// @ts-nocheck
import { useStore } from "../../store/useStore";
import { getT } from "../../theme/tokens";

export const BtnG = ({ children, style, ...r }) => {
  const { dark } = useStore();
  const T = getT(dark);
  return (
    <button {...r} style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
      background: T.surface, color: T.muted, border: `1px solid ${T.border}`,
      borderRadius: 8, fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 13, fontWeight: 600,
      padding: "10px 18px", cursor: "pointer", transition: "border-color .15s, color .15s", ...style
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderHover; e.currentTarget.style.color = T.text; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.muted; }}>
      {children}
    </button>
  );
};
