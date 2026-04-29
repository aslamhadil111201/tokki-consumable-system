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

const MASTER_MAP = {
  admins: "admins",
  departments: "departments",
  employees: "employees",
  "work-orders": "workOrders",
};

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

    if (parts[0] === "admin" && parts[1] === "reset-dummy" && method === "POST") {
      if (!ensureAdmin(auth.payload, res)) return;

      const seed = loadSeedDb();
      const { users, collections } = buildSeedDocuments(seed);
      const collectionNames = ["users", "admins", "departments", "employees", "workOrders", "items", "transactions", "receives"];

      for (const name of collectionNames) {
        await db.collection(name).deleteMany({});
      }

      if (users.length) await db.collection("users").insertMany(users);
      for (const [name, docs] of collections) {
        if (docs.length) await db.collection(name).insertMany(docs);
      }

      seedDone = true;
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
        return sendJson(res, 201, item);
      }

      if (method === "DELETE" && parts.length === 2) {
        if (!ensureAdmin(auth.payload, res)) return;
        const id = Number(parts[1]);
        await col.deleteOne({ id });
        return sendJson(res, 200, { ok: true });
      }
    }

    if (parts[0] === "items") {
      const itemsCol = db.collection("items");

      if (method === "GET" && parts.length === 1) {
        const items = await itemsCol.find({}).sort({ id: 1 }).toArray();
        return sendJson(res, 200, items);
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
        };
        await itemsCol.insertOne(item);
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
        return sendJson(res, 200, updated);
      }

      if (method === "DELETE" && parts.length === 2) {
        if (!ensureAdmin(auth.payload, res)) return;
        const id = Number(parts[1]);
        await itemsCol.deleteOne({ id });
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
        const trx = { id: await getNextId(db, "transactions"), ...body };

        for (const ci of trx.items || []) {
          const item = await itemsCol.findOne({ id: Number(ci.itemId) });
          if (!item) continue;
          const nextStock = Math.max(0, Number(item.stock || 0) - Number(ci.qty || 0));
          await itemsCol.updateOne({ id: item.id }, { $set: { stock: nextStock } });
        }

        await transactionsCol.insertOne(trx);
        return sendJson(res, 201, trx);
      }

      if (method === "DELETE" && parts.length === 2) {
        if (!ensureAdmin(auth.payload, res)) return;
        const id = Number(parts[1]);
        await transactionsCol.deleteOne({ id });
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
        const { itemId, qty, poNumber, doNumber, date, admin } = body;
        const item = await itemsCol.findOne({ id: Number(itemId) });
        if (!item) return sendJson(res, 404, { error: "Item tidak ditemukan" });

        const nextStock = Number(item.stock || 0) + Number(qty || 0);
        await itemsCol.updateOne({ id: item.id }, { $set: { stock: nextStock } });

        const record = {
          id: await getNextId(db, "receives"),
          itemId: Number(itemId),
          itemName: item.name,
          unit: item.unit,
          qty: Number(qty || 0),
          poNumber,
          doNumber,
          date,
          admin,
          time: new Date().toTimeString().slice(0, 5),
        };
        await receivesCol.insertOne(record);
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
            await itemsCol.updateOne({ id: item.id }, { $set: { stock: nextStock } });
          }
          await receivesCol.deleteOne({ id });
        }
        return sendJson(res, 200, { ok: true });
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
