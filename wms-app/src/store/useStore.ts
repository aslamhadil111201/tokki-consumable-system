// @ts-nocheck
import { create } from 'zustand';
import { updateT } from '../theme/tokens';

interface User {
  id: number;
  username: string;
  role: string;
}

interface StoreState {
  // Auth
  user: User | null;
  loggedIn: boolean;
  authToken: string;
  login: (token: string, user: User) => void;
  logout: (message?: string) => void;
  setUser: (user: User | null) => void;

  // Master Data
  items: any[];
  admins: any[];
  departments: any[];
  employees: any[];
  workOrders: any[];
  itemMap: Record<number, any>;
  
  // Transactions
  trx: any[];
  receives: any[];
  returns: any[];
  allHistory: any[];
  auditRows: any[];
  deliveryNotes: any[];
  shippingAddresses: any[];

  // UI State
  loadingCount: number;
  loadingText: string;
  toastMessage: { msg: string; type: 'ok' | 'err' } | null;
  dataReady: boolean;
  setToast: (msg: string, type?: 'ok' | 'err') => void;
  withLoading: <T>(task: () => Promise<T>, message?: string) => Promise<T>;
  
  // Theme
  dark: boolean;
  toggleTheme: () => void;

  // Actions
  fetchAll: () => Promise<void>;
  saveDeliveryNote: (note: any) => Promise<any>;
  deleteDeliveryNote: (id: string | number) => Promise<any>;
  saveShippingAddress: (address: any) => Promise<any>;
  deleteShippingAddress: (id: string | number) => Promise<any>;
  deleteItem: (id: string | number) => Promise<any>;
  deleteReturn: (id: string | number) => Promise<any>;
}

export const useStore = create<StoreState>((set, get) => {
  const getInitialDark = () => {
    try {
      return localStorage.getItem("wms_dark") === "false" ? false : true;
    } catch {
      return true;
    }
  };

  const getInitialAuth = () => {
    const token = localStorage.getItem("wms_token") || "";
    let user = null;
    try {
      user = JSON.parse(localStorage.getItem("wms_user") || "null");
    } catch {}
    return { token, loggedIn: Boolean(token), user };
  };

  const initialAuth = getInitialAuth();
  const initialDark = getInitialDark();
  updateT(initialDark);

  return {
    // === Auth State ===
    user: initialAuth.user,
    loggedIn: initialAuth.loggedIn,
    authToken: initialAuth.token,
    login: (token, user) => {
      localStorage.setItem("wms_token", token);
      localStorage.setItem("wms_user", JSON.stringify(user));
      set({ authToken: token, loggedIn: true, user });
    },
    setUser: (user) => set({ user }),
    logout: (message = "") => {
      localStorage.removeItem("wms_token");
      localStorage.removeItem("wms_user");
      set({
        loggedIn: false,
        authToken: "",
        user: null,
        items: [],
        trx: [],
        loadingCount: 0,
        loadingText: "Sedang memproses data"
      });
      if (message) {
        get().setToast(message, "err");
      }
    },

    // === Master Data ===
    items: [],
    admins: [],
    departments: [],
    employees: [],
    workOrders: [],
    itemMap: {},

    // === Transactions ===
    trx: [],
    receives: [],
    returns: [],
    allHistory: [],
    auditRows: [],
    deliveryNotes: [],
    shippingAddresses: [],

    // === UI State ===
    loadingCount: 0,
    loadingText: "Sedang memproses data",
    toastMessage: null,
    dataReady: false,
    setToast: (msg, type = 'ok') => {
      set({ toastMessage: { msg, type } });
      setTimeout(() => set({ toastMessage: null }), 3200);
    },
    withLoading: async (task, message = "Sedang memproses data") => {
      set((state) => ({
        loadingText: message,
        loadingCount: state.loadingCount + 1
      }));
      try {
        return await task();
      } finally {
        set((state) => ({ loadingCount: Math.max(0, state.loadingCount - 1) }));
      }
    },

    // === Theme ===
    dark: initialDark,
    toggleTheme: () => {
      set((state) => {
        const next = !state.dark;
        try { localStorage.setItem("wms_dark", String(next)); } catch {}
        updateT(next);
        return { dark: next };
      });
    },

    // === API Utilities ===
    apiFetch: async (path, options = {}) => {
      const { authToken, logout } = get();
      const headers: any = { ...(options.headers || {}) };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      
      const response = await fetch(`${API}${path}`, { ...options, headers });
      if (response.status === 401) {
        logout("Sesi login berakhir, silakan login lagi");
        throw new Error("Sesi login berakhir, silakan login lagi");
      }
      return response;
    },

    // === Fetch Data (Supabase) ===
    fetchAll: async () => {
      const { setToast } = get();
      try {
        const { supabase } = await import('../lib/supabase');

        const [itemsRes, trxRes] = await Promise.all([
          supabase.from('items').select('*'),
          supabase.from('transactions').select('*').order('id', { ascending: false }),
        ]);

        const items = itemsRes.data || [];
        const trx = trxRes.data || [];
        const map: Record<number, any> = {};
        items.forEach((i: any) => { map[Number(i.id)] = i; });
        set({ items, trx, itemMap: map, dataReady: true });

        // Fetch others async
        supabase.from('admins').select('*').then(({ data }) => set({ admins: data || [] }));
        supabase.from('departments').select('*').then(({ data }) => set({ departments: data || [] }));
        supabase.from('employees').select('*').then(({ data }) => set({ employees: data || [] }));
        supabase.from('workOrders').select('*').then(({ data }) => set({ workOrders: data || [] }));
        supabase.from('receives').select('*').order('id', { ascending: false }).then(({ data }) => set({ receives: data || [] }));
        supabase.from('returns').select('*').order('id', { ascending: false }).then(({ data }) => set({ returns: data || [] }));
        supabase.from('delivery_notes').select('*').order('id', { ascending: false }).then(({ data }) => set({ deliveryNotes: data || [] }));
        supabase.from('shipping_addresses').select('*').order('destination', { ascending: true }).then(({ data }) => set({ shippingAddresses: data || [] }));
        // allHistory = combined transactions + receives
        supabase.from('transactions').select('*').order('id', { ascending: false }).then(({ data }) => set({ allHistory: data || [] }));
      } catch (e: any) {
        setToast(e?.message || "Gagal terhubung ke Supabase", "err");
      }
    },

    saveDeliveryNote: async (note: any) => {
      const { fetchAll, setToast } = get();
      try {
        const { supabase } = await import('../lib/supabase');
        let res;
        const payload = {
          batch: note.batch,
          category: note.category,
          date: note.date,
          project_no: note.projectNo,
          no_kendaraan: note.noKendaraan,
          destination: note.destination,
          attn: note.attn,
          full_address: note.fullAddress,
          items: note.items,
        };

        if (note.id && !note.isNew) {
          res = await supabase.from('delivery_notes').update(payload).eq('id', note.id);
        } else {
          res = await supabase.from('delivery_notes').insert([payload]);
        }

        if (res.error) throw res.error;
        setToast("Surat Jalan berhasil disimpan ✓", "ok");
        await fetchAll();
        return { ok: true };
      } catch (e: any) {
        setToast(e.message || "Gagal menyimpan surat jalan", "err");
        return { ok: false, error: e };
      }
    },

    deleteDeliveryNote: async (id: string | number) => {
      const { fetchAll, setToast } = get();
      try {
        const { supabase } = await import('../lib/supabase');
        const { error } = await supabase.from('delivery_notes').delete().eq('id', id);
        if (error) throw error;
        setToast("Surat Jalan berhasil dihapus ✓", "ok");
        await fetchAll();
        return { ok: true };
      } catch (e: any) {
        setToast(e.message || "Gagal menghapus surat jalan", "err");
        return { ok: false, error: e };
      }
    },

    saveShippingAddress: async (addr: any) => {
      const { fetchAll, setToast } = get();
      try {
        const { supabase } = await import('../lib/supabase');
        let res;
        const payload = {
          destination: addr.destination,
          attn: addr.attn,
          contact: addr.contact,
          full_address: addr.fullAddress,
        };

        if (addr.id && !addr.isNew) {
          res = await supabase.from('shipping_addresses').update(payload).eq('id', addr.id);
        } else {
          res = await supabase.from('shipping_addresses').insert([payload]);
        }

        if (res.error) throw res.error;
        setToast("Alamat pengiriman berhasil disimpan ✓", "ok");
        await fetchAll();
        return { ok: true };
      } catch (e: any) {
        setToast(e.message || "Gagal menyimpan alamat pengiriman", "err");
        return { ok: false, error: e };
      }
    },

    deleteShippingAddress: async (id: string | number) => {
      const { fetchAll, setToast } = get();
      try {
        const { supabase } = await import('../lib/supabase');
        const { error } = await supabase.from('shipping_addresses').delete().eq('id', id);
        if (error) throw error;
        setToast("Alamat pengiriman berhasil dihapus ✓", "ok");
        await fetchAll();
        return { ok: true };
      } catch (e: any) {
        setToast(e.message || "Gagal menghapus alamat pengiriman", "err");
        return { ok: false, error: e };
      }
    },

    deleteItem: async (id: string | number) => {
      const { fetchAll, setToast } = get();
      try {
        const { supabase } = await import('../lib/supabase');
        const { error } = await supabase.from('items').delete().eq('id', id);
        if (error) throw error;
        setToast("Barang berhasil dihapus ✓", "ok");
        await fetchAll();
        return { ok: true };
      } catch (e: any) {
        setToast(e.message || "Gagal menghapus barang", "err");
        return { ok: false, error: e };
      }
    },

    deleteReturn: async (id: string | number) => {
      const { fetchAll, setToast, returns } = get();
      try {
        const { supabase } = await import('../lib/supabase');
        
        // Jika retur ini sempat berstatus "Diterima", kurangi kembali stoknya saat data retur dihapus
        const retData = returns.find((r: any) => r.id === Number(id));
        if (retData && retData.status === "Diterima" && retData.itemId) {
          const itemId = Number(retData.itemId);
          const qty = Number(retData.qty || 0);
          if (itemId && qty > 0) {
            const { data: itemData } = await supabase.from('items').select('stock, averageCost').eq('id', itemId).single();
            if (itemData) {
              const newStock = Math.max(0, (itemData.stock || 0) - qty);
              const avgCost = Number(itemData.averageCost || 0);
              const newTotalValue = Math.round(newStock * avgCost * 100) / 100;
              await supabase.from('items').update({
                stock: newStock,
                totalValue: newTotalValue
              }).eq('id', itemId);
            }
          }
        }

        const { error } = await supabase.from('returns').delete().eq('id', id);
        if (error) throw error;
        setToast("Data retur dihapus & stok disesuaikan ✓", "ok");
        await fetchAll();
        return { ok: true };
      } catch (e: any) {
        setToast(e.message || "Gagal menghapus data retur", "err");
        return { ok: false, error: e };
      }
    }
  };
});
