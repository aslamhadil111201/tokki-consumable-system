// @ts-nocheck
import { useState } from "react";
import { useStore } from "../../store/useStore";
import { T, gText } from "../../theme/tokens";
import { emptyReturForm, RETUR_REASONS } from "../../utils/formDefaults";
import { FL } from "../ui/FL";
import { BtnP } from "../ui/BtnP";
import { BtnG } from "../ui/BtnG";
import { SearchSelect } from "../ui/SearchSelect";
import { todayStr, nowTime } from "../../utils/formatters";

export const ReturModal = ({
  open,
  onClose
}: {
  open: boolean;
  onClose: () => void;
}) => {
  const { items, employees, apiFetch, withLoading, setToast, fetchAll } = useStore();
  const [returForm, setReturForm] = useState(() => emptyReturForm());

  if (!open) return null;

  const submitRetur = async () => {
    const empName = String(returForm.employee || "").trim();
    const itemId = Number(returForm.itemId);
    const qty = Number(returForm.qty);
    if (!empName) { setToast("Nama karyawan wajib diisi", "err"); return; }
    if (!employees.some((emp: any) => String(emp?.name || "").trim().toLowerCase() === empName.toLowerCase())) { setToast("Pilih nama karyawan dari database", "err"); return; }
    if (!itemId) { setToast("Pilih barang terlebih dahulu", "err"); return; }
    if (!Number.isInteger(qty) || qty <= 0) { setToast("Jumlah harus bilangan bulat > 0", "err"); return; }
    
    await withLoading(async () => {
      try {
        const { supabase } = await import("../../lib/supabase");
        const it = items.find(i => i.id === itemId);
        const { error } = await supabase.from("returns").insert([{
          employee: empName, itemId, qty, reason: returForm.reason,
          note: String(returForm.note || "").trim(), date: todayStr(), time: nowTime()
        }]);
        if (error) throw new Error(error.message || "Gagal menyimpan retur");
        // Update item stock (add back)
        if (it) {
          const newStock = (it.stock || 0) + qty;
          await supabase.from("items").update({ stock: newStock }).eq("id", itemId);
        }
        setToast("Retur berhasil dicatat, stok telah diperbarui");
        onClose();
        setReturForm(emptyReturForm());
        fetchAll();
      } catch (e: any) { setToast(e?.message || "Gagal menyimpan retur", "err"); }
    }, "Menyimpan retur...");
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div style={{ fontSize: 20, fontWeight: 900, ...gText(), marginBottom: 4 }}>↩ Catat Retur Barang</div>
        <div style={{ fontSize: 12, color: T.muted, marginBottom: 18 }}>Barang yang diretur akan otomatis menambah stok kembali.</div>
        <div className="sect-box">
          <div className="sect-lbl">👤 Data Pengembali</div>
          <div><FL>Nama Pengembali *</FL>
            <SearchSelect options={employees.map(e => ({ value: e.name, label: e.name }))} value={returForm.employee} onChange={v => setReturForm(p => ({ ...p, employee: v }))} placeholder="— Cari/pilih karyawan —" />
          </div>
        </div>
        <div className="sect-box">
          <div className="sect-lbl">📦 Barang yang Diretur</div>
          <select className="ifield" style={{ width: "100%" }} value={returForm.itemId} onChange={e => setReturForm(p => ({ ...p, itemId: e.target.value }))}>
            <option value="">-- Pilih barang --</option>
            {items.map(it => <option key={it.id} value={it.id}>{it.name} (Stok: {it.stock} {it.unit})</option>)}
          </select>
        </div>
        <div className="sect-box">
          <div className="sect-lbl">🔢 Jumlah Dikembalikan</div>
          <input className="ifield" type="number" min="1" style={{ width: "100%" }} placeholder="Qty yang dikembalikan..." value={returForm.qty} onChange={e => setReturForm(p => ({ ...p, qty: e.target.value }))} />
        </div>
        <div className="sect-box">
          <div className="sect-lbl">📋 Alasan Retur</div>
          <select className="ifield" style={{ width: "100%" }} value={returForm.reason} onChange={e => setReturForm(p => ({ ...p, reason: e.target.value }))}>
            {RETUR_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="sect-box">
          <div className="sect-lbl">📝 Catatan Tambahan <span style={{ fontWeight: 400, color: T.muted }}>(opsional)</span></div>
          <input className="ifield" style={{ width: "100%" }} placeholder="Catatan tambahan..." value={returForm.note} onChange={e => setReturForm(p => ({ ...p, note: e.target.value }))} />
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <BtnP onClick={submitRetur} style={{ flex: 1, padding: "13px", fontSize: 14, borderRadius: 12 }}>💾 Simpan Retur</BtnP>
          <BtnG onClick={onClose}>Batal</BtnG>
        </div>
      </div>
    </div>
  );
};
