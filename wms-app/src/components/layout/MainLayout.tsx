// @ts-nocheck
import { useState, useRef, useEffect } from "react";
import { Outlet, useLocation, useNavigate, Link } from "react-router-dom";
import { useStore } from "../../store/useStore";
import { getT, gText } from "../../theme/tokens";
import { TABS } from "../../constants/index";
import { todayStr, todayFmt } from "../../utils/formatters";
import { triggerDownload, trxApprovalStatus, isApprovedOutTrx } from "../../utils/helpers";
import { stockStatus, stockStatusIcon } from "../../utils/stockHelpers";
import { GlobalStyle } from "./GlobalStyle";
import { ToastNotification } from "../ui/ToastNotification";
import { UIIcon } from "../ui/UIIcon";

export const MainLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loggedIn, logout, dark, items, trx, withLoading, setToast, fetchAll, fetchItems, fetchTransactions, fetchReturns, fetchReceives, fetchDeliveryNotes } = useStore();
  const T = getT(dark);

  const [sidebar, setSidebar] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notif, setNotif] = useState(false);
  const [notifTab, setNotifTab] = useState("notif");
  const [notifHistory, setNotifHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem("wms_notif_history") || "[]"); } catch { return []; }
  });

  const notifRef = useRef(null);
  const lastFetchedRef = useRef(Date.now());

  const isAdmin = (user?.role || "").toLowerCase() === "admin";
  const isOperator = (user?.role || "").toLowerCase() === "operator";
  const isGuest = (user?.role || "").toLowerCase() === "guest";

  useEffect(() => {
    if (!loggedIn) navigate("/login");
    else if (isGuest && location.pathname !== "/delivery") navigate("/delivery");
  }, [loggedIn, navigate, isGuest, location.pathname]);

  useEffect(() => {
    if (loggedIn) {
      fetchAll().then(() => {
        lastFetchedRef.current = Date.now();
      });
    }
  }, [loggedIn]);



  // Throttled refresh on window focus / visibility change (max once every 5 minutes)
  useEffect(() => {
    if (!loggedIn) return;
    const handleFocus = () => {
      if (document.visibilityState === "visible" && Date.now() - lastFetchedRef.current > 300000) { // 5 minutes
        fetchAll().then(() => {
          lastFetchedRef.current = Date.now();
        });
      }
    };
    document.addEventListener("visibilitychange", handleFocus);
    window.addEventListener("focus", handleFocus);
    return () => {
      document.removeEventListener("visibilitychange", handleFocus);
      window.removeEventListener("focus", handleFocus);
    };
  }, [loggedIn, fetchAll]);

  // Slow background poll data every 15 minutes (900,000ms) as fallback to save egress
  useEffect(() => {
    if (!loggedIn) return;
    const iv = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchAll().then(() => {
          lastFetchedRef.current = Date.now();
        });
      }
    }, 900000); // 15 minutes
    return () => clearInterval(iv);
  }, [loggedIn, fetchAll]);

  // Supabase Realtime subscription to receive database changes instantly
  useEffect(() => {
    if (!loggedIn) return;
    let channel: any;

    const setupRealtime = async () => {
      try {
        const { supabase } = await import('../../lib/supabase');
        const channelName = `wms-db-changes-${Math.random().toString(36).substring(2, 9)}`;
        
        const timers: Record<string, any> = {};
        const debounce = (key: string, fn: () => void) => {
          clearTimeout(timers[key]);
          timers[key] = setTimeout(() => { fn(); }, 300);
        };

        channel = supabase.channel(channelName)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, () => {
            debounce('items', fetchItems);
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
            debounce('trx', fetchTransactions);
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'returns' }, () => {
            debounce('returns', fetchReturns);
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'receives' }, () => {
            debounce('receives', fetchReceives);
          })
          .subscribe();
      } catch (err) {
        console.error("Realtime subscription setup failed:", err);
      }
    };

    setupRealtime();

    return () => {
      if (channel) {
        import('../../lib/supabase').then(({ supabase }) => {
          supabase.removeChannel(channel);
        });
      }
    };
  }, [loggedIn, fetchAll]);

  useEffect(() => {
    const h = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setNotif(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  if (!loggedIn) return null;

  // Guest: NO ACCESS to WMS directly anymore (since delivery is moved)
  const visibleTabs = (isAdmin || isOperator)
      ? TABS
      : TABS.filter(t => t.id !== "history");

  const lowStock = items.filter(i => i.stock <= i.minStock);
  const approvedOutTrx = trx.filter(isApprovedOutTrx);
  const todayTrx = approvedOutTrx.filter(t => t.date === todayStr());
  const currentTab = location.pathname.substring(1) || "dashboard";



  return (
    <>
      <GlobalStyle />
      <ToastNotification />
      <div className="shell">
        {sidebar && <div className="backdrop-mob" onClick={() => setSidebar(false)} />}

        {/* SIDEBAR */}
        <aside className={`sidebar${sidebar ? " open" : ""}${sidebarCollapsed ? " collapsed" : ""}`}>
          <div className="sb-inner">
            <Link to="/dashboard" className="brand workspace-brand" onClick={() => setSidebar(false)}>
              <img className="workspace-logo" src="/tokki-logo dark mode.png" alt="Tokki Engineering and Fabrication" />
            </Link>
            <div className="nav-label">OPERASIONAL</div>
            <div className="sb-nav-scroll">
              {visibleTabs.map(t => (
                <Link key={t.id} to={`/${t.id}`} className={`nav-item${currentTab === t.id ? " active" : ""}`} onClick={() => setSidebar(false)} style={{ textDecoration: "none" }}>
                  <span className="nav-icon">{t.icon}</span>
                  <span className="nav-text">{t.label}</span>
                  {t.id === "transaction" && todayTrx.length > 0 && <span className="nav-pill">{todayTrx.length}</span>}
                </Link>
              ))}
              <button className="nav-item mobile-logout" onClick={() => logout()}>
                <span className="nav-icon">{"\u238B"}</span>
                <span className="nav-text">Keluar Akun</span>
              </button>
            </div>
            <div className="sb-footer">
              <div className="sb-user-row" style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 6px" }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: T.primary, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "white", flexShrink: 0 }}>
                  {(user?.username || "A")[0].toUpperCase()}
                </div>
                <div className="sb-user-meta" style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text }}>{user?.username || "Admin"}</div>
                  <div style={{ fontSize: 10, color: T.green, fontWeight: 700 }}>{"\u25CF"} Online {"\u00B7"} {(user?.role || "operator").toLowerCase()}</div>
                </div>
              </div>
              <button className="sb-logout-btn" onClick={() => logout()} title="Keluar"
                style={{ marginTop: 8, width: "100%", padding: "9px", background: "transparent", border: `1px solid ${T.border}`, borderRadius: 10, fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 12, fontWeight: 700, color: T.muted, cursor: "pointer", transition: "all .2s" }}
                onMouseEnter={e => { e.currentTarget.style.background = T.redBg; e.currentTarget.style.borderColor = T.redBorder; e.currentTarget.style.color = T.redText; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.muted; }}>
                <span className="sb-logout-text">Keluar {"\u2192"}</span>
                <span aria-hidden="true" style={{ display: sidebarCollapsed ? "inline" : "none" }}>{"\u238B"}</span>
              </button>
            </div>
          </div>
        </aside>

        {/* MAIN */}
        <div className="main">
          {/* TOPBAR */}
          <header className="topbar">
            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
              <button className="tb-btn" aria-label="Buka atau tutup navigasi" style={{ padding: "7px 10px", flexShrink: 0 }}
                onClick={() => { if (window.innerWidth <= 660) { setSidebar(v => !v); } else { setSidebarCollapsed(v => !v); } }}>
                <svg width="15" height="12" viewBox="0 0 15 12" fill="none">
                  <rect width="15" height="1.5" rx="1" fill="currentColor" />
                  <rect y="5.25" width="15" height="1.5" rx="1" fill="currentColor" />
                  <rect y="10.5" width="15" height="1.5" rx="1" fill="currentColor" />
                </svg>
              </button>
              <span className="workspace-breadcrumb">Warehouse /</span><div className="page-title">{TABS.find(t => t.id === currentTab)?.label || "Dashboard"}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>

              {/* NOTIF */}
              <div className="notif-wrap" ref={notifRef}>
                {(() => {
                  const unread = notifHistory.filter(n => !n.read).length;
                  const totalBadge = unread + lowStock.length;
                  return (
                    <button className="tb-btn" aria-label="Notifikasi" aria-expanded={notif} onClick={() => setNotif(!notif)} style={{ position: "relative", padding: "7px 12px" }}>
                      <UIIcon name="bell" size={17} />
                      {totalBadge > 0 && (
                        <span style={{ position: "absolute", top: -3, right: -3, background: unread > 0 ? "#f59e0b" : T.red, color: "white", fontSize: 9, fontWeight: 700, borderRadius: "50%", width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
                          {totalBadge}
                        </span>
                      )}
                    </button>
                  );
                })()}

                {notif && (
                  <div className="notif-drop" style={{ width: 320 }}>
                    <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}`, background: T.surface, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Notifikasi</div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {notifTab === "notif" && notifHistory.filter(n => !n.read).length > 0 && (
                          <button onClick={() => { const marked = notifHistory.map(n => ({ ...n, read: true })); setNotifHistory(marked); localStorage.setItem("wms_notif_history", JSON.stringify(marked)); }}
                            style={{ fontSize: 10, fontWeight: 700, background: "transparent", border: `1px solid ${T.border}`, borderRadius: 6, padding: "2px 8px", color: T.muted, cursor: "pointer" }}>
                            Baca semua
                          </button>
                        )}
                        {notifTab === "notif" && notifHistory.length > 0 && (
                          <button onClick={() => { setNotifHistory([]); localStorage.removeItem("wms_notif_history"); }}
                            style={{ fontSize: 10, fontWeight: 700, background: "transparent", border: `1px solid ${T.border}`, borderRadius: 6, padding: "2px 8px", color: T.red, cursor: "pointer" }}>
                            Hapus
                          </button>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", borderBottom: `1px solid ${T.border}` }}>
                      {[{ id: "notif", label: "Aktivitas", badge: notifHistory.filter(n => !n.read).length }, { id: "stok", label: "Alert Stok", badge: lowStock.length }].map(tb => (
                        <button key={tb.id} onClick={() => setNotifTab(tb.id)}
                          style={{ flex: 1, padding: "9px 0", fontSize: 11.5, fontWeight: 700, background: "transparent", border: "none", cursor: "pointer", color: notifTab === tb.id ? T.primary : T.muted, borderBottom: notifTab === tb.id ? `2px solid ${T.primary}` : "2px solid transparent", transition: "all .15s", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                          {tb.label}
                          {tb.badge > 0 && <span style={{ background: tb.id === "notif" ? "#f59e0b" : T.red, color: "white", fontSize: 9, fontWeight: 700, borderRadius: 999, padding: "1px 5px", minWidth: 14, textAlign: "center" }}>{tb.badge}</span>}
                        </button>
                      ))}
                    </div>
                    {notifTab === "notif" && (
                      <div style={{ maxHeight: 280, overflowY: "auto" }}>
                        {notifHistory.length === 0
                          ? <div style={{ padding: "24px 16px", textAlign: "center", color: T.muted, fontSize: 12 }}><div style={{ fontSize: 28, marginBottom: 8 }}>{"\uD83D\uDD15"}</div>Belum ada notifikasi</div>
                          : notifHistory.map(n => {
                            const fmtTs = (iso) => { try { const d = new Date(iso); return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }) + " " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };
                            return (
                              <div key={n.id}
                                onClick={() => { setNotifHistory(prev => { const next = prev.map(x => x.id === n.id ? { ...x, read: true } : x); localStorage.setItem("wms_notif_history", JSON.stringify(next)); return next; }); }}
                                style={{ padding: "10px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", background: n.read ? "transparent" : dark ? "rgba(245,158,11,.07)" : "rgba(245,158,11,.06)", transition: "background .15s" }}>
                                <div style={{ width: 8, height: 8, borderRadius: "50%", background: n.read ? T.border : n.type === "err" ? T.red : "#f59e0b", marginTop: 5, flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 12, fontWeight: n.read ? 500 : 700, color: T.text, lineHeight: 1.4 }}>{n.msg}</div>
                                  <div style={{ fontSize: 10.5, color: T.muted, marginTop: 3 }}>{fmtTs(n.ts)}</div>
                                </div>
                              </div>
                            );
                          })
                        }
                      </div>
                    )}
                    {notifTab === "stok" && (
                      <div style={{ maxHeight: 280, overflowY: "auto", padding: "8px" }}>
                        {lowStock.length === 0
                          ? <div style={{ padding: "24px 16px", textAlign: "center", color: T.muted, fontSize: 12 }}><div style={{ fontSize: 28, marginBottom: 8 }}>{"\u2705"}</div>Semua stok aman</div>
                          : lowStock.map(it => {
                            const s = stockStatus(it, dark);
                            const pct = it.minStock ? Math.min(it.stock / it.minStock * 100, 100) : 0;
                            return (
                              <div key={it.id} style={{ marginBottom: 8, borderRadius: 10, border: `1px solid ${s.border || T.border}`, background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)", overflow: "hidden" }}>
                                <div style={{ height: 3, background: s.dot, borderRadius: "10px 10px 0 0" }} />
                                <div style={{ padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
                                  <div style={{ width: 32, height: 32, borderRadius: 8, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                    {stockStatusIcon(s.key, 14)}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 2 }}>{it.name || "—"}</div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                      <div style={{ flex: 1, height: 4, borderRadius: 99, background: dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)" }}>
                                        <div style={{ height: "100%", borderRadius: 99, background: s.dot, width: `${pct}%`, transition: "width .3s" }} />
                                      </div>
                                      <span style={{ fontSize: 10, color: T.muted, whiteSpace: "nowrap", flexShrink: 0 }}>{it.stock}/{it.minStock} {it.unit}</span>
                                    </div>
                                  </div>
                                  <div style={{ flexShrink: 0, padding: "3px 9px", borderRadius: 99, background: s.bg, color: s.text, fontSize: 10, fontWeight: 700, border: `1px solid ${s.border || "transparent"}` }}>{s.label}</div>
                                </div>
                              </div>
                            );
                          })
                        }
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="tb-btn date-btn" style={{ cursor: "default", userSelect: "none", fontSize: 11 }}>
                <UIIcon name="calendar" size={15} /> {todayFmt()}
              </div>
              <button className="tb-btn tb-logout" onClick={() => logout()} title="Keluar akun" style={{ padding: "7px 10px" }}>
                {"\u238B"} Keluar
              </button>
            </div>
          </header>

          {/* PAGE CONTENT */}
          <main className="body-area enter">
            <div className="workspace-page-heading"><h1>{currentTab === "dashboard" ? "Kontrol persediaan" : TABS.find(t => t.id === currentTab)?.label || "Warehouse"}</h1><p>{({ dashboard: "Pantau stok dan pergerakan barang gudang hari ini.", stock: "Inventaris material dan consumable gudang.", transaction: "Catat pengambilan dan retur barang untuk pekerjaan.", history: "Telusuri setiap pergerakan barang gudang.", report: "Ringkasan penggunaan dan nilai persediaan." })[currentTab]}</p></div><Outlet />
          </main>
        </div>
      </div>
    </>
  );
};


