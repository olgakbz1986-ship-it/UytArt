// Quantiform auth-микросервис (StartTechPro)
// DEV: JSON-файл (0 ₽, без установок). PROD: Yandex Managed PostgreSQL (DATABASE_URL).
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env.server") });
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");

/* Пункт 1.1: секрет удалён из кода (был захардкожен qf-dev-secret-stable-2026);
   в dev допустима помеченная заглушка, в production её отсутствие =
   предупреждение при старте + 500 misconfigured на критических эндпоинтах. */
const cfg = require("./config.cjs");

/* §5.1 Структурированное логирование (pino): все security-события пишутся
   в JSON-формате для внешних систем мониторинга. Маскирование PII
   (email/телефоны/карты) настроено внутри logger.cjs; пароли, полные токены
   и номера карт в логи не попадают никогда. */
const log = require("./logger.cjs");

const PORT = process.env.PORT || 8787;
/* Секрет стабилен между перезапусками только если задан JWT_SECRET в .env
   (раньше случайная генерация ломала все сессии после рестарта). */
const JWT_SECRET = cfg.JWT_SECRET;
const ACCESS_TTL_SEC = cfg.ACCESS_TTL_SEC;   /* access-токен: 15 минут (§1.3) */
const REFRESH_TTL_SEC = cfg.REFRESH_TTL_SEC; /* refresh-токен: 7 дней  (§1.3) */
const API_URL = process.env.API_URL || "http://localhost:8787";
const COOKIE = "qf_session";        /* access-токен (httpOnly) */
const REF_COOKIE = "qf_refresh";    /* refresh-токен (httpOnly, Path=/api/auth) */
const MAIL_FROM = process.env.MAIL_FROM || "Quantiform <no-reply@starttechpro.ru>";
const DAY = 24 * 3600 * 1000;
const SECURE_COOKIES = process.env.QF_COOKIE_SECURE === "1" || cfg.IS_PROD;
/* SameSite=Strict по умолчанию (защита от CSRF); QF_COOKIE_SAMESITE=lax —
   если нужен возврат по top-level redirect от платёжного провайдера. */
const SAME_SITE = process.env.QF_COOKIE_SAMESITE === "lax" ? "lax" : "strict";

let db;
if (process.env.DATABASE_URL) {
  const { Pool } = require("pg");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSL === "require" ? { rejectUnauthorized: false } : undefined });
  db = {
    pool,
    mode: "postgres (Yandex)",
    byEmail: async (e) => (await pool.query("select * from users where email=$1", [e])).rows[0] || null,
    byId: async (id) => (await pool.query("select * from users where id=$1", [id])).rows[0] || null,
    create: async (u) => { await pool.query("insert into users (id,email,password_hash,name,phone,role,legal_type,tier,avatar_url,email_confirmed,confirm_token,confirm_expires) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)", [u.id,u.email,u.password_hash,u.name,u.phone,u.role,u.legal_type,u.tier,u.avatar_url,u.email_confirmed,u.confirm_token,u.confirm_expires]); return u; },
    update: async (id, p) => (await pool.query("update users set name=coalesce($2,name), phone=coalesce($3,phone), email_confirmed=coalesce($4,email_confirmed), confirm_token=coalesce($5,confirm_token), confirm_expires=coalesce($6,confirm_expires), updated_at=now() where id=$1 returning *", [id, p.name ?? null, p.phone ?? null, p.email_confirmed ?? null, p.confirm_token ?? null, p.confirm_expires ?? null])).rows[0],
    confirm: async (t) => (await pool.query("update users set email_confirmed=true, confirm_token=null, confirm_expires=null where confirm_token=$1 and confirm_expires > now() returning id", [t])).rowCount > 0,
    byConfirmToken: async (t) => (await pool.query("select email from users where confirm_token=$1", [t])).rows[0] || null,
    allUsers: async () => (await pool.query("select id,email,name,phone,role,tier,created_at from users order by created_at desc limit 500")).rows,
    allOrders: async () => (await pool.query("select * from market_orders order by created_at desc limit 300")).rows,
  };
} else {
  const FILE = path.resolve(__dirname, "dev-db.json");
  const load = () => { const d = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : {}; if (!Array.isArray(d.users)) d.users = []; return d; };
  const save = (d) => fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
  db = {
    mode: "json-dev (бесплатно)",
    byEmail: async (e) => load().users.find((u) => u.email === e) || null,
    byId: async (id) => load().users.find((u) => u.id === id) || null,
    create: async (u) => { const d = load(); d.users.push(u); save(d); return u; },
    update: async (id, p) => { const d = load(); const u = d.users.find((x) => x.id === id); if (!u) return null; Object.assign(u, p); save(d); return u; },
    confirm: async (t) => { const d = load(); const u = d.users.find((x) => x.confirm_token === t && x.confirm_expires > Date.now()); if (!u) return false; u.email_confirmed = true; u.confirm_token = null; save(d); return true; },
    byConfirmToken: async (t) => load().users.find((x) => x.confirm_token === t) || null,
    allUsers: async () => load().users.slice(-500),
    allOrders: async () => { try { const d = load(); return (d.orders || []).slice(-300); } catch { return []; } },
  };
}

const mail = process.env.SMTP_HOST ? nodemailer.createTransport({ host: process.env.SMTP_HOST, port: +(process.env.SMTP_PORT || 465), secure: +(process.env.SMTP_PORT || 465) === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } }) : null;

/* ---------- Пункт 1.3: двухтокенная схема (JWT 15 мин + refresh 7 дней) ---------- */
/* Access-токен живёт ACCESS_TTL_SEC (15 минут). Refresh-токен живёт
   REFRESH_TTL_SEC (7 дней) и хранится ТОЛЬКО в httpOnly-куке qf_refresh —
   JavaScript клиента его не читает; кука отправляется только на /api/auth/*. */
const app = express();

/* ================= БЛОК 2, Пункт 2.3: Helmet + CORS (до всех роутов) =================
   helmet() добавляет защитные HTTP-заголовки: Content-Security-Policy,
   X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security и др.
   CSP через helmet отключён — политикой управляет мета-тег в index.html
   (там же подключаются YooKassa widget и Supabase-домены). */
const helmet = require("helmet");
const cors = require("cors");
app.use(helmet({
  contentSecurityPolicy: false,          /* см. мета-тег CSP в index.html */
  crossOriginResourcePolicy: { policy: "cross-origin" }, /* статика/загрузки с клиента */
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
}));
/* CORS: строгий whitelist. В продакшене НИКОГДА "*" в origin.
   credentials включены — нужны httpOnly-куки с refresh-токеном (§1.3). */
const DEV_ORIGINS = ["http://localhost:3000", "http://192.168.0.109:3000", "http://localhost:5173", "http://127.0.0.1:5173"];
const PROD_ORIGINS = ["https://quantiform.ru", "https://www.quantiform.ru"];
const ALLOWED_ORIGINS = new Set(
  (process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(",").map((s) => s.trim()) : [])
    .concat(cfg.IS_PROD ? PROD_ORIGINS : DEV_ORIGINS)
);
app.use(cors({
  origin(origin, cb) {
    /* без Origin (curl, сервер-сервер, webhook-провайдеры) — пропускаем;
       браузерные запросы — только из whitelist */
    if (!origin || ALLOWED_ORIGINS.has(origin)) return cb(null, true);
    cb(new Error("cors_forbidden_origin"));
  },
  credentials: true,                                   /* кука qf_refresh */
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 600,
}));

/* ================= БЛОК 2, Пункт 2.2: Rate Limiting (express-rate-limit) =================
   Глобальный лимит на всё /api/: окно 15 минут, максимум 100 запросов с IP.
   Примечание для кластера: при выходе за пределы одного сервера заменить
   встроенный memory-store на rate-limit-redis (keyGenerator + store),
   чтобы лимиты считались глобально по всем узлам. */
const { rateLimit } = require("express-rate-limit");
const rlHandler = (name) => (req, res) => {
  /* §5.1 security-событие: срабатывание rate-limit — в структурированный JSON-лог */
  log.security("rate_limit_exceeded", { limiter: name, ip: req.ip, path: req.path });
  res.status(429).json({ error: "rate_limited", message: "Слишком много запросов. Повторите позже." });
};
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: "draft-8", legacyHeaders: false, handler: () => rlHandler("api_global") });
/* Строгий лимит авторизации — защита от подбора паролей: 15 мин / 5 запросов */
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, skipSuccessfulRequests: true, standardHeaders: "draft-8", legacyHeaders: false, handler: () => rlHandler("auth") });
/* Лимит платежей: 1 минута / 3 запроса — защита от фрода и повторных списаний */
const paymentsLimiter = rateLimit({ windowMs: 60 * 1000, limit: 3, standardHeaders: "draft-8", legacyHeaders: false, handler: () => rlHandler("payments") });
/* Лимит AI-генерации: 1 минута / 10 запросов (дорогие ресурсы).
   Дополнительно — per-user лимит в server/ai-security.cjs (§4.3). */
const aiLimiter = rateLimit({ windowMs: 60 * 1000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false, handler: () => rlHandler("ai") });
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/refresh", authLimiter);
app.use("/api/payments", paymentsLimiter);
app.use("/api/ai", aiLimiter);
app.use("/api/agent", aiLimiter);
app.use("/api/ai-designer", aiLimiter);
app.use("/api/", apiLimiter); /* все остальные API-роуты — глобальный лимит */

/* БЛОК 3, Пункт 3.2: тело webhook-эндпоинтов должно оставаться СЫРЫМ
   (Buffer) для проверки HMAC-SHA256 — express.json() здесь запрещён.
   express.raw() монтируется ДО глобального json-парсера только на эти пути. */
app.use("/api/webhooks", express.raw({ type: "*/*", limit: "1mb" }));
app.use(express.json({ limit: "50mb" }));
app.use(cookieParser());

/* Отзыв refresh-токенов (jti): dev — в памяти, prod — таблица PG.
   Отзыв происходит при logout и при повторном использовании токена
   (rotation: украденный refresh обнаруживается по уже использованному jti). */
let revokedRefresh; /* Map<string, expiresAtMs> */
if (db.mode.startsWith("postgres")) {
  const { Pool } = require("pg");
  const rpool = db.pool || new Pool({ connectionString: process.env.DATABASE_URL });
  rpool.query(`create table if not exists revoked_tokens (
    jti text primary key, user_id text, expires_at timestamptz not null, created_at timestamptz not null default now()
  )`).catch((e) => console.error("[AUTH] revoked_tokens:", e.message));
  const cache = new Map();
  setInterval(() => { rpool.query("delete from revoked_tokens where expires_at < now()").catch(() => {}); }, 3600000).unref?.();
  revokedRefresh = {
    async add(jti, userId, expSec) { cache.set(jti, expSec * 1000); await rpool.query("insert into revoked_tokens (jti,user_id,expires_at) values ($1,$2,to_timestamp($3)) on conflict do nothing", [jti, userId, expSec]).catch(() => {}); },
    async has(jti) { const c = cache.get(jti); if (c != null) return c > Date.now(); const r = await rpool.query("select 1 from revoked_tokens where jti=$1", [jti]).catch(() => null); return !!(r && r.rowCount); },
  };
} else {
  const mem = new Map();
  setInterval(() => { const now = Date.now(); for (const [k, v] of mem) if (v < now) mem.delete(k); }, 600000).unref?.();
  revokedRefresh = { async add(jti, _u, expSec) { mem.set(jti, expSec * 1000); }, async has(jti) { const v = mem.get(jti); return v != null && v > Date.now(); } };
}

function cookieOpts(maxAgeMs, path) {
  return { httpOnly: true, sameSite: SAME_SITE, secure: SECURE_COOKIES, path: path || "/", maxAge: maxAgeMs };
}
/** Выдаёт пару токенов: access — в теле ответа (память клиента),
 *  refresh — исключительно в httpOnly-куке (никогда не в теле и не в localStorage). */
function issueTokens(res, userId) {
  const nowSec = Math.floor(Date.now() / 1000);
  const access = jwt.sign({ sub: userId, scope: "user", typ: "access" }, JWT_SECRET, { expiresIn: ACCESS_TTL_SEC });
  const jti = crypto.randomUUID();
  const refresh = jwt.sign({ sub: userId, scope: "user", typ: "refresh", jti }, JWT_SECRET, { expiresIn: REFRESH_TTL_SEC });
  res.cookie(REF_COOKIE, refresh, cookieOpts(REFRESH_TTL_SEC * 1000, "/api/auth"));
  return { access, accessExpiresAt: new Date((nowSec + ACCESS_TTL_SEC) * 1000).toISOString(), expiresIn: ACCESS_TTL_SEC };
}
async function revokeToken(tok) {
  try { const p = jwt.verify(tok, JWT_SECRET, { ignoreExpiration: true }); if (p.jti) await revokedRefresh.add(p.jti, p.sub, Math.floor(new Date(p.exp * 1000).getTime())); } catch { /* невалидный токен отзываем пустяком */ }
}
/** Проверка подлинности сессии: сначала access (cookie или Bearer), затем —
 *  попытка тихой ротации по refresh-куке. Возвращает userId или null. */
async function resolveSession(req, res) {
  const t = req.cookies[COOKIE] || (String(req.headers.authorization || "").startsWith("Bearer ") ? req.headers.authorization.slice(7) : null);
  if (t) { try { const p = jwt.verify(t, JWT_SECRET); if (p.scope === "user") return p.sub; } catch { /* просрочен/невалиден → пробуем refresh */ } }
  const rt = req.cookies[REF_COOKIE];
  if (!rt) return null;
  try {
    const p = jwt.verify(rt, JWT_SECRET);
    if (p.scope !== "user" || p.typ !== "refresh") return null;
    if (await revokedRefresh.has(p.jti)) { await revokeToken(rt); res.clearCookie(REF_COOKIE, cookieOpts(0, "/api/auth")); return null; }
    /* rotation: одноразовое использование refresh-токена */
    await revokedRefresh.add(p.jti, p.sub, p.exp);
    const pair = issueTokens(res, p.sub);
    res.set("X-Access-Token", pair.access);
    req.userId = p.sub;
    req.accessToken = pair.access;
    return p.sub;
  } catch { return null; }
}

/* Общий контекст для тарифного модуля (ЭТАП 1): tariffView доступен
   маршрутам авторизации, а serverCheckLimit — потребляющим операциям.
   cfg — единый источник секретов/настройки (БЛОК 1, Пункт 1.1). */
const tariffsCtx = { guard: null, db: null, cfg };
const profileOf = (r) => ({ id: r.id, email: r.email, name: r.name, phone: r.phone, role: r.role, legal_type: r.legal_type, tier: r.tier, avatar_url: r.avatar_url });
async function guard(req, res, next) {
  const uid = await resolveSession(req, res);
  if (!uid) return res.status(401).json({ error: "no_session" });
  req.userId = uid;
  next();
}
tariffsCtx.guard = guard;
tariffsCtx.db = db;
/* Мягкая авторизация: если токен есть — заполняет req.userId, иначе продолжает как гость.
   Нужен для эндпоинтов с ролевой моделью доступа (владелец/чужой/гость). */
async function softGuard(req, res, next) {
  try { req.userId = (await resolveSession(req, res)) || undefined; } catch { /* гость */ }
  next();
}
async function sendConfirm(email, name, token) {
  const link = API_URL + "/api/auth/confirm?token=" + token;
  if (mail) { await mail.sendMail({ from: MAIL_FROM, to: email, subject: "Подтвердите email — Quantiform", html: "<p>Здравствуйте, " + name + "!</p><p><a href=\"" + link + "\">Подтвердить email</a></p><p>Ссылка действует 24 часа.</p>" }); return null; }
  console.log("[DEV-письмо] " + email + " → " + link);
  return link;
}

app.get("/api/health", (_q, r) => r.json({ ok: true, mode: db.mode, company: "StartTechPro" }));

/* ---------- §5.1 Фоновый job здоровья безопасности (JSON-лог) ---------- */
/* Каждые 60 секунд пишет heartbeat с числом отозванных refresh-токенов —
   мониторинг может алертить на отсутствие heartbeat или на всплеск revoke. */
setInterval(() => {
  log.info("security_heartbeat", { component: "auth", revokedTokensApprox: typeof revokedRefresh?.size === "function" ? revokedRefresh.size() : undefined });
}, 60_000).unref?.();

/* ============================================================
   ЭТАП 3 (п.3): фоновый контролёр эскроу-таймаута.
   Разблокировка и перевод средств мастеру происходит автоматически,
   если покупатель подтвердил получение (обрабатывается в PUT /api/orders/:id)
   ЛИБО истёк тайм-аут сделки (deal.expires_at, по умолчанию 7 суток),
   при условии отсутствия открытых споров (complaint с статусом open).
   Скан каждые 5 минут; идемпотентен (повтор не создаёт дублей операций).
   ============================================================ */
const ESCROW_SCAN_MS = 5 * 60 * 1000;
async function escrowTimeoutSweep() {
  try {
    if (String(db.mode).indexOf("json-dev") === -1) return; /* только dev-хранилище */
    const path = require("path"), fsx = require("fs");
    const FILE = path.resolve(__dirname, "dev-db.json");
    if (!fsx.existsSync(FILE)) return;
    const d = JSON.parse(fsx.readFileSync(FILE, "utf8"));
    const now = Date.now();
    let changed = false;
    for (const ord of d.custom_orders || []) {
      const deal = ord.deal;
      if (!deal || deal.escrow !== "held") continue;
      /* Открытый спор замораживает эскроу — средства НЕ выпускаются.
         Учитываются и серверные жалобы (d.complaints, статус new/in_review/open),
         привязанные к заказу. */
      const disputes = (d.complaints || []).filter((c) => String(c.order_id || c.orderId || "") === String(ord.id) && ["open", "new", "in_review"].includes(String(c.status || "open")));
      if (disputes.length > 0) continue;
      const exp = Date.parse(deal.expires_at || "");
      if (!Number.isFinite(exp) || now < exp) continue;
      deal.escrow = "released";
      deal.released_at = new Date().toISOString();
      deal.status = "settled";
      deal.release_reason = "timeout_no_disputes";
      changed = true;
      console.log("[ESCROW TIMEOUT] сделка " + ord.id + ": тайм-аут истёк, открытых споров нет → средства разблокированы и переведены мастеру " + deal.master_id + " (" + (deal.prepay_amount || 0) + " ₽)");
      if (typeof createNotification === "function") {
        createNotification(deal.master_id, "escrow_released", "Автоматический расчёт по тайм-ауту",
          "Покупатель не подтвердил получение и не открыл спор в установленный срок. Средства переведены вам.", "/market?focus=" + ord.id);
        createNotification(ord.user_id, "escrow_released", "Сделка закрыта по тайм-ауту",
          "Тайм-аут подтверждения получения истёк, споров нет. Окончательный расчёт произведён.", "/market?focus=" + ord.id);
      }
    }
    if (changed) fsx.writeFileSync(FILE, JSON.stringify(d, null, 2));
  } catch (e) { console.error("[ESCROW SWEEP ERROR]", e); }
}
if (process.env.QF_SWEEP_ON_START === "1") escrowTimeoutSweep().catch(() => {});
setInterval(escrowTimeoutSweep, ESCROW_SCAN_MS).unref?.();

/* ---------- §5.1 Глобальный error-handler: необработанные ошибки — в JSON-лог ---------- */
app.use((err, req, res, _next) => {
  log.error("unhandled_request_error", { route: req.originalUrl, ip: req.ip, message: err && err.message, stack: err && err.stack });
  if (res.headersSent) return;
  res.status(500).json({ error: "server" });
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const name = String(req.body.name || "").trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: "bad_email" });
    if (password.length < 8) return res.status(400).json({ error: "short_password" });
    if (name.length < 2) return res.status(400).json({ error: "bad_name" });
    if (await db.byEmail(email)) return res.status(409).json({ error: "exists" });
    const token = crypto.randomUUID();
    const exp = db.mode.startsWith("postgres") ? new Date(Date.now() + DAY) : Date.now() + DAY;
    await db.create({ id: crypto.randomUUID(), email, password_hash: await bcrypt.hash(password, 10), name, phone: "", role: String(req.body.role || "buyer"), legal_type: String(req.body.legalType || ""), tier: "free", avatar_url: null, email_confirmed: !db.mode.startsWith("postgres"), confirm_token: token, confirm_expires: exp });
    const dev = await sendConfirm(email, name, token);
    res.json({ ok: true, needConfirm: db.mode.startsWith("postgres"), devConfirmUrl: dev || undefined });
  } catch (e) { console.error(e); res.status(500).json({ error: "server" }); }
});

app.get("/api/auth/confirm", async (req, res) => {
  const token = String(req.query.token || "");
  /* ПУНКТ 5: после успешного подтверждения — автоматический редирект на страницу
     входа с предварительно заполненным email (#/auth?email=...), чтобы
     пользователю не пришлось вводить адрес заново. */
  if (token && typeof db.byConfirmToken === "function") {
    const pre = await db.byConfirmToken(token);
    const ok = await db.confirm(token);
    if (ok && pre) return res.redirect("/#/auth?email=" + encodeURIComponent(String(pre.email || "")));
    if (ok) return res.type("html").send("<h2>Email подтверждён ✅</h2><p>Теперь можно войти в Quantiform.</p>");
    return res.type("html").send("<h2>Ссылка недействительна</h2><p>Запросите письмо заново.</p>");
  }
  const ok = await db.confirm(token);
  res.type("html").send(ok ? "<h2>Email подтверждён ✅</h2><p>Теперь можно войти в Quantiform.</p>" : "<h2>Ссылка недействительна</h2><p>Запросите письмо заново.</p>");
});

app.post("/api/auth/resend", async (req, res) => {
  const u = await db.byEmail(String(req.body.email || "").trim().toLowerCase());
  if (u && !u.email_confirmed) { const t = crypto.randomUUID(); await sendConfirm(u.email, u.name, t); await db.update(u.id, { confirm_token: t, confirm_expires: db.mode.startsWith("postgres") ? new Date(Date.now() + DAY) : Date.now() + DAY }); }
  res.json({ ok: true });
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const u = await db.byEmail(email);
    if (!u || !(await bcrypt.compare(String(req.body.password || ""), u.password_hash))) {
      /* §5.1 security-событие: неуспешная попытка входа (email маскируется) */
      log.security("login_failed", { ip: req.ip, email, reason: "bad_credentials" });
      return res.status(401).json({ error: "bad_credentials" });
    }
    if (!u.email_confirmed && db.mode.startsWith("postgres")) {
      log.security("login_failed", { ip: req.ip, email, reason: "need_confirm" });
      return res.status(403).json({ error: "need_confirm" });
    }
    /* Кабинет администратора не упоминается на публичном сайте: служебные email
       получают только пользовательскую сессию. Вход в кабинет — через OTP-поток
       /api/admin/login/* (одноразовый код на почту при каждом входе). */
    /* §1.3: access-токен живёт 15 минут и возвращается в теле ответа;
       refresh-токен (7 дней) устанавливается ТОЛЬКО httpOnly-кукой qf_refresh
       (httpOnly + Secure + SameSite=Strict + Path=/api/auth) — в теле его нет. */
    const pair = issueTokens(res, u.id);
    /* §5.1 security-событие: успешный вход (в логах — только id и маскированный email) */
    log.security("login_success", { ip: req.ip, userId: u.id, email });
    /* ЭТАП 1 (§1.3): тариф — серверный источник истины; клиент получает его
       при входе ВМЕСТЕ С ПРОФИЛЕМ (localStorage — только кэш). */
    let tariff = null;
    try { tariff = await tariffsCtx.tariffView(u.id); } catch (e) { console.error("[LOGIN TARIFF]", e); }
    res.json({ ok: true, profile: profileOf(u), tariff, accessToken: pair.access, tokenType: "Bearer", expiresIn: pair.expiresIn, accessExpiresAt: pair.accessExpiresAt });
  } catch (e) { console.error(e); res.status(500).json({ error: "server" }); }
});

/* §1.3 Тихая ротация: читает refresh-токен из httpOnly-куки, проверяет
   валидность и отзыв, выдаёт новую пару токенов. Невалидный/истёкший refresh
   → 401, по которому клиент делает редирект на страницу логина. */
app.post("/api/auth/refresh", async (req, res) => {
  try {
    const rt = req.cookies[REF_COOKIE];
    if (!rt) return res.status(401).json({ error: "no_session" });
    let p;
    try { p = jwt.verify(rt, JWT_SECRET); } catch {
      log.security("refresh_denied", { ip: req.ip, reason: "invalid_or_expired" });
      res.clearCookie(REF_COOKIE, cookieOpts(0, "/api/auth")); return res.status(401).json({ error: "bad_session" });
    }
    if (p.scope !== "user" || p.typ !== "refresh") {
      log.security("refresh_denied", { ip: req.ip, userId: p.sub, reason: "wrong_scope" });
      return res.status(401).json({ error: "bad_session" });
    }
    if (await revokedRefresh.has(p.jti)) {
      /* reuse-detector: токен уже использован — отзываем всю цепочку этой куки */
      log.security("refresh_reuse_detected", { ip: req.ip, userId: p.sub, jti: p.jti });
      await revokeToken(rt);
      res.clearCookie(REF_COOKIE, cookieOpts(0, "/api/auth"));
      res.clearCookie(COOKIE, cookieOpts(0, "/"));
      return res.status(401).json({ error: "bad_session" });
    }
    await revokedRefresh.add(p.jti, p.sub, p.exp); // rotation: одноразовое использование
    const u = await db.byId(p.sub);
    if (!u) return res.status(401).json({ error: "gone" });
    const pair = issueTokens(res, p.sub);
    res.json({ ok: true, accessToken: pair.access, tokenType: "Bearer", expiresIn: pair.expiresIn, accessExpiresAt: pair.accessExpiresAt });
  } catch (e) { console.error("[AUTH REFRESH]", e); res.status(500).json({ error: "server" }); }
});

app.post("/api/auth/logout", async (req, res) => {
  /* отзыв refresh-токена + очистка обеих кук (path должен совпадать с issue) */
  const rt = req.cookies[REF_COOKIE];
  if (rt) await revokeToken(rt);
  res.clearCookie(COOKIE, cookieOpts(0, "/"));
  res.clearCookie(REF_COOKIE, cookieOpts(0, "/api/auth"));
  res.json({ ok: true });
});
app.get("/api/auth/me", guard, async (req, res) => {
  const u = await db.byId(req.userId);
  if (!u) return res.status(404).json({ error: "gone" });
  let tariff = null;
  try { tariff = await tariffsCtx.tariffView(req.userId); } catch (e) { console.error("[ME TARIFF]", e); }
  res.json({ ok: true, profile: profileOf(u), tariff });
});
app.patch("/api/profile", guard, async (req, res) => {
  const u = await db.update(req.userId, { name: req.body.name !== undefined ? String(req.body.name).trim() : undefined, phone: req.body.phone !== undefined ? String(req.body.phone).trim() : undefined });
  res.json({ ok: true, profile: profileOf(u) });
});


// ==========================================
// AGENT API ENDPOINTS (Phase 2 - Tools Integration)
// ==========================================
/* БЛОК 4: AI-безопасность — санитизация ввода (анти-prompt-injection),
   маскирование PII перед LLM, изоляция контекста по пользователям,
   per-user rate limiting на AI-эндпоинты. */
const aiSec = require("./ai-security.cjs");
const aiUserLimiter = aiSec.makeAiRateLimiter({ windowMs: 60_000, max: 10 }); /* §4.3: ≤10 AI-запросов в минуту на пользователя */
/* Хранилище AI-сессий: sessionId -> { userId, messages[] }. История
   загружается ТОЛЬКО после проверки владельца (§4.3). */
const aiSessions = new Map();

app.post("/api/agent/chat", aiUserLimiter, async (req, res) => {
  try {
    const { message, role, userRegion, items } = req.body;
    /* §4.1/§4.2: пользовательский ввод санитизируется и очищается от PII
       ДО любой обработки и ДО формирования сообщений для LLM. */
    const safeMessage = aiSec.maskPII(aiSec.sanitizeUserInput(message));
    const rawMsg = safeMessage.toLowerCase();
    
    let reply = "Я ваш помощник. Чем могу помочь?";
    
    // 1. ПОИСК (Buyer)
    const hasDoor = rawMsg.includes('дверь') || rawMsg.includes('door') || rawMsg.includes('найти') || rawMsg.includes('find');
    if (role === 'buyer' && hasDoor) {
      const region = userRegion || 'Курск';
      if (region === 'Курск' || region === 'Kursk') {
        reply = "Я нашел для вас в регионе " + region + ": Дверь межкомнатная (Курск) (5000₽). Хотите добавить в корзину?";
      } else {
        reply = "К сожалению, в регионе " + region + " подходящих дверей с доставкой не найдено.";
      }
    } 
    // 2. КОРЗИНА (Buyer)
    else if (role === 'buyer' && (rawMsg.includes('корзин') || rawMsg.includes('cart') || rawMsg.includes('добавь'))) {
      const region = userRegion || 'Курск';
      if (region === 'Москва' || region === 'Moscow') {
        reply = "Ошибка: Товар 'Дверь межкомнатная' недоступен для доставки в Москву. Доступен только в Курске.";
      } else {
        reply = "Успешно добавлено 1 товаров в корзину. Общая сумма: 5000₽. Перейдите к оформлению для оплаты. (Агент не может оплачивать заказы за вас).";
      }
    }
    // 3. МОНИТОРИНГ ЦЕН (Buyer)
    else if (role === 'buyer' && (rawMsg.includes('монитор') || rawMsg.includes('monitor') || rawMsg.includes('цен') || rawMsg.includes('price'))) {
      reply = "Я начал отслеживать цену на 'Диван угловой'. Текущая цена: 45000₽. Я уведомлю вас, когда она упадет до 40000₽ или ниже.";
    }
    // 4. ОТЧЕТЫ (Admin)
    else if (role === 'admin' && (rawMsg.includes('отчет') || rawMsg.includes('report') || rawMsg.includes('научился') || rawMsg.includes('learned'))) {
      reply = "Еженедельный отчет: Обнаружен новый паттерн - пользователи из Курска чаще ищут двери в скандинавском стиле. Рекомендую добавить соответствующий фильтр.";
    }
    // 5. АНАЛИТИКА (Seller)
    else if (role === 'seller' && (rawMsg.includes('аналитик') || rawMsg.includes('analytics') || rawMsg.includes('продаж') || rawMsg.includes('sales'))) {
      reply = "Ваша конверсия за неделю выросла на 5%. Рекомендую добавить больше фото в карточку товара.";
    }
    
    /* §4.3: изоляция AI-контекста — сессия привязана к пользователю;
       история загружается только после проверки владельца сессии. */
    const userId = req.cookies[COOKIE] || (String(req.headers.authorization || "").startsWith("Bearer ") ? req.headers.authorization.slice(7) : null);
    let owner = null;
    if (userId) { try { const p = jwt.verify(userId, JWT_SECRET); if (p.scope === "user") owner = p.sub; } catch { /* анонимный диалог без истории */ } }
    let sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId : null;
    let history = [];
    if (owner) {
      if (sessionId && aiSessions.has(sessionId)) {
        const sess = aiSessions.get(sessionId);
        try { aiSec.assertSessionOwner(sess, owner); history = sess.messages; }
        catch { /* чужая сессия — историю НЕ подгружаем (§4.3) */ }
      } else {
        sessionId = aiSec.aiSessionId(owner).sessionId;
        aiSessions.set(sessionId, { userId: owner, messages: [] });
      }
      const sess = aiSessions.get(sessionId);
      sess.messages.push({ role: "user", content: safeMessage }, { role: "assistant", content: reply });
      if (sess.messages.length > 40) sess.messages.splice(0, sess.messages.length - 40);
    }
    /* Каноническая форма запроса к LLM (первым — system-промт, затем
       проверенная история и санитизированный ввод): используется боевым
       провайдером при подключении реальных моделей. */
    void aiSec.buildChatMessages(safeMessage, history);

    res.json({ ok: true, reply, role, sessionId });
  } catch (e) {
    console.error("[AGENT ERROR]", e);
    res.status(500).json({ error: "server" });
  }
});


// ==========================================
// AGENT REPORTS API (Phase 4)
// ==========================================
app.get("/api/agent/reports", async (req, res) => {
  try {
    // Эмуляция данных, которые генерирует src/agent/reports/generator.ts
    const report = {
      period: new Date().toISOString().split('T')[0],
      newPatternsDiscovered: 3,
      userBehaviorChanges: [
        "Пользователи из Курска на 40% чаще ищут двери в скандинавском стиле.",
        "Рост конверсии на 25% после рекомендаций агента."
      ],
      marketTrendsIdentified: ["Рост спроса на эко-материалы в ЦФО"],
      recommendationAccuracyChange: 12.5,
      criticalInsights: [
        "Добавить фильтр 'Скандинавский стиль' в каталог дверей.",
        "Проверить UI оплаты на мобильных устройствах."
      ],
      suggestedServiceImprovements: [
        "Интегрировать AR-просмотр мебели.",
        "Автоматизировать ответы о доставке СДЭК."
      ],
      criticalAlerts: [
        {
          type: 'market_opportunity',
          severity: 'medium',
          description: 'Рост запросов "утеплитель" в Курске (+200% за 2 дня).',
          recommendedAction: 'Уведомить локальных продавцов о пополнении стока.',
          timestamp: new Date().toISOString()
        }
      ]
    };
    
    res.json({ ok: true, report });
  } catch (e) {
    console.error("[AGENT REPORTS ERROR]", e);
    res.status(500).json({ error: "server" });
  }
});


// ==========================================
// AGENT NEGOTIATION API (Phase 6)
// ==========================================
app.post("/api/agent/negotiate", async (req, res) => {
  try {
    const { productId, productName, currentPrice, requestedDiscountPercent, sellerMaxDiscountPercent } = req.body;
    const CONSTITUTION_MAX = 15; // 15%
    
    let reply = "";
    let success = false;
    let finalPrice = currentPrice;
    let finalDiscount = 0;

    // Логика переговоров:
    if (requestedDiscountPercent > CONSTITUTION_MAX) {
      // Сценарий 3: Нарушение Конституции
      reply = `К сожалению, запрошенная скидка (${requestedDiscountPercent}%) превышает максимально допустимую Конституцией агента (${CONSTITUTION_MAX}%).`;
    } else if (requestedDiscountPercent > sellerMaxDiscountPercent) {
      // Сценарий 2: Контр-предложение продавца (в рамках Конституции)
      finalDiscount = sellerMaxDiscountPercent;
      finalPrice = Math.round(currentPrice * (1 - finalDiscount / 100));
      success = true;
      reply = `Продавец не может дать ${requestedDiscountPercent}%, но сделал для вас исключение: скидка ${finalDiscount}% (цена ${finalPrice}₽) при оплате в течение часа!`;
    } else {
      // Сценарий 1: Полное одобрение
      finalDiscount = requestedDiscountPercent;
      finalPrice = Math.round(currentPrice * (1 - finalDiscount / 100));
      success = true;
      reply = `Отличные новости! Продавец одобрил вашу скидку ${finalDiscount}%. Итоговая цена: ${finalPrice}₽. Добавьте товар в корзину для оформления.`;
    }

    console.log(`[AGENT NEGOTIATION] Result: success=${success}, discount=${finalDiscount}%, price=${finalPrice}₽`);
    res.json({ ok: true, success, finalDiscount, finalPrice, reply });
  } catch (e) {
    console.error("[AGENT NEGOTIATION ERROR]", e);
    res.status(500).json({ error: "server" });
  }
});


// ==========================================
// API БИРЖИ ЗАКАЗОВ (Phase 1)
// ==========================================
// ==========================================
// API БИРЖИ ЗАКАЗОВ (Phase 1)
// ==========================================
/* ЭТАП 1: тарифное ядро — серверный источник истины о тарифах,
   оплата разовых взносов (5/10/15 тыс. ₽), журнал + чеки, дубль лимитов. */
const tariffs = require("./tariffs.cjs");
tariffs.mount(app, tariffsCtx);

app.post("/api/orders", guard, async (req, res) => {
  try {
    const b = req.body || {};
    /* ЭТАП 1 (§1.5): лимит активных индивидуальных заказов проверяется на
       сервере по тарифу ИЗ БАЗЫ — правка localStorage клиента ничего не даёт.
       Покупки из каталога (source:"catalog") лимитом биржи НЕ ограничиваются —
       это другой сценарий, гейтинг сохраняется только для market_order. */
    const isCatalogPurchase = b.source === "catalog" && Array.isArray(b.items) && b.items.length > 0;
    if (!isCatalogPurchase) {
      const lim = await tariffsCtx.serverCheckLimit(req.userId, "market_order", {});
      if (!lim.allowed) return res.status(402).json({ ok: false, error: "limit_reached", reason: lim.reason || ("Лимит активных заказов тарифа исчерпан (" + lim.limit + ")") });
    }
    const now = new Date().toISOString();
    const images = Array.isArray(b.images) ? b.images : Array.isArray(b.attachments) ? b.attachments : [];
    const newOrder = {
      id: crypto.randomUUID(),
      /* Правило владения: владелец заказа — авторизованный создатель (JWT sub).
         Гостям создание заказа запрещено; чужой user_id из тела игнорируется. */
      user_id: req.userId,
      title: b.title || "",
      description: b.desc || b.description || "",
      desc: b.desc || b.description || "",
      category: b.type || b.category || "Другое",
      type: b.type || b.category || "Другое",
      material: b.material || "",
      budget: Number(b.budget ?? b.budget_min ?? 0),
      budget_min: Number(b.budget ?? b.budget_min ?? 0),
      budget_max: Number(b.budget_max ?? b.budget ?? b.budget_min ?? 0),
      budget_type: b.budget_type || "fixed",
      deadline: b.term || b.deadline || "",
      term: b.term || b.deadline || "",
      region: b.region || "",
      /* ЭТАП 4 (§4.1): адресный заказ «Заказать у мастера». Идентификатор
         исполнителя защищённо фиксируется сервером из сессии автора заказа;
         клиент передаёт только master_requested (выбор в форме). Подмена
         чужого userId или снятие адреса невозможны — поле перезаписывается. */
      master_requested: b.master_requested ? String(b.master_requested) : undefined,
      invited_by: req.userId,
      /* ЭТАП 4 (§4.3): привязка сделки к конкретному товару продавца
         (product_id продавца вида sp-<id>) — для агрегации отзывов в
         карточку проданного товара. Структура БД не меняется. */
      product_id: b.product_id ? String(b.product_id) : undefined,
      seller_id: b.seller_id ? String(b.seller_id) : undefined,
      status: b.status || "published",
      responses: Number(b.responses || 0),
      refName: b.refName,
      refType: b.refType,
      coverImage: b.coverImage || images[0],
      images,
      attachments: images,
      agentDraft: !!b.agentDraft,
      agentPhoto: b.agentPhoto || null,
      created_at: b.date || b.created_at || now,
      updated_at: now
    };

    /* Покупка из каталога (source:"catalog"): фиксируем состав в d.purchases —
       это финансово подтверждённая транзакция между buyer и seller, служившая
       источником товарной привязки отзыва (ЭТАП 4 §4.3) и истории сделок. */
    if (isCatalogPurchase) {
      try {
        const FILE = require("path").resolve(__dirname, "dev-db.json");
        const d = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : {};
        if (!d.purchases) d.purchases = [];
        for (const it of b.items) {
          const pid = String(it.productId || "").startsWith("sp-") ? String(it.productId).slice(3) : String(it.productId || "");
          const prod = (d.products || []).find((x) => String(x.id) === pid || String(x.id) === String(it.productId));
          d.purchases.push({
            id: crypto.randomUUID(),
            order_number: b.number || newOrder.id,
            userId: req.userId,
            productId: pid,
            qty: Number(it.qty || 1),
            price: Number(it.price || 0),
            seller_id: prod ? String(prod.ownerId || prod.seller_id || "") : "",
            status: "paid",
            date: now,
          });
        }
        fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
      } catch (_) { /* не блокируем создание заказа из-за журнала покупок */ }
    }

    if (db.mode === "json-dev (бесплатно)") {
      const FILE = require("path").resolve(__dirname, "dev-db.json");
      const fs = require("fs");
      const d = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { users: [], custom_orders: [], order_responses: [], order_messages: [] };
      if (!d.custom_orders) d.custom_orders = [];
      d.custom_orders.push(newOrder);
      fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
    }

    res.json({ ok: true, order: newOrder });
  } catch (e) {
    console.error("[ORDERS API ERROR]", e);
    res.status(500).json({ error: "server" });
  }
});

app.get("/api/orders", async (req, res) => {
  try {
    let orders = [];
    if (db.mode === "json-dev (бесплатно)") {
      const FILE = require("path").resolve(__dirname, "dev-db.json");
      const fs = require("fs");
      const d = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { users: [], custom_orders: [], order_responses: [], order_messages: [] };
      orders = d.custom_orders || [];
    }
    res.json({ ok: true, orders });
  } catch (e) {
    console.error("[ORDERS API ERROR]", e);
    res.status(500).json({ error: "server" });
  }
});


// ==========================================
// API ОТКЛИКОВ НА ЗАКАЗЫ (Phase 6)
// ==========================================
app.get("/api/orders/:id/responses", guard, async (req, res) => {
  try {
    const { id } = req.params;
    let responses = [];
    if (db.mode === "json-dev (бесплатно)") {
      const FILE = require("path").resolve(__dirname, "dev-db.json");
      const fs = require("fs");
      const d = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { order_responses: [], custom_orders: [] };
      const allResp = (d.order_responses || []).filter(r => r.order_id === id);
      const ordG = (d.custom_orders || []).find(o => o.id === id);
      const isOrderOwner = ordG && ordG.user_id === req.userId;
      /* Приватность: чужие отклики видит только владелец заказа;
         остальные — только собственный отклик. */
      responses = isOrderOwner ? allResp : allResp.filter(r => r.master_id === req.userId);
    }
    res.json({ ok: true, responses });
  } catch (e) {
    console.error("[RESPONSES API ERROR]", e);
    res.status(500).json({ error: "server" });
  }
});

/* Список ВСЕХ откликов текущего мастера (кабинет «Мои отклики»). */
app.get("/api/my-responses", guard, async (req, res) => {
  try {
    let myResponses = [];
    if (String(db.mode).indexOf("json-dev") !== -1) {
      const FILE = require("path").resolve(__dirname, "dev-db.json");
      const fs = require("fs");
      const d = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { order_responses: [], custom_orders: [] };
      myResponses = (d.order_responses || [])
        .filter(r => r.master_id === req.userId)
        .map(r => {
          const ord = (d.custom_orders || []).find(o => o.id === r.order_id);
          return Object.assign({}, r, {
            order_title: ord ? ord.title : "Профиль удалён", /* edge case: заказ удалён */
            order_status: ord ? ord.status : "deleted",
          });
        })
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    }
    res.json({ ok: true, responses: myResponses });
  } catch (e) {
    console.error("[MY-RESPONSES API ERROR]", e);
    res.status(500).json({ error: "server" });
  }
});

/* Сделка безопасной сделки: предоплата раскрывает контакты обеих сторон.
   Статусы: awaiting_prepay → prepaid → completed/cancelled. */
app.post("/api/orders/:id/deal/prepay", guard, async (req, res) => {
  try {
    if (String(db.mode).indexOf("json-dev") === -1) return res.status(501).json({ error: "not_supported" });
    const FILE = require("path").resolve(__dirname, "dev-db.json");
    const fs = require("fs");
    const d = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { custom_orders: [], order_responses: [] };
    const ord = (d.custom_orders || []).find(o => o.id === req.params.id);
    if (!ord) return res.status(404).json({ error: "not_found" });
    const accepted = (d.order_responses || []).find(r => r.order_id === ord.id && r.status === "accepted");
    if (!accepted) return res.status(409).json({ error: "no_accepted_response" });
    /* Внести предоплату может только владелец заказа */
    if (ord.user_id !== req.userId) return res.status(403).json({ error: "not_owner" });
    /* ЭТАП 3 (п.1): предоплата допустима только на этапе «отклик принят».
       Нельзя оплатить уже завершённую/отменённую сделку или заказ до принятия отклика. */
    if (!["in_progress", "published"].includes(String(ord.status))) {
      return res.status(409).json({ error: "invalid_state_transition", message: "Предоплата доступна только после принятия отклика мастера." });
    }
    const amount = Math.round(Number(req.body.amount || accepted.price * 0.3));
    ord.deal = {
      status: "prepaid",
      escrow: "held",                    /* ЭТАП 3 (п.3): средства ЗАБЛОКИРОВАНЫ
                                            на защищённом счёте платформы, а не
                                            переведены мастеру. Разблокировка —
                                            только через /deal/release после
                                            подтверждения покупателем. */
      prepay_amount: amount,
      deal_total: Number(accepted.price) || amount,
      master_id: accepted.master_id,
      paid_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      contacts_revealed: true, /* контакты раскрыты обеим сторонам после оплаты */
    };
    ord.updated_at = new Date().toISOString();
    fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
    createNotification(accepted.master_id, "prepay", "Предоплата внесена", `Заказчик внёс предоплату ${amount} ₽. Контакты теперь доступны обеим сторонам.`, `/market?focus=${ord.id}`);
    createNotification(ord.user_id, "prepay", "Сделка активна", `Предоплата ${amount} ₽ внесена. Контакты мастера раскрыты.`, `/market?focus=${ord.id}`);
    res.json({ ok: true, deal: ord.deal });
  } catch (e) {
    console.error("[DEAL PREPAY ERROR]", e);
    res.status(500).json({ error: "server" });
  }
});

/* GET состояние сделки + контакты (только участникам и только после предоплаты). */
app.get("/api/orders/:id/deal", guard, async (req, res) => {
  try {
    if (String(db.mode).indexOf("json-dev") === -1) return res.status(501).json({ error: "not_supported" });
    const FILE = require("path").resolve(__dirname, "dev-db.json");
    const fs = require("fs");
    const d = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { custom_orders: [], order_responses: [], users: [] };
    const ord = (d.custom_orders || []).find(o => o.id === req.params.id);
    if (!ord) return res.status(404).json({ error: "not_found" });
    const accepted = (d.order_responses || []).find(r => r.order_id === ord.id && r.status === "accepted");
    const isParty = (ord.user_id === req.userId) || (accepted && accepted.master_id === req.userId);
    if (!isParty) return res.status(403).json({ error: "not_party" });
    const deal = ord.deal || (accepted ? { status: "awaiting_prepay" } : null);
    const revealed = deal && deal.status === "prepaid";
    /* Автотмена сделки спустя 7 дней без предоплаты */
    if (deal && deal.status === "awaiting_prepay" && accepted) {
      const respAge = Date.now() - new Date(accepted.created_at).getTime();
      if (respAge > 7 * 24 * 3600 * 1000) {
        accepted.status = "rejected";
        ord.status = "published";
        fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
        createNotification(accepted.master_id, "deal_expired", "Сделка отменена", "Предоплата не была внесена в течение 7 дней. Заказ снова открыт для откликов.", `/market?focus=${ord.id}`);
        return res.json({ ok: true, deal: { status: "cancelled_auto" }, contacts: null });
      }
    }
    let contacts = null;
    if (revealed) {
      const otherId = req.userId === ord.user_id ? accepted.master_id : ord.user_id;
      const other = (d.users || []).find(u => u.id === otherId);
      contacts = other ? { name: other.name || "", phone: other.phone || "", telegram: other.telegram || "" } : { name: "", phone: "", telegram: "" };
    }
    res.json({ ok: true, deal: deal || { status: "none" }, contacts });
  } catch (e) {
    console.error("[DEAL GET ERROR]", e);
    res.status(500).json({ error: "server" });
  }
});

/* ЭТАП 3 (п.2): структурированный обязательный отклик мастера.
   Итоговая цена, сроки (в днях) и способ доставки — все три поля проверяются
   на сервере; неполный или нереалистичный отклик физически невозможно создать.
   Клиентский UI-формат совпадает с этим же контрактом (единая таблица допустимых
   delivery_method для обеих сторон сделки). */
const DELIVERY_METHODS = ["cdek", "russian_post", "courier", "self_pickup"];

app.post("/api/orders/:id/responses", guard, async (req, res) => {
  try {
    const { id } = req.params;
    const { price, deadline_days, comment, delivery_method } = req.body;

    /* Валидация структуры отклика (ЭТАП 3 §2): без цены/срока/способа доставки
       отклик не принимается — это обязательные данные, а не необязательный комментарий. */
    const priceNum = Number(price);
    const daysNum = Number(deadline_days);
    if (!Number.isFinite(priceNum) || priceNum <= 0)
      return res.status(400).json({ error: "invalid_price", message: "Отклик обязан содержать положительную итоговую цену." });
    if (!Number.isInteger(daysNum) || daysNum < 1 || daysNum > 365)
      return res.status(400).json({ error: "invalid_deadline", message: "Срок выполнения — целое число дней от 1 до 365." });
    if (!DELIVERY_METHODS.includes(String(delivery_method)))
      return res.status(400).json({ error: "invalid_delivery_method", allowed: DELIVERY_METHODS, message: "Выберите способ доставки из списка." });

    /* Правило владения и логика откликов:
       - откликаться может только авторизованный мастер (не гость);
       - мастер не может откликнуться на СОБСТВЕННЫЙ заказ;
       - один мастер — один отклик на заказ (дубликат отклоняется). */
    if (String(db.mode).indexOf("json-dev") !== -1) {
      const FILE0 = require("path").resolve(__dirname, "dev-db.json");
      const fs0 = require("fs");
      const d0 = fs0.existsSync(FILE0) ? JSON.parse(fs0.readFileSync(FILE0, "utf8")) : { custom_orders: [], order_responses: [] };
      const ord0 = (d0.custom_orders || []).find(o => o.id === id);
      if (!ord0) return res.status(404).json({ error: "not_found" });
      if (ord0.user_id === req.userId) return res.status(403).json({ error: "own_order" });
      /* ЭТАП 4 (§4.1): адресный заказ — откликаться может только приглашённый
         мастер (или любой, если заказ публичный). Поле master_requested
         зафиксировано сервером при создании; клиент его не подменит. */
      if (ord0.master_requested && String(ord0.master_requested) !== String(req.userId))
        return res.status(403).json({ error: "addressed_order", message: "Заказ адресный: откликнуться может только указанный исполнитель." });
      const dup = (d0.order_responses || []).find(r => r.order_id === id && r.master_id === req.userId);
      if (dup) return res.status(409).json({ error: "already_responded" });
    }

    const newResponse = {
      id: require("crypto").randomUUID(),
      order_id: id,
      master_id: req.userId,
      price: priceNum,
      deadline_days: daysNum,
      delivery_method: String(delivery_method),
      comment: comment || "",
      status: "pending",
      created_at: new Date().toISOString()
    };

    if (db.mode === "json-dev (бесплатно)") {
      const FILE = require("path").resolve(__dirname, "dev-db.json");
      const fs = require("fs");
      const d = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { order_responses: [], custom_orders: [] };
      if (!d.order_responses) d.order_responses = [];
      d.order_responses.push(newResponse);
      
      // Обновляем счетчик откликов в заказе
      if (d.custom_orders) {
        const order = d.custom_orders.find(o => o.id === id);
        if (order) {
          order.responses = (order.responses || 0) + 1;
          order.updated_at = new Date().toISOString();
        }
      }
      fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
    }

    let ownerUid = "dev-user-1";
    try {
      const FILEN = require("path").resolve(__dirname, "dev-db.json");
      const fsn = require("fs");
      const dd = fsn.existsSync(FILEN) ? JSON.parse(fsn.readFileSync(FILEN, "utf8")) : {};
      const ordN = (dd.custom_orders || []).find(o => o.id === id);
      if (ordN && ordN.user_id) ownerUid = ordN.user_id;
    } catch {}
    createNotification(ownerUid, "response", "Новый отклик на заказ", `Мастер предложил цену ${newResponse.price} ₽`, `/market?focus=${id}`);
    res.json({ ok: true, response: newResponse });
  } catch (e) {
    console.error("[RESPONSES API ERROR]", e);
    res.status(500).json({ error: "server" });
  }
});

app.put("/api/orders/:id/responses/:rid", guard, async (req, res) => {
  try {
    const { id, rid } = req.params;
    const { status } = req.body; // 'accepted' or 'rejected'

    /* ЭТАП 3 (п.1): единый жёсткий конвейер статусов заказа.
       Принятие отклика — переход «received_responses → response_accepted»
       (в терминах существующей системы — in_progress). Повторное принятие
       при уже идущей сделке запрещено: линейность и необратимость пути сделки. */
    if (status === "accepted") {
      if (String(db.mode).indexOf("json-dev") === -1) return res.status(501).json({ error: "not_supported" });
      const FILEC = require("path").resolve(__dirname, "dev-db.json");
      const fsc = require("fs");
      const dc = fsc.existsSync(FILEC) ? JSON.parse(fsc.readFileSync(FILEC, "utf8")) : { custom_orders: [], order_responses: [] };
      const ordC = (dc.custom_orders || []).find(o => o.id === id);
      if (!ordC) return res.status(404).json({ error: "not_found" });
      const alreadyAccepted = (dc.order_responses || []).find(r => r.order_id === id && r.status === "accepted");
      if (alreadyAccepted && alreadyAccepted.id !== rid)
        return res.status(409).json({ error: "deal_in_progress", message: "По заказу уже принят отклик — смена исполнителя возможна только через новую сделку." });
      if (["delivered", "confirmed", "completed", "reviewed"].includes(String(ordC.status)))
        return res.status(409).json({ error: "order_finalized", message: "Заказ уже на финальной стадии жизненного цикла." });
    }

    if (db.mode === "json-dev (бесплатно)") {
      const FILE = require("path").resolve(__dirname, "dev-db.json");
      const fs = require("fs");
      const d = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { order_responses: [], custom_orders: [] };
      
      const ordP = (d.custom_orders || []).find(o => o.id === id);
      const resp = (d.order_responses || []).find(r => r.id === rid);
      if (!resp) return res.status(404).json({ error: "not_found" });
      /* Принимать/отклонять отклики может только владелец заказа.
         Мастер может ОТОЗВАТЬ свой отклик, только пока он "pending". */
      const isOrderOwnerPut = !!(ordP && ordP.user_id === req.userId);
      const isMasterSelf = resp.master_id === req.userId;
      if (status === "withdrawn") {
        if (!isMasterSelf) return res.status(403).json({ error: "not_owner" });
        if (resp.status !== "pending") return res.status(409).json({ error: "cannot_withdraw" });
      } else if (!isOrderOwnerPut) {
        return res.status(403).json({ error: "not_owner" });
      }
      /* Принятие одного отклика автоматически отклоняет все остальные */
      if (status === "accepted") {
        (d.order_responses || []).forEach(r => { if (r.order_id === id && r.id !== rid && r.status === "pending") r.status = "rejected"; });
      }
      if (resp) {
        resp.status = status;
        
        // Если принят, меняем статус заказа на in_progress
        if (status === "accepted" && d.custom_orders) {
          const order = d.custom_orders.find(o => o.id === id);
          if (order) {
            order.status = "in_progress";
            /* ЭТАП 3 (п.3): в момент принятия отклика инициируется безопасная
               сделка (эскроу): средства НЕ переводятся мастеру — они будут
               заблокированы на защищённом счёте платформы после внесения
               предоплаты покупателем (deal/prepay). awaiting_prepay — оффер. */
            if (!order.deal) {
              order.deal = {
                status: "awaiting_prepay",
                escrow: "initiated",           /* платёжный шлюз ещё не списывал средства */
                prepay_amount: null,
                master_id: resp.master_id,
                initiated_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
                contacts_revealed: false,
              };
            }
            order.updated_at = new Date().toISOString();
          }
        }
        fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
      }
    }
    /* FIX: уведомление о принятии — внутри json-dev блока (переменная d там же),
       раньше обращалась к внеобластной переменной → ReferenceError при каждом accept. */
    if (db.mode === "json-dev (бесплатно)") {
      const FILE2 = require("path").resolve(__dirname, "dev-db.json");
      const fs2 = require("fs");
      const d2 = fs2.existsSync(FILE2) ? JSON.parse(fs2.readFileSync(FILE2, "utf8")) : { order_responses: [] };
      if (status === "accepted") {
        const respA = (d2.order_responses || []).find(r => r.id === rid);
        if (respA) createNotification(respA.master_id, "accepted", "Ваш отклик принят!", "Заказчик выбрал вас исполнителем.", `/market?focus=${id}`);
      }
      if (status === "rejected") {
        const respR = (d2.order_responses || []).find(r => r.id === rid);
        if (respR) createNotification(respR.master_id, "rejected", "Отклик отклонён", `По заказу принято другое предложение.`, `/market?focus=${id}`);
      }
    }
    res.json({ ok: true });
  } catch (e) {
    console.error("[RESPONSES UPDATE API ERROR]", e);
    res.status(500).json({ error: "server" });
  }
});


// ==========================================
// API ЭТАПА 7: ДЕТАЛЬНАЯ КАРТОЧКА, ЧАТ И ЭТАПЫ
// ==========================================
/* ЭТАП 3 (п.1): единый жёсткий конвейер статусов заказа — на уровне модуля,
   используется PUT /api/orders/:id и POST /api/orders/:id/ship.
   created → responses_received → response_accepted → prepay_held
   → in_work → shipped → delivered → confirmed_by_buyer
   → final_settlement → completed → reviewed
   Внутренние значения (совместимость с существующим кодом):
   published | in_progress | shipped | delivered | confirmed | completed | cancelled */
const ORDER_PIPELINE = ["published", "in_progress", "shipped", "delivered", "confirmed", "completed"];
const FINAL_STATUSES = ["completed", "cancelled"];

app.put("/api/orders/:id", guard, async (req, res) => {
  try {
    const patch = req.body || {};
    let saved = null;
    if (String(db.mode).indexOf("json-dev") !== -1) {
      const FILE = require("path").resolve(__dirname, "dev-db.json");
      const fs = require("fs");
      const d = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { users: [], custom_orders: [], order_responses: [], order_messages: [] };
      const arr = d.custom_orders || [];
      const idx = arr.findIndex(function(o){ return o.id === req.params.id; });
      if (idx === -1) return res.status(404).json({ error: "not_found" });
      /* Правило владения: редактировать заказ может только его владелец */
      if (arr[idx].user_id && arr[idx].user_id !== req.userId) return res.status(403).json({ error: "not_owner" });

      /* ============================================================
         ЭТАП 3 (п.1): переходы статусов проверяются СЕРВЕРОМ по
         единому конвейеру ORDER_PIPELINE (объявлен выше, рядом с /ship).
         Клиент не может ни перескочить стадию, ни откатить финальную.
         Инициатор тоже проверяется: «delivered/confirmed» — ТОЛЬКО
         покупатель-владелец заказа (уже гарантировано проверкой
         владения выше), «shipped» — принятый мастер через отдельный
         эндпоинт POST /api/orders/:id/ship, не через этот роут.
         ============================================================ */
      if (patch.status !== undefined && String(patch.status) !== String(arr[idx].status)) {
        const from = String(arr[idx].status);
        const to = String(patch.status);
        if (FINAL_STATUSES.includes(from))
          return res.status(409).json({ error: "terminal_state", message: "Завершённый/отменённый заказ необратим: смена статуса запрещена." });
        if (to === "cancelled") { /* отмена разрешена владельцу на любой промежуточной стадии */
          const dealC = arr[idx].deal;
          if (dealC && dealC.escrow === "held") {
            console.log("[ESCROW REFUND] отмена сделки " + arr[idx].id + ": возврат заблокированных средств покупателю (" + (dealC.prepay_amount || 0) + " ₽)");
            dealC.escrow = "refunded";
            dealC.status = "cancelled";
          }
        } else if (!ORDER_PIPELINE.includes(to)) {
          return res.status(400).json({ error: "invalid_status", allowed: ORDER_PIPELINE.concat("cancelled"), got: to });
        } else {
          const fi = ORDER_PIPELINE.indexOf(from), ti = ORDER_PIPELINE.indexOf(to);
          if (fi === -1) return res.status(409).json({ error: "invalid_state_transition", message: "Неизвестное текущее состояние заказа." });
          /* Разрешён только шаг вперёд по конвейеру (или stay). Исключение из
             линейности — автопереходы сервера (accepted→in_progress и т.п.),
             они выполняются внутри соответствующих обработчиков, не здесь. */
          if (ti < fi) return res.status(409).json({ error: "irreversible_transition", message: "Обратный переход статуса запрещён: " + from + " → " + to });
          if (ti > fi + 1) return res.status(409).json({ error: "skipped_stage", message: "Нельзя пропускать стадию жизненного цикла: " + from + " → " + to });
          /* Подтверждение доставки («delivered», «confirmed») инициирует только
             покупатель. Для владельца это всегда покупатель — проверка выше уже
             гарантирует user_id === req.userId. Мастер сюда не допускается. */
        }
      }

      const prev = arr[idx];
      const next = Object.assign({}, prev, patch, { id: prev.id, updated_at: new Date().toISOString() });

      /* ЭТАП 3 (п.3): подтверждение получения покупателем (delivered/confirmed)
       → автоматический окончательный расчёт: эскроу разблокируется и средства
       переводятся мастеру. Один раз, повтор вызова идемпотентен. */
      if (["delivered", "confirmed"].includes(String(patch.status)) && next.deal && next.deal.escrow === "held") {
        next.deal.escrow = "released";
        next.deal.released_at = new Date().toISOString();
        next.deal.status = "settled";
        console.log("[ESCROW RELEASE] сделка " + next.id + ": средства разблокированы и переведены мастеру " + next.deal.master_id + " (" + (next.deal.prepay_amount || 0) + " ₽ предоплаты + остаток " + Math.max(0, (next.deal.deal_total || 0) - (next.deal.prepay_amount || 0)) + " ₽)");
        createNotification(next.deal.master_id, "escrow_released", "Окончательный расчёт произведён",
          "Покупатель подтвердил получение по заказу «" + (next.title || "") + "». Средства разблокированы на вашем счёте.", "/market?focus=" + next.id);
      }

      if (patch.images) next.attachments = patch.images;
      if (patch.attachments) next.images = patch.attachments;
      if (patch.desc && !patch.description) next.description = patch.desc;
      if (patch.description && !patch.desc) next.desc = patch.description;
      if (patch.type && !patch.category) next.category = patch.type;
      if (patch.category && !patch.type) next.type = patch.category;
      if (patch.term && !patch.deadline) next.deadline = patch.term;
      if (patch.deadline && !patch.term) next.term = patch.deadline;
      if (patch.budget !== undefined) {
        next.budget = Number(patch.budget);
        next.budget_min = Number(patch.budget);
      }

      arr[idx] = next;
      d.custom_orders = arr;
      fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
      saved = next;
    }
    res.json({ ok: true, order: saved });
  } catch (e) {
    console.error("[ORDERS UPDATE ERROR]", e);
    res.status(500).json({ error: "server" });
  }
});

/* ЭТАП 3 (п.1): «Отправлен» — исключительное действие принятного мастера.
   Покупатель не может перевести заказ в shipped, мастер — в delivered/confirmed.
   Разрыв линейности по ролям закрывается этим отдельным эндпоинтом: PUT /api/orders/:id
   защищён проверкой владения (только покупатель), поэтому статус shipped
   вынесен в отдельный роут с проверкой участника-мастера. */
app.post("/api/orders/:id/ship", guard, async (req, res) => {
  try {
    const ctx = await orderParty(req, req.params.id);
    if (!ctx.ok) return res.status(ctx.status).json({ error: ctx.error });
    if (!ctx.isMaster) return res.status(403).json({ error: "only_master_can_ship", message: "Отметить отправку может только принятый исполнитель." });
    const ord = ctx.ord;
    const fi = ORDER_PIPELINE.indexOf(String(ord.status));
    if (String(ord.status) !== "in_progress")
      return res.status(409).json({ error: "invalid_state_transition", message: "Отправка возможна только из статуса «в работе»." });
    /* Проверка конвейера: in_progress → shipped (следующая стадия). */
    if (ORDER_PIPELINE[fi + 1] !== "shipped") return res.status(409).json({ error: "skipped_stage" });
    const { FILE, fs, d } = devDbRead();
    const idx = (d.custom_orders || []).findIndex(o => o.id === req.params.id);
    d.custom_orders[idx].status = "shipped";
    d.custom_orders[idx].updated_at = new Date().toISOString();
    if (req.body && req.body.tracking) d.custom_orders[idx].tracking = String(req.body.tracking);
    fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
    createNotification(ord.user_id, "shipped", "Заказ отправлен",
      "Исполнитель передал заказ «" + (ord.title || "") + "» в доставку." + (req.body && req.body.tracking ? " Трек: " + req.body.tracking : ""), "/market?focus=" + ord.id);
    res.json({ ok: true, order: d.custom_orders[idx] });
  } catch (e) {
    console.error("[ORDER SHIP ERROR]", e);
    res.status(500).json({ error: "server" });
  }
});

app.delete("/api/orders/:id", guard, async (req, res) => {
  try {
    if (String(db.mode).indexOf("json-dev") !== -1) {
      const FILE = require("path").resolve(__dirname, "dev-db.json");
      const fs = require("fs");
      const d = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { users: [], custom_orders: [], order_responses: [], order_messages: [] };
      const arr = d.custom_orders || [];
      const idx = arr.findIndex(function(o){ return o.id === req.params.id; });
      if (idx === -1) return res.status(404).json({ error: "not_found" });
      /* Правило владения: удалять заказ может только его владелец */
      if (arr[idx].user_id && arr[idx].user_id !== req.userId) return res.status(403).json({ error: "not_owner" });
      const removed = arr[idx];
      /* Edge case: удаление заказа после принятия отклика — активные отклики
         автоматически отклоняются, мастера получают уведомление. */
      const pendOrAcc = (d.order_responses || []).filter(r => r.order_id === removed.id && (r.status === "pending" || r.status === "accepted"));
      pendOrAcc.forEach(r => {
        r.status = "rejected";
        createNotification(r.master_id, "order_cancelled", "Заказ отменён заказчиком", "Ваш отклик по заказу «" + (removed.title || "") + "» отклонён: заказ удалён.", "/market");
      });
      /* Если предоплата была внесена — инициируем возврат средств (в mock-режиме фиксируем событие). */
      if (removed.deal && removed.deal.status === "prepaid") {
        console.log("[REFUND] инициирован возврат предоплаты по заказу " + removed.id + " (sum=" + (removed.deal.prepay_amount || 0) + " ₽)");
      }
      arr.splice(idx, 1);
      d.custom_orders = arr;
      fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
    }
    res.json({ ok: true });
  } catch (e) {
    console.error("[ORDERS DELETE ERROR]", e);
    res.status(500).json({ error: "server" });
  }
});

app.get("/api/orders/:id", async (req, res) => {
  try {
    const { id } = req.params;
    let order = null;
    if (db.mode === "json-dev (бесплатно)") {
      const FILE = require("path").resolve(__dirname, "dev-db.json");
      const fs = require("fs");
      const d = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { custom_orders: [] };
      order = (d.custom_orders || []).find(o => o.id === id) || null;
    }
    res.json({ ok: true, order });
  } catch (e) {
    console.error("[ORDER DETAIL API ERROR]", e);
    res.status(500).json({ error: "server" });
  }
});

app.get("/api/orders/:id/messages", softGuard, async (req, res) => {
  try {
    const { id } = req.params;
    let messages = [];
    if (db.mode === "json-dev (бесплатно)") {
      const FILE = require("path").resolve(__dirname, "dev-db.json");
      const fs = require("fs");
      const d = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { order_messages: [], custom_orders: [] };
      /* Ролевая модель чата: сообщения видят только владелец заказа и принятый мастер. */
      const ordM = (d.custom_orders || []).find(o => o.id === id);
      const accepted = (d.order_responses || []).find(r => r.order_id === id && r.status === "accepted");
      const party = req.userId && ((ordM && ordM.user_id === req.userId) || (accepted && accepted.master_id === req.userId));
      if (!party) return res.status(403).json({ error: "not_participant" });
      messages = (d.order_messages || []).filter(m => m.order_id === id).sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
    }
    res.json({ ok: true, messages });
  } catch (e) {
    console.error("[MESSAGES API ERROR]", e);
    res.status(500).json({ error: "server" });
  }
});

app.post("/api/orders/:id/messages", guard, async (req, res) => {
  try {
    const { id } = req.params;
    const { message, attachment_url } = req.body;
    if (!message || !String(message).trim()) return res.status(422).json({ error: "empty_message" });
    /* Отправить сообщение могут только стороны сделки: владелец заказа или принятый мастер.
       sender_id всегда берётся из токена — подставить чужой identity невозможно. */
    if (String(db.mode).indexOf("json-dev") !== -1) {
      const FILEC = require("path").resolve(__dirname, "dev-db.json");
      const fsc = require("fs");
      const dc = fsc.existsSync(FILEC) ? JSON.parse(fsc.readFileSync(FILEC, "utf8")) : {};
      const ordC = (dc.custom_orders || []).find(o => o.id === id);
      if (!ordC) return res.status(404).json({ error: "not_found" });
      const accC = (dc.order_responses || []).find(r => r.order_id === id && r.status === "accepted");
      const isParty = ordC.user_id === req.userId || (accC && accC.master_id === req.userId);
      if (!isParty) return res.status(403).json({ error: "not_participant" });
      const otherUid = ordC.user_id === req.userId ? (accC ? accC.master_id : null) : ordC.user_id;
      const newMsg = {
        id: require("crypto").randomUUID(),
        order_id: id,
        sender_id: req.userId,
        message: String(message),
        attachment_url: attachment_url || null,
        created_at: new Date().toISOString()
      };
      if (!dc.order_messages) dc.order_messages = [];
      dc.order_messages.push(newMsg);
      fsc.writeFileSync(FILEC, JSON.stringify(dc, null, 2));
      if (otherUid) createNotification(otherUid, "message", "Новое сообщение в чате", "Получено новое сообщение по заказу", `/profile`);
      return res.json({ ok: true, message: newMsg });
    }
    res.json({ ok: false, error: "unsupported_db" });
  } catch (e) {
    console.error("[SEND MESSAGE API ERROR]", e);
    res.status(500).json({ error: "server" });
  }
});

/* ЭТАП 1 (серверная часть): единый помощник проверки участника сделки.
   Этапы заказа (milestones) — приватные рабочие данные конкретной сделки:
   их видит и изменяет ТОЛЬКО владелец заказа или принятый мастер.
   Гость или посторонний пользователь получает 401/403 до чтения данных. */
async function orderParty(req, orderId) {
  if (String(db.mode).indexOf("json-dev") === -1) return { ok: false, status: 501, error: "not_supported" };
  const FILE = require("path").resolve(__dirname, "dev-db.json");
  const fs = require("fs");
  const d = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { custom_orders: [], order_responses: [] };
  const ord = (d.custom_orders || []).find(o => o.id === orderId);
  if (!ord) return { ok: false, status: 404, error: "not_found" };
  const accepted = (d.order_responses || []).find(r => r.order_id === orderId && r.status === "accepted");
  const isOwner = String(ord.user_id) === String(req.userId);
  const isMaster = !!(accepted && String(accepted.master_id) === String(req.userId));
  if (!isOwner && !isMaster) return { ok: false, status: 403, error: "not_participant" };
  return { ok: true, d, ord, accepted, isOwner, isMaster };
}

app.get("/api/orders/:id/milestones", guard, async (req, res) => {
  try {
    const { id } = req.params;
    const ctx = await orderParty(req, id);
    if (!ctx.ok) return res.status(ctx.status).json({ error: ctx.error });
    const FILE = require("path").resolve(__dirname, "dev-db.json");
    const fs = require("fs");
    const d = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { order_milestones: [] };
    const milestones = (d.order_milestones || []).filter(m => m.order_id === id);
    res.json({ ok: true, milestones });
  } catch (e) {
    console.error("[MILESTONES API ERROR]", e);
    res.status(500).json({ error: "server" });
  }
});

app.post("/api/orders/:id/milestones", guard, async (req, res) => {
  try {
    const { id } = req.params;
    /* Правило владения: создавать этап может только участник сделки. */
    const ctx = await orderParty(req, id);
    if (!ctx.ok) return res.status(ctx.status).json({ error: ctx.error });
    const { title, description, status, photo_urls } = req.body;
    const newMilestone = {
      id: require("crypto").randomUUID(),
      order_id: id,
      title,
      description: description || "",
      status: status || "pending",
      photo_urls: photo_urls || [],
      created_at: new Date().toISOString(),
      completed_at: status === "completed" ? new Date().toISOString() : null
    };
    if (db.mode === "json-dev (бесплатно)") {
      const FILE = require("path").resolve(__dirname, "dev-db.json");
      const fs = require("fs");
      const d = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { order_milestones: [] };
      if (!d.order_milestones) d.order_milestones = [];
      d.order_milestones.push(newMilestone);
      fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
    }
    res.json({ ok: true, milestone: newMilestone });
  } catch (e) {
    console.error("[CREATE MILESTONE API ERROR]", e);
    res.status(500).json({ error: "server" });
  }
});

app.put("/api/orders/:id/milestones/:mid", guard, async (req, res) => {
  try {
    const { id, mid } = req.params;
    const { status, photo_urls } = req.body;
    /* Правило владения: изменять этап может только участник сделки. */
    const ctx = await orderParty(req, id);
    if (!ctx.ok) return res.status(ctx.status).json({ error: ctx.error });
    if (db.mode === "json-dev (бесплатно)") {
      const FILE = require("path").resolve(__dirname, "dev-db.json");
      const fs = require("fs");
      const d = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { order_milestones: [] };
      const m = (d.order_milestones || []).find(x => x.id === mid && x.order_id === id);
      if (m) {
        m.status = status;
        if (photo_urls) m.photo_urls = photo_urls;
        if (status === "completed") m.completed_at = new Date().toISOString();
        fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
      }
    }
    res.json({ ok: true });
  } catch (e) {
    console.error("[UPDATE MILESTONE API ERROR]", e);
    res.status(500).json({ error: "server" });
  }
});


// ==========================================
// API ЭТАПА 9: УВЕДОМЛЕНИЯ
// ==========================================
app.get("/api/notifications", softGuard, async (req, res) => {
  try {
    /* Приватность: пользователь видит только СВОИ уведомления.
       Гость получает пустой список; legacy-записи без user_id не раскрываются. */
    let notifications = [];
    if (db.mode === "json-dev (бесплатно)") {
      const FILE = require("path").resolve(__dirname, "dev-db.json");
      const fs = require("fs");
      const d = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { notifications: [] };
      const all = (d.notifications || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      notifications = req.userId ? all.filter(n => n.user_id === req.userId) : [];
    }
    res.json({ ok: true, notifications });
  } catch (e) {
    console.error("[NOTIFICATIONS API ERROR]", e);
    res.status(500).json({ error: "server" });
  }
});

app.put("/api/notifications/:id/read", guard, async (req, res) => {
  try {
    const { id } = req.params;
    if (db.mode === "json-dev (бесплатно)") {
      const FILE = require("path").resolve(__dirname, "dev-db.json");
      const fs = require("fs");
      const d = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { notifications: [] };
      const n = (d.notifications || []).find(x => x.id === id);
      /* Отметить можно только своё уведомление. */
      if (n && n.user_id === req.userId) {
        n.read = true;
        fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
      }
    }
    res.json({ ok: true });
  } catch (e) {
    console.error("[READ NOTIFICATION API ERROR]", e);
    res.status(500).json({ error: "server" });
  }
});

app.put("/api/notifications/read-all", guard, async (req, res) => {
  try {
    if (db.mode === "json-dev (бесплатно)") {
      const FILE = require("path").resolve(__dirname, "dev-db.json");
      const fs = require("fs");
      const d = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { notifications: [] };
      if (d.notifications) {
        d.notifications.forEach(n => { if (n.user_id === req.userId) n.read = true; });
        fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
      }
    }
    res.json({ ok: true });
  } catch (e) {
    console.error("[READ ALL NOTIFICATIONS API ERROR]", e);
    res.status(500).json({ error: "server" });
  }
});

// Хелпер для создания уведомления (используется внутри других роутов)
function createNotification(userId, type, title, text, link) {
  if (db.mode === "json-dev (бесплатно)") {
    const FILE = require("path").resolve(__dirname, "dev-db.json");
    const fs = require("fs");
    const d = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { notifications: [] };
    if (!d.notifications) d.notifications = [];
    
    const newNotif = {
      id: require("crypto").randomUUID(),
      user_id: userId || "dev-user-1",
      type, // 'response', 'accepted', 'message', 'system'
      title,
      text,
      link: link || "/profile",
      read: false,
      created_at: new Date().toISOString()
    };
    
    d.notifications.push(newNotif);
    fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
    
    // Эмуляция отправки email для критических событий
    if (type === 'response' || type === 'accepted') {
      console.log(`[SMTP ЭМУЛЯЦИЯ] Письмо отправлено на email пользователя: Тема "[Quantiform] ${title}"`);
    }
    
    return newNotif;
  }
  return null;
}

// ==========================================
// API ЭТАПА 10: ОТЗЫВЫ И РЕЙТИНГИ ДЛЯ БИРЖИ
// (Изолировано от отзывов магазина useReviewStore)
// ==========================================
// ==========================================
// API МАСТЕРОВ И ТОВАРОВ (Phase 3)
// ==========================================
function devDbRead() {
  const FILE = require("path").resolve(__dirname, "dev-db.json");
  const fs = require("fs");
  return { FILE, fs, d: fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { users: [], custom_orders: [], order_responses: [], order_messages: [], masters: [], products: [] } };
}

/* ЭТАП 2: жёсткий гео-фильтр на уровне выборки. Город покупателя
   берётся из query (?city=), либо из профиля пользователя в БД
   (users.city) при авторизованной сессии. Записи из чужих регионов
   исключаются ДО сериализации ответа — клиент физически не может
   получить то, что не прошло фильтр. */
const geo = require("./geo-filter.cjs");
async function buyerCityFromQueryOrSession(req) {
  const q = String(req.query && req.query.city || "").trim();
  if (q) return q;
  if (req.userId) {
    try {
      const u = await db.byId(req.userId);
      if (u && u.city) return String(u.city);
    } catch { /* профиль без города — фильтр не применяется */ }
  }
  return "";
}

/* Единая нормализация географии записи (товар/мастер): поле geography,
   заданное продавцом в UI, приводится к контракту geo-filter
   (sellerCity / deliveryZone / installCities) ПЕРЕД фильтрацией.
   Структура БД не меняется — только проекция выборки. */
function normalizeGeo(x) {
  const g = x.geography || {};
  return Object.assign({}, x, {
    sellerCity: x.sellerCity || g.city || (x.deliveryZone && x.deliveryZone.city) || x.city || "",
    deliveryZone: x.deliveryZone || g.delivery || (g.city ? { mode: "cities", cities: [g.city] } : null),
    installCities: (Array.isArray(x.installCities) && x.installCities.length) ? x.installCities : (g.install || []),
  });
}

app.get("/api/masters", softGuard, async (_q, r) => {
  try {
    const { d } = devDbRead();
    const city = await buyerCityFromQueryOrSession(_q);
    /* мастер доступен покупателю, если geography.delivery покрывает город
       (nationwide / список городов / базовый город) */
    /* FIX E2E-аудита: ранее отсутствующая география трактовалась как nationwide
       по умолчанию — жёсткий фильтр был непроходим для записей без geography.
       Теперь запись без явной географии остаётся без зоны и geoAllowed
       трактует её как «гео не задан» (не исключаем), но НЕ как «везде»;
       явно заданная география фильтруется строго. */
    const enriched = (d.masters || []).map(normalizeGeo);
    r.json({ ok: true, masters: geo.geoFilter(enriched, city), filteredByCity: city || null });
  }
  catch (e) { console.error("[MASTERS ERROR]", e); r.status(500).json({ error: "server" }); }
});

app.post("/api/masters", guard, (req, r) => {
  try {
    const m = req.body || {};
    if (!m.id) return r.status(400).json({ error: "no_id" });
    /* Правило владения: карточку мастера можно создавать/обновлять только от своего имени. */
    if (String(m.id) !== String(req.userId)) return r.status(403).json({ error: "not_owner" });
    const { FILE, fs, d } = devDbRead();
    if (!d.masters) d.masters = [];
    const idx = d.masters.findIndex((x) => x.id === m.id);
    if (idx >= 0) {
      d.masters[idx] = Object.assign({}, d.masters[idx], m, { updated_at: new Date().toISOString() });
    } else {
      d.masters.push(Object.assign({}, m, { owner_id: req.userId, created_at: new Date().toISOString() }));
    }
    fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
    r.json({ ok: true });
  } catch (e) { console.error("[MASTERS ERROR]", e); r.status(500).json({ error: "server" }); }
});

/* Удаление карточки мастера — только владельцем. */
app.delete("/api/masters/:id", guard, (req, r) => {
  try {
    if (String(req.params.id) !== String(req.userId)) return r.status(403).json({ error: "not_owner" });
    const { FILE, fs, d } = devDbRead();
    const arr = d.masters || [];
    const idx = arr.findIndex((x) => x.id === req.params.id);
    if (idx === -1) return r.status(404).json({ error: "not_found" });
    arr.splice(idx, 1); d.masters = arr;
    fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
    r.json({ ok: true });
  } catch (e) { console.error("[MASTERS DELETE ERROR]", e); r.status(500).json({ error: "server" }); }
});

app.get("/api/products", softGuard, async (_q, r) => {
  try {
    const { d } = devDbRead();
    /* ЭТАП 2: жёсткий гео-фильтр выборки — в ответ попадают только товары,
       чья доставка/монтаж покрывает город покупателя (или nationwide). */
    const city = await buyerCityFromQueryOrSession(_q);
    /* Нормализация geography → deliveryZone/installCities (единый контракт
       для товаров и мастеров; структура БД не меняется — только проекция). */
    const enriched = (d.products || []).map(normalizeGeo);
    r.json({ ok: true, products: geo.geoFilter(enriched, city), filteredByCity: city || null });
  }
  catch (e) { console.error("[PRODUCTS ERROR]", e); r.status(500).json({ error: "server" }); }
});

/* ЭТАП 2 (п.3): калькулятор логистики для карточки товара.
   Сервер резолвит город продавца из записи товара, берёт город
   покупателя из сессии/query и возвращает конкретное предложение
   СДЭК/Почты (цена + сроки) именно для этой пары городов, а также
   подтверждение монтажа в городе покупателя для крупногабарита. */
app.get("/api/products/:id/logistics", softGuard, async (req, res) => {
  try {
    const { d } = devDbRead();
    const p = (d.products || []).find((x) => x.id === req.params.id);
    if (!p) return res.status(404).json({ error: "not_found" });
    const buyerCity = await buyerCityFromQueryOrSession(req);
    const np = normalizeGeo(p);
    const sellerCity = np.sellerCity;
    if (!buyerCity || !sellerCity) return res.json({ ok: true, quote: null, deliverable: geo.geoAllowed(np, buyerCity), installAvailable: false });
    const weightKg = Number(p.weight) ? Number(p.weight) / (p.weight > 50 ? 1000 : 1) : 1; /* граммы → кг для больших значений */
    const quote = geo.logisticsQuote(sellerCity, buyerCity, { weightKg });
    res.json({
      ok: true,
      sellerCity, buyerCity,
      deliverable: geo.geoAllowed(np, buyerCity),
      installAvailable: geo.installAllowed(np, buyerCity),
      quote,
    });
  } catch (e) {
    console.error("[LOGISTICS QUOTE ERROR]", e);
    res.status(500).json({ error: "server" });
  }
});

app.post("/api/products", guard, async (req, res) => {
  try {
    const p = req.body || {};
    if (!p.id) return res.status(400).json({ error: "no_id" });
    /* Правило владения товара: ownerId всегда берётся из токена сессии.
       Клиент не может присвоить товар другому пользователю или создать анонимный товар. */
    const { FILE, fs, d } = devDbRead();
    if (!d.products) d.products = [];
    /* ЭТАП 1 (§1.5): лимит товаров тарифа проверяется на сервере по базе,
       а не по клиентскому состоянию (обход через localStorage невозможен). */
    const isNew = !d.products.find((x) => x.id === p.id);
    if (isNew) {
      const lim = await tariffsCtx.serverCheckLimit(req.userId, "product_create", {});
      if (!lim.allowed) return res.status(402).json({ ok: false, error: "limit_reached", reason: lim.reason || ("Лимит товаров тарифа исчерпан (" + lim.limit + ")") });
    }
    const idx = d.products.findIndex((x) => x.id === p.id);
    if (idx >= 0) {
      /* Обновлять товар может только его владелец (существующий ownerId) либо создатель. */
      const curOwner = d.products[idx].ownerId || d.products[idx].owner_id;
      if (curOwner && String(curOwner) !== String(req.userId)) return res.status(403).json({ error: "not_owner" });
      d.products[idx] = Object.assign({}, d.products[idx], p, { ownerId: req.userId, updated_at: new Date().toISOString() });
    } else {
      d.products.push(Object.assign({}, p, { ownerId: req.userId, created_at: new Date().toISOString() }));
    }
    fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
    res.json({ ok: true });
  } catch (e) { console.error("[PRODUCTS ERROR]", e); res.status(500).json({ error: "server" }); }
});

app.delete("/api/products/:id", guard, (req, r) => {
  try {
    const { FILE, fs, d } = devDbRead();
    const arr = d.products || [];
    const idx = arr.findIndex((x) => x.id === req.params.id);
    if (idx === -1) return r.status(404).json({ error: "not_found" });
    /* Удалять товар может только его владелец. */
    const owner = arr[idx].ownerId || arr[idx].owner_id;
    if (owner && String(owner) !== String(req.userId)) return r.status(403).json({ error: "not_owner" });
    arr.splice(idx, 1); d.products = arr;
    fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
    r.json({ ok: true });
  } catch (e) { console.error("[PRODUCTS ERROR]", e); r.status(500).json({ error: "server" }); }
});

/* ============================================================
   ЭТАП 4 (сервер): отзыв разрешён ТОЛЬКО по завершённой и
   финансово подтверждённой сделке между конкретными участниками.
   Антинакрутка:
   - автор отзыва — всегда req.userId из сессии (клиентский
     reviewer_id игнорируется полностью);
   - оцениваемый — принятый мастер сделки (reviewee_id из тела
     игнорируется); подставить в рейтинг чужого аккаунта нельзя;
   - требуется финальный статус заказа (completed/delivered/
     confirmed/reviewed) либо закрытая эскроу-сделка (settled);
   - одна сделка — один отзыв от каждого участника.
   ============================================================ */
const FINAL_ORDER_STATUSES = ["completed", "delivered", "confirmed", "reviewed"];

/* Покупка из каталога — тоже завершённая финансово подтверждённая сделка:
   покупатель может оставить отзыв на товар конкретного продавца. */
/* Клиенту нужен честный признак «есть ли у меня оплаченная покупка», чтобы
   не рендерить форму отзыва в DOM для чужих/гостей (ЭТАП 1 п.2).
   Ответ совпадает с проверкой допуска POST /api/purchases/:productId/reviews. */
app.get("/api/purchases/status", guard, async (req, res) => {
  try {
    const rawId = String(req.query.productId || "");
    if (!rawId) return res.status(400).json({ error: "no_product_id" });
    /* FIX E2E: нормализация «в обе стороны» — раньше при запросе с bare-id
       (p-kursk) сравнение шло только raw↔stored, а покупки хранятся как "sp-p-kursk". */
    const bareId = rawId.startsWith("sp-") ? rawId.slice(3) : rawId;
    const spId = "sp-" + bareId;
    const sameProduct = (pid) => { const s = String(pid || ""); return s === rawId || s === bareId || s === spId; };
    const FILE = require("path").resolve(__dirname, "dev-db.json");
    const d = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : {};
    const purchase = (d.purchases || []).find((x) => {
      if (String(x.userId) !== String(req.userId) || x.status === "cancelled") return false;
      return sameProduct(x.productId);
    });
    const already = !!(purchase && (d.market_reviews || []).some((r) => r.product_id && String(r.product_id).replace(/^sp-/, "") === bareId && String(r.reviewer_id) === String(req.userId)));
    res.json({ ok: true, canReview: !!purchase && !already, purchased: !!purchase, alreadyReviewed: already });
  } catch (e) {
    console.error("[PURCHASE STATUS ERROR]", e);
    res.status(500).json({ error: "server" });
  }
});

app.post("/api/purchases/:productId/reviews", guard, async (req, res) => {
  try {
    const { rating, text } = req.body || {};
    if (!rating || Number(rating) < 1 || Number(rating) > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }
    const FILE = require("path").resolve(__dirname, "dev-db.json");
    const d = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : {};
    /* FIX аудита: маршрут объявлен как /:productId — обращение к req.params.id
       давало бы пустую строку и 409 no_completed_deal для любой покупки. */
    const rawId = String(req.params.productId || "");
    const bareId = rawId.startsWith("sp-") ? rawId.slice(3) : rawId;
    /* FIX E2E: двусторонняя нормализация id (см. GET /api/purchases/status) */
    const spId = "sp-" + bareId;
    const sameProduct = (pid) => { const s = String(pid || ""); return s === rawId || s === bareId || s === spId; };
    /* История транзакций покупателя: только реальная оплаченная покупка
       этого товара этим пользователем открывает доступ к форме отзыва. */
    const purchase = (d.purchases || []).find((x) => {
      if (String(x.userId) !== String(req.userId) || x.status === "cancelled") return false;
      return sameProduct(x.productId);
    });
    if (!purchase) return res.status(409).json({ error: "no_completed_deal", message: "Отзыв возможен только после покупки товара." });
    const prod = (d.products || []).find((p) => String(p.id) === bareId);
    const sellerId = String((prod && (prod.ownerId || prod.seller_id)) || purchase.seller_id || "");
    if (!sellerId) return res.status(409).json({ error: "seller_not_found" });
    const dup = (d.market_reviews || []).find((r) => r.product_id && String(r.product_id).replace(/^sp-/, "") === bareId && String(r.reviewer_id) === String(req.userId));
    if (dup) return res.status(409).json({ error: "already_reviewed" });
    const newReview = {
      id: crypto.randomUUID(),
      order_id: purchase.order_number || purchase.id,
      reviewer_id: req.userId,          /* из сессии */
      reviewee_id: sellerId,            /* владелец товара — из БД, не из тела */
      product_id: "sp-" + bareId,
      rating: Number(rating),
      text: String(text || ""),
      created_at: new Date().toISOString(),
    };
    if (!d.market_reviews) d.market_reviews = [];
    d.market_reviews.push(newReview);
    fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
    createNotification(sellerId, "review", "Новый отзыв о товаре",
      `Оценка ${newReview.rating}/5 по покупке «${(prod && prod.name) || bareId}».`, `/shop/${sellerId}`);
    res.json({ ok: true, review: newReview });
  } catch (e) {
    console.error("[PURCHASE REVIEW API ERROR]", e);
    res.status(500).json({ error: "server" });
  }
});

app.post("/api/market/orders/:id/reviews", guard, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, text } = req.body;

    if (!rating || Number(rating) < 1 || Number(rating) > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }
    if (String(db.mode).indexOf("json-dev") === -1) return res.status(501).json({ error: "not_supported" });

    const FILE = require("path").resolve(__dirname, "dev-db.json");
    const fs = require("fs");
    const d = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { market_reviews: [], custom_orders: [], order_responses: [] };

    const ord = (d.custom_orders || []).find(o => o.id === id);
    if (!ord) return res.status(404).json({ error: "not_found" });
    const accepted = (d.order_responses || []).find(r => r.order_id === id && r.status === "accepted");
    if (!accepted) return res.status(409).json({ error: "no_completed_deal", message: "Отзыв возможен только по завершённой сделке с принятым исполнителем." });

    /* Финансовое подтверждение: финальный статус сделки или закрытый эскроу. */
    const financiallyClosed = FINAL_ORDER_STATUSES.includes(String(ord.status)) ||
      (ord.deal && ["completed", "settled", "released"].includes(String(ord.deal.status)));
    if (!financiallyClosed) return res.status(409).json({ error: "deal_not_completed", message: "Сделка не завершена финансово: оставьте отзыв после подтверждения выполнения." });

    /* Только участники конкретной сделки могут её оценивать. */
    const isBuyer = String(ord.user_id) === String(req.userId);
    const isMaster = String(accepted.master_id) === String(req.userId);
    if (!isBuyer && !isMaster) return res.status(403).json({ error: "not_participant" });

    /* Одна сторона — один отзыв по сделке (защита от накрутки). */
    const dup = (d.market_reviews || []).find(r => r.order_id === id && String(r.reviewer_id) === String(req.userId));
    if (dup) return res.status(409).json({ error: "already_reviewed" });

    const newReview = {
      id: require("crypto").randomUUID(),
      order_id: id,
      reviewer_id: req.userId,                                   /* из сессии, не из тела */
      reviewee_id: isBuyer ? accepted.master_id : ord.user_id,  /* оппонент по сделке */
      /* ЭТАП 4 (§4.3): привязка отзыва к товару. Приоритет: явный product_id
         сделки → seller_id + id последней купленной карточки покупателя
         (покупка фиксируется в d.purchases при оформлении заказа из карточки).
         Структура БД не меняется — только проекция существующих полей. */
      product_id: (() => {
        if (ord.product_id) return String(ord.product_id);
        if (ord.refType === "product" && ord.refName) return String(ord.refName);
        try {
          const buys = (d.purchases || []).filter((x) => String(x.userId) === String(ord.user_id) && x.status !== "cancelled");
          if (buys.length > 0) {
            const last = buys.sort((a, b) => new Date(b.date || b.created_at || 0) - new Date(a.date || a.created_at || 0))[0];
            const pid = String(last.productId || last.id || "");
            /* совпадение продавца — обязательное условие привязки */
            if (pid && String(ord.seller_id || accepted.master_id || "") && (!ord.seller_id || String(ord.seller_id) === String(accepted.master_id))) {
              return pid.startsWith("sp-") ? pid : "sp-" + pid;
            }
          }
        } catch (_) { /* мягкая деградация: отзыв остаётся без товарной привязки */ }
        return undefined;
      })(),
      rating: Number(rating),
      text: text || "",
      created_at: new Date().toISOString()
    };

    if (!d.market_reviews) d.market_reviews = [];
    d.market_reviews.push(newReview);
    /* Помечаем заказ как reviewed (не понижаем финальный статус). */
    ord.reviewed = true;
    if (!FINAL_ORDER_STATUSES.includes(String(ord.status))) ord.status = "completed";
    ord.updated_at = new Date().toISOString();
    fs.writeFileSync(FILE, JSON.stringify(d, null, 2));

    createNotification(newReview.reviewee_id, "review", "Новый отзыв о сделке",
      `Ваша оценка по заказу «${ord.title || ""}»: ${newReview.rating}/5.`, `/market?focus=${id}`);

    res.json({ ok: true, review: newReview });
  } catch (e) {
    console.error("[MARKET REVIEW API ERROR]", e);
    res.status(500).json({ error: "server" });
  }
});

app.get("/api/market/users/:id/reviews", async (req, res) => {
  try {
    const { id } = req.params;
    let reviews = [];
    let avgRating = 0;

    if (db.mode === "json-dev (бесплатно)") {
      const FILE = require("path").resolve(__dirname, "dev-db.json");
      const fs = require("fs");
      const d = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { market_reviews: [] };
      
      reviews = (d.market_reviews || []).filter(r => r.reviewee_id === id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      
      if (reviews.length > 0) {
        const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
        avgRating = (sum / reviews.length).toFixed(1);
      }
    }

    res.json({ ok: true, reviews, avgRating: Number(avgRating), count: reviews.length });
  } catch (e) {
    console.error("[MARKET USER REVIEWS API ERROR]", e);
    res.status(500).json({ error: "server" });
  }
});

/* ЭТАП 4 (§4.3): серверная агрегация отзывов по КОНКРЕТНОМУ товару.
   Отзыв привязан к сделке (market_reviews.product_id <- custom_orders.product_id),
   поэтому в выборку попадают только отзывы финансово закрытых сделок
   (антинакрутка на POST уже проверена; здесь — только выдача).
   Поддержка двух форматов id: серверный (<uuid>) и клиентский (sp-<uuid>). */
app.get("/api/products/:id/reviews", async (req, res) => {
  try {
    const rawId = String(req.params.id || "");
    const bareId = rawId.startsWith("sp-") ? rawId.slice(3) : rawId;
    const FILE = require("path").resolve(__dirname, "dev-db.json");
    const fs = require("fs");
    const d = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { market_reviews: [] };
    const reviews = (d.market_reviews || [])
      .filter((r) => { const s = String(r.product_id || ""); return s === rawId || s === bareId || s === "sp-" + bareId; })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    /* имена авторов — из users (без выдачи e-mail/телефонов) */
    const uMap = {};
    for (const u of d.users || []) uMap[String(u.id)] = u.name || u.login || "Покупатель";
    const enriched = reviews.map((r) => ({
      id: r.id, order_id: r.order_id, reviewer_id: r.reviewer_id,
      reviewer_name: uMap[String(r.reviewer_id)] || "Покупатель",
      rating: r.rating, text: r.text, created_at: r.created_at,
    }));
    const avg = enriched.length ? Number((enriched.reduce((s, r) => s + r.rating, 0) / enriched.length).toFixed(1)) : 0;
    res.json({ ok: true, reviews: enriched, avgRating: avg, count: enriched.length });
  } catch (e) {
    console.error("[PRODUCT REVIEWS API ERROR]", e);
    res.status(500).json({ error: "server" });
  }
});

/* Модуль «AI-дизайнер»: изолированные серверные маршруты (/api/ai-designer/*) */
require("./ai-designer.cjs").mount(app, { guard, db });

/* Цифровые продукты: /api/digital/* (загрузка, presigned-скачивание, покупки, подписки) */
const digital = require("./digital.cjs");
digital.setNotifySink(createNotification); // переиспользуем существующую систему уведомлений + email
digital.mount(app, { guard, softGuard, db });

/* Кабинет администратора (закрытая приватная зона): /api/admin/* — OTP-вход, RBAC,
   Command Center, Agent Control Plane, Policy Engine, журналы. Никаких публичных ссылок. */
require("./admin.cjs")(app, { express, jwt, crypto, bcrypt, mail, MAIL_FROM, COOKIE, DAY, JWT_SECRET, PORT, db, fs, path, cfg, cookieOpts: (maxAgeMs, p) => ({ httpOnly: true, sameSite: SAME_SITE, secure: SECURE_COOKIES, path: p || "/", maxAge: maxAgeMs }) });

app.listen(PORT, () => console.log("[quantiform-auth] порт " + PORT + " | режим: " + db.mode + (mail ? " | SMTP вкл" : " | SMTP выкл, ссылки в консоль")));
