import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SellerLegalType } from "./seller";
/* Единое тарифное ядро (shared/tariffs/core.cjs) — единственный источник
   истинных числовых таблиц. Клиент обязан использовать ТОЛЬКО его:
   локальные дубли BUYER_PLANS / SELLER_LIMITS удалены (риск рассинхрона
   с сервером устранён). Маркер безлимита «∞» резолвится в Infinity. */
import * as core from "../../shared/tariffs/core.cjs";

/* ============================================================
   Подписки: покупатели (4 тарифа) + лимиты продавцов по юрлицу
   ============================================================ */

export type BuyerPlanId = "free" | "start" | "designer" | "premium";
export interface BuyerLimits {
  aiGens: number;          /* AI-генераций в месяц, Infinity = безлимит */
  marketOrders: number;    /* активных индивидуальных заказов */
  priceWatches: number;    /* отслеживаемых товаров */
  qualityFilters: boolean;
  discountPct: number;     /* скидка на заказы, % */
  earlyAccess: boolean;
  curator: boolean;        /* персональный куратор */
  vip: boolean;
}
/* Числовые лимиты — из единого ядра; булевы/процентные флаги фич
   (совпадают с серверной BUYER_FEATURES в tariffs.cjs) дополняют locally. */
const BUYER_FEATURE_FLAGS: Record<BuyerPlanId, Pick<BuyerLimits, "qualityFilters" | "discountPct" | "earlyAccess" | "curator" | "vip">> = {
  free:     { qualityFilters: false, discountPct: 0, earlyAccess: false, curator: false, vip: false },
  start:    { qualityFilters: true,  discountPct: 3, earlyAccess: false, curator: false, vip: false },
  designer: { qualityFilters: true,  discountPct: 5, earlyAccess: true,  curator: false, vip: false },
  premium:  { qualityFilters: true,  discountPct: 7, earlyAccess: true,  curator: true,  vip: true },
};
const BUYER_NUM_LIMITS = core.resolveLimits(core.BUYER_PLANS_RAW) as Record<BuyerPlanId, Pick<BuyerLimits, "aiGens" | "marketOrders" | "priceWatches">>;
export const BUYER_PLANS: Record<BuyerPlanId, BuyerLimits> = {
  free:     { ...BUYER_NUM_LIMITS.free,     ...BUYER_FEATURE_FLAGS.free },
  start:    { ...BUYER_NUM_LIMITS.start,    ...BUYER_FEATURE_FLAGS.start },
  designer: { ...BUYER_NUM_LIMITS.designer, ...BUYER_FEATURE_FLAGS.designer },
  premium:  { ...BUYER_NUM_LIMITS.premium,  ...BUYER_FEATURE_FLAGS.premium },
};
export const buyerLimits = (plan: BuyerPlanId): BuyerLimits => BUYER_PLANS[plan] || BUYER_PLANS.free;

export const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/* ============================================================
   ЭТАП 3 (§3.1): ЕДИНАЯ ТАБЛИЦА ЛИМИТОВ — источник истины для
   всех экранов тарифов. Семь противоречий текста карточек устранены:
     · Мастер:        500 товаров (было 30), 100 генераций (было 10)
     · Профи:         2000 товаров (было 100)
     · ИП Бесплатный: 50 товаров (было 20)
     · Бизнес:        500 товаров (было 100), 100 генераций (было 30)
     · Бизнес-Про:    2000 товаров (было 500), команда 15 (было 3)
     · Бизнес-Премиум:безлимитная команда (было 10)
   Унификация бейджей (§3.1): самозанятые — «Проверенный мастер»,
   юридические лица (ИП/ООО) — «Официальный бренд».
   ============================================================ */

/* ---------- лимиты продавцов по юрлицу и тарифу ----------
   Числовые ядра (maxProducts / aiCardGens) — из единого тарифного ядра;
   расширенные UI-флаги (analytics/team/…) дополняются локально и
   соответствуют серверной сетке SELLER_FEATURES_BASE (§5.1–§5.6). */
export interface SellerLimits {
  maxProducts: number;
  aiCardGens: number;
  analytics: "basic" | "extended" | "advanced" | "full";
  marketPriority: number;
  massEdit: boolean;
  bundles: boolean;
  team: number;
  importFile: boolean;
  brandStore: boolean;
  abTest: boolean;
  b2b: boolean;
  forecasts: boolean;
  segmentation: boolean;
  manager: boolean;
  whiteLabel: boolean;
  badge?: string;
}
type SellerUiFlags = Omit<SellerLimits, "maxProducts" | "aiCardGens">;
/* Флаги по УРОВНЮ тарифа (0..3), одинаковые для всех трёх линеек. */
const SELLER_UI_BY_LEVEL: SellerUiFlags[] = [
  /* lvl 0 — free */
  { analytics: "basic", marketPriority: 0, massEdit: false, bundles: false, team: 0, importFile: false, brandStore: false, abTest: false, b2b: false, forecasts: false, segmentation: false, manager: false, whiteLabel: false },
  /* lvl 1 — master / business / corp */
  { analytics: "extended", marketPriority: 1, massEdit: false, bundles: false, team: 5, importFile: true, brandStore: true, abTest: false, b2b: false, forecasts: false, segmentation: false, manager: false, whiteLabel: false },
  /* lvl 2 — *-pro / profi */
  { analytics: "advanced", marketPriority: 3, massEdit: true, bundles: true, team: 15, importFile: true, brandStore: true, abTest: false, b2b: true, forecasts: true, segmentation: true, manager: false, whiteLabel: false },
  /* lvl 3 — *-premium / top */
  { analytics: "full", marketPriority: 3, massEdit: true, bundles: true, team: Infinity, importFile: true, brandStore: true, abTest: true, b2b: true, forecasts: true, segmentation: true, manager: true, whiteLabel: true },
];
const BADGE_BY_LEGAL_LEVEL3: Record<string, string> = { self_employed: "Проверенный мастер", ip: "Официальный бренд", ooo: "Официальный бренд" };

const SELLER_LIMITS: Record<SellerLegalType, Record<string, SellerLimits>> = (() => {
  const numeric = core.resolveLimits(core.SELLER_LIMITS_RAW as any) as unknown as Record<
    string,
    Record<string, Pick<SellerLimits, "maxProducts" | "aiCardGens">>
  >;
  const out: Record<string, Record<string, SellerLimits>> = {};
  for (const legalType of Object.keys(numeric)) {
    const rows: Record<string, SellerLimits> = {};
    const planIds = Object.keys(numeric[legalType]);
    planIds.forEach((planId, idx) => {
      const flags: SellerUiFlags = { ...SELLER_UI_BY_LEVEL[Math.min(idx, 3)] };
      if (idx === 3) flags.badge = BADGE_BY_LEGAL_LEVEL3[legalType];
      rows[planId] = { ...numeric[legalType][planId], ...flags };
    });
    out[legalType] = rows;
  }
  return out as Record<SellerLegalType, Record<string, SellerLimits>>;
})();

/* Уровень тарифа по любому имени (top/profi из комиссионной матрицы и master-pro и т.д.) */
export const sellerLimits = (t: SellerLegalType, planId: string): SellerLimits =>
  core.sellerLimitsOf(SELLER_LIMITS, t, planId);

/* ---------- состояние подписок покупателя ---------- */
export interface Concept { id: string; style: string; roomName: string; image?: string; createdAt: string; }
export interface PriceWatch { id: string; productId: string; oldPrice: number; targetPrice: number; notified?: boolean; }

interface SubState {
  buyerPlanByAccount: Record<string, BuyerPlanId>; /* key = accountId */
  aiGensUsed: Record<string, number>;
  concepts: Concept[];
  priceWatches: PriceWatch[];
  /** §3.4: счётчик использованных бесплатных премиум-доставок по месяцам */
  premiumFreeDeliveries: Record<string, number>;
  setBuyerPlan: (accountId: string, p: BuyerPlanId) => void;
  getBuyerPlan: (accountId: string) => BuyerPlanId;
  consumeAiGen: (accountId: string, cost?: number) => Promise<boolean>;
  aiGensLeft: (accountId: string) => number;
  addConcept: (c: Omit<Concept, "id" | "createdAt">) => void;
  removeConcept: (id: string) => void;
  /** §1.5/§2.2: асинхронная серверная проверка лимита перед добавлением.
   *  Возвращает ошибку-предложение апгрейда, если лимит исчерпан. */
  addPriceWatch: (w: Omit<PriceWatch, "id">) => Promise<string | null>;
  removePriceWatch: (id: string) => void;
  /** §3.4: списать один слот бесплатной премиум-доставки за текущий месяц */
  consumePremiumFreeDelivery: () => void;
  premiumFreeDeliveriesLeft: () => number;
}

export const useSubStore = create<SubState>()(
  persist(
    (set, get) => ({
      buyerPlanByAccount: {},
      aiGensUsed: {},
      concepts: [],
      priceWatches: [],
      premiumFreeDeliveries: {},

      setBuyerPlan: (accountId, p) => set((s) => ({ 
        buyerPlanByAccount: { ...s.buyerPlanByAccount, [accountId]: p } 
      })),
      
      getBuyerPlan: (accountId) => get().buyerPlanByAccount[accountId] || "free",

      consumeAiGen: async (accountId, cost = 1) => {
        /* §1.5/§2.1: сервер — источник истины о лимите AI-генераций;
           локальный счётчик только зеркалится для отображения остатка. */
        try {
          const { useTariffStore } = await import("./tariff");
          await useTariffStore.getState().assertLimit("ai_gen", cost);
        } catch { return false; }
        const plan = buyerLimits(get().getBuyerPlan(accountId));
        const month = currentMonth();
        const used = get().aiGensUsed[month] || 0;
        if (used + cost > plan.aiGens && Number.isFinite(plan.aiGens)) return false;
        set((s) => ({ aiGensUsed: { ...s.aiGensUsed, [month]: Math.min(used + cost, Number.isFinite(plan.aiGens) ? plan.aiGens : used + cost) } }));
        return true;
      },
      aiGensLeft: (accountId) => {
        const plan = buyerLimits(get().getBuyerPlan(accountId));
        if (!Number.isFinite(plan.aiGens)) return Infinity;
        const used = get().aiGensUsed[currentMonth()] || 0;
        return Math.max(0, plan.aiGens - used);
      },

      addConcept: (c) =>
        set((s) => ({ concepts: [{ ...c, id: "c-" + Date.now(), createdAt: new Date().toISOString() }, ...s.concepts] })),
      removeConcept: (id) => set((s) => ({ concepts: s.concepts.filter((c) => c.id !== id) })),

      addPriceWatch: async (w) => {
        /* §1.5/§2.2: сервер — источник истины о лимите отслеживания цен
           (0 на Free, 10 на Start/Designer...); обход через правку кэша невозможен */
        try {
          const { useTariffStore } = await import("./tariff");
          await useTariffStore.getState().assertLimit("price_watch");
        } catch (e: any) {
          if (e && e.name === "LimitReachedError") {
            return `Лимит отслеживания цен исчерпан (${e.used} из ${Number.isFinite(e.limit) ? e.limit : "∞"}). Перейдите на тариф «Старт» или выше — /plans`;
          }
          return "Сервер недоступен, попробуйте позже";
        }
        set((s) => ({ priceWatches: [{ ...w, id: "pw-" + Date.now() }, ...s.priceWatches] }));
        return null;
      },
      removePriceWatch: (id) => set((s) => ({ priceWatches: s.priceWatches.filter((w) => w.id !== id) })),

      /* §3.4/Задача 7: бесплатная доставка Премиума — максимум 2 заказа в месяц */
      consumePremiumFreeDelivery: () => {
        const month = currentMonth();
        set((s) => ({ premiumFreeDeliveries: { ...s.premiumFreeDeliveries, [month]: (s.premiumFreeDeliveries[month] || 0) + 1 } }));
      },
      premiumFreeDeliveriesLeft: () => {
        const used = get().premiumFreeDeliveries[currentMonth()] || 0;
        return Math.max(0, 2 - used);
      },
    }),
    { name: "uyutart-sub-v3" }
  )
);

/* форматирование лимита: ∞ для безлимита */
export const fmtLimit = (n: number) => (Number.isFinite(n) ? String(n) : "∞");
export const selectAiLeft = (s: SubState, accountId: string) => {
  const plan = buyerLimits(s.getBuyerPlan(accountId));
  if (!Number.isFinite(plan.aiGens)) return Infinity;
  return Math.max(0, plan.aiGens - (s.aiGensUsed[currentMonth()] || 0));
};
