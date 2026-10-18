import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api, type ApiTariff } from "./api";

/* ============================================================
   ТАРИФНЫЙ КЛИЕНТСКИЙ СТОР (ЭТАП 1, §1.3)
   ------------------------------------------------------------
   Источник истины о тарифе — СЕРВЕР (server/tariffs.cjs).
   Локальное хранилище браузера используется ТОЛЬКО как кэш:
   - при входе тариф приходит вместе с профилем (login/me);
   - перед любой потребляющей операцией вызывается assertLimit,
     который СПРАШИВАЕТ СЕРВЕР (GET /api/limits/check), а не кэш;
   - правка localStorage не даёт никаких привилегий: серверные
     лимиты и комиссии считаются по базе (обход невозможен).
   ============================================================ */

export interface ServerTariff {
  accountId: string;
  legalType: string;
  sellerPlanId: string;
  buyerPlanId: string;
  commissionRate: number | null; /* null — данных о тарифе нет вообще */
  limits: {
    seller: { maxProducts: number; aiCardGens: number };
    buyer: { aiGens: number; marketOrders: number; priceWatches: number };
  };
  updatedAt?: string;
}

export type LimitAction =
  | "product_create"
  | "ai_card_gen"
  | "ai_gen"
  | "interior_project" /* списывает 3 генерации (§2.1) */
  | "market_order"
  | "price_watch"
  | "agent_task";

export interface LimitCheckResult {
  allowed: boolean;
  limit: number;
  used: number;
  reason?: string | null;
}

interface TariffState {
  tariff: ServerTariff | null; /* кэш серверного тарифа */
  syncedAt: string | null;
  setTariff: (t: ServerTariff | null) => void;
  refresh: () => Promise<ServerTariff | null>;
  /** Комиссия продавца: берётся из серверного тарифа; резервные 15% —
   *  только когда данных о тарифе нет вообще (§1.1). */
  commissionPercent: () => number;
  /** Серверная проверка лимита перед потребляющей операцией (§1.5). */
  checkLimit: (action: LimitAction, meta?: Record<string, unknown>) => Promise<LimitCheckResult | null>;
  /** Проверка + списание на сервере. Бросает ошибку с платной стеной,
   *  если лимит исчерпан — операция НЕ выполняется. */
  assertLimit: (action: LimitAction, cost?: number, meta?: Record<string, unknown>) => Promise<LimitCheckResult>;
}

/** Ошибка лимита: UI показывает по ней платную стену с апгрейдом. */
export class LimitReachedError extends Error {
  action: LimitAction;
  limit: number;
  used: number;
  offer: { packId: string; title: string; price: number; slots: number } | null; /* §4.5: пакет сверх лимита */
  constructor(action: LimitAction, limit: number, used: number, reason?: string, offer?: { packId: string; title: string; price: number; slots: number } | null) {
    super(reason || "Лимит тарифа исчерпан");
    this.name = "LimitReachedError";
    this.action = action;
    this.limit = limit;
    this.used = used;
    this.offer = offer || null;
  }
}

const toServerTariff = (t: ApiTariff | undefined | null): ServerTariff | null => {
  if (!t) return null;
  const inf = (v: any) => (v === "Infinity" || v === Infinity ? Number.POSITIVE_INFINITY : typeof v === "number" ? v : Number(v));
  return {
    accountId: String(t.accountId),
    legalType: t.legalType,
    sellerPlanId: t.sellerPlanId,
    buyerPlanId: t.buyerPlanId,
    commissionRate: t.commissionRate == null ? null : Number(t.commissionRate),
    limits: {
      seller: { maxProducts: inf(t.limits?.seller?.maxProducts), aiCardGens: inf(t.limits?.seller?.aiCardGens) },
      buyer: {
        aiGens: inf(t.limits?.buyer?.aiGens),
        marketOrders: inf(t.limits?.buyer?.marketOrders),
        priceWatches: inf(t.limits?.buyer?.priceWatches),
      },
    },
    updatedAt: t.updatedAt,
  };
};

export const useTariffStore = create<TariffState>()(
  persist(
    (set, get) => ({
      tariff: null,
      syncedAt: null,

      setTariff: (t) => set({ tariff: t, syncedAt: new Date().toISOString() }),

      refresh: async () => {
        try {
          const r = await api.tariff();
          const t = toServerTariff(r && r.ok ? r.tariff : null);
          if (t) set({ tariff: t, syncedAt: new Date().toISOString() });
          return t;
        } catch {
          return get().tariff; /* сеть недоступна — остаёмся на кэше (он ничего не решает) */
        }
      },

      commissionPercent: () => {
        const t = get().tariff;
        /* §1.1: резерв 15% — ТОЛЬКО при полном отсутствии данных о тарифе */
        if (!t || t.commissionRate == null) return 15;
        return t.commissionRate;
      },

      checkLimit: async (action, meta) => {
        try {
          const r = await api.limitCheck(action, meta);
          if (!r || !r.ok) return null;
          return { allowed: !!r.allowed, limit: Number(r.limit), used: Number(r.used), reason: r.reason };
        } catch {
          return null;
        }
      },

      assertLimit: async (action, cost = 1, meta) => {
        /* Каждая потребляющая операция спрашивает СЕРВЕР (§1.5).
           Ответ сервера — истина; кэш localStorage не проверяется вовсе. */
        for (let i = 0; i < (cost > 1 ? cost : 1); i++) {
          const r = await api.limitConsume(action, meta);
          if (!r || r.ok !== true) {
            const lim = (r && Number(r.limit)) || 0;
            const used = (r && Number(r.used)) || 0;
            throw new LimitReachedError(action, lim, used, r && r.reason, (r as any) && (r as any).offer);
          }
          /* синхронизируем кэш тарифа после успешного потребления */
          get().refresh().catch(() => {});
        }
        const chk = await get().checkLimit(action, meta);
        return chk || { allowed: true, limit: -1, used: -1 };
      },
    }),
    { name: "qf-tariff-cache-v1", partialize: (s) => ({ tariff: s.tariff, syncedAt: s.syncedAt }) }
  )
);

/* Вызывается из store.authLogin/restoreSession: тариф приходит с сервера
   ВМЕСТЕ С ПРОФИЛЕМ (§1.3). */
export function applyServerTariff(t: ApiTariff | null | undefined) {
  useTariffStore.getState().setTariff(toServerTariff(t));
}
