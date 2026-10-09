// @ts-nocheck
import { useStore } from "../../store/useStore";
import { getT } from "../../theme/tokens";

export const BtnP = ({ children, style, ...r }) => {
  const { dark } = useStore();
  const T = getT(dark);
  return (
    <button {...r} className={`ui-btn-primary ${r.className || ""}`} style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
      background: T.primary,
      color: "white", border: "none", borderRadius: 8, fontFamily: "'Plus Jakarta Sans',sans-serif",
      fontSize: 13, fontWeight: 600, padding: "10px 20px", cursor: "pointer",
      transition: "opacity .15s ease", ...style
    }}
      onMouseEnter={e => { e.currentTarget.style.opacity = "0.88"; }}
      onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}>
      {children}
    </button>
  );
};
