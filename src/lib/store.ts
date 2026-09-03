import { create } from "zustand";
import { persist } from "zustand/middleware";
import { PRODUCTS } from "../data/seed";

export interface User {
  id: string; name: string; email: string; phone?: string;
  role: "buyer" | "seller";
  avatar?: string;   /* data-URL, до 256px */
  city?: string;
  birth?: string;
  about?: string;
}
export interface Address { id: string; label: string; city: string; street: string; zip: string; isDefault?: boolean; }
export interface CartItem { productId: string; qty: number; }
export interface BonusEntry { id: string; date: string; amount: number; reason: string; }
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
  user: User | null;
  cart: CartItem[];
  favorites: string[];
  addresses: Address[];
  orders: Order[];
  bonusBalance: number;
  bonusHistory: BonusEntry[];

  login: (u: User) => void;
  logout: () => void;
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
  addBonus: (amount: number, reason: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      cart: [],
      favorites: [],
      addresses: [
        { id: "a1", label: "Дом", city: "Москва", street: "ул. Пятницкая, 18, кв. 47", zip: "115035", isDefault: true },
      ],
      orders: [
        {
          id: "o1",
          number: "UYA-2481",
          date: new Date(Date.now() - 6 * 864e5).toISOString(),
          status: "shipped",
          items: PRODUCTS.slice(0, 2).map((p) => ({ productId: p.id, qty: 1, price: p.price })),
          total: (PRODUCTS[0]?.price || 0) + (PRODUCTS[1]?.price || 0) + 350,
          delivery: 350,
          deliveryMethod: "СДЭК до пункта выдачи",
          address: "Москва, ул. Пятницкая, 18",
          hasCustom: false,
          payMethod: "Банковская карта (ЮKassa)",
        },
      ],
      bonusBalance: 350,
      bonusHistory: [
        { id: "b1", date: new Date(Date.now() - 12 * 864e5).toISOString(), amount: 300, reason: "Отзыв с фото в интерьере" },
        { id: "b2", date: new Date(Date.now() - 30 * 864e5).toISOString(), amount: 50, reason: "Подтверждение получения" },
      ],

      login: (u) => set({ user: u }),
      logout: () => set({ user: null }),
      updateUser: (patch) => set((s) => ({ user: s.user ? { ...s.user, ...patch } : null })),

      addToCart: (productId, qty = 1) =>
        set((s) => {
          const ex = s.cart.find((c) => c.productId === productId);
          return ex
            ? { cart: s.cart.map((c) => (c.productId === productId ? { ...c, qty: c.qty + qty } : c)) }
            : { cart: [...s.cart, { productId, qty }] };
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

      addBonus: (amount, reason) =>
        set((s) => ({
          bonusBalance: s.bonusBalance + amount,
          bonusHistory: [{ id: "b-" + Date.now(), date: new Date().toISOString(), amount, reason }, ...s.bonusHistory],
        })),
    }),
    { name: "uyutart-app-v2" }
  )
);
