// @ts-nocheck
// ─── TypeScript Types/Interfaces ─────────────────────────────────

export type AttachPreview = {
  blobUrl: string;
  data: string;
  name: string;
  mimeType: string;
  receiveId: number;
} | null;

export type NotifItem = {
  id: number;
  msg: string;
  type: "ok" | "err";
  ts: string;
  read: boolean;
};

export type ToastItem = {
  msg: string;
  type: "ok" | "err";
} | null;

export type CartItem = {
  itemId: number;
  qty: number;
};

export type FormState = {
  taker: string;
  dept: string;
  workOrder: string;
  note: string;
  date: string;
  admin: string;
  cart: CartItem[];
};

export type NewItemForm = {
  name: string;
  itemCode: string;
  category: string;
  unit: string;
  minStock: string;
  stock: string;
  hargaAwal: string;
  photo: string | null;
};

export type AddForm = {
  poNumber: string;
  doNumber: string;
  date: string;
  admin: string;
  itemId: string;
  qty: string;
  buyPrice: string;
  attachment: string | null;
};

export type ReturForm = {
  employee: string;
  itemId: string;
  qty: string;
  reason: string;
  note: string;
};

export type ReportProjectMode = "unit" | "rp";
export type TrendFilter = "all" | "up" | "down" | "spike" | "cur" | "prev";
