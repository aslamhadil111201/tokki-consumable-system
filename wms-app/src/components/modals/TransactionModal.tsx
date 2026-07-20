// @ts-nocheck
import { useState } from "react";
import { useStore } from "../../store/useStore";
import { T, gText } from "../../theme/tokens";
import { emptyForm } from "../../utils/formDefaults";
import { todayStr, nowTime } from "../../utils/formatters";
import { FL } from "../ui/FL";
import { BtnP } from "../ui/BtnP";
import { BtnG } from "../ui/BtnG";
import { Badge } from "../ui/Badge";
import { SearchSelect } from "../ui/SearchSelect";
import { catColor } from "../../utils/stockHelpers";

export const TransactionModal = ({
  open,
  onClose,
  initialItem = null
}: {
  open: boolean;
  onClose: () => void;
  initialItem?: any;
}) => {
  const { items, employees, departments, admins, workOrders, withLoading, setToast, fetchAll, dark, user } = useStore();
  
  const [form, setForm] = useState(() => emptyForm({
    cart: initialItem ? [{ itemId: Number(initialItem.id), qty: 1 }] : []
  }));
  const [pickerItem, setPickerItem] = useState(initialItem ? String(initialItem.id) : "");
  const [pickerQty, setPickerQty] = useState(initialItem ? "1" : "");

  if (!open) return null;

  const addToCart = () => {
    if (!pickerItem || !pickerQty || +pickerQty < 1) { setToast("Pilih barang dan isi jumlah", "err"); return; }
    const it = items.find(i => i.id === +pickerItem);
    if (!it) { setToast("Barang tidak ditemukan", "err"); return; }
    const inCart = form.cart.reduce((a: number, c: any) => c.itemId === +pickerItem ? a + c.qty : a, 0);
    if (inCart + +pickerQty > it.stock) { setToast(`Stok tidak cukup — sisa ${it.stock - inCart} ${it.unit}`, "err"); return; }
    
    const ex = form.cart.find((c: any) => c.itemId === +pickerItem);
    if (ex) setForm(f => ({ ...f, cart: f.cart.map((c: any) => c.itemId === +pickerItem ? { ...c, qty: c.qty + +pickerQty } : c) }));
    else setForm(f => ({ ...f, cart: [...f.cart, { itemId: +pickerItem, qty: +pickerQty }] }));
    
    setPickerItem(""); setPickerQty("");
  };

  const removeCart = (id: number) => setForm(f => ({ ...f, cart: f.cart.filter((c: any) => c.itemId !== id) }));

  const submitTrx = async () => {
    if (!form.taker || !form.dept || !form.admin) { setToast("Lengkapi data pengambil & admin", "err"); return; }
    if (!form.cart.length) { setToast("Keranjang masih kosong", "err"); return; }
    
    const payload = {
      taker: form.taker, dept: form.dept, workOrder: form.workOrder, note: form.note, date: form.date, time: nowTime(), admin: form.admin,
      items: form.cart.map((c: any) => { const it = items.find(i => i.id === c.itemId); return { itemId: c.itemId, itemName: it?.name, qty: c.qty, unit: it?.unit }; })
    };
    
    await withLoading(async () => {
      try {
        const { supabase } = await import("../../lib/supabase");
        
        // Cek apakah perlu approval:
        // - Jika ada item yang stoknya menipis (stock <= minStock) setelah diambil
        // - Atau qty pengambilan > 50% dari stok tersedia
        let needsApproval = false;
        for (const c of form.cart) {
          const it = items.find(i => i.id === c.itemId);
          if (!it) continue;
          const remainingStock = it.stock - c.qty;
          if (remainingStock <= it.minStock || c.qty > it.stock * 0.5) {
            needsApproval = true;
            break;
          }
        }

        const approvalStatus = needsApproval ? "pending" : "approved";
        const insertPayload = { 
          ...payload, 
          approvalStatus,
          ...(approvalStatus === "approved" ? { approvedBy: "system", approvedAt: new Date().toISOString() } : {})
        };
        const { error } = await supabase.from("transactions").insert([insertPayload]);
        if (error) throw new Error(error.message || "Gagal menyimpan transaksi");
        
        // Log audit
        await supabase.from("audit_logs").insert([{
          action: "transactions.create",
          actor: { username: user?.username || "unknown", role: user?.role || "unknown" },
          target: `Transaction for ${form.taker}`
        }]);
        
        // Selalu kurangi stok barang saat pengambilan dicatat
        for (const c of form.cart) {
          const it = items.find(i => i.id === c.itemId);
          if (it) {
            const newStock = Math.max(0, Number(it.stock || 0) - Number(c.qty || 0));
            const avgCost = Number(it.averageCost || 0);
            const newTotalValue = Math.round(newStock * avgCost * 100) / 100;
            await supabase.from("items").update({ 
              stock: newStock,
              totalValue: newTotalValue
            }).eq("id", it.id);
          }
        }
        
        if (approvalStatus === "approved") {
          setToast(`Transaksi ${form.taker} tercatat, stok diperbarui ✓`);
        } else {
          setToast(`Transaksi ${form.taker} tercatat & stok dikurangi (menunggu konfirmasi) ✓`);
        }
        
        setForm(emptyForm()); setPickerItem(""); setPickerQty(""); onClose();
        await fetchAll();
      } catch (e: any) { setToast(e?.message || "Gagal menyimpan transaksi", "err"); }
    }, "Sedang menyimpan transaksi");
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 22, fontWeight: 900, ...gText(), marginBottom: 4 }}>Catat Pengambilan</div>
        <div style={{ fontSize: 12, color: T.muted, marginBottom: 22 }}>Satu transaksi bisa mencakup beberapa barang sekaligus</div>
        <div className="sect-box">
          <div className="sect-lbl">👤 Data Pengambil</div>
          <div className="mgrid">
            <div><FL>Tanggal *</FL><input className="ifield" type="date" style={{ maxWidth: 160 }} value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} onClick={e => e.currentTarget.showPicker()} /></div>
            <div><FL>Nama Pengambil *</FL>
              <SearchSelect options={employees.map(e => ({ value: e.name, label: e.name }))} value={form.taker} onChange={v => setForm({ ...form, taker: v })} placeholder="— Cari/pilih karyawan —" />
            </div>
            <div><FL>Section *</FL>
              <SearchSelect options={departments.map(d => ({ value: d.name, label: d.name }))} value={form.dept} onChange={v => setForm({ ...form, dept: v })} placeholder="— Cari/pilih section —" />
            </div>
            <div><FL>Admin Warehouse *</FL>
              <SearchSelect options={admins.map(a => ({ value: a.name, label: a.name }))} value={form.admin} onChange={v => setForm({ ...form, admin: v })} placeholder="— Cari/pilih admin —" />
            </div>
            <div className="mspan"><FL>No. Project</FL>
              <SearchSelect options={workOrders.map(w => ({ value: w.code, label: `${w.code} — ${w.project}` }))} value={form.workOrder} onChange={v => setForm({ ...form, workOrder: v })} placeholder="— Cari/pilih project (opsional) —" />
            </div>
            <div className="mspan"><FL>Keterangan</FL><input className="ifield" placeholder="Keperluan pengambilan..." value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} /></div>
          </div>
        </div>
        <div className="sect-box">
          <div className="sect-lbl">🛒 Tambah ke Keranjang</div>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <div style={{ flex: "1 1 0", minWidth: 0 }}><FL>Pilih Barang</FL>
              <SearchSelect
                options={items.map(i => { const ic = form.cart.find((c: any) => c.itemId === i.id); const av = i.stock - (ic?.qty || 0); return { value: String(i.id), label: `${i.name} (sisa: ${av} ${i.unit})`, disabled: av <= 0 }; })}
                value={pickerItem}
                onChange={v => setPickerItem(v)}
                placeholder="— Cari/pilih barang —"
              />
            </div>
            <div style={{ flex: "0 0 80px" }}><FL>Jumlah</FL><input className="ifield" type="number" min="1" placeholder="0" value={pickerQty} onChange={e => setPickerQty(e.target.value)} onKeyDown={e => e.key === "Enter" && addToCart()} /></div>
            <BtnP onClick={addToCart} style={{ padding: "10px 14px", flexShrink: 0, fontSize: 12, borderRadius: 10 }}>+ Add</BtnP>
          </div>
        </div>
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: T.text, display: "flex", alignItems: "center", gap: 8 }}>
              Keranjang {form.cart.length > 0 && <Badge bg={T.navActive} color={T.navActiveText} border={T.navActiveBorder}>{form.cart.length} item · {form.cart.reduce((a: number, c: any) => a + c.qty, 0)} unit</Badge>}
            </div>
            {form.cart.length > 0 && <button style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 11.5, fontWeight: 600 }} onClick={() => setForm(f => ({ ...f, cart: [] }))}>Kosongkan</button>}
          </div>
          {form.cart.length === 0
            ? <div style={{ textAlign: "center", padding: 22, background: dark ? "rgba(0,0,0,0.12)" : T.surface, border: `1.5px dashed ${T.border}`, borderRadius: 11, color: T.muted, fontSize: 12.5 }}>🛒 Belum ada barang ditambahkan</div>
            : form.cart.map((c: any) => {
              const it = items.find(i => i.id === c.itemId); const cc = catColor(it?.category); return (
                <div key={c.itemId} className="cart-row">
                  <div style={{ width: 30, height: 30, background: cc.bg, border: `1px solid ${cc.border}`, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>⚙</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it?.name}</div>
                    <div style={{ fontSize: 11, color: T.muted }}>{it?.category}</div>
                  </div>
                  <span style={{ background: T.navActive, border: `1px solid ${T.navActiveBorder}`, color: T.navActiveText, fontSize: 12, fontWeight: 800, padding: "4px 12px", borderRadius: 8, flexShrink: 0 }}>{c.qty} {it?.unit}</span>
                  <button style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "2px 4px", transition: "color .15s" }} onClick={() => removeCart(c.itemId)} onMouseEnter={e => e.currentTarget.style.color = T.redText} onMouseLeave={e => e.currentTarget.style.color = T.muted}>×</button>
                </div>
              );
            })}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <BtnP onClick={submitTrx} style={{ flex: 1, padding: "13px", fontSize: 14, borderRadius: 12 }}>💾 Simpan Transaksi</BtnP>
          <BtnG onClick={() => { onClose(); setPickerItem(""); setPickerQty(""); }}>Batal</BtnG>
        </div>
      </div>
    </div>
  );
};
