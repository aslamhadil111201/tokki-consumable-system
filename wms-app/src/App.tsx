/* eslint-disable @typescript-eslint/ban-ts-comment, react-hooks/set-state-in-effect, react-hooks/static-components, react-hooks/globals, react-hooks/exhaustive-deps */
// @ts-nocheck
import { useState, useRef, useEffect, useCallback } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const API = (
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? "http://localhost:3001/api" : "/api")
).replace(/\/$/, "");
const IDLE_TIMEOUT_MINUTES = Math.max(
  1,
  Number(import.meta.env.VITE_IDLE_TIMEOUT_MINUTES || 3),
);
const IDLE_TIMEOUT_MS = IDLE_TIMEOUT_MINUTES * 60 * 1000;
const CLIENT_BUILD_VERSION = String(import.meta.env.VITE_APP_VERSION || import.meta.env.VITE_GIT_SHA || "dev-local");
const CLIENT_MODE = import.meta.env.DEV ? "local" : "production";
const API_DISPLAY = (() => {
  try {
    return API.startsWith("http") ? new URL(API).host : "same-origin";
  } catch {
    return API;
  }
})();

// ─── DESIGN TOKENS (FIXED) ────────────────────────────────────────
const getT = (dark) => dark ? {
  bg:"#040d09", surface:"rgba(8,24,16,0.65)", surfaceSolid:"#071510",
  card:"rgba(10,32,20,0.72)", border:"rgba(16,185,129,0.14)", borderHover:"rgba(16,185,129,0.35)",
  text:"#ecfdf5", muted:"#6ee7b7", sub:"#a7f3d0",
  primary:"#10b981", primaryLight:"#34d399", primaryGlow:"rgba(16,185,129,0.35)",
  green:"#10b981", greenBg:"rgba(16,185,129,0.1)", greenBorder:"rgba(16,185,129,0.25)", greenText:"#6ee7b7",
  amber:"#f59e0b", amberBg:"rgba(245,158,11,0.1)", amberBorder:"rgba(245,158,11,0.25)", amberText:"#fcd34d",
  red:"#ef4444", redBg:"rgba(239,68,68,0.1)", redBorder:"rgba(239,68,68,0.25)", redText:"#fca5a5",
  inputBg:"rgba(4,13,9,0.7)", sidebarBg:"rgba(3,9,6,0.97)", topbarBg:"rgba(3,9,6,0.92)",
  navActive:"rgba(16,185,129,0.15)", navActiveBorder:"rgba(16,185,129,0.3)", navActiveText:"#34d399",
  shadowCard:"0 25px 60px rgba(0,0,0,0.45)", shadowSm:"0 8px 22px rgba(0,0,0,0.3)",
} : {
  bg:"#f6fef9", surface:"rgba(255,255,255,0.85)", surfaceSolid:"#ffffff",
  card:"#ffffff", border:"#d1fae5", borderHover:"#34d399",
  text:"#022c22", muted:"#4b5563", sub:"#1f2937",
  primary:"#059669", primaryLight:"#047857", primaryGlow:"rgba(5,150,105,0.25)",
  green:"#059669", greenBg:"#dcfce7", greenBorder:"#bbf7d0", greenText:"#166534",
  amber:"#b45309", amberBg:"#fef9c3", amberBorder:"#fef08a", amberText:"#854d0e",
  red:"#dc2626", redBg:"#fee2e2", redBorder:"#fecaca", redText:"#991b1b",
  inputBg:"#f9fafb", sidebarBg:"rgba(255,255,255,0.98)", topbarBg:"rgba(255,255,255,0.95)",
  navActive:"#d1fae5", navActiveBorder:"#6ee7b7", navActiveText:"#065f46",
  shadowCard:"0 10px 30px rgba(0,0,0,0.08)", shadowSm:"0 4px 12px rgba(0,0,0,0.05)",
};

let T = getT(true);
const gText = () => ({ color: T.primaryLight });

const CATS = ["Semua","APD","Abrasif","Cutting Tool","Industrial Gas","Kebersihan"];
const EXCEL_ICON=(<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:"block"}}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/><path d="M7 12l2.5 3L12 12l2.5 3L17 12" strokeWidth="1.8"/></svg>);
const PDF_ICON=(<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:"block"}}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h1.5a1.5 1.5 0 0 1 0 3H9v-3zm0 3v2"/><path d="M14 13v5m0 0h2m-2-3h1.5"/></svg>);
const NAV_ICONS={
  dashboard:(
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:"block"}}>
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  transaction:(
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:"block"}}>
      <circle cx="12" cy="12" r="10"/>
      <polyline points="16 12 12 8 8 12"/>
      <line x1="12" y1="16" x2="12" y2="8"/>
    </svg>
  ),
  stock:(
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:"block"}}>
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
      <line x1="3" y1="6" x2="21" y2="6"/>
      <path d="M16 10a4 4 0 0 1-8 0"/>
    </svg>
  ),
  history:(
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:"block"}}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
      <path d="M3 3v5h5"/>
      <path d="M12 7v5l4 2"/>
    </svg>
  ),
  report:(
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:"block"}}>
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  ),
};
const TABS = [
  {id:"dashboard",label:"Dashboard",icon:NAV_ICONS.dashboard},
  {id:"transaction",label:"Pengambilan",icon:NAV_ICONS.transaction},
  {id:"stock",label:"Stok Barang",icon:NAV_ICONS.stock},
  {id:"history",label:"Riwayat",icon:NAV_ICONS.history},
  {id:"report",label:"Laporan",icon:NAV_ICONS.report},
];
const ITEM_CATEGORIES = ["APD","Abrasif","Cutting Tool","Industrial Gas","Kebersihan"];
const MAX_STOCK_VALUE = 1000000;
const MAX_TEXT_LEN = 120;

const todayStr=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const nowTime=()=>new Date().toTimeString().slice(0,5);
const fmtDate=d=>d?new Date(d+"T00:00:00").toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"}):""; 
const todayFmt=()=>new Date().toLocaleDateString("id-ID",{weekday:"short",day:"2-digit",month:"short",year:"numeric"});
const fmtMoney=n=>`Rp ${Number(n||0).toLocaleString("id-ID")}`;
const isoDate=(d)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const clamp01=(n)=>Math.max(0,Math.min(1,Number(n)||0));
const trxApprovalStatus=(t)=>String(t?.approvalStatus||"approved").toLowerCase();
const isApprovedOutTrx=(t)=>trxApprovalStatus(t)==="approved";
const emptyForm=(overrides={})=>({taker:"",dept:"",workOrder:"",note:"",date:todayStr(),admin:"",cart:[],...overrides});
const emptyNewItem=()=>({name:"",itemCode:"",category:"APD",unit:"pcs",minStock:"",stock:"",hargaAwal:"",photo:null});
const emptyAddForm=(overrides={})=>({poNumber:"",doNumber:"",date:todayStr(),admin:"",itemId:"",qty:"",buyPrice:"",attachment:null,...overrides});
const RETUR_REASONS=["Sisa pemakaian","Kondisi masih baik","Kelebihan ambil","Tidak jadi dipakai"];
const emptyReturForm=()=>({employee:"",itemId:"",qty:"",reason:RETUR_REASONS[0],note:""});
const initials=(name="")=>String(name).split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]?.toUpperCase()||"").join("")||"NA";
const _AV_PAL=["#10b981","#6366f1","#f59e0b","#ef4444","#8b5cf6","#ec4899","#14b8a6","#f97316","#0ea5e9","#22c55e"];
const avatarColor=(name="")=>{let h=0;for(let i=0;i<name.length;i++)h=name.charCodeAt(i)+((h<<5)-h);return _AV_PAL[Math.abs(h)%_AV_PAL.length];};
const toSafeRows = (rows) => Array.isArray(rows) ? rows : (rows ? [rows] : []);
const csvEscape = (v) => {
  const s = String(v ?? "").replace(/"/g, '""');
  return /[",\n]/.test(s) ? `"${s}"` : s;
};
const csvText = (v) => `="${String(v ?? "").replace(/"/g, '""')}"`;
const fmtDateExcel = (d) => {
  if(!d) return "";
  const m = String(d).match(/(\d{4})-(\d{2})-(\d{2})/);
  if(m) return `${m[3]}/${m[2]}/${m[1]}`;
  return String(d);
};
const triggerDownload = (filename, content, mime) => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const pathToTab = (pathname = "") => {
  const p = String(pathname || "/").toLowerCase().replace(/\/+$/, "") || "/";
  if (p === "/" || p === "/dashboard" || p === "/dasboard" || p === "/dasbord") return "dashboard";
  if (p === "/login") return "login";
  if (p === "/riwayat" || p === "/history") return "history";
  if (p === "/laporan" || p === "/report") return "report";
  if (p === "/pengambilan" || p === "/transaction") return "transaction";
  if (p === "/stok" || p === "/stock") return "stock";
  return null;
};

const tabToPath = (tab = "") => ({
  login: "/Login",
  dashboard: "/Dasboard",
  transaction: "/Pengambilan",
  stock: "/Stok",
  history: "/Riwayat",
  report: "/Laporan",
}[tab] || "/Dasboard");

const stockStatusKey=it=>{
  const stock=Number(it?.stock||0);
  const minStock=Number(it?.minStock||0);
  if(stock===0) return "habis";
  if(stock<=minStock) return "menipis";
  if(minStock>0&&stock<=minStock*1.5) return "mendekati";
  return "aman";
};
const stockStatus=it=>{
  const key=stockStatusKey(it);
  if(key==="habis") return{bg:T.redBg,text:T.redText,border:T.redBorder,dot:T.red,label:"Habis",icon:"⊗"};
  if(key==="menipis") return{bg:T.amberBg,text:T.amberText,border:T.amberBorder,dot:T.amber,label:"Menipis",icon:"⚠"};
  if(key==="mendekati") return{bg:"#ffedd5",text:"#9a3412",border:"#fdba74",dot:"#f97316",label:"Mendekati",icon:"◷"};
  return{bg:T.greenBg,text:T.greenText,border:T.greenBorder,dot:T.green,label:"Aman",icon:"🛡"};
};
const catColor=cat=>({
  APD:{dot:"#10b981",bg:"rgba(16,185,129,0.1)",text:"#6ee7b7",border:"rgba(16,185,129,0.25)"},
  Abrasif:{dot:"#f59e0b",bg:"rgba(245,158,11,0.1)",text:"#fcd34d",border:"rgba(245,158,11,0.25)"},
  "Cutting Tool":{dot:"#3b82f6",bg:"rgba(59,130,246,0.1)",text:"#93c5fd",border:"rgba(59,130,246,0.25)"},
  "Industrial Gas":{dot:"#8b5cf6",bg:"rgba(139,92,246,0.1)",text:"#c4b5fd",border:"rgba(139,92,246,0.25)"},
  Kebersihan:{dot:"#ec4899",bg:"rgba(236,72,153,0.1)",text:"#f9a8d4",border:"rgba(236,72,153,0.25)"},
}[cat]||{dot:T.primary,bg:T.navActive,text:T.navActiveText,border:T.navActiveBorder});

// ─── MICRO COMPONENTS ─────────────────────────────────────────────
const Prog=({pct,color})=>(
  <div style={{height:3,background:"rgba(128,128,128,0.15)",borderRadius:4,overflow:"hidden",marginTop:6}}>
    <div style={{height:"100%",width:`${Math.min(100,Math.max(0,pct))}%`,background:color,borderRadius:4,transition:"width .5s ease"}}/>
  </div>
);
const ProgBlocks=({pct,color})=>{
  const total=14;const filled=Math.round(Math.min(100,Math.max(0,pct))/100*total);
  return(
    <div style={{display:"flex",gap:3,margin:"6px 0 4px"}}>
      {Array.from({length:total}).map((_,i)=>(
        <div key={i} style={{flex:1,height:7,borderRadius:3,background:i<filled?color:"rgba(128,128,128,0.18)",transition:"background .3s"}}/>
      ))}
    </div>
  );
};
const Badge=({children,bg,color,border,style})=>(
  <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"3px 10px",borderRadius:20,background:bg||T.surface,color:color||T.muted,border:`1px solid ${border||T.border}`,fontSize:10,fontWeight:700,whiteSpace:"nowrap",letterSpacing:".05em",...style}}>{children}</span>
);
const FL=({children})=>(
  <div style={{fontSize:10,fontWeight:800,color:T.muted,letterSpacing:".12em",textTransform:"uppercase",marginBottom:6}}>{children}</div>
);
const BtnP=({children,style,...r})=>(
  <button {...r} style={{
    display:"inline-flex",alignItems:"center",justifyContent:"center",gap:7,
    background:`linear-gradient(135deg,${T.primary},${T.primaryLight})`,
    color:"white",border:"none",borderRadius:12,fontFamily:"'Plus Jakarta Sans',sans-serif",
    fontSize:13,fontWeight:700,padding:"10px 20px",cursor:"pointer",
    boxShadow:`0 4px 14px ${T.primaryGlow}`,transition:"all .2s ease",...style}}
    onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-1px)";e.currentTarget.style.boxShadow=`0 8px 24px ${T.primaryGlow}`;}}
    onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow=`0 4px 14px ${T.primaryGlow}`;}}>
    {children}
  </button>
);
const BtnG=({children,style,...r})=>(
  <button {...r} style={{
    display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6,
    background:T.surface,color:T.muted,border:`1px solid ${T.border}`,
    borderRadius:12,fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:13,fontWeight:600,
    padding:"10px 18px",cursor:"pointer",transition:"all .2s ease",...style}}
    onMouseEnter={e=>{e.currentTarget.style.borderColor=T.borderHover;e.currentTarget.style.color=T.text;}}
    onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.color=T.muted;}}>
    {children}
  </button>
);

const SearchSelect=({options,value,onChange,placeholder})=>{
  const [q,setQ]=useState("");
  const [open,setOpen]=useState(false);
  const ref=useRef(null);
  useEffect(()=>{
    const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};
    document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);
  },[]);
  const filtered=options.filter(o=>o.label.toLowerCase().includes(q.toLowerCase()));
  const selectedLabel=options.find(o=>o.value===value)?.label||"";
  return(
    <div ref={ref} style={{position:"relative"}}>
      <input className="ifield"
        value={open?q:selectedLabel}
        onChange={e=>{setQ(e.target.value);setOpen(true);}}
        onFocus={()=>{setQ("");setOpen(true);}}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open&&(
        <div style={{position:"absolute",zIndex:600,width:"100%",background:T.surfaceSolid,border:`1px solid ${T.border}`,borderRadius:10,maxHeight:210,overflowY:"auto",boxShadow:T.shadowCard,marginTop:4}}>
          {filtered.length===0
            ?<div style={{padding:"10px 13px",fontSize:12,color:T.muted}}>Tidak ditemukan</div>
            :filtered.map(o=>(
              <div key={o.value}
                onMouseDown={e=>{e.preventDefault();if(!o.disabled){onChange(o.value);setQ("");setOpen(false);}}}
                style={{padding:"9px 13px",fontSize:13,color:o.disabled?T.muted:o.value===value?T.navActiveText:T.text,background:o.value===value?T.navActive:"transparent",cursor:o.disabled?"not-allowed":"pointer",borderBottom:`1px solid ${T.border}`,transition:"background .12s",opacity:o.disabled?.45:1}}
                onMouseEnter={e=>{if(!o.disabled&&o.value!==value)e.currentTarget.style.background=T.surface;}}
                onMouseLeave={e=>{e.currentTarget.style.background=o.value===value?T.navActive:"transparent";}}>
                {o.label}
              </div>
            ))}
        </div>
      )}
    </div>
  );
};

// ─── APP ──────────────────────────────────────────────────────────
export default function App(){
  const [dark,setDark]=useState(()=>{try{return localStorage.getItem("wms_dark")==="false"?false:true;}catch{return true;}});
  T=getT(dark);
  const toggleTheme=useCallback(()=>{
    setDark(prev=>{
      const next=!prev;
      try{localStorage.setItem("wms_dark",String(next));}catch{}
      return next;
    });
  },[]);
  const [tab,setTab]=useState("login");
  const [items,setItems]=useState([]);
  const [trx,setTrx]=useState([]);
  const [admins,setAdmins]=useState([]);
  const [departments,setDepartments]=useState([]);
  const [employees,setEmployees]=useState([]);
  const [workOrders,setWorkOrders]=useState([]);
  const [loadingCount,setLoadingCount]=useState(0);
  const [loadingText,setLoadingText]=useState("Sedang memproses data");
  const [catF,setCatF]=useState("Semua");
  const [stockStatusF,setStockStatusF]=useState("Semua");
  const [searchQ,setSearchQ]=useState("");
  const [trxDate,setTrxDate]=useState("");
  const [showModal,setShowModal]=useState(false);
  const [showAdd,setShowAdd]=useState(false);
  const [showNewItem,setShowNewItem]=useState(false);
  const [toast,setToast]=useState(null);
  const [notif,setNotif]=useState(false);
  const [form,setForm]=useState(emptyForm());
  const [newItemForm,setNewItemForm]=useState(emptyNewItem());
  const [addForm,setAddForm]=useState(emptyAddForm());
  const [sidebar,setSidebar]=useState(false);
  const [loggedIn,setLoggedIn]=useState(()=>Boolean(localStorage.getItem("wms_token")));
  const [authToken,setAuthToken]=useState(()=>localStorage.getItem("wms_token")||"");
  const [loginForm,setLoginForm]=useState({username:"",password:""});
  const [showLoginPassword,setShowLoginPassword]=useState(false);
  const [pickerItem,setPickerItem]=useState("");
  const [pickerQty,setPickerQty]=useState("");
  const [user,setUser]=useState(()=>{
    try{return JSON.parse(localStorage.getItem("wms_user")||"null");}
    catch{return null;}
  });
  const [showEdit,setShowEdit]=useState(false);
  const [editItem,setEditItem]=useState(null);
  const [receives,setReceives]=useState([]);
  const [allHistory,setAllHistory]=useState([]);
  const [historyTab,setHistoryTab]=useState("out");
  const [historyQuery,setHistoryQuery]=useState("");
  const [historyApprovalStatus,setHistoryApprovalStatus]=useState("all");
  const [addFormDragOver,setAddFormDragOver]=useState(false);
  const [attachPreview,setAttachPreview]=useState<{blobUrl:string;data:string;name:string;mimeType:string;receiveId:number}|null>(null);
  const [historyFrom,setHistoryFrom]=useState("");
  const [historyTo,setHistoryTo]=useState("");
  const [historyOutPage,setHistoryOutPage]=useState(1);
  const [historyInPage,setHistoryInPage]=useState(1);
  const [historyPageSize,setHistoryPageSize]=useState(6);
  const [auditRows,setAuditRows]=useState([]);
  const [auditTotal,setAuditTotal]=useState(0);
  const [auditPage,setAuditPage]=useState(1);
  const [auditPageSize,setAuditPageSize]=useState(8);
  const [auditActor,setAuditActor]=useState("");
  const [auditAction,setAuditAction]=useState("");
  const [auditFrom,setAuditFrom]=useState("");
  const [auditTo,setAuditTo]=useState("");
  const [pendingApprovalCount,setPendingApprovalCount]=useState(0);
  const [approvalBusyKey,setApprovalBusyKey]=useState("");
  const [slaTick,setSlaTick]=useState(0);
  const [autoRejectHours,setAutoRejectHours]=useState(24);
  const [autoRejectInput,setAutoRejectInput]=useState("24");
  const [autoRejectSaving,setAutoRejectSaving]=useState(false);
  const [notifHistory,setNotifHistory]=useState<any[]>(()=>{try{return JSON.parse(localStorage.getItem("wms_notif_history")||"[]");}catch{return [];}});
  const [notifTab,setNotifTab]=useState("notif");
  const prevPendingCountRef=useRef(-1);
  const prevTrxStatusRef=useRef<Record<string,string>>({});
  const isFirstTrxFetchRef=useRef(true);
  const userRef=useRef(user);
  const [sidebarCollapsed,setSidebarCollapsed]=useState(false);
  const [idleWarning,setIdleWarning]=useState(false);
  const [idleCountdown,setIdleCountdown]=useState(60);
  const [reportPeriod,setReportPeriod]=useState("month");
  const [dashDonutSegIdx,setDashDonutSegIdx]=useState(-1);
  const [dashTrendPointIdx,setDashTrendPointIdx]=useState(-1);
  const [reportProjectMode,setReportProjectMode]=useState<"unit"|"rp">("unit");
  const [trendFilter,setTrendFilter]=useState<"all"|"up"|"down"|"spike"|"cur"|"prev">("all");
  const [returns,setReturns]=useState([]);
  const [showRetur,setShowRetur]=useState(false);
  const [returForm,setReturForm]=useState(emptyReturForm());
  const [returSubTab,setReturSubTab]=useState("log");
  const notifRef=useRef(null);
  const restoreInputRef=useRef(null);
  const desiredTabRef=useRef("dashboard");
  const idleTimerRef=useRef(null);
  const idleWarningTimerRef=useRef(null);
  const idleCountdownRef=useRef(null);
  const keepAliveRef=useRef(null);
  const loading=loadingCount>0;
  const isAdmin = (user?.role || "").toLowerCase() === "admin";
  const isOperator = (user?.role || "").toLowerCase() === "operator";
  const canManage = isAdmin || isOperator;
  const visibleTabs = (isAdmin||isOperator) ? TABS : TABS.filter(t=>t.id!=="history");

  const logout=useCallback((message="")=>{
    const safeMessage = typeof message === "string" ? message : "";
    setLoggedIn(false);
    setUser(null);
    setAuthToken("");
    setLoadingCount(0);
    setLoadingText("Sedang memproses data");
    localStorage.removeItem("wms_user");
    localStorage.removeItem("wms_token");
    setTab("login");
    setItems([]);
    setTrx([]);
    window.history.replaceState(null,"","/Login");
    if(safeMessage){
      setToast({msg:safeMessage,type:"err"});
      setTimeout(()=>setToast(null),3200);
    }
  },[]);

  const apiFetch=async(path,options={})=>{
    const headers={...(options.headers||{})};
    if(authToken)headers.Authorization=`Bearer ${authToken}`;
    const r=await fetch(`${API}${path}`,{...options,headers});
    if(r.status===401){
      logout("Sesi login berakhir, silakan login lagi");
      throw new Error("Sesi login berakhir, silakan login lagi");
    }
    return r;
  };

  useEffect(()=>{
    if(authToken)localStorage.setItem("wms_token",authToken);
    else localStorage.removeItem("wms_token");
  },[authToken]);

  useEffect(()=>{
    const applyPathTab = () => {
      const mapped = pathToTab(window.location.pathname);
      if (!mapped) return;
      if (mapped !== "login") desiredTabRef.current = mapped;
      setTab(mapped);
    };

    applyPathTab();
    window.addEventListener("popstate", applyPathTab);
    return () => window.removeEventListener("popstate", applyPathTab);
  },[]);

  useEffect(()=>{
    const currentPath = window.location.pathname;
    const mapped = pathToTab(currentPath);

    if (!loggedIn) {
      if (tab !== "login") setTab("login");
      if (mapped !== "login") window.history.replaceState(null, "", "/Login");
      return;
    }

    const safeTab = tab === "login" ? (desiredTabRef.current || "dashboard") : tab;
    if (safeTab !== "login") desiredTabRef.current = safeTab;
    const nextPath = tabToPath(safeTab);
    if (currentPath !== nextPath) window.history.replaceState(null, "", nextPath);
  },[loggedIn,tab]);

  const withLoading=async(task,message="Sedang memproses data")=>{
    setLoadingText(message);
    setLoadingCount(c=>c+1);
    try{
      return await task();
    }finally{
      setLoadingCount(c=>Math.max(0,c-1));
    }
  };

  const toast$=(msg,type="ok")=>{setToast({msg,type});setTimeout(()=>setToast(null),3200);};

  // ── FETCH SEMUA DATA ─────────────────────────────────────────────
  const fetchAll=async()=>withLoading(async()=>{
    try{
      const [it,tr,adm,dep,emp,wo,rcv,allMovements,ret,cfg]=await Promise.all([
        apiFetch("/items").then(r=>r.json()),
        apiFetch("/transactions").then(r=>r.json()),
        apiFetch("/admins").then(r=>r.json()),
        apiFetch("/departments").then(r=>r.json()),
        apiFetch("/employees").then(r=>r.json()),
        apiFetch("/work-orders").then(r=>r.json()),
        apiFetch("/receives").then(r=>r.json()),
        apiFetch("/transactions?scope=all").then(r=>r.json()),
        apiFetch("/returns").then(r=>r.json()),
        apiFetch("/settings").then(r=>r.json()).catch(()=>({autoRejectHours:24})),
      ]);
      setItems(it); setTrx(tr); setAdmins(adm); setDepartments(dep); setEmployees(emp); setWorkOrders(wo); setReceives(rcv); setAllHistory(allMovements); setReturns(Array.isArray(ret)?ret:[]);
      const arh=Math.max(1,Number(cfg?.autoRejectHours)||24);
      setAutoRejectHours(arh);
      setAutoRejectInput(String(arh));
    }catch(e){toast$(e?.message||"Gagal terhubung ke server","err");}
  },"Sedang memuat data");

  useEffect(()=>{if(loggedIn)fetchAll();},[loggedIn]);
  useEffect(()=>{
    if(!loggedIn)return;
    const onVisible=()=>{if(document.visibilityState==="visible")fetchAll();};
    document.addEventListener("visibilitychange",onVisible);
    return()=>document.removeEventListener("visibilitychange",onVisible);
  },[loggedIn]);
  useEffect(()=>{
    if(!visibleTabs.some(t=>t.id===tab)) setTab("dashboard");
  },[tab,visibleTabs]);

  const openStockWithFilter=(status="Semua")=>{
    setStockStatusF(status);
    setTab("stock");
  };
  const resetStockFilters=()=>{
    setCatF("Semua");
    setStockStatusF("Semua");
    setSearchQ("");
  };

  const lowStock=items.filter(i=>i.stock<=i.minStock);
  const approvedOutTrx=trx.filter(isApprovedOutTrx);
  const pendingApprovalTrx=trx.filter(t=>trxApprovalStatus(t)==="pending");
  const todayTrx=approvedOutTrx.filter(t=>t.date===todayStr());
  const todayUnits=todayTrx.reduce((a,t)=>a+t.items.reduce((b,i)=>b+i.qty,0),0);
  const totalOut=approvedOutTrx.reduce((a,t)=>a+t.items.reduce((b,i)=>b+i.qty,0),0);
  const totalIn=receives.reduce((a,r)=>a+r.qty,0);
  const itemMap=Object.fromEntries(items.map(i=>[Number(i.id),i]));
  // ── Dashboard insight data ───────────────────────────────────────
  const dashStockAman=items.filter(i=>Number(i.stock)>Number(i.minStock)).length;
  const dashStockMenipis=items.filter(i=>Number(i.stock)>0&&Number(i.stock)<=Number(i.minStock)).length;
  const dashStockHabis=items.filter(i=>Number(i.stock)===0).length;
  const dashTotalStokPcs=items.reduce((a,i)=>a+Number(i.stock||0),0);
  const dashTotalNilaiStok=items.reduce((a,it)=>a+(Number(it.stock||0)*Number(it.averageCost||it.lastPrice||0)),0);
  const _d7s=new Date();_d7s.setDate(_d7s.getDate()-6);const dashLast7Start=isoDate(_d7s);
  const dashLast7Days=Array.from({length:7}).map((_,idx)=>{const d=new Date();d.setDate(d.getDate()-(6-idx));return isoDate(d);});
  const dashLast7OutQty=dashLast7Days.map(day=>approvedOutTrx.filter(t=>t.date===day).reduce((a,t)=>a+(t.items||[]).reduce((b,i)=>b+Number(i.qty||0),0),0));
  const dashItemUsageMap={};
  approvedOutTrx.filter(t=>t.date>=dashLast7Start).forEach(t=>(t.items||[]).forEach(it=>{const k=String(it.itemName||"");dashItemUsageMap[k]=(dashItemUsageMap[k]||0)+Number(it.qty||0);}));
  const dashTopEntry=Object.entries(dashItemUsageMap).sort((a,b)=>b[1]-a[1])[0];
  const dashTopItemName=dashTopEntry?.[0]||"-";
  const dashTopItemQty=dashTopEntry?.[1]||0;
  const dashRecentReceives=[...receives].sort((a,b)=>Number(b.id)-Number(a.id)).slice(0,4);
  const statusFilterKey={Aman:"aman",Mendekati:"mendekati",Menipis:"menipis",Habis:"habis"}[stockStatusF]||"";
  const hasActiveStockFilters=catF!=="Semua"||stockStatusF!=="Semua"||searchQ.trim()!=="";
  const filtItems=items
    .filter(i=>(catF==="Semua"||i.category===catF)&&i.name.toLowerCase().includes(searchQ.toLowerCase()))
    .filter(i=>!statusFilterKey||stockStatusKey(i)===statusFilterKey);
  const filtMenipisCount=filtItems.filter(i=>stockStatusKey(i)==="menipis").length;
  const filtHabisCount=filtItems.filter(i=>stockStatusKey(i)==="habis").length;
  const filtTrx=[...trx].reverse().filter(t=>!trxDate||t.date===trxDate);
  const dateMatch=(d)=>{
    if(!d) return true;
    if(historyFrom&&d<historyFrom) return false;
    if(historyTo&&d>historyTo) return false;
    return true;
  };
  const q=historyQuery.trim().toLowerCase();
  const filteredOut=[...trx].filter(t=>dateMatch(t.date)&&(q===""||[t.taker,t.dept,t.admin,t.workOrder,t.note,...(t.items||[]).map(i=>i.itemName)].filter(Boolean).join(" ").toLowerCase().includes(q))).sort((a,b)=>b.id-a.id);
  const filteredOutByApproval=filteredOut.filter(t=>{
    if(historyApprovalStatus==="all") return true;
    return trxApprovalStatus(t)===historyApprovalStatus;
  });
  const filteredPending=filteredOut.filter(t=>trxApprovalStatus(t)==="pending");
  const filteredIn=[...receives].filter(r=>dateMatch(r.date)&&(q===""||[r.itemName,r.poNumber,r.doNumber,r.admin].filter(Boolean).join(" ").toLowerCase().includes(q))).sort((a,b)=>b.id-a.id);
  const filteredAll=[...allHistory].filter(t=>dateMatch(t.date)&&(q===""||[
    t.type,
    t.movementType,
    t.taker,
    t.dept,
    t.admin,
    t.workOrder,
    t.note,
    t.itemName,
    t.poNumber,
    t.doNumber,
    ...(t.items||[]).map(i=>i.itemName),
  ].filter(Boolean).join(" ").toLowerCase().includes(q))).sort((a,b)=>b.id-a.id);
  const outTotalPages=Math.max(1,Math.ceil(filteredOutByApproval.length/historyPageSize));
  const inTotalPages=Math.max(1,Math.ceil(filteredIn.length/historyPageSize));
  const allTotalPages=Math.max(1,Math.ceil(filteredAll.length/historyPageSize));
  const pagedOut=filteredOutByApproval.slice((historyOutPage-1)*historyPageSize,historyOutPage*historyPageSize);
  const pagedIn=filteredIn.slice((historyInPage-1)*historyPageSize,historyInPage*historyPageSize);
  const pagedAll=filteredAll.slice((historyOutPage-1)*historyPageSize,historyOutPage*historyPageSize);
  const auditTotalPages=Math.max(1,Math.ceil(auditTotal/auditPageSize));

  const reportRange=(()=>{
    const now=new Date();
    const end=isoDate(now);
    if(reportPeriod==="week"){
      const s=new Date(now);
      s.setDate(now.getDate()-6);
      return {start:isoDate(s),end,label:"7 Hari Terakhir"};
    }
    if(reportPeriod==="year"){
      const s=new Date(now.getFullYear(),0,1);
      return {start:isoDate(s),end,label:`Tahun ${now.getFullYear()}`};
    }
    const s=new Date(now.getFullYear(),now.getMonth(),1);
    return {start:isoDate(s),end,label:"Bulan Berjalan"};
  })();
  const inReportRange=(d)=>Boolean(d)&&d>=reportRange.start&&d<=reportRange.end;
  const reportOut=approvedOutTrx.filter(t=>inReportRange(t.date));
  const reportIn=receives.filter(r=>inReportRange(r.date));
  const reportTotalOutUnits=reportOut.reduce((a,t)=>a+toSafeRows(t.items).reduce((b,i)=>b+Number(i.qty||0),0),0);
  const reportTotalInUnits=reportIn.reduce((a,r)=>a+Number(r.qty||0),0);
  const reportOutValue=reportOut.reduce((a,t)=>a+toSafeRows(t.items).reduce((b,i)=>{
    const ref=itemMap[Number(i.itemId||0)];
    const estPrice=Number(ref?.averageCost||ref?.lastPrice||0);
    return b+Number(i.qty||0)*estPrice;
  },0),0);
  const reportInValue=reportIn.reduce((a,r)=>a+Number(r.totalCostIn??(Number(r.qty||0)*Number(r.buyPrice||0))),0);
  const reportEstimatedValue=reportOutValue+reportInValue;

  const reportTxnSeries=(()=>{
    const now=new Date();
    const outMap={};
    const inMap={};
    reportOut.forEach(t=>{outMap[t.date]=(outMap[t.date]||0)+1;});
    reportIn.forEach(r=>{inMap[r.date]=(inMap[r.date]||0)+1;});

    if(reportPeriod==="year"){
      return Array.from({length:12}).map((_,idx)=>{
        const key=`${now.getFullYear()}-${String(idx+1).padStart(2,"0")}`;
        const out=Object.keys(outMap).reduce((acc,d)=>acc+(String(d).startsWith(key)?Number(outMap[d]||0):0),0);
        const inn=Object.keys(inMap).reduce((acc,d)=>acc+(String(d).startsWith(key)?Number(inMap[d]||0):0),0);
        return {
          key,
          label:new Date(now.getFullYear(),idx,1).toLocaleDateString("id-ID",{month:"short"}),
          out,
          in:inn,
        };
      });
    }

    const days=reportPeriod==="week"?7:(new Date(now.getFullYear(),now.getMonth()+1,0).getDate());
    const first=reportPeriod==="week"?new Date(now.getFullYear(),now.getMonth(),now.getDate()-6):new Date(now.getFullYear(),now.getMonth(),1);
    return Array.from({length:days}).map((_,idx)=>{
      const d=new Date(first.getFullYear(),first.getMonth(),first.getDate()+idx);
      const key=isoDate(d);
      return {
        key,
        label:d.toLocaleDateString("id-ID",{day:"2-digit",month:"short"}),
        out:Number(outMap[key]||0),
        in:Number(inMap[key]||0),
      };
    }).filter(row=>row.key<=todayStr());
  })();
  const reportTxnMax=Math.max(1,...reportTxnSeries.map(s=>Math.max(s.out,s.in)));
  const reportTxnTitle=reportPeriod==="week"
    ?"Bar Chart Transaksi Harian (7 Hari Terakhir)"
    :reportPeriod==="month"
      ?"Bar Chart Transaksi Harian (Bulan Berjalan)"
      :`Bar Chart Transaksi Bulanan (Tahun ${new Date().getFullYear()})`;
  const reportTrendTitle="Tren Penggunaan per Item";
  const reportTrendCurrentLabel=reportPeriod==="week"
    ?"7 Hari Terakhir"
    :reportPeriod==="month"
      ?"Bulan Berjalan"
      :"Tahun Berjalan";
  const reportTrendPrevLabel=reportPeriod==="week"
    ?"7 Hari Sebelumnya"
    :reportPeriod==="month"
      ?"Bulan Sebelumnya"
      :"Tahun Sebelumnya";
  const reportTrendMaxVisibleRows=5;
  const reportTrendRowHeightPx=78;
  const reportTrendScrollMaxHeight=reportTrendMaxVisibleRows*reportTrendRowHeightPx;

  const reportRangeDays=(()=>{
    const start=new Date(reportRange.start);
    const end=new Date(reportRange.end);
    return Math.max(1,Math.floor((end.getTime()-start.getTime())/86400000)+1);
  })();
  const reportPrevRange=(()=>{
    const start=new Date(reportRange.start);
    const prevEnd=new Date(start);
    prevEnd.setDate(prevEnd.getDate()-1);
    const prevStart=new Date(prevEnd);
    prevStart.setDate(prevStart.getDate()-(reportRangeDays-1));
    return {start:isoDate(prevStart),end:isoDate(prevEnd)};
  })();
  const inPrevReportRange=(d)=>Boolean(d)&&d>=reportPrevRange.start&&d<=reportPrevRange.end;
  const reportOutPrev=approvedOutTrx.filter(t=>inPrevReportRange(t.date));
  const reportTrendSubtitle=`${reportTrendCurrentLabel} vs ${reportTrendPrevLabel}`;

  const reportTopItems=(()=>{
    const map={};
    reportOut.forEach(t=>toSafeRows(t.items).forEach(it=>{
      const key=it.itemName||`Item ${it.itemId||""}`;
      map[key]=(map[key]||0)+Number(it.qty||0);
    }));
    const rows=Object.entries(map).map(([name,total])=>({name,total:Number(total||0)})).sort((a,b)=>b.total-a.total).slice(0,5);
    const max=Math.max(1,...rows.map(r=>r.total));
    return rows.map(r=>({...r,pct:Math.round((r.total/max)*100)}));
  })();

  const reportDeptStack=(()=>{
    const byDept={};
    reportOut.forEach(t=>{
      const dept=t.dept||"Tanpa Dept";
      if(!byDept[dept]) byDept[dept]={};
      toSafeRows(t.items).forEach(it=>{
        const ref=itemMap[Number(it.itemId||0)];
        const cat=ref?.category||"Lainnya";
        byDept[dept][cat]=(byDept[dept][cat]||0)+Number(it.qty||0);
      });
    });
    return Object.entries(byDept)
      .map(([dept,cats])=>{
        const total=Object.values(cats).reduce((a,v)=>a+Number(v||0),0);
        return {dept,total,cats};
      })
      .sort((a,b)=>b.total-a.total)
      .slice(0,8);
  })();

  const reportDeptCats=(()=>{
    const found=new Set();
    reportDeptStack.forEach(row=>Object.keys(row.cats||{}).forEach(c=>found.add(c)));
    const ordered=[...ITEM_CATEGORIES,"Lainnya"].filter(c=>found.has(c));
    const extra=[...found].filter(c=>!ordered.includes(c));
    return [...ordered,...extra];
  })();
  const reportCatPalette={
    APD:"#10b981",
    Abrasif:"#f59e0b",
    "Cutting Tool":"#3b82f6",
    "Industrial Gas":"#8b5cf6",
    Kebersihan:"#ec4899",
    Lainnya:"#64748b",
  };

  const reportProjectUsage=(()=>{
    const map:Record<string,number>={};
    reportOut.forEach(t=>{
      const key=t.workOrder?String(t.workOrder).trim():null;
      if(!key) return;
      toSafeRows(t.items).forEach(it=>{
        map[key]=(map[key]||0)+Number(it.qty||0);
      });
    });
    const rows=Object.entries(map).map(([name,total])=>({name,total})).sort((a,b)=>b.total-a.total).slice(0,8);
    const max=Math.max(1,...rows.map(r=>r.total));
    return rows.map(r=>({...r,pct:Math.round((r.total/max)*100)}));
  })();

  // project by Rp value
  const reportProjectByRp=(()=>{
    const map:Record<string,number>={};
    reportOut.forEach(t=>{
      const key=t.workOrder?String(t.workOrder).trim():null;
      if(!key) return;
      toSafeRows(t.items).forEach(it=>{
        const ref=itemMap[Number(it.itemId||0)];
        const price=Number(ref?.averageCost||ref?.lastPrice||0);
        map[key]=(map[key]||0)+Number(it.qty||0)*price;
      });
    });
    const rows=Object.entries(map).map(([name,total])=>({name,total})).sort((a,b)=>b.total-a.total).slice(0,8);
    const max=Math.max(1,...rows.map(r=>r.total));
    return rows.map(r=>({...r,pct:Math.round((r.total/max)*100)}));
  })();

  // tren per item: periode ini vs periode sebelumnya (durasi sama)
  const reportMonthlyTrend=(()=>{
    const curMap:Record<string,number>={};
    const prevMap:Record<string,number>={};
    reportOut.forEach(t=>{
      toSafeRows(t.items).forEach(it=>{
        const key=it.itemName||`Item ${it.itemId||""}`;
        curMap[key]=(curMap[key]||0)+Number(it.qty||0);
      });
    });
    reportOutPrev.forEach(t=>{
      toSafeRows(t.items).forEach(it=>{
        const key=it.itemName||`Item ${it.itemId||""}`;
        prevMap[key]=(prevMap[key]||0)+Number(it.qty||0);
      });
    });
    const allKeys=new Set([...Object.keys(curMap),...Object.keys(prevMap)]);
    const rows=[...allKeys].map(name=>{
      const cur=curMap[name]||0;
      const prev=prevMap[name]||0;
      const pctChange=prev===0?(cur>0?999:0):Math.round((cur-prev)/prev*100);
      return {name,cur,prev,pctChange};
    }).filter(r=>r.cur>0||r.prev>0).sort((a,b)=>b.cur-a.cur).slice(0,8);
    const maxBar=Math.max(1,...rows.map(r=>Math.max(r.cur,r.prev)));
    return rows.map(r=>({...r,curPct:Math.round(r.cur/maxBar*100),prevPct:Math.round(r.prev/maxBar*100),isSpike:r.pctChange>=50&&r.cur>0}));
  })();

  const trendSpikeCount=reportMonthlyTrend.filter(r=>r.isSpike).length;

  useEffect(()=>{document.body.style.background=T.bg;document.body.style.transition="background .4s,color .3s";},[dark]);
  useEffect(()=>{setHistoryOutPage(1);setHistoryInPage(1);},[historyQuery,historyFrom,historyTo,historyPageSize,historyApprovalStatus]);
  useEffect(()=>{if(historyOutPage>(historyTab==="all"?allTotalPages:outTotalPages))setHistoryOutPage(historyTab==="all"?allTotalPages:outTotalPages);},[historyOutPage,outTotalPages,allTotalPages,historyTab]);
  useEffect(()=>{if(historyInPage>inTotalPages)setHistoryInPage(inTotalPages);},[historyInPage,inTotalPages]);
  useEffect(()=>{setAuditPage(1);},[auditActor,auditAction,auditFrom,auditTo,auditPageSize]);

  useEffect(()=>{
    if(!loggedIn||!isAdmin||tab!=="history"||historyTab!=="audit") return;
    let canceled=false;
    (async()=>{
      try{
        const sp=new URLSearchParams({page:String(auditPage),pageSize:String(auditPageSize)});
        if(auditActor.trim()) sp.set("actor",auditActor.trim());
        if(auditAction) sp.set("action",auditAction);
        if(auditFrom) sp.set("from",auditFrom);
        if(auditTo) sp.set("to",auditTo);
        const r=await apiFetch(`/audit-logs?${sp.toString()}`);
        if(!r.ok) throw new Error("Gagal memuat audit log");
        const data=await r.json();
        if(canceled) return;
        setAuditRows(Array.isArray(data.rows)?data.rows:[]);
        setAuditTotal(Number(data.total||0));
      }catch(e){if(!canceled) toast$(e?.message||"Gagal memuat audit log","err");}
    })();
    return()=>{canceled=true;};
  },[loggedIn,isAdmin,tab,historyTab,auditPage,auditPageSize,auditActor,auditAction,auditFrom,auditTo]);

  useEffect(()=>{
    if(!isAdmin){
      setPendingApprovalCount(0);
      return;
    }
    setPendingApprovalCount(pendingApprovalTrx.length);
  },[isAdmin,pendingApprovalTrx.length]);

  useEffect(()=>{
    if(!loggedIn||!isAdmin) return;
    let canceled=false;

    const pullPendingCount=async()=>{
      try{
        const r=await apiFetch("/transactions?approvalStatus=pending&page=1&pageSize=1");
        if(!r.ok) return;
        const data=await r.json();
        if(canceled) return;
        const nextTotal=Number(data?.total);
        if(Number.isFinite(nextTotal)){
          if(prevPendingCountRef.current>=0&&nextTotal>prevPendingCountRef.current){
            const diff=nextTotal-prevPendingCountRef.current;
            setToast({msg:`🔔 ${diff} permintaan baru menunggu approval`,type:"ok"});
            setTimeout(()=>setToast(null),4500);
            setNotifHistory(prev=>{
              const next=[{id:Date.now(),msg:`🔔 ${diff} permintaan baru menunggu approval`,type:"ok",ts:new Date().toISOString(),read:false},...prev].slice(0,50);
              localStorage.setItem("wms_notif_history",JSON.stringify(next));
              return next;
            });
          }
          prevPendingCountRef.current=nextTotal;
          setPendingApprovalCount(nextTotal);
          return;
        }
        if(Array.isArray(data?.rows)){
          setPendingApprovalCount(data.rows.length);
          return;
        }
        if(Array.isArray(data)){
          setPendingApprovalCount(data.length);
        }
      }catch{}
    };

    pullPendingCount();
    const iv=window.setInterval(()=>{
      if(document.visibilityState==="visible") pullPendingCount();
    },30000);

    return()=>{
      canceled=true;
      window.clearInterval(iv);
    };
  },[loggedIn,isAdmin,authToken]);

  useEffect(()=>{
    const h=e=>{if(notifRef.current&&!notifRef.current.contains(e.target))setNotif(false);};
    document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);
  },[]);
  const login=async()=>withLoading(async()=>{
    try{
      const r=await fetch(`${API}/login`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(loginForm)});
      if(!r.ok){const e=await r.json();toast$(e.error||"Login gagal","err");return;}
      const {token,user:u}=await r.json();
      setAuthToken(token||"");
      setLoggedIn(true);
      setUser(u);
      localStorage.setItem("wms_token",token||"");
      localStorage.setItem("wms_user",JSON.stringify(u));
      setTab(desiredTabRef.current||"dashboard");
      toast$("Selamat datang ✓");
    }catch{toast$("Server tidak bisa dihubungi","err");}
  },"Sedang login");

  useEffect(()=>{
    if(!loggedIn){
      if(idleTimerRef.current){window.clearTimeout(idleTimerRef.current);idleTimerRef.current=null;}
      if(idleWarningTimerRef.current){window.clearTimeout(idleWarningTimerRef.current);idleWarningTimerRef.current=null;}
      if(idleCountdownRef.current){window.clearInterval(idleCountdownRef.current);idleCountdownRef.current=null;}
      setIdleWarning(false);
      return;
    }

    const WARN_BEFORE_MS=Math.min(60_000,IDLE_TIMEOUT_MS-1000);

    const clearAllTimers=()=>{
      if(idleTimerRef.current){window.clearTimeout(idleTimerRef.current);idleTimerRef.current=null;}
      if(idleWarningTimerRef.current){window.clearTimeout(idleWarningTimerRef.current);idleWarningTimerRef.current=null;}
      if(idleCountdownRef.current){window.clearInterval(idleCountdownRef.current);idleCountdownRef.current=null;}
    };

    const startLogoutCountdown=()=>{
      const secs=Math.round(WARN_BEFORE_MS/1000);
      setIdleCountdown(secs);
      setIdleWarning(true);
      idleCountdownRef.current=window.setInterval(()=>{
        setIdleCountdown(prev=>{
          if(prev<=1){
            window.clearInterval(idleCountdownRef.current);
            idleCountdownRef.current=null;
            logout(`Logout otomatis: tidak ada aktivitas selama ${IDLE_TIMEOUT_MINUTES} menit`);
            return 0;
          }
          return prev-1;
        });
      },1000);
    };

    const resetIdleTimer=()=>{
      clearAllTimers();
      setIdleWarning(false);
      idleWarningTimerRef.current=window.setTimeout(startLogoutCountdown,IDLE_TIMEOUT_MS-WARN_BEFORE_MS);
    };

    keepAliveRef.current=resetIdleTimer;

    const events=["mousemove","keydown","click","scroll","touchstart"];
    resetIdleTimer();
    events.forEach(evt=>window.addEventListener(evt,resetIdleTimer,{passive:true}));

    return()=>{
      events.forEach(evt=>window.removeEventListener(evt,resetIdleTimer));
      clearAllTimers();
    };
  },[loggedIn,logout]);

  // ── SYNC userRef ──────────────────────────────────────────────────
  useEffect(()=>{userRef.current=user;},[user]);

  // ── SLA TICK (every 30s) for pending card age display ─────────────
  useEffect(()=>{
    if(!loggedIn) return;
    const iv=window.setInterval(()=>setSlaTick(c=>c+1),30000);
    return()=>window.clearInterval(iv);
  },[loggedIn]);

  // ── OPERATOR NOTIFICATION: detect when own pending trx changes status ──
  useEffect(()=>{
    if(!loggedIn) return;
    if(isFirstTrxFetchRef.current){
      isFirstTrxFetchRef.current=false;
      prevTrxStatusRef.current=Object.fromEntries(trx.map((t:any)=>[String(t.id),trxApprovalStatus(t)]));
      return;
    }
    const role=(userRef.current?.role||"").toLowerCase();
    if(role==="operator"){
      const prev=prevTrxStatusRef.current;
      trx.forEach((t:any)=>{
        const id=String(t.id);
        const prevS=prev[id];
        const currS=trxApprovalStatus(t);
        if(prevS==="pending"&&currS==="approved"){
          const m=`✅ Permintaan ${t.taker||""}${t.dept?` (${t.dept})`:""}  telah di-approve`;
          setToast({msg:m,type:"ok"});setTimeout(()=>setToast(null),4000);
          setNotifHistory(prev=>{const next=[{id:Date.now(),msg:m,type:"ok",ts:new Date().toISOString(),read:false},...prev].slice(0,50);localStorage.setItem("wms_notif_history",JSON.stringify(next));return next;});
        } else if(prevS==="pending"&&currS==="rejected"){
          const m=`⛔ Permintaan ${t.taker||""}${t.dept?` (${t.dept})`:""}  ditolak`;
          setToast({msg:m,type:"err"});setTimeout(()=>setToast(null),4000);
          setNotifHistory(prev=>{const next=[{id:Date.now(),msg:m,type:"err",ts:new Date().toISOString(),read:false},...prev].slice(0,50);localStorage.setItem("wms_notif_history",JSON.stringify(next));return next;});
        }
      });
      prevTrxStatusRef.current=Object.fromEntries(trx.map((t:any)=>[String(t.id),trxApprovalStatus(t)]));
    }
  },[trx]);

  const addToCart=()=>{
    if(!pickerItem||!pickerQty||+pickerQty<1){toast$("Pilih barang dan isi jumlah","err");return;}
    const it=items.find(i=>i.id===+pickerItem);if(!it){toast$("Barang tidak ditemukan","err");return;}
    const inCart=form.cart.reduce((a,c)=>c.itemId===+pickerItem?a+c.qty:a,0);
    if(inCart+ +pickerQty>it.stock){toast$(`Stok tidak cukup — sisa ${it.stock-inCart} ${it.unit}`,"err");return;}
    const ex=form.cart.find(c=>c.itemId===+pickerItem);
    if(ex)setForm(f=>({...f,cart:f.cart.map(c=>c.itemId===+pickerItem?{...c,qty:c.qty+ +pickerQty}:c)}));
    else setForm(f=>({...f,cart:[...f.cart,{itemId:+pickerItem,qty:+pickerQty}]}));
    setPickerItem("");setPickerQty("");
  };
  const removeCart=id=>setForm(f=>({...f,cart:f.cart.filter(c=>c.itemId!==id)}));
  const submitTrx=async()=>{
    if(!form.taker||!form.dept||!form.admin){toast$("Lengkapi data pengambil & admin","err");return;}
    if(!form.cart.length){toast$("Keranjang masih kosong","err");return;}
    const payload={taker:form.taker,dept:form.dept,workOrder:form.workOrder,note:form.note,date:form.date,time:nowTime(),admin:form.admin,
      items:form.cart.map(c=>{const it=items.find(i=>i.id===c.itemId);return{itemId:c.itemId,itemName:it.name,qty:c.qty,unit:it.unit};})};
    await withLoading(async()=>{
      try{
        const r=await apiFetch("/transactions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
        let data:any=null;
        try{data=await r.json();}catch{data=null;}
        if(!r.ok)throw new Error(data?.error||"Gagal menyimpan transaksi");
        if(String(data?.approvalStatus||"").toLowerCase()==="pending") toast$(`Transaksi ${form.taker} masuk antrian approval admin`,`err`);
        else toast$(`Transaksi ${form.taker} tercatat`);
        setForm(emptyForm());setPickerItem("");setPickerQty("");setShowModal(false);
        await fetchAll();
      }catch(e){toast$(e?.message||"Gagal menyimpan transaksi","err");}
    },"Sedang menyimpan transaksi");
  };
  const openQuickOut=item=>{
    setForm(prev=>{
      const existing=prev.cart.find(c=>c.itemId===Number(item.id));
      return emptyForm({
        ...prev,
        cart: existing ? prev.cart : [...prev.cart,{itemId:Number(item.id),qty:1}],
      });
    });
    setPickerItem(String(item.id));
    setPickerQty("1");
    setShowModal(true);
  };
  const openQuickIn=item=>{
    setAddForm(emptyAddForm({itemId:String(item.id),buyPrice:item.lastPrice?String(item.lastPrice):"",qty:"1"}));
    setShowAdd(true);
  };
  const submitAdd=async()=>{
    if(!canManage){toast$("Hanya admin/operator yang boleh menambah stok","err");return;}
    if(!addForm.itemId||!addForm.qty||+addForm.qty<1||!addForm.admin){toast$("Lengkapi semua field wajib","err");return;}
    const effectiveBuyPrice=Number(addForm.buyPrice);
    if(!Number.isFinite(effectiveBuyPrice)||effectiveBuyPrice<0){toast$("Harga beli wajib angka >= 0","err");return;}
    await withLoading(async()=>{
      try{
        const r=await apiFetch("/receives",{method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({itemId:+addForm.itemId,qty:+addForm.qty,buyPrice:effectiveBuyPrice,poNumber:addForm.poNumber,doNumber:addForm.doNumber,date:addForm.date,admin:addForm.admin,attachment:addForm.attachment||null})});
        if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e?.error||"error");}
        setAddForm(emptyAddForm());setShowAdd(false);
        toast$("Stok berhasil ditambahkan ✓");
        await fetchAll();
      }catch(err:any){toast$(err?.message||"Gagal menyimpan penerimaan","err");}
    },"Sedang menyimpan penerimaan");
  };
  const fetchReceiveAttachment=async(receiveId:number)=>{
    await withLoading(async()=>{
      try{
        const r=await apiFetch(`/receives/${receiveId}`);
        if(!r.ok)throw new Error();
        const doc=await r.json();
        if(!doc.attachment){toast$("Tidak ada lampiran","err");return;}
        const mimeMatch=doc.attachment.match(/^data:([^;]+);/);
        const mimeType=mimeMatch?mimeMatch[1]:"application/octet-stream";
        const name=`lampiran-penerimaan-${receiveId}.${mimeType==="application/pdf"?"pdf":mimeType==="image/png"?"png":"jpg"}`;
        // konvert base64 → Blob URL agar bisa ditampilkan di semua browser
        const base64=doc.attachment.split(",")[1];
        const bytes=atob(base64);
        const arr=new Uint8Array(bytes.length);
        for(let i=0;i<bytes.length;i++)arr[i]=bytes.charCodeAt(i);
        const blob=new Blob([arr],{type:mimeType});
        const blobUrl=URL.createObjectURL(blob);
        setAttachPreview({blobUrl,data:doc.attachment,name,mimeType,receiveId});
      }catch{toast$("Gagal memuat lampiran","err");}
    },"Memuat lampiran");
  };
  const submitRetur=async()=>{
    const empName=String(returForm.employee||"").trim();
    const itemId=Number(returForm.itemId);
    const qty=Number(returForm.qty);
    if(!empName){toast$("Nama karyawan wajib diisi","err");return;}
    if(!employees.some((emp:any)=>String(emp?.name||"").trim().toLowerCase()===empName.toLowerCase())){toast$("Pilih nama karyawan dari database","err");return;}
    if(!itemId){toast$("Pilih barang terlebih dahulu","err");return;}
    if(!Number.isInteger(qty)||qty<=0){toast$("Jumlah harus bilangan bulat > 0","err");return;}
    await withLoading(async()=>{
      const r=await apiFetch("/returns",{method:"POST",body:JSON.stringify({employee:empName,itemId,qty,reason:returForm.reason,note:String(returForm.note||"").trim(),date:todayStr(),time:nowTime()})});
      if(!r.ok){const e=await r.json().catch(()=>({}));toast$(e.error||"Gagal menyimpan retur","err");return;}
      toast$("Retur berhasil dicatat, stok telah diperbarui");
      setShowRetur(false);
      setReturForm(emptyReturForm());
      fetchAll();
    },"Menyimpan retur...");
  };
  const submitNewItem=async()=>{
    if(!canManage){toast$("Hanya admin/operator yang boleh menambah item","err");return;}
    const name = String(newItemForm.name || "").trim();
    const itemCode = String(newItemForm.itemCode || "").trim();
    const unit = String(newItemForm.unit || "").trim();
    const stock = Number(newItemForm.stock);
    const minStock = Number(newItemForm.minStock);
    const hargaAwal = newItemForm.hargaAwal==="" ? 0 : Number(newItemForm.hargaAwal);

    if(!name||!newItemForm.category||!unit){toast$("Nama, kategori, dan satuan wajib diisi","err");return;}
    if(!ITEM_CATEGORIES.includes(newItemForm.category)){toast$("Kategori tidak valid","err");return;}
    if(name.length<3||name.length>MAX_TEXT_LEN){toast$("Nama barang harus 3-120 karakter","err");return;}
    if(itemCode.length>40){toast$("Item kode maksimal 40 karakter","err");return;}
    if(unit.length<1||unit.length>20){toast$("Satuan harus 1-20 karakter","err");return;}
    if(newItemForm.stock===""||newItemForm.minStock===""){toast$("Stok awal dan min stok wajib diisi","err");return;}
    if(!Number.isInteger(stock)||!Number.isInteger(minStock)){toast$("Stok harus bilangan bulat","err");return;}
    if(stock<0||minStock<0){toast$("Nilai stok tidak boleh negatif","err");return;}
    if(stock>MAX_STOCK_VALUE||minStock>MAX_STOCK_VALUE){toast$(`Stok maksimal ${MAX_STOCK_VALUE.toLocaleString("id-ID")}`,"err");return;}
    if(isNaN(hargaAwal)||hargaAwal<0){toast$("Harga awal tidak boleh negatif","err");return;}
    await withLoading(async()=>{
      try{
        const payload={
          name,
          itemCode,
          category:newItemForm.category,
          unit,
          stock,
          minStock,
          hargaAwal,
          averageCost:hargaAwal,
          lastPrice:hargaAwal,
          totalValue:hargaAwal*stock,
          photo:newItemForm.photo||null,
        };
        const r=await apiFetch("/items",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
        if(!r.ok){
          if(r.status===413) throw new Error("Foto terlalu besar untuk diproses server");
          let msg="";
          try{const e=await r.json();msg=e?.error||"";}catch{msg="";}
          if(msg) throw new Error(msg);
          throw new Error("Gagal menambah item baru");
        }
        setShowNewItem(false);
        setNewItemForm(emptyNewItem());
        toast$("Item baru berhasil ditambahkan ✓");
        await fetchAll();
      }catch(e){toast$(e?.message||"Gagal menambah item baru","err");}
    },"Sedang menambahkan item baru");
  };
  const submitEdit=async()=>{
    if(!isAdmin){toast$("Hanya admin yang boleh mengubah item","err");return;}
    if(!editItem?.name||!editItem?.category){toast$("Nama dan kategori wajib diisi","err");return;}
    await withLoading(async()=>{
      try{
        const r=await apiFetch(`/items/${editItem.id}`,{method:"PUT",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({name:editItem.name,category:editItem.category,photo:editItem.photo||null})});
        if(!r.ok){
          if(r.status===413) throw new Error("Foto terlalu besar untuk diproses server");
          let msg="";
          try{const e=await r.json();msg=e?.error||"";}catch{msg="";}
          throw new Error(msg||"Gagal memperbarui item");
        }
        setShowEdit(false);setEditItem(null);
        toast$("Item berhasil diperbarui ✓");
        await fetchAll();
      }catch(e){toast$(e?.message||"Gagal memperbarui item","err");}
    },"Sedang memperbarui item");
  };

  const deleteTransaction=async(id)=>{
    if(!isAdmin){toast$("Hanya admin yang boleh menghapus transaksi","err");return;}
    if(!window.confirm("Hapus transaksi ini?")) return;
    await withLoading(async()=>{
      try{
        const r=await apiFetch(`/transactions/${id}`,{method:"DELETE"});
        if(!r.ok) throw new Error("Gagal menghapus transaksi");
        toast$("Transaksi dihapus");
        await fetchAll();
      }catch(e){toast$(e?.message||"Gagal menghapus transaksi","err");}
    },"Sedang menghapus transaksi");
  };

    const processTransactionApproval=async(id,action)=>{
      if(!isAdmin){toast$("Hanya admin yang boleh approval transaksi","err");return;}
      const actionLabel=action==="approve"?"approve":"reject";
      const busyKey=`${id}:${actionLabel}`;
      if(approvalBusyKey) return;
      const yes=window.confirm(actionLabel==="approve"?"Approve transaksi ini?":"Reject transaksi ini?");
      if(!yes) return;
      const note="";
      setApprovalBusyKey(busyKey);
      try{
        await withLoading(async()=>{
          try{
            const r=await apiFetch(`/transactions/${id}/approval`,{
              method:"PATCH",
              headers:{"Content-Type":"application/json"},
              body:JSON.stringify({action:actionLabel,note:String(note||"").trim()}),
            });
            const data=await r.json().catch(()=>null);
            if(!r.ok){
              const rawMessage=String(data?.error||"");
              const rawLower=rawMessage.toLowerCase();
              let message=rawMessage||"Gagal memproses approval";
              if(r.status===403) message="Akses ditolak: hanya admin yang boleh approval";
              else if(r.status===404) message="Transaksi tidak ditemukan";
              else if(r.status===409) message="Data transaksi berubah, silakan refresh lalu coba lagi";
              else if(r.status===400){
                if(rawLower.includes("bukan antrian")) message="Transaksi ini sudah diproses, silakan refresh data";
                else if(rawLower.includes("stok")) message="Approval gagal: stok tidak cukup saat diproses";
                else message=rawMessage||"Permintaan approval tidak valid";
              }
              throw new Error(message);
            }

            const prevTrx=trx.find(tx=>Number(tx?.id)===Number(id));
            const wasPending=trxApprovalStatus(prevTrx)==="pending";
            const fallbackUpdated={
              approvalStatus: actionLabel==="approve"?"approved":"rejected",
              approvalNote: note,
              approvedBy: String(user?.username||prevTrx?.approvedBy||""),
              approvedAt: new Date().toISOString(),
            };
            const updatedTrx=(data&&typeof data==="object")?data:fallbackUpdated;

            setTrx(prev=>prev.map(tx=>Number(tx?.id)===Number(id)?{...tx,...updatedTrx}:tx));
            setAllHistory(prev=>prev.map(row=>(
              String(row?.type||"out").toLowerCase()==="out"&&Number(row?.id)===Number(id)
                ? {...row,...updatedTrx}
                : row
            )));

            if(actionLabel==="approve"&&wasPending&&Array.isArray(prevTrx?.items)){
              const qtyByItemId=(prevTrx.items||[]).reduce((acc,line)=>{
                const itemId=Number(line?.itemId);
                if(!Number.isInteger(itemId)||itemId<=0) return acc;
                acc[itemId]=(acc[itemId]||0)+Number(line?.qty||0);
                return acc;
              },{} as Record<number,number>);

              setItems(prev=>prev.map(it=>{
                const dec=Number(qtyByItemId[Number(it?.id)]||0);
                if(dec<=0) return it;
                const nextStock=Math.max(0,Number(it?.stock||0)-dec);
                const avg=Number(it?.averageCost??it?.lastPrice??0);
                return {...it,stock:nextStock,totalValue:Math.round(nextStock*avg*100)/100};
              }));
            }

            if(wasPending) setPendingApprovalCount(c=>Math.max(0,c-1));
            toast$(actionLabel==="approve"?"Transaksi berhasil di-approve":"Transaksi ditolak");
            fetchAll();
          }catch(e){toast$(e?.message||"Gagal memproses approval","err");}
        },actionLabel==="approve"?"Sedang meng-approve transaksi":"Sedang menolak transaksi");
      }finally{
        setApprovalBusyKey("");
      }
    };

  const deleteReceive=async(id)=>{
    if(!isAdmin){toast$("Hanya admin yang boleh menghapus riwayat penerimaan","err");return;}
    if(!window.confirm("Hapus riwayat penerimaan ini?")) return;
    await withLoading(async()=>{
      try{
        const r=await apiFetch(`/receives/${id}`,{method:"DELETE"});
        if(!r.ok) throw new Error("Gagal menghapus riwayat");
        toast$("Riwayat penerimaan dihapus");
        await fetchAll();
      }catch(e){toast$(e?.message||"Gagal menghapus riwayat","err");}
    },"Sedang menghapus riwayat penerimaan");
  };

  const resetDummyData=async()=>{
    if(!isAdmin){toast$("Hanya admin yang boleh reset data dummy","err");return;}
    if(!window.confirm("Reset data dummy sekarang? Data transaksi, penerimaan, stok, dan master akan dikembalikan ke seed awal.")) return;
    await withLoading(async()=>{
      try{
        const r=await apiFetch("/admin/reset-dummy",{method:"POST"});
        if(!r.ok){
          let msg="Gagal reset data dummy";
          try{const e=await r.json();msg=e?.error||msg;}catch{msg="Gagal reset data dummy";}
          throw new Error(msg);
        }
        toast$("Reset data dummy berhasil ✓");
        await fetchAll();
      }catch(e){toast$(e?.message||"Gagal reset data dummy","err");}
    },"Sedang mereset data dummy");
  };

  const downloadBackupData=async()=>{
    if(!isAdmin){toast$("Hanya admin yang boleh backup data","err");return;}
    await withLoading(async()=>{
      try{
        const r=await apiFetch("/admin/backup");
        if(!r.ok) throw new Error("Gagal membuat backup");
        const backup=await r.json();
        const stamp=new Date().toISOString().replace(/[:.]/g,"-");
        triggerDownload(`wms-backup-${stamp}.json`,JSON.stringify(backup,null,2),"application/json;charset=utf-8;");
        toast$("Backup data berhasil diunduh ✓");
      }catch(e){toast$(e?.message||"Gagal backup data","err");}
    },"Sedang menyiapkan file backup");
  };

  const restoreBackupData=async(e)=>{
    if(!isAdmin){toast$("Hanya admin yang boleh restore data","err");return;}
    const file=e.target.files?.[0];
    e.target.value="";
    if(!file) return;

    try{
      const txt=await file.text();
      const parsed=JSON.parse(txt);
      const yes=window.confirm("Restore backup akan menimpa data saat ini. Lanjutkan?");
      if(!yes) return;

      await withLoading(async()=>{
        const r=await apiFetch("/admin/restore",{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify(parsed),
        });
        if(!r.ok){
          let msg="Gagal restore backup";
          try{const er=await r.json();msg=er?.error||msg;}catch{msg="Gagal restore backup";}
          throw new Error(msg);
        }
        toast$("Restore backup berhasil ✓");
        await fetchAll();
      },"Sedang memulihkan data backup");
    }catch(err){
      if(err?.name==="SyntaxError") toast$("File backup tidak valid (JSON rusak)","err");
      else toast$(err?.message||"Gagal restore backup","err");
    }
  };

  const reportPeriodLabel = () => {
    if(historyFrom&&historyTo) return `${fmtDate(historyFrom)} - ${fmtDate(historyTo)}`;
    if(historyFrom) return `>= ${fmtDate(historyFrom)}`;
    if(historyTo) return `<= ${fmtDate(historyTo)}`;
    return "Semua Periode";
  };

  const approvalMetaChips = (row:any) => {
    const status=trxApprovalStatus(row);
    if(status==="pending") return null;
    const approvedAtText=row?.approvedAt?new Date(row.approvedAt).toLocaleString("id-ID"):"";
    const approvedBy=String(row?.approvedBy||"").trim();
    const note=String(row?.approvalNote||"").trim();
    const reason=String(row?.approvalReason||"").trim();
    if(!approvedBy&&!approvedAtText&&!note&&!reason) return null;
    return (
      <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:4}}>
        {approvedBy&&<Badge bg={T.navActive} color={T.navActiveText} border={T.navActiveBorder}>👤 {approvedBy}</Badge>}
        {approvedAtText&&<Badge bg={T.surface} color={T.muted} border={T.border}>🕒 {approvedAtText}</Badge>}
        {note&&<Badge bg={T.surface} color={T.muted} border={T.border}>📝 {note}</Badge>}
        {reason&&<Badge bg={T.amberBg} color={T.amberText} border={T.amberBorder}>Alasan: {reason}</Badge>}
      </div>
    );
  };

  // ── SLA helper: compute age + urgency of a pending transaction ────
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const getSlaInfo=(t:any,_tick:number)=>{
    // t.id is a unix timestamp in ms (used as primary key)
    const createdMs=t.createdAt?new Date(t.createdAt).getTime():Number(t.id)||0;
    if(!createdMs||createdMs>Date.now()+60000) return{label:"",urgency:"normal" as const,ageMin:0,remainingMin:null as number|null,remainingLabel:""};
    const ageMs=Date.now()-createdMs;
    const ageMin=Math.floor(ageMs/60000);
    let label="";
    if(ageMin<1) label="baru saja";
    else if(ageMin<60) label=`${ageMin} mnt`;
    else{const h=Math.floor(ageMin/60);const m=ageMin%60;label=m>0?`${h}j ${m}m`:`${h} jam`;}
    const urgency=ageMin>=30?"critical":ageMin>=15?"warning":"normal";
    const totalMin=autoRejectHours*60;
    const remainingMin=Math.max(0,totalMin-ageMin);
    let remainingLabel="";
    if(remainingMin<=0) remainingLabel="segera di-reject";
    else if(remainingMin<60) remainingLabel=`${remainingMin} mnt lagi`;
    else{const rh=Math.floor(remainingMin/60);const rm=remainingMin%60;remainingLabel=rm>0?`${rh}j ${rm}m lagi`:`${rh} jam lagi`;}
    return{label,urgency,ageMin,remainingMin,remainingLabel};
  };

  // ── Save auto-reject setting ──────────────────────────────────────
  const saveAutoRejectSetting=async()=>{
    const h=parseInt(autoRejectInput,10);
    if(!Number.isFinite(h)||h<1||h>720){toast$("Masukkan jam antara 1–720","err");return;}
    setAutoRejectSaving(true);
    try{
      const r=await apiFetch("/settings",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({autoRejectHours:h})});
      if(!r.ok){const e=await r.json().catch(()=>({}));toast$(e?.error||"Gagal simpan setting","err");return;}
      const d=await r.json();
      const arh=Math.max(1,Number(d?.autoRejectHours)||h);
      setAutoRejectHours(arh);setAutoRejectInput(String(arh));
      toast$(`Auto-reject diset ke ${arh} jam`,"ok");
    }catch(e:any){toast$(e?.message||"Gagal simpan setting","err");}
    finally{setAutoRejectSaving(false);}
  };

  const exportTransactionsExcel=()=>{
    const source=filteredOut;
    const unitTotal=source.reduce((acc,t)=>acc+toSafeRows(t.items).reduce((x,it)=>x+Number(it.qty||0),0),0);
    const rows=[
      ["TOKKI Consumable System"],
      ["Laporan Riwayat Pengambilan"],
      [`Periode`,reportPeriodLabel()],
      [`Dibuat`,`${todayFmt()} ${nowTime()}`],
      [`Total Data`,source.length],
      [`Total Unit`,unitTotal],
      [],
      ["ID","Tanggal","Waktu","Pengambil","Section","Project","Admin","Item","Qty","Unit","Keterangan"],
      ...toSafeRows(source).flatMap(t=>toSafeRows(t.items).map(it=>[
        csvText(t.id),fmtDateExcel(t.date),t.time,t.taker,t.dept,t.workOrder||"",t.admin||"",it.itemName,it.qty,it.unit,t.note||"",
      ])),
    ];
    const csv="\uFEFF"+rows.map(r=>r.map(v=>typeof v==="string"&&v.startsWith("=")?v:csvEscape(v)).join(",")).join("\n");
    triggerDownload(`riwayat-pengambilan-${todayStr()}.csv`,csv,"text/csv;charset=utf-8;");
    toast$("Export Excel (CSV) pengambilan berhasil");
  };

  const exportReceivesExcel=()=>{
    const source=filteredIn;
    const unitTotal=source.reduce((a,r)=>a+Number(r.qty||0),0);
    const rows=[
      ["TOKKI Consumable System"],
      ["Laporan Riwayat Penerimaan"],
      [`Periode`,reportPeriodLabel()],
      [`Dibuat`,`${todayFmt()} ${nowTime()}`],
      [`Total Data`,source.length],
      [`Total Unit`,unitTotal],
      [],
      ["ID","Tanggal","Waktu","Item","Qty","Unit","PO","DO","Admin"],
      ...toSafeRows(source).map(r=>[
        csvText(r.id),fmtDateExcel(r.date),r.time,r.itemName,r.qty,r.unit,r.poNumber||"",r.doNumber||"",r.admin||"",
      ]),
    ];
    const csv="\uFEFF"+rows.map(r=>r.map(v=>typeof v==="string"&&v.startsWith("=")?v:csvEscape(v)).join(",")).join("\n");
    triggerDownload(`riwayat-penerimaan-${todayStr()}.csv`,csv,"text/csv;charset=utf-8;");
    toast$("Export Excel (CSV) penerimaan berhasil");
  };

  const downloadPdfTable=({fileName,title,subtitle,headers,rows})=>{
    const doc=new jsPDF({orientation:"landscape",unit:"pt",format:"a4"});
    doc.setFont("helvetica","bold");
    doc.setFontSize(14);
    doc.text(String(title||"Laporan"),40,32);
    if(subtitle){
      doc.setFont("helvetica","normal");
      doc.setFontSize(10);
      doc.text(String(subtitle),40,50);
    }
    autoTable(doc,{
      startY:subtitle?62:46,
      head:[headers.map(h=>String(h??""))],
      body:rows.map(r=>toSafeRows(r).map(c=>String(c??""))),
      styles:{font:"helvetica",fontSize:8,cellPadding:4,overflow:"linebreak"},
      headStyles:{fillColor:[16,185,129],textColor:[255,255,255],fontStyle:"bold"},
      margin:{left:40,right:40,top:40,bottom:30},
      theme:"grid",
    });
    doc.save(fileName||`laporan-${todayStr()}.pdf`);
  };

  const exportTransactionsPdf=()=>{
    const source=filteredOut;
    const unitTotal=source.reduce((acc,t)=>acc+toSafeRows(t.items).reduce((x,it)=>x+Number(it.qty||0),0),0);
    const rows=toSafeRows(source).flatMap(t=>toSafeRows(t.items).map(it=>[
      t.id,t.date,t.time,t.taker,t.dept,t.workOrder||"",t.admin||"",it.itemName,`${it.qty} ${it.unit}`,t.note||"",
    ]));
    downloadPdfTable({
      fileName:`riwayat-pengambilan-${todayStr()}.pdf`,
      title:`Riwayat Pengambilan - ${todayFmt()}`,
      subtitle:`Periode: ${reportPeriodLabel()} | Total data: ${source.length} | Total unit: ${unitTotal}`,
      headers:["ID","Tanggal","Waktu","Pengambil","Section","Project","Admin","Item","Qty","Ket"],
      rows,
    });
    toast$("Export PDF pengambilan berhasil");
  };

  const exportReceivesPdf=()=>{
    const source=filteredIn;
    const unitTotal=source.reduce((a,r)=>a+Number(r.qty||0),0);
    const rows=toSafeRows(source).map(r=>[
      r.id,r.date,r.time,r.itemName,`${r.qty} ${r.unit}`,r.poNumber||"",r.doNumber||"",r.admin||"",
    ]);
    downloadPdfTable({
      fileName:`riwayat-penerimaan-${todayStr()}.pdf`,
      title:`Riwayat Penerimaan - ${todayFmt()}`,
      subtitle:`Periode: ${reportPeriodLabel()} | Total data: ${source.length} | Total unit: ${unitTotal}`,
      headers:["ID","Tanggal","Waktu","Item","Qty","PO","DO","Admin"],
      rows,
    });
    toast$("Export PDF penerimaan berhasil");
  };

  // ── EXPORT LAPORAN APPROVAL ────────────────────────────────────────
  const approvalReportSource=trx.filter((t:any)=>trxApprovalStatus(t)!=="approved"||true); // semua out trx (pending, approved, rejected)
  const fmtSlaDuration=(createdMs:number,resolvedMs:number)=>{
    if(!createdMs||!resolvedMs||resolvedMs<createdMs) return "-";
    const min=Math.floor((resolvedMs-createdMs)/60000);
    if(min<1) return "<1 mnt";
    if(min<60) return `${min} mnt`;
    const h=Math.floor(min/60);const m=min%60;
    return m>0?`${h}j ${m}m`:`${h} jam`;
  };
  const approvalReportRows=toSafeRows(approvalReportSource).flatMap((t:any)=>{
    const status=trxApprovalStatus(t);
    const createdMs=Number(t.id)||0;
    const resolvedMs=t.approvedAt?new Date(t.approvedAt).getTime():0;
    const slaDur=fmtSlaDuration(createdMs,resolvedMs);
    return toSafeRows(t.items).map((it:any)=>({
      id:t.id,
      date:t.date,
      time:t.time||"-",
      taker:t.taker||"-",
      dept:t.dept||"-",
      workOrder:t.workOrder||"-",
      admin:t.admin||"-",
      itemName:it.itemName||"-",
      qty:it.qty,
      unit:it.unit||"-",
      status:status==="approved"?"Approved":status==="rejected"?"Rejected":"Pending",
      approvalReason:t.approvalReason||"-",
      approvedBy:t.approvedBy||"-",
      approvedAt:t.approvedAt?new Date(t.approvedAt).toLocaleString("id-ID"):"-",
      approvalNote:t.approvalNote||"-",
      slaDur,
    }));
  });

  const exportApprovalExcel=()=>{
    const approved=approvalReportSource.filter((t:any)=>trxApprovalStatus(t)==="approved").length;
    const rejected=approvalReportSource.filter((t:any)=>trxApprovalStatus(t)==="rejected").length;
    const pending=approvalReportSource.filter((t:any)=>trxApprovalStatus(t)==="pending").length;
    const rows=[
      ["TOKKI Consumable System"],
      ["Laporan Approval Pengambilan"],
      [`Dibuat`,`${todayFmt()} ${nowTime()}`],
      [`Total Transaksi`,approvalReportSource.length],
      [`Approved`,approved],
      [`Rejected`,rejected],
      [`Pending`,pending],
      [],
      ["ID","Tanggal","Waktu","Pengambil","Section","Project","Admin","Item","Qty","Unit","Status","Alasan Approval","Diproses Oleh","Waktu Proses","Catatan","Durasi SLA"],
      ...approvalReportRows.map(r=>[
        csvText(r.id),fmtDateExcel(r.date),r.time,r.taker,r.dept,r.workOrder,r.admin,r.itemName,r.qty,r.unit,r.status,r.approvalReason,r.approvedBy,r.approvedAt,r.approvalNote,r.slaDur,
      ]),
    ];
    const csv="\uFEFF"+rows.map(r=>r.map(v=>typeof v==="string"&&v.startsWith("=")?v:csvEscape(v)).join(",")).join("\n");
    triggerDownload(`laporan-approval-${todayStr()}.csv`,csv,"text/csv;charset=utf-8;");
    toast$("Export Excel (CSV) laporan approval berhasil");
  };

  const exportApprovalPdf=()=>{
    const approved=approvalReportSource.filter((t:any)=>trxApprovalStatus(t)==="approved").length;
    const rejected=approvalReportSource.filter((t:any)=>trxApprovalStatus(t)==="rejected").length;
    const pending=approvalReportSource.filter((t:any)=>trxApprovalStatus(t)==="pending").length;
    downloadPdfTable({
      fileName:`laporan-approval-${todayStr()}.pdf`,
      title:`Laporan Approval Pengambilan - ${todayFmt()}`,
      subtitle:`Total: ${approvalReportSource.length} | Approved: ${approved} | Rejected: ${rejected} | Pending: ${pending}`,
      headers:["ID","Tanggal","Pengambil","Section","Item","Qty","Status","Diproses Oleh","Durasi SLA","Alasan"],
      rows:approvalReportRows.map(r=>[
        r.id,r.date,r.taker,r.dept,r.itemName,`${r.qty} ${r.unit}`,r.status,r.approvedBy,r.slaDur,r.approvalReason,
      ]),
    });
    toast$("Export PDF laporan approval berhasil");
  };

  const auditPeriodLabel = () => {
    if(auditFrom&&auditTo) return `${fmtDate(auditFrom)} - ${fmtDate(auditTo)}`;
    if(auditFrom) return `>= ${fmtDate(auditFrom)}`;
    if(auditTo) return `<= ${fmtDate(auditTo)}`;
    return "Semua Periode";
  };

  const fetchAuditExportRows=async()=>{
    const sp=new URLSearchParams({page:"1",pageSize:"5000"});
    if(auditActor.trim()) sp.set("actor",auditActor.trim());
    if(auditAction) sp.set("action",auditAction);
    if(auditFrom) sp.set("from",auditFrom);
    if(auditTo) sp.set("to",auditTo);
    const r=await apiFetch(`/audit-logs?${sp.toString()}`);
    if(!r.ok) throw new Error("Gagal mengambil data audit untuk export");
    const d=await r.json();
    return toSafeRows(d.rows);
  };

  const exportAuditExcel=async()=>{
    try{
      const rowsData=await fetchAuditExportRows();
      const rows=[
        ["TOKKI Consumable System"],
        ["Laporan Audit Log"],
        ["Periode",auditPeriodLabel()],
        ["Dibuat",`${todayFmt()} ${nowTime()}`],
        ["Total Data",rowsData.length],
        [],
        ["ID","Timestamp","Action","Actor","Role","Target"],
        ...rowsData.map(a=>[
          a.id,
          a.createdAt ? new Date(a.createdAt).toLocaleString("id-ID") : "",
          a.action || "",
          a.actor?.username || "",
          a.actor?.role || "",
          a.target || "",
        ]),
      ];
      const csv=rows.map(r=>r.map(csvEscape).join(",")).join("\n");
      triggerDownload(`audit-log-${todayStr()}.csv`,csv,"text/csv;charset=utf-8;");
      toast$("Export Excel (CSV) audit berhasil");
    }catch(e){toast$(e?.message||"Gagal export audit","err");}
  };

  const exportAuditPdf=async()=>{
    try{
      const rowsData=await fetchAuditExportRows();
      downloadPdfTable({
        fileName:`audit-log-${todayStr()}.pdf`,
        title:`Audit Log - ${todayFmt()}`,
        subtitle:`Periode: ${auditPeriodLabel()} | Total data: ${rowsData.length}`,
        headers:["ID","Timestamp","Action","Actor","Role","Target"],
        rows: rowsData.map(a=>[
          a.id,
          a.createdAt ? new Date(a.createdAt).toLocaleString("id-ID") : "",
          a.action || "",
          a.actor?.username || "",
          a.actor?.role || "",
          a.target || "",
        ]),
      });
      toast$("Export PDF audit berhasil");
    }catch(e){toast$(e?.message||"Gagal export audit","err");}
  };

  const exportReportExcel=()=>{
    const rows=[
      ["TOKKI Consumable System"],
      ["Laporan & Analitik"],
      ["Periode",reportRange.label],
      ["Rentang",`${fmtDate(reportRange.start)} - ${fmtDate(reportRange.end)}`],
      ["Dibuat",`${todayFmt()} ${nowTime()}`],
      [],
      ["KPI","Nilai"],
      ["Total Keluar (Unit)",reportTotalOutUnits],
      ["Total Masuk (Unit)",reportTotalInUnits],
      ["Nilai Estimasi (Rp)",Math.round(reportEstimatedValue)],
      ["Item Kritis",lowStock.length],
      [],
      ["Transaksi Per Hari/Bulan"],
      ["Label","Keluar","Masuk"],
      ...reportTxnSeries.map(s=>[s.label,s.out,s.in]),
      [],
      ["Top 5 Item Paling Sering Diambil"],
      ["Item","Unit Keluar"],
      ...reportTopItems.map(r=>[r.name,r.total]),
      [],
      ["Breakdown Pengambilan per Departemen"],
      ["Departemen","Total Unit",...reportDeptCats],
      ...reportDeptStack.map(row=>[
        row.dept,
        row.total,
        ...reportDeptCats.map(cat=>Number(row.cats?.[cat]||0)),
      ]),
    ];
    const csv="\uFEFF"+rows.map(r=>r.map(csvEscape).join(",")).join("\n");
    triggerDownload(`laporan-analitik-${todayStr()}.csv`,csv,"text/csv;charset=utf-8;");
    toast$("Export Excel (CSV) laporan berhasil");
  };

  const exportReportPdf=()=>{
    downloadPdfTable({
      fileName:`laporan-analitik-${todayStr()}.pdf`,
      title:`Laporan & Analitik - ${todayFmt()}`,
      subtitle:`Periode: ${reportRange.label} (${fmtDate(reportRange.start)} - ${fmtDate(reportRange.end)}) | Keluar: ${reportTotalOutUnits} | Masuk: ${reportTotalInUnits} | Item kritis: ${lowStock.length}`,
      headers:["Label","Keluar","Masuk"],
      rows:reportTxnSeries.map(s=>[s.label,s.out,s.in]),
    });
    toast$("Export PDF laporan berhasil");
  };

  // ── CSS STRING ────────────────────────────────────────────────
  const CSS=`
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,500;1,600;1,700;1,800;1,900&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    html,body,#root{height:100%;max-width:100%;overflow:hidden}
    body{font-family:'Plus Jakarta Sans',sans-serif;background:${T.bg};color:${T.text};min-height:100vh;-webkit-font-smoothing:antialiased;transition:background .4s,color .3s;font-size:13px;line-height:1.6}
    ::-webkit-scrollbar{width:4px;height:4px}
    ::-webkit-scrollbar-track{background:transparent}
    ::-webkit-scrollbar-thumb{background:${T.border};border-radius:4px}

    .shell{display:flex;height:100vh;height:100dvh;position:relative;z-index:1;width:100%;max-width:100%;overflow:hidden}

    /* SIDEBAR */
    .sidebar{width:228px;flex-shrink:0;background:${T.sidebarBg};border-right:1px solid ${T.border};display:flex;flex-direction:column;position:sticky;top:0;height:100vh;height:100dvh;overflow:hidden;backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);transition:transform .28s cubic-bezier(.4,0,.2,1),width .22s ease;z-index:100}
    .sidebar.open{transform:translateX(0)!important}
    .sidebar.collapsed{width:82px}
    .sidebar.collapsed .brand{justify-content:center;padding:14px 0 12px}
    .sidebar.collapsed .brand > div:not(.brand-logo){display:none}
    .sidebar.collapsed .nav-label{display:none}
    .sidebar.collapsed .nav-item{justify-content:center;padding:10px 8px;gap:0}
    .sidebar.collapsed .nav-text{display:none}
    .sidebar.collapsed .nav-pill{position:absolute;top:4px;right:4px;margin-left:0}
    .sidebar.collapsed .sb-user-meta{display:none}
    .sidebar.collapsed .sb-user-row{justify-content:center}
    .sidebar.collapsed .sb-logout-text{display:none}
    .sidebar.collapsed .sb-logout-btn{padding:9px 0}
    .sidebar.collapsed .sb-inner{padding:0 8px 0}
    .sb-inner{display:flex;flex-direction:column;height:100%;padding:0 12px 0;overflow:hidden}
    .sb-nav-scroll{flex:1;overflow-y:auto;padding-bottom:8px;min-height:0}
    .brand{padding:22px 8px 20px;display:flex;align-items:center;gap:11px;border-bottom:1px solid ${T.border};margin-bottom:24px;flex-shrink:0}
    .brand-logo{width:48px;height:48px;border-radius:10px;background:#ffffff;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;padding:3px}
    .brand-name{font-size:16px;font-weight:900;color:${T.primaryLight};line-height:1.2}
    .brand-sub{font-size:9px;color:${T.muted};letter-spacing:.12em;text-transform:uppercase;font-weight:700;margin-top:2px}
    .nav-label{font-size:9px;font-weight:800;color:${T.muted};letter-spacing:.18em;text-transform:uppercase;padding:0 8px 14px}
    .nav-item{display:flex;align-items:center;gap:11px;width:100%;padding:11px 12px;border-radius:11px;cursor:pointer;border:1px solid transparent;font-family:'Plus Jakarta Sans',sans-serif;font-size:13px;font-weight:600;color:${T.muted};text-align:left;transition:all .2s ease;margin-bottom:5px;background:transparent}
    .nav-item:hover{background:${T.surface};color:${T.text};border-color:${T.border}}
    .nav-item.active{background:${T.navActive};color:${T.navActiveText};border-color:${T.navActiveBorder};box-shadow:0 0 12px ${T.primaryGlow}}
    .nav-icon{width:20px;height:20px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .nav-pill{margin-left:auto;background:${T.primary};color:white;font-size:10px;font-weight:800;padding:1px 8px;border-radius:20px}
    .sb-footer{padding:14px 0 20px;border-top:1px solid ${T.border};flex-shrink:0}

    /* MAIN */
    .main{flex:1;display:flex;flex-direction:column;min-width:0;width:100%;overflow-x:hidden;overflow-y:auto;height:100vh;height:100dvh}
    .topbar{height:64px;background:${T.topbarBg};border-bottom:1px solid ${T.border};padding:0 24px;display:flex;align-items:center;justify-content:space-between;gap:12px;position:sticky;top:0;z-index:50;flex-shrink:0;backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px)}
    .page-title{font-size:22px;font-weight:900;color:${T.text};min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:260px;line-height:1.3;margin:0}
    .tb-btn{display:inline-flex;align-items:center;gap:6px;padding:7px 13px;border:1px solid ${T.border};border-radius:10px;background:${T.surface};color:${T.muted};font-family:'Plus Jakarta Sans',sans-serif;font-size:12px;font-weight:600;cursor:pointer;transition:all .2s;backdrop-filter:blur(12px)}
    .tb-btn:hover{border-color:${T.borderHover};color:${T.text}}
    .tb-logout{display:none !important}
    .tb-logout:hover{background:${T.redBg};border-color:${T.redBorder};color:${T.redText}}
    .tb-btn.tb-backup,.tb-btn.tb-restore,.tb-btn.tb-reset-dummy{display:inline-flex}
    .date-btn{display:inline-flex}
    .nav-item.mobile-logout{display:none;border-color:${T.redBorder};color:${T.redText};background:${T.redBg}}
    .nav-item.mobile-logout:hover{background:${T.redBg};border-color:${T.redBorder};color:${T.redText}}

    /* TOGGLE — smooth cubic */
    .toggle-wrap{display:flex;align-items:center;gap:8px;background:${T.surface};border:1px solid ${T.border};border-radius:30px;padding:5px 10px 5px 13px;cursor:pointer;user-select:none;transition:all .2s;appearance:none;-webkit-appearance:none;font-family:'Plus Jakarta Sans',sans-serif;position:relative;z-index:2}
    .toggle-wrap:hover{border-color:${T.borderHover}}
    .toggle-wrap:focus-visible{outline:none;box-shadow:0 0 0 2px ${T.primaryGlow}}
    .toggle-wrap.mini{min-width:72px;min-height:36px;padding:6px 11px;justify-content:center}
    .toggle-wrap.mini .toggle-lbl{display:inline-flex !important;font-size:12px}
    .toggle-lbl{font-size:11px;font-weight:700;color:${T.muted}}
    .toggle-track{width:42px;height:23px;border-radius:12px;background:${dark?`linear-gradient(135deg,${T.primary},${T.primaryLight})`:`rgba(100,116,139,0.25)`};position:relative;transition:background .35s ease;box-shadow:${dark?`0 0 8px ${T.primaryGlow}`:"none"}}
    .toggle-thumb{width:17px;height:17px;border-radius:50%;background:#fff;position:absolute;top:3px;left:${dark?"22px":"3px"};transition:left .3s cubic-bezier(.4,0,.2,1);box-shadow:0 2px 6px rgba(0,0,0,0.25)}

    .body-area{padding:28px 24px 52px;flex:1;overflow-y:auto;overflow-x:hidden;min-width:0}
    .enter{animation:fadeIn .32s ease}
    @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}

    .sec{font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;color:${T.muted};margin:24px 0 14px;display:flex;align-items:center;gap:12px}
    .sec::after{content:'';flex:1;height:1px;background:${T.border}}

    .stats-g{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px}
    .two-col{display:grid;grid-template-columns:1.4fr 1fr;gap:16px}
    .report-botgrid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px}
    .stock-g{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px}
    .hist-g{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px}
    .stat5-g{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:18px}
    .stat5-g .stat-card .stat-val{font-size:clamp(16px,3.5vw,28px);font-weight:900;line-height:1.2;word-break:break-word;overflow-wrap:break-word}
    .trx-row-inner{flex:1;display:flex;gap:0;align-items:center;padding:12px 14px 12px 8px;flex-wrap:nowrap;min-width:0}
    .trx-col-name{width:210px;flex-shrink:0;padding-right:16px}
    .trx-col-time{width:110px;flex-shrink:0;padding-right:16px}
    .trx-col-items{flex:1 1 auto;min-width:200px;padding-right:16px}
    .trx-col-count{width:90px;flex-shrink:0;padding-right:16px}
    .trx-col-total{width:140px;flex-shrink:0;text-align:right;padding-right:14px}

    .dash-hero{background:${T.card};border:1px solid ${T.border};border-radius:24px;padding:18px 26px;min-height:128px;margin-bottom:24px;position:relative;overflow:hidden;backdrop-filter:blur(14px);box-shadow:${T.shadowSm}}
    .dash-hero::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,${dark?"rgba(16,185,129,0.11)":"rgba(16,185,129,0.09)"} 0%,transparent 55%)}
    .dash-hero::after{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,${T.primary},${T.primaryLight},#14b8a6)}
    .dash-hero-content{position:relative;z-index:1;display:flex;align-items:center;gap:16px;justify-content:space-between;flex-wrap:wrap}
    .dash-hero-copy{flex:1;min-width:220px}
    .dash-hero-title{font-size:20px;color:${T.text};font-weight:900;margin-bottom:2px;line-height:1.2}
    .dash-hero-btn{flex-shrink:0;padding:12px 20px;border-radius:14px;font-weight:800}
    .dash-hero-illus{width:164px;height:92px;position:relative;flex-shrink:0;opacity:${dark?0.45:0.6}}
    .dash-box{position:absolute;bottom:0;border-radius:10px;background:linear-gradient(180deg,${dark?"rgba(255,255,255,0.1)":"rgba(6,95,70,0.14)"},transparent),${dark?"rgba(250,204,21,0.14)":"rgba(5,150,105,0.12)"};border:1px solid ${T.border};box-shadow:inset 0 1px 0 rgba(255,255,255,0.05)}
    .dash-box.b1{left:12px;width:34px;height:42px}
    .dash-box.b2{left:44px;width:48px;height:58px}
    .dash-box.b3{left:88px;width:42px;height:76px}
    .dash-box.b4{left:124px;width:28px;height:50px}
    .dash-box::before{content:'';position:absolute;top:8px;left:8px;right:8px;height:1px;background:${T.border}}
    .dash-box::after{content:'';position:absolute;top:0;bottom:0;left:50%;width:1px;background:${T.border};opacity:.65}

    .dash-stat{display:flex;align-items:center;gap:14px;min-height:116px}
    .dash-stat-icon{width:52px;height:52px;border-radius:18px;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0;background:${dark?"linear-gradient(135deg,rgba(16,185,129,0.18),rgba(16,185,129,0.07))":"linear-gradient(135deg,rgba(16,185,129,0.13),rgba(16,185,129,0.04))"}; border:1px solid ${T.navActiveBorder};box-shadow:0 0 0 6px ${dark?"rgba(16,185,129,0.05)":"rgba(16,185,129,0.04)"}}
    .dash-stat-meta{flex:1;min-width:0}
    .dash-stat-label{font-size:10px;font-weight:800;color:${T.muted};letter-spacing:.08em;text-transform:uppercase;margin-bottom:4px}
    .dash-stat-value{font-size:25px;font-weight:900;line-height:1;color:${T.text}}
    .dash-stat-sub{font-size:11px;color:${T.muted};margin-top:8px;font-weight:600}

    .dash-panel-title{font-size:16px;font-weight:800;color:${T.text};display:flex;align-items:center;gap:8px}
    .dash-transaction-card{padding:18px 0;border-bottom:1px solid ${T.border};display:flex;align-items:flex-start;gap:14px}
    .dash-transaction-card:first-of-type{padding-top:6px}
    .dash-transaction-card:last-child{border-bottom:none;padding-bottom:0}
    .dash-avatar{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,${T.primary},${T.primaryLight});color:white;font-size:15px;font-weight:800;flex-shrink:0;box-shadow:0 10px 18px ${T.primaryGlow}}
    .dash-transaction-main{flex:1;min-width:0}
    .dash-transaction-name{font-size:13.5px;font-weight:800;color:${T.text};line-height:1.3}
    .dash-transaction-meta{font-size:11px;color:${T.muted};margin-top:2px;font-weight:500}
    .dash-chip-row{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}
    .dash-chip{display:inline-flex;align-items:center;gap:6px;background:${T.greenBg};color:${T.greenText};border:1px solid ${T.greenBorder};font-size:10.5px;font-weight:700;padding:4px 9px;border-radius:8px;max-width:100%}
    .dash-chip-text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:210px}
    .dash-unit-pill{background:${T.navActive};border:1px solid ${T.navActiveBorder};color:${T.navActiveText};font-size:11px;font-weight:800;border-radius:999px;padding:7px 12px;white-space:nowrap;flex-shrink:0}

    .dash-alert-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 16px 22px;text-align:center;min-height:295px}
    .dash-alert-visual{width:120px;height:120px;border-radius:50%;display:flex;align-items:center;justify-content:center;position:relative;background:radial-gradient(circle,${dark?"rgba(16,185,129,0.28)":"rgba(16,185,129,0.18)"} 0%,transparent 70%);margin-bottom:16px}
    .dash-alert-visual::before{content:'';position:absolute;inset:18px;border-radius:50%;background:${dark?"rgba(16,185,129,0.12)":"rgba(16,185,129,0.1)"};border:1px solid ${T.navActiveBorder};box-shadow:0 0 20px ${T.primaryGlow}}
    .dash-alert-check{position:relative;z-index:1;width:46px;height:46px;border-radius:14px;background:linear-gradient(135deg,${T.primary},${T.primaryLight});display:flex;align-items:center;justify-content:center;color:white;font-size:24px;font-weight:900;box-shadow:0 12px 28px ${T.primaryGlow}}
    .dash-alert-spark{position:absolute;width:6px;height:6px;border-radius:50%;background:${T.primaryLight};box-shadow:0 0 12px ${T.primaryGlow}}
    .dash-alert-spark.s1{top:22px;left:18px}
    .dash-alert-spark.s2{top:35px;right:18px}
    .dash-alert-spark.s3{bottom:30px;left:26px}
    .dash-alert-spark.s4{top:16px;right:34px;width:4px;height:4px}

    /* CARDS */
    .stat-card{background:${T.card};border:1px solid ${T.border};border-radius:18px;padding:20px 22px;backdrop-filter:blur(12px);transition:all .25s;position:relative;overflow:hidden;box-shadow:${T.shadowSm}}
    .stat-card:hover{border-color:${T.borderHover};transform:translateY(-3px);box-shadow:${T.shadowCard}}
    .card{background:${T.card};border:1px solid ${T.border};border-radius:20px;padding:22px 24px;backdrop-filter:blur(12px);transition:all .25s;box-shadow:${T.shadowSm}}
    .card:hover{border-color:${T.borderHover};box-shadow:${T.shadowCard}}

    /* DASHBOARD RESPONSIVE GRIDS */
    .dash-insight-g{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:20px}
    .dash-charts-g{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:20px}
    .dash-tables-g{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px}
    .dash-footer-g{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
    .dash-low-hdr{display:grid;grid-template-columns:2fr 56px 64px 50px;gap:8px;padding:6px 0 8px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px}
    .dash-low-row{display:grid;grid-template-columns:2fr 56px 64px 50px;gap:8px;padding:8px 0;align-items:center;font-size:12px}
    .dash-recv-hdr{display:grid;grid-template-columns:2fr 68px 90px 56px;gap:8px;padding:6px 0 8px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px}
    .dash-recv-row{display:grid;grid-template-columns:2fr 68px 90px 56px;gap:8px;padding:8px 0;align-items:center;font-size:12px}

    .stk-card{background:${T.card};border-radius:18px;padding:16px;display:flex;flex-direction:column;backdrop-filter:blur(12px);transition:all .25s;position:relative;overflow:hidden;box-shadow:${T.shadowSm}}
    .stk-card:hover{transform:translateY(-4px);box-shadow:${T.shadowCard}}

    .trx-card{background:${T.card};border:1px solid ${T.border};border-radius:16px;margin-bottom:10px;overflow:hidden;transition:all .22s;backdrop-filter:blur(10px);box-shadow:${T.shadowSm};max-width:100%;word-wrap:break-word}
    .trx-card:hover{border-color:${T.borderHover};box-shadow:${T.shadowCard}}
    .trx-head{padding:14px 18px;border-bottom:1px solid ${T.border};display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}
    .trx-body{padding:10px 14px 13px;display:flex;flex-wrap:wrap;gap:6px}
    .trx-stats{display:flex;flex-direction:column;align-items:flex-end;gap:2px;flex-shrink:0;text-align:right}
    .itm-pill{display:inline-flex;align-items:center;gap:6px;background:${dark?"rgba(0,0,0,0.15)":T.surface};border:1px solid ${T.border};border-radius:9px;padding:5px 10px}

    .audit-row{display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid ${T.border};flex-wrap:wrap}
    .audit-row:last-child{border-bottom:none}
    .audit-col-action{flex:1 1 180px;min-width:0}
    .audit-col-target{flex:0 0 110px;min-width:0}
    .audit-col-date{flex:1 1 120px;min-width:0;display:flex;align-items:center;gap:6px;color:${T.muted};font-size:12px;font-weight:600}
    .audit-col-id{flex-shrink:0}
    .audit-col-arrow{flex-shrink:0}

    .fbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:18px}
    .cat-btn{padding:7px 14px;border-radius:9px;border:1px solid ${T.border};background:${T.surface};color:${T.muted};font-family:'Plus Jakarta Sans',sans-serif;font-size:12px;font-weight:700;cursor:pointer;transition:all .18s}
    .cat-btn:hover{border-color:${T.navActiveBorder};color:${T.navActiveText};background:${T.navActive}}
    .cat-btn.on{background:linear-gradient(135deg,${T.primary},${T.primaryLight});border-color:transparent;color:white;box-shadow:0 4px 12px ${T.primaryGlow}}

    /* INPUT — clean + focus ring */
    .ifield{width:100%;background:${T.inputBg};border:1px solid ${T.border};color:${T.text};padding:10px 13px;border-radius:10px;outline:none;font-size:13px;font-family:'Plus Jakarta Sans',sans-serif;transition:border-color .2s ease,box-shadow .2s ease;line-height:1.4}
    .ifield::placeholder{color:${T.muted};opacity:.65}
    .ifield:focus{border-color:${T.primary};box-shadow:0 0 0 2px ${T.primaryGlow}}

    /* OVERLAY + MODAL */
    .overlay{position:fixed;inset:0;background:rgba(0,6,3,0.78);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);z-index:400;display:flex;align-items:flex-start;justify-content:center;padding:20px 16px;overflow-y:auto}
    .modal{background:${T.surfaceSolid};border:1px solid ${T.border};border-radius:22px;padding:28px;width:560px;max-width:100%;box-shadow:${T.shadowCard};margin:auto;animation:mi .22s ease;position:relative;overflow:hidden}
    .modal::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;border-radius:22px 22px 0 0;background:linear-gradient(90deg,${T.primary},${T.primaryLight},#14b8a6)}
    @keyframes mi{from{opacity:0;transform:translateY(14px) scale(.97)}to{opacity:1;transform:none}}

    .sect-box{background:${dark?"rgba(0,0,0,0.18)":T.surface};border:1px solid ${T.border};border-radius:14px;padding:16px;margin-bottom:14px}
    .sect-lbl{font-size:10px;font-weight:800;color:${T.primaryLight};letter-spacing:.12em;text-transform:uppercase;margin-bottom:12px}
    .mgrid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .mspan{grid-column:span 2}

    .cart-row{display:flex;align-items:center;gap:10px;padding:10px 12px;background:${dark?"rgba(0,0,0,0.15)":T.surface};border:1px solid ${T.border};border-radius:11px;margin-bottom:7px;transition:border-color .2s}
    .cart-row:hover{border-color:${T.borderHover}}
    .stk-box{background:${dark?"rgba(0,0,0,0.18)":T.surface};border:1px solid ${T.border};border-radius:10px;padding:10px}

    .al-row{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;padding:12px 0;border-bottom:1px solid ${T.border}}
    .al-row:last-child{border-bottom:none}

    .notif-wrap{position:relative}
    .notif-drop{position:absolute;top:calc(100% + 8px);right:0;width:290px;background:${T.surfaceSolid};border:1px solid ${T.border};border-radius:16px;box-shadow:${T.shadowCard};z-index:200;overflow:hidden;backdrop-filter:blur(20px)}

    .toast{position:fixed;bottom:24px;right:24px;z-index:999;padding:13px 18px;border-radius:14px;font-size:12.5px;font-weight:700;box-shadow:${T.shadowCard};animation:toastIn .22s ease;display:flex;align-items:center;gap:9px;backdrop-filter:blur(14px);border:1px solid;max-width:300px}
    @keyframes toastIn{from{transform:translateY(14px);opacity:0}to{transform:none;opacity:1}}

    .busy-overlay{position:fixed;inset:0;z-index:1300;background:rgba(0,6,3,0.58);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:16px}
    .busy-card{display:flex;flex-direction:column;align-items:center;gap:12px;background:${T.surfaceSolid};border:1px solid ${T.border};border-radius:16px;padding:18px 24px;box-shadow:${T.shadowCard};min-width:210px}
    .busy-spin{width:34px;height:34px;border-radius:50%;border:3px solid ${T.border};border-top-color:${T.primary};animation:busySpin .85s linear infinite}
    .busy-text{font-size:13px;font-weight:800;color:${T.text};letter-spacing:.02em}
    .busy-sub{font-size:11px;color:${T.muted}}
    @keyframes busySpin{to{transform:rotate(360deg)}}

    .backdrop-mob{display:none;position:fixed;inset:0;background:rgba(0,6,3,0.55);z-index:90}

    /* BOTTOM NAV — mobile only */
    .bottom-nav{display:none;position:fixed;bottom:0;left:0;right:0;z-index:180;background:${T.sidebarBg};border-top:1px solid ${T.border};backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);padding:0 4px env(safe-area-inset-bottom,0)}
    .bn-inner{display:flex;align-items:stretch;height:58px}
    .bn-item{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;border:none;background:transparent;cursor:pointer;color:${T.muted};font-family:'Plus Jakarta Sans',sans-serif;font-size:9px;font-weight:700;transition:color .2s;position:relative;padding:0}
    .bn-item.active{color:${T.primary}}
    .bn-item-icon{font-size:17px;line-height:1}
    .bn-pill{position:absolute;top:6px;right:calc(50% - 14px);background:${T.primary};color:white;font-size:8px;font-weight:800;border-radius:20px;padding:1px 5px;min-width:14px;text-align:center}
    @media(max-width:660px){.bottom-nav{display:block}.body-area{padding-bottom:72px !important}}

    /* LOGIN */
    .login-bg{position:fixed;inset:0;background:linear-gradient(135deg,rgba(0,12,5,0.82) 0%,rgba(0,10,4,0.66) 40%,rgba(0,8,3,0.74) 100%),url('/login-bg-new.png');background-size:cover;background-position:center;background-repeat:no-repeat}
    .login-bg::after{content:'';position:absolute;inset:0;background-image:radial-gradient(circle,${dark?"rgba(16,185,129,0.08)":"rgba(16,185,129,0.12)"} 1px,transparent 1px);background-size:26px 26px}
    .login-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px;position:relative;z-index:1}
    .login-card{
      background:${dark?"rgba(3,14,7,0.88)":"rgba(255,255,255,0.93)"};
      border:1px solid ${dark?"rgba(16,185,129,0.22)":"rgba(16,185,129,0.3)"};
      border-radius:24px;
      padding:44px 40px;
      width:440px;max-width:100%;
      box-shadow:${dark?"0 32px 80px rgba(0,0,0,0.8),0 0 0 1px rgba(16,185,129,0.08)":"0 20px 60px rgba(0,0,0,0.25),0 0 0 1px rgba(16,185,129,0.12)"};
      backdrop-filter:blur(28px);
      -webkit-backdrop-filter:blur(28px);
      position:relative;overflow:hidden;
      animation:fadeIn .4s ease;
    }
    .login-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,${T.primary},${T.primaryLight},#14b8a6);border-radius:24px 24px 0 0}
    .login-ifield-wrap{position:relative}
    .login-ifield-icon{position:absolute;left:13px;top:50%;transform:translateY(-50%);color:${T.muted};display:flex;align-items:center;pointer-events:none}
    .login-ifield-wrap .ifield{padding-left:42px}
    .login-btn{width:100%;padding:14px 20px;font-size:15px;font-weight:800;background:linear-gradient(135deg,${T.primary} 0%,${T.primaryLight} 100%);color:white;border:none;border-radius:14px;cursor:pointer;box-shadow:0 6px 24px ${T.primaryGlow};letter-spacing:.02em;display:flex;align-items:center;justify-content:center;gap:9px;transition:transform .15s,box-shadow .15s;font-family:'Plus Jakarta Sans',sans-serif}
    .login-btn:hover{transform:translateY(-2px);box-shadow:0 10px 32px ${T.primaryGlow}}
    .login-btn:active{transform:translateY(0)}
    .login-mode-icon-btn{width:44px;height:44px;display:flex;align-items:center;justify-content:center;border-radius:12px;border:1px solid ${T.border};background:${T.surface};color:${T.text};font-size:18px;font-weight:800;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;transition:all .2s;box-shadow:${T.shadowSm}}
    .login-mode-icon-btn:hover{border-color:${T.borderHover};background:${T.navActive};color:${T.navActiveText};transform:translateY(-1px)}
    .login-mode-icon-btn:focus-visible{outline:none;box-shadow:0 0 0 2px ${T.primaryGlow}}
    .login-divider{display:flex;align-items:center;gap:12px;margin:18px 0 14px}
    .login-divider::before,.login-divider::after{content:'';flex:1;height:1px;background:${T.border}}
    @media(max-width:480px){
      .login-card{padding:36px 20px;border-radius:18px}
      .login-wrap{padding:12px;align-items:flex-start;padding-top:28px}
    }

    @media(max-width:1100px){
      .stats-g{grid-template-columns:repeat(2,1fr)}
      .hist-g{grid-template-columns:repeat(2,1fr)}
      .two-col{grid-template-columns:1fr}
      .report-botgrid{grid-template-columns:1fr}
      .stat5-g{grid-template-columns:repeat(3,1fr)}
      .approval-ov-g{grid-template-columns:repeat(3,1fr) !important}
      .dash-insight-g{grid-template-columns:repeat(2,minmax(0,1fr))}
      .dash-charts-g{grid-template-columns:1fr 1fr}
    }
    @media(max-width:860px){
      .stock-g{grid-template-columns:repeat(2,1fr)}
      .body-area{padding:20px 16px 44px}
      .stat5-g{grid-template-columns:repeat(3,1fr)}
      .trx-col-name{width:160px}
      .trx-col-time{width:90px}
      .trx-col-count{display:none}
      .dash-charts-g{grid-template-columns:1fr}
      .dash-tables-g{grid-template-columns:1fr}
      .dash-footer-g{grid-template-columns:1fr 1fr}
    }
    @media(max-width:660px){
      .sidebar{position:fixed;left:0;top:0;bottom:0;transform:translateX(-100%);box-shadow:20px 0 50px rgba(0,0,0,.5);z-index:260}
      .sidebar.open{transform:translateX(0)}
      .sb-inner{padding-bottom:88px}
      .backdrop-mob{display:block}
      .topbar{padding:0 10px;gap:6px;height:58px}
      .tb-btn.tb-backup,.tb-btn.tb-restore,.tb-btn.tb-reset-dummy{display:none !important}
      .date-btn{display:none !important}
      .tb-logout{display:inline-flex !important}
      .page-title{font-size:15px;max-width:none;line-height:1.12;font-weight:800;letter-spacing:.01em}
      .notif-wrap{margin:0 -4px}
      .tb-reset-dummy{display:none}
      .nav-item.mobile-logout{display:flex}
      .body-area{padding:14px 12px 40px}
      .stock-g{grid-template-columns:repeat(2,minmax(0,1fr))}
      .stats-g{grid-template-columns:repeat(2,minmax(0,1fr))}
      .two-col{grid-template-columns:1fr}
      .mgrid{grid-template-columns:1fr}
      .mspan{grid-column:span 1}
      .modal{padding:20px 14px;border-radius:18px}
      .trx-head{flex-direction:column;gap:8px;align-items:stretch;padding:12px 14px}
      .trx-stats{width:100%;text-align:left;align-items:flex-start;flex-direction:row;justify-content:space-between;gap:8px;flex-wrap:wrap}
      .trx-stats button{width:100%}
      .fbar{gap:4px;flex-wrap:wrap}
      .fbar input[type=date]{width:120px !important;font-size:11px}
      .fbar select{width:100px !important;font-size:11px}
      .fbar span{display:none}
      .audit-col-target{display:none}
      .audit-col-arrow{display:none}
      .trx-card{margin-bottom:8px}
      .audit-col-action{flex:1 1 auto}
      .audit-col-target{flex:0 0 110px}
      .cat-btn{padding:6px 10px;font-size:11px}
      .toggle-lbl{display:none}
      .toggle-wrap.mini .toggle-lbl{display:inline-flex !important}
      .stat-card{padding:16px 14px;min-width:0}
      .card{padding:16px 16px;min-width:0}
      .date-btn{display:none}
      .dash-hero{padding:14px 14px 16px;border-radius:18px;margin-bottom:14px}
      .dash-hero-title{font-size:17px}
      .dash-hero-btn{padding:10px 16px;font-size:13px;width:100%}
      .dash-hero-copy{min-width:0}
      .dash-hero-illus{display:none}
      .stats-g{gap:10px;margin-bottom:14px}
      .two-col{gap:12px}
      .approval-ov-g{grid-template-columns:repeat(2,1fr) !important;gap:10px !important}
      .dash-insight-g{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
      .dash-charts-g{grid-template-columns:1fr}
      .dash-tables-g{grid-template-columns:1fr}
      .dash-footer-g{grid-template-columns:1fr}
      .dash-low-hdr{grid-template-columns:minmax(0,2fr) 46px 54px}
      .dash-low-row{grid-template-columns:minmax(0,2fr) 46px 54px}
      .dash-col-satuan{display:none}
      .dash-recv-hdr{grid-template-columns:minmax(0,2fr) 60px 80px}
      .dash-recv-row{grid-template-columns:minmax(0,2fr) 60px 80px}
      .dash-col-oleh{display:none}
      .dash-stat{flex-direction:column;align-items:flex-start;gap:8px;min-height:auto}
      .dash-stat-icon{width:40px;height:40px;border-radius:13px;font-size:18px}
      .dash-stat-value{font-size:clamp(22px,6vw,30px)}
      .dash-stat-sub{margin-top:4px}
      .dash-panel-title{font-size:14px}
      .two-col>.card{margin-bottom:0}
      .dash-transaction-card{gap:10px}
      .dash-unit-pill{padding:6px 10px;font-size:10.5px}
      .stat5-g{grid-template-columns:repeat(2,1fr);gap:8px}
      .trx-row-inner{flex-wrap:wrap;padding:10px 10px 10px 6px;gap:6px}
      .trx-col-name{width:100%;padding-right:0;order:1}
      .trx-col-time{width:auto;flex-shrink:1;padding-right:0;order:2}
      .trx-col-items{min-width:0;width:100%;padding-right:0;order:4}
      .trx-col-count{display:none}
      .trx-col-total{width:auto;text-align:left;padding-right:0;order:3}
      .fbar input{width:130px !important;font-size:12px}
      .fbar select{width:130px !important;font-size:12px}
      .audit-col-action{flex:1 1 100%;order:1}
      .audit-col-target{flex:1 1 auto;order:2}
      .audit-row{flex-wrap:wrap;gap:10px;padding:12px 14px}
    }
    @media(max-width:420px){
      .stats-g{grid-template-columns:repeat(2,minmax(0,1fr))}
      .approval-ov-g{grid-template-columns:repeat(2,minmax(0,1fr)) !important}
      .dash-insight-g{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
      .hist-g{grid-template-columns:repeat(2,minmax(0,1fr))}
      .stock-g{grid-template-columns:1fr}
      .stk-card{padding:14px}
      .body-area{padding:12px 10px 36px}
      .topbar{padding:0 8px;gap:4px;height:54px}
      .page-title{font-size:13px;line-height:1.12;font-weight:800;letter-spacing:.01em}
      .tb-btn{padding:6px 10px;font-size:11px}
      .modal{padding:16px 12px}
      .cart-row{flex-wrap:wrap}
      .stat5-g{grid-template-columns:1fr 1fr;gap:6px}
      .fbar input[type=date]{width:110px !important}
    }
  `;

  // ── BG BLOBS ────────────────────────────────────────────────────
  const Blobs=()=>(
    <div style={{position:"fixed",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
      <div style={{position:"absolute",top:"-15%",left:"-10%",width:420,height:420,borderRadius:"50%",background:"rgba(16,185,129,0.2)",filter:"blur(100px)",opacity:dark?.5:.3,transition:"opacity .4s"}}/>
      <div style={{position:"absolute",bottom:"-15%",right:"-10%",width:340,height:340,borderRadius:"50%",background:"rgba(5,150,105,0.15)",filter:"blur(90px)",opacity:dark?.5:.25,transition:"opacity .4s"}}/>
      <div style={{position:"absolute",top:"45%",right:"15%",width:220,height:220,borderRadius:"50%",background:"rgba(20,184,166,0.1)",filter:"blur(70px)",opacity:dark?.4:.2,transition:"opacity .4s"}}/>
    </div>
  );

  // ── TOGGLE COMPONENT ─────────────────────────────────────────────
  const Toggle=({mini})=>(
    <button type="button" className={`toggle-wrap${mini?" mini":""}`} onClick={toggleTheme} style={mini?{padding:"6px 11px"}:{}} aria-label={dark?"Switch to light mode":"Switch to dark mode"}>
      <span className="toggle-lbl">{dark?"🌙":"☀️"}{!mini&&(dark?" Dark":" Light")}</span>
      <div className="toggle-track"><div className="toggle-thumb"/></div>
    </button>
  );

  const BusyOverlay=()=>loading&&loggedIn?(
    <div className="busy-overlay" role="status" aria-live="polite" aria-busy="true">
      <div className="busy-card">
        <div className="busy-spin"/>
        <div className="busy-text">Mohon menunggu...</div>
        <div className="busy-sub">{loadingText}</div>
      </div>
    </div>
  ):null;

  // ── LOGIN ────────────────────────────────────────────────────────
  if(!loggedIn) return(
    <div style={{position:"relative",minHeight:"100vh"}}>
      <style>{CSS}</style>
      <div className="login-bg"/>
      <div style={{position:"fixed",right:"-6%",top:"50%",transform:"translateY(-50%)",width:"min(520px,52vw)",opacity:dark?0.05:0.07,pointerEvents:"none",zIndex:0}}>
        <img src="/LOGO TOKKI-FAVICON.png" alt="" style={{width:"100%",objectFit:"contain"}}/>
      </div>
      <div style={{position:"fixed",left:0,top:0,bottom:0,width:"35%",background:dark?"linear-gradient(90deg,rgba(0,12,5,0.6) 0%,transparent 100%)":"linear-gradient(90deg,rgba(209,250,229,0.5) 0%,transparent 100%)",pointerEvents:"none",zIndex:0}}/>
      <div className="login-wrap">
        <div className="login-card">
          <button type="button" className="login-mode-icon-btn" onClick={toggleTheme} aria-label={dark?"Pindah ke mode terang":"Pindah ke mode gelap"} title={dark?"Pindah ke mode terang":"Pindah ke mode gelap"} style={{position:"absolute",top:16,right:16,zIndex:3}}>
            {dark?"☀️":"🌙"}
          </button>

          <div style={{display:"flex",justifyContent:"center",marginBottom:22}}>
            <img src={dark?"/tokki-logo dark mode.png":"/tokki-logo.png"} alt="Tokki" style={{height:dark?54:66,objectFit:"contain"}}/>
          </div>

          <div style={{display:"flex",justifyContent:"center",marginBottom:20}}>
            <div style={{display:"inline-flex",alignItems:"center",gap:7,background:T.navActive,border:`1px solid ${T.navActiveBorder}`,borderRadius:20,padding:"5px 14px",fontSize:11,fontWeight:800,color:T.navActiveText}}>
              🛡️ Warehouse Management System
            </div>
          </div>

          <div style={{fontSize:34,fontWeight:900,lineHeight:1.15,marginBottom:8}}>
            <span style={{color:T.text}}>Selamat </span>
            <span style={{color:T.primary}}>Datang</span>
          </div>
          <div style={{fontSize:13,color:T.muted,marginBottom:28,fontWeight:500,lineHeight:1.65}}>
            Masuk untuk mengelola inventaris barang consumable gudang
          </div>

          <div style={{marginBottom:14}}>
            <div style={{fontSize:10,fontWeight:800,color:T.primary,letterSpacing:".12em",textTransform:"uppercase",marginBottom:6}}>Username</div>
            <div className="login-ifield-wrap">
              <span className="login-ifield-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
              </span>
              <input className="ifield" type="text" placeholder="Masukkan username"
                value={loginForm.username} onChange={e=>setLoginForm({...loginForm,username:e.target.value})}
                onKeyDown={e=>e.key==="Enter"&&login()}/>
            </div>
          </div>

          <div style={{marginBottom:22}}>
            <div style={{fontSize:10,fontWeight:800,color:T.primary,letterSpacing:".12em",textTransform:"uppercase",marginBottom:6}}>Password</div>
            <div className="login-ifield-wrap" style={{position:"relative"}}>
              <span className="login-ifield-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </span>
              <input className="ifield" type={showLoginPassword?"text":"password"} placeholder="Masukkan password"
                style={{paddingRight:76}}
                value={loginForm.password} onChange={e=>setLoginForm({...loginForm,password:e.target.value})}
                onKeyDown={e=>e.key==="Enter"&&login()}/>
              <button type="button" onClick={()=>setShowLoginPassword(v=>!v)}
                style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",border:"none",background:"transparent",fontSize:12,fontWeight:700,color:T.primary,cursor:"pointer",padding:"4px 2px"}}>
                {showLoginPassword?"Tutup":"Lihat"}
              </button>
            </div>
          </div>

          <button className="login-btn" onClick={login}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Masuk ke Dashboard
          </button>

          <div className="login-divider">
            <span style={{fontSize:11,color:T.muted,fontWeight:600}}>atau</span>
          </div>

          <div style={{textAlign:"center",fontSize:12,color:T.muted,display:"flex",alignItems:"center",justifyContent:"center",gap:6,fontWeight:500}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{color:T.primary}}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Gunakan akun yang telah diberikan
          </div>
        </div>
      </div>
      {toast&&<div className="toast" style={{background:toast.type==="err"?T.redBg:T.greenBg,border:`1px solid ${toast.type==="err"?T.redBorder:T.greenBorder}`,color:toast.type==="err"?T.redText:T.greenText}}>
        <span>{toast.type==="err"?"✕":"✓"}</span>{toast.msg}
      </div>}
      <BusyOverlay/>
    </div>
  );

  // ── MAIN APP ──────────────────────────────────────────────────────
  return(
    <div style={{background:T.bg,minHeight:"100vh",position:"relative",color:T.text}}>
      <style>{CSS}</style>
      <Blobs/>
      <div className="shell">
        {sidebar&&<div className="backdrop-mob" onClick={()=>setSidebar(false)}/>}

        {/* SIDEBAR */}
        <aside className={`sidebar${sidebar?" open":""}${sidebarCollapsed?" collapsed":""}`}>
          <div className="sb-inner">
            <button className="brand" onClick={()=>{setTab("dashboard");setSidebar(false);}} style={{width:"100%",border:"none",background:"transparent",cursor:"pointer",transition:"all .2s",borderRadius:8}} onMouseEnter={e=>{e.currentTarget.style.opacity="0.8"}} onMouseLeave={e=>{e.currentTarget.style.opacity="1"}}>
              <div className="brand-logo"><img src={dark?"/tokki-logo dark mode.png":"/tokki-logo.png"} alt="Tokki" style={{width:"100%",height:"100%",objectFit:"contain"}}/></div>
              <div style={{minWidth:0}}>
                <div style={{fontSize:16,fontWeight:900,color:T.primaryLight,lineHeight:1.2}}>Warehouse</div>
                <div style={{fontSize:9,color:T.muted,letterSpacing:".12em",textTransform:"uppercase",fontWeight:700,marginTop:2}}>Consumable Sys</div>
              </div>
            </button>
            <div className="sb-nav-scroll">
            <div className="nav-label">Menu Utama</div>
            {visibleTabs.map(t=>(
              <button key={t.id} className={`nav-item${tab===t.id?" active":""}`} onClick={()=>{setTab(t.id);setSidebar(false);}}>
                <span className="nav-icon">{t.icon}</span><span className="nav-text">{t.label}</span>
                {t.id==="transaction"&&todayTrx.length>0&&<span className="nav-pill">{todayTrx.length}</span>}
                {t.id==="history"&&pendingApprovalCount>0&&<span className="nav-pill">{pendingApprovalCount}</span>}
              </button>
            ))}
            <button className="nav-item mobile-logout" onClick={logout}>
              <span className="nav-icon">⎋</span><span className="nav-text">Keluar Akun</span>
            </button>
            </div>
            <div className="sb-footer">
              <div className="sb-user-row" style={{display:"flex",alignItems:"center",gap:9,padding:"8px 6px"}}>
                <div style={{width:32,height:32,borderRadius:9,background:`linear-gradient(135deg,${T.primary},${T.primaryLight})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:"white",flexShrink:0}}>
                  {(user?.username||"A")[0].toUpperCase()}
                </div>
                <div className="sb-user-meta" style={{minWidth:0}}>
                  <div style={{fontSize:12.5,fontWeight:700,color:T.text}}>{user?.username||"Admin"}</div>
                  <div style={{fontSize:10,color:T.green,fontWeight:700}}>● Online · {(user?.role||"operator").toLowerCase()}</div>
                </div>
              </div>
              <button className="sb-logout-btn" onClick={logout} title="Keluar" style={{marginTop:8,width:"100%",padding:"9px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:10,fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:12,fontWeight:700,color:T.muted,cursor:"pointer",transition:"all .2s"}}
                onMouseEnter={e=>{e.currentTarget.style.background=T.redBg;e.currentTarget.style.borderColor=T.redBorder;e.currentTarget.style.color=T.redText;}}
                onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.borderColor=T.border;e.currentTarget.style.color=T.muted;}}>
                <span className="sb-logout-text">Keluar →</span>
                <span aria-hidden="true" style={{display:sidebarCollapsed?"inline":"none"}}>⎋</span>
              </button>
            </div>
          </div>
        </aside>

        {/* MAIN */}
        <div className="main">
          {/* TOPBAR */}
          <header className="topbar">
            <div style={{display:"flex",alignItems:"center",gap:10,flex:1,minWidth:0}}>
              <button className="tb-btn" style={{padding:"7px 10px",flexShrink:0}} onClick={()=>{if(window.innerWidth<=660){setSidebar(v=>!v);}else{setSidebarCollapsed(v=>!v);}}}>
                <svg width="15" height="12" viewBox="0 0 15 12" fill="none"><rect width="15" height="1.5" rx="1" fill="currentColor"/><rect y="5.25" width="15" height="1.5" rx="1" fill="currentColor"/><rect y="10.5" width="15" height="1.5" rx="1" fill="currentColor"/></svg>
              </button>
              <h1 className="page-title">{TABS.find(t=>t.id===tab)?.label||"Dashboard"}</h1>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
              {isAdmin&&tab!=="login"&&(
                <button className="tb-btn tb-backup" onClick={downloadBackupData} style={{fontWeight:700}}>
                  ⬇ Backup
                </button>
              )}
              {isAdmin&&tab!=="login"&&(
                <button className="tb-btn tb-restore" onClick={()=>restoreInputRef.current?.click()} style={{fontWeight:700}}>
                  ⤴ Restore
                </button>
              )}
              {isAdmin&&tab!=="login"&&(
                <button className="tb-btn tb-reset-dummy" onClick={resetDummyData} style={{fontWeight:700}}>
                  ♻ Reset Dummy
                </button>
              )}
              <input ref={restoreInputRef} type="file" accept="application/json,.json" style={{display:"none"}} onChange={restoreBackupData}/>
              <Toggle/>
              {/* NOTIF */}
              <div className="notif-wrap" ref={notifRef}>
                {(()=>{
                  const unread=notifHistory.filter(n=>!n.read).length;
                  const totalBadge=unread+lowStock.length;
                  return(
                    <button className="tb-btn" onClick={()=>setNotif(!notif)} style={{position:"relative",padding:"7px 12px"}}>
                      🔔
                      {totalBadge>0&&<span style={{position:"absolute",top:-3,right:-3,background:unread>0?"#f59e0b":T.red,color:"white",fontSize:9,fontWeight:800,borderRadius:"50%",width:16,height:16,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>{totalBadge}</span>}
                    </button>
                  );
                })()}
                {notif&&(
                  <div className="notif-drop" style={{width:320}}>
                    <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`,background:T.surface,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div style={{fontSize:13,fontWeight:800,...gText()}}>Notifikasi</div>
                      <div style={{display:"flex",gap:6}}>
                        {notifTab==="notif"&&notifHistory.filter(n=>!n.read).length>0&&(
                          <button onClick={()=>{const marked=notifHistory.map(n=>({...n,read:true}));setNotifHistory(marked);localStorage.setItem("wms_notif_history",JSON.stringify(marked));}} style={{fontSize:10,fontWeight:700,background:"transparent",border:`1px solid ${T.border}`,borderRadius:6,padding:"2px 8px",color:T.muted,cursor:"pointer"}}>Baca semua</button>
                        )}
                        {notifTab==="notif"&&notifHistory.length>0&&(
                          <button onClick={()=>{setNotifHistory([]);localStorage.removeItem("wms_notif_history");}} style={{fontSize:10,fontWeight:700,background:"transparent",border:`1px solid ${T.border}`,borderRadius:6,padding:"2px 8px",color:T.red,cursor:"pointer"}}>Hapus</button>
                        )}
                      </div>
                    </div>
                    <div style={{display:"flex",borderBottom:`1px solid ${T.border}`}}>
                      {[{id:"notif",label:"Aktivitas",badge:notifHistory.filter(n=>!n.read).length},{id:"stok",label:"Alert Stok",badge:lowStock.length}].map(tb=>(
                        <button key={tb.id} onClick={()=>setNotifTab(tb.id)} style={{flex:1,padding:"9px 0",fontSize:11.5,fontWeight:700,background:"transparent",border:"none",cursor:"pointer",color:notifTab===tb.id?T.primary:T.muted,borderBottom:notifTab===tb.id?`2px solid ${T.primary}`:`2px solid transparent`,transition:"all .15s",display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
                          {tb.label}{tb.badge>0&&<span style={{background:tb.id==="notif"?"#f59e0b":T.red,color:"white",fontSize:9,fontWeight:800,borderRadius:999,padding:"1px 5px",minWidth:14,textAlign:"center"}}>{tb.badge}</span>}
                        </button>
                      ))}
                    </div>
                    {notifTab==="notif"&&(
                      <div style={{maxHeight:280,overflowY:"auto"}}>
                        {notifHistory.length===0
                          ?<div style={{padding:"24px 16px",textAlign:"center",color:T.muted,fontSize:12}}><div style={{fontSize:28,marginBottom:8}}>🔕</div>Belum ada notifikasi</div>
                          :notifHistory.map(n=>{
                            const fmtTs=(iso)=>{try{const d=new Date(iso);return d.toLocaleDateString("id-ID",{day:"2-digit",month:"short"})+" "+d.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"});}catch{return "";}};
                            return(
                              <div key={n.id} onClick={()=>{setNotifHistory(prev=>{const next=prev.map(x=>x.id===n.id?{...x,read:true}:x);localStorage.setItem("wms_notif_history",JSON.stringify(next));return next;});}} style={{padding:"10px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",gap:10,alignItems:"flex-start",cursor:"pointer",background:n.read?"transparent":dark?"rgba(245,158,11,.07)":"rgba(245,158,11,.06)",transition:"background .15s"}}>
                                <div style={{width:8,height:8,borderRadius:"50%",background:n.read?T.border:n.type==="err"?T.red:"#f59e0b",marginTop:5,flexShrink:0}}/>
                                <div style={{flex:1,minWidth:0}}>
                                  <div style={{fontSize:12,fontWeight:n.read?500:700,color:T.text,lineHeight:1.4}}>{n.msg}</div>
                                  <div style={{fontSize:10.5,color:T.muted,marginTop:3}}>{fmtTs(n.ts)}</div>
                                </div>
                              </div>
                            );
                          })
                        }
                      </div>
                    )}
                    {notifTab==="stok"&&(
                      <div style={{maxHeight:280,overflowY:"auto"}}>
                        {lowStock.length===0
                          ?<div style={{padding:"24px 16px",textAlign:"center",color:T.muted,fontSize:12}}><div style={{fontSize:28,marginBottom:8}}>✅</div>Semua stok aman</div>
                          :lowStock.map(it=>{const s=stockStatus(it);return(
                            <div key={it.id} style={{padding:"10px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:10}}>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:12,fontWeight:700,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{it.name}</div>
                                <div style={{fontSize:10.5,color:T.muted,marginTop:1}}>Sisa {it.stock} / min {it.minStock} {it.unit}</div>
                                <Prog pct={it.minStock?it.stock/it.minStock*100:0} color={s.dot}/>
                              </div>
                              <Badge bg={s.bg} color={s.text} border={s.border}>{s.label}</Badge>
                            </div>
                          );})
                        }
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="tb-btn date-btn" style={{cursor:"default",userSelect:"none",fontSize:11,display:"var(--date-display,inline-flex)"}}>📅 {todayFmt()}</div>
              <button className="tb-btn tb-logout" onClick={logout} title="Keluar akun" style={{padding:"7px 10px"}}>⎋ Keluar</button>
            </div>
          </header>

          <main className="body-area enter">

            {/* ══ DASHBOARD ══ */}
            {tab==="dashboard"&&(
              <div>
                <div className="dash-hero">
                  <div className="dash-hero-content">
                    <div className="dash-hero-copy">
                      <div style={{display:"inline-flex",alignItems:"center",gap:6,background:T.navActive,border:`1px solid ${T.navActiveBorder}`,borderRadius:999,padding:"4px 12px",fontSize:10.5,fontWeight:800,color:T.navActiveText,marginBottom:10}}>🏭 Sistem Gudang Aktif</div>
                      <div className="dash-hero-title">Ringkasan Hari Ini</div>
                      <div style={{fontSize:12,color:T.muted,fontWeight:600,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginTop:4}}>
                        <span>📅 {todayFmt()}</span>
                        <span style={{color:T.primary}}>•</span>
                        <span><b style={{color:T.primaryLight}}>{todayTrx.length}</b> transaksi</span>
                        <span style={{color:T.primary}}>•</span>
                        <span><b style={{color:T.primaryLight}}>{todayUnits}</b> unit keluar</span>
                      </div>
                    </div>
                    <BtnP onClick={()=>setShowModal(true)} className="dash-hero-btn">＋ Catat Pengambilan</BtnP>
                    <div className="dash-hero-illus" aria-hidden="true">
                      <div className="dash-box b1"/>
                      <div className="dash-box b2"/>
                      <div className="dash-box b3"/>
                      <div className="dash-box b4"/>
                    </div>
                  </div>
                </div>

                {/* Insight cards */}
                <div className="dash-insight-g">
                  {[
                    {icon:"⚠️",bg:dark?"rgba(245,158,11,0.12)":T.amberBg,label:"Barang Menipis",val:`${dashStockMenipis} Item`,sub:"Stok menipis, belum habis",color:T.amber,onClick:()=>openStockWithFilter("Menipis")},
                    {icon:"📈",bg:T.greenBg,label:"Barang Paling Sering Keluar",val:dashTopItemName,sub:`${dashTopItemQty} pcs dalam 7 hari terakhir`,color:T.primaryLight,onClick:null},
                    {icon:"🚨",bg:dark?"rgba(239,68,68,0.14)":"#fee2e2",label:"Stok Habis",val:`${dashStockHabis} Item`,sub:"Perlu restock segera",color:T.red,onClick:()=>openStockWithFilter("Habis")},
                    {icon:"🕐",bg:dark?"rgba(167,139,250,0.12)":"#ede9fe",label:"Total Item",val:`${items.length} Item`,sub:"Semua item dalam inventaris",color:"#a78bfa",onClick:null},
                  ].map((c,i)=>(
                    <div key={i} className="stat-card" style={{display:"flex",alignItems:"flex-start",gap:12,cursor:c.onClick?"pointer":"default"}} onClick={c.onClick||undefined}>
                      <div style={{width:38,height:38,borderRadius:10,background:c.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{c.icon}</div>
                      <div style={{minWidth:0,flex:1}}>
                        <div style={{fontSize:11,color:T.muted,marginBottom:4,fontWeight:600}}>{c.label}</div>
                        <div style={{fontSize:14,fontWeight:800,color:c.color,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden",lineHeight:1.25,marginBottom:2}}>{c.val}</div>
                        <div style={{fontSize:11,color:T.muted}}>{c.sub}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Charts 3-col */}
                {(()=>{
                  const R=42,C2=2*Math.PI*R;
                  const dTotal=dashStockAman+dashStockMenipis+dashStockHabis||1;
                  const donutSegs=[
                    {label:"Aman",count:dashStockAman,color:"#10b981",sub:"> Min Stok"},
                    {label:"Menipis",count:dashStockMenipis,color:"#f59e0b",sub:"≤ Min Stok"},
                    {label:"Habis",count:dashStockHabis,color:"#ef4444",sub:"Stok = 0"},
                  ];
                  let cumLen=0;
                  const renderedSegs=donutSegs.map(s=>{
                    const len=(s.count/dTotal)*C2;
                    const da=`${len} ${C2-len}`;
                    const doff=-cumLen;
                    cumLen+=len;
                    return {...s,color:s.color,da,doff};
                  });
                  const svgW=220,svgH=72;
                  const chartDateFontSize=(typeof window!=="undefined"&&window.innerWidth>=1500)?5.2:6.1;
                  const maxQty=Math.max(...dashLast7OutQty,1);
                  const linePoints=dashLast7OutQty.map((v,i)=>`${(i/6)*svgW},${svgH-(v/maxQty)*svgH*0.85}`).join(" ");
                  const areaPoints=`0,${svgH} ${linePoints} ${svgW},${svgH}`;
                  const activeTrendPoint=dashTrendPointIdx>=0?{
                    idx:dashTrendPointIdx,
                    label:dashLast7Days[dashTrendPointIdx],
                    value:dashLast7OutQty[dashTrendPointIdx],
                    x:(dashTrendPointIdx/6)*svgW,
                    y:svgH-(dashLast7OutQty[dashTrendPointIdx]/maxQty)*svgH*0.85,
                  }:null;
                  const activeDonutSeg=dashDonutSegIdx>=0?renderedSegs[dashDonutSegIdx]:null;
                  return(
                    <div className="dash-charts-g">
                      {/* Donut ringkasan stok */}
                      <div className="card" style={{display:"flex",flexDirection:"column"}} onMouseLeave={()=>setDashDonutSegIdx(-1)}>
                        <div style={{fontSize:14,fontWeight:700,color:T.text,marginBottom:14}}>Ringkasan Stok</div>
                        <div style={{display:"flex",alignItems:"center",gap:18,flex:1}}>
                          <div style={{position:"relative",width:150,height:150,flexShrink:0}}>
                            <svg width="150" height="150" viewBox="0 0 100 100">
                              <circle cx="50" cy="50" r={R} fill="none" stroke={T.border} strokeWidth="13"/>
                              {renderedSegs.map((s,i)=>{
                                const isActive=i===dashDonutSegIdx;
                                return (
                                  <g key={i}>
                                    <circle cx="50" cy="50" r={R} fill="none" stroke={s.color} strokeWidth={isActive?15:13} strokeDasharray={s.da} strokeDashoffset={s.doff} transform="rotate(-90 50 50)" style={{transition:"stroke-width .18s ease, opacity .18s ease",opacity:dashDonutSegIdx===-1||isActive?1:0.45}}/>
                                    <circle
                                      cx="50"
                                      cy="50"
                                      r={R}
                                      fill="none"
                                      stroke="transparent"
                                      strokeWidth="24"
                                      strokeDasharray={s.da}
                                      strokeDashoffset={s.doff}
                                      transform="rotate(-90 50 50)"
                                      onMouseEnter={()=>setDashDonutSegIdx(i)}
                                      onMouseDown={()=>setDashDonutSegIdx(i)}
                                      onTouchStart={()=>setDashDonutSegIdx(i)}
                                      onClick={()=>setDashDonutSegIdx(i)}
                                      style={{cursor:"pointer"}}
                                    />
                                  </g>
                                );
                              })}
                            </svg>
                            <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",textAlign:"center",pointerEvents:"none"}}>
                              {activeDonutSeg?(
                                <div style={{fontSize:9.5,color:activeDonutSeg.color,lineHeight:1.1,fontWeight:800,letterSpacing:0.1,marginBottom:3}}>{activeDonutSeg.label}</div>
                              ):(
                                <div style={{fontSize:9.2,color:T.muted,lineHeight:1.12,fontWeight:800,letterSpacing:0.1,marginBottom:3}}>
                                  <div>Total Stok</div>
                                  <div>Saat Ini</div>
                                </div>
                              )}
                              <div style={{fontSize:18.5,fontWeight:800,color:T.text,lineHeight:1}}>{activeDonutSeg?activeDonutSeg.count.toLocaleString("id-ID"):dashTotalStokPcs.toLocaleString("id-ID")}</div>
                              <div style={{fontSize:10,color:T.muted,lineHeight:1.15,marginTop:2}}>{activeDonutSeg?"item":"pcs"}</div>
                            </div>
                          </div>
                          <div style={{flex:1}}>
                            {renderedSegs.map((l,i)=>(
                              <div key={i} onMouseEnter={()=>setDashDonutSegIdx(i)} onMouseDown={()=>setDashDonutSegIdx(i)} onTouchStart={()=>setDashDonutSegIdx(i)} onClick={()=>setDashDonutSegIdx(i)} style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,fontSize:12,color:T.muted,cursor:"pointer",padding:"2px 0",borderRadius:8,opacity:dashDonutSegIdx===-1||dashDonutSegIdx===i?1:0.65,transition:"opacity .18s ease"}}>
                                <div style={{width:10,height:10,borderRadius:"50%",background:l.color,flexShrink:0,boxShadow:dashDonutSegIdx===i?`0 0 0 4px ${l.color}22`:"none"}}/>
                                <div style={{flex:1}}>{l.label}</div>
                                <div style={{fontWeight:700,color:T.text}}>{l.count}<span style={{fontSize:10,fontWeight:400,color:T.muted,marginLeft:3}}>item</span></div>
                              </div>
                            ))}
                            <div style={{fontSize:10.5,color:T.muted,marginTop:2,minHeight:16}}>{activeDonutSeg?activeDonutSeg.sub:"Tap warna chart untuk detail"}</div>
                          </div>
                        </div>
                        <div style={{fontSize:11,color:T.primary,marginTop:12,cursor:"pointer"}} onClick={()=>openStockWithFilter("Semua")}>Lihat semua stok →</div>
                      </div>
                      {/* Line chart 7 hari */}
                      <div className="card">
                        <div style={{fontSize:14,fontWeight:700,color:T.text,marginBottom:6}}>Trend Keluar (7 Hari Terakhir)</div>
                        <div style={{display:"flex",gap:12,marginBottom:8,fontSize:11,color:T.muted}}>
                          <span style={{display:"flex",alignItems:"center",gap:4}}>
                            <span style={{width:20,height:2,background:T.primary,display:"inline-block",borderRadius:2}}/>Unit Keluar
                          </span>
                        </div>
                        <div style={{position:"relative"}} onMouseLeave={()=>setDashTrendPointIdx(-1)}>
                          {activeTrendPoint&&(
                            <div style={{position:"absolute",left:`${Math.min(Math.max((activeTrendPoint.x/svgW)*100,12),88)}%`,top:0,transform:"translate(-50%,-110%)",background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:"7px 10px",boxShadow:T.shadowSm,zIndex:2,pointerEvents:"none",minWidth:96,textAlign:"center"}}>
                              <div style={{fontSize:10,color:T.muted,fontWeight:700}}>{activeTrendPoint.label?.slice(5).replace("-","/")}</div>
                              <div style={{fontSize:13,fontWeight:800,color:T.primary,marginTop:2}}>{activeTrendPoint.value} unit</div>
                            </div>
                          )}
                          <svg width="100%" viewBox={`0 0 ${svgW} ${svgH+22}`} style={{overflow:"visible",display:"block"}}>
                            {[0,1,2].map(i=>(
                              <line key={i} x1="0" y1={(svgH*0.85/2)*i} x2={svgW} y2={(svgH*0.85/2)*i} stroke={T.border} strokeWidth="0.5" strokeDasharray="4 4"/>
                            ))}
                            <polygon points={areaPoints} fill={dark?"rgba(16,185,129,0.08)":T.greenBg}/>
                            <polyline points={linePoints} fill="none" stroke={T.primary} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
                            {dashLast7OutQty.map((v,i)=>{
                              const pointX=(i/6)*svgW;
                              const pointY=svgH-(v/maxQty)*svgH*0.85;
                              const isActive=i===dashTrendPointIdx;
                              return (
                                <g
                                  key={i}
                                  onMouseEnter={()=>setDashTrendPointIdx(i)}
                                  onMouseDown={()=>setDashTrendPointIdx(i)}
                                  onTouchStart={()=>setDashTrendPointIdx(i)}
                                  onClick={()=>setDashTrendPointIdx(i)}
                                  style={{cursor:"pointer"}}
                                >
                                  <circle cx={pointX} cy={pointY} r="14" fill="transparent" style={{pointerEvents:"all"}}/>
                                  <circle cx={pointX} cy={pointY} r={isActive?5:4} fill={T.primary} stroke={T.card} strokeWidth="2"/>
                                </g>
                              );
                            })}
                            {dashLast7Days.map((d,i)=>(
                              <text key={i} x={(i/6)*svgW} y={svgH+18} textAnchor="middle" fontSize={chartDateFontSize} fill={T.muted}>{d.slice(5).replace("-","/")}</text>
                            ))}
                          </svg>
                        </div>
                        <div style={{fontSize:11,color:T.primary,marginTop:4,cursor:"pointer"}} onClick={()=>setTab("report")}>Lihat laporan lengkap →</div>
                      </div>
                      {/* Status stok */}
                      <div className="card">
                        <div style={{fontSize:14,fontWeight:700,color:T.text,marginBottom:14}}>Status Stok</div>
                        {[
                          {dot:"#10b981",name:"Aman",sub:"> Min Stok",count:dashStockAman,color:T.primaryLight,filter:"Aman"},
                          {dot:"#f59e0b",name:"Menipis",sub:"≤ Min Stok",count:dashStockMenipis,color:"#f59e0b",filter:"Menipis"},
                          {dot:"#ef4444",name:"Habis",sub:"Stok = 0",count:dashStockHabis,color:"#ef4444",filter:"Habis"},
                        ].map((row,i)=>(
                          <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:i<2?`1px solid ${T.border}`:"none"}}>
                            <div style={{display:"flex",alignItems:"center",gap:8}}>
                              <div style={{width:10,height:10,borderRadius:"50%",background:row.dot,flexShrink:0}}/>
                              <div>
                                <div style={{fontSize:13,color:T.text,fontWeight:600}}>{row.name}</div>
                                <div style={{fontSize:11,color:T.muted}}>{row.sub}</div>
                              </div>
                            </div>
                            <div style={{display:"flex",alignItems:"center",gap:8}}>
                              <div style={{fontSize:14,fontWeight:700,color:row.color}}>{row.count} Item</div>
                              <div style={{color:T.primary,fontSize:16,cursor:"pointer",lineHeight:1}} onClick={()=>openStockWithFilter(row.filter)}>›</div>
                            </div>
                          </div>
                        ))}
                        <div style={{fontSize:11,color:T.primary,marginTop:12,cursor:"pointer"}} onClick={()=>openStockWithFilter("Semua")}>Lihat semua item →</div>
                      </div>
                    </div>
                  );
                })()}

                {isAdmin&&(()=>{
                  const apTotal=trx.length;
                  const apPending=pendingApprovalTrx.length;
                  const apApproved=trx.filter(t=>trxApprovalStatus(t)==="approved").length;
                  const apRejected=trx.filter(t=>trxApprovalStatus(t)==="rejected").length;
                  const cutoff30d=Date.now()-30*24*60*60*1000;
                  const resolved=trx.filter(t=>trxApprovalStatus(t)!=="pending"&&t.approvedAt&&new Date(t.approvedAt).getTime()>=cutoff30d);
                  const avgSlaMs=resolved.length>0?resolved.reduce((sum,t)=>{
                    const created=Number(t.id)||0;
                    const resolvedAt=t.approvedAt?new Date(t.approvedAt).getTime():0;
                    const diff=resolvedAt-created;
                    return sum+(diff>0?diff:0);
                  },0)/resolved.length:0;
                  const avgApprovalTimeLabel=(()=>{
                    if(resolved.length===0) return "Belum ada data";
                    if(avgSlaMs<60000) return "Kurang dari 1 menit";
                    const totalMinutes=Math.round(avgSlaMs/60000);
                    const days=Math.floor(totalMinutes/(60*24));
                    const hours=Math.floor((totalMinutes%(60*24))/60);
                    const minutes=totalMinutes%60;
                    if(days>0) return `${days} hari ${hours} jam`;
                    if(hours>0) return `${hours} jam ${minutes} menit`;
                    return `${minutes} menit`;
                  })();
                  return(
                    <div style={{marginBottom:20}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                        <div style={{fontSize:12,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:".08em"}}>📊 Approval Overview</div>
                        <button className="tb-btn" onClick={()=>{setTab("history");setHistoryTab("approval");}} style={{fontSize:11,padding:"5px 11px"}}>Lihat approval →</button>
                      </div>
                      <div className="approval-ov-g" style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:14,marginBottom:0}}>
                        {[
                          {label:"Total Pengajuan",val:String(apTotal),sub:"semua transaksi",dot:T.primary,icon:"📋"},
                          {label:"Pending",val:String(apPending),sub:"menunggu approval",dot:apPending>0?"#f59e0b":T.muted,icon:"⏳"},
                          {label:"Disetujui",val:String(apApproved),sub:"approved",dot:"#10b981",icon:"✅"},
                          {label:"Ditolak",val:String(apRejected),sub:"rejected",dot:apRejected>0?T.red:T.muted,icon:"❌"},
                          {label:"Rata-rata Waktu Approval",val:avgApprovalTimeLabel,sub:"pengajuan yang sudah diproses dalam 30 hari terakhir",dot:"#6366f1",icon:"⏱"},
                        ].map((s,i)=>(
                          <div key={i} className="stat-card" style={{padding:"16px 18px",minWidth:0}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                              <div style={{display:"flex",flexDirection:"column",gap:6,flex:1,minWidth:0}}>
                                <div style={{display:"flex",alignItems:"center",gap:8}}>
                                  <div className="dash-stat-icon" style={{flexShrink:0}}>{s.icon}</div>
                                  <div style={{fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:".04em",lineHeight:1.3}}>{s.label}</div>
                                </div>
                                <div style={{fontSize:"clamp(18px,2.5vw,26px)",fontWeight:900,color:T.text,lineHeight:1.1,wordBreak:"break-word"}}>{s.val}</div>
                                <div style={{fontSize:11,color:T.muted,marginTop:2}}>{s.sub}</div>
                              </div>
                              <div style={{width:8,height:8,borderRadius:"50%",background:s.dot,boxShadow:`0 0 8px ${s.dot}`,marginLeft:8,marginTop:4,flexShrink:0}}/>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {isAdmin&&(
                  <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:"14px 18px",marginBottom:20,display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
                    <div style={{fontSize:13,fontWeight:700,color:T.text,flexShrink:0}}>⚙️ Auto-reject pending</div>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                      <input
                        type="number" min={1} max={720} value={autoRejectInput}
                        onChange={e=>setAutoRejectInput(e.target.value)}
                        onKeyDown={e=>{if(e.key==="Enter")saveAutoRejectSetting();}}
                        style={{width:72,padding:"5px 9px",borderRadius:7,border:`1px solid ${T.border}`,background:T.card,color:T.text,fontSize:13,fontWeight:700,textAlign:"center"}}
                      />
                      <span style={{fontSize:12,color:T.muted,fontWeight:600}}>jam sejak dibuat</span>
                      <button
                        className="tb-btn" disabled={autoRejectSaving}
                        onClick={saveAutoRejectSetting}
                        style={{fontSize:11,padding:"5px 13px",opacity:autoRejectSaving?0.6:1}}
                      >{autoRejectSaving?"Menyimpan...":"Simpan"}</button>
                    </div>
                    <div style={{fontSize:11,color:T.muted,marginLeft:"auto"}}>Sekarang: <b style={{color:T.primary}}>{autoRejectHours} jam</b></div>
                  </div>
                )}

                {/* Tables 2-col */}
                <div className="dash-tables-g">
                  {/* Barang Hampir Habis */}
                  <div className="card">
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                      <div style={{fontSize:14,fontWeight:700,color:T.text}}>Barang yang Perlu Restock</div>
                      <span style={{padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:700,background:T.amberBg,color:T.amber,border:`1px solid ${T.amberBorder}`}}>{lowStock.length} Item</span>
                    </div>
                    {lowStock.length===0
                      ?<div style={{textAlign:"center",padding:"24px 0",color:T.muted}}><div style={{fontSize:28,marginBottom:6}}>✅</div>Semua stok aman</div>
                      :(<>
                        <div className="dash-low-hdr" style={{borderBottom:`1px solid ${T.border}`,color:T.muted}}>
                          <span>Item</span><span>Stok</span><span>Min Stok</span><span className="dash-col-satuan">Satuan</span>
                        </div>
                        {lowStock.slice(0,4).map(it=>{const s=stockStatus(it);return(
                          <div key={it.id} className="dash-low-row" style={{borderBottom:`1px solid ${T.border}`,color:T.muted}}>
                            <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>
                              <div style={{width:28,height:28,borderRadius:6,background:T.navActive,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0}}>📦</div>
                              <div style={{minWidth:0}}>
                                <div style={{fontSize:12,fontWeight:600,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{it.name}</div>
                                <div style={{fontSize:10,color:T.muted}}>{it.category||""}</div>
                              </div>
                            </div>
                            <span style={{color:s.dot,fontWeight:700}}>{it.stock}</span>
                            <span>{it.minStock}</span>
                            <span className="dash-col-satuan">{it.unit}</span>
                          </div>
                        );})}
                        <div style={{fontSize:11,color:T.primary,marginTop:12,cursor:"pointer"}} onClick={()=>openStockWithFilter("Menipis")}>Lihat semua barang yang perlu restock →</div>
                      </>)
                    }
                  </div>
                  {/* Barang Terakhir Diterima */}
                  <div className="card">
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                      <div style={{fontSize:14,fontWeight:700,color:T.text}}>Barang Terakhir Diterima</div>
                      <span style={{padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:700,background:T.navActive,color:T.navActiveText,border:`1px solid ${T.navActiveBorder}`}}>{dashRecentReceives.length} Item</span>
                    </div>
                    {dashRecentReceives.length===0
                      ?<div style={{textAlign:"center",padding:"24px 0",color:T.muted}}><div style={{fontSize:28,marginBottom:6}}>📭</div>Belum ada penerimaan</div>
                      :(<>
                        <div className="dash-recv-hdr" style={{borderBottom:`1px solid ${T.border}`,color:T.muted}}>
                          <span>Item</span><span>Jumlah</span><span>Tanggal</span><span className="dash-col-oleh">Oleh</span>
                        </div>
                        {dashRecentReceives.map((r,i)=>(
                          <div key={r.id} className="dash-recv-row" style={{borderBottom:i<dashRecentReceives.length-1?`1px solid ${T.border}`:"none",color:T.muted}}>
                            <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>
                              <div style={{width:28,height:28,borderRadius:6,background:T.navActive,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0}}>📥</div>
                              <div style={{minWidth:0}}>
                                <div style={{fontSize:12,fontWeight:600,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.itemName}</div>
                                <div style={{fontSize:10,color:T.muted}}>{r.category||""}</div>
                              </div>
                            </div>
                            <span style={{color:T.text,fontWeight:600}}>{r.qty} {r.unit||"pcs"}</span>
                            <div>
                              <div style={{color:T.text,fontSize:11}}>{r.date||""}</div>
                              <div style={{fontSize:10,color:T.muted}}>{r.time||""}</div>
                            </div>
                            <span className="dash-col-oleh" style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.admin||r.receivedBy||"-"}</span>
                          </div>
                        ))}
                        <div style={{fontSize:11,color:T.primary,marginTop:12,cursor:"pointer"}} onClick={()=>{setTab("history");setHistoryTab("in");}}>Lihat riwayat penerimaan →</div>
                      </>)
                    }
                  </div>
                </div>

                {/* Footer bar */}
                <div className="dash-footer-g">
                  {[
                    {icon:"📅",label:"Update Terakhir",val:todayFmt()},
                    {icon:"🔄",label:"Total Transaksi Hari Ini",val:`${todayTrx.length} Transaksi`},
                    {icon:"💰",label:"Total Nilai Stok (Est.)",val:fmtMoney(dashTotalNilaiStok)},
                  ].map((f,i)=>(
                    <div key={i} className="stat-card" style={{display:"flex",alignItems:"center",gap:12}}>
                      <div style={{width:36,height:36,borderRadius:8,background:T.greenBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{f.icon}</div>
                      <div>
                        <div style={{fontSize:11,color:T.muted,marginBottom:3}}>{f.label}</div>
                        <div style={{fontSize:14,fontWeight:700,color:T.primary}}>{f.val}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ══ PENGAMBILAN ══ */}
            {tab==="transaction"&&(
              <div>
                {/* ── Panel header ── */}
                <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:16,padding:"16px 20px",marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between",gap:14,flexWrap:"wrap",boxShadow:T.shadowSm}}>
                  <div style={{display:"flex",alignItems:"center",gap:14}}>
                    <div style={{width:48,height:48,borderRadius:14,background:`linear-gradient(135deg,${T.primary},${T.primaryLight})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0,boxShadow:`0 8px 20px ${T.primaryGlow}`}}>📤</div>
                    <div>
                      <div style={{fontSize:16,fontWeight:900,color:T.text,lineHeight:1.2}}>Catat Pengambilan Barang</div>
                      <div style={{fontSize:12,color:T.muted,marginTop:3,fontWeight:500}}>Catat pengambilan barang oleh karyawan. Satu transaksi bisa beberapa barang.</div>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {isAdmin&&<BtnG onClick={exportTransactionsExcel} style={{fontWeight:700,display:"flex",alignItems:"center",gap:6}}>{EXCEL_ICON}Excel</BtnG>}
                    {isAdmin&&<BtnG onClick={exportTransactionsPdf} style={{fontWeight:700,display:"flex",alignItems:"center",gap:6}}>{PDF_ICON}PDF</BtnG>}
                    <button onClick={()=>{setReturForm(emptyReturForm());setShowRetur(true);}} style={{padding:"12px 18px",borderRadius:14,fontWeight:800,fontSize:13,fontFamily:"'Plus Jakarta Sans',sans-serif",border:`1.5px solid ${T.amber}`,background:T.amberBg,color:T.amber,cursor:"pointer"}}>↩ Catat Retur</button>
                    <BtnP onClick={()=>setShowModal(true)} style={{flexShrink:0,padding:"12px 20px",borderRadius:14,fontWeight:800}}>＋ Catat Pengambilan</BtnP>
                  </div>
                </div>

                {/* ── Sub-tabs ── */}
                <div style={{display:"flex",gap:4,background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:4,marginBottom:14,overflowX:"auto",WebkitOverflowScrolling:"touch",scrollbarWidth:"none"}}>
                  {[
                    {id:"log",icon:"📤",label:`Log Pengambilan (${trx.length})`},
                    {id:"retur",icon:"↩",label:`Retur Barang (${returns.length})`},
                  ].map(tb=>(
                    <button key={tb.id} onClick={()=>setReturSubTab(tb.id)} style={{padding:"9px 18px",borderRadius:9,border:"none",fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:12,fontWeight:700,cursor:"pointer",transition:"all .2s",background:returSubTab===tb.id?T.primary:"transparent",color:returSubTab===tb.id?"white":T.muted,boxShadow:returSubTab===tb.id?`0 4px 12px ${T.primaryGlow}`:"none",whiteSpace:"nowrap",flexShrink:0}}>{tb.icon} {tb.label}</button>
                  ))}
                </div>

                {/* ── Sub-tab: LOG PENGAMBILAN ── */}
                {returSubTab==="log"&&(
                  <div>
                  <div className="fbar">
                  <span style={{fontSize:11.5,color:T.muted,fontWeight:700,flexShrink:0}}>Filter tanggal:</span>
                  <input type="date" className="ifield" value={trxDate} onChange={e=>setTrxDate(e.target.value)} style={{width:180}}/>
                  {trxDate&&<BtnG style={{fontSize:11.5,padding:"7px 12px"}} onClick={()=>setTrxDate("")}>✕ Reset</BtnG>}
                  <span style={{marginLeft:"auto",fontSize:11.5,color:T.muted}}>{filtTrx.length} transaksi</span>
                  </div>
                {filtTrx.length===0
                  ?<div style={{textAlign:"center",padding:"60px 0",color:T.muted}}><div style={{fontSize:36,marginBottom:12}}>📂</div>Tidak ada transaksi ditemukan</div>
                  :filtTrx.map(t=>(
                    <div key={t.id} className="trx-card">
                      <div className="trx-head">
                        {/* Avatar */}
                        <div style={{width:44,height:44,borderRadius:"50%",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",background:avatarColor(t.taker),color:"white",fontWeight:800,fontSize:14,letterSpacing:".5px",marginTop:1,boxShadow:`0 4px 10px ${avatarColor(t.taker)}55`}}>
                          {initials(t.taker)}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13.5,fontWeight:700,color:T.text}}>{t.taker}</div>
                          <div style={{fontSize:11,color:T.muted,marginTop:3}}>{t.dept} · {fmtDate(t.date)} · {t.time}</div>
                          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:9}}>
                            {t.workOrder&&<Badge bg={T.greenBg} color={T.greenText} border={T.greenBorder}>🔧 {t.workOrder}</Badge>}
                            {t.note&&<Badge bg={T.surface} color={T.muted} border={T.border}>📝 {t.note}</Badge>}
                            <Badge bg={T.navActive} color={T.navActiveText} border={T.navActiveBorder}>Admin: {t.admin}</Badge>
                          </div>
                        </div>
                        <div className="trx-stats">
                          <div>
                            <div style={{fontSize:26,fontWeight:900,color:T.primaryLight,lineHeight:1}}>{t.items.length}</div>
                            <div style={{fontSize:10,color:T.muted,fontWeight:600}}>jenis</div>
                            <div style={{fontSize:11.5,fontWeight:700,color:T.green,marginTop:3}}>{t.items.reduce((a,i)=>a+i.qty,0)} unit</div>
                          </div>
                          {isAdmin&&(
                            <button onClick={()=>deleteTransaction(t.id)} style={{marginTop:0,background:T.redBg,border:`1px solid ${T.redBorder}`,color:T.redText,borderRadius:8,padding:"6px 12px",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>🗑 Hapus</button>
                          )}
                        </div>
                      </div>
                      <div className="trx-body">
                        {t.items.map((it,ii)=>(
                          <div key={ii} className="itm-pill">
                            <span style={{fontSize:12,fontWeight:700,color:T.sub}}>{it.itemName}</span>
                            <span style={{fontSize:10.5,fontWeight:800,color:T.navActiveText,background:T.navActive,padding:"1px 7px",borderRadius:5,border:`1px solid ${T.navActiveBorder}`}}>×{it.qty} {it.unit}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  </div>
                )}

                {/* ── Sub-tab: RETUR BARANG ── */}
                {returSubTab==="retur"&&(
                  <div>
                    {/* Summary cards */}
                    <div className="stats-g" style={{marginBottom:16}}>
                      {(()=>{
                        const totalUnit=returns.reduce((a,r)=>a+Number(r.qty||0),0);
                        const pending=returns.filter(r=>r.status==="Menunggu").length;
                        const diterima=returns.filter(r=>r.status==="Diterima").length;
                        return [
                          {label:"Total Retur",val:returns.length,icon:"↩",color:T.amber,bg:T.amberBg,sub:"total catatan"},
                          {label:"Unit Dikembalikan",val:totalUnit,icon:"📦",color:T.green,bg:T.greenBg,sub:"unit barang kembali"},
                          {label:"Diterima",val:diterima,icon:"✅",color:T.primary,bg:T.navActive,sub:"sudah diproses"},
                          {label:"Menunggu",val:pending,icon:"⏳",color:T.red,bg:T.redBg,sub:"menunggu konfirmasi"},
                        ];
                      })().map((s,i)=>(
                        <div key={i} className="stat-card" style={{padding:"16px 18px"}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
                            <div>
                              <div style={{fontSize:10.5,fontWeight:800,color:T.muted,textTransform:"uppercase",letterSpacing:".09em",marginBottom:7}}>{s.label}</div>
                              <div style={{fontSize:26,fontWeight:900,color:T.text,lineHeight:1.2}}>{s.val}</div>
                              <div style={{fontSize:11.5,color:T.muted,marginTop:6}}>{s.sub}</div>
                            </div>
                            <div style={{width:36,height:36,borderRadius:11,background:s.bg,color:s.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:900,border:`1px solid ${T.border}`}}>{s.icon}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Retur list */}
                    {returns.length===0
                      ?<div style={{textAlign:"center",padding:"60px 0",color:T.muted}}><div style={{fontSize:36,marginBottom:12}}>↩</div>Belum ada retur tercatat</div>
                      :[...returns].reverse().map(r=>{
                        const it=itemMap[Number(r.itemId)];
                        const isDiterima=r.status==="Diterima";
                        return(
                          <div key={r.id} style={{display:"flex",alignItems:"stretch",gap:0,background:T.card,border:`1px solid ${T.border}`,borderLeft:`4px solid ${T.amber}`,borderRadius:14,marginBottom:8,overflow:"hidden",boxShadow:T.shadowSm}}>
                            <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"14px 12px",gap:5,minWidth:64,flexShrink:0}}>
                              <div style={{width:40,height:40,borderRadius:"50%",background:T.amberBg,border:`2px solid ${T.amber}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>↩</div>
                              <span style={{fontSize:9,fontWeight:900,letterSpacing:".07em",color:T.amber,textTransform:"uppercase"}}>RETUR</span>
                            </div>
                            <div style={{flex:1,padding:"12px 14px",minWidth:0}}>
                              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:6}}>
                                <span style={{fontSize:13.5,fontWeight:800,color:T.text}}>{r.employee}</span>
                                <span style={{fontSize:10,fontWeight:800,padding:"2px 8px",borderRadius:5,border:`1px solid ${isDiterima?T.greenBorder:T.redBorder}`,background:isDiterima?T.greenBg:T.redBg,color:isDiterima?T.greenText:T.redText}}>{r.status||"Menunggu"}</span>
                              </div>
                              <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:5}}>
                                <span style={{fontSize:12}}>📦</span>
                                <span style={{fontSize:12.5,fontWeight:700,color:T.text}}>{it?.name||r.itemName||`Item #${r.itemId}`}</span>
                                <span style={{fontSize:10.5,fontWeight:800,color:T.navActiveText,background:T.navActive,padding:"1px 8px",borderRadius:5,border:`1px solid ${T.navActiveBorder}`}}>+{r.qty} {it?.unit||"pcs"}</span>
                              </div>
                              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                                <Badge bg={T.amberBg} color={T.amber} border={`1px solid ${T.amber}33`}>📋 {r.reason}</Badge>
                                {r.note&&<Badge bg={T.surface} color={T.muted} border={T.border}>📝 {r.note}</Badge>}
                                <Badge bg={T.surface} color={T.muted} border={T.border}>🗓 {fmtDate(r.date)} {r.time||""}</Badge>
                              </div>
                            </div>
                            {isAdmin&&(
                              <div style={{display:"flex",flexDirection:"column",justifyContent:"center",padding:"0 12px",gap:6,flexShrink:0}}>
                                {!isDiterima&&(
                                  <button onClick={async()=>{
                                    await withLoading(async()=>{
                                      const resp=await apiFetch(`/returns/${r.id}`,{method:"PATCH",body:JSON.stringify({status:"Diterima"})});
                                      if(!resp.ok){const e=await resp.json().catch(()=>({}));toast$(e.error||"Gagal update status","err");return;}
                                      toast$("Status retur diperbarui");fetchAll();
                                    },"Memperbarui...");
                                  }} style={{background:T.greenBg,border:`1px solid ${T.greenBorder}`,color:T.greenText,borderRadius:8,padding:"6px 10px",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>✅ Terima</button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    }
                  </div>
                )}
              </div>
            )}

            {/* ══ STOK ══ */}
            {tab==="stock"&&(
              <div>
                {/* ── Filter bar (with action buttons) ── */}
                <div style={{display:"grid",gap:12,marginBottom:16,padding:"14px",border:`1px solid ${T.border}`,borderRadius:16,background:dark?"linear-gradient(120deg, rgba(3,20,14,0.92), rgba(2,25,18,0.86))":T.surfaceSolid,boxShadow:dark?"0 0 0 1px rgba(16,185,129,0.08), 0 10px 30px rgba(0,0,0,0.35)":T.shadowSm}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
                    <div style={{position:"relative",flex:"1 1 460px",maxWidth:620,minWidth:260}}>
                      <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:14,color:T.muted,pointerEvents:"none"}}>🔍</span>
                      <input className="ifield" placeholder="Cari barang..." value={searchQ} onChange={e=>setSearchQ(e.target.value)} style={{width:"100%",paddingLeft:34}}/>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginLeft:"auto"}}>
                      {canManage&&<BtnG onClick={()=>setShowNewItem(true)} style={{fontSize:13,padding:"8px 16px"}}>＋ Add New Item</BtnG>}
                      {canManage&&<BtnP onClick={()=>setShowAdd(true)} style={{fontSize:13,padding:"8px 16px",fontWeight:500}}>📥 Receive New</BtnP>}
                    </div>
                  </div>

                  <div style={{display:"grid",gap:10,padding:"12px",border:`1px solid ${T.border}`,borderRadius:14,background:dark?"linear-gradient(120deg, rgba(1,26,19,0.88), rgba(1,16,12,0.7))":T.surface}}>
                    <div style={{fontSize:13,fontWeight:700,color:T.primaryLight,display:"flex",alignItems:"center",gap:8}}>⎇ Filter Barang</div>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                      <div style={{fontSize:12,fontWeight:600,color:T.muted,minWidth:60}}>Kategori</div>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                        {CATS.map(c=>{
                          const active=catF===c;
                          return(
                            <button key={c} onClick={()=>setCatF(c)} style={{padding:"7px 14px",borderRadius:12,border:`1px solid ${active?T.primary:T.border}`,background:active?T.primary:T.surfaceSolid,color:active?"#eafdf5":T.text,fontSize:12,fontWeight:600,cursor:"pointer",lineHeight:1.35,whiteSpace:"nowrap"}}>
                              {active?"✓ ":""}{c}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div style={{height:1,background:T.border,opacity:0.7}}/>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                      <div style={{fontSize:12,fontWeight:600,color:T.muted,minWidth:60}}>Status</div>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                        {["Semua","Aman","Mendekati","Menipis","Habis"].map(s=>{
                          const active=stockStatusF===s;
                          const activeStyle=s==="Mendekati"?{bg:"#BA7517",text:"#FAEEDA",border:"#BA7517",icon:"◷"}
                            :s==="Menipis"?{bg:"#D85A30",text:"#FAECE7",border:"#D85A30",icon:"⚠"}
                            :s==="Habis"?{bg:"#A32D2D",text:"#FCEBEB",border:"#A32D2D",icon:"⊗"}
                            :s==="Aman"?{bg:T.primary,text:"#E1F5EE",border:T.primary,icon:"🛡"}
                            :{bg:T.primary,text:"#E1F5EE",border:T.primary,icon:"✓"};
                          const idleIcon=s==="Mendekati"?"◷":s==="Menipis"?"⚠":s==="Habis"?"⊗":s==="Aman"?"🛡":"○";
                          return(
                            <button key={s} onClick={()=>setStockStatusF(s)} style={{padding:"7px 14px",borderRadius:12,border:`1px solid ${active?activeStyle.border:T.border}`,background:active?activeStyle.bg:T.surfaceSolid,color:active?activeStyle.text:T.text,fontSize:12,fontWeight:600,cursor:"pointer",lineHeight:1.35,whiteSpace:"nowrap"}}>
                              {(active?activeStyle.icon:idleIcon)+" "}{s}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",padding:"12px",border:`1px solid ${T.border}`,borderRadius:14,background:dark?"linear-gradient(120deg, rgba(1,22,16,0.88), rgba(1,12,9,0.72))":T.surface}}>
                    <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{fontSize:20,color:T.primaryLight}}>◻</div>
                        <div>
                          <div style={{fontSize:13,fontWeight:700,color:T.primaryLight}}>{filtItems.length} Item</div>
                          <div style={{fontSize:11,color:T.muted}}>Total ditemukan</div>
                        </div>
                      </div>
                      <div style={{width:1,height:34,background:T.border}}/>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{fontSize:20,color:"#f59e0b"}}>⚠</div>
                        <div>
                          <div style={{fontSize:13,fontWeight:700,color:"#f59e0b"}}>{filtMenipisCount} Menipis</div>
                          <div style={{fontSize:11,color:T.muted}}>Stok menipis</div>
                        </div>
                      </div>
                      <div style={{width:1,height:34,background:T.border}}/>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{fontSize:20,color:"#ef4444"}}>⊗</div>
                        <div>
                          <div style={{fontSize:13,fontWeight:700,color:"#ef4444"}}>{filtHabisCount} Habis</div>
                          <div style={{fontSize:11,color:T.muted}}>Stok habis</div>
                        </div>
                      </div>
                    </div>
                    <button onClick={resetStockFilters} style={{fontSize:12,padding:"7px 12px",borderRadius:999,border:`1px solid ${T.border}`,background:"transparent",color:T.primaryLight,cursor:"pointer",display:"flex",alignItems:"center",gap:6,opacity:hasActiveStockFilters?1:0.72}}>↻ Reset Filter</button>
                  </div>
                </div>
                <div className="stock-g">
                  {filtItems.length===0&&<div style={{gridColumn:"1/-1",textAlign:"center",padding:"60px 0",color:T.muted}}><div style={{fontSize:36,marginBottom:12}}>🔍</div>Tidak ada barang ditemukan</div>}
                  {filtItems.map(it=>{
                    const s=stockStatus(it); const cc=catColor(it.category); const pct=it.minStock?Math.min(100,it.stock/it.minStock*100):100;
                    const cardBorder=s.label==="Aman"?cc.dot:s.dot;
                    return(
                      <div key={it.id} className="stk-card" style={{border:`2px solid ${cardBorder}`,gap:0}}>
                        {/* Menu button */}
                        {isAdmin&&(
                          <button onClick={e=>{e.stopPropagation();setEditItem({...it});setShowEdit(true);}}
                            style={{position:"absolute",top:10,right:10,background:"transparent",border:`1px solid ${T.border}`,borderRadius:7,width:28,height:28,cursor:"pointer",fontSize:16,color:T.muted,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s",zIndex:10,lineHeight:1}}
                            onMouseEnter={e=>{e.currentTarget.style.background=T.navActive;e.currentTarget.style.color=T.text;}}
                            onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=T.muted;}}>
                            ⋮
                          </button>
                        )}

                        {/* Photo */}
                        <div style={{width:"100%",height:120,marginBottom:14,borderRadius:10,overflow:"hidden",background:dark?"rgba(0,0,0,0.22)":"rgba(255,255,255,0.65)",border:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                          {it.photo
                            ?<img src={it.photo} alt={it.name} style={{width:"100%",height:"100%",objectFit:"contain"}}/>
                            :<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",background:cc.bg,fontSize:32,opacity:.35}}>📷</div>
                          }
                        </div>

                        {/* Name */}
                        <div style={{fontSize:13.5,fontWeight:800,color:T.text,lineHeight:1.35,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",paddingRight:isAdmin?24:0,marginBottom:4}}>{it.name}</div>
                        {/* Code in category color */}
                        {it.itemCode&&<div style={{fontSize:10.5,fontWeight:700,color:cc.dot,marginBottom:6}}>Kode: {it.itemCode}</div>}
                        {/* Category dot + text */}
                        <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:14}}>
                          <span style={{width:7,height:7,borderRadius:"50%",background:cc.dot,flexShrink:0,display:"inline-block"}}/>
                          <span style={{fontSize:11,color:cc.text,fontWeight:700}}>{it.category}</span>
                        </div>

                        {/* Divider */}
                        <div style={{height:1,background:T.border,marginBottom:12}}/>

                        {/* Stock + status badge inline */}
                        <div style={{display:"flex",alignItems:"flex-start",gap:8,marginBottom:6}}>
                          <div>
                            <span style={{fontSize:34,fontWeight:900,lineHeight:1,color:cardBorder}}>{it.stock}</span>
                            <span style={{fontSize:12,fontWeight:600,color:T.muted,marginLeft:5}}>{it.unit}</span>
                          </div>
                          <Badge bg={s.bg} color={s.text} border={s.border} style={{marginLeft:"auto",fontSize:10,padding:"3px 9px",flexShrink:0,marginTop:4}}>
                            {s.icon} {s.label}
                          </Badge>
                        </div>
                        {/* Min stock */}
                        <div style={{fontSize:11,color:T.muted,fontWeight:600,marginBottom:2}}>Min: {it.minStock} {it.unit}</div>
                        {/* Segmented progress bar */}
                        <ProgBlocks pct={pct} color={cardBorder}/>
                        {/* Percentage text */}
                        <div style={{fontSize:10,color:T.muted,marginBottom:14}}>{Math.round(pct)}% dari kebutuhan minimum</div>

                        {/* Divider */}
                        <div style={{height:1,background:T.border,marginBottom:12}}/>

                        {/* Avg + Last boxes */}
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                          <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,padding:"9px 11px"}}>
                            <div style={{fontSize:9.5,fontWeight:800,color:T.muted,letterSpacing:".06em",textTransform:"uppercase",marginBottom:5}}>Avg</div>
                            <div style={{fontSize:12,fontWeight:800,color:T.text}}>{fmtMoney(it.averageCost)}</div>
                          </div>
                          <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,padding:"9px 11px"}}>
                            <div style={{fontSize:9.5,fontWeight:800,color:T.muted,letterSpacing:".06em",textTransform:"uppercase",marginBottom:5}}>Last</div>
                            <div style={{fontSize:12,fontWeight:800,color:T.text}}>{fmtMoney(it.lastPrice)}</div>
                          </div>
                        </div>

                        {/* Total Value */}
                        <div style={{marginBottom:14}}>
                          <div style={{fontSize:9.5,fontWeight:800,color:T.muted,letterSpacing:".06em",textTransform:"uppercase",marginBottom:4}}>Total Value</div>
                          <div style={{fontSize:15,fontWeight:900,color:T.text}}>{fmtMoney(it.totalValue)}</div>
                        </div>

                        {/* Buttons */}
                        <div style={{display:"flex",gap:8,marginTop:"auto"}}>
                          {isAdmin&&(
                            <button onClick={()=>openQuickIn(it)}
                              style={{flex:1,padding:"9px",fontSize:12,fontWeight:700,borderRadius:10,cursor:"pointer",background:"transparent",color:T.green,border:`1.5px solid ${T.green}`,fontFamily:"'Plus Jakarta Sans',sans-serif",transition:"all .18s",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}
                              onMouseEnter={e=>{e.currentTarget.style.background=T.greenBg;}}
                              onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
                              ↓ Masuk
                            </button>
                          )}
                          <button onClick={()=>openQuickOut(it)}
                            style={{flex:1,padding:"9px",fontSize:12,fontWeight:700,borderRadius:10,cursor:"pointer",background:"transparent",color:T.red,border:`1.5px solid ${T.red}`,fontFamily:"'Plus Jakarta Sans',sans-serif",transition:"all .18s",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}
                            onMouseEnter={e=>{e.currentTarget.style.background=T.redBg;}}
                            onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
                            ↑ Keluar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ══ REPORT ══ */}
            {tab==="report"&&(
              <div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:14}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    <span style={{fontSize:12,fontWeight:800,color:T.muted,letterSpacing:".08em",textTransform:"uppercase"}}>Periode</span>
                    {[
                      {id:"week",label:"Minggu"},
                      {id:"month",label:"Bulan"},
                      {id:"year",label:"Tahun"},
                    ].map(p=>(
                      <button key={p.id} className={`cat-btn${reportPeriod===p.id?" on":""}`} onClick={()=>setReportPeriod(p.id)}>
                        {p.label}
                      </button>
                    ))}
                    <span style={{fontSize:11.5,color:T.muted}}>• {fmtDate(reportRange.start)} - {fmtDate(reportRange.end)}</span>
                  </div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    <BtnG onClick={exportReportExcel} style={{fontWeight:700,display:"flex",alignItems:"center",gap:6}}>{EXCEL_ICON}Export Excel</BtnG>
                    <BtnG onClick={exportReportPdf} style={{fontWeight:700,display:"flex",alignItems:"center",gap:6}}>{PDF_ICON}Export PDF</BtnG>
                  </div>
                </div>

                <div className="stats-g" style={{marginBottom:16}}>
                  {[
                    {label:"Total Keluar",value:`${reportTotalOutUnits.toLocaleString("id-ID")} unit`,sub:"Unit pengambilan",color:T.red,bg:T.redBg,icon:"↗"},
                    {label:"Total Masuk",value:`${reportTotalInUnits.toLocaleString("id-ID")} unit`,sub:"Unit penerimaan",color:T.green,bg:T.greenBg,icon:"↙"},
                    {label:"Nilai Estimasi",value:fmtMoney(Math.round(reportEstimatedValue)),sub:"Keluar + masuk",color:T.primary,bg:T.navActive,icon:"💰"},
                    {label:"Item Kritis",value:`${lowStock.length} item`,sub:"Stok <= minimum",color:T.amber,bg:T.amberBg,icon:"⚠"},
                  ].map((kpi,idx)=>(
                    <div key={idx} className="stat-card" style={{padding:"16px 18px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
                        <div>
                          <div style={{fontSize:10.5,fontWeight:800,color:T.muted,textTransform:"uppercase",letterSpacing:".09em",marginBottom:7}}>{kpi.label}</div>
                          <div style={{fontSize:22,fontWeight:900,color:T.text,lineHeight:1.2}}>{kpi.value}</div>
                          <div style={{fontSize:11.5,color:T.muted,marginTop:6}}>{kpi.sub}</div>
                        </div>
                        <div style={{width:36,height:36,borderRadius:11,background:kpi.bg,color:kpi.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:900,border:`1px solid ${T.border}`}}>
                          {kpi.icon}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="two-col" style={{marginBottom:16}}>
                  <div className="card" style={{padding:"16px 18px",display:"flex",flexDirection:"column"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                      <div className="dash-panel-title">{reportTxnTitle}</div>
                      <div style={{display:"flex",gap:10,fontSize:11.5,color:T.muted,fontWeight:700}}>
                        <span style={{display:"inline-flex",alignItems:"center",gap:6}}><span style={{width:8,height:8,borderRadius:"50%",background:T.red,display:"inline-block"}}/>Keluar</span>
                        <span style={{display:"inline-flex",alignItems:"center",gap:6}}><span style={{width:8,height:8,borderRadius:"50%",background:T.green,display:"inline-block"}}/>Masuk</span>
                      </div>
                    </div>
                    <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"flex-end",minHeight:220}}>
                    {reportTxnSeries.length===0||reportTxnSeries.every(s=>s.out===0&&s.in===0)
                      ?<div style={{padding:"36px 0",textAlign:"center",color:T.muted}}>Belum ada transaksi</div>
                      :(
                        <div style={{display:"grid",gridTemplateColumns:`repeat(${reportTxnSeries.length}, minmax(0, 1fr))`,gap:6,alignItems:"stretch",height:"100%",minHeight:220}}>
                          {reportTxnSeries.map(point=>(
                            <div key={point.key} style={{display:"flex",flexDirection:"column",alignItems:"center",minWidth:0,height:"100%"}}>
                              <div style={{display:"flex",alignItems:"end",gap:2,height:"calc(100% - 20px)",minHeight:0}}>
                                <div title={`Keluar: ${point.out}`} style={{width:8,height:`${Math.max(point.out>0?1.6:0.6,(point.out/reportTxnMax)*55)}%`,background:T.red,borderRadius:"5px 5px 0 0",opacity:0.92}}/>
                                <div title={`Masuk: ${point.in}`} style={{width:8,height:`${Math.max(point.in>0?1.6:0.6,(point.in/reportTxnMax)*55)}%`,background:T.green,borderRadius:"5px 5px 0 0",opacity:0.92}}/>
                              </div>
                              <div style={{fontSize:9,color:T.muted,height:14,marginTop:6,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:"100%",textAlign:"center",flexShrink:0}}>{point.label}</div>
                            </div>
                          ))}
                        </div>
                      )
                    }
                    </div>
                  </div>

                  <div className="card" style={{padding:"16px 18px",display:"flex",flexDirection:"column"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:10,flexWrap:"wrap",flexShrink:0}}>
                      <div>
                        <div className="dash-panel-title" style={{marginBottom:4}}>{reportTrendTitle}</div>
                        <div style={{fontSize:11,color:T.muted}}>{reportTrendSubtitle}{trendSpikeCount>0&&<span style={{marginLeft:8,background:"#fee2e2",color:"#dc2626",borderRadius:999,padding:"2px 8px",fontWeight:800,fontSize:10.5}}>⚡ {trendSpikeCount} lonjakan</span>}</div>
                      </div>
                      <div style={{display:"flex",gap:4,flexShrink:0}}>
                        {([["all","Semua"],["up","Naik"],["down","Turun"],["spike","Lonjakan!"]] as const).map(([id,label])=>(
                          <button key={id} onClick={()=>setTrendFilter(id)} style={{padding:"4px 9px",borderRadius:8,border:"none",fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:10.5,fontWeight:700,cursor:"pointer",background:trendFilter===id?T.primary:"transparent",color:trendFilter===id?"white":T.muted,transition:"all .18s"}}>{label}</button>
                        ))}
                      </div>
                    </div>
                    <div style={{display:"flex",gap:8,fontSize:10.5,marginBottom:10,flexWrap:"wrap"}}>
                      <button onClick={()=>setTrendFilter(trendFilter==="prev"?"all":"prev")} style={{display:"inline-flex",alignItems:"center",gap:5,padding:"3px 8px",borderRadius:8,border:`1px solid ${trendFilter==="prev"?"#10b981":T.border}`,background:trendFilter==="prev"?(dark?"rgba(16,185,129,0.15)":"#d1fae5"):"transparent",color:trendFilter==="prev"?"#059669":T.muted,fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:700,cursor:"pointer",transition:"all .18s"}}><span style={{width:10,height:10,borderRadius:3,background:dark?"rgba(255,255,255,0.22)":"#bbf7d0",display:"inline-block",flexShrink:0}}/>{reportTrendPrevLabel}</button>
                      <button onClick={()=>setTrendFilter(trendFilter==="cur"?"all":"cur")} style={{display:"inline-flex",alignItems:"center",gap:5,padding:"3px 8px",borderRadius:8,border:`1px solid ${trendFilter==="cur"?"#10b981":T.border}`,background:trendFilter==="cur"?(dark?"rgba(16,185,129,0.25)":"#d1fae5"):"transparent",color:trendFilter==="cur"?"#059669":T.muted,fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:700,cursor:"pointer",transition:"all .18s"}}><span style={{width:10,height:10,borderRadius:3,background:"#10b981",display:"inline-block",flexShrink:0}}/>{reportTrendCurrentLabel}</button>
                    </div>
                    {reportMonthlyTrend.length===0
                      ?<div style={{padding:"36px 0",textAlign:"center",color:T.muted}}>Belum ada data pengambilan pada periode ini</div>
                      :(
                        <div style={{overflowY:"auto",paddingRight:4,display:"flex",flexDirection:"column",gap:8,minHeight:0,maxHeight:reportTrendScrollMaxHeight}}>
                          {reportMonthlyTrend.filter(r=>{
                            if(trendFilter==="up") return r.pctChange>0;
                            if(trendFilter==="down") return r.pctChange<0;
                            if(trendFilter==="spike") return r.isSpike;
                            if(trendFilter==="cur") return r.cur>0;
                            if(trendFilter==="prev") return r.prev>0;
                            return true;
                          }).map(row=>{
                            const pctAbs=Math.abs(row.pctChange);
                            const pill=row.isSpike
                              ?{bg:"#fee2e2",c:"#dc2626",sign:"⚡"}
                              :row.pctChange>8
                                ?{bg:"#fef3c7",c:"#d97706",sign:"▲"}
                                :row.pctChange<0
                                  ?{bg:"#d1fae5",c:"#059669",sign:"▼"}
                                  :{bg:dark?"rgba(255,255,255,0.08)":"#f1f5f9",c:T.muted,sign:"→"};
                            return (
                              <div key={row.name} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:"9px 12px"}}>
                                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:6}}>
                                  <div style={{fontSize:12,fontWeight:800,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{row.name}</div>
                                  <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
                                    <span style={{fontSize:10.5,color:T.muted,fontWeight:600}}>{row.prev}→{row.cur}</span>
                                    <span style={{background:pill.bg,color:pill.c,borderRadius:999,padding:"2px 8px",fontSize:10,fontWeight:800}}>{pill.sign} {row.pctChange===999?"baru":`${row.pctChange>0?"+":""}${row.pctChange}%`}</span>
                                  </div>
                                </div>
                                <div style={{display:"flex",flexDirection:"column",gap:3}}>
                                  <div style={{height:6,borderRadius:6,overflow:"hidden",background:dark?"rgba(255,255,255,0.08)":"#e5e7eb"}}>
                                    <div style={{height:"100%",width:`${row.prevPct}%`,background:dark?"rgba(255,255,255,0.22)":"#bbf7d0",borderRadius:6}}/>
                                  </div>
                                  <div style={{height:6,borderRadius:6,overflow:"hidden",background:dark?"rgba(255,255,255,0.08)":"#e5e7eb"}}>
                                    <div style={{height:"100%",width:`${row.curPct}%`,background:row.isSpike?"#ef4444":"#10b981",borderRadius:6,transition:"width .35s ease"}}/>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )
                    }
                  </div>
                </div>

                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:0}} className="report-botgrid">
                  <div className="card" style={{padding:"16px 18px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:12}}>
                    <div className="dash-panel-title">Breakdown per Departemen ({reportRange.label})</div>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      {reportDeptCats.map(cat=>(
                        <span key={cat} style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:10.5,fontWeight:700,color:T.muted,padding:"2px 8px",border:`1px solid ${T.border}`,borderRadius:999}}>
                          <span style={{width:8,height:8,borderRadius:"50%",background:reportCatPalette[cat]||"#64748b",display:"inline-block"}}/>{cat}
                        </span>
                      ))}
                    </div>
                  </div>
                  {reportDeptStack.length===0
                    ?<div style={{padding:"32px 0",textAlign:"center",color:T.muted}}>Belum ada pengambilan pada periode ini</div>
                    :(
                      <div style={{display:"flex",flexDirection:"column",gap:10}}>
                        {reportDeptStack.map(row=>(
                          <div key={row.dept} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:"10px 12px"}}>
                            <div style={{display:"flex",justifyContent:"space-between",gap:8,marginBottom:7}}>
                              <div style={{fontSize:12.5,fontWeight:800,color:T.text}}>{row.dept}</div>
                              <div style={{fontSize:11.5,fontWeight:800,color:T.muted}}>{row.total} unit</div>
                            </div>
                            <div style={{height:12,borderRadius:999,overflow:"hidden",display:"flex",background:dark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.07)"}}>
                              {reportDeptCats.map(cat=>{
                                const val=Number(row.cats?.[cat]||0);
                                if(!val) return null;
                                const pct=clamp01(val/Math.max(1,row.total))*100;
                                return <div key={`${row.dept}-${cat}`} title={`${cat}: ${val} unit`} style={{width:`${pct}%`,background:reportCatPalette[cat]||"#64748b"}}/>;
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  }
                </div>

                  <div className="card" style={{padding:"16px 18px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:12,flexWrap:"wrap"}}>
                      <div className="dash-panel-title">Project Paling Sering Dipakai ({reportRange.label})</div>
                      <div style={{display:"flex",gap:4,background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,padding:3}}>
                        {([["unit","Frekuensi"],["rp","Nilai (Rp)"]] as const).map(([id,label])=>(
                          <button key={id} onClick={()=>setReportProjectMode(id)} style={{padding:"4px 10px",borderRadius:7,border:"none",fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:10.5,fontWeight:700,cursor:"pointer",background:reportProjectMode===id?T.primary:"transparent",color:reportProjectMode===id?"white":T.muted,transition:"all .18s"}}>{label}</button>
                        ))}
                      </div>
                    </div>
                    {(reportProjectMode==="unit"?reportProjectUsage:reportProjectByRp).length===0
                      ?<div style={{padding:"36px 0",textAlign:"center",color:T.muted}}>Belum ada data pengambilan dengan project</div>
                      :(
                        <div style={{display:"flex",flexDirection:"column",gap:10}}>
                          {(reportProjectMode==="unit"?reportProjectUsage:reportProjectByRp).map((row,idx)=>(
                            <div key={row.name} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:"10px 12px"}}>
                              <div style={{display:"flex",justifyContent:"space-between",gap:8,marginBottom:6}}>
                                <div style={{fontSize:12.5,fontWeight:800,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{idx+1}. {row.name}</div>
                                <div style={{fontSize:11.5,fontWeight:800,color:T.navActiveText,whiteSpace:"nowrap"}}>
                                  {reportProjectMode==="unit"?`${row.total} unit`:fmtMoney(Math.round(row.total))}
                                </div>
                              </div>
                              <div style={{height:8,borderRadius:10,background:dark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.08)",overflow:"hidden"}}>
                                <div style={{height:"100%",width:`${row.pct}%`,background:reportProjectMode==="unit"?`linear-gradient(90deg,#f59e0b,#fbbf24)`:`linear-gradient(90deg,${T.primary},${T.primaryLight})`,borderRadius:10,transition:"width .35s ease"}}/>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    }
                  </div>
                </div>
              </div>
            )}

            {/* ══ HISTORY ══ */}
            {tab==="history"&&(
              <div>
                {/* Sub-tab toggle + actions */}
                <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:14}}>
                  <div style={{display:"flex",gap:4,background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:4,overflowX:"auto",WebkitOverflowScrolling:"touch",scrollbarWidth:"none"}}>
                    {[
                      {id:"all",icon:"🧾",label:`Semua (${allHistory.length})`},
                      {id:"out",icon:"📤",label:`Pengambilan (${trx.length})`},
                      {id:"in",icon:"📋",label:`Penerimaan (${receives.length})`},
                      ...(isAdmin?[{id:"approval",icon:"⏳",label:`Approval (${pendingApprovalCount})`}]:[]),
                      ...(isAdmin?[{id:"audit",icon:"🛡",label:`Audit (${auditTotal})`}]:[]),
                    ].map(tb=>(
                      <button key={tb.id} onClick={()=>setHistoryTab(tb.id)} style={{padding:"8px 14px",borderRadius:9,border:"none",fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:12,fontWeight:700,cursor:"pointer",transition:"all .2s",background:historyTab===tb.id?T.primary:"transparent",color:historyTab===tb.id?"white":T.muted,boxShadow:historyTab===tb.id?`0 4px 12px ${T.primaryGlow}`:"none",whiteSpace:"nowrap",flexShrink:0}}>{tb.icon} {tb.label}</button>
                    ))}
                  </div>
                  <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                    {isAdmin&&historyTab!=="audit"&&historyTab!=="approval"&&<BtnG onClick={historyTab==="in"?exportReceivesExcel:exportTransactionsExcel} style={{fontWeight:700,padding:"8px 14px",fontSize:12,display:"flex",alignItems:"center",gap:6}}>{EXCEL_ICON}Excel</BtnG>}
                    {isAdmin&&historyTab!=="audit"&&historyTab!=="approval"&&<BtnG onClick={historyTab==="in"?exportReceivesPdf:exportTransactionsPdf} style={{fontWeight:700,padding:"8px 14px",fontSize:12,display:"flex",alignItems:"center",gap:6}}>{PDF_ICON}PDF</BtnG>}
                    {isAdmin&&historyTab==="approval"&&<BtnG onClick={exportApprovalExcel} style={{fontWeight:700,padding:"8px 14px",fontSize:12,display:"flex",alignItems:"center",gap:6}}>{EXCEL_ICON}Excel</BtnG>}
                    {isAdmin&&historyTab==="approval"&&<BtnG onClick={exportApprovalPdf} style={{fontWeight:700,padding:"8px 14px",fontSize:12,display:"flex",alignItems:"center",gap:6}}>{PDF_ICON}PDF</BtnG>}
                    {isAdmin&&historyTab==="audit"&&<BtnG onClick={exportAuditExcel} style={{fontWeight:700,display:"flex",alignItems:"center",gap:6}}>{EXCEL_ICON}Excel</BtnG>}
                    {isAdmin&&historyTab==="audit"&&<BtnG onClick={exportAuditPdf} style={{fontWeight:700,display:"flex",alignItems:"center",gap:6}}>{PDF_ICON}PDF</BtnG>}
                    {isAdmin&&historyTab!=="in"&&historyTab!=="audit"&&historyTab!=="approval"&&<BtnP onClick={()=>setShowModal(true)} style={{padding:"8px 16px",fontSize:12,fontWeight:800}}>＋ Catat Pengambilan</BtnP>}
                    {canManage&&historyTab==="in"&&<BtnP onClick={()=>setShowAdd(true)} style={{padding:"8px 16px",fontSize:12,fontWeight:800}}>＋ Catat Penerimaan</BtnP>}
                  </div>
                </div>

                {historyTab!=="audit"&&(
                  <div className="fbar" style={{marginBottom:14}}>
                    <input className="ifield" style={{width:220}} placeholder="🔍 Cari nama/item/admin/PO/DO..." value={historyQuery} onChange={e=>setHistoryQuery(e.target.value)}/>
                    {historyTab==="out"&&(
                      <select className="ifield" style={{width:190}} value={historyApprovalStatus} onChange={e=>setHistoryApprovalStatus(e.target.value)}>
                        <option value="all">Semua Status Approval</option>
                        <option value="approved">Approved</option>
                        <option value="pending">Pending</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    )}
                    <span style={{fontSize:11.5,color:T.muted,fontWeight:700}}>Dari</span>
                    <input type="date" className="ifield" style={{width:160}} value={historyFrom} onChange={e=>setHistoryFrom(e.target.value)}/>
                    <span style={{fontSize:11.5,color:T.muted,fontWeight:700}}>Sampai</span>
                    <input type="date" className="ifield" style={{width:160}} value={historyTo} onChange={e=>setHistoryTo(e.target.value)}/>
                    <select className="ifield" style={{width:120}} value={historyPageSize} onChange={e=>setHistoryPageSize(Number(e.target.value)||6)}>
                      {[6,10,15,20].map(n=><option key={n} value={n}>{n}/hal</option>)}
                    </select>
                    <BtnG style={{fontSize:11.5,padding:"7px 12px"}} onClick={()=>{setHistoryQuery("");setHistoryFrom("");setHistoryTo("");setHistoryApprovalStatus("all");}}>✕ Reset</BtnG>
                    <span style={{marginLeft:"auto",fontSize:11.5,color:T.muted,fontWeight:600,whiteSpace:"nowrap"}}>
                      {historyTab==="all"?filteredAll.length:historyTab==="out"?filteredOutByApproval.length:historyTab==="approval"?filteredPending.length:filteredIn.length} transaksi ditemukan
                    </span>
                  </div>
                )}

                {historyTab==="approval"&&isAdmin&&(
                  <div>
                    {filteredPending.length===0
                      ?<div style={{textAlign:"center",padding:"60px 0",color:T.muted}}><div style={{fontSize:36,marginBottom:12}}>✅</div>Tidak ada transaksi yang menunggu approval</div>
                      :filteredPending.map((t:any)=>{
                        const totalUnits=(t.items||[]).reduce((a:number,i:any)=>a+Number(i.qty||0),0);
                        const totalCostRow=Number(t.totalCostOut??(t.items||[]).reduce((acc:number,it:any)=>{const avg=Number(it.averageCost??itemMap[Number(it.itemId)]?.averageCost??0);return acc+(Number(it.qty||0)*avg);},0));
                        const sla=getSlaInfo(t,slaTick);
                        const slaColor=sla.urgency==="critical"?T.red:sla.urgency==="warning"?"#f97316":T.amber;
                        const slaIcon=sla.urgency==="critical"?"🔴":sla.urgency==="warning"?"⚠️":"⏱";
                        const slaBorderLeft=`4px solid ${slaColor}`;
                        const slaCardBg=sla.urgency==="critical"?`linear-gradient(90deg,rgba(239,68,68,0.07) 0%,transparent 120px)`:sla.urgency==="warning"?`linear-gradient(90deg,rgba(249,115,22,0.07) 0%,transparent 120px)`:"none";
                        return(
                          <div key={t.id} style={{display:"flex",alignItems:"stretch",gap:0,background:T.card,backgroundImage:slaCardBg,border:`1px solid ${sla.urgency==="critical"?T.redBorder:sla.urgency==="warning"?"rgba(249,115,22,0.3)":T.border}`,borderLeft:slaBorderLeft,borderRadius:14,marginBottom:8,overflow:"hidden",boxShadow:T.shadowSm}}>
                            <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"14px 12px",gap:5,minWidth:70,flexShrink:0}}>
                              <div style={{width:48,height:48,borderRadius:"50%",background:sla.urgency==="critical"?T.redBg:T.amberBg,border:`2px solid ${slaColor}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,lineHeight:1}}>⏳</div>
                              <span style={{fontSize:9,fontWeight:900,letterSpacing:".07em",color:slaColor,textTransform:"uppercase"}}>PENDING</span>
                              {sla.label&&<span style={{fontSize:9,fontWeight:800,color:slaColor,textAlign:"center",lineHeight:1.2}}>{slaIcon} {sla.label}</span>}
                              {sla.remainingLabel&&<span style={{fontSize:9,fontWeight:800,color:sla.remainingMin===0?T.red:T.muted,textAlign:"center",lineHeight:1.2}}>🕒 {sla.remainingLabel}</span>}
                            </div>
                            <div className="trx-row-inner">
                              <div className="trx-col-name">
                                <div style={{fontSize:13.5,fontWeight:800,color:T.text,lineHeight:1.3}}>{t.taker||"-"}</div>
                                <div style={{fontSize:11,color:T.muted,marginTop:2}}>{t.dept||"-"}</div>
                                <div style={{fontSize:10.5,color:T.muted,marginTop:1}}>Admin: {t.admin||"-"}</div>
                              </div>
                              <div className="trx-col-time">
                                <div style={{fontSize:16,fontWeight:900,color:T.text,lineHeight:1}}>{t.time||"-"}</div>
                                <div style={{fontSize:10.5,color:T.muted,marginTop:3}}>{fmtDate(t.date)}</div>
                              </div>
                              <div className="trx-col-items">
                                {(t.items||[]).slice(0,3).map((it:any,ii:number)=>(
                                  <div key={ii} style={{display:"grid",gridTemplateColumns:"14px minmax(0,1fr) auto",alignItems:"center",columnGap:8,marginBottom:4}}>
                                    <span style={{fontSize:11}}>📦</span>
                                    <span style={{fontSize:12,fontWeight:700,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:200}}>{it.itemName}</span>
                                    <span style={{fontSize:10,fontWeight:800,color:T.navActiveText,background:T.navActive,padding:"1px 7px",borderRadius:5,border:`1px solid ${T.navActiveBorder}`,flexShrink:0}}>×{it.qty} {it.unit}</span>
                                  </div>
                                ))}
                                {(t.items||[]).length>3&&<div style={{fontSize:10,color:T.muted}}>+{(t.items||[]).length-3} item lainnya</div>}
                                {t.approvalReason&&<div style={{fontSize:10.5,color:T.amber,fontWeight:700,marginTop:4}}>Alasan: {t.approvalReason}</div>}
                              </div>
                              <div className="trx-col-count" style={{display:"flex",flexDirection:"column",gap:5}}>
                                <div style={{display:"flex",alignItems:"baseline",gap:4}}>
                                  <span style={{fontSize:16,fontWeight:900,color:T.text,lineHeight:1}}>{(t.items||[]).length}</span>
                                  <span style={{fontSize:10.5,fontWeight:600,color:T.muted}}>jenis</span>
                                </div>
                                <div style={{display:"flex",alignItems:"baseline",gap:4}}>
                                  <span style={{fontSize:16,fontWeight:900,color:T.text,lineHeight:1}}>{totalUnits}</span>
                                  <span style={{fontSize:10.5,fontWeight:600,color:T.muted}}>unit</span>
                                </div>
                              </div>
                              <div className="trx-col-total">
                                <div style={{fontSize:10,color:T.muted,fontWeight:700,marginBottom:3,textTransform:"uppercase",letterSpacing:".05em"}}>Total</div>
                                <div style={{fontSize:14,fontWeight:900,color:slaColor}}>{fmtMoney(totalCostRow)}</div>
                                {sla.urgency!=="normal"&&<div style={{fontSize:9,fontWeight:700,color:slaColor,marginTop:3}}>{sla.urgency==="critical"?"🚨 Segera diproses!":"⚠ Menunggu lama"}</div>}
                              </div>
                              <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
                                <button type="button" disabled={Boolean(approvalBusyKey)} onClick={()=>processTransactionApproval(t.id,"approve")} style={{background:T.greenBg,border:`1px solid ${T.greenBorder}`,color:T.greenText,borderRadius:8,padding:"7px 10px",fontSize:11,fontWeight:700,cursor:approvalBusyKey?"not-allowed":"pointer",whiteSpace:"nowrap",opacity:approvalBusyKey?0.65:1}}>{approvalBusyKey===`${t.id}:approve`?"Memproses...":"✅ Approve"}</button>
                                <button type="button" disabled={Boolean(approvalBusyKey)} onClick={()=>processTransactionApproval(t.id,"reject")} style={{background:T.redBg,border:`1px solid ${T.redBorder}`,color:T.redText,borderRadius:8,padding:"7px 10px",fontSize:11,fontWeight:700,cursor:approvalBusyKey?"not-allowed":"pointer",whiteSpace:"nowrap",opacity:approvalBusyKey?0.65:1}}>{approvalBusyKey===`${t.id}:reject`?"Memproses...":"⛔ Reject"}</button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    }
                  </div>
                )}

                {/* ─ TAB SEMUA ─ */}
                {historyTab==="all"&&(
                  <div>
                    {filteredAll.length===0
                      ?<div style={{textAlign:"center",padding:"60px 0",color:T.muted}}><div style={{fontSize:36,marginBottom:12}}>🧾</div>Belum ada riwayat transaksi</div>
                      :(()=>{
                        const grouped:Record<string,typeof pagedAll>={};
                        for(const row of pagedAll){const d=row.date||"";if(!grouped[d])grouped[d]=[];grouped[d].push(row);}
                        const sortedDates=Object.keys(grouped).sort((a,b)=>b.localeCompare(a));
                        const fmtDG=(d:string)=>new Date(d+"T00:00:00").toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"}).toUpperCase();
                        return sortedDates.map(date=>(
                          <div key={date} style={{marginBottom:22}}>
                            {/* Date group header */}
                            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                              <span style={{width:8,height:8,borderRadius:"50%",background:T.primary,display:"inline-block",flexShrink:0}}/>
                              <span style={{fontSize:12,fontWeight:900,color:T.primary,letterSpacing:".1em"}}>{fmtDG(date)}</span>
                            </div>
                            {grouped[date].map((row:any)=>{
                              const isIn=String(row.type||"").toLowerCase()==="in";
                              const accentColor=isIn?T.green:T.red;
                              const accentBg=isIn?T.greenBg:T.redBg;
                              const itemsArr:any[]=row.items||[];
                              const totalUnits=isIn?(Number(row.qty)||0):itemsArr.reduce((a:number,i:any)=>a+Number(i.qty||0),0);
                              const jenis=isIn?1:itemsArr.length;
                              const totalCost=isIn
                                ?Number(row.totalCostIn??((Number(row.qty)||0)*(Number(row.buyPrice)||0)))
                                :Number(row.totalCostOut??0);
                              return(
                                <div key={`${row.type||"x"}-${row.id}`} style={{display:"flex",alignItems:"stretch",gap:0,background:T.card,border:`1px solid ${T.border}`,borderLeft:`4px solid ${accentColor}`,borderRadius:14,marginBottom:8,overflow:"hidden",transition:"box-shadow .2s",boxShadow:T.shadowSm}}>
                                  {/* Avatar */}
                                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"14px 12px",gap:5,minWidth:70,flexShrink:0}}>
                                    <div style={{width:48,height:48,borderRadius:"50%",background:accentBg,border:`2px solid ${accentColor}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,lineHeight:1}}>
                                      {isIn?"↙":"↗"}
                                    </div>
                                    <span style={{fontSize:9,fontWeight:900,letterSpacing:".07em",color:accentColor,textTransform:"uppercase"}}>{isIn?"MASUK":"KELUAR"}</span>
                                  </div>
                                  {/* Content */}
                                  <div className="trx-row-inner">
                                    {/* Name + dept */}
                                    <div className="trx-col-name">
                                      <div style={{fontSize:13.5,fontWeight:800,color:T.text,lineHeight:1.3}}>{isIn?(row.itemName||itemsArr[0]?.itemName||"-"):(row.taker||"-")}</div>
                                      <div style={{fontSize:11,color:T.muted,marginTop:2}}>{isIn?`Admin: ${row.admin||"-"}`:(row.dept||"-")}</div>
                                      {!isIn&&<div style={{fontSize:10.5,color:T.muted,marginTop:1}}>Admin: {row.admin||"-"}</div>}
                                      {!isIn&&(
                                        <div style={{marginTop:4}}>
                                          {(()=>{
                                            const status=trxApprovalStatus(row);
                                            if(status==="pending") return <Badge bg={T.amberBg} color={T.amberText} border={T.amberBorder}>⏳ Pending Approval</Badge>;
                                            if(status==="rejected") return <Badge bg={T.redBg} color={T.redText} border={T.redBorder}>⛔ Rejected</Badge>;
                                            return <Badge bg={T.greenBg} color={T.greenText} border={T.greenBorder}>✅ Approved</Badge>;
                                          })()}
                                          {approvalMetaChips(row)}
                                        </div>
                                      )}
                                    </div>
                                    {/* Time */}
                                    <div className="trx-col-time">
                                      <div style={{fontSize:16,fontWeight:900,color:T.text,lineHeight:1}}>{row.time||"-"}</div>
                                      <div style={{fontSize:10.5,color:T.muted,marginTop:3}}>{fmtDate(row.date)}</div>
                                    </div>
                                    {/* Items */}
                                    <div className="trx-col-items">
                                      {isIn
                                        ?<>
                                          <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:4,flexWrap:"wrap"}}>
                                            <span style={{fontSize:12}}>📦</span>
                                            <span style={{fontSize:12.5,fontWeight:700,color:T.text}}>{row.itemName||"-"}</span>
                                            <span style={{fontSize:10.5,fontWeight:800,color:T.greenText,background:T.greenBg,padding:"1px 8px",borderRadius:5,border:`1px solid ${T.greenBorder}`,flexShrink:0}}>+{row.qty} {row.unit||"pcs"}</span>
                                          </div>
                                          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                                            {row.poNumber&&<span style={{fontSize:10,fontWeight:700,color:T.navActiveText,background:T.navActive,padding:"2px 8px",borderRadius:5,border:`1px solid ${T.navActiveBorder}`}}>PO: {row.poNumber}</span>}
                                            {row.doNumber&&<span style={{fontSize:10,fontWeight:700,color:T.muted,background:T.surface,padding:"2px 8px",borderRadius:5,border:`1px solid ${T.border}`}}>DO: {row.doNumber}</span>}
                                            {row.buyPrice&&<span style={{fontSize:10,color:T.greenText,fontWeight:700}}>💵 Buy {fmtMoney(row.buyPrice)} / {row.unit||"pcs"}</span>}
                                          </div>
                                        </>
                                        :itemsArr.slice(0,3).map((it:any,ii:number)=>(
                                          <div key={ii} style={{display:"grid",gridTemplateColumns:"14px minmax(0,1fr) auto",alignItems:"center",columnGap:8,marginBottom:3}}>
                                            <span style={{fontSize:11}}>📦</span>
                                            <span style={{fontSize:12,fontWeight:700,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:200}}>{it.itemName}</span>
                                            <span style={{fontSize:10,fontWeight:800,color:T.navActiveText,background:T.navActive,padding:"1px 7px",borderRadius:5,border:`1px solid ${T.navActiveBorder}`,flexShrink:0}}>×{it.qty} {it.unit||"pcs"}</span>
                                          </div>
                                        ))
                                      }
                                      {!isIn&&itemsArr.length>3&&<div style={{fontSize:10,color:T.muted,marginTop:2}}>+{itemsArr.length-3} item lainnya</div>}
                                    </div>
                                    {/* Jenis + Unit */}
                                    <div className="trx-col-count" style={{display:"flex",flexDirection:"column",gap:5}}>
                                      <div style={{display:"flex",alignItems:"baseline",gap:4}}>
                                        <span style={{fontSize:16,fontWeight:900,color:T.text,lineHeight:1}}>{jenis}</span>
                                        <span style={{fontSize:10.5,fontWeight:600,color:T.muted}}>jenis</span>
                                      </div>
                                      <div style={{display:"flex",alignItems:"baseline",gap:4}}>
                                        <span style={{fontSize:16,fontWeight:900,color:T.text,lineHeight:1}}>{totalUnits}</span>
                                        <span style={{fontSize:10.5,fontWeight:600,color:T.muted}}>unit</span>
                                      </div>
                                    </div>
                                    {/* Total */}
                                    <div className="trx-col-total" style={{paddingRight:isAdmin?14:0}}>
                                      <div style={{fontSize:10,color:T.muted,fontWeight:700,marginBottom:3,textTransform:"uppercase",letterSpacing:".05em"}}>Total</div>
                                      <div style={{fontSize:14,fontWeight:900,color:accentColor}}>{fmtMoney(totalCost)}</div>
                                    </div>
                                    {/* Hapus */}
                                    {isAdmin&&(
                                      <button
                                        onClick={()=>isIn?deleteReceive(row.receiveId??row.id):deleteTransaction(row.id)}
                                        style={{background:T.redBg,border:`1px solid ${T.redBorder}`,color:T.redText,borderRadius:8,padding:"7px 12px",fontSize:11,fontWeight:700,cursor:"pointer",flexShrink:0,whiteSpace:"nowrap"}}>
                                        🗑 Hapus
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ));
                      })()
                    }
                    {/* Pagination */}
                    {filteredAll.length>0&&(
                      <div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:6,marginTop:20,flexWrap:"wrap"}}>
                        <button onClick={()=>setHistoryOutPage(p=>Math.max(1,p-1))} disabled={historyOutPage<=1}
                          style={{padding:"8px 18px",borderRadius:9,border:`1px solid ${T.border}`,background:T.surface,color:historyOutPage<=1?T.muted:T.text,fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:12.5,fontWeight:700,cursor:historyOutPage<=1?"default":"pointer",opacity:historyOutPage<=1?0.5:1,transition:"all .18s"}}>
                          ‹ Sebelumnya
                        </button>
                        {Array.from({length:allTotalPages}).map((_,i)=>(
                          <button key={i} onClick={()=>setHistoryOutPage(i+1)}
                            style={{width:38,height:38,borderRadius:9,border:`1px solid ${historyOutPage===i+1?T.primary:T.border}`,background:historyOutPage===i+1?T.primary:T.surface,color:historyOutPage===i+1?"white":T.muted,fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:13,fontWeight:800,cursor:"pointer",transition:"all .18s"}}>
                            {i+1}
                          </button>
                        ))}
                        <button onClick={()=>setHistoryOutPage(p=>Math.min(allTotalPages,p+1))} disabled={historyOutPage>=allTotalPages}
                          style={{padding:"8px 18px",borderRadius:9,border:`1px solid ${T.border}`,background:T.surface,color:historyOutPage>=allTotalPages?T.muted:T.text,fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:12.5,fontWeight:700,cursor:historyOutPage>=allTotalPages?"default":"pointer",opacity:historyOutPage>=allTotalPages?0.5:1,transition:"all .18s"}}>
                          Selanjutnya ›
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* ─ TAB PENGAMBILAN ─ */}
                {historyTab==="out"&&(
                  <div>
                    {/* Stats 5 columns */}
                    <div className="stat5-g">
                      {(()=>{
                        const totalNilai=approvedOutTrx.reduce((acc,t)=>acc+Number(t.totalCostOut??t.items.reduce((a,it)=>a+(Number(it.qty||0)*Number(it.averageCost??itemMap[Number(it.itemId)]?.averageCost??0)),0)),0);
                        return [
                          {label:"Total Transaksi",sub:"pengambilan approved",val:approvedOutTrx.length,valStr:null,icon:"📋",dot:T.primary},
                          {label:"Total Unit Keluar",sub:"unit total",val:totalOut,valStr:null,icon:"📦",dot:T.green},
                          {label:"Item Berbeda",sub:"jenis barang",val:[...new Set(approvedOutTrx.flatMap(t=>t.items.map(i=>i.itemId)))].length,valStr:null,icon:"🏷",dot:T.primaryLight},
                          {label:"Jumlah Pengambil",sub:"karyawan",val:[...new Set(approvedOutTrx.map(t=>t.taker))].length,valStr:null,icon:"👥",dot:T.amber},
                          {label:"Total Nilai",sub:"estimasi harga rata-rata",val:null,valStr:fmtMoney(totalNilai),icon:"Rp",dot:T.primary},
                        ];
                      })().map((s,i)=>(
                        <div key={i} className="stat-card" style={{display:"flex",flexDirection:"column",gap:0,padding:"16px 14px"}}>
                          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                            <div style={{width:36,height:36,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:400,background:dark?"rgba(16,185,129,0.13)":"rgba(16,185,129,0.09)",border:`1px solid ${T.navActiveBorder}`,flexShrink:0,color:s.dot}}>{s.icon}</div>
                            <span style={{width:6,height:6,borderRadius:"50%",background:s.dot,display:"inline-block"}}/>
                          </div>
                          <div style={{fontSize:9,fontWeight:800,color:T.muted,letterSpacing:".07em",textTransform:"uppercase",marginBottom:4,lineHeight:1.3}}>{s.label}</div>
                          <div className="stat-val" style={{fontSize:"clamp(15px,3.5vw,28px)",fontWeight:900,lineHeight:1.2,color:s.dot,marginBottom:4,wordBreak:"break-word",overflowWrap:"break-word"}}>{s.val!==null?s.val:s.valStr}</div>
                          <div style={{fontSize:10,color:T.muted,fontWeight:500}}>{s.sub}</div>
                        </div>
                      ))}
                    </div>

                    {/* Barang Paling Sering Diambil */}
                    <div className="card" style={{marginBottom:18}}>
                      <div style={{fontSize:16,fontWeight:800,...gText(),marginBottom:16}}>🏆 Barang Paling Sering Diambil</div>
                      {(()=>{
                        const agg=approvedOutTrx.flatMap(t=>t.items).reduce((acc,it)=>{acc[it.itemName]=(acc[it.itemName]||0)+it.qty;return acc;},{} as Record<string,number>);
                        const sorted=Object.entries(agg).sort((a,b)=>b[1]-a[1]).slice(0,5);
                        const max=sorted[0]?.[1]||1;
                        const grandTotal=sorted.reduce((a,[,v])=>a+v,0)||1;
                        return sorted.length===0
                          ?<div style={{textAlign:"center",padding:"24px 0",color:T.muted}}>Belum ada data</div>
                          :sorted.map(([name,qty],i)=>(
                            <div key={name} style={{display:"flex",alignItems:"center",gap:11,padding:"11px 0",borderBottom:`1px solid ${T.border}`}}>
                              <div style={{width:24,height:24,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,background:i===0?T.navActive:T.surface,color:i===0?T.navActiveText:T.muted,border:`1px solid ${i===0?T.navActiveBorder:T.border}`,flexShrink:0}}>{i+1}</div>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5,gap:8}}>
                                  <span style={{fontSize:13,fontWeight:700,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</span>
                                  <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                                    <span style={{fontSize:12,fontWeight:800,color:T.greenText}}>{qty} unit</span>
                                    <span style={{fontSize:11,fontWeight:700,color:T.muted}}>({(qty/grandTotal*100).toFixed(1)}%)</span>
                                  </div>
                                </div>
                                <Prog pct={qty/max*100} color={i===0?T.primary:T.muted}/>
                              </div>
                            </div>
                          ));
                      })()}
                    </div>

                    {/* Log Pengambilan */}
                    <div style={{fontSize:17,fontWeight:800,...gText(),marginBottom:14}}>Log Pengambilan</div>
                    {pagedOut.map(t=>{
                      const totalCostRow=Number(t.totalCostOut??t.items.reduce((acc,it)=>{const avg=Number(it.averageCost??itemMap[Number(it.itemId)]?.averageCost??0);return acc+(Number(it.qty||0)*avg);},0));
                      const totalUnits=t.items.reduce((a,i)=>a+i.qty,0);
                      return(
                        <div key={t.id} style={{display:"flex",alignItems:"stretch",gap:0,background:T.card,border:`1px solid ${T.border}`,borderLeft:`4px solid ${T.red}`,borderRadius:14,marginBottom:8,overflow:"hidden",boxShadow:T.shadowSm,transition:"box-shadow .2s"}}>
                          {/* Avatar */}
                          <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"14px 12px",gap:5,minWidth:70,flexShrink:0}}>
                            <div style={{width:48,height:48,borderRadius:"50%",background:T.redBg,border:`2px solid ${T.red}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,lineHeight:1}}>↗</div>
                            <span style={{fontSize:9,fontWeight:900,letterSpacing:".07em",color:T.red,textTransform:"uppercase"}}>KELUAR</span>
                          </div>
                          {/* Content */}
                          <div className="trx-row-inner">
                            {/* Name + dept */}
                            <div className="trx-col-name">
                              <div style={{fontSize:13.5,fontWeight:800,color:T.text,lineHeight:1.3}}>{t.taker}</div>
                              <div style={{fontSize:11,color:T.muted,marginTop:2}}>{t.dept}</div>
                              <div style={{fontSize:10.5,color:T.muted,marginTop:1}}>Admin: {t.admin}</div>
                              <div style={{marginTop:4}}>
                                {(()=>{
                                  const status=trxApprovalStatus(t);
                                  if(status==="pending") return <Badge bg={T.amberBg} color={T.amberText} border={T.amberBorder}>⏳ Pending Approval</Badge>;
                                  if(status==="rejected") return <Badge bg={T.redBg} color={T.redText} border={T.redBorder}>⛔ Rejected</Badge>;
                                  return <Badge bg={T.greenBg} color={T.greenText} border={T.greenBorder}>✅ Approved</Badge>;
                                })()}
                                {approvalMetaChips(t)}
                              </div>
                            </div>
                            {/* Time */}
                            <div className="trx-col-time">
                              <div style={{fontSize:16,fontWeight:900,color:T.text,lineHeight:1}}>{t.time||"-"}</div>
                              <div style={{fontSize:10.5,color:T.muted,marginTop:3}}>{fmtDate(t.date)}</div>
                            </div>
                            {/* Items */}
                            <div className="trx-col-items">
                              {t.items.slice(0,3).map((it,ii)=>(
                                <div key={ii} style={{display:"grid",gridTemplateColumns:"14px minmax(0,1fr) auto",alignItems:"center",columnGap:8,marginBottom:4}}>
                                  <span style={{fontSize:11}}>📦</span>
                                  <span style={{fontSize:12,fontWeight:700,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:200}}>{it.itemName}</span>
                                  <span style={{fontSize:10,fontWeight:800,color:T.navActiveText,background:T.navActive,padding:"1px 7px",borderRadius:5,border:`1px solid ${T.navActiveBorder}`,flexShrink:0}}>×{it.qty} {it.unit}</span>
                                </div>
                              ))}
                              {t.items.length>3&&<div style={{fontSize:10,color:T.muted}}>+{t.items.length-3} item lainnya</div>}
                            </div>
                            {/* Jenis + Unit */}
                            <div className="trx-col-count" style={{display:"flex",flexDirection:"column",gap:5}}>
                              <div style={{display:"flex",alignItems:"baseline",gap:4}}>
                                <span style={{fontSize:16,fontWeight:900,color:T.text,lineHeight:1}}>{t.items.length}</span>
                                <span style={{fontSize:10.5,fontWeight:600,color:T.muted}}>jenis</span>
                              </div>
                              <div style={{display:"flex",alignItems:"baseline",gap:4}}>
                                <span style={{fontSize:16,fontWeight:900,color:T.text,lineHeight:1}}>{totalUnits}</span>
                                <span style={{fontSize:10.5,fontWeight:600,color:T.muted}}>unit</span>
                              </div>
                            </div>
                            {/* Total */}
                            <div className="trx-col-total" style={{paddingRight:isAdmin?14:0}}>
                              <div style={{fontSize:10,color:T.muted,fontWeight:700,marginBottom:3,textTransform:"uppercase",letterSpacing:".05em"}}>Total</div>
                              <div style={{fontSize:14,fontWeight:900,color:T.red}}>{fmtMoney(totalCostRow)}</div>
                            </div>
                            {/* Hapus */}
                            {isAdmin&&(
                              <button onClick={()=>deleteTransaction(t.id)}
                                style={{background:T.redBg,border:`1px solid ${T.redBorder}`,color:T.redText,borderRadius:8,padding:"7px 12px",fontSize:11,fontWeight:700,cursor:"pointer",flexShrink:0,whiteSpace:"nowrap"}}>
                                🗑 Hapus
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {/* Pagination */}
                    {filteredOutByApproval.length>0&&(
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:16,gap:8,flexWrap:"wrap"}}>
                        <span style={{fontSize:11.5,color:T.muted,fontWeight:600}}>Menampilkan {(historyOutPage-1)*historyPageSize+1}-{Math.min(historyOutPage*historyPageSize,filteredOutByApproval.length)} dari {filteredOutByApproval.length} transaksi</span>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <button onClick={()=>setHistoryOutPage(p=>Math.max(1,p-1))} disabled={historyOutPage<=1}
                            style={{display:"flex",alignItems:"center",gap:4,padding:"8px 16px",borderRadius:9,border:`1px solid ${T.border}`,background:T.surface,color:historyOutPage<=1?T.muted:T.text,fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:12.5,fontWeight:700,cursor:historyOutPage<=1?"default":"pointer",opacity:historyOutPage<=1?0.5:1,transition:"all .18s"}}>
                            ‹ Prev
                          </button>
                          {Array.from({length:outTotalPages}).map((_,i)=>(
                            <button key={i} onClick={()=>setHistoryOutPage(i+1)}
                              style={{width:36,height:36,borderRadius:9,border:`1px solid ${historyOutPage===i+1?T.primary:T.border}`,background:historyOutPage===i+1?T.primary:T.surface,color:historyOutPage===i+1?"white":T.muted,fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:13,fontWeight:800,cursor:"pointer",transition:"all .18s"}}>
                              {i+1}
                            </button>
                          ))}
                          <button onClick={()=>setHistoryOutPage(p=>Math.min(outTotalPages,p+1))} disabled={historyOutPage>=outTotalPages}
                            style={{display:"flex",alignItems:"center",gap:4,padding:"8px 16px",borderRadius:9,border:`1px solid ${T.border}`,background:T.surface,color:historyOutPage>=outTotalPages?T.muted:T.text,fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:12.5,fontWeight:700,cursor:historyOutPage>=outTotalPages?"default":"pointer",opacity:historyOutPage>=outTotalPages?0.5:1,transition:"all .18s"}}>
                            Next ›
                          </button>
                        </div>
                        <select value={historyPageSize} onChange={e=>setHistoryPageSize(Number(e.target.value)||6)}
                          style={{padding:"8px 12px",borderRadius:9,border:`1px solid ${T.border}`,background:T.surface,color:T.text,fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:12,fontWeight:600,cursor:"pointer",outline:"none"}}>
                          {[6,10,15,20].map(n=><option key={n} value={n}>{n} / halaman</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                {/* ─ TAB PENERIMAAN ─ */}
                {historyTab==="in"&&(
                  <div>
                    {/* Stats 5 columns */}
                    <div className="stat5-g">
                      {(()=>{
                        const totalNilaiIn=receives.reduce((acc,r)=>{
                          const it=itemMap[Number(r.itemId)];
                          return acc+(Number(r.buyPrice??it?.lastPrice??0)*Number(r.qty||0));
                        },0);
                        return [
                          {label:"Total Penerimaan",sub:"transaksi",val:receives.length,valStr:null,icon:"📥",dot:T.primary},
                          {label:"Total Unit Masuk",sub:"unit",val:totalIn,valStr:null,icon:"📦",dot:T.green},
                          {label:"Item Berbeda",sub:"jenis barang",val:[...new Set(receives.map(r=>r.itemId))].length,valStr:null,icon:"🏷",dot:T.primaryLight},
                          {label:"Admin Terlibat",sub:"admin",val:[...new Set(receives.map(r=>r.admin).filter(Boolean))].length,valStr:null,icon:"👥",dot:T.amber},
                          {label:"Total Nilai",sub:"estimasi harga beli",val:null,valStr:fmtMoney(totalNilaiIn),icon:"Rp",dot:T.primary},
                        ];
                      })().map((s,i)=>(
                        <div key={i} className="stat-card" style={{display:"flex",flexDirection:"column",padding:"16px 14px"}}>
                          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                            <div style={{width:36,height:36,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:400,background:dark?"rgba(16,185,129,0.13)":"rgba(16,185,129,0.09)",border:`1px solid ${T.navActiveBorder}`,flexShrink:0,color:s.dot}}>{s.icon}</div>
                            <span style={{width:6,height:6,borderRadius:"50%",background:s.dot,display:"inline-block"}}/>
                          </div>
                          <div style={{fontSize:9,fontWeight:800,color:T.muted,letterSpacing:".07em",textTransform:"uppercase",marginBottom:4,lineHeight:1.3}}>{s.label}</div>
                          <div className="stat-val" style={{fontSize:"clamp(15px,3.5vw,28px)",fontWeight:900,lineHeight:1.2,color:s.dot,marginBottom:4,wordBreak:"break-word",overflowWrap:"break-word"}}>{s.val!==null?s.val:s.valStr}</div>
                          <div style={{fontSize:10,color:T.muted,fontWeight:500}}>{s.sub}</div>
                        </div>
                      ))}
                    </div>

                    {filteredIn.length===0
                      ?<div style={{textAlign:"center",padding:"60px 0",color:T.muted}}><div style={{fontSize:36,marginBottom:12}}>📭</div>Belum ada riwayat penerimaan</div>
                      :pagedIn.map((r)=>{
                          const it=itemMap[Number(r.itemId)];
                          const buyPrice=Number(r.buyPrice??it?.lastPrice??0);
                          const totalCostR=buyPrice*Number(r.qty||0);
                          return(
                            <div key={r.id} style={{display:"flex",alignItems:"stretch",gap:0,background:T.card,border:`1px solid ${T.border}`,borderLeft:`4px solid ${T.green}`,borderRadius:14,marginBottom:8,overflow:"hidden",boxShadow:T.shadowSm,transition:"box-shadow .2s"}}>
                              {/* Avatar */}
                              <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"14px 12px",gap:5,minWidth:70,flexShrink:0}}>
                                <div style={{width:48,height:48,borderRadius:"50%",background:T.greenBg,border:`2px solid ${T.green}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,lineHeight:1}}>↙</div>
                                <span style={{fontSize:9,fontWeight:900,letterSpacing:".07em",color:T.green,textTransform:"uppercase"}}>MASUK</span>
                              </div>
                              {/* Content */}
                              <div className="trx-row-inner">
                                {/* Name */}
                                <div className="trx-col-name">
                                  <div style={{fontSize:13.5,fontWeight:800,color:T.text,lineHeight:1.3}}>{r.itemName||"-"}</div>
                                  <div style={{fontSize:11,color:T.muted,marginTop:2}}>Admin: {r.admin||"-"}</div>
                                </div>
                                {/* Time */}
                                <div className="trx-col-time">
                                  <div style={{fontSize:16,fontWeight:900,color:T.text,lineHeight:1}}>{r.time||"-"}</div>
                                  <div style={{fontSize:10.5,color:T.muted,marginTop:3}}>{fmtDate(r.date)}</div>
                                </div>
                                {/* Items */}
                                <div className="trx-col-items">
                                  <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:4,flexWrap:"wrap"}}>
                                    <span style={{fontSize:12}}>📦</span>
                                    <span style={{fontSize:12.5,fontWeight:700,color:T.text}}>{r.itemName||"-"}</span>
                                    <span style={{fontSize:10.5,fontWeight:800,color:T.greenText,background:T.greenBg,padding:"1px 8px",borderRadius:5,border:`1px solid ${T.greenBorder}`,flexShrink:0}}>+{r.qty} {r.unit||"pcs"}</span>
                                  </div>
                                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                                    {r.poNumber&&<span style={{fontSize:10,fontWeight:700,color:T.navActiveText,background:T.navActive,padding:"2px 8px",borderRadius:5,border:`1px solid ${T.navActiveBorder}`}}>PO: {r.poNumber}</span>}
                                    {r.doNumber&&<span style={{fontSize:10,fontWeight:700,color:T.muted,background:T.surface,padding:"2px 8px",borderRadius:5,border:`1px solid ${T.border}`}}>DO: {r.doNumber}</span>}
                                    {r.buyPrice&&<span style={{fontSize:10,color:T.greenText,fontWeight:700}}>💵 Buy {fmtMoney(buyPrice)} / {r.unit||"pcs"}</span>}
                                  </div>
                                </div>
                                {/* Jenis + Unit */}
                                <div className="trx-col-count" style={{display:"flex",flexDirection:"column",gap:5}}>
                                  <div style={{display:"flex",alignItems:"baseline",gap:4}}>
                                    <span style={{fontSize:16,fontWeight:900,color:T.text,lineHeight:1}}>1</span>
                                    <span style={{fontSize:10.5,fontWeight:600,color:T.muted}}>jenis</span>
                                  </div>
                                  <div style={{display:"flex",alignItems:"baseline",gap:4}}>
                                    <span style={{fontSize:16,fontWeight:900,color:T.text,lineHeight:1}}>{Number(r.qty)||0}</span>
                                    <span style={{fontSize:10.5,fontWeight:600,color:T.muted}}>unit</span>
                                  </div>
                                </div>
                                {/* Total */}
                                <div className="trx-col-total" style={{paddingRight:isAdmin?14:0}}>
                                  <div style={{fontSize:10,color:T.muted,fontWeight:700,marginBottom:3,textTransform:"uppercase",letterSpacing:".05em"}}>Total</div>
                                  <div style={{fontSize:14,fontWeight:900,color:T.green}}>{fmtMoney(totalCostR)}</div>
                                </div>
                                {/* Hapus */}
                                {isAdmin&&(
                                  <button onClick={()=>deleteReceive(r.id)}
                                    style={{background:T.redBg,border:`1px solid ${T.redBorder}`,color:T.redText,borderRadius:8,padding:"7px 12px",fontSize:11,fontWeight:700,cursor:"pointer",flexShrink:0,whiteSpace:"nowrap"}}>
                                    🗑 Hapus
                                  </button>
                                )}
                                {r.hasAttachment&&(
                                  <button onClick={()=>fetchReceiveAttachment(r.id)}
                                    title="Lihat Lampiran"
                                    style={{background:T.navActive,border:`1px solid ${T.navActiveBorder}`,color:T.navActiveText,borderRadius:8,padding:"7px 10px",fontSize:13,fontWeight:700,cursor:"pointer",flexShrink:0}}>
                                    📎
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                    }

                    {/* Pagination */}
                    {filteredIn.length>0&&(
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:16,gap:8,flexWrap:"wrap"}}>
                        <span style={{fontSize:11.5,color:T.muted,fontWeight:600}}>Menampilkan {(historyInPage-1)*historyPageSize+1}-{Math.min(historyInPage*historyPageSize,filteredIn.length)} dari {filteredIn.length} transaksi</span>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <button onClick={()=>setHistoryInPage(p=>Math.max(1,p-1))} disabled={historyInPage<=1}
                            style={{padding:"8px 16px",borderRadius:9,border:`1px solid ${T.border}`,background:T.surface,color:historyInPage<=1?T.muted:T.text,fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:12.5,fontWeight:700,cursor:historyInPage<=1?"default":"pointer",opacity:historyInPage<=1?0.5:1,transition:"all .18s"}}>
                            ← Prev
                          </button>
                          {Array.from({length:inTotalPages}).map((_,i)=>(
                            <button key={i} onClick={()=>setHistoryInPage(i+1)}
                              style={{width:36,height:36,borderRadius:9,border:`1px solid ${historyInPage===i+1?T.primary:T.border}`,background:historyInPage===i+1?T.primary:T.surface,color:historyInPage===i+1?"white":T.muted,fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:13,fontWeight:800,cursor:"pointer",transition:"all .18s"}}>
                              {i+1}
                            </button>
                          ))}
                          <button onClick={()=>setHistoryInPage(p=>Math.min(inTotalPages,p+1))} disabled={historyInPage>=inTotalPages}
                            style={{padding:"8px 16px",borderRadius:9,border:`1px solid ${T.border}`,background:T.surface,color:historyInPage>=inTotalPages?T.muted:T.text,fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:12.5,fontWeight:700,cursor:historyInPage>=inTotalPages?"default":"pointer",opacity:historyInPage>=inTotalPages?0.5:1,transition:"all .18s"}}>
                            Next →
                          </button>
                        </div>
                        <select value={historyPageSize} onChange={e=>setHistoryPageSize(Number(e.target.value)||6)}
                          style={{padding:"8px 12px",borderRadius:9,border:`1px solid ${T.border}`,background:T.surface,color:T.text,fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:12,fontWeight:600,cursor:"pointer",outline:"none"}}>
                          {[6,10,15,20].map(n=><option key={n} value={n}>{n} / halaman</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                {historyTab==="audit"&&isAdmin&&(
                  <div>
                    <p style={{fontSize:12.5,color:T.muted,fontWeight:500,marginBottom:16}}>Audit log aktivitas sistem untuk admin/operator.</p>
                    {/* Filter bar */}
                    <div className="fbar">
                      <div style={{position:"relative",flexShrink:0}}>
                        <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:13,color:T.muted,pointerEvents:"none"}}>🔍</span>
                        <input className="ifield" style={{width:190,paddingLeft:32}} placeholder="Filter actor username" value={auditActor} onChange={e=>setAuditActor(e.target.value)}/>
                      </div>
                      <select className="ifield" style={{width:190}} value={auditAction} onChange={e=>setAuditAction(e.target.value)}>
                        <option value="">Semua action</option>
                        {[
                          "auth.login","admin.resetDummy","admin.backupExport","admin.restoreBackup","items.create","items.update","items.delete",
                          "transactions.create","transactions.pending","transactions.approve","transactions.reject","transactions.delete","receives.create","receives.delete",
                          "master.create","master.delete",
                        ].map(a=><option key={a} value={a}>{a}</option>)}
                      </select>
                      <span style={{fontSize:11.5,color:T.muted,fontWeight:700,flexShrink:0}}>Dari</span>
                      <input type="date" className="ifield" style={{width:160}} value={auditFrom} onChange={e=>setAuditFrom(e.target.value)}/>
                      <span style={{fontSize:11.5,color:T.muted,fontWeight:700,flexShrink:0}}>Sampai</span>
                      <input type="date" className="ifield" style={{width:160}} value={auditTo} onChange={e=>setAuditTo(e.target.value)}/>
                      <select className="ifield" style={{width:120}} value={auditPageSize} onChange={e=>setAuditPageSize(Number(e.target.value)||8)}>
                        {[8,12,20].map(n=><option key={n} value={n}>{n}/hal</option>)}
                      </select>
                      <BtnG style={{fontSize:11.5,padding:"7px 12px",flexShrink:0}} onClick={()=>{setAuditActor("");setAuditAction("");setAuditFrom("");setAuditTo("");}}>↺ Reset</BtnG>
                    </div>
                    {/* Rows */}
                    {auditRows.length===0
                      ?<div style={{textAlign:"center",padding:"60px 0",color:T.muted}}><div style={{fontSize:36,marginBottom:12}}>🛡</div>Belum ada audit log</div>
                      :(
                        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:16,overflow:"hidden",minWidth:0}}>
                          {auditRows.map((a,ri)=>{
                            const actionIconMap:Record<string,string>={
                              "auth.login":"🔑","auth.logout":"🚪",
                              "items.create":"📦","items.update":"✏️","items.delete":"🗑️",
                              "transactions.create":"↗️","transactions.pending":"⏳","transactions.approve":"✅","transactions.reject":"⛔","transactions.delete":"🗑️",
                              "receives.create":"🚚","receives.delete":"🗑️",
                              "admin.resetDummy":"⚙️","admin.backupExport":"💾","admin.restoreBackup":"♻️",
                              "master.create":"🏷️","master.delete":"🗑️",
                            };
                            const actionColorMap:Record<string,string>={
                              "auth.login":T.green,"auth.logout":T.muted,
                              "items.create":"#0ea5e9","items.update":"#6366f1","items.delete":T.red,
                              "transactions.create":"#8b5cf6","transactions.pending":T.amber,"transactions.approve":T.green,"transactions.reject":T.red,"transactions.delete":T.red,
                              "receives.create":T.amber,"receives.delete":T.red,
                              "admin.resetDummy":T.red,"admin.backupExport":"#f97316","admin.restoreBackup":"#14b8a6",
                              "master.create":"#ec4899","master.delete":T.red,
                            };
                            const icon=actionIconMap[a.action]||"📋";
                            const color=actionColorMap[a.action]||T.muted;
                            const dt=new Date(a.createdAt);
                            const dateStr=`${dt.getDate()}/${dt.getMonth()+1}/${dt.getFullYear()}, ${dt.getHours().toString().padStart(2,"0")}.${dt.getMinutes().toString().padStart(2,"0")}.${dt.getSeconds().toString().padStart(2,"0")}`;
                            return(
                              <div key={a.id} className="audit-row"
                                onMouseEnter={e=>{e.currentTarget.style.background=dark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.02)";}}
                                onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
                                {/* Icon circle */}
                                <div style={{width:46,height:46,borderRadius:"50%",background:dark?`${color}22`:`${color}18`,border:`1.5px solid ${color}55`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>
                                  {icon}
                                </div>
                                {/* Action + badges */}
                                <div className="audit-col-action">
                                  <div style={{fontSize:13.5,fontWeight:800,color:T.text,marginBottom:6}}>{a.action}</div>
                                  <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                                    <span style={{fontSize:10.5,fontWeight:700,color:T.navActiveText,background:T.navActive,padding:"2px 9px",borderRadius:5,border:`1px solid ${T.navActiveBorder}`}}>Actor: {a.actor?.username||"-"}</span>
                                    <span style={{fontSize:10.5,fontWeight:700,color:T.muted,background:T.surface,padding:"2px 9px",borderRadius:5,border:`1px solid ${T.border}`}}>Role: {a.actor?.role||"-"}</span>
                                  </div>
                                </div>
                                {/* Target */}
                                <div className="audit-col-target">
                                  <div style={{fontSize:9.5,fontWeight:800,color:T.muted,textTransform:"uppercase",letterSpacing:".07em",marginBottom:4}}>Target</div>
                                  <div style={{fontSize:12.5,fontWeight:600,color:T.text}}>{a.target||"-"}</div>
                                </div>
                                {/* Date */}
                                <div className="audit-col-date">
                                  <span>📅</span><span>{dateStr}</span>
                                </div>
                                {/* ID badge */}
                                <div className="audit-col-id" style={{background:T.amberBg,border:`1px solid ${T.amberBorder}`,color:T.amberText,borderRadius:8,padding:"4px 12px",fontSize:12,fontWeight:800}}>
                                  #{a.id}
                                </div>
                                {/* Arrow btn */}
                                <div className="audit-col-arrow" style={{width:32,height:32,borderRadius:8,border:`1px solid ${T.border}`,background:T.surface,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:T.muted,fontSize:14,flexShrink:0,transition:"all .15s"}}
                                  onMouseEnter={e=>{(e.currentTarget as HTMLDivElement).style.borderColor=color;(e.currentTarget as HTMLDivElement).style.color=color;}}
                                  onMouseLeave={e=>{(e.currentTarget as HTMLDivElement).style.borderColor=T.border;(e.currentTarget as HTMLDivElement).style.color=T.muted;}}>
                                  →
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )
                    }
                    {/* Pagination */}
                    {auditRows.length>0&&(
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:16,gap:8,flexWrap:"wrap"}}>
                        <span style={{fontSize:11.5,color:T.muted,fontWeight:600}}>Menampilkan {(auditPage-1)*auditPageSize+1} – {Math.min(auditPage*auditPageSize,auditTotal)} dari {auditTotal} data</span>
                        <div style={{display:"flex",alignItems:"center",gap:5}}>
                          {/* Prev */}
                          <button onClick={()=>setAuditPage(p=>Math.max(1,p-1))} disabled={auditPage<=1}
                            style={{width:34,height:34,borderRadius:8,border:`1px solid ${T.border}`,background:T.surface,color:auditPage<=1?T.muted:T.text,fontSize:14,fontWeight:700,cursor:auditPage<=1?"default":"pointer",opacity:auditPage<=1?0.4:1,transition:"all .18s"}}>
                            ‹
                          </button>
                          {/* Numbered pages with ellipsis */}
                          {(()=>{
                            const pages:number[]=[];
                            for(let i=1;i<=auditTotalPages;i++){
                              if(i===1||i===auditTotalPages||Math.abs(i-auditPage)<=1) pages.push(i);
                            }
                            const els:React.ReactNode[]=[];
                            let prev=-1;
                            pages.forEach(p=>{
                              if(prev!==-1&&p-prev>1) els.push(<span key={`e${p}`} style={{width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:T.muted}}>…</span>);
                              els.push(
                                <button key={p} onClick={()=>setAuditPage(p)}
                                  style={{width:34,height:34,borderRadius:8,border:`1px solid ${auditPage===p?T.primary:T.border}`,background:auditPage===p?T.primary:T.surface,color:auditPage===p?"white":T.muted,fontSize:13,fontWeight:800,cursor:"pointer",transition:"all .18s"}}>
                                  {p}
                                </button>
                              );
                              prev=p;
                            });
                            return els;
                          })()}
                          {/* Next */}
                          <button onClick={()=>setAuditPage(p=>Math.min(auditTotalPages,p+1))} disabled={auditPage>=auditTotalPages}
                            style={{width:34,height:34,borderRadius:8,border:`1px solid ${T.border}`,background:T.surface,color:auditPage>=auditTotalPages?T.muted:T.text,fontSize:14,fontWeight:700,cursor:auditPage>=auditTotalPages?"default":"pointer",opacity:auditPage>=auditTotalPages?0.4:1,transition:"all .18s"}}>
                            ›
                          </button>
                        </div>
                        <select value={auditPageSize} onChange={e=>setAuditPageSize(Number(e.target.value)||8)}
                          style={{padding:"8px 12px",borderRadius:9,border:`1px solid ${T.border}`,background:T.surface,color:T.text,fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:12,fontWeight:600,cursor:"pointer",outline:"none"}}>
                          {[8,12,20].map(n=><option key={n} value={n}>{n}/hal</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* ══ MODAL CATAT PENGAMBILAN ══ */}
      {showModal&&(
        <div className="overlay" onClick={()=>setShowModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:22,fontWeight:900,...gText(),marginBottom:4}}>Catat Pengambilan</div>
            <div style={{fontSize:12,color:T.muted,marginBottom:22}}>Satu transaksi bisa mencakup beberapa barang sekaligus</div>
            <div className="sect-box">
              <div className="sect-lbl">👤 Data Pengambil</div>
              <div className="mgrid">
                <div><FL>Tanggal *</FL><input className="ifield" type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></div>
                <div><FL>Nama Pengambil *</FL>
                  <SearchSelect options={employees.map(e=>({value:e.name,label:e.name}))} value={form.taker} onChange={v=>setForm({...form,taker:v})} placeholder="— Cari/pilih karyawan —"/>
                </div>
                <div><FL>Section *</FL>
                  <SearchSelect options={departments.map(d=>({value:d.name,label:d.name}))} value={form.dept} onChange={v=>setForm({...form,dept:v})} placeholder="— Cari/pilih section —"/>
                </div>
                <div><FL>Admin Warehouse *</FL>
                  <SearchSelect options={admins.map(a=>({value:a.name,label:a.name}))} value={form.admin} onChange={v=>setForm({...form,admin:v})} placeholder="— Cari/pilih admin —"/>
                </div>
                <div className="mspan"><FL>No. Project</FL>
                  <SearchSelect options={workOrders.map(w=>({value:w.code,label:`${w.code} — ${w.project}`}))} value={form.workOrder} onChange={v=>setForm({...form,workOrder:v})} placeholder="— Cari/pilih project (opsional) —"/>
                </div>
                <div className="mspan"><FL>Keterangan</FL><input className="ifield" placeholder="Keperluan pengambilan..." value={form.note} onChange={e=>setForm({...form,note:e.target.value})}/></div>
              </div>
            </div>
            <div className="sect-box">
              <div className="sect-lbl">🛒 Tambah ke Keranjang</div>
              <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
                <div style={{flex:"1 1 0",minWidth:0}}><FL>Pilih Barang</FL>
                  <SearchSelect
                    options={items.map(i=>{const ic=form.cart.find(c=>c.itemId===i.id);const av=i.stock-(ic?.qty||0);return{value:String(i.id),label:`${i.name} (sisa: ${av} ${i.unit})`,disabled:av<=0};})}
                    value={pickerItem}
                    onChange={v=>setPickerItem(v)}
                    placeholder="— Cari/pilih barang —"
                  />
                </div>
                <div style={{flex:"0 0 80px"}}><FL>Jumlah</FL><input className="ifield" type="number" min="1" placeholder="0" value={pickerQty} onChange={e=>setPickerQty(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addToCart()}/></div>
                <BtnP onClick={addToCart} style={{padding:"10px 14px",flexShrink:0,fontSize:12,borderRadius:10}}>+ Add</BtnP>
              </div>
            </div>
            <div style={{marginBottom:20}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={{fontSize:12,fontWeight:800,color:T.text,display:"flex",alignItems:"center",gap:8}}>
                  Keranjang {form.cart.length>0&&<Badge bg={T.navActive} color={T.navActiveText} border={T.navActiveBorder}>{form.cart.length} item · {form.cart.reduce((a,c)=>a+c.qty,0)} unit</Badge>}
                </div>
                {form.cart.length>0&&<button style={{background:"none",border:"none",color:T.muted,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:11.5,fontWeight:600}} onClick={()=>setForm(f=>({...f,cart:[]}))}>Kosongkan</button>}
              </div>
              {form.cart.length===0
                ?<div style={{textAlign:"center",padding:22,background:dark?"rgba(0,0,0,0.12)":T.surface,border:`1.5px dashed ${T.border}`,borderRadius:11,color:T.muted,fontSize:12.5}}>🛒 Belum ada barang ditambahkan</div>
                :form.cart.map(c=>{const it=items.find(i=>i.id===c.itemId);const cc=catColor(it?.category);return(
                  <div key={c.itemId} className="cart-row">
                    <div style={{width:30,height:30,background:cc.bg,border:`1px solid ${cc.border}`,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>⚙</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:700,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{it?.name}</div>
                      <div style={{fontSize:11,color:T.muted}}>{it?.category}</div>
                    </div>
                    <span style={{background:T.navActive,border:`1px solid ${T.navActiveBorder}`,color:T.navActiveText,fontSize:12,fontWeight:800,padding:"4px 12px",borderRadius:8,flexShrink:0}}>{c.qty} {it?.unit}</span>
                    <button style={{background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:18,lineHeight:1,padding:"2px 4px",transition:"color .15s"}} onClick={()=>removeCart(c.itemId)} onMouseEnter={e=>e.currentTarget.style.color=T.redText} onMouseLeave={e=>e.currentTarget.style.color=T.muted}>×</button>
                  </div>
                );})}
            </div>
            <div style={{display:"flex",gap:10}}>
              <BtnP onClick={submitTrx} style={{flex:1,padding:"13px",fontSize:14,borderRadius:12}}>💾 Simpan Transaksi</BtnP>
              <BtnG onClick={()=>{setShowModal(false);setPickerItem("");setPickerQty("");}}>Batal</BtnG>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL ADD NEW ITEM ══ */}
      {showNewItem&&(
        <div className="overlay" onClick={()=>setShowNewItem(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:540}}>
            <div style={{fontSize:22,fontWeight:900,...gText(),marginBottom:4}}>➕ Add New Item</div>
            <div style={{fontSize:12,color:T.muted,marginBottom:22}}>Input manual data barang baru beserta foto produk</div>
            <div className="sect-box">
              <div className="sect-lbl">📷 Foto Barang</div>
              <div style={{display:"flex",gap:14,alignItems:"center"}}>
                <div style={{width:96,height:96,borderRadius:12,overflow:"hidden",border:`1px solid ${T.border}`,background:T.navActive,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,padding:6}}>
                  {newItemForm.photo
                    ?<img src={newItemForm.photo} alt={newItemForm.name||"Preview"} style={{width:"100%",height:"100%",objectFit:"contain"}}/>
                    :<span style={{fontSize:28,opacity:.4}}>📷</span>
                  }
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:11.5,color:T.muted,marginBottom:8,lineHeight:1.5}}>Upload foto barang (JPG/PNG/WEBP, maks 2MB)</div>
                  <label style={{display:"inline-flex",alignItems:"center",gap:7,background:T.navActive,border:`1px solid ${T.navActiveBorder}`,borderRadius:10,padding:"8px 14px",cursor:"pointer",fontSize:12,fontWeight:700,color:T.navActiveText}}>
                    📂 Pilih Foto
                    <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>2097152){toast$("Ukuran foto maks 2MB","err");return;}const reader=new FileReader();reader.onload=ev=>setNewItemForm(p=>({...p,photo:ev.target?.result||null}));reader.readAsDataURL(f);}}/>
                  </label>
                  {newItemForm.photo&&<button onClick={()=>setNewItemForm(p=>({...p,photo:null}))} style={{marginLeft:8,background:"none",border:"none",color:T.muted,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:11.5,fontWeight:600}}>✕ Hapus</button>}
                </div>
              </div>
            </div>
            <div className="sect-box">
              <div className="sect-lbl">📋 Data Barang Baru</div>
              <div className="mgrid">
                <div className="mspan"><FL>Nama Barang *</FL><input className="ifield" placeholder="Nama barang..." value={newItemForm.name} onChange={e=>setNewItemForm(p=>({...p,name:e.target.value}))}/></div>
                <div><FL>Item Kode</FL><input className="ifield" placeholder="Contoh: AS21205" value={newItemForm.itemCode} onChange={e=>setNewItemForm(p=>({...p,itemCode:e.target.value}))}/></div>
                <div><FL>Kategori *</FL>
                  <select className="ifield" value={newItemForm.category} onChange={e=>setNewItemForm(p=>({...p,category:e.target.value}))}>
                    {ITEM_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div><FL>Satuan *</FL><input className="ifield" placeholder="pcs / box / set" value={newItemForm.unit} onChange={e=>setNewItemForm(p=>({...p,unit:e.target.value}))}/></div>
                <div><FL>Min Stock *</FL><input className="ifield" type="number" min="0" placeholder="0" value={newItemForm.minStock} onChange={e=>setNewItemForm(p=>({...p,minStock:e.target.value}))}/></div>
                <div><FL>Stok Awal *</FL><input className="ifield" type="number" min="0" placeholder="0" value={newItemForm.stock} onChange={e=>setNewItemForm(p=>({...p,stock:e.target.value}))}/></div>
                <div><FL>Harga Awal (Rp)</FL><input className="ifield" type="number" min="0" placeholder="0" value={newItemForm.hargaAwal} onChange={e=>setNewItemForm(p=>({...p,hargaAwal:e.target.value}))}/></div>
              </div>
            </div>
            <div style={{display:"flex",gap:10}}>
              <BtnP onClick={submitNewItem} style={{flex:1,padding:"13px",fontSize:14,borderRadius:12}}>💾 Simpan Item</BtnP>
              <BtnG onClick={()=>{setShowNewItem(false);setNewItemForm(emptyNewItem());}}>Batal</BtnG>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL RECEIVE NEW ══ */}
      {showAdd&&(
        <div className="overlay" onClick={()=>setShowAdd(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:520}}>
            <div style={{fontSize:22,fontWeight:900,...gText(),marginBottom:4}}>📥 Receive New</div>
            <div style={{fontSize:12,color:T.muted,marginBottom:22}}>Catat penerimaan barang dan tambahkan stok ke inventaris</div>
            <div className="sect-box">
              <div className="sect-lbl">📄 Dokumen Penerimaan</div>
              <div className="mgrid">
                <div><FL>PO Number</FL><input className="ifield" placeholder="Nomor Purchase Order" value={addForm.poNumber} onChange={e=>setAddForm({...addForm,poNumber:e.target.value})}/></div>
                <div><FL>Delivery Order Number</FL><input className="ifield" placeholder="Nomor Delivery Order" value={addForm.doNumber} onChange={e=>setAddForm({...addForm,doNumber:e.target.value})}/></div>
                <div><FL>Tanggal *</FL><input className="ifield" type="date" value={addForm.date} onChange={e=>setAddForm({...addForm,date:e.target.value})}/></div>
                <div><FL>Admin Warehouse *</FL>
                  <SearchSelect options={admins.map(a=>({value:a.name,label:a.name}))} value={addForm.admin} onChange={v=>setAddForm({...addForm,admin:v})} placeholder="— Cari/pilih admin —"/>
                </div>
              </div>
            </div>
            <div className="sect-box">
              <div className="sect-lbl">📦 Barang yang Diterima</div>
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                <div><FL>Nama Barang *</FL>
                  <SearchSelect
                    options={items.map(i=>({value:String(i.id),label:`${i.name} (stok: ${i.stock} ${i.unit})`}))}
                    value={addForm.itemId}
                    onChange={v=>setAddForm({...addForm,itemId:v})}
                    placeholder="— Cari/pilih barang —"
                  />
                </div>
                {addForm.itemId&&(()=>{const it=items.find(i=>i.id===+addForm.itemId);return it?(
                  <div style={{display:"flex",gap:8}}>
                    <div style={{flex:1,background:T.navActive,border:`1px solid ${T.navActiveBorder}`,borderRadius:10,padding:"10px 13px"}}>
                      <div style={{fontSize:10,fontWeight:800,color:T.muted,textTransform:"uppercase",letterSpacing:".08em",marginBottom:4}}>Kategori</div>
                      <div style={{fontSize:13,fontWeight:700,color:T.navActiveText}}>{it.category}</div>
                    </div>
                    <div style={{flex:1,background:T.navActive,border:`1px solid ${T.navActiveBorder}`,borderRadius:10,padding:"10px 13px"}}>
                      <div style={{fontSize:10,fontWeight:800,color:T.muted,textTransform:"uppercase",letterSpacing:".08em",marginBottom:4}}>Stok Saat Ini</div>
                      <div style={{fontSize:13,fontWeight:700,color:T.navActiveText}}>{it.stock} {it.unit}</div>
                    </div>
                  </div>
                ):null;})()}
                <div><FL>Jumlah Diterima *</FL>
                  <input className="ifield" type="number" min="1" placeholder="0"
                    value={addForm.qty} onChange={e=>setAddForm({...addForm,qty:e.target.value})}/>
                </div>
                <div><FL>Harga Beli / Unit *</FL>
                  <input className="ifield" type="number" min="0" placeholder="0"
                    value={addForm.buyPrice} onChange={e=>setAddForm({...addForm,buyPrice:e.target.value})}/>
                </div>
                {addForm.itemId&&(()=>{const it=items.find(i=>i.id===+addForm.itemId);return it?(
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    <div style={{background:T.navActive,border:`1px solid ${T.navActiveBorder}`,borderRadius:10,padding:"10px 13px"}}>
                      <div style={{fontSize:10,fontWeight:800,color:T.muted,textTransform:"uppercase",letterSpacing:".08em",marginBottom:4}}>Harga Avg Saat Ini</div>
                      <div style={{fontSize:13,fontWeight:700,color:T.navActiveText}}>{fmtMoney(it.averageCost)}</div>
                    </div>
                    <div style={{background:T.navActive,border:`1px solid ${T.navActiveBorder}`,borderRadius:10,padding:"10px 13px"}}>
                      <div style={{fontSize:10,fontWeight:800,color:T.muted,textTransform:"uppercase",letterSpacing:".08em",marginBottom:4}}>Last Price</div>
                      <div style={{fontSize:13,fontWeight:700,color:T.navActiveText}}>{fmtMoney(it.lastPrice)}</div>
                    </div>
                  </div>
                ):null;})()}
              </div>
            </div>
            {/* ── Lampiran ── */}
            <div className="sect-box">
              <div className="sect-lbl">📎 Lampiran Dokumen <span style={{fontWeight:400,fontSize:10,color:T.muted}}>(opsional · PDF, JPG, PNG · maks 10MB)</span></div>
              <div
                onDragOver={e=>{e.preventDefault();setAddFormDragOver(true);}}
                onDragLeave={()=>setAddFormDragOver(false)}
                onDrop={e=>{
                  e.preventDefault();setAddFormDragOver(false);
                  const f=e.dataTransfer.files?.[0];if(!f)return;
                  if(!["image/jpeg","image/png","application/pdf"].includes(f.type)){toast$("Hanya PDF, JPG, PNG yang diizinkan","err");return;}
                  if(f.size>10485760){toast$("Ukuran lampiran maks 10MB","err");return;}
                  const reader=new FileReader();
                  reader.onload=ev=>setAddForm(p=>({...p,attachment:ev.target?.result as string||null}));
                  reader.readAsDataURL(f);
                }}
                style={{border:`2px dashed ${addFormDragOver?T.primary:T.border}`,borderRadius:12,padding:"18px 16px",textAlign:"center",transition:"border-color .2s",background:addFormDragOver?T.navActive:"transparent",cursor:"pointer"}}
                onClick={()=>{if(!addForm.attachment)(document.getElementById("attach-upload-input") as HTMLInputElement)?.click();}}
              >
                {addForm.attachment?(()=>{
                  const isPdf=addForm.attachment.startsWith("data:application/pdf");
                  return(
                    <div style={{display:"flex",alignItems:"center",gap:10,justifyContent:"center"}}>
                      <span style={{fontSize:28}}>{isPdf?"📄":"🖼️"}</span>
                      <div style={{textAlign:"left"}}>
                        <div style={{fontSize:12,fontWeight:700,color:T.navActiveText}}>{isPdf?"Dokumen PDF":"Gambar"} terlampir</div>
                        <div style={{fontSize:10,color:T.muted,marginTop:2}}>Klik ✕ untuk hapus</div>
                      </div>
                      <button onClick={e=>{e.stopPropagation();setAddForm(p=>({...p,attachment:null}));}} style={{marginLeft:8,background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:16,fontWeight:700}}>✕</button>
                    </div>
                  );
                })():(
                  <div>
                    <div style={{fontSize:24,marginBottom:6}}>📂</div>
                    <div style={{fontSize:12,fontWeight:600,color:T.muted}}>Drag & drop file ke sini, atau <span style={{color:T.primary,fontWeight:700}}>klik untuk pilih</span></div>
                  </div>
                )}
                <input id="attach-upload-input" type="file" accept=".pdf,.jpg,.jpeg,.png,image/jpeg,image/png,application/pdf" style={{display:"none"}} onChange={e=>{
                  const f=e.target.files?.[0];if(!f)return;
                  if(!["image/jpeg","image/png","application/pdf"].includes(f.type)){toast$("Hanya PDF, JPG, PNG yang diizinkan","err");return;}
                  if(f.size>10485760){toast$("Ukuran lampiran maks 10MB","err");return;}
                  const reader=new FileReader();
                  reader.onload=ev=>setAddForm(p=>({...p,attachment:ev.target?.result as string||null}));
                  reader.readAsDataURL(f);
                  e.target.value="";
                }}/>
              </div>
            </div>
            <div style={{display:"flex",gap:10}}>
              <BtnP onClick={submitAdd} style={{flex:1,padding:"13px",fontSize:14,borderRadius:12}}>💾 Simpan Penerimaan</BtnP>
              <BtnG onClick={()=>setShowAdd(false)}>Batal</BtnG>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL CATAT RETUR ══ */}
      {showRetur&&(
        <div className="overlay" onClick={()=>setShowRetur(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:480}}>
            <div style={{fontSize:20,fontWeight:900,...gText(),marginBottom:4}}>↩ Catat Retur Barang</div>
            <div style={{fontSize:12,color:T.muted,marginBottom:18}}>Barang yang diretur akan otomatis menambah stok kembali.</div>
            <div className="sect-box">
              <div className="sect-lbl">👤 Data Pengembali</div>
              <div><FL>Nama Pengembali *</FL>
                <SearchSelect options={employees.map(e=>({value:e.name,label:e.name}))} value={returForm.employee} onChange={v=>setReturForm(p=>({...p,employee:v}))} placeholder="— Cari/pilih karyawan —"/>
              </div>
            </div>
            <div className="sect-box">
              <div className="sect-lbl">📦 Barang yang Diretur</div>
              <select className="ifield" style={{width:"100%"}} value={returForm.itemId} onChange={e=>setReturForm(p=>({...p,itemId:e.target.value}))}>
                <option value="">-- Pilih barang --</option>
                {items.map(it=><option key={it.id} value={it.id}>{it.name} (Stok: {it.stock} {it.unit})</option>)}
              </select>
            </div>
            <div className="sect-box">
              <div className="sect-lbl">🔢 Jumlah Dikembalikan</div>
              <input className="ifield" type="number" min="1" style={{width:"100%"}} placeholder="Qty yang dikembalikan..." value={returForm.qty} onChange={e=>setReturForm(p=>({...p,qty:e.target.value}))}/>
            </div>
            <div className="sect-box">
              <div className="sect-lbl">📋 Alasan Retur</div>
              <select className="ifield" style={{width:"100%"}} value={returForm.reason} onChange={e=>setReturForm(p=>({...p,reason:e.target.value}))}>
                {RETUR_REASONS.map(r=><option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="sect-box">
              <div className="sect-lbl">📝 Catatan Tambahan <span style={{fontWeight:400,color:T.muted}}>(opsional)</span></div>
              <input className="ifield" style={{width:"100%"}} placeholder="Catatan tambahan..." value={returForm.note} onChange={e=>setReturForm(p=>({...p,note:e.target.value}))}/>
            </div>
            <div style={{display:"flex",gap:10,marginTop:4}}>
              <BtnP onClick={submitRetur} style={{flex:1,padding:"13px",fontSize:14,borderRadius:12}}>💾 Simpan Retur</BtnP>
              <BtnG onClick={()=>setShowRetur(false)}>Batal</BtnG>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL EDIT ITEM ══ */}
      {showEdit&&editItem&&(
        <div className="overlay" onClick={()=>setShowEdit(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:480}}>
            <div style={{fontSize:22,fontWeight:900,...gText(),marginBottom:4}}>✏️ Edit Barang</div>
            <div style={{fontSize:12,color:T.muted,marginBottom:22}}>Perbarui nama, kategori, dan foto barang</div>
            <div className="sect-box">
              <div className="sect-lbl">📷 Foto Barang</div>
              <div style={{display:"flex",gap:14,alignItems:"center"}}>
                <div style={{width:90,height:90,borderRadius:12,overflow:"hidden",border:`1px solid ${T.border}`,background:T.navActive,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  {editItem.photo
                    ?<img src={editItem.photo} alt={editItem.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                    :<span style={{fontSize:28,opacity:.4}}>📷</span>
                  }
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:11.5,color:T.muted,marginBottom:8,lineHeight:1.5}}>Upload foto barang (JPG/PNG/WEBP, maks 2MB)</div>
                  <label style={{display:"inline-flex",alignItems:"center",gap:7,background:T.navActive,border:`1px solid ${T.navActiveBorder}`,borderRadius:10,padding:"8px 14px",cursor:"pointer",fontSize:12,fontWeight:700,color:T.navActiveText}}>
                    📂 Pilih Foto
                    <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>{const f=e.target.files[0];if(!f)return;if(f.size>2097152){toast$("Ukuran foto maks 2MB","err");return;}const reader=new FileReader();reader.onload=ev=>setEditItem(p=>({...p,photo:ev.target.result}));reader.readAsDataURL(f);}}/>
                  </label>
                  {editItem.photo&&<button onClick={()=>setEditItem(p=>({...p,photo:null}))} style={{marginLeft:8,background:"none",border:"none",color:T.muted,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:11.5,fontWeight:600}}>✕ Hapus</button>}
                </div>
              </div>
            </div>
            <div className="sect-box">
              <div className="sect-lbl">📋 Informasi Barang</div>
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                <div><FL>Nama Barang *</FL><input className="ifield" value={editItem.name} onChange={e=>setEditItem(p=>({...p,name:e.target.value}))} placeholder="Nama barang..."/></div>
                <div><FL>Kategori *</FL>
                  <select className="ifield" value={editItem.category} onChange={e=>setEditItem(p=>({...p,category:e.target.value}))}>
                    {ITEM_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div style={{display:"flex",gap:10}}>
              <BtnP onClick={submitEdit} style={{flex:1,padding:"13px",fontSize:14,borderRadius:12}}>💾 Simpan Perubahan</BtnP>
              <BtnG onClick={()=>{setShowEdit(false);setEditItem(null);}}>Batal</BtnG>
            </div>
          </div>
        </div>
      )}

      {/* IDLE WARNING POPUP */}
      {idleWarning&&(
        <div style={{position:"fixed",inset:0,zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.65)",backdropFilter:"blur(4px)"}}>
          <div style={{background:T.surfaceSolid,border:`1px solid ${T.amberBorder}`,borderRadius:20,padding:"36px 40px",maxWidth:400,width:"90%",textAlign:"center",boxShadow:T.shadowCard}}>
            <div style={{fontSize:44,marginBottom:12}}>⏳</div>
            <div style={{fontSize:18,fontWeight:800,color:T.text,marginBottom:8}}>Sesi Hampir Berakhir</div>
            <div style={{fontSize:14,color:T.muted,marginBottom:20,lineHeight:1.6}}>
              Tidak ada aktivitas terdeteksi.<br/>
              Anda akan logout otomatis dalam
            </div>
            <div style={{fontSize:52,fontWeight:900,color:T.amber,marginBottom:24,fontVariantNumeric:"tabular-nums",letterSpacing:"-1px"}}>{idleCountdown}<span style={{fontSize:22,fontWeight:600}}>s</span></div>
            <BtnP onClick={()=>keepAliveRef.current?.()} style={{width:"100%",padding:"14px",fontSize:15,borderRadius:14}}>
              Tetap Login
            </BtnP>
          </div>
        </div>
      )}

      {/* MODAL PREVIEW LAMPIRAN */}
      {attachPreview&&(
        <div className="overlay" onClick={()=>{URL.revokeObjectURL(attachPreview.blobUrl);setAttachPreview(null);}}>  
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:680,width:"95%",padding:"28px 28px 22px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
              <div style={{fontSize:16,fontWeight:900,color:T.text}}>📎 Lampiran Dokumen</div>
              <button onClick={()=>{URL.revokeObjectURL(attachPreview.blobUrl);setAttachPreview(null);}} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:T.muted,lineHeight:1,padding:4}}>✕</button>
            </div>
            <div style={{fontSize:12,color:T.muted,marginBottom:14,wordBreak:"break-all"}}>{attachPreview.name}</div>
            {attachPreview.mimeType==="application/pdf"?(
              <iframe
                src={attachPreview.blobUrl}
                title={attachPreview.name}
                style={{width:"100%",height:520,border:`1px solid ${T.border}`,borderRadius:12,display:"block"}}
              />
            ):(
              <div style={{textAlign:"center",borderRadius:12,overflow:"hidden",border:`1px solid ${T.border}`,background:T.surface,maxHeight:520,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <img src={attachPreview.blobUrl} alt="Lampiran" style={{maxWidth:"100%",maxHeight:520,objectFit:"contain"}}/>
              </div>
            )}
            <div style={{display:"flex",justifyContent:"flex-end",marginTop:16,gap:10}}>
              <a
                href={attachPreview.data}
                download={attachPreview.name}
                style={{display:"inline-flex",alignItems:"center",gap:6,padding:"8px 16px",borderRadius:8,border:`1px solid ${T.border}`,background:T.surface,color:T.text,fontSize:12,fontWeight:700,textDecoration:"none"}}
              >⬇ Unduh</a>
              <BtnG onClick={()=>{URL.revokeObjectURL(attachPreview.blobUrl);setAttachPreview(null);}}>Tutup</BtnG>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast&&<div className="toast" style={{background:toast.type==="err"?T.redBg:T.greenBg,border:`1px solid ${toast.type==="err"?T.redBorder:T.greenBorder}`,color:toast.type==="err"?T.redText:T.greenText}}>
        <span style={{fontSize:15}}>{toast.type==="err"?"✕":"✓"}</span>{toast.msg}
      </div>}

      {/* BOTTOM NAV — mobile only */}
      <nav className="bottom-nav">
        <div className="bn-inner">
          {visibleTabs.map(t=>(
            <button key={t.id} className={`bn-item${tab===t.id?" active":""}`} onClick={()=>{setTab(t.id);setSidebar(false);}}>
              {t.id==="transaction"&&todayTrx.length>0&&<span className="bn-pill">{todayTrx.length}</span>}
              <span className="bn-item-icon">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </nav>
      <BusyOverlay/>
    </div>
  );
}
