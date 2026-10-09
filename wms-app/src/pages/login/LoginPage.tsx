// @ts-nocheck
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./LoginPage.css";
import { useStore } from "../../store/useStore";
import { GlobalStyle } from "../../components/layout/GlobalStyle";
import { ToastNotification } from "../../components/ui/ToastNotification";

export function LoginPage() {
  const { login: storeLogin, setToast, withLoading, loadingCount } = useStore();
  const navigate = useNavigate();
  
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add("login-page-active");
    document.body.classList.add("login-page-active");
    return () => {
      document.documentElement.classList.remove("login-page-active");
      document.body.classList.remove("login-page-active");
    };
  }, []);

  const login = async () => {
    if (!loginForm.username || !loginForm.password) { setToast("Username dan password wajib diisi", "err"); return; }
    console.log("[LOGIN] Starting login for:", loginForm.username);
    await withLoading(async () => {
      try {
        const { supabase } = await import("../../lib/supabase");
        console.log("[LOGIN] Supabase imported, querying users...");
        const { data: users, error } = await supabase.rpc("verify_user_login", {
          p_username: loginForm.username,
          p_password: loginForm.password
        });

        console.log("[LOGIN] RPC result:", { error, usersCount: users?.length });
        if (error) throw new Error("Gagal menghubungi database");
        if (!users || users.length === 0) throw new Error("Username atau password salah");

        const user = users[0];
        console.log("[LOGIN] Login success via RPC! Calling storeLogin...");
        storeLogin("supabase-session", { id: user.id, username: user.username, role: user.role, name: user.name });
        
        // Log audit (fire and forget)
        await supabase.from("audit_logs").insert([{
          action: "auth.login",
          actor: { username: user.username, role: user.role },
          target: user.username
        }]);

        // Auto-cleanup audit logs older than 30 days to prevent DB from filling up
        try {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          await supabase
            .from("audit_logs")
            .delete()
            .lt("createdAt", thirtyDaysAgo.toISOString());
          console.log("[LOGIN] Auto-cleanup old audit logs completed.");
        } catch (cleanupErr) {
          console.error("[LOGIN] Failed to clean up old audit logs:", cleanupErr);
        }

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
    <main className="tokki-login">
      <GlobalStyle />
      <ToastNotification />
      <header className="login-brand-header"><div className="login-logo-plate"><img src="/tokki-logo dark mode.png" alt="Tokki Engineering and Fabrication" /></div></header>
      <div className="login-access-card">
      <section className="login-form-panel">
        <div className="login-form-content">
          <div className="login-welcome"><h1>Selamat datang.</h1><p>Masuk untuk mengelola persediaan gudang.</p></div>
          <form className="login-form" onSubmit={e => { e.preventDefault(); if (!loadingCount) login(); }}>
            <div className="login-field"><label htmlFor="login-username">Username</label><input id="login-username" type="text" autoComplete="username" required placeholder="Masukkan username" value={loginForm.username} onChange={e => setLoginForm({ ...loginForm, username: e.target.value })} /></div>
            <div className="login-field"><label htmlFor="login-password">Password</label><div className="login-password-wrap"><input id="login-password" type={showLoginPassword ? "text" : "password"} autoComplete="current-password" required placeholder="Masukkan password" value={loginForm.password} onChange={e => setLoginForm({ ...loginForm, password: e.target.value })} /><button type="button" onClick={() => setShowLoginPassword(v => !v)} aria-pressed={showLoginPassword}>{showLoginPassword ? "Tutup" : "Lihat"}</button></div></div>
            <button type="submit" className="login-submit" disabled={loadingCount > 0}>{loadingCount > 0 ? "Sedang masuk…" : "Masuk"}</button>
          </form>
          <div className="login-account-note">Butuh akses? Hubungi administrator gudang.</div>
        </div>
      </section>
      <section className="login-photo-panel">
        <img className="login-factory-photo" src="/login-bg-new.webp" alt="Gedung PT Tokki Engineering and Fabrication" />
      </section>
      </div>
      <footer className="login-company-note">PT Tokki Engineering and Fabrication</footer>
    </main>
  );
}
