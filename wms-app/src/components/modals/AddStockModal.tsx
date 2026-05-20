// @ts-nocheck
import { useState } from "react";
import { useStore } from "../../store/useStore";
import { T, gText } from "../../theme/tokens";
import { emptyAddForm } from "../../utils/formDefaults";
import { FL } from "../ui/FL";
import { BtnP } from "../ui/BtnP";
import { BtnG } from "../ui/BtnG";
import { SearchSelect } from "../ui/SearchSelect";
import { fmtMoney } from "../../utils/formatters";

export const AddStockModal = ({
  open,
  onClose,
  initialItem = null
}: {
  open: boolean;
  onClose: () => void;
  initialItem?: any;
}) => {
  const { items, admins, apiFetch, withLoading, setToast, fetchAll, user } = useStore();
  
  const [addForm, setAddForm] = useState(() => emptyAddForm(
    initialItem ? { itemId: String(initialItem.id), buyPrice: initialItem.lastPrice ? String(initialItem.lastPrice) : "", qty: "1" } : {}
  ));
  const [addFormDragOver, setAddFormDragOver] = useState(false);

  const canManage = (user?.role || "").toLowerCase() === "admin" || (user?.role || "").toLowerCase() === "operator";

  if (!open) return null;

  const submitAdd = async () => {
    if (!canManage) { setToast("Hanya admin/operator yang boleh menambah stok", "err"); return; }
    if (!addForm.itemId || !addForm.qty || +addForm.qty < 1 || !addForm.admin) { setToast("Lengkapi semua field wajib", "err"); return; }
    const effectiveBuyPrice = Number(addForm.buyPrice);
    if (!Number.isFinite(effectiveBuyPrice) || effectiveBuyPrice < 0) { setToast("Harga beli wajib angka >= 0", "err"); return; }
    
    await withLoading(async () => {
      try {
        const { supabase } = await import("../../lib/supabase");
        const it = items.find(i => i.id === +addForm.itemId);
        const itemName = it?.name || "";
        const unit = it?.unit || "pcs";
        const { error } = await supabase.from("receives").insert([{
          itemId: +addForm.itemId, itemName, qty: +addForm.qty, unit,
          buyPrice: effectiveBuyPrice, poNumber: addForm.poNumber, doNumber: addForm.doNumber,
          date: addForm.date, admin: addForm.admin, attachment: addForm.attachment || null
        }]);
        if (error) throw new Error(error.message || "Gagal menyimpan penerimaan");
        // Update item stock
        if (it) {
          const newStock = (it.stock || 0) + (+addForm.qty);
          await supabase.from("items").update({ stock: newStock, lastPrice: effectiveBuyPrice }).eq("id", it.id);
        }
        setAddForm(emptyAddForm()); onClose();
        setToast("Stok berhasil ditambahkan \u2713");
        await fetchAll();
      } catch (err: any) { setToast(err?.message || "Gagal menyimpan penerimaan", "err"); }
    }, "Sedang menyimpan penerimaan");
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div style={{ fontSize: 22, fontWeight: 900, ...gText(), marginBottom: 4 }}>📥 Receive New</div>
        <div style={{ fontSize: 12, color: T.muted, marginBottom: 22 }}>Catat penerimaan barang dan tambahkan stok ke inventaris</div>
        <div className="sect-box">
          <div className="sect-lbl">📄 Dokumen Penerimaan</div>
          <div className="mgrid">
            <div><FL>PO Number</FL><input className="ifield" placeholder="Nomor Purchase Order" value={addForm.poNumber} onChange={e => setAddForm({ ...addForm, poNumber: e.target.value })} /></div>
            <div><FL>Delivery Order Number</FL><input className="ifield" placeholder="Nomor Delivery Order" value={addForm.doNumber} onChange={e => setAddForm({ ...addForm, doNumber: e.target.value })} /></div>
            <div><FL>Tanggal *</FL><input className="ifield" type="date" value={addForm.date} onChange={e => setAddForm({ ...addForm, date: e.target.value })} /></div>
            <div><FL>Admin Warehouse *</FL>
              <SearchSelect options={admins.map(a => ({ value: a.name, label: a.name }))} value={addForm.admin} onChange={v => setAddForm({ ...addForm, admin: v })} placeholder="— Cari/pilih admin —" />
            </div>
          </div>
        </div>
        <div className="sect-box">
          <div className="sect-lbl">📦 Barang yang Diterima</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div><FL>Nama Barang *</FL>
              <SearchSelect
                options={items.map(i => ({ value: String(i.id), label: `${i.name} (stok: ${i.stock} ${i.unit})` }))}
                value={addForm.itemId}
                onChange={v => setAddForm({ ...addForm, itemId: v })}
                placeholder="— Cari/pilih barang —"
              />
            </div>
            {addForm.itemId && (() => {
              const it = items.find(i => i.id === +addForm.itemId); return it ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ flex: 1, background: T.navActive, border: `1px solid ${T.navActiveBorder}`, borderRadius: 10, padding: "10px 13px" }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: T.muted, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 4 }}>Kategori</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.navActiveText }}>{it.category}</div>
                  </div>
                  <div style={{ flex: 1, background: T.navActive, border: `1px solid ${T.navActiveBorder}`, borderRadius: 10, padding: "10px 13px" }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: T.muted, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 4 }}>Stok Saat Ini</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.navActiveText }}>{it.stock} {it.unit}</div>
                  </div>
                </div>
              ) : null;
            })()}
            <div><FL>Jumlah Diterima *</FL>
              <input className="ifield" type="number" min="1" placeholder="0"
                value={addForm.qty} onChange={e => setAddForm({ ...addForm, qty: e.target.value })} />
            </div>
            <div><FL>Harga Beli / Unit *</FL>
              <input className="ifield" type="number" min="0" placeholder="0"
                value={addForm.buyPrice} onChange={e => setAddForm({ ...addForm, buyPrice: e.target.value })} />
            </div>
            {addForm.itemId && (() => {
              const it = items.find(i => i.id === +addForm.itemId); return it ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div style={{ background: T.navActive, border: `1px solid ${T.navActiveBorder}`, borderRadius: 10, padding: "10px 13px" }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: T.muted, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 4 }}>Harga Avg Saat Ini</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.navActiveText }}>{fmtMoney(it.averageCost)}</div>
                  </div>
                  <div style={{ background: T.navActive, border: `1px solid ${T.navActiveBorder}`, borderRadius: 10, padding: "10px 13px" }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: T.muted, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 4 }}>Last Price</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.navActiveText }}>{fmtMoney(it.lastPrice)}</div>
                  </div>
                </div>
              ) : null;
            })()}
          </div>
        </div>
        {/* ── Lampiran ── */}
        <div className="sect-box">
          <div className="sect-lbl">📎 Lampiran Dokumen <span style={{ fontWeight: 400, fontSize: 10, color: T.muted }}>(opsional · PDF, JPG, PNG · maks 10MB)</span></div>
          <div
            onDragOver={e => { e.preventDefault(); setAddFormDragOver(true); }}
            onDragLeave={() => setAddFormDragOver(false)}
            onDrop={e => {
              e.preventDefault(); setAddFormDragOver(false);
              const f = e.dataTransfer.files?.[0]; if (!f) return;
              if (!["image/jpeg", "image/png", "application/pdf"].includes(f.type)) { setToast("Hanya PDF, JPG, PNG yang diizinkan", "err"); return; }
              if (f.size > 10485760) { setToast("Ukuran lampiran maks 10MB", "err"); return; }
              const reader = new FileReader();
              reader.onload = ev => setAddForm(p => ({ ...p, attachment: ev.target?.result as string || null }));
              reader.readAsDataURL(f);
            }}
            style={{ border: `2px dashed ${addFormDragOver ? T.primary : T.border}`, borderRadius: 12, padding: "18px 16px", textAlign: "center", transition: "border-color .2s", background: addFormDragOver ? T.navActive : "transparent", cursor: "pointer" }}
            onClick={() => { if (!addForm.attachment) (document.getElementById("attach-upload-input") as HTMLInputElement)?.click(); }}
          >
            {addForm.attachment ? (() => {
              const isPdf = addForm.attachment.startsWith("data:application/pdf");
              return (
                <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center" }}>
                  <span style={{ fontSize: 28 }}>{isPdf ? "📄" : "🖼️"}</span>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: T.navActiveText }}>{isPdf ? "Dokumen PDF" : "Gambar"} terlampir</div>
                    <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>Klik ✕ untuk hapus</div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); setAddForm(p => ({ ...p, attachment: null })); }} style={{ marginLeft: 8, background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 16, fontWeight: 700 }}>✕</button>
                </div>
              );
            })() : (
              <div>
                <div style={{ fontSize: 24, marginBottom: 6 }}>📂</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.muted }}>Drag & drop file ke sini, atau <span style={{ color: T.primary, fontWeight: 700 }}>klik untuk pilih</span></div>
              </div>
            )}
            <input id="attach-upload-input" type="file" accept=".pdf,.jpg,.jpeg,.png,image/jpeg,image/png,application/pdf" style={{ display: "none" }} onChange={e => {
              const f = e.target.files?.[0]; if (!f) return;
              if (!["image/jpeg", "image/png", "application/pdf"].includes(f.type)) { setToast("Hanya PDF, JPG, PNG yang diizinkan", "err"); return; }
              if (f.size > 10485760) { setToast("Ukuran lampiran maks 10MB", "err"); return; }
              const reader = new FileReader();
              reader.onload = ev => setAddForm(p => ({ ...p, attachment: ev.target?.result as string || null }));
              reader.readAsDataURL(f);
              e.target.value = "";
            }} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <BtnP onClick={submitAdd} style={{ flex: 1, padding: "13px", fontSize: 14, borderRadius: 12 }}>💾 Simpan Penerimaan</BtnP>
          <BtnG onClick={onClose}>Batal</BtnG>
        </div>
      </div>
    </div>
  );
};
