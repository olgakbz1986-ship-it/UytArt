/* ============================================================
   UytArt — ЕДИНОЕ ТАРИФНОЕ ЯДРО (общий пакет, single source of truth)
   ------------------------------------------------------------
   Этот файл — единственный источник истинных числовых тарифных
   таблиц для КЛИЕНТА (src/lib/subscriptions.ts, src/lib/seller.ts)
   и СЕРВЕРА (server/tariffs.cjs). Дублирование таблиц устранено:
   правки тарифов вносятся ТОЛЬКО здесь — рассинхрон невозможен.

   Формат: CommonJS (.js) — нативно работает в Node (require) и
   собирается Vite/TS в браузере (import; allowJs включён в tsconfig).

   СОГЛАШЕНИЕ О БЕЗЛИМИТЕ: во всех таблицах безлимит кодируется
   строкой "∞". Обе стороны обязаны резолвить его через INF()
   до сравнений с числами (Infinity не сериализуется в JSON и
   ломает persist-состояния).
   ============================================================ */

/** Резолвер маркера безлимита: "∞" -> Infinity, иначе — число как есть. */
function INF(v) {
  return v === "∞" ? Infinity : v;
}

/** Разворачивает таблицу лимитов, заменяя все "∞" на Infinity. */
function resolveLimits(table) {
  const out = {};
  for (const k of Object.keys(table)) {
    const row = table[k];
    const r = {};
    for (const f of Object.keys(row)) r[f] = INF(row[f]);
    out[k] = r;
  }
  return out;
}

/* ---------- матрица комиссий по типу юрлица и тарифу (§1.2) ---------- */
const COMMISSION_MATRIX = {
  self_employed: { free: 10, master: 9, profi: 8, top: 7 },
  ip: { free: 12, business: 11, "business-pro": 10, "business-premium": 9 },
  ooo: { free: 15, corp: 14, "corp-pro": 13, "corp-premium": 11 },
};

/* ---------- уровни тарифов (для фолбэка по уровню, §1.1) ---------- */
const PLAN_LEVEL = {
  free: 0,
  master: 1, business: 1, corp: 1,
  "master-pro": 2, "business-pro": 2, "corp-pro": 2, profi: 2,
  "master-premium": 3, "business-premium": 3, "corp-premium": 3, top: 3,
};

/* ---------- лимиты продавцов: maxProducts / aiCardGens (§3.1) ---------- */
const SELLER_LIMITS_RAW = {
  self_employed: {
    free: { maxProducts: 50, aiCardGens: 0 },
    master: { maxProducts: 500, aiCardGens: 100 },
    "master-pro": { maxProducts: 2000, aiCardGens: "∞" },
    "master-premium": { maxProducts: "∞", aiCardGens: "∞" },
  },
  ip: {
    free: { maxProducts: 50, aiCardGens: 0 },
    business: { maxProducts: 500, aiCardGens: 100 },
    "business-pro": { maxProducts: 2000, aiCardGens: "∞" },
    "business-premium": { maxProducts: "∞", aiCardGens: "∞" },
  },
  ooo: {
    free: { maxProducts: 50, aiCardGens: 0 },
    corp: { maxProducts: 500, aiCardGens: 100 },
    "corp-pro": { maxProducts: 2000, aiCardGens: "∞" },
    "corp-premium": { maxProducts: "∞", aiCardGens: "∞" },
  },
};

/* ---------- лимиты покупателей (§3.5: безлимит priceWatches — «∞») ---------- */
const BUYER_PLANS_RAW = {
  free: { aiGens: 2, marketOrders: 1, priceWatches: 0 },
  start: { aiGens: 15, marketOrders: 3, priceWatches: 10 },
  designer: { aiGens: 50, marketOrders: 10, priceWatches: "∞" },
  premium: { aiGens: "∞", marketOrders: "∞", priceWatches: "∞" },
};

/* ---------- разовые регистрационные взносы: 5 / 10 / 15 тыс. ₽ (§1.4) ---------- */
const REGISTRATION_FEES = { self_employed: 5000, ip: 10000, ooo: 15000 };

/* ---------- месячные цены тарифов продавца (§4.1–§4.6) ---------- */
const SELLER_PLAN_PRICES = {
  self_employed: [
    { id: "free", price: 0 },
    { id: "master", price: 300 },
    { id: "profi", price: 600 },
    { id: "top", price: 1200 },
  ],
  ip: [
    { id: "free", price: 0 },
    { id: "business", price: 999, legacyPrice: 800 },
    { id: "business-pro", price: 1999, legacyPrice: 1800 },
    { id: "business-premium", price: 4999, legacyPrice: 4000 },
  ],
  ooo: [
    { id: "free", price: 0 },
    { id: "corp", price: 4999, legacyPrice: 2500 },
    { id: "corp-pro", price: 14999, legacyPrice: 6000 },
    { id: "corp-premium", price: 49999, legacyPrice: 15000 },
  ],
};

/* ---------- цены подписок покупателя (§4.6 — без изменений) ---------- */
const BUYER_PLAN_PRICES = { free: 0, start: 500, designer: 1000, premium: 1500 };

/* ---------- дедушкина оговорка и ревизия цен (§4.3) ----------
   PRICE_REVISION_EFFECTIVE_AT переопределяется сервером через env
   (QF_PRICE_REVISION_AT); клиент использует значение по умолчанию. */
const GRANDFATHER_MONTHS = { ip: 3, ooo: 6 };
const PRICE_REVISION_NOTICE_DAYS = 30;
const PRICE_REVISION_EFFECTIVE_AT_DEFAULT = "2026-10-18T00:00:00.000Z";

/* ---------- годовая цена: −20%, округление до 10 ₽ (§3.2/§4.2) ---------- */
const YEAR_DISCOUNT = 0.2;
function yearPriceOf(monthly) {
  return monthly === 0 ? 0 : Math.round((monthly * 12 * (1 - YEAR_DISCOUNT)) / 10) * 10;
}

/* ---------- разовые пакеты сверх лимита (§4.5) ---------- */
const OVERLIMIT_PACKS = {
  "plus-products-50": { kind: "product_slots", slots: 50, price: 300, title: "+50 слотов товаров на месяц" },
  "plus-ai-gens-50": { kind: "ai_gen_packs", slots: 50, price: 500, title: "+50 AI-генераций на месяц" },
};
function packForAction(action) {
  if (action === "product_create") return "plus-products-50";
  if (action === "ai_card_gen" || action === "ai_gen" || action === "interior_project") return "plus-ai-gens-50";
  return null;
}

/* ---------- функции-резолверы (идентичны на клиенте и сервере) ---------- */

/** Комиссия по тарифу: точное попадание, иначе — уровень в матрице;
 *  null — когда данных о тарифе нет вообще (§1.1: 15% резерв — решение стороны). */
function commissionRateOf(legalType, planId) {
  const row = COMMISSION_MATRIX[legalType];
  if (!row || !planId) return null;
  if (row[planId] != null) return row[planId];
  const keys = Object.keys(row);
  const lvl = PLAN_LEVEL[planId] != null ? PLAN_LEVEL[planId] : 0;
  return row[keys[Math.min(lvl, keys.length - 1)]] ?? null;
}

/** Лимиты продавца из РЕЗОЛВЕННОЙ таблицы ("∞" уже заменён на Infinity):
 *  точное попадание, иначе фолбек по уровню в линейке.
 *  Разрешает сторонам добавлять собственные поля (UI-флаги клиента,
 *  паки сервера) — функция читает только maxProducts/aiCardGens и
 *  возвращает строку целиком. */
function sellerLimitsOf(resolvedSellerLimits, legalType, planId) {
  const table = resolvedSellerLimits[legalType] || resolvedSellerLimits.self_employed;
  if (table[planId]) return table[planId];
  const lvl = PLAN_LEVEL[planId] != null ? PLAN_LEVEL[planId] : 0;
  const keys = Object.keys(table);
  return table[keys[Math.min(lvl, keys.length - 1)]] || table.free;
}

/** Строка цены тарифа продавца по id. */
function sellerPlanPriceRow(legalType, planId) {
  const list = SELLER_PLAN_PRICES[legalType] || [];
  return list.find((p) => p.id === planId) || null;
}

module.exports = {
  INF,
  resolveLimits,
  COMMISSION_MATRIX,
  PLAN_LEVEL,
  SELLER_LIMITS_RAW,
  BUYER_PLANS_RAW,
  REGISTRATION_FEES,
  SELLER_PLAN_PRICES,
  BUYER_PLAN_PRICES,
  GRANDFATHER_MONTHS,
  PRICE_REVISION_NOTICE_DAYS,
  PRICE_REVISION_EFFECTIVE_AT_DEFAULT,
  YEAR_DISCOUNT,
  yearPriceOf,
  OVERLIMIT_PACKS,
  packForAction,
  commissionRateOf,
  sellerLimitsOf,
  sellerPlanPriceRow,
};
