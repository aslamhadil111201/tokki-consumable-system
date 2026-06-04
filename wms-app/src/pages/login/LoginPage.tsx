// @ts-nocheck
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./LoginPage.css";
import { getT } from "../../theme/tokens";
import { useStore } from "../../store/useStore";
import { GlobalStyle } from "../../components/layout/GlobalStyle";

export function LoginPage() {
  const { dark, toggleTheme, login: storeLogin, setToast, withLoading } = useStore();
  const T = getT(dark);
  const navigate = useNavigate();
  
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const login = async () => {
    if (!loginForm.username || !loginForm.password) { setToast("Username dan password wajib diisi", "err"); return; }
    console.log("[LOGIN] Starting login for:", loginForm.username);
    await withLoading(async () => {
      try {
        const { supabase } = await import("../../lib/supabase");
        console.log("[LOGIN] Supabase imported, querying users...");
        const { data: users, error } = await supabase
          .from("users")
          .select("*")
          .eq("username", loginForm.username)
          .limit(1);

        console.log("[LOGIN] Query result:", { error, usersCount: users?.length });
        if (error) throw new Error("Gagal menghubungi database");
        if (!users || users.length === 0) throw new Error("Username tidak ditemukan");

        const user = users[0];
        if (user.password !== loginForm.password) throw new Error("Password salah");

        console.log("[LOGIN] Password match! Calling storeLogin...");
        storeLogin("supabase-session", { id: user.id, username: user.username, role: user.role });
        // Log audit (fire and forget)
        await supabase.from("audit_logs").insert([{
          action: "auth.login",
          actor: { username: user.username, role: user.role },
          target: user.username
        }]);
        console.log("[LOGIN] Success! Navigating to dashboard...");
        setToast(`Selamat datang, ${user.username} \u2713`);
        navigate("/dashboard", { replace: true });
      } catch (e: any) {
        console.error("[LOGIN] Error:", e);
        setToast(e?.message || "Gagal login", "err");
      }
    }, "Sedang masuk...");
  };

  return (
    <div style={{ position: "relative", minHeight: "100vh" }}>
      <GlobalStyle />
      <div className="login-bg" />
      <div style={{ position: "fixed", right: "-6%", top: "50%", transform: "translateY(-50%)", width: "min(520px,52vw)", opacity: dark ? 0.05 : 0.07, pointerEvents: "none", zIndex: 0 }}>
        <img src="/LOGO TOKKI-FAVICON.png" alt="" style={{ width: "100%", objectFit: "contain" }} />
      </div>
      <div style={{ position: "fixed", left: 0, top: 0, bottom: 0, width: "35%", background: dark ? "linear-gradient(90deg,rgba(0,12,5,0.6) 0%,transparent 100%)" : "linear-gradient(90deg,rgba(209,250,229,0.5) 0%,transparent 100%)", pointerEvents: "none", zIndex: 0 }} />
      <div className="login-wrap">
        <div className="login-card">
          <button type="button" className="login-mode-icon-btn" onClick={toggleTheme} aria-label={dark ? "Pindah ke mode terang" : "Pindah ke mode gelap"} title={dark ? "Pindah ke mode terang" : "Pindah ke mode gelap"} style={{ position: "absolute", top: 16, right: 16, zIndex: 3 }}>
            {dark ? "☀️" : "🌙"}
          </button>

          <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
            <img src={dark ? "/tokki-logo dark mode.png" : "/tokki-logo.png"} alt="Tokki" style={{ height: dark ? 46 : 56, objectFit: "contain" }} />
          </div>

          <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: T.navActive, border: `1px solid ${T.navActiveBorder}`, borderRadius: 20, padding: "5px 14px", fontSize: 11, fontWeight: 800, color: T.navActiveText }}>
              🛡️ Warehouse Management System
            </div>
          </div>

          <div style={{ fontSize: 30, fontWeight: 900, lineHeight: 1.15, marginBottom: 6 }}>
            <span style={{ color: T.text }}>Selamat </span>
            <span style={{ color: T.primary }}>Datang</span>
          </div>
          <div style={{ fontSize: 13, color: T.muted, marginBottom: 20, fontWeight: 500, lineHeight: 1.65 }}>
            Masuk untuk mengelola inventaris barang gudang
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: T.primary, letterSpacing: ".12em", textTransform: "uppercase", marginBottom: 6 }}>Username</div>
            <div className="login-ifield-wrap">
              <span className="login-ifield-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg>
              </span>
              <input className="ifield" type="text" placeholder="Masukkan username"
                value={loginForm.username} onChange={e => setLoginForm({ ...loginForm, username: e.target.value })}
                onKeyDown={e => e.key === "Enter" && login()} />
            </div>
          </div>

          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: T.primary, letterSpacing: ".12em", textTransform: "uppercase", marginBottom: 6 }}>Password</div>
            <div className="login-ifield-wrap" style={{ position: "relative" }}>
              <span className="login-ifield-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              </span>
              <input className="ifield" type={showLoginPassword ? "text" : "password"} placeholder="Masukkan password"
                style={{ paddingRight: 76 }}
                value={loginForm.password} onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
                onKeyDown={e => e.key === "Enter" && login()} />
              <button type="button" onClick={() => setShowLoginPassword(v => !v)}
                style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", fontSize: 12, fontWeight: 700, color: T.primary, cursor: "pointer", padding: "4px 2px" }}>
                {showLoginPassword ? "Tutup" : "Lihat"}
              </button>
            </div>
          </div>

          <button className="login-btn" onClick={login}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            Masuk ke Dashboard
          </button>

          <div className="login-divider">
            <span style={{ fontSize: 11, color: T.muted, fontWeight: 600 }}>atau</span>
          </div>

          {/* Guest login info */}
          <div style={{
            background: `linear-gradient(135deg, ${T.surface} 0%, ${dark ? "rgba(16,185,129,0.08)" : "rgba(16,185,129,0.05)"} 100%)`,
            border: `1px solid ${T.primary}40`,
            borderRadius: 14, padding: "12px 16px", marginBottom: 12,
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: `${T.primary}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🚚</div>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>Akun Delivery Access</span>
            </div>
            <button
              type="button"
              onClick={() => setLoginForm({ username: "delivery", password: "tokki2026" })}
              style={{
                background: T.primary, color: "white", border: "none",
                borderRadius: 8, padding: "7px 16px", fontSize: 12,
                fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
              }}>
              Gunakan →
            </button>
          </div>

          <div style={{ textAlign: "center", fontSize: 12, color: T.muted, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontWeight: 500 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: T.primary }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
            Gunakan akun yang telah diberikan
          </div>
        </div>
      </div>
    </div>
  );
}
