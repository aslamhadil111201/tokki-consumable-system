# Implementation Plan v2 - Redesign Menu Laporan (Report Page)

Revisi dari draft awal. Perubahan utama: menghilangkan kontradiksi rank badge (emoji vs CSS gradient), mendefinisikan logika periode-sebelumnya secara eksplisit, menangani edge case (div-by-zero, empty state), dan memperkuat verification plan.

---

## Proposed Changes

### 1. [ReportPage.tsx](file:///c:/PROJECT%20WHS/wms-app/wms-app/src/pages/report/ReportPage.tsx)

* **Perbandingan Periode Sebelumnya** — definisi eksplisit, tidak boleh ambigu saat implementasi:
  * **Minggu**: 7 hari kalender terakhir (rolling), dibandingkan dengan 7 hari sebelum itu. Bukan minggu ISO.
  * **Bulan**: bulan kalender berjalan (tanggal 1 s/d hari ini), dibandingkan dengan bulan kalender sebelumnya penuh.
  * **Tahun**: tahun kalender berjalan, dibandingkan tahun kalender sebelumnya.
  * Variabel: `reportOutPrev`, `reportInPrev`, `reportValuePrev` — hasil query dengan rentang tanggal sesuai definisi di atas.
  * **Guard pembagian nol**: fungsi `calcTrendPercent(current, prev)` mengembalikan `null` jika `prev === 0` dan `current === 0` (tidak ada perubahan, tampilkan `–`), atau string `"Baru"` / indikator khusus jika `prev === 0` dan `current > 0` (tidak ada basis pembanding, hindari `Infinity%`).
  * Jangan render badge tren sama sekali jika hasil `null` — bukan menampilkan `NaN%` atau `Infinity%`.

* **Segmented Pill Control**: bungkus seleksi periode dalam `.report-period-pill`, satu elemen indikator aktif (`.pill-indicator`) yang di-transform via CSS (bukan re-render tiga tombol terpisah) agar transisi slide mulus.

* **Date Badge & Icon**: ikon kalender pada info rentang tanggal. Gunakan SVG icon, bukan emoji 📅 (lihat alasan konsistensi rendering di bagian Rank Badge di bawah).

* **KPI Card Glow**: kelas dinamis `glow-red`, `glow-green`, `glow-primary`, `glow-amber` + badge tren dari `calcTrendPercent`. Sertakan state `null` → sembunyikan badge, jangan tampilkan placeholder kosong yang bikin layout jumping.

* **Bar Chart Grid & Gradients**: `.chart-container-relative` membungkus grid `.chart-grid-lines` di belakang bar. Bar pakai `linear-gradient` atas-bawah via CSS class, bukan inline style per-elemen (memudahkan theming & mengurangi re-render cost).

* **Empty state**: jika dataset kosong (departemen/project/tren tanpa transaksi pada periode terpilih), render komponen `<EmptyState />` sederhana, bukan chart kosong dengan grid/glow tanpa konten.

* **Rank Badge — KEPUTUSAN FINAL: CSS, bukan emoji.**
  Ganti rencana `🥇🥈🥉` dengan elemen `<span className="rank-badge rank-1">1</span>` dst. Alasan: emoji dirender oleh font sistem OS, sehingga gradient warna logam yang dirancang di CSS (poin di bawah) tidak akan pernah terlihat — kontradiksi ini yang menyebabkan revisi dokumen ini. Badge peringkat ≥4 pakai `.rank-default` (abu-abu netral), bukan emoji atau angka polos tanpa styling.

### 2. [ReportPage.css](file:///c:/PROJECT%20WHS/wms-app/wms-app/src/pages/report/ReportPage.css)

* **Premium Segmented Pill**: `.report-period-pill`, `.pill-indicator` (posisi absolute, transisi `transform` bukan `left/width` untuk performa GPU), `.period-btn` dengan state active/inactive.

* **KPI Glow & Hover Lift**: `::after` radial-gradient per warna, `transition: transform 150ms ease, box-shadow 150ms ease`, `transform: translateY(-4px)` saat hover. Tambahkan `will-change: transform` hanya saat hover aktif (lewat class), bukan permanen, untuk menghindari beban memory GPU yang tidak perlu.

* **Bar Chart**:
  * `.chart-container-relative` posisi grid di belakang bar (`z-index` / stacking context jelas).
  * `.grid-line` opasitas 5%.
  * Bar: `border-radius` atas, `background: linear-gradient(...)` per kelas `.bar-out` / `.bar-in`.
  * **Hover interaction — revisi performa**: gunakan `transform: scaleY()` (bukan properti yang memicu layout) untuk scale-up bar aktif, dan `opacity` untuk fade bar lain, dibatasi pada container dengan `contain: layout paint` agar repaint tidak menyebar ke seluruh halaman saat dataset besar (misal transaksi harian sebulan penuh, ~30 bar).

* **Rank Badge Colors**: gradient logam untuk `.rank-1` (emas), `.rank-2` (perak), `.rank-3` (perunggu); `.rank-default` abu-abu netral untuk peringkat ≥4. Ini satu-satunya sumber kebenaran visual untuk ranking — TSX tidak lagi merender emoji apa pun untuk badge ini.

* **Aksesibilitas warna keluar/masuk**: selain merah/hijau, tambahkan ikon arah kecil (▲/▼ atau ikon panah) di sebelah nilai KPI dan bar chart agar tidak murni bergantung pada hue untuk membedakan keluar vs masuk (mendukung user dengan color vision deficiency).

---

## Verification Plan

### Automated Tests
- `npm run build` — validasi TypeScript compile & syntax.
- Unit test untuk `calcTrendPercent`: kasus normal, `prev === 0 && current === 0`, `prev === 0 && current > 0`, `prev < 0` tidak mungkin terjadi tapi tetap divalidasi tipe.
- Snapshot test (jika ada test harness snapshot, mis. Jest) untuk komponen KPI Card dan Rank Badge di 3 state: normal, empty, trend-null.

### Manual Verification
Checklist eksplisit, bukan "verifikasi visual" generik:
- [ ] Tombol Periode: transisi slide mulus, tidak ada layout shift, keyboard-accessible (tab + enter berfungsi).
- [ ] KPI Card: glow tampil sesuai warna, hover lift bekerja, badge tren `null` tidak tampil (bukan kosong dengan spasi aneh).
- [ ] KPI Card saat `prev === 0`: menampilkan indikator "Baru" bukan `Infinity%`.
- [ ] Bar Chart: grid horizontal terlihat samar (5%), gradient bar sesuai warna, hover scale-up + fade bar lain lancar di dataset ~30 data point (uji dengan bulan penuh).
- [ ] Rank Badge: warna emas/perak/perunggu tampil dari CSS (bukan emoji sistem) — cek konsisten di Chrome, Firefox, Safari, dan minimal satu browser mobile (Android WebView jika WMS dipakai di tablet gudang).
- [ ] Empty state: departemen/project tanpa data pada periode terpilih menampilkan pesan kosong, bukan chart glow tanpa isi.
- [ ] Breakpoint: mobile (≤480px), tablet (768px), desktop (≥1024px) — tidak ada elemen overflow atau overlap.
- [ ] Color vision check: keluar/masuk bisa dibedakan tanpa warna (screenshot lalu convert grayscale, cek ikon arah masih membedakan).

### Rollback Plan
- Perubahan dibungkus di belakang feature flag `ENABLE_REPORT_REDESIGN` (env var atau config sederhana) selama masa observasi awal, ATAU minimal commit terpisah dari perubahan logic (`calcTrendPercent`, query periode) vs perubahan visual murni (CSS), sehingga rollback visual tidak perlu menyentuh logic perhitungan.
