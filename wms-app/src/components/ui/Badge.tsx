// @ts-nocheck
import { useStore } from "../../store/useStore";
import { getT } from "../../theme/tokens";

export const Badge = ({ children, bg, color, border, style, alignRight }) => {
  const { dark } = useStore();
  const T = getT(dark);
  return (
    <div style={alignRight ? { width: "100%", display: "flex", justifyContent: "flex-end" } : {}}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 20, background: bg || T.surface, color: color || T.muted, border: `1px solid ${border || T.border}`, fontSize: 10, fontWeight: 700, whiteSpace: "nowrap", letterSpacing: ".05em", ...style }}>{children}</span>
    </div>
  );
};
