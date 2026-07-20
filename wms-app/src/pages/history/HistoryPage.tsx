// @ts-nocheck
import { useState, useEffect } from "react";
import "./HistoryPage.css";
import { getT } from "../../theme/tokens";
import { Badge } from "../../components/ui/Badge";
import { BtnP } from "../../components/ui/BtnP";
import { BtnG } from "../../components/ui/BtnG";
import { TablePageSkeleton } from "../../components/ui/Skeleton";
import { fmtMoney, fmtDate, fmtDateExcel, todayStr } from "../../utils/formatters";
import { trxApprovalStatus, isApprovedOutTrx, toSafeRows, csvEscape, csvText, triggerDownload } from "../../utils/helpers";
import { EXCEL_ICON, PDF_ICON } from "../../constants/index";
import { useStore } from "../../store/useStore";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { TransactionModal } from "../../components/modals/TransactionModal";
import { AddStockModal } from "../../components/modals/AddStockModal";

export function HistoryPage() {
  const { dark, user, trx, receives, returns, deliveryNotes, items, setToast, withLoading, fetchAll, dataReady } = useStore();
  const T = getT(dark);

  const isAdmin = (user?.role || "").toLowerCase() === "admin";
  const canManage = isAdmin || (user?.role || "").toLowerCase() === "operator";
  const itemMap = Object.fromEntries(items.map(i => [Number(i.id), i]));

  const [historyTab, setHistoryTab] = useState("all");
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  const [historyApprovalStatus, setHistoryApprovalStatus] = useState("all");
  const [historyPageSize, setHistoryPageSize] = useState(6);
  const [historyOutPage, setHistoryOutPage] = useState(1);
  const [historyInPage, setHistoryInPage] = useState(1);
  
  const [approvalBusyKey, setApprovalBusyKey] = useState<string | null>(null);
  const [slaTick, setSlaTick] = useState(0);
  const [autoRejectHours, setAutoRejectHours] = useState(24);

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  // Audit
  const [auditRows, setAuditRows] = useState<any[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(8);
  const [auditActor, setAuditActor] = useState("");
  const [auditAction, setAuditAction] = useState("");
  const [auditFrom, setAuditFrom] = useState("");
  const [auditTo, setAuditTo] = useState("");

  useEffect(() => {
    const fetchAudit = async () => {
      if (!isAdmin) return;
      try {
        const { supabase } = await import("../../lib/supabase");
        let query = supabase.from("audit_logs").select("*", { count: "exact" })
          .order("created_at", { ascending: false })
          .range((auditPage - 1) * auditPageSize, auditPage * auditPageSize - 1);
        if (auditAction) query = query.eq("action", auditAction);
        if (auditFrom) query = query.gte("created_at", auditFrom);
        if (auditTo) query = query.lte("created_at", auditTo + "T23:59:59");
        const { data, count, error } = await query;
        if (!error) {
          // Filter by actor username if specified
          let rows = data || [];
          if (auditActor) {
            rows = rows.filter(r => r.actor?.username?.toLowerCase().includes(auditActor.toLowerCase()));
          }
          setAuditRows(rows);
          setAuditTotal(count || rows.length);
        }
      } catch (e) { }
    };
    if (historyTab === "audit") fetchAudit();
  }, [auditPage, auditPageSize, auditActor, auditAction, auditFrom, auditTo, isAdmin, historyTab]);

  useEffect(() => {
    const t = setInterval(() => setSlaTick(v => v + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const approvedOutTrx = trx.filter(isApprovedOutTrx);
  const pendingApprovalCount = trx.filter(t => trxApprovalStatus(t) === "pending").length;

  const allHistory = [
    ...trx.map(t => ({ ...t, type: "out", _ts: t.date + "T" + t.time })),
    ...receives.map(r => ({ ...r, type: "in", _ts: r.date + "T" + (r.time || "00:00") }))
  ].sort((a, b) => b._ts.localeCompare(a._ts));

  const filterFn = (item: any) => {
    if (historyFrom && item.date < historyFrom) return false;
    if (historyTo && item.date > historyTo) return false;
    if (historyQuery) {
      const q = historyQuery.toLowerCase();
      const fields = [item.taker, item.admin, item.poNumber, item.doNumber, item.workOrder, item.note, item.approvalReason].filter(Boolean).map(String);
      const itemsMatch = toSafeRows(item.items).some(i => (i.itemName || "").toLowerCase().includes(q));
      if (!fields.some(f => f.toLowerCase().includes(q)) && !itemsMatch && !(item.itemName || "").toLowerCase().includes(q)) return false;
    }
    return true;
  };

  const filteredAll = allHistory.filter(filterFn);
  const filteredOut = trx.filter(filterFn);
  const filteredIn = receives.filter(filterFn);

  const filteredOutByApproval = filteredOut.filter(t => historyApprovalStatus === "all" || trxApprovalStatus(t) === historyApprovalStatus);
  const filteredPending = trx.filter(t => trxApprovalStatus(t) === "pending").filter(filterFn);

  const outTotalPages = Math.ceil(filteredOutByApproval.length / Math.max(1, historyPageSize));
  const inTotalPages = Math.ceil(filteredIn.length / Math.max(1, historyPageSize));
  const allTotalPages = Math.ceil(filteredAll.length / Math.max(1, historyPageSize));
  const auditTotalPages = Math.ceil(auditTotal / Math.max(1, auditPageSize));

  const pagedOut = filteredOutByApproval.slice((historyOutPage - 1) * historyPageSize, historyOutPage * historyPageSize);
  const pagedIn = filteredIn.slice((historyInPage - 1) * historyPageSize, historyInPage * historyPageSize);
  const pagedAll = filteredAll.slice((historyOutPage - 1) * historyPageSize, historyOutPage * historyPageSize);

  const totalOut = approvedOutTrx.reduce((a, t) => a + toSafeRows(t.items).reduce((b: number, i: any) => b + Number(i.qty || 0), 0), 0);
  const totalIn = receives.reduce((a, r) => a + Number(r.qty || 0), 0);

  const getSlaInfo = (t: any) => {
    const ageMs = Date.now() - Number(t.id);
    const limitMs = autoRejectHours * 60 * 60 * 1000;
    const remainingMs = Math.max(0, limitMs - ageMs);
    const urgency = remainingMs === 0 ? "critical" : remainingMs < limitMs * 0.25 ? "warning" : "normal";
    if (remainingMs === 0) return { urgency, remainingMs, remainingMin: 0, label: "Waktu Habis", remainingLabel: "Telah melewati batas SLA" };
    const m = Math.floor(remainingMs / 60000);
    const h = Math.floor(m / 60); const remM = m % 60;
    const remainingLabel = h > 0 ? `${h} jam ${remM} mnt tersisa` : `${remM} mnt tersisa`;
    const label = ageMs < 60000 ? "Baru Saja" : ageMs < 3600000 ? `${Math.floor(ageMs / 60000)} mnt lalu` : `${Math.floor(ageMs / 3600000)} jam lalu`;
    return { urgency, remainingMs, remainingMin: m, label, remainingLabel };
  };

  const processTransactionApproval = async (id: number, act: "approve" | "reject") => {
    if (!isAdmin) { setToast("Hanya admin yang dapat menyetujui transaksi", "err"); return; }
    setApprovalBusyKey(`${id}:${act}`);
    try {
      const { supabase } = await import("../../lib/supabase");
      const updateData = act === "approve"
        ? { approvalStatus: "approved", approvedBy: user?.username || "admin", approvedAt: new Date().toISOString() }
        : { approvalStatus: "rejected", approvedBy: user?.username || "admin", approvedAt: new Date().toISOString() };
      const { error } = await supabase.from("transactions").update(updateData).eq("id", id);
      if (error) throw new Error(error.message || `Gagal ${act} transaksi`);

      // Jika approve, kurangi stok
      if (act === "approve") {
        const trxData = trx.find(t => t.id === id);
        if (trxData && Array.isArray(trxData.items)) {
          for (const line of trxData.items) {
            const itemId = Number(line.itemId);
            const qty = Number(line.qty || 0);
            if (itemId && qty > 0) {
              const item = items.find(i => Number(i.id) === itemId);
              if (item) {
                const newStock = Math.max(0, (item.stock || 0) - qty);
                await supabase.from("items").update({ stock: newStock }).eq("id", itemId);
              }
            }
          }
        }
      }

      // Log audit
      await supabase.from("audit_logs").insert([{
        action: `transactions.${act}`,
        actor: { username: user?.username, role: user?.role },
        target: `Transaction #${id}`
      }]);
      setToast(`Transaksi berhasil di-${act} \u2713`);
      await fetchAll();
    } catch (e: any) { setToast(e?.message || `Gagal ${act} transaksi`, "err"); }
    finally { setApprovalBusyKey(null); }
  };

  const deleteTransaction = async (id: number) => {
    if (!isAdmin) { setToast("Hanya admin yang boleh menghapus transaksi", "err"); return; }
    if (!window.confirm("Hapus transaksi ini? Stok barang yang sudah disetujui akan dikembalikan ke gudang.")) return;
    await withLoading(async () => {
      try {
        const { supabase } = await import("../../lib/supabase");
        
        // 1. Ambil data transaksi terlebih dahulu
        const trxData = trx.find(t => t.id === id);
        
        // 2. Jika transaksi ini sudah disetujui (approved), kembalikan stok barang
        if (trxData && trxApprovalStatus(trxData) === "approved" && Array.isArray(trxData.items)) {
          for (const line of trxData.items) {
            const itemId = Number(line.itemId);
            const qty = Number(line.qty || 0);
            if (itemId && qty > 0) {
              const { data: itemData } = await supabase.from("items").select("stock, averageCost").eq("id", itemId).single();
              if (itemData) {
                const newStock = (itemData.stock || 0) + qty;
                const avgCost = Number(itemData.averageCost || 0);
                const newTotalValue = Math.round(newStock * avgCost * 100) / 100;
                await supabase.from("items").update({ 
                  stock: newStock,
                  totalValue: newTotalValue
                }).eq("id", itemId);
              }
            }
          }
        }

        const { error } = await supabase.from("transactions").delete().eq("id", id);
        if (error) throw new Error(error.message || "Gagal menghapus transaksi");
        await supabase.from("audit_logs").insert([{
          action: "transactions.delete",
          actor: { username: user?.username, role: user?.role },
          target: `Transaction #${id}`
        }]);
        setToast("Transaksi dihapus & stok barang telah dikembalikan ✓");
        await fetchAll();
      } catch (e: any) { setToast(e?.message || "Gagal menghapus", "err"); }
    }, "Sedang menghapus...");
  };

  const deleteReceive = async (id: number) => {
    if (!isAdmin) { setToast("Hanya admin yang boleh menghapus", "err"); return; }
    if (!window.confirm("Hapus penerimaan ini? Stok barang akan dikurangi kembali.")) return;
    await withLoading(async () => {
      try {
        const { supabase } = await import("../../lib/supabase");

        // 1. Ambil data penerimaan
        const recData = receives.find(r => r.id === id);
        
        // 2. Kurangi kembali stok barang yang sempat ditambahkan saat penerimaan
        if (recData && recData.itemId) {
          const itemId = Number(recData.itemId);
          const qty = Number(recData.qty || 0);
          if (itemId && qty > 0) {
            const { data: itemData } = await supabase.from("items").select("stock, averageCost").eq("id", itemId).single();
            if (itemData) {
              const newStock = Math.max(0, (itemData.stock || 0) - qty);
              const avgCost = Number(itemData.averageCost || 0);
              const newTotalValue = Math.round(newStock * avgCost * 100) / 100;
              await supabase.from("items").update({ 
                stock: newStock,
                totalValue: newTotalValue 
              }).eq("id", itemId);
            }
          }
        }

        const { error } = await supabase.from("receives").delete().eq("id", id);
        if (error) throw new Error(error.message || "Gagal menghapus penerimaan");
        setToast("Penerimaan dihapus & stok disesuaikan ✓");
        await fetchAll();
      } catch (e: any) { setToast(e?.message || "Gagal menghapus", "err"); }
    }, "Sedang menghapus...");
  };

  const fetchReceiveAttachment = async (id: number) => {
    try {
      const { supabase } = await import("../../lib/supabase");
      const { data, error } = await supabase
        .from("receives")
        .select("attachment")
        .eq("id", id)
        .single();
      if (error || !data) { setToast("Gagal mengambil lampiran", "err"); return; }
      if (!data.attachment) { setToast("Lampiran kosong", "err"); return; }
      const w = window.open("");
      if (w) w.document.write(`<iframe src="${data.attachment}" style="width:100%;height:100vh;border:none;"></iframe>`);
      else setToast("Pop-up diblokir", "err");
    } catch { setToast("Gagal mengambil lampiran", "err"); }
  };

  const approvalMetaChips = (t: any) => {
    const s = trxApprovalStatus(t);
    if (s === "pending") return null;
    return (
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 4 }}>
        <span style={{ fontSize: 10, background: T.surface, color: T.muted, padding: "2px 8px", borderRadius: 4, border: `1px solid ${T.border}` }}>
          👤 Oleh: {s === "approved" ? t.approvedBy : t.rejectedBy}
        </span>
        <span style={{ fontSize: 10, background: T.surface, color: T.muted, padding: "2px 8px", borderRadius: 4, border: `1px solid ${T.border}` }}>
          📅 {fmtDate((s === "approved" ? t.approvedAt : t.rejectedAt) || "")}
        </span>
      </div>
    );
  };

  const dlPdf = (fileName: string, title: string, headers: any[], rows: any[]) => {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.text(title, 40, 32);
    autoTable(doc, { startY: 46, head: [headers.map(h => String(h ?? ""))], body: rows.map(r => r.map((c: any) => String(c ?? ""))), styles: { font: "helvetica", fontSize: 8, cellPadding: 4, overflow: "linebreak" }, headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: "bold" }, margin: { left: 40, right: 40, top: 40, bottom: 30 }, theme: "grid" });
    doc.save(fileName);
  };

  const exportTransactionsExcel = () => {
    const rows = [
      ["Warehouse Management System"], ["Laporan Riwayat Pengambilan"], [],
      ["ID", "Tanggal", "Waktu", "Pengambil", "Section", "Project", "Admin", "Item", "Qty", "Unit", "Keterangan", "Status"],
      ...filteredOutByApproval.flatMap((t: any) => toSafeRows(t.items).map((it: any) => [
        csvText(t.id), fmtDateExcel(t.date), t.time, t.taker, t.dept, t.workOrder || "", t.admin || "", it.itemName, it.qty, it.unit, t.note || "", trxApprovalStatus(t).toUpperCase()
      ]))
    ];
    const csv = "\uFEFF" + rows.map(r => r.map(v => typeof v === "string" ? csvEscape(v) : v).join(",")).join("\n");
    triggerDownload(`pengambilan-${todayStr()}.csv`, csv, "text/csv;charset=utf-8;");
    setToast("Export Excel (CSV) pengambilan berhasil");
  };

  const exportTransactionsPdf = () => {
    const rows = filteredOutByApproval.flatMap((t: any) => toSafeRows(t.items).map((it: any) => [t.id, t.date, t.time, t.taker, t.dept, t.workOrder || "", t.admin || "", it.itemName, `${it.qty} ${it.unit}`, t.note || "", trxApprovalStatus(t).toUpperCase()]));
    dlPdf(`pengambilan-${todayStr()}.pdf`, "Riwayat Pengambilan", ["ID", "Tanggal", "Waktu", "Pengambil", "Section", "Project", "Admin", "Item", "Qty", "Ket", "Status"], rows);
  };

  const exportReceivesExcel = () => {
    const rows = [
      ["Warehouse Management System"], ["Laporan Penerimaan Barang"], [],
      ["ID", "Tanggal", "Waktu", "Admin", "Item", "Qty", "Unit", "Harga Satuan", "Total", "PO", "DO", "Supplier"],
      ...filteredIn.map((r: any) => {
        const p = Number(r.buyPrice || 0); const t = p * Number(r.qty || 0);
        return [csvText(r.id), fmtDateExcel(r.date), r.time || "", r.admin || "", r.itemName || "", r.qty, r.unit || "", p, t, r.poNumber || "", r.doNumber || "", r.supplier || ""];
      })
    ];
    const csv = "\uFEFF" + rows.map(r => r.map(v => typeof v === "string" ? csvEscape(v) : v).join(",")).join("\n");
    triggerDownload(`penerimaan-${todayStr()}.csv`, csv, "text/csv;charset=utf-8;");
    setToast("Export Excel (CSV) penerimaan berhasil");
  };

  const exportReceivesPdf = () => {
    const rows = filteredIn.map((r: any) => [r.id, r.date, r.time || "", r.admin || "", r.itemName || "", `${r.qty} ${r.unit || ""}`, fmtMoney(Number(r.buyPrice || 0)), fmtMoney(Number(r.buyPrice || 0) * Number(r.qty || 0)), r.poNumber || "", r.doNumber || ""]);
    dlPdf(`penerimaan-${todayStr()}.pdf`, "Riwayat Penerimaan", ["ID", "Tanggal", "Waktu", "Admin", "Item", "Qty", "Harga Satuan", "Total Harga", "PO", "DO"], rows);
  };

  const exportAuditExcel = () => {
    const rows = [
      ["Warehouse Management System"], ["Laporan Audit Trail"], [],
      ["ID", "Waktu", "Aksi", "Actor", "Role", "Target"],
      ...auditRows.map(a => [csvText(a.id), new Date(a.createdAt).toLocaleString("id-ID"), a.action, a.actor?.username || "", a.actor?.role || "", a.target || ""])
    ];
    const csv = "\uFEFF" + rows.map(r => r.map(v => typeof v === "string" ? csvEscape(v) : v).join(",")).join("\n");
    triggerDownload(`audit-${todayStr()}.csv`, csv, "text/csv;charset=utf-8;");
    setToast("Export Excel (CSV) audit berhasil");
  };

  const exportAuditPdf = () => {
    const rows = auditRows.map(a => [a.id, new Date(a.createdAt).toLocaleString("id-ID"), a.action, a.actor?.username || "", a.actor?.role || "", a.target || ""]);
    dlPdf(`audit-${todayStr()}.pdf`, "Laporan Audit Trail", ["ID", "Waktu", "Aksi", "Actor", "Role", "Target"], rows);
  };

  const exportAllReportsExcel = async () => {
    await withLoading(async () => {
      try {
        const XLSX = await import("xlsx");
        const wb = XLSX.utils.book_new();

        // 1. Sheet Stok Barang
        const stokRows = items.map(it => ({
          "ID": it.id,
          "Kode Barang": it.itemCode || "-",
          "Nama Barang": it.name,
          "Kategori": it.category,
          "Stok": it.stock,
          "Satuan": it.unit,
          "Min. Stok": it.minStock,
          "Average Cost": it.averageCost || 0,
          "Last Price": it.lastPrice || 0,
          "Total Value": it.totalValue || 0
        }));
        const wsStok = XLSX.utils.json_to_sheet(stokRows);
        XLSX.utils.book_append_sheet(wb, wsStok, "Stok Barang");

        // 2. Sheet Pengambilan
        const outRows = trx.flatMap((t: any) => 
          toSafeRows(t.items).map((it: any) => ({
            "ID Transaksi": t.id,
            "Tanggal": t.date,
            "Waktu": t.time || "-",
            "Nama Pengambil": t.taker || "-",
            "Section": t.dept || "-",
            "Project": t.workOrder || "-",
            "Admin": t.admin || "-",
            "Nama Barang": it.itemName || "-",
            "Qty": it.qty,
            "Unit": it.unit || "pcs",
            "Status": trxApprovalStatus(t).toUpperCase(),
            "Keterangan": t.note || "-"
          }))
        );
        const wsOut = XLSX.utils.json_to_sheet(outRows);
        XLSX.utils.book_append_sheet(wb, wsOut, "Pengambilan");

        // 3. Sheet Penerimaan
        const inRows = receives.map((r: any) => ({
          "ID Penerimaan": r.id,
          "Tanggal": r.date,
          "Waktu": r.time || "-",
          "Admin": r.admin || "-",
          "Nama Barang": r.itemName || "-",
          "Qty": r.qty,
          "Unit": r.unit || "pcs",
          "Harga Satuan": r.buyPrice || 0,
          "Total Harga": (r.buyPrice || 0) * (r.qty || 0),
          "No. PO": r.poNumber || "-",
          "No. DO": r.doNumber || "-",
          "Supplier": r.supplier || "-"
        }));
        const wsIn = XLSX.utils.json_to_sheet(inRows);
        XLSX.utils.book_append_sheet(wb, wsIn, "Penerimaan");

        // 4. Sheet Retur Barang
        const returRows = returns.map((r: any) => {
          const it = itemMap[Number(r.itemId)];
          return {
            "ID Retur": r.id,
            "Tanggal": r.date,
            "Waktu": r.time || "-",
            "Karyawan": r.employee || "-",
            "Nama Barang": it?.name || r.itemName || `Item #${r.itemId}`,
            "Qty": r.qty,
            "Unit": it?.unit || "pcs",
            "Alasan": r.reason || "-",
            "Catatan": r.note || "-"
          };
        });
        const wsRetur = XLSX.utils.json_to_sheet(returRows);
        XLSX.utils.book_append_sheet(wb, wsRetur, "Retur Barang");

        // 5. Sheet Surat Jalan
        const sjRows = deliveryNotes.flatMap((n: any) => 
          toSafeRows(n.items).map((it: any) => ({
            "ID Surat Jalan": n.id,
            "No. Batch": n.batch || "-",
            "Kategori": n.category || "-",
            "Tanggal": n.date || "-",
            "No. Project": n.project_no || "-",
            "No. Kendaraan": n.no_kendaraan || "-",
            "Tujuan": n.destination || "-",
            "Penerima / Attn": n.attn || "-",
            "Alamat": n.full_address || "-",
            "Deskripsi Barang": it.description || "-",
            "Qty": it.qty || 0,
            "UoM": it.uom || "-"
          }))
        );
        const wsSj = XLSX.utils.json_to_sheet(sjRows);
        XLSX.utils.book_append_sheet(wb, wsSj, "Surat Jalan");

        XLSX.writeFile(wb, `Laporan_WMS_Lengkap_${todayStr()}.xlsx`);
        setToast("Export Semua Laporan (Excel) berhasil ✓", "ok");
      } catch (e: any) {
        setToast(e.message || "Gagal export laporan", "err");
      }
    }, "Mengekspor semua laporan...");
  };

  return (
    <div>
      {!dataReady && <TablePageSkeleton rows={6} statCount={5} showTabs />}
      {dataReady && (<>
      {/* Sub-tab toggle + actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 4, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 4, overflowX: "auto", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
          {(() => {
            const detectiveIcon = (
              <span style={{ fontSize: 15, display: "inline-flex", alignItems: "center", justifyContent: "center", width: 15, height: 15, lineHeight: 1, marginRight: 2 }}>
                🕵️‍♂️
              </span>
            );
            const subTabs = [
              { id: "all", icon: "🧾", label: `Semua (${allHistory.length})` },
              { id: "out", icon: "📤", label: `Pengambilan (${trx.length})` },
              { id: "in", icon: "📋", label: `Penerimaan (${receives.length})` },
              ...(isAdmin ? [{ id: "approval", icon: "⏳", label: `Approval (${pendingApprovalCount})` }] : []),
              ...(isAdmin ? [{ id: "audit", icon: detectiveIcon, label: `Audit (${auditTotal})` }] : []),
            ];
            return subTabs.map(tb => (
              <button key={tb.id} onClick={() => setHistoryTab(tb.id)} style={{ padding: "8px 14px", borderRadius: 9, border: "none", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all .2s", background: historyTab === tb.id ? T.primary : "transparent", color: historyTab === tb.id ? "white" : T.muted, boxShadow: historyTab === tb.id ? `0 4px 12px ${T.primaryGlow}` : "none", whiteSpace: "nowrap", flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>{tb.icon} {tb.label}</button>
            ));
          })()}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {isAdmin && historyTab === "all" && (
            <button onClick={exportAllReportsExcel} style={{ fontWeight: 800, padding: "8px 14px", fontSize: 12, display: "flex", alignItems: "center", gap: 6, background: "var(--t-primary)", color: "white", border: "none", borderRadius: 9, cursor: "pointer", transition: "all .2s", boxShadow: `0 4px 12px ${T.primaryGlow}` }}>
              📊 Export Semua Laporan (Excel)
            </button>
          )}
          {isAdmin && historyTab !== "all" && historyTab !== "audit" && historyTab !== "approval" && <BtnG onClick={historyTab === "in" ? exportReceivesExcel : exportTransactionsExcel} style={{ fontWeight: 700, padding: "8px 14px", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>{EXCEL_ICON}Excel</BtnG>}
          {isAdmin && historyTab !== "all" && historyTab !== "audit" && historyTab !== "approval" && <BtnG onClick={historyTab === "in" ? exportReceivesPdf : exportTransactionsPdf} style={{ fontWeight: 700, padding: "8px 14px", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>{PDF_ICON}PDF</BtnG>}
          {isAdmin && historyTab === "audit" && <BtnG onClick={exportAuditExcel} style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>{EXCEL_ICON}Excel</BtnG>}
          {isAdmin && historyTab === "audit" && <BtnG onClick={exportAuditPdf} style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>{PDF_ICON}PDF</BtnG>}
          {isAdmin && historyTab !== "in" && historyTab !== "audit" && historyTab !== "approval" && <BtnP onClick={() => setShowModal(true)} style={{ padding: "8px 16px", fontSize: 12, fontWeight: 800 }}>＋ Catat Pengambilan</BtnP>}
          {canManage && historyTab === "in" && <BtnP onClick={() => setShowAdd(true)} style={{ padding: "8px 16px", fontSize: 12, fontWeight: 800 }}>＋ Catat Penerimaan</BtnP>}
        </div>
      </div>

      {historyTab !== "audit" && (
        <div className="fbar" style={{ marginBottom: 14 }}>
          <input className="ifield" style={{ width: 220 }} placeholder="🔍 Cari nama/item/admin/PO/DO..." value={historyQuery} onChange={e => setHistoryQuery(e.target.value)} />
          {historyTab === "out" && (
            <select className="ifield" style={{ width: 190 }} value={historyApprovalStatus} onChange={e => setHistoryApprovalStatus(e.target.value)}>
              <option value="all">Semua Status Approval</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
            </select>
          )}
          <span style={{ fontSize: 11.5, color: T.muted, fontWeight: 700 }}>Dari</span>
          <input type="date" className="ifield" style={{ width: 160 }} value={historyFrom} onChange={e => setHistoryFrom(e.target.value)} onClick={e => e.currentTarget.showPicker()} />
          <span style={{ fontSize: 11.5, color: T.muted, fontWeight: 700 }}>Sampai</span>
          <input type="date" className="ifield" style={{ width: 160 }} value={historyTo} onChange={e => setHistoryTo(e.target.value)} onClick={e => e.currentTarget.showPicker()} />
          <select className="ifield" style={{ width: 120 }} value={historyPageSize} onChange={e => setHistoryPageSize(Number(e.target.value) || 6)}>
            {[6, 10, 15, 20].map(n => <option key={n} value={n}>{n}/hal</option>)}
          </select>
          <BtnG style={{ fontSize: 11.5, padding: "7px 12px" }} onClick={() => { setHistoryQuery(""); setHistoryFrom(""); setHistoryTo(""); setHistoryApprovalStatus("all"); }}>✕ Reset</BtnG>
          <span style={{ marginLeft: "auto", fontSize: 11.5, color: T.muted, fontWeight: 600, whiteSpace: "nowrap" }}>
            {historyTab === "all" ? filteredAll.length : historyTab === "out" ? filteredOutByApproval.length : historyTab === "approval" ? filteredPending.length : filteredIn.length} transaksi ditemukan
          </span>
        </div>
      )}

      {historyTab === "approval" && isAdmin && (
        <div>
          {filteredPending.length === 0
            ? <div style={{ textAlign: "center", padding: "60px 0", color: T.muted }}><div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>Tidak ada transaksi yang menunggu approval</div>
            : filteredPending.map((t: any) => {
              const totalUnits = (t.items || []).reduce((a: number, i: any) => a + Number(i.qty || 0), 0);
              const totalCostRow = Number(t.totalCostOut ?? (t.items || []).reduce((acc: number, it: any) => { const avg = Number(it.averageCost ?? itemMap[Number(it.itemId)]?.averageCost ?? 0); return acc + (Number(it.qty || 0) * avg); }, 0));
              const sla = getSlaInfo(t);
              const slaColor = sla.urgency === "critical" ? T.red : sla.urgency === "warning" ? "#f97316" : T.amber;
              const slaIcon = sla.urgency === "critical" ? "🔴" : sla.urgency === "warning" ? "⚠️" : "⏱";
              const slaBorderLeft = `4px solid ${slaColor}`;
              const slaCardBg = sla.urgency === "critical" ? `linear-gradient(90deg,rgba(239,68,68,0.07) 0%,transparent 120px)` : sla.urgency === "warning" ? `linear-gradient(90deg,rgba(249,115,22,0.07) 0%,transparent 120px)` : "none";
              return (
                <div key={t.id} style={{ display: "flex", alignItems: "stretch", gap: 0, background: T.card, backgroundImage: slaCardBg, border: `1px solid ${sla.urgency === "critical" ? T.redBorder : sla.urgency === "warning" ? "rgba(249,115,22,0.3)" : T.border}`, borderLeft: slaBorderLeft, borderRadius: 14, marginBottom: 8, overflow: "hidden", boxShadow: T.shadowSm }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "14px 12px", gap: 5, minWidth: 70, flexShrink: 0 }}>
                    <div style={{ width: 48, height: 48, borderRadius: "50%", background: sla.urgency === "critical" ? T.redBg : T.amberBg, border: `2px solid ${slaColor}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, lineHeight: 1 }}>⏳</div>
                    <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: ".07em", color: slaColor, textTransform: "uppercase" }}>PENDING</span>
                    {sla.label && <span style={{ fontSize: 9, fontWeight: 800, color: slaColor, textAlign: "center", lineHeight: 1.2 }}>{slaIcon} {sla.label}</span>}
                    {sla.remainingLabel && <span style={{ fontSize: 9, fontWeight: 800, color: sla.remainingMin === 0 ? T.red : T.muted, textAlign: "center", lineHeight: 1.2 }}>🕒 {sla.remainingLabel}</span>}
                  </div>
                  <div className="trx-row-inner">
                    <div className="trx-col-name">
                      <div style={{ fontSize: 13.5, fontWeight: 800, color: T.text, lineHeight: 1.3 }}>{t.taker || "-"}</div>
                      <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{t.dept || "-"}</div>
                      <div style={{ fontSize: 10.5, color: T.muted, marginTop: 1 }}>Admin: {t.admin || "-"}</div>
                    </div>
                    <div className="trx-col-time">
                      <div style={{ fontSize: 16, fontWeight: 900, color: T.text, lineHeight: 1 }}>{t.time || "-"}</div>
                      <div style={{ fontSize: 10.5, color: T.muted, marginTop: 3 }}>{fmtDate(t.date)}</div>
                    </div>
                    <div className="trx-col-items">
                      {(t.items || []).slice(0, 3).map((it: any, ii: number) => (
                        <div key={ii} style={{ display: "grid", gridTemplateColumns: "14px minmax(0,1fr) auto", alignItems: "center", columnGap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 11 }}>📦</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>{it.itemName}</span>
                          <span style={{ fontSize: 10, fontWeight: 800, color: T.navActiveText, background: T.navActive, padding: "1px 7px", borderRadius: 5, border: `1px solid ${T.navActiveBorder}`, flexShrink: 0 }}>×{it.qty} {it.unit}</span>
                        </div>
                      ))}
                      {(t.items || []).length > 3 && <div style={{ fontSize: 10, color: T.muted }}>+{(t.items || []).length - 3} item lainnya</div>}
                      {t.approvalReason && <div style={{ fontSize: 10.5, color: T.amber, fontWeight: 700, marginTop: 4 }}>Alasan: {t.approvalReason}</div>}
                    </div>
                    <div className="trx-col-count" style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                        <span style={{ fontSize: 16, fontWeight: 900, color: T.text, lineHeight: 1 }}>{(t.items || []).length}</span>
                        <span style={{ fontSize: 10.5, fontWeight: 600, color: T.muted }}>jenis</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                        <span style={{ fontSize: 16, fontWeight: 900, color: T.text, lineHeight: 1 }}>{totalUnits}</span>
                        <span style={{ fontSize: 10.5, fontWeight: 600, color: T.muted }}>unit</span>
                      </div>
                    </div>
                    <div className="trx-col-total">
                      <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, marginBottom: 3, textTransform: "uppercase", letterSpacing: ".05em" }}>Total</div>
                      <div style={{ fontSize: 14, fontWeight: 900, color: slaColor }}>{fmtMoney(totalCostRow)}</div>
                      {sla.urgency !== "normal" && <div style={{ fontSize: 9, fontWeight: 700, color: slaColor, marginTop: 3 }}>{sla.urgency === "critical" ? "🚨 Segera diproses!" : "⚠ Menunggu lama"}</div>}
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                      <button type="button" disabled={Boolean(approvalBusyKey)} onClick={() => processTransactionApproval(t.id, "approve")} style={{ background: T.greenBg, border: `1px solid ${T.greenBorder}`, color: T.greenText, borderRadius: 8, padding: "7px 10px", fontSize: 11, fontWeight: 700, cursor: approvalBusyKey ? "not-allowed" : "pointer", whiteSpace: "nowrap", opacity: approvalBusyKey ? 0.65 : 1 }}>{approvalBusyKey === `${t.id}:approve` ? "Memproses..." : "✅ Approve"}</button>
                      <button type="button" disabled={Boolean(approvalBusyKey)} onClick={() => processTransactionApproval(t.id, "reject")} style={{ background: T.redBg, border: `1px solid ${T.redBorder}`, color: T.redText, borderRadius: 8, padding: "7px 10px", fontSize: 11, fontWeight: 700, cursor: approvalBusyKey ? "not-allowed" : "pointer", whiteSpace: "nowrap", opacity: approvalBusyKey ? 0.65 : 1 }}>{approvalBusyKey === `${t.id}:reject` ? "Memproses..." : "⛔ Reject"}</button>
                    </div>
                  </div>
                </div>
              );
            })
          }
        </div>
      )}

      {/* ─ TAB SEMUA ─ */}
      {historyTab === "all" && (
        <div>
          {filteredAll.length === 0
            ? <div style={{ textAlign: "center", padding: "60px 0", color: T.muted }}><div style={{ fontSize: 36, marginBottom: 12 }}>🧾</div>Belum ada riwayat transaksi</div>
            : (() => {
              const grouped: Record<string, typeof pagedAll> = {};
              for (const row of pagedAll) { const d = row.date || ""; if (!grouped[d]) grouped[d] = []; grouped[d].push(row); }
              const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
              const fmtDG = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
              return sortedDates.map(date => (
                <div key={date} style={{ marginBottom: 22 }}>
                  {/* Date group header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.primary, display: "inline-block", flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 900, color: T.primary, letterSpacing: ".1em" }}>{fmtDG(date)}</span>
                  </div>
                  {grouped[date].map((row: any) => {
                    const isIn = String(row.type || "").toLowerCase() === "in";
                    const accentColor = isIn ? T.green : T.red;
                    const accentBg = isIn ? T.greenBg : T.redBg;
                    const itemsArr: any[] = row.items || [];
                    const totalUnits = isIn ? (Number(row.qty) || 0) : itemsArr.reduce((a: number, i: any) => a + Number(i.qty || 0), 0);
                    const jenis = isIn ? 1 : itemsArr.length;
                    const totalCost = isIn
                      ? Number(row.totalCostIn ?? ((Number(row.qty) || 0) * (Number(row.buyPrice) || 0)))
                      : Number(row.totalCostOut ?? 0);
                    return (
                      <div key={`${row.type || "x"}-${row.id}`} style={{ display: "flex", alignItems: "stretch", gap: 0, background: T.card, border: `1px solid ${T.border}`, borderLeft: `4px solid ${accentColor}`, borderRadius: 14, marginBottom: 8, overflow: "hidden", transition: "box-shadow .2s", boxShadow: T.shadowSm }}>
                        {/* Avatar */}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "14px 12px", gap: 5, minWidth: 70, flexShrink: 0 }}>
                          <div style={{ width: 48, height: 48, borderRadius: "50%", background: accentBg, border: `2px solid ${accentColor}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, lineHeight: 1 }}>
                            {isIn ? "↙" : "↗"}
                          </div>
                          <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: ".07em", color: accentColor, textTransform: "uppercase" }}>{isIn ? "MASUK" : "KELUAR"}</span>
                        </div>
                        {/* Content */}
                        <div className="trx-row-inner">
                          {/* Name + dept */}
                          <div className="trx-col-name">
                            <div style={{ fontSize: 13.5, fontWeight: 800, color: T.text, lineHeight: 1.3 }}>{isIn ? (row.itemName || itemsArr[0]?.itemName || "-") : (row.taker || "-")}</div>
                            <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{isIn ? `Admin: ${row.admin || "-"}` : (row.dept || "-")}</div>
                            {!isIn && <div style={{ fontSize: 10.5, color: T.muted, marginTop: 1 }}>Admin: {row.admin || "-"}</div>}
                            {!isIn && (
                              <div style={{ marginTop: 4 }}>
                                {(() => {
                                  const status = trxApprovalStatus(row);
                                  if (status === "pending") return <Badge bg={T.amberBg} color={T.amberText} border={T.amberBorder}>⏳ Pending Approval</Badge>;
                                  if (status === "rejected") return <Badge bg={T.redBg} color={T.redText} border={T.redBorder}>⛔ Rejected</Badge>;
                                  return <Badge bg={T.greenBg} color={T.greenText} border={T.greenBorder}>✅ Approved</Badge>;
                                })()}
                                {approvalMetaChips(row)}
                              </div>
                            )}
                          </div>
                          {/* Time */}
                          <div className="trx-col-time">
                            <div style={{ fontSize: 16, fontWeight: 900, color: T.text, lineHeight: 1 }}>{row.time || "-"}</div>
                            <div style={{ fontSize: 10.5, color: T.muted, marginTop: 3 }}>{fmtDate(row.date)}</div>
                          </div>
                          {/* Items */}
                          <div className="trx-col-items">
                            {isIn
                              ? <>
                                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4, flexWrap: "wrap" }}>
                                  <span style={{ fontSize: 12 }}>📦</span>
                                  <span style={{ fontSize: 12.5, fontWeight: 700, color: T.text }}>{row.itemName || "-"}</span>
                                  <span style={{ fontSize: 10.5, fontWeight: 800, color: T.greenText, background: T.greenBg, padding: "1px 8px", borderRadius: 5, border: `1px solid ${T.greenBorder}`, flexShrink: 0 }}>+{row.qty} {row.unit || "pcs"}</span>
                                </div>
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                  {row.poNumber && <span style={{ fontSize: 10, fontWeight: 700, color: T.navActiveText, background: T.navActive, padding: "2px 8px", borderRadius: 5, border: `1px solid ${T.navActiveBorder}` }}>PO: {row.poNumber}</span>}
                                  {row.doNumber && <span style={{ fontSize: 10, fontWeight: 700, color: T.muted, background: T.surface, padding: "2px 8px", borderRadius: 5, border: `1px solid ${T.border}` }}>DO: {row.doNumber}</span>}
                                  {row.buyPrice && <span style={{ fontSize: 10, color: T.greenText, fontWeight: 700 }}>💵 Buy {fmtMoney(row.buyPrice)} / {row.unit || "pcs"}</span>}
                                </div>
                              </>
                              : itemsArr.slice(0, 3).map((it: any, ii: number) => (
                                <div key={ii} style={{ display: "grid", gridTemplateColumns: "14px minmax(0,1fr) auto", alignItems: "center", columnGap: 8, marginBottom: 3 }}>
                                  <span style={{ fontSize: 11 }}>📦</span>
                                  <span style={{ fontSize: 12, fontWeight: 700, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>{it.itemName}</span>
                                  <span style={{ fontSize: 10, fontWeight: 800, color: T.navActiveText, background: T.navActive, padding: "1px 7px", borderRadius: 5, border: `1px solid ${T.navActiveBorder}`, flexShrink: 0 }}>×{it.qty} {it.unit || "pcs"}</span>
                                </div>
                              ))
                            }
                            {!isIn && itemsArr.length > 3 && <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>+{itemsArr.length - 3} item lainnya</div>}
                          </div>
                          {/* Jenis + Unit */}
                          <div className="trx-col-count" style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                              <span style={{ fontSize: 16, fontWeight: 900, color: T.text, lineHeight: 1 }}>{jenis}</span>
                              <span style={{ fontSize: 10.5, fontWeight: 600, color: T.muted }}>jenis</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                              <span style={{ fontSize: 16, fontWeight: 900, color: T.text, lineHeight: 1 }}>{totalUnits}</span>
                              <span style={{ fontSize: 10.5, fontWeight: 600, color: T.muted }}>unit</span>
                            </div>
                          </div>
                          {/* Total */}
                          <div className="trx-col-total" style={{ paddingRight: isAdmin ? 14 : 0 }}>
                            <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, marginBottom: 3, textTransform: "uppercase", letterSpacing: ".05em" }}>Total</div>
                            <div style={{ fontSize: 14, fontWeight: 900, color: accentColor }}>{fmtMoney(totalCost)}</div>
                          </div>
                          {/* Hapus */}
                          {isAdmin && (
                            <button
                              onClick={() => isIn ? deleteReceive(row.receiveId ?? row.id) : deleteTransaction(row.id)}
                              style={{ background: T.redBg, border: `1px solid ${T.redBorder}`, color: T.redText, borderRadius: 8, padding: "7px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" }}>
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
          {filteredAll.length > 0 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 20, flexWrap: "wrap" }}>
              <button onClick={() => setHistoryOutPage(p => Math.max(1, p - 1))} disabled={historyOutPage <= 1}
                style={{ padding: "8px 18px", borderRadius: 9, border: `1px solid ${T.border}`, background: T.surface, color: historyOutPage <= 1 ? T.muted : T.text, fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 12.5, fontWeight: 700, cursor: historyOutPage <= 1 ? "default" : "pointer", opacity: historyOutPage <= 1 ? 0.5 : 1, transition: "all .18s" }}>
                ‹ Sebelumnya
              </button>
              {Array.from({ length: allTotalPages }).map((_, i) => (
                <button key={i} onClick={() => setHistoryOutPage(i + 1)}
                  style={{ width: 38, height: 38, borderRadius: 9, border: `1px solid ${historyOutPage === i + 1 ? T.primary : T.border}`, background: historyOutPage === i + 1 ? T.primary : T.surface, color: historyOutPage === i + 1 ? "white" : T.muted, fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 13, fontWeight: 800, cursor: "pointer", transition: "all .18s" }}>
                  {i + 1}
                </button>
              ))}
              <button onClick={() => setHistoryOutPage(p => Math.min(allTotalPages, p + 1))} disabled={historyOutPage >= allTotalPages}
                style={{ padding: "8px 18px", borderRadius: 9, border: `1px solid ${T.border}`, background: T.surface, color: historyOutPage >= allTotalPages ? T.muted : T.text, fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 12.5, fontWeight: 700, cursor: historyOutPage >= allTotalPages ? "default" : "pointer", opacity: historyOutPage >= allTotalPages ? 0.5 : 1, transition: "all .18s" }}>
                Selanjutnya ›
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─ TAB PENGAMBILAN ─ */}
      {historyTab === "out" && (
        <div>
          {/* Stats 5 columns */}
          <div className="stat5-g">
            {(() => {
              const totalNilai = approvedOutTrx.reduce((acc, t) => acc + Number(t.totalCostOut ?? t.items.reduce((a: number, it: any) => a + (Number(it.qty || 0) * Number(it.averageCost ?? itemMap[Number(it.itemId)]?.averageCost ?? 0)), 0)), 0);
              return [
                { label: "Total Transaksi", sub: "pengambilan approved", val: approvedOutTrx.length, valStr: null, icon: "📋", dot: T.primary },
                { label: "Total Unit Keluar", sub: "unit total", val: totalOut, valStr: null, icon: "📦", dot: T.green },
                { label: "Item Berbeda", sub: "jenis barang", val: [...new Set(approvedOutTrx.flatMap(t => t.items.map((i: any) => i.itemId)))].length, valStr: null, icon: "🗂️", dot: T.primaryLight },
                { label: "Jumlah Pengambil", sub: "karyawan", val: [...new Set(approvedOutTrx.map(t => t.taker))].length, valStr: null, icon: "👥", dot: T.amber },
                { label: "Total Nilai", sub: "estimasi harga rata-rata", val: null, valStr: fmtMoney(totalNilai), icon: "Rp", dot: T.primary },
              ];
            })().map((s, i) => (
              <div key={i} className="stat-card" style={{ display: "flex", flexDirection: "column", gap: 0, padding: "16px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 400, background: dark ? "rgba(16,185,129,0.13)" : "rgba(16,185,129,0.09)", border: `1px solid ${T.navActiveBorder}`, flexShrink: 0, color: s.dot }}>{s.icon}</div>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, display: "inline-block" }} />
                </div>
                <div style={{ fontSize: 9, fontWeight: 800, color: T.muted, letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 4, lineHeight: 1.3 }}>{s.label}</div>
                <div className="stat-val" style={{ fontSize: "clamp(15px,3.5vw,28px)", fontWeight: 900, lineHeight: 1.2, color: s.dot, marginBottom: 4, wordBreak: "break-word", overflowWrap: "break-word" }}>{s.val !== null ? s.val : s.valStr}</div>
                <div style={{ fontSize: 10, color: T.muted, fontWeight: 500 }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Log Pengambilan */}
          <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 14 }}>Log Pengambilan</div>
          {pagedOut.map((t: any) => {
            const totalCostRow = Number(t.totalCostOut ?? t.items.reduce((acc: number, it: any) => { const avg = Number(it.averageCost ?? itemMap[Number(it.itemId)]?.averageCost ?? 0); return acc + (Number(it.qty || 0) * avg); }, 0));
            const totalUnits = t.items.reduce((a: number, i: any) => a + i.qty, 0);
            return (
              <div key={t.id} style={{ display: "flex", alignItems: "stretch", gap: 0, background: T.card, border: `1px solid ${T.border}`, borderLeft: `4px solid ${T.red}`, borderRadius: 14, marginBottom: 8, overflow: "hidden", boxShadow: T.shadowSm, transition: "box-shadow .2s" }}>
                {/* Avatar */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "14px 12px", gap: 5, minWidth: 70, flexShrink: 0 }}>
                  <div style={{ width: 48, height: 48, borderRadius: "50%", background: T.redBg, border: `2px solid ${T.red}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, lineHeight: 1 }}>↗</div>
                  <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: ".07em", color: T.red, textTransform: "uppercase" }}>KELUAR</span>
                </div>
                {/* Content */}
                <div className="trx-row-inner">
                  {/* Name + dept */}
                  <div className="trx-col-name">
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: T.text, lineHeight: 1.3 }}>{t.taker}</div>
                    <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{t.dept}</div>
                    <div style={{ fontSize: 10.5, color: T.muted, marginTop: 1 }}>Admin: {t.admin}</div>
                    <div style={{ marginTop: 4 }}>
                      {(() => {
                        const status = trxApprovalStatus(t);
                        if (status === "pending") return <Badge bg={T.amberBg} color={T.amberText} border={T.amberBorder}>⏳ Pending Approval</Badge>;
                        if (status === "rejected") return <Badge bg={T.redBg} color={T.redText} border={T.redBorder}>⛔ Rejected</Badge>;
                        return <Badge bg={T.greenBg} color={T.greenText} border={T.greenBorder}>✅ Approved</Badge>;
                      })()}
                      {approvalMetaChips(t)}
                    </div>
                  </div>
                  {/* Time */}
                  <div className="trx-col-time">
                    <div style={{ fontSize: 16, fontWeight: 900, color: T.text, lineHeight: 1 }}>{t.time || "-"}</div>
                    <div style={{ fontSize: 10.5, color: T.muted, marginTop: 3 }}>{fmtDate(t.date)}</div>
                  </div>
                  {/* Items */}
                  <div className="trx-col-items">
                    {t.items.slice(0, 3).map((it: any, ii: number) => (
                      <div key={ii} style={{ display: "grid", gridTemplateColumns: "14px minmax(0,1fr) auto", alignItems: "center", columnGap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 11 }}>📦</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>{it.itemName}</span>
                        <span style={{ fontSize: 10, fontWeight: 800, color: T.navActiveText, background: T.navActive, padding: "1px 7px", borderRadius: 5, border: `1px solid ${T.navActiveBorder}`, flexShrink: 0 }}>×{it.qty} {it.unit}</span>
                      </div>
                    ))}
                    {t.items.length > 3 && <div style={{ fontSize: 10, color: T.muted }}>+{t.items.length - 3} item lainnya</div>}
                  </div>
                  {/* Jenis + Unit */}
                  <div className="trx-col-count" style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                      <span style={{ fontSize: 16, fontWeight: 900, color: T.text, lineHeight: 1 }}>{t.items.length}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 600, color: T.muted }}>jenis</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                      <span style={{ fontSize: 16, fontWeight: 900, color: T.text, lineHeight: 1 }}>{totalUnits}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 600, color: T.muted }}>unit</span>
                    </div>
                  </div>
                  {/* Total */}
                  <div className="trx-col-total" style={{ paddingRight: isAdmin ? 14 : 0 }}>
                    <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, marginBottom: 3, textTransform: "uppercase", letterSpacing: ".05em" }}>Total</div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: T.red }}>{fmtMoney(totalCostRow)}</div>
                  </div>
                  {/* Hapus */}
                  {isAdmin && (
                    <button onClick={() => deleteTransaction(t.id)}
                      style={{ background: T.redBg, border: `1px solid ${T.redBorder}`, color: T.redText, borderRadius: 8, padding: "7px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" }}>
                      🗑 Hapus
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {/* Pagination */}
          {filteredOutByApproval.length > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11.5, color: T.muted, fontWeight: 600 }}>Menampilkan {(historyOutPage - 1) * historyPageSize + 1}-{Math.min(historyOutPage * historyPageSize, filteredOutByApproval.length)} dari {filteredOutByApproval.length} transaksi</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button onClick={() => setHistoryOutPage(p => Math.max(1, p - 1))} disabled={historyOutPage <= 1}
                  style={{ display: "flex", alignItems: "center", gap: 4, padding: "8px 16px", borderRadius: 9, border: `1px solid ${T.border}`, background: T.surface, color: historyOutPage <= 1 ? T.muted : T.text, fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 12.5, fontWeight: 700, cursor: historyOutPage <= 1 ? "default" : "pointer", opacity: historyOutPage <= 1 ? 0.5 : 1, transition: "all .18s" }}>
                  ‹ Prev
                </button>
                {Array.from({ length: outTotalPages }).map((_, i) => (
                  <button key={i} onClick={() => setHistoryOutPage(i + 1)}
                    style={{ width: 36, height: 36, borderRadius: 9, border: `1px solid ${historyOutPage === i + 1 ? T.primary : T.border}`, background: historyOutPage === i + 1 ? T.primary : T.surface, color: historyOutPage === i + 1 ? "white" : T.muted, fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 13, fontWeight: 800, cursor: "pointer", transition: "all .18s" }}>
                    {i + 1}
                  </button>
                ))}
                <button onClick={() => setHistoryOutPage(p => Math.min(outTotalPages, p + 1))} disabled={historyOutPage >= outTotalPages}
                  style={{ display: "flex", alignItems: "center", gap: 4, padding: "8px 16px", borderRadius: 9, border: `1px solid ${T.border}`, background: T.surface, color: historyOutPage >= outTotalPages ? T.muted : T.text, fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 12.5, fontWeight: 700, cursor: historyOutPage >= outTotalPages ? "default" : "pointer", opacity: historyOutPage >= outTotalPages ? 0.5 : 1, transition: "all .18s" }}>
                  Next ›
                </button>
              </div>
              <select value={historyPageSize} onChange={e => setHistoryPageSize(Number(e.target.value) || 6)}
                style={{ padding: "8px 12px", borderRadius: 9, border: `1px solid ${T.border}`, background: T.surface, color: T.text, fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer", outline: "none" }}>
                {[6, 10, 15, 20].map(n => <option key={n} value={n}>{n} / halaman</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      {/* ─ TAB PENERIMAAN ─ */}
      {historyTab === "in" && (
        <div>
          {/* Stats 5 columns */}
          <div className="stat5-g">
            {(() => {
              const totalNilaiIn = receives.reduce((acc, r) => {
                const it = itemMap[Number(r.itemId)];
                return acc + (Number(r.buyPrice ?? it?.lastPrice ?? 0) * Number(r.qty || 0));
              }, 0);
              return [
                { label: "Total Penerimaan", sub: "transaksi", val: receives.length, valStr: null, icon: "📥", dot: T.primary },
                { label: "Total Unit Masuk", sub: "unit", val: totalIn, valStr: null, icon: "📦", dot: T.green },
                { label: "Item Berbeda", sub: "jenis barang", val: [...new Set(receives.map(r => r.itemId))].length, valStr: null, icon: "🗂️", dot: T.primaryLight },
                { label: "Admin Terlibat", sub: "admin", val: [...new Set(receives.map(r => r.admin).filter(Boolean))].length, valStr: null, icon: "👥", dot: T.amber },
                { label: "Total Nilai", sub: "estimasi harga beli", val: null, valStr: fmtMoney(totalNilaiIn), icon: "Rp", dot: T.primary },
              ];
            })().map((s, i) => (
              <div key={i} className="stat-card" style={{ display: "flex", flexDirection: "column", padding: "16px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 400, background: dark ? "rgba(16,185,129,0.13)" : "rgba(16,185,129,0.09)", border: `1px solid ${T.navActiveBorder}`, flexShrink: 0, color: s.dot }}>{s.icon}</div>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, display: "inline-block" }} />
                </div>
                <div style={{ fontSize: 9, fontWeight: 800, color: T.muted, letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 4, lineHeight: 1.3 }}>{s.label}</div>
                <div className="stat-val" style={{ fontSize: "clamp(15px,3.5vw,28px)", fontWeight: 900, lineHeight: 1.2, color: s.dot, marginBottom: 4, wordBreak: "break-word", overflowWrap: "break-word" }}>{s.val !== null ? s.val : s.valStr}</div>
                <div style={{ fontSize: 10, color: T.muted, fontWeight: 500 }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {filteredIn.length === 0
            ? <div style={{ textAlign: "center", padding: "60px 0", color: T.muted }}><div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>Belum ada riwayat penerimaan</div>
            : pagedIn.map((r: any) => {
              const it = itemMap[Number(r.itemId)];
              const buyPrice = Number(r.buyPrice ?? it?.lastPrice ?? 0);
              const totalCostR = buyPrice * Number(r.qty || 0);
              return (
                <div key={r.id} style={{ display: "flex", alignItems: "stretch", gap: 0, background: T.card, border: `1px solid ${T.border}`, borderLeft: `4px solid ${T.green}`, borderRadius: 14, marginBottom: 8, overflow: "hidden", boxShadow: T.shadowSm, transition: "box-shadow .2s" }}>
                  {/* Avatar */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "14px 12px", gap: 5, minWidth: 70, flexShrink: 0 }}>
                    <div style={{ width: 48, height: 48, borderRadius: "50%", background: T.greenBg, border: `2px solid ${T.green}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, lineHeight: 1 }}>↙</div>
                    <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: ".07em", color: T.green, textTransform: "uppercase" }}>MASUK</span>
                  </div>
                  {/* Content */}
                  <div className="trx-row-inner">
                    {/* Name */}
                    <div className="trx-col-name">
                      <div style={{ fontSize: 13.5, fontWeight: 800, color: T.text, lineHeight: 1.3 }}>{r.itemName || "-"}</div>
                      <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>Admin: {r.admin || "-"}</div>
                    </div>
                    {/* Time */}
                    <div className="trx-col-time">
                      <div style={{ fontSize: 16, fontWeight: 900, color: T.text, lineHeight: 1 }}>{r.time || "-"}</div>
                      <div style={{ fontSize: 10.5, color: T.muted, marginTop: 3 }}>{fmtDate(r.date)}</div>
                    </div>
                    {/* Items */}
                    <div className="trx-col-items">
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12 }}>📦</span>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: T.text }}>{r.itemName || "-"}</span>
                        <span style={{ fontSize: 10.5, fontWeight: 800, color: T.greenText, background: T.greenBg, padding: "1px 8px", borderRadius: 5, border: `1px solid ${T.greenBorder}`, flexShrink: 0 }}>+{r.qty} {r.unit || "pcs"}</span>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {r.poNumber && <span style={{ fontSize: 10, fontWeight: 700, color: T.navActiveText, background: T.navActive, padding: "2px 8px", borderRadius: 5, border: `1px solid ${T.navActiveBorder}` }}>PO: {r.poNumber}</span>}
                        {r.doNumber && <span style={{ fontSize: 10, fontWeight: 700, color: T.muted, background: T.surface, padding: "2px 8px", borderRadius: 5, border: `1px solid ${T.border}` }}>DO: {r.doNumber}</span>}
                        {r.buyPrice && <span style={{ fontSize: 10, color: T.greenText, fontWeight: 700 }}>💵 Buy {fmtMoney(buyPrice)} / {r.unit || "pcs"}</span>}
                      </div>
                    </div>
                    {/* Jenis + Unit */}
                    <div className="trx-col-count" style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                        <span style={{ fontSize: 16, fontWeight: 900, color: T.text, lineHeight: 1 }}>1</span>
                        <span style={{ fontSize: 10.5, fontWeight: 600, color: T.muted }}>jenis</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                        <span style={{ fontSize: 16, fontWeight: 900, color: T.text, lineHeight: 1 }}>{Number(r.qty) || 0}</span>
                        <span style={{ fontSize: 10.5, fontWeight: 600, color: T.muted }}>unit</span>
                      </div>
                    </div>
                    {/* Total */}
                    <div className="trx-col-total" style={{ paddingRight: isAdmin ? 14 : 0 }}>
                      <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, marginBottom: 3, textTransform: "uppercase", letterSpacing: ".05em" }}>Total</div>
                      <div style={{ fontSize: 14, fontWeight: 900, color: T.green }}>{fmtMoney(totalCostR)}</div>
                    </div>
                    {/* Hapus */}
                    {isAdmin && (
                      <button onClick={() => deleteReceive(r.id)}
                        style={{ background: T.redBg, border: `1px solid ${T.redBorder}`, color: T.redText, borderRadius: 8, padding: "7px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" }}>
                        🗑 Hapus
                      </button>
                    )}
                    {r.hasAttachment && (
                      <button onClick={() => fetchReceiveAttachment(r.id)}
                        title="Lihat Lampiran"
                        style={{ background: T.navActive, border: `1px solid ${T.navActiveBorder}`, color: T.navActiveText, borderRadius: 8, padding: "7px 10px", fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                        📎
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          }

          {/* Pagination */}
          {filteredIn.length > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11.5, color: T.muted, fontWeight: 600 }}>Menampilkan {(historyInPage - 1) * historyPageSize + 1}-{Math.min(historyInPage * historyPageSize, filteredIn.length)} dari {filteredIn.length} transaksi</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button onClick={() => setHistoryInPage(p => Math.max(1, p - 1))} disabled={historyInPage <= 1}
                  style={{ padding: "8px 16px", borderRadius: 9, border: `1px solid ${T.border}`, background: T.surface, color: historyInPage <= 1 ? T.muted : T.text, fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 12.5, fontWeight: 700, cursor: historyInPage <= 1 ? "default" : "pointer", opacity: historyInPage <= 1 ? 0.5 : 1, transition: "all .18s" }}>
                  ← Prev
                </button>
                {Array.from({ length: inTotalPages }).map((_, i) => (
                  <button key={i} onClick={() => setHistoryInPage(i + 1)}
                    style={{ width: 36, height: 36, borderRadius: 9, border: `1px solid ${historyInPage === i + 1 ? T.primary : T.border}`, background: historyInPage === i + 1 ? T.primary : T.surface, color: historyInPage === i + 1 ? "white" : T.muted, fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 13, fontWeight: 800, cursor: "pointer", transition: "all .18s" }}>
                    {i + 1}
                  </button>
                ))}
                <button onClick={() => setHistoryInPage(p => Math.min(inTotalPages, p + 1))} disabled={historyInPage >= inTotalPages}
                  style={{ padding: "8px 16px", borderRadius: 9, border: `1px solid ${T.border}`, background: T.surface, color: historyInPage >= inTotalPages ? T.muted : T.text, fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 12.5, fontWeight: 700, cursor: historyInPage >= inTotalPages ? "default" : "pointer", opacity: historyInPage >= inTotalPages ? 0.5 : 1, transition: "all .18s" }}>
                  Next →
                </button>
              </div>
              <select value={historyPageSize} onChange={e => setHistoryPageSize(Number(e.target.value) || 6)}
                style={{ padding: "8px 12px", borderRadius: 9, border: `1px solid ${T.border}`, background: T.surface, color: T.text, fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer", outline: "none" }}>
                {[6, 10, 15, 20].map(n => <option key={n} value={n}>{n} / halaman</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      {historyTab === "audit" && isAdmin && (
        <div>
          <p style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, marginBottom: 16 }}>Audit log aktivitas sistem untuk admin/operator.</p>
          {/* Filter bar */}
          <div className="fbar">
            <div style={{ position: "relative", flexShrink: 0 }}>
              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: T.muted, pointerEvents: "none" }}>🔍</span>
              <input className="ifield" style={{ width: 190, paddingLeft: 32 }} placeholder="Filter actor username" value={auditActor} onChange={e => setAuditActor(e.target.value)} />
            </div>
            <select className="ifield" style={{ width: 190 }} value={auditAction} onChange={e => setAuditAction(e.target.value)}>
              <option value="">Semua action</option>
              {[
                "auth.login", "admin.resetDummy", "admin.backupExport", "admin.restoreBackup", "items.create", "items.update", "items.delete",
                "transactions.create", "transactions.pending", "transactions.approve", "transactions.reject", "transactions.delete", "receives.create", "receives.delete",
                "master.create", "master.delete",
              ].map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <span style={{ fontSize: 11.5, color: T.muted, fontWeight: 700, flexShrink: 0 }}>Dari</span>
            <input type="date" className="ifield" style={{ width: 160 }} value={auditFrom} onChange={e => setAuditFrom(e.target.value)} onClick={e => e.currentTarget.showPicker()} />
            <span style={{ fontSize: 11.5, color: T.muted, fontWeight: 700, flexShrink: 0 }}>Sampai</span>
            <input type="date" className="ifield" style={{ width: 160 }} value={auditTo} onChange={e => setAuditTo(e.target.value)} onClick={e => e.currentTarget.showPicker()} />
            <select className="ifield" style={{ width: 120 }} value={auditPageSize} onChange={e => setAuditPageSize(Number(e.target.value) || 8)}>
              {[8, 12, 20].map(n => <option key={n} value={n}>{n}/hal</option>)}
            </select>
            <BtnG style={{ fontSize: 11.5, padding: "7px 12px", flexShrink: 0 }} onClick={() => { setAuditActor(""); setAuditAction(""); setAuditFrom(""); setAuditTo(""); }}>↺ Reset</BtnG>
          </div>
          {/* Rows */}
          {auditRows.length === 0
            ? <div style={{ textAlign: "center", padding: "60px 0", color: T.muted }}><div style={{ fontSize: 36, marginBottom: 12 }}>🛡</div>Belum ada audit log</div>
            : (
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden", minWidth: 0 }}>
                {auditRows.map((a, ri) => {
                  const actionIconMap: Record<string, string> = {
                    "auth.login": "🔑", "auth.logout": "🚪",
                    "items.create": "📦", "items.update": "✏️", "items.delete": "🗑️",
                    "transactions.create": "↗️", "transactions.pending": "⏳", "transactions.approve": "✅", "transactions.reject": "⛔", "transactions.delete": "🗑️",
                    "receives.create": "🚚", "receives.delete": "🗑️",
                    "admin.resetDummy": "⚙️", "admin.backupExport": "💾", "admin.restoreBackup": "♻️",
                    "master.create": "🏷️", "master.delete": "🗑️",
                  };
                  const actionColorMap: Record<string, string> = {
                    "auth.login": T.green, "auth.logout": T.muted,
                    "items.create": "#0ea5e9", "items.update": "#6366f1", "items.delete": T.red,
                    "transactions.create": "#8b5cf6", "transactions.pending": T.amber, "transactions.approve": T.green, "transactions.reject": T.red, "transactions.delete": T.red,
                    "receives.create": T.amber, "receives.delete": T.red,
                    "admin.resetDummy": T.red, "admin.backupExport": "#f97316", "admin.restoreBackup": "#14b8a6",
                    "master.create": "#ec4899", "master.delete": T.red,
                  };
                  const icon = actionIconMap[a.action] || "📋";
                  const color = actionColorMap[a.action] || T.muted;
                  const dt = new Date(a.created_at || a.createdAt);
                  const dateStr = dt.getTime() ? `${dt.getDate()}/${dt.getMonth() + 1}/${dt.getFullYear()}, ${dt.getHours().toString().padStart(2, "0")}.${dt.getMinutes().toString().padStart(2, "0")}.${dt.getSeconds().toString().padStart(2, "0")}` : "-";
                  return (
                    <div key={a.id} className="audit-row"
                      onMouseEnter={e => { e.currentTarget.style.background = dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                      {/* Icon circle */}
                      <div style={{ width: 46, height: 46, borderRadius: "50%", background: dark ? `${color}22` : `${color}18`, border: `1.5px solid ${color}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                        {icon}
                      </div>
                      {/* Action + badges */}
                      <div className="audit-col-action">
                        <div style={{ fontSize: 13.5, fontWeight: 800, color: T.text, marginBottom: 6 }}>{a.action}</div>
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: T.navActiveText, background: T.navActive, padding: "2px 9px", borderRadius: 5, border: `1px solid ${T.navActiveBorder}` }}>Actor: {a.actor?.username || "-"}</span>
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: T.muted, background: T.surface, padding: "2px 9px", borderRadius: 5, border: `1px solid ${T.border}` }}>Role: {a.actor?.role || "-"}</span>
                        </div>
                      </div>
                      {/* Target */}
                      <div className="audit-col-target">
                        <div style={{ fontSize: 9.5, fontWeight: 800, color: T.muted, textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 4 }}>Target</div>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: T.text }}>{a.target || "-"}</div>
                      </div>
                      {/* Date */}
                      <div className="audit-col-date">
                        <span>📅</span><span>{dateStr}</span>
                      </div>
                      {/* ID badge */}
                      <div className="audit-col-id" style={{ background: T.amberBg, border: `1px solid ${T.amberBorder}`, color: T.amberText, borderRadius: 8, padding: "4px 12px", fontSize: 12, fontWeight: 800 }}>
                        #{a.id}
                      </div>
                      {/* Arrow btn */}
                      <div className="audit-col-arrow" style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${T.border}`, background: T.surface, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.muted, fontSize: 14, flexShrink: 0, transition: "all .15s" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = color; (e.currentTarget as HTMLDivElement).style.color = color; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = T.border; (e.currentTarget as HTMLDivElement).style.color = T.muted; }}>
                        →
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          }
          {/* Pagination */}
          {auditRows.length > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11.5, color: T.muted, fontWeight: 600 }}>Menampilkan {(auditPage - 1) * auditPageSize + 1} – {Math.min(auditPage * auditPageSize, auditTotal)} dari {auditTotal} data</span>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                {/* Prev */}
                <button onClick={() => setAuditPage(p => Math.max(1, p - 1))} disabled={auditPage <= 1}
                  style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${T.border}`, background: T.surface, color: auditPage <= 1 ? T.muted : T.text, fontSize: 14, fontWeight: 700, cursor: auditPage <= 1 ? "default" : "pointer", opacity: auditPage <= 1 ? 0.4 : 1, transition: "all .18s" }}>
                  ‹
                </button>
                {/* Numbered pages with ellipsis */}
                {(() => {
                  const pages: number[] = [];
                  for (let i = 1; i <= auditTotalPages; i++) {
                    if (i === 1 || i === auditTotalPages || Math.abs(i - auditPage) <= 1) pages.push(i);
                  }
                  const els: React.ReactNode[] = [];
                  let prev = -1;
                  pages.forEach(p => {
                    if (prev !== -1 && p - prev > 1) els.push(<span key={`e${p}`} style={{ width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: T.muted }}>…</span>);
                    els.push(
                      <button key={p} onClick={() => setAuditPage(p)}
                        style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${auditPage === p ? T.primary : T.border}`, background: auditPage === p ? T.primary : T.surface, color: auditPage === p ? "white" : T.muted, fontSize: 13, fontWeight: 800, cursor: "pointer", transition: "all .18s" }}>
                        {p}
                      </button>
                    );
                    prev = p;
                  });
                  return els;
                })()}
                {/* Next */}
                <button onClick={() => setAuditPage(p => Math.min(auditTotalPages, p + 1))} disabled={auditPage >= auditTotalPages}
                  style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${T.border}`, background: T.surface, color: auditPage >= auditTotalPages ? T.muted : T.text, fontSize: 14, fontWeight: 700, cursor: auditPage >= auditTotalPages ? "default" : "pointer", opacity: auditPage >= auditTotalPages ? 0.4 : 1, transition: "all .18s" }}>
                  ›
                </button>
              </div>
              <select value={auditPageSize} onChange={e => setAuditPageSize(Number(e.target.value) || 8)}
                style={{ padding: "8px 12px", borderRadius: 9, border: `1px solid ${T.border}`, background: T.surface, color: T.text, fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer", outline: "none" }}>
                {[8, 12, 20].map(n => <option key={n} value={n}>{n}/hal</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      <TransactionModal open={showModal} onClose={() => setShowModal(false)} />
      <AddStockModal open={showAdd} onClose={() => setShowAdd(false)} />
      </>)}
    </div>
  );
}
