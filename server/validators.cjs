/* ============================================================
   ВАЛИДАЦИЯ ВХОДНЫХ ДАННЫХ (БЛОК 2, Пункт 2.1 — Zod)
   ------------------------------------------------------------
   Централизованное хранилище всех схем валидации сервера.
   Паттерн применения в каждом обработчике, принимающем данные
   клиента (самая первая строка функции, до бизнес-логики):

     const v = validate(vld.TARIFF_SET, req.body);
     if (!v.ok) return res.status(400).json({ error: "validation", errors: v.errors });
     // далее работаем с проверенными данными v.data

   · safeParse возвращает { success, data | error };
   · при success=false отвечаем 400 + массив ошибок;
   · unknown-поля вырезаются (strip), лишние данные не попадают в логику.
   ============================================================ */
const { z } = require("zod");

/* ---------- справочники допустимых значений (совпадают с тарифным ядром) ---------- */
const LEGAL_TYPES = ["self_employed", "ip", "ooo"];
const BUYER_PLANS = ["free", "start", "designer", "premium"];
const SELLER_PLANS = [
  "free", "master", "profi", "top",
  "business", "business-pro", "business-premium",
  "corp", "corp-pro", "corp-premium",
];
const ALL_PLANS = [...new Set([...BUYER_PLANS, ...SELLER_PLANS])];
/* ID пакетов сверх лимита из server/tariffs.cjs (OVERLIMIT_PACKS):
   plus-products-50 (+50 слотов товаров), plus-ai-gens-50 (+50 AI-генераций).
   Клиентские псевдонимы products_50 / gens_50 принимаются и нормализуются. */
const PACK_IDS = ["plus-products-50", "plus-ai-gens-50"];
const ACTIONS = [
  "product_create", "ai_card_gen", "ai_gen", "interior_project",
  "agent_task", "market_order", "price_watch",
];
const COHORTS = ["repeat", "one_time", "vip", "dormant", "all"];
const REPORT_DIMS = ["date", "product", "revenue", "category", "buyer", "region", "channel"];

/* ---------- переиспользуемые примитивы ---------- */
const str = (min, max) => z.string().trim().min(min).max(max);
const idStr = str(1, 64);
const methodEnum = z.enum(["card", "sbp", "yoo_money", "wallet", "cash"]).catch("card");
const optionalText = (max) => z.string().trim().max(max).optional();

/* ---------- схемы по эндпоинтам ---------- */

/* POST /api/auth/register */
const REGISTER = z.object({
  email: z.string().trim().toLowerCase().regex(/^\S+@\S+\.\S+$/, "bad_email"),
  password: z.string().min(8, "password слишком короткий (мин. 8)").max(200),
  name: z.string().trim().min(2).max(100),
  role: z.enum(["buyer", "seller", "designer"]).catch("buyer"),
  legalType: z.enum(LEGAL_TYPES).or(z.literal("")).catch(""),
});

/* POST /api/auth/login, /api/auth/resend */
const LOGIN = z.object({
  email: z.string().trim().min(3).max(254),
  password: z.string().min(1, "password обязателен").max(200),
});
const RESEND = z.object({ email: z.string().trim().min(3).max(254) });

/* PATCH /api/profile */
const PROFILE_PATCH = z
  .object({ name: optionalText(100), phone: optionalText(30) })
  .refine((d) => d.name !== undefined || d.phone !== undefined, { message: "нет полей для обновления" });

/* POST /api/tariff/set — tariffId/planId из допустимого списка тарифов */
const TARIFF_SET = z
  .object({
    kind: z.enum(["seller", "buyer"]),
    planId: z.union([z.enum(ALL_PLANS), z.string().trim().min(1).max(64)]).optional(),
    tariffId: z.union([z.enum(ALL_PLANS), z.string().trim().min(1).max(64)]).optional(),
    legalType: z.enum(LEGAL_TYPES).optional(),
  })
  .transform((d) => ({ ...d, planId: d.planId || d.tariffId })) /* клиент может прислать тариф в tariffId */
  .refine((d) => !!d.planId, { path: ["planId"], message: "нужен planId или tariffId из списка тарифов" })
  .refine((d) => d.kind !== "seller" || !!d.legalType, { path: ["legalType"], message: "для seller обязателен legalType" });

/* POST /api/payments/registration-fee */
const REGISTRATION_FEE = z.object({
  legalType: z.enum(LEGAL_TYPES),
  method: methodEnum,
  planId: z.enum(ALL_PLANS).catch("free"),
});

/* POST /api/subscriptions/seller/create */
const SUB_CREATE = z.object({
  planId: z.enum(SELLER_PLANS),
  legalType: z.enum(LEGAL_TYPES).optional(),
  period: z.enum(["month", "year"]).catch("month"),
  billingCycle: z.enum(["month", "year"]).optional(),
  paymentMethodToken: optionalText(512),
});

/* POST /api/packs/create — packId только из списка пакетов */
const PACK_CREATE = z.object({
  packId: z.enum(PACK_IDS),
  quantity: z.coerce.number().int().min(1).max(10).catch(1),
  method: methodEnum,
});

/* POST /api/limits/consume */
const LIMIT_CONSUME = z.object({
  action: z.enum(ACTIONS),
  meta: z.record(z.string(), z.any()).catch({}),
});

/* POST /api/limits/buy-pack — packId ∈ {products_50|gens_50} (и канонические id),
   quantity — целое 1..10 */
const BUY_PACK = z
  .object({
    packType: z.enum(["products", "generations"]).optional(),
    packId: z.enum(["products_50", "gens_50", ...PACK_IDS]).optional(),
    quantity: z.coerce.number().int("quantity — целое число").min(1, "quantity от 1 до 10").max(10, "quantity от 1 до 10"),
    method: methodEnum,
  })
  .transform((d, ctx) => {
    let packType = d.packType;
    if (!packType && d.packId) {
      packType = /products/.test(d.packId) ? "products" : "generations";
    }
    if (!packType) {
      ctx.addIssue({ code: "custom", path: ["packId"], message: "нужен packId (products_50 | gens_50) или packType" });
      return z.NEVER;
    }
    return { packType, quantity: d.quantity, method: d.method };
  });

/* POST /api/seller/ab-tests */
const AB_CREATE = z.object({
  productId: idStr,
  variantA: str(1, 5000),
  variantB: str(1, 5000),
});

/* POST /api/seller/ab-tests/:id/event (пиксель витрины) */
const AB_EVENT = z.object({
  variant: z.enum(["a", "b"]).catch("a"),
  kind: z.enum(["view", "conversion"]).catch("view"),
});

/* POST /api/seller/ab-tests/start — запуск теста по существующей карточке */
const AB_START = z.object({ testId: idStr.optional(), productId: idStr.optional() })
  .refine((d) => d.testId || d.productId, { message: "нужен testId или productId" });

/* POST /api/seller/ab-tests/finalize — досрочное завершение с фиксацией победителя */
const AB_FINALIZE = z.object({
  testId: idStr,
  winner: z.enum(["a", "b", "none"]).catch("none"),
});

/* POST /api/seller/import */
const IMPORT = z.object({
  csv: z.string().min(1, "файл пуст").max(2 * 1024 * 1024, "файл слишком большой (макс. 2 МБ)"),
});

/* GET /api/seller/weekly-report?week=ISO */
const WEEKLY_REPORT_Q = z.object({ week: z.string().trim().regex(/^\d{4}-W\d{2}$/).optional() });

/* POST /api/curator/escalate */
const ESCALATE = z.object({ question: str(5, 2000) });

/* GET /api/b2b/closed-orders?status=... */
const B2B_CLOSED_Q = z.object({ status: z.enum(["open", "won", "lost", "all"]).catch("all") });

/* POST /api/b2b/tenders */
const TENDER = z.object({
  title: str(3, 200).catch("Корпоративный тендер"),
  budget: z.coerce.number().positive("budget должен быть положительным числом").max(1_000_000_000),
});

/* GET /api/seller/segments */
const SEGMENTS_Q = z.object({ days: z.coerce.number().int().min(7).max(365).catch(90) });

/* POST /api/seller/newsletter */
const NEWSLETTER = z.object({
  cohort: z.enum(COHORTS).catch("repeat"),
  subject: str(1, 200).catch("Новая коллекция"),
});

/* POST /api/seller/site — мини-сайт мастерской / белый ярлык */
const SITE = z.object({
  subdomain: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,30}$/).catch(""),
  domain: z
    .string()
    .trim()
    .regex(/^(?!-)[a-z0-9-]{1,63}(\.[a-z0-9-]{1,63})+$/i, "домен указан неверно")
    .max(253)
    .or(z.literal(""))
    .catch(""),
});

/* GET /api/premium/sales */
const PREMIUM_SALES_Q = z.object({ week: z.string().trim().regex(/^\d{4}-W\d{2}$/).optional() });

/* POST /api/manager/request */
const MANAGER_REQUEST = z.object({ message: str(3, 4000) });

/* POST /api/seller/reports/custom */
const CUSTOM_REPORT = z.object({
  dimensions: z.array(z.enum(REPORT_DIMS)).min(1).max(REPORT_DIMS.length).catch(["date", "product", "revenue"]),
  format: z.enum(["xlsx", "csv"]).catch("xlsx"),
});

/* POST /api/seller/top-positions */
const TOP_POSITIONS = z.object({
  category: str(1, 60),
  categoryId: idStr.optional(),
}).refine((d) => d.category || d.categoryId, { path: ["category"], message: "нужна категория" });

/* POST /api/seller/promo/book — бронирование выхода в рассылке платформы */
const PROMO_BOOK = z.object({
  placement: z.enum(["email-digest", "push-weekly"]).catch("email-digest"),
  creative: str(1, 500),
});

/* POST /api/seller/registration-status */
const REG_STATUS = z.object({ legalType: z.enum(LEGAL_TYPES) });

/* POST /api/orders (заявка покупателя) */
const ORDER_CREATE = z.object({
  title: str(3, 300),
  description: str(1, 5000),
  budget: z.coerce.number().min(0).max(1_000_000_000).catch(0),
  category: optionalText(60),
});

/* POST /api/orders/:id/responses (отклик мастера) */
const RESPONSE_CREATE = z.object({
  price: z.coerce.number().positive("цена должна быть > 0").max(1_000_000_000),
  message: str(1, 3000),
  days: z.coerce.number().int().min(1).max(365).catch(14),
});

/* PUT /api/orders/:id/responses/:rid */
const RESPONSE_UPDATE = z.object({
  price: z.coerce.number().positive().max(1_000_000_000).optional(),
  message: optionalText(3000),
  days: z.coerce.number().int().min(1).max(365).optional(),
  status: z.enum(["pending", "accepted", "withdrawn"]).optional(),
}).refine((d) => Object.values(d).some((x) => x !== undefined), { message: "нет полей для обновления" });

/* PUT /api/orders/:id */
const ORDER_UPDATE = z.object({
  title: optionalText(300),
  description: optionalText(5000),
  budget: z.coerce.number().min(0).max(1_000_000_000).optional(),
  status: z.enum(["open", "in_progress", "done", "cancelled", "archived"]).optional(),
  category: optionalText(60),
}).refine((d) => Object.values(d).some((x) => x !== undefined), { message: "нет полей для обновления" });

/* POST /api/orders/:id/messages */
const ORDER_MESSAGE = z.object({ text: str(1, 4000) });

/* POST /api/orders/:id/milestones */
const MILESTONE_CREATE = z.object({
  title: str(1, 200),
  amount: z.coerce.number().min(0).max(1_000_000_000).catch(0),
});

/* POST /api/orders/:id/deal/prepay — оплата сделки (эскроу) */
const DEAL_PREPAY = z.object({
  amount: z.coerce.number().positive("amount должен быть положительным числом").max(1_000_000_000),
  tariffId: z.enum(ALL_PLANS).or(z.string().trim().min(1).max(64)).optional(),
  paymentMethodToken: z.string().trim().min(1, "paymentMethodToken не может быть пустым").max(1024),
});

/* POST /api/agent/chat, /api/agent/negotiate */
const AGENT_CHAT = z.object({
  message: str(1, 8000),
  history: z.array(z.object({ role: z.string().max(20), content: z.string().max(8000) })).max(50).catch([]),
});

/* ---------- служебные функции ---------- */
/** Универсальный вызов safeParse: возвращает { ok, data } или { ok:false, errors }. */
function validate(schema, payload) {
  const r = schema.safeParse(payload ?? {});
  if (r.success) return { ok: true, data: r.data };
  const errors = (r.error?.issues || r.error?.errors || []).map((e) => ({
    path: (e.path || []).join("."),
    message: e.message,
    code: e.code || "invalid",
  }));
  return { ok: false, errors };
}

/** Express-middleware: 400 + массив ошибок валидации до выполнения бизнес-логики.
 *  Проверенные данные кладёт в req.validatedData (req.body остаётся совместимым). */
function vMiddleware(schema) {
  return function zodValidate(req, res, next) {
    const v = validate(schema, req.body);
    if (!v.ok) return res.status(400).json({ error: "validation", message: "Данные не прошли проверку", errors: v.errors });
    req.validatedData = v.data;
    next();
  };
}

module.exports = {
  validate,
  vMiddleware,
  LEGAL_TYPES, BUYER_PLANS, SELLER_PLANS, ALL_PLANS, PACK_IDS, ACTIONS, COHORTS,
  REGISTER, LOGIN, RESEND, PROFILE_PATCH,
  TARIFF_SET, REGISTRATION_FEE, SUB_CREATE, PACK_CREATE,
  LIMIT_CONSUME, BUY_PACK,
  AB_CREATE, AB_EVENT, AB_START, AB_FINALIZE,
  IMPORT, WEEKLY_REPORT_Q, ESCALATE, B2B_CLOSED_Q, TENDER,
  SEGMENTS_Q, NEWSLETTER, SITE, PREMIUM_SALES_Q, MANAGER_REQUEST,
  CUSTOM_REPORT, TOP_POSITIONS, PROMO_BOOK, REG_STATUS,
  ORDER_CREATE, RESPONSE_CREATE, RESPONSE_UPDATE, ORDER_UPDATE, ORDER_MESSAGE, MILESTONE_CREATE,
  DEAL_PREPAY, AGENT_CHAT,
};
