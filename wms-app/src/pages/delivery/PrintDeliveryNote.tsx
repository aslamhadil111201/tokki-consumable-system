// @ts-nocheck
import React from 'react';
import { fmtDate } from '../../utils/formatters';

interface PrintItem {
  qty: number;
  uom: string;
  description: string;
}

interface PrintDeliveryNoteProps {
  note: {
    id?: number;
    batch: string;
    category: string;
    date: string;
    project_no?: string;
    no_kendaraan?: string;
    destination: string;
    attn?: string;
    full_address?: string;
    items: PrintItem[];
  } | null;
}

export function PrintDeliveryNote({ note }: PrintDeliveryNoteProps) {
  if (!note) return null;

  // Fill up blank items to keep spacing standard (like a professional carbon-copy delivery note)
  const items = note.items || [];
  const minRows = 10;
  const paddingRowsCount = Math.max(0, minRows - items.length);
  const paddingRows = Array.from({ length: paddingRowsCount });

  return (
    <div id="tokki-print-container">
      {/* Self-contained styling to guarantee pixel-perfect printing across light/dark modes */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media screen {
          #tokki-print-container {
            display: none !important;
          }
        }

        @media print {
          /* Page settings */
          @page {
            size: A4 portrait;
            margin: 8mm 10mm 8mm 10mm;
          }

          /* General resets */
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            font-family: 'Courier New', Courier, monospace, 'Segoe UI', Arial, sans-serif !important;
            font-size: 12px !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Hide all other elements inside the React app root */
          body > * {
            visibility: hidden !important;
          }

          /* Make ONLY the print container visible and force absolute top-left positioning */
          #tokki-print-container,
          #tokki-print-container * {
            visibility: visible !important;
          }

          #tokki-print-container {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: #ffffff !important;
            box-sizing: border-box !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          /* Layout styles */
          .print-header-layout {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            width: 100%;
            margin-bottom: 8px;
          }

          .print-header-left {
            width: 52%;
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .print-logo-wrap {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 2px;
          }

          .print-address-text {
            font-size: 9.5px;
            line-height: 1.3;
            color: #000000;
            font-weight: 600;
          }

          .print-header-right {
            width: 45%;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 6px;
          }

          .print-right-meta {
            display: grid;
            grid-template-columns: 110px 8px 1fr;
            row-gap: 2px;
            font-size: 11.5px;
            width: 100%;
            font-weight: 700;
          }

          .print-recipient-box {
            border: 1.5px solid #000000;
            padding: 8px 10px;
            width: 100%;
            min-height: 75px;
            border-radius: 4px;
            box-sizing: border-box;
            font-size: 11px;
            line-height: 1.4;
          }

          .print-recipient-lbl {
            font-weight: bold;
            margin-bottom: 3px;
          }

          .print-recipient-dest {
            font-weight: 800;
            font-size: 12px;
          }

          /* Title block style */
          .print-title-block {
            text-align: center;
            margin: 12px 0 10px 0;
            width: 100%;
          }

          .print-title-main {
            font-size: 19px;
            font-weight: 800;
            margin: 0;
            letter-spacing: 0.5px;
            text-decoration: underline;
            text-transform: capitalize;
          }

          .print-title-sub {
            font-size: 15px;
            font-weight: 700;
            margin: 2px 0 0 0;
            letter-spacing: 0.5px;
            text-decoration: underline;
          }

          /* Middle Meta Info Grid */
          .print-middle-grid {
            display: flex;
            justify-content: space-between;
            width: 100%;
            margin-bottom: 8px;
            font-size: 11px;
            font-weight: 700;
          }

          .print-middle-left {
            width: 50%;
            display: grid;
            grid-template-columns: 80px 8px 1fr;
            row-gap: 3px;
          }

          .print-middle-right {
            width: 45%;
            display: grid;
            grid-template-columns: 100px 8px 1fr;
            row-gap: 3px;
          }

          /* Sentences */
          .print-sentence {
            font-size: 11.5px;
            margin-bottom: 8px;
            font-style: italic;
            font-weight: 600;
          }

          /* Table of Goods */
          .print-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 12px;
          }

          .print-table th {
            border: 1.5px solid #000000;
            padding: 6px 10px;
            background: #e2e8f0 !important;
            font-weight: bold;
            font-size: 11px;
            text-align: center;
            text-transform: capitalize;
          }

          .print-table td {
            border: 1.5px solid #000000;
            padding: 6px 10px;
            font-size: 11px;
            height: 26px;
            box-sizing: border-box;
            font-weight: 600;
          }

          .print-text-center {
            text-align: center;
          }

          /* Footer / Signatures block */
          .print-footer-statement {
            font-size: 11px;
            font-weight: bold;
            margin-bottom: 14px;
          }

          .print-sig-row {
            display: flex;
            justify-content: space-between;
            width: 100%;
            margin-top: 10px;
          }

          .print-sig-col {
            width: 30%;
            text-align: center;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            min-height: 80px;
            font-size: 11px;
            font-weight: bold;
          }

          .print-sig-name-wrap {
            width: 80%;
            margin: 0 auto;
            border-bottom: 1.5px solid #000000;
            padding-bottom: 2px;
          }
        }
      ` }} />

      <div className="print-page">
        {/* Header Layout: Left (Logo & Address) | Right (Document Metadata & Ship To) */}
        <div className="print-header-layout">
          <div className="print-header-left">
            <div className="print-logo-wrap">
              {/* Green TF Oval Circle + Bold TOKKI Text */}
              <svg width="220" height="46" viewBox="0 0 220 46" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="21" cy="21" r="19.5" stroke="#048A43" strokeWidth="3" fill="none" />
                <path d="M10 12H32" stroke="#048A43" strokeWidth="3" strokeLinecap="round" />
                <path d="M10 19H26" stroke="#048A43" strokeWidth="3" strokeLinecap="round" />
                <path d="M21 12V30" stroke="#048A43" strokeWidth="3" strokeLinecap="round" />
                <path d="M15 25H27" stroke="#048A43" strokeWidth="3" strokeLinecap="round" />
                <text x="50" y="27" fontFamily="'Segoe UI', Arial, sans-serif" fontWeight="900" fontSize="25" fill="#111111" letterSpacing="0.8">TOKKI</text>
                <text x="50" y="38" fontFamily="'Segoe UI', Arial, sans-serif" fontWeight="700" fontSize="7" fill="#048A43" letterSpacing="0.2">ENGINEERING AND FABRICATION</text>
              </svg>
            </div>
            <div className="print-address-text">
              <strong>Cilegon Factory & Office :</strong><br />
              Jl. Australia II Blok D1/2<br />
              Kawasan Industri Estate Cilegon (KIEC)<br />
              Cilegon - Banten - Indonesia<br />
              Phone : +62-254 311 7244 (Hunting)<br />
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+62-254 311 7243, +62-254 311 7245
            </div>
          </div>

          <div className="print-header-right">
            <div className="print-right-meta">
              <span>Document Batch</span>
              <span>:</span>
              <span>{note.batch}</span>

              <span>Tanggal</span>
              <span>:</span>
              <span>{fmtDate(note.date)}</span>
            </div>

            <div className="print-recipient-box">
              <div className="print-recipient-lbl">Kepada Yth :</div>
              <div className="print-recipient-dest">{note.destination}</div>
              {note.attn && <div style={{ fontSize: '10.5px' }}><strong>Attn:</strong> {note.attn}</div>}
              {note.full_address && (
                <div style={{ fontSize: '9.5px', marginTop: '3px', whiteSpace: 'pre-line', fontWeight: 600 }}>
                  {note.full_address}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Title Area */}
        <div className="print-title-block">
          <h2 className="print-title-main">Delivery Note</h2>
          <h3 className="print-title-sub">Surat Jalan</h3>
        </div>

        {/* Middle Metadata Block */}
        <div className="print-middle-grid">
          <div className="print-middle-left">
            <span>Project No.</span>
            <span>:</span>
            <span>{note.project_no || '-'}</span>

            <span>Attn.</span>
            <span>:</span>
            <span>{note.attn || '-'}</span>
          </div>
          <div className="print-middle-right">
            <span>No Kendaraan</span>
            <span>:</span>
            <span>{note.no_kendaraan || '-'}</span>
          </div>
        </div>

        {/* Sentence */}
        <div className="print-sentence">
          dengan ini kami mengirimkan barang-barang berikut di bawah ini:
        </div>

        {/* Table of Goods */}
        <table className="print-table">
          <thead>
            <tr>
              <th style={{ width: '130px' }}>Quantity</th>
              <th>Description of Goods</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx}>
                <td className="print-text-center" style={{ fontWeight: 'bold' }}>
                  {item.qty} {item.uom}
                </td>
                <td>{item.description}</td>
              </tr>
            ))}
            {paddingRows.map((_, idx) => (
              <tr key={`pad-${idx}`}>
                <td></td>
                <td></td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Footer Statement */}
        <div className="print-footer-statement">
          Seluruh item tersebut di atas telah diterima dengan baik.
        </div>

        {/* Signature Blocks */}
        <div className="print-sig-row">
          <div className="print-sig-col">
            <span>Penerima,</span>
            <div className="print-sig-name-wrap">
              <span>( &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; )</span>
            </div>
          </div>
          <div className="print-sig-col">
            <span>Diserahkan Oleh,</span>
            <div className="print-sig-name-wrap">
              <span>( &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; )</span>
            </div>
          </div>
          <div className="print-sig-col">
            <span>Hormat Kami,</span>
            <div className="print-sig-name-wrap">
              <span>( &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; )</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
