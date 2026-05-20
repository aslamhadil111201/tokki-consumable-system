// @ts-nocheck
// ─── UIIcon Component ────────────────────────────────────────────

export const UIIcon = ({name, size=14, color="currentColor"}) => {
  const p = {width:size,height:size,viewBox:"0 0 24 24",fill:"none",stroke:color,strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",style:{display:"block"}};
  if(name==="search") return <svg {...p}><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
  if(name==="plus") return <svg {...p}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
  if(name==="receive") return <svg {...p}><path d="M3 7h18"/><path d="M6 7V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2"/><rect x="4" y="7" width="16" height="13" rx="2"/><path d="M12 10v7"/><path d="M9 14l3 3 3-3"/></svg>;
  if(name==="filter") return <svg {...p}><polygon points="22 3 2 3 10 12 10 19 14 21 14 12 22 3"/></svg>;
  if(name==="check") return <svg {...p}><path d="M20 6 9 17l-5-5"/></svg>;
  if(name==="shield") return <svg {...p}><path d="M12 2L4 6v6c0 5.25 3.5 9.74 8 11 4.5-1.26 8-5.75 8-11V6z"/><path d="M9 12l2 2 4-4"/></svg>;
  if(name==="clock") return <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
  if(name==="alert") return <svg {...p}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
  if(name==="x") return <svg {...p}><circle cx="12" cy="12" r="9"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>;
  if(name==="boxes") return <svg {...p}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="7.5 4.21 12 6.81 16.5 4.21"/><polyline points="7.5 19.79 7.5 14.6 3 12"/><polyline points="21 12 16.5 14.6 16.5 19.79"/><polyline points="12 22.08 12 16.8 7.5 14.6"/><polyline points="12 16.8 16.5 14.6"/></svg>;
  if(name==="rotate") return <svg {...p}><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-9"/></svg>;
  return null;
};
