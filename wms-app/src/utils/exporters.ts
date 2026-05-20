// @ts-nocheck
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { todayStr, nowTime, fmtDate, todayFmt, fmtMoney, fmtDateExcel } from "./formatters";
import { csvEscape, csvText, toSafeRows, triggerDownload } from "./helpers";

export function downloadPdfTable({ fileName, title, subtitle, headers, rows }) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(String(title || "Laporan"), 40, 32);
  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(String(subtitle), 40, 50);
  }
  autoTable(doc, {
    startY: subtitle ? 62 : 46,
    head: [headers.map(h => String(h ?? ""))],
    body: rows.map(r => toSafeRows(r).map(c => String(c ?? ""))),
    styles: { font: "helvetica", fontSize: 8, cellPadding: 4, overflow: "linebreak" },
    headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: "bold" },
    margin: { left: 40, right: 40, top: 40, bottom: 30 },
    theme: "grid",
  });
  doc.save(fileName || `laporan-${todayStr()}.pdf`);
}

export function exportTransactionsExcel({ filteredOut, reportPeriodLabel, toast$ }) {
  const source = filteredOut;
  const unitTotal = source.reduce((acc, t) => acc + toSafeRows(t.items).reduce((x, it) => x + Number(it.qty || 0), 0), 0);
  const rows = [
    ["TOKKI Consumable System"], ["Laporan Riwayat Pengambilan"],
    ["Periode", reportPeriodLabel()], ["Dibuat", `${todayFmt()} ${nowTime()}`],
    ["Total Data", source.length], ["Total Unit", unitTotal], [],
    ["ID", "Tanggal", "Waktu", "Pengambil", "Section", "Project", "Admin", "Item", "Qty", "Unit", "Keterangan"],
    ...toSafeRows(source).flatMap(t => toSafeRows(t.items).map(it => [
      csvText(t.id), fmtDateExcel(t.date), t.time, t.taker, t.dept, t.workOrder || "", t.admin || "", it.itemName, it.qty, it.unit, t.note || "",
    ])),
  ];
  const csv = "\uFEFF" + rows.map(r => r.map(v => typeof v === "string" && v.startsWith("=") ? v : csvEscape(v)).join(",")).join("\n");
  triggerDownload(`riwayat-pengambilan-${todayStr()}.csv`, csv, "text/csv;charset=utf-8;");
  toast$("Export Excel (CSV) pengambilan berhasil");
}

export function exportReceivesExcel({ filteredIn, reportPeriodLabel, toast$ }) {
  const source = filteredIn;
  const unitTotal = source.reduce((a, r) => a + Number(r.qty || 0), 0);
  const rows = [
    ["TOKKI Consumable System"], ["Laporan Riwayat Penerimaan"],
    ["Periode", reportPeriodLabel()], ["Dibuat", `${todayFmt()} ${nowTime()}`],
    ["Total Data", source.length], ["Total Unit", unitTotal], [],
    ["ID", "Tanggal", "Waktu", "Item", "Qty", "Unit", "PO", "DO", "Admin"],
    ...toSafeRows(source).map(r => [
      csvText(r.id), fmtDateExcel(r.date), r.time, r.itemName, r.qty, r.unit, r.poNumber || "", r.doNumber || "", r.admin || "",
    ]),
  ];
  const csv = "\uFEFF" + rows.map(r => r.map(v => typeof v === "string" && v.startsWith("=") ? v : csvEscape(v)).join(",")).join("\n");
  triggerDownload(`riwayat-penerimaan-${todayStr()}.csv`, csv, "text/csv;charset=utf-8;");
  toast$("Export Excel (CSV) penerimaan berhasil");
}

export function exportTransactionsPdf({ filteredOut, reportPeriodLabel, toast$ }) {
  const source = filteredOut;
  const unitTotal = source.reduce((acc, t) => acc + toSafeRows(t.items).reduce((x, it) => x + Number(it.qty || 0), 0), 0);
  const rows = toSafeRows(source).flatMap(t => toSafeRows(t.items).map(it => [
    t.id, t.date, t.time, t.taker, t.dept, t.workOrder || "", t.admin || "", it.itemName, `${it.qty} ${it.unit}`, t.note || "",
  ]));
  downloadPdfTable({
    fileName: `riwayat-pengambilan-${todayStr()}.pdf`,
    title: `Riwayat Pengambilan - ${todayFmt()}`,
    subtitle: `Periode: ${reportPeriodLabel()} | Total data: ${source.length} | Total unit: ${unitTotal}`,
    headers: ["ID", "Tanggal", "Waktu", "Pengambil", "Section", "Project", "Admin", "Item", "Qty", "Ket"],
    rows,
  });
  toast$("Export PDF pengambilan berhasil");
}

export function exportReceivesPdf({ filteredIn, reportPeriodLabel, toast$ }) {
  const source = filteredIn;
  const unitTotal = source.reduce((a, r) => a + Number(r.qty || 0), 0);
  const rows = toSafeRows(source).map(r => [
    r.id, r.date, r.time, r.itemName, `${r.qty} ${r.unit}`, r.poNumber || "", r.doNumber || "", r.admin || "",
  ]);
  downloadPdfTable({
    fileName: `riwayat-penerimaan-${todayStr()}.pdf`,
    title: `Riwayat Penerimaan - ${todayFmt()}`,
    subtitle: `Periode: ${reportPeriodLabel()} | Total data: ${source.length} | Total unit: ${unitTotal}`,
    headers: ["ID", "Tanggal", "Waktu", "Item", "Qty", "PO", "DO", "Admin"],
    rows,
  });
  toast$("Export PDF penerimaan berhasil");
}

export function exportReturnsExcel({ returns, itemMap, toast$ }) {
  const source = returns;
  const unitTotal = source.reduce((a, r) => a + Number(r.qty || 0), 0);
  const rows = [
    ["TOKKI Consumable System"], ["Laporan Retur Barang"],
    ["Dibuat", `${todayFmt()} ${nowTime()}`], ["Total Data", source.length], ["Total Unit", unitTotal], [],
    ["ID", "Tanggal", "Waktu", "Karyawan", "Item", "Qty", "Unit", "Alasan", "Catatan", "Status"],
    ...toSafeRows(source).map(r => {
      const it = itemMap[Number(r.itemId)];
      return [csvText(r.id), fmtDateExcel(r.date), r.time || "", r.employee, it?.name || r.itemName || `Item #${r.itemId}`, r.qty, it?.unit || "pcs", r.reason, r.note || "", r.status || "Menunggu"];
    }),
  ];
  const csv = "\uFEFF" + rows.map(r => r.map(v => typeof v === "string" && v.startsWith("=") ? v : csvEscape(v)).join(",")).join("\n");
  triggerDownload(`retur-barang-${todayStr()}.csv`, csv, "text/csv;charset=utf-8;");
  toast$("Export Excel (CSV) retur berhasil");
}

export function exportReturnsPdf({ returns, itemMap, toast$ }) {
  const source = returns;
  const unitTotal = source.reduce((a, r) => a + Number(r.qty || 0), 0);
  const rows = toSafeRows(source).map(r => {
    const it = itemMap[Number(r.itemId)];
    return [r.id, r.date, r.time || "", r.employee, it?.name || r.itemName || `Item #${r.itemId}`, `${r.qty} ${it?.unit || "pcs"}`, r.reason, r.note || "", r.status || "Menunggu"];
  });
  downloadPdfTable({
    fileName: `retur-barang-${todayStr()}.pdf`,
    title: `Retur Barang - ${todayFmt()}`,
    subtitle: `Total data: ${source.length} | Total unit: ${unitTotal}`,
    headers: ["ID", "Tanggal", "Waktu", "Karyawan", "Item", "Qty", "Alasan", "Catatan", "Status"],
    rows,
  });
  toast$("Export PDF retur berhasil");
}

export function exportApprovalExcel({ approvalReportSource, approvalReportRows, toast$ }) {
  const approved = approvalReportSource.filter(t => String(t?.approvalStatus || "approved").toLowerCase() === "approved").length;
  const rejected = approvalReportSource.filter(t => String(t?.approvalStatus || "approved").toLowerCase() === "rejected").length;
  const pending = approvalReportSource.filter(t => String(t?.approvalStatus || "approved").toLowerCase() === "pending").length;
  const rows = [
    ["TOKKI Consumable System"], ["Laporan Approval Pengambilan"],
    ["Dibuat", `${todayFmt()} ${nowTime()}`], ["Total Transaksi", approvalReportSource.length],
    ["Approved", approved], ["Rejected", rejected], ["Pending", pending], [],
    ["ID", "Tanggal", "Waktu", "Pengambil", "Section", "Project", "Admin", "Item", "Qty", "Unit", "Status", "Alasan Approval", "Diproses Oleh", "Waktu Proses", "Catatan", "Durasi SLA"],
    ...approvalReportRows.map(r => [csvText(r.id), fmtDateExcel(r.date), r.time, r.taker, r.dept, r.workOrder, r.admin, r.itemName, r.qty, r.unit, r.status, r.approvalReason, r.approvedBy, r.approvedAt, r.approvalNote, r.slaDur]),
  ];
  const csv = "\uFEFF" + rows.map(r => r.map(v => typeof v === "string" && v.startsWith("=") ? v : csvEscape(v)).join(",")).join("\n");
  triggerDownload(`laporan-approval-${todayStr()}.csv`, csv, "text/csv;charset=utf-8;");
  toast$("Export Excel (CSV) laporan approval berhasil");
}

export function exportApprovalPdf({ approvalReportSource, approvalReportRows, toast$ }) {
  const approved = approvalReportSource.filter(t => String(t?.approvalStatus || "approved").toLowerCase() === "approved").length;
  const rejected = approvalReportSource.filter(t => String(t?.approvalStatus || "approved").toLowerCase() === "rejected").length;
  const pending = approvalReportSource.filter(t => String(t?.approvalStatus || "approved").toLowerCase() === "pending").length;
  downloadPdfTable({
    fileName: `laporan-approval-${todayStr()}.pdf`,
    title: `Laporan Approval Pengambilan - ${todayFmt()}`,
    subtitle: `Total: ${approvalReportSource.length} | Approved: ${approved} | Rejected: ${rejected} | Pending: ${pending}`,
    headers: ["ID", "Tanggal", "Pengambil", "Section", "Item", "Qty", "Status", "Diproses Oleh", "Durasi SLA", "Alasan"],
    rows: approvalReportRows.map(r => [r.id, r.date, r.taker, r.dept, r.itemName, `${r.qty} ${r.unit}`, r.status, r.approvedBy, r.slaDur, r.approvalReason]),
  });
  toast$("Export PDF laporan approval berhasil");
}

export async function exportAuditExcel({ fetchAuditExportRows, auditPeriodLabel, toast$ }) {
  try {
    const rowsData = await fetchAuditExportRows();
    const rows = [
      ["TOKKI Consumable System"], ["Laporan Audit Log"],
      ["Periode", auditPeriodLabel()], ["Dibuat", `${todayFmt()} ${nowTime()}`], ["Total Data", rowsData.length], [],
      ["ID", "Timestamp", "Action", "Actor", "Role", "Target"],
      ...rowsData.map(a => [a.id, a.createdAt ? new Date(a.createdAt).toLocaleString("id-ID") : "", a.action || "", a.actor?.username || "", a.actor?.role || "", a.target || ""]),
    ];
    const csv = rows.map(r => r.map(csvEscape).join(",")).join("\n");
    triggerDownload(`audit-log-${todayStr()}.csv`, csv, "text/csv;charset=utf-8;");
    toast$("Export Excel (CSV) audit berhasil");
  } catch (e) { toast$(e?.message || "Gagal export audit", "err"); }
}

export async function exportAuditPdf({ fetchAuditExportRows, auditPeriodLabel, toast$ }) {
  try {
    const rowsData = await fetchAuditExportRows();
    downloadPdfTable({
      fileName: `audit-log-${todayStr()}.pdf`,
      title: `Audit Log - ${todayFmt()}`,
      subtitle: `Periode: ${auditPeriodLabel()} | Total data: ${rowsData.length}`,
      headers: ["ID", "Timestamp", "Action", "Actor", "Role", "Target"],
      rows: rowsData.map(a => [a.id, a.createdAt ? new Date(a.createdAt).toLocaleString("id-ID") : "", a.action || "", a.actor?.username || "", a.actor?.role || "", a.target || ""]),
    });
    toast$("Export PDF audit berhasil");
  } catch (e) { toast$(e?.message || "Gagal export audit", "err"); }
}

export function exportReportExcel({ reportRange, reportTotalOutUnits, reportTotalInUnits, reportEstimatedValue, lowStock, reportTxnSeries, reportTopItems, reportProjectUsage, reportProjectByRp, reportDeptStack, reportDeptCats, toast$ }) {
  const rows = [
    ["TOKKI Consumable System"], ["Laporan & Analitik"],
    ["Periode", reportRange.label], ["Rentang", `${fmtDate(reportRange.start)} - ${fmtDate(reportRange.end)}`],
    ["Dibuat", `${todayFmt()} ${nowTime()}`], [],
    ["KPI", "Nilai"],
    ["Total Keluar (Unit)", reportTotalOutUnits], ["Total Masuk (Unit)", reportTotalInUnits],
    ["Nilai Estimasi (Rp)", Math.round(reportEstimatedValue)], ["Item Kritis", lowStock.length], [],
    ["Transaksi Per Hari/Bulan"], ["Label", "Keluar", "Masuk"],
    ...reportTxnSeries.map(s => [s.label, s.out, s.in]), [],
    ["Top 5 Item Paling Sering Diambil"], ["Item", "Unit Keluar"],
    ...reportTopItems.map(r => [r.name, r.total]), [],
    ["Project Paling Sering Dipakai (Frekuensi)"], ["Project", "Unit Keluar"],
    ...reportProjectUsage.map(r => [r.name, r.total]), [],
    ["Project Paling Sering Dipakai (Nilai Rp)"], ["Project", "Nilai (Rp)"],
    ...reportProjectByRp.map(r => [r.name, Math.round(r.total)]), [],
    ["Breakdown Pengambilan per Departemen"], ["Departemen", "Total Unit", ...reportDeptCats],
    ...reportDeptStack.map(row => [row.dept, row.total, ...reportDeptCats.map(cat => Number(row.cats?.[cat] || 0))]),
  ];
  const csv = "\uFEFF" + rows.map(r => r.map(csvEscape).join(",")).join("\n");
  triggerDownload(`laporan-analitik-${todayStr()}.csv`, csv, "text/csv;charset=utf-8;");
  toast$("Export Excel (CSV) laporan berhasil");
}

export function exportReportPdf({ reportRange, reportTotalOutUnits, reportTotalInUnits, reportEstimatedValue, lowStock, reportTxnSeries, reportTopItems, reportProjectUsage, reportProjectByRp, reportDeptStack, reportDeptCats, toast$ }) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFont("helvetica", "bold"); doc.setFontSize(14);
  doc.text(`Laporan & Analitik - ${todayFmt()}`, 40, 32);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text(`Periode: ${reportRange.label} (${fmtDate(reportRange.start)} - ${fmtDate(reportRange.end)})`, 40, 50);
  const tbl = (startY, head, body) => autoTable(doc, { startY, head: [head], body, styles: { font: "helvetica", fontSize: 9, cellPadding: 4 }, headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: "bold" }, margin: { left: 40, right: 40 }, theme: "grid" });
  tbl(62, ["KPI", "Nilai"], [["Total Keluar (Unit)", String(reportTotalOutUnits)], ["Total Masuk (Unit)", String(reportTotalInUnits)], ["Nilai Estimasi (Rp)", fmtMoney(Math.round(reportEstimatedValue))], ["Item Kritis", String(lowStock.length)]]);
  tbl(doc.lastAutoTable.finalY + 16, ["Label", "Keluar", "Masuk"], reportTxnSeries.map(s => [s.label, s.out, s.in]));
  tbl(doc.lastAutoTable.finalY + 16, ["Item", "Unit Keluar"], reportTopItems.map(r => [r.name, r.total]));
  tbl(doc.lastAutoTable.finalY + 16, ["Project", "Unit Keluar"], reportProjectUsage.map(r => [r.name, r.total]));
  tbl(doc.lastAutoTable.finalY + 16, ["Project", "Nilai (Rp)"], reportProjectByRp.map(r => [r.name, fmtMoney(Math.round(r.total))]));
  tbl(doc.lastAutoTable.finalY + 16, ["Departemen", "Total Unit", ...reportDeptCats], reportDeptStack.map(row => [row.dept, row.total, ...reportDeptCats.map(cat => Number(row.cats?.[cat] || 0))]));
  doc.save(`laporan-analitik-${todayStr()}.pdf`);
  toast$("Export PDF laporan berhasil");
}
