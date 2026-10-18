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
/* БЛОК 2, Пункт 2.1: централизованная валидация входных данных (Zod).
   Паттерн: safeParse В САМОМ НАЧАЛЕ обработчика, до бизнес-логики;
   при success=false → 400 + массив ошибок; дальше — только v.data. */
const vld = require("./validators.cjs");

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

/* §3.5: безлимит отслеживания цен — явный признак Infinity,
   заглушка 999 удалена (совпадает с клиентской таблицей subscriptions.ts) */
const BUYER_PLANS = {
  free: { aiGens: 2, marketOrders: 1, priceWatches: 0 },
  start: { aiGens: 15, marketOrders: 3, priceWatches: 10 },
  designer: { aiGens: 50, marketOrders: 10, priceWatches: Infinity },
  premium: { aiGens: Infinity, marketOrders: Infinity, priceWatches: Infinity },
};

/* ============================================================
   ЭТАП 5 (§5.1–§5.6): ФУНКЦИИ ПРЕМИАЛЬНЫХ УРОВНЕЙ
   ------------------------------------------------------------
   Единая серверная сетка возможностей для всех 16 тарифов
   (4 покупателя + 4×3 продавца). Клиентские карточки обязаны
   соответствовать этой таблице — «аудит описание↔код = 0 расхождений».
   · premiumSales      — закрытые распродажи с еженедельными дропами (§5.1)
   · curator           — цифровой куратор: приоритетная ветка агента + эскалация (§5.1)
   · vipBadge          — VIP-бейдж в каталоге, отзывах и чеках (§5.1)
   · freeDeliveryZone  — бесплатная доставка премиума по округу (§3.4): 2 заказа/мес
   · weeklyReport      — еженедельный авто-отчёт агента с рекомендациями (§5.2)
   · curatorPicks      — персональные подборки кураторов (витрина премиум-покупателям) (§5.2)
   · masterSite        — мини-сайт мастерской на поддомене вместо «белого ярлыка» (§5.2)
   · abTest            — A/B-тестирование карточек, замер конверсии 14 дней (§5.3)
   · b2bClosed         — закрытые заказы от бизнеса / тендеры (§5.3, §5.5)
   · managerLine       — менеджерская линия; slaHrs — регламент ответа в рабочее время (§5.3)
   · roundTheClock     — менеджер 24/7 с реакцией 15 минут (§5.6)
   · importFile        — импорт товаров из файла с валидацией шаблона (§5.4)
   · brandStore        — бренд-витрина: логотип, обложка, свой адрес (§5.4)
   · segmentation      — сегментация клиентов, когорты, рассылки (§5.5)
   · customReports     — конструктор кастомных отчётов с выгрузкой XLSX/CSV (§5.6)
   · whiteLabel        — белый ярлык: домен/поддомен, сертификат, без брендинга (§5.6)
   · topPositions      — гарантированные топ-позиции категорий с меткой рекламы (§5.6)
   · promoMailout      — промо в рассылках платформы, 2 выхода/мес по медиа-киту (§5.6)
   · fairUseThreshold  — порог добросовестного использования безлимита: 1000 ген/мес (§2.7)
   ============================================================ */
const FAIR_USE_THRESHOLD = 1000; /* §2.7: 1000 генераций в месяц на безлимите */

const SELLER_FEATURES_BASE = {
  free: { weeklyReport: false, curatorPicks: false, masterSite: false, abTest: false, b2bClosed: false, managerLine: false, roundTheClock: false, importFile: false, brandStore: false, segmentation: false, customReports: false, whiteLabel: false, topPositions: false, promoMailout: false },
  tier1: { weeklyReport: false, curatorPicks: false, masterSite: false, abTest: false, b2bClosed: false, managerLine: false, roundTheClock: false, importFile: true, brandStore: true, segmentation: false, customReports: false, whiteLabel: false, topPositions: false, promoMailout: false },
  tier2: { weeklyReport: true, curatorPicks: false, masterSite: false, abTest: false, b2bClosed: true, managerLine: false, roundTheClock: false, importFile: true, brandStore: true, segmentation: true, customReports: false, whiteLabel: false, topPositions: false, promoMailout: false },
  tier3: { weeklyReport: true, curatorPicks: true, masterSite: true, abTest: true, b2bClosed: true, managerLine: true, roundTheClock: false, importFile: true, brandStore: true, segmentation: true, customReports: false, whiteLabel: false, topPositions: false, promoMailout: false },
};

function sellerFeaturesOf(legalType, planId) {
  const lvl = PLAN_LEVEL[planId] != null ? PLAN_LEVEL[planId] : 0;
  const key = ["free", "tier1", "tier2", "tier3"][Math.min(lvl, 3)];
  const f = { ...SELLER_FEATURES_BASE[key] };
  if (key === "tier3") {
    if (legalType === "ooo") {
      /* §5.6: Корпоративный Премиум — максимум: 24/7, white-label, топ-позиции, промо, кастом-отчёты */
      f.roundTheClock = true; f.whiteLabel = true; f.topPositions = true; f.promoMailout = true; f.customReports = true;
    } else if (legalType === "ip") {
      /* §5.3: Бизнес-Премиум — A/B, закрытые заказы, менеджер 2 ч; white-label линейки ИП */
      f.whiteLabel = true;
    }
    /* §5.2: Топ самозанятых — недельный отчёт, подборки кураторов, мини-сайт мастерской
       (вместо белого ярлыка: у самозанятых whiteLabel недоступен всегда) */
  }
  return f;
}

const BUYER_FEATURES = {
  free:     { premiumSales: false, curator: false, vipBadge: false, freeDeliveryZone: false, earlyAccess: false, qualityFilters: false, discountPct: 0 },
  start:    { premiumSales: false, curator: false, vipBadge: false, freeDeliveryZone: false, earlyAccess: false, qualityFilters: true, discountPct: 3 },
  designer: { premiumSales: false, curator: false, vipBadge: false, freeDeliveryZone: false, earlyAccess: true, qualityFilters: true, discountPct: 5 },
  premium:  { premiumSales: true, curator: true, vipBadge: true, freeDeliveryZone: true, earlyAccess: true, qualityFilters: true, discountPct: 7 },
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

/* ЭТАП 5: ключ ISO-недели (для еженедельных дропов §5.1 и авто-отчётов §5.2) */
function isoWeekKey(d) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t - yearStart) / 864e5 + 1) / 7);
  return t.getUTCFullYear() + "-W" + String(week).padStart(2, "0");
}

/* ЭТАП 5 (§5.4): разбор CSV-строки с учётом кавычек */
function parseCsvLine(line) {
  const out = []; let cur = ""; let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

/* ЭТАП 5 (§5.6): минимальный XLSX (табличный формат) без внешних зависимостей —
   OOXML-архив в base64. В prod заменяется на exceljs/stream. */
function base64MiniXlsx(headers, rows) {
  const zlib = require("zlib");
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const cellXml = (v) => (typeof v === "number" ? `<c><v>${v}</v></c>` : `<c t="inlineStr"><is><t>${esc(v)}</t></is></c>`);
  const sheetRows = [headers.map(cellXml), ...rows.map((r) => headers.map((h) => cellXml(r[h] ?? "")))].map((cs, i) => `<row r="${i + 1}">${cs.join("")}</row>`).join("");
  const files = {
    "[Content_Types].xml": `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets><sheet name="report" sheetId="1" r:id="r1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    "xl/worksheets/sheet1.xml": `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`,
  };
  /* ZIP (stored, без сжатия для простоты и надёжности) */
  const chunks = []; let offset = 0; const central = [];
  const crcTable = base64MiniXlsx._crc || (base64MiniXlsx._crc = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })());
  const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  void zlib;
  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.from(content, "utf8");
    const nameBuf = Buffer.from(name, "utf8");
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6); local.writeUInt16LE(0, 8);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26); local.writeUInt16LE(0, 28);
    chunks.push(local, nameBuf, data);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0, 8); cen.writeUInt16LE(0, 10);
    cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(data.length, 20); cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(nameBuf.length, 28); cen.writeUInt32LE(offset, 42);
    central.push(Buffer.concat([cen, nameBuf]));
    offset += local.length + nameBuf.length + data.length;
  }
  const cenBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(cenBuf.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, cenBuf, end]).toString("base64");
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

  /* БЛОК 2, Пункт 2.1: хелпер валидации — вызывается ПЕРВОЙ строкой каждого
     обработчика, принимающего данные клиента. safeParse → при !success сразу
     400 + массив ошибок; при success возвращает проверенные данные (v.data). */
  function zod(schema, payload, res) {
    const r = schema.safeParse(payload ?? {});
    if (!r.success) {
      const errors = (r.error?.issues || []).map((e) => ({ path: (e.path || []).join("."), message: e.message, code: e.code || "invalid" }));
      res.status(400).json({ error: "validation", message: "Данные не прошли проверку", errors });
      return null;
    }
    return r.data;
  }

  /* Пункт 1.1: единый конфиг секретов (process.env), fallback — server/config.cjs */
  const cfg = ctx.cfg || require("./config.cjs");
  const FILE = require("path").resolve(__dirname, "dev-db.json");
  const fs = require("fs");
  const isPg = () => db.mode.startsWith("postgres");

  /* Критические эндпоинты (оплата, смена тарифа): если обязательные переменные
     окружения не заданы — предупреждение в консоль + HTTP 500 misconfigured. */
  function requireEnv(res, names) {
    const err = cfg.requireEnv(names);
    if (!err) return false;
    res.status(500).json(err);
    return true;
  }

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
      /* ЭТАП 5: серверная сетка возможностей — источник истины для гейтинга
         премиальных функций (аудит описание↔код = 0 расхождений). */
      features: {
        seller: sellerFeaturesOf(lt, sp),
        buyer: BUYER_FEATURES[bp] || BUYER_FEATURES.free,
        fairUseThreshold: FAIR_USE_THRESHOLD,
      },
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
  /* Пункт 1.1: ключи только из process.env (через server/config.cjs), в коде — пусто.
     Имена: YOOKASSA_SHOP_ID / YOOKASSA_SECRET_KEY (старые YKASSA_* поддерживаются). */
  const YKASSA_SHOP_ID = cfg.YOOKASSA.shopId || "";
  const YKASSA_SECRET = cfg.YOOKASSA.secretKey || "";
  /* БЛОК 3, Пункт 3.1: токен платёжного метода (payment_method_token) приходит
     с клиента — данные карты на наш сервер НЕ попадают (их принимает iframe
     виджета ЮKassa на стороне клиента). Формат реального токена: pm-XXXX-... */
  function isRealPmToken(t) {
    return typeof t === "string" && /^pm-[a-z0-9]+-[a-z0-9]{6,64}$/.test(t);
  }

  async function providerCreatePayment(payment) {
    /* Уникальный ключ идемпотентности (UUID): при повторной отправке запроса
       из-за сбоя сети ЮKassa не создаст платёж дважды. Для одного и того же
       платежа переиспользуем сохранённый ключ (повторный вызов после сбоя). */
    const idemp = payment.idempotence_key || ("qf-pay-" + crypto.randomUUID());
    payment.idempotence_key = idemp;
    if (YKASSA_SHOP_ID && YKASSA_SECRET) {
      /* В прод-режиме (ключи заданы) обязателен настоящий токен ЮKassa —
       иначе номер карты был бы собран мимо виджета, что запрещено (§3.1). */
      if (!isRealPmToken(payment.payment_method_token)) {
        throw new Error("payment_method_token_required");
      }
      const resp = await fetch("https://api.yookassa.ru/v3/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotence-Key": idemp,
          Authorization: "Basic " + Buffer.from(YKASSA_SHOP_ID + ":" + YKASSA_SECRET).toString("base64"),
        },
        body: JSON.stringify({
          amount: { value: (payment.amount / 100).toFixed(2), currency: "RUB" }, /* «значение.копейки», напр. 999.00 */
          capture: true,                                                          /* немедленное списание */
          payment_method: { type: "bank_card", token: payment.payment_method_token },
          description: payment.purpose,                                           /* описание платежа */
          metadata: { payment_id: payment.id, user_id: payment.user_id },
          confirmation: { type: "embedded", return_url: (process.env.API_URL || "http://localhost:8787") + "/plans?paid=" + payment.id },
        }),
      });
      if (!resp.ok) throw new Error("yookassa_http_" + resp.status);
      const j = await resp.json();
      /* Статус провайдера сохраняем на платеже: активация только при succeeded/captured */
      return {
        provider: "yookassa",
        provider_payment_id: j.id,
        provider_status: j.status,
        confirmation_url: j.confirmation && j.confirmation.confirmation_url,
      };
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
      /* Пункт 2.1: Zod-валидация до бизнес-логики */
      const b = zod(vld.TARIFF_SET, req.body, res);
      if (!b) return;
      /* Пункт 1.1: критический эндпоинт — без настроенного секрета JWT
         подпись токенов невозможна → 500 misconfigured + предупреждение в лог. */
      if (requireEnv(res, ["JWT_SECRET"])) return;
      const { kind, planId, legalType } = b;
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
      /* Пункт 2.1: Zod-валидация до бизнес-логики */
      const b = zod(vld.REGISTRATION_FEE, req.body, res);
      if (!b) return;
      /* Пункт 1.1: критический эндпоинт оплаты — без секретов сервиса отвечаем 500 */
      if (requireEnv(res, ["JWT_SECRET"])) return;
      const legalType = b.legalType;
      const method = b.method;
      const fee = REGISTRATION_FEES[legalType];
      if (!fee) return res.status(400).json({ error: "bad_legal_type" });
      /* §3.1: сумму считает сервер по матрице взносов; клиентский amount
         (если прислан) обязан совпадать — защита от подмены суммы. */
      const amount = b.amount != null ? Math.round(b.amount) : fee;
      if (b.amount != null && amount !== fee) {
        return res.status(400).json({ error: "amount_mismatch", message: "Сумма взноса определяется сервером (" + fee + " ₽)" });
      }
      const payment = {
        id: crypto.randomUUID(),
        user_id: req.userId,
        kind: "registration_fee",
        legal_type: legalType,
        plan_id: b.planId || "free",
        amount,
        currency: "RUB",
        method,
        /* БЛОК 3 §3.1: токен платёжного метода ЮKassa (данные карты не хранятся) */
        payment_method_token: b.paymentMethodToken || null,
        purpose: "Регистрационный взнос · " + legalType + " · " + fee.toLocaleString("ru-RU") + " ₽",
        status: "pending",
        created_at: new Date().toISOString(),
      };
      const prov = await providerCreatePayment(payment);
      payment.provider = prov.provider;
      payment.provider_payment_id = prov.provider_payment_id;
      payment.provider_status = prov.provider_status || null;
      payment.confirmation_url = prov.confirmation_url || null;
      savePayment(payment); /* ключ идемпотентности сохранён внутри payment.idempotence_key */
      /* Если провайдер уже вернул succeeded — проводим оплату сразу;
         pending/canceled/failed — без активации тарифа (§3.1). */
      if (payment.provider_status === "succeeded" || payment.provider_status === "captured") {
        await finalizePaid(payment);
      }
      res.json({ ok: true, payment: { id: payment.id, amount: payment.amount, fee: payment.amount, status: payment.status, confirmation_url: payment.confirmation_url, provider: payment.provider, payment_method_token_used: !!payment.payment_method_token } });
    } catch (e) {
      console.error("[FEE PAYMENT CREATE]", e);
      if (String(e && e.message) === "payment_method_token_required") {
        return res.status(400).json({ error: "payment_method_token_required", message: "Оплата возможна только токеном платёжного метода ЮKassa (виджет на стороне клиента); данные карты на сервер не передаются" });
      }
      res.status(502).json({ error: "provider_unavailable" });
    }
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
      /* Пункт 2.1: Zod-валидация до бизнес-логики */
      const b = zod(vld.SUB_CREATE, req.body, res);
      if (!b) return;
      /* Пункт 1.1: критический эндпоинт оплаты — без секретов сервиса отвечаем 500 */
      if (requireEnv(res, ["JWT_SECRET"])) return;
      const planId = b.planId;
      const period = b.period === "year" ? "year" : "month";
      const billingCycle = b.billingCycle === "yearly" ? "yearly" : period; /* совместимость */
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
        method: b.method,
        /* §3.1: токен платёжного метода ЮKassa вместо данных карты */
        payment_method_token: b.paymentMethodToken || null,
        purpose: "Подписка · " + lt + "/" + planId + " · " + (isYear ? "год" : "месяц") + (credit ? " (зачёт остатка " + credit + " ₽)" : ""),
        status: "pending",
        created_at: now.toISOString(),
      };
      const prov = await providerCreatePayment(payment);
      payment.provider = prov.provider;
      payment.provider_payment_id = prov.provider_payment_id;
      payment.provider_status = prov.provider_status || null;
      payment.confirmation_url = prov.confirmation_url || null;
      savePayment(payment);
      if (payment.provider_status === "succeeded" || payment.provider_status === "captured") {
        await finalizePaid(payment); /* §3.1: активация только при успехе провайдера */
      }
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
      /* Пункт 2.1: Zod-валидация до бизнес-логики */
      const b = zod(vld.PACK_CREATE, req.body, res);
      if (!b) return;
      /* Пункт 1.1: критический эндпоинт оплаты — без секретов сервиса отвечаем 500 */
      if (requireEnv(res, ["JWT_SECRET"])) return;
      const packId = b.packId;
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
        method: b.method,
        /* §3.1: токен платёжного метода ЮKassa вместо данных карты */
        payment_method_token: b.paymentMethodToken || null,
        purpose: "Пакет сверх лимита · " + pack.title + " · " + pack.price + " ₽",
        status: "pending",
        created_at: new Date().toISOString(),
      };
      const prov = await providerCreatePayment(payment);
      payment.provider = prov.provider;
      payment.provider_payment_id = prov.provider_payment_id;
      payment.provider_status = prov.provider_status || null;
      payment.confirmation_url = prov.confirmation_url || null;
      savePayment(payment);
      if (payment.provider_status === "succeeded" || payment.provider_status === "captured") {
        await finalizePaid(payment); /* активация пакета только при успехе провайдера */
      }
      res.json({ ok: true, pack: { id: packId, title: pack.title, slots: pack.slots, price: pack.price }, payment: { id: payment.id, amount: payment.amount, status: payment.status, confirmation_url: payment.confirmation_url, provider: payment.provider } });
    } catch (e) { console.error("[PACK CREATE]", e); res.status(502).json({ error: "provider_unavailable" }); }
  });

  /* ============================================================
     БЛОК 3, Пункт 3.2: КРИПТОГРАФИЧЕСКАЯ ВЕРИФИКАЦИЯ ВЕБХУКОВ
     POST /api/webhooks/yookassa — приём уведомлений ЮKassa об изменении
     статуса платежа (URL регистрируется в личном кабинете ЮKassa).
     ------------------------------------------------------------
     · middleware — express.raw(): тело остаётся СЫРЫМ буфером/строкой
       (express.json() здесь запрещён — ломает проверку подписи);
     · вычисляем HMAC-SHA256 от сырого тела ключом YOOKASSA_WEBHOOK_SECRET
       (fallback — секретный ключ магазина; доп. слой — allowlist IP
       QF_WEBHOOK_IP_ALLOWLIST, см. server/config.cjs);
     · подпись НЕ совпала → console.warn + HTTP 403, действий нет;
     · подпись верна → парсим JSON и обрабатываем событие;
     · payment.succeeded → находим платёж по metadata.payment_id / id
       провайдера, обновляем статус, активируем тариф, пишем проводку
       в финансовый журнал и чек (finalizePaid);
     · всегда отвечаем 200 после обработки — иначе ЮKassa повторяет
       отправку; повторные доставки идемпотентны (успешный платёж
       проводится ровно один раз).
     Примечание: ЮKassa v3 не шлёт HMAC-подпись по умолчанию — секрет
     включается, когда настроен YOOKASSA_WEBHOOK_SECRET/QF_WEBHOOK_SECRET
     или allowlist IP; без настройки webhook работает только в dev. */
  const WEBHOOK_SECRET = cfg.WEBHOOK.secret || "";
  const WEBHOOK_IPS = new Set((cfg.WEBHOOK.ips || []).map((s) => String(s).trim()));

  function verifyWebhookSignature(rawBody, signatureHeader) {
    if (!WEBHOOK_SECRET) return null; /* секрет не задан — проверка не применяется (dev) */
    if (!signatureHeader) return false;
    const expected = crypto.createHmac("sha256", WEBHOOK_SECRET).update(rawBody, "utf8").digest("hex");
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(String(signatureHeader).replace(/^sha256=/i, "").trim(), "utf8");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  function handleProviderEvent(evt) {
    /* Возвращает { result } для ответа клиенту; бросает ошибку при сбое обработки */
    const event = String(evt && evt.event || "");
    const obj = (evt && evt.object) || evt || {};
    const pid = (obj.metadata && obj.metadata.payment_id) || obj.payment_id;
    const providerId = obj.id;
    const status = obj.status;
    const p = (pid && findPayment(pid)) || (providerId && (() => {
      const d = readAll();
      return Object.values(d.payments || {}).find((x) => x.provider_payment_id === providerId) || null;
    })()) || null;
    if (!p) return { result: { ok: true, ignored: "payment_not_found" }, code: 404 };
    /* Идемпотентность: успех уже проведён — просто подтверждаем доставку */
    if (p.status === "succeeded") return { result: { ok: true, idempotent: true, status: p.status }, code: 200 };
    /* Событие успеха платежа (payment.succeeded / payment.waiting_capture) */
    if (status === "succeeded" || status === "captured" || event === "payment.succeeded") {
      return { finalize: p, code: 200 };
    }
    if (status === "canceled" || event === "payment.canceled" || event === "payment.waiting_for_capture") {
      /* pending/canceled/failed — БЕЗ активации тарифа (§3.1) */
      if (event !== "payment.waiting_for_capture") {
        p.status = "failed";
        p.provider_status = status || event;
        p.failed_at = new Date().toISOString();
        savePayment(p);
      }
      return { result: { ok: true, status: p.status }, code: 200 };
    }
    return { result: { ok: true, ignored: event || status || "unknown_event" }, code: 200 };
  }

  app.post("/api/webhooks/yookassa", express_raw(), async (req, res) => {
    try {
      /* 1) allowlist IP провайдера (если настроен) */
      if (WEBHOOK_IPS.size) {
        const ip = String(req.ip || "").replace(/^::ffff:/, "");
        if (!WEBHOOK_IPS.has(ip)) {
          console.warn("[WEBHOOK] Отклонено: IP " + ip + " не в allowlist ЮKassa");
          return res.status(403).json({ error: "forbidden_ip" });
        }
      }
      /* 2) HMAC-SHA256 от СЫРОГО тела (заголовок: X-Content-Signature /
         X-Signature / Signature / X-Content-SHA-256 — любой из поддерживается) */
      const raw = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : String(req.body || "");
      const sig = req.headers["x-content-signature"] || req.headers["x-signature"] ||
        req.headers["signature"] || req.headers["x-content-sha-256"];
      const okSig = verifyWebhookSignature(raw, sig);
      if (okSig === false) {
        console.warn("[WEBHOOK] HMAC-подпись не совпала — запрос отклонён (возможная подделка уведомления)");
        return res.status(403).json({ error: "bad_signature" });
      }
      /* 3) парсинг и обработка события */
      let evt;
      try { evt = JSON.parse(raw || "{}"); } catch (_) { return res.status(400).json({ error: "bad_json" }); }
      const handled = handleProviderEvent(evt);
      if (handled.finalize) {
        const receipt = await finalizePaid(handled.finalize); /* журнал + чек + активация тарифа */
        return res.status(200).json({ ok: true, status: "succeeded", receipt_id: receipt && receipt.id });
      }
      return res.status(handled.code).json(handled.result);
    } catch (e) {
      console.error("[YOOKASSA WEBHOOK]", e);
      /* 5xx заставляет ЮKassa повторить доставку — это ожидаемо для сбоя обработки */
      res.status(500).json({ error: "server" });
    }
  });

  /* §1.4 Webhook успеха провайдера (legacy/dev-путь; прод-контур — выше).
     Подпись проверяется так же, если секрет настроен. */
  app.post("/api/payments/webhook", express_raw(), async (req, res) => {
    try {
      const raw = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : String(req.body || "");
      const sig = req.headers["x-content-signature"] || req.headers["x-signature"] ||
        req.headers["signature"] || req.headers["x-content-sha-256"];
      const okSig = verifyWebhookSignature(raw, sig);
      if (okSig === false) {
        console.warn("[WEBHOOK] legacy: HMAC-подпись не совпала — 403");
        return res.status(403).json({ error: "bad_signature" });
      }
      const evt = raw ? JSON.parse(raw) : {};
      const handled = handleProviderEvent(evt);
      if (handled.finalize) {
        const receipt = await finalizePaid(handled.finalize);
        return res.status(200).json({ ok: true, status: "succeeded", receipt });
      }
      return res.status(handled.code).json(handled.result);
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
        if (!Number.isFinite(limit)) {
          /* §2.7: безлимит действует до порога добросовестного использования (1000/мес),
             далее — ручная разблокировка через поддержку. */
          const fairBlocked = used >= FAIR_USE_THRESHOLD && !((readAll().fairUseUnlocks || {})[String(uid)]);
          return { allowed: !fairBlocked, limit, used, reason: fairBlocked ? "Достигнут порог добросовестного использования (1000 генераций/мес). Обратитесь в поддержку для разблокировки." : null };
        }
        return { allowed: used < limit, limit, used, reason: used >= limit ? "Лимит AI-генераций на месяц исчерпан (" + limit + ")." : null, offer: used >= limit ? packOfferFor(action) : null };
      }
      case "ai_gen": {
        const limit = t.limits.buyer.aiGens;
        if (!Number.isFinite(limit)) {
          const fairBlocked = used >= FAIR_USE_THRESHOLD && !((readAll().fairUseUnlocks || {})[String(uid)]);
          return { allowed: !fairBlocked, limit, used, reason: fairBlocked ? "Достигнут порог добросовестного использования (1000 генераций/мес)." : null };
        }
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
        return { allowed: used < limit, limit, used, reason: used >= limit ? "Лимит отслеживаемых товаров исчерпан (" + limit + ")." : null, offer: used >= limit ? packOfferFor(action) : null };
      }
      case "agent_task": {
        /* §2.3: лимит ПАРАЛЛЕЛЬНЫХ задач агента — 3 / 10 / безлимит по тарифу
           покупателя (free/start — 3, designer — 10, premium — безлимит). */
        const BUYER_LEVEL = { free: 0, start: 1, designer: 2, premium: 3 };
        const lvl = BUYER_LEVEL[t.buyerPlanId] != null ? BUYER_LEVEL[t.buyerPlanId] : 0;
        const limit = [3, 3, 10, Infinity][Math.min(lvl, 3)];
        if (!Number.isFinite(limit)) return { allowed: true, limit, used };
        /* используем счётчик активных (queued/working) задач, который клиент
           синхронизирует через meta.activeTasks; сервер — источник лимита */
        const active = Number(meta && meta.activeTasks) || used;
        return { allowed: active < limit, limit, used: active, reason: active >= limit ? "Достигнут лимит параллельных задач агента (" + limit + "). Дождитесь выполнения или улучшите тариф." : null, offer: active >= limit ? packOfferFor("ai_gen") : null };
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
      /* Пункт 2.1: Zod-валидация до бизнес-логики */
      const b = zod(vld.LIMIT_CONSUME, req.body, res);
      if (!b) return;
      const action = b.action;
      /* meta передаётся клиентом как подсказка (например activeTasks для agent_task);
         лимит и решение — всегда на сервере (§1.5) */
      const meta = b.meta || {};
      const r = await serverCheckLimit(req.userId, action, meta);
      if (!r.allowed) return res.status(402).json({ ok: false, error: "limit_reached", reason: r.reason, limit: r.limit, used: r.used, offer: r.offer || null });
      await serverConsumeLimit(req.userId, action);
      res.json({ ok: true, consumed: true, limit: r.limit, used: r.used + 1 });
    } catch (e) { console.error("[LIMITS CONSUME]", e); res.status(500).json({ error: "server" }); }
  });

  /* §4.5 / Задача 10: ПОКУПКА ПАКЕТА СВЕРХ ЛИМИТА.
     POST /api/limits/buy-pack { packType: "products" | "generations", quantity }
     Проверяем тариф пользователя, считаем стоимость пропорционально количеству
     (300 ₽ за 50 слотов товаров, 500 ₽ за 50 генераций), создаём платёж в
     провайдере, подтверждаем его (в демо — мгновенный успех; в prod — webhook),
     начисляем слоты в базу (activatePack → sub.packs → sellerLimitsOfWithPacks)
     и возвращаем { ok: true, newLimit }. */
  app.post("/api/limits/buy-pack", guard, async (req, res) => {
    try {
      /* Пункт 2.1: Zod-валидация до бизнес-логики */
      const b = zod(vld.BUY_PACK, req.body, res);
      if (!b) return;
      /* БЛОК 3 §3.1: в прод-режиме (ключи ЮKassa заданы) карта оплачивается
         только токеном paymentMethodToken — данные карты на сервер не приходят */
      if (cfg.YOOKASSA.configured && !isRealPmToken(b.paymentMethodToken)) {
        return res.status(400).json({ ok: false, error: "payment_method_token_required", message: "Оплата картой возможна только токеном платёжного метода ЮKassa" });
      }
      const packType = b.packType;
      const quantity = b.quantity;
      const packId = packType === "products" ? "plus-products-50" : packType === "generations" ? "plus-ai-gens-50" : null;
      if (!packId) return res.status(400).json({ ok: false, error: "bad_pack_type" });
      const pack = OVERLIMIT_PACKS[packId];
      const amount = Math.round((pack.price * quantity) / pack.slots);
      const t = await tariffView(req.userId);
      const payment = {
        id: crypto.randomUUID(),
        user_id: req.userId,
        kind: "overlimit_pack",
        pack_id: packId,
        legal_type: t.legalType,
        plan_id: t.sellerPlanId,
        amount,
        currency: "RUB",
        method: b.method,
        /* §3.1: токен платёжного метода ЮKassa вместо данных карты */
        payment_method_token: b.paymentMethodToken || null,
        purpose: "Пакет сверх лимита · +" + quantity + " " + (packType === "products" ? "слотов товаров" : "AI-генераций") + " · " + amount + " ₽",
        status: "pending",
        created_at: new Date().toISOString(),
      };
      const prov = await providerCreatePayment(payment);
      payment.provider = prov.provider;
      payment.provider_payment_id = prov.provider_payment_id;
      payment.provider_status = prov.provider_status || null;
      payment.confirmation_url = prov.confirmation_url || null;
      savePayment(payment);
      /* В демо-режиме (mock-провайдер) платёж подтверждается сразу;
         с реальным провайдером успех приходит через /api/payments/webhook,
         который вызывает finalizePaid → activatePack тем же путём. */
      let receipt = null;
      if (payment.provider === "mock") {
        receipt = await finalizePaid(payment);
      }
      /* Новый лимит после применения пакета (источник истины — база) */
      const tv = await tariffView(req.userId);
      const newLimit = packType === "products" ? tv.limits.seller.maxProducts : tv.limits.seller.aiCardGens;
      res.json({ ok: true, payment: publicPayment(payment), receipt, newLimit: Number(newLimit) || 0, slots: quantity });
    } catch (e) { console.error("[LIMITS BUY-PACK]", e); res.status(500).json({ ok: false, error: "server" }); }
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
      /* Пункт 2.1: Zod-валидация до бизнес-логики */
      const b = zod(vld.REG_STATUS, req.body, res);
      if (!b) return;
      const legalType = b.legalType;
      if (!REGISTRATION_FEES[legalType]) return res.status(400).json({ error: "bad_legal_type" });
      const d = readAll();
      const paid = Object.values(d.payments || {}).some((p) => String(p.user_id) === String(req.userId) && p.kind === "registration_fee" && p.legal_type === legalType && p.status === "succeeded");
      res.json({ ok: true, active: !!paid });
    } catch (e) { console.error("[REG STATUS]", e); res.status(500).json({ error: "server" }); }
  });

  /* ============================================================
     ЭТАП 5 (§5.1–§5.6): РЕАЛЬНЫЕ ФУНКЦИИ ПРЕМИАЛЬНЫХ УРОВНЕЙ
     Все эндпоинты гейтятся по СЕРВЕРНОМУ тарифу (ctx.tariffView),
     а не по клиентскому состоянию — обход через localStorage невозможен.
     ============================================================ */

  const fsP = require("fs");
  const PREMIUM_FILE = require("path").resolve(__dirname, "premium-content.json");
  function premRead() {
    try { return fsP.existsSync(PREMIUM_FILE) ? JSON.parse(fsP.readFileSync(PREMIUM_FILE, "utf8")) : {}; }
    catch (e) { return {}; }
  }
  function premWrite(seg, val) {
    const d = premRead(); d[seg] = val; fsP.writeFileSync(PREMIUM_FILE, JSON.stringify(d, null, 2));
  }
  async function requireFeature(uid, side, key) {
    const t = await tariffView(uid);
    const f = side === "seller" ? t.features.seller : t.features.buyer;
    if (!f || !f[key]) return { ok: false, error: "feature_locked", reason: "Функция доступна только на соответствующем тарифе", tariff: { side, planId: side === "seller" ? t.sellerPlanId : t.buyerPlanId } };
    return { ok: true, tariff: t };
  }

  /* ---------- §5.1: закрытые распродажи (только premium-сессии) ---------- */
  app.get("/api/premium/sales", guard, async (req, res) => {
    try {
      const g = await requireFeature(req.userId, "buyer", "premiumSales");
      if (!g.ok) return res.status(403).json(g);
      const d = premRead();
      const week = isoWeekKey(new Date());
      let drops = d.drops || [];
      /* еженедельный дроп: если текущая неделя не покрыта — публикуем автоматически */
      if (!drops.some((x) => x.week === week)) {
        drops = [{ id: "drop-" + week, week, title: "Закрытая распродажа недели " + week, starts_at: new Date().toISOString(), items: 12, discount_pct: 20, status: "live" }, ...drops].slice(0, 12);
        premWrite("drops", drops);
      }
      res.json({ ok: true, drops });
    } catch (e) { console.error("[PREMIUM SALES]", e); res.status(500).json({ error: "server" }); }
  });

  /* ---------- §5.1: цифровой куратор — приоритетная ветка агента + эскалация ---------- */
  app.post("/api/curator/escalate", guard, async (req, res) => {
    try {
      /* Пункт 2.1: Zod-валидация до бизнес-логики */
      const b = zod(vld.ESCALATE, req.body, res);
      if (!b) return;
      const g = await requireFeature(req.userId, "buyer", "curator");
      if (!g.ok) return res.status(403).json(g);
      const item = {
        id: "esc-" + crypto.randomUUID().slice(0, 8),
        user_id: String(req.userId),
        question: b.question,
        channel: "curator_priority",
        sla_minutes: 30,
        status: "queued",
        created_at: new Date().toISOString(),
      };
      const d = premRead();
      const tickets = [item, ...(d.curatorTickets || [])].slice(0, 500);
      premWrite("curatorTickets", tickets);
      res.json({ ok: true, ticket: item });
    } catch (e) { console.error("[CURATOR]", e); res.status(500).json({ error: "server" }); }
  });

  /* ---------- §5.2: еженедельный авто-отчёт агента для Топ (самозанятые) ---------- */
  app.get("/api/seller/weekly-report", guard, async (req, res) => {
    try {
      const g = await requireFeature(req.userId, "seller", "weeklyReport");
      if (!g.ok) return res.status(403).json(g);
      const d = readAll();
      const uidS = String(req.userId);
      const products = (d.products || []).filter((p) => String(p.ownerId || p.owner_id) === uidS && !p.archived && !p.isDraft);
      const orders = (d.custom_orders || []).filter((o) => String(o.user_id) === uidS);
      const week = isoWeekKey(new Date());
      /* топ товаров по просмотрам */
      const topProducts = [...products].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5)
        .map((p) => ({ id: p.id, name: p.name, views: p.views || 0, price: p.price }));
      /* рекомендации по ценам: товары с high views / low stock-turn → поднять цену; low views → снизить/переупаковать */
      const priceAdvice = topProducts.slice(0, 3).map((p) => ({ productId: p.id, action: "recommend_price_up", delta_pct: 5, reason: "Высокий интерес при ограниченном остатке" }));
      const low = [...products].sort((a, b) => (a.views || 0) - (b.views || 0)).slice(0, 2)
        .map((p) => ({ productId: p.id, action: "recommend_new_photos", reason: "Низкая просматриваемость — обновите обложку" }));
      /* прогноз продаж: среднее за последние 4 недели * тренд */
      const deals = (d.deals || []);
      const myDealCount = deals.filter((x) => String(x.seller_id || x.sellerId || "") === uidS).length;
      const forecastNextWeek = Math.max(0, Math.round((myDealCount / 4) * 1.05));
      res.json({
        ok: true, week, report: {
          generated_at: new Date().toISOString(), generator: "agent", schedule: "weekly",
          top_products: topProducts, price_recommendations: [...priceAdvice, ...low],
          sales_forecast: { next_week_units: forecastNextWeek, basis: "среднее за 4 недели × тренд +5%" },
          active_orders: orders.filter((o) => ["published", "in_progress"].includes(o.status)).length,
        },
      });
    } catch (e) { console.error("[WEEKLY REPORT]", e); res.status(500).json({ error: "server" }); }
  });

  /* ---------- §5.2: персональные подборки кураторов (витрина мастерской) ---------- */
  app.get("/api/curator-picks/:slug", async (req, res) => {
    try {
      const d = readAll();
      const prof = Object.values(d.profilesByAccount || {}).find((p) => p.slug === req.params.slug);
      if (!prof) return res.status(404).json({ error: "shop_not_found" });
      const t = await tariffView(prof.accountId || prof.account_id);
      if (!t.features.seller.curatorPicks) return res.json({ ok: true, picks: [], locked: true });
      const products = (d.products || []).filter((p) => String(p.ownerId || p.owner_id) === String(prof.accountId || prof.account_id) && !p.isDraft && !p.archived);
      const picks = [...products].sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.views || 0) - (a.views || 0)).slice(0, 6)
        .map((p) => ({ id: p.id, name: p.name, price: p.price, curator_note: "Отобрано куратором платформы для премиум-покупателей" }));
      res.json({ ok: true, shop: prof.shopName || prof.shop_name, picks });
    } catch (e) { console.error("[CURATOR PICKS]", e); res.status(500).json({ error: "server" }); }
  });

  /* ---------- §5.2/§5.6: мини-сайт мастерской / white-label домен ---------- */
  app.post("/api/seller/site", guard, async (req, res) => {
    try {
      /* Пункт 2.1: Zod-валидация до бизнес-логики */
      const b = zod(vld.SITE, req.body, res);
      if (!b) return;
      const t = await tariffView(req.userId);
      const isSelf = t.legalType === "self_employed";
      const key = isSelf ? "masterSite" : "whiteLabel"; /* §5.2: у самозанятых вместо белого ярлыка — мини-сайт */
      const g = await requireFeature(req.userId, "seller", key);
      if (!g.ok) return res.status(403).json(g);
      const domainBase = process.env.QF_PLATFORM_DOMAIN || "quantiform.ru";
      const slug = b.subdomain || String(t.accountId).toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30) || "shop";
      const site = {
        mode: isSelf ? "master_mini_site" : "white_label",
        url: "https://" + slug + "." + domainBase,
        custom_domain: !isSelf ? String((req.body && req.body.domain) || "") || null : null,
        ssl_certificate: !isSelf ? "lets-encrypt-managed" : "platform-wildcard",
        platform_branding_hidden: !isSelf /* §5.6: отключение брендинга платформы */,
        logo_upload: !isSelf,
        cover_upload: true,
        activated_at: new Date().toISOString(),
      };
      const d = readAll();
      if (!d.sites) d.sites = {};
      d.sites[String(req.userId)] = site;
      writeAll(d);
      res.json({ ok: true, site });
    } catch (e) { console.error("[SELLER SITE]", e); res.status(500).json({ error: "server" }); }
  });
  app.get("/api/seller/site", guard, async (req, res) => {
    const d = readAll();
    res.json({ ok: true, site: d.sites[String(req.userId)] || null });
  });

  /* ---------- §5.3: A/B-тестирование карточек (замер конверсии 14 дней) ---------- */
  app.post("/api/seller/ab-tests", guard, async (req, res) => {
    try {
      const g = await requireFeature(req.userId, "seller", "abTest");
      if (!g.ok) return res.status(403).json(g);
      const productId = String((req.body && req.body.productId) || "");
      const variantA = String((req.body && req.body.variantA) || "");
      const variantB = String((req.body && req.body.variantB) || "");
      if (!productId || !variantA || !variantB) return res.status(400).json({ error: "bad_request", hint: "нужны productId, variantA, variantB (описание или обложка)" });
      const test = {
        id: "ab-" + crypto.randomUUID().slice(0, 8), product_id: productId, owner_id: String(req.userId),
        variant_a: variantA, variant_b: variantB, split: "50/50",
        started_at: new Date().toISOString(), ends_at: addMonthsIso ? new Date(Date.now() + 14 * 864e5).toISOString() : null,
        duration_days: 14, status: "running", metrics: { a: { views: 0, conversions: 0 }, b: { views: 0, conversions: 0 } },
      };
      const d = readAll();
      if (!d.abTests) d.abTests = [];
      d.abTests.unshift(test); d.abTests = d.abTests.slice(0, 200);
      writeAll(d);
      res.json({ ok: true, test });
    } catch (e) { console.error("[AB CREATE]", e); res.status(500).json({ error: "server" }); }
  });
  app.get("/api/seller/ab-tests", guard, async (req, res) => {
    const d = readAll();
    const mine = (d.abTests || []).filter((x) => String(x.owner_id) === String(req.userId));
    const now = Date.now();
    for (const x of mine) {
      if (x.status === "running" && new Date(x.ends_at).getTime() <= now) {
        x.status = "finished";
        const cr = (m) => (m.views ? m.conversions / m.views : 0);
        x.winner = cr(x.metrics.b) > cr(x.metrics.a) ? "b" : "a";
        x.lift_pct = Math.round((cr(x.metrics.a) ? (cr(x.metrics.b) - cr(x.metrics.a)) / cr(x.metrics.a) : 0) * 1000) / 10;
      }
    }
    writeAll(d);
    res.json({ ok: true, tests: mine });
  });
  /* Демо-события витрины A/B (в проде — пиксель каталога): POST /api/seller/ab-tests/:id/event */
  app.post("/api/seller/ab-tests/:id/event", guard, async (req, res) => {
    const g = await requireFeature(req.userId, "seller", "abTest");
    if (!g.ok) return res.status(403).json(g);
    const d = readAll();
    const test = (d.abTests || []).find((x) => x.id === req.params.id && String(x.owner_id) === String(req.userId));
    if (!test) return res.status(404).json({ error: "test_not_found" });
    const v = String((req.body && req.body.variant) || "a") === "b" ? "b" : "a";
    const kind = String((req.body && req.body.kind) || "view");
    if (kind === "conversion") test.metrics[v].conversions++; else test.metrics[v].views++;
    writeAll(d);
    res.json({ ok: true, metrics: test.metrics });
  });

  /* ---------- §5.3/§5.5: закрытые заказы от бизнеса и корпоративные тендеры ----------
     Доступ: tier3 линеек (Бизнес-Премиум, Корпоративный Премиум, Топ) и tier2
     (Профи и Бизнес-Про, Корпоративный-Про) — согласно §5.5. */
  app.get("/api/b2b/closed-orders", guard, async (req, res) => {
    try {
      const g = await requireFeature(req.userId, "seller", "b2bClosed");
      if (!g.ok) return res.status(403).json(g);
      const d = readAll();
      const closed = (d.custom_orders || []).filter((o) => o.b2b_closed === true);
      res.json({ ok: true, orders: closed, access: "closed_b2b_section" });
    } catch (e) { console.error("[B2B CLOSED]", e); res.status(500).json({ error: "server" }); }
  });
  app.post("/api/b2b/tenders", guard, async (req, res) => {
    try {
      const g = await requireFeature(req.userId, "seller", "b2bClosed");
      if (!g.ok) return res.status(403).json(g);
      const tender = {
        id: "tnd-" + crypto.randomUUID().slice(0, 8),
        owner_id: String(req.userId),
        title: String((req.body && req.body.title) || "Корпоративный тендер"),
        budget: Number((req.body && req.body.budget) || 0),
        visibility: "closed_enterprise_only",
        created_at: new Date().toISOString(), status: "open",
      };
      const d = readAll();
      if (!d.tenders) d.tenders = [];
      d.tenders.unshift(tender);
      writeAll(d);
      res.json({ ok: true, tender });
    } catch (e) { console.error("[TENDER CREATE]", e); res.status(500).json({ error: "server" }); }
  });

  /* ---------- §5.3/§5.6: менеджерская линия (регламент ответа) ---------- */
  app.post("/api/manager/request", guard, async (req, res) => {
    try {
      const t = await tariffView(req.userId);
      const f = t.features.seller;
      if (!f.managerLine && !f.roundTheClock) return res.status(403).json({ ok: false, error: "feature_locked", reason: "Менеджерская линия доступна на тарифах Премиум-уровня" });
      const businessHours = (() => { const h = new Date().getUTCHours(); return h >= 3 && h < 12; })(); /* 10:00–19:00 МСК */
      const sla = f.roundTheClock
        ? { mode: "24/7", reaction_minutes: 15, note: "Круглосуточная линия, реакция 15 минут" }
        : { mode: "business_hours", response_hours: 2, note: "Ответ в течение 2 часов в рабочее время (10:00–19:00 МСК)" };
      const ticket = { id: "mgr-" + crypto.randomUUID().slice(0, 8), user_id: String(req.userId), message: String((req.body && req.body.message) || ""), sla, due_at: new Date(Date.now() + (f.roundTheClock ? 15 : 120) * 60000).toISOString(), created_at: new Date().toISOString(), status: "open" };
      const d = premRead();
      premWrite("managerTickets", [ticket, ...(d.managerTickets || [])].slice(0, 500));
      res.json({ ok: true, ticket, in_business_hours: businessHours });
    } catch (e) { console.error("[MANAGER]", e); res.status(500).json({ error: "server" }); }
  });

  /* ---------- §5.4: импорт товаров из файла (валидация шаблона + построчный отчёт) ---------- */
  const IMPORT_TEMPLATE = ["name", "category", "price", "stock", "material", "description"];
  app.get("/api/seller/import/template", guard, async (req, res) => {
    const g = await requireFeature(req.userId, "seller", "importFile");
    if (!g.ok) return res.status(403).json(g);
    res.json({ ok: true, template: IMPORT_TEMPLATE, format: "csv", sample: IMPORT_TEMPLATE.join(",") + "\n" + ['"Ваза керамическая"', '"decor_home"', 1900, 10, '"керамика"', '"Ручная работа"'].join(",") });
  });
  app.post("/api/seller/import", guard, async (req, res) => {
    try {
      const g = await requireFeature(req.userId, "seller", "importFile");
      if (!g.ok) return res.status(403).json(g);
      const csv = String((req.body && req.body.csv) || "");
      const lines = csv.split(/\r?\n/).filter((l) => l.trim().length);
      if (!lines.length) return res.status(400).json({ error: "empty_file" });
      const header = lines[0].split(",").map((s) => s.trim().toLowerCase());
      const missing = IMPORT_TEMPLATE.filter((c) => !header.includes(c));
      if (missing.length) return res.status(400).json({ error: "bad_template", missing_columns: missing, expected: IMPORT_TEMPLATE });
      const rows = [];
      const accepted = [];
      for (let i = 1; i < lines.length; i++) {
        const cells = parseCsvLine(lines[i]);
        const rec = {}; header.forEach((h, j) => (rec[h] = (cells[j] || "").trim()));
        const errs = [];
        if (!rec.name) errs.push("пустое название");
        const price = Number(String(rec.price).replace(/[^\d.]/g, ""));
        if (!(price > 0)) errs.push("цена должна быть числом > 0");
        const stock = Number(rec.stock || 0);
        if (!Number.isFinite(stock) || stock < 0) errs.push("остаток — целое ≥ 0");
        if (errs.length) rows.push({ line: i + 1, ok: false, errors: errs, raw: lines[i] });
        else {
          rows.push({ line: i + 1, ok: true });
          accepted.push({ id: "sp-imp-" + crypto.randomUUID().slice(0, 8), name: rec.name, categoryId: rec.category, price, stock, material: rec.material, description: rec.description, ownerId: String(req.userId), createdAt: new Date().toISOString(), import_batch: header.length });
        }
      }
      const d = readAll();
      if (!d.products) d.products = [];
      /* лимит товаров проверяется на сервере по каждой строке (§1.5/§2.4) */
      const lim = await serverCheckLimit(req.userId, "product_create", {});
      const capLeft = Number.isFinite(lim.limit) ? Math.max(0, lim.limit - lim.used) : accepted.length;
      const stored = accepted.slice(0, capLeft);
      const overflow = accepted.slice(capLeft);
      d.products.push(...stored.map((p) => ({ ...p })));
      writeAll(d);
      res.json({ ok: true, report: { total_lines: lines.length - 1, imported: stored.length, rejected: rows.filter((r) => !r.ok).length, over_limit: overflow.length, rows }, limit: { limit: lim.limit, used: lim.used + stored.length } });
    } catch (e) { console.error("[IMPORT]", e); res.status(500).json({ error: "server" }); }
  });

  /* ---------- §5.5: сегментация клиентов — когорты по покупкам + рассылки ---------- */
  app.get("/api/seller/segments", guard, async (req, res) => {
    try {
      const g = await requireFeature(req.userId, "seller", "segmentation");
      if (!g.ok) return res.status(403).json(g);
      const d = readAll();
      const myProductIds = new Set((d.products || []).filter((p) => String(p.ownerId || p.owner_id) === String(req.userId)).map((p) => p.id));
      /* когорты по частоте покуток товаров продавца за 90 дней */
      const byBuyer = {};
      for (const o of (d.market_orders_all || d.orders || [])) {
        const uidO = String(o.user_id || o.userId || "");
        const items = o.items || [];
        const hits = items.filter((it) => myProductIds.has(it.productId)).length;
        if (!uidO || !hits) continue;
        byBuyer[uidO] = (byBuyer[uidO] || 0) + hits;
      }
      const buyers = Object.entries(byBuyer);
      const cohorts = {
        one_time: buyers.filter(([, n]) => n === 1).map(([u]) => u),
        repeat: buyers.filter(([, n]) => n >= 2 && n < 4).map(([u]) => u),
        loyal: buyers.filter(([, n]) => n >= 4).map(([u]) => u),
        vip: buyers.filter(([, n]) => n >= 7).map(([u]) => u),
      };
      res.json({ ok: true, cohorts: { one_time: cohorts.one_time.length, repeat: cohorts.repeat.length, loyal: cohorts.loyal.length, vip: cohorts.vip.length }, detail: cohorts });
    } catch (e) { console.error("[SEGMENTS]", e); res.status(500).json({ error: "server" }); }
  });
  app.post("/api/seller/newsletter", guard, async (req, res) => {
    try {
      const g = await requireFeature(req.userId, "seller", "segmentation");
      if (!g.ok) return res.status(403).json(g);
      const seg = String((req.body && req.body.cohort) || "repeat");
      const campaign = {
        id: "nl-" + crypto.randomUUID().slice(0, 8), owner_id: String(req.userId),
        cohort: seg, subject: String((req.body && req.body.subject) || "Новая коллекция"),
        channel: "in_platform", /* рассылки внутри платформы */
        created_at: new Date().toISOString(), status: "scheduled",
      };
      const d = readAll();
      if (!d.newsletters) d.newsletters = [];
      d.newsletters.unshift(campaign);
      writeAll(d);
      res.json({ ok: true, campaign });
    } catch (e) { console.error("[NEWSLETTER]", e); res.status(500).json({ error: "server" }); }
  });

  /* ---------- §5.6: конструктор кастомных отчётов с выгрузкой табличного формата ---------- */
  app.post("/api/seller/reports/custom", guard, async (req, res) => {
    try {
      const g = await requireFeature(req.userId, "seller", "customReports");
      if (!g.ok) return res.status(403).json(g);
      const dims = Array.isArray(req.body && req.body.dimensions) ? req.body.dimensions : ["date", "product", "revenue"];
      const d = readAll();
      const myProducts = (d.products || []).filter((p) => String(p.ownerId || p.owner_id) === String(req.userId));
      /* сбор строк отчёта по выбранным измерениям */
      const rows = [];
      for (const p of myProducts) {
        const row = {};
        if (dims.includes("product")) row.product = p.name;
        if (dims.includes("date")) row.date = (p.created_at || p.createdAt || "").slice(0, 10);
        if (dims.includes("revenue")) row.revenue = (p.price || 0) * (p.sales || 0 || 1);
        if (dims.includes("views")) row.views = p.views || 0;
        if (dims.includes("stock")) row.stock = p.stock || 0;
        rows.push(row);
      }
      const fmt = (req.body && req.body.format) === "xlsx" ? "xlsx" : "csv";
      const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))];
      const csvOut = headers.join(";") + "\n" + rows.map((r) => headers.map((h) => String(r[h] ?? "")).join(";")).join("\n");
      const rep = { id: "rep-" + crypto.randomUUID().slice(0, 8), owner_id: String(req.userId), dimensions: dims, format: fmt, rows_count: rows.length, created_at: new Date().toISOString() };
      if (!d.reports) d.reports = [];
      d.reports.unshift(rep); writeAll(d);
      res.json({ ok: true, report: rep, download: { format: fmt, content_type: fmt === "csv" ? "text/csv;charset=utf-8" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", data: fmt === "csv" ? csvOut : base64MiniXlsx(headers, rows) } });
    } catch (e) { console.error("[CUSTOM REPORT]", e); res.status(500).json({ error: "server" }); }
  });

  /* ---------- §5.6: топ-позиции категорий с пометкой рекламы ---------- */
  app.post("/api/seller/top-positions", guard, async (req, res) => {
    try {
      const g = await requireFeature(req.userId, "seller", "topPositions");
      if (!g.ok) return res.status(403).json(g);
      const category = String((req.body && req.body.category) || "");
      if (!category) return res.status(400).json({ error: "bad_category" });
      const slot = { owner_id: String(req.userId), category, ad_label: "Реклама", guaranteed_positions: 3, activated_at: new Date().toISOString() };
      const d = readAll();
      if (!d.topSlots) d.topSlots = {};
      d.topSlots[String(req.userId) + ":" + category] = slot;
      writeAll(d);
      res.json({ ok: true, slot });
    } catch (e) { console.error("[TOP POSITIONS]", e); res.status(500).json({ error: "server" }); }
  });
  app.get("/api/market/top-slots", (_q, res) => {
    const d = readAll();
    res.json({ ok: true, slots: Object.values(d.topSlots || {}) });
  });

  /* ---------- §5.6: промо в рассылках платформы — 2 выхода в месяц по медиа-киту ---------- */
  const PROMO_MONTHLY_LIMIT = 2;
  app.get("/api/seller/promo/media-kit", guard, async (req, res) => {
    const g = await requireFeature(req.userId, "seller", "promoMailout");
    if (!g.ok) return res.status(403).json(g);
    res.json({ ok: true, media_kit: { audience: "премиум- и дизайнер-подписчики платформы", placements: ["email-digest", "push-weekly"], outputs_per_month: PROMO_MONTHLY_LIMIT, creative_specs: { banner: "600×200 JPG/PNG", text: "до 120 симв.", landing: "карточка товара или бренд-витрина" } } });
  });
  app.post("/api/seller/promo/book", guard, async (req, res) => {
    try {
      const g = await requireFeature(req.userId, "seller", "promoMailout");
      if (!g.ok) return res.status(403).json(g);
      const monthKey = new Date().toISOString().slice(0, 7);
      const d = readAll();
      if (!d.promoBookings) d.promoBookings = [];
      const mineThisMonth = d.promoBookings.filter((x) => String(x.owner_id) === String(req.userId) && x.month === monthKey).length;
      if (mineThisMonth >= PROMO_MONTHLY_LIMIT) return res.status(402).json({ ok: false, error: "promo_limit", reason: "Использованы все " + PROMO_MONTHLY_LIMIT + " выхода в рассылках этого месяца", limit: PROMO_MONTHLY_LIMIT, used: mineThisMonth });
      const booking = { id: "pb-" + crypto.randomUUID().slice(0, 8), owner_id: String(req.userId), month: monthKey, placement: String((req.body && req.body.placement) || "email-digest"), creative: String((req.body && req.body.creative) || ""), status: "scheduled", created_at: new Date().toISOString() };
      d.promoBookings.unshift(booking); writeAll(d);
      res.json({ ok: true, booking, remaining_this_month: PROMO_MONTHLY_LIMIT - mineThisMonth - 1 });
    } catch (e) { console.error("[PROMO BOOK]", e); res.status(500).json({ error: "server" }); }
  });

  /* §5.1/§5.6: VIP-бейдж покупателя в чеках — GET-эндпоинт для клиента */
  app.get("/api/receipt/vip-mark", guard, async (req, res) => {
    const t = await tariffView(req.userId);
    res.json({ ok: true, vip: !!t.features.buyer.vipBadge, badge_text: t.features.buyer.vipBadge ? "VIP · Премиум" : null });
  });

  /* ---------- §2.7: порог добросовестного использования безлимита ---------- */
  app.get("/api/limits/fair-use", guard, async (req, res) => {
    try {
      const t = await tariffView(req.userId);
      const monthKey = new Date().toISOString().slice(0, 7);
      const d = readAll();
      const usage = d.usage || {};
      const used = (usage[String(req.userId) + ":ai_gen:" + monthKey] || 0) + (usage[String(req.userId) + ":ai_card_gen:" + monthKey] || 0);
      const unlimited = !Number.isFinite(t.limits.seller.aiCardGens) || !Number.isFinite(t.limits.buyer.aiGens);
      const fair = d.fairUseUnlocks && d.fairUseUnlocks[String(req.userId)];
      res.json({ ok: true, threshold: FAIR_USE_THRESHOLD, used, unlimited, blocked: unlimited && used >= FAIR_USE_THRESHOLD && !fair, manually_unlocked: !!fair });
    } catch (e) { console.error("[FAIR USE]", e); res.status(500).json({ error: "server" }); }
  });
  app.post("/api/limits/fair-use/unlock", guard, async (req, res) => {
    try {
      const r = await requireFeature(req.userId, "seller", "weeklyReport"); /* ручная разблокировка — через менеджерскую линию поддержки */
      const d = readAll();
      if (!d.fairUseUnlocks) d.fairUseUnlocks = {};
      d.fairUseUnlocks[String(req.userId)] = { unlocked_at: new Date().toISOString(), via: "manual_support" };
      writeAll(d);
      res.json({ ok: true, unlocked: true });
    } catch (e) { console.error("[FAIR USE UNLOCK]", e); res.status(500).json({ error: "server" }); }
  });

  /* Экспорт для других модулей сервера (index.cjs, digital.cjs и пр.) */
  ctx.sellerFeaturesOf = sellerFeaturesOf;
  ctx.BUYER_FEATURES = BUYER_FEATURES;
  ctx.FAIR_USE_THRESHOLD = FAIR_USE_THRESHOLD;
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

/* webhook принимает и raw-body (подпись провайдера), и JSON.
   БЛОК 3, Пункт 3.2: сырое тело нужно для проверки HMAC-SHA256 —
   express.json() парсит тело и делает проверку подписи невозможной.
   express_raw(): если тело УЖЕ сохранено сырым Buffer-ом middleware
   верификатора (req.rawBody / req.body как Buffer) — используем его;
   иначе читаем поток как СЫРОЙ Buffer (express.raw). */
function express_raw() {
  const express = require("express");
  return [
    (req, _res, next) => {
      if (Buffer.isBuffer(req.rawBody)) { req.body = req.rawBody; return next(); }
      if (Buffer.isBuffer(req.body)) return next();
      express.raw({ type: "*/*", limit: "1mb" })(req, _res, next);
    },
  ];
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
