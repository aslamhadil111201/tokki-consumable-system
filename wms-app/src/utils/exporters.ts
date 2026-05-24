// ─── Exporters ───────────────────────────────────────────────────
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { todayStr, nowTime, fmtDate, todayFmt, fmtMoney, fmtDateExcel } from "./formatters";
import { csvEscape, csvText, toSafeRows, triggerDownload } from "./helpers";

type ToastFn = (msg: string, type?: "ok" | "err") => void;
type CsvRow = (string | number | null | undefined)[];

interface PdfTableOptions {
  fileName?: string;
  title: string;
  subtitle?: string;
  headers: string[];
  rows: CsvRow[];
}

interface ReportRange {
  label: string;
  start: string;
  end: string;
}

interface TxnSeries {
  label: string;
  out: number;
  in: number;
}

interface NameTotal {
  name: string;
  total: number;
}

interface DeptRow {
  dept: string;
  total: number;
  cats: Record<string, number>;
}

// ─── PDF ─────────────────────────────────────────────────────────

export function downloadPdfTable({ fileName, title, subtitle, headers, rows }: PdfTableOptions): void {
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

// ─── TRANSACTIONS ─────────────────────────────────────────────────

export function exportTransactionsExcel({
  filteredOut,
  reportPeriodLabel,
  toast$,
}: {
  filteredOut: Record<string, unknown>[];
  reportPeriodLabel: () => string;
  toast$: ToastFn;
}): void {
  const source = filteredOut;
  const unitTotal = source.reduce(
    (acc, t) => acc + toSafeRows(t.items as unknown[]).reduce((x: number, it: unknown) => x + Number((it as Record<string, unknown>).qty || 0), 0),
    0,
  );
  const rows: CsvRow[] = [
    ["Warehouse Management System"], ["Laporan Riwayat Pengambilan"],
    ["Periode", reportPeriodLabel()], ["Dibuat", `${todayFmt()} ${nowTime()}`],
    ["Total Data", source.length], ["Total Unit", unitTotal], [],
    ["ID", "Tanggal", "Waktu", "Pengambil", "Section", "Project", "Admin", "Item", "Qty", "Unit", "Keterangan"],
    ...toSafeRows(source).flatMap(t =>
      toSafeRows(t.items as unknown[]).map(it => {
        const item = it as Record<string, unknown>;
        const trx = t as Record<string, unknown>;
        return [csvText(trx.id), fmtDateExcel(trx.date as string), trx.time, trx.taker, trx.dept, trx.workOrder || "", trx.admin || "", item.itemName, item.qty, item.unit, trx.note || ""];
      }),
    ),
  ];
  const csv = "\uFEFF" + rows.map(r => r.map(v => typeof v === "string" && v.startsWith("=") ? v : csvEscape(v)).join(",")).join("\n");
  triggerDownload(`riwayat-pengambilan-${todayStr()}.csv`, csv, "text/csv;charset=utf-8;");
  toast$("Export Excel (CSV) pengambilan berhasil");
}

export function exportTransactionsPdf({
  filteredOut,
  reportPeriodLabel,
  toast$,
}: {
  filteredOut: Record<string, unknown>[];
  reportPeriodLabel: () => string;
  toast$: ToastFn;
}): void {
  const source = filteredOut;
  const unitTotal = source.reduce(
    (acc, t) => acc + toSafeRows(t.items as unknown[]).reduce((x: number, it: unknown) => x + Number((it as Record<string, unknown>).qty || 0), 0),
    0,
  );
  const rows = toSafeRows(source).flatMap(t =>
    toSafeRows(t.items as unknown[]).map(it => {
      const item = it as Record<string, unknown>;
      const trx = t as Record<string, unknown>;
      return [trx.id, trx.date, trx.time, trx.taker, trx.dept, trx.workOrder || "", trx.admin || "", item.itemName, `${item.qty} ${item.unit}`, trx.note || ""];
    }),
  );
  downloadPdfTable({
    fileName: `riwayat-pengambilan-${todayStr()}.pdf`,
    title: `Riwayat Pengambilan - ${todayFmt()}`,
    subtitle: `Periode: ${reportPeriodLabel()} | Total data: ${source.length} | Total unit: ${unitTotal}`,
    headers: ["ID", "Tanggal", "Waktu", "Pengambil", "Section", "Project", "Admin", "Item", "Qty", "Ket"],
    rows,
  });
  toast$("Export PDF pengambilan berhasil");
}

// ─── RECEIVES ─────────────────────────────────────────────────────

export function exportReceivesExcel({
  filteredIn,
  reportPeriodLabel,
  toast$,
}: {
  filteredIn: Record<string, unknown>[];
  reportPeriodLabel: () => string;
  toast$: ToastFn;
}): void {
  const source = filteredIn;
  const unitTotal = source.reduce((a, r) => a + Number(r.qty || 0), 0);
  const rows: CsvRow[] = [
    ["Warehouse Management System"], ["Laporan Riwayat Penerimaan"],
    ["Periode", reportPeriodLabel()], ["Dibuat", `${todayFmt()} ${nowTime()}`],
    ["Total Data", source.length], ["Total Unit", unitTotal], [],
    ["ID", "Tanggal", "Waktu", "Item", "Qty", "Unit", "PO", "DO", "Admin"],
    ...toSafeRows(source).map(r => [
      csvText(r.id), fmtDateExcel(r.date as string), r.time, r.itemName, r.qty, r.unit, r.poNumber || "", r.doNumber || "", r.admin || "",
    ]),
  ];
  const csv = "\uFEFF" + rows.map(r => r.map(v => typeof v === "string" && v.startsWith("=") ? v : csvEscape(v)).join(",")).join("\n");
  triggerDownload(`riwayat-penerimaan-${todayStr()}.csv`, csv, "text/csv;charset=utf-8;");
  toast$("Export Excel (CSV) penerimaan berhasil");
}

export function exportReceivesPdf({
  filteredIn,
  reportPeriodLabel,
  toast$,
}: {
  filteredIn: Record<string, unknown>[];
  reportPeriodLabel: () => string;
  toast$: ToastFn;
}): void {
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

// ─── RETURNS ──────────────────────────────────────────────────────

export function exportReturnsExcel({
  returns,
  itemMap,
  toast$,
}: {
  returns: Record<string, unknown>[];
  itemMap: Record<number, Record<string, unknown>>;
  toast$: ToastFn;
}): void {
  const source = returns;
  const unitTotal = source.reduce((a, r) => a + Number(r.qty || 0), 0);
  const rows: CsvRow[] = [
    ["Warehouse Management System"], ["Laporan Retur Barang"],
    ["Dibuat", `${todayFmt()} ${nowTime()}`], ["Total Data", source.length], ["Total Unit", unitTotal], [],
    ["ID", "Tanggal", "Waktu", "Karyawan", "Item", "Qty", "Unit", "Alasan", "Catatan", "Status"],
    ...toSafeRows(source).map(r => {
      const it = itemMap[Number(r.itemId)];
      return [csvText(r.id), fmtDateExcel(r.date as string), r.time || "", r.employee, it?.name || r.itemName || `Item #${r.itemId}`, r.qty, it?.unit || "pcs", r.reason, r.note || "", r.status || "Menunggu"];
    }),
  ];
  const csv = "\uFEFF" + rows.map(r => r.map(v => typeof v === "string" && v.startsWith("=") ? v : csvEscape(v)).join(",")).join("\n");
  triggerDownload(`retur-barang-${todayStr()}.csv`, csv, "text/csv;charset=utf-8;");
  toast$("Export Excel (CSV) retur berhasil");
}

export function exportReturnsPdf({
  returns,
  itemMap,
  toast$,
}: {
  returns: Record<string, unknown>[];
  itemMap: Record<number, Record<string, unknown>>;
  toast$: ToastFn;
}): void {
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

// ─── APPROVAL ─────────────────────────────────────────────────────

interface ApprovalRow {
  id: unknown;
  date: string;
  time: unknown;
  taker: unknown;
  dept: unknown;
  workOrder: unknown;
  admin: unknown;
  itemName: unknown;
  qty: unknown;
  unit: unknown;
  status: unknown;
  approvalReason: unknown;
  approvedBy: unknown;
  approvedAt: unknown;
  approvalNote: unknown;
  slaDur: unknown;
}

export function exportApprovalExcel({
  approvalReportSource,
  approvalReportRows,
  toast$,
}: {
  approvalReportSource: { approvalStatus?: string }[];
  approvalReportRows: ApprovalRow[];
  toast$: ToastFn;
}): void {
  const approved = approvalReportSource.filter(t => String(t?.approvalStatus || "approved").toLowerCase() === "approved").length;
  const rejected = approvalReportSource.filter(t => String(t?.approvalStatus || "approved").toLowerCase() === "rejected").length;
  const pending = approvalReportSource.filter(t => String(t?.approvalStatus || "approved").toLowerCase() === "pending").length;
  const rows: CsvRow[] = [
    ["Warehouse Management System"], ["Laporan Approval Pengambilan"],
    ["Dibuat", `${todayFmt()} ${nowTime()}`], ["Total Transaksi", approvalReportSource.length],
    ["Approved", approved], ["Rejected", rejected], ["Pending", pending], [],
    ["ID", "Tanggal", "Waktu", "Pengambil", "Section", "Project", "Admin", "Item", "Qty", "Unit", "Status", "Alasan Approval", "Diproses Oleh", "Waktu Proses", "Catatan", "Durasi SLA"],
    ...approvalReportRows.map(r => [csvText(r.id), fmtDateExcel(r.date), r.time, r.taker, r.dept, r.workOrder, r.admin, r.itemName, r.qty, r.unit, r.status, r.approvalReason, r.approvedBy, r.approvedAt, r.approvalNote, r.slaDur]),
  ];
  const csv = "\uFEFF" + rows.map(r => r.map(v => typeof v === "string" && v.startsWith("=") ? v : csvEscape(v)).join(",")).join("\n");
  triggerDownload(`laporan-approval-${todayStr()}.csv`, csv, "text/csv;charset=utf-8;");
  toast$("Export Excel (CSV) laporan approval berhasil");
}

export function exportApprovalPdf({
  approvalReportSource,
  approvalReportRows,
  toast$,
}: {
  approvalReportSource: { approvalStatus?: string }[];
  approvalReportRows: ApprovalRow[];
  toast$: ToastFn;
}): void {
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

// ─── AUDIT ────────────────────────────────────────────────────────

interface AuditRow {
  id: unknown;
  createdAt?: string;
  action?: string;
  actor?: { username?: string; role?: string };
  target?: string;
}

export async function exportAuditExcel({
  fetchAuditExportRows,
  auditPeriodLabel,
  toast$,
}: {
  fetchAuditExportRows: () => Promise<AuditRow[]>;
  auditPeriodLabel: () => string;
  toast$: ToastFn;
}): Promise<void> {
  try {
    const rowsData = await fetchAuditExportRows();
    const rows: CsvRow[] = [
      ["Warehouse Management System"], ["Laporan Audit Log"],
      ["Periode", auditPeriodLabel()], ["Dibuat", `${todayFmt()} ${nowTime()}`], ["Total Data", rowsData.length], [],
      ["ID", "Timestamp", "Action", "Actor", "Role", "Target"],
      ...rowsData.map(a => [a.id, a.createdAt ? new Date(a.createdAt).toLocaleString("id-ID") : "", a.action || "", a.actor?.username || "", a.actor?.role || "", a.target || ""]),
    ];
    const csv = rows.map(r => r.map(csvEscape).join(",")).join("\n");
    triggerDownload(`audit-log-${todayStr()}.csv`, csv, "text/csv;charset=utf-8;");
    toast$("Export Excel (CSV) audit berhasil");
  } catch (e: unknown) {
    toast$((e instanceof Error ? e.message : null) || "Gagal export audit", "err");
  }
}

export async function exportAuditPdf({
  fetchAuditExportRows,
  auditPeriodLabel,
  toast$,
}: {
  fetchAuditExportRows: () => Promise<AuditRow[]>;
  auditPeriodLabel: () => string;
  toast$: ToastFn;
}): Promise<void> {
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
  } catch (e: unknown) {
    toast$((e instanceof Error ? e.message : null) || "Gagal export audit", "err");
  }
}

// ─── REPORT ───────────────────────────────────────────────────────

interface ReportExportParams {
  reportRange: ReportRange;
  reportTotalOutUnits: number;
  reportTotalInUnits: number;
  reportEstimatedValue: number;
  lowStock: unknown[];
  reportTxnSeries: TxnSeries[];
  reportTopItems: NameTotal[];
  reportProjectUsage: NameTotal[];
  reportProjectByRp: NameTotal[];
  reportDeptStack: DeptRow[];
  reportDeptCats: string[];
  toast$: ToastFn;
}

export function exportReportExcel({
  reportRange, reportTotalOutUnits, reportTotalInUnits, reportEstimatedValue,
  lowStock, reportTxnSeries, reportTopItems, reportProjectUsage, reportProjectByRp,
  reportDeptStack, reportDeptCats, toast$,
}: ReportExportParams): void {
  const rows: CsvRow[] = [
    ["Warehouse Management System"], ["Laporan & Analitik"],
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

export function exportReportPdf({
  reportRange, reportTotalOutUnits, reportTotalInUnits, reportEstimatedValue,
  lowStock, reportTxnSeries, reportTopItems, reportProjectUsage, reportProjectByRp,
  reportDeptStack, reportDeptCats, toast$,
}: ReportExportParams): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(`Laporan & Analitik - ${todayFmt()}`, 40, 32);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Periode: ${reportRange.label} (${fmtDate(reportRange.start)} - ${fmtDate(reportRange.end)})`, 40, 50);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tbl = (startY: number, head: string[], body: CsvRow[]) =>
    autoTable(doc, {
      startY,
      head: [head],
      body: body.map(r => toSafeRows(r).map(c => String(c ?? ""))),
      styles: { font: "helvetica", fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: "bold" },
      margin: { left: 40, right: 40 },
      theme: "grid",
    });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lastY = () => (doc as any).lastAutoTable.finalY;

  tbl(62, ["KPI", "Nilai"], [
    ["Total Keluar (Unit)", String(reportTotalOutUnits)],
    ["Total Masuk (Unit)", String(reportTotalInUnits)],
    ["Nilai Estimasi (Rp)", fmtMoney(Math.round(reportEstimatedValue))],
    ["Item Kritis", String(lowStock.length)],
  ]);
  tbl(lastY() + 16, ["Label", "Keluar", "Masuk"], reportTxnSeries.map(s => [s.label, s.out, s.in]));
  tbl(lastY() + 16, ["Item", "Unit Keluar"], reportTopItems.map(r => [r.name, r.total]));
  tbl(lastY() + 16, ["Project", "Unit Keluar"], reportProjectUsage.map(r => [r.name, r.total]));
  tbl(lastY() + 16, ["Project", "Nilai (Rp)"], reportProjectByRp.map(r => [r.name, fmtMoney(Math.round(r.total))]));
  tbl(lastY() + 16, ["Departemen", "Total Unit", ...reportDeptCats],
    reportDeptStack.map(row => [row.dept, row.total, ...reportDeptCats.map(cat => Number(row.cats?.[cat] || 0))]));

  doc.save(`laporan-analitik-${todayStr()}.pdf`);
  toast$("Export PDF laporan berhasil");
}
