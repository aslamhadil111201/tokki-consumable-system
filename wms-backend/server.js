const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3001;
const DB_PATH = path.join(__dirname, "db.json");

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
app.get("/api/transactions", (req, res) => res.json(readDB().transactions));

app.post("/api/transactions", (req, res) => {
  const db = readDB();
  const trx = { id: Date.now(), ...req.body };

  // Kurangi stok
  trx.items.forEach(ci => {
    const item = db.items.find(i => i.id === ci.itemId);
    if (item) item.stock = Math.max(0, item.stock - ci.qty);
  });

  db.transactions.push(trx);
  writeDB(db);
  res.status(201).json(trx);
});

app.delete("/api/transactions/:id", (req, res) => {
  const db = readDB();
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
