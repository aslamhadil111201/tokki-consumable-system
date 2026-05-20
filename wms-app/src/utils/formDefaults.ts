// @ts-nocheck
// ─── Form Defaults ───────────────────────────────────────────────
import { todayStr } from "./formatters";

export const emptyForm = (overrides={}) => ({
  taker:"", dept:"", workOrder:"", note:"", date:todayStr(), admin:"", cart:[], ...overrides
});

export const emptyNewItem = () => ({
  name:"", itemCode:"", category:"APD", unit:"pcs", minStock:"", stock:"", hargaAwal:"", photo:null
});

export const emptyAddForm = (overrides={}) => ({
  poNumber:"", doNumber:"", date:todayStr(), admin:"", itemId:"", qty:"", buyPrice:"", attachment:null, ...overrides
});

export const RETUR_REASONS = ["Sisa pemakaian","Kondisi masih baik","Kelebihan ambil","Tidak jadi dipakai"];

export const emptyReturForm = () => ({
  employee:"", itemId:"", qty:"", reason:RETUR_REASONS[0], note:""
});
