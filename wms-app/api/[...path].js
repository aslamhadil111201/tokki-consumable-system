import fs from "fs";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v2 as cloudinary } from "cloudinary";
import { MongoClient } from "mongodb";

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.MONGO_DB_NAME || "tokki_consumable";
const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret-in-vercel";
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;
const AUDIT_RETENTION_DAYS = Math.max(1, Number(process.env.AUDIT_RETENTION_DAYS || 90));
const AUDIT_CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;

const MASTER_MAP = {
  admins: "admins",
  departments: "departments",
  employees: "employees",
  "work-orders": "workOrders",
};
const ADMIN_DATA_COLLECTIONS = ["users", "admins", "departments", "employees", "workOrders", "items", "transactions", "receives", "auditLogs"];

const toNumber = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const roundMoney = (v) => Math.round(toNumber(v) * 100) / 100;

const globalForMongo = globalThis;

if (!globalForMongo.__tokkiMongoClientPromise) {
  if (MONGO_URI) {
    // Keep pool small in serverless to avoid wasting Atlas connections per instance.
    const client = new MongoClient(MONGO_URI, {
      maxPoolSize: 5,
      minPoolSize: 0,
      maxIdleTimeMS: 20000,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 30000,
    });
    globalForMongo.__tokkiMongoClientPromise = client.connect();
  }
}

let seedDone = false;
let lastAuditCleanupAt = 0;

function sendJson(res, status, payload) {
  res.status(status).json(payload);
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body || "{}");
    } catch {
      return {};
    }
  }
  return req.body;
}

function parsePath(req) {
  const url = new URL(req.url, "http://localhost");
  return url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
}

function loadSeedDb() {
  try {
    const raw = fs.readFileSync(new URL("../data/db.json", import.meta.url), "utf-8");
    return JSON.parse(raw);
  } catch {
    return {
      users: [{ id: 1, username: "admin", password: "admin123", role: "admin", name: "Administrator" }],
      admins: [],
      departments: [],
      employees: [],
      workOrders: [],
      items: [],
      transactions: [],
      receives: [],
    };
  }
}

function buildSeedDocuments(seed) {
  const users = (seed.users || []).map((u) => ({
    id: Number(u.id),
    username: String(u.username || "").trim(),
    passwordHash: bcrypt.hashSync(String(u.password || "admin123"), 10),
    role: (u.role || "operator").toLowerCase() === "admin" ? "admin" : "operator",
    name: u.name || u.username || "User",
  })).filter((u) => u.username);

  if (!users.some((u) => u.role === "admin")) {
    users.push({
      id: users.reduce((m, u) => Math.max(m, Number(u.id || 0)), 0) + 1,
      username: "admin",
      passwordHash: bcrypt.hashSync("admin123", 10),
      role: "admin",
      name: "Administrator",
    });
  }

  if (!users.some((u) => u.role === "operator")) {
    users.push({
      id: users.reduce((m, u) => Math.max(m, Number(u.id || 0)), 0) + 1,
      username: "operator",
      passwordHash: bcrypt.hashSync("operator123", 10),
      role: "operator",
      name: "Operator",
    });
  }

  const cleanedItems = (seed.items || []).map((it) => ({
    ...it,
    photo: typeof it.photo === "string" && it.photo.startsWith("data:image/") ? null : it.photo || null,
  }));

  return {
    users,
    collections: [
      ["admins", seed.admins || []],
      ["departments", seed.departments || []],
      ["employees", seed.employees || []],
      ["workOrders", seed.workOrders || []],
      ["items", cleanedItems],
      ["transactions", seed.transactions || []],
      ["receives", seed.receives || []],
    ],
  };
}

async function getDb() {
  if (!globalForMongo.__tokkiMongoClientPromise) {
    throw new Error("MONGO_URI belum diset di environment");
  }
  const client = await globalForMongo.__tokkiMongoClientPromise;
  return client.db(DB_NAME);
}

async function seedDatabaseIfNeeded(db) {
  if (seedDone) return;

  const usersCount = await db.collection("users").countDocuments();
  if (usersCount > 0) {
    seedDone = true;
    return;
  }

  const seed = loadSeedDb();
  const { users, collections } = buildSeedDocuments(seed);

  if (users.length) await db.collection("users").insertMany(users);
  for (const [name, docs] of collections) {
    if (docs.length) await db.collection(name).insertMany(docs);
  }

  seedDone = true;
}

async function getNextId(db, collectionName) {
  const latest = await db.collection(collectionName).find({}, { projection: { id: 1 } }).sort({ id: -1 }).limit(1).toArray();
  const last = Number(latest[0]?.id || 0);
  return last + 1;
}

function getTokenFromHeader(req) {
  const auth = req.headers?.authorization || req.headers?.Authorization;
  if (!auth || typeof auth !== "string") return "";
  if (!auth.startsWith("Bearer ")) return "";
  return auth.slice(7).trim();
}

function verifyAuth(req) {
  const token = getTokenFromHeader(req);
  if (!token) return { ok: false, error: "Unauthorized" };
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return { ok: true, payload };
  } catch {
    return { ok: false, error: "Token tidak valid atau kadaluarsa" };
  }
}

function isAdminUser(payload) {
  return String(payload?.role || "").toLowerCase() === "admin";
}

function ensureAdmin(payload, res) {
  if (isAdminUser(payload)) return true;
  sendJson(res, 403, { error: "Forbidden: admin only" });
  return false;
}

async function writeAuditLog(db, { actor, action, target, meta }) {
  try {
    await maybeCleanupAuditLogs(db);
    const entry = {
      id: await getNextId(db, "auditLogs"),
      action: String(action || "unknown"),
      target: String(target || ""),
      actor: {
        id: Number(actor?.sub || actor?.id || 0),
        username: String(actor?.username || ""),
        role: String(actor?.role || ""),
      },
      meta: meta || {},
      createdAt: new Date().toISOString(),
    };
    await db.collection("auditLogs").insertOne(entry);
  } catch {
    // Ignore audit write failures so main flow remains available.
  }
}

async function maybeCleanupAuditLogs(db) {
  const now = Date.now();
  if (now - lastAuditCleanupAt < AUDIT_CLEANUP_INTERVAL_MS) return;
  lastAuditCleanupAt = now;

  const cutoffIso = new Date(now - AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await db.collection("auditLogs").deleteMany({ createdAt: { $lt: cutoffIso } });
}

function maybeConfigureCloudinary() {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    return false;
  }
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });
  return true;
}

async function normalizePhoto(photoValue) {
  if (photoValue === null) return null;
  if (!photoValue || typeof photoValue !== "string") return null;

  if (!photoValue.startsWith("data:image/")) {
    return photoValue;
  }

  const cloudinaryReady = maybeConfigureCloudinary();
  if (!cloudinaryReady) {
    throw new Error("Cloudinary belum dikonfigurasi");
  }

  const uploaded = await cloudinary.uploader.upload(photoValue, {
    folder: "tokki-consumable-system/items",
    resource_type: "image",
  });
  return uploaded.secure_url;
}

function validateNewItemPayload(body) {
  const name = String(body?.name || "").trim();
  const itemCode = String(body?.itemCode || "").trim();
  const category = String(body?.category || "").trim();
  const unit = String(body?.unit || "").trim();
  const stock = Number(body?.stock);
  const minStock = Number(body?.minStock);
  const categories = ["APD", "Abrasif", "Cutting Tool", "Material", "Kebersihan"];

  if (!name || name.length < 3 || name.length > 120) {
    return { ok: false, error: "Nama barang harus 3-120 karakter" };
  }
  if (itemCode.length > 40) {
    return { ok: false, error: "Item kode maksimal 40 karakter" };
  }
  if (!categories.includes(category)) {
    return { ok: false, error: "Kategori tidak valid" };
  }
  if (!unit || unit.length > 20) {
    return { ok: false, error: "Satuan harus 1-20 karakter" };
  }
  if (!Number.isInteger(stock) || !Number.isInteger(minStock)) {
    return { ok: false, error: "Stok harus bilangan bulat" };
  }
  if (stock < 0 || minStock < 0 || stock > 1000000 || minStock > 1000000) {
    return { ok: false, error: "Nilai stok harus 0-1000000" };
  }

  return {
    ok: true,
    value: {
      name,
      itemCode,
      category,
      unit,
      stock,
      minStock,
    },
  };
}

function withCostingDefaults(item) {
  const stock = toNumber(item?.stock, 0);
  const averageCost = roundMoney(item?.averageCost);
  const lastPrice = roundMoney(item?.lastPrice);
  const totalValue = roundMoney(item?.totalValue ?? stock * averageCost);
  return {
    ...item,
    stock,
    averageCost,
    lastPrice,
    totalValue,
  };
}

function stripMongoId(doc) {
  if (!doc || typeof doc !== "object") return doc;
  const { _id, ...rest } = doc;
  return rest;
}

function normalizeBackupPayload(body) {
  const root = body && typeof body === "object" ? body : {};
  const payload = (root.backup && typeof root.backup === "object") ? root.backup : root;
  const collectionsRoot = (payload.collections && typeof payload.collections === "object") ? payload.collections : payload;

  const normalized = {};
  let hasAnyCollection = false;
  for (const name of ADMIN_DATA_COLLECTIONS) {
    const docs = Array.isArray(collectionsRoot[name]) ? collectionsRoot[name] : [];
    if (docs.length > 0) hasAnyCollection = true;
    normalized[name] = docs.map(stripMongoId);
  }

  if (!hasAnyCollection) {
    return { ok: false, error: "File backup tidak valid atau kosong" };
  }

  return { ok: true, collections: normalized };
}

async function exportBackup(db) {
  const out = {
    format: "tokki-wms-backup-v1",
    generatedAt: new Date().toISOString(),
    collections: {},
  };

  for (const name of ADMIN_DATA_COLLECTIONS) {
    const docs = await db.collection(name).find({}).toArray();
    out.collections[name] = docs.map(stripMongoId);
  }

  return out;
}

export default async function handler(req, res) {
  try {
    const method = req.method || "GET";
    const parts = parsePath(req);
    const body = parseBody(req);

    if (method === "GET" && parts.length === 0) {
      return sendJson(res, 200, { ok: true, service: "wms-api" });
    }

    if (method === "GET" && parts[0] === "health") {
      return sendJson(res, 200, {
        ok: true,
        mongoConfigured: Boolean(MONGO_URI),
        cloudinaryConfigured: Boolean(CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET),
        jwtConfigured: Boolean(JWT_SECRET),
      });
    }

    const db = await getDb();
    await seedDatabaseIfNeeded(db);

    if (method === "POST" && parts[0] === "login") {
      const { username, password } = body;
      const user = await db.collection("users").findOne({ username: String(username || "") });
      if (!user) return sendJson(res, 401, { error: "Username atau password salah" });

      const passOk = await bcrypt.compare(String(password || ""), String(user.passwordHash || ""));
      if (!passOk) return sendJson(res, 401, { error: "Username atau password salah" });

      const token = jwt.sign(
        {
          sub: user.id,
          username: user.username,
          role: user.role || "admin",
          name: user.name || user.username,
        },
        JWT_SECRET,
        { expiresIn: "12h" },
      );

      await writeAuditLog(db, {
        actor: { id: user.id, username: user.username, role: user.role || "operator" },
        action: "auth.login",
        target: "auth",
      });

      return sendJson(res, 200, {
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role || "admin",
          name: user.name || user.username,
        },
      });
    }

    const auth = verifyAuth(req);
    if (!auth.ok) return sendJson(res, 401, { error: auth.error });

    if (parts[0] === "audit-logs" && method === "GET") {
      if (!ensureAdmin(auth.payload, res)) return;
      const requestUrl = new URL(req.url, "http://localhost");
      const page = Math.max(1, Number(requestUrl.searchParams.get("page") || 1));
      const pageSize = Math.min(50, Math.max(5, Number(requestUrl.searchParams.get("pageSize") || 10)));
      const actor = String(requestUrl.searchParams.get("actor") || "").trim();
      const action = String(requestUrl.searchParams.get("action") || "").trim();
      const from = String(requestUrl.searchParams.get("from") || "").trim();
      const to = String(requestUrl.searchParams.get("to") || "").trim();

      const q = {};
      if (actor) q["actor.username"] = actor;
      if (action) q.action = action;
      if (from || to) {
        q.createdAt = {};
        if (from) q.createdAt.$gte = new Date(`${from}T00:00:00`).toISOString();
        if (to) q.createdAt.$lte = new Date(`${to}T23:59:59.999`).toISOString();
      }

      const col = db.collection("auditLogs");
      const total = await col.countDocuments(q);
      const rows = await col.find(q).sort({ id: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray();
      return sendJson(res, 200, { rows, total, page, pageSize });
    }

    if (parts[0] === "admin" && parts[1] === "reset-dummy" && method === "POST") {
      if (!ensureAdmin(auth.payload, res)) return;

      const seed = loadSeedDb();
      const { users, collections } = buildSeedDocuments(seed);
      const collectionNames = ["users", "admins", "departments", "employees", "workOrders", "items", "transactions", "receives", "auditLogs"];

      for (const name of collectionNames) {
        await db.collection(name).deleteMany({});
      }

      if (users.length) await db.collection("users").insertMany(users);
      for (const [name, docs] of collections) {
        if (docs.length) await db.collection(name).insertMany(docs);
      }

      seedDone = true;
      await writeAuditLog(db, {
        actor: auth.payload,
        action: "admin.resetDummy",
        target: "system",
      });
      return sendJson(res, 200, { ok: true });
    }

    if (parts[0] === "admin" && parts[1] === "backup" && method === "GET") {
      if (!ensureAdmin(auth.payload, res)) return;
      const backup = await exportBackup(db);
      await writeAuditLog(db, {
        actor: auth.payload,
        action: "admin.backupExport",
        target: "system",
        meta: { generatedAt: backup.generatedAt },
      });
      return sendJson(res, 200, backup);
    }

    if (parts[0] === "admin" && parts[1] === "restore" && method === "POST") {
      if (!ensureAdmin(auth.payload, res)) return;

      const parsed = normalizeBackupPayload(body);
      if (!parsed.ok) return sendJson(res, 400, { error: parsed.error });

      for (const name of ADMIN_DATA_COLLECTIONS) {
        await db.collection(name).deleteMany({});
      }

      for (const name of ADMIN_DATA_COLLECTIONS) {
        const docs = parsed.collections[name] || [];
        if (docs.length) await db.collection(name).insertMany(docs);
      }

      seedDone = true;
      await writeAuditLog(db, {
        actor: auth.payload,
        action: "admin.restoreBackup",
        target: "system",
        meta: {
          collections: ADMIN_DATA_COLLECTIONS.reduce((acc, name) => {
            acc[name] = (parsed.collections[name] || []).length;
            return acc;
          }, {}),
        },
      });
      return sendJson(res, 200, { ok: true });
    }

    if (parts[0] in MASTER_MAP) {
      const key = MASTER_MAP[parts[0]];
      const col = db.collection(key);

      if (method === "GET" && parts.length === 1) {
        const docs = await col.find({}).sort({ id: 1 }).toArray();
        return sendJson(res, 200, docs);
      }

      if (method === "POST" && parts.length === 1) {
        if (!ensureAdmin(auth.payload, res)) return;
        const item = { id: await getNextId(db, key), ...body };
        await col.insertOne(item);
        await writeAuditLog(db, {
          actor: auth.payload,
          action: "master.create",
          target: key,
          meta: { id: item.id },
        });
        return sendJson(res, 201, item);
      }

      if (method === "DELETE" && parts.length === 2) {
        if (!ensureAdmin(auth.payload, res)) return;
        const id = Number(parts[1]);
        await col.deleteOne({ id });
        await writeAuditLog(db, {
          actor: auth.payload,
          action: "master.delete",
          target: key,
          meta: { id },
        });
        return sendJson(res, 200, { ok: true });
      }
    }

    if (parts[0] === "items") {
      const itemsCol = db.collection("items");

      if (method === "GET" && parts.length === 1) {
        const items = await itemsCol.find({}).sort({ id: 1 }).toArray();
        const normalized = items.map(withCostingDefaults);
        return sendJson(res, 200, normalized);
      }

      if (method === "POST" && parts.length === 1) {
        if (!ensureAdmin(auth.payload, res)) return;
        const valid = validateNewItemPayload(body);
        if (!valid.ok) return sendJson(res, 400, { error: valid.error });
        const photo = await normalizePhoto(body.photo);
        const item = {
          id: await getNextId(db, "items"),
          ...valid.value,
          photo,
          averageCost: 0,
          lastPrice: 0,
          totalValue: 0,
        };
        await itemsCol.insertOne(item);
        await writeAuditLog(db, {
          actor: auth.payload,
          action: "items.create",
          target: "items",
          meta: { id: item.id, name: item.name },
        });
        return sendJson(res, 201, item);
      }

      if (method === "PUT" && parts.length === 2) {
        if (!ensureAdmin(auth.payload, res)) return;
        const id = Number(parts[1]);
        const prev = await itemsCol.findOne({ id });
        if (!prev) return sendJson(res, 404, { error: "Item tidak ditemukan" });

        const next = { ...body };
        if (Object.prototype.hasOwnProperty.call(body, "photo")) {
          next.photo = await normalizePhoto(body.photo);
        }

        await itemsCol.updateOne({ id }, { $set: next });
        const updated = await itemsCol.findOne({ id });
        await writeAuditLog(db, {
          actor: auth.payload,
          action: "items.update",
          target: "items",
          meta: { id },
        });
        return sendJson(res, 200, updated);
      }

      if (method === "DELETE" && parts.length === 2) {
        if (!ensureAdmin(auth.payload, res)) return;
        const id = Number(parts[1]);
        await itemsCol.deleteOne({ id });
        await writeAuditLog(db, {
          actor: auth.payload,
          action: "items.delete",
          target: "items",
          meta: { id },
        });
        return sendJson(res, 200, { ok: true });
      }
    }

    if (parts[0] === "transactions") {
      const transactionsCol = db.collection("transactions");
      const itemsCol = db.collection("items");

      if (method === "GET" && parts.length === 1) {
        const docs = await transactionsCol.find({}).sort({ id: 1 }).toArray();
        return sendJson(res, 200, docs);
      }

      if (method === "POST" && parts.length === 1) {
        const reqItems = Array.isArray(body.items) ? body.items : [];
        if (reqItems.length === 0) return sendJson(res, 400, { error: "Item transaksi tidak boleh kosong" });

        const resolvedItems = [];
        for (const ci of reqItems) {
          const itemId = Number(ci?.itemId);
          const qtyOut = Number(ci?.qty);
          if (!Number.isInteger(qtyOut) || qtyOut <= 0) {
            return sendJson(res, 400, { error: "Qty keluar harus bilangan bulat > 0" });
          }

          const item = await itemsCol.findOne({ id: itemId });
          if (!item) return sendJson(res, 404, { error: `Item ID ${itemId} tidak ditemukan` });

          const currentQty = toNumber(item.stock, 0);
          if (qtyOut > currentQty) {
            return sendJson(res, 400, { error: `Qty keluar untuk ${item.name} melebihi stok (${currentQty})` });
          }

          const averageCost = roundMoney(item.averageCost);
          const nextQty = currentQty - qtyOut;
          const totalCostOut = roundMoney(qtyOut * averageCost);
          const nextTotalValue = roundMoney(nextQty * averageCost);

          resolvedItems.push({
            source: ci,
            item,
            qtyOut,
            averageCost,
            nextQty,
            totalCostOut,
            nextTotalValue,
          });
        }

        for (const r of resolvedItems) {
          await itemsCol.updateOne(
            { id: r.item.id },
            { $set: { stock: r.nextQty, averageCost: r.averageCost, totalValue: r.nextTotalValue } },
          );
        }

        const trxItems = resolvedItems.map((r) => ({
          ...r.source,
          itemId: Number(r.item.id),
          itemName: r.item.name,
          unit: r.item.unit,
          qty: r.qtyOut,
          averageCost: r.averageCost,
          totalCost: r.totalCostOut,
        }));
        const trx = {
          id: await getNextId(db, "transactions"),
          ...body,
          items: trxItems,
          totalCostOut: roundMoney(resolvedItems.reduce((acc, r) => acc + r.totalCostOut, 0)),
        };

        await transactionsCol.insertOne(trx);
        await writeAuditLog(db, {
          actor: auth.payload,
          action: "transactions.create",
          target: "transactions",
          meta: { id: trx.id, taker: trx.taker, totalCostOut: trx.totalCostOut },
        });
        return sendJson(res, 201, trx);
      }

      if (method === "DELETE" && parts.length === 2) {
        if (!ensureAdmin(auth.payload, res)) return;
        const id = Number(parts[1]);
        await transactionsCol.deleteOne({ id });
        await writeAuditLog(db, {
          actor: auth.payload,
          action: "transactions.delete",
          target: "transactions",
          meta: { id },
        });
        return sendJson(res, 200, { ok: true });
      }
    }

    if (parts[0] === "receives") {
      const receivesCol = db.collection("receives");
      const itemsCol = db.collection("items");

      if (method === "GET" && parts.length === 1) {
        const docs = await receivesCol.find({}).sort({ id: 1 }).toArray();
        return sendJson(res, 200, docs);
      }

      if (method === "POST" && parts.length === 1) {
        if (!ensureAdmin(auth.payload, res)) return;
        const { itemId, qty, poNumber, doNumber, date, admin, buyPrice } = body;
        const qtyIn = Number(qty);
        const purchasePrice = Number(buyPrice);
        if (!Number.isInteger(qtyIn) || qtyIn <= 0) {
          return sendJson(res, 400, { error: "Qty masuk harus bilangan bulat > 0" });
        }
        if (!Number.isFinite(purchasePrice) || purchasePrice < 0) {
          return sendJson(res, 400, { error: "Harga beli harus angka >= 0" });
        }
        const item = await itemsCol.findOne({ id: Number(itemId) });
        if (!item) return sendJson(res, 404, { error: "Item tidak ditemukan" });

        const qtyOld = toNumber(item.stock, 0);
        const avgOld = roundMoney(item.averageCost);
        const avgNew = qtyOld <= 0
          ? roundMoney(purchasePrice)
          : roundMoney(((qtyOld * avgOld) + (qtyIn * purchasePrice)) / (qtyOld + qtyIn));
        const qtyNew = qtyOld + qtyIn;
        const totalValue = roundMoney(qtyNew * avgNew);

        await itemsCol.updateOne(
          { id: item.id },
          {
            $set: {
              stock: qtyNew,
              averageCost: avgNew,
              lastPrice: roundMoney(purchasePrice),
              totalValue,
            },
          },
        );

        const record = {
          id: await getNextId(db, "receives"),
          itemId: Number(itemId),
          itemName: item.name,
          unit: item.unit,
          qty: qtyIn,
          buyPrice: roundMoney(purchasePrice),
          averageCostBefore: avgOld,
          averageCostAfter: avgNew,
          totalValueAfter: totalValue,
          poNumber,
          doNumber,
          date,
          admin,
          time: new Date().toTimeString().slice(0, 5),
        };
        await receivesCol.insertOne(record);
        await writeAuditLog(db, {
          actor: auth.payload,
          action: "receives.create",
          target: "receives",
          meta: { id: record.id, itemId: record.itemId, qty: record.qty, buyPrice: record.buyPrice },
        });
        return sendJson(res, 201, record);
      }

      if (method === "DELETE" && parts.length === 2) {
        if (!ensureAdmin(auth.payload, res)) return;
        const id = Number(parts[1]);
        const rec = await receivesCol.findOne({ id });
        if (rec) {
          const item = await itemsCol.findOne({ id: Number(rec.itemId) });
          if (item) {
            const nextStock = Math.max(0, Number(item.stock || 0) - Number(rec.qty || 0));
            const avg = roundMoney(item.averageCost);
            await itemsCol.updateOne({ id: item.id }, { $set: { stock: nextStock, averageCost: avg, totalValue: roundMoney(nextStock * avg) } });
          }
          await receivesCol.deleteOne({ id });
        }
        await writeAuditLog(db, {
          actor: auth.payload,
          action: "receives.delete",
          target: "receives",
          meta: { id },
        });
        return sendJson(res, 200, { ok: true });
      }
    }

    if (parts[0] === "costing" && parts[1] === "summary" && method === "GET") {
      if (!ensureAdmin(auth.payload, res)) return;
      const items = await db.collection("items").find({}).sort({ id: 1 }).toArray();
      const normalized = items.map(withCostingDefaults);

      const categoriesMap = new Map();
      for (const it of normalized) {
        const key = String(it.category || "Uncategorized");
        const prev = categoriesMap.get(key) || { category: key, itemCount: 0, totalQty: 0, totalValue: 0 };
        prev.itemCount += 1;
        prev.totalQty += toNumber(it.stock, 0);
        prev.totalValue += toNumber(it.totalValue, 0);
        categoriesMap.set(key, prev);
      }

      const categories = [...categoriesMap.values()]
        .map((c) => ({
          ...c,
          totalValue: roundMoney(c.totalValue),
          averageCost: c.totalQty > 0 ? roundMoney(c.totalValue / c.totalQty) : 0,
        }))
        .sort((a, b) => a.category.localeCompare(b.category));

      const totalQty = normalized.reduce((acc, it) => acc + toNumber(it.stock, 0), 0);
      const totalInventoryValue = roundMoney(normalized.reduce((acc, it) => acc + toNumber(it.totalValue, 0), 0));

      return sendJson(res, 200, {
        asOf: new Date().toISOString(),
        totals: {
          items: normalized.length,
          totalQty,
          totalInventoryValue,
        },
        categories,
        items: normalized,
      });
    }

    return sendJson(res, 404, { error: "Endpoint tidak ditemukan" });
  } catch (error) {
    return sendJson(res, 500, {
      error: "Internal server error",
      details: String(error?.message || error),
    });
  }
}
