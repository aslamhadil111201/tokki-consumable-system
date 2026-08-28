// @ts-nocheck
// ─── Design Tokens ───────────────────────────────────────────────

export const getT = (dark) => dark ? {
  bg:"#0b0f0d", surface:"rgba(16,24,20,0.8)", surfaceSolid:"#111916",
  card:"#141c18", border:"rgba(255,255,255,0.08)", borderHover:"rgba(16,185,129,0.4)",
  text:"#e8f5ee", muted:"#6b7c74", sub:"#9ab5a8",
  primary:"#10b981", primaryLight:"#34d399", primaryGlow:"rgba(16,185,129,0.15)",
  green:"#10b981", greenBg:"rgba(16,185,129,0.08)", greenBorder:"rgba(16,185,129,0.2)", greenText:"#6ee7b7",
  amber:"#f59e0b", amberBg:"rgba(245,158,11,0.08)", amberBorder:"rgba(245,158,11,0.2)", amberText:"#fcd34d",
  red:"#ef4444", redBg:"rgba(239,68,68,0.08)", redBorder:"rgba(239,68,68,0.2)", redText:"#fca5a5",
  inputBg:"#0d1410", sidebarBg:"#0d1410", topbarBg:"rgba(13,20,16,0.95)",
  navActive:"rgba(16,185,129,0.1)", navActiveBorder:"rgba(16,185,129,0.25)", navActiveText:"#34d399",
  shadowCard:"0 4px 16px rgba(0,0,0,0.3)", shadowSm:"0 2px 8px rgba(0,0,0,0.2)",
} : {
  bg:"#f4f7f5", surface:"#ffffff", surfaceSolid:"#ffffff",
  card:"#ffffff", border:"#e2e8e5", borderHover:"#10b981",
  text:"#0f2019", muted:"#5c6e66", sub:"#374840",
  primary:"#059669", primaryLight:"#047857", primaryGlow:"rgba(5,150,105,0.15)",
  green:"#059669", greenBg:"#ecfdf5", greenBorder:"#a7f3d0", greenText:"#065f46",
  amber:"#b45309", amberBg:"#fffbeb", amberBorder:"#fde68a", amberText:"#78350f",
  red:"#dc2626", redBg:"#fef2f2", redBorder:"#fecaca", redText:"#7f1d1d",
  inputBg:"#f9fafb", sidebarBg:"#ffffff", topbarBg:"rgba(255,255,255,0.97)",
  navActive:"#ecfdf5", navActiveBorder:"#6ee7b7", navActiveText:"#065f46",
  shadowCard:"0 4px 12px rgba(0,0,0,0.06)", shadowSm:"0 1px 4px rgba(0,0,0,0.04)",
};

// T is a mutable reference - updated by App component on each render
// All components that import T will get the current value at render time
export let T = getT(true);

// updateT is called by App component to update T when dark mode changes
export const updateT = (dark: boolean) => {
  T = getT(dark);
  return T;
};

export const gText = () => ({ color: T.primaryLight });
