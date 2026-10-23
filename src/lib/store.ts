import { create } from "zustand";
import { persist } from "zustand/middleware";
import { PRODUCTS } from "../data/seed";
import { applyServerTariff } from "./tariff";

export type SellerType = "self_employed" | "ip" | "ooo";
export type UserRole = "buyer" | "seller";

export interface User {
  id: string; name: string; email: string; phone?: string;
  role: UserRole;
  sellerType?: SellerType;
  avatar?: string;
  city?: string;
  birth?: string;
  about?: string;
  region?: string;
  tariff?: string;
}

export interface ActiveSession {
  userId: string;
  role: UserRole;
  sellerType?: SellerType;
  name: string;
  email: string;
  phone?: string;
  region?: string;
  tariff?: string;
  avatar?: string;
}

export interface Address { id: string; label: string; city: string; street: string; zip: string; isDefault?: boolean; }
export interface CartItem { productId: string; qty: number; }
export interface BonusEntry { id: string; date: string; amount: number; reason: string; sellerId?: string; sellerName?: string; }
export type OrderStatus = "paid" | "shipped" | "delivered" | "received";
export interface Order {
  id: string;
  number: string;
  date: string;
  status: OrderStatus;
  items: { productId: string; qty: number; price: number }[];
  total: number;
  delivery: number;
  deliveryMethod: string;
  address: string;
  hasCustom: boolean;
  payMethod: string;
}

/* Реестр согласий (Итерация два, Пункт А) */
export interface ConsentRecord {
  document: string;
  version: string;
  timestamp: string;
}

/* Cookie-баннер с категориями (Итерация два, Пункт Б) */
export interface CookieConsentCategories {
  necessary: true;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
}
export interface CookieConsent {
  categories: CookieConsentCategories;
  timestamp: string;
}

export const NEXT_STATUS: Record<OrderStatus, OrderStatus> = {
  paid: "shipped",
  shipped: "delivered",
  delivered: "received",
  received: "received",
};

interface AppState {
  accounts: Record<string, User[]>;
  session: ActiveSession | null;
  cart: CartItem[];
  cartEvents: { productId: string; ts: string }[];
  favorites: string[];
  viewerCity: string | null;
  addresses: Address[];
  orders: Order[];
  bonusBalance: number;
  bonusBySeller: Record<string, number>;
  bonusHistory: BonusEntry[];
  consents: ConsentRecord[];
  cookieConsent: CookieConsent | null;

  addConsent: (c: Omit<ConsentRecord, "timestamp"> & { timestamp?: string }) => ConsentRecord;
  setCookieConsent: (categories: Omit<CookieConsentCategories, "necessary"> & { necessary?: true }) => CookieConsent;

  login: (u: User, makeActive?: boolean) => void;
  logout: () => void;
  authRegister: (p: { name: string; email: string; password: string; role?: string; legalType?: string; consents?: ConsentRecord[] }) => Promise<{ ok: boolean; needConfirm?: boolean; devConfirmUrl?: string; error?: string }>;
  authLogin: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  restoreSession: () => Promise<void>;
  setActiveAccount: (email: string, role: UserRole, sellerType?: SellerType) => void;
  updateUser: (patch: Partial<User>) => void;
  addToCart: (productId: string, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  toggleFav: (productId: string) => void;
  addAddress: (a: Omit<Address, "id">) => void;
  removeAddress: (id: string) => void;
  placeOrder: (o: Omit<Order, "id" | "number" | "date" | "status">) => Order;
  advanceStatus: (id: string) => void;
  confirmReceipt: (id: string) => void;
  setViewerCity: (c: string | null) => void;
  addBonus: (amount: number, reason: string, sellerId?: string, sellerName?: string) => void;
  spendBonuses: (entries: { sellerId: string; amount: number }[]) => void;
}

import { api } from "./api";

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      accounts: {},
      session: null,
      cart: [],
      cartEvents: [],
      favorites: [],
      viewerCity: null,
      addresses: [
        { id: "a1", label: "Дом", city: "Москва", street: "ул. Пятницкая, 18, кв. 47", zip: "115035", isDefault: true },
      ],
      orders: [],
      bonusBalance: 0,
      bonusBySeller: {},
      bonusHistory: [],
      consents: [],
      cookieConsent: null,

      setCookieConsent: (categories) => {
        const rec: CookieConsent = {
          categories: { necessary: true, functional: !!categories.functional, analytics: !!categories.analytics, marketing: !!categories.marketing },
          timestamp: new Date().toISOString(),
        };
        set({ cookieConsent: rec });
        return rec;
      },

      addConsent: (c) => {
        const rec: ConsentRecord = { document: c.document, version: c.version, timestamp: c.timestamp || new Date().toISOString() };
        set((s) => {
          const exists = s.consents.some((x) => x.document === rec.document && x.version === rec.version);
          return exists ? s : { consents: [...s.consents, rec] };
        });
        return rec;
      },

      login: (u, makeActive = true) => set((s) => {
        const emailKey = u.email.toLowerCase();
        const existing = s.accounts[emailKey] || [];
        const existsIdx = existing.findIndex((x) => x.id === u.id);
        let updatedAccounts: Record<string, User[]>;
        if (existsIdx >= 0) {
          updatedAccounts = { ...s.accounts, [emailKey]: [...existing.slice(0, existsIdx), u, ...existing.slice(existsIdx + 1)] };
        } else {
          updatedAccounts = { ...s.accounts, [emailKey]: [...existing, u] };
        }
        let newSession: ActiveSession | null = s.session;
        if (makeActive) {
          newSession = {
            userId: u.id,
            role: u.role,
            sellerType: u.sellerType,
            name: u.name,
            email: u.email,
            phone: u.phone,
            region: u.region,
            tariff: u.tariff,
            avatar: u.avatar,
          };
        }
        return { accounts: updatedAccounts, session: newSession };
      }),

      logout: () => { api.logout().catch(() => {}); set({ session: null }); },

      authRegister: async (p) => api.register(p),
      authLogin: async (email, password) => {
        const r = await api.login(email, password);
        if (!r.ok || !r.profile) return { ok: false, error: r.error };
        const pr = r.profile;
        applyServerTariff(r.tariff);
        useAppStore.getState().login({ id: pr.id, name: pr.name || pr.email.split("@")[0], email: pr.email, phone: pr.phone || "", role: (pr.role as UserRole) || "buyer", tier: pr.tier } as User);
        try {
          const m = await fetch("/api/admin/me", { credentials: "include" }).then((x) => x.json());
          if (m && m.ok && m.profile) {
            (window as any).__QF_ADMIN__ = m.profile;
          }
        } catch { /* сервер недоступен */ }
        return { ok: true } as { ok: true };
      },
      restoreSession: async () => {
        try {
          const r = await api.me();
          if (r.ok && r.profile) {
            const pr = r.profile;
            applyServerTariff(r.tariff);
            useAppStore.getState().login({ id: pr.id, name: pr.name || pr.email.split("@")[0], email: pr.email, phone: pr.phone || "", role: (pr.role as UserRole) || "buyer", tier: pr.tier } as User);
          }
        } catch { /* сервер недоступен */ }
        try {
          const m = await fetch("/api/admin/me", { credentials: "include" }).then((x) => x.json());
          if (m && m.ok && m.profile) {
            (window as any).__QF_ADMIN__ = m.profile;
            if (location.hash.startsWith("#/admin")) { /* уже в кабинете */ }
          }
        } catch { /* нет сервера — демо */ }
      },

      setActiveAccount: (email, role, sellerType) => set((s) => {
        const emailKey = email.toLowerCase();
        const list = s.accounts[emailKey] || [];
        const found = list.find((u) => u.role === role && (!sellerType || u.sellerType === sellerType));
        if (!found) return s;
        return {
          session: {
            userId: found.id,
            role: found.role,
            sellerType: found.sellerType,
            name: found.name,
            email: found.email,
            phone: found.phone,
            region: found.region,
            tariff: found.tariff,
            avatar: found.avatar,
          },
        };
      }),

      updateUser: (patch) => set((s) => {
        if (!s.session) return s;
        const emailKey = s.session.email.toLowerCase();
        const list = s.accounts[emailKey] || [];
        const idx = list.findIndex((u) => u.id === s.session!.userId);
        if (idx < 0) return s;
        const updatedUser = { ...list[idx], ...patch };
        const updatedList = [...list];
        updatedList[idx] = updatedUser;
        return {
          accounts: { ...s.accounts, [emailKey]: updatedList },
          session: { ...s.session, ...patch },
        };
      }),

      addToCart: (productId, qty = 1) =>
        set((s) => {
          const ex = s.cart.find((c) => c.productId === productId);
          const cartEvents = [...s.cartEvents.slice(-499), { productId, ts: new Date().toISOString() }];
          return ex
            ? { cart: s.cart.map((c) => (c.productId === productId ? { ...c, qty: c.qty + qty } : c)), cartEvents }
            : { cart: [...s.cart, { productId, qty }], cartEvents };
        }),
      setQty: (productId, qty) =>
        set((s) => ({
          cart: qty <= 0 ? s.cart.filter((c) => c.productId !== productId) : s.cart.map((c) => (c.productId === productId ? { ...c, qty } : c)),
        })),
      removeFromCart: (productId) => set((s) => ({ cart: s.cart.filter((c) => c.productId !== productId) })),
      clearCart: () => set({ cart: [] }),

      toggleFav: (productId) =>
        set((s) => ({
          favorites: s.favorites.includes(productId) ? s.favorites.filter((f) => f !== productId) : [...s.favorites, productId],
        })),

      setViewerCity: (c) => set({ viewerCity: c }),
      addAddress: (a) => set((s) => ({ addresses: [...s.addresses, { ...a, id: "a" + Date.now() }] })),
      removeAddress: (id) => set((s) => ({ addresses: s.addresses.filter((a) => a.id !== id) })),

      placeOrder: (o) => {
        const order: Order = {
          ...o,
          id: "ord-" + Date.now(),
          number: "UYA-" + Math.floor(1000 + Math.random() * 9000),
          date: new Date().toISOString(),
          status: "paid",
        };
        set((s) => ({ orders: [order, ...s.orders] }));
        return order;
      },
      advanceStatus: (id) =>
        set((s) => ({ orders: s.orders.map((o) => (o.id === id ? { ...o, status: NEXT_STATUS[o.status] } : o)) })),
      confirmReceipt: (id) => set((s) => ({ orders: s.orders.map((o) => (o.id === id ? { ...o, status: "received" } : o)) })),

      addBonus: (amount, reason, sellerId, sellerName) =>
        set((s) => ({
          bonusBalance: s.bonusBalance + amount,
          bonusBySeller: sellerId && amount > 0 ? { ...s.bonusBySeller, [sellerId]: (s.bonusBySeller[sellerId] || 0) + amount } : s.bonusBySeller,
          bonusHistory: [{ id: "b-" + Date.now(), date: new Date().toISOString(), amount, reason, sellerId, sellerName }, ...s.bonusHistory],
        })),
      spendBonuses: (entries) =>
        set((s) => {
          const bySeller = { ...s.bonusBySeller };
          let total = 0;
          entries.forEach((e) => { bySeller[e.sellerId] = Math.max(0, (bySeller[e.sellerId] || 0) - e.amount); total += e.amount; });
          return {
            bonusBalance: Math.max(0, s.bonusBalance - total),
            bonusBySeller: bySeller,
            bonusHistory: [{ id: "b-" + Date.now(), date: new Date().toISOString(), amount: -total, reason: "Списание бонусов при оплате заказа" }, ...s.bonusHistory],
          };
        }),
    }),
    { name: "uyutart-app-v3" }
  )
);
