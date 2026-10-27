/* ============================================================
   Магазин биржи индивидуальных заказов (zustand store).

   ВЫНЕСЕН из src/pages/extras.tsx, чтобы разорвать цикл импортов
   profile.tsx -> extras.tsx -> profile.tsx. Цикл делал невозможным
   переиспользование панелей покупателя в кабинете продавца: при
   circular import модуль profile на момент загрузки extras ещё не
   инициализирован, поэтому BuyerSubscriptionsPanel/BuyerOrdersPanel
   приходили undefined и вкладки «Мои подписки»/«Мои заказы» у
   продавца были пустыми (именно это и наблюдалось в UI).

   Ключ persist ("uyutart-market-v2") сохранён — данные существующих
   пользователей не теряются. extras.tsx реэкспортирует стор, чтобы
   все прежние импорты продолжали работать.
   ============================================================ */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useAppStore } from "./store";
import { useNotifyStore } from "./notify";
import { orderOwnerIdLike } from "./ownership";

export interface MarketOrder {
  id: string; title: string; type: string; desc: string; material: string;
  budget: number; term: string; region: string; refName?: string; refType?: "image" | "video"; coverImage?: string; images?: string[]; moderationIssues?: string[]; moderationWarnings?: string[];
  /* ЭТАП 3 (п.1): единый жёсткий конвейер статусов заказа, синхронизированный
     с серверным ORDER_PIPELINE (server/index.cjs):
     published → in_progress → shipped → delivered → confirmed → completed,
     плюс отмена (cancelled) и служебные pre-publish состояния (draft/moderation). */
  date: string; status: "draft" | "moderation" | "published" | "in_progress" | "shipped" | "delivered" | "confirmed" | "completed" | "cancelled";
  responses: number; myOwn?: boolean;
  /* Владелец заказа (userId автора). Правило владения: только владелец
     может редактировать/удалять заказ и видеть список откликов. */
  ownerId?: string;
  agentPhoto?: string | null; agentItems?: string[]; agentDraft?: boolean;
  // Поля из API
  user_id?: string;
  category?: string;
  budget_min?: number;
  budget_max?: number;
  budget_type?: 'fixed' | 'range' | 'negotiable';
  deadline?: string;
  attachments?: string[];
  created_at?: string;
  updated_at?: string;
}

interface MarketState {
  orders: MarketOrder[];
  responded: string[];
  addOrder: (o: Omit<MarketOrder, "id" | "date" | "status" | "responses" | "myOwn" | "ownerId"> & { master_requested?: string }) => void;
  respond: (id: string) => void;
}

/* Единый признак владельца заказа: ownerId (новый формат) или user_id (серверный формат).
   Реализация делегируется в src/lib/ownership.ts — единый модуль владения,
   изоморфный серверной проверке (ЭТАП 1): клиент и сервер считают владельца по одному правилу. */
export { orderOwnerIdLike as orderOwnerId };

// ===== Агент модерации карточек заказов =====
const MODERATION_RULES: Array<{ id: string; check: (o: any) => boolean; hint: string }> = [
  { id: "title", check: (o) => String(o.title || "").trim().length >= 3, hint: "Название короче 3 символов — сформулируйте, что нужно изготовить." },
  { id: "desc", check: (o) => String(o.desc || "").trim().length >= 10, hint: "Описание короче 10 символов — добавьте деталей: размеры, назначение, пожелания." },
  { id: "budget", check: (o) => Number(o.budget) > 0, hint: "Бюджет не указан или равен 0 — мастерам важно понимать вилку цены." },
  { id: "term", check: (o) => String(o.term || "").trim().length > 0, hint: "Не указан желаемый срок изготовления." },
  { id: "region", check: (o) => String(o.region || "").trim().length > 0, hint: "Не указан регион — мастерам важно понимать географию заказа." },
];
export function moderateOrder(o: any): { issues: string[]; warnings: string[] } {
  const issues = MODERATION_RULES.filter((r) => !r.check(o)).map((r) => r.hint);
  const warnings: string[] = [];
  const hasPhoto = !!(o.coverImage || (Array.isArray(o.images) && o.images.length > 0) || o.agentPhoto);
  if (!hasPhoto) warnings.push("Нет ни одного фото: добавьте обложку — карточки с фото получают больше откликов.");
  return { issues, warnings };
}

export const useMarketStore = create<MarketState>()(
  persist(
    (set) => ({
      orders: [],
      responded: [],
      addOrder: async (o) => {
        /* Правило владения: владелец записывается в момент создания —
           активный авторизованный пользователь. Гость создать заказ не может. */
        const uid = useAppStore.getState().session?.userId || "";
        /* §1.5/§2.2: СЕРВЕРНАЯ проверка лимита активных индивидуальных заказов
           (1 / 3 / 10 / ∞ по тарифу покупателя) до создания заказа. */
        try {
          const { useTariffStore, LimitReachedError } = await import("./tariff");
          await useTariffStore.getState().assertLimit("market_order");
        } catch (e: any) {
          if (e && e.name === "LimitReachedError") {
            useNotifyStore.getState().push({ kind: "alert", title: "Лимит активных заказов исчерпан", text: `Активных заказов: ${e.used} из ${Number.isFinite(e.limit) ? e.limit : "∞"}. Улучшите тариф покупателя, чтобы создавать больше заказов (/plans).`, actionLabel: "Улучшить тариф", deepLink: "/plans" });
          } else {
            useNotifyStore.getState().push({ kind: "alert", title: "Сервер недоступен", text: "Не удалось проверить лимит заказов. Попробуйте позже." });
          }
          return;
        }
        const verdict = moderateOrder(o);
        const newOrder: MarketOrder = { ...o, id: "mo-" + Date.now(), date: new Date().toISOString(), status: (verdict.issues.length ? "moderation" : "published") as any, responses: 0, myOwn: !!uid, ownerId: uid || undefined, moderationIssues: verdict.issues, moderationWarnings: verdict.warnings };
        /* ЭТАП 4 (§4.1): адресный заказ — master_requested уже внутри o;
           сервер перезафиксирует его и invited_by из сессии, подмена невозможна. */
        set((s) => ({ orders: [newOrder, ...s.orders] }));
        useNotifyStore.getState().push(verdict.issues.length ? { kind: "alert", title: "Агент модерации: заказ не опубликован", text: "Замечаний: " + verdict.issues.length + ". " + verdict.issues.join(" ") + " Исправьте и отправьте снова." } : { kind: "report", title: "Агент модерации: заказ опубликован", text: "Карточка прошла все проверки." + (verdict.warnings.length ? " Рекомендации: " + verdict.warnings.join(" ") : "") });

        // Отправляем на сервер
        try {
          const response = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newOrder)
          });
          const data = await response.json();
          if (data.ok) {
            // Обновляем ID заказа на серверный
            set((s) => ({ orders: s.orders.map(ord => ord.id === newOrder.id ? { ...ord, id: data.order.id } : ord) }));
          }
        } catch (e) {
          console.error('[MarketStore] Ошибка отправки заказа на сервер:', e);
        }
      },
      respond: (id) =>
        set((s) => ({
          responded: [...s.responded, id],
          orders: s.orders.map((o) => (o.id === id ? { ...o, responses: o.responses + 1 } : o)),
        })),
    }),
    { name: "uyutart-market-v2" }
  )
);
