import { create } from "zustand";
import { persist } from "zustand/middleware";
import { PRODUCTS } from "../data/seed";

export type SellerType = "self_employed" | "ip" | "ooo";
export type UserRole = "buyer" | "seller";

export interface User {
  id: string; name: string; email: string; phone?: string;
  role: UserRole;
  sellerType?: SellerType; /* только для role="seller" */
  avatar?: string;   /* data-URL, до 256px */
  city?: string;
  birth?: string;
  about?: string;
  region?: string;
  tariff?: string; /* ID тарифа */
}

/* Единый объект активной сессии */
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

/* следующий статус для демо-продвижения заказа */
export const NEXT_STATUS: Record<OrderStatus, OrderStatus> = {
  paid: "shipped",
  shipped: "delivered",
  delivered: "received",
  received: "received",
};

interface AppState {
  /* Реестр всех аккаунтов пользователя (по email) */
  accounts: Record<string, User[]>; /* key = email */
  /* Единая активная сессия */
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

  login: (u: User, makeActive?: boolean) => void;
  logout: () => void;
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

      /* Вход: сохраняем аккаунт в реестр по email, опционально делаем активным */
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

      /* Выход: полная очистка активной сессии */
      logout: () => set({ session: null }),

      /* Переключение на другой аккаунт из реестра по email+role */
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
