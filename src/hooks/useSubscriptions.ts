/* ============================================================
   Хуки TanStack Query для подписок, ленты и уведомлений
   (ЗАДАЧА 4, п.3–п.6). Сервер возвращает готовые enriched-поля:
   target_name / target_slug / target_avatar / target_url / new_count —
   ручные резолверы и клиентские счётчики на клиенте больше не нужны.
   ============================================================ */
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { QK, queryClient } from "../lib/queryClient";
import { currentUserId } from "../lib/userFeed";

export interface SubscriptionItem {
  id: string;
  user_id: string;
  target_type: string;
  target_id: string;
  target_name: string | null;
  target_slug: string | null;
  target_avatar: string | null;
  target_url: string | null;
  created_at: string;
  updated_at: string | null;
  last_seen_at: string | null;
  new_count: number;
}

export interface FeedItem {
  id: string;
  name: string;
  description?: string;
  price?: number | string;
  image?: string;
  images?: string[];
  seller_id?: string;
  seller_name?: string | null;
  seller_slug?: string | null;
  seller_avatar?: string | null;
  url?: string | null;
  created_at: string;
  is_new?: boolean;
  [k: string]: any;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  text: string;
  link: string | null;
  read: boolean;
  created_at: string;
}

async function getJson(url: string): Promise<any> {
  const r = await fetch(url, { headers: { "x-user-id": currentUserId() }, credentials: "include" });
  if (r.status === 401) {
    const err: any = new Error("Требуется вход в аккаунт");
    err.status = 401;
    throw err;
  }
  const d = await r.json().catch(() => null);
  if (!r.ok || !d || d.ok === false) {
    const err: any = new Error((d && (d.error || d.message)) || "Сервер ошибся, попробуйте позже");
    err.status = r.status;
    throw err;
  }
  return d;
}

function qs(params: Record<string, string | number | undefined | null>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** Ключ кэша списка подписок с параметрами (используется хуками и мутациями). */
export function subsListKey(opts: { sortBy?: string; search?: string; limit?: number } = {}) {
  const { sortBy = "date", search = "", limit = 20 } = opts;
  return [...QK.subscriptions, { sortBy, search, limit }] as const;
}

/** п.3: список подписок (сортировка / поиск через параметры запроса). */
export function useSubscriptions(opts: { sortBy?: string; search?: string; limit?: number } = {}) {
  return useQuery({
    queryKey: subsListKey(opts),
    queryFn: async () => {
      const { sortBy = "date", search = "", limit = 20 } = opts;
      const d = await getJson(`/api/subscriptions${qs({ sort_by: sortBy, search, limit })}`);
      return (d.subscriptions || []) as SubscriptionItem[];
    },
    placeholderData: keepPreviousData,
  });
}

/** п.13: загрузка следующей страницы подписок по cursor — дописывает
    результат в тот же кэш-ключ, что и useSubscriptions. */
export async function loadMoreSubscriptions(
  opts: { sortBy?: string; search?: string; limit?: number },
  cursor: string
): Promise<{ hasMore: boolean }> {
  const { sortBy = "date", search = "", limit = 20 } = opts;
  const key = subsListKey(opts);
  const d = await getJson(`/api/subscriptions${qs({ sort_by: sortBy, search, limit, cursor })}`);
  const page = (d.subscriptions || []) as SubscriptionItem[];
  const prev: SubscriptionItem[] = queryClient.getQueryData(key) || [];
  const seen = new Set(prev.map((s) => s.id));
  queryClient.setQueryData(key, [...prev, ...page.filter((s) => !seen.has(s.id))]);
  return { hasMore: !!d.next_cursor };
}

/** п.4: лента новинок по всем подпискам — infinite через cursor. */
export function useFeed(opts: { targetType?: string; limit?: number } = {}) {
  const { targetType = "", limit = 20 } = opts;
  return useInfiniteQuery({
    queryKey: [...QK.feed, { targetType, limit }],
    queryFn: ({ pageParam }) =>
      getJson(`/api/feed${qs({ limit, cursor: pageParam as string | null, target_type: targetType })}`).then((d) => ({
        items: (d.feed || []) as FeedItem[],
        next_cursor: (d.next_cursor ?? null) as string | null,
      })),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
  });
}

/** п.5: список уведомлений (unread_only / cursor). */
export function useNotifications(opts: { unreadOnly?: boolean; limit?: number } = {}) {
  const { unreadOnly = false, limit = 20 } = opts;
  return useQuery({
    queryKey: [...QK.notifications, { unreadOnly, limit }],
    queryFn: async () => {
      const d = await getJson(`/api/notifications${qs({ limit, unread_only: unreadOnly ? "true" : "" })}`);
      return (d.notifications || []) as NotificationItem[];
    },
  });
}

/** п.6: лента конкретного продавца — infinite через cursor. */
export function useSellerFeed(sellerId: string | number, opts: { limit?: number } = {}) {
  const { limit = 20 } = opts;
  return useInfiniteQuery({
    queryKey: QK.sellerFeed(String(sellerId)),
    queryFn: ({ pageParam }) =>
      getJson(`/api/sellers/${encodeURIComponent(String(sellerId))}/feed${qs({ limit, cursor: pageParam as string | null })}`).then((d) => ({
        items: (d.feed || []) as FeedItem[],
        next_cursor: (d.next_cursor ?? null) as string | null,
      })),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
    enabled: !!sellerId,
  });
}
