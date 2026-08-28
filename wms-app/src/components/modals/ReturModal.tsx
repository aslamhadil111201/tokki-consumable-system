// @ts-nocheck
import { useState } from "react";
import { useStore } from "../../store/useStore";
import { gText, getT } from "../../theme/tokens";
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
  const { items, employees, departments, withLoading, setToast, fetchAll, dark } = useStore();
  const T = getT(dark);
  const [returForm, setReturForm] = useState(() => emptyReturForm());
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [newEmployeeName, setNewEmployeeName] = useState("");
  const [newEmployeeDept, setNewEmployeeDept] = useState("");

  if (!open) return null;

  const handleCreateEmployee = async () => {
    const name = newEmployeeName.trim();
    const dept = newEmployeeDept.trim();
    if (!name) { setToast("Nama karyawan harus diisi", "err"); return; }
    if (employees.some(e => String(e.name || "").trim().toLowerCase() === name.toLowerCase())) {
      setToast("Nama karyawan sudah terdaftar", "err");
      return;
    }

    await withLoading(async () => {
      try {
        const { supabase } = await import("../../lib/supabase");
        const nextId = employees.length > 0 ? Math.max(...employees.map(e => Number(e.id || 0))) + 1 : 1;

        const { error } = await supabase.from("employees").insert([{
          id: nextId,
          name,
          dept
        }]);
        if (error) throw error;

        setToast(`${name} berhasil ditambahkan ✓`);
        setReturForm(p => ({ ...p, employee: name }));
        setShowAddEmployee(false);
        setNewEmployeeName("");
        setNewEmployeeDept("");
        await fetchAll();
      } catch (e: any) {
        setToast(e.message || "Gagal menambahkan karyawan", "err");
      }
    }, "Menyimpan karyawan baru...");
  };

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
          note: String(returForm.note || "").trim(), date: todayStr(), time: nowTime(),
          status: "Diterima"
        }]);
        if (error) throw new Error(error.message || "Gagal menyimpan retur");
        
        // Tambahkan kembali barang ke stok langsung
        if (itemId) {
          const { data: itemData } = await supabase.from("items").select("stock").eq("id", itemId).single();
          if (itemData) {
            const newStock = (itemData.stock || 0) + qty;
            await supabase.from("items").update({ stock: newStock }).eq("id", itemId);
          }
        }
        
        setToast("Retur berhasil dicatat & stok ditambahkan ✓");
        onClose();
        setReturForm(emptyReturForm());
        fetchAll();
      } catch (e: any) { setToast(e?.message || "Gagal menyimpan retur", "err"); }
    }, "Menyimpan retur...");
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div style={{ fontSize: 20, fontWeight: 700, ...gText(), marginBottom: 4 }}>↩ Catat Retur Barang</div>
        <div style={{ fontSize: 12, color: T.muted, marginBottom: 18 }}>Barang yang diretur akan langsung ditambahkan ke stok barang.</div>
        <div className="sect-box">
          <div className="sect-lbl">Data Pengembali</div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <FL>Nama Pengembali *</FL>
              <button
                type="button"
                onClick={() => setShowAddEmployee(true)}
                style={{ background: "none", border: "none", color: "var(--t-primary-light)", fontSize: "11px", fontWeight: "700", cursor: "pointer", padding: "0 0 4px 0", textDecoration: "underline" }}
              >
                ＋ Tambah Karyawan Baru
              </button>
            </div>
            <SearchSelect options={employees.map(e => ({ value: e.name, label: e.name }))} value={returForm.employee} onChange={v => setReturForm(p => ({ ...p, employee: v }))} placeholder="— Cari/pilih karyawan —" />
          </div>
        </div>
        <div className="sect-box">
          <div className="sect-lbl"> Barang yang Diretur</div>
          <SearchSelect
            options={items.map(it => ({ value: String(it.id), label: `${it.name} (Stok: ${it.stock} ${it.unit})` }))}
            value={returForm.itemId ? String(returForm.itemId) : ""}
            onChange={v => setReturForm(p => ({ ...p, itemId: v }))}
            placeholder="— Cari/pilih barang —"
          />
        </div>
        <div className="sect-box">
          <div className="sect-lbl">🔢 Jumlah Dikembalikan</div>
          <input className="ifield" type="number" min="1" style={{ width: "100%" }} placeholder="Qty yang dikembalikan..." value={returForm.qty} onChange={e => setReturForm(p => ({ ...p, qty: e.target.value }))} />
        </div>
        <div className="sect-box">
          <div className="sect-lbl"> Alasan Retur</div>
          <select className="ifield" style={{ width: "100%" }} value={returForm.reason} onChange={e => setReturForm(p => ({ ...p, reason: e.target.value }))}>
            {RETUR_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="sect-box">
          <div className="sect-lbl"> Catatan Tambahan <span style={{ fontWeight: 400, color: T.muted }}>(opsional)</span></div>
          <input className="ifield" style={{ width: "100%" }} placeholder="Catatan tambahan..." value={returForm.note} onChange={e => setReturForm(p => ({ ...p, note: e.target.value }))} />
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <BtnP onClick={submitRetur} style={{ flex: 1, padding: "13px", fontSize: 14, borderRadius: 12 }}>Simpan Retur</BtnP>
          <BtnG onClick={onClose}>Batal</BtnG>
        </div>
      </div>

      {showAddEmployee && (
        <div className="overlay" style={{ zIndex: 1100 }} onClick={() => setShowAddEmployee(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400, border: `1.5px solid ${T.primary}` }}>
            <div style={{ fontSize: 18, fontWeight: 700, ...gText(), marginBottom: 4 }}>＋ Tambah Karyawan Baru</div>
            <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 16 }}>Tambahkan nama karyawan baru ke database</div>

            <div className="sect-box" style={{ marginBottom: 12 }}>
              <div>
                <FL>Nama Karyawan *</FL>
                <input
                  className="ifield"
                  value={newEmployeeName}
                  onChange={e => setNewEmployeeName(e.target.value)}
                  placeholder="Contoh: Budi Santoso"
                />
              </div>
            </div>

            <div className="sect-box" style={{ marginBottom: 20 }}>
              <div>
                <FL>Section</FL>
                <SearchSelect
                  options={departments.map(d => ({ value: d.name, label: d.name }))}
                  value={newEmployeeDept}
                  onChange={v => setNewEmployeeDept(v)}
                  placeholder="— Pilih section (opsional) —"
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <BtnP onClick={handleCreateEmployee} style={{ flex: 1, padding: "11px", fontSize: 13, borderRadius: 10 }}>Simpan Karyawan</BtnP>
              <BtnG onClick={() => { setShowAddEmployee(false); setNewEmployeeName(""); setNewEmployeeDept(""); }}>Batal</BtnG>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

