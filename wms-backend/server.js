const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3001;
const DB_PATH = path.join(__dirname, "db.json");
const APPROVAL_QTY_THRESHOLD = Math.max(1, Number(process.env.APPROVAL_QTY_THRESHOLD || 20));

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// ── Helpers ──────────────────────────────────────────────────────
const readDB = () => JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
const writeDB = (data) => fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));

// ── AUTH ─────────────────────────────────────────────────────────
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const db = readDB();
  const user = db.users.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ error: "Username atau password salah" });
  const { password: _, ...safeUser } = user;
  res.json({ user: safeUser });
});

// ── MASTER DATA ───────────────────────────────────────────────────
app.get("/api/admins",      (req, res) => res.json(readDB().admins));
app.get("/api/departments", (req, res) => res.json(readDB().departments));
app.get("/api/employees",   (req, res) => res.json(readDB().employees));
app.get("/api/work-orders", (req, res) => res.json(readDB().workOrders));

// POST master data
app.post("/api/admins", (req, res) => {
  const db = readDB();
  const item = { id: Date.now(), ...req.body };
  db.admins.push(item);
  writeDB(db);
  res.status(201).json(item);
});

app.post("/api/departments", (req, res) => {
  const db = readDB();
  const item = { id: Date.now(), ...req.body };
  db.departments.push(item);
  writeDB(db);
  res.status(201).json(item);
});

app.post("/api/employees", (req, res) => {
  const db = readDB();
  const item = { id: Date.now(), ...req.body };
  db.employees.push(item);
  writeDB(db);
  res.status(201).json(item);
});

app.post("/api/work-orders", (req, res) => {
  const db = readDB();
  const item = { id: Date.now(), ...req.body };
  db.workOrders.push(item);
  writeDB(db);
  res.status(201).json(item);
});

// DELETE master data
app.delete("/api/admins/:id",      (req, res) => { const db = readDB(); db.admins      = db.admins.filter(x => x.id !== +req.params.id);      writeDB(db); res.json({ ok: true }); });
app.delete("/api/departments/:id", (req, res) => { const db = readDB(); db.departments = db.departments.filter(x => x.id !== +req.params.id); writeDB(db); res.json({ ok: true }); });
app.delete("/api/employees/:id",   (req, res) => { const db = readDB(); db.employees   = db.employees.filter(x => x.id !== +req.params.id);   writeDB(db); res.json({ ok: true }); });
app.delete("/api/work-orders/:id", (req, res) => { const db = readDB(); db.workOrders  = db.workOrders.filter(x => x.id !== +req.params.id);  writeDB(db); res.json({ ok: true }); });

// ── ITEMS (STOK BARANG) ───────────────────────────────────────────
app.get("/api/items", (req, res) => res.json(readDB().items));

app.post("/api/items", (req, res) => {
  const db = readDB();
  const item = { id: Date.now(), ...req.body };
  db.items.push(item);
  writeDB(db);
  res.status(201).json(item);
});

app.put("/api/items/:id", (req, res) => {
  const db = readDB();
  const idx = db.items.findIndex(i => i.id === +req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Item tidak ditemukan" });
  db.items[idx] = { ...db.items[idx], ...req.body };
  writeDB(db);
  res.json(db.items[idx]);
});

app.delete("/api/items/:id", (req, res) => {
  const db = readDB();
  db.items = db.items.filter(i => i.id !== +req.params.id);
  writeDB(db);
  res.json({ ok: true });
});

// ── TRANSACTIONS ─────────────────────────────────────────────────
app.get("/api/transactions", (req, res) => {
  const scope = String(req.query.scope || "out").toLowerCase();
  const approvalStatus = String(req.query.approvalStatus || "").toLowerCase();
  const rows = readDB().transactions || [];
  let filtered =
    scope === "all"
      ? rows
      : rows.filter(t => !t.type || String(t.type).toLowerCase() === "out");
  if (["pending", "approved", "rejected"].includes(approvalStatus)) {
    filtered = filtered.filter(t => String(t?.approvalStatus || "approved").toLowerCase() === approvalStatus);
  }
  res.json(filtered);
});

app.post("/api/transactions", (req, res) => {
  const db = readDB();
  const reqItems = Array.isArray(req.body.items) ? req.body.items : [];
  if (reqItems.length === 0) {
    return res.status(400).json({ error: "Item transaksi tidak boleh kosong" });
  }

  const resolvedItems = [];
  const approvalReasons = [];
  for (const line of reqItems) {
    const itemId = Number(line?.itemId);
    const qtyOut = Number(line?.qty);
    if (!Number.isInteger(qtyOut) || qtyOut <= 0) {
      return res.status(400).json({ error: "Qty keluar harus bilangan bulat > 0" });
    }

    const itemIndex = db.items.findIndex(i => i.id === itemId);
    if (itemIndex === -1) {
      return res.status(404).json({ error: `Item ID ${itemId} tidak ditemukan` });
    }

    const item = db.items[itemIndex];
    const currentStock = Number(item?.stock || 0);
    if (qtyOut > currentStock) {
      return res.status(400).json({ error: `Qty keluar untuk ${item.name} melebihi stok (${currentStock})` });
    }

    const nextQty = currentStock - qtyOut;
    const avgCost = Number(item?.averageCost || 0);
    const totalCostOut = Math.round(qtyOut * avgCost * 100) / 100;

    if (qtyOut > APPROVAL_QTY_THRESHOLD) {
      approvalReasons.push(`Qty ${item.name} melebihi batas approval (${APPROVAL_QTY_THRESHOLD})`);
    }
    if (nextQty < Number(item?.minStock || 0)) {
      approvalReasons.push(`Stok ${item.name} akan di bawah minimum (${Number(item?.minStock || 0)})`);
    }

    resolvedItems.push({ itemIndex, item, qtyOut, nextQty, totalCostOut });
  }

  const needApproval = approvalReasons.length > 0;
  if (!needApproval) {
    resolvedItems.forEach(row => {
      db.items[row.itemIndex] = {
        ...row.item,
        stock: row.nextQty,
      };
    });
  }

  const trx = {
    id: Date.now(),
    type: "out",
    movementType: "keluar",
    ...req.body,
    items: resolvedItems.map(row => ({
      itemId: row.item.id,
      itemName: row.item.name,
      qty: row.qtyOut,
      unit: row.item.unit,
      averageCost: Number(row.item?.averageCost || 0),
      totalCost: row.totalCostOut,
    })),
    totalCostOut: Math.round(resolvedItems.reduce((s, row) => s + row.totalCostOut, 0) * 100) / 100,
    approvalStatus: needApproval ? "pending" : "approved",
    approvalReason: needApproval ? [...new Set(approvalReasons)].join("; ") : "",
    approvalNote: "",
    approvedBy: needApproval ? null : "system",
    approvedAt: needApproval ? null : new Date().toISOString(),
  };

  db.transactions.push(trx);
  writeDB(db);
  res.status(trx.approvalStatus === "pending" ? 202 : 201).json(trx);
});

app.patch("/api/transactions/:id/approval", (req, res) => {
  const db = readDB();
  const id = Number(req.params.id);
  const action = String(req.body?.action || "").toLowerCase();
  const note = String(req.body?.note || "").trim();

  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "ID tidak valid" });
  if (!["approve", "reject"].includes(action)) return res.status(400).json({ error: "Action approval tidak valid" });

  const trxIndex = (db.transactions || []).findIndex(t => t.id === id);
  if (trxIndex === -1) return res.status(404).json({ error: "Transaksi tidak ditemukan" });

  const trx = db.transactions[trxIndex];
  if (String(trx.type || "out").toLowerCase() !== "out") {
    return res.status(400).json({ error: "Hanya transaksi keluar yang bisa di-approval" });
  }
  if (String(trx.approvalStatus || "approved").toLowerCase() !== "pending") {
    return res.status(400).json({ error: "Transaksi ini bukan antrian approval" });
  }

  if (action === "approve") {
    for (const line of Array.isArray(trx.items) ? trx.items : []) {
      const itemIndex = (db.items || []).findIndex(i => i.id === Number(line?.itemId));
      if (itemIndex === -1) return res.status(400).json({ error: `Item ID ${line?.itemId} tidak ditemukan saat approval` });

      const item = db.items[itemIndex];
      const qtyOut = Number(line?.qty || 0);
      const currentStock = Number(item?.stock || 0);
      if (qtyOut > currentStock) {
        return res.status(400).json({ error: `Stok ${item?.name || line?.itemId} tidak cukup saat approval` });
      }

      db.items[itemIndex] = {
        ...item,
        stock: currentStock - qtyOut,
      };
    }
  }

  db.transactions[trxIndex] = {
    ...trx,
    approvalStatus: action === "approve" ? "approved" : "rejected",
    approvalNote: note,
    approvedBy: "admin",
    approvedAt: new Date().toISOString(),
  };

  writeDB(db);
  res.json(db.transactions[trxIndex]);
});

app.delete("/api/transactions/:id", (req, res) => {
  const db = readDB();
  const trx = db.transactions.find(t => t.id === +req.params.id);
  if (!trx) return res.status(404).json({ error: "Transaksi tidak ditemukan" });

  const approvalStatus = String(trx.approvalStatus || "approved").toLowerCase();
  const stockWasDeducted = approvalStatus === "approved" || !trx.approvalStatus;

  if (stockWasDeducted) {
    (trx.items || []).forEach(line => {
      const item = db.items.find(i => i.id === Number(line?.itemId));
      if (!item) return;
      item.stock = Number(item.stock || 0) + Number(line?.qty || 0);
    });
  }

  db.transactions = db.transactions.filter(t => t.id !== +req.params.id);
  writeDB(db);
  res.json({ ok: true });
});

// ── RECEIVES (PENERIMAAN BARANG) ──────────────────────────────────
app.get("/api/receives", (req, res) => res.json(readDB().receives || []));

app.post("/api/receives", (req, res) => {
  const db = readDB();
  const { itemId, qty, poNumber, doNumber, date, admin } = req.body;
  const item = db.items.find(i => i.id === +itemId);
  if (!item) return res.status(404).json({ error: "Item tidak ditemukan" });
  item.stock = (item.stock || 0) + +qty;
  if (!db.receives) db.receives = [];
  const record = { id: Date.now(), itemId: +itemId, itemName: item.name, unit: item.unit, qty: +qty, poNumber, doNumber, date, admin, time: new Date().toTimeString().slice(0,5) };
  db.receives.push(record);
  writeDB(db);
  res.status(201).json(record);
});

app.delete("/api/receives/:id", (req, res) => {
  const db = readDB();
  const rec = db.receives.find(r => r.id === +req.params.id);
  if (rec) {
    const item = db.items.find(i => i.id === rec.itemId);
    if (item) item.stock = Math.max(0, item.stock - rec.qty);
    db.receives = db.receives.filter(r => r.id !== +req.params.id);
  }
  writeDB(db);
  res.json({ ok: true });
});

// ── START ─────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ WMS Backend berjalan di http://localhost:${PORT}`);
});
