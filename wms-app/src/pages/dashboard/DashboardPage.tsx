// @ts-nocheck
import { useState } from "react";
import "./DashboardPage.css";
import { gText } from "../../theme/tokens";
import { Badge } from "../../components/ui/Badge";
import { BtnP } from "../../components/ui/BtnP";
import { BtnG } from "../../components/ui/BtnG";
import { Prog } from "../../components/ui/Prog";
import { stockStatus } from "../../utils/stockHelpers";
import { fmtMoney, fmtDate, todayFmt, isoDate, todayStr } from "../../utils/formatters";
import { trxApprovalStatus, isApprovedOutTrx } from "../../utils/helpers";
import { useStore } from "../../store/useStore";
import { TransactionModal } from "../../components/modals/TransactionModal";
import { useNavigate } from "react-router-dom";

export function DashboardPage() {
  const { dark, items, trx, receives, user, apiFetch, setToast } = useStore();
  const navigate = useNavigate();

  const [dashDonutSegIdx, setDashDonutSegIdx] = useState(-1);
  const [dashTrendPointIdx, setDashTrendPointIdx] = useState(-1);
  const [showModal, setShowModal] = useState(false);
  
  // Settings state (if needed for auto reject)
  const [autoRejectInput, setAutoRejectInput] = useState("24");
  const [autoRejectSaving, setAutoRejectSaving] = useState(false);

  const isAdmin = (user?.role || "").toLowerCase() === "admin";
  const autoRejectHours = 24; // Mocked, ideally from store if needed

  // Core derivations
  const approvedOutTrx = trx.filter(isApprovedOutTrx);
  const pendingApprovalTrx = trx.filter(t => trxApprovalStatus(t) === "pending");
  const todayTrx = approvedOutTrx.filter(t => t.date === todayStr());
  const todayUnits = todayTrx.reduce((a, t) => a + (t.items || []).reduce((b: number, i: any) => b + i.qty, 0), 0);
  const lowStock = items.filter(i => i.stock <= i.minStock);
  const pendingApprovalCount = pendingApprovalTrx.length;
  
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

  const saveAutoRejectSetting = async () => {
    const h = parseInt(autoRejectInput, 10);
    if (!Number.isFinite(h) || h < 1 || h > 720) { setToast("Masukkan jam antara 1–720", "err"); return; }
    setAutoRejectSaving(true);
    try {
      const r = await apiFetch("/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ autoRejectHours: h }) });
      if (!r.ok) { const e = await r.json().catch(() => ({})); setToast(e?.error || "Gagal simpan setting", "err"); return; }
      setToast(`Auto-reject diset ke ${h} jam`, "ok");
    } catch (e: any) { setToast(e?.message || "Gagal simpan setting", "err"); }
    finally { setAutoRejectSaving(false); }
  };

  const openStockWithFilter = (filter: string) => {
    navigate("/stock");
  };

  return (
    <div>
      <div className="dash-hero">
        <div className="dash-hero-content">
          <div className="dash-hero-copy">
            <div className="dash-hero-badge">🏭 Sistem Gudang Aktif</div>
            <div className="dash-hero-title">Ringkasan Hari Ini</div>
            <div className="dash-hero-stats">
              <span>📅 {todayFmt()}</span>
              <span className="dash-hero-dot">•</span>
              <span><b className="dash-hero-highlight">{todayTrx.length}</b> transaksi</span>
              <span className="dash-hero-dot">•</span>
              <span><b className="dash-hero-highlight">{todayUnits}</b> unit keluar</span>
            </div>
          </div>
          <BtnP onClick={() => setShowModal(true)} className="dash-hero-btn">＋ Catat Pengambilan</BtnP>
          <div className="dash-hero-illus" aria-hidden="true">
            <div className="dash-box b1" />
            <div className="dash-box b2" />
            <div className="dash-box b3" />
            <div className="dash-box b4" />
          </div>
        </div>
      </div>

      {/* Charts 3-col */}
      {(() => {
        const R = 42, C2 = 2 * Math.PI * R;
        const dTotal = dashStockAman + dashStockMenipis + dashStockHabis || 1;
        const donutSegs = [
          { label: "Aman", count: dashStockAman, color: "#10b981", sub: "> Min Stok" },
          { label: "Menipis", count: dashStockMenipis, color: "#f59e0b", sub: "≤ Min Stok" },
          { label: "Habis", count: dashStockHabis, color: "#ef4444", sub: "Stok = 0" },
        ];
        let cumLen = 0;
        const renderedSegs = donutSegs.map(s => {
          const len = (s.count / dTotal) * C2;
          const da = `${len} ${C2 - len}`;
          const doff = -cumLen;
          cumLen += len;
          return { ...s, color: s.color, da, doff };
        });
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
        const activeDonutSeg = dashDonutSegIdx >= 0 ? renderedSegs[dashDonutSegIdx] : null;
        return (
          <div className="dash-charts-g">
            {/* Donut ringkasan stok */}
            <div className="card dash-chart-card" onMouseLeave={() => setDashDonutSegIdx(-1)}>
              <div className="dash-chart-title">Ringkasan Stok</div>
              <div className="dash-donut-wrap">
                <div className="dash-donut-svg">
                  <svg width="150" height="150" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r={R} fill="none" stroke="var(--t-border)" strokeWidth="13" />
                    {renderedSegs.map((s, i) => {
                      const isActive = i === dashDonutSegIdx;
                      return (
                        <g key={i}>
                          <circle cx="50" cy="50" r={R} fill="none" stroke={s.color} strokeWidth={isActive ? 15 : 13} strokeDasharray={s.da} strokeDashoffset={s.doff} transform="rotate(-90 50 50)" style={{ transition: "stroke-width .18s ease, opacity .18s ease", opacity: dashDonutSegIdx === -1 || isActive ? 1 : 0.45 }} />
                          <circle
                            cx="50"
                            cy="50"
                            r={R}
                            fill="none"
                            stroke="transparent"
                            strokeWidth="24"
                            strokeDasharray={s.da}
                            strokeDashoffset={s.doff}
                            transform="rotate(-90 50 50)"
                            onMouseEnter={() => setDashDonutSegIdx(i)}
                            onClick={() => setDashDonutSegIdx(i)}
                            style={{ cursor: "pointer" }}
                          />
                        </g>
                      );
                    })}
                  </svg>
                  <div className="dash-donut-center">
                    {activeDonutSeg ? (
                      <div style={{ fontSize: 9.5, color: activeDonutSeg.color, lineHeight: 1.1, fontWeight: 800, letterSpacing: 0.1, marginBottom: 3 }}>{activeDonutSeg.label}</div>
                    ) : (
                      <div style={{ fontSize: 9.2, color: "var(--t-muted)", lineHeight: 1.12, fontWeight: 800, letterSpacing: 0.1, marginBottom: 3 }}>
                        <div>Total Stok</div>
                        <div>Saat Ini</div>
                      </div>
                    )}
                    <div style={{ fontSize: 18.5, fontWeight: 800, color: "var(--t-text)", lineHeight: 1 }}>{activeDonutSeg ? activeDonutSeg.count.toLocaleString("id-ID") : dashTotalStokPcs.toLocaleString("id-ID")}</div>
                    <div style={{ fontSize: 10, color: "var(--t-muted)", lineHeight: 1.15, marginTop: 2 }}>{activeDonutSeg ? "item" : "pcs"}</div>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  {renderedSegs.map((l, i) => (
                    <div key={i} className="dash-donut-legend" onMouseEnter={() => setDashDonutSegIdx(i)} onClick={() => setDashDonutSegIdx(i)} style={{ opacity: dashDonutSegIdx === -1 || dashDonutSegIdx === i ? 1 : 0.65 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: l.color, flexShrink: 0, boxShadow: dashDonutSegIdx === i ? `0 0 0 4px ${l.color}22` : "none" }} />
                      <div style={{ flex: 1 }}>{l.label}</div>
                      <div style={{ fontWeight: 700, color: "var(--t-text)" }}>{l.count}<span style={{ fontSize: 10, fontWeight: 400, color: "var(--t-muted)", marginLeft: 3 }}>item</span></div>
                    </div>
                  ))}
                  <div style={{ fontSize: 10.5, color: "var(--t-muted)", marginTop: 2, minHeight: 16 }}>{activeDonutSeg ? activeDonutSeg.sub : "Tap warna chart untuk detail"}</div>
                </div>
              </div>
              <div className="dash-table-link" onClick={() => navigate("/report")}>Lihat laporan lengkap →</div>
            </div>
            {/* Line chart 7 hari */}
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

      {isAdmin && (() => {
        const apTotal = trx.length;
        const apPending = pendingApprovalTrx.length;
        const apApproved = trx.filter(t => trxApprovalStatus(t) === "approved").length;
        const apRejected = trx.filter(t => trxApprovalStatus(t) === "rejected").length;
        return (
          <div style={{ marginBottom: 20 }}>
            <div className="approval-ov-header">
              <div className="approval-ov-title">📊 Approval Overview</div>
              <button className="tb-btn approval-ov-btn" onClick={() => navigate("/history")}>Lihat approval →</button>
            </div>
            <div className="approval-ov-g">
              {[
                { label: "Total Pengajuan", val: String(apTotal), sub: "semua transaksi", dot: "var(--t-primary)", icon: "\uD83D\uDCCB" },
                { label: "Pending", val: String(apPending), sub: "menunggu approval", dot: apPending > 0 ? "#f59e0b" : "var(--t-muted)", icon: "\u231B" },
                { label: "Disetujui", val: String(apApproved), sub: "approved", dot: "#10b981", icon: "\u2705" },
                { label: "Ditolak", val: String(apRejected), sub: "rejected", dot: apRejected > 0 ? "var(--t-red)" : "var(--t-muted)", icon: "\u274C" },
              ].map((s, i) => (
                <div key={i} className="stat-card approval-ov-card">
                  <div className="approval-ov-card-inner">
                    <div className="approval-ov-info">
                      <div className="approval-ov-info-hdr">
                        <div className="dash-stat-icon">{s.icon}</div>
                        <div className="approval-ov-info-lbl">{s.label}</div>
                      </div>
                      <div className="approval-ov-info-val">{s.val}</div>
                      <div className="approval-ov-info-sub">{s.sub}</div>
                    </div>
                    <div className="approval-ov-dot" style={{ background: s.dot, boxShadow: `0 0 8px ${s.dot}` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {isAdmin && (
        <div className="auto-reject-panel">
          <div className="auto-reject-title">⚙️ Auto-reject pending</div>
          <div className="auto-reject-controls">
            <input
              type="number" min={1} max={720} value={autoRejectInput}
              onChange={e => setAutoRejectInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") saveAutoRejectSetting(); }}
              className="auto-reject-input"
            />
            <span className="auto-reject-lbl">jam sejak dibuat</span>
            <button
              className="tb-btn auto-reject-btn" disabled={autoRejectSaving}
              onClick={saveAutoRejectSetting}
              style={{ opacity: autoRejectSaving ? 0.6 : 1 }}
            >{autoRejectSaving ? "Menyimpan..." : "Simpan"}</button>
          </div>
          <div className="auto-reject-status">Sekarang: <b style={{ color: "var(--t-primary)" }}>{autoRejectHours} jam</b></div>
        </div>
      )}

      {/* Tables 2-col */}
      <div className="dash-tables-g">
        {/* Barang Hampir Habis */}
        <div className="card">
          <div className="dash-table-header">
            <div className="dash-table-title">Barang yang Perlu Restock</div>
            <span className="dash-table-badge dash-table-badge-amber">{lowStock.length} Item</span>
          </div>
          {lowStock.length === 0
            ? <div className="dash-empty-state"><div className="dash-empty-icon">✅</div>Semua stok aman</div>
            : (<>
              <div className="dash-low-hdr dash-row-border">
                <span>Item</span><span>Stok</span><span>Min Stok</span><span className="dash-col-satuan">Satuan</span>
              </div>
              {lowStock.slice(0, 4).map(it => {
                const s = stockStatus(it, dark); return (
                  <div key={it.id} className="dash-low-row dash-row-border">
                    <div className="dash-item-cell">
                      <div className="dash-item-icon">📦</div>
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
            ? <div className="dash-empty-state"><div className="dash-empty-icon">📭</div>Belum ada penerimaan</div>
            : (<>
              <div className="dash-recv-hdr dash-row-border">
                <span>Item</span><span>Jumlah</span><span>Tanggal</span><span className="dash-col-oleh">Oleh</span>
              </div>
              {dashRecentReceives.map((r, i) => (
                <div key={r.id} className="dash-recv-row" style={{ borderBottom: i < dashRecentReceives.length - 1 ? "1px solid var(--t-border)" : "none", color: "var(--t-muted)" }}>
                  <div className="dash-item-cell">
                    <div className="dash-item-icon">📥</div>
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

      {/* Footer bar */}
      <div className="dash-footer-g">
        {[
          { icon: "📅", label: "Update Terakhir", val: todayFmt() },
          { icon: "🔄", label: "Total Transaksi Hari Ini", val: `${todayTrx.length} Transaksi` },
          { icon: "💰", label: "Total Nilai Stok (Est.)", val: fmtMoney(dashTotalNilaiStok) },
        ].map((f, i) => (
          <div key={i} className="stat-card dash-footer-card">
            <div className="dash-footer-icon">{f.icon}</div>
            <div>
              <div className="dash-footer-lbl">{f.label}</div>
              <div className="dash-footer-val">{f.val}</div>
            </div>
          </div>
        ))}
      </div>

      <TransactionModal open={showModal} onClose={() => setShowModal(false)} />
    </div>
  );
}
