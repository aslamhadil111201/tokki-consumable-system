// @ts-nocheck
import { useEffect } from "react";
import { IDLE_TIMEOUT_MS, IDLE_TIMEOUT_MINUTES } from "../constants/index";

export function useIdleTimer({ loggedIn, logout, setIdleWarning, setIdleCountdown, keepAliveRef,
  idleTimerRef, idleWarningTimerRef, idleCountdownRef }) {
  useEffect(() => {
    if (!loggedIn) {
      if (idleTimerRef.current) { window.clearTimeout(idleTimerRef.current); idleTimerRef.current = null; }
      if (idleWarningTimerRef.current) { window.clearTimeout(idleWarningTimerRef.current); idleWarningTimerRef.current = null; }
      if (idleCountdownRef.current) { window.clearInterval(idleCountdownRef.current); idleCountdownRef.current = null; }
      setIdleWarning(false);
      return;
    }

    const WARN_BEFORE_MS = Math.min(60_000, IDLE_TIMEOUT_MS - 1000);

    const clearAllTimers = () => {
      if (idleTimerRef.current) { window.clearTimeout(idleTimerRef.current); idleTimerRef.current = null; }
      if (idleWarningTimerRef.current) { window.clearTimeout(idleWarningTimerRef.current); idleWarningTimerRef.current = null; }
      if (idleCountdownRef.current) { window.clearInterval(idleCountdownRef.current); idleCountdownRef.current = null; }
    };

    const startLogoutCountdown = () => {
      const secs = Math.round(WARN_BEFORE_MS / 1000);
      setIdleCountdown(secs);
      setIdleWarning(true);
      idleCountdownRef.current = window.setInterval(() => {
        setIdleCountdown(prev => {
          if (prev <= 1) {
            window.clearInterval(idleCountdownRef.current);
            idleCountdownRef.current = null;
            logout(`Logout otomatis: tidak ada aktivitas selama ${IDLE_TIMEOUT_MINUTES} menit`);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    };

    const resetIdleTimer = () => {
      clearAllTimers();
      setIdleWarning(false);
      idleWarningTimerRef.current = window.setTimeout(startLogoutCountdown, IDLE_TIMEOUT_MS - WARN_BEFORE_MS);
    };

    keepAliveRef.current = resetIdleTimer;

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    resetIdleTimer();
    events.forEach(evt => window.addEventListener(evt, resetIdleTimer, { passive: true }));

    return () => {
      events.forEach(evt => window.removeEventListener(evt, resetIdleTimer));
      clearAllTimers();
    };
  }, [loggedIn, logout]);
}
