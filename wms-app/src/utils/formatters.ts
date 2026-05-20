// @ts-nocheck
// ─── Formatters ──────────────────────────────────────────────────

export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

export const nowTime = () => new Date().toTimeString().slice(0,5);

export const fmtDate = d => d ? new Date(d+"T00:00:00").toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"}) : "";

export const todayFmt = () => new Date().toLocaleDateString("id-ID",{weekday:"short",day:"2-digit",month:"short",year:"numeric"});

export const fmtMoney = n => `Rp ${Number(n||0).toLocaleString("id-ID")}`;

export const isoDate = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

export const fmtDateExcel = (d) => {
  if(!d) return "";
  const m = String(d).match(/(\d{4})-(\d{2})-(\d{2})/);
  if(m) return `${m[3]}/${m[2]}/${m[1]}`;
  return String(d);
};
