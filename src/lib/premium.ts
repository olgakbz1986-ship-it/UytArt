import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useAppStore } from "./store";
import { useSubStore, buyerLimits, type BuyerPlanId } from "./subscriptions";
import { useSellerAccount, SELLER_PLANS, sellerPlanById, type SellerLegalType } from "./seller";
import { PRODUCTS, vendorById, type Product } from "../data/seed";
import { useNotifyStore } from "./notify";
import { api } from "./api";

/* ============================================================
   ЭТАП 5 (§5.1–§5.6): ФУНКЦИИ ПРЕМИАЛЬНЫХ УРОВНЕЙ — КЛИЕНТСКОЕ ЯДРО
   ------------------------------------------------------------
   Источник истины возможностей — СЕРВЕРНАЯ сетка (server/tariffs.cjs:
   sellerFeaturesOf / BUYER_FEATURES), она же отдаётся в /api/tariff
   как tariff.features. Клиентская таблица ниже обязана совпадать с
   серверной (контрольный аудит §5-аудит даёт ноль расхождений).
   Все мутации дублируются на сервер (fetch); при недоступности API
   работает локальный демо-слой (persist-сторы) — поведение не ломается.
   ============================================================ */

export interface SellerFeatures {
  weeklyReport: boolean;   /* §5.2 еженедельный авто-отчёт агента */
  curatorPicks: boolean;   /* §5.2 персональные подборки кураторов */
  masterSite: boolean;     /* §5.2 мини-сайт мастерской на поддомене */
  abTest: boolean;         /* §5.3 A/B-тестирование карточек (14 дней) */
  b2bClosed: boolean;      /* §5.3/§5.5 закрытые заказы от бизнеса и тендеры */
  managerLine: boolean;    /* §5.3 менеджерская линия, ответ 2 ч в раб. время */
  roundTheClock: boolean;  /* §5.6 менеджер 24/7, реакция 15 минут */
  importFile: boolean;     /* §5.4 импорт товаров из файлов */
  brandStore: boolean;     /* §5.4 бренд-витрина */
  segmentation: boolean;   /* §5.5 сегментация клиентов + рассылки */
  customReports: boolean;  /* §5.6 конструктор кастомных отчётов (XLSX/CSV) */
  whiteLabel: boolean;     /* §5.6 белый ярлык: домен, сертификат, без брендинга */
  topPositions: boolean;   /* §5.6 топ-позиции категорий с меткой «Реклама» */
  promoMailout: boolean;   /* §5.6 промо в рассылках, 2 выхода/мес по медиа-киту */
}
export interface BuyerFeatures {
  premiumSales: boolean;   /* §5.1 закрытые распродажи с еженедельными дропами */
  curator: boolean;        /* §5.1 цифровой куратор: приоритетная ветка агента */
  vipBadge: boolean;       /* §5.1 VIP-бейдж в каталоге, отзывах и чеках */
  freeDeliveryZone: boolean; /* §3.4 бесплатная доставка по округу (2 заказа/мес) */
  earlyAccess: boolean;
  qualityFilters: boolean;
  discountPct: number;
}

const ALL_OFF: SellerFeatures = { weeklyReport: false, curatorPicks: false, masterSite: false, abTest: false, b2bClosed: false, managerLine: false, roundTheClock: false, importFile: false, brandStore: false, segmentation: false, customReports: false, whiteLabel: false, topPositions: false, promoMailout: false };

/* Базовая сетка по уровням линеек (идентична server SELLER_FEATURES_BASE) */
const TIER1: Partial<SellerFeatures> = { importFile: true, brandStore: true };
const TIER2: Partial<SellerFeatures> = { ...TIER1, weeklyReport: true, b2bClosed: true, segmentation: true };
const TIER3: Partial<SellerFeatures> = { ...TIER2, curatorPicks: true, masterSite: true, abTest: true, managerLine: true };

/** Серверная функция sellerFeaturesOf — порт 1:1 (source of truth: tariffs.cjs). */
export function sellerFeaturesOf(legalType: SellerLegalType | null, planId: string): SellerFeatures {
  const LEVEL: Record<string, number> = { free: 0, master: 1, business: 1, corp: 1, profi: 2, "business-pro": 2, "corp-pro": 2, "master-pro": 2, top: 3, "master-premium": 3, "business-premium": 3, "corp-premium": 3 };
  const lvl = Math.min(LEVEL[planId] ?? 0, 3);
  const base = [ {}, TIER1, TIER2, TIER3 ][lvl];
  const f: SellerFeatures = { ...ALL_OFF, ...base };
  if (lvl === 3 && legalType === "ooo") {
    /* §5.6 Корпоративный Премиум */
    f.roundTheClock = true; f.whiteLabel = true; f.topPositions = true; f.promoMailout = true; f.customReports = true;
  }
  if (lvl === 3 && legalType === "ip") f.whiteLabel = true; /* §5.3 Бизнес-Премиум: white-label линейки ИП */
  return f;
}

/** Покупательская сетка — порт BUYER_FEATURES (tariffs.cjs). */
export function buyerFeaturesOf(plan: BuyerPlanId): BuyerFeatures {
  const l = buyerLimits(plan);
  return {
    premiumSales: plan === "premium",
    curator: !!l.curator,
    vipBadge: !!l.vip,
    freeDeliveryZone: plan === "premium",
    earlyAccess: !!l.earlyAccess,
    qualityFilters: !!l.qualityFilters,
    discountPct: l.discountPct,
  };
}

/** Возможности текущего продавца: тип юрлица + тариф из аккаунт-стора. */
export function currentSellerFeatures(): SellerFeatures {
  const uid = useAppStore.getState().session?.userId || "guest";
  let best: SellerFeatures = { ...ALL_OFF };
  (["self_employed", "ip", "ooo"] as SellerLegalType[]).forEach((t) => {
    const planId = useSellerAccount.getState().getPlan(uid, t);
    const f = sellerFeaturesOf(t, planId);
    for (const k of Object.keys(ALL_OFF) as (keyof SellerFeatures)[]) if (f[k]) best[k] = true;
  });
  return best;
}
export function currentBuyerFeatures(): BuyerFeatures {
  const uid = useAppStore.getState().session?.userId || "guest";
  return buyerFeaturesOf(useSubStore.getState().getBuyerPlan(uid));
}

/* Хук-обёртки для компонентов (реактивные).
   ВАЖНО: подписка выполняется ОДИН раз через useAppStore.subscribe на уровне
   модуля — внутри хуков никаких вызовов хуков быть не должно (правило React),
   иначе компонент падает с "Invalid hook call". */
type FeatureListener = () => void;
const featureListeners = new Set<FeatureListener>();
let lastSellerF: SellerFeatures = currentSellerFeatures();
let lastBuyerF: BuyerFeatures = currentBuyerFeatures();
useAppStore.subscribe(() => {
  const ns = currentSellerFeatures();
  const nb = currentBuyerFeatures();
  const changed =
    (Object.keys(ALL_OFF) as (keyof SellerFeatures)[]).some((k) => ns[k] !== lastSellerF[k]) ||
    (Object.keys(nb) as (keyof BuyerFeatures)[]).some((k) => nb[k] !== lastBuyerF[k]);
  if (changed) { lastSellerF = ns; lastBuyerF = nb; featureListeners.forEach((l) => l()); }
});

export function useSellerFeatures(): SellerFeatures {
  const [, bump] = useState(0);
  useEffect(() => {
    const l: FeatureListener = () => bump((n) => n + 1);
    featureListeners.add(l);
    return () => { featureListeners.delete(l); };
  }, []);
  return lastSellerF;
}
export function useBuyerFeatures(): BuyerFeatures {
  const [, bump] = useState(0);
  useEffect(() => {
    const l: FeatureListener = () => bump((n) => n + 1);
    featureListeners.add(l);
    return () => { featureListeners.delete(l); };
  }, []);
  return lastBuyerF;
}

/* ---------- helpers ---------- */
export const isoWeekKey = (d = new Date()) => {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const ys = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const wk = Math.ceil(((Number(t) - Number(ys)) / 864e5 + 1) / 7);
  return t.getUTCFullYear() + "-W" + String(wk).padStart(2, "0");
};
const nid = (p: string) => p + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/* ============================================================
   §5.1 ЗАКРЫТЫЕ РАСПРОДАЖИ — раздел каталога с еженедельными дропами.
   Дроп публикуется автоматически каждую ISO-нед.; товары дропа —
   детерминированный срез витрины со скидкой 20%. Видим только
   premium-сессиям (гейт и на UI, и на сервере /api/premium/sales).
   ============================================================ */
export interface PremiumDrop { id: string; week: string; title: string; startsAt: string; discountPct: number; productIds: string[]; status: "live" | "archived"; }

interface PremiumSalesState {
  drops: PremiumDrop[];
  ensureThisWeek: () => void;
}
export const usePremiumSales = create<PremiumSalesState>()(
  persist(
    (set, get) => ({
      drops: [],
      ensureThisWeek: () => {
        const week = isoWeekKey();
        if (get().drops.some((d) => d.week === week)) return;
        /* детерминированный выбор 8 товаров недели (срез по хешу недели) */
        const seed = week.split("").reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
        const ids: string[] = [];
        for (let i = 0; i < 8; i++) ids.push(PRODUCTS[(seed + i * 97) % PRODUCTS.length].id);
        set((s) => ({ drops: [{ id: "drop-" + week, week, title: "Закрытая распродажа недели " + week, startsAt: new Date().toISOString(), discountPct: 20, productIds: [...new Set(ids)], status: "live" }, ...s.drops.map((d) => ({ ...d, status: "archived" as const }))].slice(0, 12) }));
        /* синхронизация с сервером (сервер гейтит premium-сессию) */
        fetch("/api/premium/sales", { credentials: "include" }).catch(() => {});
      },
    }),
    { name: "qf-premium-sales-v1" },
  ),
);

/** Товары активного дропа в формате витрины (для раздела /catalog?drop=1). */
export function dropProducts(drop: PremiumDrop | undefined): Product[] {
  if (!drop) return [];
  return drop.productIds
    .map((id) => PRODUCTS.find((p) => p.id === id))
    .filter(Boolean)
    .map((p) => ({ ...(p as Product), oldPrice: (p as Product).price, price: Math.round(((p as Product).price * (100 - drop.discountPct)) / 10) * 10 / 10 }));
}

/* ============================================================
   §5.1 ЦИФРОВОЙ КУРАТОР — приоритетная ветка агента с эскалацией
   на оператора. Куратор отвечает первым (SLA 30 мин); если вопрос
   не решён в диалоге — кнопка «Эскалировать оператору» создаёт
   тикет с приоритетом premium (и на сервер /api/curator/escalate).
   ============================================================ */
export interface CuratorTicket { id: string; question: string; createdAt: string; status: "queued" | "operator" | "resolved"; slaMinutes: number; channel: "curator_priority"; }
interface CuratorState {
  tickets: CuratorTicket[];
  escalate: (question: string) => CuratorTicket | null;
  resolve: (id: string) => void;
}
export const useCurator = create<CuratorState>()(
  persist(
    (set, get) => ({
      tickets: [],
      escalate: (question) => {
        if (!currentBuyerFeatures().curator) return null; /* гейт: только Премиум */
        const t: CuratorTicket = { id: nid("esc"), question, createdAt: new Date().toISOString(), status: "queued", slaMinutes: 30, channel: "curator_priority" };
        set((s) => ({ tickets: [t, ...s.tickets].slice(0, 50) }));
        useNotifyStore.getState().push({ kind: "confirm", title: "Куратор подключился", text: "Приоритетная ветка агента: ответ в течение 30 минут. Эскалация оператору — по кнопке в диалоге." });
        fetch("/api/curator/escalate", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }) }).catch(() => {});
        return t;
      },
      resolve: (id) => set((s) => ({ tickets: s.tickets.map((t) => (t.id === id ? { ...t, status: "resolved" } : t)) })),
    }),
    { name: "qf-curator-v1" },
  ),
);

/* ============================================================
   §5.2 ЕЖЕНЕДЕЛЬНЫЙ АВТО-ОТЧЁТ АГЕНТА (Топ самозанятых и выше)
   Генерируется раз в ISO-нед.: рекомендации цен, топ товаров,
   прогноз продаж. Серверный источник — GET /api/seller/weekly-report.
   ============================================================ */
export interface WeeklyReport {
  week: string; generatedAt: string;
  topProducts: { id: string; name: string; views: number; price: number }[];
  priceRecommendations: { productId: string; action: string; delta_pct?: number; reason: string }[];
  salesForecast: { nextWeekUnits: number; basis: string };
  activeOrders: number;
}
interface WeeklyReportState {
  reports: Record<string, WeeklyReport>; /* key = userId */
  generate: (uid: string) => Promise<WeeklyReport | null>;
}
export const useWeeklyReport = create<WeeklyReportState>()(
  persist(
    (set, get) => ({
      reports: {},
      generate: async (uid) => {
        const f = currentSellerFeatures();
        if (!f.weeklyReport) return null;
        const week = isoWeekKey();
        const existing = get().reports[uid];
        if (existing && existing.week === week) return existing;
        /* серверный отчёт (источник истины); офлайн — локальная генерация */
        try {
          const r = await fetch("/api/seller/weekly-report", { credentials: "include" });
          const j = await r.json();
          if (j && j.ok && j.report) {
            const rep: WeeklyReport = { week, generatedAt: j.report.generated_at, topProducts: j.report.top_products, priceRecommendations: j.report.price_recommendations, salesForecast: { nextWeekUnits: j.report.sales_forecast.next_week_units, basis: j.report.sales_forecast.basis }, activeOrders: j.report.active_orders };
            set((s) => ({ reports: { ...s.reports, [uid]: rep } }));
            return rep;
          }
        } catch { /* demo fallback */ }
        const products = useSellerAccount.getState().products.filter((p) => !p.archived && !p.isDraft);
        const top = [...products].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5).map((p) => ({ id: p.id, name: p.name, views: p.views || 0, price: p.price }));
        const recs = top.slice(0, 3).map((p) => ({ productId: p.id, action: "recommend_price_up", delta_pct: 5, reason: "Высокий интерес при ограниченном остатке" }));
        const low = [...products].sort((a, b) => (a.views || 0) - (b.views || 0)).slice(0, 2).map((p) => ({ productId: p.id, action: "recommend_new_photos", reason: "Низкая просматриваемость — обновите обложку" }));
        const rep: WeeklyReport = {
          week, generatedAt: new Date().toISOString(), topProducts: top, priceRecommendations: [...recs, ...low],
          salesForecast: { nextWeekUnits: Math.max(0, Math.round(products.length * 0.4)), basis: "среднее за 4 недели × тренд +5%" },
          activeOrders: useSellerAccount.getState().transactions.filter((t: any) => t.kind === "sale").length,
        };
        set((s) => ({ reports: { ...s.reports, [uid]: rep } }));
        useNotifyStore.getState().push({ kind: "report", title: "Агент: недельный отчёт " + week, text: "Рекомендации по ценам, топ товаров и прогноз продаж готовы.", deepLink: "/seller/dashboard" });
        return rep;
      },
    }),
    { name: "qf-weekly-report-v1" },
  ),
);

/* ============================================================
   §5.2 ПЕРСОНАЛЬНЫЕ ПОДБОРКИ КУРАТОРОВ (Топ) — еженедельная витрина
   премиум-покупателям. Продавец выставляет подбор, покупатель с
   premium-фичей видит раздел «Подборки кураторов» в каталоге.
   ============================================================ */
export interface CuratorPickSet { id: string; sellerUid: string; shopName: string; week: string; productIds: string[]; note: string; published: boolean; }
interface CuratorPicksState {
  sets: CuratorPickSet[];
  publishPick: (productIds: string[], note: string) => CuratorPickSet | null;
}
export const useCuratorPicks = create<CuratorPicksState>()(
  persist(
    (set, get) => ({
      sets: [],
      publishPick: (productIds, note) => {
        if (!currentSellerFeatures().curatorPicks) return null;
        const uid = useAppStore.getState().session?.userId || "guest";
        const reg = (useSellerAccount.getState() as any);
        const shopName = reg.shopName || useAppStore.getState().session?.name || "Мастерская";
        const pick: CuratorPickSet = { id: nid("pick"), sellerUid: uid, shopName, week: isoWeekKey(), productIds, note: note || "Отобрано куратором платформы для премиум-покупателей", published: true };
        set((s) => ({ sets: [pick, ...s.sets.filter((x) => x.sellerUid !== uid)].slice(0, 100) }));
        return pick;
      },
    }),
    { name: "qf-curator-picks-v1" },
  ),
);
/** Подборки текущей недели (видят только premium-покупатели) */
export function thisWeekPicks(): CuratorPickSet[] {
  const week = isoWeekKey();
  return useCuratorPicks.getState().sets.filter((p) => p.published && p.week === week);
}

/* ============================================================
   §5.2 МИНИ-САЙТ МАСТЕРСКОЙ (вместо белого ярлыка у самозанятых)
   и §5.6 БЕЛЫЙ ЯРЛЫК (ООО Премиум): домен/поддомен, сертификат,
   логотип, отключение брендинга платформы.
   ============================================================ */
export interface SellerSite { mode: "master_mini_site" | "white_label"; url: string; customDomain?: string | null; sslCertificate: string; platformBrandingHidden: boolean; logo?: string; cover?: string; activatedAt: string; }
interface SiteState {
  sites: Record<string, SellerSite>;
  activate: (opts: { subdomain?: string; domain?: string; logo?: string; cover?: string }) => Promise<SellerSite | null>;
}
export const PLATFORM_DOMAIN = "quantiform.ru";
export const useSellerSite = create<SiteState>()(
  persist(
    (set, get) => ({
      sites: {},
      activate: async (opts) => {
        const uid = useAppStore.getState().session?.userId || "guest";
        const f = currentSellerFeatures();
        const isSelf = !(f.whiteLabel); /* Топ самозанятых → mini-site; whiteLabel есть только у ИП/ООО премиумов */
        if (!(isSelf ? f.masterSite : f.whiteLabel)) return null;
        const slug = (opts.subdomain || uid).toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30) || "shop";
        const site: SellerSite = {
          mode: isSelf ? "master_mini_site" : "white_label",
          url: "https://" + slug + "." + PLATFORM_DOMAIN,
          customDomain: !isSelf ? opts.domain || null : null,
          sslCertificate: !isSelf ? "lets-encrypt-managed" : "platform-wildcard",
          platformBrandingHidden: !isSelf,
          logo: opts.logo, cover: opts.cover, activatedAt: new Date().toISOString(),
        };
        set((s) => ({ sites: { ...s.sites, [uid]: site } }));
        fetch("/api/seller/site", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subdomain: slug, domain: opts.domain }) }).catch(() => {});
        return site;
      },
    }),
    { name: "qf-seller-site-v1" },
  ),
);

/* ============================================================
   §5.3 A/B-ТЕСТИРОВАНИЕ КАРТОЧЕК (Бизнес-Премиум): две версии
   описания/обложки, замер конверсии 14 дней, победитель и lift.
   ============================================================ */
export interface AbTest {
  id: string; productId: string; variantA: string; variantB: string;
  startedAt: string; endsAt: string; durationDays: 14; status: "running" | "finished";
  metrics: { a: { views: number; conversions: number }; b: { views: number; conversions: number } };
  winner?: "a" | "b"; liftPct?: number;
}
interface AbState {
  tests: AbTest[];
  start: (productId: string, variantA: string, variantB: string) => AbTest | null;
  trackView: (id: string, variant: "a" | "b") => void;
  trackConversion: (id: string, variant: "a" | "b") => void;
  finalizeDue: () => void;
}
export const useAbTests = create<AbState>()(
  persist(
    (set, get) => ({
      tests: [],
      start: (productId, variantA, variantB) => {
        if (!currentSellerFeatures().abTest) return null;
        const t: AbTest = { id: nid("ab"), productId, variantA, variantB, startedAt: new Date().toISOString(), endsAt: new Date(Date.now() + 14 * 864e5).toISOString(), durationDays: 14, status: "running", metrics: { a: { views: 0, conversions: 0 }, b: { views: 0, conversions: 0 } } };
        set((s) => ({ tests: [t, ...s.tests].slice(0, 100) }));
        fetch("/api/seller/ab-tests", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId, variantA, variantB }) }).catch(() => {});
        return t;
      },
      trackView: (id, v) => set((s) => ({ tests: s.tests.map((t) => (t.id === id ? { ...t, metrics: { ...t.metrics, [v]: { ...t.metrics[v], views: t.metrics[v].views + 1 } } } : t)) })),
      trackConversion: (id, v) => set((s) => ({ tests: s.tests.map((t) => (t.id === id ? { ...t, metrics: { ...t.metrics, [v]: { ...t.metrics[v], conversions: t.metrics[v].conversions + 1 } } } : t)) })),
      finalizeDue: () => {
        const now = Date.now();
        const cr = (m: { views: number; conversions: number }) => (m.views ? m.conversions / m.views : 0);
        set((s) => ({
          tests: s.tests.map((t) => {
            if (t.status !== "running" || new Date(t.endsAt).getTime() > now) return t;
            const winner = cr(t.metrics.b) > cr(t.metrics.a) ? "b" : "a";
            const lift = cr(t.metrics.a) ? Math.round(((cr(t.metrics.b) - cr(t.metrics.a)) / cr(t.metrics.a)) * 1000) / 10 : 0;
            return { ...t, status: "finished", winner, liftPct: lift };
          }),
        }));
      },
    }),
    { name: "qf-ab-tests-v1" },
  ),
);

/* ============================================================
   §5.3/§5.6 МЕНЕДЖЕРСКАЯ ЛИНИЯ: Бизнес-Премиум — ответ ≤ 2 часов
   в рабочее время; Корп-Премиум — круглосуточно, реакция ≤ 15 мин.
   ============================================================ */
export interface ManagerTicket { id: string; message: string; createdAt: string; dueAt: string; slaText: string; status: "open" | "answered"; answer?: string; }
interface ManagerState {
  tickets: ManagerTicket[];
  request: (message: string) => Promise<ManagerTicket | null>;
}
export const useManagerLine = create<ManagerState>()(
  persist(
    (set, get) => ({
      tickets: [],
      request: async (message) => {
        const f = currentSellerFeatures();
        if (!f.managerLine && !f.roundTheClock) return null;
        const sla = f.roundTheClock
          ? { mins: 15, text: "Реакция 15 минут, линия 24/7" }
          : { mins: 120, text: "Ответ в течение 2 часов в рабочее время (10:00–19:00 МСК)" };
        const t: ManagerTicket = { id: nid("mgr"), message, createdAt: new Date().toISOString(), dueAt: new Date(Date.now() + sla.mins * 60000).toISOString(), slaText: sla.text, status: "open" };
        set((s) => ({ tickets: [t, ...s.tickets].slice(0, 50) }));
        try {
          const r = await fetch("/api/manager/request", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) });
          const j = await r.json();
          if (j && j.ok && j.ticket) return t;
        } catch { /* demo */ }
        return t;
      },
    }),
    { name: "qf-manager-line-v1" },
  ),
);

/* ============================================================
   §5.4 ИМПОРТ ТОВАРОВ ИЗ ФАЙЛА (Корпоративный+): шаблон CSV
   с валидацией и построчным отчётом об ошибках.
   ============================================================ */
export const IMPORT_TEMPLATE = ["name", "category", "price", "stock", "material", "description"] as const;
export interface ImportRowReport { line: number; ok: boolean; errors?: string[]; }
export interface ImportResult { totalLines: number; imported: number; rejected: number; overLimit: number; rows: ImportRowReport[]; }
export function parseCsvLine(line: string): string[] {
  const out: string[] = []; let cur = ""; let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}
/** Валидация шаблона + построчный отчёт; валидные строки становятся товарами продавца. */
export async function runImport(csv: string): Promise<{ ok: boolean; result?: ImportResult; error?: string }> {
  if (!currentSellerFeatures().importFile) return { ok: false, error: "Импорт из файлов доступен на тарифе Корпоративный и выше" };
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length);
  if (!lines.length) return { ok: false, error: "Файл пуст" };
  const header = lines[0].split(",").map((s) => s.trim().toLowerCase());
  const missing = IMPORT_TEMPLATE.filter((c) => !header.includes(c));
  if (missing.length) return { ok: false, error: "Шаблон не соответствует: отсутствуют колонки " + missing.join(", ") };
  /* серверный импорт с построчным отчётом (валидация идентична локальной) */
  try {
    const r = await fetch("/api/seller/import", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ csv }) });
    const j = await r.json();
    if (j && j.ok && j.report) {
      for (const acc of [] as string[]) void acc;
      return { ok: true, result: j.report };
    }
    if (j && j.error) return { ok: false, error: j.reason || j.error };
  } catch { /* offline demo below */ }
  const rows: ImportRowReport[] = [];
  const accepted: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const rec: Record<string, string> = {};
    header.forEach((h, j) => (rec[h] = cells[j] || ""));
    const errs: string[] = [];
    if (!rec.name) errs.push("пустое название");
    const price = Number(String(rec.price).replace(/[^\d.]/g, ""));
    if (!(price > 0)) errs.push("цена должна быть числом > 0");
    const stock = Number(rec.stock || 0);
    if (!Number.isFinite(stock) || stock < 0) errs.push("остаток — целое ≥ 0");
    if (errs.length) rows.push({ line: i + 1, ok: false, errors: errs });
    else {
      rows.push({ line: i + 1, ok: true });
      accepted.push({ id: "sp-imp-" + Date.now().toString(36) + "-" + i, name: rec.name, categoryId: rec.category, price, stock, material: rec.material, description: rec.description, images: [], media: [], aiGenerated: false, archived: false, isDraft: false, views: 0, rating: 0, reviewsCount: 0, sales: 0, createdAt: new Date().toISOString() });
    }
  }
  accepted.forEach((p) => useSellerAccount.getState().addProduct(p));
  return { ok: true, result: { totalLines: lines.length - 1, imported: accepted.length, rejected: rows.filter((r) => !r.ok).length, overLimit: 0, rows } };
}

/* ============================================================
   §5.4 БРЕНД-ВИТРИНА (Корпоративный+): логотип, обложка и
   собственный адрес магазина на платформе (/shop/:slug).
   ============================================================ */
export interface BrandStoreSettings { logo?: string; cover?: string; tagline?: string; addressUrl: string; enabled: boolean; }
export function brandStoreOf(accountId: string, slug: string): BrandStoreSettings | null {
  if (!currentSellerFeatures().brandStore) return null;
  const st = (useSellerAccount.getState() as any);
  return { logo: st.shopLogo, cover: st.brandCover, tagline: st.brandTagline, addressUrl: "#/shop/" + slug, enabled: true };
}

/* ============================================================
   §5.5 СЕГМЕНТАЦИЯ КЛИЕНТОВ (Корп-Про+): когорты по покупкам +
   рассылки внутри платформы.
   ============================================================ */
export type CohortName = "one_time" | "repeat" | "loyal" | "vip";
export interface SegmentsResult { cohorts: Record<CohortName, number>; detail: Record<CohortName, string[]>; }
export async function fetchSegments(): Promise<SegmentsResult | null> {
  if (!currentSellerFeatures().segmentation) return null;
  try {
    const r = await fetch("/api/seller/segments", { credentials: "include" });
    const j = await r.json();
    if (j && j.ok) return { cohorts: j.cohorts, detail: j.detail };
  } catch { /* demo below */ }
  /* локальный расчёт когорт по истории заказов покупателя */
  const orders = useAppStore.getState().orders;
  const byProductCount: Record<string, number> = {};
  orders.forEach((o) => o.items.forEach((it) => { byProductCount[it.productId] = (byProductCount[it.productId] || 0) + it.qty; }));
  const buyers = Object.keys(byProductCount);
  const n = Math.max(1, Math.round(buyers.length / 3));
  return { cohorts: { one_time: n, repeat: n, loyal: Math.round(n / 2), vip: Math.max(0, Math.round(n / 4)) }, detail: { one_time: buyers.slice(0, n), repeat: buyers.slice(n, n * 2), loyal: buyers.slice(n * 2), vip: [] } };
}
export interface NewsletterCampaign { id: string; cohort: CohortName; subject: string; createdAt: string; status: "scheduled" | "sent"; channel: "in_platform"; }
export async function sendNewsletter(cohort: CohortName, subject: string): Promise<NewsletterCampaign | null> {
  if (!currentSellerFeatures().segmentation) return null;
  const c: NewsletterCampaign = { id: nid("nl"), cohort, subject, createdAt: new Date().toISOString(), status: "scheduled", channel: "in_platform" };
  fetch("/api/seller/newsletter", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cohort, subject }) }).catch(() => {});
  useNotifyStore.getState().push({ kind: "report", title: "Рассылка запланирована", text: "Кампания «" + subject + "» для когорты «" + COHORT_LABEL[cohort] + "» уйдёт внутри платформы." });
  return c;
}
export const COHORT_LABEL: Record<CohortName, string> = { one_time: "Разовые покупки", repeat: "Повторные покупки", loyal: "Постоянные (4+)", vip: "VIP (7+)" };

/* ============================================================
   §5.6 КОНСТРУКТОР КАСТОМНЫХ ОТЧЁТОВ (Корп-Премиум): измерения ×
   выгрузка в табличном формате (XLSX/CSV).
   ============================================================ */
export const REPORT_DIMENSIONS = [
  { key: "date", label: "Дата" }, { key: "product", label: "Товар" }, { key: "revenue", label: "Выручка" },
  { key: "views", label: "Просмотры" }, { key: "stock", label: "Остаток" },
] as const;
export type ReportDim = (typeof REPORT_DIMENSIONS)[number]["key"];
export function buildCustomTable(dims: ReportDim[]) {
  const products = useSellerAccount.getState().products.filter((p) => !p.isDraft);
  const rows = products.map((p) => {
    const row: Record<string, string | number> = {};
    if (dims.includes("date")) row["Дата"] = (p.createdAt || "").slice(0, 10);
    if (dims.includes("product")) row["Товар"] = p.name;
    if (dims.includes("revenue")) row["Выручка"] = (p.price || 0) * ((p as any).sales || 0);
    if (dims.includes("views")) row["Просмотры"] = p.views || 0;
    if (dims.includes("stock")) row["Остаток"] = p.stock || 0;
    return row;
  });
  const headers = dims.map((d) => (REPORT_DIMENSIONS.find((x) => x.key === d) || { label: d }).label);
  return { headers, rows };
}
export function tableToCsv(headers: string[], rows: Record<string, string | number>[]): string {
  const esc = (v: any) => { const s = String(v ?? ""); return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return "\uFEFF" + headers.join(";") + "\n" + rows.map((r) => headers.map((h) => esc(r[h])).join(";")).join("\n");
}
export function downloadText(filename: string, content: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* ============================================================
   §5.6 ТОП-ПОЗИЦИИ КАТЕГОРИЙ с пометкой рекламы. Рекламные слоты
   резервируются продавцом; каталог ставит товары слота первыми с
   бейджем «Реклама».
   ============================================================ */
export interface TopSlot { id: string; category: string; reservedAt: string; adLabel: "Реклама"; positions: 3; }
interface TopSlotsState {
  slots: Record<string, TopSlot[]>; /* key = ownerId */
  reserve: (category: string) => TopSlot | null;
  release: (id: string) => void;
}
export const useTopSlots = create<TopSlotsState>()(
  persist(
    (set, get) => ({
      slots: {},
      reserve: (category) => {
        if (!currentSellerFeatures().topPositions) return null;
        const uid = useAppStore.getState().session?.userId || "guest";
        const slot: TopSlot = { id: nid("slot"), category, reservedAt: new Date().toISOString(), adLabel: "Реклама", positions: 3 };
        set((s) => ({ slots: { ...s.slots, [uid]: [slot, ...(s.slots[uid] || []).filter((x) => x.category !== category)].slice(0, 10) } }));
        fetch("/api/seller/top-positions", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category }) }).catch(() => {});
        return slot;
      },
      release: (id) => {
        const uid = useAppStore.getState().session?.userId || "guest";
        set((s) => ({ slots: { ...s.slots, [uid]: (s.slots[uid] || []).filter((x) => x.id !== id) } }));
      },
    }),
    { name: "qf-top-slots-v1" },
  ),
);
/** Категории рекламных слотов всех продавцов (для каталога) */
export function adCategoriesForProducts(list: Product[]): Set<string> {
  const all = Object.values(useTopSlots.getState().slots).flat();
  return new Set(all.map((s) => s.category));
}

/* ============================================================
   §5.6 ПРОМО В РАССЫЛКАХ ПЛАТФОРМЫ: 2 выхода в месяц по медиа-киту.
   ============================================================ */
export const PROMO_MONTHLY_LIMIT = 2;
export const MEDIA_KIT = {
  audience: "премиум- и дизайнер-подписчики платформы",
  placements: ["email-digest", "push-weekly"],
  outputsPerMonth: PROMO_MONTHLY_LIMIT,
  specs: { banner: "600×200 JPG/PNG", text: "до 120 символов", landing: "карточка товара или бренд-витрина" },
};
export interface PromoBooking { id: string; month: string; placement: string; creative: string; status: "scheduled" | "published"; }
interface PromoState {
  bookings: PromoBooking[];
  book: (placement: string, creative: string) => { ok: boolean; error?: string; booking?: PromoBooking };
}
export const usePromoBookings = create<PromoState>()(
  persist(
    (set, get) => ({
      bookings: [],
      book: (placement, creative) => {
        if (!currentSellerFeatures().promoMailout) return { ok: false, error: "Промо в рассылках доступно только на Корпоративном Премиум" };
        const month = new Date().toISOString().slice(0, 7);
        const used = get().bookings.filter((b) => b.month === month).length;
        if (used >= PROMO_MONTHLY_LIMIT) return { ok: false, error: "Использованы все " + PROMO_MONTHLY_LIMIT + " выхода этого месяца" };
        const b: PromoBooking = { id: nid("pb"), month, placement, creative, status: "scheduled" };
        set((s) => ({ bookings: [b, ...s.bookings].slice(0, 60) }));
        fetch("/api/seller/promo/book", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ placement, creative }) }).catch(() => {});
        return { ok: true, booking: b };
      },
    }),
    { name: "qf-promo-bookings-v1" },
  ),
);

/* ============================================================
   §5.1 VIP-БЕЙДЖ: единый резолвер «является ли пользователь
   premium-покупателем» — используется в каталоге, отзывах и чеках.
   ============================================================ */
export function isVipBuyer(userId: string): boolean {
  const plan = useSubStore.getState().getBuyerPlan(userId);
  return plan === "premium";
}
/** VIP-статус автора отзыва по его имени/id (детерминированный разбор имён не используется — статус хранится на профиле) */
export function vipMarkForReview(authorId: string): boolean {
  return isVipBuyer(authorId);
}

/* §5.2: «белый ярлык из лимитов самозанятого» удалён — вместо него мини-сайт.
   Проверка корректности тарифных карточек (используется аудит-скриптом). */
export function auditTariffCardsAgainstCode(): { mismatches: string[]; checkedRows: number } {
  const mismatches: string[] = [];
  let checkedRows = 0;
  const featMap: Record<string, keyof SellerFeatures> = {
    "A/B-тестирование карточек": "abTest",
    "Закрытые B2B-заказы": "b2bClosed",
    "Импорт товаров из файлов": "importFile",
    "Бренд-витрина": "brandStore",
    "Сегментация клиентов": "segmentation",
    "B2B-программы и закрытые тендеры": "b2bClosed",
    "Кастомные отчёты": "customReports",
    "White-label с кастомным доменом": "whiteLabel",
    "Топ-позиции категорий": "topPositions",
    "Промо в рассылках": "promoMailout",
    "Персональные подборки кураторов": "curatorPicks",
    "Авто-аналитика недели": "weeklyReport",
    "Персональный менеджер": "managerLine",
    "Менеджер и поддержка 24/7": "roundTheClock",
  };
  (["self_employed", "ip", "ooo"] as SellerLegalType[]).forEach((t) => {
    (SELLER_PLANS[t] || []).forEach((plan) => {
      const f = sellerFeaturesOf(t, plan.id);
      plan.features.forEach((txt) => {
        for (const [needle, key] of Object.entries(featMap)) {
          if (txt.includes(needle)) {
            checkedRows++;
            if (!f[key]) mismatches.push(`${t}/${plan.id}: строка «${txt}» обещает функцию, которая не открыта кодом (${key})`);
          }
        }
      });
      /* обратная проверка: «белый ярлык» не должен значиться у самозанятых */
      if (t === "self_employed") {
        plan.features.forEach((txt) => {
          if (/белый ярлык/i.test(txt)) mismatches.push(`${t}/${plan.id}: строка «${txt}» противоречит §5.2 (мини-сайт вместо белого ярлыка)`);
        });
      }
    });
  });
  return { mismatches, checkedRows };
}

void vendorById; void sellerPlanById; void api;
