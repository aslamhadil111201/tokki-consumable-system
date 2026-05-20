// @ts-nocheck
import { useStore } from "../../store/useStore";
import { getT } from "../../theme/tokens";

export const BtnP = ({ children, style, ...r }) => {
  const { dark } = useStore();
  const T = getT(dark);
  return (
    <button {...r} style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
      background: `linear-gradient(135deg,${T.primary},${T.primaryLight})`,
      color: "white", border: "none", borderRadius: 12, fontFamily: "'Plus Jakarta Sans',sans-serif",
      fontSize: 13, fontWeight: 700, padding: "10px 20px", cursor: "pointer",
      boxShadow: `0 4px 14px ${T.primaryGlow}`, transition: "all .2s ease", ...style
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = `0 8px 24px ${T.primaryGlow}`; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = `0 4px 14px ${T.primaryGlow}`; }}>
      {children}
    </button>
  );
};
