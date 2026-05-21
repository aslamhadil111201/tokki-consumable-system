// @ts-nocheck
import React, { useState, useEffect, useRef } from "react";
import "./DeliveryPage.css";
import { useStore } from "../../store/useStore";
import { getT } from "../../theme/tokens";
import { BtnP } from "../../components/ui/BtnP";
import { BtnG } from "../../components/ui/BtnG";
import { PrintDeliveryNote } from "./PrintDeliveryNote";
import { todayStr, fmtDate } from "../../utils/formatters";
import { Search, MapPin, Truck, Plus, Trash2, Printer, Edit, ArrowLeft, Building2, Check, X } from "lucide-react";

// Categorized options
const CATEGORIES = [
  { id: "ALL", label: "Semua" },
  { id: "FNG", label: "Finish Good (Customer)" },
  { id: "DLV", label: "Sub Vendor (Pekerjaan Luar)" },
  { id: "STW", label: "Site Work (Proyek Lapangan)" },
  { id: "ETC", label: "Umum / Operasional" }
];

const UOM_OPTIONS = ["pcs", "lot", "set", "roll", "btg", "box", "kg", "mtr", "ltr", "unit"];

export function DeliveryPage() {
  const {
    dark,
    deliveryNotes,
    shippingAddresses,
    saveDeliveryNote,
    deleteDeliveryNote,
    saveShippingAddress,
    deleteShippingAddress,
    fetchAll,
    withLoading
  } = useStore();

  const T = getT(dark);

  // General views state: "list" | "form" | "address_manager"
  const [view, setView] = useState("list");
  const [activeCat, setActiveCat] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Print state
  const [printNote, setPrintNote] = useState<any>(null);

  // Address manager states
  const [addrFormOpen, setAddrFormOpen] = useState(false);
  const [editingAddr, setEditingAddr] = useState<any>(null);
  const [addrDestination, setAddrDestination] = useState("");
  const [addrAttn, setAddrAttn] = useState("");
  const [addrContact, setAddrContact] = useState("");
  const [addrFullAddress, setAddrFullAddress] = useState("");

  // Delivery Note Form states
  const [editingNote, setEditingNote] = useState<any>(null);
  const [formBatch, setFormBatch] = useState("");
  const [formCategory, setFormCategory] = useState("FNG");
  const [formDate, setFormDate] = useState(todayStr());
  const [formProjectNo, setFormProjectNo] = useState("");
  const [formNoKendaraan, setFormNoKendaraan] = useState("");
  const [formDestination, setFormDestination] = useState("");
  const [formAttn, setFormAttn] = useState("");
  const [formFullAddress, setFormFullAddress] = useState("");
  const [formItems, setFormItems] = useState<any[]>([{ qty: 1, uom: "pcs", description: "" }]);

  // Autocomplete UI state
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  // Fetch all data when page mounts
  useEffect(() => {
    fetchAll();
  }, []);

  // Listen to clicks outside autocomplete dropdown to close it
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (autocompleteRef.current && !autocompleteRef.current.contains(event.target as Node)) {
        setShowAddressSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Auto-generate batch number when category changes in creation view
  useEffect(() => {
    if (view === "form" && (!editingNote || editingNote.isNew)) {
      const generated = generateNextBatch(formCategory, deliveryNotes);
      setFormBatch(generated);
    }
  }, [formCategory, view, editingNote, deliveryNotes]);

  // Sequential batch code generator
  function generateNextBatch(category: string, notes: any[]) {
    const catNotes = notes.filter(n => n.category === category);
    if (catNotes.length === 0) {
      return `${category}001`;
    }

    let maxNum = 0;
    let maxPad = 3;
    const regex = new RegExp(`^${category}(\\d+)$`, 'i');

    catNotes.forEach(n => {
      const match = String(n.batch || "").trim().match(regex);
      if (match) {
        const numStr = match[1];
        const num = parseInt(numStr, 10);
        if (num > maxNum) {
          maxNum = num;
          maxPad = numStr.length;
        }
      }
    });

    const nextNum = maxNum + 1;
    const nextNumStr = String(nextNum).padStart(Math.max(3, maxPad), '0');
    return `${category}${nextNumStr}`;
  }

  // Address Manager Handlers
  const handleOpenAddrForm = (addr: any = null) => {
    if (addr) {
      setEditingAddr(addr);
      setAddrDestination(addr.destination);
      setAddrAttn(addr.attn || "");
      setAddrContact(addr.contact || "");
      setAddrFullAddress(addr.full_address || "");
    } else {
      setEditingAddr(null);
      setAddrDestination("");
      setAddrAttn("");
      setAddrContact("");
      setAddrFullAddress("");
    }
    setAddrFormOpen(true);
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addrDestination.trim()) {
      useStore.getState().setToast("Tujuan harus diisi", "err");
      return;
    }

    const payload = {
      id: editingAddr?.id,
      isNew: !editingAddr,
      destination: addrDestination.trim(),
      attn: addrAttn.trim(),
      contact: addrContact.trim(),
      fullAddress: addrFullAddress.trim()
    };

    const res = await withLoading(() => saveShippingAddress(payload), "Menyimpan Alamat...");
    if (res.ok) {
      setAddrFormOpen(false);
    }
  };

  const handleDeleteAddress = async (id: number) => {
    if (window.confirm("Apakah Anda yakin ingin menghapus alamat pengiriman ini?")) {
      await withLoading(() => deleteShippingAddress(id), "Menghapus Alamat...");
    }
  };

  // Delivery Note Form Handlers
  const handleOpenNoteForm = (note: any = null) => {
    if (note) {
      setEditingNote(note);
      setFormBatch(note.batch);
      setFormCategory(note.category);
      setFormDate(note.date);
      setFormProjectNo(note.project_no || "");
      setFormNoKendaraan(note.no_kendaraan || "");
      setFormDestination(note.destination);
      setFormAttn(note.attn || "");
      setFormFullAddress(note.full_address || "");
      setFormItems(note.items && note.items.length ? [...note.items] : [{ qty: 1, uom: "pcs", description: "" }]);
    } else {
      setEditingNote({ isNew: true });
      setFormCategory("FNG");
      setFormDate(todayStr());
      setFormProjectNo("");
      setFormNoKendaraan("");
      setFormDestination("");
      setFormAttn("");
      setFormFullAddress("");
      setFormItems([{ qty: 1, uom: "pcs", description: "" }]);
    }
    setView("form");
  };

  const handleAddItemRow = () => {
    setFormItems([...formItems, { qty: 1, uom: "pcs", description: "" }]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (formItems.length === 1) return;
    setFormItems(formItems.filter((_, idx) => idx !== index));
  };

  const handleItemFieldChange = (index: number, field: string, value: any) => {
    const updated = [...formItems];
    updated[index] = { ...updated[index], [field]: value };
    setFormItems(updated);
  };

  const handleSaveDeliveryNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formBatch.trim()) {
      useStore.getState().setToast("Nomor batch tidak boleh kosong", "err");
      return;
    }
    if (!formDestination.trim()) {
      useStore.getState().setToast("Tujuan pengiriman tidak boleh kosong", "err");
      return;
    }

    // Validate items
    const invalidItems = formItems.some(i => !i.description.trim() || Number(i.qty) <= 0);
    if (invalidItems) {
      useStore.getState().setToast("Semua item harus memiliki deskripsi dan kuantitas positif", "err");
      return;
    }

    const payload = {
      id: editingNote?.id,
      isNew: editingNote?.isNew,
      batch: formBatch.trim(),
      category: formCategory,
      date: formDate,
      projectNo: formProjectNo.trim(),
      noKendaraan: formNoKendaraan.trim(),
      destination: formDestination.trim(),
      attn: formAttn.trim(),
      fullAddress: formFullAddress.trim(),
      items: formItems.map(i => ({
        qty: Number(i.qty),
        uom: i.uom,
        description: i.description.trim()
      }))
    };

    const res = await withLoading(() => saveDeliveryNote(payload), "Menyimpan Surat Jalan...");
    if (res.ok) {
      setView("list");
    }
  };

  const handleDeleteDeliveryNote = async (id: number) => {
    if (window.confirm("Apakah Anda yakin ingin menghapus surat jalan ini?")) {
      await withLoading(() => deleteDeliveryNote(id), "Menghapus Surat Jalan...");
    }
  };

  const handleTriggerPrint = (note: any) => {
    setPrintNote(note);
    setTimeout(() => {
      window.print();
    }, 250);
  };

  // Derive stats
  const totalNotes = deliveryNotes.length;
  const fngNotes = deliveryNotes.filter(n => n.category === "FNG").length;
  const dlvNotes = deliveryNotes.filter(n => n.category === "DLV").length;
  const stwNotes = deliveryNotes.filter(n => n.category === "STW").length;
  const etcNotes = deliveryNotes.filter(n => n.category === "ETC").length;

  // Filter & Search Logic
  const filteredNotes = deliveryNotes.filter(n => {
    const matchesCat = activeCat === "ALL" || n.category === activeCat;

    const sq = searchQuery.toLowerCase().trim();
    if (!sq) return matchesCat;

    const matchesBatch = String(n.batch || "").toLowerCase().includes(sq);
    const matchesDest = String(n.destination || "").toLowerCase().includes(sq);
    const matchesAttn = String(n.attn || "").toLowerCase().includes(sq);
    const matchesProj = String(n.project_no || "").toLowerCase().includes(sq);

    // Search inside item descriptions
    const matchesItems = (n.items || []).some((item: any) =>
      String(item.description || "").toLowerCase().includes(sq)
    );

    return matchesCat && (matchesBatch || matchesDest || matchesAttn || matchesProj || matchesItems);
  });

  // Autocomplete filter
  const addressSuggestions = formDestination.trim()
    ? shippingAddresses.filter(addr =>
        addr.destination.toLowerCase().includes(formDestination.toLowerCase())
      )
    : [];

  const handleSelectSuggestion = (addr: any) => {
    setFormDestination(addr.destination);
    setFormAttn(addr.attn || "");
    setFormFullAddress(addr.full_address || "");
    setShowAddressSuggestions(false);
  };

  return (
    <div className="delivery-container">
      {/* Hidden print asset */}
      <PrintDeliveryNote note={printNote} />

      {/* Main page Header */}
      <div className="delivery-header">
        <div className="delivery-title">
          <Truck size={24} style={{ color: T.primary }} />
          <span>Sistem Surat Jalan (Delivery Note)</span>
        </div>

        <div className="delivery-actions">
          {view === "list" && (
            <>
              <BtnG onClick={() => setView("address_manager")}>
                <Building2 size={16} /> Kelola Alamat
              </BtnG>
              <BtnP onClick={() => handleOpenNoteForm()}>
                <Plus size={16} /> Buat Surat Jalan
              </BtnP>
            </>
          )}

          {view === "address_manager" && (
            <BtnG onClick={() => { setView("list"); setAddrFormOpen(false); }}>
              <ArrowLeft size={16} /> Kembali
            </BtnG>
          )}

          {view === "form" && (
            <BtnG onClick={() => setView("list")}>
              <ArrowLeft size={16} /> Batal
            </BtnG>
          )}
        </div>
      </div>

      {/* VIEW: 1. LIST OF NOTES VIEW */}
      {view === "list" && (
        <>
          {/* Quick stats blocks */}
          <div className="delivery-stats">
            <div className={`delivery-stat-card cat-all ${activeCat === "ALL" ? "active" : ""}`} onClick={() => setActiveCat("ALL")}>
              <div className="delivery-stat-lbl">Semua SJ</div>
              <div className="delivery-stat-val">{totalNotes}</div>
              <div className="delivery-stat-sub">Semua Kategori</div>
            </div>
            <div className={`delivery-stat-card cat-fng ${activeCat === "FNG" ? "active" : ""}`} onClick={() => setActiveCat("FNG")}>
              <div className="delivery-stat-lbl">Finish Good</div>
              <div className="delivery-stat-val">{fngNotes}</div>
              <div className="delivery-stat-sub">Kirim ke Customer</div>
            </div>
            <div className={`delivery-stat-card cat-dlv ${activeCat === "DLV" ? "active" : ""}`} onClick={() => setActiveCat("DLV")}>
              <div className="delivery-stat-lbl">Sub Vendor</div>
              <div className="delivery-stat-val">{dlvNotes}</div>
              <div className="delivery-stat-sub">Pekerjaan Luar</div>
            </div>
            <div className={`delivery-stat-card cat-stw ${activeCat === "STW" ? "active" : ""}`} onClick={() => setActiveCat("STW")}>
              <div className="delivery-stat-lbl">Site Work</div>
              <div className="delivery-stat-val">{stwNotes}</div>
              <div className="delivery-stat-sub">Proyek Lapangan</div>
            </div>
            <div className={`delivery-stat-card cat-etc ${activeCat === "ETC" ? "active" : ""}`} onClick={() => setActiveCat("ETC")}>
              <div className="delivery-stat-lbl">Lain-lain</div>
              <div className="delivery-stat-val">{etcNotes}</div>
              <div className="delivery-stat-sub">Umum / Operasional</div>
            </div>
          </div>

          {/* Filtering and Toolbar */}
          <div className="delivery-toolbar">
            <div className="delivery-search">
              <Search className="delivery-search-icon" size={16} />
              <input
                type="text"
                className="delivery-search-input"
                placeholder="Cari nomor batch, tujuan, item..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="delivery-tabs">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  className={`delivery-tab-btn ${activeCat === cat.id ? "active" : ""}`}
                  onClick={() => setActiveCat(cat.id)}
                >
                  {cat.id === "ALL" ? "Semua" : cat.id}
                </button>
              ))}
            </div>
          </div>

          {/* List Card Container */}
          <div className="delivery-card">
            {filteredNotes.length === 0 ? (
              <div className="delivery-empty">
                <div className="delivery-empty-icon">📭</div>
                <h3>Tidak ada Surat Jalan ditemukan</h3>
                <p style={{ fontSize: '12px', marginTop: '4px' }}>Silakan sesuaikan filter pencarian atau buat surat jalan baru.</p>
              </div>
            ) : (
              <div className="delivery-table-wrap">
                <table className="delivery-table">
                  <thead>
                    <tr>
                      <th>Batch No.</th>
                      <th>Kategori</th>
                      <th>Tanggal</th>
                      <th>Tujuan</th>
                      <th>Penerima (Attn)</th>
                      <th>Deskripsi Barang</th>
                      <th style={{ textAlign: "right" }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredNotes.map((note) => (
                      <tr key={note.id}>
                        <td style={{ fontWeight: 800 }}>{note.batch}</td>
                        <td>
                          <span className={`delivery-badge ${note.category.toLowerCase()}`}>
                            {note.category}
                          </span>
                        </td>
                        <td>{fmtDate(note.date)}</td>
                        <td style={{ fontWeight: 600 }}>{note.destination}</td>
                        <td>{note.attn || "-"}</td>
                        <td>
                          <div className="delivery-cell-items">
                            {(note.items || []).map((i: any) => `${i.qty} ${i.uom} x ${i.description}`).join(", ")}
                          </div>
                        </td>
                        <td>
                          <div className="delivery-row-actions">
                            <button
                              className="icon-btn btn-print"
                              title="Cetak Surat Jalan"
                              onClick={() => handleTriggerPrint(note)}
                            >
                              <Printer size={14} />
                            </button>
                            <button
                              className="icon-btn"
                              title="Edit Surat Jalan"
                              onClick={() => handleOpenNoteForm(note)}
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              className="icon-btn btn-delete"
                              title="Hapus Surat Jalan"
                              onClick={() => handleDeleteDeliveryNote(note.id)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* VIEW: 2. SHIPPING ADDRESS MANAGER VIEW */}
      {view === "address_manager" && (
        <div className="delivery-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: "800", color: T.text }}>
              Buku Alamat Pengiriman
            </h3>
            {!addrFormOpen && (
              <BtnP onClick={() => handleOpenAddrForm()}>
                <Plus size={16} /> Tambah Alamat Baru
              </BtnP>
            )}
          </div>

          {/* Add / Edit Address form panel */}
          {addrFormOpen && (
            <div
              style={{
                background: "var(--t-surface)",
                border: "1px solid var(--t-border)",
                borderRadius: "16px",
                padding: "20px",
                marginBottom: "24px",
                backdropFilter: "blur(10px)"
              }}
            >
              <h4 style={{ fontSize: "14px", fontWeight: "800", marginBottom: "14px", color: T.text }}>
                {editingAddr ? "Edit Alamat Pengiriman" : "Tambah Alamat Pengiriman Baru"}
              </h4>
              <form onSubmit={handleSaveAddress}>
                <div className="delivery-form-grid">
                  <div className="form-group">
                    <label className="form-lbl">Nama Tujuan (Perusahaan/Site)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Contoh: PT. Krakatau Steel (Persero) Tbk"
                      value={addrDestination}
                      onChange={e => setAddrDestination(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-lbl">Penerima (Attn)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Contoh: Bpk. Bambang Hermawan"
                      value={addrAttn}
                      onChange={e => setAddrAttn(e.target.value)}
                    />
                  </div>
                  <div className="form-group col-span-2">
                    <label className="form-lbl">Kontak / Telepon</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Contoh: 0812-3456-7890"
                      value={addrContact}
                      onChange={e => setAddrContact(e.target.value)}
                    />
                  </div>
                  <div className="form-group col-span-2">
                    <label className="form-lbl">Alamat Lengkap</label>
                    <textarea
                      className="form-input"
                      style={{ minHeight: "80px", resize: "vertical" }}
                      placeholder="Masukkan alamat lengkap pengiriman untuk dicetak..."
                      value={addrFullAddress}
                      onChange={e => setAddrFullAddress(e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "14px" }}>
                  <BtnG type="button" onClick={() => setAddrFormOpen(false)}>
                    <X size={14} /> Batal
                  </BtnG>
                  <BtnP type="submit">
                    <Check size={14} /> Simpan Alamat
                  </BtnP>
                </div>
              </form>
            </div>
          )}

          {/* List layout of addresses */}
          {shippingAddresses.length === 0 ? (
            <div className="delivery-empty">
              <div className="delivery-empty-icon">📍</div>
              <h3>Belum ada alamat pengiriman tercatat</h3>
              <p style={{ fontSize: '12px', marginTop: '4px' }}>Alamat pengiriman membantu mempercepat pengisian surat jalan.</p>
            </div>
          ) : (
            <div className="address-grid">
              {shippingAddresses.map((addr) => (
                <div className="address-card" key={addr.id}>
                  <div className="address-card-header">
                    <div className="address-card-title">{addr.destination}</div>
                    <div style={{ display: "flex", gap: "4px" }}>
                      <button
                        className="icon-btn"
                        style={{ width: "26px", height: "26px" }}
                        onClick={() => handleOpenAddrForm(addr)}
                      >
                        <Edit size={12} />
                      </button>
                      <button
                        className="icon-btn btn-delete"
                        style={{ width: "26px", height: "26px" }}
                        onClick={() => handleDeleteAddress(addr.id)}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  <div className="address-card-meta">
                    {addr.attn && (
                      <div>
                        <strong>Attn:</strong> {addr.attn}
                      </div>
                    )}
                    {addr.contact && (
                      <div>
                        <strong>Kontak:</strong> {addr.contact}
                      </div>
                    )}
                  </div>

                  {addr.full_address && (
                    <div className="address-card-desc">{addr.full_address}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW: 3. CREATE / EDIT DELIVERY NOTE FORM */}
      {view === "form" && (
        <div className="delivery-card">
          <h3 style={{ fontSize: "16px", fontWeight: "800", marginBottom: "20px", color: T.text }}>
            {editingNote && !editingNote.isNew ? `Edit Surat Jalan: ${formBatch}` : "Buat Surat Jalan Baru"}
          </h3>

          <form onSubmit={handleSaveDeliveryNote}>
            <div className="delivery-form-grid">
              <div className="form-group">
                <label className="form-lbl">Nomor Batch (Auto-Generated)</label>
                <input
                  type="text"
                  className="form-input"
                  value={formBatch}
                  onChange={e => setFormBatch(e.target.value)}
                  style={{ fontWeight: "bold" }}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-lbl">Kategori</label>
                <select
                  className="form-input"
                  value={formCategory}
                  onChange={e => setFormCategory(e.target.value)}
                  disabled={editingNote && !editingNote.isNew}
                >
                  <option value="FNG">FNG - Finish Good (Customer)</option>
                  <option value="DLV">DLV - Sub Vendor (Pekerjaan Luar)</option>
                  <option value="STW">STW - Site Work (Proyek Lapangan)</option>
                  <option value="ETC">ETC - Lain-lain (Umum / Operasional)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-lbl">Tanggal Pengiriman</label>
                <input
                  type="date"
                  className="form-input"
                  value={formDate}
                  onChange={e => setFormDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-lbl">Nomor Proyek (Project No.)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Contoh: PROJ-2026-X"
                  value={formProjectNo}
                  onChange={e => setFormProjectNo(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-lbl">Nomor Kendaraan / Driver</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Contoh: B 9876 CG / Driver Ahmad"
                  value={formNoKendaraan}
                  onChange={e => setFormNoKendaraan(e.target.value)}
                />
              </div>

              {/* Destination Autocomplete integration */}
              <div className="form-group" ref={autocompleteRef}>
                <label className="form-lbl">Tujuan Pengiriman (Destination)</label>
                <div className="autocomplete-wrap">
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ketik nama tujuan untuk melacak buku alamat..."
                    value={formDestination}
                    onChange={e => {
                      setFormDestination(e.target.value);
                      setShowAddressSuggestions(true);
                    }}
                    onFocus={() => setShowAddressSuggestions(true)}
                    required
                  />

                  {showAddressSuggestions && addressSuggestions.length > 0 && (
                    <div className="autocomplete-dropdown">
                      {addressSuggestions.map(addr => (
                        <div
                          key={addr.id}
                          className="autocomplete-item"
                          onClick={() => handleSelectSuggestion(addr)}
                        >
                          <div className="autocomplete-title">{addr.destination}</div>
                          {addr.attn && <div className="autocomplete-desc">Attn: {addr.attn}</div>}
                          {addr.full_address && <div className="autocomplete-desc">{addr.full_address}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="form-group col-span-2">
                <label className="form-lbl">Penerima (Attn)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Nama contact person penerima barang..."
                  value={formAttn}
                  onChange={e => setFormAttn(e.target.value)}
                />
              </div>

              <div className="form-group col-span-2">
                <label className="form-lbl">Alamat Lengkap Pengiriman</label>
                <textarea
                  className="form-input"
                  style={{ minHeight: "80px", resize: "vertical" }}
                  placeholder="Tulis alamat tujuan pengiriman selengkap mungkin untuk dicetak..."
                  value={formFullAddress}
                  onChange={e => setFormFullAddress(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            {/* Dynamic list rows */}
            <div className="form-items-section">
              <div className="form-items-title">
                <span>Daftar Barang (List of Goods)</span>
                <BtnG type="button" onClick={handleAddItemRow} style={{ padding: "6px 12px", fontSize: "11px" }}>
                  <Plus size={12} /> Tambah Item Baris
                </BtnG>
              </div>

              <table className="form-items-table">
                <thead>
                  <tr>
                    <th style={{ width: "90px" }}>Jumlah (Qty)</th>
                    <th style={{ width: "120px" }}>Satuan (Unit)</th>
                    <th>Deskripsi Barang (Description of Goods)</th>
                    <th style={{ width: "40px", textAlign: "right" }}>Hapus</th>
                  </tr>
                </thead>
                <tbody>
                  {formItems.map((item, idx) => (
                    <tr key={idx}>
                      <td>
                        <input
                          type="number"
                          className="form-input"
                          style={{ textAlign: "center" }}
                          value={item.qty}
                          onChange={e => handleItemFieldChange(idx, "qty", e.target.value)}
                          min="1"
                          required
                        />
                      </td>
                      <td>
                        <select
                          className="form-input"
                          value={item.uom}
                          onChange={e => handleItemFieldChange(idx, "uom", e.target.value)}
                        >
                          {UOM_OPTIONS.map(opt => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Masukkan nama barang, spesifikasi, atau seri..."
                          value={item.description}
                          onChange={e => handleItemFieldChange(idx, "description", e.target.value)}
                          required
                        />
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          className="icon-btn btn-delete"
                          onClick={() => handleRemoveItemRow(idx)}
                          disabled={formItems.length === 1}
                          style={{ opacity: formItems.length === 1 ? 0.3 : 1 }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="form-btn-row">
              <BtnG type="button" onClick={() => setView("list")}>
                Batal
              </BtnG>
              <BtnP type="submit">
                Simpan & Selesai
              </BtnP>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
