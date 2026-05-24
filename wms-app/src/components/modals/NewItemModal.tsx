// @ts-nocheck
import { useState } from "react";
import { useStore } from "../../store/useStore";
import { T, gText } from "../../theme/tokens";
import { emptyNewItem } from "../../utils/formDefaults";
import { ITEM_CATEGORIES, MAX_STOCK_VALUE, MAX_TEXT_LEN } from "../../constants/index";
import { FL } from "../ui/FL";
import { BtnP } from "../ui/BtnP";
import { BtnG } from "../ui/BtnG";

export const NewItemModal = ({
  open,
  onClose
}: {
  open: boolean;
  onClose: () => void;
}) => {
  const { withLoading, setToast, fetchAll, user } = useStore();
  const [newItemForm, setNewItemForm] = useState(() => emptyNewItem());

  const canManage = (user?.role || "").toLowerCase() === "admin" || (user?.role || "").toLowerCase() === "operator";

  if (!open) return null;

  const submitNewItem = async () => {
    if (!canManage) { setToast("Hanya admin/operator yang boleh menambah item", "err"); return; }
    const name = String(newItemForm.name || "").trim();
    const itemCode = String(newItemForm.itemCode || "").trim();
    const unit = String(newItemForm.unit || "").trim();
    const stock = Number(newItemForm.stock);
    const minStock = Number(newItemForm.minStock);
    const hargaAwal = newItemForm.hargaAwal === "" ? 0 : Number(newItemForm.hargaAwal);

    if (!name || !newItemForm.category || !unit) { setToast("Nama, kategori, dan satuan wajib diisi", "err"); return; }
    if (!ITEM_CATEGORIES.includes(newItemForm.category)) { setToast("Kategori tidak valid", "err"); return; }
    if (name.length < 3 || name.length > MAX_TEXT_LEN) { setToast("Nama barang harus 3-120 karakter", "err"); return; }
    if (itemCode.length > 40) { setToast("Item kode maksimal 40 karakter", "err"); return; }
    if (unit.length < 1 || unit.length > 20) { setToast("Satuan harus 1-20 karakter", "err"); return; }
    if (newItemForm.stock === "" || newItemForm.minStock === "") { setToast("Stok awal dan min stok wajib diisi", "err"); return; }
    if (!Number.isInteger(stock) || !Number.isInteger(minStock)) { setToast("Stok harus bilangan bulat", "err"); return; }
    if (stock < 0 || minStock < 0) { setToast("Nilai stok tidak boleh negatif", "err"); return; }
    if (stock > MAX_STOCK_VALUE || minStock > MAX_STOCK_VALUE) { setToast(`Stok maksimal ${MAX_STOCK_VALUE.toLocaleString("id-ID")}`, "err"); return; }
    if (isNaN(hargaAwal) || hargaAwal < 0) { setToast("Harga awal tidak boleh negatif", "err"); return; }
    
    await withLoading(async () => {
      try {
        const { supabase } = await import("../../lib/supabase");
        const payload = {
          name, itemCode, category: newItemForm.category, unit, stock, minStock,
          averageCost: hargaAwal, lastPrice: hargaAwal,
          totalValue: hargaAwal * stock, photo: newItemForm.photo || null,
        };
        const { error } = await supabase.from("items").insert([payload]);
        if (error) throw new Error(error.message || "Gagal menambah item baru");
        onClose();
        setNewItemForm(emptyNewItem());
        setToast("Item baru berhasil ditambahkan \u2713");
        await fetchAll();
      } catch (e: any) { setToast(e?.message || "Gagal menambah item baru", "err"); }
    }, "Sedang menambahkan item baru");
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 540 }}>
        <div style={{ fontSize: 22, fontWeight: 900, ...gText(), marginBottom: 4 }}>➕ Add New Item</div>
        <div style={{ fontSize: 12, color: T.muted, marginBottom: 22 }}>Input manual data barang baru beserta foto produk</div>
        <div className="sect-box">
          <div className="sect-lbl">📷 Foto Barang</div>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <div style={{ width: 96, height: 96, borderRadius: 12, overflow: "hidden", border: `1px solid ${T.border}`, background: T.navActive, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 6 }}>
              {newItemForm.photo
                ? <img src={newItemForm.photo} alt={newItemForm.name || "Preview"} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                : <span style={{ fontSize: 28, opacity: .4 }}>📷</span>
              }
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 8, lineHeight: 1.5 }}>Upload foto barang (JPG/PNG/WEBP, maks 2MB)</div>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 7, background: T.navActive, border: `1px solid ${T.navActiveBorder}`, borderRadius: 10, padding: "8px 14px", cursor: "pointer", fontSize: 12, fontWeight: 700, color: T.navActiveText }}>
                📂 Pilih Foto
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (!f) return; if (f.size > 2097152) { setToast("Ukuran foto maks 2MB", "err"); return; } const reader = new FileReader(); reader.onload = ev => setNewItemForm(p => ({ ...p, photo: ev.target?.result as string || null })); reader.readAsDataURL(f); }} />
              </label>
              {newItemForm.photo && <button onClick={() => setNewItemForm(p => ({ ...p, photo: null }))} style={{ marginLeft: 8, background: "none", border: "none", color: T.muted, cursor: "pointer", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 11.5, fontWeight: 600 }}>✕ Hapus</button>}
            </div>
          </div>
        </div>
        <div className="sect-box">
          <div className="sect-lbl">📋 Data Barang Baru</div>
          <div className="mgrid">
            <div className="mspan"><FL>Nama Barang *</FL><input className="ifield" placeholder="Nama barang..." value={newItemForm.name} onChange={e => setNewItemForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div><FL>Item Kode</FL><input className="ifield" placeholder="Contoh: AS21205" value={newItemForm.itemCode} onChange={e => setNewItemForm(p => ({ ...p, itemCode: e.target.value }))} /></div>
            <div><FL>Kategori *</FL>
              <select className="ifield" value={newItemForm.category} onChange={e => setNewItemForm(p => ({ ...p, category: e.target.value }))}>
                {ITEM_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><FL>Satuan *</FL><input className="ifield" placeholder="pcs / box / set" value={newItemForm.unit} onChange={e => setNewItemForm(p => ({ ...p, unit: e.target.value }))} /></div>
            <div><FL>Min Stock *</FL><input className="ifield" type="number" min="0" placeholder="0" value={newItemForm.minStock} onChange={e => setNewItemForm(p => ({ ...p, minStock: e.target.value }))} /></div>
            <div><FL>Stok Awal *</FL><input className="ifield" type="number" min="0" placeholder="0" value={newItemForm.stock} onChange={e => setNewItemForm(p => ({ ...p, stock: e.target.value }))} /></div>
            <div><FL>Harga Awal (Rp)</FL><input className="ifield" type="number" min="0" placeholder="0" value={newItemForm.hargaAwal} onChange={e => setNewItemForm(p => ({ ...p, hargaAwal: e.target.value }))} /></div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <BtnP onClick={submitNewItem} style={{ flex: 1, padding: "13px", fontSize: 14, borderRadius: 12 }}>💾 Simpan Item</BtnP>
          <BtnG onClick={() => { onClose(); setNewItemForm(emptyNewItem()); }}>Batal</BtnG>
        </div>
      </div>
    </div>
  );
};
