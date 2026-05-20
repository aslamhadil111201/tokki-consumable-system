// @ts-nocheck
import { useEffect } from "react";
import { trxApprovalStatus } from "../utils/helpers";

export function useNotifications({
  loggedIn, isAdmin, authToken, trx, trxFetchedRef, userRef,
  prevPendingCountRef, prevTrxStatusRef,
  setPendingApprovalCount, setToast, setNotifHistory, apiFetch
}) {
  // ── Poll pending approval count (admin only) ──────────────────
  useEffect(() => {
    if (!loggedIn || !isAdmin) return;
    let canceled = false;

    const pullPendingCount = async () => {
      try {
        const r = await apiFetch("/transactions?approvalStatus=pending&page=1&pageSize=1");
        if (!r.ok) return;
        const data = await r.json();
        if (canceled) return;
        const nextTotal = Array.isArray(data) ? data.length : Number(data?.total || data?.rows?.length || 0);
        if (Number.isFinite(nextTotal)) {
          if (prevPendingCountRef.current >= 0 && nextTotal > prevPendingCountRef.current) {
            const diff = nextTotal - prevPendingCountRef.current;
            setToast({ msg: `🔔 ${diff} permintaan baru menunggu approval`, type: "ok" });
            setTimeout(() => setToast(null), 4500);
            setNotifHistory(prev => {
              const next = [{ id: Date.now(), msg: `🔔 ${diff} permintaan baru menunggu approval`, type: "ok", ts: new Date().toISOString(), read: false }, ...prev].slice(0, 50);
              localStorage.setItem("wms_notif_history", JSON.stringify(next));
              return next;
            });
          }
          prevPendingCountRef.current = nextTotal;
          localStorage.setItem("wms_last_pending_count", String(nextTotal));
          setPendingApprovalCount(nextTotal);
        }
      } catch {}
    };

    pullPendingCount();
    const iv = window.setInterval(() => {
      if (document.visibilityState === "visible") pullPendingCount();
    }, 30000);

    return () => {
      canceled = true;
      window.clearInterval(iv);
    };
  }, [loggedIn, isAdmin, authToken]);

  // ── Operator: detect when own pending trx changes status ──────
  useEffect(() => {
    if (!loggedIn) return;
    if (!trxFetchedRef.current) return;
    const role = (userRef.current?.role || "").toLowerCase();
    if (role === "operator") {
      const prev = prevTrxStatusRef.current;
      const toasts = [];
      const newNotifs = [];
      trx.forEach(t => {
        const id = String(t.id);
        const prevS = prev[id];
        const currS = trxApprovalStatus(t);
        if (prevS === "pending" && currS === "approved") {
          const m = `✅ Permintaan ${t.taker || ""}${t.dept ? ` (${t.dept})` : ""}  telah di-approve`;
          toasts.push({ msg: m, type: "ok" });
          newNotifs.push({ id: Date.now() + Math.random(), msg: m, type: "ok", ts: new Date().toISOString(), read: false });
        } else if (prevS === "pending" && currS === "rejected") {
          const m = `⛔ Permintaan ${t.taker || ""}${t.dept ? ` (${t.dept})` : ""}  ditolak`;
          toasts.push({ msg: m, type: "err" });
          newNotifs.push({ id: Date.now() + Math.random(), msg: m, type: "err", ts: new Date().toISOString(), read: false });
        }
      });
      if (toasts.length > 0) {
        setToast({ msg: toasts[0].msg, type: toasts[0].type });
        setTimeout(() => setToast(null), 4000);
      }
      if (newNotifs.length > 0) {
        setNotifHistory(prev => {
          const next = [...newNotifs, ...prev].slice(0, 50);
          localStorage.setItem("wms_notif_history", JSON.stringify(next));
          return next;
        });
      }
    }
    const nextPrev = Object.fromEntries(trx.map(t => [String(t.id), trxApprovalStatus(t)]));
    prevTrxStatusRef.current = nextPrev;
    localStorage.setItem("wms_last_trx_status", JSON.stringify(nextPrev));
  }, [trx]);
}
