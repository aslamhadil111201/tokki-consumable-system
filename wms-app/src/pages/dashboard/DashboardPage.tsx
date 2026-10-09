// @ts-nocheck
import { useState } from "react";
import "./DashboardPage.css";
import { BtnP } from "../../components/ui/BtnP";
import { UIIcon } from "../../components/ui/UIIcon";
import { DashboardSkeleton } from "../../components/ui/Skeleton";
import { stockStatus, stockStatusKey } from "../../utils/stockHelpers";
import { fmtMoneyShort, isoDate, todayStr } from "../../utils/formatters";
import { isApprovedOutTrx } from "../../utils/helpers";
import { useStore } from "../../store/useStore";
import { TransactionModal } from "../../components/modals/TransactionModal";
import { useNavigate } from "react-router-dom";

export function DashboardPage() {
  const { dark, items, trx, receives, dataReady } = useStore();
  const navigate = useNavigate();

  const [dashTrendPointIdx, setDashTrendPointIdx] = useState(-1);
  const [showModal, setShowModal] = useState(false);


  // Core derivations
  const approvedOutTrx = trx.filter(isApprovedOutTrx);
  const todayTrx = approvedOutTrx.filter(t => t.date === todayStr());
  const todayUnits = todayTrx.reduce((a, t) => a + (t.items || []).reduce((b: number, i: any) => b + i.qty, 0), 0);
  const lowStock = items.filter(i => Number(i.stock) <= Number(i.minStock));
  
  // Dashboard specific derivations
  const dashStockAman = items.filter(i => stockStatusKey(i) === "aman").length;
  const dashStockMendekati = items.filter(i => stockStatusKey(i) === "mendekati").length;
  const dashStockMenipis = items.filter(i => Number(i.stock) > 0 && Number(i.stock) <= Number(i.minStock)).length;
  const dashStockHabis = items.filter(i => Number(i.stock) === 0).length;
  const dashTotalStokPcs = items.reduce((a, i) => a + Number(i.stock || 0), 0);
  const dashTotalNilaiStok = items.reduce((a, it) => a + (Number(it.stock || 0) * Number(it.averageCost || it.lastPrice || 0)), 0);
  
  const dashLast7Days = Array.from({ length: 7 }).map((_, idx) => { const d = new Date(); d.setDate(d.getDate() - (6 - idx)); return isoDate(d); });
  const dashLast7OutQty = dashLast7Days.map(day => approvedOutTrx.filter(t => t.date === day).reduce((a, t) => a + (t.items || []).reduce((b: number, i: any) => b + Number(i.qty || 0), 0), 0));
  
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
      <div className="dash-toolbar">
        <BtnP onClick={() => setShowModal(true)}><UIIcon name="plus" size={15} /> Catat pengambilan</BtnP>
      </div>

      {/* Ringkasan persediaan */}
      <div className="workspace-metrics">
        {[
          { label: "Stok tersedia", value: dashTotalStokPcs.toLocaleString("id-ID"), unit: "unit", note: `${items.length} jenis barang` },
          { label: "Nilai persediaan", value: fmtMoneyShort(dashTotalNilaiStok), unit: "", note: "Estimasi harga rata-rata" },
          { label: "Pengambilan hari ini", value: todayTrx.length, unit: "transaksi", note: `${todayUnits} unit barang keluar` },
          { label: "Perlu restock", value: lowStock.length, unit: "item", note: "Stok mencapai batas minimum" },
        ].map(m => <div key={m.label} className="workspace-metric"><span>{m.label}</span><strong>{m.value} <small>{m.unit}</small></strong><p>{m.note}</p></div>)}
      </div>

      {(() => {
        const svgW = 600, svgH = 160;
        const maxQty = Math.max(...dashLast7OutQty, 1);
        const y = (value: number) => svgH - 6 - (value / maxQty) * (svgH - 18);
        const linePoints = dashLast7OutQty.map((v, i) => `${(i / 6) * svgW},${y(v)}`).join(" ");
        const areaPoints = `0,${svgH} ${linePoints} ${svgW},${svgH}`;
        const activeTrendPoint = dashTrendPointIdx >= 0 ? {
          label: dashLast7Days[dashTrendPointIdx],
          value: dashLast7OutQty[dashTrendPointIdx],
          x: (dashTrendPointIdx / 6) * 100,
        } : null;
        const weekTotal = dashLast7OutQty.reduce((sum, qty) => sum + qty, 0);
        return (
          <div className="dash-charts-g">
            {/* Pengambilan mingguan dan status stok */}
            <div className="card dash-chart-card">
              <div className="dash-chart-heading">
                <h2 className="dash-chart-title">Pengambilan 7 hari terakhir</h2>
                <span className="dash-chart-total">{weekTotal.toLocaleString("id-ID")} unit</span>
              </div>
              <div className="dash-trend-chart" onMouseLeave={() => setDashTrendPointIdx(-1)}>
                <div className="dash-trend-scale" aria-hidden="true"><span>{maxQty}</span><span>{(maxQty / 2).toLocaleString("id-ID", { maximumFractionDigits: 1 })}</span><span>0</span></div>
                <div className="dash-trend-plot">
                  <svg width="100%" height="160" viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="none" role="img" aria-label="Grafik jumlah barang keluar dalam tujuh hari terakhir">
                    {[12, svgH / 2, svgH - 6].map(value => <line key={value} x1="0" y1={value} x2={svgW} y2={value} stroke="var(--t-border)" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
                    <polygon points={areaPoints} fill="var(--t-green-bg)" opacity="0.65" />
                    <polyline points={linePoints} fill="none" stroke="var(--t-primary)" strokeWidth="1.8" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
                  </svg>
                  {dashLast7OutQty.map((value, i) => <button key={dashLast7Days[i]} type="button" className={`dash-trend-point${i === dashTrendPointIdx ? " active" : ""}`} style={{ left: `${(i / 6) * 100}%`, top: `${y(value) / svgH * 100}%` }} aria-label={`${dashLast7Days[i]}: ${value} unit keluar`} onMouseEnter={() => setDashTrendPointIdx(i)} onFocus={() => setDashTrendPointIdx(i)} onBlur={() => setDashTrendPointIdx(-1)} onClick={() => setDashTrendPointIdx(i)}><span /></button>)}
                  {activeTrendPoint && <div className="dash-trend-tooltip" style={{ left: `${Math.min(Math.max(activeTrendPoint.x, 15), 85)}%` }} role="status"><span>{activeTrendPoint.label?.slice(5).split("-").reverse().join("/")}</span><strong>{activeTrendPoint.value} unit</strong></div>}
                  <div className="dash-trend-dates" aria-hidden="true">{dashLast7Days.map(date => <span key={date}>{date.slice(5).split("-").reverse().join("/")}</span>)}</div>
                </div>
              </div>
              <button type="button" className="dash-table-link" onClick={() => navigate("/report")}>Lihat laporan lengkap →</button>
            </div>
            {/* Status stok */}
            <div className="card dash-chart-card dash-stock-status">
              <h2 className="dash-chart-title">Status stok</h2>
              {[
                { dot: "#10b981", name: "Aman", sub: "> 1,5 × stok minimum", count: dashStockAman, color: "var(--t-primary-light)", filter: "Aman" },
                { dot: "#f97316", name: "Mendekati", sub: "Di atas minimum, hingga 1,5 × minimum", count: dashStockMendekati, color: "#c2410c", filter: "Mendekati" },
                { dot: "#f59e0b", name: "Menipis", sub: "≤ Min Stok", count: dashStockMenipis, color: "#f59e0b", filter: "Menipis" },
                { dot: "#ef4444", name: "Habis", sub: "Stok = 0", count: dashStockHabis, color: "#ef4444", filter: "Habis" },
              ].map((row, i) => (
                <button type="button" key={row.name} className="dash-status-row" onClick={() => openStockWithFilter(row.filter)} style={{ borderBottom: i < 3 ? "1px solid var(--t-border)" : "none" }}>
                  <span className="dash-status-info">
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: row.dot, flexShrink: 0 }} />
                    <span>
                      <span style={{ display: "block", fontSize: 13, color: "var(--t-text)", fontWeight: 600 }}>{row.name}</span>
                      <span style={{ display: "block", fontSize: 11, color: "var(--t-muted)" }}>{row.sub}</span>
                    </span>
                  </span>
                  <span className="dash-status-val">
                    <span style={{ fontSize: 14, fontWeight: 700, color: row.color }}>{row.count} Item</span>
                    <span aria-hidden="true">›</span>
                  </span>
                </button>
              ))}
              <button type="button" className="dash-table-link" onClick={() => openStockWithFilter("Semua")}>Lihat semua item →</button>
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
              <button type="button" className="dash-table-link" onClick={() => openStockWithFilter("Perlu restock")}>Lihat semua barang yang perlu restock →</button>
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
              <button type="button" className="dash-table-link" onClick={() => navigate("/history")}>Lihat riwayat penerimaan →</button>
            </>)
          }
        </div>
      </div>


      <TransactionModal open={showModal} onClose={() => setShowModal(false)} />
      </>)}
    </div>
  );
}


