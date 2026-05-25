// @ts-nocheck
import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Upload, Download, X, CheckCircle, AlertCircle, FileSpreadsheet, Loader } from "lucide-react";
import { useStore } from "../../store/useStore";
import { getT } from "../../theme/tokens";
import { BtnP } from "../ui/BtnP";
import { BtnG } from "../ui/BtnG";

/**
 * Format Excel yang didukung (sesuai file asli):
 *
 * Sheet: "Product Finish good" → category FNG
 * Sheet: "Sub vendor"          → category DLV
 * Sheet: "Site Work"           → category STW
 * Sheet: "Etc"                 → category ETC
 * Sheet: "Shipping Address"    → data alamat (opsional, tidak diimport ke delivery_notes)
 *
 * Kolom per sheet delivery:
 *   Batch | Date | Project No | Destination | Qty | UoM | Item List | Attn
 *
 * Setiap baris = 1 item barang.
 * Baris dengan Batch yang sama dikelompokkan menjadi 1 surat jalan.
 */

const SHEET_CAT_MAP: Record<string, string> = {
  "product finish good": "FNG",
  "product finish goods": "FNG",
  "finish good": "FNG",
  "finish goods": "FNG",
  "fng": "FNG",
  "sub vendor": "DLV",
  "subvendor": "DLV",
  "sub-vendor": "DLV",
  "dlv": "DLV",
  "site work": "STW",
  "sitework": "STW",
  "site-work": "STW",
  "stw": "STW",
  "etc": "ETC",
  "lain-lain": "ETC",
  "etcetera": "ETC",
};

/** Resolve category from sheet name — exact map first, then keyword fallback */
function resolveCat(sheetName: string): string | null {
  const key = sheetName.toLowerCase().trim();
  if (SHEET_CAT_MAP[key]) return SHEET_CAT_MAP[key];
  // keyword fallback
  if (key.includes("finish")) return "FNG";
  if (key.includes("sub") && key.includes("vendor")) return "DLV";
  if (key.includes("site") && key.includes("work")) return "STW";
  if (key === "etc" || key.startsWith("etc") || key.includes("lain")) return "ETC";
  return null;
}

function parseDate(val: unknown): string | null {
  if (!val) return null;

  // Excel serial number
  if (typeof val === "number") {
    try {
      const d = XLSX.SSF.parse_date_code(val);
      if (d && d.y > 1900) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
    } catch { /* ignore */ }
  }

  const s = String(val).trim();
  if (!s || s === "-" || s === "") return null;

  const months: Record<string, string> = {
    jan:"01", feb:"02", mar:"03", apr:"04", may:"05", jun:"06",
    jul:"07", aug:"08", sep:"09", oct:"10", nov:"11", dec:"12",
    // Indonesia
    januari:"01", februari:"02", maret:"03", april:"04", mei:"05", juni:"06",
    juli:"07", agustus:"08", september:"09", oktober:"10", november:"11", desember:"12",
    // Singkatan Indonesia
    agt:"08", okt:"10", des:"12",
  };

  // DD/MM/YYYY
  // DD/MM/YYYY or DD/MM/YY or DD/MM/YYY (typo tahun 3 digit)
  let m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    let yr = m[3];
    if (yr.length === 2) yr = "20" + yr;
    else if (yr.length === 3) yr = "20" + yr.slice(-2); // "204" → "2024"
    return `${yr}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
  }

  // YYYY-MM-DD or YYYY/MM/DD
  m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2,"0")}-${m[3].padStart(2,"0")}`;

  // DD/Mon/YYYY  e.g. "05/Apr/2026"
  m = s.match(/^(\d{1,2})[\/\-]([A-Za-z]+)[\/\-](\d{4})$/);
  if (m) {
    const mo = months[m[2].toLowerCase().substring(0,3)];
    if (mo) return `${m[3]}-${mo}-${m[1].padStart(2,"0")}`;
  }

  // DD Mon YYYY  e.g. "17 Dec 2024" / "17 December 2024"
  m = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (m) {
    const mo = months[m[2].toLowerCase().substring(0,3)];
    if (mo) return `${m[3]}-${mo}-${m[1].padStart(2,"0")}`;
  }

  // Mon DD, YYYY  e.g. "Dec 17, 2024"
  m = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m) {
    const mo = months[m[1].toLowerCase().substring(0,3)];
    if (mo) return `${m[3]}-${mo}-${m[2].padStart(2,"0")}`;
  }

  // Native Date parse as last resort
  const native = new Date(s);
  if (!isNaN(native.getTime()) && native.getFullYear() > 1990) {
    return `${native.getFullYear()}-${String(native.getMonth()+1).padStart(2,"0")}-${String(native.getDate()).padStart(2,"0")}`;
  }

  console.warn(`⚠️ parseDate failed:`, JSON.stringify(s));
  return null;
}

/** Normalize header key: lowercase, trim, collapse spaces/underscores */
function normKey(k: string) {
  return k.toLowerCase().trim().replace(/[\s_]+/g, " ");
}

/** Find value from a row by possible header aliases */
function getCol(row: Record<string, unknown>, ...aliases: string[]): unknown {
  for (const alias of aliases) {
    const found = Object.keys(row).find((k) => normKey(k) === alias.toLowerCase());
    if (found !== undefined) return row[found];
  }
  return "";
}

interface DeliveryRecord {
  batch: string;
  category: string;
  date: string | null;
  destination: string;
  attn: string;
  project_no: string;
  no_kendaraan: string;
  items: { qty: string; uom: string; description: string }[];
}

function parseSheet(ws: XLSX.WorkSheet, category: string): DeliveryRecord[] {
  const json: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
  if (!json.length) return [];

  // Debug: log header keys dan 2 baris pertama
  console.log(`\n📄 parseSheet [${category}] — ${json.length} rows`);
  console.log("  Headers:", Object.keys(json[0]));
  if (json[0]) console.log("  Row 0:", JSON.stringify(json[0]));
  if (json[1]) console.log("  Row 1:", JSON.stringify(json[1]));

  // Group rows by batch
  const map = new Map<string, DeliveryRecord>();

  for (const row of json) {
    const batch = String(getCol(row, "batch") || "").trim();
    if (!batch) continue;

    const itemDesc = String(getCol(row, "item list", "items", "description", "item") || "").trim();
    const qty = String(getCol(row, "qty", "quantity") || "1").trim();
    const uom = String(getCol(row, "uom", "unit", "satuan") || "Pcs").trim();

    if (!map.has(batch)) {
      const rawDate = getCol(row, "date", "tanggal");
      const dest = String(getCol(row, "destination", "tujuan", "customer") || "").trim();
      const projNo = String(getCol(row, "project no", "project no.", "project_no", "project") || "").trim();
      const attn = String(getCol(row, "attn", "pic", "contact person") || "").trim();
      const kendaraan = String(getCol(row, "no kendaraan", "kendaraan", "vehicle") || "").trim();

      map.set(batch, {
        batch,
        category,
        date: parseDate(rawDate),
        destination: dest,
        attn,
        project_no: projNo,
        no_kendaraan: kendaraan,
        items: [],
      });
    }

    if (itemDesc) {
      map.get(batch)!.items.push({ qty, uom, description: itemDesc });
    }
  }

  return Array.from(map.values());
}

interface PreviewRow extends DeliveryRecord {
  sheetName: string;
  errors: string[];
}

function validateRecord(r: DeliveryRecord): string[] {
  const errs: string[] = [];
  if (!r.batch) errs.push("Batch kosong");
  if (!r.destination) errs.push("Destination kosong");
  // tanggal tidak valid → tetap diimport, tidak diblokir
  if (!r.items.length) errs.push("Tidak ada item barang");
  return errs;
}

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export function ModalImportDelivery({ onClose, onSuccess }: Props) {
  const { dark, setToast } = useStore();
  const T = getT(dark);
  const fileRef = useRef<HTMLInputElement>(null);

  const [validRows, setValidRows] = useState<PreviewRow[]>([]);
  const [errorRows, setErrorRows] = useState<PreviewRow[]>([]);
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [fileName, setFileName] = useState("");
  const [sheetsSummary, setSheetsSummary] = useState<{ name: string; cat: string; count: number }[]>([]);

  const reset = () => {
    setValidRows([]); setErrorRows([]); setStep("upload");
    setFileName(""); setSheetsSummary([]);
    setImportedCount(0); setFailedCount(0); setSkippedCount(0);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target!.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array", cellDates: false });

      const allValid: PreviewRow[] = [];
      const allErrors: PreviewRow[] = [];
      const summary: { name: string; cat: string; count: number }[] = [];

      console.log("📋 Sheet names found:", wb.SheetNames);

      for (const sheetName of wb.SheetNames) {
        const key = sheetName.toLowerCase().trim();
        const cat = resolveCat(sheetName);
        console.log(`  Sheet: "${sheetName}" → key: "${key}" → cat: ${cat || "NOT FOUND"}`);

        // Skip shipping address sheet
        if (key.includes("shipping") || key.includes("address") || key.includes("alamat")) continue;
        // Skip sum/array/print sheets
        if (key.includes("sum") || key.includes("array") || key.includes("print")) continue;

        if (!cat) continue; // skip unknown sheets

        const ws = wb.Sheets[sheetName];
        const records = parseSheet(ws, cat);

        let sheetValid = 0;
        for (const rec of records) {
          const errs = validateRecord(rec);
          const row: PreviewRow = { ...rec, sheetName, errors: errs };
          if (errs.length) {
            allErrors.push(row);
          } else {
            allValid.push(row);
            sheetValid++;
          }
        }
        if (records.length) summary.push({ name: sheetName, cat, count: sheetValid });
      }

      setValidRows(allValid);
      setErrorRows(allErrors);
      setSheetsSummary(summary);
      setStep("preview");
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    if (!validRows.length) return;
    setImporting(true);

    const { supabase } = await import("../../lib/supabase");

    // Ambil SEMUA batch yang sudah ada (bypass 1000 row limit dengan range)
    let existingBatches = new Set<string>();
    let from = 0;
    const PAGE = 1000;
    while (true) {
      const { data: page } = await supabase
        .from("delivery_notes")
        .select("batch")
        .range(from, from + PAGE - 1);
      if (!page || page.length === 0) break;
      page.forEach((r: any) => existingBatches.add(String(r.batch).trim()));
      if (page.length < PAGE) break;
      from += PAGE;
    }
    console.log(`📦 Existing batches in DB: ${existingBatches.size}`);

    // Filter hanya yang belum ada
    const newRows = validRows.filter((r) => !existingBatches.has(r.batch.trim()));
    const skipped = validRows.length - newRows.length;

    if (skipped > 0) {
      console.log(`⚠️ Skipped ${skipped} duplicate batches`);
    }

    if (!newRows.length) {
      setImportedCount(0);
      setFailedCount(0);
      setImporting(false);
      setStep("done");
      return;
    }

    const payloads = newRows.map((row) => {
      const payload: Record<string, unknown> = {
        batch: String(row.batch || "").trim(),
        category: String(row.category || "FNG").trim(),
        destination: String(row.destination || "").trim(),
        attn: String(row.attn || "").trim(),
        full_address: "",
        project_no: String(row.project_no || "").trim(),
        no_kendaraan: String(row.no_kendaraan || "").trim(),
        items: Array.isArray(row.items) && row.items.length > 0
          ? row.items.map(it => ({
              qty: String(it.qty || "1"),
              uom: String(it.uom || "Pcs"),
              description: String(it.description || ""),
            }))
          : [{ qty: "1", uom: "Pcs", description: "-" }],
      };
      // Hanya kirim date kalau valid, kalau null jangan kirim field-nya
      if (row.date) payload.date = row.date;
      return payload;
    });

    // Insert satu per satu untuk isolasi error per baris
    const CHUNK = 50;
    let ok = 0;
    let fail = 0;

    for (let i = 0; i < payloads.length; i += CHUNK) {
      const chunk = payloads.slice(i, i + CHUNK);
      const { error, data } = await supabase.from("delivery_notes").insert(chunk).select("id");
      if (error) {
        console.error(`Insert error chunk ${i}-${i+CHUNK}:`, error.message, "|", error.details, "|", error.hint);
        console.error("Sample payload:", JSON.stringify(chunk[0]));
        // Retry satu per satu untuk isolasi yang gagal
        for (const single of chunk) {
          const { error: e2 } = await supabase.from("delivery_notes").insert([single]);
          if (e2) {
            console.error("Single insert failed:", e2.message, "| batch:", single.batch);
            fail++;
          } else {
            ok++;
          }
        }
      } else {
        ok += data?.length ?? chunk.length;
      }
    }

    setImportedCount(ok);
    setFailedCount(fail);
    setSkippedCount(skipped);
    setImporting(false);
    setStep("done");
    if (ok > 0) onSuccess();
  };

  const CAT_COLOR: Record<string, string> = {
    FNG: "#10b981", DLV: "#3b82f6", STW: "#f59e0b", ETC: "#6b7280",
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.55)", display: "flex",
        alignItems: "center", justifyContent: "center", padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: T.card, borderRadius: 16, width: "100%", maxWidth: 700,
          maxHeight: "90vh", overflowY: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
          border: `1px solid ${T.border}`,
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 22px", borderBottom: `1px solid ${T.border}`,
          position: "sticky", top: 0, background: T.card, zIndex: 2,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <FileSpreadsheet size={20} color={T.primary} />
            <span style={{ fontWeight: 700, fontSize: 15, color: T.text }}>Import Data Delivery dari Excel</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: T.muted }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: "20px 22px" }}>

          {/* ── STEP: UPLOAD ── */}
          {step === "upload" && (
            <div>
              <p style={{ color: T.muted, fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>
                Upload file Excel (.xlsx / .xls) yang sudah ada. Sistem akan membaca sheet{" "}
                <strong style={{ color: T.text }}>Product Finish good</strong>,{" "}
                <strong style={{ color: T.text }}>Sub vendor</strong>,{" "}
                <strong style={{ color: T.text }}>Site Work</strong>, dan{" "}
                <strong style={{ color: T.text }}>Etc</strong> secara otomatis.
              </p>

              {/* Format info */}
              <div style={{
                background: T.surface, borderRadius: 10, padding: "14px 16px",
                marginBottom: 20, border: `1px solid ${T.border}`,
              }}>
                <div style={{ fontWeight: 600, fontSize: 12, color: T.primary, marginBottom: 10 }}>FORMAT KOLOM YANG DIHARAPKAN</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                  {["Batch", "Date", "Project No", "Destination", "Qty", "UoM", "Item List", "Attn"].map((c) => (
                    <span key={c} style={{
                      background: T.inputBg, border: `1px solid ${T.border}`,
                      borderRadius: 6, padding: "3px 10px", fontSize: 11,
                      color: T.text, fontWeight: 500,
                    }}>{c}</span>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.7 }}>
                  • Setiap baris = 1 item barang. Baris dengan <strong style={{ color: T.text }}>Batch</strong> yang sama otomatis digabung.<br />
                  • Sheet yang dibaca: <strong style={{ color: T.text }}>Product Finish good → FNG</strong>, <strong style={{ color: T.text }}>Sub vendor → DLV</strong>, <strong style={{ color: T.text }}>Site Work → STW</strong>, <strong style={{ color: T.text }}>Etc → ETC</strong>
                </div>
              </div>

              {/* Drop zone */}
              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${T.primary}`, borderRadius: 12,
                  padding: "44px 20px", textAlign: "center", cursor: "pointer",
                  background: T.surface, transition: "opacity 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.75")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                <Upload size={34} color={T.primary} style={{ marginBottom: 10 }} />
                <div style={{ fontWeight: 600, color: T.text, marginBottom: 4 }}>Klik untuk pilih file Excel</div>
                <div style={{ fontSize: 12, color: T.muted }}>Format: .xlsx atau .xls</div>
              </div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={handleFile} />
            </div>
          )}

          {/* ── STEP: PREVIEW ── */}
          {step === "preview" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <FileSpreadsheet size={15} color={T.muted} />
                <span style={{ fontSize: 13, color: T.muted }}>{fileName}</span>
              </div>

              {/* Sheet summary */}
              {sheetsSummary.length > 0 && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                  {sheetsSummary.map((s) => (
                    <div key={s.name} style={{
                      background: `${CAT_COLOR[s.cat]}18`,
                      border: `1px solid ${CAT_COLOR[s.cat]}50`,
                      borderRadius: 8, padding: "6px 12px", fontSize: 12,
                    }}>
                      <span style={{ fontWeight: 600, color: CAT_COLOR[s.cat] }}>{s.cat}</span>
                      <span style={{ color: T.muted, marginLeft: 6 }}>{s.name}</span>
                      <span style={{ color: T.text, marginLeft: 6, fontWeight: 600 }}>{s.count} SJ</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Summary counts */}
              <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                <div style={{
                  flex: 1, background: "#10b98118", border: "1px solid #10b981",
                  borderRadius: 10, padding: "12px 16px", textAlign: "center",
                }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#10b981" }}>{validRows.length}</div>
                  <div style={{ fontSize: 11, color: "#10b981" }}>Surat jalan siap import</div>
                </div>
                <div style={{
                  flex: 1,
                  background: errorRows.length ? "#ef444418" : T.surface,
                  border: `1px solid ${errorRows.length ? "#ef4444" : T.border}`,
                  borderRadius: 10, padding: "12px 16px", textAlign: "center",
                }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: errorRows.length ? "#ef4444" : T.muted }}>{errorRows.length}</div>
                  <div style={{ fontSize: 11, color: errorRows.length ? "#ef4444" : T.muted }}>Dilewati (ada error)</div>
                </div>
              </div>

              {/* Error list */}
              {errorRows.length > 0 && (
                <div style={{
                  background: "#ef444410", border: "1px solid #ef444440",
                  borderRadius: 10, padding: "12px 14px", marginBottom: 14,
                  maxHeight: 140, overflowY: "auto",
                }}>
                  <div style={{ fontWeight: 600, fontSize: 12, color: "#ef4444", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    <AlertCircle size={13} /> Batch yang dilewati:
                  </div>
                  {errorRows.map((e, i) => (
                    <div key={i} style={{ fontSize: 11, color: "#ef4444", marginBottom: 3 }}>
                      <strong>[{e.sheetName}] {e.batch || "(no batch)"}:</strong> {e.errors.join(", ")}
                    </div>
                  ))}
                </div>
              )}

              {/* Preview table */}
              {validRows.length > 0 && (
                <div style={{ overflowX: "auto", marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: T.muted, marginBottom: 6 }}>
                    Preview ({Math.min(validRows.length, 8)} dari {validRows.length} surat jalan):
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: T.surface }}>
                        {["Batch", "Cat", "Tanggal", "Destination", "Project No", "Items"].map((h) => (
                          <th key={h} style={{
                            padding: "6px 10px", textAlign: "left", color: T.muted,
                            fontWeight: 600, borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap",
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {validRows.slice(0, 8).map((r, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                          <td style={{ padding: "5px 10px", fontWeight: 600, color: CAT_COLOR[r.category] || T.text }}>{r.batch}</td>
                          <td style={{ padding: "5px 10px", color: T.muted }}>{r.category}</td>
                          <td style={{ padding: "5px 10px", color: T.muted, whiteSpace: "nowrap" }}>{r.date || "-"}</td>
                          <td style={{ padding: "5px 10px", color: T.text, maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.destination}</td>
                          <td style={{ padding: "5px 10px", color: T.muted }}>{r.project_no || "-"}</td>
                          <td style={{ padding: "5px 10px", color: T.muted }}>
                            <span style={{
                              background: T.surface, borderRadius: 4,
                              padding: "1px 6px", fontSize: 10,
                            }}>{r.items.length} item</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {validRows.length > 8 && (
                    <div style={{ fontSize: 11, color: T.muted, marginTop: 6, textAlign: "center" }}>
                      ... dan {validRows.length - 8} surat jalan lainnya
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <BtnG onClick={reset} style={{ fontSize: 12 }}>Ganti File</BtnG>
                <BtnP
                  onClick={handleImport}
                  disabled={validRows.length === 0 || importing}
                  style={{
                    padding: "9px 20px", fontSize: 13,
                    display: "flex", alignItems: "center", gap: 6,
                    opacity: validRows.length === 0 ? 0.5 : 1,
                  }}
                >
                  {importing
                    ? <><Loader size={14} className="spin" /> Mengimport...</>
                    : <><Upload size={14} /> Import {validRows.length} Surat Jalan</>
                  }
                </BtnP>
              </div>
            </div>
          )}

          {/* ── STEP: DONE ── */}
          {step === "done" && (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <CheckCircle size={54} color="#10b981" style={{ marginBottom: 14 }} />
              <div style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 8 }}>
                Import Selesai!
              </div>
              <div style={{ fontSize: 14, color: T.muted, marginBottom: 8 }}>
                <strong style={{ color: "#10b981", fontSize: 20 }}>{importedCount}</strong> surat jalan berhasil diimport
              </div>
              {skippedCount > 0 && (
                <div style={{ fontSize: 13, color: T.muted, marginBottom: 4 }}>
                  <strong style={{ color: "#f59e0b" }}>{skippedCount}</strong> dilewati (sudah ada di database)
                </div>
              )}
              {failedCount > 0 && (
                <div style={{ fontSize: 13, color: "#ef4444", marginBottom: 4 }}>
                  <strong>{failedCount}</strong> gagal — cek console untuk detail error
                </div>
              )}
              <div style={{ marginTop: 24 }}>
                <BtnP onClick={onClose} style={{ padding: "10px 32px" }}>Tutup</BtnP>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
