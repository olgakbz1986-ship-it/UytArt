import { useAppStore } from "./store";
import { marketProducts } from "./market";
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

/* ЗАДАЧА ЗАВЕРШЕНИЯ, п.4: мёртвый код удалён полностью:
   - интерфейс ServerSubscription (нигде не использовался);
   - digitalAuthorId (не вызывается ни в одном компоненте);
   - хук-адаптер useUserSubscriptions (все потребители переведены на
     прямые хуки TanStack Query: useSubscriptions / useFeed +
     мутации из useSubscriptionMutations). */
