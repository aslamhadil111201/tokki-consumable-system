// @ts-nocheck
import { useState } from "react";
import "./DashboardPage.css";
import { gText } from "../../theme/tokens";
import { Badge } from "../../components/ui/Badge";
import { BtnP } from "../../components/ui/BtnP";
import { BtnG } from "../../components/ui/BtnG";
import { Prog } from "../../components/ui/Prog";
import { DashboardSkeleton } from "../../components/ui/Skeleton";
import { stockStatus } from "../../utils/stockHelpers";
import { fmtMoney, fmtMoneyShort, fmtDate, todayFmt, isoDate, todayStr } from "../../utils/formatters";
import { trxApprovalStatus, isApprovedOutTrx } from "../../utils/helpers";
import { useStore } from "../../store/useStore";
import { TransactionModal } from "../../components/modals/TransactionModal";
import { useNavigate } from "react-router-dom";

export function DashboardPage() {
  const { dark, items, trx, receives, user, setToast, dataReady } = useStore();
  const navigate = useNavigate();

  const [dashTrendPointIdx, setDashTrendPointIdx] = useState(-1);
  const [showModal, setShowModal] = useState(false);

  const isAdmin = (user?.role || "").toLowerCase() === "admin";

  // Core derivations
  const approvedOutTrx = trx.filter(isApprovedOutTrx);
  const todayTrx = approvedOutTrx.filter(t => t.date === todayStr());
  const todayUnits = todayTrx.reduce((a, t) => a + (t.items || []).reduce((b: number, i: any) => b + i.qty, 0), 0);
  const lowStock = items.filter(i => i.stock <= i.minStock);
  
  // Dashboard specific derivations
  const dashStockAman = items.filter(i => Number(i.stock) > Number(i.minStock)).length;
  const dashStockMenipis = items.filter(i => Number(i.stock) > 0 && Number(i.stock) <= Number(i.minStock)).length;
  const dashStockHabis = items.filter(i => Number(i.stock) === 0).length;
  const dashTotalStokPcs = items.reduce((a, i) => a + Number(i.stock || 0), 0);
  const dashTotalNilaiStok = items.reduce((a, it) => a + (Number(it.stock || 0) * Number(it.averageCost || it.lastPrice || 0)), 0);
  
  const _d7s = new Date(); _d7s.setDate(_d7s.getDate() - 6); const dashLast7Start = isoDate(_d7s);
  const dashLast7Days = Array.from({ length: 7 }).map((_, idx) => { const d = new Date(); d.setDate(d.getDate() - (6 - idx)); return isoDate(d); });
  const dashLast7OutQty = dashLast7Days.map(day => approvedOutTrx.filter(t => t.date === day).reduce((a, t) => a + (t.items || []).reduce((b: number, i: any) => b + Number(i.qty || 0), 0), 0));
  
  const dashItemUsageMap: any = {};
  approvedOutTrx.filter(t => t.date >= dashLast7Start).forEach(t => (t.items || []).forEach((it: any) => { const k = String(it.itemName || ""); dashItemUsageMap[k] = (dashItemUsageMap[k] || 0) + Number(it.qty || 0); }));
  
  const dashRecentReceives = [...receives].sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 4);



  const openStockWithFilter = (filter: string) => {
    navigate("/stock", { state: { stockStatusFilter: filter } });
  };

  return (
    <div>
      {/* Skeleton loading – shown while Supabase fetch hasn't completed */}
      {!dataReady && <DashboardSkeleton />}

      {/* Real content – shown after data is ready */}
      {dataReady && (<>
      <div className="dash-hero">
        <div className="dash-hero-content">
          <div className="dash-hero-copy">
            <div className="dash-hero-title">Ringkasan Hari Ini</div>
            <div className="dash-hero-stats">
              <span>{todayFmt()}</span>
              <span className="dash-hero-dot">•</span>
              <span><b className="dash-hero-highlight">{todayTrx.length}</b> transaksi</span>
              <span className="dash-hero-dot">•</span>
              <span><b className="dash-hero-highlight">{todayUnits}</b> unit keluar</span>
            </div>
          </div>
          <BtnP onClick={() => setShowModal(true)} className="dash-hero-btn">＋ Catat Pengambilan</BtnP>
        </div>
      </div>

      {/* Charts 3-col */}
      <div className="workspace-metrics">
        {[
          { label: "Stok tersedia", value: dashTotalStokPcs.toLocaleString("id-ID"), unit: "unit", note: `${items.length} jenis barang` },
          { label: "Nilai persediaan", value: fmtMoneyShort(dashTotalNilaiStok), unit: "", note: "Estimasi harga rata-rata" },
          { label: "Pengambilan hari ini", value: todayTrx.length, unit: "transaksi", note: `${todayUnits} unit barang keluar` },
          { label: "Perlu restock", value: lowStock.length, unit: "item", note: "Stok mencapai batas minimum" },
        ].map(m => <div key={m.label} className="workspace-metric"><span>{m.label}</span><strong>{m.value} <small>{m.unit}</small></strong><p>{m.note}</p></div>)}
      </div>

      {(() => {
        const svgW = 220, svgH = 72;
        const chartDateFontSize = (typeof window !== "undefined" && window.innerWidth >= 1500) ? 5.2 : 6.1;
        const maxQty = Math.max(...dashLast7OutQty, 1);
        const linePoints = dashLast7OutQty.map((v, i) => `${(i / 6) * svgW},${svgH - (v / maxQty) * svgH * 0.85}`).join(" ");
        const areaPoints = `0,${svgH} ${linePoints} ${svgW},${svgH}`;
        const activeTrendPoint = dashLast7OutQty && dashLast7Days && dashTrendPointIdx >= 0 && dashLast7Days[dashTrendPointIdx] !== undefined ? {
          idx: dashTrendPointIdx,
          label: dashLast7Days[dashTrendPointIdx],
          value: dashLast7OutQty[dashTrendPointIdx],
          x: (dashTrendPointIdx / 6) * svgW,
          y: svgH - (dashLast7OutQty[dashTrendPointIdx] / maxQty) * svgH * 0.85,
        } : null;
        return (
          <div className="dash-charts-g">
            {/* Pengambilan mingguan dan status stok */}
            <div className="card dash-chart-card">
              <div className="dash-chart-title" style={{ marginBottom: 6 }}>Trend Keluar (7 Hari Terakhir)</div>
              <div className="dash-trend-hdr">
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 20, height: 2, background: "var(--t-primary)", display: "inline-block", borderRadius: 2 }} />Unit Keluar
                </span>
              </div>
              <div style={{ position: "relative", flex: 1 }} onMouseLeave={() => setDashTrendPointIdx(-1)}>
                {activeTrendPoint && (
                  <div className="dash-trend-tooltip" style={{ left: `${Math.min(Math.max((activeTrendPoint.x / svgW) * 100, 12), 88)}%` }}>
                    <div style={{ fontSize: 10, color: "var(--t-muted)", fontWeight: 700 }}>{activeTrendPoint.label?.slice(5).replace("-", "/")}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "var(--t-primary)", marginTop: 2 }}>{activeTrendPoint.value} unit</div>
                  </div>
                )}
                <svg width="100%" viewBox={`0 0 ${svgW} ${svgH + 22}`} style={{ overflow: "visible", display: "block" }}>
                  {[0, 1, 2].map(i => (
                    <line key={i} x1="0" y1={(svgH * 0.85 / 2) * i} x2={svgW} y2={(svgH * 0.85 / 2) * i} stroke="var(--t-border)" strokeWidth="0.5" strokeDasharray="4 4" />
                  ))}
                  <polygon points={areaPoints} fill={dark ? "rgba(16,185,129,0.08)" : "var(--t-green-bg)"} />
                  <polyline points={linePoints} fill="none" stroke="var(--t-primary)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                  {dashLast7OutQty.map((v, i) => {
                    const pointX = (i / 6) * svgW;
                    const pointY = svgH - (v / maxQty) * svgH * 0.85;
                    const isActive = i === dashTrendPointIdx;
                    return (
                      <g
                        key={i}
                        onMouseEnter={() => setDashTrendPointIdx(i)}
                        onClick={() => setDashTrendPointIdx(i)}
                        style={{ cursor: "pointer" }}
                      >
                        <circle cx={pointX} cy={pointY} r="14" fill="transparent" style={{ pointerEvents: "all" }} />
                        <circle cx={pointX} cy={pointY} r={isActive ? 5 : 4} fill="var(--t-primary)" stroke="var(--t-card)" strokeWidth="2" />
                      </g>
                    );
                  })}
                  {dashLast7Days.map((d, i) => (
                    <text key={i} x={(i / 6) * svgW} y={svgH + 18} textAnchor="middle" fontSize={chartDateFontSize} fill="var(--t-muted)">{d.slice(5).replace("-", "/")}</text>
                  ))}
                </svg>
              </div>
              <div className="dash-table-link" onClick={() => navigate("/report")}>Lihat laporan lengkap →</div>
            </div>
            {/* Status stok */}
            <div className="card dash-chart-card">
              <div className="dash-chart-title">Status Stok</div>
              {[
                { dot: "#10b981", name: "Aman", sub: "> Min Stok", count: dashStockAman, color: "var(--t-primary-light)", filter: "Aman" },
                { dot: "#f59e0b", name: "Menipis", sub: "≤ Min Stok", count: dashStockMenipis, color: "#f59e0b", filter: "Menipis" },
                { dot: "#ef4444", name: "Habis", sub: "Stok = 0", count: dashStockHabis, color: "#ef4444", filter: "Habis" },
              ].map((row, i) => (
                <div key={i} className="dash-status-row" style={{ borderBottom: i < 2 ? "1px solid var(--t-border)" : "none" }}>
                  <div className="dash-status-info">
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: row.dot, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 13, color: "var(--t-text)", fontWeight: 600 }}>{row.name}</div>
                      <div style={{ fontSize: 11, color: "var(--t-muted)" }}>{row.sub}</div>
                    </div>
                  </div>
                  <div className="dash-status-val">
                    <div style={{ fontSize: 14, fontWeight: 700, color: row.color }}>{row.count} Item</div>
                    <div style={{ color: "var(--t-primary)", fontSize: 16, cursor: "pointer", lineHeight: 1 }} onClick={() => openStockWithFilter(row.filter)}>›</div>
                  </div>
                </div>
              ))}
              <div className="dash-table-link" onClick={() => openStockWithFilter("Semua")}>Lihat semua item →</div>
            </div>
          </div>
        );
      })()}



      {/* Tables 2-col */}
      <div className="dash-tables-g">
        {/* Barang Hampir Habis */}
        <div className="card">
          <div className="dash-table-header">
            <div className="dash-table-title">Barang yang Perlu Restock</div>
            <span className="dash-table-badge dash-table-badge-amber">{lowStock.length} Item</span>
          </div>
          {lowStock.length === 0
            ? <div className="dash-empty-state"><div className="dash-empty-icon">—</div>Semua stok aman</div>
            : (<>
              <div className="dash-low-hdr dash-row-border">
                <span>Item</span><span>Stok</span><span>Min Stok</span><span className="dash-col-satuan">Satuan</span>
              </div>
              {lowStock.slice(0, 4).map(it => {
                const s = stockStatus(it, dark); return (
                  <div key={it.id} className="dash-low-row dash-row-border">
                    <div className="dash-item-cell">
                      <div className="dash-item-info">
                        <div className="dash-item-name">{it.name}</div>
                        <div className="dash-item-cat">{it.category || ""}</div>
                      </div>
                    </div>
                    <span style={{ color: s.dot, fontWeight: 700 }}>{it.stock}</span>
                    <span>{it.minStock}</span>
                    <span className="dash-col-satuan">{it.unit}</span>
                  </div>
                );
              })}
              <div className="dash-table-link" onClick={() => openStockWithFilter("Menipis")}>Lihat semua barang yang perlu restock →</div>
            </>)
          }
        </div>
        {/* Barang Terakhir Diterima */}
        <div className="card">
          <div className="dash-table-header">
            <div className="dash-table-title">Barang Terakhir Diterima</div>
            <span className="dash-table-badge dash-table-badge-nav">{dashRecentReceives.length} Item</span>
          </div>
          {dashRecentReceives.length === 0
            ? <div className="dash-empty-state"><div className="dash-empty-icon">—</div>Belum ada penerimaan</div>
            : (<>
              <div className="dash-recv-hdr dash-row-border">
                <span>Item</span><span>Jumlah</span><span>Tanggal</span><span className="dash-col-oleh">Oleh</span>
              </div>
              {dashRecentReceives.map((r, i) => (
                <div key={r.id} className="dash-recv-row" style={{ borderBottom: i < dashRecentReceives.length - 1 ? "1px solid var(--t-border)" : "none", color: "var(--t-muted)" }}>
                  <div className="dash-item-cell">
                    <div className="dash-item-info">
                      <div className="dash-item-name">{r.itemName}</div>
                      <div className="dash-item-cat">{r.category || ""}</div>
                    </div>
                  </div>
                  <span style={{ color: "var(--t-text)", fontWeight: 600 }}>{r.qty} {r.unit || "pcs"}</span>
                  <div>
                    <div style={{ color: "var(--t-text)", fontSize: 11 }}>{r.date || ""}</div>
                    <div style={{ fontSize: 10, color: "var(--t-muted)" }}>{r.time || ""}</div>
                  </div>
                  <span className="dash-col-oleh" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.admin || r.receivedBy || "-"}</span>
                </div>
              ))}
              <div className="dash-table-link" onClick={() => navigate("/history")}>Lihat riwayat penerimaan →</div>
            </>)
          }
        </div>
      </div>

      <div className="workspace-footer"><span>TOKKI · Warehouse Management</span><span>Diperbarui {todayFmt()}</span></div>

      <TransactionModal open={showModal} onClose={() => setShowModal(false)} />
      </>)}
    </div>
  );
}


