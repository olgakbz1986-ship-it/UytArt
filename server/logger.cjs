/* ============================================================
   СТРУКТУРИРОВАННОЕ ЛОГИРОВАНИЕ (БЛОК 5, Пункт 5.1)
   ------------------------------------------------------------
   · Формат — JSON (pino): уровень, время, сообщение, контекст —
     удобно парсить внешним системам мониторинга (Loki/ELK/CloudWatch).
   · Все security-события логируются через log.security(event, ctx):
       login_success / login_failed            — попытки входа (§1.3, §2.2)
       validation_error                        — Zod отклонил запрос (§2.1)
       rate_limit_exceeded                     — срабатывание лимитов (§2.2)
       suspicious_pattern                      — подозрительное поведение
                                                 (например, 10 смен тарифа за минуту)
       webhook_signature_invalid               — криптографическая ошибка HMAC (§3.2)
       refresh_denied / refresh_reuse_detected — аномалии ротации токенов (§1.3)
   · Анти-PII ред REDACT: пароли, токены, секреты вырезаются полностью;
     email маскируется до первых двух символов (ad***@domain), телефоны —
     до последних четырёх, последовательности из 13+ цифр (номера карт)
     never попадают в вывод. Тот же maskPII, что и для LLM (Пункт 4.2).
   ============================================================ */

let pino;
try { pino = require("pino"); } catch { pino = null; }

/* ---------- маскирование PII (общие правила для логов) ---------- */
const SECRET_KEY_RE = /^(password|passwd|pass|pwd|secret|token|authorization|authtoken|accesstoken|refreshtoken|jwt|apikey|api_key|cardnumber|pan|cvv|cvc)$/i;

function maskEmail(s) {
  const at = s.indexOf("@");
  if (at <= 0) return "***";
  return s.slice(0, Math.min(2, at)) + "***" + s.slice(at);
}
function maskPhone(s) {
  /* +7 912 345-67-89 → +7 *** ***-**-789: оставляем только последние 4 цифры */
  const tail = s.replace(/\D/g, "").slice(-4);
  return "phone:***" + tail;
}
/** Строкое правило: никаких полных email, телефонов, номеров карт, токенов. */
function scrubValue(v) {
  if (typeof v !== "string") return v;
  let s = v;
  /* номера карт и длинные числовые цепочки (13+ цифр подряд) */
  s = s.replace(/\b(?:\d[ -]?){13,19}\b/g, "[CARD]");
  /* email */
  s = s.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, (m) => maskEmail(m));
  /* российские телефоны */
  s = s.replace(/(?:\+7|8)[\s(]?\d{3}[\s)]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/g, (m) => maskPhone(m));
  return s;
}
function scrub(obj, depth = 0) {
  if (obj == null || depth > 6) return obj;
  if (Array.isArray(obj)) return obj.map((x) => scrub(x, depth + 1));
  if (typeof obj === "string") return scrubValue(obj);
  if (typeof obj !== "object") return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = SECRET_KEY_RE.test(k) ? "[REDACTED]" : scrub(v, depth + 1);
  }
  return out;
}

/* ---------- базовый логгер ---------- */
const LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug");
let base;
if (pino) {
  base = pino({
    level: LEVEL,
    base: { app: "quantiform-api", env: process.env.NODE_ENV || "development" },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
} else {
  /* graceful fallback: если pino не установлен — тот же JSON-формат через console */
  const emit = (lvl, msg, ctx) =>
    console.log(JSON.stringify({ level: lvl, time: new Date().toISOString(), app: "quantiform-api", msg, ...ctx }));
  base = {
    info: (ctx, msg) => emit("info", msg, ctx),
    warn: (ctx, msg) => emit("warn", msg, ctx),
    error: (ctx, msg) => emit("error", msg, ctx),
    debug: (ctx, msg) => emit("debug", msg, ctx),
  };
}

/** Единая точка входа для событий безопасности. event — машинно-читаемое имя. */
function security(event, ctx = {}) {
  const c = scrub(ctx);
  const line = { event, ...c };
  /* неуспешные входы, ошибки подписи вебхуков, reuse токенов — warn;
     штатные события (успешный вход) — info */
  if (/failed|denied|invalid|reuse|suspicious/.test(event)) base.warn(line, "security:" + event);
  else base.info(line, "security:" + event);
}

module.exports = {
  raw: base,
  security,
  info: (msg, ctx = {}) => base.info(scrub({ ...ctx }), msg),
  warn: (msg, ctx = {}) => base.warn(scrub({ ...ctx }), msg),
  error: (msg, ctx = {}) => base.error(scrub({ ...ctx }), msg),
  /* экспорт для тестов и переиспользования тем же процессом */
  _scrub: scrub,
  _maskEmail: maskEmail,
};
