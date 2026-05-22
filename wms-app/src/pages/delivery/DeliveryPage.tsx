// @ts-nocheck
import { useState, useEffect, useRef } from "react";
import "./DeliveryPage.css";
import { useStore } from "../../store/useStore";
import { getT } from "../../theme/tokens";
import { BtnP } from "../../components/ui/BtnP";
import { BtnG } from "../../components/ui/BtnG";
import { Printer, Edit, Trash2, Plus, ArrowLeft, Package, MapPin, ChevronDown, X } from "lucide-react";
import TokkiLogo from "../../assets/tokki-logo.png";

const CATS = { FNG: "Finish Good", DLV: "Sub Vendor", STW: "Site Work", ETC: "Lain-lain" };
const UOMS = ["Pcs", "Set", "Unit", "Ea", "Box", "Roll", "Pack", "Kg", "Liter", "m", "cm"];

export function DeliveryPage() {
  const { dark, user, setToast } = useStore();
  const T = getT(dark);

  const [notes, setNotes] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [view, setView] = useState("list"); // list | form | addr
  const [editId, setEditId] = useState(null);
  const [catFilter, setCatFilter] = useState("ALL");
  const [searchQ, setSearchQ] = useState("");
  const [formItems, setFormItems] = useState([{ id: "1", qty: "1", uom: "Pcs", desc: "" }]);
  const [printData, setPrintData] = useState(null);
  const [destOpen, setDestOpen] = useState(false);
  const printRef = useRef(null);

  // Address form state
  const [addrForm, setAddrForm] = useState(false);
  const [newDest, setNewDest] = useState("");
  const [newAddr, setNewAddr] = useState("");
  const [newAttn, setNewAttn] = useState("");
  const [newContact, setNewContact] = useState("");

  // Form refs
  const [formCat, setFormCat] = useState("FNG");
  const [formBatch, setFormBatch] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);
  const [formProject, setFormProject] = useState("");
  const [formKendaraan, setFormKendaraan] = useState("");
  const [formDest, setFormDest] = useState("");
  const [formAttn, setFormAttn] = useState("");
  const [formAddr, setFormAddr] = useState("");

  useEffect(() => { fetchNotes(); fetchAddresses(); }, []);

  const fetchNotes = async () => {
    const { supabase } = await import("../../lib/supabase");
    const { data } = await supabase.from("delivery_notes").select("*").order("created_at", { ascending: false });
    setNotes(data || []);
  };

  const fetchAddresses = async () => {
    const { supabase } = await import("../../lib/supabase");
    const { data } = await supabase.from("shipping_addresses").select("*").order("destination");
    setAddresses(data || []);
  };

  const genBatch = (cat) => {
    const existing = notes.filter(n => n.category === cat);
    const nums = existing.map(n => { const m = n.batch?.match(/\d+$/); return m ? +m[0] : 0; });
    
    let baseStart = 1;
    if (cat === "DLV") baseStart = 977;
    else if (cat === "FNG") baseStart = 14;
    else if (cat === "STW") baseStart = 362;
    else if (cat === "ETC") baseStart = 3;

    const next = nums.length && Math.max(...nums) >= baseStart ? Math.max(...nums) + 1 : baseStart;
    return cat + String(next).padStart(3, "0");
  };

  const openNew = () => {
    setEditId(null);
    setFormCat("FNG");
    setFormBatch(genBatch("FNG"));
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormProject(""); setFormKendaraan(""); setFormDest(""); setFormAttn(""); setFormAddr("");
    setFormItems([{ id: Date.now().toString(), qty: "1", uom: "Pcs", desc: "" }]);
    setView("form");
  };

  const openEdit = (note) => {
    setEditId(note.id);
    setFormCat(note.category || "FNG");
    setFormBatch(note.batch || "");
    setFormDate(note.date || "");
    setFormProject(note.project_no || "");
    setFormKendaraan(note.no_kendaraan || "");
    setFormDest(note.destination || "");
    setFormAttn(note.attn || "");
    setFormAddr(note.full_address || "");
    const items = (note.items || []).map((it, i) => ({ id: String(i), qty: String(it.qty || "1"), uom: it.uom || "Pcs", desc: it.description || "" }));
    setFormItems(items.length ? items : [{ id: "1", qty: "1", uom: "Pcs", desc: "" }]);
    setView("form");
  };

  const handleSave = async () => {
    if (!formDest.trim()) { setToast("Destination wajib diisi!", "err"); return; }
    const validItems = formItems.filter(i => i.desc.trim());
    if (!validItems.length) { setToast("Minimal satu item barang!", "err"); return; }

    const { supabase } = await import("../../lib/supabase");
    const payload = {
      batch: formBatch,
      category: formCat,
      date: formDate,
      project_no: formProject,
      no_kendaraan: formKendaraan,
      destination: formDest,
      attn: formAttn,
      full_address: formAddr,
      items: validItems.map(i => ({ qty: i.qty, uom: i.uom, description: i.desc })),
    };

    if (editId) {
      const { error } = await supabase.from("delivery_notes").update(payload).eq("id", editId);
      if (error) { setToast(error.message, "err"); return; }
      setToast("Surat jalan diperbarui \u2713");
    } else {
      const { error } = await supabase.from("delivery_notes").insert([payload]);
      if (error) { setToast(error.message, "err"); return; }
      // Auto-save address
      if (!addresses.find(a => a.destination?.toLowerCase() === formDest.toLowerCase())) {
        await supabase.from("shipping_addresses").insert([{ destination: formDest, full_address: formAddr, attn: formAttn }]);
        fetchAddresses();
      }
      setToast("Surat jalan berhasil dibuat \u2713");
    }
    await fetchNotes();
    setView("list");
  };

  const handleDelete = async (id) => {
    if (!confirm("Hapus surat jalan ini?")) return;
    const { supabase } = await import("../../lib/supabase");
    await supabase.from("delivery_notes").delete().eq("id", id);
    setToast("Surat jalan dihapus");
    fetchNotes();
  };

  const handlePrint = (note) => {
    setPrintData(note);
    const oldTitle = document.title;
    document.title = "Official Delivery Document";
    setTimeout(() => {
      window.print();
      document.title = oldTitle;
    }, 500);
  };

  const onCatChange = (c) => {
    setFormCat(c);
    if (!editId) setFormBatch(genBatch(c));
  };

  const onDestChange = (v) => {
    setFormDest(v);
    const a = addresses.find(x => x.destination?.toLowerCase() === v.toLowerCase());
    if (a) { setFormAttn(a.attn || ""); setFormAddr(a.full_address || ""); }
  };

  const addItem = () => setFormItems([...formItems, { id: Date.now().toString(), qty: "1", uom: "Pcs", desc: "" }]);
  const removeItem = (id) => setFormItems(formItems.filter(i => i.id !== id));
  const updateItem = (id, field, val) => setFormItems(formItems.map(i => i.id === id ? { ...i, [field]: val } : i));

  // Filter
  let filtered = [...notes];
  if (catFilter !== "ALL") filtered = filtered.filter(n => n.category === catFilter);
  if (searchQ) {
    const q = searchQ.toLowerCase();
    filtered = filtered.filter(n => (n.batch || "").toLowerCase().includes(q) || (n.destination || "").toLowerCase().includes(q) || (n.project_no || "").toLowerCase().includes(q) || (n.items || []).some(i => (i.description || "").toLowerCase().includes(q)));
  }

  const fmtDate = (s) => s ? new Date(s).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "-";
  const fmtDatePrint = (s) => {
    if (!s) return "-";
    const d = new Date(s);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  // ─── RENDER ───

  // Address management view
  if (view === "addr") {
    const handleSaveAddr = async () => {
      if (!newDest.trim()) { setToast("Destination wajib diisi!", "err"); return; }
      const { supabase } = await import("../../lib/supabase");
      const { error } = await supabase.from("shipping_addresses").insert([{ destination: newDest, full_address: newAddr, attn: newAttn, contact: newContact }]);
      if (error) { setToast(error.message, "err"); return; }
      setToast("Alamat berhasil ditambahkan \u2713");
      setAddrForm(false); setNewDest(""); setNewAddr(""); setNewAttn(""); setNewContact("");
      fetchAddresses();
    };

    const handleDeleteAddr = async (id) => {
      if (!confirm("Hapus alamat ini?")) return;
      const { supabase } = await import("../../lib/supabase");
      await supabase.from("shipping_addresses").delete().eq("id", id);
      setToast("Alamat dihapus");
      fetchAddresses();
    };
    return (
      <div style={{ maxWidth: 820 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1rem" }}>
          <BtnG onClick={() => setView("list")} style={{ padding: "6px 12px", fontSize: 12 }}><ArrowLeft size={14} /> Kembali</BtnG>
          <span style={{ fontSize: 16, fontWeight: 600, color: T.text }}>Kelola Shipping Address</span>
          <BtnP onClick={() => setAddrForm(true)} style={{ marginLeft: "auto", padding: "7px 14px", fontSize: 12 }}><Plus size={14} /> Tambah Alamat</BtnP>
        </div>

        {addrForm && (
          <div className="dn-form-section" style={{ background: T.surface, border: `1px solid ${T.primary}`, marginBottom: "1rem" }}>
            <div className="dn-form-title" style={{ color: T.primary }}>Tambah Alamat Baru</div>
            <div className="dn-form-grid dn-form-grid-2">
              <div className="dn-form-group" style={{ gridColumn: "1/-1" }}>
                <label style={{ color: T.muted }}>Destination (Nama Customer) *</label>
                <input className="ifield" value={newDest} onChange={e => setNewDest(e.target.value)} placeholder="PT. Nama Perusahaan" />
              </div>
              <div className="dn-form-group">
                <label style={{ color: T.muted }}>Attn (PIC)</label>
                <input className="ifield" value={newAttn} onChange={e => setNewAttn(e.target.value)} placeholder="Mr. / Bpk. Nama" />
              </div>
              <div className="dn-form-group">
                <label style={{ color: T.muted }}>Contact</label>
                <input className="ifield" value={newContact} onChange={e => setNewContact(e.target.value)} placeholder="08xxx" />
              </div>
              <div className="dn-form-group" style={{ gridColumn: "1/-1" }}>
                <label style={{ color: T.muted }}>Full Address</label>
                <input className="ifield" value={newAddr} onChange={e => setNewAddr(e.target.value)} placeholder="Jl. Alamat lengkap..." />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
              <BtnG onClick={() => setAddrForm(false)} style={{ fontSize: 12, padding: "6px 12px" }}>Batal</BtnG>
              <BtnP onClick={handleSaveAddr} style={{ fontSize: 12, padding: "6px 14px" }}>Simpan</BtnP>
            </div>
          </div>
        )}

        <table className="dn-table" style={{ background: T.card, borderRadius: 12, overflow: "hidden" }}>
          <thead><tr style={{ background: T.surface }}>
            <th style={{ color: T.muted }}>Destination</th>
            <th style={{ color: T.muted }}>Full Address</th>
            <th style={{ color: T.muted }}>Attn</th>
            <th style={{ color: T.muted, width: 60 }}>Aksi</th>
          </tr></thead>
          <tbody>
            {addresses.length === 0 ? (
              <tr><td colSpan={4} style={{ textAlign: "center", padding: "2rem", color: T.muted }}>Belum ada alamat tersimpan</td></tr>
            ) : addresses.map(a => (
              <tr key={a.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                <td style={{ fontWeight: 500, color: T.text }}>{a.destination}</td>
                <td style={{ color: T.muted, fontSize: 11 }}>{a.full_address || "-"}</td>
                <td style={{ color: T.muted }}>{a.attn || "-"}</td>
                <td>
                  <button className="dn-act-btn" onClick={() => handleDeleteAddr(a.id)} style={{ color: T.red }}><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (view === "form") return (
    <div style={{ maxWidth: 820 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1rem" }}>
        <BtnG onClick={() => setView("list")} style={{ padding: "6px 12px", fontSize: 12 }}><ArrowLeft size={14} /> Kembali</BtnG>
        <span style={{ fontSize: 16, fontWeight: 600, color: T.text }}>{editId ? "Edit" : "Buat"} Surat Jalan</span>
      </div>

      <div className="dn-form-section" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
        <div className="dn-form-title" style={{ color: T.primary }}>Informasi Pengiriman</div>
        <div className="dn-form-grid dn-form-grid-3" style={{ marginBottom: 10 }}>
          <div className="dn-form-group">
            <label style={{ color: T.muted }}>Kategori</label>
            <select className="ifield" value={formCat} onChange={e => onCatChange(e.target.value)}>
              {Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v} ({k})</option>)}
            </select>
          </div>
          <div className="dn-form-group">
            <label style={{ color: T.muted }}>Batch No</label>
            <input className="ifield" value={formBatch} readOnly style={{ background: T.inputBg, opacity: 0.7 }} />
          </div>
          <div className="dn-form-group">
            <label style={{ color: T.muted }}>Tanggal</label>
            <input className="ifield" type="date" value={formDate} onChange={e => setFormDate(e.target.value)} />
          </div>
        </div>
        <div className="dn-form-grid dn-form-grid-2">
          <div className="dn-form-group">
            <label style={{ color: T.muted }}>Project No</label>
            <input className="ifield" value={formProject} onChange={e => setFormProject(e.target.value)} placeholder="E0063, C0557, -" />
          </div>
          <div className="dn-form-group">
            <label style={{ color: T.muted }}>No Kendaraan</label>
            <input className="ifield" value={formKendaraan} onChange={e => setFormKendaraan(e.target.value)} placeholder="B 1234 ABC" />
          </div>
        </div>
      </div>

      <div className="dn-form-section" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
        <div className="dn-form-title" style={{ color: T.primary }}>Data Penerima</div>
        <div className="dn-form-grid dn-form-grid-2">
          <div className="dn-form-group" style={{ gridColumn: "1/-1", position: "relative" }}>
            <label style={{ color: T.muted }}>Destination (Tujuan) *</label>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <input 
                className="ifield" 
                value={formDest} 
                onChange={e => { onDestChange(e.target.value); setDestOpen(true); }} 
                onFocus={(e) => { setDestOpen(true); e.target.select(); }}
                onBlur={() => setTimeout(() => setDestOpen(false), 200)}
                placeholder="PT. Nama Perusahaan..." 
                style={{ paddingRight: 60 }}
              />
              {formDest && (
                <X size={15} color={T.muted} style={{ position: "absolute", right: 32, cursor: "pointer" }} onClick={() => { onDestChange(""); setDestOpen(true); }} />
              )}
              <ChevronDown size={16} color={T.muted} style={{ position: "absolute", right: 12, pointerEvents: "none" }} />
            </div>
            {destOpen && addresses.length > 0 && (
              <div style={{
                position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
                background: T.surfaceSolid, border: `1px solid ${T.border}`, borderRadius: 8,
                boxShadow: T.shadowCard, maxHeight: 250, overflowY: "auto", marginTop: 4, padding: "4px 0"
              }}>
                {addresses.filter(a => a.destination.toLowerCase().includes((formDest || "").toLowerCase())).map(a => (
                  <div key={a.id} 
                    className="dn-dd-item"
                    onClick={() => { onDestChange(a.destination); setDestOpen(false); }}
                    style={{ padding: "8px 14px", cursor: "pointer", color: T.text, fontSize: 13 }}
                  >
                    {a.destination}
                  </div>
                ))}
                {addresses.filter(a => a.destination.toLowerCase().includes((formDest || "").toLowerCase())).length === 0 && (
                  <div style={{ padding: "8px 14px", color: T.muted, fontSize: 13, fontStyle: "italic" }}>Perusahaan tidak ditemukan. (Tekan simpan untuk menambah baru)</div>
                )}
              </div>
            )}
          </div>
          <div className="dn-form-group">
            <label style={{ color: T.muted }}>Attn</label>
            <input className="ifield" value={formAttn} onChange={e => setFormAttn(e.target.value)} placeholder="Mr. / Bpk. Nama" />
          </div>
          <div className="dn-form-group">
            <label style={{ color: T.muted }}>Alamat (untuk cetak)</label>
            <input className="ifield" value={formAddr} onChange={e => setFormAddr(e.target.value)} placeholder="Jl. Alamat lengkap..." />
          </div>
        </div>
      </div>

      <div className="dn-form-section" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div className="dn-form-title" style={{ color: T.primary, margin: 0 }}>Description of Goods</div>
          <BtnG onClick={addItem} style={{ padding: "5px 10px", fontSize: 11 }}><Plus size={13} /> Tambah Baris</BtnG>
        </div>
        <table className="dn-items-table">
          <thead><tr><th style={{ width: 28 }}>No</th><th style={{ width: 70 }}>Qty</th><th style={{ width: 80 }}>UoM</th><th>Description of Goods</th><th style={{ width: 34 }}></th></tr></thead>
          <tbody>
            {formItems.map((it, i) => (
              <tr key={it.id}>
                <td style={{ textAlign: "center", color: T.muted, fontSize: 11 }}>{i + 1}</td>
                <td><input type="number" value={it.qty} min="0.01" step="any" onChange={e => updateItem(it.id, "qty", e.target.value)} style={{ textAlign: "center" }} /></td>
                <td><select value={it.uom} onChange={e => updateItem(it.id, "uom", e.target.value)}>{UOMS.map(u => <option key={u} value={u}>{u}</option>)}</select></td>
                <td><input type="text" value={it.desc} onChange={e => updateItem(it.id, "desc", e.target.value)} placeholder="Description of goods..." /></td>
                <td><button className="dn-act-btn" onClick={() => removeItem(it.id)} style={{ color: T.red }}><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <BtnG onClick={() => setView("list")}>Batal</BtnG>
        <BtnP onClick={handleSave} style={{ padding: "10px 20px" }}>Simpan Surat Jalan</BtnP>
      </div>
    </div>
  );

  // ─── LIST VIEW ───
  return (
    <div>
      {/* Preload logo for printing */}
      <img src={TokkiLogo} style={{ display: "none" }} alt="" />

      {/* Print area (hidden, shown only during print) */}
      {printData && (
        <div className="dn-print-area" ref={printRef}>
          <div className="dn-print-header">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                <tr>
                  <td style={{ verticalAlign: "top", width: "57%" }}>
                    <img src={TokkiLogo} alt="TOKKI" style={{ height: 70, objectFit: "contain", marginBottom: 4, marginLeft: "-15px" }} />
                  </td>
                  <td style={{ verticalAlign: "top", width: "43%" }}></td>
                </tr>
                <tr>
                  <td style={{ verticalAlign: "top", fontSize: "8.5pt", lineHeight: 1.55 }}>
                    <div><strong>Cilegon Factory &amp; Office :</strong></div>
                    <div>Jl. Australia 1 Kav. C1/2</div>
                    <div>Kawasan Krakatau Industri Estate Cilegon (KIEC)</div>
                    <div>Cilegon - Banten - Indonesia</div>
                    <div style={{ display: "flex", gap: "4px" }}>
                      <div>Phone :</div>
                      <div>
                        <div>+62 - 254 831 7244 (Hunting)</div>
                        <div>+62 - 254 831 7243, +62 - 254 831 7245</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ verticalAlign: "top", fontSize: "9pt", width: "43%", wordBreak: "break-word" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 2 }}>
                      <tbody>
                        <tr><td style={{ width: 105, paddingBottom: 2 }}>Shipment Batch</td><td style={{ paddingBottom: 2 }}>: <strong>{printData.batch}</strong></td></tr>
                        <tr><td style={{ paddingBottom: 2 }}>Cilegon</td><td style={{ paddingBottom: 2 }}>: {fmtDatePrint(printData.date)}</td></tr>
                        <tr><td style={{ paddingBottom: 2 }}>Kepada Yth</td><td style={{ paddingBottom: 2 }}>:</td></tr>
                      </tbody>
                    </table>
                    <div className="dn-print-recv">{printData.destination}</div>
                    {printData.full_address && <div style={{ fontSize: "8.5pt", color: "#444", marginTop: 2, lineHeight: 1.45 }}>{printData.full_address}</div>}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="dn-print-title"><h2>Delivery Note</h2><p>Surat Jalan</p></div>
          <div className="dn-print-info">
            <div style={{ width: "57%" }}>
              <table><tbody>
                <tr><td className="lbl" style={{ width: 80 }}>Project No.</td><td>: {printData.project_no || "-"}</td></tr>
                <tr><td className="lbl" style={{ width: 80 }}>Attn.</td><td>: {printData.attn || "-"}</td></tr>
              </tbody></table>
            </div>
            <div style={{ width: "43%", textAlign: "right" }}>
              No Kendaraan : {printData.no_kendaraan || "\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0"}
            </div>
          </div>
          <div className="dn-print-greet">dengan ini kami mengirimkan barang-barang berikut di bawah ini :</div>
          <table className="dn-print-table">
            <thead><tr><th style={{ width: 80 }}>Quantity</th><th>Description of Goods</th></tr></thead>
            <tbody>
              {(printData.items || []).map((it, i) => (
                <tr key={i}><td>{it.qty} {it.uom}</td><td>{it.description}</td></tr>
              ))}
            </tbody>
          </table>
          <div className="dn-print-note">Seluruh item tersebut di atas telah diterima dengan baik.</div>
          <div className="dn-print-sigs">
            <div className="dn-print-sig-col">
              <div className="dn-print-sig-role">Penerima,</div>
              <div className="dn-print-sig-line"></div>
            </div>
            <div className="dn-print-sig-col">
              <div className="dn-print-sig-role">Diserahkan Oleh,</div>
              <div className="dn-print-sig-line"></div>
            </div>
            <div className="dn-print-sig-col">
              <div className="dn-print-sig-role">Hormat Kami,</div>
              <div className="dn-print-sig-line"></div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: T.text, display: "flex", alignItems: "center", gap: 8 }}>
          <Package size={20} /> Sistem Surat Jalan (Delivery Note)
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <BtnG onClick={() => setView("addr")} style={{ fontSize: 12, padding: "8px 14px" }}><MapPin size={14} /> Kelola Alamat</BtnG>
          <BtnP onClick={openNew} style={{ fontSize: 12, padding: "8px 14px" }}><Plus size={14} /> Buat Surat Jalan</BtnP>
        </div>
      </div>

      {/* Stats */}
      <div className="dn-stats">
        {[
          { label: "SEMUA SJ", val: notes.length, sub: "Semua Kategori", color: T.primary },
          { label: "FINISH GOOD", val: notes.filter(n => n.category === "FNG").length, sub: "Kirim ke Customer", color: "#10b981" },
          { label: "SUB VENDOR", val: notes.filter(n => n.category === "DLV").length, sub: "Pekerjaan Luar", color: "#3b82f6" },
          { label: "SITE WORK", val: notes.filter(n => n.category === "STW").length, sub: "Proyek Lapangan", color: "#f59e0b" },
          { label: "LAIN-LAIN", val: notes.filter(n => n.category === "ETC").length, sub: "Umum / Operasional", color: "#6b7280" },
        ].map((s, i) => (
          <div key={i} className="dn-stat" style={{ background: T.card, border: `1px solid ${T.border}` }}>
            <div className="dn-stat-lbl" style={{ color: T.muted }}>{s.label}</div>
            <div className="dn-stat-val" style={{ color: s.color }}>{s.val}</div>
            <div className="dn-stat-sub" style={{ color: T.muted }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="dn-toolbar">
        <input className="ifield" placeholder="Cari nomor batch, tujuan, item..." value={searchQ} onChange={e => setSearchQ(e.target.value)} />
        <div className="dn-cat-tabs">
          {["ALL", ...Object.keys(CATS)].map(c => (
            <button key={c} className={`dn-cat-btn`} onClick={() => setCatFilter(c)}
              style={{ background: catFilter === c ? T.primary : T.surface, color: catFilter === c ? "white" : T.muted, border: `1px solid ${catFilter === c ? T.primary : T.border}` }}>
              {c === "ALL" ? "Semua" : c}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <table className="dn-table">
        <thead><tr style={{ background: T.surface, borderBottom: `1px solid ${T.border}` }}>
          <th style={{ color: T.muted }}>BATCH NO.</th>
          <th style={{ color: T.muted }}>KATEGORI</th>
          <th style={{ color: T.muted }}>TANGGAL</th>
          <th style={{ color: T.muted }}>TUJUAN</th>
          <th style={{ color: T.muted }}>PROJECT NO.</th>
          <th style={{ color: T.muted }}>DESKRIPSI BARANG</th>
          <th style={{ color: T.muted }}>AKSI</th>
        </tr></thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr><td colSpan={7} style={{ textAlign: "center", padding: "3rem", color: T.muted }}>
              {notes.length === 0 ? "Belum ada surat jalan. Buat yang pertama!" : "Tidak ada hasil."}
            </td></tr>
          ) : filtered.map(n => (
            <tr key={n.id} style={{ borderBottom: `1px solid ${T.border}` }}>
              <td><span className={`dn-batch-badge dn-batch-${n.category}`}>{n.batch}</span></td>
              <td style={{ color: T.muted, fontSize: 11 }}>{n.category}</td>
              <td style={{ color: T.muted }}>{fmtDate(n.date)}</td>
              <td style={{ fontWeight: 500, color: T.text }}>{n.destination || "-"}</td>
              <td style={{ color: T.muted }}>{n.project_no || "-"}</td>
              <td style={{ color: T.muted, fontSize: 11 }} title={(n.items || []).map(i => `${i.qty} ${i.uom} x ${i.description}`).join("\n")}>
                {(() => {
                  const full = (n.items || []).map(i => `${i.qty} ${i.uom} x ${i.description}`).join(", ");
                  return full.length > 50 ? full.substring(0, 50) + "..." : full;
                })()}
              </td>
              <td>
                <div className="dn-actions">
                  <button className="dn-act-btn" onClick={() => handlePrint(n)} title="Cetak" style={{ color: T.text }}><Printer size={15} /></button>
                  <button className="dn-act-btn" onClick={() => openEdit(n)} title="Edit / Lihat Detail" style={{ color: T.text }}><Edit size={15} /></button>
                  <button className="dn-act-btn" onClick={() => handleDelete(n.id)} title="Hapus" style={{ color: T.red }}><Trash2 size={15} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
