// @ts-nocheck
// ─── Helpers ─────────────────────────────────────────────────────

export const clamp01 = (n) => Math.max(0, Math.min(1, Number(n)||0));

export const trxApprovalStatus = (t) => String(t?.approvalStatus||"approved").toLowerCase();

export const isApprovedOutTrx = (t) => trxApprovalStatus(t) === "approved";

export const initials = (name="") => String(name).split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]?.toUpperCase()||"").join("") || "NA";

const _AV_PAL = ["#10b981","#6366f1","#f59e0b","#ef4444","#8b5cf6","#ec4899","#14b8a6","#f97316","#0ea5e9","#22c55e"];
export const avatarColor = (name="") => {
  let h = 0;
  for(let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h<<5)-h);
  return _AV_PAL[Math.abs(h) % _AV_PAL.length];
};

export const toSafeRows = (rows) => Array.isArray(rows) ? rows : (rows ? [rows] : []);

export const csvEscape = (v) => {
  const s = String(v ?? "").replace(/"/g, '""');
  return /[",\n]/.test(s) ? `"${s}"` : s;
};

export const csvText = (v) => `="${String(v ?? "").replace(/"/g, '""')}"`;

export const triggerDownload = (filename, content, mime) => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const pathToTab = (pathname = "") => {
  const p = String(pathname || "/").toLowerCase().replace(/\/+$/, "") || "/";
  if (p === "/" || p === "/dashboard" || p === "/dasboard" || p === "/dasbord") return "dashboard";
  if (p === "/login") return "login";
  if (p === "/riwayat" || p === "/history") return "history";
  if (p === "/laporan" || p === "/report") return "report";
  if (p === "/pengambilan" || p === "/transaction") return "transaction";
  if (p === "/stok" || p === "/stock") return "stock";
  return null;
};

export const tabToPath = (tab = "") => ({
  login: "/Login",
  dashboard: "/Dasboard",
  transaction: "/Pengambilan",
  stock: "/Stok",
  history: "/Riwayat",
  report: "/Laporan",
}[tab] || "/Dasboard");
