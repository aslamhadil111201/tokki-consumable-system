// @ts-nocheck
import { useStore } from "../../store/useStore";
import { getT } from "../../theme/tokens";

export const FL = ({ children }) => {
  const { dark } = useStore();
  const T = getT(dark);
  return (
    <div style={{ fontSize: 10, fontWeight: 800, color: T.muted, letterSpacing: ".12em", textTransform: "uppercase", marginBottom: 6 }}>{children}</div>
  );
};
