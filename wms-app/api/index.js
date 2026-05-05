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
const APPROVAL_QTY_THRESHOLD = Math.max(1, Number(process.env.APPROVAL_QTY_THRESHOLD || 20));
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const ALERT_EMAIL = process.env.ALERT_EMAIL || "";

// ── EMAIL ALERT ───────────────────────────────────────────────────
const sendStockAlertEmail = async (lowItems) => {
  if (!RESEND_API_KEY || !ALERT_EMAIL || !lowItems.length) return;
  try {
    const cards = lowItems.map(it => {
      const s = Number(it.stock);
      const ms = Number(it.minStock);
      let statusLabel, statusBg, statusColor, stockColor, cardBorder, dotColor;
      if (s === 0) { statusLabel = "HABIS"; statusBg = "#fee2e2"; statusColor = "#dc2626"; stockColor = "#dc2626"; cardBorder = "#fca5a5"; dotColor = "#dc2626"; }
      else if (s <= ms) { statusLabel = "MENIPIS"; statusBg = "#fef9c3"; statusColor = "#92400e"; stockColor = "#e67e22"; cardBorder = "#fde68a"; dotColor = "#facc15"; }
      else { statusLabel = "MENDEKATI"; statusBg = "#ffedd5"; statusColor = "#9a3412"; stockColor = "#ea580c"; cardBorder = "#fdba74"; dotColor = "#fb923c"; }
      const unit = it.unit || "pcs";
      const rowStyle = "display:table;width:100%;margin-top:5px;";
      const labelStyle = "display:table-cell;font-size:12px;color:#9ca3af;width:50%;";
      const valStyle = "display:table-cell;font-size:12px;color:#374151;text-align:right;font-weight:500;";
      return `<div style="border:1.5px solid ${cardBorder};border-radius:8px;padding:11px 13px;margin-bottom:8px;background:#fff;">
        <div style="display:table;width:100%;margin-bottom:4px;">
          <span style="display:table-cell;font-weight:700;color:#111;font-size:13px;word-break:break-word;vertical-align:middle;">${it.name}</span>
          <span style="display:table-cell;text-align:right;vertical-align:middle;white-space:nowrap;">
            <span style="background:${statusBg};color:${statusColor};border-radius:4px;padding:3px 9px;font-size:11px;font-weight:700;display:inline-block;">
              <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${dotColor};margin-right:6px;vertical-align:middle;border:1px solid rgba(0,0,0,0.12);"></span>${statusLabel}
            </span>
          </span>
        </div>
        <div style="${rowStyle}">
          <span style="${labelStyle}">Kategori</span>
          <span style="${valStyle}">${it.category || "-"}</span>
        </div>
        <div style="${rowStyle}">
          <span style="${labelStyle}">Stok saat ini</span>
          <span style="${valStyle.replace("#374151", stockColor)}">${it.stock} ${unit}</span>
        </div>
        <div style="${rowStyle}">
          <span style="${labelStyle}">Min. stok</span>
          <span style="${valStyle}">${it.minStock} ${unit}</span>
        </div>
      </div>`;
    }).join("");

    const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Type" content="text/html;charset=UTF-8"></head><body style="margin:0;padding:0;background:#f3f4f6;">
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:560px;margin:16px auto;background:#f9fafb;padding:16px;border-radius:12px;box-sizing:border-box;">
      <div style="background:linear-gradient(135deg,#059669,#34d399);border-radius:10px;padding:16px 20px;margin-bottom:16px;">
        <div style="font-size:20px;font-weight:800;color:#fff;">🏭 TOKKI - WHS</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.85);margin-top:4px;">Notifikasi Restock Barang</div>
      </div>
      <div style="background:#f9fafb;border-radius:10px;padding:4px 0;margin-bottom:12px;">
        <p style="margin:0 0 8px;color:#374151;font-size:14px;padding:0 4px;">Halo Admin,</p>
        <p style="margin:0 0 12px;color:#374151;font-size:14px;padding:0 4px;">Terdapat <strong>${lowItems.length} item</strong> yang memerlukan restock segera:</p>
        ${cards}
      </div>
      <div style="background:#ecfdf5;border:1px solid #bbf7d0;border-radius:8px;padding:12px 14px;margin-bottom:12px;">
        <p style="margin:0;color:#065f46;font-size:13px;">⚡ Segera lakukan pemesanan ulang untuk menghindari kehabisan stok operasional.</p>
      </div>
      <p style="margin:0;color:#9ca3af;font-size:11px;text-align:center;">TOKKI Engineering &amp; Fabrication · WMS Sistem Gudang · ${new Date().toLocaleString("id-ID",{dateStyle:"full",timeStyle:"short"})}</p>
    </div></body></html>`;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "onboarding@resend.dev",
        to: [ALERT_EMAIL],
        subject: `⚠️ Alert Restock: ${lowItems.length} Item Perlu Ditindak — TOKKI - WHS`,
        html,
      }),
    });
  } catch (_) {
    // silently fail — email is best-effort, don't break main flow
  }
};

const checkAndAlertLowStock = async (db, changedItemIds = []) => {
  if (!RESEND_API_KEY || !ALERT_EMAIL || !changedItemIds.length) return;
  try {
    const itemsCol = db.collection("items");
    const lowItems = await itemsCol.find({
      id: { $in: changedItemIds.map(Number) },
      $expr: { $lte: ["$stock", { $multiply: ["$minStock", 1.5] }] },
    }).toArray();
    if (lowItems.length) await sendStockAlertEmail(lowItems);
  } catch (_) { /* best-effort */ }
};

const MASTER_MAP = {
  admins: "admins",
  departments: "departments",
  employees: "employees",
  "work-orders": "workOrders",
};
const ADMIN_DATA_COLLECTIONS = ["users", "admins", "departments", "employees", "workOrders", "items", "transactions", "receives", "returns", "auditLogs"];

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
let defaultUsersEnsured = false;
let lastAuditCleanupAt = 0;
let lastAutoRejectAt = 0;
const AUTO_REJECT_INTERVAL_MS = 30 * 60 * 1000;

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
      ["returns", seed.returns || []],
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

async function getMongoClient() {
  if (!globalForMongo.__tokkiMongoClientPromise) {
    throw new Error("MONGO_URI belum diset di environment");
  }
  return globalForMongo.__tokkiMongoClientPromise;
}

function withSessionOptions(session, options = {}) {
  return session ? { ...options, session } : options;
}

async function runWithMongoTransaction(work) {
  const client = await getMongoClient();
  const session = client.startSession();

  try {
    let result;
    try {
      await session.withTransaction(async () => {
        result = await work(session);
      });
      return result;
    } catch (error) {
      const message = String(error?.message || error || "");
      if (/Transaction numbers are only allowed|does not support transactions/i.test(message)) {
        return work(null);
      }
      throw error;
    }
  } finally {
    await session.endSession();
  }
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

async function ensureDefaultUsersPresent(db) {
  if (defaultUsersEnsured) return;

  const usersCol = db.collection("users");
  const [adminUser, operatorUser] = await Promise.all([
    usersCol.findOne({ username: "admin" }),
    usersCol.findOne({ username: "operator" }),
  ]);

  if (!adminUser) {
    await usersCol.insertOne({
      id: await getNextId(db, "users"),
      username: "admin",
      passwordHash: bcrypt.hashSync("admin123", 10),
      role: "admin",
      name: "Administrator",
    });
  }

  if (!operatorUser) {
    await usersCol.insertOne({
      id: await getNextId(db, "users"),
      username: "operator",
      passwordHash: bcrypt.hashSync("operator123", 10),
      role: "operator",
      name: "Operator",
    });
  }

  defaultUsersEnsured = true;
}

async function getNextId(db, collectionName, session = null) {
  const latest = await db.collection(collectionName)
    .find({}, withSessionOptions(session, { projection: { id: 1 } }))
    .sort({ id: -1 })
    .limit(1)
    .toArray();
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

function ensureAdminOrOperator(payload, res) {
  const role = String(payload?.role || "").toLowerCase();
  if (role === "admin" || role === "operator") return true;
  sendJson(res, 403, { error: "Forbidden: admin or operator only" });
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

async function runAutoRejectIfNeeded(db) {
  if (Date.now() - lastAutoRejectAt < AUTO_REJECT_INTERVAL_MS) return;
  lastAutoRejectAt = Date.now();
  try {
    const settingsCol = db.collection("settings");
    const setting = await settingsCol.findOne({ key: "autoRejectHours" });
    const hours = Math.max(1, toNumber(setting?.value, 24));
    const cutoff = new Date(Date.now() - hours * 3600000).toISOString();
    const transactionsCol = db.collection("transactions");
    const pending = await transactionsCol.find({ approvalStatus: "pending", createdAt: { $lt: cutoff } }).toArray();
    if (pending.length === 0) return;
    const now = new Date().toISOString();
    const note = `Auto-rejected: tidak ada tindakan dalam ${hours} jam`;
    for (const trx of pending) {
      await transactionsCol.updateOne(
        { id: trx.id },
        { $set: { approvalStatus: "rejected", approvalNote: note, approvedBy: "system", approvedAt: now } },
      );
      await writeAuditLog(db, {
        actor: { id: 0, username: "system", role: "system" },
        action: "transactions.auto_reject",
        target: "transactions",
        meta: { id: trx.id, hours },
      });
    }
  } catch { /* auto-reject errors must not break main flow */ }
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
    const requestUrl = new URL(req.url, "http://localhost");
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
    await ensureDefaultUsersPresent(db);
    maybeCleanupAuditLogs(db).catch(() => {});
    runAutoRejectIfNeeded(db).catch(() => {});

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

    if (parts[0] === "settings") {
      if (method === "GET") {
        const setting = await db.collection("settings").findOne({ key: "autoRejectHours" });
        return sendJson(res, 200, { autoRejectHours: Math.max(1, toNumber(setting?.value, 24)) });
      }
      if (method === "PATCH") {
        if (!ensureAdmin(auth.payload, res)) return;
        const hours = Number(body?.autoRejectHours);
        if (!Number.isFinite(hours) || hours < 1 || hours > 720) {
          return sendJson(res, 400, { error: "autoRejectHours harus antara 1 dan 720" });
        }
        const rounded = Math.round(hours);
        await db.collection("settings").updateOne(
          { key: "autoRejectHours" },
          { $set: { key: "autoRejectHours", value: rounded } },
          { upsert: true },
        );
        await writeAuditLog(db, {
          actor: auth.payload,
          action: "settings.update",
          target: "settings",
          meta: { autoRejectHours: rounded },
        });
        return sendJson(res, 200, { autoRejectHours: rounded });
      }
    }

    if (parts[0] === "audit-logs" && method === "GET") {
      if (!ensureAdmin(auth.payload, res)) return;
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

    if (parts[0] === "admin" && parts[1] === "costing" && parts[2] === "revalue" && method === "POST") {
      if (!ensureAdmin(auth.payload, res)) return;

      const dryRun = Boolean(body?.dryRun);
      const defaultAverageCostRaw = body?.defaultAverageCost;
      const hasDefaultAverageCost = defaultAverageCostRaw !== undefined && defaultAverageCostRaw !== null && defaultAverageCostRaw !== "";
      const defaultAverageCost = hasDefaultAverageCost ? Number(defaultAverageCostRaw) : null;
      if (hasDefaultAverageCost && (!Number.isFinite(defaultAverageCost) || defaultAverageCost < 0)) {
        return sendJson(res, 400, { error: "defaultAverageCost harus angka >= 0" });
      }

      const overrideRows = Array.isArray(body?.items) ? body.items : [];
      const overrides = new Map();
      for (const row of overrideRows) {
        const itemId = Number(row?.itemId ?? row?.id);
        const avg = Number(row?.averageCost);
        if (!Number.isInteger(itemId) || !Number.isFinite(avg) || avg < 0) {
          return sendJson(res, 400, { error: "Setiap override wajib berisi itemId/id dan averageCost >= 0" });
        }
        overrides.set(itemId, avg);
      }

      if (!hasDefaultAverageCost && overrides.size === 0) {
        return sendJson(res, 400, { error: "Kirim defaultAverageCost atau items override" });
      }

      const itemsCol = db.collection("items");
      const items = await itemsCol.find({}).sort({ id: 1 }).toArray();
      const previews = [];

      for (const raw of items) {
        const it = withCostingDefaults(raw);
        const hasOverride = overrides.has(Number(it.id));
        const chosenAvg = hasOverride ? Number(overrides.get(Number(it.id))) : (hasDefaultAverageCost ? Number(defaultAverageCost) : null);
        if (chosenAvg === null) continue;

        const avg = roundMoney(chosenAvg);
        const stock = toNumber(it.stock, 0);
        const totalValue = roundMoney(stock * avg);
        const lastPrice = toNumber(it.lastPrice, 0) > 0 ? roundMoney(it.lastPrice) : avg;

        previews.push({
          itemId: Number(it.id),
          itemName: it.name,
          stock,
          averageCostBefore: roundMoney(it.averageCost),
          averageCostAfter: avg,
          totalValueBefore: roundMoney(it.totalValue),
          totalValueAfter: totalValue,
          lastPriceAfter: lastPrice,
          source: hasOverride ? "override" : "default",
        });
      }

      if (!dryRun) {
        for (const p of previews) {
          await itemsCol.updateOne(
            { id: p.itemId },
            {
              $set: {
                averageCost: p.averageCostAfter,
                totalValue: p.totalValueAfter,
                lastPrice: p.lastPriceAfter,
              },
            },
          );
        }

        await writeAuditLog(db, {
          actor: auth.payload,
          action: "admin.costingRevalue",
          target: "items",
          meta: {
            updatedCount: previews.length,
            mode: hasDefaultAverageCost ? "default+overrides" : "overrides",
          },
        });
      }

      return sendJson(res, 200, {
        ok: true,
        dryRun,
        updatedCount: previews.length,
        previews,
      });
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
        if (!ensureAdminOrOperator(auth.payload, res)) return;
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
        const scope = String(requestUrl.searchParams.get("scope") || "out").toLowerCase();
        const statusFilter = String(requestUrl.searchParams.get("approvalStatus") || "").toLowerCase();
        const query = scope === "all"
          ? {}
          : { $or: [{ type: { $exists: false } }, { type: "out" }] };
        if (["pending", "approved", "rejected"].includes(statusFilter)) {
          query.approvalStatus = statusFilter;
        }
        const docs = await transactionsCol.find(query).sort({ id: 1 }).toArray();
        return sendJson(res, 200, docs);
      }

      if (method === "POST" && parts.length === 1) {
        const reqItems = Array.isArray(body.items) ? body.items : [];
        if (reqItems.length === 0) return sendJson(res, 400, { error: "Item transaksi tidak boleh kosong" });

        const trx = await runWithMongoTransaction(async (session) => {
          const resolvedItems = [];
          const approvalReasons = [];
          for (const ci of reqItems) {
            const itemId = Number(ci?.itemId);
            const qtyOut = Number(ci?.qty);
            if (!Number.isInteger(qtyOut) || qtyOut <= 0) {
              throw new Error("Qty keluar harus bilangan bulat > 0");
            }

            const item = await itemsCol.findOne({ id: itemId }, withSessionOptions(session));
            if (!item) throw new Error(`Item ID ${itemId} tidak ditemukan`);

            const currentQty = toNumber(item.stock, 0);
            if (qtyOut > currentQty) {
              throw new Error(`Qty keluar untuk ${item.name} melebihi stok (${currentQty})`);
            }

            const averageCost = roundMoney(item.averageCost);
            const nextQty = currentQty - qtyOut;
            const totalCostOut = roundMoney(qtyOut * averageCost);
            const nextTotalValue = roundMoney(nextQty * averageCost);

            if (qtyOut > APPROVAL_QTY_THRESHOLD) {
              approvalReasons.push(`Qty ${item.name} melebihi batas approval (${APPROVAL_QTY_THRESHOLD})`);
            }

            if (nextQty < toNumber(item.minStock, 0)) {
              approvalReasons.push(`Stok ${item.name} akan di bawah minimum (${toNumber(item.minStock, 0)})`);
            }

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

          const trxItems = resolvedItems.map((r) => ({
            ...r.source,
            itemId: Number(r.item.id),
            itemName: r.item.name,
            unit: r.item.unit,
            qty: r.qtyOut,
            averageCost: r.averageCost,
            totalCost: r.totalCostOut,
          }));

          const needApproval = approvalReasons.length > 0;
          if (!needApproval) {
            for (const r of resolvedItems) {
              await itemsCol.updateOne(
                { id: r.item.id },
                { $set: { stock: r.nextQty, averageCost: r.averageCost, totalValue: r.nextTotalValue } },
                withSessionOptions(session),
              );
            }
          }

          const nextTransactionId = await getNextId(db, "transactions", session);
          const transactionRow = {
            id: nextTransactionId,
            type: "out",
            movementType: "keluar",
            ...body,
            items: trxItems,
            totalCostOut: roundMoney(resolvedItems.reduce((acc, r) => acc + r.totalCostOut, 0)),
            approvalStatus: needApproval ? "pending" : "approved",
            approvalReason: needApproval ? [...new Set(approvalReasons)].join("; ") : "",
            approvalNote: "",
            approvedBy: needApproval ? null : String(auth.payload?.username || ""),
            approvedAt: needApproval ? null : new Date().toISOString(),
          };

          await transactionsCol.insertOne(transactionRow, withSessionOptions(session));
          return transactionRow;
        });

        await writeAuditLog(db, {
          actor: auth.payload,
          action: trx.approvalStatus === "pending" ? "transactions.pending" : "transactions.create",
          target: "transactions",
          meta: {
            id: trx.id,
            taker: trx.taker,
            totalCostOut: trx.totalCostOut,
            approvalStatus: trx.approvalStatus,
          },
        });
        // Kirim email alert jika transaksi auto-approved dan ada item yang stoknya turun
        if (trx.approvalStatus === "approved") {
          const changedIds = (trx.items || []).map(i => Number(i.itemId)).filter(Boolean);
          checkAndAlertLowStock(db, changedIds).catch(() => {});
        }
        return sendJson(res, trx.approvalStatus === "pending" ? 202 : 201, trx);
      }

      if (method === "PATCH" && parts.length === 3 && parts[2] === "approval") {
        if (!ensureAdmin(auth.payload, res)) return;
        const id = Number(parts[1]);
        const action = String(body?.action || "").toLowerCase();
        const note = String(body?.note || "").trim();
        if (!Number.isInteger(id) || id <= 0) return sendJson(res, 400, { error: "ID tidak valid" });
        if (!["approve", "reject"].includes(action)) {
          return sendJson(res, 400, { error: "Action approval tidak valid" });
        }

        const updated = await runWithMongoTransaction(async (session) => {
          const existing = await transactionsCol.findOne({ id }, withSessionOptions(session));
          if (!existing) return null;
          if (String(existing.type || "out").toLowerCase() !== "out") {
            throw new Error("Hanya transaksi keluar yang bisa di-approval");
          }
          if (String(existing.approvalStatus || "approved").toLowerCase() !== "pending") {
            throw new Error("Transaksi ini bukan antrian approval");
          }

          if (action === "approve") {
            for (const line of Array.isArray(existing.items) ? existing.items : []) {
              const itemId = Number(line?.itemId);
              const qtyOut = Number(line?.qty);
              if (!Number.isInteger(itemId) || !Number.isInteger(qtyOut) || qtyOut <= 0) continue;

              const item = await itemsCol.findOne({ id: itemId }, withSessionOptions(session));
              if (!item) throw new Error(`Item ID ${itemId} tidak ditemukan saat approval`);

              const currentQty = toNumber(item.stock, 0);
              if (qtyOut > currentQty) {
                throw new Error(`Stok ${item.name} tidak cukup saat approval`);
              }

              const averageCost = roundMoney(line?.averageCost ?? item.averageCost);
              const nextQty = currentQty - qtyOut;
              await itemsCol.updateOne(
                { id: itemId },
                {
                  $set: {
                    stock: nextQty,
                    averageCost,
                    totalValue: roundMoney(nextQty * averageCost),
                  },
                },
                withSessionOptions(session),
              );
            }
          }

          const approvalStatus = action === "approve" ? "approved" : "rejected";
          await transactionsCol.updateOne(
            { id },
            {
              $set: {
                approvalStatus,
                approvalNote: note,
                approvedBy: String(auth.payload?.username || ""),
                approvedAt: new Date().toISOString(),
              },
            },
            withSessionOptions(session),
          );

          return transactionsCol.findOne({ id }, withSessionOptions(session));
        });

        if (!updated) return sendJson(res, 404, { error: "Transaksi tidak ditemukan" });

        await writeAuditLog(db, {
          actor: auth.payload,
          action: action === "approve" ? "transactions.approve" : "transactions.reject",
          target: "transactions",
          meta: {
            id,
            note,
          },
        });

        // Kirim email alert jika di-approve dan ada item yang stoknya di bawah minimum
        if (action === "approve") {
          const changedIds = (updated.items || []).map(i => Number(i.itemId)).filter(Boolean);
          checkAndAlertLowStock(db, changedIds).catch(() => {});
        }

        return sendJson(res, 200, updated);
      }

      if (method === "DELETE" && parts.length === 2) {
        if (!ensureAdmin(auth.payload, res)) return;
        const id = Number(parts[1]);

        const trx = await runWithMongoTransaction(async (session) => {
          const existing = await transactionsCol.findOne({ id }, withSessionOptions(session));
          if (!existing) return null;

          const trxType = String(existing.type || "out").toLowerCase();
          if (trxType === "in") {
            throw new Error("Gunakan hapus riwayat penerimaan untuk transaksi masuk");
          }

          const approvalStatus = String(existing.approvalStatus || "approved").toLowerCase();
          const stockWasDeducted = approvalStatus === "approved" || !existing.approvalStatus;

          if (stockWasDeducted) {
            for (const line of Array.isArray(existing.items) ? existing.items : []) {
              const itemId = Number(line?.itemId);
              const qtyRestore = Number(line?.qty);
              if (!Number.isInteger(itemId) || !Number.isInteger(qtyRestore) || qtyRestore <= 0) continue;

              const item = await itemsCol.findOne({ id: itemId }, withSessionOptions(session));
              if (!item) continue;

              const averageCost = roundMoney(line?.averageCost ?? item.averageCost);
              const nextQty = toNumber(item.stock, 0) + qtyRestore;
              await itemsCol.updateOne(
                { id: itemId },
                {
                  $set: {
                    stock: nextQty,
                    averageCost,
                    totalValue: roundMoney(nextQty * averageCost),
                  },
                },
                withSessionOptions(session),
              );
            }
          }

          await transactionsCol.deleteOne({ id }, withSessionOptions(session));
          return existing;
        });

        if (!trx) return sendJson(res, 404, { error: "Transaksi tidak ditemukan" });
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
      const transactionsCol = db.collection("transactions");

      if (method === "GET" && parts.length === 1) {
        const docs = await receivesCol.find({}).sort({ id: 1 }).toArray();
        const light = docs.map(({ attachment, ...rest }) => ({ ...rest, hasAttachment: !!attachment }));
        return sendJson(res, 200, light);
      }

      if (method === "GET" && parts.length === 2) {
        const id = Number(parts[1]);
        if (!Number.isInteger(id) || id <= 0) return sendJson(res, 400, { error: "ID tidak valid" });
        const doc = await receivesCol.findOne({ id });
        if (!doc) return sendJson(res, 404, { error: "Tidak ditemukan" });
        return sendJson(res, 200, doc);
      }

      if (method === "POST" && parts.length === 1) {
        if (!ensureAdminOrOperator(auth.payload, res)) return;
        const { itemId, qty, poNumber, doNumber, date, admin, buyPrice, attachment } = body;
        if (attachment != null) {
          if (typeof attachment !== "string" || !attachment.startsWith("data:")) return sendJson(res, 400, { error: "Format lampiran tidak valid" });
          if (attachment.length > 14000000) return sendJson(res, 400, { error: "Ukuran lampiran maks 10MB" });
          const allowed = ["data:image/jpeg;", "data:image/png;", "data:application/pdf;"];
          if (!allowed.some(p => attachment.startsWith(p))) return sendJson(res, 400, { error: "Hanya PDF, JPG, PNG yang diizinkan" });
        }
        const qtyIn = Number(qty);
        const purchasePrice = Number(buyPrice);
        if (!Number.isInteger(qtyIn) || qtyIn <= 0) {
          return sendJson(res, 400, { error: "Qty masuk harus bilangan bulat > 0" });
        }
        if (!Number.isFinite(purchasePrice) || purchasePrice < 0) {
          return sendJson(res, 400, { error: "Harga beli harus angka >= 0" });
        }

        const record = await runWithMongoTransaction(async (session) => {
          const item = await itemsCol.findOne({ id: Number(itemId) }, withSessionOptions(session));
          if (!item) throw new Error("Item tidak ditemukan");

          const qtyOld = toNumber(item.stock, 0);
          const avgOld = roundMoney(item.averageCost);
          const avgNew = qtyOld <= 0
            ? roundMoney(purchasePrice)
            : roundMoney(((qtyOld * avgOld) + (qtyIn * purchasePrice)) / (qtyOld + qtyIn));
          const qtyNew = qtyOld + qtyIn;
          const totalValue = roundMoney(qtyNew * avgNew);
          const receiveId = await getNextId(db, "receives", session);
          const transactionId = await getNextId(db, "transactions", session);
          const time = new Date().toTimeString().slice(0, 5);

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
            withSessionOptions(session),
          );

          const receiveRow = {
            id: receiveId,
            transactionId,
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
            time,
            attachment: attachment || null,
          };
          const transactionRow = {
            id: transactionId,
            type: "in",
            movementType: "masuk",
            receiveId,
            itemId: Number(itemId),
            itemName: item.name,
            unit: item.unit,
            qty: qtyIn,
            buyPrice: roundMoney(purchasePrice),
            averageCostBefore: avgOld,
            averageCostAfter: avgNew,
            totalValueAfter: totalValue,
            totalCostIn: roundMoney(qtyIn * purchasePrice),
            poNumber,
            doNumber,
            date,
            admin,
            time,
            items: [{
              itemId: Number(itemId),
              itemName: item.name,
              unit: item.unit,
              qty: qtyIn,
              buyPrice: roundMoney(purchasePrice),
              averageCostBefore: avgOld,
              averageCostAfter: avgNew,
              totalValueAfter: totalValue,
            }],
          };

          await receivesCol.insertOne(receiveRow, withSessionOptions(session));
          await transactionsCol.insertOne(transactionRow, withSessionOptions(session));
          return receiveRow;
        });

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

        const rec = await runWithMongoTransaction(async (session) => {
          const existing = await receivesCol.findOne({ id }, withSessionOptions(session));
          if (!existing) return null;

          const item = await itemsCol.findOne({ id: Number(existing.itemId) }, withSessionOptions(session));
          if (item) {
            const qtyIn = Number(existing.qty || 0);
            const nextStock = Math.max(0, Number(item.stock || 0) - qtyIn);
            const averageCost = roundMoney(existing.averageCostBefore ?? item.averageCost);
            await itemsCol.updateOne(
              { id: item.id },
              {
                $set: {
                  stock: nextStock,
                  averageCost,
                  totalValue: roundMoney(nextStock * averageCost),
                },
              },
              withSessionOptions(session),
            );
          }

          await receivesCol.deleteOne({ id }, withSessionOptions(session));
          await transactionsCol.deleteOne({ type: "in", receiveId: id }, withSessionOptions(session));
          return existing;
        });

        if (!rec) return sendJson(res, 404, { error: "Riwayat penerimaan tidak ditemukan" });
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

    if (parts[0] === "returns") {
      const returnsCol = db.collection("returns");
      const itemsCol = db.collection("items");

      if (method === "GET" && parts.length === 1) {
        const docs = await returnsCol.find({}).sort({ id: -1 }).toArray();
        return sendJson(res, 200, docs);
      }

      if (method === "POST" && parts.length === 1) {
        const { employee, itemId, qty, reason, note, date, time } = body;
        if (!String(employee || "").trim()) return sendJson(res, 400, { error: "Nama karyawan wajib diisi" });
        const parsedItemId = Number(itemId);
        const parsedQty = Number(qty);
        if (!Number.isInteger(parsedQty) || parsedQty <= 0) return sendJson(res, 400, { error: "Qty harus bilangan bulat > 0" });

        const record = await runWithMongoTransaction(async (session) => {
          const item = await itemsCol.findOne({ id: parsedItemId }, withSessionOptions(session));
          if (!item) throw new Error("Barang tidak ditemukan");

          const nextStock = toNumber(item.stock, 0) + parsedQty;
          const avgCost = roundMoney(item.averageCost);
          await itemsCol.updateOne(
            { id: parsedItemId },
            { $set: { stock: nextStock, totalValue: roundMoney(nextStock * avgCost) } },
            withSessionOptions(session),
          );

          const nextId = await getNextId(db, "returns", session);
          const row = {
            id: nextId,
            employee: String(employee || "").trim(),
            itemId: parsedItemId,
            itemName: item.name,
            unit: item.unit,
            qty: parsedQty,
            reason: String(reason || ""),
            note: String(note || ""),
            date: String(date || ""),
            time: String(time || ""),
            status: "Menunggu",
          };
          await returnsCol.insertOne(row, withSessionOptions(session));
          return row;
        });

        await writeAuditLog(db, {
          actor: auth.payload,
          action: "returns.create",
          target: "returns",
          meta: { id: record.id, employee: record.employee, itemId: record.itemId, qty: record.qty },
        });
        return sendJson(res, 201, record);
      }

      if (method === "PATCH" && parts.length === 2) {
        if (!ensureAdmin(auth.payload, res)) return;
        const id = Number(parts[1]);
        const { status } = body;
        const allowed = ["Diterima", "Menunggu"];
        if (!allowed.includes(status)) return sendJson(res, 400, { error: "Status tidak valid" });
        const result = await returnsCol.findOneAndUpdate({ id }, { $set: { status } }, { returnDocument: "after" });
        if (!result) return sendJson(res, 404, { error: "Retur tidak ditemukan" });
        return sendJson(res, 200, result);
      }
    }

    return sendJson(res, 404, { error: "Endpoint tidak ditemukan" });
  } catch (error) {
    return sendJson(res, 500, {
      error: "Internal server error",
      details: String(error?.message || error),
    });
  }
}
