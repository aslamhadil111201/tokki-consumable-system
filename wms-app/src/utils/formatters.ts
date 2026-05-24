// ─── Formatters ──────────────────────────────────────────────────

/** Returns today's date as "YYYY-MM-DD" */
export const todayStr = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Returns current time as "HH:MM" */
export const nowTime = (): string => new Date().toTimeString().slice(0, 5);

/** Formats an ISO date string to Indonesian locale (e.g. "01 Jan 2024") */
export const fmtDate = (d: string | null | undefined): string =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "";

/** Returns today's date in full Indonesian locale (e.g. "Sen, 01 Jan 2024") */
export const todayFmt = (): string =>
  new Date().toLocaleDateString("id-ID", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });

/** Formats a number as Indonesian Rupiah (e.g. "Rp 1.000.000") */
export const fmtMoney = (n: number | string | null | undefined): string =>
  `Rp ${Number(n || 0).toLocaleString("id-ID")}`;

/** Converts a Date object to "YYYY-MM-DD" string */
export const isoDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Converts "YYYY-MM-DD" to "DD/MM/YYYY" for Excel compatibility */
export const fmtDateExcel = (d: string | null | undefined): string => {
  if (!d) return "";
  const m = String(d).match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return String(d);
};
