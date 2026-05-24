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

const Blobs = () => {
  const dark = useStore(s => s.dark);
  const T = getT(dark);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: "-15%", left: "-10%", width: 420, height: 420, borderRadius: "50%", background: "rgba(16,185,129,0.2)", filter: "blur(100px)", opacity: dark ? 0.5 : 0.3, transition: "opacity .4s" }} />
      <div style={{ position: "absolute", bottom: "-15%", right: "-10%", width: 340, height: 340, borderRadius: "50%", background: "rgba(5,150,105,0.15)", filter: "blur(90px)", opacity: dark ? 0.5 : 0.25, transition: "opacity .4s" }} />
      <div style={{ position: "absolute", top: "45%", right: "15%", width: 220, height: 220, borderRadius: "50%", background: "rgba(20,184,166,0.1)", filter: "blur(70px)", opacity: dark ? 0.4 : 0.2, transition: "opacity .4s" }} />
    </div>
  );
};

const Toggle = ({ mini = false }) => {
  const { dark, toggleTheme } = useStore();
  return (
    <button type="button" className={`toggle-wrap${mini ? " mini" : ""}`} onClick={toggleTheme} style={mini ? { padding: "6px 11px" } : {}} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}>
      <span className="toggle-lbl">{dark ? "\uD83C\uDF19" : "\u2600\uFE0F"}{!mini && (dark ? " Dark" : " Light")}</span>
      <div className="toggle-track"><div className="toggle-thumb" /></div>
    </button>
  );
};

export const MainLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loggedIn, logout, dark, items, trx, apiFetch, withLoading, setToast, fetchAll } = useStore();
  const T = getT(dark);

  const [sidebar, setSidebar] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notif, setNotif] = useState(false);
  const [notifTab, setNotifTab] = useState("notif");
  const [notifHistory, setNotifHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem("wms_notif_history") || "[]"); } catch { return []; }
  });

  const notifRef = useRef(null);
  const restoreInputRef = useRef(null);

  useEffect(() => {
    if (!loggedIn) navigate("/login");
  }, [loggedIn, navigate]);

  useEffect(() => {
    if (loggedIn) fetchAll();
  }, [loggedIn]);

  // Detect new pending transactions and push notification
  const prevPendingRef = useRef(0);
  useEffect(() => {
    if (!loggedIn) return;
    const currentPending = trx.filter(t => trxApprovalStatus(t) === "pending").length;
    if (prevPendingRef.current > 0 && currentPending > prevPendingRef.current) {
      const diff = currentPending - prevPendingRef.current;
      const msg = `\uD83D\uDD14 ${diff} permintaan baru menunggu approval`;
      setNotifHistory(prev => {
        const next = [{ id: Date.now(), msg, type: "ok", ts: new Date().toISOString(), read: false }, ...prev].slice(0, 50);
        localStorage.setItem("wms_notif_history", JSON.stringify(next));
        return next;
      });
    }
    prevPendingRef.current = currentPending;
  }, [trx, loggedIn]);

  // Poll data every 30s
  useEffect(() => {
    if (!loggedIn) return;
    const iv = setInterval(() => { if (document.visibilityState === "visible") fetchAll(); }, 30000);
    return () => clearInterval(iv);
  }, [loggedIn]);

  useEffect(() => {
    const h = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setNotif(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  if (!loggedIn) return null;

  const isAdmin = (user?.role || "").toLowerCase() === "admin";
  const isOperator = (user?.role || "").toLowerCase() === "operator";
  const visibleTabs = (isAdmin || isOperator) ? TABS : TABS.filter(t => t.id !== "history");

  const lowStock = items.filter(i => i.stock <= i.minStock);
  const approvedOutTrx = trx.filter(isApprovedOutTrx);
  const todayTrx = approvedOutTrx.filter(t => t.date === todayStr());
  const pendingApprovalCount = trx.filter(t => trxApprovalStatus(t) === "pending").length;
  const currentTab = location.pathname.substring(1) || "dashboard";

  // Tabel yang di-backup/restore (urutan penting: master data dulu, lalu transaksional)
  const BACKUP_TABLES = [
    "users", "admins", "departments", "employees", "workOrders",
    "items", "transactions", "receives", "returns",
    "delivery_notes", "shipping_addresses", "audit_logs",
  ] as const;

  const downloadBackupData = async () => {
    if (!isAdmin) { setToast("Hanya admin yang boleh backup data", "err"); return; }
    await withLoading(async () => {
      try {
        const { supabase } = await import("../../lib/supabase");
        const collections: Record<string, unknown[]> = {};

        for (const table of BACKUP_TABLES) {
          const { data, error } = await supabase.from(table).select("*");
          if (error) throw new Error(`Gagal backup tabel ${table}: ${error.message}`);
          collections[table] = data || [];
        }

        const backup = {
          format: "tokki-wms-backup-v2-supabase",
          generatedAt: new Date().toISOString(),
          collections,
        };

        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        triggerDownload(
          `wms-backup-${stamp}.json`,
          JSON.stringify(backup, null, 2),
          "application/json;charset=utf-8;"
        );

        // Audit log
        await supabase.from("audit_logs").insert([{
          action: "admin.backupExport",
          actor: { username: user?.username, role: user?.role },
          target: "system",
        }]);

        setToast("Backup data berhasil diunduh ✓");
      } catch (e: any) { setToast(e?.message || "Gagal backup data", "err"); }
    }, "Sedang menyiapkan file backup...");
  };

  const restoreBackupData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) { setToast("Hanya admin yang boleh restore data", "err"); return; }
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    let parsed: any;
    try {
      const txt = await file.text();
      parsed = JSON.parse(txt);
    } catch {
      setToast("File backup tidak valid (JSON rusak)", "err");
      return;
    }

    // Support format lama (MongoDB) dan baru (Supabase)
    const collections = parsed?.collections ?? parsed;
    if (!collections || typeof collections !== "object") {
      setToast("Format file backup tidak dikenali", "err");
      return;
    }

    if (!window.confirm("Restore backup akan MENIMPA semua data saat ini. Lanjutkan?")) return;

    await withLoading(async () => {
      try {
        const { supabase } = await import("../../lib/supabase");

        // Hapus data lama lalu insert baru, per tabel
        for (const table of BACKUP_TABLES) {
          const rows: unknown[] = Array.isArray(collections[table]) ? collections[table] : [];
          // Hapus semua baris (filter id > 0 agar tidak error jika tabel kosong)
          await supabase.from(table).delete().gte("id", 0);
          if (rows.length > 0) {
            // Insert dalam batch 500 untuk menghindari payload terlalu besar
            const BATCH = 500;
            for (let i = 0; i < rows.length; i += BATCH) {
              const { error } = await supabase.from(table).insert(rows.slice(i, i + BATCH));
              if (error) throw new Error(`Gagal restore tabel ${table}: ${error.message}`);
            }
          }
        }

        // Audit log
        await supabase.from("audit_logs").insert([{
          action: "admin.restoreBackup",
          actor: { username: user?.username, role: user?.role },
          target: "system",
        }]);

        setToast("Restore backup berhasil ✓");
        await fetchAll();
      } catch (e: any) { setToast(e?.message || "Gagal restore backup", "err"); }
    }, "Sedang memulihkan data backup...");
  };

  const resetDummyData = async () => {
    if (!isAdmin) { setToast("Hanya admin yang boleh reset data dummy", "err"); return; }
    if (!window.confirm("Reset data dummy akan menghapus semua transaksi & mengembalikan data awal. Lanjutkan?")) return;

    await withLoading(async () => {
      try {
        const { supabase } = await import("../../lib/supabase");

        // Tabel transaksional yang di-reset (master data dipertahankan)
        const RESET_TABLES = [
          "transactions", "receives", "returns",
          "delivery_notes", "audit_logs",
        ] as const;

        for (const table of RESET_TABLES) {
          await supabase.from(table).delete().gte("id", 0);
        }

        // Reset stok semua item ke 0
        await supabase.from("items").update({ stock: 0, averageCost: 0, lastPrice: 0, totalValue: 0 }).gte("id", 0);

        // Audit log
        await supabase.from("audit_logs").insert([{
          action: "admin.resetDummy",
          actor: { username: user?.username, role: user?.role },
          target: "system",
        }]);

        setToast("Reset data dummy berhasil ✓");
        await fetchAll();
      } catch (e: any) { setToast(e?.message || "Gagal reset data dummy", "err"); }
    }, "Sedang mereset data...");
  };

  return (
    <>
      <GlobalStyle />
      <Blobs />
      <div className="shell">
        {sidebar && <div className="backdrop-mob" onClick={() => setSidebar(false)} />}

        {/* SIDEBAR */}
        <aside className={`sidebar${sidebar ? " open" : ""}${sidebarCollapsed ? " collapsed" : ""}`}>
          <div className="sb-inner">
            <Link to="/dashboard" className="brand" onClick={() => setSidebar(false)} style={{ width: "100%", border: "none", background: "transparent", cursor: "pointer", transition: "all .2s", borderRadius: 8, textDecoration: "none" }}>
              <div className="brand-logo"><img src={dark ? "/tokki-logo dark mode.png" : "/tokki-logo.png"} alt="Tokki" style={{ width: "100%", height: "100%", objectFit: "contain" }} /></div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: T.primaryLight, lineHeight: 1.2 }}>Warehouse</div>
                <div style={{ fontSize: 9, color: T.muted, letterSpacing: ".12em", textTransform: "uppercase", fontWeight: 700, marginTop: 2 }}>Management System</div>
              </div>
            </Link>
            <div className="sb-nav-scroll">
              <div className="nav-label">Menu Utama</div>
              {visibleTabs.map(t => (
                <Link key={t.id} to={`/${t.id}`} className={`nav-item${currentTab === t.id ? " active" : ""}`} onClick={() => setSidebar(false)} style={{ textDecoration: "none" }}>
                  <span className="nav-icon">{t.icon}</span>
                  <span className="nav-text">{t.label}</span>
                  {t.id === "transaction" && todayTrx.length > 0 && <span className="nav-pill">{todayTrx.length}</span>}
                  {t.id === "history" && pendingApprovalCount > 0 && <span className="nav-pill">{pendingApprovalCount}</span>}
                </Link>
              ))}
              <button className="nav-item mobile-logout" onClick={() => logout()}>
                <span className="nav-icon">{"\u238B"}</span>
                <span className="nav-text">Keluar Akun</span>
              </button>
            </div>
            <div className="sb-footer">
              <div className="sb-user-row" style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 6px" }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: `linear-gradient(135deg,${T.primary},${T.primaryLight})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "white", flexShrink: 0 }}>
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
              <button className="tb-btn" style={{ padding: "7px 10px", flexShrink: 0 }}
                onClick={() => { if (window.innerWidth <= 660) { setSidebar(v => !v); } else { setSidebarCollapsed(v => !v); } }}>
                <svg width="15" height="12" viewBox="0 0 15 12" fill="none">
                  <rect width="15" height="1.5" rx="1" fill="currentColor" />
                  <rect y="5.25" width="15" height="1.5" rx="1" fill="currentColor" />
                  <rect y="10.5" width="15" height="1.5" rx="1" fill="currentColor" />
                </svg>
              </button>
              <h1 className="page-title">{TABS.find(t => t.id === currentTab)?.label || "Dashboard"}</h1>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              {isAdmin && (
                <button className="tb-btn tb-backup" onClick={downloadBackupData} style={{ fontWeight: 700 }}>
                  {"\u2B07"} Backup
                </button>
              )}
              {isAdmin && (
                <button className="tb-btn tb-restore" onClick={() => restoreInputRef.current?.click()} style={{ fontWeight: 700 }}>
                  {"\u2934"} Restore
                </button>
              )}
              {isAdmin && (
                <button className="tb-btn tb-reset-dummy" onClick={resetDummyData} style={{ fontWeight: 700 }}>
                  {"\u267B"} Reset Dummy
                </button>
              )}
              <input ref={restoreInputRef} type="file" accept="application/json,.json" style={{ display: "none" }} onChange={restoreBackupData} />

              <Toggle />

              {/* NOTIF */}
              <div className="notif-wrap" ref={notifRef}>
                {(() => {
                  const unread = notifHistory.filter(n => !n.read).length;
                  const totalBadge = unread + lowStock.length;
                  return (
                    <button className="tb-btn" onClick={() => setNotif(!notif)} style={{ position: "relative", padding: "7px 12px" }}>
                      {"\uD83D\uDD14"}
                      {totalBadge > 0 && (
                        <span style={{ position: "absolute", top: -3, right: -3, background: unread > 0 ? "#f59e0b" : T.red, color: "white", fontSize: 9, fontWeight: 800, borderRadius: "50%", width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
                          {totalBadge}
                        </span>
                      )}
                    </button>
                  );
                })()}

                {notif && (
                  <div className="notif-drop" style={{ width: 320 }}>
                    <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}`, background: T.surface, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: 13, fontWeight: 800, ...gText() }}>Notifikasi</div>
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
                          {tb.badge > 0 && <span style={{ background: tb.id === "notif" ? "#f59e0b" : T.red, color: "white", fontSize: 9, fontWeight: 800, borderRadius: 999, padding: "1px 5px", minWidth: 14, textAlign: "center" }}>{tb.badge}</span>}
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
                                  <div style={{ flexShrink: 0, padding: "3px 9px", borderRadius: 99, background: s.bg, color: s.text, fontSize: 10, fontWeight: 800, border: `1px solid ${s.border || "transparent"}` }}>{s.label}</div>
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
                {"\uD83D\uDCC5"} {todayFmt()}
              </div>
              <button className="tb-btn tb-logout" onClick={() => logout()} title="Keluar akun" style={{ padding: "7px 10px" }}>
                {"\u238B"} Keluar
              </button>
            </div>
          </header>

          {/* PAGE CONTENT */}
          <main className="body-area enter">
            <Outlet />
          </main>
        </div>
      </div>
    </>
  );
};
