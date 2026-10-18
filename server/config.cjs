/* ============================================================
   ЕДИНЫЙ КОНФИГ СЕРВЕРА (БЛОК 1, Пункт 1.1 — аудит и очистка секретов)
   ------------------------------------------------------------
   Правила:
   · Никаких секретов в коде. Всё только из переменных окружения (.env).
   · В DEV допустимы стабильные dev-заглушки (иначе после каждого рестарта
     слетают сессии — см. историю бага с JWT_SECRET), но их использование
     сопровождается предупреждением в консоль при старте.
   · В PRODUCTION заглушки запрещены: критическая переменная отсутствует →
     предельно допустимая длина жизни токена НЕ увеличивается, а критические
     эндпоинты (оплата, смена тарифа) возвращают 500 misconfigured.
   · Ключ service_role (Supabase/админский обход RLS) используется ТОЛЬКО на
     сервере (см. server/tariffs.cjs) и никогда не передаётся на клиент.
   ============================================================ */
const crypto = require("crypto");

const IS_PROD = process.env.NODE_ENV === "production";

/* Стабильная dev-заглушка: одна и та же между перезапусками (детерминирована
   из имени проекта), случайным crypto.randomBytes её не подменить намеренно —
   она явно помечена как dev-only. */
const DEV_JWT_STUB = "dev-only." + crypto.createHash("sha256").update("quantiform-dev-jwt-stub").digest("hex");

function envList(name) {
  return String(process.env[name] || "")
    .split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
}

/**
 * Читает строковую переменную окружения.
 * fallback — только для dev; в production игнорируется (строгий режим).
 */
function readSecret(name, fallback) {
  const v = process.env[name];
  if (v && String(v).trim()) return String(v).trim();
  if (!IS_PROD && fallback != null) return String(fallback);
  return null;
}

/**
 * Проверяет конфигурацию критического эндпоинта.
 * Возвращает null, если всё настроено, иначе — объект ошибки 500
 * («сервис настроен некорректно») для ответа клиенту.
 */
function requireEnv(names) {
  const missing = names.filter((n) => {
    const v = process.env[n];
    return !(v && String(v).trim());
  });
  if (!missing.length) return null;
  console.warn("[CONFIG] Критический эндпоинт недоступен: не заданы переменные окружения: " + missing.join(", "));
  return { error: "misconfigured", message: "Сервис настроен некорректно: отсутствуют обязательные переменные окружения" };
}

/* ---------- JWT / сессии (Пункт 1.3: двухтокенная схема) ---------- */
const ACCESS_TTL_SEC = Number(process.env.JWT_ACCESS_TTL_SEC || 15 * 60);        /* access: 15 минут */
const REFRESH_TTL_SEC = Number(process.env.JWT_REFRESH_TTL_SEC || 7 * 24 * 3600); /* refresh: 7 дней */

/* ---------- YooKassa (совместимость со старыми именами переменных) ---------- */
const shopId = readSecret("YOOKASSA_SHOP_ID", null) || readSecret("YKASSA_SHOP_ID", null);
const shopKey = readSecret("YOOKASSA_SECRET_KEY", null) || readSecret("YKASSA_SECRET", null);
/* Webhook подписан тем же секретным ключом магазина (YooKassa не имеет
   отдельного webhook-секрета); QF_WEBHOOK_SECRET/YOOKASSA_WEBHOOK_SECRET
   поддерживаются, если провайдер решит использовать отдельный секрет. */
const webhookSecret =
  readSecret("YOOKASSA_WEBHOOK_SECRET", null) ||
  readSecret("QF_WEBHOOK_SECRET", null) ||
  shopKey;

/* allowlist IP провайдера (опционально; пустой список = проверка IP не применяется) */
const webhookIps = envList("QF_WEBHOOK_IP_ALLOWLIST").concat(envList("YOOKASSA_WEBHOOK_IPS"));

module.exports = {
  IS_PROD,
  JWT_SECRET: readSecret("JWT_SECRET", DEV_JWT_STUB),
  JWT_SECRET_IS_DEV_STUB: !readSecret("JWT_SECRET", null),
  ACCESS_TTL_SEC,
  REFRESH_TTL_SEC,
  YOOKASSA: { shopId, secretKey: shopKey, configured: !!(shopId && shopKey) },
  WEBHOOK: { secret: webhookSecret, ips: webhookIps, verifyEnabled: !!(webhookSecret || webhookIps.length) },
  SUPABASE: {
    url: readSecret("SUPABASE_URL", null),
    anonKey: readSecret("SUPABASE_ANON_KEY", null),
    /* НИКОГДА не отдавать клиенту: обходит RLS (Пункт 1.2) */
    serviceRoleKey: readSecret("SUPABASE_SERVICE_ROLE_KEY", null),
  },
  readSecret,
  requireEnv,
};

/* Предупреждения при старте — без выхода из процесса (dev-сервер должен
   подниматься даже с незаполненным .env). */
if (module.exports.JWT_SECRET_IS_DEV_STUB) {
  console.warn(
    "[CONFIG] JWT_SECRET не задан — используется dev-заглушка. " +
    "В production задайте JWT_SECRET в переменных окружения, иначе все сессии предсказуемы."
  );
}
if (!module.exports.YOOKASSA.configured) {
  console.warn("[CONFIG] YOOKASSA_SHOP_ID / YOOKASSA_SECRET_KEY не заданы — платежи работают в dev-мок режиме.");
}
if (!module.exports.WEBHOOK.secret) {
  console.warn("[CONFIG] Секрет вебхука оплаты не задан — подпись событий проверить невозможно (только dev).");
}
