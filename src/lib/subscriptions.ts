import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SellerLegalType } from "./seller";

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
export const BUYER_PLANS: Record<BuyerPlanId, BuyerLimits> = {
  free: { aiGens: 2, marketOrders: 1, priceWatches: 0, qualityFilters: false, discountPct: 0, earlyAccess: false, curator: false, vip: false },
  start: { aiGens: 15, marketOrders: 3, priceWatches: 10, qualityFilters: true, discountPct: 3, earlyAccess: false, curator: false, vip: false },
  designer: { aiGens: 50, marketOrders: 10, priceWatches: 999, qualityFilters: true, discountPct: 5, earlyAccess: true, curator: false, vip: false },
  premium: { aiGens: Infinity, marketOrders: Infinity, priceWatches: Infinity, qualityFilters: true, discountPct: 7, earlyAccess: true, curator: true, vip: true },
};
export const buyerLimits = (plan: BuyerPlanId): BuyerLimits => BUYER_PLANS[plan] || BUYER_PLANS.free;

export const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/* ---------- лимиты продавцов по юрлицу и тарифу ---------- */
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
const UNLIM = Infinity;
export const SELLER_LIMITS: Record<SellerLegalType, Record<string, SellerLimits>> = {
  self_employed: {
    free: { maxProducts: 5, aiCardGens: 0, analytics: "basic", marketPriority: 0, massEdit: false, bundles: false, team: 0, importFile: false, brandStore: false, abTest: false, b2b: false, forecasts: false, segmentation: false, manager: false, whiteLabel: false },
    master: { maxProducts: 30, aiCardGens: 10, analytics: "extended", marketPriority: 1, massEdit: false, bundles: false, team: 0, importFile: false, brandStore: false, abTest: false, b2b: false, forecasts: false, segmentation: false, manager: false, whiteLabel: false },
    profi: { maxProducts: 100, aiCardGens: UNLIM, analytics: "advanced", marketPriority: 2, massEdit: true, bundles: true, team: 0, importFile: false, brandStore: false, abTest: false, b2b: false, forecasts: false, segmentation: false, manager: false, whiteLabel: false },
    top: { maxProducts: UNLIM, aiCardGens: UNLIM, analytics: "full", marketPriority: 3, massEdit: true, bundles: true, team: 0, importFile: false, brandStore: false, abTest: false, b2b: false, forecasts: true, segmentation: false, manager: false, whiteLabel: false, badge: "Проверенный мастер" },
  },
  ip: {
    free: { maxProducts: 20, aiCardGens: 0, analytics: "basic", marketPriority: 0, massEdit: false, bundles: false, team: 0, importFile: false, brandStore: false, abTest: false, b2b: false, forecasts: false, segmentation: false, manager: false, whiteLabel: false },
    business: { maxProducts: 100, aiCardGens: 30, analytics: "extended", marketPriority: 1, massEdit: true, bundles: false, team: 0, importFile: false, brandStore: false, abTest: false, b2b: false, forecasts: false, segmentation: false, manager: false, whiteLabel: false },
    "business-pro": { maxProducts: 500, aiCardGens: UNLIM, analytics: "advanced", marketPriority: 3, massEdit: true, bundles: true, team: 3, importFile: false, brandStore: false, abTest: false, b2b: false, forecasts: true, segmentation: false, manager: false, whiteLabel: false },
    "business-premium": { maxProducts: UNLIM, aiCardGens: UNLIM, analytics: "full", marketPriority: 3, massEdit: true, bundles: true, team: 10, importFile: true, brandStore: false, abTest: true, b2b: true, forecasts: true, segmentation: true, manager: true, whiteLabel: false, badge: "Премиум продавец" },
  },
  ooo: {
    free: { maxProducts: 50, aiCardGens: 0, analytics: "basic", marketPriority: 0, massEdit: false, bundles: false, team: 0, importFile: false, brandStore: false, abTest: false, b2b: false, forecasts: false, segmentation: false, manager: false, whiteLabel: false },
    corp: { maxProducts: 500, aiCardGens: 100, analytics: "extended", marketPriority: 1, massEdit: true, bundles: false, team: 5, importFile: true, brandStore: true, abTest: false, b2b: false, forecasts: false, segmentation: false, manager: false, whiteLabel: false },
    "corp-pro": { maxProducts: 2000, aiCardGens: UNLIM, analytics: "advanced", marketPriority: 3, massEdit: true, bundles: true, team: 15, importFile: true, brandStore: true, abTest: true, b2b: true, forecasts: true, segmentation: true, manager: false, whiteLabel: false },
    "corp-premium": { maxProducts: UNLIM, aiCardGens: UNLIM, analytics: "full", marketPriority: 3, massEdit: true, bundles: true, team: UNLIM, importFile: true, brandStore: true, abTest: true, b2b: true, forecasts: true, segmentation: true, manager: true, whiteLabel: true, badge: "Официальный бренд" },
  },
};
export const sellerLimits = (t: SellerLegalType, planId: string): SellerLimits =>
  SELLER_LIMITS[t]?.[planId] || SELLER_LIMITS[t].free;

/* ---------- состояние подписок покупателя ---------- */
export interface Concept { id: string; style: string; roomName: string; image?: string; createdAt: string; }
export interface PriceWatch { id: string; productId: string; oldPrice: number; targetPrice: number; notified?: boolean; }

interface SubState {
  buyerPlan: BuyerPlanId;
  aiGensUsed: Record<string, number>;
  concepts: Concept[];
  priceWatches: PriceWatch[];
  setBuyerPlan: (p: BuyerPlanId) => void;
  consumeAiGen: () => boolean;
  aiGensLeft: () => number;
  addConcept: (c: Omit<Concept, "id" | "createdAt">) => void;
  removeConcept: (id: string) => void;
  addPriceWatch: (w: Omit<PriceWatch, "id">) => void;
  removePriceWatch: (id: string) => void;
}

export const useSubStore = create<SubState>()(
  persist(
    (set, get) => ({
      buyerPlan: "free",
      aiGensUsed: {},
      concepts: [],
      priceWatches: [],

      setBuyerPlan: (p) => set({ buyerPlan: p }),

      consumeAiGen: () => {
        const plan = buyerLimits(get().buyerPlan);
        const month = currentMonth();
        const used = get().aiGensUsed[month] || 0;
        if (used >= plan.aiGens) return false;
        set((s) => ({ aiGensUsed: { ...s.aiGensUsed, [month]: used + 1 } }));
        return true;
      },
      aiGensLeft: () => {
        const plan = buyerLimits(get().buyerPlan);
        if (!Number.isFinite(plan.aiGens)) return Infinity;
        const used = get().aiGensUsed[currentMonth()] || 0;
        return Math.max(0, plan.aiGens - used);
      },

      addConcept: (c) =>
        set((s) => ({ concepts: [{ ...c, id: "c-" + Date.now(), createdAt: new Date().toISOString() }, ...s.concepts] })),
      removeConcept: (id) => set((s) => ({ concepts: s.concepts.filter((c) => c.id !== id) })),

      addPriceWatch: (w) => set((s) => ({ priceWatches: [{ ...w, id: "pw-" + Date.now() }, ...s.priceWatches] })),
      removePriceWatch: (id) => set((s) => ({ priceWatches: s.priceWatches.filter((w) => w.id !== id) })),
    }),
    { name: "uyutart-sub-v2" }
  )
);

/* форматирование лимита: ∞ для безлимита */
export const fmtLimit = (n: number) => (Number.isFinite(n) ? String(n) : "∞");
export const selectAiLeft = (s: SubState) => {
  const plan = buyerLimits(s.buyerPlan);
  if (!Number.isFinite(plan.aiGens)) return Infinity;
  return Math.max(0, plan.aiGens - (s.aiGensUsed[currentMonth()] || 0));
};
