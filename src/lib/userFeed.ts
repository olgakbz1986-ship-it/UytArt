import { useAppStore } from "./store";
import { marketProducts } from "./market";
import { VENDORS } from "../data/seed";
import { invalidateSubscriptionCaches } from "./queryClient";

/* ============================================================
   ЛЕНТА ПОДПИСОК ПОЛЬЗОВАТЕЛЯ (тонкий клиентский слой)
   ------------------------------------------------------------
   ЗАДАЧА 4, п.7–п.9: ручная реализация кэша подписок УДАЛЕНА —
   fetchSubscriptions / subsCache / subsInflight, resolveTargetName,
   newItemsCountFor и computeNewCounts больше не нужны: сервер
   (/api/subscriptions, server/repo.cjs) возвращает готовые поля
   target_name / target_avatar / target_url / new_count, а кэш
   полностью берёт на себя TanStack Query (src/hooks/*).

   В этом файле остаются только чистые утилиты ID-пространства:
   currentUserId, канонизация id продавца/автора и функции записи
   на сервер (используются мутациями TanStack Query).
   ============================================================ */

export interface ServerSubscription {
  id: string;
  userId: string;
  targetType: string;   /* shop | master | author | category | product */
  targetId: string;     /* каноныzed id продавца (владелец витрины) */
  createdAt: string;
}

/* Единый id покупателя для ВСЕХ запросов к /api/subscriptions.
   ИСПРАВЛЕНИЕ: ранее клиенты читали несуществующий ключ localStorage "userId"
   (никто его никогда не записывал) и молча fallback-или на "demo-user-1",
   из-за чего подписка, созданная под серверным id сессии (JWT sub),
   не находилась в кабинете «Мои подписки» — разрыв ID-пространства.
   Сервер при авторизованной сессии переопределяет этот id своим (req.userId),
   поэтому значение здесь важно только для гостевого демо-режима. */
export const currentUserId = () =>
  useAppStore.getState().session?.userId ||
  "demo-user-1";

/** Единый канон id цели подписки: всегда id владельца-продавца. */
export function canonicalSellerId(p: { [k: string]: any }): string {
  return String((p as any).ownerId || (p as any).sellerId || p.vendorId || "");
}

/** Идентификатор автора цифрового товара (стабильно из id вида "dp-<id>"). */
export function digitalAuthorId(productId: string): string {
  const raw = productId.startsWith("dp-") ? productId.slice(3) : productId;
  return "author-" + String(raw).replace(/[^a-zA-Z0-9_-].*$/, "").slice(0, 12);
}

/** Подписка на сервере (используется кнопкой «Подписаться»). */
export async function subscribeOnServer(targetType: string, targetId: string): Promise<boolean> {
  const userId = currentUserId();
  /* ИСПРАВЛЕНИЕ: канонизация цели на клиенте. Если цель — демо-вендор
     seed-каталога (id вида "vendor-*"), находим реального владельца
     витрины по товару этого вендора на витрине; иначе кабинет «Мои
     подписки» не смог бы резолвить магазин и показать его ленту.
     Если резолв невозможен — не пишем подписку на фантомную цель. */
  if (targetType === "shop" && /^vendor-/.test(String(targetId))) {
    const own = marketProducts().find((x: any) => String(x.vendorId || "") === String(targetId));
    const real = own ? canonicalSellerId(own as any) : "";
    if (!real) {
      console.warn("[subscriptions] цель-вендор не резолвится в продавца:", targetId);
      return false;
    }
    targetId = real;
  }
  const res = await fetch("/api/subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-user-id": userId },
    body: JSON.stringify({ targetType, targetId }),
    credentials: "include",
  });
  const data = await res.json().catch(() => null);
  if (data && data.ok) {
    /* ЗАДАЧА 4: кэш подписок ведёт TanStack Query — после записи
       инвалидируем запросы, список и кнопка перечитаются с сервера. */
    invalidateSubscriptionCaches();
    return true;
  }
  return false;
}

/** Отписка на сервере. */
export async function unsubscribeOnServer(targetType: string, targetId: string): Promise<boolean> {
  const userId = currentUserId();
  const res = await fetch(`/api/subscriptions/${encodeURIComponent(targetType)}/${encodeURIComponent(targetId)}`, {
    method: "DELETE",
    headers: { "x-user-id": userId },
    credentials: "include",
  });
  const data = await res.json().catch(() => null);
  if (data && data.ok) {
    invalidateSubscriptionCaches();
    return true;
  }
  return false;
}

/* ============================================================
   Совместимость с прежним API (ЗАДАЧА 4, п.7–п.8): ручные кэш
   (subsCache/subsInflight), резолвер resolveTargetName и клиентские
   счётчики (newItemsCountFor/computeNewCounts) удалены — сервер
   возвращает готовые target_name / new_count. Хук useUserSubscriptions
   сохранён как тонкая адаптация над TanStack Query, чтобы старые
   импорты (SubscribeButton) продолжали работать от единого источника
   истины /api/subscriptions.
   ============================================================ */
import { useSubscriptions as useTQSubscriptions } from "../hooks/useSubscriptions";
import type { SubscriptionItem } from "../hooks/useSubscriptions";

/** Прежний хук подписок — теперь поверх TanStack Query (кэш автоматический). */
export function useUserSubscriptions(): {
  subscriptions: Array<{ id: string; targetType: string; targetId: string; name: string | null }>;
  loading: boolean;
  error: unknown;
  refresh: () => void;
} {
  const q = useTQSubscriptions({ limit: 100 });
  const subscriptions = (q.data ?? []).map((s: SubscriptionItem) => ({
    id: s.id,
    targetType: s.target_type,
    targetId: s.target_id,
    name: s.target_name,
  }));
  return {
    subscriptions,
    loading: q.isLoading,
    error: q.error,
    refresh: () => {
      void q.refetch();
    },
  };
}
