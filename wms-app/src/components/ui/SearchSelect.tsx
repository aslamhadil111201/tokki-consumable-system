// @ts-nocheck
import { useState, useRef, useEffect } from "react";
import { useStore } from "../../store/useStore";
import { getT } from "../../theme/tokens";

export const SearchSelect = ({ options, value, onChange, placeholder }) => {
  const { dark } = useStore();
  const T = getT(dark);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const filtered = options.filter(o => o.label.toLowerCase().includes(q.toLowerCase()));
  const selectedLabel = options.find(o => o.value === value)?.label || "";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input className="ifield"
        value={open ? q : selectedLabel}
        onChange={e => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => { setQ(""); setOpen(true); }}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && (
        <div style={{ position: "absolute", zIndex: 600, width: "100%", background: T.surfaceSolid, border: `1px solid ${T.border}`, borderRadius: 10, maxHeight: 210, overflowY: "auto", boxShadow: T.shadowCard, marginTop: 4 }}>
          {filtered.length === 0
            ? <div style={{ padding: "10px 13px", fontSize: 12, color: T.muted }}>Tidak ditemukan</div>
            : filtered.map((o, index) => (
              <div key={`${o.value}-${index}`}
                onMouseDown={e => { e.preventDefault(); if (!o.disabled) { onChange(o.value); setQ(""); setOpen(false); } }}
                style={{ padding: "9px 13px", fontSize: 13, color: o.disabled ? T.muted : o.value === value ? T.navActiveText : T.text, background: o.value === value ? T.navActive : "transparent", cursor: o.disabled ? "not-allowed" : "pointer", borderBottom: `1px solid ${T.border}`, transition: "background .12s", opacity: o.disabled ? 0.45 : 1 }}
                onMouseEnter={e => { if (!o.disabled && o.value !== value) e.currentTarget.style.background = T.surface; }}
                onMouseLeave={e => { e.currentTarget.style.background = o.value === value ? T.navActive : "transparent"; }}>
                {o.label}
              </div>
            ))}
        </div>
      )}
    </div>
  );
};
