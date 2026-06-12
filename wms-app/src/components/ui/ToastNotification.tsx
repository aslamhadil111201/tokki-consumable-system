import { useEffect, useState } from "react";
import { useStore } from "../../store/useStore";

export function ToastNotification() {
  const toastMessage = useStore(s => s.toastMessage);
  const dark = useStore(s => s.dark);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (toastMessage) {
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [toastMessage]);

  if (!toastMessage) return null;

  const isErr = toastMessage.type === "err";

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        position: "fixed",
        bottom: 28,
        left: "50%",
        transform: `translateX(-50%) translateY(${visible ? "0" : "20px"})`,
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "13px 20px",
        borderRadius: 14,
        minWidth: 240,
        maxWidth: "min(420px, 92vw)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.28)",
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        fontSize: 13,
        fontWeight: 700,
        lineHeight: 1.4,
        letterSpacing: ".01em",
        opacity: visible ? 1 : 0,
        transition: "opacity .22s ease, transform .22s ease",
        background: isErr
          ? dark ? "rgba(30,8,8,0.97)" : "rgba(255,245,245,0.98)"
          : dark ? "rgba(3,20,12,0.97)" : "rgba(240,255,248,0.98)",
        border: isErr
          ? `1.5px solid ${dark ? "rgba(239,68,68,0.55)" : "rgba(220,38,38,0.35)"}`
          : `1.5px solid ${dark ? "rgba(16,185,129,0.55)" : "rgba(16,185,129,0.4)"}`,
        color: isErr
          ? dark ? "#fca5a5" : "#b91c1c"
          : dark ? "#6ee7b7" : "#065f46",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      {/* Icon */}
      <span style={{ fontSize: 17, flexShrink: 0 }}>
        {isErr ? "⚠️" : "✅"}
      </span>

      {/* Message */}
      <span style={{ flex: 1 }}>{toastMessage.msg}</span>
    </div>
  );
}
