// ─── Constants ───────────────────────────────────────────────────
import { FileSpreadsheet, FileText, LayoutDashboard, ArrowUpCircle, Package, History, BarChart3, Truck } from "lucide-react";

export const API = (
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? "http://localhost:3001/api" : "/api")
).replace(/\/$/, "");

// Default 30 menit — bisa di-override via VITE_IDLE_TIMEOUT_MINUTES di .env
export const IDLE_TIMEOUT_MINUTES = Math.max(
  1,
  Number(import.meta.env.VITE_IDLE_TIMEOUT_MINUTES || 30),
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

export const EXCEL_ICON = <FileSpreadsheet size={15} />;
export const PDF_ICON = <FileText size={15} />;

export const NAV_ICONS = {
  dashboard: <LayoutDashboard size={18} />,
  transaction: <ArrowUpCircle size={18} />,
  stock: <Package size={18} />,
  delivery: <Truck size={18} />,
  history: <History size={18} />,
  report: <BarChart3 size={18} />,
};

export const TABS = [
  {id:"dashboard",label:"Dashboard",icon:NAV_ICONS.dashboard},
  {id:"transaction",label:"Pengambilan",icon:NAV_ICONS.transaction},
  {id:"stock",label:"Stok Barang",icon:NAV_ICONS.stock},
  {id:"delivery",label:"Surat Jalan",icon:NAV_ICONS.delivery},
  {id:"history",label:"Riwayat",icon:NAV_ICONS.history},
  {id:"report",label:"Laporan",icon:NAV_ICONS.report},
];
