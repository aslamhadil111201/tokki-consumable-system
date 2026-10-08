// @ts-nocheck
import { useStore } from "../../store/useStore";
import { getT } from "../../theme/tokens";

export const FL = ({ children }) => {
  const { dark } = useStore();
  const T = getT(dark);
  return (
    <div style={{ fontSize: 13, fontWeight: 600, color: T.muted,  marginBottom: 6 }}>{children}</div>
  );
};
