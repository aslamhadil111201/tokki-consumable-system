// @ts-nocheck
import { useState, useEffect } from "react";
import "./StockPage.css";
import { Badge } from "../../components/ui/Badge";
import { BtnP } from "../../components/ui/BtnP";
import { BtnG } from "../../components/ui/BtnG";
import { UIIcon } from "../../components/ui/UIIcon";
import { ProgBlocks } from "../../components/ui/Prog";
import { StockSkeleton } from "../../components/ui/Skeleton";
import { fmtMoney } from "../../utils/formatters";
import { stockStatus, stockStatusKey, stockStatusIcon, catColor } from "../../utils/stockHelpers";
import { CATS } from "../../constants/index";
import { useStore } from "../../store/useStore";
import { NewItemModal } from "../../components/modals/NewItemModal";
import { AddStockModal } from "../../components/modals/AddStockModal";
import { EditItemModal } from "../../components/modals/EditItemModal";
import { TransactionModal } from "../../components/modals/TransactionModal";
import { getT } from "../../theme/tokens";

export function StockPage() {
  const { items, user, dark, dataReady } = useStore();
  const T = getT(dark);
  
  const [catF, setCatF] = useState("Semua");
  const [stockStatusF, setStockStatusF] = useState("Semua");
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
    .filter(i => (catF === "Semua" || i.category === catF) && i.name.toLowerCase().includes(searchQ.toLowerCase()))
    .filter(i => !statusFilterKey || stockStatusKey(i) === statusFilterKey);
    
  const totalPages = Math.ceil(filtItems.length / Math.max(1, stockPageSize));
  const currentPage = stockPage > totalPages ? 1 : stockPage;
  const pagedItems = filtItems.slice((currentPage - 1) * stockPageSize, currentPage * stockPageSize);

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

  return (
    <div>
      {!dataReady && <StockSkeleton />}
      {dataReady && (<>
      {/* ── Filter bar (with action buttons) ── */}
      <div className="stock-filter-container">
        <div className="stock-filter-top">
          <div className="stock-search-wrap">
            <span className="stock-search-icon"><UIIcon name="search" size={15} /></span>
            <input className="ifield stock-search-input" placeholder="Cari barang..." value={searchQ} onChange={e => setSearchQ(e.target.value)} />
          </div>
          <div className="stock-actions">
            {canManage && <BtnG onClick={() => setShowNewItem(true)} className="stock-action-btn-new"><UIIcon name="plus" size={14} /> Add New Item</BtnG>}
            {canManage && <BtnP onClick={() => { setQuickInItem(null); setShowAdd(true); }} className="stock-action-btn-recv"><UIIcon name="receive" size={14} /> Receive New</BtnP>}
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

      <div className="stock-g">
        {filtItems.length === 0 && (
          <div className="stock-empty-state">
            <div className="stock-empty-icon"><UIIcon name="search" size={34} /></div>
            Tidak ada barang ditemukan
          </div>
        )}
        {pagedItems.map(it => {
          const s = stockStatus(it, dark); const cc = catColor(it.category, dark); const pct = it.minStock ? Math.min(100, it.stock / it.minStock * 100) : 100;
          const cardBorder = s.label === "Aman" ? cc.dot : s.dot;
          return (
            <div key={it.id} className="stk-card" style={{ border: `2px solid ${cardBorder}`, gap: 0 }}>
              {isAdmin && (
                <button onClick={e => { e.stopPropagation(); setEditItem({ ...it }); setShowEdit(true); }} className="stk-menu-btn">⋮</button>
              )}

              <div className="stk-photo-box">
                {it.photo
                  ? <img src={it.photo} alt={it.name} className="stk-photo-img" />
                  : <div className="stk-photo-placeholder" style={{ background: cc.bg }}>📷</div>
                }
              </div>

              <div className="stk-name" style={{ paddingRight: isAdmin ? 24 : 0 }}>{it.name}</div>
              {it.itemCode && <div className="stk-code" style={{ color: cc.dot }}>Kode: {it.itemCode}</div>}
              
              <div className="stk-cat-row">
                <span className="stk-cat-dot" style={{ background: cc.dot }} />
                <span className="stk-cat-text" style={{ color: cc.text }}>{it.category}</span>
              </div>

              <div className="stk-divider" />

              <div className="stk-stock-row">
                <div>
                  <span className="stk-stock-val" style={{ color: cardBorder }}>{it.stock}</span>
                  <span className="stk-stock-unit">{it.unit}</span>
                </div>
                <Badge bg={s.bg} color={s.text} border={s.border} className="stk-stock-badge">
                  {s.icon} {s.label}
                </Badge>
              </div>
              
              <div className="stk-min-stock">Min: {it.minStock} {it.unit}</div>
              <ProgBlocks pct={pct} color={cardBorder} />
              <div className="stk-pct-text">{Math.round(pct)}% dari kebutuhan minimum</div>

              <div className="stk-divider" />

              <div className="stk-price-grid">
                <div className="stk-price-box">
                  <div className="stk-price-lbl">Avg</div>
                  <div className="stk-price-val">{fmtMoney(it.averageCost)}</div>
                </div>
                <div className="stk-price-box">
                  <div className="stk-price-lbl">Last</div>
                  <div className="stk-price-val">{fmtMoney(it.lastPrice)}</div>
                </div>
              </div>

              <div className="stk-val-wrap">
                <div className="stk-price-lbl">Total Value</div>
                <div className="stk-val-val">{fmtMoney(it.totalValue)}</div>
              </div>

              <div className="stk-btn-row">
                {isAdmin && (
                  <button onClick={() => openQuickIn(it)} className="stk-btn-in">↓ Masuk</button>
                )}
                <button onClick={() => openQuickOut(it)} className="stk-btn-out">↑ Keluar</button>
              </div>
            </div>
          );
        })}
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
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setStockPage(i + 1)}
                style={{ width: 36, height: 36, borderRadius: 9, border: `1px solid ${currentPage === i + 1 ? T.primary : T.border}`, background: currentPage === i + 1 ? T.primary : T.surface, color: currentPage === i + 1 ? "white" : T.muted, fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 13, fontWeight: 800, cursor: "pointer", transition: "all .18s" }}
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
