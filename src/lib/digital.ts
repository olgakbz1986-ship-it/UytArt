/* ============================================================
   СТОР ЦИФРОВЫХ ПРОДУКТОВ (ТЗ «Инфраструктура продажи цифровых
   продуктов», этапы 1, 5–11)

   Ответственности:
   - продукты продавца (создание/редактирование/версии/архив);
   - покупки покупателей (единственный источник истины hasDigitalAccess);
   - тест-драйвы промтов и агентов (лимит на пару userId+productId);
   - подписки на каталог с фоновым процессом продления;
   - синхронизация с сервером (/api/digital/*).

   Все мутации защищены правилом владения canMutate(ownerId).
   ============================================================ */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  DigitalProduct, DigitalPurchase, Subscription, SubscriptionPlan, ProductVersion,
} from "../types/digital";
import { DIGITAL_SUBSCRIPTION_PLANS } from "../types/digital";
import { useAppStore } from "./store";
import { useNotifyStore } from "./notify";

const uid = (p: string) => p + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const nowIso = () => new Date().toISOString();

interface DigitalState {
  products: DigitalProduct[];
  purchases: DigitalPurchase[];
  versions: ProductVersion[];
  subscriptions: Subscription[];
  plans: SubscriptionPlan[];
  /** счётчик тест-драйвов: key = `${userId}:${productId}` */
  testDrives: Record<string, number>;

  /* --- продавец: создание / редактирование / версии / архив --- */
  createProduct: (p: Omit<DigitalProduct, "id" | "ownerId" | "stats" | "createdAt" | "updatedAt" | "status"> & Partial<Pick<DigitalProduct, "status">>) => DigitalProduct | null;
  updateProduct: (id: string, patch: Partial<DigitalProduct>) => boolean;
  archiveProduct: (id: string) => boolean;
  addVersion: (id: string, version: string, fileUrl: string) => boolean;

  /* --- покупатель: покупка и доступ --- */
  purchaseProduct: (productId: string) => { ok: boolean; error?: string };
  bumpDownload: (productId: string) => void;
  recordTestDrive: (productId: string) => { ok: boolean; remaining: number };

  /* --- подписки --- */
  subscribe: (planId: string) => Subscription | null;
  cancelAutoRenew: (subId: string) => void;
  renewSubscription: (subId: string) => boolean;
  /** фоновый процесс (запускается раз в сутки): продление/expiry */
  tickSubscriptions: () => void;

  /* --- синхронизация с сервером --- */
  mergeFromServer: (d: { products?: DigitalProduct[]; purchases?: DigitalPurchase[] }, serverWins?: boolean) => void;
}

export const useDigitalStore = create<DigitalState>()(
  persist(
    (set, get) => ({
      products: [],
      purchases: [],
      versions: [],
      subscriptions: [],
      plans: DIGITAL_SUBSCRIPTION_PLANS,
      testDrives: {},

      createProduct: (input) => {
        const session = useAppStore.getState().session;
        if (!session || session.role !== "seller") return null;
        const p: DigitalProduct = {
          ...input,
          id: uid("dp"),
          ownerId: session.userId,
          stats: { downloads: 0, revenue: 0, rating: 0, salesCount: 0 },
          status: input.status || "published",
          createdAt: nowIso(),
          updatedAt: nowIso(),
        } as DigitalProduct;
        set((s) => ({ products: [p, ...s.products] }));
        /* регистрируем версию 1.0 в истории */
        set((s) => ({ versions: [{ id: uid("pv"), productId: p.id, version: p.version, fileUrl: p.fileUrl, releasedAt: nowIso() }, ...s.versions] }));
        /* асинхронно сохраняем на сервер (приватный файл уже загружен мастером) */
        fetch("/api/digital/products", {
          method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
          body: JSON.stringify(p),
        }).catch(() => { /* офлайн-режим: данные останутся в persist-сторе */ });
        return p;
      },

      updateProduct: (id, patch) => {
        const st = get();
        const prod = st.products.find((x) => x.id === id);
        if (!prod) return false;
        const session = useAppStore.getState().session;
        /* Правило владения: только owner. Без исключений. */
        if (!session || session.userId !== prod.ownerId) return false;
        const forbidden: (keyof DigitalProduct)[] = ["id", "ownerId", "purchasedVersion" as keyof DigitalProduct];
        const clean = { ...patch };
        for (const k of forbidden) delete (clean as Record<string, unknown>)[k as string];
        set((s) => ({ products: s.products.map((x) => (x.id === id ? { ...x, ...clean, updatedAt: nowIso() } : x)) }));
        fetch(`/api/digital/products/${id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
          body: JSON.stringify(clean),
        }).catch(() => undefined);
        return true;
      },

      archiveProduct: (id) => get().updateProduct(id, { status: "archived" }),

      addVersion: (id, version, fileUrl) => {
        const prod = get().products.find((x) => x.id === id);
        if (!prod) return false;
        const session = useAppStore.getState().session;
        if (!session || session.userId !== prod.ownerId) return false;
        set((s) => ({
          versions: [{ id: uid("pv"), productId: id, version, fileUrl, releasedAt: nowIso() }, ...s.versions],
          products: s.products.map((x) => (x.id === id ? { ...x, version, fileUrl, updatedAt: nowIso() } : x)),
        }));
        /* §11: уведомить ВСЕХ покупателей о новой версии (+email на сервере) */
        const buyers = new Set(s_purchasesOf(id).map((p) => p.userId));
        buyers.forEach((u) => {
          try {
            useNotifyStore.getState().push({
              kind: "report", title: "Продукт обновлён",
              text: `«${prod.title}» доступен в новой версии ${version}. Скачать можно бесплатно в разделе «Мои цифровые покупки».`,
              deepLink: "#/digital-purchases", payload: { productId: id, version },
            });
          } catch { /* ignore */ }
          void u;
        });
        fetch(`/api/digital/products/${id}/versions`, {
          method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
          body: JSON.stringify({ version, fileUrl }),
        }).catch(() => undefined);
        return true;
      },

      purchaseProduct: (productId) => {
        const session = useAppStore.getState().session;
        if (!session) return { ok: false, error: "Войдите в аккаунт, чтобы купить цифровой товар." };
        const prod = get().products.find((x) => x.id === productId);
        if (!prod) return { ok: false, error: "Продукт не найден." };
        if (prod.ownerId === session.userId) return { ok: false, error: "Нельзя купить собственный продукт." };
        if (get().purchases.some((p) => p.userId === session.userId && p.productId === productId)) {
          return { ok: false, error: "Вы уже купили этот продукт." };
        }
        const rec: DigitalPurchase = {
          id: uid("dpur"), userId: session.userId, productId,
          purchasedAt: nowIso(), downloadCount: 0, purchasedVersion: prod.version,
        };
        set((s) => ({
          purchases: [rec, ...s.purchases],
          products: s.products.map((x) => (x.id === productId
            ? { ...x, stats: { ...x.stats, salesCount: x.stats.salesCount + 1, revenue: x.stats.revenue + x.price } }
            : x)),
        }));
        /* уведомление продавцу о продаже (§12 digital_product_purchased) */
        try {
          useNotifyStore.getState().push({
            kind: "report", title: "Новая продажа цифрового продукта",
            text: `«${prod.title}» — ${prod.price.toLocaleString("ru-RU")} ₽. Покупатель: ${session.name}.`,
            deepLink: "#/seller/dashboard", payload: { productId, amount: prod.price },
          });
        } catch { /* ignore */ }
        fetch(`/api/digital/${productId}/purchase`, {
          method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        }).catch(() => undefined);
        return { ok: true };
      },

      bumpDownload: (productId) => {
        const session = useAppStore.getState().session;
        if (!session) return;
        set((s) => ({
          purchases: s.purchases.map((p) => (p.userId === session.userId && p.productId === productId
            ? { ...p, downloadCount: p.downloadCount + 1 } : p)),
          products: s.products.map((x) => (x.id === productId
            ? { ...x, stats: { ...x.stats, downloads: x.stats.downloads + 1 } } : x)),
        }));
      },

      recordTestDrive: (productId) => {
        const session = useAppStore.getState().session;
        const uidKey = session?.userId || "guest";
        const prod = get().products.find((x) => x.id === productId);
        const limit = prod?.testDriveLimit ?? 2;
        const key = `${uidKey}:${productId}`;
        const used = get().testDrives[key] || 0;
        if (used >= limit) {
          if (session) {
            try {
              useNotifyStore.getState().push({
                kind: "alert", title: "Лимит бесплатных тестов исчерпан",
                text: `Бесплатные попытки теста «${prod?.title || "продукта"}» закончились. Купите продукт, чтобы получить полный доступ.`,
                deepLink: `#/product/${productId}`, payload: { productId },
              });
            } catch { /* ignore */ }
          }
          return { ok: false, remaining: 0 };
        }
        set((s) => ({ testDrives: { ...s.testDrives, [key]: used + 1 } }));
        return { ok: true, remaining: limit - used - 1 };
      },

      subscribe: (planId) => {
        const session = useAppStore.getState().session;
        if (!session) return null;
        const plan = get().plans.find((p) => p.id === planId);
        if (!plan) return null;
        const start = new Date();
        const end = new Date(start);
        if (plan.billingCycle === "yearly") end.setFullYear(end.getFullYear() + 1); else end.setMonth(end.getMonth() + 1);
        const sub: Subscription = {
          id: uid("dsb"), userId: session.userId, planId: plan.id, status: "active",
          currentPeriodStart: start.toISOString(), currentPeriodEnd: end.toISOString(), autoRenew: true,
        };
        set((s) => ({ subscriptions: [sub, ...s.subscriptions.filter((x) => !(x.userId === session.userId && x.planId === planId && x.status === "active"))] }));
        fetch("/api/digital/subscriptions", {
          method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
          body: JSON.stringify({ planId }),
        }).catch(() => undefined);
        return sub;
      },

      cancelAutoRenew: (subId) => {
        const session = useAppStore.getState().session;
        set((s) => ({
          subscriptions: s.subscriptions.map((x) => (x.id === subId && x.userId === session?.userId
            ? { ...x, autoRenew: false } : x)),
        }));
        fetch(`/api/digital/subscriptions/${subId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
          body: JSON.stringify({ autoRenew: false }),
        }).catch(() => undefined);
      },

      renewSubscription: (subId) => {
        const st = get();
        const sub = st.subscriptions.find((x) => x.id === subId);
        if (!sub) return false;
        const plan = st.plans.find((p) => p.id === sub.planId);
        if (!plan) return false;
        const end = new Date(sub.currentPeriodEnd);
        const next = new Date(end);
        if (plan.billingCycle === "yearly") next.setFullYear(next.getFullYear() + 1); else next.setMonth(next.getMonth() + 1);
        set((s) => ({
          subscriptions: s.subscriptions.map((x) => (x.id === subId
            ? { ...x, status: "active", currentPeriodStart: end.toISOString(), currentPeriodEnd: next.toISOString() } : x)),
        }));
        try {
          useNotifyStore.getState().push({
            kind: "report", title: "Подписка продлена",
            text: `Тариф «${plan.name}» продлён до ${next.toLocaleDateString("ru-RU")}.`,
          });
        } catch { /* ignore */ }
        return true;
      },

      tickSubscriptions: () => {
        const st = get();
        const now = Date.now();
        st.subscriptions.forEach((sub) => {
          if (sub.status === "cancelled" || sub.status === "expired") return;
          const end = new Date(sub.currentPeriodEnd).getTime();
          const plan = st.plans.find((p) => p.id === sub.planId);
          /* за 3 дня до конца при выключенном автопродлении — предупреждение */
          if (!sub.autoRenew && sub.status === "active" && end - now < 3 * 864e5 && end > now) {
            try {
              useNotifyStore.getState().push({
                kind: "alert", title: "Подписка скоро истекает",
                text: `Доступ к каталогу «${plan?.name || ""}» закроется ${new Date(end).toLocaleDateString("ru-RU")}. Скачанные файлы останутся у вас навсегда.`,
              });
            } catch { /* ignore */ }
          }
          if (end > now) return;
          /* период истёк */
          if (sub.autoRenew) {
            get().renewSubscription(sub.id);
          } else if (sub.status === "past_due") {
            /* 7 дней после past_due без оплаты → expired */
            if (now - end > 7 * 864e5) {
              set((s) => ({ subscriptions: s.subscriptions.map((x) => (x.id === sub.id ? { ...x, status: "expired" } : x)) }));
              try {
                useNotifyStore.getState().push({ kind: "alert", title: "Подписка истекла", text: "Доступ к каталогу подписки закрыт. Скачанные файлы остались у вас." });
              } catch { /* ignore */ }
            }
          } else {
            set((s) => ({ subscriptions: s.subscriptions.map((x) => (x.id === sub.id ? { ...x, status: "past_due" } : x)) }));
            try {
              useNotifyStore.getState().push({ kind: "alert", title: "Не удалось продлить подписку", text: "Обновите платёжный метод в настройках подписки в течение 7 дней." });
            } catch { /* ignore */ }
          }
        });
      },

      mergeFromServer: (d, serverWins = false) => set((s) => {
        /* витринные товары других продавцов (приходят с /api/digital/products
           без секретных полей) — синхронизируем статусы и статистику целиком;
           локальные объекты владельца при конфликте выигрывают содержимым,
           кроме витринной синхронизации (serverWins): там серверный published-
           снимок актуальнее persist-кэша и не должен содержать секреты */
        const byId = new Map(s.products.map((p) => [p.id, p]));
        (d.products || []).forEach((p) => { const prev = byId.get(p.id); byId.set(p.id, prev ? (serverWins ? { ...prev, ...p } : { ...p, ...prev }) : p); });
        const purKeys = new Set(s.purchases.map((p) => `${p.userId}:${p.productId}`));
        const newPur = (d.purchases || []).filter((p) => !purKeys.has(`${p.userId}:${p.productId}`));
        return { products: Array.from(byId.values()), purchases: [...newPur, ...s.purchases] };
      }),
    }),
    { name: "quantiform-digital-v1" }
  )
);

/** helper: все покупки продукта (для рассылки об обновлениях) */
function s_purchasesOf(productId: string): DigitalPurchase[] {
  return useDigitalStore.getState().purchases.filter((p) => p.productId === productId);
}

/* Фоновый процесс подписок (§10): раз в сутки + при старте приложения */
if (typeof window !== "undefined") {
  const run = () => useDigitalStore.getState().tickSubscriptions();
  setTimeout(run, 3000);
  setInterval(run, 24 * 3600 * 1000);
}
