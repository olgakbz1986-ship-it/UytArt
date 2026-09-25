import { create } from "zustand";
import { persist } from "zustand/middleware";

export type NotifyKind = "report" | "question" | "confirm" | "alert";

export interface NotifyItem {
  id: string;
  kind: NotifyKind;
  title: string;
  text: string;
  createdAt: number;
  read: boolean;
  actionLabel?: string;
  actionType?: string;
  payload?: Record<string, unknown>;
  deepLink?: string;
  resolved?: "accepted" | "declined";
}

/* Реестр исполнителей подтверждений: агент зарегистрирует сюда свои действия */
export const notifyActions: Record<string, (payload: Record<string, unknown>) => void> = {};

interface NotifyState {
  items: NotifyItem[];
  push: (n: Omit<NotifyItem, "id" | "createdAt" | "read">) => string;
  markRead: (id: string) => void;
  markAll: () => void;
  remove: (id: string) => void;
  resolve: (id: string, v: "accepted" | "declined") => void;
}

export const useNotifyStore = create<NotifyState>()(
  persist(
    (set) => ({
      items: [],
      push: (n) => {
        const id = "n-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        set((s) => ({ items: [{ ...n, id, createdAt: Date.now(), read: false }, ...s.items].slice(0, 100) }));
        return id;
      },
      markRead: (id) => set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, read: true } : i)) })),
      markAll: () => set((s) => ({ items: s.items.map((i) => ({ ...i, read: true })) })),
      remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      resolve: (id, v) =>
        set((s) => ({
          items: s.items.map((i) => {
            if (i.id !== id) return i;
            if (v === "accepted" && i.actionType && notifyActions[i.actionType]) notifyActions[i.actionType](i.payload || {});
            return { ...i, resolved: v, read: true };
          }),
        })),
    }),
    { name: "quantiform-notify" }
  )
);
