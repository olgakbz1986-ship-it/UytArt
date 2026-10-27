/* ============================================================
   Типизация единого тарифного ядра (shared/tariffs/core.cjs).
   Единственный источник истинных числовых таблиц для клиента
   (src/lib/subscriptions.ts, src/lib/seller.ts) и сервера
   (server/tariffs.cjs). При изменении таблиц в core.js
   обновляйте и этот файл — tsc поймает рассинхрон типов.
   ============================================================ */

/** Резолвер маркера безлимита: "∞" -> Infinity, иначе — число как есть. */
export declare function INF(v: number | "∞"): number;

/** Строка лимитов: значения — числа или маркер безлимита "∞". */
export type LimitRow = Record<string, number | "∞">;
/** Таблица лимитов (может быть вложенной: юрлицо → тариф → строка). */
export type LimitsTable = Record<string, LimitRow>;

/** Разворачивает таблицу лимитов, заменяя все "∞" на Infinity. */
export declare function resolveLimits(table: LimitsTable): Record<string, Record<string, number>>;

/* ---------- матрица комиссий по типу юрлица и тарифу (§1.2) ---------- */
export declare const COMMISSION_MATRIX: Record<string, Record<string, number>>;

/** Уровень тарифа по любому имени (для фолбека по позиции в линейке). */
export declare const PLAN_LEVEL: Record<string, number>;

/* ---------- сырые таблицы лимитов (безлимит = "∞") ---------- */
export declare const SELLER_LIMITS_RAW: Record<string, Record<string, LimitRow>>;
export declare const BUYER_PLANS_RAW: Record<string, LimitRow>;

/* ---------- разовые регистрационные взносы (§1.4) ---------- */
export declare const REGISTRATION_FEES: Record<string, number>;

/* ---------- месячные цены тарифов продавца (§4.1–§4.6) ---------- */
export interface PlanPriceRow {
  id: string;
  price: number;
  legacyPrice?: number;
}
export declare const SELLER_PLAN_PRICES: Record<string, PlanPriceRow[]>;

/* ---------- цены подписок покупателя (§4.6) ---------- */
export declare const BUYER_PLAN_PRICES: Record<string, number>;

/* ---------- переходный период и ревизия цен (§4.3) ---------- */
export declare const GRANDFATHER_MONTHS: Record<string, number>;
export declare const PRICE_REVISION_NOTICE_DAYS: number;
export declare const PRICE_REVISION_EFFECTIVE_AT_DEFAULT: string;

/* ---------- годовая цена: −20%, округление до 10 ₽ (§3.2/§4.2) ---------- */
export declare const YEAR_DISCOUNT: number;
export declare function yearPriceOf(monthly: number): number;

/* ---------- разовые пакеты сверх лимита (§4.5) ---------- */
export interface OverlimitPack {
  kind: string;
  slots: number;
  price: number;
  title: string;
}
export declare const OVERLIMIT_PACKS: Record<string, OverlimitPack>;
export declare function packForAction(action: string): string | null;

/* ---------- функции-резолверы ---------- */
export declare function commissionRateOf(legalType: string, planId: string): number | null;
/** Лимиты продавца из РЕЗОЛВЕННОЙ таблицы; дженерик позволяет сторонам
 *  добавлять собственные поля (UI-флаги клиента, паки сервера). */
export declare function sellerLimitsOf<T extends Record<string, Record<string, object>>>(
  resolvedSellerLimits: T,
  legalType: string,
  planId: string
): T[keyof T][string];
export declare function sellerPlanPriceRow(legalType: string, planId: string): PlanPriceRow | null;
