/* ============================================================
   Мутации подписок через TanStack Query (ЗАДАЧА 4, п.14–п.15):
   subscribe / unsubscribe / markRead — с оптимистичным обновлением
   кэша списка подписок и понятными сообщениями об ошибках (п.22).
   ============================================================ */
import { useMutation } from "@tanstack/react-query";
import { queryClient, QK } from "../lib/queryClient";
import { currentUserId } from "../lib/userFeed";
import type { SubscriptionItem } from "./useSubscriptions";

export class SubscriptionError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

/** Понятная причина ошибки подписки для пользователя (п.22). */
export function subscriptionErrorMessage(e: unknown): string {
  if (e instanceof SubscriptionError) {
    if (e.message) return e.message;
    switch (e.status) {
      case 401: return "Сессия истекла — войдите снова";
      case 403: return "Лимит подписок исчерпан";
      case 404: return "Продавец не найден";
      default: return "Сервер ошибся, попробуйте позже";
    }
  }
  if (e instanceof TypeError) return "Сеть недоступна, проверьте подключение";
  return "Не удалось выполнить действие, попробуйте ещё раз";
}

async function postJson(url: string, body?: unknown): Promise<any> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-user-id": currentUserId() },
    credentials: "include",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const d = await r.json().catch(() => null);
  if (!r.ok || !d || d.ok === false) {
    throw new SubscriptionError((d && (d.error || d.message)) || "", r.status);
  }
  return d;
}

/** п.14: подписка на продавца (POST /api/subscriptions). */
export function useSubscribeMutation() {
  return useMutation({
    mutationFn: ({ targetType, targetId }: { targetType: string; targetId: string }) =>
      postJson("/api/subscriptions", { targetType, targetId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QK.subscriptions });
      queryClient.invalidateQueries({ queryKey: QK.feed });
    },
  });
}

/** отписка (DELETE /api/subscriptions/:targetType/:targetId). */
export function useUnsubscribeMutation() {
  return useMutation({
    mutationFn: async ({ targetType, targetId }: { targetType: string; targetId: string }) => {
      const r = await fetch(
        `/api/subscriptions/${encodeURIComponent(targetType)}/${encodeURIComponent(targetId)}`,
        { method: "DELETE", headers: { "x-user-id": currentUserId() }, credentials: "include" }
      );
      const d = await r.json().catch(() => null);
      if (!r.ok || !d || d.ok === false) {
        throw new SubscriptionError((d && (d.error || d.message)) || "", r.status);
      }
      return d;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QK.subscriptions });
      queryClient.invalidateQueries({ queryKey: QK.feed });
    },
  });
}

/** п.15: отметить подписку прочитанной (POST .../read) — new_count становится 0. */
export function useMarkSubscriptionReadMutation() {
  return useMutation({
    mutationFn: ({ targetType, targetId }: { targetType: string; targetId: string }) =>
      postJson(`/api/subscriptions/${encodeURIComponent(targetType)}/${encodeURIComponent(targetId)}/read`),
    onSuccess: (_data, { targetType, targetId }) => {
      /* мгновенно обнуляем счётчик во всех закэшированных страницах списка */
      queryClient.setQueriesData<{ pages: any[] } | any>({ queryKey: QK.subscriptions }, (old: any) => {
        const upd = (list: SubscriptionItem[]) =>
          list.map((s) =>
            s.target_type === targetType && String(s.target_id) === String(targetId)
              ? { ...s, new_count: 0, last_seen_at: new Date().toISOString() }
              : s
          );
        if (Array.isArray(old)) return upd(old);
        if (old && Array.isArray(old.pages)) return { ...old, pages: old.pages.map((p: any) => ({ ...p, subscriptions: upd(p.subscriptions || []) })) };
        return old;
      });
      queryClient.invalidateQueries({ queryKey: QK.subscriptions });
    },
  });
}
