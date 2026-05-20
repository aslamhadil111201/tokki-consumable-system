import { useEffect } from "react";
import { useStore } from "../../store/useStore";
import { getT, updateT } from "../../theme/tokens";

export const GlobalStyle = () => {
  const { dark } = useStore();
  const T = getT(dark);
  updateT(dark);
  
  useEffect(() => {
    document.body.setAttribute("data-theme", dark ? "dark" : "light");
  }, [dark]);

  const CSS = `
    :root {
      --t-bg: ${T.bg};
      --t-surface: ${T.surface};
      --t-surface-solid: ${T.surfaceSolid};
      --t-card: ${T.card};
      --t-border: ${T.border};
      --t-text: ${T.text};
      --t-muted: ${T.muted};
      --t-primary: ${T.primary};
      --t-primary-light: ${T.primaryLight};
      --t-nav-active: ${T.navActive};
      --t-nav-active-border: ${T.navActiveBorder};
      --t-nav-active-text: ${T.navActiveText};
      --t-shadow-sm: ${T.shadowSm};
      --t-green: ${T.green};
      --t-green-bg: ${T.greenBg};
      --t-amber: ${T.amber};
      --t-amber-bg: ${T.amberBg};
      --t-red: ${T.red};
      --t-red-bg: ${T.redBg};
    }

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
  
  return <style>{CSS}</style>;
};
