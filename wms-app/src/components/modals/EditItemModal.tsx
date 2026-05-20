// @ts-nocheck
import { useState, useEffect } from "react";
import { useStore } from "../../store/useStore";
import { T, gText } from "../../theme/tokens";
import { ITEM_CATEGORIES } from "../../constants/index";
import { FL } from "../ui/FL";
import { BtnP } from "../ui/BtnP";
import { BtnG } from "../ui/BtnG";

export const EditItemModal = ({
  open,
  onClose,
  item
}: {
  open: boolean;
  onClose: () => void;
  item: any;
}) => {
  const { apiFetch, withLoading, setToast, fetchAll, user } = useStore();
  const [editItem, setEditItem] = useState<any>(null);

  useEffect(() => {
    if (open && item) {
      setEditItem({ ...item });
    } else {
      setEditItem(null);
    }
  }, [open, item]);

  const isAdmin = (user?.role || "").toLowerCase() === "admin";

  if (!open || !editItem) return null;

  const submitEdit = async () => {
    if (!isAdmin) { setToast("Hanya admin yang boleh mengubah item", "err"); return; }
    if (!editItem?.name || !editItem?.category) { setToast("Nama dan kategori wajib diisi", "err"); return; }
    
    await withLoading(async () => {
      try {
        const { supabase } = await import("../../lib/supabase");
        const { error } = await supabase.from("items").update({
          name: editItem.name, category: editItem.category, photo: editItem.photo || null
        }).eq("id", editItem.id);
        if (error) throw new Error(error.message || "Gagal memperbarui item");
        onClose();
        setToast("Item berhasil diperbarui \u2713");
        await fetchAll();
      } catch (e: any) { setToast(e?.message || "Gagal memperbarui item", "err"); }
    }, "Sedang memperbarui item");
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div style={{ fontSize: 22, fontWeight: 900, ...gText(), marginBottom: 4 }}>✏️ Edit Barang</div>
        <div style={{ fontSize: 12, color: T.muted, marginBottom: 22 }}>Perbarui nama, kategori, dan foto barang</div>
        <div className="sect-box">
          <div className="sect-lbl">📷 Foto Barang</div>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <div style={{ width: 90, height: 90, borderRadius: 12, overflow: "hidden", border: `1px solid ${T.border}`, background: T.navActive, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {editItem.photo
                ? <img src={editItem.photo} alt={editItem.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <span style={{ fontSize: 28, opacity: .4 }}>📷</span>
              }
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 8, lineHeight: 1.5 }}>Upload foto barang (JPG/PNG/WEBP, maks 2MB)</div>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 7, background: T.navActive, border: `1px solid ${T.navActiveBorder}`, borderRadius: 10, padding: "8px 14px", cursor: "pointer", fontSize: 12, fontWeight: 700, color: T.navActiveText }}>
                📂 Pilih Foto
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (!f) return; if (f.size > 2097152) { setToast("Ukuran foto maks 2MB", "err"); return; } const reader = new FileReader(); reader.onload = ev => setEditItem((p: any) => ({ ...p, photo: ev.target?.result })); reader.readAsDataURL(f); }} />
              </label>
              {editItem.photo && <button onClick={() => setEditItem((p: any) => ({ ...p, photo: null }))} style={{ marginLeft: 8, background: "none", border: "none", color: T.muted, cursor: "pointer", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 11.5, fontWeight: 600 }}>✕ Hapus</button>}
            </div>
          </div>
        </div>
        <div className="sect-box">
          <div className="sect-lbl">📋 Informasi Barang</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div><FL>Nama Barang *</FL><input className="ifield" value={editItem.name} onChange={e => setEditItem((p: any) => ({ ...p, name: e.target.value }))} placeholder="Nama barang..." /></div>
            <div><FL>Kategori *</FL>
              <select className="ifield" value={editItem.category} onChange={e => setEditItem((p: any) => ({ ...p, category: e.target.value }))}>
                {ITEM_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <BtnP onClick={submitEdit} style={{ flex: 1, padding: "13px", fontSize: 14, borderRadius: 12 }}>💾 Simpan Perubahan</BtnP>
          <BtnG onClick={onClose}>Batal</BtnG>
        </div>
      </div>
    </div>
  );
};
