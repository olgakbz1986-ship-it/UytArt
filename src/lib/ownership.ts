/* ============================================================
   ЕДИНЫЙ МОДУЛЬ ВЛАДЕНИЯ СУЩНОСТЯМИ (owner-based access control)

   Фундаментальный принцип: каждая пользовательская сущность
   (заказ на бирже, карточка мастера, карточка товара) имеет
   строгого владельца — userId, записанный в момент создания.
   Никто, кроме владельца, не может редактировать или удалять
   сущность. Правило абсолютно и не имеет исключений.

   Три роли наблюдателя для любой сущности:
   - guest      — не авторизован: только публичная информация;
   - owner      — владелец: полный функционал управления;
   - other      — другой пользователь: только разрешённые
                  действия (откликнуться / купить), но не чужие
                  приватные данные (список откликов, контакты).
   ============================================================ */
import { useAppStore } from "./store";

export type ViewerRole = "guest" | "owner" | "other";

/** Текущий userId активной сессии ("" если гость). */
export function currentUserId(): string {
  try { return useAppStore.getState().session?.userId || ""; } catch { return ""; }
}

/** Реактивный хук: userId текущей сессии. */
export const useCurrentUserId = () => useAppStore((s) => s.session?.userId || "");

/**
 * Роль текущего наблюдателя относительно сущности с ownerId.
 * Гость → "guest"; совпадение с userId → "owner"; иначе → "other".
 */
export function viewerRoleFor(ownerId?: string | null): ViewerRole {
  const uid = currentUserId();
  if (!uid) return "guest";
  if (!ownerId) return "other"; // сущность без владельца недоступна никому как «моя»
  return uid === ownerId ? "owner" : "other";
}

/** Реактивная версия viewerRoleFor (перерендер при смене сессии). */
export function useViewerRole(ownerId?: string | null): ViewerRole {
  const uid = useAppStore((s) => s.session?.userId || "");
  if (!uid) return "guest";
  if (!ownerId) return "other";
  return uid === ownerId ? "owner" : "other";
}

/**
 * Ядро правила доступа: можно ли текущему пользователю
 * МУТИРОВАТЬ сущность (редактировать / удалять / менять статус).
 * Разрешено ТОЛЬКО владельцу. Без исключений.
 */
export function canMutate(ownerId?: string | null): boolean {
  const uid = currentUserId();
  return !!uid && !!ownerId && uid === ownerId;
}

/** Реактивная версия canMutate. */
export const useCanMutate = (ownerId?: string | null) => useViewerRole(ownerId) === "owner";

/** Владелец ли сущности — по явному userId (для колбэков вне React). */
export function isOwnerOf(ownerId: string | null | undefined, userId: string): boolean {
  return !!userId && !!ownerId && ownerId === userId;
}

/**
 * Защита мутаций стора: вернуть true, если операция запрещена.
 * Используется внутри методов seller-стора как единый guard.
 */
export function denyUnlessOwner(ownerId?: string | null): boolean {
  return !canMutate(ownerId);
}

/* ============================================================
   ДОСТУП К ЦИФРОВЫМ ПРОДУКТАМ (ТЗ «Цифровые товары» §3)

   hasDigitalAccess — вторая фундаментальная проверка наравне с
   canMutate. Источником истины о праве доступа является запись
   о покупке (DigitalPurchase) для пары userId+productId, либо
   активная подписка, включающая продукт. Владелец продукта
   всегда имеет доступ к своему продукту (управление/превью).
   ============================================================ */
import { useDigitalStore } from "./digital";

/** Есть ли у пользователя купенный/подписочный доступ к продукту. */
export function hasDigitalAccess(userId: string, productId: string): boolean {
  if (!userId || !productId) return false;
  const st = useDigitalStore.getState();
  /* покупатель платил за продукт? */
  if (st.purchases.some((p) => p.userId === userId && p.productId === productId)) return true;
  /* владелец продукта (для управления и предпросмотра) */
  const prod = st.products.find((x) => x.id === productId);
  if (prod && prod.ownerId === userId) return true;
  /* активная подписка, включающая продукт */
  const now = Date.now();
  for (const sub of st.subscriptions) {
    if (sub.userId !== userId) continue;
    if (sub.status !== "active" && sub.status !== "past_due") continue;
    if (new Date(sub.currentPeriodEnd).getTime() < now) continue;
    const plan = st.plans.find((pl) => pl.id === sub.planId);
    if (plan?.includedProducts.includes(productId)) return true;
    /* pro/enterprise дают доступ ко всему каталогу подписки */
    if (plan && (plan.tier === "pro" || plan.tier === "enterprise")) return true;
  }
  return false;
}

/** Реактивная версия hasDigitalAccess (перерисовка при изменении покупок). */
export function useHasDigitalAccess(productId?: string | null): boolean {
  const uid = useAppStore((s) => s.session?.userId || "");
  const purchases = useDigitalStore((s) => s.purchases);
  const products = useDigitalStore((s) => s.products);
  const subscriptions = useDigitalStore((s) => s.subscriptions);
  const plans = useDigitalStore((s) => s.plans);
  if (!uid || !productId) return false;
  if (purchases.some((p) => p.userId === uid && p.productId === productId)) return true;
  const prod = products.find((x) => x.id === productId);
  if (prod && prod.ownerId === uid) return true;
  const now = Date.now();
  for (const sub of subscriptions) {
    if (sub.userId !== uid) continue;
    if (sub.status !== "active" && sub.status !== "past_due") continue;
    if (new Date(sub.currentPeriodEnd).getTime() < now) continue;
    const plan = plans.find((pl) => pl.id === sub.planId);
    if (plan?.includedProducts.includes(productId)) return true;
    if (plan && (plan.tier === "pro" || plan.tier === "enterprise")) return true;
  }
  return false;
}
