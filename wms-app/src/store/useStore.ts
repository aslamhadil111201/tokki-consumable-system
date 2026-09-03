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
  fetchItems: () => Promise<void>;
  fetchTransactions: () => Promise<void>;
  fetchReceives: () => Promise<void>;
  fetchReturns: () => Promise<void>;
  fetchDeliveryNotes: () => Promise<void>;
  fetchShippingAddresses: () => Promise<void>;
  fetchMasters: () => Promise<void>;
  
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
    const token = sessionStorage.getItem("wms_token") || "";
    let user = null;
    try {
      user = JSON.parse(sessionStorage.getItem("wms_user") || "null");
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
      sessionStorage.setItem("wms_token", token);
      sessionStorage.setItem("wms_user", JSON.stringify(user));
      set({ authToken: token, loggedIn: true, user });
    },
    setUser: (user) => set({ user }),
    logout: (message = "") => {
      sessionStorage.removeItem("wms_token");
      sessionStorage.removeItem("wms_user");
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

    // === Specific Fetch Data Methods ===
    fetchItems: async () => {
      try {
        const { supabase } = await import('../lib/supabase');
        const { data } = await supabase.from('items').select('id, name, unit, minStock, stock, category, itemCode, averageCost, lastPrice, totalValue');
        const items = data || [];
        const map: Record<number, any> = {};
        items.forEach((i: any) => { map[Number(i.id)] = i; });
        set({ items, itemMap: map });
      } catch (e) { console.error("fetchItems error", e); }
    },
    fetchTransactions: async () => {
      try {
        const { supabase } = await import('../lib/supabase');
        // Added limit 500 to save egress
        const { data } = await supabase.from('transactions').select('id, taker, dept, workOrder, note, date, time, admin, items, approvalStatus, approvalNote, approvedBy, approvedAt, created_at').order('id', { ascending: false }).limit(500);
        const trx = data || [];
        set({ trx, allHistory: trx });
      } catch (e) { console.error("fetchTransactions error", e); }
    },
    fetchReceives: async () => {
      try {
        const { supabase } = await import('../lib/supabase');
        const { data } = await supabase.from('receives_view').select('id, itemId, itemName, unit, qty, poNumber, doNumber, date, admin, time, buyPrice, created_at, hasAttachment').order('id', { ascending: false }).limit(500);
        set({ receives: data || [] });
      } catch (e) { console.error("fetchReceives error", e); }
    },
    fetchReturns: async () => {
      try {
        const { supabase } = await import('../lib/supabase');
        const { data } = await supabase.from('returns').select('id, employee, itemId, itemName, unit, qty, reason, note, date, time, status').order('id', { ascending: false }).limit(500);
        set({ returns: data || [] });
      } catch (e) { console.error("fetchReturns error", e); }
    },
    fetchDeliveryNotes: async () => {
      try {
        const { supabase } = await import('../lib/supabase');
        const { data } = await supabase.from('delivery_notes').select('id, batch, category, date, project_no, no_kendaraan, destination, attn, full_address, items').order('id', { ascending: false }).limit(500);
        set({ deliveryNotes: data || [] });
      } catch (e) { console.error("fetchDeliveryNotes error", e); }
    },
    fetchShippingAddresses: async () => {
      try {
        const { supabase } = await import('../lib/supabase');
        const { data } = await supabase.from('shipping_addresses').select('id, destination, attn, contact, full_address').order('destination', { ascending: true });
        set({ shippingAddresses: data || [] });
      } catch (e) { console.error("fetchShippingAddresses error", e); }
    },
    fetchMasters: async () => {
      try {
        const { supabase } = await import('../lib/supabase');
        const [admins, depts, emps, wos] = await Promise.all([
          supabase.from('admins').select('id, name'),
          supabase.from('departments').select('id, name'),
          supabase.from('employees').select('id, name, dept'),
          supabase.from('workOrders').select('id, code, project')
        ]);
        set({
          admins: admins.data || [],
          departments: depts.data || [],
          employees: emps.data || [],
          workOrders: wos.data || []
        });
      } catch (e) { console.error("fetchMasters error", e); }
    },

    // === Fetch Data (Supabase) ===
    fetchAll: async () => {
      const { setToast, fetchItems, fetchTransactions, fetchMasters, fetchReceives, fetchReturns } = get();
      try {
        await Promise.all([
          fetchItems(),
          fetchTransactions()
        ]);
        set({ dataReady: true });
        
        // Fetch others async without awaiting to speed up main render
        fetchMasters();
        fetchReceives();
        fetchReturns();
      } catch (e: any) {
        setToast(e?.message || "Gagal terhubung ke Supabase", "err");
      }
    },





    deleteItem: async (id: string | number) => {
      const { fetchAll, setToast } = get();
      try {
        const { supabase } = await import('../lib/supabase');
        const { error } = await supabase.from('items').delete().eq('id', id);
        if (error) throw error;
        setToast("Barang berhasil dihapus ✓", "ok");
        // Realtime will handle refetch
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
        // Realtime will handle refetch
        return { ok: true };
      } catch (e: any) {
        setToast(e.message || "Gagal menghapus data retur", "err");
        return { ok: false, error: e };
      }
    }
  };
});
