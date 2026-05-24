import { supabase } from './supabase';

// ─── apiFetchProxy ────────────────────────────────────────────────
// Catatan: file ini adalah legacy Supabase proxy yang dipakai sebelum
// migrasi ke direct Supabase calls di useStore.fetchAll().
// Saat ini hanya dipakai untuk endpoint yang belum dimigrasikan.
// window.alert() dan console.log debug sudah dihapus.

export const apiFetchProxy = async (path: string, options: RequestInit = {}) => {
  const method = ((options.method as string) || "GET").toUpperCase();
  const body = options.body ? JSON.parse(options.body as string) : null;

  const res = (data: unknown, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  });

  const errorRes = (msg: string, status = 400) => res({ error: msg }, status);

  try {
    // ── LOGIN ─────────────────────────────────────────────────────────
    if (path === "/login" && method === "POST") {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', body.username)
        .eq('password', body.password);

      if (error) throw error;
      if (data && data.length > 0) {
        const user = data[0];
        const fakeToken = btoa(JSON.stringify({ sub: user.id, username: user.username, role: user.role, name: user.name }));
        return res({ token: fakeToken, user });
      }
      return errorRes("Username atau password salah", 401);
    }

    // ── ITEMS ─────────────────────────────────────────────────────────
    if (path === "/items" && method === "GET") {
      const { data, error } = await supabase.from('items').select('*').order('id', { ascending: true });
      if (error) throw error;
      return res(data);
    }
    if (path === "/items" && method === "POST") {
      const { data, error } = await supabase.from('items').insert([body]).select().single();
      if (error) throw error;
      return res(data, 201);
    }
    if (path.startsWith("/items/") && method === "PUT") {
      const id = path.split("/")[2];
      const { data, error } = await supabase.from('items').update(body).eq('id', id).select().single();
      if (error) throw error;
      return res(data);
    }
    if (path.startsWith("/items/") && method === "DELETE") {
      const id = path.split("/")[2];
      const { error } = await supabase.from('items').delete().eq('id', id);
      if (error) throw error;
      return res({ ok: true });
    }

    // ── TRANSACTIONS ──────────────────────────────────────────────────
    if (path.startsWith("/transactions") && method === "GET") {
      const urlParams = new URLSearchParams(path.split("?")[1] || "");
      let query = supabase.from('transactions').select('*').order('id', { ascending: false });

      const approvalStatus = urlParams.get("approvalStatus");
      if (approvalStatus) {
        query = query.eq('approvalStatus', approvalStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      return res(data);
    }
    if (path === "/transactions" && method === "POST") {
      const { data, error } = await supabase.from('transactions').insert([body]).select().single();
      if (error) throw error;
      return res(data, 201);
    }
    if (path.startsWith("/transactions/") && path.endsWith("/approval") && method === "PATCH") {
      const id = path.split("/")[2];
      const { data, error } = await supabase.from('transactions').update(body).eq('id', id).select().single();
      if (error) throw error;
      return res(data);
    }
    if (path.startsWith("/transactions/") && method === "DELETE") {
      const id = path.split("/")[2];
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) throw error;
      return res({ ok: true });
    }

    // ── RECEIVES ──────────────────────────────────────────────────────
    if (path === "/receives" && method === "GET") {
      const { data, error } = await supabase.from('receives').select('*').order('id', { ascending: false });
      if (error) throw error;
      return res(data);
    }
    if (path === "/receives" && method === "POST") {
      const { data, error } = await supabase.from('receives').insert([body]).select().single();
      if (error) throw error;
      if (data) {
        const { data: itemData } = await supabase.from('items').select('stock').eq('id', body.itemId).single();
        if (itemData) {
          await supabase.from('items').update({ stock: itemData.stock + body.qty }).eq('id', body.itemId);
        }
      }
      return res(data, 201);
    }
    if (path.startsWith("/receives/") && method === "DELETE") {
      const id = path.split("/")[2];
      const { data: rec } = await supabase.from('receives').select('*').eq('id', id).single();
      if (rec) {
        const { data: itemData } = await supabase.from('items').select('stock').eq('id', rec.itemId).single();
        if (itemData) {
          await supabase.from('items').update({ stock: itemData.stock - rec.qty }).eq('id', rec.itemId);
        }
      }
      const { error } = await supabase.from('receives').delete().eq('id', id);
      if (error) throw error;
      return res({ ok: true });
    }

    // ── RETURNS ───────────────────────────────────────────────────────
    if (path === "/returns" && method === "GET") {
      const { data, error } = await supabase.from('returns').select('*').order('id', { ascending: false });
      if (error) throw error;
      return res(data || []);
    }
    if (path === "/returns" && method === "POST") {
      const { data, error } = await supabase.from('returns').insert([body]).select().single();
      if (error) throw error;
      if (data) {
        const { data: itemData } = await supabase.from('items').select('stock').eq('id', body.itemId).single();
        if (itemData) {
          await supabase.from('items').update({ stock: itemData.stock + body.qty }).eq('id', body.itemId);
        }
      }
      return res(data, 201);
    }

    // ── MASTER DATA ───────────────────────────────────────────────────
    const masterRoutes = ["/admins", "/departments", "/employees", "/work-orders"] as const;
    for (const route of masterRoutes) {
      const table = route === "/work-orders" ? "workOrders" : route.slice(1);
      if (path === route && method === "GET") {
        const { data, error } = await supabase.from(table).select('*').order('id');
        if (error) throw error;
        return res(data || []);
      }
      if (path === route && method === "POST") {
        const { data, error } = await supabase.from(table).insert([body]).select().single();
        if (error) throw error;
        return res(data, 201);
      }
      if (path.startsWith(`${route}/`) && method === "DELETE") {
        const id = path.split("/")[2];
        const { error } = await supabase.from(table).delete().eq('id', id);
        if (error) throw error;
        return res({ ok: true });
      }
    }

    // ── SETTINGS ──────────────────────────────────────────────────────
    if (path === "/settings" && method === "GET") {
      const { data, error } = await supabase.from('settings').select('*').limit(1).single();
      if (error) return res({ autoRejectHours: 24 });
      return res(data);
    }
    if (path === "/settings" && method === "PATCH") {
      const { data, error } = await supabase.from('settings').update(body).neq('id', -1).select().single();
      if (error) throw error;
      return res(data);
    }

    // ── AUDIT LOGS ────────────────────────────────────────────────────
    if (path.startsWith("/audit-logs") && method === "GET") {
      const { data, error } = await supabase.from('auditLogs').select('*').order('id', { ascending: false }).limit(100);
      if (error) throw error;
      return res(data || []);
    }

    return errorRes("Not Found", 404);

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error(`apiFetchProxy Error on ${method} ${path}:`, err);
    return errorRes(message, 500);
  }
};
