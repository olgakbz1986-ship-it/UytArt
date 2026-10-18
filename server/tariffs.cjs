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
    return {
      accountId: String(uid),
      legalType: lt,
      sellerPlanId: sp,
      buyerPlanId: bp,
      commissionRate: rate,
      limits: { seller: sellerLimitsOf(lt, sp), buyer: buyerLimitsOf(bp) },
      updatedAt: row.updated_at,
    };
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

  /* Успешная оплата: проводка дохода + чек + пересчёт комиссии профиля (§1.2). */
  async function finalizePaid(p) {
    p.status = "succeeded";
    p.paid_at = new Date().toISOString();
    savePayment(p);
    financeLedgerPush(p.user_id, {
      type: "registration_fee_income",
      amount: p.amount,
      payment_id: p.id,
      comment: "Разовый регистрационный взнос · " + p.legal_type + " · способ: " + p.method,
    });
    const receipt = financeIssueReceipt(p.user_id, p);
    /* Пересчёт комиссии профиля из матрицы комиссий по ОПЛАЧЕННОМУ тарифу */
    const rate = commissionRateOf(p.legal_type, p.plan_id || "free");
    if (rate != null) await upsertTariffRow(p.user_id, { legal_type: p.legal_type, commission_rate: rate });
    return receipt;
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

  /* §1.5 Серверная проверка лимита: читает тариф ИЗ БАЗЫ (не из клиента). */
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
        return { allowed: count < limit, limit, used: count, reason: count >= limit ? "Лимит товаров тарифа исчерпан (" + limit + "). Улучшите тариф." : null };
      }
      case "ai_card_gen": {
        const limit = t.limits.seller.aiCardGens;
        if (!Number.isFinite(limit)) return { allowed: true, limit, used };
        return { allowed: used < limit, limit, used, reason: used >= limit ? "Лимит AI-генераций на месяц исчерпан (" + limit + ")." : null };
      }
      case "ai_gen": {
        const limit = t.limits.buyer.aiGens;
        if (!Number.isFinite(limit)) return { allowed: true, limit, used };
        return { allowed: used < limit, limit, used, reason: used >= limit ? "Лимит AI-генераций покупателя исчерпан (" + limit + ")." : null };
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
      if (!r.allowed) return res.status(402).json({ ok: false, error: "limit_reached", reason: r.reason, limit: r.limit, used: r.used });
      await serverConsumeLimit(req.userId, action);
      res.json({ ok: true, consumed: true, limit: r.limit, used: r.used + 1 });
    } catch (e) { console.error("[LIMITS CONSUME]", e); res.status(500).json({ error: "server" }); }
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

  /* Экспорт для других модулей сервера (digital.cjs и пр.) */
  ctx.serverCheckLimit = serverCheckLimit;
  ctx.serverConsumeLimit = serverConsumeLimit;
  ctx.commissionRateOf = commissionRateOf;
  ctx.REGISTRATION_FEES = REGISTRATION_FEES;
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
};
