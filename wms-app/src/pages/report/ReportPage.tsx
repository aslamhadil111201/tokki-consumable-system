// @ts-nocheck
import { useState } from "react";
import "./ReportPage.css";
import { BtnG } from "../../components/ui/BtnG";
import { TablePageSkeleton } from "../../components/ui/Skeleton";
import { fmtMoney, fmtDate, isoDate, todayStr, todayFmt, nowTime } from "../../utils/formatters";
import { clamp01, isApprovedOutTrx, toSafeRows, csvEscape, triggerDownload } from "../../utils/helpers";
import { EXCEL_ICON, PDF_ICON, ITEM_CATEGORIES } from "../../constants/index";
import { useStore } from "../../store/useStore";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

function EmptyState({ message }: { message: string }) {
  return (
    <div className="report-empty-state">
      <div className="report-empty-icon"></div>
      <div className="report-empty-msg">{message}</div>
    </div>
  );
}

export function ReportPage() {
  const { dark, trx, receives, items, setToast, dataReady } = useStore();

  const [reportPeriod, setReportPeriod] = useState("month");
  const [reportProjectMode, setReportProjectMode] = useState<"unit" | "rp">("unit");
  const [trendFilter, setTrendFilter] = useState<"all" | "up" | "down" | "spike" | "cur" | "prev">("all");
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string>("all");
  const [showAllTrends, setShowAllTrends] = useState(false);

  const approvedOutTrx = trx.filter(isApprovedOutTrx);
  const lowStock = items.filter(i => Number(i.stock) <= Number(i.minStock));
  const itemMap = Object.fromEntries(items.map(i => [Number(i.id), i]));

  const reportRange = (() => {
    const now = new Date();
    const end = isoDate(now);
    if (reportPeriod === "week") {
      const s = new Date(now); s.setDate(now.getDate() - 6);
      return { start: isoDate(s), end, label: "7 Hari Terakhir" };
    }
    if (reportPeriod === "year") {
      const s = new Date(now.getFullYear(), 0, 1);
      return { start: isoDate(s), end, label: `Tahun ${now.getFullYear()}` };
    }
    const s = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: isoDate(s), end, label: "Bulan Berjalan" };
  })();

  const inReportRange = (d: string) => Boolean(d) && d >= reportRange.start && d <= reportRange.end;
  
  const reportOut = approvedOutTrx.filter(t => {
    if (!inReportRange(t.date)) return false;
    if (selectedItemId === "all") return true;
    return toSafeRows(t.items).some((i: any) => Number(i.itemId) === Number(selectedItemId));
  });

  const reportIn = receives.filter(r => {
    if (!inReportRange(r.date)) return false;
    if (selectedItemId === "all") return true;
    return Number(r.itemId) === Number(selectedItemId);
  });

  const reportTotalOutUnits = reportOut.reduce((a, t) => a + toSafeRows(t.items).reduce((b: number, i: any) => {
    if (selectedItemId !== "all" && Number(i.itemId) !== Number(selectedItemId)) return b;
    return b + Number(i.qty || 0);
  }, 0), 0);

  const reportTotalInUnits = reportIn.reduce((a, r) => a + Number(r.qty || 0), 0);

  const reportOutValue = reportOut.reduce((a, t) => a + toSafeRows(t.items).reduce((b: number, i: any) => {
    if (selectedItemId !== "all" && Number(i.itemId) !== Number(selectedItemId)) return b;
    const ref = itemMap[Number(i.itemId || 0)];
    const estPrice = Number(ref?.averageCost || ref?.lastPrice || 0);
    return b + Number(i.qty || 0) * estPrice;
  }, 0), 0);

  const reportInValue = reportIn.reduce((a, r) => a + Number(r.totalCostIn ?? (Number(r.qty || 0) * Number(r.buyPrice || 0))), 0);
  const reportEstimatedValue = reportOutValue + reportInValue;

  const reportRangeDays = (() => {
    const start = new Date(reportRange.start); const end = new Date(reportRange.end);
    return Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1);
  })();

  const reportPrevRange = (() => {
    const now = new Date();
    if (reportPeriod === "year") {
      const prevYear = now.getFullYear() - 1;
      const start = new Date(prevYear, 0, 1);
      const end = new Date(prevYear, 11, 31);
      return { start: isoDate(start), end: isoDate(end) };
    }
    if (reportPeriod === "month") {
      const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: isoDate(prevStart), end: isoDate(prevEnd) };
    }
    // week
    const start = new Date(reportRange.start);
    const prevEnd = new Date(start); prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd); prevStart.setDate(prevStart.getDate() - 6);
    return { start: isoDate(prevStart), end: isoDate(prevEnd) };
  })();

  const inPrevReportRange = (d: string) => Boolean(d) && d >= reportPrevRange.start && d <= reportPrevRange.end;

  const reportOutPrev = approvedOutTrx.filter(t => {
    if (!inPrevReportRange(t.date)) return false;
    if (selectedItemId === "all") return true;
    return toSafeRows(t.items).some((i: any) => Number(i.itemId) === Number(selectedItemId));
  });

  const reportInPrev = receives.filter(r => {
    if (!inPrevReportRange(r.date)) return false;
    if (selectedItemId === "all") return true;
    return Number(r.itemId) === Number(selectedItemId);
  });

  const reportTotalOutUnitsPrev = reportOutPrev.reduce((a, t) => a + toSafeRows(t.items).reduce((b: number, i: any) => {
    if (selectedItemId !== "all" && Number(i.itemId) !== Number(selectedItemId)) return b;
    return b + Number(i.qty || 0);
  }, 0), 0);

  const reportTotalInUnitsPrev = reportInPrev.reduce((a, r) => a + Number(r.qty || 0), 0);

  const reportOutValuePrev = reportOutPrev.reduce((a, t) => a + toSafeRows(t.items).reduce((b: number, i: any) => {
    if (selectedItemId !== "all" && Number(i.itemId) !== Number(selectedItemId)) return b;
    const ref = itemMap[Number(i.itemId || 0)];
    const estPrice = Number(ref?.averageCost || ref?.lastPrice || 0);
    return b + Number(i.qty || 0) * estPrice;
  }, 0), 0);

  const reportInValuePrev = reportInPrev.reduce((a, r) => a + Number(r.totalCostIn ?? (Number(r.qty || 0) * Number(r.buyPrice || 0))), 0);
  const reportEstimatedValuePrev = reportOutValuePrev + reportInValuePrev;

  const calcTrendPercent = (cur: number, prev: number) => {
    if (prev === 0 && cur === 0) return null;
    if (prev === 0 && cur > 0) return { label: "Baru", color: "var(--t-green)" };
    const diff = cur - prev;
    const pct = Math.round((diff / prev) * 100);
    const color = pct >= 0 ? "var(--t-green)" : "var(--t-red)";
    const icon = pct >= 0 ? "▲" : "▼";
    return { label: `${icon} ${pct >= 0 ? "+" : ""}${pct}% vs lalu`, color };
  };

  const reportTxnSeries = (() => {
    const now = new Date();
    const outMap: any = {}; const inMap: any = {};
    reportOut.forEach(t => { outMap[t.date] = (outMap[t.date] || 0) + 1; });
    reportIn.forEach(r => { inMap[r.date] = (inMap[r.date] || 0) + 1; });

    if (reportPeriod === "year") {
      return Array.from({ length: 12 }).map((_, idx) => {
        const key = `${now.getFullYear()}-${String(idx + 1).padStart(2, "0")}`;
        const out = Object.keys(outMap).reduce((acc, d) => acc + (String(d).startsWith(key) ? Number(outMap[d] || 0) : 0), 0);
        const inn = Object.keys(inMap).reduce((acc, d) => acc + (String(d).startsWith(key) ? Number(inMap[d] || 0) : 0), 0);
        return { key, label: new Date(now.getFullYear(), idx, 1).toLocaleDateString("id-ID", { month: "short" }), out, in: inn };
      });
    }

    const days = reportPeriod === "week" ? 7 : (new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate());
    const first = reportPeriod === "week" ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6) : new Date(now.getFullYear(), now.getMonth(), 1);
    return Array.from({ length: days }).map((_, idx) => {
      const d = new Date(first.getFullYear(), first.getMonth(), first.getDate() + idx);
      const key = isoDate(d);
      return { key, label: d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }), out: Number(outMap[key] || 0), in: Number(inMap[key] || 0) };
    }).filter(row => row.key <= todayStr());
  })();

  const reportTxnMax = Math.max(1, ...reportTxnSeries.map(s => Math.max(s.out, s.in)));
  const reportTxnTitle = reportPeriod === "week" ? "Tren Transaksi Harian (7 Hari Terakhir)" : reportPeriod === "month" ? "Tren Transaksi Harian (Bulan Berjalan)" : `Tren Transaksi Bulanan (Tahun ${new Date().getFullYear()})`;

  const getX = (index: number) => {
    if (reportTxnSeries.length <= 1) return 45 + 265;
    return 45 + (index / (reportTxnSeries.length - 1)) * 530;
  };
  const getY = (val: number) => {
    const maxVal = reportTxnMax || 1;
    return 300 - (val / maxVal) * 230; // 300 is base y axis, 230 is height scale (headroom = 70px)
  };

  const pathOut = reportTxnSeries.length > 0
    ? reportTxnSeries.map((p, i) => `${i === 0 ? "M" : "L"} ${getX(i)} ${getY(p.out)}`).join(" ")
    : "";
  const areaOut = pathOut
    ? `${pathOut} L ${getX(reportTxnSeries.length - 1)} 300 L ${getX(0)} 300 Z`
    : "";

  const pathIn = reportTxnSeries.length > 0
    ? reportTxnSeries.map((p, i) => `${i === 0 ? "M" : "L"} ${getX(i)} ${getY(p.in)}`).join(" ")
    : "";
  const areaIn = pathIn
    ? `${pathIn} L ${getX(reportTxnSeries.length - 1)} 300 L ${getX(0)} 300 Z`
    : "";

  // Find peak indexes dynamically
  const peakOutPoint = reportTxnSeries.length > 0
    ? reportTxnSeries.reduce((max, p) => p.out > max.out ? p : max, reportTxnSeries[0])
    : null;
  const peakInPoint = reportTxnSeries.length > 0
    ? reportTxnSeries.reduce((max, p) => p.in > max.in ? p : max, reportTxnSeries[0])
    : null;
  const peakOutIdx = peakOutPoint ? reportTxnSeries.indexOf(peakOutPoint) : -1;
  const peakInIdx = peakInPoint ? reportTxnSeries.indexOf(peakInPoint) : -1;

  const reportTrendTitle = "Tren Penggunaan per Item";
  const reportTrendCurrentLabel = reportPeriod === "week" ? "7 Hari Terakhir" : reportPeriod === "month" ? "Bulan Berjalan" : "Tahun Berjalan";
  const reportTrendPrevLabel = reportPeriod === "week" ? "7 Hari Sebelumnya" : reportPeriod === "month" ? "Bulan Sebelumnya" : "Tahun Sebelumnya";
  const reportTrendSubtitle = `${reportTrendCurrentLabel} vs ${reportTrendPrevLabel}`;



  const reportMonthlyTrend = (() => {
    const curMap: any = {}; const prevMap: any = {};
    reportOut.forEach(t => { toSafeRows(t.items).forEach(it => { const key = it.itemName || `Item ${it.itemId || ""}`; curMap[key] = (curMap[key] || 0) + Number(it.qty || 0); }); });
    reportOutPrev.forEach(t => { toSafeRows(t.items).forEach(it => { const key = it.itemName || `Item ${it.itemId || ""}`; prevMap[key] = (prevMap[key] || 0) + Number(it.qty || 0); }); });
    const allKeys = new Set([...Object.keys(curMap), ...Object.keys(prevMap)]);
    const rows = [...allKeys].map(name => {
      const cur = curMap[name] || 0; const prev = prevMap[name] || 0;
      const pctChange = prev === 0 ? (cur > 0 ? 999 : 0) : Math.round((cur - prev) / prev * 100);
      return { name, cur, prev, pctChange };
    }).filter(r => r.cur > 0 || r.prev > 0).sort((a, b) => b.cur - a.cur).slice(0, 8);
    const maxBar = Math.max(1, ...rows.map(r => Math.max(r.cur, r.prev)));
    return rows.map(r => ({ ...r, curPct: Math.round(r.cur / maxBar * 100), prevPct: Math.round(r.prev / maxBar * 100), isSpike: r.pctChange >= 50 && r.cur > 0 }));
  })();

  const trendSpikeCount = reportMonthlyTrend.filter(r => r.isSpike).length;

  const reportTopItems = (() => {
    const map: any = {};
    reportOut.forEach(t => toSafeRows(t.items).forEach(it => { const key = it.itemName || `Item ${it.itemId || ""}`; map[key] = (map[key] || 0) + Number(it.qty || 0); }));
    const rows = Object.entries(map).map(([name, total]) => ({ name, total: Number(total || 0) })).sort((a, b) => b.total - a.total).slice(0, 5);
    const max = Math.max(1, ...rows.map(r => r.total));
    return rows.map(r => ({ ...r, pct: Math.round((r.total / max) * 100) }));
  })();

  const reportDeptStack = (() => {
    const byDept: any = {};
    reportOut.forEach(t => {
      const dept = t.dept || "Tanpa Dept";
      if (!byDept[dept]) byDept[dept] = {};
      toSafeRows(t.items).forEach(it => {
        const ref = itemMap[Number(it.itemId || 0)];
        const cat = ref?.category || "Lainnya";
        byDept[dept][cat] = (byDept[dept][cat] || 0) + Number(it.qty || 0);
      });
    });
    return Object.entries(byDept).map(([dept, cats]: any) => {
      const total = Object.values(cats).reduce((a: number, v: any) => a + Number(v || 0), 0);
      return { dept, total, cats };
    }).sort((a, b) => b.total - a.total).slice(0, 8);
  })();

  const reportDeptCats = (() => {
    const found = new Set<string>();
    reportDeptStack.forEach(row => Object.keys(row.cats || {}).forEach(c => found.add(c)));
    const ordered = [...ITEM_CATEGORIES, "Lainnya"].filter(c => found.has(c));
    const extra = [...found].filter(c => !ordered.includes(c));
    return [...ordered, ...extra];
  })();

  const reportCatPalette: any = { APD: "#10b981", Abrasif: "#f59e0b", "Cutting Tool": "#3b82f6", "Industrial Gas": "#8b5cf6", Kebersihan: "#ec4899", Lainnya: "#64748b" };

  const reportProjectUsage = (() => {
    const map: any = {};
    reportOut.forEach(t => {
      const key = t.workOrder ? String(t.workOrder).trim() : null; if (!key) return;
      toSafeRows(t.items).forEach(it => { map[key] = (map[key] || 0) + Number(it.qty || 0); });
    });
    const rows = Object.entries(map).map(([name, total]) => ({ name, total: Number(total) })).sort((a, b) => b.total - a.total).slice(0, 8);
    const max = Math.max(1, ...rows.map(r => r.total));
    return rows.map(r => ({ ...r, pct: Math.round((r.total / max) * 100) }));
  })();

  const reportProjectByRp = (() => {
    const map: any = {};
    reportOut.forEach(t => {
      const key = t.workOrder ? String(t.workOrder).trim() : null; if (!key) return;
      toSafeRows(t.items).forEach(it => {
        const ref = itemMap[Number(it.itemId || 0)];
        const price = Number(ref?.averageCost || ref?.lastPrice || 0);
        map[key] = (map[key] || 0) + Number(it.qty || 0) * price;
      });
    });
    const rows = Object.entries(map).map(([name, total]) => ({ name, total: Number(total) })).sort((a, b) => b.total - a.total).slice(0, 8);
    const max = Math.max(1, ...rows.map(r => r.total));
    return rows.map(r => ({ ...r, pct: Math.round((r.total / max) * 100) }));
  })();

  const exportReportExcel = () => {
    const rows = [
      ["Warehouse Management System"],
      ["Laporan & Analitik"],
      ["Periode", reportRange.label],
      ["Rentang", `${fmtDate(reportRange.start)} - ${fmtDate(reportRange.end)}`],
      ["Dibuat", `${todayFmt()} ${nowTime()}`],
      [],
      ["KPI", "Nilai"],
      ["Total Keluar (Unit)", reportTotalOutUnits],
      ["Total Masuk (Unit)", reportTotalInUnits],
      ["Nilai Estimasi (Rp)", Math.round(reportEstimatedValue)],
      ["Item Kritis", lowStock.length],
      [],
      ["Transaksi Per Hari/Bulan"],
      ["Label", "Keluar", "Masuk"],
      ...reportTxnSeries.map(s => [s.label, s.out, s.in]),
      [],
      ["Top 5 Item Paling Sering Diambil"],
      ["Item", "Unit Keluar"],
      ...reportTopItems.map(r => [r.name, r.total]),
      [],
      ["Project Paling Sering Dipakai (Frekuensi)"],
      ["Project", "Unit Keluar"],
      ...reportProjectUsage.map(r => [r.name, r.total]),
      [],
      ["Project Paling Sering Dipakai (Nilai Rp)"],
      ["Project", "Nilai (Rp)"],
      ...reportProjectByRp.map(r => [r.name, Math.round(r.total)]),
      [],
      ["Breakdown Pengambilan per Departemen"],
      ["Departemen", "Total Unit", ...reportDeptCats],
      ...reportDeptStack.map(row => [row.dept, row.total, ...reportDeptCats.map(cat => Number(row.cats?.[cat] || 0))]),
    ];
    const csv = "\uFEFF" + rows.map(r => r.map(v => typeof v === "string" ? csvEscape(v) : v).join(",")).join("\n");
    triggerDownload(`laporan-analitik-${todayStr()}.csv`, csv, "text/csv;charset=utf-8;");
    setToast("Export Excel (CSV) laporan berhasil");
  };

  const exportReportPdf = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.text(`Laporan & Analitik - ${todayFmt()}`, 40, 32);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text(`Periode: ${reportRange.label} (${fmtDate(reportRange.start)} - ${fmtDate(reportRange.end)})`, 40, 50);

    autoTable(doc, {
      startY: 62, head: [["KPI", "Nilai"]],
      body: [
        ["Total Keluar (Unit)", String(reportTotalOutUnits)],
        ["Total Masuk (Unit)", String(reportTotalInUnits)],
        ["Nilai Estimasi (Rp)", fmtMoney(Math.round(reportEstimatedValue))],
        ["Item Kritis", String(lowStock.length)],
      ],
      styles: { font: "helvetica", fontSize: 9, cellPadding: 4 }, headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: "bold" }, margin: { left: 40, right: 40 }, theme: "grid",
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 16, head: [["Label", "Keluar", "Masuk"]],
      body: reportTxnSeries.map(s => [s.label, String(s.out), String(s.in)]),
      styles: { font: "helvetica", fontSize: 9, cellPadding: 4 }, headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: "bold" }, margin: { left: 40, right: 40 }, theme: "grid",
    });

    doc.save(`laporan-analitik-${todayStr()}.pdf`);
    setToast("Export PDF laporan berhasil");
  };

  return (
    <div>
      {!dataReady && <TablePageSkeleton rows={4} statCount={4} showTabs={false} />}
      {dataReady && (<>
      <div className="report-header">
        <div className="report-filters">
          <span className="report-filter-label">Periode</span>
          <div className="report-period-pill">
            <div className="pill-indicator" style={{ transform: reportPeriod === "week" ? "translateX(0%)" : reportPeriod === "month" ? "translateX(100%)" : "translateX(200%)" }} />
            {[
              { id: "week", label: "Minggu" },
              { id: "month", label: "Bulan" },
              { id: "year", label: "Tahun" },
            ].map(p => (
              <button key={p.id} className={`period-btn${reportPeriod === p.id ? " active" : ""}`} onClick={() => setReportPeriod(p.id)}>
                {p.label}
              </button>
            ))}
          </div>
          <span className="report-filter-date">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4, verticalAlign: "middle", display: "inline-block" }}>
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            {fmtDate(reportRange.start)} - {fmtDate(reportRange.end)}
          </span>
        </div>
        <div className="report-actions">
          <BtnG onClick={exportReportExcel} style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>{EXCEL_ICON}Export Excel</BtnG>
          <BtnG onClick={exportReportPdf} style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>{PDF_ICON}Export PDF</BtnG>
        </div>
      </div>

      <div className="stats-g" style={{ marginBottom: 16 }}>
        {[
          {
            label: "TOTAL KELUAR",
            value: `${reportTotalOutUnits.toLocaleString("id-ID")} unit`,
            sub: "Unit pengambilan",
            color: "var(--t-red)",
            bg: "rgba(239, 68, 68, 0.1)",
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--t-red)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" />
              </svg>
            ),
            trend: calcTrendPercent(reportTotalOutUnits, reportTotalOutUnitsPrev),
            glowClass: "glow-red"
          },
          {
            label: "TOTAL MASUK",
            value: `${reportTotalInUnits.toLocaleString("id-ID")} unit`,
            sub: "Unit penerimaan",
            color: "var(--t-green)",
            bg: "rgba(16, 185, 129, 0.1)",
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--t-green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" />
              </svg>
            ),
            trend: calcTrendPercent(reportTotalInUnits, reportTotalInUnitsPrev),
            glowClass: "glow-green"
          },
          {
            label: "NILAI ESTIMASI",
            value: fmtMoney(Math.round(reportEstimatedValue)),
            sub: "Keluar + masuk",
            color: "#8b5cf6",
            bg: "rgba(139, 92, 246, 0.1)",
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            ),
            trend: calcTrendPercent(reportEstimatedValue, reportEstimatedValuePrev),
            glowClass: "glow-primary"
          },
          {
            label: "ITEM KRITIS",
            value: `${lowStock.length} item`,
            sub: "Stok <= minimum",
            color: "var(--t-amber)",
            bg: "rgba(245, 158, 11, 0.1)",
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--t-amber)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            ),
            trend: { label: lowStock.length > 0 ? "Perlu perhatian" : "Aman", color: lowStock.length > 0 ? "var(--t-amber)" : "var(--t-green)" },
            glowClass: "glow-amber"
          },
        ].map((kpi, idx) => (
          <div key={idx} className={`stat-card report-kpi-card ${kpi.glowClass}`} style={{ padding: "16px 18px", background: "var(--t-card)", border: "1px solid var(--t-border)", borderRadius: "16px" }}>
            <div className="report-kpi-inner" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div className="report-kpi-label" style={{ fontSize: "10.5px", fontWeight: 700, color: "var(--t-muted)", textTransform: "uppercase", letterSpacing: ".09em", marginBottom: 7 }}>{kpi.label}</div>
                <div className="report-kpi-val" style={{ fontSize: "22px", fontWeight: 700, color: "var(--t-text)", lineHeight: 1.2 }}>{kpi.value}</div>
                <div className="report-kpi-sub" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: "11.5px", color: "var(--t-muted)", marginTop: 6 }}>
                  <span>{kpi.sub}</span>
                  {kpi.trend && (
                    <>
                      <span className="kpi-trend-badge" style={{ color: kpi.trend.color, fontSize: "10px", fontWeight: 700, background: `${kpi.trend.color}15`, padding: "2px 6px", borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 3 }}>
                        {kpi.trend.label}
                      </span>
                      {kpi.label !== "ITEM KRITIS" && <span style={{ opacity: 0.6 }}>vs periode lalu</span>}
                    </>
                  )}
                </div>
              </div>
              <div className="report-kpi-icon" style={{ background: kpi.bg, border: "none", width: "40px", height: "40px", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {kpi.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="two-col" style={{ marginBottom: 16 }}>
        <div className="card report-chart-card">
          <div className="report-chart-hdr" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", gap: 10, flexWrap: "wrap" }}>
            <div className="dash-panel-title" style={{ whiteSpace: "nowrap", flexShrink: 0 }}>{reportTxnTitle}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
              <div className="report-chart-legend" style={{ display: "flex", gap: 10, fontSize: "11px", color: "var(--t-muted)", whiteSpace: "nowrap" }}>
                <span className="report-legend-item" style={{ display: "flex", alignItems: "center", gap: 4 }}><span className="report-legend-dot" style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--t-red)", display: "inline-block" }} />Keluar (Unit)</span>
                <span className="report-legend-item" style={{ display: "flex", alignItems: "center", gap: 4 }}><span className="report-legend-dot" style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--t-green)", display: "inline-block" }} />Masuk (Unit)</span>
              </div>
              <select
                className="report-chart-select"
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                style={{
                  padding: "5px 24px 5px 10px",
                  borderRadius: "8px",
                  border: "1px solid var(--t-border)",
                  background: "var(--t-surface)",
                  color: "var(--t-text)",
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontSize: "11.5px",
                  fontWeight: 700,
                  outline: "none",
                  cursor: "pointer",
                  width: "140px",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  overflow: "hidden"
                }}
              >
                <option value="all">Semua Item</option>
                {items.map(it => (
                  <option key={it.id} value={it.id}>{it.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="report-chart-body" style={{ minHeight: "340px", position: "relative" }}>
            {reportTxnSeries.length === 0 || reportTxnSeries.every(s => s.out === 0 && s.in === 0)
              ? <EmptyState message="Belum ada transaksi pada periode ini" />
              : (
                <>
                  <div className="chart-container-relative" style={{ height: "340px", position: "relative" }}>
                  <svg viewBox="0 0 600 340" width="100%" height="100%" style={{ overflow: "visible" }}>
                    <defs>
                      <linearGradient id="grad-out" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--t-red)" stopOpacity="0.22" />
                        <stop offset="100%" stopColor="var(--t-red)" stopOpacity="0.00" />
                      </linearGradient>
                      <linearGradient id="grad-in" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--t-green)" stopOpacity="0.22" />
                        <stop offset="100%" stopColor="var(--t-green)" stopOpacity="0.00" />
                      </linearGradient>
                    </defs>

                    {/* Y-Axis scale labels */}
                    {[
                      { y: 300, val: 0 },
                      { y: 242.5, val: Math.round(reportTxnMax * 0.25) },
                      { y: 185, val: Math.round(reportTxnMax * 0.5) },
                      { y: 127.5, val: Math.round(reportTxnMax * 0.75) },
                      { y: 70, val: reportTxnMax }
                    ].map((tick, idx) => (
                      <text
                        key={idx}
                        x="30"
                        y={tick.y + 3}
                        textAnchor="end"
                        fill="var(--t-muted)"
                        fontSize="9px"
                        fontWeight="700"
                      >
                        {tick.val}
                      </text>
                    ))}
                    <text
                      x="30"
                      y="55"
                      textAnchor="end"
                      fill="var(--t-muted)"
                      fontSize="9px"
                      fontWeight="700"
                    >
                      Unit
                    </text>

                    {/* Grid Lines */}
                    {[70, 127.5, 185, 242.5, 300].map((y, idx) => (
                      <line
                        key={idx}
                        x1="45"
                        y1={y}
                        x2="575"
                        y2={y}
                        stroke="var(--t-border)"
                        strokeOpacity="0.25"
                        strokeWidth="1"
                      />
                    ))}

                    {/* Fill Areas under lines */}
                    <path d={areaOut} fill="url(#grad-out)" style={{ transition: "d 0.3s ease" }} />
                    <path d={areaIn} fill="url(#grad-in)" style={{ transition: "d 0.3s ease" }} />

                    {/* Paths */}
                    <path d={pathOut} fill="none" stroke="var(--t-red)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "d 0.3s ease" }} />
                    <path d={pathIn} fill="none" stroke="var(--t-green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "d 0.3s ease" }} />

                    {/* Circles & Exact Values above them */}
                    {reportTxnSeries.map((point, idx) => (
                      <g key={`out-pt-${idx}`}>
                        <circle
                          cx={getX(idx)}
                          cy={getY(point.out)}
                          r="4"
                          fill="var(--t-red)"
                          stroke={dark ? "#1a1b1e" : "#ffffff"}
                          strokeWidth="1.5"
                        />
                        {point.out > 0 && (
                          <text
                            x={getX(idx)}
                            y={getY(point.out) - 8}
                            textAnchor="middle"
                            fill="var(--t-red)"
                            fontSize="9px"
                            fontWeight="700"
                          >
                            {point.out}
                          </text>
                        )}
                      </g>
                    ))}

                    {reportTxnSeries.map((point, idx) => (
                      <g key={`in-pt-${idx}`}>
                        <circle
                          cx={getX(idx)}
                          cy={getY(point.in)}
                          r="4"
                          fill="var(--t-green)"
                          stroke={dark ? "#1a1b1e" : "#ffffff"}
                          strokeWidth="1.5"
                        />
                        {point.in > 0 && (
                          <text
                            x={getX(idx)}
                            y={getY(point.in) - 8}
                            textAnchor="middle"
                            fill="var(--t-green)"
                            fontSize="9px"
                            fontWeight="700"
                          >
                            {point.in}
                          </text>
                        )}
                      </g>
                    ))}

                    {/* Peak Badges */}
                    {peakOutPoint && peakOutPoint.out > 0 && peakOutIdx !== -1 && (
                      <g transform={`translate(${getX(peakOutIdx)}, ${getY(peakOutPoint.out) - 34})`}>
                        <rect
                          x="-35"
                          y="-20"
                          width="70"
                          height="24"
                          rx="6"
                          fill="var(--t-red)"
                        />
                        <text
                          x="0"
                          y="-11"
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize="7.5px"
                          fontWeight="700"
                        >
                          Peak Keluar
                        </text>
                        <text
                          x="0"
                          y="-2"
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize="8px"
                          fontWeight="900"
                        >
                          {peakOutPoint.out} Unit
                        </text>
                        <path
                          d="M -4 4 L 0 8 L 4 4 Z"
                          fill="var(--t-red)"
                        />
                      </g>
                    )}

                    {peakInPoint && peakInPoint.in > 0 && peakInIdx !== -1 && (
                      <g transform={`translate(${getX(peakInIdx)}, ${getY(peakInPoint.in) - 34})`}>
                        <rect
                          x="-35"
                          y="-20"
                          width="70"
                          height="24"
                          rx="6"
                          fill="var(--t-green)"
                        />
                        <text
                          x="0"
                          y="-11"
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize="7.5px"
                          fontWeight="700"
                        >
                          Peak Masuk
                        </text>
                        <text
                          x="0"
                          y="-2"
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize="8px"
                          fontWeight="900"
                        >
                          {peakInPoint.in} Unit
                        </text>
                        <path
                          d="M -4 4 L 0 8 L 4 4 Z"
                          fill="var(--t-green)"
                        />
                      </g>
                    )}

                    {/* X-Axis Labels */}
                    {reportTxnSeries.map((point, idx) => {
                      const showLabel = reportPeriod === "week"
                        || (reportPeriod === "month" && idx % 4 === 0)
                        || (reportPeriod === "year" && idx % 1 === 0);
                      if (!showLabel) return null;
                      return (
                        <text
                          key={point.key}
                          x={getX(idx)}
                          y={322}
                          textAnchor="middle"
                          fill="var(--t-muted)"
                          fontSize="9px"
                          fontWeight="700"
                        >
                          {point.label}
                        </text>
                      );
                    })}

                    {/* Interactive Hover Guides & Markers */}
                    {hoveredIdx !== null && hoveredIdx < reportTxnSeries.length && (
                      <>
                        <line
                          x1={getX(hoveredIdx)}
                          y1={30}
                          x2={getX(hoveredIdx)}
                          y2={300}
                          stroke="var(--t-border)"
                          strokeWidth="1.5"
                          strokeDasharray="4 4"
                        />
                        {/* Out Indicator */}
                        <circle
                          cx={getX(hoveredIdx)}
                          cy={getY(reportTxnSeries[hoveredIdx].out)}
                          r="5"
                          fill="var(--t-red)"
                          stroke={dark ? "#1a1b1e" : "#ffffff"}
                          strokeWidth="2"
                        />
                        <circle
                          cx={getX(hoveredIdx)}
                          cy={getY(reportTxnSeries[hoveredIdx].out)}
                          r="10"
                          fill="none"
                          stroke="var(--t-red)"
                          strokeWidth="1.5"
                          opacity="0.3"
                        />
                        {/* In Indicator */}
                        <circle
                          cx={getX(hoveredIdx)}
                          cy={getY(reportTxnSeries[hoveredIdx].in)}
                          r="5"
                          fill="var(--t-green)"
                          stroke={dark ? "#1a1b1e" : "#ffffff"}
                          strokeWidth="2"
                        />
                        <circle
                          cx={getX(hoveredIdx)}
                          cy={getY(reportTxnSeries[hoveredIdx].in)}
                          r="10"
                          fill="none"
                          stroke="var(--t-green)"
                          strokeWidth="1.5"
                          opacity="0.3"
                        />
                      </>
                    )}

                    {/* Invisible Hover Zones */}
                    {reportTxnSeries.map((point, idx) => {
                      const stepWidth = reportTxnSeries.length > 1 ? 530 / (reportTxnSeries.length - 1) : 530;
                      return (
                        <rect
                          key={point.key}
                          x={getX(idx) - stepWidth / 2}
                          y={20}
                          width={stepWidth}
                          height={280}
                          fill="transparent"
                          onMouseEnter={() => setHoveredIdx(idx)}
                          onMouseLeave={() => setHoveredIdx(null)}
                          style={{ cursor: "pointer" }}
                        />
                      );
                    })}
                  </svg>

                  {/* HTML Tooltip overlay */}
                  {hoveredIdx !== null && hoveredIdx < reportTxnSeries.length && (
                    <div
                      className="chart-tooltip"
                      style={{
                        left: `${getX(hoveredIdx) / 600 * 100}%`,
                        transform: getX(hoveredIdx) > 300 ? "translateX(-110%)" : "translateX(10px)",
                        top: "30px"
                      }}
                    >
                      <div className="tooltip-date">{reportTxnSeries[hoveredIdx].label}</div>
                      <div className="tooltip-row"><span className="tooltip-dot out" /> Keluar: <strong>{reportTxnSeries[hoveredIdx].out} unit</strong></div>
                      <div className="tooltip-row"><span className="tooltip-dot in" /> Masuk: <strong>{reportTxnSeries[hoveredIdx].in} unit</strong></div>
                    </div>
                  )}
                  </div>
                  {/* Bottom Stats Summary Row */}
                  <div className="report-chart-summary-row" style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
                    <div className="report-chart-summary-card" style={{ flex: "1 1 160px", minWidth: 0, display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "rgba(239, 68, 68, 0.05)", border: "1px solid rgba(239, 68, 68, 0.1)", borderRadius: "12px" }}>
                      <div style={{ width: 34, height: 34, borderRadius: "8px", background: "rgba(239, 68, 68, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--t-red)", flexShrink: 0 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" />
                        </svg>
                      </div>
                      <div>
                        <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--t-red)" }}>Peak Pengeluaran</div>
                        <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--t-text)" }}>{peakOutPoint ? peakOutPoint.out : 0} Unit</div>
                        <div style={{ fontSize: "10px", color: "var(--t-muted)", marginTop: 2 }}>Terjadi di {peakOutPoint ? peakOutPoint.label : ""} {new Date().getFullYear()}</div>
                      </div>
                    </div>

                    <div className="report-chart-summary-card" style={{ flex: "1 1 160px", minWidth: 0, display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "rgba(16, 185, 129, 0.05)", border: "1px solid rgba(16, 185, 129, 0.1)", borderRadius: "12px" }}>
                      <div style={{ width: 34, height: 34, borderRadius: "8px", background: "rgba(16, 185, 129, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--t-green)", flexShrink: 0 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                          <line x1="12" y1="8" x2="12" y2="16" />
                          <line x1="8" y1="12" x2="16" y2="12" />
                        </svg>
                      </div>
                      <div>
                        <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--t-green)" }}>Peak Penerimaan</div>
                        <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--t-text)" }}>{peakInPoint ? peakInPoint.in : 0} Unit</div>
                        <div style={{ fontSize: "10px", color: "var(--t-muted)", marginTop: 2 }}>Terjadi di {peakInPoint ? peakInPoint.label : ""} {new Date().getFullYear()}</div>
                      </div>
                    </div>

                    <div className="report-chart-summary-card" style={{ flex: "1 1 160px", minWidth: 0, display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "rgba(59, 130, 246, 0.05)", border: "1px solid rgba(59, 130, 246, 0.1)", borderRadius: "12px" }}>
                      <div style={{ width: 34, height: 34, borderRadius: "8px", background: "rgba(59, 130, 246, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#3b82f6", flexShrink: 0 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                        </svg>
                      </div>
                      <div>
                        <div style={{ fontSize: "10px", fontWeight: 700, color: "#3b82f6" }}>
                          Rata-rata {reportPeriod === "year" ? "Bulanan" : "Harian"} (Keluar + Masuk)
                        </div>
                        <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--t-text)" }}>
                          {Math.round(reportTxnSeries.reduce((acc, p) => acc + p.out + p.in, 0) / (reportTxnSeries.length || 1))} Unit
                        </div>
                        <div style={{ fontSize: "10px", color: "var(--t-muted)", marginTop: 2 }}>
                          Total rata-rata transaksi per {reportPeriod === "year" ? "bulan" : "hari"}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )
            }
          </div>
        </div>

        <div className="card report-chart-card">
          <div className="report-trend-hdr" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 180px", minWidth: 0 }}>
              <div className="dash-panel-title" style={{ marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{reportTrendTitle}</div>
              <div className="report-trend-sub" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span>{reportTrendSubtitle}</span>
                {trendSpikeCount > 0 && <span className="report-trend-spike" style={{ whiteSpace: "nowrap" }}>{trendSpikeCount} lonjakan</span>}
              </div>
            </div>
            <div className="report-trend-filters" style={{ flexShrink: 0 }}>
              {([["all", "Semua"], ["up", "Naik"], ["down", "Turun"], ["spike", "Lonjakan!"]] as const).map(([id, label]) => (
                <button key={id} onClick={() => setTrendFilter(id)} className="report-trend-fbtn" style={{ background: trendFilter === id ? "var(--t-primary)" : "transparent", color: trendFilter === id ? "white" : "var(--t-muted)" }}>{label}</button>
              ))}
            </div>
          </div>
          <div className="report-trend-cmp">
            <button onClick={() => setTrendFilter(trendFilter === "prev" ? "all" : "prev")} className="report-trend-cbtn" style={{ border: `1px solid ${trendFilter === "prev" ? "#10b981" : "var(--t-border)"}`, background: trendFilter === "prev" ? (dark ? "rgba(16,185,129,0.15)" : "#d1fae5") : "transparent", color: trendFilter === "prev" ? "#059669" : "var(--t-muted)" }}><span style={{ width: 10, height: 10, borderRadius: 3, background: dark ? "rgba(255,255,255,0.22)" : "#bbf7d0", display: "inline-block", flexShrink: 0 }} />{reportTrendPrevLabel}</button>
            <button onClick={() => setTrendFilter(trendFilter === "cur" ? "all" : "cur")} className="report-trend-cbtn" style={{ border: `1px solid ${trendFilter === "cur" ? "#10b981" : "var(--t-border)"}`, background: trendFilter === "cur" ? (dark ? "rgba(16,185,129,0.25)" : "#d1fae5") : "transparent", color: trendFilter === "cur" ? "#059669" : "var(--t-muted)" }}><span style={{ width: 10, height: 10, borderRadius: 3, background: "#10b981", display: "inline-block", flexShrink: 0 }} />{reportTrendCurrentLabel}</button>
          </div>
          {reportMonthlyTrend.length === 0
            ? <EmptyState message="Belum ada data pengambilan pada periode ini" />
            : (
              <div className="report-trend-list">
                {(() => {
                  const filtered = reportMonthlyTrend.filter(r => {
                    if (trendFilter === "up") return r.pctChange > 0;
                    if (trendFilter === "down") return r.pctChange < 0;
                    if (trendFilter === "spike") return r.isSpike;
                    if (trendFilter === "cur") return r.cur > 0;
                    if (trendFilter === "prev") return r.prev > 0;
                    return true;
                  });
                  return (
                    <>
                      {filtered.slice(0, showAllTrends ? undefined : 5).map((row, idx) => {
                        const pill = row.isSpike
                          ? { bg: "#fee2e2", c: "#dc2626", sign: "⚡" }
                          : row.pctChange > 8
                            ? { bg: "#fef3c7", c: "#d97706", sign: "▲" }
                            : row.pctChange < 0
                              ? { bg: "#d1fae5", c: "#059669", sign: "▼" }
                              : { bg: dark ? "rgba(255,255,255,0.08)" : "#f1f5f9", c: "var(--t-muted)", sign: "→" };
                        const rankClass = idx < 3 ? `rank-${idx + 1}` : "rank-default";
                        return (
                          <div key={row.name} className="report-trend-item">
                            <div className="report-ti-hdr">
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                                <span className={`rank-badge ${rankClass}`}>{idx + 1}</span>
                                <div className="report-ti-name">{row.name}</div>
                              </div>
                              <div className="report-ti-stats">
                                <span className="report-ti-diff">{row.prev}→{row.cur}</span>
                                <span className="report-ti-badge" style={{ background: pill.bg, color: pill.c }}>{pill.sign} {row.pctChange === 999 ? "baru" : `${row.pctChange > 0 ? "+" : ""}${row.pctChange}%`}</span>
                              </div>
                            </div>
                            <div className="report-ti-bars">
                              <div className="report-ti-bar" style={{ background: dark ? "rgba(255,255,255,0.08)" : "#e5e7eb" }}>
                                <div style={{ height: "100%", width: `${row.prevPct}%`, background: dark ? "rgba(255,255,255,0.22)" : "#bbf7d0", borderRadius: 6 }} />
                              </div>
                              <div className="report-ti-bar" style={{ background: dark ? "rgba(255,255,255,0.08)" : "#e5e7eb" }}>
                                <div style={{ height: "100%", width: `${row.curPct}%`, background: row.isSpike ? "#ef4444" : "#10b981", borderRadius: 6, transition: "width .35s ease" }} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {filtered.length > 5 && (
                        <button
                          className="report-trend-more-btn"
                          onClick={() => setShowAllTrends(!showAllTrends)}
                          style={{
                            display: "block",
                            width: "100%",
                            padding: "10px 0",
                            marginTop: "12px",
                            background: "transparent",
                            border: "1px solid var(--t-border)",
                            borderRadius: "10px",
                            color: "var(--t-primary)",
                            fontSize: "12px",
                            fontWeight: 700,
                            cursor: "pointer",
                            textAlign: "center",
                            transition: "all 0.2s"
                          }}
                        >
                          {showAllTrends ? "Sembunyikan item ↑" : "Lihat semua item →"}
                        </button>
                      )}
                    </>
                  );
                })()}
              </div>
            )
          }
        </div>
      </div>

      <div className="report-botgrid">
        <div className="card report-chart-card">
          <div className="report-dept-hdr">
            <div className="dash-panel-title">Breakdown per Departemen ({reportRange.label})</div>
            <div className="report-dept-tags">
              {reportDeptCats.map(cat => (
                <span key={cat} className="report-dept-tag">
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: reportCatPalette[cat] || "#64748b", display: "inline-block" }} />{cat}
                </span>
              ))}
            </div>
          </div>
          {reportDeptStack.length === 0
            ? <EmptyState message="Belum ada pengambilan pada periode ini" />
            : (
              <div className="report-dept-list">
                {reportDeptStack.map((row: any) => (
                  <div key={row.dept} className="report-dept-item">
                    <div className="report-di-hdr">
                      <div className="report-di-name">{row.dept}</div>
                      <div className="report-di-val">{row.total} unit</div>
                    </div>
                    <div className="report-di-bar" style={{ background: dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)" }}>
                      {reportDeptCats.map(cat => {
                        const val = Number(row.cats?.[cat] || 0);
                        if (!val) return null;
                        const pct = clamp01(val / Math.max(1, row.total)) * 100;
                        return <div key={`${row.dept}-${cat}`} title={`${cat}: ${val} unit`} style={{ width: `${pct}%`, background: reportCatPalette[cat] || "#64748b" }} />;
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </div>

        <div className="card report-chart-card">
          <div className="report-proj-hdr">
            <div className="dash-panel-title">Project Paling Sering Dipakai ({reportRange.label})</div>
            <div className="report-proj-tabs">
              {([["unit", "Frekuensi"], ["rp", "Nilai (Rp)"]] as const).map(([id, label]) => (
                <button key={id} onClick={() => setReportProjectMode(id)} className="report-proj-tab" style={{ background: reportProjectMode === id ? "var(--t-primary)" : "transparent", color: reportProjectMode === id ? "white" : "var(--t-muted)" }}>{label}</button>
              ))}
            </div>
          </div>
          {(reportProjectMode === "unit" ? reportProjectUsage : reportProjectByRp).length === 0
            ? <EmptyState message="Belum ada data pengambilan dengan project" />
            : (
              <div className="report-proj-grid-v3" style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
                {(reportProjectMode === "unit" ? reportProjectUsage : reportProjectByRp).slice(0, 3).map((row, idx) => {
                  const rankColors = [
                    { bg: "rgba(245, 158, 11, 0.1)", border: "rgba(245, 158, 11, 0.2)", c: "#d97706" }, // Rank 1
                    { bg: "rgba(16, 185, 129, 0.1)", border: "rgba(16, 185, 129, 0.2)", c: "#059669" }, // Rank 2
                    { bg: "rgba(59, 130, 246, 0.1)", border: "rgba(59, 130, 246, 0.2)", c: "#2563eb" }, // Rank 3
                  ][idx] || { bg: "var(--t-border)", border: "transparent", c: "var(--t-muted)" };

                  return (
                    <div
                      key={row.name}
                      className="report-proj-card-v3"
                      style={{
                        flex: 1,
                        minWidth: "160px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "12px 16px",
                        background: dark ? "rgba(255,255,255,0.02)" : "#f8fafc",
                        border: "1px solid var(--t-border)",
                        borderRadius: "12px",
                        boxSizing: "border-box"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div
                          style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "8px",
                            background: rankColors.bg,
                            border: `1px solid ${rankColors.border}`,
                            color: rankColors.c,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "15px",
                            fontWeight: 700,
                            flexShrink: 0
                          }}
                        >
                          {idx + 1}
                        </div>
                        <div>
                          <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--t-text)" }}>{row.name}</div>
                          <div style={{ fontSize: "11.5px", color: "var(--t-muted)", marginTop: 2, fontWeight: 700 }}>
                            {reportProjectMode === "unit" ? `${row.total} unit` : fmtMoney(Math.round(row.total))}
                          </div>
                        </div>
                      </div>
                      {idx === 0 && (
                        <span style={{ fontSize: "18px", marginLeft: 8 }} title="Project Terbanyak"></span>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          }
        </div>
      </div>
      </>)}
    </div>
  );
}

