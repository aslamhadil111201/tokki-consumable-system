// @ts-nocheck
import { useStore } from "../../store/useStore";

export const BusyOverlay = () => {
  const { loadingCount, loadingText, loggedIn } = useStore();
  const loading = loadingCount > 0;

  if (!loading || !loggedIn) return null;

  return (
    <div className="busy-overlay" role="status" aria-live="polite" aria-busy="true">
      <div className="busy-card">
        <div className="busy-spin" />
        <div className="busy-text">Mohon menunggu...</div>
        <div className="busy-sub">{loadingText}</div>
      </div>
    </div>
  );
};
