import { useEffect, useState } from "react";
import { useAppStore } from "./store";
import { marketProducts } from "./market";
import { VENDORS } from "../data/seed";

/* ============================================================
   ЛЕНТА ПОДПИСОК ПОЛЬЗОВАТЕЛЯ (единый клиентский слой)
   ------------------------------------------------------------
   Связывает кнопку «Подписаться» на карточке магазина/мастерской/
   автора с разделом «Мои подписки» в кабинете покупателя:

   1. Подписки хранятся на сервере (/api/subscriptions) — единый
      источник истины и для кнопки, и для кабинета.
   2. ID-пространство приведено к единому канону: id продавца
      (ownerId / аккаунт). Карточка товара в каталоге пишет
      подписку на реального владельца (sellerItem.ownerId), а не
      на демо-vendor, иначе кабинет не смог бы резолвить магазин.
   3. «Новинки» (счётчик у подписки) — товары продавца, созданные
      после момента подписки (createdAt > createdAt подписки).
      До публикации сервиса счётчики равны 0 — структура готова.
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

/** Резолв отображаемого названия цели подписки по данным витрины. */
export function resolveTargetName(targetType: string, targetId: string): string {
  if (!targetId) return "";
  const list = marketProducts();
  /* демо-вендоры seed-каталога (v1…v12) — имя напрямую из реестра VENDORS */
  const demoVendor = VENDORS.find((v) => v.id === targetId);
  if (demoVendor) return demoVendor.name;
  if (targetType === "shop" || targetType === "master" || targetType === "author") {
    /* товар этого продавца → название магазина/автора из профиля-зеркала */
    const own = list.find(
      (x) =>
        canonicalSellerId(x as any) === targetId ||
        (targetType === "author" && x.id.startsWith("dp-") && digitalAuthorId(x.id) === targetId)
    );
    if (own) return (own as any).shopName || (own as any).sub || (own as any).name || targetId;
    /* мастер/магазин без товаров — имя из реестра профилей продавцов.
       ИСПРАВЛЕНИЕ: ключ persist-стора — "uyutart-seller-reg-v3" (см. src/lib/seller.ts),
       ранее читался устаревший "-v1", из-за чего имена магазинов без товаров
       в «Моих подписках» не резолвились и показывали сырой id. */
    try {
      const prof = JSON.parse(localStorage.getItem("uyutart-seller-reg-v3") || "{}");
      const byAcc = prof?.state?.profilesByAccount || {};
      const pr = byAcc[targetId];
      if (pr?.shopName) return pr.shopName;
    } catch { /* нет кэша профилей — показываем id */ }
  }
  if (targetType === "product") {
    const p = list.find((x) => x.id === targetId || x.slug === targetId);
    if (p) return p.name;
  }
  return targetId;
}

/* ---------- реактивная загрузка подписок (общий кэш) ----------
   Кэш и in-flight-запросы сбрасываются при смене аккаунта (login/logout),
   иначе новый пользователь увидел бы подписки предыдущего аккаунта. */
const subsCache = new Map<string, ServerSubscription[]>();
const subsInflight = new Map<string, Promise<ServerSubscription[]>>();

useAppStore.subscribe((s, prev) => {
  if (s.session?.userId !== prev.session?.userId) {
    subsCache.clear();
    subsInflight.clear();
  }
});

async function fetchSubscriptions(userId: string): Promise<ServerSubscription[]> {
  const inflight = subsInflight.get(userId);
  if (inflight) return inflight;
  /* credentials: "include" — сервер авторизует по httpOnly-cookie (JWT)
     и переопределяет req.userId значением из токена; заголовок x-user-id
     остаётся fallback-ом для гостевого демо-режима. */
  const pr = fetch("/api/subscriptions", { headers: { "x-user-id": userId }, credentials: "include" })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      const list: ServerSubscription[] = d && d.ok && Array.isArray(d.subscriptions) ? d.subscriptions : [];
      subsCache.set(userId, list);
      return list;
    })
    .catch(() => subsCache.get(userId) || []);
  subsInflight.set(userId, pr);
  pr.finally(() => subsInflight.delete(userId));
  return pr;
}

/** Хук: список подписок текущего пользователя с сервера (реактивно). */
export function useUserSubscriptions(): {
  subscriptions: ServerSubscription[];
  loading: boolean;
  refresh: () => void;
} {
  /* реактивный id сессии: при login/logout хук перезагружает список,
     а не «замерзает» на id, прочитанном один раз при монтировании */
  const userId = useAppStore((s) => s.session?.userId) || "demo-user-1";
  const [subscriptions, setSubscriptions] = useState<ServerSubscription[]>(
    () => subsCache.get(userId) || []
  );
  const [loading, setLoading] = useState<boolean>(() => !subsCache.has(userId));

  const load = () => {
    setLoading(true);
    fetchSubscriptions(userId).then((list) => {
      setSubscriptions(list);
      setLoading(false);
    });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return { subscriptions, loading, refresh: load };
}

/** Синхронная проверка: подписан ли текущий пользователь на цель (по кэшу). */
export function isSubscribedCached(targetType: string, targetId: string): boolean {
  const uid = currentUserId();
  const list = subsCache.get(uid);
  if (!list) return false;
  return list.some((s) => s.targetType === targetType && s.targetId === targetId);
}

/** Подписка на сервере (используется кнопкой «Подписаться»). */
export async function subscribeOnServer(targetType: string, targetId: string): Promise<boolean> {
  const userId = currentUserId();
  const res = await fetch("/api/subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-user-id": userId },
    body: JSON.stringify({ targetType, targetId }),
    credentials: "include",
  });
  const data = await res.json().catch(() => null);
  if (data && data.ok) {
    /* ИСПРАВЛЕНИЕ: после успешной записи на сервер кэш инвалидируется и
       перечитывается с сервера. Ранее в кэш ложилась локальная запись с id
       "sub_local" и клиентским createdAt — при несовпадении id-пространства
       (клиентский fallback vs серверный req.userId) кабинет читал бы пустой
       список, а кнопка показывала бы «Вы подписаны». */
    subsCache.delete(userId);
    await fetchSubscriptions(userId);
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
    subsCache.delete(userId);
    await fetchSubscriptions(userId);
    return true;
  }
  return false;
}

/* ---------- счётчики новинок по подпискам ---------- */

/** Число новых товаров продавца с момента подписки (товары витрины,
    ownerId === sellerId, createdAt > sub.createdAt). */
export function newItemsCountFor(products: { [k: string]: any }[], sellerId: string, sinceIso: string): number {
  const since = Date.parse(sinceIso || "") || 0;
  return products.filter(
    (x) => canonicalSellerId(x as any) === sellerId && Date.parse(String((x as any).createdAt || "")) > since
  ).length;
}

/** Карта «sellerId → число новинок» для всех активных подписок shop/master/author. */
export function computeNewCounts(subs: ServerSubscription[]): Record<string, number> {
  const out: Record<string, number> = {};
  if (!subs.length) return out;
  const products = marketProducts();
  for (const s of subs) {
    if (s.targetType !== "shop" && s.targetType !== "master" && s.targetType !== "author") continue;
    const key = `${s.targetType}:${s.targetId}`;
    if (out[key] === undefined) {
      out[key] = newItemsCountFor(products as any, s.targetId, s.createdAt);
    }
  }
  return out;
}
