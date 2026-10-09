// @ts-nocheck
// ─── Design Tokens ───────────────────────────────────────────────

// Optional argument preserves existing color-helper call sites.
export const getT = (_dark?: boolean) => ({
  bg:"#f5f6f7", surface:"#ffffff", surfaceSolid:"#ffffff",
  card:"#ffffff", border:"#e5e8eb", borderHover:"#10b981",
  text:"#202624", muted:"#7b8580", sub:"#415668",
  primary:"#087655", primaryLight:"#155b46", primaryGlow:"rgba(5,150,105,0.15)",
  green:"#087655", greenBg:"#eaf3ee", greenBorder:"#a7f3d0", greenText:"#065f46",
  amber:"#b45309", amberBg:"#fffbeb", amberBorder:"#fde68a", amberText:"#78350f",
  red:"#dc2626", redBg:"#fef2f2", redBorder:"#fecaca", redText:"#7f1d1d",
  inputBg:"#ffffff", sidebarBg:"#ffffff", topbarBg:"#ffffff",
  navActive:"#eaf3ee", navActiveBorder:"#cde4d8", navActiveText:"#065f46",
  shadowCard:"0 2px 3px rgba(22,60,47,0.02)", shadowSm:"0 1px 2px rgba(22,60,47,0.02)",
});

// T is a mutable reference - updated by App component on each render
// All components that import T will get the current value at render time
export let T = getT();

// Refresh the shared light palette used by existing components.
export const updateT = (_dark?: boolean) => {
  T = getT();
  return T;
};

export const gText = () => ({ color: T.primaryLight });
