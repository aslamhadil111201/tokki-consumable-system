// @ts-nocheck
// ─── Stock Helpers ───────────────────────────────────────────────
import { getT } from "../theme/tokens";
import { UIIcon } from "../components/ui/UIIcon";

export const stockStatusKey = it => {
  const stock = Number(it?.stock || 0);
  const minStock = Number(it?.minStock || 0);
  if (stock === 0) return "habis";
  if (stock <= minStock) return "menipis";
  if (minStock > 0 && stock <= minStock * 1.5) return "mendekati";
  return "aman";
};

export const stockStatusIcon = (key, size = 14) => (
  key === "habis" ? <UIIcon name="x" size={size} />
    : key === "menipis" ? <UIIcon name="alert" size={size} />
    : key === "mendekati" ? <UIIcon name="clock" size={size} />
    : key === "aman" ? <UIIcon name="shield" size={size} />
    : <UIIcon name="check" size={size} />
);

// stockStatus accepts optional dark param for reactive theming
export const stockStatus = (it, dark = true) => {
  const T = getT(dark);
  const key = stockStatusKey(it);
  if (key === "habis") return { bg: T.redBg, text: T.redText, border: T.redBorder, dot: T.red, label: "Habis", key: "habis", icon: stockStatusIcon("habis", 12) };
  if (key === "menipis") return { bg: T.amberBg, text: T.amberText, border: T.amberBorder, dot: T.amber, label: "Menipis", key: "menipis", icon: stockStatusIcon("menipis", 12) };
  if (key === "mendekati") return { bg: "#ffedd5", text: "#9a3412", border: "#fdba74", dot: "#f97316", label: "Mendekati", key: "mendekati", icon: stockStatusIcon("mendekati", 12) };
  return { bg: T.greenBg, text: T.greenText, border: T.greenBorder, dot: T.green, label: "Aman", key: "aman", icon: stockStatusIcon("aman", 12) };
};

export const catColor = (cat, dark = true) => {
  const T = getT(dark);
  return ({
    APD: { dot: "#10b981", bg: "rgba(16,185,129,0.1)", text: "#6ee7b7", border: "rgba(16,185,129,0.25)" },
    Abrasif: { dot: "#f59e0b", bg: "rgba(245,158,11,0.1)", text: "#fcd34d", border: "rgba(245,158,11,0.25)" },
    "Cutting Tool": { dot: "#3b82f6", bg: "rgba(59,130,246,0.1)", text: "#93c5fd", border: "rgba(59,130,246,0.25)" },
    "Industrial Gas": { dot: "#8b5cf6", bg: "rgba(139,92,246,0.1)", text: "#c4b5fd", border: "rgba(139,92,246,0.25)" },
    Kebersihan: { dot: "#ec4899", bg: "rgba(236,72,153,0.1)", text: "#f9a8d4", border: "rgba(236,72,153,0.25)" },
  }[cat] || { dot: T.primary, bg: T.navActive, text: T.navActiveText, border: T.navActiveBorder });
};
