/* ============================================================
   TanStack Query — единый серверный кэш клиента (ЗАДАЧА 4, п.2)
   Настройки: staleTime 5 минут, retry 1, refetchOnWindowFocus true.
   ============================================================ */
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 минут
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

/* Ключи запросов — единая точка инвалидации (подписки / лента / уведомления). */
export const QK = {
  subscriptions: ["subscriptions"] as const,
  feed: ["feed"] as const,
  notifications: ["notifications"] as const,
  sellerFeed: (id: string | number) => ["seller-feed", String(id)] as const,
};

/** Инвалидация всего, что зависит от подписок пользователя. */
export function invalidateSubscriptionCaches() {
  queryClient.invalidateQueries({ queryKey: QK.subscriptions });
  queryClient.invalidateQueries({ queryKey: QK.feed });
}
