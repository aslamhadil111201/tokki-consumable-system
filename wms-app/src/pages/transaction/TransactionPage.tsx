// @ts-nocheck
import { useState, useEffect } from "react";
import "./TransactionPage.css";

import { Badge } from "../../components/ui/Badge";
import { BtnP } from "../../components/ui/BtnP";
import { BtnG } from "../../components/ui/BtnG";
import { fmtDate, todayStr, nowTime, fmtDateExcel } from "../../utils/formatters";
import { avatarColor, initials, csvText, csvEscape, triggerDownload, toSafeRows } from "../../utils/helpers";
import { EXCEL_ICON, PDF_ICON } from "../../constants/index";
import { useStore } from "../../store/useStore";
import { TransactionModal } from "../../components/modals/TransactionModal";
import { ReturModal } from "../../components/modals/ReturModal";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { getT } from "../../theme/tokens";

export function TransactionPage() {
  const { trx, returns, itemMap, user, apiFetch, withLoading, setToast, fetchAll, dark } = useStore();
  const T = getT(dark);
  
  const [returSubTab, setReturSubTab] = useState("log");
  const [trxDate, setTrxDate] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showRetur, setShowRetur] = useState(false);

  const [trxPage, setTrxPage] = useState(1);
  const [trxPageSize, setTrxPageSize] = useState(8);

  const [returPage, setReturPage] = useState(1);
  const [returPageSize, setReturPageSize] = useState(8);

  useEffect(() => {
    setTrxPage(1);
  }, [trxDate]);

  const isAdmin = (user?.role || "").toLowerCase() === "admin";
  const filtTrx = [...trx].reverse().filter((t: any) => !trxDate || t.date === trxDate);

  const totalPages = Math.ceil(filtTrx.length / Math.max(1, trxPageSize));
  const currentTrxPage = trxPage > totalPages ? 1 : trxPage;
  const pagedTrx = filtTrx.slice((currentTrxPage - 1) * trxPageSize, currentTrxPage * trxPageSize);

  const totalReturPages = Math.ceil(returns.length / Math.max(1, returPageSize));
  const currentReturPage = returPage > totalReturPages ? 1 : returPage;
  const pagedReturns = [...returns].reverse().slice((currentReturPage - 1) * returPageSize, currentReturPage * returPageSize);

  const deleteTransaction = async (id: number) => {
    if (!isAdmin) { setToast("Hanya admin yang boleh menghapus transaksi", "err"); return; }
    if (!window.confirm("Hapus transaksi ini?")) return;
    await withLoading(async () => {
      try {
        const { supabase } = await import("../../lib/supabase");
        const { error } = await supabase.from("transactions").delete().eq("id", id);
        if (error) throw new Error(error.message || "Gagal menghapus transaksi");
        setToast("Transaksi dihapus");
        await fetchAll();
      } catch (e: any) { setToast(e?.message || "Gagal menghapus transaksi", "err"); }
    }, "Sedang menghapus transaksi");
  };

  const exportTransactionsExcel = () => {
    const source = filtTrx;
    const unitTotal = source.reduce((acc, t) => acc + toSafeRows(t.items).reduce((x, it) => x + Number(it.qty || 0), 0), 0);
    const rows = [
      ["Warehouse Management System"],
      ["Laporan Riwayat Pengambilan"],
      [`Periode`, trxDate ? fmtDate(trxDate) : "Semua Periode"],
      [`Total Data`, source.length],
      [`Total Unit`, unitTotal],
      [],
      ["ID", "Tanggal", "Waktu", "Pengambil", "Section", "Project", "Admin", "Item", "Qty", "Unit", "Keterangan"],
      ...toSafeRows(source).flatMap(t => toSafeRows(t.items).map(it => [
        csvText(t.id), fmtDateExcel(t.date), t.time, t.taker, t.dept, t.workOrder || "", t.admin || "", it.itemName, it.qty, it.unit, t.note || "",
      ])),
    ];
    const csv = "\uFEFF" + rows.map(r => r.map(v => typeof v === "string" && v.startsWith("=") ? v : csvEscape(v)).join(",")).join("\n");
    triggerDownload(`riwayat-pengambilan-${todayStr()}.csv`, csv, "text/csv;charset=utf-8;");
    setToast("Export Excel (CSV) pengambilan berhasil");
  };

  const exportReturnsExcel = () => {
    const source = returns;
    const unitTotal = source.reduce((a, r) => a + Number(r.qty || 0), 0);
    const rows = [
      ["Warehouse Management System"],
      ["Laporan Retur Barang"],
      ["Total Data", source.length],
      ["Total Unit", unitTotal],
      [],
      ["ID", "Tanggal", "Waktu", "Karyawan", "Item", "Qty", "Unit", "Alasan", "Catatan", "Status"],
      ...toSafeRows(source).map(r => {
        const it = itemMap[Number(r.itemId)];
        return [
          csvText(r.id), fmtDateExcel(r.date), r.time || "", r.employee,
          it?.name || r.itemName || `Item #${r.itemId}`, r.qty, it?.unit || "pcs", r.reason, r.note || "", r.status || "Menunggu",
        ];
      }),
    ];
    const csv = "\uFEFF" + rows.map(r => r.map(v => typeof v === "string" && v.startsWith("=") ? v : csvEscape(v)).join(",")).join("\n");
    triggerDownload(`retur-barang-${todayStr()}.csv`, csv, "text/csv;charset=utf-8;");
    setToast("Export Excel (CSV) retur berhasil");
  };

  const downloadPdfTable = ({ fileName, title, subtitle, headers, rows }: any) => {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.text(String(title || "Laporan"), 40, 32);
    if (subtitle) { doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text(String(subtitle), 40, 50); }
    autoTable(doc, {
      startY: subtitle ? 62 : 46,
      head: [headers.map((h: any) => String(h ?? ""))],
      body: rows.map((r: any) => toSafeRows(r).map(c => String(c ?? ""))),
      styles: { font: "helvetica", fontSize: 8, cellPadding: 4, overflow: "linebreak" },
      headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: "bold" },
      margin: { left: 40, right: 40, top: 40, bottom: 30 }, theme: "grid",
    });
    doc.save(fileName || `laporan-${todayStr()}.pdf`);
  };

  const exportTransactionsPdf = () => {
    const source = filtTrx;
    const unitTotal = source.reduce((acc, t) => acc + toSafeRows(t.items).reduce((x, it) => x + Number(it.qty || 0), 0), 0);
    const rows = toSafeRows(source).flatMap(t => toSafeRows(t.items).map(it => [
      t.id, t.date, t.time, t.taker, t.dept, t.workOrder || "", t.admin || "", it.itemName, `${it.qty} ${it.unit}`, t.note || "",
    ]));
    downloadPdfTable({
      fileName: `riwayat-pengambilan-${todayStr()}.pdf`, title: `Riwayat Pengambilan`,
      subtitle: `Total data: ${source.length} | Total unit: ${unitTotal}`,
      headers: ["ID", "Tanggal", "Waktu", "Pengambil", "Section", "Project", "Admin", "Item", "Qty", "Ket"], rows,
    });
    setToast("Export PDF pengambilan berhasil");
  };

  const exportReturnsPdf = () => {
    const source = returns;
    const unitTotal = source.reduce((a, r) => a + Number(r.qty || 0), 0);
    const rows = toSafeRows(source).map(r => {
      const it = itemMap[Number(r.itemId)];
      return [r.id, r.date, r.time || "", r.employee, it?.name || r.itemName || `Item #${r.itemId}`, `${r.qty} ${it?.unit || "pcs"}`, r.reason, r.note || "", r.status || "Menunggu"];
    });
    downloadPdfTable({
      fileName: `retur-barang-${todayStr()}.pdf`, title: `Retur Barang`,
      subtitle: `Total data: ${source.length} | Total unit: ${unitTotal}`,
      headers: ["ID", "Tanggal", "Waktu", "Karyawan", "Item", "Qty", "Alasan", "Catatan", "Status"], rows,
    });
    setToast("Export PDF retur berhasil");
  };

  return (
    <div>
      {/* ── Panel header ── */}
      <div className="trx-panel-header">
        <div className="trx-panel-title-wrap">
          <div className="trx-panel-icon">📤</div>
          <div>
            <div className="trx-panel-title">Catat Pengambilan Barang</div>
            <div className="trx-panel-subtitle">Catat pengambilan barang oleh karyawan. Satu transaksi bisa beberapa barang.</div>
          </div>
        </div>
        <div className="trx-panel-actions">
          {isAdmin && (
            returSubTab === "log"
              ? <BtnG onClick={exportTransactionsExcel} style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>{EXCEL_ICON}Excel</BtnG>
              : <BtnG onClick={exportReturnsExcel} style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>{EXCEL_ICON}Excel</BtnG>
          )}
          {isAdmin && (
            returSubTab === "log"
              ? <BtnG onClick={exportTransactionsPdf} style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>{PDF_ICON}PDF</BtnG>
              : <BtnG onClick={exportReturnsPdf} style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>{PDF_ICON}PDF</BtnG>
          )}
          <button onClick={() => setShowRetur(true)} className="trx-btn-catat-retur">↩ Catat Retur</button>
          <BtnP onClick={() => setShowModal(true)} style={{ flexShrink: 0, padding: "12px 20px", borderRadius: 14, fontWeight: 800 }}>＋ Catat Pengambilan</BtnP>
        </div>
      </div>

      {/* ── Sub-tabs ── */}
      <div className="trx-tabs-container">
        {[
          { id: "log", icon: "📤", label: `Log Pengambilan (${trx.length})` },
          { id: "retur", icon: "↩", label: `Retur Barang (${returns.length})` },
        ].map(tb => (
          <button key={tb.id} onClick={() => setReturSubTab(tb.id)} className={`trx-tab-btn ${returSubTab === tb.id ? 'trx-tab-btn-active' : 'trx-tab-btn-inactive'}`}>
            {tb.icon} {tb.label}
          </button>
        ))}
      </div>

      {/* ── Sub-tab: LOG PENGAMBILAN ── */}
      {returSubTab === "log" && (
        <div>
          <div className="fbar">
            <span className="fbar-label">Filter tanggal:</span>
            <input type="date" className="ifield trx-date-input" style={{ maxWidth: 160 }} value={trxDate} onChange={e => setTrxDate(e.target.value)} onClick={e => e.currentTarget.showPicker()} />
            {trxDate && <BtnG style={{ fontSize: 11.5, padding: "7px 12px" }} onClick={() => setTrxDate("")}>✕ Reset</BtnG>}
            <select className="ifield" style={{ width: 120, marginLeft: 8 }} value={trxPageSize} onChange={e => { setTrxPageSize(Number(e.target.value) || 8); setTrxPage(1); }}>
              {[8, 12, 24, 48].map(n => <option key={n} value={n}>{n}/hal</option>)}
            </select>
            <span className="fbar-count">{filtTrx.length} transaksi</span>
          </div>
          {filtTrx.length === 0
            ? <div className="trx-empty-state"><div className="trx-empty-icon">📂</div>Tidak ada transaksi ditemukan</div>
            : pagedTrx.map(t => (
              <div key={t.id} className="trx-card">
                <div className="trx-head">
                  <div className="trx-avatar" style={{ background: avatarColor(t.taker), boxShadow: `0 4px 10px ${avatarColor(t.taker)}55` }}>
                    {initials(t.taker)}
                  </div>
                  <div className="trx-info">
                    <div className="trx-info-name">{t.taker}</div>
                    <div className="trx-info-meta">{t.dept} · {fmtDate(t.date)} · {t.time}</div>
                    <div className="trx-info-badges">
                      {t.workOrder && <Badge bg="var(--t-green-bg)" color="var(--t-green-text)" border="var(--t-green-border)">🔧 {t.workOrder}</Badge>}
                      {t.note && <Badge bg="var(--t-surface)" color="var(--t-muted)" border="var(--t-border)">📝 {t.note}</Badge>}
                      <Badge bg="var(--t-nav-active)" color="var(--t-nav-active-text)" border="var(--t-nav-active-border)">Admin: {t.admin}</Badge>
                    </div>
                  </div>
                  <div className="trx-stats">
                    <div>
                      <div className="trx-stat-qty">{t.items.length}</div>
                      <div className="trx-stat-lbl">jenis</div>
                      <div className="trx-stat-unit">{t.items.reduce((a: number, i: any) => a + i.qty, 0)} unit</div>
                    </div>
                    {isAdmin && (
                      <button onClick={() => deleteTransaction(t.id)} className="trx-btn-delete">🗑 Hapus</button>
                    )}
                  </div>
                </div>
                <div className="trx-body">
                  {t.items.map((it: any, ii: number) => (
                    <div key={ii} className="itm-pill">
                      <span className="trx-item-name">{it.itemName}</span>
                      <span className="trx-item-qty">×{it.qty} {it.unit}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

          {/* Pagination */}
          {filtTrx.length > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11.5, color: T.muted, fontWeight: 600 }}>Menampilkan {(currentTrxPage - 1) * trxPageSize + 1}-{Math.min(currentTrxPage * trxPageSize, filtTrx.length)} dari {filtTrx.length} transaksi</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button onClick={() => setTrxPage(p => Math.max(1, p - 1))} disabled={currentTrxPage <= 1}
                  style={{ display: "flex", alignItems: "center", gap: 4, padding: "8px 16px", borderRadius: 9, border: `1px solid ${T.border}`, background: T.surface, color: currentTrxPage <= 1 ? T.muted : T.text, fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 12.5, fontWeight: 700, cursor: currentTrxPage <= 1 ? "default" : "pointer", opacity: currentTrxPage <= 1 ? 0.5 : 1, transition: "all .18s" }}>
                  ‹ Prev
                </button>
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button key={i} onClick={() => setTrxPage(i + 1)}
                    style={{ width: 36, height: 36, borderRadius: 9, border: `1px solid ${currentTrxPage === i + 1 ? T.primary : T.border}`, background: currentTrxPage === i + 1 ? T.primary : T.surface, color: currentTrxPage === i + 1 ? "white" : T.muted, fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 13, fontWeight: 800, cursor: "pointer", transition: "all .18s" }}>
                    {i + 1}
                  </button>
                ))}
                <button onClick={() => setTrxPage(p => Math.min(totalPages, p + 1))} disabled={currentTrxPage >= totalPages}
                  style={{ display: "flex", alignItems: "center", gap: 4, padding: "8px 16px", borderRadius: 9, border: `1px solid ${T.border}`, background: T.surface, color: currentTrxPage >= totalPages ? T.muted : T.text, fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 12.5, fontWeight: 700, cursor: currentTrxPage >= totalPages ? "default" : "pointer", opacity: currentTrxPage >= totalPages ? 0.5 : 1, transition: "all .18s" }}>
                  Next ›
                </button>
              </div>
              <select value={trxPageSize} onChange={e => { setTrxPageSize(Number(e.target.value) || 8); setTrxPage(1); }}
                style={{ padding: "8px 12px", borderRadius: 9, border: `1px solid ${T.border}`, background: T.surface, color: T.text, fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer", outline: "none" }}>
                {[8, 12, 24, 48].map(n => <option key={n} value={n}>{n} / halaman</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      {/* ── Sub-tab: RETUR BARANG ── */}
      {returSubTab === "retur" && (
        <div>
          {/* Summary cards */}
          <div className="stats-g retur-stats-g">
            {(() => {
              const totalUnit = returns.reduce((a, r) => a + Number(r.qty || 0), 0);
              const pending = returns.filter(r => r.status === "Menunggu").length;
              const diterima = returns.filter(r => r.status === "Diterima").length;
              return [
                { label: "Total Retur", val: returns.length, icon: "↩", color: "var(--t-amber)", bg: "var(--t-amber-bg)", sub: "total catatan" },
                { label: "Unit Dikembalikan", val: totalUnit, icon: "📦", color: "var(--t-green)", bg: "var(--t-green-bg)", sub: "unit barang kembali" },
                { label: "Diterima", val: diterima, icon: "✅", color: "var(--t-primary)", bg: "var(--t-nav-active)", sub: "sudah diproses" },
                { label: "Menunggu", val: pending, icon: "⏳", color: "var(--t-red)", bg: "var(--t-red-bg)", sub: "menunggu konfirmasi" },
              ];
            })().map((s, i) => (
              <div key={i} className="stat-card retur-stat-card">
                <div className="retur-stat-inner">
                  <div>
                    <div className="retur-stat-label">{s.label}</div>
                    <div className="retur-stat-val">{s.val}</div>
                    <div className="retur-stat-sub">{s.sub}</div>
                  </div>
                  <div className="retur-stat-icon" style={{ background: s.bg, color: s.color }}>{s.icon}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Retur list */}
          {returns.length === 0
            ? <div className="trx-empty-state"><div className="trx-empty-icon">↩</div>Belum ada retur tercatat</div>
            : pagedReturns.map(r => {
              const it = itemMap[Number(r.itemId)];
              const isDiterima = r.status === "Diterima";
              return (
                <div key={r.id} className="retur-card">
                  <div className="retur-card-icon-wrap">
                    <div className="retur-card-icon">↩</div>
                    <span className="retur-card-lbl">RETUR</span>
                  </div>
                  <div className="retur-card-body">
                    <div className="retur-card-header">
                      <span className="retur-emp-name">{r.employee}</span>
                      <span className="retur-status-badge" style={{ border: `1px solid ${isDiterima ? "var(--t-green-border)" : "var(--t-red-border)"}`, background: isDiterima ? "var(--t-green-bg)" : "var(--t-red-bg)", color: isDiterima ? "var(--t-green-text)" : "var(--t-red-text)" }}>{r.status || "Menunggu"}</span>
                    </div>
                    <div className="retur-item-row">
                      <span className="retur-item-icon">📦</span>
                      <span className="retur-item-name">{it?.name || r.itemName || `Item #${r.itemId}`}</span>
                      <span className="retur-item-qty">+{r.qty} {it?.unit || "pcs"}</span>
                    </div>
                    <div className="retur-badges">
                      <Badge bg="var(--t-amber-bg)" color="var(--t-amber)" border="1px solid rgba(245, 158, 11, 0.2)">📋 {r.reason}</Badge>
                      {r.note && <Badge bg="var(--t-surface)" color="var(--t-muted)" border="var(--t-border)">📝 {r.note}</Badge>}
                      <Badge bg="var(--t-surface)" color="var(--t-muted)" border="var(--t-border)">🗓 {fmtDate(r.date)} {r.time || ""}</Badge>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="retur-actions">
                      {!isDiterima && (
                        <button onClick={async () => {
                          await withLoading(async () => {
                            try {
                              const { supabase } = await import("../../lib/supabase");
                              const { error } = await supabase.from("returns").update({ status: "Diterima" }).eq("id", r.id);
                              if (error) throw new Error(error.message || "Gagal update status");
                              setToast("Status retur diperbarui ✓");
                              fetchAll();
                            } catch (e: any) { setToast(e?.message || "Gagal update status", "err"); }
                          }, "Memperbarui...");
                        }} className="retur-btn-terima">✅ Terima</button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          }

          {/* Pagination Retur */}
          {returns.length > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11.5, color: T.muted, fontWeight: 600 }}>Menampilkan {(currentReturPage - 1) * returPageSize + 1}-{Math.min(currentReturPage * returPageSize, returns.length)} dari {returns.length} data</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button onClick={() => setReturPage(p => Math.max(1, p - 1))} disabled={currentReturPage <= 1}
                  style={{ display: "flex", alignItems: "center", gap: 4, padding: "8px 16px", borderRadius: 9, border: `1px solid ${T.border}`, background: T.surface, color: currentReturPage <= 1 ? T.muted : T.text, fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 12.5, fontWeight: 700, cursor: currentReturPage <= 1 ? "default" : "pointer", opacity: currentReturPage <= 1 ? 0.5 : 1, transition: "all .18s" }}>
                  ‹ Prev
                </button>
                {Array.from({ length: totalReturPages }).map((_, i) => (
                  <button key={i} onClick={() => setReturPage(i + 1)}
                    style={{ width: 36, height: 36, borderRadius: 9, border: `1px solid ${currentReturPage === i + 1 ? T.primary : T.border}`, background: currentReturPage === i + 1 ? T.primary : T.surface, color: currentReturPage === i + 1 ? "white" : T.muted, fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 13, fontWeight: 800, cursor: "pointer", transition: "all .18s" }}>
                    {i + 1}
                  </button>
                ))}
                <button onClick={() => setReturPage(p => Math.min(totalReturPages, p + 1))} disabled={currentReturPage >= totalReturPages}
                  style={{ display: "flex", alignItems: "center", gap: 4, padding: "8px 16px", borderRadius: 9, border: `1px solid ${T.border}`, background: T.surface, color: currentReturPage >= totalReturPages ? T.muted : T.text, fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 12.5, fontWeight: 700, cursor: currentReturPage >= totalReturPages ? "default" : "pointer", opacity: currentReturPage >= totalReturPages ? 0.5 : 1, transition: "all .18s" }}>
                  Next ›
                </button>
              </div>
              <select value={returPageSize} onChange={e => { setReturPageSize(Number(e.target.value) || 8); setReturPage(1); }}
                style={{ padding: "8px 12px", borderRadius: 9, border: `1px solid ${T.border}`, background: T.surface, color: T.text, fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer", outline: "none" }}>
                {[8, 12, 24, 48].map(n => <option key={n} value={n}>{n} / halaman</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Render Modals isolated */}
      <TransactionModal open={showModal} onClose={() => setShowModal(false)} />
      <ReturModal open={showRetur} onClose={() => setShowRetur(false)} />
    </div>
  );
}
