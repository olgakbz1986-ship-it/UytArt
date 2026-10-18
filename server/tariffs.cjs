/* ============================================================
   ТАРИФНОЕ ЯДРО — серверный источник истины о тарифах (ЭТАП 1)
   ------------------------------------------------------------
   §1.3: карта тарифов аккаунта хранится в базе (в dev — сегмент
         `tariffs` файла dev-db.json, в prod — таблица account_tariffs).
   §1.4: реальная оплата разовых взносов 5 000 / 10 000 / 15 000 ₽:
         платёж создаётся у провайдера (ЮKassa), успех/отказ обрабатываются
         webhooks-эндпоинтами, при успехе выполняется проводка дохода в
         финансовый журнал и выпуск фискального чека; регистрация НЕ
         переходит в активный статус без успешной оплаты.
   §1.2: комиссия профиля продавца пересчитывается из матрицы комиссий
         при каждой смене тарифа и при оплате взноса.
   §1.5: лимиты дублированы на сервере: serverCheckLimit читает тариф
         ИЗ БАЗЫ, а не из клиентского состояния.
   ============================================================ */
const crypto = require("crypto");

/* ---------- матрицы (полные копии клиентских, сервер — истина) ---------- */
const COMMISSION_MATRIX = {
  self_employed: { free: 10, master: 9, profi: 8, top: 7 },
  ip: { free: 12, business: 11, "business-pro": 10, "business-premium": 9 },
  ooo: { free: 15, corp: 14, "corp-pro": 13, "corp-premium": 11 },
};

const SELLER_LIMITS = {
  self_employed: {
    free: { maxProducts: 50, aiCardGens: 0 },
    master: { maxProducts: 500, aiCardGens: 100 },
    "master-pro": { maxProducts: 2000, aiCardGens: Infinity },
    "master-premium": { maxProducts: Infinity, aiCardGens: Infinity },
  },
  ip: {
    free: { maxProducts: 50, aiCardGens: 0 },
    business: { maxProducts: 500, aiCardGens: 100 },
    "business-pro": { maxProducts: 2000, aiCardGens: Infinity },
    "business-premium": { maxProducts: Infinity, aiCardGens: Infinity },
  },
  ooo: {
    free: { maxProducts: 50, aiCardGens: 0 },
    corp: { maxProducts: 500, aiCardGens: 100 },
    "corp-pro": { maxProducts: 2000, aiCardGens: Infinity },
    "corp-premium": { maxProducts: Infinity, aiCardGens: Infinity },
  },
};

const BUYER_PLANS = {
  free: { aiGens: 2, marketOrders: 1, priceWatches: 0 },
  start: { aiGens: 15, marketOrders: 3, priceWatches: 10 },
  designer: { aiGens: 50, marketOrders: 10, priceWatches: 999 },
  premium: { aiGens: Infinity, marketOrders: Infinity, priceWatches: Infinity },
};

/* Разовые регистрационные взносы по типу юрлица: 5 / 10 / 15 тыс. ₽ */
const REGISTRATION_FEES = { self_employed: 5000, ip: 10000, ooo: 15000 };

/* ============================================================
   ЭТАП 4 (§4.1–§4.6): РЕВИЗИЯ ЦЕН И ПОЛИТИКА МОНЕТИЗАЦИИ
   ------------------------------------------------------------
   · Новые месячные цены действуют для НОВЫХ подписок;
     действующие подписчики платят legacyPrice до истечения
     дедушкиной оговорки (ИП — 3 мес., ООО — 6 мес., §4.3).
   · Самозанятые (0/300/600/1200) и покупатели (0/500/1000/1500)
     не изменяются (§4.6).
   ============================================================ */
const YEAR_DISCOUNT = 0.2; /* единая формула годовой цены: −20% (§3.2/§4.2) */
const yearPriceOf = (monthly) => (monthly === 0 ? 0 : Math.round((monthly * 12 * (1 - YEAR_DISCOUNT)) / 10) * 10);

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
const BUYER_PLAN_PRICES = { free: 0, start: 500, designer: 1000, premium: 1500 }; /* §4.6 — без изменений */
const GRANDFATHER_MONTHS = { ip: 3, ooo: 6 }; /* §4.3 */
const PRICE_REVISION_NOTICE_DAYS = 30;        /* §4.3: уведомление за 30 дней */
const PRICE_REVISION_EFFECTIVE_AT = process.env.QF_PRICE_REVISION_AT || "2026-10-18T00:00:00.000Z"; /* дата ревизии */

/* Пакеты сверх лимитов (§4.5): +50 слотов товаров за 300 ₽/мес,
   +50 AI-генераций за 500 ₽/мес. */
const OVERLIMIT_PACKS = {
  "plus-products-50": { kind: "product_slots", slots: 50, price: 300, title: "+50 слотов товаров на месяц" },
  "plus-ai-gens-50": { kind: "ai_gen_packs", slots: 50, price: 500, title: "+50 AI-генераций на месяц" },
};
function packForAction(action) {
  if (action === "product_create") return "plus-products-50";
  if (action === "ai_card_gen" || action === "ai_gen" || action === "interior_project") return "plus-ai-gens-50";
  return null;
}

function planRow(legalType, planId) {
  const list = SELLER_PLAN_PRICES[legalType] || [];
  return list.find((p) => p.id === planId) || null;
}

/* Цена тарифа с учётом дедушкиной оговорки (§4.3):
   sub = { activeSinceIso, grandfatherFromIso } или null (новая подписка). */
function sellerPlanPrice(legalType, planId, sub, at) {
  const row = planRow(legalType, planId);
  if (!row) return { amount: 0, listPrice: 0, grandfathered: false, grandfatherUntil: null, noticeAt: null };
  const months = GRANDFATHER_MONTHS[legalType];
  if (!row.legacyPrice || !months || !sub || !sub.activeSinceIso) {
    return { amount: row.price, listPrice: row.price, grandfathered: false, grandfatherUntil: null, noticeAt: null };
  }
  const from = new Date(Math.max(new Date(sub.activeSinceIso).getTime(), new Date(sub.grandfatherFromIso || PRICE_REVISION_EFFECTIVE_AT).getTime()));
  const until = new Date(from.getTime());
  until.setUTCMonth(until.getUTCMonth() + months);
  const now = at || new Date();
  if (now >= until) {
    return { amount: row.price, listPrice: row.price, grandfathered: false, grandfatherUntil: until.toISOString(), noticeAt: null };
  }
  const notice = new Date(until.getTime() - PRICE_REVISION_NOTICE_DAYS * 24 * 60 * 60 * 1000);
  return { amount: row.legacyPrice, listPrice: row.price, grandfathered: true, grandfatherUntil: until.toISOString(), noticeAt: notice.toISOString() };
}

/* Пропорциональный перерасчёт (§4.4). */
function periodRemainingFraction(startIso, endIso, at) {
  const a = new Date(startIso).getTime(), b = new Date(endIso).getTime();
  if (!(b > a)) return 0;
  const t = Math.min(Math.max((at || new Date()).getTime(), a), b);
  return Math.max(0, Math.min(1, (b - t) / (b - a)));
}
function upgradeCredit(oldPrice, startIso, endIso, at) {
  return Math.round(oldPrice * periodRemainingFraction(startIso, endIso, at));
}

const PLAN_LEVEL = {
  free: 0,
  master: 1, business: 1, corp: 1,
  "master-pro": 2, "business-pro": 2, "corp-pro": 2, profi: 2,
  "master-premium": 3, "business-premium": 3, "corp-premium": 3, top: 3,
};

/* Комиссия по тарифу: точное попадание, иначе — уровень в матрице;
   15% допускается ТОЛЬКО когда данных о тарифе нет вообще (§1.1). */
function commissionRateOf(legalType, planId) {
  const row = COMMISSION_MATRIX[legalType];
  if (!row || !planId) return null;
  if (row[planId] != null) return row[planId];
  const keys = Object.keys(row);
  const lvl = PLAN_LEVEL[planId] != null ? PLAN_LEVEL[planId] : 0;
  return row[keys[Math.min(lvl, keys.length - 1)]] ?? null;
}

function sellerLimitsOf(legalType, planId) {
  const table = SELLER_LIMITS[legalType] || SELLER_LIMITS.self_employed;
  if (table[planId]) return table[planId];
  const lvl = PLAN_LEVEL[planId] != null ? PLAN_LEVEL[planId] : 0;
  const keys = Object.keys(table);
  return table[keys[Math.min(lvl, keys.length - 1)]] || table.free;
}

function buyerLimitsOf(planId) {
  return BUYER_PLANS[planId] || BUYER_PLANS.free;
}

/** §4.5: пакет-предложение в момент отказа по лимиту. */
function packOfferFor(action) {
  const id = packForAction(action);
  if (!id) return null;
  const p = OVERLIMIT_PACKS[id];
  return { packId: id, title: p.title, price: p.price, slots: p.slots };
}

function mount(app, ctx) {
  const { guard, db } = ctx;
  const FILE = require("path").resolve(__dirname, "dev-db.json");
  const fs = require("fs");
  const isPg = () => db.mode.startsWith("postgres");

  const readAll = () => (fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : {});
  const writeAll = (d) => fs.writeFileSync(FILE, JSON.stringify(d, null, 2));

  /* ---------- чтение/запись карты тарифов аккаунта ---------- */
  async function getTariffRow(uid) {
    if (isPg()) {
      const r = await db.pool.query("select * from account_tariffs where user_id=$1", [uid]);
      return r.rows[0] || null;
    }
    const d = readAll();
    return (d.tariffs || {})[String(uid)] || null;
  }
  async function upsertTariffRow(uid, patch) {
    if (isPg()) {
      const r = await db.pool.query(
        `insert into account_tariffs (user_id, legal_type, seller_plan_id, buyer_plan_id, commission_rate, updated_at)
         values ($1,$2,$3,$4,$5, now())
         on conflict (user_id) do update set
           legal_type = coalesce(excluded.legal_type, account_tariffs.legal_type),
           seller_plan_id = coalesce(excluded.seller_plan_id, account_tariffs.seller_plan_id),
           buyer_plan_id = coalesce(excluded.buyer_plan_id, account_tariffs.buyer_plan_id),
           commission_rate = coalesce(excluded.commission_rate, account_tariffs.commission_rate),
           updated_at = now()
         returning *`,
        [uid, patch.legal_type ?? null, patch.seller_plan_id ?? null, patch.buyer_plan_id ?? null, patch.commission_rate ?? null]
      );
      return r.rows[0];
    }
    const d = readAll();
    if (!d.tariffs) d.tariffs = {};
    const key = String(uid);
    const cur = d.tariffs[key] || { user_id: key, legal_type: null, seller_plan_id: "free", buyer_plan_id: "free", commission_rate: null };
    const next = {
      ...cur,
      legal_type: patch.legal_type !== undefined ? patch.legal_type : cur.legal_type,
      seller_plan_id: patch.seller_plan_id !== undefined ? patch.seller_plan_id : cur.seller_plan_id,
      buyer_plan_id: patch.buyer_plan_id !== undefined ? patch.buyer_plan_id : cur.buyer_plan_id,
      commission_rate: patch.commission_rate !== undefined ? patch.commission_rate : cur.commission_rate,
      updated_at: new Date().toISOString(),
    };
    d.tariffs[key] = next;
    writeAll(d);
    return next;
  }

  async function tariffView(uid) {
    let row = await getTariffRow(uid);
    if (!row) {
      /* записи ещё нет — создаём из профиля пользователя (legal_type users) */
      const legal = isPg() ? (await db.byId(uid))?.legal_type : (readAll().users.find((u) => u.id === uid) || {}).legal_type;
      row = await upsertTariffRow(uid, {
        legal_type: ["self_employed", "ip", "ooo"].includes(legal) ? legal : "self_employed",
        seller_plan_id: "free",
        buyer_plan_id: "free",
        commission_rate: commissionRateOf(["self_employed", "ip", "ooo"].includes(legal) ? legal : "self_employed", "free"),
      });
    }
    const lt = row.legal_type || "self_employed";
    const sp = row.seller_plan_id || "free";
    const bp = row.buyer_plan_id || "free";
    const rate = commissionRateOf(lt, sp); /* null только если данных о тарифе нет */
    /* §1.2: комиссия профиля продавца пересчитывается ИЗ МАТРИЦЫ при каждом
       чтении/смене тарифа — базовая ставка типа юрлица не хранится «навсегда». */
    try { syncProfileCommission(uid, lt, sp, rate); } catch (e) { console.error("[COMMISSION SYNC]", e); }
    /* ЭТАП 4 (§4.3): цена текущего тарифа с дедушкиной оговоркой —
       считается на сервере по данным подписки в базе, а не на клиенте. */
    const subs = subscriptionOf(uid);
    const priceInfo = sellerPlanPrice(lt, sp, subs.paid ? { activeSinceIso: subs.paid.periodStart, grandfatherFromIso: subs.grandfatherFrom } : null);
    return {
      accountId: String(uid),
      legalType: lt,
      sellerPlanId: sp,
      buyerPlanId: bp,
      commissionRate: rate,
      limits: { seller: sellerLimitsOfWithPacks(lt, sp, uid), buyer: buyerLimitsOf(bp) },
      pricing: {
        monthlyAmount: priceInfo.amount,
        listPrice: priceInfo.listPrice,
        yearPrice: yearPriceOf(priceInfo.amount),
        grandfathered: priceInfo.grandfathered,
        grandfatherUntil: priceInfo.grandfatherUntil,
        revisionNoticeAt: priceInfo.noticeAt,
      },
      subscription: subs, /* §4.4: оплаченный период / дата окончания доступа */
      updatedAt: row.updated_at,
    };
  }

  /* ---------- ЭТАП 4: подписки и пакеты сверх лимитов ---------- */
  function subscriptionsSeg() {
    const d = readAll();
    if (!d.subscriptions) d.subscriptions = {}; /* uid -> { paid, packs, grandfatherFrom } */
    return d;
  }
  function subscriptionOf(uid) {
    const d = subscriptionsSeg();
    return d.subscriptions[String(uid)] || { paid: null, packs: {}, grandfatherFrom: PRICE_REVISION_EFFECTIVE_AT };
  }
  function saveSubscription(uid, sub) {
    const d = subscriptionsSeg();
    d.subscriptions[String(uid)] = sub;
    writeAll(d);
  }
  /** Активные бусты пакетов этого месяца: { product_slots: N, ai_gen_packs: N } */
  function packBoosts(uid) {
    const sub = subscriptionOf(uid);
    const monthKey = new Date().toISOString().slice(0, 7);
    const out = { product_slots: 0, ai_gen_packs: 0 };
    for (const [packId, info] of Object.entries(sub.packs || {})) {
      if (!OVERLIMIT_PACKS[packId]) continue;
      const until = (info && info.until) || "";
      if (until.slice(0, 7) >= monthKey && new Date(until).getTime() > Date.now()) {
        out[OVERLIMIT_PACKS[packId].kind] += OVERLIMIT_PACKS[packId].slots;
      }
    }
    return out;
  }
  /* Лимит продавца = сетка тарифа + активные купленные пакты (§4.5:
     пакеты реально открывают лимит, причём на СЕРВЕРЕ). */
  function sellerLimitsOfWithPacks(legalType, planId, uid) {
    const base = sellerLimitsOf(legalType, planId);
    const b = packBoosts(uid);
    const add = (v, n) => (!Number.isFinite(v) ? v : v + n);
    return { maxProducts: add(base.maxProducts, b.product_slots), aiCardGens: add(base.aiCardGens, b.ai_gen_packs) };
  }

  /* Пересчёт и запись комиссии в профиль продавца (реестр профилей на сервере). */
  function syncProfileCommission(uid, legalType, sellerPlanId, rate) {
    if (isPg()) return; /* prod: колонка commission_rate в account_tariffs — истина */
    if (rate == null) return; /* данных о тарифе нет — комиссию НЕ трогаем */
    const d = readAll();
    if (!d.profilesByAccount) return;
    const prof = d.profilesByAccount[String(uid)];
    if (prof && prof.commissionRate !== rate) {
      prof.commissionRate = rate;
      writeAll(d);
    }
  }

  /* ---------- финансовый журнал и чеки (сегмент finance) ---------- */
  function financeSeg() {
    const d = readAll();
    if (!d.finance) d.finance = { ledger: [], receipts: [] };
    return d;
  }
  function financeLedgerPush(uid, entry) {
    const d = financeSeg();
    d.finance.ledger.push({ id: "fl-" + crypto.randomUUID(), account_id: String(uid), ts: new Date().toISOString(), ...entry });
    writeAll(d);
  }
  function financeIssueReceipt(uid, payment) {
    const d = financeSeg();
    const receipt = {
      id: "rcp-" + crypto.randomUUID(),
      fn_number: "99" + String(Math.floor(1e7 + Math.random() * 9e7)), /* Мок ФН: в prod — номер фискального документа ФН */
      fd_number: Math.floor(1e5 + Math.random() * 9e5),
      type: "income",
      tax_system: payment.legal_type === "self_employed" ? "НПД" : "УСН",
      fiscal_provider: process.env.FN_PROVIDER || "mock-fn",
      amount: payment.amount,
      payment_method: payment.method,
      purpose: payment.purpose,
      account_id: String(uid),
      payment_id: payment.id,
      issued_at: new Date().toISOString(),
    };
    d.finance.receipts.push(receipt);
    writeAll(d);
    return receipt;
  }
  function findPayment(id) {
    const d = readAll();
    return ((d.payments || {})[String(id)]) || null;
  }
  function savePayment(p) {
    const d = readAll();
    if (!d.payments) d.payments = {};
    d.payments[String(p.id)] = p;
    writeAll(d);
  }

  /* ---------- платёжный провайдер (ЮKassa; мок при отсутствии ключей) ---------- */
  const YKASSA_SHOP_ID = process.env.YKASSA_SHOP_ID || "";
  const YKASSA_SECRET = process.env.YKASSA_SECRET || "";
  async function providerCreatePayment(payment) {
    const idemp = "qf-fee-" + payment.id;
    if (YKASSA_SHOP_ID && YKASSA_SECRET) {
      const resp = await fetch("https://api.yookassa.ru/v3/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotence-Key": idemp,
          Authorization: "Basic " + Buffer.from(YKASSA_SHOP_ID + ":" + YKASSA_SECRET).toString("base64"),
        },
        body: JSON.stringify({
          amount: { value: (payment.amount / 100).toFixed(2), currency: "RUB" },
          capture: true,
          description: payment.purpose,
          metadata: { payment_id: payment.id, user_id: payment.user_id },
          confirmation: { return_url: (process.env.API_URL || "http://localhost:8787") + "/plans?paid=" + payment.id },
        }),
      });
      if (!resp.ok) throw new Error("yookassa_http_" + resp.status);
      const j = await resp.json();
      return { provider: "yookassa", provider_payment_id: j.id, confirmation_url: j.confirmation && j.confirmation.confirmation_url };
    }
    /* DEV/демо-режим: эмуляция инвойса платёжного провайдера.
       Подтверждение — POST /api/payments/:id/confirm (или webhook-эмуляция). */
    return { provider: "mock", provider_payment_id: "mock_" + payment.id.slice(0, 8), confirmation_url: "/api/payments/" + payment.id + "/confirm" };
  }

  /* Успешная оплата: проводка дохода + чек + пересчёт комиссии профиля (§1.2).
     ЭТАП 4: подписки на тарифы и пакеты сверх лимитов проводят доход,
     выпускают чек и АКТИВИРУЮТ подписку/пакет в базе. */
  async function finalizePaid(p) {
    p.status = "succeeded";
    p.paid_at = new Date().toISOString();
    savePayment(p);
    financeLedgerPush(p.user_id, {
      type: p.kind === "seller_subscription" ? "subscription_income" : p.kind === "overlimit_pack" ? "pack_income" : "registration_fee_income",
      amount: p.amount,
      payment_id: p.id,
      comment: (p.kind === "seller_subscription" ? "Подписка на тариф" : p.kind === "overlimit_pack" ? "Пакет сверх лимита" : "Разовый регистрационный взнос")
        + " · " + p.legal_type + " · способ: " + p.method + (p.credit_applied ? " · зачтено: " + p.credit_applied + " ₽" : ""),
    });
    const receipt = financeIssueReceipt(p.user_id, p);
    if (p.kind === "seller_subscription") {
      await activateSubscription(p);
    } else if (p.kind === "overlimit_pack") {
      activatePack(p);
    }
    /* Пересчёт комиссии профиля из матрицы комиссий по ОПЛАЧЕННОМУ тарифу */
    const rate = commissionRateOf(p.legal_type, p.plan_id || "free");
    if (rate != null) await upsertTariffRow(p.user_id, { legal_type: p.legal_type, commission_rate: rate });
    return receipt;
  }

  /* §4.1/§4.3/§4.4: активация оплаченной подписки продавца.
     Апгрейд — новый период начинается сразу (остаток зачтён в сумме платежа);
     Даунгрейд — доступ к прежнему тарифу сохраняется до конца уже
     оплаченного периода, смена плана откладывается (pendingPlan). */
  async function activateSubscription(p) {
    const sub = subscriptionOf(p.user_id);
    const now = new Date();
    const months = p.period === "year" ? 12 : 1;
    const prev = sub.paid;
    if (prev && prev.planId !== "free" && (PLAN_LEVEL[p.plan_id] ?? 0) < (PLAN_LEVEL[prev.planId] ?? 0) && new Date(prev.periodEnd) > now) {
      /* даунгрейд: фиксируем дату окончания оплаченного доступа (§4.4) */
      sub.pendingDowngrade = { planId: p.plan_id, accessUntil: prev.periodEnd, paidAt: p.paid_at, paymentId: p.id };
    } else {
      const periodStart = now.toISOString();
      sub.paid = {
        planId: p.plan_id,
        period: p.period,
        amount: p.amount,
        listPrice: p.list_price,
        grandfathered: !!p.grandfathered,
        creditApplied: p.credit_applied || 0,
        periodStart,
        periodEnd: addMonthsIso(periodStart, months),
        paymentId: p.id,
        paidAt: p.paid_at,
      };
      delete sub.pendingDowngrade;
    }
    saveSubscription(p.user_id, sub);
    await upsertTariffRow(p.user_id, { seller_plan_id: p.plan_id });
  }
  /* §4.5: активация пакета сверх лимита на текущий месяц */
  function activatePack(p) {
    const sub = subscriptionOf(p.user_id);
    if (!sub.packs) sub.packs = {};
    const until = addMonthsIso(new Date().toISOString(), 1);
    const cur = sub.packs[p.pack_id];
    const from = cur && cur.until && new Date(cur.until) > new Date() ? cur.until : new Date().toISOString();
    sub.packs[p.pack_id] = { until: addMonthsIso(from, 1), lastPaymentId: p.id, activatedAt: p.paid_at };
    void until;
    saveSubscription(p.user_id, sub);
  }

  /* ============================== API ============================== */

  /* §1.3 Чтение тарифа аккаунта (клиент получает при входе вместе с профилем) */
  app.get("/api/tariff", guard, async (req, res) => {
    try { res.json({ ok: true, tariff: await tariffView(req.userId) }); }
    catch (e) { console.error("[TARIFF GET]", e); res.status(500).json({ error: "server" }); }
  });

  /* §1.3 Смена тарифа. Сервер сам считает комиссию из матрицы (§1.1/§1.2):
     клиент не может прислать свою ставку. */
  app.post("/api/tariff/set", guard, async (req, res) => {
    try {
      const { kind, planId, legalType } = req.body || {};
      if (kind === "seller") {
        if (!["self_employed", "ip", "ooo"].includes(legalType)) return res.status(400).json({ error: "bad_legal_type" });
        const row = COMMISSION_MATRIX[legalType];
        const known = Object.keys(row).concat(Object.keys(PLAN_LEVEL));
        if (!known.includes(planId)) return res.status(400).json({ error: "bad_plan" });
        const rate = commissionRateOf(legalType, planId);
        await upsertTariffRow(req.userId, { legal_type: legalType, seller_plan_id: planId, commission_rate: rate });
        return res.json({ ok: true, tariff: await tariffView(req.userId) });
      }
      if (kind === "buyer") {
        if (!BUYER_PLANS[planId]) return res.status(400).json({ error: "bad_plan" });
        await upsertTariffRow(req.userId, { buyer_plan_id: planId });
        return res.json({ ok: true, tariff: await tariffView(req.userId) });
      }
      res.status(400).json({ error: "bad_kind" });
    } catch (e) { console.error("[TARIFF SET]", e); res.status(500).json({ error: "server" }); }
  });

  /* §1.4 Создание платежа разового взноса (5/10/15 тыс. ₽) у провайдера */
  app.post("/api/payments/registration-fee", guard, async (req, res) => {
    try {
      const legalType = String((req.body && req.body.legalType) || "");
      const method = String((req.body && req.body.method) || "card");
      const fee = REGISTRATION_FEES[legalType];
      if (!fee) return res.status(400).json({ error: "bad_legal_type" });
      const payment = {
        id: crypto.randomUUID(),
        user_id: req.userId,
        kind: "registration_fee",
        legal_type: legalType,
        plan_id: (req.body && req.body.planId) || "free",
        amount: fee,
        currency: "RUB",
        method,
        purpose: "Регистрационный взнос · " + legalType + " · " + fee.toLocaleString("ru-RU") + " ₽",
        status: "pending",
        created_at: new Date().toISOString(),
      };
      const prov = await providerCreatePayment(payment);
      payment.provider = prov.provider;
      payment.provider_payment_id = prov.provider_payment_id;
      payment.confirmation_url = prov.confirmation_url || null;
      savePayment(payment);
      res.json({ ok: true, payment: { id: payment.id, amount: payment.amount, fee: payment.amount, status: payment.status, confirmation_url: payment.confirmation_url, provider: payment.provider } });
    } catch (e) { console.error("[FEE PAYMENT CREATE]", e); res.status(502).json({ error: "provider_unavailable" }); }
  });

  /* ============================================================
     ЭТАП 4 (§4.1–§4.5): ПОДПИСКА НА ТАРИФ ПРОДАВЦА — реальная оплата
     ------------------------------------------------------------
     Цена считается НА СЕРВЕРЕ: новые подписки — новая цена (§4.1/§4.2);
     действующие — legacyPrice до конца дедушкиного срока (§4.3).
     Апгрейд: зачитывается остаток оплаченного периода пропорционально (§4.4).
     Даунгрейд: доступ фиксируется до конца уже оплаченного периода (§4.4).
     ============================================================ */
  function addMonthsIso(iso, months) {
    const d = new Date(iso);
    d.setUTCMonth(d.getUTCMonth() + months);
    return d.toISOString();
  }

  app.post("/api/subscriptions/seller/create", guard, async (req, res) => {
    try {
      const planId = String((req.body && req.body.planId) || "");
      const period = req.body && req.body.period === "year" ? "year" : "month";
      const billingCycle = req.body && req.body.billingCycle === "yearly" ? "yearly" : period; /* совместимость */
      const isYear = billingCycle === "year";
      const t = await tariffView(req.userId);
      const lt = t.legalType;
      const row = planRow(lt, planId);
      if (!row) return res.status(400).json({ error: "bad_plan" });
      const sub = subscriptionOf(req.userId);
      if (planId === t.sellerPlanId && sub.paid && sub.paid.planId === planId && new Date(sub.paid.periodEnd) > new Date()) {
        return res.status(409).json({ error: "already_active" });
      }
      /* §4.3: «действующий подписчик» = есть успешная подписка на платный тариф */
      const isExisting = !!(sub.paid && sub.paid.planId !== "free");
      const priceInfo = sellerPlanPrice(lt, planId, isExisting ? { activeSinceIso: sub.paid.periodStart, grandfatherFromIso: sub.grandfatherFrom } : null);
      let amount = isYear ? yearPriceOf(priceInfo.amount) : priceInfo.amount;
      let credit = 0;
      const now = new Date();
      /* §4.4 апгрейд: пропорциональный зачёт неиспользованного остатка текущего периода */
      const upgrading = sub.paid && (PLAN_LEVEL[planId] ?? 0) > (PLAN_LEVEL[sub.paid.planId] ?? 0);
      if (upgrading && sub.paid.periodEnd && new Date(sub.paid.periodEnd) > now) {
        const oldPriceInfo = sellerPlanPrice(lt, sub.paid.planId, { activeSinceIso: sub.paid.periodStart, grandfatherFromIso: sub.grandfatherFrom });
        credit = upgradeCredit(oldPriceInfo.amount, sub.paid.periodStart, sub.paid.periodEnd, now);
        amount = Math.max(0, amount - credit);
      }
      const payment = {
        id: crypto.randomUUID(),
        user_id: req.userId,
        kind: "seller_subscription",
        legal_type: lt,
        plan_id: planId,
        period: isYear ? "year" : "month",
        list_price: isYear ? yearPriceOf(priceInfo.listPrice) : priceInfo.listPrice,
        grandfathered: priceInfo.grandfathered,
        credit_applied: credit,
        amount,
        currency: "RUB",
        method: String((req.body && req.body.method) || "card"),
        purpose: "Подписка · " + lt + "/" + planId + " · " + (isYear ? "год" : "месяц") + (credit ? " (зачёт остатка " + credit + " ₽)" : ""),
        status: "pending",
        created_at: now.toISOString(),
      };
      const prov = await providerCreatePayment(payment);
      payment.provider = prov.provider;
      payment.provider_payment_id = prov.provider_payment_id;
      payment.confirmation_url = prov.confirmation_url || null;
      savePayment(payment);
      res.json({
        ok: true,
        quote: {
          planId, period: payment.period, listPrice: payment.list_price, amount,
          grandfathered: priceInfo.grandfathered, grandfatherUntil: priceInfo.grandfatherUntil,
          revisionNoticeAt: priceInfo.noticeAt, creditApplied: credit,
        },
        payment: { id: payment.id, amount: payment.amount, status: payment.status, confirmation_url: payment.confirmation_url, provider: payment.provider },
      });
    } catch (e) { console.error("[SUB CREATE]", e); res.status(502).json({ error: "provider_unavailable" }); }
  });

  /* §4.5 Пакет сверх лимита: +50 слотов товаров 300 ₽/мес, +50 генераций 500 ₽/мес */
  app.post("/api/packs/create", guard, async (req, res) => {
    try {
      const packId = String((req.body && req.body.packId) || "");
      const pack = OVERLIMIT_PACKS[packId];
      if (!pack) return res.status(400).json({ error: "bad_pack" });
      const payment = {
        id: crypto.randomUUID(),
        user_id: req.userId,
        kind: "overlimit_pack",
        pack_id: packId,
        legal_type: (await tariffView(req.userId)).legalType,
        plan_id: null,
        amount: pack.price,
        currency: "RUB",
        method: String((req.body && req.body.method) || "card"),
        purpose: "Пакет сверх лимита · " + pack.title + " · " + pack.price + " ₽",
        status: "pending",
        created_at: new Date().toISOString(),
      };
      const prov = await providerCreatePayment(payment);
      payment.provider = prov.provider;
      payment.provider_payment_id = prov.provider_payment_id;
      payment.confirmation_url = prov.confirmation_url || null;
      savePayment(payment);
      res.json({ ok: true, pack: { id: packId, title: pack.title, slots: pack.slots, price: pack.price }, payment: { id: payment.id, amount: payment.amount, status: payment.status, confirmation_url: payment.confirmation_url, provider: payment.provider } });
    } catch (e) { console.error("[PACK CREATE]", e); res.status(502).json({ error: "provider_unavailable" }); }
  });

  /* §1.4 Webhook успеха провайдера (в prod подписывается секретами ЮKassa;
     в dev допускается служебное подтверждение от аутентифицированного владельца) */
  app.post("/api/payments/webhook", express_raw(), async (req, res) => {
    try {
      const evt = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const pid = (evt && evt.object && evt.object.metadata && evt.object.metadata.payment_id) || (evt && evt.payment_id);
      const status = (evt && evt.object && evt.object.status) || (evt && evt.status);
      const p = pid ? findPayment(pid) : null;
      if (!p) return res.status(404).json({ error: "payment_not_found" });
      if (p.status === "succeeded") return res.json({ ok: true, idempotent: true });
      if (status === "succeeded" || status === "captured") {
        const receipt = await finalizePaid(p);
        return res.json({ ok: true, status: "succeeded", receipt });
      }
      p.status = "failed";
      p.failed_at = new Date().toISOString();
      savePayment(p);
      res.json({ ok: true, status: "failed" });
    } catch (e) { console.error("[PAYMENT WEBHOOK]", e); res.status(500).json({ error: "server" }); }
  });

  /* §1.4 Подтверждение оплаты владельцем платежа (dev-путь имитации success).
     Реальный прод-поток — webhook выше; этот эндпоинт сверяет сумму и помечает
     платёж успешным ровно один раз (идемпотентно). */
  app.post("/api/payments/:id/confirm", guard, async (req, res) => {
    try {
      const p = findPayment(req.params.id);
      if (!p) return res.status(404).json({ error: "payment_not_found" });
      if (String(p.user_id) !== String(req.userId)) return res.status(403).json({ error: "not_owner" });
      if (p.status === "succeeded") {
        const d = readAll();
        const rcpt = ((d.finance && d.finance.receipts) || []).find((r) => r.payment_id === p.id) || null;
        return res.json({ ok: true, payment: publicPayment(p), already_paid: true, receipt: rcpt });
      }
      if (p.status !== "pending") return res.status(409).json({ error: "payment_" + p.status });
      const receipt = await finalizePaid(p);
      res.json({ ok: true, payment: publicPayment(p), receipt });
    } catch (e) { console.error("[PAYMENT CONFIRM]", e); res.status(500).json({ error: "server" }); }
  });

  /* §1.4 Отказ от оплаты */
  app.post("/api/payments/:id/fail", guard, async (req, res) => {
    try {
      const p = findPayment(req.params.id);
      if (!p) return res.status(404).json({ error: "payment_not_found" });
      if (String(p.user_id) !== String(req.userId)) return res.status(403).json({ error: "not_owner" });
      if (p.status === "succeeded") return res.status(409).json({ error: "already_paid" });
      p.status = "failed";
      p.failed_at = new Date().toISOString();
      savePayment(p);
      res.json({ ok: true, payment: publicPayment(p) });
    } catch (e) { console.error("[PAYMENT FAIL]", e); res.status(500).json({ error: "server" }); }
  });

  /* Статус платежа (клиент опрашивает перед переходом в active) */
  app.get("/api/payments/:id", guard, async (req, res) => {
    const p = findPayment(req.params.id);
    if (!p) return res.status(404).json({ error: "payment_not_found" });
    if (String(p.user_id) !== String(req.userId)) return res.status(403).json({ error: "not_owner" });
    const d = readAll();
    const rcpt = ((d.finance && d.finance.receipts) || []).find((r) => r.payment_id === p.id) || null;
    res.json({ ok: true, payment: publicPayment(p), receipt: rcpt });
  });

  /* Финансовый журнал сервера: проводки доходов (взнос виден в журнале с чеком) */
  app.get("/api/finance/ledger", guard, (req, res) => {
    const d = readAll();
    const fin = d.finance || { ledger: [], receipts: [] };
    const mine = fin.ledger.filter((e) => String(e.account_id) === String(req.userId));
    const receipts = fin.receipts.filter((r) => String(r.account_id) === String(req.userId));
    res.json({ ok: true, ledger: mine, receipts });
  });

  /* Публичная справочная информация о взносах (для шага оплаты) */
  app.get("/api/tariffs/fees", (_q, r) => r.json({ ok: true, fees: REGISTRATION_FEES, commissions: COMMISSION_MATRIX }));

  function publicPayment(p) {
    return { id: p.id, amount: p.amount, fee: p.amount, status: p.status, method: p.method, confirmation_url: p.confirmation_url || null, paid_at: p.paid_at || null, provider: p.provider };
  }

  /* §4.5 Серверная проверка лимита: читает тариф ИЗ БАЗЫ (не из клиента),
     лимит продавца включает купленные пакеты сверх лимита (§4.5). */
  async function serverCheckLimit(uid, action, meta) {
    meta = meta || {};
    const t = await tariffView(uid);
    const monthKey = new Date().toISOString().slice(0, 7);
    const d = readAll();
    const usage = (d.usage || {});
    const ukey = String(uid) + ":" + action + ":" + monthKey;
    const used = usage[ukey] || 0;
    switch (action) {
      case "product_create": {
        const limit = t.limits.seller.maxProducts;
        if (!Number.isFinite(limit)) return { allowed: true, limit, used };
        const products = (d.products || []).filter((p) => String(p.ownerId || p.owner_id) === String(uid) && !p.archived && !p.isDraft);
        const count = products.length;
        return { allowed: count < limit, limit, used: count, reason: count >= limit ? "Лимит товаров тарифа исчерпан (" + limit + "). Улучшите тариф." : null, offer: count >= limit ? packOfferFor(action) : null };
      }
      case "ai_card_gen": {
        const limit = t.limits.seller.aiCardGens;
        if (!Number.isFinite(limit)) return { allowed: true, limit, used };
        return { allowed: used < limit, limit, used, reason: used >= limit ? "Лимит AI-генераций на месяц исчерпан (" + limit + ")." : null, offer: used >= limit ? packOfferFor(action) : null };
      }
      case "ai_gen": {
        const limit = t.limits.buyer.aiGens;
        if (!Number.isFinite(limit)) return { allowed: true, limit, used };
        return { allowed: used < limit, limit, used, reason: used >= limit ? "Лимит AI-генераций покупателя исчерпан (" + limit + ")." : null, offer: used >= limit ? packOfferFor(action) : null };
      }
      case "market_order": {
        const limit = t.limits.buyer.marketOrders;
        if (!Number.isFinite(limit)) return { allowed: true, limit, used };
        const orders = (d.custom_orders || []).filter((o) => String(o.user_id) === String(uid) && ["published", "in_progress"].includes(o.status));
        return { allowed: orders.length < limit, limit, used: orders.length, reason: orders.length >= limit ? "Достигнут лимит активных заказов тарифа (" + limit + ")." : null };
      }
      case "price_watch": {
        const limit = t.limits.buyer.priceWatches;
        if (!Number.isFinite(limit)) return { allowed: true, limit, used };
        return { allowed: used < limit, limit, used, reason: used >= limit ? "Лимит отслеживаемых товаров исчерпан (" + limit + ")." : null };
      }
      default:
        return { allowed: false, reason: "unknown_action" };
    }
  }
  async function serverConsumeLimit(uid, action) {
    if (action === "product_create" || action === "market_order") return; /* считаются по объектам, не счётчиком */
    const d = readAll();
    if (!d.usage) d.usage = {};
    const monthKey = new Date().toISOString().slice(0, 7);
    const ukey = String(uid) + ":" + action + ":" + monthKey;
    d.usage[ukey] = (d.usage[ukey] || 0) + 1;
    writeAll(d);
  }

  /* Эндпоинты проверки/потребления лимита (§1.5): каждая потребляющая
     операция обязана спросить сервер, а не собственное localStorage. */
  app.get("/api/limits/check", guard, async (req, res) => {
    try {
      const action = String(req.query.action || "");
      const r = await serverCheckLimit(req.userId, action, {});
      res.json({ ok: true, ...r });
    } catch (e) { console.error("[LIMITS CHECK]", e); res.status(500).json({ error: "server" }); }
  });
  app.post("/api/limits/consume", guard, async (req, res) => {
    try {
      const action = String((req.body && req.body.action) || "");
      const r = await serverCheckLimit(req.userId, action, {});
      if (!r.allowed) return res.status(402).json({ ok: false, error: "limit_reached", reason: r.reason, limit: r.limit, used: r.used, offer: r.offer || null });
      await serverConsumeLimit(req.userId, action);
      res.json({ ok: true, consumed: true, limit: r.limit, used: r.used + 1 });
    } catch (e) { console.error("[LIMITS CONSUME]", e); res.status(500).json({ error: "server" }); }
  });

  /* ============================================================
     ЭТАП 4 (§4.1–§4.6): ПУБЛИЧНЫЙ ЦЕННИК и УВЕДОМЛЕНИЯ
     ============================================================ */

  /* Прайс-лист: новые цены (list), старые (legacy) и годовые по −20% */
  app.get("/api/tariffs/pricing", (_q, r) => {
    const out = { effectiveAt: PRICE_REVISION_EFFECTIVE_AT, yearDiscount: YEAR_DISCOUNT, seller: {}, buyer: BUYER_PLAN_PRICES, grandfatherMonths: GRANDFATHER_MONTHS, noticeDays: PRICE_REVISION_NOTICE_DAYS, overlimitPacks: OVERLIMIT_PACKS };
    for (const [lt, list] of Object.entries(SELLER_PLAN_PRICES)) {
      out.seller[lt] = list.map((p) => ({ id: p.id, price: p.price, legacyPrice: p.legacyPrice ?? null, yearPrice: yearPriceOf(p.price), yearLegacyPrice: p.legacyPrice != null ? yearPriceOf(p.legacyPrice) : null }));
    }
    r.json({ ok: true, pricing: out });
  });

  /* §4.3: уведомления аккаунта (в т.ч. «изменение цены за 30 дней») */
  app.get("/api/notifications", guard, async (req, res) => {
    try {
      const t = await tariffView(req.userId);
      const items = [];
      const pr = t.pricing;
      if (pr.grandfathered && pr.revisionNoticeAt && new Date(pr.revisionNoticeAt) <= new Date()) {
        items.push({
          id: "price-revision-" + t.accountId,
          type: "price_revision",
          title: "Изменение стоимости подписки",
          body: "С 18.10.2026 действует новая цена тарифа. Для действующих подписчиков сохранена старая цена до " +
            new Date(pr.grandfatherUntil).toLocaleDateString("ru-RU") + " (дедушкина оговорка). " +
            "Новая цена — " + pr.listPrice.toLocaleString("ru-RU") + " ₽/мес. Настоящее уведомление направлено не менее чем за 30 дней.",
          sent_at: pr.revisionNoticeAt,
          applies_at: pr.grandfatherUntil,
        });
      }
      const d = readAll();
      for (const n of ((d.notifications && d.notifications[String(req.userId)]) || [])) items.push(n);
      res.json({ ok: true, notifications: items });
    } catch (e) { console.error("[NOTIFICATIONS]", e); res.status(500).json({ error: "server" }); }
  });

  /* Синхронизация статуса регистрации: active ТОЛЬКО если за аккаунтом
     есть успешный платёж взноса его правовой формы (§1.4). */
  app.post("/api/seller/registration-status", guard, async (req, res) => {
    try {
      const legalType = String((req.body && req.body.legalType) || "");
      if (!REGISTRATION_FEES[legalType]) return res.status(400).json({ error: "bad_legal_type" });
      const d = readAll();
      const paid = Object.values(d.payments || {}).some((p) => String(p.user_id) === String(req.userId) && p.kind === "registration_fee" && p.legal_type === legalType && p.status === "succeeded");
      res.json({ ok: true, active: !!paid });
    } catch (e) { console.error("[REG STATUS]", e); res.status(500).json({ error: "server" }); }
  });

  /* Экспорт для других модулей сервера (index.cjs, digital.cjs и пр.) */
  ctx.tariffView = tariffView;
  ctx.getTariffRow = getTariffRow;
  ctx.upsertTariffRow = upsertTariffRow;
  ctx.serverCheckLimit = serverCheckLimit;
  ctx.serverConsumeLimit = serverConsumeLimit;
  ctx.commissionRateOf = commissionRateOf;
  ctx.REGISTRATION_FEES = REGISTRATION_FEES;
  /* ЭТАП 4: доступ к политике цен и подпискам для других модулей сервера */
  ctx.SELLER_PLAN_PRICES = SELLER_PLAN_PRICES;
  ctx.BUYER_PLAN_PRICES = BUYER_PLAN_PRICES;
  ctx.OVERLIMIT_PACKS = OVERLIMIT_PACKS;
  ctx.GRANDFATHER_MONTHS = GRANDFATHER_MONTHS;
  ctx.PRICE_REVISION_NOTICE_DAYS = PRICE_REVISION_NOTICE_DAYS;
  ctx.sellerPlanPrice = sellerPlanPrice;
  ctx.subscriptionOf = subscriptionOf;
}

/* webhook принимает и raw-body (подпись провайдера), и JSON */
function express_raw() {
  const express = require("express");
  return [express.text({ type: "*/*" })];
}

module.exports = {
  mount,
  COMMISSION_MATRIX,
  SELLER_LIMITS,
  BUYER_PLANS,
  REGISTRATION_FEES,
  commissionRateOf,
  sellerLimitsOf,
  buyerLimitsOf,
  /* ЭТАП 4. РЕВИЗИЯ ЦЕН И ПОЛИТИКА МОНЕТИЗАЦИИ */
  SELLER_PLAN_PRICES,
  BUYER_PLAN_PRICES,
  OVERLIMIT_PACKS,
  GRANDFATHER_MONTHS,
  PRICE_REVISION_NOTICE_DAYS,
  PRICE_REVISION_EFFECTIVE_AT,
  yearPriceOf,
  sellerPlanPrice,
  periodRemainingFraction,
  upgradeCredit,
};
