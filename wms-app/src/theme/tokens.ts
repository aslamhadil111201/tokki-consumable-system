// @ts-nocheck
// ─── Design Tokens ───────────────────────────────────────────────

export const getT = (dark) => dark ? {
  bg:"#040d09", surface:"rgba(8,24,16,0.65)", surfaceSolid:"#071510",
  card:"rgba(10,32,20,0.72)", border:"rgba(16,185,129,0.14)", borderHover:"rgba(16,185,129,0.35)",
  text:"#ecfdf5", muted:"#6ee7b7", sub:"#a7f3d0",
  primary:"#10b981", primaryLight:"#34d399", primaryGlow:"rgba(16,185,129,0.35)",
  green:"#10b981", greenBg:"rgba(16,185,129,0.1)", greenBorder:"rgba(16,185,129,0.25)", greenText:"#6ee7b7",
  amber:"#f59e0b", amberBg:"rgba(245,158,11,0.1)", amberBorder:"rgba(245,158,11,0.25)", amberText:"#fcd34d",
  red:"#ef4444", redBg:"rgba(239,68,68,0.1)", redBorder:"rgba(239,68,68,0.25)", redText:"#fca5a5",
  inputBg:"rgba(4,13,9,0.7)", sidebarBg:"rgba(3,9,6,0.97)", topbarBg:"rgba(3,9,6,0.92)",
  navActive:"rgba(16,185,129,0.15)", navActiveBorder:"rgba(16,185,129,0.3)", navActiveText:"#34d399",
  shadowCard:"0 25px 60px rgba(0,0,0,0.45)", shadowSm:"0 8px 22px rgba(0,0,0,0.3)",
} : {
  bg:"#f6fef9", surface:"rgba(255,255,255,0.85)", surfaceSolid:"#ffffff",
  card:"#ffffff", border:"#d1fae5", borderHover:"#34d399",
  text:"#022c22", muted:"#4b5563", sub:"#1f2937",
  primary:"#059669", primaryLight:"#047857", primaryGlow:"rgba(5,150,105,0.25)",
  green:"#059669", greenBg:"#dcfce7", greenBorder:"#bbf7d0", greenText:"#166534",
  amber:"#b45309", amberBg:"#fef9c3", amberBorder:"#fef08a", amberText:"#854d0e",
  red:"#dc2626", redBg:"#fee2e2", redBorder:"#fecaca", redText:"#991b1b",
  inputBg:"#f9fafb", sidebarBg:"rgba(255,255,255,0.98)", topbarBg:"rgba(255,255,255,0.95)",
  navActive:"#d1fae5", navActiveBorder:"#6ee7b7", navActiveText:"#065f46",
  shadowCard:"0 10px 30px rgba(0,0,0,0.08)", shadowSm:"0 4px 12px rgba(0,0,0,0.05)",
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
