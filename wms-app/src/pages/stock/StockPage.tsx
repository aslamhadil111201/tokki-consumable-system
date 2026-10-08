// @ts-nocheck
import { useLocation } from "react-router-dom";
import { getPageIndices } from "../../utils/pagination";
import { useState, useEffect } from "react";
import "./StockPage.css";
import { Badge } from "../../components/ui/Badge";
import { BtnP } from "../../components/ui/BtnP";
import { BtnG } from "../../components/ui/BtnG";
import { UIIcon } from "../../components/ui/UIIcon";
import { StockSkeleton } from "../../components/ui/Skeleton";
import { fmtMoney } from "../../utils/formatters";
import { stockStatus, stockStatusKey, stockStatusIcon } from "../../utils/stockHelpers";
import { CATS } from "../../constants/index";
import { useStore } from "../../store/useStore";
import { NewItemModal } from "../../components/modals/NewItemModal";
import { AddStockModal } from "../../components/modals/AddStockModal";
import { EditItemModal } from "../../components/modals/EditItemModal";
import { TransactionModal } from "../../components/modals/TransactionModal";
import { getT } from "../../theme/tokens";

export function StockPage() {
  const { items, user, dark, dataReady, deleteItem } = useStore();
  const T = getT(dark);
  
  const [catF, setCatF] = useState("Semua");
  const location = useLocation();
  const [stockStatusF, setStockStatusF] = useState(() => {
    const incoming = location.state?.stockStatusFilter;
    return ["Aman", "Mendekati", "Menipis", "Habis"].includes(incoming) ? incoming : "Semua";
  });
  const [searchQ, setSearchQ] = useState("");
  
  const [stockPage, setStockPage] = useState(1);
  const [stockPageSize, setStockPageSize] = useState(12);

  useEffect(() => {
    setStockPage(1);
  }, [catF, stockStatusF, searchQ]);

  const [showNewItem, setShowNewItem] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [quickInItem, setQuickInItem] = useState<any>(null);
  
  const [showEdit, setShowEdit] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  
  const [showQuickOut, setShowQuickOut] = useState(false);
  const [quickOutItem, setQuickOutItem] = useState<any>(null);

  const isAdmin = (user?.role || "").toLowerCase() === "admin";
  const canManage = isAdmin || (user?.role || "").toLowerCase() === "operator";

  const statusFilterKey = { Aman: "aman", Mendekati: "mendekati", Menipis: "menipis", Habis: "habis" }[stockStatusF] || "";
  const hasActiveStockFilters = catF !== "Semua" || stockStatusF !== "Semua" || searchQ.trim() !== "";
  
  const filtItems = items
    .filter(i => (catF === "Semua" || i.category === catF) && `${i.name} ${i.itemCode || ""}`.toLowerCase().includes(searchQ.toLowerCase()))
    .filter(i => !statusFilterKey || stockStatusKey(i) === statusFilterKey);
    
  const totalPages = Math.ceil(filtItems.length / Math.max(1, stockPageSize));
  const currentPage = stockPage > totalPages ? 1 : stockPage;
  const pagedItems = filtItems.slice((currentPage - 1) * stockPageSize, currentPage * stockPageSize);

  const [itemPhotos, setItemPhotos] = useState<Record<number, string>>({});

  useEffect(() => {
    if (pagedItems.length === 0) return;
    const ids = pagedItems.map(i => i.id);
    let active = true;

    const fetchPhotos = async () => {
      const { globalPhotoCache } = await import("../../utils/helpers");
      const missingIds = ids.filter(id => !globalPhotoCache[id]);
      
      if (missingIds.length > 0) {
        const { supabase } = await import("../../lib/supabase");
        const { data } = await supabase
          .from("items")
          .select("id, photo")
          .in("id", missingIds);
        if (data) {
          data.forEach(d => {
            if (d.photo) globalPhotoCache[Number(d.id)] = d.photo;
          });
        }
      }

      if (active) {
        const mapped: Record<number, string> = {};
        ids.forEach(id => {
          if (globalPhotoCache[id]) mapped[id] = globalPhotoCache[id];
        });
        setItemPhotos(prev => ({ ...prev, ...mapped }));
      }
    };

    fetchPhotos();
    return () => { active = false; };
  }, [currentPage, stockPageSize, catF, stockStatusF, searchQ, items]);

  const filtMenipisCount = filtItems.filter(i => stockStatusKey(i) === "menipis").length;
  const filtHabisCount = filtItems.filter(i => stockStatusKey(i) === "habis").length;

  const resetStockFilters = () => {
    setCatF("Semua"); setStockStatusF("Semua"); setSearchQ("");
  };

  const openQuickIn = (item: any) => {
    setQuickInItem(item);
    setShowAdd(true);
  };

  const openQuickOut = (item: any) => {
    setQuickOutItem(item);
    setShowQuickOut(true);
  };

  const handleDeleteItem = async (it: any) => {
    if (confirm(`Apakah Anda yakin ingin menghapus barang "${it.name}"?`)) {
      await deleteItem(it.id);
    }
  };

  return (
    <div>
      {!dataReady && <StockSkeleton />}
      {dataReady && (<>
      {/* ── Filter bar (with action buttons) ── */}
      <div className="stock-filter-container">
        <div className="stock-filter-top">
          <div className="stock-search-wrap">
            <span className="stock-search-icon"><UIIcon name="search" size={15} /></span>
            <input className="ifield stock-search-input" placeholder="Cari nama barang atau kode…" value={searchQ} onChange={e => setSearchQ(e.target.value)} />
          </div>
          <div className="stock-actions">
            {canManage && <BtnG onClick={() => setShowNewItem(true)} className="stock-action-btn-new"><UIIcon name="plus" size={14} /> Tambah barang</BtnG>}
            {canManage && <BtnP onClick={() => { setQuickInItem(null); setShowAdd(true); }} className="stock-action-btn-recv"><UIIcon name="receive" size={14} /> Catat penerimaan</BtnP>}
          </div>
        </div>

        <div className="stock-filter-panel">
          <div className="stock-filter-row">
            <div className="stock-filter-label">Status</div>
            <div className="stock-filter-group">
              {["Semua", "Aman", "Mendekati", "Menipis", "Habis"].map(s => {
                const active = stockStatusF === s;
                const statusKey = s === "Aman" ? "aman" : s === "Mendekati" ? "mendekati" : s === "Menipis" ? "menipis" : s === "Habis" ? "habis" : "semua";
                return (
                  <button key={s} onClick={() => setStockStatusF(s)} className={`stk-filter-btn stk-status-btn--${statusKey}${active ? ' active' : ''}`}>
                    {stockStatusIcon(statusKey, 14)}
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="stock-summary-panel">
          <div className="stock-summary-stats">
            <div className="stock-summary-item">
              <div className="stock-summary-icon stock-summary-icon--primary"><UIIcon name="boxes" size={20} /></div>
              <div>
                <div className="stock-summary-val stock-summary-val--primary">{filtItems.length} Item</div>
                <div className="stock-summary-lbl">Total ditemukan</div>
              </div>
            </div>
            <div className="stock-summary-divider" />
            <div className="stock-summary-item">
              <div className="stock-summary-icon" style={{ color: "#16a34a", background: "rgba(22,163,74,0.1)" }}><UIIcon name="shield" size={20} /></div>
              <div>
                <div className="stock-summary-val" style={{ color: "#16a34a" }}>{filtItems.filter(i => stockStatusKey(i) === "aman").length} Aman</div>
                <div className="stock-summary-lbl">Stok aman</div>
              </div>
            </div>
            <div className="stock-summary-divider" />
            <div className="stock-summary-item">
              <div className="stock-summary-icon" style={{ color: "#d97706", background: "rgba(217,119,6,0.1)" }}><UIIcon name="clock" size={20} /></div>
              <div>
                <div className="stock-summary-val" style={{ color: "#d97706" }}>{filtItems.filter(i => stockStatusKey(i) === "mendekati").length} Mendekati</div>
                <div className="stock-summary-lbl">Mendekati minimum</div>
              </div>
            </div>
            <div className="stock-summary-divider" />
            <div className="stock-summary-item">
              <div className="stock-summary-icon stock-summary-icon--amber"><UIIcon name="alert" size={20} /></div>
              <div>
                <div className="stock-summary-val stock-summary-val--amber">{filtMenipisCount} Menipis</div>
                <div className="stock-summary-lbl">Stok menipis</div>
              </div>
            </div>
            <div className="stock-summary-divider" />
            <div className="stock-summary-item">
              <div className="stock-summary-icon stock-summary-icon--red"><UIIcon name="x" size={20} /></div>
              <div>
                <div className="stock-summary-val stock-summary-val--red">{filtHabisCount} Habis</div>
                <div className="stock-summary-lbl">Stok habis</div>
              </div>
            </div>
          </div>
          <button onClick={resetStockFilters} className={`stock-reset-btn${hasActiveStockFilters ? '' : ' stock-reset-btn--dim'}`}>
            <UIIcon name="rotate" size={14} /> Reset Filter
          </button>
        </div>
      </div>

      <div className="workspace-stock-table">
        <table>
          <thead><tr><th>Kode barang</th><th>Nama barang</th><th className="number-cell">Stok</th><th className="number-cell">Minimum</th><th>Status</th><th className="number-cell">Nilai persediaan</th><th>Aksi</th></tr></thead>
          <tbody>
            {pagedItems.map(it => { const s = stockStatus(it, dark); return (
              <tr key={it.id}>
                <td className="workspace-code">{it.itemCode || "—"}</td>
                <td><div className="workspace-stock-name">{itemPhotos[Number(it.id)] && <img src={itemPhotos[Number(it.id)]} alt="" loading="lazy" />}<div><strong>{it.name}</strong><span>{it.category}</span></div></div></td>
                <td className="number-cell"><strong>{Number(it.stock).toLocaleString("id-ID")}</strong> <span>{it.unit}</span></td>
                <td className="number-cell">{it.minStock} {it.unit}</td>
                <td><Badge bg={s.bg} color={s.text} border={s.border}>{s.label}</Badge></td>
                <td className="number-cell">{fmtMoney(it.totalValue)}</td>
                <td><div className="workspace-stock-actions">
                  {isAdmin && <button onClick={() => openQuickIn(it)}>Masuk</button>}
                  <button onClick={() => openQuickOut(it)}>Keluar</button>
                  {isAdmin && <details className="workspace-item-menu"><summary aria-label={`Aksi lainnya untuk ${it.name}`}>⋯</summary><div><button onClick={() => { setEditItem({ ...it }); setShowEdit(true); }}>Edit barang</button><button className="workspace-danger" onClick={() => handleDeleteItem(it)}>Hapus barang</button><span>Harga rata-rata: {fmtMoney(it.averageCost)}<br />Harga terakhir: {fmtMoney(it.lastPrice)}</span></div></details>}
                </div></td>
              </tr>
            ); })}
          </tbody>
        </table>
        {filtItems.length === 0 && <div className="stock-empty-state">Tidak ada barang yang sesuai.<button onClick={resetStockFilters}>Reset pencarian</button></div>}
      </div>

      {/* Pagination & page size selection */}
      {filtItems.length > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24, gap: 12, flexWrap: "wrap", background: T.card, border: `1px solid ${T.border}`, padding: "12px 18px", borderRadius: 16, boxShadow: T.shadowSm }}>
          <span style={{ fontSize: 12, color: T.muted, fontWeight: 600 }}>
            Menampilkan {Math.min(filtItems.length, (currentPage - 1) * stockPageSize + 1)}-{Math.min(currentPage * stockPageSize, filtItems.length)} dari {filtItems.length} item
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              onClick={() => setStockPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              style={{ display: "flex", alignItems: "center", gap: 4, padding: "8px 16px", borderRadius: 9, border: `1px solid ${T.border}`, background: T.surface, color: currentPage <= 1 ? T.muted : T.text, fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 12.5, fontWeight: 700, cursor: currentPage <= 1 ? "default" : "pointer", opacity: currentPage <= 1 ? 0.5 : 1, transition: "all .18s" }}
            >
              ‹ Prev
            </button>
            {getPageIndices(totalPages, currentPage).map(i => (
              <button
                key={i}
                onClick={() => setStockPage(i + 1)}
                style={{ width: 36, height: 36, borderRadius: 9, border: `1px solid ${currentPage === i + 1 ? T.primary : T.border}`, background: currentPage === i + 1 ? T.primary : T.surface, color: currentPage === i + 1 ? "white" : T.muted, fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all .18s" }}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => setStockPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              style={{ display: "flex", alignItems: "center", gap: 4, padding: "8px 16px", borderRadius: 9, border: `1px solid ${T.border}`, background: T.surface, color: currentPage >= totalPages ? T.muted : T.text, fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 12.5, fontWeight: 700, cursor: currentPage >= totalPages ? "default" : "pointer", opacity: currentPage >= totalPages ? 0.5 : 1, transition: "all .18s" }}
            >
              Next ›
            </button>
          </div>
          <select
            value={stockPageSize}
            onChange={e => { setStockPageSize(Number(e.target.value) || 12); setStockPage(1); }}
            style={{ padding: "8px 12px", borderRadius: 9, border: `1px solid ${T.border}`, background: T.surface, color: T.text, fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer", outline: "none" }}
          >
            {[8, 12, 24, 48].map(n => (
              <option key={n} value={n}>{n} / halaman</option>
            ))}
          </select>
        </div>
      )}

      <NewItemModal open={showNewItem} onClose={() => setShowNewItem(false)} />
      <AddStockModal initialItem={quickInItem} open={showAdd} onClose={() => { setShowAdd(false); setQuickInItem(null); }} />
      <EditItemModal item={editItem} open={showEdit} onClose={() => { setShowEdit(false); setEditItem(null); }} />
      <TransactionModal initialItem={quickOutItem} open={showQuickOut} onClose={() => { setShowQuickOut(false); setQuickOutItem(null); }} />
      </>)}
    </div>
  );
}

