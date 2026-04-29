// @ts-nocheck
import { useState, useRef, useEffect } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const API = (
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? "http://localhost:3001/api" : "/api")
).replace(/\/$/, "");

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

// gradient text helper — solid color agar tidak tertutup
const gText = () => ({ color: T.primaryLight });

const CATS = ["Semua","APD","Abrasif","Cutting Tool","Material","Kebersihan"];
const TABS = [
  {id:"dashboard",label:"Dashboard",icon:"⬡"},
  {id:"transaction",label:"Pengambilan",icon:"◈"},
  {id:"stock",label:"Stok Barang",icon:"◉"},
  {id:"history",label:"Riwayat",icon:"◎"},
];
const ITEM_CATEGORIES = ["APD","Abrasif","Cutting Tool","Material","Kebersihan"];
const MAX_STOCK_VALUE = 1000000;
const MAX_TEXT_LEN = 120;

const todayStr=()=>new Date().toISOString().split("T")[0];
const nowTime=()=>new Date().toTimeString().slice(0,5);
const fmtDate=d=>d?new Date(d+"T00:00:00").toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"}):""; 
const todayFmt=()=>new Date().toLocaleDateString("id-ID",{weekday:"short",day:"2-digit",month:"short",year:"numeric"});
const emptyForm=()=>({taker:"",dept:"",workOrder:"",note:"",date:todayStr(),admin:"",cart:[]});
const emptyNewItem=()=>({name:"",itemCode:"",category:"APD",unit:"pcs",minStock:"",stock:"",photo:null});
const toSafeRows = (rows) => Array.isArray(rows) ? rows : (rows ? [rows] : []);
const csvEscape = (v) => {
  const s = String(v ?? "").replace(/"/g, '""');
  return /[",\n]/.test(s) ? `"${s}"` : s;
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

const stockStatus=it=>{
  if(it.stock===0) return{bg:T.redBg,text:T.redText,border:T.redBorder,dot:T.red,label:"Habis"};
  if(it.stock<=it.minStock) return{bg:T.amberBg,text:T.amberText,border:T.amberBorder,dot:T.amber,label:"Restok"};
  return{bg:T.greenBg,text:T.greenText,border:T.greenBorder,dot:T.green,label:"Aman"};
};
const catColor=cat=>({
  APD:{dot:"#10b981",bg:"rgba(16,185,129,0.1)",text:"#6ee7b7",border:"rgba(16,185,129,0.25)"},
  Abrasif:{dot:"#f59e0b",bg:"rgba(245,158,11,0.1)",text:"#fcd34d",border:"rgba(245,158,11,0.25)"},
  "Cutting Tool":{dot:"#3b82f6",bg:"rgba(59,130,246,0.1)",text:"#93c5fd",border:"rgba(59,130,246,0.25)"},
  Material:{dot:"#8b5cf6",bg:"rgba(139,92,246,0.1)",text:"#c4b5fd",border:"rgba(139,92,246,0.25)"},
  Kebersihan:{dot:"#ec4899",bg:"rgba(236,72,153,0.1)",text:"#f9a8d4",border:"rgba(236,72,153,0.25)"},
}[cat]||{dot:T.primary,bg:T.navActive,text:T.navActiveText,border:T.navActiveBorder});

// ─── MICRO COMPONENTS ─────────────────────────────────────────────
const Prog=({pct,color})=>(
  <div style={{height:3,background:"rgba(128,128,128,0.15)",borderRadius:4,overflow:"hidden",marginTop:6}}>
    <div style={{height:"100%",width:`${Math.min(100,Math.max(0,pct))}%`,background:color,borderRadius:4,transition:"width .5s ease"}}/>
  </div>
);
const Badge=({children,bg,color,border})=>(
  <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"3px 10px",borderRadius:20,background:bg||T.surface,color:color||T.muted,border:`1px solid ${border||T.border}`,fontSize:10,fontWeight:700,whiteSpace:"nowrap",letterSpacing:".05em"}}>{children}</span>
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
  const [dark,setDark]=useState(true);
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
  const [searchQ,setSearchQ]=useState("");
  const [trxDate,setTrxDate]=useState("");
  const [showModal,setShowModal]=useState(false);
  const [showAdd,setShowAdd]=useState(false);
  const [showNewItem,setShowNewItem]=useState(false);
  const [toast,setToast]=useState(null);
  const [notif,setNotif]=useState(false);
  const [form,setForm]=useState(emptyForm());
  const [newItemForm,setNewItemForm]=useState(emptyNewItem());
  const [addForm,setAddForm]=useState({poNumber:"",doNumber:"",date:todayStr(),admin:"",itemId:"",qty:""});
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
  const [historyTab,setHistoryTab]=useState("out");
  const [historyQuery,setHistoryQuery]=useState("");
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
  const [sidebarCollapsed,setSidebarCollapsed]=useState(false);
  const notifRef=useRef(null);
  const restoreInputRef=useRef(null);
  const loading=loadingCount>0;
  const isAdmin = (user?.role || "").toLowerCase() === "admin";
  const visibleTabs = isAdmin ? TABS : TABS.filter(t=>t.id!=="history");

  T=getT(dark);

  const apiFetch=async(path,options={})=>{
    const headers={...(options.headers||{})};
    if(authToken)headers.Authorization=`Bearer ${authToken}`;
    const r=await fetch(`${API}${path}`,{...options,headers});
    if(r.status===401){
      setAuthToken("");
      setLoggedIn(false);
      setUser(null);
      localStorage.removeItem("wms_token");
      localStorage.removeItem("wms_user");
      setTab("login");
      throw new Error("Sesi login berakhir, silakan login lagi");
    }
    return r;
  };

  useEffect(()=>{
    if(authToken)localStorage.setItem("wms_token",authToken);
    else localStorage.removeItem("wms_token");
  },[authToken]);

  const withLoading=async(task,message="Sedang memproses data")=>{
    setLoadingText(message);
    setLoadingCount(c=>c+1);
    try{
      return await task();
    }finally{
      setLoadingCount(c=>Math.max(0,c-1));
    }
  };

  // ── FETCH SEMUA DATA ─────────────────────────────────────────────
  const fetchAll=async()=>withLoading(async()=>{
    try{
      const [it,tr,adm,dep,emp,wo,rcv]=await Promise.all([
        apiFetch("/items").then(r=>r.json()),
        apiFetch("/transactions").then(r=>r.json()),
        apiFetch("/admins").then(r=>r.json()),
        apiFetch("/departments").then(r=>r.json()),
        apiFetch("/employees").then(r=>r.json()),
        apiFetch("/work-orders").then(r=>r.json()),
        apiFetch("/receives").then(r=>r.json()),
      ]);
      setItems(it); setTrx(tr); setAdmins(adm); setDepartments(dep); setEmployees(emp); setWorkOrders(wo); setReceives(rcv);
    }catch(e){toast$(e?.message||"Gagal terhubung ke server","err");}
  },"Sedang memuat data");

  useEffect(()=>{if(loggedIn)fetchAll();},[loggedIn]);
  useEffect(()=>{
    if(!visibleTabs.some(t=>t.id===tab)) setTab("dashboard");
  },[tab,visibleTabs]);

  const lowStock=items.filter(i=>i.stock<=i.minStock);
  const todayTrx=trx.filter(t=>t.date===todayStr());
  const todayUnits=todayTrx.reduce((a,t)=>a+t.items.reduce((b,i)=>b+i.qty,0),0);
  const totalOut=trx.reduce((a,t)=>a+t.items.reduce((b,i)=>b+i.qty,0),0);
  const totalIn=receives.reduce((a,r)=>a+r.qty,0);
  const filtItems=items.filter(i=>(catF==="Semua"||i.category===catF)&&i.name.toLowerCase().includes(searchQ.toLowerCase()));
  const filtTrx=[...trx].reverse().filter(t=>!trxDate||t.date===trxDate);
  const dateMatch=(d)=>{
    if(!d) return true;
    if(historyFrom&&d<historyFrom) return false;
    if(historyTo&&d>historyTo) return false;
    return true;
  };
  const q=historyQuery.trim().toLowerCase();
  const filteredOut=[...trx].filter(t=>dateMatch(t.date)&&(q===""||[t.taker,t.dept,t.admin,t.workOrder,t.note,...(t.items||[]).map(i=>i.itemName)].filter(Boolean).join(" ").toLowerCase().includes(q))).sort((a,b)=>b.id-a.id);
  const filteredIn=[...receives].filter(r=>dateMatch(r.date)&&(q===""||[r.itemName,r.poNumber,r.doNumber,r.admin].filter(Boolean).join(" ").toLowerCase().includes(q))).sort((a,b)=>b.id-a.id);
  const outTotalPages=Math.max(1,Math.ceil(filteredOut.length/historyPageSize));
  const inTotalPages=Math.max(1,Math.ceil(filteredIn.length/historyPageSize));
  const pagedOut=filteredOut.slice((historyOutPage-1)*historyPageSize,historyOutPage*historyPageSize);
  const pagedIn=filteredIn.slice((historyInPage-1)*historyPageSize,historyInPage*historyPageSize);
  const auditTotalPages=Math.max(1,Math.ceil(auditTotal/auditPageSize));

  useEffect(()=>{document.body.style.background=T.bg;document.body.style.transition="background .4s,color .3s";},[dark]);
  useEffect(()=>{setHistoryOutPage(1);setHistoryInPage(1);},[historyQuery,historyFrom,historyTo,historyPageSize]);
  useEffect(()=>{if(historyOutPage>outTotalPages)setHistoryOutPage(outTotalPages);},[historyOutPage,outTotalPages]);
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
    const h=e=>{if(notifRef.current&&!notifRef.current.contains(e.target))setNotif(false);};
    document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);
  },[]);

  const toast$=(msg,type="ok")=>{setToast({msg,type});setTimeout(()=>setToast(null),3200);};
  const login=async()=>withLoading(async()=>{
    try{
      const r=await fetch(`${API}/login`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(loginForm)});
      if(!r.ok){const e=await r.json();toast$(e.error||"Login gagal","err");return;}
      const {token,user:u}=await r.json();
      setAuthToken(token||"");
      setLoggedIn(true);
      setUser(u);
      localStorage.setItem("wms_user",JSON.stringify(u));
      setTab("dashboard");
      toast$("Selamat datang ✓");
    }catch{toast$("Server tidak bisa dihubungi","err");}
  },"Sedang login");
  const logout=()=>{
    setLoggedIn(false);
    setUser(null);
    setAuthToken("");
    localStorage.removeItem("wms_user");
    localStorage.removeItem("wms_token");
    setTab("login");
    setItems([]);
    setTrx([]);
  };
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
        if(!r.ok)throw new Error();
        toast$(`Transaksi ${form.taker} tercatat`);
        setForm(emptyForm());setPickerItem("");setPickerQty("");setShowModal(false);
        await fetchAll();
      }catch{toast$("Gagal menyimpan transaksi","err");}
    },"Sedang menyimpan transaksi");
  };
  const submitAdd=async()=>{
    if(!isAdmin){toast$("Hanya admin yang boleh menambah stok","err");return;}
    if(!addForm.itemId||!addForm.qty||+addForm.qty<1||!addForm.admin){toast$("Lengkapi semua field wajib","err");return;}
    await withLoading(async()=>{
      try{
        const r=await apiFetch("/receives",{method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({itemId:+addForm.itemId,qty:+addForm.qty,poNumber:addForm.poNumber,doNumber:addForm.doNumber,date:addForm.date,admin:addForm.admin})});
        if(!r.ok)throw new Error();
        setAddForm({poNumber:"",doNumber:"",date:todayStr(),admin:"",itemId:"",qty:""});setShowAdd(false);
        toast$("Stok berhasil ditambahkan ✓");
        await fetchAll();
      }catch{toast$("Gagal menyimpan penerimaan","err");}
    },"Sedang menyimpan penerimaan");
  };
  const submitNewItem=async()=>{
    if(!isAdmin){toast$("Hanya admin yang boleh menambah item","err");return;}
    const name = String(newItemForm.name || "").trim();
    const itemCode = String(newItemForm.itemCode || "").trim();
    const unit = String(newItemForm.unit || "").trim();
    const stock = Number(newItemForm.stock);
    const minStock = Number(newItemForm.minStock);

    if(!name||!newItemForm.category||!unit){toast$("Nama, kategori, dan satuan wajib diisi","err");return;}
    if(!ITEM_CATEGORIES.includes(newItemForm.category)){toast$("Kategori tidak valid","err");return;}
    if(name.length<3||name.length>MAX_TEXT_LEN){toast$("Nama barang harus 3-120 karakter","err");return;}
    if(itemCode.length>40){toast$("Item kode maksimal 40 karakter","err");return;}
    if(unit.length<1||unit.length>20){toast$("Satuan harus 1-20 karakter","err");return;}
    if(newItemForm.stock===""||newItemForm.minStock===""){toast$("Stok awal dan min stok wajib diisi","err");return;}
    if(!Number.isInteger(stock)||!Number.isInteger(minStock)){toast$("Stok harus bilangan bulat","err");return;}
    if(stock<0||minStock<0){toast$("Nilai stok tidak boleh negatif","err");return;}
    if(stock>MAX_STOCK_VALUE||minStock>MAX_STOCK_VALUE){toast$(`Stok maksimal ${MAX_STOCK_VALUE.toLocaleString("id-ID")}`,"err");return;}
    await withLoading(async()=>{
      try{
        const payload={
          name,
          itemCode,
          category:newItemForm.category,
          unit,
          stock,
          minStock,
          photo:newItemForm.photo||null,
        };
        const r=await apiFetch("/items",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
        if(!r.ok){
          if(r.status===413) throw new Error("Foto terlalu besar untuk diproses server");
          let msg="";
          try{const e=await r.json();msg=e?.error||"";}catch{}
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
          try{const e=await r.json();msg=e?.error||"";}catch{}
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
          try{const e=await r.json();msg=e?.error||msg;}catch{}
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
          try{const er=await r.json();msg=er?.error||msg;}catch{}
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
        t.id,t.date,t.time,t.taker,t.dept,t.workOrder||"",t.admin||"",it.itemName,it.qty,it.unit,t.note||"",
      ])),
    ];
    const csv=rows.map(r=>r.map(csvEscape).join(",")).join("\n");
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
        r.id,r.date,r.time,r.itemName,r.qty,r.unit,r.poNumber||"",r.doNumber||"",r.admin||"",
      ]),
    ];
    const csv=rows.map(r=>r.map(csvEscape).join(",")).join("\n");
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

  // ── CSS STRING ────────────────────────────────────────────────
  const CSS=`
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,500;1,600;1,700;1,800;1,900&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Plus Jakarta Sans',sans-serif;background:${T.bg};color:${T.text};min-height:100vh;-webkit-font-smoothing:antialiased;transition:background .4s,color .3s;font-size:13px;line-height:1.6}
    ::-webkit-scrollbar{width:4px;height:4px}
    ::-webkit-scrollbar-track{background:transparent}
    ::-webkit-scrollbar-thumb{background:${T.border};border-radius:4px}

    .shell{display:flex;min-height:100vh;position:relative;z-index:1}

    /* SIDEBAR */
    .sidebar{width:228px;flex-shrink:0;background:${T.sidebarBg};border-right:1px solid ${T.border};display:flex;flex-direction:column;position:sticky;top:0;height:100vh;overflow-y:auto;backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);transition:transform .28s cubic-bezier(.4,0,.2,1),width .22s ease;z-index:100}
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
    .sidebar.collapsed .sb-inner{padding:0 8px 16px}
    .sb-inner{display:flex;flex-direction:column;height:100%;padding:0 12px 20px}
    .brand{padding:20px 8px 18px;display:flex;align-items:center;gap:11px;border-bottom:1px solid ${T.border};margin-bottom:20px;flex-shrink:0}
    .brand-logo{width:48px;height:48px;border-radius:10px;background:#ffffff;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;padding:3px}
    .brand-name{font-size:16px;font-weight:900;color:${T.primaryLight};line-height:1.2}
    .brand-sub{font-size:9px;color:${T.muted};letter-spacing:.12em;text-transform:uppercase;font-weight:700;margin-top:2px}
    .nav-label{font-size:9px;font-weight:800;color:${T.muted};letter-spacing:.18em;text-transform:uppercase;padding:0 8px 10px}
    .nav-item{display:flex;align-items:center;gap:10px;width:100%;padding:10px;border-radius:11px;cursor:pointer;border:1px solid transparent;font-family:'Plus Jakarta Sans',sans-serif;font-size:12.5px;font-weight:600;color:${T.muted};text-align:left;transition:all .2s ease;margin-bottom:3px;background:transparent}
    .nav-item:hover{background:${T.surface};color:${T.text};border-color:${T.border}}
    .nav-item.active{background:${T.navActive};color:${T.navActiveText};border-color:${T.navActiveBorder};box-shadow:0 0 12px ${T.primaryGlow}}
    .nav-icon{font-size:14px;width:18px;text-align:center;flex-shrink:0}
    .nav-pill{margin-left:auto;background:${T.primary};color:white;font-size:10px;font-weight:800;padding:1px 8px;border-radius:20px}
    .sb-footer{margin-top:auto;padding-top:14px;border-top:1px solid ${T.border};flex-shrink:0}

    /* MAIN */
    .main{flex:1;display:flex;flex-direction:column;min-width:0}
    .topbar{height:64px;background:${T.topbarBg};border-bottom:1px solid ${T.border};padding:0 24px;display:flex;align-items:center;justify-content:space-between;gap:12px;position:sticky;top:0;z-index:50;flex-shrink:0;backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px)}
    .page-title{font-size:22px;font-weight:900;color:${T.text}}
    .tb-btn{display:inline-flex;align-items:center;gap:6px;padding:7px 13px;border:1px solid ${T.border};border-radius:10px;background:${T.surface};color:${T.muted};font-family:'Plus Jakarta Sans',sans-serif;font-size:12px;font-weight:600;cursor:pointer;transition:all .2s;backdrop-filter:blur(12px)}
    .tb-btn:hover{border-color:${T.borderHover};color:${T.text}}
    .tb-logout{display:none !important}
    .tb-logout:hover{background:${T.redBg};border-color:${T.redBorder};color:${T.redText}}
    .nav-item.mobile-logout{display:none;border-color:${T.redBorder};color:${T.redText};background:${T.redBg}}
    .nav-item.mobile-logout:hover{background:${T.redBg};border-color:${T.redBorder};color:${T.redText}}

    /* TOGGLE — smooth cubic */
    .toggle-wrap{display:flex;align-items:center;gap:8px;background:${T.surface};border:1px solid ${T.border};border-radius:30px;padding:5px 10px 5px 13px;cursor:pointer;user-select:none;transition:all .2s}
    .toggle-wrap:hover{border-color:${T.borderHover}}
    .toggle-lbl{font-size:11px;font-weight:700;color:${T.muted}}
    .toggle-track{width:42px;height:23px;border-radius:12px;background:${dark?`linear-gradient(135deg,${T.primary},${T.primaryLight})`:`rgba(100,116,139,0.25)`};position:relative;transition:background .35s ease;box-shadow:${dark?`0 0 8px ${T.primaryGlow}`:"none"}}
    .toggle-thumb{width:17px;height:17px;border-radius:50%;background:#fff;position:absolute;top:3px;left:${dark?"22px":"3px"};transition:left .3s cubic-bezier(.4,0,.2,1);box-shadow:0 2px 6px rgba(0,0,0,0.25)}

    .body-area{padding:28px 24px 52px;flex:1;overflow-y:auto}
    .enter{animation:fadeIn .32s ease}
    @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}

    .sec{font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;color:${T.muted};margin:24px 0 14px;display:flex;align-items:center;gap:12px}
    .sec::after{content:'';flex:1;height:1px;background:${T.border}}

    .stats-g{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px}
    .two-col{display:grid;grid-template-columns:1.4fr 1fr;gap:16px}
    .stock-g{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
    .hist-g{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px}

    /* CARDS */
    .stat-card{background:${T.card};border:1px solid ${T.border};border-radius:18px;padding:20px 22px;backdrop-filter:blur(12px);transition:all .25s;position:relative;overflow:hidden;box-shadow:${T.shadowSm}}
    .stat-card:hover{border-color:${T.borderHover};transform:translateY(-3px);box-shadow:${T.shadowCard}}
    .card{background:${T.card};border:1px solid ${T.border};border-radius:20px;padding:22px 24px;backdrop-filter:blur(12px);transition:all .25s;box-shadow:${T.shadowSm}}
    .card:hover{border-color:${T.borderHover};box-shadow:${T.shadowCard}}
    .stk-card{background:${T.card};border:1px solid ${T.border};border-radius:18px;padding:18px;display:flex;flex-direction:column;gap:14px;backdrop-filter:blur(12px);transition:all .25s;position:relative;overflow:hidden;box-shadow:${T.shadowSm}}
    .stk-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,${T.primary},transparent);opacity:.65}
    .stk-card:hover{border-color:${T.borderHover};transform:translateY(-4px);box-shadow:${T.shadowCard}}

    .trx-card{background:${T.card};border:1px solid ${T.border};border-radius:16px;margin-bottom:10px;overflow:hidden;transition:all .22s;backdrop-filter:blur(10px);box-shadow:${T.shadowSm}}
    .trx-card:hover{border-color:${T.borderHover};box-shadow:${T.shadowCard}}
    .trx-head{padding:14px 18px;border-bottom:1px solid ${T.border};display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
    .trx-body{padding:10px 14px 13px;display:flex;flex-wrap:wrap;gap:6px}
    .itm-pill{display:inline-flex;align-items:center;gap:6px;background:${dark?"rgba(0,0,0,0.15)":T.surface};border:1px solid ${T.border};border-radius:9px;padding:5px 10px}

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
    .login-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px;position:relative;z-index:1}
    .login-card{
      background:${dark?"rgba(10,32,20,0.72)":"rgba(255,255,255,0.9)"};
      border:1px solid ${T.border};
      border-radius:24px;
      padding:44px 40px;
      width:420px;max-width:100%;
      box-shadow:${T.shadowCard};
      backdrop-filter:blur(18px);
      -webkit-backdrop-filter:blur(18px);
      position:relative;overflow:hidden;
      animation:fadeIn .4s ease;
    }
    .login-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,${T.primary},${T.primaryLight},#14b8a6);border-radius:24px 24px 0 0}
    @media(max-width:480px){
      .login-card{padding:36px 22px;border-radius:18px}
      .login-wrap{padding:12px;align-items:flex-start;padding-top:32px}
    }

    @media(max-width:1100px){
      .stats-g{grid-template-columns:repeat(2,1fr)}
      .hist-g{grid-template-columns:repeat(2,1fr)}
      .two-col{grid-template-columns:1fr}
    }
    @media(max-width:860px){
      .stock-g{grid-template-columns:repeat(2,1fr)}
      .body-area{padding:20px 16px 44px}
    }
    @media(max-width:660px){
      .sidebar{position:fixed;left:0;top:0;bottom:0;transform:translateX(-100%);box-shadow:20px 0 50px rgba(0,0,0,.5);z-index:260}
      .sidebar.open{transform:translateX(0)}
      .sb-inner{padding-bottom:88px}
      .backdrop-mob{display:block}
      .topbar{padding:0 12px;gap:8px}
      .page-title{font-size:16px}
      .tb-reset-dummy{display:none}
      .nav-item.mobile-logout{display:flex}
      .body-area{padding:14px 12px 40px}
      .stock-g{grid-template-columns:1fr 1fr}
      .two-col{grid-template-columns:1fr}
      .mgrid{grid-template-columns:1fr}
      .mspan{grid-column:span 1}
      .modal{padding:20px 14px;border-radius:18px}
      .trx-head{flex-direction:column;gap:6px;align-items:flex-start}
      .fbar{gap:6px}
      .cat-btn{padding:6px 10px;font-size:11px}
      .toggle-lbl{display:none}
      .stat-card{padding:16px}
      .card{padding:16px 16px}
      .date-btn{display:none}
    }
    @media(max-width:420px){
      .stats-g{grid-template-columns:1fr 1fr}
      .hist-g{grid-template-columns:1fr 1fr}
      .stock-g{grid-template-columns:1fr}
      .stk-card{padding:14px}
      .body-area{padding:12px 10px 36px}
      .topbar{padding:0 10px}
      .modal{padding:16px 12px}
      .cart-row{flex-wrap:wrap}
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
    <div className="toggle-wrap" onClick={()=>setDark(!dark)} style={mini?{padding:"4px 8px 4px 10px"}:{}}>
      <span className="toggle-lbl">{dark?"🌙":"☀️"}{!mini&&(dark?" Dark":" Light")}</span>
      <div className="toggle-track"><div className="toggle-thumb"/></div>
    </div>
  );

  const BusyOverlay=()=>loading?(
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
    <div style={{position:"relative"}}>
      <style>{CSS}</style>
      <Blobs/>
      <div className="login-wrap">
        <div className="login-card">
          {/* toggle pojok kanan atas */}
          <div style={{position:"absolute",top:16,right:16}}><Toggle mini/></div>

          <div style={{display:"flex",justifyContent:"center",marginBottom:20}}>
            <img src={dark?"/tokki-logo dark mode.png":"/tokki-logo.png"} alt="Tokki" style={{height:dark?52:64,objectFit:"contain"}}/>
          </div>

          <div style={{display:"inline-flex",alignItems:"center",gap:6,background:T.navActive,border:`1px solid ${T.navActiveBorder}`,borderRadius:20,padding:"4px 12px",fontSize:10,fontWeight:800,color:T.navActiveText,marginBottom:16}}>
            Warehouse Management System
          </div>

          {/* TITLE — FIXED gradient text */}
          <div style={{fontSize:32,fontWeight:900,lineHeight:1.15,marginBottom:8,...gText()}}>
            Selamat Datang
          </div>
          <div style={{fontSize:13,color:T.muted,marginBottom:28,fontWeight:500,lineHeight:1.6}}>
            Masuk untuk mengelola inventaris barang consumable gudang
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div><FL>Username</FL>
              <input className="ifield" type="text" placeholder="Masukkan username"
                value={loginForm.username} onChange={e=>setLoginForm({...loginForm,username:e.target.value})}
                onKeyDown={e=>e.key==="Enter"&&login()}/>
            </div>
            <div><FL>Password</FL>
              <div style={{position:"relative"}}>
                <input className="ifield" type={showLoginPassword?"text":"password"} placeholder="Masukkan password"
                  style={{paddingRight:94}}
                  value={loginForm.password} onChange={e=>setLoginForm({...loginForm,password:e.target.value})}
                  onKeyDown={e=>e.key==="Enter"&&login()}/>
                <button type="button" onClick={()=>setShowLoginPassword(v=>!v)}
                  style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",border:`1px solid ${T.border}`,background:T.surface,borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700,color:T.muted,cursor:"pointer"}}>
                  {showLoginPassword?"Tutup":"Lihat"}
                </button>
              </div>
            </div>
            <BtnP onClick={login} style={{padding:"13px",fontSize:14,marginTop:4,width:"100%",borderRadius:12}}>
              🔐 Masuk ke Dashboard
            </BtnP>
          </div>
          <div style={{textAlign:"center",marginTop:18,fontSize:11.5,color:T.muted,fontStyle:"italic"}}>
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
            <div className="nav-label">Menu Utama</div>
            {visibleTabs.map(t=>(
              <button key={t.id} className={`nav-item${tab===t.id?" active":""}`} onClick={()=>{setTab(t.id);setSidebar(false);}}>
                <span className="nav-icon">{t.icon}</span><span className="nav-text">{t.label}</span>
                {t.id==="transaction"&&todayTrx.length>0&&<span className="nav-pill">{todayTrx.length}</span>}
              </button>
            ))}
            <button className="nav-item mobile-logout" onClick={logout}>
              <span className="nav-icon">⎋</span><span className="nav-text">Keluar Akun</span>
            </button>
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
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <button className="tb-btn" style={{padding:"7px 10px",flexShrink:0}} onClick={()=>{if(window.innerWidth<=660){setSidebar(v=>!v);}else{setSidebarCollapsed(v=>!v);}}}>
                <svg width="15" height="12" viewBox="0 0 15 12" fill="none"><rect width="15" height="1.5" rx="1" fill="currentColor"/><rect y="5.25" width="15" height="1.5" rx="1" fill="currentColor"/><rect y="10.5" width="15" height="1.5" rx="1" fill="currentColor"/></svg>
              </button>
              <h1 className="page-title">{TABS.find(t=>t.id===tab)?.label||"Dashboard"}</h1>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
              {isAdmin&&tab!=="login"&&(
                <button className="tb-btn" onClick={downloadBackupData} style={{fontWeight:700}}>
                  ⬇ Backup
                </button>
              )}
              {isAdmin&&tab!=="login"&&(
                <button className="tb-btn" onClick={()=>restoreInputRef.current?.click()} style={{fontWeight:700}}>
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
                <button className="tb-btn" onClick={()=>setNotif(!notif)} style={{position:"relative",padding:"7px 12px"}}>
                  🔔
                  {lowStock.length>0&&<span style={{position:"absolute",top:-3,right:-3,background:T.red,color:"white",fontSize:9,fontWeight:800,borderRadius:"50%",width:16,height:16,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>{lowStock.length}</span>}
                </button>
                {notif&&(
                  <div className="notif-drop">
                    <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`,background:T.surface}}>
                      <div style={{fontSize:13,fontWeight:800,...gText()}}>⚠️ Alert Stok</div>
                      <div style={{fontSize:11,color:T.muted,marginTop:2}}>{lowStock.length} item perlu perhatian</div>
                    </div>
                    <div style={{maxHeight:260,overflowY:"auto"}}>
                      {lowStock.length===0
                        ?<div style={{padding:16,textAlign:"center",color:T.muted,fontSize:12}}>Semua stok aman ✅</div>
                        :lowStock.map(it=>{const s=stockStatus(it);return(
                          <div key={it.id} style={{padding:"10px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:10}}>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:12,fontWeight:700,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{it.name}</div>
                              <div style={{fontSize:10.5,color:T.muted,marginTop:1}}>Sisa {it.stock} / min {it.minStock} {it.unit}</div>
                              <Prog pct={it.minStock?it.stock/it.minStock*100:0} color={s.dot}/>
                            </div>
                            <Badge bg={s.bg} color={s.text} border={s.border}>{s.label}</Badge>
                          </div>
                        );})}
                    </div>
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
                {/* HERO STRIP */}
                <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:20,padding:"20px 24px",marginBottom:24,position:"relative",overflow:"hidden",backdropFilter:"blur(12px)",boxShadow:T.shadowSm}}>
                  <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${T.primary},${T.primaryLight},#14b8a6)`}}/>
                  <div style={{display:"flex",alignItems:"center",gap:16,flexWrap:"wrap",position:"relative"}}>
                    <div style={{flex:1,minWidth:200}}>
                      <div style={{display:"inline-flex",alignItems:"center",gap:6,background:T.navActive,border:`1px solid ${T.navActiveBorder}`,borderRadius:20,padding:"3px 12px",fontSize:10,fontWeight:800,color:T.navActiveText,marginBottom:8}}>🏭 Sistem Gudang Aktif</div>
                      <div style={{fontSize:19,fontWeight:800,...gText()}}>Ringkasan Hari Ini</div>
                      <div style={{fontSize:12,color:T.muted,marginTop:3,fontWeight:500}}>{todayFmt()} · {todayTrx.length} transaksi · {todayUnits} unit keluar</div>
                    </div>
                    <BtnP onClick={()=>setShowModal(true)} style={{flexShrink:0}}>+ Catat Pengambilan</BtnP>
                  </div>
                </div>

                {/* STATS */}
                <div className="stats-g">
                  {[
                    {label:"Total Item",val:items.length,color:T.primaryLight,sub:`${filtItems.length} tampil`,dot:T.primary},
                    {label:"Transaksi Hari Ini",val:todayTrx.length,color:"#6ee7b7",sub:`${todayUnits} unit keluar`,dot:"#10b981"},
                    {label:"Unit Keluar Hari Ini",val:todayUnits,color:"#a7f3d0",sub:"unit total",dot:"#34d399"},
                    {label:"Perlu Restok",val:lowStock.length,color:lowStock.length>0?T.redText:T.muted,sub:"item alert",dot:lowStock.length>0?T.red:T.muted},
                  ].map((s,i)=>(
                    <div key={i} className="stat-card">
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                        <div style={{fontSize:10,fontWeight:800,color:T.muted,letterSpacing:".08em",textTransform:"uppercase"}}>{s.label}</div>
                        <div style={{width:7,height:7,borderRadius:"50%",background:s.dot,boxShadow:`0 0 6px ${s.dot}`}}/>
                      </div>
                      <div style={{fontSize:44,fontWeight:900,lineHeight:1,color:s.color}}>{s.val}</div>
                      <div style={{fontSize:11,color:T.muted,marginTop:8,fontWeight:500}}>{s.sub}</div>
                    </div>
                  ))}
                </div>

                <div className="two-col">
                  <div className="card">
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                      <div style={{fontSize:16,fontWeight:800,...gText()}}>📋 Transaksi Hari Ini</div>
                      <button className="tb-btn" onClick={()=>setTab("history")} style={{fontSize:11,padding:"5px 11px"}}>Lihat semua →</button>
                    </div>
                    {todayTrx.length===0
                      ?<div style={{textAlign:"center",padding:"34px 0",color:T.muted}}><div style={{fontSize:32,marginBottom:8}}>📭</div>Belum ada transaksi hari ini</div>
                      :todayTrx.slice(0,4).map(t=>(
                        <div key={t.id} style={{padding:"11px 0",borderBottom:`1px solid ${T.border}`}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:7,gap:8}}>
                            <div>
                              <div style={{fontWeight:700,fontSize:13,color:T.text}}>{t.taker}</div>
                              <div style={{fontSize:11,color:T.muted,marginTop:2}}>{t.dept} · {t.time}</div>
                            </div>
                            <Badge bg={T.navActive} color={T.navActiveText} border={T.navActiveBorder}>{t.items.reduce((a,i)=>a+i.qty,0)} unit</Badge>
                          </div>
                          <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                            {t.items.map((it,ii)=>(
                              <span key={ii} style={{background:T.greenBg,color:T.greenText,fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:6,border:`1px solid ${T.greenBorder}`,whiteSpace:"nowrap"}}>
                                {it.itemName} ×{it.qty}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                  <div className="card">
                    <div style={{fontSize:16,fontWeight:800,...gText(),marginBottom:16}}>🔔 Alert Stok</div>
                    {lowStock.length===0
                      ?<div style={{textAlign:"center",padding:"34px 0"}}><div style={{fontSize:32,marginBottom:8}}>✅</div><div style={{fontSize:12.5,color:T.muted}}>Semua stok aman</div></div>
                      :lowStock.slice(0,5).map(it=>{const s=stockStatus(it);return(
                        <div key={it.id} className="al-row">
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:12.5,fontWeight:700,color:T.text}}>{it.name}</div>
                            <div style={{fontSize:10.5,color:T.muted,marginTop:2}}>Sisa {it.stock} / min {it.minStock} {it.unit}</div>
                            <Prog pct={it.minStock?it.stock/it.minStock*100:0} color={s.dot}/>
                          </div>
                          <Badge bg={s.bg} color={s.text} border={s.border}><span style={{width:5,height:5,borderRadius:"50%",background:s.dot,display:"inline-block"}}/> {s.label}</Badge>
                        </div>
                      );})}
                  </div>
                </div>
              </div>
            )}

            {/* ══ PENGAMBILAN ══ */}
            {tab==="transaction"&&(
              <div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:14,marginBottom:20,flexWrap:"wrap"}}>
                  <p style={{fontSize:12.5,color:T.muted,fontWeight:500}}>Catat pengambilan barang oleh karyawan. Satu transaksi bisa beberapa barang.</p>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {isAdmin&&<BtnG onClick={exportTransactionsExcel} style={{fontWeight:700}}>⬇ Excel</BtnG>}
                    {isAdmin&&<BtnG onClick={exportTransactionsPdf} style={{fontWeight:700}}>🧾 PDF</BtnG>}
                    <BtnP onClick={()=>setShowModal(true)}>+ Catat Pengambilan</BtnP>
                  </div>
                </div>
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
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13.5,fontWeight:700,color:T.text}}>{t.taker}</div>
                          <div style={{fontSize:11,color:T.muted,marginTop:3}}>{t.dept} · {fmtDate(t.date)} · {t.time}</div>
                          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:9}}>
                            {t.workOrder&&<Badge bg={T.greenBg} color={T.greenText} border={T.greenBorder}>🔧 {t.workOrder}</Badge>}
                            {t.note&&<Badge bg={T.surface} color={T.muted} border={T.border}>📝 {t.note}</Badge>}
                            <Badge bg={T.navActive} color={T.navActiveText} border={T.navActiveBorder}>Admin: {t.admin}</Badge>
                          </div>
                        </div>
                        <div style={{textAlign:"right",flexShrink:0}}>
                          <div style={{fontSize:26,fontWeight:900,color:T.primaryLight,lineHeight:1}}>{t.items.length}</div>
                          <div style={{fontSize:10,color:T.muted,fontWeight:600}}>jenis</div>
                          <div style={{fontSize:11.5,fontWeight:700,color:T.green,marginTop:3}}>{t.items.reduce((a,i)=>a+i.qty,0)} unit</div>
                          {isAdmin&&(
                            <button onClick={()=>deleteTransaction(t.id)} style={{marginTop:8,background:T.redBg,border:`1px solid ${T.redBorder}`,color:T.redText,borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>🗑 Hapus</button>
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

            {/* ══ STOK ══ */}
            {tab==="stock"&&(
              <div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:20,flexWrap:"wrap"}}>
                  <p style={{fontSize:12.5,color:T.muted,fontWeight:500}}>Kelola inventaris barang consumable gudang.</p>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    {isAdmin&&<BtnG onClick={()=>setShowNewItem(true)} style={{fontWeight:800}}>➕ Add New Item</BtnG>}
                    {isAdmin&&<BtnP onClick={()=>setShowAdd(true)}>📥 Receive New</BtnP>}
                  </div>
                </div>
                <div className="fbar">
                  <input className="ifield" placeholder="🔍 Cari barang..." value={searchQ} onChange={e=>setSearchQ(e.target.value)} style={{width:220}}/>
                  {CATS.map(c=><button key={c} className={`cat-btn${catF===c?" on":""}`} onClick={()=>setCatF(c)}>{c}</button>)}
                  <span style={{marginLeft:"auto",fontSize:11.5,color:T.muted}}>{filtItems.length} item</span>
                </div>
                <div className="stock-g">
                  {filtItems.length===0&&<div style={{gridColumn:"1/-1",textAlign:"center",padding:"60px 0",color:T.muted}}><div style={{fontSize:36,marginBottom:12}}>🔍</div>Tidak ada barang ditemukan</div>}
                  {filtItems.map(it=>{
                    const s=stockStatus(it); const cc=catColor(it.category); const pct=it.minStock?Math.min(100,it.stock/it.minStock*100):100;
                    return(
                      <div key={it.id} className="stk-card">
                        <div style={{width:"100%",height:110,borderRadius:10,marginBottom:8,background:dark?"rgba(0,0,0,0.16)":"rgba(255,255,255,0.75)",border:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",padding:8}}>
                          {it.photo
                            ?<img src={it.photo} alt={it.name} style={{width:"100%",height:"100%",objectFit:"contain",objectPosition:"center"}}/>
                            :<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",background:cc.bg,border:`1px dashed ${cc.border}`,borderRadius:8,fontSize:26,opacity:.45}}>📷</div>
                          }
                        </div>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                          <div style={{minWidth:0}}>
                            <div style={{fontSize:13.5,fontWeight:700,color:T.text,lineHeight:1.35,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{it.name}</div>
                            {it.itemCode&&<div style={{fontSize:11.5,color:T.muted,fontWeight:700,marginTop:3}}>Item Kode: {it.itemCode}</div>}
                            <div style={{display:"flex",alignItems:"center",gap:5,marginTop:4}}>
                              <span style={{width:6,height:6,borderRadius:"50%",background:cc.dot,display:"inline-block",flexShrink:0}}/>
                              <span style={{fontSize:11,color:cc.text,fontWeight:700}}>{it.category}</span>
                            </div>
                          </div>
                          <div style={{display:"flex",flexDirection:"column",gap:5,alignItems:"flex-end",flexShrink:0}}>
                            <Badge bg={s.bg} color={s.text} border={s.border}><span style={{width:5,height:5,borderRadius:"50%",background:s.dot,display:"inline-block"}}/> {s.label}</Badge>
                            {isAdmin&&(
                              <button onClick={e=>{e.stopPropagation();setEditItem({...it});setShowEdit(true);}}
                                style={{background:T.navActive,border:`1px solid ${T.navActiveBorder}`,borderRadius:7,padding:"3px 9px",cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:10,fontWeight:700,color:T.navActiveText,transition:"all .15s"}}
                                onMouseEnter={e=>{e.currentTarget.style.background=T.primary;e.currentTarget.style.color="white";e.currentTarget.style.borderColor=T.primary;}}
                                onMouseLeave={e=>{e.currentTarget.style.background=T.navActive;e.currentTarget.style.color=T.navActiveText;e.currentTarget.style.borderColor=T.navActiveBorder;}}>
                                ✏️ Edit
                              </button>
                            )}
                          </div>
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                          <div className="stk-box"><div style={{fontSize:9,fontWeight:800,color:T.muted,letterSpacing:".08em",textTransform:"uppercase",marginBottom:5}}>Stok</div><div style={{fontSize:22,fontWeight:900,lineHeight:1,color:it.stock<=it.minStock?T.redText:T.greenText}}>{it.stock}</div></div>
                          <div className="stk-box"><div style={{fontSize:9,fontWeight:800,color:T.muted,letterSpacing:".08em",textTransform:"uppercase",marginBottom:5}}>Min</div><div style={{fontSize:22,fontWeight:900,lineHeight:1,color:T.text}}>{it.minStock}</div></div>
                          <div className="stk-box"><div style={{fontSize:9,fontWeight:800,color:T.muted,letterSpacing:".08em",textTransform:"uppercase",marginBottom:5}}>Satuan</div><div style={{fontSize:11,fontWeight:700,color:T.muted,marginTop:5,wordBreak:"break-word"}}>{it.unit}</div></div>
                        </div>
                        <Prog pct={pct} color={s.dot}/>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ══ HISTORY ══ */}
            {tab==="history"&&(
              <div>
                {/* Sub-tab toggle */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:22}}>
                  <div style={{display:"flex",gap:6,background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:4,width:"fit-content"}}>
                    <button onClick={()=>setHistoryTab("out")} style={{padding:"9px 18px",borderRadius:9,border:"none",fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:12.5,fontWeight:700,cursor:"pointer",transition:"all .2s",background:historyTab==="out"?T.primary:"transparent",color:historyTab==="out"?"white":T.muted,boxShadow:historyTab==="out"?`0 4px 12px ${T.primaryGlow}`:"none"}}>📤 Pengambilan ({trx.length})</button>
                    <button onClick={()=>setHistoryTab("in")} style={{padding:"9px 18px",borderRadius:9,border:"none",fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:12.5,fontWeight:700,cursor:"pointer",transition:"all .2s",background:historyTab==="in"?T.primary:"transparent",color:historyTab==="in"?"white":T.muted,boxShadow:historyTab==="in"?`0 4px 12px ${T.primaryGlow}`:"none"}}>📥 Penerimaan ({receives.length})</button>
                    {isAdmin&&<button onClick={()=>setHistoryTab("audit")} style={{padding:"9px 18px",borderRadius:9,border:"none",fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:12.5,fontWeight:700,cursor:"pointer",transition:"all .2s",background:historyTab==="audit"?T.primary:"transparent",color:historyTab==="audit"?"white":T.muted,boxShadow:historyTab==="audit"?`0 4px 12px ${T.primaryGlow}`:"none"}}>🛡 Audit ({auditTotal})</button>}
                  </div>
                  {isAdmin&&(
                    <div style={{display:"flex",gap:8}}>
                      {historyTab!=="audit"&&<BtnG onClick={historyTab==="out"?exportTransactionsExcel:exportReceivesExcel} style={{fontWeight:700}}>⬇ Excel</BtnG>}
                      {historyTab!=="audit"&&<BtnG onClick={historyTab==="out"?exportTransactionsPdf:exportReceivesPdf} style={{fontWeight:700}}>🧾 PDF</BtnG>}
                      {historyTab==="audit"&&<BtnG onClick={exportAuditExcel} style={{fontWeight:700}}>⬇ Excel</BtnG>}
                      {historyTab==="audit"&&<BtnG onClick={exportAuditPdf} style={{fontWeight:700}}>🧾 PDF</BtnG>}
                    </div>
                  )}
                </div>

                {historyTab!=="audit"&&(
                  <div className="fbar">
                    <input className="ifield" style={{width:220}} placeholder="🔍 Cari nama/item/admin/PO/DO..." value={historyQuery} onChange={e=>setHistoryQuery(e.target.value)}/>
                    <span style={{fontSize:11.5,color:T.muted,fontWeight:700}}>Dari</span>
                    <input type="date" className="ifield" style={{width:160}} value={historyFrom} onChange={e=>setHistoryFrom(e.target.value)}/>
                    <span style={{fontSize:11.5,color:T.muted,fontWeight:700}}>Sampai</span>
                    <input type="date" className="ifield" style={{width:160}} value={historyTo} onChange={e=>setHistoryTo(e.target.value)}/>
                    <select className="ifield" style={{width:120}} value={historyPageSize} onChange={e=>setHistoryPageSize(Number(e.target.value)||6)}>
                      {[6,10,15,20].map(n=><option key={n} value={n}>{n}/hal</option>)}
                    </select>
                    <BtnG style={{fontSize:11.5,padding:"7px 12px"}} onClick={()=>{setHistoryQuery("");setHistoryFrom("");setHistoryTo("");}}>✕ Reset</BtnG>
                  </div>
                )}

                {/* ─ TAB PENGAMBILAN ─ */}
                {historyTab==="out"&&(
                  <div>
                    <p style={{fontSize:12.5,color:T.muted,fontWeight:500,marginBottom:16}}>Rekap seluruh pengambilan barang consumable gudang.</p>
                    <div className="hist-g">
                      {[
                        {label:"Total Transaksi",val:trx.length,color:T.primaryLight},
                        {label:"Total Unit Keluar",val:totalOut,color:"#6ee7b7"},
                        {label:"Item Berbeda",val:[...new Set(trx.flatMap(t=>t.items.map(i=>i.itemId)))].length,color:"#a7f3d0"},
                        {label:"Jumlah Pengambil",val:[...new Set(trx.map(t=>t.taker))].length,color:T.amberText},
                      ].map((s,i)=>(
                        <div key={i} className="stat-card">
                          <div style={{fontSize:10,fontWeight:800,color:T.muted,letterSpacing:".08em",textTransform:"uppercase",marginBottom:12}}>{s.label}</div>
                          <div style={{fontSize:40,fontWeight:900,lineHeight:1,color:s.color}}>{s.val}</div>
                        </div>
                      ))}
                    </div>
                    <div className="card" style={{marginBottom:16}}>
                      <div style={{fontSize:16,fontWeight:800,...gText(),marginBottom:16}}>🏆 Barang Paling Sering Diambil</div>
                      {(()=>{
                        const agg=trx.flatMap(t=>t.items).reduce((acc,it)=>{acc[it.itemName]=(acc[it.itemName]||0)+it.qty;return acc;},{});
                        const sorted=Object.entries(agg).sort((a,b)=>b[1]-a[1]).slice(0,5);const max=sorted[0]?.[1]||1;
                        return sorted.length===0?<div style={{textAlign:"center",padding:"24px 0",color:T.muted}}>Belum ada data</div>
                          :sorted.map(([name,qty],i)=>(
                            <div key={name} style={{display:"flex",alignItems:"center",gap:11,padding:"11px 0",borderBottom:`1px solid ${T.border}`}}>
                              <div style={{width:24,height:24,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,background:i===0?T.navActive:T.surface,color:i===0?T.navActiveText:T.muted,border:`1px solid ${i===0?T.navActiveBorder:T.border}`,flexShrink:0}}>{i+1}</div>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5,gap:8}}>
                                  <span style={{fontSize:13,fontWeight:700,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</span>
                                  <span style={{fontSize:12,fontWeight:800,color:T.greenText,flexShrink:0}}>{qty} unit</span>
                                </div>
                                <Prog pct={qty/max*100} color={i===0?T.primary:T.muted}/>
                              </div>
                            </div>
                          ));
                      })()}
                    </div>
                    <div style={{fontSize:17,fontWeight:800,...gText(),marginBottom:14}}>Log Lengkap</div>
                    {pagedOut.map(t=>(
                      <div key={t.id} className="trx-card">
                        <div className="trx-head">
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
                              <span style={{fontSize:13.5,fontWeight:700,color:T.text}}>{t.taker}</span>
                              <span style={{fontSize:11.5,color:T.muted}}>{t.dept}</span>
                            </div>
                            <div style={{fontSize:11,color:T.muted,marginTop:3}}>{fmtDate(t.date)} · {t.time} · Admin: {t.admin}{t.workOrder&&` · ${t.workOrder}`}</div>
                          </div>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <Badge bg={T.navActive} color={T.navActiveText} border={T.navActiveBorder}>{t.items.length} item · {t.items.reduce((a,i)=>a+i.qty,0)} unit</Badge>
                            {isAdmin&&<button onClick={()=>deleteTransaction(t.id)} style={{background:T.redBg,border:`1px solid ${T.redBorder}`,color:T.redText,borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>🗑 Hapus</button>}
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
                    {filteredOut.length>0&&(
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10,gap:8,flexWrap:"wrap"}}>
                        <span style={{fontSize:11.5,color:T.muted}}>Menampilkan {(historyOutPage-1)*historyPageSize+1}-{Math.min(historyOutPage*historyPageSize,filteredOut.length)} dari {filteredOut.length}</span>
                        <div style={{display:"flex",gap:8}}>
                          <BtnG onClick={()=>setHistoryOutPage(p=>Math.max(1,p-1))} disabled={historyOutPage<=1} style={{padding:"7px 12px",opacity:historyOutPage<=1?0.55:1}}>← Prev</BtnG>
                          <Badge bg={T.surface} color={T.text} border={T.border}>Page {historyOutPage}/{outTotalPages}</Badge>
                          <BtnG onClick={()=>setHistoryOutPage(p=>Math.min(outTotalPages,p+1))} disabled={historyOutPage>=outTotalPages} style={{padding:"7px 12px",opacity:historyOutPage>=outTotalPages?0.55:1}}>Next →</BtnG>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ─ TAB PENERIMAAN ─ */}
                {historyTab==="in"&&(
                  <div>
                    <p style={{fontSize:12.5,color:T.muted,fontWeight:500,marginBottom:16}}>Rekap seluruh penerimaan & penambahan stok barang.</p>
                    <div className="hist-g">
                      {[
                        {label:"Total Penerimaan",val:receives.length,color:T.primaryLight},
                        {label:"Total Unit Masuk",val:totalIn,color:"#6ee7b7"},
                        {label:"Item Berbeda",val:[...new Set(receives.map(r=>r.itemId))].length,color:"#a7f3d0"},
                        {label:"Admin Terlibat",val:[...new Set(receives.map(r=>r.admin).filter(Boolean))].length,color:T.amberText},
                      ].map((s,i)=>(
                        <div key={i} className="stat-card">
                          <div style={{fontSize:10,fontWeight:800,color:T.muted,letterSpacing:".08em",textTransform:"uppercase",marginBottom:12}}>{s.label}</div>
                          <div style={{fontSize:40,fontWeight:900,lineHeight:1,color:s.color}}>{s.val}</div>
                        </div>
                      ))}
                    </div>
                    {filteredIn.length===0
                      ?<div style={{textAlign:"center",padding:"60px 0",color:T.muted}}><div style={{fontSize:36,marginBottom:12}}>📭</div>Belum ada riwayat penerimaan</div>
                      :pagedIn.map(r=>(
                        <div key={r.id} className="trx-card">
                          <div className="trx-head">
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:7}}>
                                <span style={{fontSize:13.5,fontWeight:700,color:T.text}}>{r.itemName}</span>
                                <Badge bg={T.greenBg} color={T.greenText} border={T.greenBorder}>📦 +{r.qty} {r.unit}</Badge>
                              </div>
                              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                                {r.poNumber&&<Badge bg={T.navActive} color={T.navActiveText} border={T.navActiveBorder}>PO: {r.poNumber}</Badge>}
                                {r.doNumber&&<Badge bg={T.surface} color={T.muted} border={T.border}>DO: {r.doNumber}</Badge>}
                                <Badge bg={T.surface} color={T.muted} border={T.border}>📅 {fmtDate(r.date)}</Badge>
                                <Badge bg={T.surface} color={T.muted} border={T.border}>⏰ {r.time}</Badge>
                                <Badge bg={T.amberBg} color={T.amberText} border={T.amberBorder}>👤 {r.admin}</Badge>
                              </div>
                            </div>
                            {isAdmin&&<button onClick={()=>deleteReceive(r.id)} style={{background:T.redBg,border:`1px solid ${T.redBorder}`,color:T.redText,borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>🗑 Hapus</button>}
                          </div>
                        </div>
                      ))
                    }
                    {filteredIn.length>0&&(
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10,gap:8,flexWrap:"wrap"}}>
                        <span style={{fontSize:11.5,color:T.muted}}>Menampilkan {(historyInPage-1)*historyPageSize+1}-{Math.min(historyInPage*historyPageSize,filteredIn.length)} dari {filteredIn.length}</span>
                        <div style={{display:"flex",gap:8}}>
                          <BtnG onClick={()=>setHistoryInPage(p=>Math.max(1,p-1))} disabled={historyInPage<=1} style={{padding:"7px 12px",opacity:historyInPage<=1?0.55:1}}>← Prev</BtnG>
                          <Badge bg={T.surface} color={T.text} border={T.border}>Page {historyInPage}/{inTotalPages}</Badge>
                          <BtnG onClick={()=>setHistoryInPage(p=>Math.min(inTotalPages,p+1))} disabled={historyInPage>=inTotalPages} style={{padding:"7px 12px",opacity:historyInPage>=inTotalPages?0.55:1}}>Next →</BtnG>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {historyTab==="audit"&&isAdmin&&(
                  <div>
                    <p style={{fontSize:12.5,color:T.muted,fontWeight:500,marginBottom:16}}>Audit log aktivitas sistem untuk admin/operator.</p>
                    <div className="fbar">
                      <input className="ifield" style={{width:180}} placeholder="Filter actor username" value={auditActor} onChange={e=>setAuditActor(e.target.value)}/>
                      <select className="ifield" style={{width:180}} value={auditAction} onChange={e=>setAuditAction(e.target.value)}>
                        <option value="">Semua action</option>
                        {[
                          "auth.login","admin.resetDummy","admin.backupExport","admin.restoreBackup","items.create","items.update","items.delete",
                          "transactions.create","transactions.delete","receives.create","receives.delete",
                          "master.create","master.delete",
                        ].map(a=><option key={a} value={a}>{a}</option>)}
                      </select>
                      <span style={{fontSize:11.5,color:T.muted,fontWeight:700}}>Dari</span>
                      <input type="date" className="ifield" style={{width:160}} value={auditFrom} onChange={e=>setAuditFrom(e.target.value)}/>
                      <span style={{fontSize:11.5,color:T.muted,fontWeight:700}}>Sampai</span>
                      <input type="date" className="ifield" style={{width:160}} value={auditTo} onChange={e=>setAuditTo(e.target.value)}/>
                      <select className="ifield" style={{width:120}} value={auditPageSize} onChange={e=>setAuditPageSize(Number(e.target.value)||8)}>
                        {[8,12,20].map(n=><option key={n} value={n}>{n}/hal</option>)}
                      </select>
                      <BtnG style={{fontSize:11.5,padding:"7px 12px"}} onClick={()=>{setAuditActor("");setAuditAction("");setAuditFrom("");setAuditTo("");}}>✕ Reset</BtnG>
                    </div>
                    {auditRows.length===0
                      ?<div style={{textAlign:"center",padding:"60px 0",color:T.muted}}><div style={{fontSize:36,marginBottom:12}}>🛡</div>Belum ada audit log</div>
                      :auditRows.map(a=>(
                        <div key={a.id} className="trx-card">
                          <div className="trx-head">
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:7}}>
                                <span style={{fontSize:13.5,fontWeight:700,color:T.text}}>{a.action}</span>
                                <Badge bg={T.navActive} color={T.navActiveText} border={T.navActiveBorder}>Actor: {a.actor?.username||"-"}</Badge>
                                <Badge bg={T.surface} color={T.muted} border={T.border}>Role: {a.actor?.role||"-"}</Badge>
                              </div>
                              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                                <Badge bg={T.surface} color={T.muted} border={T.border}>Target: {a.target||"-"}</Badge>
                                <Badge bg={T.surface} color={T.muted} border={T.border}>📅 {new Date(a.createdAt).toLocaleString("id-ID")}</Badge>
                              </div>
                            </div>
                            <Badge bg={T.amberBg} color={T.amberText} border={T.amberBorder}>#{a.id}</Badge>
                          </div>
                        </div>
                      ))}
                    {auditRows.length>0&&(
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10,gap:8,flexWrap:"wrap"}}>
                        <span style={{fontSize:11.5,color:T.muted}}>Menampilkan {(auditPage-1)*auditPageSize+1}-{Math.min(auditPage*auditPageSize,auditTotal)} dari {auditTotal}</span>
                        <div style={{display:"flex",gap:8}}>
                          <BtnG onClick={()=>setAuditPage(p=>Math.max(1,p-1))} disabled={auditPage<=1} style={{padding:"7px 12px",opacity:auditPage<=1?0.55:1}}>← Prev</BtnG>
                          <Badge bg={T.surface} color={T.text} border={T.border}>Page {auditPage}/{auditTotalPages}</Badge>
                          <BtnG onClick={()=>setAuditPage(p=>Math.min(auditTotalPages,p+1))} disabled={auditPage>=auditTotalPages} style={{padding:"7px 12px",opacity:auditPage>=auditTotalPages?0.55:1}}>Next →</BtnG>
                        </div>
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
              </div>
            </div>
            <div style={{display:"flex",gap:10}}>
              <BtnP onClick={submitAdd} style={{flex:1,padding:"13px",fontSize:14,borderRadius:12}}>💾 Simpan Penerimaan</BtnP>
              <BtnG onClick={()=>setShowAdd(false)}>Batal</BtnG>
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
