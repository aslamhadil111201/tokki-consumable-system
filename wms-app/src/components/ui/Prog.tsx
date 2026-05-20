// @ts-nocheck
// ─── Prog & ProgBlocks Components ────────────────────────────────

export const Prog = ({pct, color}) => (
  <div style={{height:3,background:"rgba(128,128,128,0.15)",borderRadius:4,overflow:"hidden",marginTop:6}}>
    <div style={{height:"100%",width:`${Math.min(100,Math.max(0,pct))}%`,background:color,borderRadius:4,transition:"width .5s ease"}}/>
  </div>
);

export const ProgBlocks = ({pct, color}) => {
  const total = 14;
  const filled = Math.round(Math.min(100,Math.max(0,pct))/100*total);
  return (
    <div style={{display:"flex",gap:3,margin:"6px 0 4px"}}>
      {Array.from({length:total}).map((_,i) => (
        <div key={i} style={{flex:1,height:7,borderRadius:3,background:i<filled?color:"rgba(128,128,128,0.18)",transition:"background .3s"}}/>
      ))}
    </div>
  );
};
