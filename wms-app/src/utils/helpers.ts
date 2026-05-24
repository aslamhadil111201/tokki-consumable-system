// ─── Helpers ─────────────────────────────────────────────────────

/** Clamps a number between 0 and 1 */
export const clamp01 = (n: unknown): number => Math.max(0, Math.min(1, Number(n) || 0));

/** Returns the approval status string of a transaction, lowercased */
export const trxApprovalStatus = (t: { approvalStatus?: string } | null | undefined): string =>
  String(t?.approvalStatus || "approved").toLowerCase();

/** Returns true if a transaction is approved (stock-out) */
export const isApprovedOutTrx = (t: { approvalStatus?: string } | null | undefined): boolean =>
  trxApprovalStatus(t) === "approved";

/** Returns up to 2-letter initials from a name */
export const initials = (name = ""): string =>
  String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() || "")
    .join("") || "NA";

const _AV_PAL = [
  "#10b981", "#6366f1", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#0ea5e9", "#22c55e",
];

/** Returns a deterministic color from a palette based on a name string */
export const avatarColor = (name = ""): string => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return _AV_PAL[Math.abs(h) % _AV_PAL.length];
};

/** Ensures the value is always an array */
export const toSafeRows = <T>(rows: T | T[] | null | undefined): T[] =>
  Array.isArray(rows) ? rows : rows ? [rows] : [];

/** Escapes a value for CSV output */
export const csvEscape = (v: unknown): string => {
  const s = String(v ?? "").replace(/"/g, '""');
  return /[",\n]/.test(s) ? `"${s}"` : s;
};

/** Wraps a value in Excel text formula to prevent number auto-formatting */
export const csvText = (v: unknown): string => `="${String(v ?? "").replace(/"/g, '""')}"`;

/** Triggers a file download in the browser */
export const triggerDownload = (filename: string, content: string, mime: string): void => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

/** Maps a pathname to a tab id */
export const pathToTab = (pathname = ""): string | null => {
  const p = String(pathname || "/").toLowerCase().replace(/\/+$/, "") || "/";
  if (p === "/" || p === "/dashboard" || p === "/dasboard" || p === "/dasbord") return "dashboard";
  if (p === "/login") return "login";
  if (p === "/riwayat" || p === "/history") return "history";
  if (p === "/laporan" || p === "/report") return "report";
  if (p === "/pengambilan" || p === "/transaction") return "transaction";
  if (p === "/stok" || p === "/stock") return "stock";
  return null;
};

/** Maps a tab id to a path */
export const tabToPath = (tab = ""): string =>
  ({
    login: "/Login",
    dashboard: "/Dasboard",
    transaction: "/Pengambilan",
    stock: "/Stok",
    history: "/Riwayat",
    report: "/Laporan",
  }[tab] || "/Dasboard");
