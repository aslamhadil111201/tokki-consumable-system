// @ts-nocheck
import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Upload, X, CheckCircle, AlertCircle, FileSpreadsheet, Loader } from "lucide-react";
import { useStore } from "../../store/useStore";
import { getT } from "../../theme/tokens";
import { BtnP } from "../ui/BtnP";
import { BtnG } from "../ui/BtnG";

/**
 * Import Shipping Address dari Excel
 * Kolom: Destination | Full Address | Attn | Contact
 * Sheet yang dibaca: "Shipping Address" atau sheet pertama
 */

function normKey(k: string) {
  return k.toLowerCase().trim().replace(/[\s_]+/g, " ");
}

function getCol(row: Record<string, unknown>, ...aliases: string[]): string {
  for (const alias of aliases) {
    const found = Object.keys(row).find((k) => normKey(k) === alias.toLowerCase());
    if (found !== undefined) return String(row[found] || "").trim();
  }
  return "";
}

interface AddrRecord {
  destination: string;
  full_address: string;
  attn: string;
  contact: string;
}

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export function ModalImportAddress({ onClose, onSuccess }: Props) {
  const { dark, setToast } = useStore();
  const T = getT(dark);
  const fileRef = useRef<HTMLInputElement>(null);

  const [validRows, setValidRows] = useState<AddrRecord[]>([]);
  const [errorRows, setErrorRows] = useState<{ dest: string; err: string }[]>([]);
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [fileName, setFileName] = useState("");

  const reset = () => {
    setValidRows([]); setErrorRows([]); setStep("upload");
    setFileName(""); setImportedCount(0); setSkippedCount(0);
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

      // Cari sheet "Shipping Address" atau pakai sheet pertama
      const sheetName = wb.SheetNames.find(
        (s) => s.toLowerCase().includes("shipping") || s.toLowerCase().includes("address") || s.toLowerCase().includes("alamat")
      ) || wb.SheetNames[0];

      const ws = wb.Sheets[sheetName];
      const json: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

      console.log(`📋 Reading sheet: "${sheetName}" — ${json.length} rows`);
      if (json[0]) console.log("Headers:", Object.keys(json[0]));

      const valid: AddrRecord[] = [];
      const errors: { dest: string; err: string }[] = [];

      for (const row of json) {
        const dest = getCol(row, "destination", "tujuan", "nama", "customer", "company");
        if (!dest) {
          errors.push({ dest: "(kosong)", err: "Destination kosong" });
          continue;
        }
        valid.push({
          destination: dest,
          full_address: getCol(row, "full address", "full_address", "address", "alamat"),
          attn: getCol(row, "attn", "pic", "contact person", "nama pic"),
          contact: getCol(row, "contact", "phone", "telepon", "no hp", "no. hp"),
        });
      }

      setValidRows(valid);
      setErrorRows(errors);
      setStep("preview");
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    if (!validRows.length) return;
    setImporting(true);

    const { supabase } = await import("../../lib/supabase");

    // Ambil semua destination yang sudah ada
    const { data: existing } = await supabase.from("shipping_addresses").select("destination");
    const existingSet = new Set((existing || []).map((r: any) => String(r.destination).toLowerCase().trim()));

    const newRows = validRows.filter((r) => !existingSet.has(r.destination.toLowerCase().trim()));
    const skipped = validRows.length - newRows.length;

    let ok = 0;
    if (newRows.length > 0) {
      const { data, error } = await supabase.from("shipping_addresses").insert(newRows).select("id");
      if (error) {
        console.error("Import address error:", error);
        setToast("Ada error saat import: " + error.message, "err");
      } else {
        ok = data?.length ?? newRows.length;
      }
    }

    setImportedCount(ok);
    setSkippedCount(skipped);
    setImporting(false);
    setStep("done");
    if (ok > 0) onSuccess();
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
      <div style={{
        background: T.card, borderRadius: 16, width: "100%", maxWidth: 600,
        maxHeight: "88vh", overflowY: "auto",
        boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
        border: `1px solid ${T.border}`,
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 22px", borderBottom: `1px solid ${T.border}`,
          position: "sticky", top: 0, background: T.card, zIndex: 2,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <FileSpreadsheet size={20} color={T.primary} />
            <span style={{ fontWeight: 700, fontSize: 15, color: T.text }}>Import Shipping Address dari Excel</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: T.muted }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: "20px 22px" }}>

          {/* UPLOAD */}
          {step === "upload" && (
            <div>
              <p style={{ color: T.muted, fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>
                Upload file Excel yang berisi sheet <strong style={{ color: T.text }}>Shipping Address</strong>.
                Sistem akan otomatis membaca kolom Destination, Full Address, Attn, dan Contact.
              </p>
              <div style={{
                background: T.surface, borderRadius: 10, padding: "12px 16px",
                marginBottom: 20, border: `1px solid ${T.border}`,
              }}>
                <div style={{ fontWeight: 600, fontSize: 12, color: T.primary, marginBottom: 8 }}>FORMAT KOLOM</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {["Destination", "Full Address", "Attn", "Contact"].map((c) => (
                    <span key={c} style={{
                      background: T.inputBg, border: `1px solid ${T.border}`,
                      borderRadius: 6, padding: "3px 10px", fontSize: 11, color: T.text, fontWeight: 500,
                    }}>{c}</span>
                  ))}
                </div>
              </div>
              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${T.primary}`, borderRadius: 12,
                  padding: "44px 20px", textAlign: "center", cursor: "pointer",
                  background: T.surface,
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

          {/* PREVIEW */}
          {step === "preview" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <FileSpreadsheet size={15} color={T.muted} />
                <span style={{ fontSize: 13, color: T.muted }}>{fileName}</span>
              </div>

              <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                <div style={{
                  flex: 1, background: "#10b98118", border: "1px solid #10b981",
                  borderRadius: 10, padding: "12px 16px", textAlign: "center",
                }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#10b981" }}>{validRows.length}</div>
                  <div style={{ fontSize: 11, color: "#10b981" }}>Alamat siap import</div>
                </div>
                <div style={{
                  flex: 1,
                  background: errorRows.length ? "#ef444418" : T.surface,
                  border: `1px solid ${errorRows.length ? "#ef4444" : T.border}`,
                  borderRadius: 10, padding: "12px 16px", textAlign: "center",
                }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: errorRows.length ? "#ef4444" : T.muted }}>{errorRows.length}</div>
                  <div style={{ fontSize: 11, color: errorRows.length ? "#ef4444" : T.muted }}>Dilewati (error)</div>
                </div>
              </div>

              {errorRows.length > 0 && (
                <div style={{
                  background: "#ef444410", border: "1px solid #ef444440",
                  borderRadius: 10, padding: "12px 14px", marginBottom: 14, maxHeight: 120, overflowY: "auto",
                }}>
                  <div style={{ fontWeight: 600, fontSize: 12, color: "#ef4444", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                    <AlertCircle size={13} /> Baris yang dilewati:
                  </div>
                  {errorRows.map((e, i) => (
                    <div key={i} style={{ fontSize: 11, color: "#ef4444", marginBottom: 2 }}>
                      <strong>{e.dest}:</strong> {e.err}
                    </div>
                  ))}
                </div>
              )}

              {validRows.length > 0 && (
                <div style={{ overflowX: "auto", marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: T.muted, marginBottom: 6 }}>
                    Preview ({Math.min(validRows.length, 6)} dari {validRows.length}):
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: T.surface }}>
                        {["Destination", "Full Address", "Attn"].map((h) => (
                          <th key={h} style={{ padding: "6px 10px", textAlign: "left", color: T.muted, fontWeight: 600, borderBottom: `1px solid ${T.border}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {validRows.slice(0, 6).map((r, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                          <td style={{ padding: "5px 10px", fontWeight: 500, color: T.text, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.destination}</td>
                          <td style={{ padding: "5px 10px", color: T.muted, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.full_address || "-"}</td>
                          <td style={{ padding: "5px 10px", color: T.muted, whiteSpace: "nowrap" }}>{r.attn || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {validRows.length > 6 && (
                    <div style={{ fontSize: 11, color: T.muted, marginTop: 6, textAlign: "center" }}>
                      ... dan {validRows.length - 6} alamat lainnya
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <BtnG onClick={reset} style={{ fontSize: 12 }}>Ganti File</BtnG>
                <BtnP
                  onClick={handleImport}
                  disabled={validRows.length === 0 || importing}
                  style={{ padding: "9px 20px", fontSize: 13, display: "flex", alignItems: "center", gap: 6, opacity: validRows.length === 0 ? 0.5 : 1 }}
                >
                  {importing
                    ? <><Loader size={14} className="spin" /> Mengimport...</>
                    : <><Upload size={14} /> Import {validRows.length} Alamat</>
                  }
                </BtnP>
              </div>
            </div>
          )}

          {/* DONE */}
          {step === "done" && (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <CheckCircle size={54} color="#10b981" style={{ marginBottom: 14 }} />
              <div style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 8 }}>Import Selesai!</div>
              <div style={{ fontSize: 14, color: T.muted, marginBottom: 8 }}>
                <strong style={{ color: "#10b981", fontSize: 20 }}>{importedCount}</strong> alamat berhasil diimport
              </div>
              {skippedCount > 0 && (
                <div style={{ fontSize: 13, color: T.muted, marginBottom: 16 }}>
                  <strong style={{ color: "#f59e0b" }}>{skippedCount}</strong> dilewati (sudah ada)
                </div>
              )}
              <BtnP onClick={onClose} style={{ padding: "10px 32px", marginTop: 16 }}>Tutup</BtnP>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
