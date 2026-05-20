// @ts-nocheck
// ─── Constants ───────────────────────────────────────────────────

export const API = (
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? "http://localhost:3001/api" : "/api")
).replace(/\/$/, "");

export const IDLE_TIMEOUT_MINUTES = Math.max(
  1,
  Number(import.meta.env.VITE_IDLE_TIMEOUT_MINUTES || 3),
);
export const IDLE_TIMEOUT_MS = IDLE_TIMEOUT_MINUTES * 60 * 1000;
export const CLIENT_BUILD_VERSION = String(import.meta.env.VITE_APP_VERSION || import.meta.env.VITE_GIT_SHA || "dev-local");
export const CLIENT_MODE = import.meta.env.DEV ? "local" : "production";
export const API_DISPLAY = (() => {
  try {
    return API.startsWith("http") ? new URL(API).host : "same-origin";
  } catch {
    return API;
  }
})();

export const CATS = ["Semua","APD","Abrasif","Cutting Tool","Industrial Gas","Kebersihan"];
export const ITEM_CATEGORIES = ["APD","Abrasif","Cutting Tool","Industrial Gas","Kebersihan"];
export const MAX_STOCK_VALUE = 1000000;
export const MAX_TEXT_LEN = 120;

export const EXCEL_ICON = (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:"block"}}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/><path d="M7 12l2.5 3L12 12l2.5 3L17 12" strokeWidth="1.8"/></svg>);
export const PDF_ICON = (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:"block"}}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h1.5a1.5 1.5 0 0 1 0 3H9v-3zm0 3v2"/><path d="M14 13v5m0 0h2m-2-3h1.5"/></svg>);

export const NAV_ICONS = {
  dashboard: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:"block"}}>
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  transaction: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:"block"}}>
      <circle cx="12" cy="12" r="10"/>
      <polyline points="16 12 12 8 8 12"/>
      <line x1="12" y1="16" x2="12" y2="8"/>
    </svg>
  ),
  stock: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:"block"}}>
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
      <line x1="3" y1="6" x2="21" y2="6"/>
      <path d="M16 10a4 4 0 0 1-8 0"/>
    </svg>
  ),
  history: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:"block"}}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
      <path d="M3 3v5h5"/>
      <path d="M12 7v5l4 2"/>
    </svg>
  ),
  report: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:"block"}}>
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  ),
};

export const TABS = [
  {id:"dashboard",label:"Dashboard",icon:NAV_ICONS.dashboard},
  {id:"transaction",label:"Pengambilan",icon:NAV_ICONS.transaction},
  {id:"stock",label:"Stok Barang",icon:NAV_ICONS.stock},
  {id:"history",label:"Riwayat",icon:NAV_ICONS.history},
  {id:"report",label:"Laporan",icon:NAV_ICONS.report},
];
