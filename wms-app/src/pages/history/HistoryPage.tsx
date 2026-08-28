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
  const { dark, user, trx, receives, returns, deliveryNotes, items, setToast, withLoading, fetchAll, dataReady, deleteReturn } = useStore();
  const T = getT(dark);

  const isAdmin = (user?.role || "").toLowerCase() === "admin";
  const canManage = isAdmin || (user?.role || "").toLowerCase() === "operator";
  const itemMap = Object.fromEntries(items.map(i => [Number(i.id), i]));

  const [historyTab, setHistoryTab] = useState("all");
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  const [historyPageSize, setHistoryPageSize] = useState(6);
  const [historyOutPage, setHistoryOutPage] = useState(1);
  const [historyInPage, setHistoryInPage] = useState(1);
  const [historyReturPage, setHistoryReturPage] = useState(1);

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const approvedOutTrx = trx.filter(isApprovedOutTrx);

  const allHistory = [
    ...trx.map(t => ({ ...t, type: "out", _ts: t.date + "T" + (t.time || "00:00") })),
    ...receives.map(r => ({ ...r, type: "in", _ts: r.date + "T" + (r.time || "00:00") })),
    ...returns.map(r => {
      const it = itemMap[Number(r.itemId)];
      return { ...r, type: "retur", taker: r.employee, itemName: it?.name || r.itemName || `Item #${r.itemId}`, unit: it?.unit || "pcs", _ts: r.date + "T" + (r.time || "00:00") };
    })
  ].sort((a, b) => b._ts.localeCompare(a._ts));

  const filterFn = (item: any) => {
    if (historyFrom && item.date < historyFrom) return false;
    if (historyTo && item.date > historyTo) return false;
    if (historyQuery) {
      const q = historyQuery.toLowerCase();
      const fields = [item.taker, item.employee, item.admin, item.poNumber, item.doNumber, item.workOrder, item.note, item.reason, item.approvalReason].filter(Boolean).map(String);
      const itemsMatch = toSafeRows(item.items).some(i => (i.itemName || "").toLowerCase().includes(q));
      if (!fields.some(f => f.toLowerCase().includes(q)) && !itemsMatch && !(item.itemName || "").toLowerCase().includes(q)) return false;
    }
    return true;
  };

  const filteredAll = allHistory.filter(filterFn);
  const filteredOut = trx.filter(filterFn);
  const filteredIn = receives.filter(filterFn);
  const filteredReturns = returns.map((r: any) => {
    const it = itemMap[Number(r.itemId)];
    return { ...r, taker: r.employee, itemName: it?.name || r.itemName || `Item #${r.itemId}`, unit: it?.unit || "pcs" };
  }).filter(filterFn);

  const filteredOutByApproval = filteredOut;

  const outTotalPages = Math.ceil(filteredOutByApproval.length / Math.max(1, historyPageSize));
  const inTotalPages = Math.ceil(filteredIn.length / Math.max(1, historyPageSize));
  const returTotalPages = Math.ceil(filteredReturns.length / Math.max(1, historyPageSize));
  const allTotalPages = Math.ceil(filteredAll.length / Math.max(1, historyPageSize));

  const pagedOut = filteredOutByApproval.slice((historyOutPage - 1) * historyPageSize, historyOutPage * historyPageSize);
  const pagedIn = filteredIn.slice((historyInPage - 1) * historyPageSize, historyInPage * historyPageSize);
  const pagedReturns = filteredReturns.slice((historyReturPage - 1) * historyPageSize, historyReturPage * historyPageSize);
  const pagedAll = filteredAll.slice((historyOutPage - 1) * historyPageSize, historyOutPage * historyPageSize);

  const totalOut = approvedOutTrx.reduce((a, t) => a + toSafeRows(t.items).reduce((b: number, i: any) => b + Number(i.qty || 0), 0), 0);
  const totalIn = receives.reduce((a, r) => a + Number(r.qty || 0), 0);



  const deleteTransaction = async (id: number) => {
    if (!isAdmin) { setToast("Hanya admin yang boleh menghapus transaksi", "err"); return; }
    if (!window.confirm("Hapus transaksi ini? Stok barang akan dikembalikan ke gudang.")) return;
    await withLoading(async () => {
      try {
        const { supabase } = await import("../../lib/supabase");
        
        // 1. Ambil data transaksi terlebih dahulu
        const trxData = trx.find(t => t.id === id);
        
        // 2. Selalu kembalikan stok barang ke gudang jika transaksi dihapus
        if (trxData && Array.isArray(trxData.items)) {
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
        setToast("Transaksi dihapus & stok barang telah bertambah kembali ✓");
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



  const dlPdf = (fileName: string, title: string, headers: any[], rows: any[]) => {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.text(title, 40, 32);
    autoTable(doc, { startY: 46, head: [headers.map(h => String(h ?? ""))], body: rows.map(r => r.map((c: any) => String(c ?? ""))), styles: { font: "helvetica", fontSize: 8, cellPadding: 4, overflow: "linebreak" }, headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: "bold" }, margin: { left: 40, right: 40, top: 40, bottom: 30 }, theme: "grid" });
    doc.save(fileName);
  };

  const exportTransactionsExcel = () => {
    const rows = [
      ["Warehouse Management System"], ["Laporan Riwayat Pengambilan"], [],
      ["ID", "Tanggal", "Waktu", "Pengambil", "Section", "Project", "Admin", "Item", "Qty", "Unit", "Keterangan"],
      ...filteredOutByApproval.flatMap((t: any) => toSafeRows(t.items).map((it: any) => [
        csvText(t.id), fmtDateExcel(t.date), t.time, t.taker, t.dept, t.workOrder || "", t.admin || "", it.itemName, it.qty, it.unit, t.note || ""
      ]))
    ];
    const csv = "\uFEFF" + rows.map(r => r.map(v => typeof v === "string" ? csvEscape(v) : v).join(",")).join("\n");
    triggerDownload(`pengambilan-${todayStr()}.csv`, csv, "text/csv;charset=utf-8;");
    setToast("Export Excel (CSV) pengambilan berhasil");
  };

  const exportTransactionsPdf = () => {
    const rows = filteredOutByApproval.flatMap((t: any) => toSafeRows(t.items).map((it: any) => [t.id, t.date, t.time, t.taker, t.dept, t.workOrder || "", t.admin || "", it.itemName, `${it.qty} ${it.unit}`, t.note || ""]));
    dlPdf(`pengambilan-${todayStr()}.pdf`, "Riwayat Pengambilan", ["ID", "Tanggal", "Waktu", "Pengambil", "Section", "Project", "Admin", "Item", "Qty", "Ket"], rows);
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

  const exportReturnsExcel = () => {
    const rows = [
      ["Warehouse Management System"], ["Laporan Retur Barang"], [],
      ["ID", "Tanggal", "Waktu", "Karyawan", "Item", "Qty", "Satuan", "Alasan", "Catatan", "Status"],
      ...filteredReturns.map((r: any) => [
        csvText(r.id), fmtDateExcel(r.date), r.time || "", r.employee,
        r.itemName, r.qty, r.unit || "pcs", r.reason, r.note || "", r.status || "Menunggu"
      ])
    ];
    const csv = "\uFEFF" + rows.map(r => r.map(v => typeof v === "string" ? csvEscape(v) : v).join(",")).join("\n");
    triggerDownload(`retur-${todayStr()}.csv`, csv, "text/csv;charset=utf-8;");
    setToast("Export Excel (CSV) retur berhasil ✓");
  };

  const exportReturnsPdf = () => {
    const rows = filteredReturns.map((r: any) => [r.id, r.date, r.time || "", r.employee, r.itemName, `${r.qty} ${r.unit || "pcs"}`, r.reason, r.note || "", r.status || "Menunggu"]);
    dlPdf(`retur-${todayStr()}.pdf`, "Laporan Retur Barang", ["ID", "Tanggal", "Waktu", "Karyawan", "Item", "Qty", "Alasan", "Catatan", "Status"], rows);
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
            const subTabs = [
              { id: "all", label: `Semua (${allHistory.length})` },
              { id: "out", label: `Pengambilan (${trx.length})` },
              { id: "in", label: `Penerimaan (${receives.length})` },
              { id: "retur", label: `Retur (${returns.length})` }
            ];
            return subTabs.map(tb => (
              <button key={tb.id} onClick={() => setHistoryTab(tb.id)} style={{ padding: "8px 14px", borderRadius: 8, border: "none", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all .2s", background: historyTab === tb.id ? T.primary : "transparent", color: historyTab === tb.id ? "white" : T.muted, whiteSpace: "nowrap", flexShrink: 0 }}>{tb.label}</button>
            ));
          })()}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {isAdmin && historyTab === "all" && (
            <>
              <BtnG onClick={exportAllReportsExcel} style={{ fontWeight: 600, padding: "8px 14px", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                {EXCEL_ICON} Excel
              </BtnG>
              <BtnG onClick={exportTransactionsPdf} style={{ fontWeight: 600, padding: "8px 14px", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                {PDF_ICON} PDF
              </BtnG>
            </>
          )}
          {isAdmin && historyTab !== "all" && (
            <BtnG onClick={historyTab === "in" ? exportReceivesExcel : historyTab === "retur" ? exportReturnsExcel : exportTransactionsExcel} style={{ fontWeight: 700, padding: "8px 14px", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>{EXCEL_ICON}Excel</BtnG>
          )}
          {isAdmin && historyTab !== "all" && (
            <BtnG onClick={historyTab === "in" ? exportReceivesPdf : historyTab === "retur" ? exportReturnsPdf : exportTransactionsPdf} style={{ fontWeight: 700, padding: "8px 14px", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>{PDF_ICON}PDF</BtnG>
          )}
          
        </div>
      </div>

        <div className="fbar" style={{ marginBottom: 14 }}>
          <input className="ifield" style={{ width: 220 }} placeholder="Cari nama/item/admin/PO/DO..." value={historyQuery} onChange={e => setHistoryQuery(e.target.value)} />
          <span style={{ fontSize: 11.5, color: T.muted, fontWeight: 700 }}>Dari</span>
          <input type="date" className="ifield" style={{ width: 160 }} value={historyFrom} onChange={e => setHistoryFrom(e.target.value)} onClick={e => e.currentTarget.showPicker()} />
          <span style={{ fontSize: 11.5, color: T.muted, fontWeight: 700 }}>Sampai</span>
          <input type="date" className="ifield" style={{ width: 160 }} value={historyTo} onChange={e => setHistoryTo(e.target.value)} onClick={e => e.currentTarget.showPicker()} />
          <select className="ifield" style={{ width: 120 }} value={historyPageSize} onChange={e => setHistoryPageSize(Number(e.target.value) || 6)}>
            {[6, 10, 15, 20].map(n => <option key={n} value={n}>{n}/hal</option>)}
          </select>
          <BtnG style={{ fontSize: 11.5, padding: "7px 12px" }} onClick={() => { setHistoryQuery(""); setHistoryFrom(""); setHistoryTo(""); }}>✕ Reset</BtnG>
          <span style={{ marginLeft: "auto", fontSize: 11.5, color: T.muted, fontWeight: 600, whiteSpace: "nowrap" }}>
            {historyTab === "all" ? filteredAll.length : historyTab === "out" ? filteredOutByApproval.length : historyTab === "retur" ? filteredReturns.length : filteredIn.length} transaksi ditemukan
          </span>
        </div>



      {/* ─ TAB SEMUA ─ */}
      {historyTab === "all" && (
        <div>
          {filteredAll.length === 0
            ? <div style={{ textAlign: "center", padding: "60px 0", color: T.muted }}>Belum ada riwayat transaksi</div>
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
                    <span style={{ fontSize: 12, fontWeight: 700, color: T.primary, letterSpacing: ".1em" }}>{fmtDG(date)}</span>
                  </div>
                  {grouped[date].map((row: any) => {
                    const isRetur = String(row.type || "").toLowerCase() === "retur";
                    const isIn = String(row.type || "").toLowerCase() === "in";
                    const isDiterima = row.status === "Diterima";
                    const accentColor = isRetur ? T.amber : isIn ? T.green : T.red;
                    const accentBg = isRetur ? T.amberBg : isIn ? T.greenBg : T.redBg;
                    const itemsArr: any[] = row.items || [];
                    const totalUnits = isRetur ? (Number(row.qty) || 0) : isIn ? (Number(row.qty) || 0) : itemsArr.reduce((a: number, i: any) => a + Number(i.qty || 0), 0);
                    const jenis = (isRetur || isIn) ? 1 : itemsArr.length;
                    const totalCost = isRetur
                      ? (Number(row.qty) || 0) * Number(itemMap[Number(row.itemId)]?.averageCost ?? 0)
                      : isIn
                      ? (Number(row.qty) || 0) * Number(row.buyPrice ?? itemMap[Number(row.itemId)]?.lastPrice ?? itemMap[Number(row.itemId)]?.averageCost ?? 0)
                      : itemsArr.reduce((acc: number, it: any) => {
                          const avg = Number(it.averageCost ?? itemMap[Number(it.itemId)]?.averageCost ?? 0);
                          return acc + (Number(it.qty || 0) * avg);
                        }, 0);
                    return (
                      <div key={`${row.type || "x"}-${row.id}`} style={{ display: "flex", alignItems: "stretch", gap: 0, background: T.card, border: `1px solid ${T.border}`, borderLeft: `4px solid ${accentColor}`, borderRadius: 14, marginBottom: 8, overflow: "hidden", transition: "box-shadow .2s", boxShadow: T.shadowSm }}>
                        {/* Type */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "0 10px", flexShrink: 0, minWidth: 44 }}>
                          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".07em", color: accentColor, textTransform: "uppercase", writingMode: "vertical-rl", transform: "rotate(180deg)" }}>{isRetur ? "RETUR" : isIn ? "MASUK" : "KELUAR"}</span>
                        </div>
                        {/* Content */}
                        <div className="trx-row-inner">
                          {/* Name + dept */}
                          <div className="trx-col-name">
                            <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text, lineHeight: 1.3 }}>{isRetur ? (row.employee || row.taker || "-") : isIn ? (row.itemName || itemsArr[0]?.itemName || "-") : (row.taker || "-")}</div>
                            <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{isRetur ? "Retur Karyawan" : isIn ? `Admin: ${row.admin || "-"}` : (row.dept || "-")}</div>
                            {!isIn && !isRetur && <div style={{ fontSize: 10.5, color: T.muted, marginTop: 1 }}>Admin: {row.admin || "-"}</div>}
                            {isRetur && (
                              <div style={{ marginTop: 4 }}>
                                <Badge bg={isDiterima ? T.greenBg : T.amberBg} color={isDiterima ? T.greenText : T.amberText} border={isDiterima ? T.greenBorder : T.amberBorder}>
                                  {isDiterima ? "Diterima" : "Menunggu"}
                                </Badge>
                              </div>
                            )}

                          </div>
                          {/* Time */}
                          <div className="trx-col-time">
                            <div style={{ fontSize: 15, fontWeight: 700, color: T.text, lineHeight: 1 }}>{row.time || "-"}</div>
                            <div style={{ fontSize: 10.5, color: T.muted, marginTop: 3 }}>{fmtDate(row.date)}</div>
                          </div>
                          {/* Items */}
                          <div className="trx-col-items">
                            {isRetur
                              ? <>
                                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4, flexWrap: "wrap" }}>
                                  <span style={{ fontSize: 12.5, fontWeight: 700, color: T.text }}>{row.itemName || "-"}</span>
                                  <span style={{ fontSize: 10.5, fontWeight: 800, color: T.amberText, background: T.amberBg, padding: "1px 8px", borderRadius: 5, border: `1px solid ${T.amberBorder}`, flexShrink: 0 }}>+{row.qty} {row.unit || "pcs"}</span>
                                </div>
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                  {row.reason && <span style={{ fontSize: 10, fontWeight: 600, color: T.navActiveText, background: T.navActive, padding: "2px 8px", borderRadius: 5, border: `1px solid ${T.navActiveBorder}` }}>{row.reason}</span>}
                                  {row.note && <span style={{ fontSize: 10, fontWeight: 600, color: T.muted, background: T.surface, padding: "2px 8px", borderRadius: 5, border: `1px solid ${T.border}` }}>{row.note}</span>}
                                </div>
                              </>
                              : isIn
                              ? <>
                                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4, flexWrap: "wrap" }}>
                                  <span style={{ fontSize: 12.5, fontWeight: 700, color: T.text }}>{row.itemName || "-"}</span>
                                  <span style={{ fontSize: 10.5, fontWeight: 800, color: T.greenText, background: T.greenBg, padding: "1px 8px", borderRadius: 5, border: `1px solid ${T.greenBorder}`, flexShrink: 0 }}>+{row.qty} {row.unit || "pcs"}</span>
                                </div>
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                  {row.poNumber && <span style={{ fontSize: 10, fontWeight: 600, color: T.navActiveText, background: T.navActive, padding: "2px 8px", borderRadius: 5, border: `1px solid ${T.navActiveBorder}` }}>PO: {row.poNumber}</span>}
                                  {row.doNumber && <span style={{ fontSize: 10, fontWeight: 600, color: T.muted, background: T.surface, padding: "2px 8px", borderRadius: 5, border: `1px solid ${T.border}` }}>DO: {row.doNumber}</span>}
                                  {row.buyPrice && <span style={{ fontSize: 10, color: T.greenText, fontWeight: 600 }}>Buy {fmtMoney(row.buyPrice)} / {row.unit || "pcs"}</span>}
                                </div>
                              </>
                              : itemsArr.slice(0, 3).map((it: any, ii: number) => (
                                <div key={ii} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", alignItems: "center", columnGap: 8, marginBottom: 3 }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: T.text, lineHeight: 1.35 }} title={it.itemName}>{it.itemName}</span>
                                  <span style={{ fontSize: 10, fontWeight: 800, color: T.navActiveText, background: T.navActive, padding: "1px 7px", borderRadius: 5, border: `1px solid ${T.navActiveBorder}`, flexShrink: 0 }}>×{it.qty} {it.unit || "pcs"}</span>
                                </div>
                              ))
                            }
                            {!isIn && !isRetur && itemsArr.length > 3 && <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>+{itemsArr.length - 3} item lainnya</div>}
                          </div>
                          {/* Jenis + Unit */}
                          <div className="trx-col-count" style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                              <span style={{ fontSize: 15, fontWeight: 700, color: T.text, lineHeight: 1 }}>{jenis}</span>
                              <span style={{ fontSize: 10.5, fontWeight: 600, color: T.muted }}>jenis</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                              <span style={{ fontSize: 15, fontWeight: 700, color: T.text, lineHeight: 1 }}>{totalUnits}</span>
                              <span style={{ fontSize: 10.5, fontWeight: 600, color: T.muted }}>unit</span>
                            </div>
                          </div>
                          {/* Total */}
                          <div className="trx-col-total" style={{ paddingRight: isAdmin ? 14 : 0 }}>
                            <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, marginBottom: 3, textTransform: "uppercase", letterSpacing: ".05em" }}>Total</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: accentColor }}>{fmtMoney(totalCost)}</div>
                          </div>
                          {/* Hapus */}
                          {isAdmin && (
                            <button
                              onClick={() => isRetur ? deleteReturn(row.id) : isIn ? deleteReceive(row.receiveId ?? row.id) : deleteTransaction(row.id)}
                              style={{ background: T.redBg, border: `1px solid ${T.redBorder}`, color: T.redText, borderRadius: 8, padding: "7px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" }}>
                              Hapus
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
                { label: "Total Transaksi", sub: "pengambilan approved", val: approvedOutTrx.length, valStr: null, icon: "", dot: T.primary },
                { label: "Total Unit Keluar", sub: "unit total", val: totalOut, valStr: null, icon: "", dot: T.green },
                { label: "Item Berbeda", sub: "jenis barang", val: [...new Set(approvedOutTrx.flatMap(t => t.items.map((i: any) => i.itemId)))].length, valStr: null, icon: "🗂️", dot: T.primaryLight },
                { label: "Jumlah Pengambil", sub: "karyawan", val: [...new Set(approvedOutTrx.map(t => t.taker))].length, valStr: null, icon: "", dot: T.amber },
                { label: "Total Nilai", sub: "estimasi harga rata-rata", val: null, valStr: fmtMoney(totalNilai), icon: "Rp", dot: T.primary },
              ];
            })().map((s, i) => (
              <div key={i} className="stat-card" style={{ display: "flex", flexDirection: "column", gap: 0, padding: "16px 14px" }}>
                <div style={{ marginBottom: 10 }}></div>
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
                {/* Type */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "0 10px", flexShrink: 0, minWidth: 44 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".07em", color: T.red, textTransform: "uppercase", writingMode: "vertical-rl", transform: "rotate(180deg)" }}>KELUAR</span>
                </div>
                {/* Content */}
                <div className="trx-row-inner">
                  {/* Name + dept */}
                  <div className="trx-col-name">
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: T.text, lineHeight: 1.3 }}>{t.taker}</div>
                    <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{t.dept}</div>
                    <div style={{ fontSize: 10.5, color: T.muted, marginTop: 1 }}>Admin: {t.admin}</div>

                  </div>
                  {/* Time */}
                  <div className="trx-col-time">
                    <div style={{ fontSize: 16, fontWeight: 900, color: T.text, lineHeight: 1 }}>{t.time || "-"}</div>
                    <div style={{ fontSize: 10.5, color: T.muted, marginTop: 3 }}>{fmtDate(t.date)}</div>
                  </div>
                  {/* Items */}
                  <div className="trx-col-items">
                    {t.items.slice(0, 3).map((it: any, ii: number) => (
                      <div key={ii} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", alignItems: "center", columnGap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: T.text, lineHeight: 1.35 }} title={it.itemName}>{it.itemName}</span>
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
                      Hapus
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
                { label: "Total Penerimaan", sub: "transaksi", val: receives.length, valStr: null, icon: "", dot: T.primary },
                { label: "Total Unit Masuk", sub: "unit", val: totalIn, valStr: null, icon: "", dot: T.green },
                { label: "Item Berbeda", sub: "jenis barang", val: [...new Set(receives.map(r => r.itemId))].length, valStr: null, icon: "🗂️", dot: T.primaryLight },
                { label: "Admin Terlibat", sub: "admin", val: [...new Set(receives.map(r => r.admin).filter(Boolean))].length, valStr: null, icon: "", dot: T.amber },
                { label: "Total Nilai", sub: "estimasi harga beli", val: null, valStr: fmtMoney(totalNilaiIn), icon: "Rp", dot: T.primary },
              ];
            })().map((s, i) => (
              <div key={i} className="stat-card" style={{ display: "flex", flexDirection: "column", padding: "16px 14px" }}>
                <div style={{ marginBottom: 10 }}></div>
                <div style={{ fontSize: 9, fontWeight: 800, color: T.muted, letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 4, lineHeight: 1.3 }}>{s.label}</div>
                <div className="stat-val" style={{ fontSize: "clamp(15px,3.5vw,28px)", fontWeight: 900, lineHeight: 1.2, color: s.dot, marginBottom: 4, wordBreak: "break-word", overflowWrap: "break-word" }}>{s.val !== null ? s.val : s.valStr}</div>
                <div style={{ fontSize: 10, color: T.muted, fontWeight: 500 }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {filteredIn.length === 0
            ? <div style={{ textAlign: "center", padding: "60px 0", color: T.muted }}>Belum ada riwayat penerimaan</div>
            : pagedIn.map((r: any) => {
              const it = itemMap[Number(r.itemId)];
              const buyPrice = Number(r.buyPrice ?? it?.lastPrice ?? 0);
              const totalCostR = buyPrice * Number(r.qty || 0);
              return (
                <div key={r.id} style={{ display: "flex", alignItems: "stretch", gap: 0, background: T.card, border: `1px solid ${T.border}`, borderLeft: `4px solid ${T.green}`, borderRadius: 14, marginBottom: 8, overflow: "hidden", boxShadow: T.shadowSm, transition: "box-shadow .2s" }}>
                  {/* Type */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "0 10px", flexShrink: 0, minWidth: 44 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".07em", color: T.green, textTransform: "uppercase", writingMode: "vertical-rl", transform: "rotate(180deg)" }}>MASUK</span>
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
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: T.text }}>{r.itemName || "-"}</span>
                        <span style={{ fontSize: 10.5, fontWeight: 800, color: T.greenText, background: T.greenBg, padding: "1px 8px", borderRadius: 5, border: `1px solid ${T.greenBorder}`, flexShrink: 0 }}>+{r.qty} {r.unit || "pcs"}</span>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {r.poNumber && <span style={{ fontSize: 10, fontWeight: 700, color: T.navActiveText, background: T.navActive, padding: "2px 8px", borderRadius: 5, border: `1px solid ${T.navActiveBorder}` }}>PO: {r.poNumber}</span>}
                        {r.doNumber && <span style={{ fontSize: 10, fontWeight: 700, color: T.muted, background: T.surface, padding: "2px 8px", borderRadius: 5, border: `1px solid ${T.border}` }}>DO: {r.doNumber}</span>}
                        {r.buyPrice && <span style={{ fontSize: 10, color: T.greenText, fontWeight: 700 }}>Buy {fmtMoney(buyPrice)} / {r.unit || "pcs"}</span>}
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
                        Hapus
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

      {/* ─ TAB RETUR BARANG ─ */}
      {historyTab === "retur" && (
        <div>
          {/* Stats 2 columns */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 18 }}>
            {(() => {
              const totalUnitRetur = returns.reduce((acc, r) => acc + Number(r.qty || 0), 0);
              return [
                { label: "Total Retur", sub: "catatan retur", val: returns.length, icon: "", dot: T.primary },
                { label: "Unit Dikembalikan", sub: "unit barang", val: totalUnitRetur, icon: "", dot: T.green },
              ];
            })().map((s, i) => (
              <div key={i} className="stat-card" style={{ display: "flex", flexDirection: "column", padding: "16px 14px" }}>
                <div style={{ marginBottom: 10 }}></div>
                <div style={{ fontSize: 9, fontWeight: 800, color: T.muted, letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 4, lineHeight: 1.3 }}>{s.label}</div>
                <div className="stat-val" style={{ fontSize: "clamp(15px,3.5vw,28px)", fontWeight: 900, lineHeight: 1.2, color: s.dot, marginBottom: 4 }}>{s.val}</div>
                <div style={{ fontSize: 10, color: T.muted, fontWeight: 500 }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {filteredReturns.length === 0
            ? <div style={{ textAlign: "center", padding: "60px 0", color: T.muted }}>Belum ada riwayat retur barang</div>
            : pagedReturns.map((r: any) => {
              return (
                <div key={r.id} style={{ display: "flex", alignItems: "stretch", gap: 0, background: T.card, border: `1px solid ${T.border}`, borderLeft: `4px solid ${T.green}`, borderRadius: 14, marginBottom: 8, overflow: "hidden", boxShadow: T.shadowSm, transition: "box-shadow .2s" }}>
                  {/* Type */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "0 10px", flexShrink: 0, minWidth: 44 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".07em", color: T.amber, textTransform: "uppercase", writingMode: "vertical-rl", transform: "rotate(180deg)" }}>RETUR</span>
                  </div>
                  {/* Content */}
                  <div className="trx-row-inner">
                    {/* Name */}
                    <div className="trx-col-name">
                      <div style={{ fontSize: 13.5, fontWeight: 800, color: T.text, lineHeight: 1.3 }}>{r.employee || "-"}</div>
                    </div>
                    {/* Time */}
                    <div className="trx-col-time">
                      <div style={{ fontSize: 16, fontWeight: 900, color: T.text, lineHeight: 1 }}>{r.time || "-"}</div>
                      <div style={{ fontSize: 10.5, color: T.muted, marginTop: 3 }}>{fmtDate(r.date)}</div>
                    </div>
                    {/* Items */}
                    <div className="trx-col-items">
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: T.text }}>{r.itemName || "-"}</span>
                        <span style={{ fontSize: 10.5, fontWeight: 800, color: T.amberText, background: T.amberBg, padding: "1px 8px", borderRadius: 5, border: `1px solid ${T.amberBorder}`, flexShrink: 0 }}>+{r.qty} {r.unit || "pcs"}</span>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {r.reason && <span style={{ fontSize: 10, fontWeight: 700, color: T.navActiveText, background: T.navActive, padding: "2px 8px", borderRadius: 5, border: `1px solid ${T.navActiveBorder}` }}>{r.reason}</span>}
                        {r.note && <span style={{ fontSize: 10, fontWeight: 600, color: T.muted, background: T.surface, padding: "2px 8px", borderRadius: 5, border: `1px solid ${T.border}` }}>{r.note}</span>}
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
                    {/* Actions */}
                    {isAdmin && (
                      <button onClick={() => deleteReturn(r.id)}
                        style={{ background: T.redBg, border: `1px solid ${T.redBorder}`, color: T.redText, borderRadius: 8, padding: "7px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" }}>
                        Hapus
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          }

          {/* Pagination */}
          {filteredReturns.length > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11.5, color: T.muted, fontWeight: 600 }}>Menampilkan {(historyReturPage - 1) * historyPageSize + 1}-{Math.min(historyReturPage * historyPageSize, filteredReturns.length)} dari {filteredReturns.length} retur</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button onClick={() => setHistoryReturPage(p => Math.max(1, p - 1))} disabled={historyReturPage <= 1}
                  style={{ padding: "8px 16px", borderRadius: 9, border: `1px solid ${T.border}`, background: T.surface, color: historyReturPage <= 1 ? T.muted : T.text, fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 12.5, fontWeight: 700, cursor: historyReturPage <= 1 ? "default" : "pointer", opacity: historyReturPage <= 1 ? 0.5 : 1, transition: "all .18s" }}>
                  ← Prev
                </button>
                {Array.from({ length: returTotalPages }).map((_, i) => (
                  <button key={i} onClick={() => setHistoryReturPage(i + 1)}
                    style={{ width: 36, height: 36, borderRadius: 9, border: `1px solid ${historyReturPage === i + 1 ? T.primary : T.border}`, background: historyReturPage === i + 1 ? T.primary : T.surface, color: historyReturPage === i + 1 ? "white" : T.muted, fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 13, fontWeight: 800, cursor: "pointer", transition: "all .18s" }}>
                    {i + 1}
                  </button>
                ))}
                <button onClick={() => setHistoryReturPage(p => Math.min(returTotalPages, p + 1))} disabled={historyReturPage >= returTotalPages}
                  style={{ padding: "8px 16px", borderRadius: 9, border: `1px solid ${T.border}`, background: T.surface, color: historyReturPage >= returTotalPages ? T.muted : T.text, fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 12.5, fontWeight: 700, cursor: historyReturPage >= returTotalPages ? "default" : "pointer", opacity: historyReturPage >= returTotalPages ? 0.5 : 1, transition: "all .18s" }}>
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



      <TransactionModal open={showModal} onClose={() => setShowModal(false)} />
      <AddStockModal open={showAdd} onClose={() => setShowAdd(false)} />
      </>)}
    </div>
  );
}







