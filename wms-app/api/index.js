import fs from "fs";

const FALLBACK_DB = {
  users: [{ id: 1, username: "admin", password: "admin123", name: "Administrator", role: "admin" }],
  admins: [],
  departments: [],
  employees: [],
  workOrders: [],
  items: [],
  transactions: [],
  receives: [],
};

const TMP_DB = "/tmp/wms-db.json";

function loadSeedDb() {
  try {
    const raw = fs.readFileSync(new URL("../data/db.json", import.meta.url), "utf-8");
    return JSON.parse(raw);
  } catch {
    return FALLBACK_DB;
  }
}

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

function ensureDbFile() {
  if (!fs.existsSync(TMP_DB)) {
    const seedDb = loadSeedDb();
    fs.writeFileSync(TMP_DB, JSON.stringify(seedDb, null, 2), "utf-8");
  }
}

function readDb() {
  ensureDbFile();
  return JSON.parse(fs.readFileSync(TMP_DB, "utf-8"));
}

function writeDb(data) {
  fs.writeFileSync(TMP_DB, JSON.stringify(data, null, 2), "utf-8");
}

function parsePath(req) {
  const url = new URL(req.url, "http://localhost");
  const parts = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  return parts;
}

export default function handler(req, res) {
  try {
    const method = req.method || "GET";
    const parts = parsePath(req);
    const body = parseBody(req);

    if (method === "GET" && parts.length === 0) {
      return sendJson(res, 200, { ok: true, service: "wms-api" });
    }

    if (method === "POST" && parts[0] === "login") {
      const db = readDb();
      const { username, password } = body;
      const user = db.users.find(
        (u) => u.username === username && u.password === password,
      );
      if (!user) return sendJson(res, 401, { error: "Username atau password salah" });
      const { password: _ignored, ...safeUser } = user;
      return sendJson(res, 200, { user: safeUser });
    }

    const masterMap = {
      admins: "admins",
      departments: "departments",
      employees: "employees",
      "work-orders": "workOrders",
    };

    if (parts[0] in masterMap) {
      const key = masterMap[parts[0]];
      const db = readDb();

      if (method === "GET" && parts.length === 1) {
        return sendJson(res, 200, db[key] || []);
      }

      if (method === "POST" && parts.length === 1) {
        const item = { id: Date.now(), ...body };
        db[key] = db[key] || [];
        db[key].push(item);
        writeDb(db);
        return sendJson(res, 201, item);
      }

      if (method === "DELETE" && parts.length === 2) {
        const id = Number(parts[1]);
        db[key] = (db[key] || []).filter((x) => Number(x.id) !== id);
        writeDb(db);
        return sendJson(res, 200, { ok: true });
      }
    }

    if (parts[0] === "items") {
      const db = readDb();

      if (method === "GET" && parts.length === 1) {
        return sendJson(res, 200, db.items || []);
      }

      if (method === "POST" && parts.length === 1) {
        const item = { id: Date.now(), ...body };
        db.items = db.items || [];
        db.items.push(item);
        writeDb(db);
        return sendJson(res, 201, item);
      }

      if (method === "PUT" && parts.length === 2) {
        const id = Number(parts[1]);
        const idx = (db.items || []).findIndex((i) => Number(i.id) === id);
        if (idx === -1) return sendJson(res, 404, { error: "Item tidak ditemukan" });
        db.items[idx] = { ...db.items[idx], ...body };
        writeDb(db);
        return sendJson(res, 200, db.items[idx]);
      }

      if (method === "DELETE" && parts.length === 2) {
        const id = Number(parts[1]);
        db.items = (db.items || []).filter((i) => Number(i.id) !== id);
        writeDb(db);
        return sendJson(res, 200, { ok: true });
      }
    }

    if (parts[0] === "transactions") {
      const db = readDb();

      if (method === "GET" && parts.length === 1) {
        return sendJson(res, 200, db.transactions || []);
      }

      if (method === "POST" && parts.length === 1) {
        const trx = { id: Date.now(), ...body };
        db.items = db.items || [];
        db.transactions = db.transactions || [];

        (trx.items || []).forEach((ci) => {
          const item = db.items.find((i) => Number(i.id) === Number(ci.itemId));
          if (item) item.stock = Math.max(0, Number(item.stock || 0) - Number(ci.qty || 0));
        });

        db.transactions.push(trx);
        writeDb(db);
        return sendJson(res, 201, trx);
      }

      if (method === "DELETE" && parts.length === 2) {
        const id = Number(parts[1]);
        db.transactions = (db.transactions || []).filter((t) => Number(t.id) !== id);
        writeDb(db);
        return sendJson(res, 200, { ok: true });
      }
    }

    if (parts[0] === "receives") {
      const db = readDb();
      db.receives = db.receives || [];
      db.items = db.items || [];

      if (method === "GET" && parts.length === 1) {
        return sendJson(res, 200, db.receives);
      }

      if (method === "POST" && parts.length === 1) {
        const { itemId, qty, poNumber, doNumber, date, admin } = body;
        const item = db.items.find((i) => Number(i.id) === Number(itemId));
        if (!item) return sendJson(res, 404, { error: "Item tidak ditemukan" });

        item.stock = Number(item.stock || 0) + Number(qty || 0);
        const record = {
          id: Date.now(),
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
        db.receives.push(record);
        writeDb(db);
        return sendJson(res, 201, record);
      }

      if (method === "DELETE" && parts.length === 2) {
        const id = Number(parts[1]);
        const rec = (db.receives || []).find((r) => Number(r.id) === id);
        if (rec) {
          const item = db.items.find((i) => Number(i.id) === Number(rec.itemId));
          if (item) item.stock = Math.max(0, Number(item.stock || 0) - Number(rec.qty || 0));
          db.receives = db.receives.filter((r) => Number(r.id) !== id);
          writeDb(db);
        }
        return sendJson(res, 200, { ok: true });
      }
    }

    return sendJson(res, 404, { error: "Endpoint tidak ditemukan" });
  } catch (error) {
    return sendJson(res, 500, { error: "Internal server error", details: String(error?.message || error) });
  }
}
