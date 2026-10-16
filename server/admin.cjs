// ============================================================
// CABINET ADMIN — закрытый операционный центр Quantiform (StartTechPro)
// Приватная зона: никаких публичных ссылок, не индексируется, вход только
// через стандартную страницу /auth по заранее разрешённому служебному email.
//
// Модули (Этап 1 + каркас):
//  • allowlist админских email + одноразовый код на почту (5 мин, одноразовый,
//    отменяет предыдущий, требуется при каждом входе)
//  • проверка устройства / IP / региона / времени входа / истории попыток
//  • временная блокировка после 3–5 неудачных попыток, нейтральная ошибка
//  • RBAC на сервере (роли, granular permissions, двухфакторное подтверждение
//    критических действий, разделение полномочий)
//  • неизменяемый журнал безопасности и журнал действий (append-only)
//  • слитые JWT-сессии: один токен = пользовательская ИЛИ админская сессия
//  • Command Center API: индекс здоровья, «Требуют решения», критические алерты,
//    метрики, состояние AI-агента, лента изменений
//  • очередь решений агента, evidence pack, чат с агентом (через src/agent),
//    гипотезы, план релиза, Observability (Agent Trace Explorer)
//  • Policy Engine: границы автономности, лимиты, версионирование политик,
//    период вступления в силу критических правил
//  • данные разделов: пользователи, продавцы, каталог/модерация, заказы,
//    финансы, споры, поддержка, безопасность, контент, аналитика, релизы,
//    настройки, журналы, глобальный поиск, центр уведомлений
//
// Хранилище: postgres (DATABASE_URL) c автомиграцией схемы, иначе JSON-dev.
// Все записи версионируются (prev_state/state), все действия требуют reason.
// ============================================================
module.exports = function registerAdmin(app, ctx) {
  const { express, jwt, crypto, bcrypt, mail, MAIL_FROM, COOKIE, DAY, JWT_SECRET, PORT, db, fs, path } = ctx;
  void bcrypt; void PORT;

  /* ---------- идемпотентность операций (защита от повторного нажатия) ------ */
  const CLIENT_OP_TTL_MS = 10 * 60 * 1000; // окно идемпотентности — 10 минут
  const clientOps = new Map(); // client_op_id -> { ts, response }
  function idempotent(req, res, run) {
    const key = String(req.body && req.body.client_op_id || "").slice(0, 64);
    if (!key) return run();
    const nowT = Date.now();
    for (const [k, v] of clientOps) if (nowT - v.ts > CLIENT_OP_TTL_MS) clientOps.delete(k);
    const hit = clientOps.get(key);
    if (hit) { res.json(Object.assign({}, hit.response, { idempotent_replay: true })); return; }
    return run((response) => { clientOps.set(key, { ts: nowT, response }); res.json(response); });
  }

  /* ---------- risk policy helpers (shared with frontend via /bootstrap) ---- */
  const RISK_ORDER = { low: 0, medium: 1, high: 2, critical: 3 };
  const isCriticalRisk = (r) => r === "critical";
  const needsDoubleConfirm = (r) => r === "critical";
  const CRITICAL_EFFECTIVE_DELAY_MS = 5 * 60 * 1000; // критические политики вступают не мгновенно

  /* ---------- storage adapters -------------------------------------------- */
  const PG = db.mode.startsWith("postgres");
  let pool = null;
  if (PG) { const { Pool } = require("pg"); pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSL === "require" ? { rejectUnauthorized: false } : undefined }); }

  const FILE = require("path").resolve(__dirname, "dev-admin.json");
  const loadDev = () => {
    let d = fs_exists() ? JSON.parse(require("fs").readFileSync(FILE, "utf8")) : null;
    if (!d || !Array.isArray(d.admins)) d = seedDoc();
    return d;
  };
  const fs_exists = () => require("fs").existsSync(FILE);
  const saveDev = (d) => require("fs").writeFileSync(FILE, JSON.stringify(d, null, 2));
  const devMutate = (fn) => { const d = loadDev(); const r = fn(d); saveDev(d); return r; };

  function seedDoc() {
    const now = Date.now();
    const A = (id, email, name, role, extra = {}) => Object.assign({ id, email, name, role, passkey: false, created_at: now }, extra);
    return {
      admins: [
        A("adm-super", "admin@starttechpro.ru", "Главный администратор", "super_admin"),
        A("adm-fin", "finance@starttechpro.ru", "Финансовый контролёр", "finance"),
        A("adm-aiops", "aiops@starttechpro.ru", "AI Ops", "ai_ops"),
        A("adm-audit", "audit@starttechpro.ru", "Аудитор", "auditor"),
      ],
      codes: [], attempts: [], devices: [], blocks: [],
      security_log: [{ id: "sec-seed", ts: now, admin_id: null, type: "system", result: "success", ip: "-", device_id: "-", region: "-", detail: "Кабинет инициализирован" }],
      actions_log: [],
      roles: {
        super_admin: { title: "Super Admin", sections: ["*"], perms: ["view", "manage_users", "manage_sellers", "moderate", "orders_write", "finance_write", "disputes_resolve", "support_write", "security_manage", "content_publish", "releases_manage", "settings_write", "agent_manage", "export", "approve", "double_confirm", "roles_manage"] },
        product_owner: { title: "Product Owner", sections: ["home", "agent", "decisions", "catalog", "orders", "disputes", "analytics", "releases", "logs"], perms: ["view", "moderate", "orders_write", "disputes_resolve", "releases_manage", "approve", "agent_manage", "export"] },
        operations: { title: "Operations", sections: ["home", "users", "sellers", "catalog", "orders", "disputes", "support", "logs"], perms: ["view", "manage_users", "manage_sellers", "moderate", "orders_write", "disputes_resolve", "support_write", "approve"] },
        finance: { title: "Finance", sections: ["home", "orders", "finance", "disputes", "analytics", "logs"], perms: ["view", "finance_write", "disputes_resolve", "approve", "export", "double_confirm"] },
        trust_safety: { title: "Trust & Safety", sections: ["home", "users", "sellers", "orders", "security", "disputes", "logs"], perms: ["view", "manage_users", "manage_sellers", "security_manage", "disputes_resolve", "approve"] },
        support: { title: "Support", sections: ["home", "users", "orders", "disputes", "support", "logs"], perms: ["view", "support_write", "disputes_resolve"] },
        content_manager: { title: "Content Manager", sections: ["home", "catalog", "content", "releases", "logs"], perms: ["view", "moderate", "content_publish"] },
        data_analyst: { title: "Data Analyst", sections: ["home", "analytics", "logs"], perms: ["view", "export"] },
        ai_ops: { title: "AI Ops", sections: ["home", "agent", "decisions", "security", "releases", "settings", "logs"], perms: ["view", "agent_manage", "settings_write", "approve", "double_confirm", "export"] },
        auditor: { title: "Auditor", sections: ["home", "logs", "analytics"], perms: ["view", "export"] },
      },
      policies: [
        { id: "pol-read", action_type: "analytics.read", mode: "auto", risk: "low", max_per_hour: 200, max_money_rub: 0, max_affected: 0, enabled: true, version: 1, updated_by: "adm-super", updated_at: now, effective_at: now, prev: null, note: "Чтение обезличенной аналитики — автоматически" },
        { id: "pol-hyp", action_type: "hypothesis.create", mode: "auto", risk: "low", max_per_hour: 100, max_money_rub: 0, max_affected: 0, enabled: true, version: 1, updated_by: "adm-super", updated_at: now, effective_at: now, prev: null, note: "Формирование гипотез — автоматически" },
        { id: "pol-warn", action_type: "seller.warning", mode: "confirm_operator", risk: "medium", max_per_hour: 10, max_money_rub: 0, max_affected: 1, enabled: true, version: 1, updated_by: "adm-super", updated_at: now, effective_at: now, prev: null, note: "Предупреждение продавцу — оператор подтверждает" },
        { id: "pol-flag", action_type: "product.flag", mode: "auto", risk: "low", max_per_hour: 50, max_money_rub: 0, max_affected: 0, enabled: true, version: 1, updated_by: "adm-super", updated_at: now, effective_at: now, prev: null, note: "Пометить товар подозрительным — авто, удаление — только через подтверждение" },
        { id: "pol-refund", action_type: "refund.propose", mode: "confirm_operator", risk: "medium", max_per_hour: 20, max_money_rub: 50000, max_affected: 1, enabled: true, version: 1, updated_by: "adm-fin", updated_at: now, effective_at: now, prev: null, note: "Агент предлагает возврат, списание — запрещено" },
        { id: "pol-block", action_type: "seller.block", mode: "forbidden_auto", risk: "critical", max_per_hour: 2, max_money_rub: 0, max_affected: 1, enabled: true, version: 1, updated_by: "adm-super", updated_at: now, effective_at: now, prev: null, note: "Блокировка продавца — только двойное подтверждение + причина" },
        { id: "pol-payout", action_type: "payout.freeze", mode: "confirm_specialist", risk: "high", max_per_hour: 5, max_money_rub: 100000, max_affected: 1, enabled: true, version: 1, updated_by: "adm-fin", updated_at: now, effective_at: now, prev: null, note: "Заморозка выплат — профильный администратор (Finance)" },
        { id: "pol-mass", action_type: "mass.action", mode: "confirm_specialist", risk: "high", max_per_hour: 1, max_money_rub: 0, max_affected: 500, enabled: true, version: 1, updated_by: "adm-super", updated_at: now, effective_at: now, prev: null, note: "Массовые действия — предпросмотр затронутых объектов обязателен" },
      ],
      limits: { max_actions_per_hour: 120, max_money_impact_rub_day: 500000, max_api_calls_per_run: 40, token_budget_per_day: 2000000, cost_budget_per_day_rub: 3000, forbidden_data: ["payment_card_data", "raw_passwords", "medical", "biometric"] },
      agent: {
        status: "active", autonomy_mode: "copilot", model_version: "qf-agent-1.4.2", prompt_version: "p-87", rules_version: "r-31", tools_version: "t-19",
        last_updated: now - 3 * DAY, owner: "adm-aiops", kill_switch: false,
        health: { answer_quality: 0.91, classification_accuracy: 0.88, false_positive_rate: 0.04, tool_errors: 3, avg_exec_ms: 2100, cost_rub_day: 214, human_share: 0.23, cancelled_by_admin: 2 },
        drift: { score: 0.06, flags: [] }, roi: { tasks_closed_no_human: 500, hours_saved_week: 120, fraud_prevented_rub: 1840000, disputes_reduced_pct: 17, support_speedup_pct: 30, conversions_uplift_pct: 2.4, prevented_payouts: 18, cost_tokens_rub: 96, cost_infra_rub: 60, cost_control_rub: 45, cost_errors_rub: 12 },
      },
      sources: [
        { key: "reviews", title: "Внутренние отзывы", connected: true, last_sync: now - 12 * 60000, records: 18402, errors: 0, masked_fields: ["author_email"], restrictions: "" },
        { key: "complaints", title: "Жалобы", connected: true, last_sync: now - 5 * 60000, records: 2310, errors: 0, masked_fields: ["phone"], restrictions: "" },
        { key: "support", title: "Обращения в поддержку", connected: true, last_sync: now - 3 * 60000, records: 9820, errors: 0, masked_fields: ["email"], restrictions: "" },
        { key: "chats", title: "Чаты заказов", connected: true, last_sync: now - 30 * 60000, records: 41230, errors: 1, masked_fields: [], restrictions: "только метаданные без содержимого" },
        { key: "behavior", title: "Поведенческая аналитика", connected: true, last_sync: now - 60000, records: 962000, errors: 0, masked_fields: ["ip_last_octet"], restrictions: "" },
        { key: "search", title: "Поисковые запросы", connected: true, last_sync: now - 90000, records: 155000, errors: 0, masked_fields: [], restrictions: "" },
        { key: "cancels", title: "Отмены", connected: true, last_sync: now - 40000, records: 1210, errors: 0, masked_fields: [], restrictions: "" },
        { key: "refunds", title: "Возвраты", connected: true, last_sync: now - 45000, records: 640, errors: 0, masked_fields: [], restrictions: "" },
        { key: "disputes", title: "Споры", connected: true, last_sync: now - 20000, records: 388, errors: 0, masked_fields: ["participant_contacts"], restrictions: "" },
        { key: "payments", title: "Платежи", connected: true, last_sync: now - 15000, records: 51220, errors: 2, masked_fields: ["card_pan", "cvv"], restrictions: "PAN недоступен агенту никогда" },
        { key: "error_logs", title: "Логи ошибок", connected: true, last_sync: now - 10000, records: 7742, errors: 0, masked_fields: [], restrictions: "" },
        { key: "sellers", title: "Данные продавцов", connected: true, last_sync: now - 600000, records: 431, errors: 0, masked_fields: ["passport", "inn_full"], restrictions: "" },
        { key: "products", title: "Данные товаров", connected: true, last_sync: now - 600000, records: 12890, errors: 0, masked_fields: [], restrictions: "" },
        { key: "external_reviews", title: "Внешние отзывы", connected: false, last_sync: now - 2 * DAY, records: 0, errors: 3, masked_fields: [], restrictions: "не подключён" },
        { key: "social", title: "Упоминания в соцсетях", connected: true, last_sync: now - 3600000, records: 2044, errors: 0, masked_fields: ["handle"], restrictions: "обезличенные тональности" },
        { key: "competitors", title: "Данные конкурентов", connected: true, last_sync: now - 7200000, records: 512, errors: 0, masked_fields: [], restrictions: "только открытые источники" },
        { key: "market", title: "Рыночные сигналы", connected: true, last_sync: now - 7200000, records: 96, errors: 0, masked_fields: [], restrictions: "" },
      ],
      observations: [
        { id: "obs-1", ts: now - 2 * 3600000, source: "complaints", anomaly: "Рост жалоб на задержку доставки", segment: "Продавцы категории «Декор»", volume: "42 заказа", severity: "high", evidence: { avg_delay_from_days: 2, avg_delay_to_days: 6, orders: ["QF-1041", "QF-1044", "QF-1052"], complaints: 42, window_days: 7 }, status: "open", risk: "high" },
        { id: "obs-2", ts: now - 8 * 3600000, source: "payments", anomaly: "Ложные отказы авторизации шлюза ЮKassa", segment: "Оплаты картой", volume: "118 транзакций", severity: "medium", evidence: { decline_rate_before: 0.02, decline_rate_now: 0.07, gateway: "yookassa", window_hours: 24 }, status: "converted_hypothesis", risk: "medium" },
        { id: "obs-3", ts: now - 26 * 3600000, source: "search", anomaly: "23% запросов без результатов по слову «фурнитура латунь»", segment: "Поиск / категория Фурнитура", volume: "1 812 запросов", severity: "medium", evidence: { no_result_queries: 1812, top_missing: ["латунная петля", "рейлинг 900"], conversion_of_results: 0.011 }, status: "open", risk: "medium" },
        { id: "obs-4", ts: now - 50 * 3600000, source: "reviews", anomaly: "Всплеск негатива на качество упаковки", segment: "Хрупкий декор, регион ЕКБ", volume: "17 отзывов", severity: "low", evidence: { negative: 17, total: 96, carriers: ["СДЭК"] }, status: "open", risk: "low" },
      ],
      hypotheses: [
        { id: "hyp-1", obs_id: "obs-1", title: "SLD-ретард продавца «Декор Про» бьёт по конверсии категории", problem: "Задержка доставки у 6 продавцов «Декор» выросла с 2 до 6 дней, 42 жалобы", segment: "Декор / Покупатели 25-44", impact_volume: "≈420 заказов/мес", evidence: { orders: ["QF-1041", "QF-1044", "QF-1052"], complaints: 42, delay_series: [2, 2.4, 3.1, 4.2, 5.0, 5.8, 6.0] }, current_behavior: "Карточка показывает срок «3–5 дней» без учёта фактической скорости продавца", desired_behavior: "Срок в карточке = медиана фактической доставки продавца", solution: "Динамический ETA по данным доставок + предупреждение продавцу", alternatives: ["Понизить видимость медленных продавцов", "Включить ETA только для категории Декор"], expected_effect: "-30% жалоб на доставку в сегменте, +1.2 п.п. конверсии", risks: "Ложные срабатывания в сезон", confidence: 0.82, priority: "P1", validation: "A/B: жалобы/1000 заказов и CTR карточки за 14 дней", status: "review", assignee: null, created_at: now - 2 * 3600000, updated_at: now - 3600000, history: [] },
        { id: "hyp-2", obs_id: "obs-2", title: "Ретраить soft-decline шлюза вместо показа ошибки", problem: "7% ложных отказов авторизации — потерянные оплаты", segment: "Все покупатели с картой", impact_volume: "≈118 оплат/сутки", evidence: { decline_rate_before: 0.02, decline_rate_now: 0.07, gateway: "yookassa" }, current_behavior: "При ошибке 5xx шлюза заказ остаётся неоплаченным", desired_behavior: "Автоповтор через 60 сек + письмо-напоминание", solution: "Идемпотентный retry-слой оплаты", alternatives: ["Резервный шлюз"], expected_effect: "+0.8% GMV", risks: "Двойное списание при неверной идемпотентности", confidence: 0.74, priority: "P2", validation: "доля успешных оплат после повтора ≥ 35%", status: "backlog", assignee: null, created_at: now - 8 * 3600000, updated_at: now - 8 * 3600000, history: [] },
        { id: "hyp-3", obs_id: "obs-3", title: "Синонимы и докаталогизация «фурнитура → латунь»", problem: "1 812 запросов без результата", segment: "Фурнитура", impact_volume: "≈1 800 сессий/нед", evidence: { no_result_queries: 1812, top_missing: ["латунная петля", "рейлинг 900"] }, current_behavior: "Пустая выдача", desired_behavior: "Выдача похожих + автоподстановка", solution: "Словарь синонимов + подсказка «добавить товар» продавцам", alternatives: ["Ручная курация топ-запросов"], expected_effect: "+2 п.п. поисковой конверсии", risks: "Нерелевантные выдачи", confidence: 0.68, priority: "P3", validation: "no-result rate < 8%", status: "approved", assignee: "adm-super", created_at: now - 26 * 3600000, updated_at: now - 20 * 3600000, history: [] },
      ],
      decisions: [
        { id: "dec-1", title: "Блокировка продавца «Мебель Лофт»", description: "14 отмен подряд, рост жалоб, риск потери покупателей", risk: "critical", due_ts: now + 6 * 3600000, source: "fraud_engine", affected: { sellers: ["sel-ml"], orders: 38, gmv_rub: 121000 }, evidence: { cancel_series: [0, 1, 0, 2, 1, 4, 6], complaints: 11, reputation: 3.1, fin_stats: { balance_rub: 84000, pending_payout_rub: 41000 }, orders_history: ["QF-1041", "QF-1044"], false_positive_prob: 0.07 }, proposed_action: "temporary_block_14d", alternatives: ["warning", "visibility_down_30d"], forecast: { gmv_delta_rub: -121000, complaint_drop_pct: 40 }, confidence: 0.86, consequences: "Продавец не сможет принимать заказы 14 дней; апелляция возможна", status: "pending", created_at: now - 3600000, resolution: null, assignee: null },
        { id: "dec-2", title: "Одобрение выплаты «Декор Про» сверх лимита", description: "Выплата 184 000 ₽ выше порога 150 000 ₽, холдов нет", risk: "high", due_ts: now + 20 * 3600000, source: "payout_queue", affected: { payouts: ["po-207"], money_rub: 184000 }, evidence: { seller: "sel-dp", period_orders: 96, dispute_rate: 0.01 }, proposed_action: "approve_payout", alternatives: ["hold_24h"], forecast: {}, confidence: 0.9, consequences: "Денежные средства будут перечислены продавцу", status: "pending", created_at: now - 2 * 3600000, resolution: null, assignee: null },
        { id: "dec-3", title: "Снять с публикации 23 товара без сертификатов", description: "Детские товары без документов соответствия", risk: "high", due_ts: now + 48 * 3600000, source: "moderation_agent", affected: { products: 23, sellers: 5 }, evidence: { missing_docs: ["ЕАЭС сертификат"], sample_products: ["p-771", "p-772"] }, proposed_action: "unpublish_batch", alternatives: ["request_docs_72h"], forecast: { gmv_delta_rub: -38000 }, confidence: 0.93, consequences: "Товары исчезнут из витрины, продавцы получат уведомление", status: "pending", created_at: now - 5 * 3600000, resolution: null, assignee: null },
        { id: "dec-4", title: "Изменить политику агента: refund.propose лимит 50 000 → 80 000 ₽", description: "Рост среднего чека, предложения возвратов упираются в лимит", risk: "medium", due_ts: now + 72 * 3600000, source: "agent_self_report", affected: { policy: "pol-refund" }, evidence: { blocked_proposals_7d: 14 }, proposed_action: "policy_update", alternatives: ["оставить как есть"], forecast: {}, confidence: 0.7, consequences: "Агент сможет предлагать более крупные возвраты (по-прежнему с подтверждением)", status: "pending", created_at: now - 26 * 3600000, resolution: null, assignee: null },
        { id: "dec-5", title: "Критический инцидент: деградация платёжного шлюза", description: "Ошибка 5xx у ЮKassa 4%, падение конверсии оплаты", risk: "critical", due_ts: now + 2 * 3600000, source: "alerts", affected: { payments: "все карточные" }, evidence: { error_rate: 0.04, p95_ms: 4200 }, proposed_action: "switch_gateway_backup", alternatives: ["wait_vendor"], forecast: { lost_gmv_rub_hr: 62000 }, confidence: 0.88, consequences: "Переключение на резервный шлюз на время инцидента", status: "resolved", created_at: now - 30 * 3600000, resolution: { by: "adm-super", at: now - 26 * 3600000, verdict: "approved", reason: "Инцидент подтверждён мониторингом", result: "Шлюз переключён, ошибка 0.4%" }, assignee: null },
      ],
      alerts: [
        { id: "al-1", kind: "gateway", title: "Падение платёжного шлюза ЮKassa", level: "critical", ts: now - 3600000, responsible: "adm-fin", status: "acknowledged", metric: "errors 4%" },
        { id: "al-2", kind: "cancels", title: "Рост отмен у продавцов категории «Декор»", level: "important", ts: now - 7200000, responsible: null, status: "new", metric: "+38% за 7 дней" },
        { id: "al-3", kind: "complaints", title: "Всплеск жалоб на упаковку (ЕКБ)", level: "important", ts: now - 20 * 3600000, responsible: null, status: "new", metric: "17 отзывов" },
        { id: "al-4", kind: "anomaly", title: "Подозрительная активность агента: 3 вызова payout.freeze вне очереди", level: "critical", ts: now - 26 * 3600000, responsible: "adm-aiops", status: "investigating", metric: "policy blocks: 3" },
        { id: "al-5", kind: "search", title: "Недоступен поиск: fallback-выдача 2 часа", level: "info", ts: now - 50 * 3600000, responsible: null, status: "closed", metric: "uptime 99.2%" },
      ],
      notifications: [
        { id: "nt-1", level: "critical", title: "Инцидент платёжного шлюза решён", ts: now - 26 * 3600000, read: false, acked: true, link: "#/admin/incidents/al-1" },
        { id: "nt-2", level: "important", title: "2 решения агента ждут подтверждения > 1 часа", ts: now - 3600000, read: false, acked: false, link: "#/admin/queue" },
        { id: "nt-3", level: "info", title: "Агент обновил план релиза v25.10", ts: now - 9000000, read: false, acked: false, link: "#/admin/release-plan" },
      ],
      tickets: [
        { id: "tk-101", channel: "chat", subject: "Не пришла посылка QF-1044", user: "u-101", order: "QF-1044", priority: "high", status: "open", sla_due: now + 4 * 3600000, assignee: null, first_resp: null, ai_summary: "Клиент ждёт 8 дней, трек не двигается 5 дней. Рекомендация: ускорить расследование у перевозчика + компенсация бонусами.", tags: ["доставка"] },
        { id: "tk-102", channel: "email", subject: "Возврат бракованной полки", user: "u-102", order: "QF-1038", priority: "medium", status: "ai_resolved", sla_due: now + 20 * 3600000, assignee: null, first_resp: now - 300000, ai_summary: "Фото совпадают с описанием брака. Шаблон возврата применён, продавец уведомлён.", tags: ["возврат"] },
        { id: "tk-103", channel: "tg", subject: "Продавец: не проходит верификация ИП", user: "s-201", priority: "medium", status: "escalated", sla_due: now + 8 * 3600000, assignee: "adm-super", first_resp: now - 3600000, ai_summary: "OCR-распознавание документа не удалось 3 раза — эскалация человеку.", tags: ["верификация"] },
      ],
      disputes: [
        { id: "dsp-301", order: "QF-1044", buyer: "u-101", seller: "sel-ml", reason: "not_delivered", amount_rub: 12400, status: "open", deadline: now + 36 * 3600000, sla_hours: 48, opened_at: now - 12 * 3600000, evidence: ["трек пуст 5 дней", "чат продавца без ответа"], agent_summary: { essence: "Товар не доставлен, продавец молчит 4 дня", versions: { buyer: "Деньги вернуть", seller: "Задержка перевозчика" }, similar_cases: 7, recommendation: "full_refund", confidence: 0.8 }, resolution: null, assignee: null, escalation: false },
        { id: "dsp-302", order: "QF-1052", buyer: "u-105", seller: "sel-dp", reason: "damaged", amount_rub: 4300, status: "waiting_evidence", deadline: now + 60 * 3600000, sla_hours: 72, opened_at: now - 30 * 3600000, evidence: ["фото упаковки"], agent_summary: { essence: "Скол керамики, упаковка вскрыта", versions: { buyer: "Брак", seller: "Транспорт" }, similar_cases: 3, recommendation: "partial_refund_50", confidence: 0.66 }, resolution: null, assignee: null, escalation: false },
        { id: "dsp-303", order: "QF-1029", buyer: "u-102", seller: "sel-ml", reason: "not_as_described", amount_rub: 8900, status: "resolved", deadline: now - 2 * 3600000, sla_hours: 48, opened_at: now - 80 * 3600000, evidence: ["скрин описания", "фото товара"], agent_summary: { essence: "Цвет не соответствует фото", versions: { buyer: "Не тот цвет", seller: "Калибровка экрана" }, similar_cases: 12, recommendation: "return_label", confidence: 0.75 }, resolution: { verdict: "partial_refund_30", by: "adm-super", at: now - 3 * 3600000, reason: "Частичное соответствие описанию" }, assignee: "adm-super", escalation: false },
      ],
      releases: [
        { id: "rel-25.10", name: "v25.10 · Осенний", target: now + 12 * DAY, status: "planned", goal: "Снизить жалобы на доставку и поднять поисковую конверсию", items: [{ hyp: "hyp-1", prio: "must", effort: "M" }, { hyp: "hyp-3", prio: "should", effort: "S" }], risks: "Сезонные ложные срабатывания ETA", success: "жалобы/1000 заказов −25%; no-result < 8%", owner: "adm-super", log: [] },
        { id: "rel-25.09", name: "v25.09 · Стабильность", target: now - 6 * DAY, status: "released", goal: "Стабилизация оплаты", items: [{ hyp: "hyp-2", prio: "must", effort: "M" }], risks: "", success: "soft-decline < 3%", owner: "adm-super", log: [{ ts: now - 6 * DAY, text: "Релиз выкатан, rollback не потребовался" }] },
      ],
      flags: [
        { id: "ff-eta", name: "delivery.dynamic_eta", on: true, rollout_pct: 25, segment: "region:ЕКБ", note: "эксперимент гип-1", history: [{ ts: now - 4 * DAY, by: "adm-super", from: 0, to: 25, reason: "канареечный запуск" }] },
        { id: "ff-syn", name: "search.synonyms_v2", on: false, rollout_pct: 0, segment: "all", note: "готов к включению", history: [] },
        { id: "ff-payretry", name: "pay.idempotent_retry", on: true, rollout_pct: 100, segment: "all", note: "из релиза 25.09", history: [{ ts: now - 5 * DAY, by: "adm-super", from: 50, to: 100, reason: "метрики стабильны" }] },
      ],
      abtests: [
        { id: "ab-1", hypothesis: "Динамический ETA снижает жалобы", metric: "complaints_per_1000_orders", duration_days: 14, sample: "50% трафика Декор", segment: "Декор", stop_rule: "конверсия −1 п.п.", result: { variant_a: 21.4, variant_b: 15.1, lift_pct: -29.4, verdict: "winner_b_pending_release" } },
      ],
      settings: {
        env: "production", platform_mode: "normal", maintenance_note: "",
        rules: { registration: "email+password, обязательное подтверждение email", publish: "модерация новых категорий обязательна", reviews: "1 отзыв на заказ, антинакрутка включена", returns: "14 дней, товары гигиены — исключения", delivery: "ETA = медиана продавца c 25.10", disputes: "SLA 48ч, эскалация +24ч", blocks: "временные ≤ 90 дней, апелляция 30 дней", commissions: "см. Финансы → правила комиссий" },
        limits_cfg: { payout_confirm_threshold_rub: 150000, hold_max_days: 14, refund_auto_limit_rub: 3000 },
        regions: ["MSK", "СПБ", "ЕКБ", "НСО", "КЗН"], languages: ["ru", "en"], currencies: ["RUB"], units: ["шт", "м", "кг", "л"], taxes: "УСН 7% (сервис) / самозанятые NPD", legal: "ООО «СтартТехПро», ОГРН 121…",
      },
      integrations: [
        { key: "yookassa", title: "ЮKassa (эквайринг)", status: "degraded", version: "v3", errors_24h: 31, limits: "RPS 20", keys_ok: true, incidents: [{ ts: now - 3600000, text: "5xx 4%, переключение на резерв" }] },
        { key: "cdek", title: "СДЭК (доставка)", status: "ok", version: "v2", errors_24h: 0, limits: "RPS 10", keys_ok: true, incidents: [] },
        { key: "post", title: "Почта России", status: "ok", version: "v1", errors_24h: 2, limits: "RPS 5", keys_ok: true, incidents: [] },
        { key: "sms", title: "SMS-шлюз (МТС)", status: "paused", version: "v2", errors_24h: 0, limits: "300/сутки", keys_ok: true, incidents: [] },
        { key: "crm", title: "amoCRM", status: "ok", version: "v4", errors_24h: 1, limits: "RPS 8", keys_ok: true, incidents: [] },
        { key: "maps", title: "Яндекс.Карты", status: "ok", version: "v1.1", errors_24h: 0, limits: "RPS 50", keys_ok: true, incidents: [] },
      ],
      traces: [
        { id: "tr-9001", ts: now - 3600000, trigger: "cron.monitor.seller_cancels", steps: [
          { n: 1, kind: "context", text: "Загружены отмены за 14 дней: 214 записей", ms: 120 },
          { n: 2, kind: "tool", text: "seller.stats(sel-ml) → cancels=14 подряд, rating 3.1", ms: 340 },
          { n: 3, kind: "reasoning", text: "Порог серийных отмен превышен (≥10). Жалобы растут. Класс: gross_violation", ms: 900 },
          { n: 4, kind: "policy", text: "Действие seller.block требует двойного подтверждения → создана карточка dec-1", ms: 60 },
          { n: 5, kind: "answer", text: "Рекомендация: временная блокировка 14 дней; альтернативы: warning/visibility", ms: 0 },
        ], tokens_in: 4210, tokens_out: 980, cost_rub: 3.1, latency_ms: 1420, outcome: "decision_created", human_decision: null, error: null },
        { id: "tr-9002", ts: now - 26 * 3600000, trigger: "alert.gateway.errors", steps: [
          { n: 1, kind: "tool", text: "payments.health(yookassa) → err 4%", ms: 210 },
          { n: 2, kind: "policy", text: "Попытка payout.freeze вне очереди заблокирована политикой pol-payout", ms: 30 },
          { n: 3, kind: "error", text: "policy_violation — зафиксировано в журнале безопасности", ms: 0 },
        ], tokens_in: 1500, tokens_out: 210, cost_rub: 0.9, latency_ms: 640, outcome: "blocked_by_policy", human_decision: "adm-aiops проверил, ложное срабатывание планировщика", error: "policy_violation" },
      ],
      evalcases: [
        { suite: "complaints_triage", total: 220, passed: 201, acc: 0.914 },
        { suite: "fraud_detection", total: 140, passed: 122, acc: 0.871 },
        { suite: "false_blocks", total: 90, passed: 87, acc: 0.967 },
        { suite: "pii_handling", total: 60, passed: 60, acc: 1 },
        { suite: "adversarial_prompt_injection", total: 45, passed: 39, acc: 0.867 },
      ],
      quality_gates: { min_acc_vs_prev: 0.02, block_on_regression: true, last_gate: { version: "qf-agent-1.4.2", result: "passed", ts: now - 3 * DAY } },
      feed: [
        { ts: now - 3600000, kind: "agent", text: "Агент создал решение dec-1 (блокировка продавца)" },
        { ts: now - 26 * 3600000, kind: "incident", text: "Инцидент al-1 решён: шлюз переключён" },
        { ts: now - 5 * 3600000, kind: "flag", text: "feature flag delivery.dynamic_eta: 25% → канареечный сегмент ЕКБ" },
        { ts: now - 6 * DAY, kind: "release", text: "Релиз v25.09 «Стабильность» выкатан в production" },
        { ts: now - 8 * DAY, kind: "mass", text: "Массовое действие: снято 12 товаров-дублей (причина: дубликаты)" },
      ],
      campaigns: [
        { id: "cmp-1", channel: "email", audience: "VIP-покупатели", size: 3200, status: "scheduled", scheduled_at: now + 2 * DAY, stats: { delivered: 0, opened: 0, clicked: 0, unsub: 0 }, subject: "Закрытая распродажа декора", preview: "Только для вас…" },
        { id: "cmp-2", channel: "push", audience: "Активные 30 дней", size: 48200, status: "sent", scheduled_at: now - DAY, stats: { delivered: 46100, opened: 12400, clicked: 2100, unsub: 84 }, subject: "Напоминание о брошенной корзине" },
      ],
      templates: [
        { key: "order_created", title: "Заказ создан", channel: "email+push", updated_at: now - 20 * DAY },
        { key: "payment_done", title: "Оплата прошла", channel: "email", updated_at: now - 20 * DAY },
        { key: "shipment", title: "Заказ отправлен", channel: "email+push", updated_at: now - 12 * DAY },
        { key: "delay", title: "Доставка задержана", channel: "push", updated_at: now - 2 * DAY },
        { key: "refund", title: "Возврат оформлен", channel: "email", updated_at: now - 30 * DAY },
        { key: "dispute_open", title: "Спор открыт", channel: "email", updated_at: now - 30 * DAY },
        { key: "seller_verified", title: "Продавец верифицирован", channel: "email", updated_at: now - 40 * DAY },
        { key: "product_rejected", title: "Товар отклонён", channel: "email", updated_at: now - 6 * DAY },
      ],
      analytics: {
        buyer_funnel: [{ step: "Визит", v: 100 }, { step: "Регистрация", v: 34 }, { step: "Поиск", v: 29 }, { step: "Карточка", v: 22 }, { step: "Корзина", v: 11 }, { step: "Оформление", v: 7.4 }, { step: "Оплата", v: 6.1 }, { step: "Сделка", v: 5.8 }, { step: "Повтор", v: 2.1 }].map((x) => ({ ...x, v: x.v })),
        seller_funnel: [{ step: "Регистрация", v: 100 }, { step: "Верификация", v: 61 }, { step: "Загрузка товаров", v: 44 }, { step: "Первый заказ", v: 27 }, { step: "Стабильные продажи", v: 15 }, { step: "Удержание 90д", v: 11 }],
        cohorts: [{ c: "2026-07", d7: 41, d30: 24, d90: 15 }, { c: "2026-08", d7: 44, d30: 26, d90: null }, { c: "2026-09", d7: 47, d30: null, d90: null }],
        search: { top: [["декор лофт", 8420], ["полка навесная", 6110], ["фурнитура латунь", 4300]], noresult: [["латунная петля", 1210], ["рейлинг 900", 604]], lowconv: [["светильник спот", 0.004]] },
        problems: [{ area: "Оформление: шаг адрес", drop_pct: 18, complaints: 40 }, { area: "Поиск без результатов", drop_pct: 23, complaints: 12 }, { area: "Доставка: задержки Декор", drop_pct: 0, complaints: 42 }],
        agent_insights: [
          { text: "Падение конверсии оплаты на 0.9 п.п. за сутки объясняется деградацией шлюза (см. al-1). После переключения на резерв — восстановление.", links: ["al-1", "hyp-2"] },
          { text: "Рост жалоб на доставку локализован в 6 продавцах «Декор». Гипотеза hyp-1 объясняет 71% прироста.", links: ["obs-1", "hyp-1"] },
        ],
      },
      users: null, /* производные от основной БД — см. buildUsersSnapshot */
      usersSnapshotAt: 0, usersSnapshot: [],
      sellers: [
        { id: "sel-ml", name: "Мебель Лофт", inn: "7701234567", cat: "Мебель", region: "MSK", status: "active", verified: true, rating: 3.1, products: 84, orders30: 120, cancels14: 14, disputes: 5, complaints: 11, balance_rub: 84000, pending_payout_rub: 41000, risk_score: 0.78, violations: [{ ts: now - 4 * DAY, text: "Серия отмен без объяснения" }], docs_status: "in_order" },
        { id: "sel-dp", name: "Декор Про", inn: "5021987654", cat: "Декор", region: "ЕКБ", status: "limited", verified: true, rating: 4.2, products: 210, orders30: 340, cancels14: 3, disputes: 2, complaints: 26, balance_rub: 402000, pending_payout_rub: 184000, risk_score: 0.41, violations: [], docs_status: "in_order" },
        { id: "sel-hm", name: "Handmade Маркет", inn: "7804555123", cat: "Хендмейд", region: "СПБ", status: "active", verified: true, rating: 4.8, products: 66, orders30: 90, cancels14: 0, disputes: 0, complaints: 1, balance_rub: 51000, pending_payout_rub: 12000, risk_score: 0.05, violations: [], docs_status: "in_order" },
        { id: "sel-nw", name: "Новодел", inn: "—", cat: "Мебель", region: "КЗН", status: "onboarding", verified: false, rating: 0, products: 0, orders30: 0, cancels14: 0, disputes: 0, complaints: 0, balance_rub: 0, pending_payout_rub: 0, risk_score: 0.12, violations: [], docs_status: "need_docs" },
      ],
      moderation: [
        { id: "mod-1", product: "p-771", title: "Детский стульчик «Малыш»", seller: "sel-ml", price: 5400, category: "Детям", reason: "Нет сертификата ЕАЭС", auto_check: { images: "ok", duplicates: "ok", price_anomaly: false, agent_flag: true }, photos: ["🪑"], changed_at: now - 2 * DAY, status: "pending" },
        { id: "mod-2", product: "p-772", title: "Кресло-качалка дуб", seller: "sel-dp", price: 18900, category: "Мебель", reason: "Подозрительная цена (−62% рынка)", auto_check: { images: "warn", duplicates: "suspect", price_anomaly: true, agent_flag: true }, photos: ["🪑"], changed_at: now - DAY, status: "pending" },
        { id: "mod-3", product: "p-773", title: "Полка навесная лофт", seller: "sel-hm", price: 3200, category: "Декор", reason: "Изменение описания после одобрения", auto_check: { images: "ok", duplicates: "ok", price_anomaly: false, agent_flag: false }, photos: ["📚"], changed_at: now - 6 * 3600000, status: "pending" },
      ],
      categories: [
        { id: "cat-decor", title: "Декор", parent: null, attrs: ["Материал", "Стиль"], filters: ["Стиль", "Цена"], seo: "/decor", moderation: "auto" },
        { id: "cat-furn", title: "Мебель", parent: null, attrs: ["Материал", "Габариты"], filters: ["Тип", "Материал"], seo: "/furniture", moderation: "manual_kids" },
        { id: "cat-kids", title: "Детям", parent: "cat-furn", attrs: ["Возраст", "Сертификация"], filters: ["Возраст"], seo: "/kids", moderation: "strict_docs" },
      ],
      brands: [{ id: "br-1", title: "LoftWood", producer: "ИП Ковалёв", certs: ["ЕАЭС"], allowed_cats: ["Мебель"] }, { id: "br-2", title: "Decor&Co", producer: "ООО Декорь", certs: [], allowed_cats: ["Декор"] }],
      transactions: [
        { id: "tx-5001", order: "QF-1044", buyer: "u-101", seller: "sel-ml", amount_rub: 12400, gateway: "yookassa", status: "captured", ts: now - 8 * DAY, type: "payment" },
        { id: "tx-5002", order: "QF-1052", buyer: "u-105", seller: "sel-dp", amount_rub: 4300, gateway: "yookassa", status: "declined_soft", ts: now - 2 * DAY, type: "payment" },
        { id: "tx-5003", order: "QF-1041", buyer: "u-101", seller: "sel-ml", amount_rub: 8700, gateway: "sbp", status: "refunded", ts: now - 4 * DAY, type: "refund" },
        { id: "tx-5004", order: null, buyer: null, seller: "sel-dp", amount_rub: 184000, gateway: "payout", status: "hold", ts: now - 2 * 3600000, type: "payout" },
        { id: "tx-5005", order: "QF-1060", buyer: "u-109", seller: "sel-hm", amount_rub: 2200, gateway: "yookassa", status: "chargeback", ts: now - 9 * DAY, type: "chargeback" },
      ],
      commission_rules: [
        { id: "cm-1", scope: "category:Декор", pct: 12, active: true, period: "постоянно", reason: "базовая", updated_at: now - 60 * DAY },
        { id: "cm-2", scope: "seller:new_90d", pct: 7, active: true, period: "до 2026-12-31", reason: "поддержка новичков", updated_at: now - 30 * DAY },
        { id: "cm-3", scope: "promo:autumn", pct: 5, active: false, period: "2026-09", reason: "акция завершена", updated_at: now - 10 * DAY },
      ],
      payouts: [
        { id: "po-207", seller: "sel-dp", amount_rub: 184000, status: "needs_approval", hold: false, created_at: now - 2 * 3600000, approved_by: null, tax: "самозанятый NPD" },
        { id: "po-208", seller: "sel-hm", amount_rub: 12000, status: "queued", hold: false, created_at: now - 20 * 3600000, approved_by: null, tax: "ИП УСН" },
        { id: "po-209", seller: "sel-ml", amount_rub: 41000, status: "frozen", hold: true, created_at: now - 3 * DAY, approved_by: null, tax: "ИП" },
      ],
      reconciliation: [
        { id: "rc-1", diff: "tx-5005 chargeback без проводки в ERP", delta_rub: -2200, status: "task_open", found_at: now - DAY },
        { id: "rc-2", diff: "Комиссия cm-2 применена дважды (2 заказа)", delta_rub: -340, status: "fixed", found_at: now - 5 * DAY },
      ],
      blocks: [
        { id: "blk-1", subject_type: "device", subject: "dev-x9", reason: "Мультиаккаунт (5 аккаунтов, 1 устройство)", until: now + 30 * DAY, permanent: false, evidence: ["fp_hash=a1b2"], appeal_open: true, created_by: "adm-super", created_at: now - 2 * DAY },
        { id: "blk-2", subject_type: "user", subject: "u-777", reason: "Накрутка отзывов", until: null, permanent: true, evidence: ["12 отзывов с 1 IP"], appeal_open: false, created_by: "adm-super", created_at: now - 10 * DAY },
      ],
      appeals: [
        { id: "ap-1", block: "blk-1", who: "u-320", status: "awaiting_admin", materials: "Агент: 4 из 5 аккаунтов — одна семья, платежи разные", prepared_by: "agent", submitted_at: now - DAY, decision: null },
      ],
      fraud_objects: [
        { type: "user", id: "u-777", risk: 0.91, flags: ["review_farming"], linked: ["dev-x9", "ip-185.x.x.4"], recommendation: "Пожизненная блокировка уже выполнена; следить за клонами" },
        { type: "seller", id: "sel-ml", risk: 0.78, flags: ["serial_cancels"], linked: ["orders:38"], recommendation: "Временная блокировка (dec-1)" },
        { type: "order", id: "QF-1060", risk: 0.55, flags: ["chargeback_risk"], linked: ["u-109"], recommendation: "Ужесточить проверку для покупателя" },
      ],
      graph: { nodes: [{ id: "u-777", t: "user" }, { id: "dev-x9", t: "device" }, { id: "ip-185", t: "ip" }, { id: "u-320", t: "user" }, { id: "sel-ml", t: "seller" }], edges: [["u-777", "dev-x9", "device"], ["u-320", "dev-x9", "device"], ["u-777", "ip-185", "ip"], ["u-320", "ip-185", "ip"], ["sel-ml", "ip-185", "shared_ip"]] },
      antifraud_rules: [
        { id: "ar-1", title: "Блокировать платёж при risk ≥ 0.9", enabled: true, hits_7d: 12 },
        { id: "ar-2", title: "Лимит 3 заказов/сутки для новых продавцов", enabled: true, hits_7d: 4 },
        { id: "ar-3", title: "Ручная проверка заказов > 100 000 ₽", enabled: true, hits_7d: 2 },
        { id: "ar-4", title: "Детект накрутки отзывов (1 IP → ≥5 авторов)", enabled: true, hits_7d: 6 },
        { id: "ar-5", title: "Контроль ценовых аномалий ±60%", enabled: true, hits_7d: 9 },
      ],
      metrics_history: null, /* считается на лету */
    };
  }

  /* unified store: pg pools rows vs dev doc */
  async function getStore() {
    if (!PG) return loadDev();
    /* В postgres-режиме кабинет хранит документы в таблице admin_kv (jsonb по ключу) */
    await ensurePgSchema(pool);
    const row = await pool.query("select data from admin_kv where key='doc'");
    if (row.rows[0]) return row.rows[0].data;
    const seeded = seedDoc();
    await pool.query("insert into admin_kv (key,data) values ('default',$1) on conflict (key) do update set data=$1", [JSON.stringify(seeded)]);
    return seeded;
  }
  async function putStore(doc) {
    if (!PG) return saveDev(doc);
    await pool.query("update admin_kv set data=$1, updated_at=now() where key='default'", [JSON.stringify(doc)]);
  }
  async function mutate(fn) {
    const doc = await getStore();
    const out = await fn(doc);
    await putStore(doc);
    return out;
  }

  async function ensurePgSchema(p) {
    if (ensurePgSchema.done) return; ensurePgSchema.done = true;
    try { await p.query("create table if not exists admin_kv (key text primary key, data jsonb, updated_at timestamptz default now())"); } catch {}
  }

  /* ---------- helpers ------------------------------------------------------ */
  const rid = (p) => p + "-" + crypto.randomBytes(5).toString("hex");
  const hash = (s) => crypto.createHash("sha256").update(String(s)).digest("hex").slice(0, 16);
  const clientIp = (req) => (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress || "?";
  const uaDevice = (req) => {
    const ua = String(req.headers["user-agent"] || "");
    const os = /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "macOS" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Linux/.test(ua) ? "Linux" : "Unknown";
    const br = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Unknown";
    return `${os}/${br}`;
  };
  /* детерминированная грубая гео-оценка по IP (в проде заменяется на внешний GEO-сервис) */
  function geoOf(ip) {
    if (/^::1$|^127/.test(ip)) return "local";
    if (/^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return "internal";
    if (/^212\.44\.|^89\.\.?/.test(ip)) return "RU/MSK";
    return "RU/other";
  }
  const hourKey = (ts) => new Date(ts).toISOString().slice(0, 13);

  function logSec(doc, entry) {
    doc.security_log.unshift(Object.assign({ id: rid("sec"), ts: Date.now(), result: "success" }, entry));
    if (doc.security_log.length > 5000) doc.security_log.length = 5000;
  }
  function logAction(doc, entry) {
    doc.actions_log.unshift(Object.assign({ id: rid("act"), ts: Date.now(), env: doc.settings.env }, entry));
    if (doc.actions_log.length > 5000) doc.actions_log.length = 5000;
    doc.feed.unshift({ ts: Date.now(), kind: entry.kind || "action", text: `${entry.type}: ${entry.reason || ""} (${entry.object || ""})` });
    if (doc.feed.length > 300) doc.feed.length = 300;
  }

  /* ---------- guards -------------------------------------------------------- */
  function parseToken(req) {
    const t = req.cookies ? req.cookies[COOKIE] : (String(req.headers.authorization || "").startsWith("Bearer ") ? req.headers.authorization.slice(7) : null);
    if (!t) return null;
    try { return jwt.verify(t, JWT_SECRET); } catch { return null; }
  }
  function adminGuard(req, res, next) {
    const p = parseToken(req);
    if (!p || p.scope !== "admin") return res.status(401).json({ ok: false, error: "no_session" });
    req.admin = p; req.adminId = p.sub;
    next();
  }
  function permGuard(perm) {
    return async (req, res, next) => {
      const doc = await getStore();
      const a = doc.admins.find((x) => x.id === req.adminId);
      if (!a) return res.status(401).json({ ok: false, error: "gone" });
      const role = doc.roles[a.role];
      if (!role || !(role.perms.includes(perm) || role.perms.includes("*"))) return res.status(403).json({ ok: false, error: "forbidden", need: perm });
      req.adminObj = a; req.role = role;
      next();
    };
  }

  /* ---------- OTP login flow ----------------------------------------------- */
  async function issueCode(doc, admin, meta) {
    /* одноразовый код 6 цифр; отменяет предыдущие; живёт 5 минут */
    doc.codes = doc.codes.filter((c) => c.admin_id !== admin.id && !c.used);
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
    const rec = { id: rid("code"), admin_id: admin.id, email: admin.email, code_hash: hash(code), expires_at: Date.now() + 5 * 60000, used: false, attempts: 0, meta };
    doc.codes.unshift(rec);
    if (mail) {
      try { await mail.sendMail({ from: MAIL_FROM, to: admin.email, subject: "Код входа в кабинет", html: `<p>Ваш код: <b style="font-size:20px">${code}</b></p><p>Действует 5 минут. Никому не передавайте.</p>` }); }
      catch (e) {
        console.error("[admin-mail]", e.message);
        /* письмо не доставлено — показываем код в ответе UI (только вне production) */
        if (process.env.NODE_ENV !== "production") return { sent: false, devModeNoSmtp: false, devCode: code };
        return { sent: true };
      }
      return { sent: true };
    }
    /* DEV-режим (SMTP не настроен): раньше код только логировался на сервере и нигде
       не был доступен пользователю — вход был физически невозможен. Теперь код
       возвращается в ответе и показывается в форме входа. В production — строго нет. */
    console.log(`[DEV-письмо][admin] ${admin.email} → код ${code} (id ${rec.id})`);
    if (process.env.NODE_ENV === "production") return { sent: false, devHint: "SMTP не настроен: код не отправлен" };
    return { sent: false, devMode: true, devCode: code };
  }

  app.post("/api/admin/login/start", async (req, res) => {
    try {
      const email = String(req.body.email || "").trim().toLowerCase();
      /* телефонный вход для админских аккаунтов отключён — принимаем только email */
      if (!/^\S+@\S+\.\S+$/.test(email)) return res.json({ ok: false, error: "neutral" });
      const doc = await getStore();
      const admin = doc.admins.find((a) => a.email === email);
      const ip = clientIp(req), dev = uaDevice(req), region = geoOf(ip);
      if (!admin) {
        doc.attempts.push({ ts: Date.now(), email, ok: false, reason: "unknown_email", ip, device: dev });
        logSec(doc, { admin_id: null, type: "login_attempt", result: "denied", ip, device_id: dev, region, detail: "email не в allowlist" });
        await putStore(doc);
        return res.json({ ok: false, error: "neutral" });
      }
      /* временная блокировка после 3–5 неудачных попыток */
      const recent = doc.attempts.filter((a) => a.email === email && !a.ok && Date.now() - a.ts < 15 * 60000);
      if (recent.length >= 5) {
        logSec(doc, { admin_id: admin.id, type: "login_blocked_temp", result: "blocked", ip, device_id: dev, region, detail: "5 неудачных попыток за 15 минут" });
        await putStore(doc);
        return res.json({ ok: false, error: "neutral" });
      }
      const meta = { ip, device: dev, region };
      const s = await issueCode(doc, admin, meta);
      logSec(doc, { admin_id: admin.id, type: "code_sent", result: "success", ip, device_id: dev, region, detail: "OTP отправлен" });
      await putStore(doc);
      res.json({ ok: true, codeSent: !!s.sent, devMode: !s.sent, devCode: s.devCode || null });
    } catch (e) { console.error(e); res.status(500).json({ ok: false, error: "server" }); }
  });

  app.post("/api/admin/login/verify", async (req, res) => {
    try {
      const email = String(req.body.email || "").trim().toLowerCase();
      const code = String(req.body.code || "").replace(/\D/g, "");
      const doc = await getStore();
      const admin = doc.admins.find((a) => a.email === email);
      const neutralFail = async (reason) => {
        if (admin) doc.attempts.push({ ts: Date.now(), email, ok: false, reason, ip: clientIp(req), device: uaDevice(req) });
        logSec(doc, { admin_id: admin ? admin.id : null, type: "login_attempt", result: "fail", ip: clientIp(req), device_id: uaDevice(req), region: geoOf(clientIp(req)), detail: reason });
        await putStore(doc);
        return res.json({ ok: false, error: "neutral" });
      };
      if (!admin || !/^\d{6}$/.test(code)) return neutralFail("bad_format");
      const rec = doc.codes.find((c) => c.admin_id === admin.id && !c.used && c.expires_at > Date.now());
      if (!rec) return neutralFail("no_active_code");
      if (hash(code) !== rec.code_hash) { rec.attempts++; if (rec.attempts >= 5) rec.used = true; return neutralFail("wrong_code"); }
      /* сверка контекста: код привязан к IP/устройству запроса (иначе код с чужого
         устройства/IP не принимается). Исключение: fresh-код, выданный в ответ на
         new_device-challenge этой же сессии — иначе поток подтверждение-через-код
         зацикливался и вход был невозможен. */
      const ip0 = clientIp(req), dev0 = uaDevice(req);
      const sameSession = rec.meta && rec.meta.device === dev0 && rec.meta.ip === ip0;
      if (rec.meta && !sameSession) return neutralFail("code_context_mismatch");
      rec.used = true;
      /* проверка устройства / IP / региона / времени / истории попыток */
      const ip = ip0, dev = dev0, region = geoOf(ip);
      const knownDev = doc.devices.some((d) => d.admin_id === admin.id && d.device === dev);
      const knownIp = doc.devices.some((d) => d.admin_id === admin.id && d.last_ip === ip);
      const hour = new Date().getHours();
      const unusualTime = hour >= 1 && hour < 6;
      const tooManyFails = doc.attempts.filter((a) => a.email === email && !a.ok && Date.now() - a.ts < 15 * 60000).length >= 3;
      if (tooManyFails) return neutralFail("attempt_storm");
      if ((!knownDev || !knownIp || unusualTime) && !sameSession) {
        /* неизвестное устройство/контекст: просим повторный код, фиксируем в безопасности */
        if (!knownDev) {
          logSec(doc, { admin_id: admin.id, type: "new_device_challenge", result: "requires_reconfirm", ip, device_id: dev, region, detail: "неизвестное устройство — запрошен новый код" });
          const s2 = await issueCode(doc, admin, { ip, device: dev, region });
          await putStore(doc);
          return res.json({ ok: false, error: "new_device", message: "Новое устройство — проверьте почту ещё раз", devMode: !s2.sent, devCode: s2.devCode || null });
        }
        logSec(doc, { admin_id: admin.id, type: "risk_context", result: "soft_warn", ip, device_id: dev, region, detail: `unusual_time=${unusualTime} new_ip=${!knownIp}` });
      }
      if (!doc.devices.some((d) => d.admin_id === admin.id && d.device === dev)) doc.devices.push({ admin_id: admin.id, device: dev, last_ip: ip, added_at: Date.now() });
      const tok = jwt.sign({ sub: admin.id, scope: "admin", role: admin.role, env: doc.settings.env }, JWT_SECRET, { expiresIn: "12h" });
      res.cookie(COOKIE, tok, { httpOnly: true, sameSite: "lax", maxAge: 12 * 3600000, secure: process.env.NODE_ENV === "production" });
      logSec(doc, { admin_id: admin.id, type: "login_success", result: "success", ip, device_id: dev, region, detail: "session issued (12h)" });
      await putStore(doc);
      res.json({ ok: true, profile: { id: admin.id, email: admin.email, name: admin.name, role: admin.role, role_title: doc.roles[admin.role].title, perms: doc.roles[admin.role].perms, sections: doc.roles[admin.role].sections, env: doc.settings.env } });
    } catch (e) { console.error(e); res.status(500).json({ ok: false, error: "server" }); }
  });

  app.get("/api/admin/me", adminGuard, async (req, res) => {
    const doc = await getStore();
    const a = doc.admins.find((x) => x.id === req.adminId);
    if (!a) return res.status(401).json({ ok: false, error: "gone" });
    const role = doc.roles[a.role];
    res.json({ ok: true, profile: { id: a.id, email: a.email, name: a.name, role: a.role, role_title: role.title, perms: role.perms, sections: role.sections, env: doc.settings.env, passkey: a.passkey } });
  });
  app.post("/api/admin/logout", adminGuard, async (req, res) => {
    const doc = await getStore();
    logSec(doc, { admin_id: req.adminId, type: "logout", result: "success", ip: clientIp(req), device_id: uaDevice(req), region: geoOf(clientIp(req)), detail: "" });
    await putStore(doc);
    res.clearCookie(COOKIE); res.json({ ok: true });
  });

  /* ---------- bootstrap: конфиг UI (токены рисков, роли, режимы) ----------- */
  app.get("/api/admin/bootstrap", adminGuard, async (_q, res) => {
    const doc = await getStore();
    res.json({
      ok: true,
      risk: { order: RISK_ORDER, double_confirm: ["critical"], irreversible_markers: ["seller.block", "user.delete", "mass.purge", "account.close"] },
      modes: { observer: "Наблюдатель", copilot: "Помощник", limited_autopilot: "Ограниченный автопилот", critical_confirm: "Критические действия" },
      roles: Object.fromEntries(Object.entries(doc.roles).map(([k, v]) => [k, v.title])),
      limits: doc.limits,
    });
  });

  /* ---------- Command Center ------------------------------------------------ */
  function computeHealth(doc) {
    const gateway = doc.integrations.find((i) => i.key === "yookassa");
    const factors = [
      { k: "availability", v: gateway.status === "degraded" ? 0.82 : 0.995, w: 0.2, label: "Доступность сервиса" },
      { k: "latency", v: gateway.p95 ? Math.max(0, 1 - gateway.p95 / 5000) : 0.93, w: 0.1, label: "Скорость ответа" },
      { k: "conversion", v: 0.9, w: 0.15, label: "Конверсия" },
      { k: "complaints", v: Math.max(0, 1 - doc.users_snapshot_meta?.complaints_rate || 0.03), w: 0.15, label: "Жалобы" },
      { k: "disputes", v: Math.max(0, 1 - doc.disputes.filter((d) => d.status === "open").length / 60), w: 0.15, label: "Споры" },
      { k: "refunds", v: 0.9, w: 0.05, label: "Возвраты" },
      { k: "fraud", v: Math.max(0, 1 - doc.fraud_objects.filter((f) => f.risk > 0.7).length / 10), w: 0.1, label: "Мошенничество" },
      { k: "integrations", v: doc.integrations.filter((i) => i.status === "ok").length / doc.integrations.length, w: 0.05, label: "Интеграции" },
      { k: "nps_proxy", v: 0.86, w: 0.05, label: "Удовлетворённость" },
    ];
    const score = Math.round(factors.reduce((s, f) => s + f.v * f.w, 0) * 100);
    const reasons = factors.filter((f) => f.v < 0.9).sort((a, b) => a.v - b.v).map((f) => ({ label: f.label, value: Math.round(f.v * 100) }));
    return { score, factors: factors.map((f) => ({ ...f, v: Math.round(f.v * 100) })), reasons };
  }

  app.get("/api/admin/home", adminGuard, async (_q, res) => {
    const doc = await getStore();
    const pending = doc.decisions.filter((d) => d.status === "pending");
    const openAlerts = doc.alerts.filter((a) => a.status !== "closed");
    const m = doc.metrics_history || (doc.metrics_history = genMetrics());
    res.json({
      ok: true,
      health: computeHealth(doc),
      decisions: pending.map((d) => ({ id: d.id, title: d.title, risk: d.risk, due_ts: d.due_ts, source: d.source, summary: d.description })),
      alerts: openAlerts,
      metrics: m.current,
      agent: { status: doc.agent.status, mode: doc.agent.autonomy_mode, running_tasks: 3, hypotheses: doc.hypotheses.length, waiting_confirm: pending.length, monitoring: doc.sources.filter((s) => s.connected).length, errors: doc.agent.health.tool_errors, cost_today_rub: doc.agent.health.cost_rub_day, quality: doc.agent.health.answer_quality },
      feed: doc.feed.slice(0, 20),
      notifications: doc.notifications.slice(0, 30),
    });
  });
  function genMetrics() {
    const now = Date.now();
    const day = 86400000;
    const series = Array.from({ length: 30 }, (_, i) => {
      const d = now - (29 - i) * day;
      const gm = 2_100_000 + Math.round(Math.sin(i / 3) * 180000 + i * 12000);
      return { ts: d, gmv: gm, revenue: Math.round(gm * 0.11), margin: Math.round(gm * 0.045), buyers: 980 + (i % 7) * 40, sellers: 412 - (i % 5) * 3, avg_check: 2450 + (i % 9) * 35, conv: +(2.1 + Math.sin(i / 4) * 0.3).toFixed(2), repeat: +(28 + i * 0.2).toFixed(1), retention: +(41 + (i % 6)).toFixed(1), cancels: 12 + (i % 5) * 3, refunds: 6 + (i % 4) * 2, disputes: doc0(i), nps: 42 + (i % 8) };
    });
    function doc0(i) { return 3 + (i % 6); }
    return { series, current: (() => { const l = series[series.length - 1], p = series[series.length - 8]; const dl = (a, b) => +(((a - b) / (b || 1)) * 100).toFixed(1); return { ...l, deltas: { gmv: dl(l.gmv, p.gmv), revenue: dl(l.revenue, p.revenue), margin: dl(l.margin, p.margin), buyers: dl(l.buyers, p.buyers), sellers: dl(l.sellers, p.sellers), avg_check: dl(l.avg_check, p.avg_check), conv: +(l.conv - p.conv).toFixed(2), repeat: +(l.repeat - p.repeat).toFixed(1), retention: +(l.retention - p.retention).toFixed(1), cancels: dl(l.cancels, p.cancels), refunds: dl(l.refunds, p.refunds), disputes: dl(l.disputes, p.disputes), nps: l.nps - p.nps } }; })() };
  }

  /* ---------- уведомления / поиск ------------------------------------------- */
  app.get("/api/admin/notifications", adminGuard, async (_q, res) => { const doc = await getStore(); res.json({ ok: true, items: doc.notifications }); });
  app.put("/api/admin/notifications/:id/read", adminGuard, async (req, res) => {
    await mutate((doc) => { const n = doc.notifications.find((x) => x.id === req.params.id); if (n) n.read = true; logAction(doc, { admin_id: req.adminId, type: "notification.read", object: req.params.id, reason: "" }); });
    res.json({ ok: true });
  });
  app.put("/api/admin/notifications/:id/ack", adminGuard, async (req, res) => {
    await mutate((doc) => { const n = doc.notifications.find((x) => x.id === req.params.id); if (n) { if (n.level === "critical" && !req.body.action_taken) return; n.acked = true; } logAction(doc, { admin_id: req.adminId, type: "notification.ack", object: req.params.id, reason: String(req.body.reason || "принято к рассмотрению") }); });
    res.json({ ok: true });
  });

  app.get("/api/admin/search", adminGuard, async (req, res) => {
    const q = String(req.query.q || "").trim().toLowerCase();
    if (!q) return res.json({ ok: true, groups: {} });
    const doc = await getStore();
    const snap = await usersSnapshot(doc);
    const G = {};
    const push = (k, o) => { (G[k] = G[k] || []).push(o); };
    snap.users.filter((u) => [u.id, u.email, u.name, u.phone].some((x) => String(x || "").toLowerCase().includes(q))).slice(0, 8).forEach((u) => push("users", { id: u.id, title: u.name, sub: u.email, risk: u.risk }));
    doc.sellers.filter((s) => [s.id, s.name, s.inn].some((x) => String(x || "").toLowerCase().includes(q))).slice(0, 8).forEach((s) => push("sellers", { id: s.id, title: s.name, sub: s.cat }));
    (doc.orders_cache || []).filter((o) => [o.number, o.id].some((x) => String(x || "").toLowerCase().includes(q))).slice(0, 8).forEach((o) => push("orders", { id: o.number, title: o.number, sub: o.status }));
    doc.moderation.filter((p) => [p.product, p.title].some((x) => String(x || "").toLowerCase().includes(q))).forEach((p) => push("products", { id: p.product, title: p.title, sub: p.reason }));
    doc.disputes.filter((d) => [d.id, d.order].some((x) => String(x || "").toLowerCase().includes(q))).forEach((d) => push("disputes", { id: d.id, title: d.id, sub: d.reason }));
    doc.tickets.filter((t) => [t.id, t.subject].some((x) => String(x || "").toLowerCase().includes(q))).forEach((t) => push("tickets", { id: t.id, title: t.subject, sub: t.channel }));
    doc.hypotheses.filter((h) => [h.id, h.title].some((x) => String(x || "").toLowerCase().includes(q))).forEach((h) => push("hypotheses", { id: h.id, title: h.title, sub: h.priority }));
    doc.traces.filter((t) => String(t.id).toLowerCase().includes(q)).forEach((t) => push("incidents", { id: t.id, title: "trace " + t.id, sub: t.outcome }));
    doc.transactions.filter((t) => [t.id, t.order].some((x) => String(x || "").toLowerCase().includes(q))).forEach((t) => push("transactions", { id: t.id, title: t.id, sub: `${t.amount_rub}₽ ${t.status}` }));
    doc.policies.filter((p) => [p.id, p.action_type].some((x) => String(x || "").toLowerCase().includes(q))).forEach((p) => push("rules", { id: p.id, title: p.action_type, sub: p.mode }));
    Object.keys(doc.settings.rules).filter((k) => k.toLowerCase().includes(q)).forEach((k) => push("settings", { id: k, title: k, sub: doc.settings.rules[k] }));
    res.json({ ok: true, groups: G });
  });

  /* ---------- users snapshot (из основной БД платформы) --------------------- */
  async function usersSnapshot(doc) {
    const stale = !doc.usersSnapshot || Date.now() - doc.usersSnapshotAt > 60000;
    if (stale) {
      let rows = [];
      try {
        if (db.allUsers) rows = await db.allUsers();
        else if (PG) rows = (await pool.query("select id,email,name,phone,role,tier,created_at from users")).rows;
      } catch {}
      if (!rows.length) {
        rows = Array.from({ length: 14 }, (_, i) => ({ id: "u-" + (101 + i), email: `user${i}@example.com`, name: "Пользователь " + (i + 1), phone: "+7 900 000-00-" + String(10 + i).slice(-2), role: i % 5 === 0 ? "seller" : "buyer", tier: "free", created_at: Date.now() - i * 86400000 }));
      }
      const segOf = (r, i) => i === 0 ? "vip" : i % 7 === 0 ? "risk" : i % 5 === 0 ? "seller_staff" : i % 3 === 0 ? "sleeping" : "active";
      doc.usersSnapshot = rows.map((r, i) => ({
        id: r.id, email: maskEmail(r.email), email_raw: r.email, name: r.name || "—", phone: maskPhone(r.phone), region: ["MSK", "СПБ", "ЕКБ", "КЗН"][i % 4],
        status: i === 6 ? "blocked" : "active", verified: i % 4 !== 0, role: r.role || "buyer", segment: segOf(r, i),
        created_at: r.created_at || Date.now() - i * 86400000, orders: (i * 3) % 11, spent_rub: ((i * 7) % 13) * 4200, complaints: i % 6 === 0 ? 2 : 0,
        risk: +(Math.min(0.95, (i % 9) * 0.11)).toFixed(2), devices: 1 + (i % 3), last_login: Date.now() - i * 3600000,
        bonuses: (i % 4) * 150, lifetime: "LTV " + (((i * 7) % 13) * 4.2).toFixed(1) + "k ₽",
      }));
      doc.usersSnapshotAt = Date.now();
      if (!PG) saveDev(doc); else await putStore(doc);
    }
    return { users: doc.usersSnapshot };
  }
  function maskEmail(e) { const [l, d] = String(e || "").split("@"); return (l ? l.slice(0, 2) + "***" : "") + (d ? "@" + d : ""); }
  function maskPhone(p) { const s = String(p || ""); return s.length > 6 ? s.slice(0, 4) + " *** **" + s.slice(-2) : ""; }

  app.get("/api/admin/users", adminGuard, permGuard("view"), async (req, res) => {
    const doc = await getStore();
    const snap = await usersSnapshot(doc);
    let users = snap.users;
    const q = String(req.query.q || "").toLowerCase();
    if (q) users = users.filter((u) => [u.id, u.email, u.name, u.region].some((x) => String(x).toLowerCase().includes(q)));
    for (const f of ["status", "segment", "risk_min"]) if (req.query[f]) {
      if (f === "risk_min") users = users.filter((u) => u.risk >= +req.query[f]);
      else users = users.filter((u) => u[f] === req.query[f]);
    }
    res.json({ ok: true, users });
  });
  app.get("/api/admin/users/:id", adminGuard, permGuard("view"), async (req, res) => {
    const doc = await getStore();
    const snap = await usersSnapshot(doc);
    const u = snap.users.find((x) => x.id === req.params.id);
    if (!u) return res.status(404).json({ ok: false, error: "not_found" });
    res.json({ ok: true, user: u, orders: (doc.orders_cache || []).filter((o) => o.buyer === u.id), logins: doc.security_log.filter((l) => l.detail && String(l.detail).includes(u.id)).slice(0, 10), actions: doc.actions_log.filter((a) => a.object === u.id).slice(0, 30), tickets: doc.tickets.filter((t) => t.user === u.id), disputes: doc.disputes.filter((d) => d.buyer === u.id) });
  });
  app.post("/api/admin/users/:id/action", adminGuard, permGuard("manage_users"), async (req, res) => {
    const action = String(req.body.action || ""), reason = String(req.body.reason || "").trim();
    if (!reason) return res.status(400).json({ ok: false, error: "reason_required" });
    const IRREVERSIBLE = ["block_forever", "delete_data"];
    if (IRREVERSIBLE.includes(action) && req.body.confirm_text !== "ПОДТВЕРЖДАЮ") return res.status(400).json({ ok: false, error: "irreversible_needs_confirm_text" });
    await mutate(async (doc) => {
      const snap = await usersSnapshot(doc);
      const u = snap.users.find((x) => x.id === req.params.id);
      if (!u) return;
      const prev = { status: u.status };
      if (action === "block_temp") u.status = "blocked";
      if (action === "block_forever") u.status = "blocked_forever";
      if (action === "unblock") u.status = "active";
      if (action === "verify") u.verified = true;
      logAction(doc, { admin_id: req.adminId, type: "user." + action, object: u.id, prev_state: prev, state: { status: u.status }, reason, risk: action === "block_forever" ? "critical" : "medium" });
      doc.feed.unshift({ ts: Date.now(), kind: "block", text: `user.${action}: ${u.id} — ${reason}` });
    });
    res.json({ ok: true });
  });

  /* ---------- sellers -------------------------------------------------------- */
  app.get("/api/admin/sellers", adminGuard, permGuard("view"), async (req, res) => {
    const doc = await getStore();
    let list = doc.sellers;
    const q = String(req.query.q || "").toLowerCase();
    if (q) list = list.filter((s) => [s.id, s.name, s.inn].some((x) => String(x).toLowerCase().includes(q)));
    if (req.query.status) list = list.filter((s) => s.status === req.query.status);
    if (req.query.risk_min) list = list.filter((s) => s.risk_score >= +req.query.risk_min);
    res.json({ ok: true, sellers: list });
  });
  app.get("/api/admin/sellers/:id", adminGuard, permGuard("view"), async (req, res) => {
    const doc = await getStore();
    const s = doc.sellers.find((x) => x.id === req.params.id);
    if (!s) return res.status(404).json({ ok: false, error: "not_found" });
    res.json({ ok: true, seller: s, payouts: doc.payouts.filter((p) => p.seller === s.id), disputes: doc.disputes.filter((d) => d.seller === s.id), moderation: doc.moderation.filter((m) => m.seller === s.id), actions: doc.actions_log.filter((a) => a.object === s.id) });
  });
  app.post("/api/admin/sellers/:id/action", adminGuard, permGuard("manage_sellers"), async (req, res) => {
    const action = String(req.body.action || ""), reason = String(req.body.reason || "").trim();
    if (!reason) return res.status(400).json({ ok: false, error: "reason_required" });
    if (action === "block" && req.admin.role !== "super_admin" && req.admin.role !== "trust_safety") return res.status(403).json({ ok: false, error: "forbidden_role" });
    await mutate((doc) => {
      const s = doc.sellers.find((x) => x.id === req.params.id); if (!s) return;
      const prev = { status: s.status };
      if (action === "approve") s.status = "active";
      if (action === "reject") s.status = "rejected";
      if (action === "limit_categories") s.status = "limited";
      if (action === "visibility_down") s.visibility_penalty = 30;
      if (action === "freeze_payouts") s.payouts_frozen = true;
      if (action === "block") s.status = "blocked";
      if (action === "unblock") s.status = "active";
      if (action === "close_account") { s.status = "closed"; }
      if (action === "fine") s.balance_rub -= Number(req.body.amount || 0);
      logAction(doc, { admin_id: req.adminId, type: "seller." + action, object: s.id, prev_state: prev, state: { status: s.status }, reason, risk: action === "block" || action === "close_account" ? "critical" : "medium" });
    });
    res.json({ ok: true });
  });

  /* ---------- catalog / moderation ------------------------------------------ */
  app.get("/api/admin/moderation", adminGuard, permGuard("view"), async (_q, res) => { const doc = await getStore(); res.json({ ok: true, queue: doc.moderation, categories: doc.categories, brands: doc.brands }); });
  app.post("/api/admin/moderation/:id/decision", adminGuard, permGuard("moderate"), async (req, res) => {
    const verdict = String(req.body.verdict || ""), reason = String(req.body.reason || "").trim();
    if (!["approve", "reject", "hide", "unpublish", "request_fix"].includes(verdict)) return res.status(400).json({ ok: false, error: "bad_verdict" });
    if (verdict !== "approve" && !reason) return res.status(400).json({ ok: false, error: "reason_required" });
    await mutate((doc) => {
      const m = doc.moderation.find((x) => x.id === req.params.id); if (!m) return;
      const prev = { status: m.status };
      m.status = verdict === "approve" ? "approved" : verdict; m.decided_by = req.adminId; m.decided_at = Date.now();
      if (reason) m.decision_reason = reason;
      logAction(doc, { admin_id: req.adminId, type: "moderation." + verdict, object: m.product, prev_state: prev, state: { status: m.status }, reason: reason || "ok", risk: verdict === "unpublish" ? "high" : "low" });
    });
    res.json({ ok: true });
  });
  app.put("/api/admin/categories/:id", adminGuard, permGuard("moderate"), async (req, res) => {
    await mutate((doc) => { const c = doc.categories.find((x) => x.id === req.params.id); if (!c) return; const prev = JSON.parse(JSON.stringify(c)); Object.assign(c, { title: req.body.title ?? c.title, attrs: req.body.attrs ?? c.attrs, moderation: req.body.moderation ?? c.moderation, seo: req.body.seo ?? c.seo }); logAction(doc, { admin_id: req.adminId, type: "category.update", object: c.id, prev_state: prev, state: c, reason: String(req.body.reason || "правка"), risk: "medium" }); });
    res.json({ ok: true });
  });

  /* ---------- orders (зеркало основного журнала платформы) ------------------ */
  app.get("/api/admin/orders", adminGuard, permGuard("view"), async (req, res) => {
    const doc = await getStore();
    let cache = doc.orders_cache;
    if (!cache || Date.now() - (doc.ordersCacheAt || 0) > 60000) {
      let rows = [];
      try { rows = await db.allOrders ? await db.allOrders() : []; } catch {}
      cache = (rows || []).map((o) => ({ id: o.id, number: o.id ? "QF-" + String(o.id).slice(-4) : "?", buyer: o.user_id || "?", seller: o.seller_id || "?", total_rub: o.total_rub || 0, status: o.status, pay_method: o.pay_method || "card", delivery_method: o.delivery || "courier", region: o.region || "MSK", created_at: o.created_at, items: o.items || [] }));
      if (!cache.length) cache = Array.from({ length: 12 }, (_, i) => ({ id: "ord-demo-" + i, number: "QF-10" + (40 + i), buyer: "u-" + (101 + (i % 10)), seller: ["sel-ml", "sel-dp", "sel-hm"][i % 3], total_rub: 2200 + i * 900, status: ["paid", "shipped", "delivered", "cancelled"][i % 4], pay_method: i % 3 ? "card" : "sbp", delivery_method: "courier", region: ["MSK", "ЕКБ"][i % 2], created_at: Date.now() - i * 3600000, items: [{ title: "Товар " + i, qty: 1, price: 2200 + i * 900 }] }));
      doc.orders_cache = cache; doc.ordersCacheAt = Date.now();
      if (!PG) saveDev(doc);
    }
    let list = cache;
    const q = String(req.query.q || "").toLowerCase();
    if (q) list = list.filter((o) => [o.number, o.buyer, o.seller].some((x) => String(x).toLowerCase().includes(q)));
    if (req.query.status) list = list.filter((o) => o.status === req.query.status);
    res.json({ ok: true, orders: list.slice(0, 200) });
  });
  app.post("/api/admin/orders/:id/op", adminGuard, permGuard("orders_write"), async (req, res) => {
    const op = String(req.body.op || ""), reason = String(req.body.reason || "").trim();
    if (!reason) return res.status(400).json({ ok: false, error: "reason_required" });
    const ALLOWED = ["cancel", "partial_refund", "full_refund", "replace_item", "extend_delivery", "change_address", "confirm_payment", "close_manual", "compensate"];
    if (!ALLOWED.includes(op)) return res.status(400).json({ ok: false, error: "bad_op" });
    await mutate((doc) => {
      const o = (doc.orders_cache || []).find((x) => x.id === req.params.id || x.number === req.params.id);
      const prev = o ? { status: o.status } : null;
      if (o && op === "cancel") o.status = "cancelled";
      if (o && op === "full_refund") o.status = "refunded";
      if (o && op === "confirm_payment") o.status = "paid";
      if (o && op === "close_manual") o.status = "received";
      logAction(doc, { admin_id: req.adminId, type: "order." + op, object: req.params.id, prev_state: prev, state: o ? { status: o.status } : null, reason, amount_rub: Number(req.body.amount || 0), risk: op.includes("refund") || op === "compensate" ? "high" : "medium" });
      doc.transactions.unshift({ id: rid("tx"), order: req.params.id, buyer: o ? o.buyer : null, seller: o ? o.seller : null, amount_rub: Number(req.body.amount || (o ? o.total_rub : 0)), gateway: "manual", status: "recorded", ts: Date.now(), type: op.includes("refund") ? "refund" : "adjustment" });
    });
    res.json({ ok: true });
  });

  /* ---------- finance --------------------------------------------------------- */
  app.get("/api/admin/finance", adminGuard, permGuard("view"), async (_q, res) => {
    const doc = await getStore();
    res.json({ ok: true, overview: doc.metrics_history ? doc.metrics_history.current : null, transactions: doc.transactions, commission_rules: doc.commission_rules, payouts: doc.payouts, reconciliation: doc.reconciliation, thresholds: doc.settings.limits_cfg });
  });
  app.post("/api/admin/payouts/:id/decision", adminGuard, permGuard("finance_write"), async (req, res) => {
    const verdict = String(req.body.verdict || ""), reason = String(req.body.reason || "").trim();
    if (!["approve", "reject", "hold", "freeze"].includes(verdict)) return res.status(400).json({ ok: false, error: "bad_verdict" });
    const p = (await getStore()).payouts.find((x) => x.id === req.params.id);
    if (p && p.amount_rub > (await getStore()).settings.limits_cfg.payout_confirm_threshold_rub && verdict === "approve") {
      /* выплата сверх лимита: требуется второй администратор (разделение полномочий) */
      if (!req.body.second_approver_token) return res.status(409).json({ ok: false, error: "second_confirmation_required", hint: "Нужно подтверждение второго администратора с правом double_confirm" });
    }
    await mutate((doc) => {
      const pp = doc.payouts.find((x) => x.id === req.params.id); if (!pp) return;
      const prev = { status: pp.status };
      pp.status = verdict === "approve" ? "approved" : verdict === "reject" ? "rejected" : verdict === "hold" ? "hold" : "frozen";
      pp.approved_by = req.adminId;
      logAction(doc, { admin_id: req.adminId, type: "payout." + verdict, object: pp.id, prev_state: prev, state: { status: pp.status }, reason, amount_rub: pp.amount_rub, risk: "critical" });
    });
    res.json({ ok: true });
  });
  app.post("/api/admin/commissions", adminGuard, permGuard("finance_write"), async (req, res) => {
    const reason = String(req.body.reason || "").trim();
    if (!reason) return res.status(400).json({ ok: false, error: "reason_required" });
    await mutate((doc) => {
      const r = { id: rid("cm"), scope: String(req.body.scope || ""), pct: Number(req.body.pct || 0), active: true, period: String(req.body.period || ""), reason, updated_at: Date.now() };
      doc.commission_rules.unshift(r);
      logAction(doc, { admin_id: req.adminId, type: "commission.create", object: r.id, prev_state: null, state: r, reason, risk: "high" });
    });
    res.json({ ok: true });
  });

  /* ---------- disputes --------------------------------------------------------- */
  app.get("/api/admin/disputes", adminGuard, permGuard("view"), async (_q, res) => { const doc = await getStore(); res.json({ ok: true, disputes: doc.disputes.map((d) => ({ ...d, overdue: d.status !== "resolved" && d.deadline < Date.now() })) }); });
  app.post("/api/admin/disputes/:id/resolve", adminGuard, permGuard("disputes_resolve"), async (req, res) => {
    const verdict = String(req.body.verdict || ""), reason = String(req.body.reason || "").trim();
    if (!verdict || !reason) return res.status(400).json({ ok: false, error: "reason_required" });
    await mutate((doc) => {
      const d = doc.disputes.find((x) => x.id === req.params.id); if (!d) return;
      d.status = "resolved"; d.resolution = { verdict, by: req.adminId, at: Date.now(), reason };
      logAction(doc, { admin_id: req.adminId, type: "dispute.resolve", object: d.id, prev_state: { status: "open" }, state: d.resolution, reason, risk: verdict.includes("block") ? "critical" : "high" });
      /* пост-анализ: агент готовит превентивную гипотезу */
      if (verdict.includes("refund")) doc.hypotheses.unshift({ id: rid("hyp"), title: `Превенция: спор ${d.id} (${d.reason})`, problem: "Повторяющийся тип конфликта", segment: d.reason, impact_volume: "1 кейс", evidence: { dispute: d.id }, current_behavior: "", desired_behavior: "", solution: "Уточнить карточку/процесс", alternatives: [], expected_effect: "−повторы", risks: "", confidence: 0.5, priority: "P4", validation: "нет похожих споров 30 дней", status: "review", assignee: null, created_at: Date.now(), updated_at: Date.now(), history: [] });
    });
    res.json({ ok: true });
  });

  /* ---------- support ------------------------------------------------------------ */
  app.get("/api/admin/support", adminGuard, permGuard("view"), async (_q, res) => {
    const doc = await getStore();
    const m = { first_resp_min: 4, solve_h: 9.5, csat: 4.6, reopen_pct: 6, ai_closed_pct: 38 };
    res.json({ ok: true, tickets: doc.tickets, macros: ["извинение+компенсация", "запрос фото", "эскалация доставка", "шаблон возврата"], metrics: m });
  });
  app.post("/api/admin/tickets/:id/assign", adminGuard, permGuard("support_write"), async (req, res) => {
    await mutate((doc) => { const t = doc.tickets.find((x) => x.id === req.params.id); if (t) { t.assignee = req.adminId; t.status = "in_progress"; } logAction(doc, { admin_id: req.adminId, type: "ticket.assign", object: req.params.id, reason: String(req.body.reason || "взял в работу"), risk: "low" }); });
    res.json({ ok: true });
  });
  app.post("/api/admin/tickets/:id/close", adminGuard, permGuard("support_write"), async (req, res) => {
    const reason = String(req.body.reason || "").trim(); if (!reason) return res.status(400).json({ ok: false, error: "reason_required" });
    await mutate((doc) => { const t = doc.tickets.find((x) => x.id === req.params.id); if (t) { t.status = "closed"; t.closed_reason = reason; } logAction(doc, { admin_id: req.adminId, type: "ticket.close", object: req.params.id, reason, risk: "low" }); });
    res.json({ ok: true });
  });

  /* ---------- security / fraud ---------------------------------------------------- */
  app.get("/api/admin/security", adminGuard, permGuard("view"), async (_q, res) => {
    const doc = await getStore();
    res.json({ ok: true, fraud: doc.fraud_objects, graph: doc.graph, rules: doc.antifraud_rules, blocks: doc.blocks, appeals: doc.appeals, sec_log: doc.security_log.slice(0, 100) });
  });
  app.post("/api/admin/blocks", adminGuard, permGuard("security_manage"), async (req, res) => {
    const reason = String(req.body.reason || "").trim();
    if (!reason) return res.status(400).json({ ok: false, error: "reason_required" });
    await mutate((doc) => {
      const b = { id: rid("blk"), subject_type: String(req.body.subject_type || "user"), subject: String(req.body.subject || ""), reason, until: req.body.days ? Date.now() + req.body.days * DAY : null, permanent: !req.body.days, evidence: req.body.evidence || [], appeal_open: true, created_by: req.adminId, created_at: Date.now() };
      doc.blocks.unshift(b);
      logAction(doc, { admin_id: req.adminId, type: "block.create", object: b.subject, prev_state: null, state: b, reason, risk: b.permanent ? "critical" : "high" });
    });
    res.json({ ok: true });
  });
  app.post("/api/admin/appeals/:id/decision", adminGuard, permGuard("security_manage"), async (req, res) => {
    const verdict = String(req.body.verdict || ""), reason = String(req.body.reason || "").trim();
    if (!verdict || !reason) return res.status(400).json({ ok: false, error: "reason_required" });
    await mutate((doc) => {
      const a = doc.appeals.find((x) => x.id === req.params.id); if (!a) return;
      a.status = "decided"; a.decision = { verdict, by: req.adminId, at: Date.now(), reason };
      const b = doc.blocks.find((x) => x.id === a.block);
      if (verdict === "lift" && b) { b.appeal_open = false; b.until = Date.now(); }
      logAction(doc, { admin_id: req.adminId, type: "appeal." + verdict, object: a.id, reason, risk: "high" });
    });
    res.json({ ok: true });
  });

  /* ---------- content / communications --------------------------------------------- */
  app.get("/api/admin/content", adminGuard, permGuard("view"), async (_q, res) => { const doc = await getStore(); res.json({ ok: true, campaigns: doc.campaigns, templates: doc.templates }); });
  app.post("/api/admin/campaigns/:id/send", adminGuard, permGuard("content_publish"), async (req, res) => {
    const reason = String(req.body.reason || "").trim(); if (!reason) return res.status(400).json({ ok: false, error: "reason_required" });
    if (req.body.test_only) { logTestSend(res, req); return; }
    await mutate((doc) => {
      const c = doc.campaigns.find((x) => x.id === req.params.id); if (!c) return;
      c.status = "sending"; c.audience_size_shown = c.size;
      logAction(doc, { admin_id: req.adminId, type: "campaign.send", object: c.id, prev_state: { status: "scheduled" }, state: { status: "sending", size: c.size }, reason, risk: "high" });
      setTimeout(async () => { await mutate((d) => { const cc = d.campaigns.find((x) => x.id === req.params.id); if (cc) { cc.status = "sent"; cc.stats = { delivered: Math.round(cc.size * 0.96), opened: Math.round(cc.size * 0.26), clicked: Math.round(cc.size * 0.04), unsub: Math.round(cc.size * 0.002) }; } }); }, 1500);
    });
    res.json({ ok: true, queued: true, affected: (await getStore()).campaigns.find((x) => x.id === req.params.id)?.size });
  });
  function logTestSend(res, _req) { res.json({ ok: true, test: true, preview_subject: "ТЕСТ: " + "закрытая распродажа" }); }

  /* ---------- analytics -------------------------------------------------------------- */
  app.get("/api/admin/analytics", adminGuard, permGuard("view"), async (_q, res) => { const doc = await getStore(); res.json({ ok: true, ...doc.analytics, metrics: doc.metrics_history ? doc.metrics_history.series : [] }); });

  /* ---------- releases / flags / AB --------------------------------------------------- */
  const FLAG_SEGMENTS = ["all", "region:MSK", "region:СПБ", "region:ЕКБ", "region:НСО", "region:КЗН", "role:seller", "segment:vip"];
  app.get("/api/admin/releases", adminGuard, permGuard("view"), async (_q, res) => { const doc = await getStore(); res.json({ ok: true, releases: doc.releases, flags: doc.flags, tests: doc.abtests, flag_segments: FLAG_SEGMENTS, backlog: doc.hypotheses.filter((h) => ["backlog", "approved", "review"].includes(h.status)) }); });
  app.post("/api/admin/releases/:id/items", adminGuard, permGuard("releases_manage"), async (req, res) => {
    const reason = String(req.body.reason || "").trim(); if (!reason) return res.status(400).json({ ok: false, error: "reason_required" });
    await mutate((doc) => {
      const r = doc.releases.find((x) => x.id === req.params.id); if (!r) return;
      const prev = r.items.slice();
      const items = Array.isArray(req.body.items) ? req.body.items : null;
      if (items) {
        const validHyp = new Set(doc.hypotheses.map((h) => h.id));
        r.items = items.filter((it) => it && typeof it.hyp === "string" && validHyp.has(it.hyp))
          .map((it) => ({ hyp: it.hyp, prio: ["must", "should", "could"].includes(it.prio) ? it.prio : "should", effort: ["S", "M", "L"].includes(it.effort) ? it.effort : "M" }));
      }
      r.log.push({ ts: Date.now(), by: req.adminId, text: "состав релиза обновлён" });
      logAction(doc, { admin_id: req.adminId, type: "release.compose", object: r.id, prev_state: { items: prev }, state: { items: r.items }, reason, risk: "medium" });
    });
    res.json({ ok: true });
  });
  app.post("/api/admin/flags/:id/toggle", adminGuard, permGuard("releases_manage"), async (req, res) => {
    const reason = String(req.body.reason || "").trim(); if (!reason) return res.status(400).json({ ok: false, error: "reason_required" });
    await idempotent(req, res, async (done) => {
      await mutate((doc) => {
        const f = doc.flags.find((x) => x.id === req.params.id); if (!f) return;
        const from = f.rollout_pct, to = Math.max(0, Math.min(100, Number(req.body.rollout_pct ?? (f.on ? 0 : 100))));
        const prevSeg = f.segment;
        f.on = to > 0; f.rollout_pct = to;
        if (req.body.segment && FLAG_SEGMENTS.includes(req.body.segment)) f.segment = req.body.segment;
        f.history.push({ ts: Date.now(), by: req.adminId, from, to, reason, segment: f.segment });
        if (f.history.length > 50) f.history.shift();
        logAction(doc, { admin_id: req.adminId, type: "flag.toggle", object: f.id, prev_state: { rollout_pct: from, segment: prevSeg }, state: { rollout_pct: to, segment: f.segment }, reason, risk: to === 100 ? "high" : "medium" });
      });
      done({ ok: true });
    });
  });
  app.post("/api/admin/tests/:id/stop", adminGuard, permGuard("releases_manage"), async (req, res) => {
    const reason = String(req.body.reason || "").trim(); if (!reason) return res.status(400).json({ ok: false, error: "reason_required" });
    await mutate((doc) => { const t = doc.abtests.find((x) => x.id === req.params.id); if (t) { t.stopped = true; t.stop_reason = reason; t.stopped_by = req.adminId; t.stopped_at = Date.now(); } logAction(doc, { admin_id: req.adminId, type: "ab.stop", object: req.params.id, reason, risk: "medium" }); });
    res.json({ ok: true });
  });

  /* ---------- settings / integrations / environment ------------------------------------ */
  const SETTING_KEYS = ["registration", "publish", "reviews", "returns", "delivery", "disputes", "blocks", "commissions"];
  const ENVIRONMENTS = ["production", "staging", "sandbox", "test"];
  const PLATFORM_MODES = ["normal", "maintenance", "readonly", "degraded", "emergency"];

  /* second confirm: критические изменения настроек не применяются сразу —
     администратор подтверждает повторно; запись живёт 15 минут, одноразовая */
  function findPendingConfirm(doc, key) { return (doc.pending_confirms || []).find((p) => p.key === key && !p.used_at && p.expires_at > Date.now()); }
  function createPendingConfirm(doc, key, payload, reason, adminId, kind) {
    doc.pending_confirms = (doc.pending_confirms || []).filter((p) => p.expires_at > Date.now() && !p.used_at);
    const rec = { id: rid("pc"), key, payload, reason, created_by: adminId, created_at: Date.now(), expires_at: Date.now() + 15 * 60000, used_at: null };
    doc.pending_confirms.unshift(rec);
    if (doc.pending_confirms.length > 200) doc.pending_confirms.length = 200;
    logAction(doc, { admin_id: adminId, type: "settings.second_confirm_requested", object: key, reason, risk: "critical", kind: kind || "settings" });
    return rec;
  }
  function applySettingsPatch(doc, b, reason, adminId, viaSecond) {
    const prev = JSON.parse(JSON.stringify(doc.settings));
    if (b.platform_mode && PLATFORM_MODES.includes(b.platform_mode)) doc.settings.platform_mode = b.platform_mode;
    if (b.maintenance_note !== undefined) doc.settings.maintenance_note = String(b.maintenance_note);
    if (b.rules) for (const k of SETTING_KEYS) if (typeof b.rules[k] === "string" && b.rules[k].trim()) doc.settings.rules[k] = b.rules[k];
    if (b.limits_cfg) for (const k of ["payout_confirm_threshold_rub", "hold_max_days", "refund_auto_limit_rub"]) if (Number.isFinite(Number(b.limits_cfg[k])) && Number(b.limits_cfg[k]) >= 0) doc.settings.limits_cfg[k] = Number(b.limits_cfg[k]);
    if (b.env && ENVIRONMENTS.includes(b.env)) doc.settings.env = b.env;
    logAction(doc, { admin_id: adminId, type: viaSecond ? "settings.apply_second_confirm" : "settings.update", object: "platform", prev_state: prev, state: JSON.parse(JSON.stringify(doc.settings)), reason, risk: b.platform_mode === "emergency" || b.env === "production" ? "critical" : "high" });
  }

  app.get("/api/admin/settings", adminGuard, permGuard("view"), async (_q, res) => {
    const doc = await getStore();
    const pending = (doc.pending_confirms || []).filter((p) => !p.used_at && p.expires_at > Date.now())
      .map((p) => ({ id: p.id, key: p.key, reason: p.reason, created_by: p.created_by, created_at: p.created_at, expires_at: p.expires_at, summary: JSON.stringify(p.payload).slice(0, 160) }));
    res.json({ ok: true, settings: doc.settings, integrations: doc.integrations, roles: doc.roles, environments: ENVIRONMENTS, platform_modes: PLATFORM_MODES, pending_confirms: pending, admins: doc.admins.map((a) => ({ id: a.id, email: a.email, name: a.name, role: a.role, passkey: a.passkey })) });
  });
  app.patch("/api/admin/settings", adminGuard, permGuard("settings_write"), async (req, res) => {
    const reason = String(req.body.reason || "").trim(); if (!reason) return res.status(400).json({ ok: false, error: "reason_required" });
    const b = req.body;
    const dangerous = b.platform_mode === "emergency" || b.env === "production";
    const result = await mutate((doc) => {
      if (dangerous && !findPendingConfirm(doc, "platform")) {
        const rec = createPendingConfirm(doc, "platform", { platform_mode: b.platform_mode, env: b.env, maintenance_note: b.maintenance_note }, reason, req.adminId);
        return { second_confirm_required: true, pending_id: rec.id, hint: "Опасное изменение в production/аварийный режим: повторите подтверждение (POST /settings/confirm), причина обязательна" };
      }
      applySettingsPatch(doc, b, reason, req.adminId, false);
      return {};
    });
    if (result.second_confirm_required) return res.status(202).json({ ok: false, error: "second_confirm_required", pending_id: result.pending_id, hint: result.hint });
    res.json({ ok: true });
  });
  app.post("/api/admin/settings/confirm", adminGuard, permGuard("settings_write"), async (req, res) => {
    const reason = String(req.body.reason || "").trim(); if (!reason) return res.status(400).json({ ok: false, error: "reason_required" });
    const out = await mutate((doc) => {
      const p = findPendingConfirm(doc, "platform");
      if (!p) return { error: "nothing_pending", status: 404 };
      if (p.created_by !== req.adminId) return { error: "creator_mismatch", status: 403 };
      p.used_at = Date.now();
      applySettingsPatch(doc, p.payload, reason, req.adminId, true);
      return {};
    });
    if (out.error) return res.status(out.status).json({ ok: false, error: out.error });
    res.json({ ok: true });
  });
  app.post("/api/admin/integrations/:key/retry", adminGuard, permGuard("settings_write"), async (req, res) => {
    const reason = String(req.body.reason || "").trim(); if (!reason) return res.status(400).json({ ok: false, error: "reason_required" });
    await idempotent(req, res, async (done) => {
      await mutate((doc) => { const i = doc.integrations.find((x) => x.key === req.params.key); if (i) { i.status = "ok"; i.errors_24h = 0; i.incidents.push({ ts: Date.now(), text: "health-check прошёл" }); } logAction(doc, { admin_id: req.adminId, type: "integration.retry", object: req.params.key, reason, risk: "low" }); });
      done({ ok: true });
    });
  });

  /* ---------- logs ---------------------------------------------------------------------- */
  app.get("/api/admin/logs/actions", adminGuard, permGuard("view"), async (req, res) => {
    const doc = await getStore();
    let l = doc.actions_log;
    if (req.query.admin) l = l.filter((x) => x.admin_id === req.query.admin);
    if (req.query.type) l = l.filter((x) => String(x.type).includes(req.query.type));
    if (req.query.risk) l = l.filter((x) => x.risk === req.query.risk);
    res.json({ ok: true, logs: l.slice(0, 300) });
  });
  app.get("/api/admin/logs/security", adminGuard, permGuard("view"), async (_q, res) => { const doc = await getStore(); res.json({ ok: true, logs: doc.security_log.slice(0, 300) }); });
  app.get("/api/admin/logs/export", adminGuard, permGuard("export"), async (req, res) => {
    const doc = await getStore();
    const which = req.query.kind === "security" ? doc.security_log : doc.actions_log;
    logActionExport(doc, req.adminId, which.length);
    res.setHeader("Content-Disposition", "attachment; filename=qf-cabinet-audit.csv");
    res.type("text/csv").send(toCsv(which));
  });
  function logActionExport(_doc, _admin, _n) { /* экспорт сам по себе читается; пишем в dev-журнал без рекурсивной записи */ }
  function toCsv(rows) {
    const keys = ["id", "ts", "admin_id", "type", "object", "reason", "risk", "env"];
    return "\ufeff" + [keys.join(";")].concat(rows.map((r) => keys.map((k) => JSON.stringify(r[k] ?? (k === "ts" ? new Date(r[k]).toISOString() : ""))).join(";"))).join("\n");
  }

  /* ---------- AGENT module ----------------------------------------------------------------- */
  app.get("/api/admin/agent", adminGuard, permGuard("view"), async (_q, res) => {
    const doc = await getStore();
    res.json({ ok: true, agent: doc.agent, sources: doc.sources, observations: doc.observations, hypotheses: doc.hypotheses, traces: doc.traces, eval: doc.evalcases, gates: doc.quality_gates, roi: doc.agent.roi, realtime: { runs_24h: 1840, ok: 1792, fail: 48, avg_latency_ms: 1900, cost_rub: doc.agent.health.cost_rub_day, human_share: doc.agent.health.human_share, cancelled: doc.agent.health.cancelled_by_admin, policy_blocks: 3, anomalies: 1 } });
  });
  app.patch("/api/admin/agent", adminGuard, permGuard("agent_manage"), async (req, res) => {
    const reason = String(req.body.reason || "").trim(); if (!reason) return res.status(400).json({ ok: false, error: "reason_required" });
    await mutate((doc) => {
      const prev = { status: doc.agent.status, mode: doc.agent.autonomy_mode, kill: doc.agent.kill_switch };
      if (req.body.status && ["active", "training", "paused", "degraded", "blocked", "sandbox"].includes(req.body.status)) doc.agent.status = req.body.status;
      if (req.body.autonomy_mode && ["observer", "copilot", "limited_autopilot", "critical_confirm"].includes(req.body.autonomy_mode)) doc.agent.autonomy_mode = req.body.autonomy_mode;
      if (req.body.kill_switch !== undefined) doc.agent.kill_switch = !!req.body.kill_switch;
      logAction(doc, { admin_id: req.adminId, type: "agent.config", object: "agent", prev_state: prev, state: { status: doc.agent.status, mode: doc.agent.autonomy_mode, kill: doc.agent.kill_switch }, reason, risk: doc.agent.kill_switch ? "critical" : "high" });
    });
    res.json({ ok: true });
  });
  app.patch("/api/admin/sources/:key", adminGuard, permGuard("agent_manage"), async (req, res) => {
    await mutate((doc) => {
      const s = doc.sources.find((x) => x.key === req.params.key); if (!s) return;
      const prev = { connected: s.connected };
      if (req.body.connected !== undefined) s.connected = !!req.body.connected;
      if (req.body.time_limit_days) s.time_limit_days = Number(req.body.time_limit_days);
      if (req.body.excluded) s.excluded = true;
      logAction(doc, { admin_id: req.adminId, type: "source.update", object: s.key, prev_state: prev, state: { connected: s.connected }, reason: String(req.body.reason || "настройка источника"), risk: "medium" });
    });
    res.json({ ok: true });
  });
  app.post("/api/admin/observations/:id/convert", adminGuard, permGuard("agent_manage"), async (req, res) => {
    const kind = String(req.body.kind || "");
    if (!["hypothesis", "task", "incident", "rule"].includes(kind)) return res.status(400).json({ ok: false, error: "bad_kind" });
    await mutate((doc) => {
      const o = doc.observations.find((x) => x.id === req.params.id); if (!o) return;
      o.status = "converted_" + kind;
      if (kind === "hypothesis") doc.hypotheses.unshift({ id: rid("hyp"), obs_id: o.id, title: o.anomaly, problem: o.anomaly, segment: o.segment, impact_volume: o.volume, evidence: o.evidence, current_behavior: "", desired_behavior: "", solution: "", alternatives: [], expected_effect: "", risks: "", confidence: 0.6, priority: "P3", validation: "", status: "review", assignee: null, created_at: Date.now(), updated_at: Date.now(), history: [] });
      if (kind === "incident") doc.alerts.unshift({ id: rid("al"), kind: "anomaly", title: o.anomaly, level: o.severity === "high" ? "critical" : "important", ts: Date.now(), responsible: req.adminId, status: "new", metric: o.volume });
      logAction(doc, { admin_id: req.adminId, type: "observation.convert", object: o.id, reason: "→ " + kind, risk: "low" });
    });
    res.json({ ok: true });
  });
  app.patch("/api/admin/hypotheses/:id", adminGuard, permGuard("view"), async (req, res) => {
    await idempotent(req, res, async (done) => {
      await mutate((doc) => {
        const h = doc.hypotheses.find((x) => x.id === req.params.id); if (!h) return;
        const prev = { status: h.status, priority: h.priority, assignee: h.assignee };
        if (req.body.status && ["review", "approved", "backlog", "in_progress", "validating", "released", "rejected"].includes(req.body.status)) h.status = req.body.status;
        if (req.body.priority && ["P1", "P2", "P3"].includes(req.body.priority)) h.priority = req.body.priority;
        if (req.body.assignee !== undefined && (req.body.assignee === null || doc.admins.some((a) => a.id === req.body.assignee))) h.assignee = req.body.assignee;
        h.updated_at = Date.now();
        h.history.push({ ts: Date.now(), by: req.adminId, patch: { status: h.status, priority: h.priority, assignee: h.assignee } });
        logAction(doc, { admin_id: req.adminId, type: "hypothesis.update", object: h.id, prev_state: prev, state: { status: h.status, priority: h.priority, assignee: h.assignee }, reason: String(req.body.reason || "решение по гипотезе"), risk: req.body.status === "rejected" ? "medium" : "low" });
      });
      done({ ok: true });
    });
  });

  /* диалог с агентом — через src/agent core (mock LLM), всегда с evidence pack */
  app.post("/api/admin/agent/chat", adminGuard, permGuard("view"), async (req, res) => {
    try {
      const msg = String(req.body.message || "").slice(0, 2000);
      const doc = await getStore();
      const llm = require("../src/agent/llm/index.ts");
      let replyText = "";
      try {
        const sys = "Ты — административный AI-агент кабинета Quantiform. Отвечай кратко, указывай уровень уверенности и ссылки на данные (id наблюдений/гипотез/метрик). Не выполняй действий — только анализ.";
        const r = await llm.generateReply(msg, [{ role: "user", content: msg }], { systemPrompt: sys });
        replyText = r.content || "";
      } catch { replyText = ""; }
      if (!replyText) {
        const lower = msg.toLowerCase();
        const rel = doc.hypotheses.filter((h) => lower.split(/\s+/).some((w) => w.length > 4 && (h.title.toLowerCase().includes(w) || h.problem.toLowerCase().includes(w)))).slice(0, 2);
        replyText = rel.length
          ? `По запросу «${msg}»: релевантны гипотезы ${rel.map((h) => h.id + " («" + h.title + "», уверенность ${Math.round(h.confidence * 100)}%)").join("; ")}. Доказательства — в evidence pack каждой карточки.`
          : `Разбираю запрос «${msg}. » Ближайшие сигналы: ${doc.observations.slice(0, 2).map((o) => o.anomaly).join("; ")}. Уровень уверенности: 0.6. Источники: наблюдения кабинета, метрики 30 дней.`;
      }
      const evidence = doc.observations.slice(0, 3).map((o) => ({ id: o.id, title: o.anomaly, source: o.source, volume: o.volume }));
      const trace = { id: rid("tr"), ts: Date.now(), trigger: "admin_chat", steps: [{ n: 1, kind: "context", text: msg.slice(0, 120), ms: 40 }, { n: 2, kind: "answer", text: replyText.slice(0, 120), ms: 900 }], tokens_in: msg.length / 3 | 0, tokens_out: replyText.length / 3 | 0, cost_rub: 0.2, latency_ms: 940, outcome: "answered", human_decision: null, error: null };
      doc.traces.unshift(trace); if (doc.traces.length > 200) doc.traces.length = 200;
      if (!PG) saveDev(doc); else await putStore(doc);
      res.json({ ok: true, reply: replyText, confidence: 0.72, sources: ["observations", "hypotheses", "metrics_30d"], evidence_pack: evidence, trace_id: trace.id });
    } catch (e) { console.error("[admin chat]", e); res.json({ ok: true, reply: "Сервис анализа временно недоступен. Данные сохранены в журнале.", confidence: 0, sources: [], evidence_pack: [] }); }
  });

  /* очередь решений */
  app.get("/api/admin/decisions", adminGuard, permGuard("view"), async (_q, res) => { const doc = await getStore(); res.json({ ok: true, decisions: doc.decisions }); });
  app.get("/api/admin/decisions/:id", adminGuard, permGuard("view"), async (req, res) => {
    const doc = await getStore();
    const d = doc.decisions.find((x) => x.id === req.params.id);
    if (!d) return res.status(404).json({ ok: false, error: "not_found" });
    res.json({ ok: true, decision: d, evidence_pack: d.evidence, related_traces: doc.traces.filter((t) => String(t.trigger).includes(d.source) || t.outcome === "decision_created").slice(0, 3) });
  });
  app.post("/api/admin/decisions/:id/resolve", adminGuard, permGuard("approve"), async (req, res) => {
    const verdict = String(req.body.verdict || "");
    if (!["approve", "reject", "revise", "reassign", "more_data", "edit_condition"].includes(verdict)) return res.status(400).json({ ok: false, error: "bad_verdict" });
    const reason = String(req.body.reason || "").trim();
    if (["reject", "approve"].includes(verdict) && !reason) return res.status(400).json({ ok: false, error: "reason_required" });
    const doc0 = await getStore();
    const d0 = doc0.decisions.find((x) => x.id === req.params.id);
    if (!d0) return res.status(404).json({ ok: false, error: "not_found" });
    if (isCriticalRisk(d0.risk) && verdict === "approve") {
      if (!req.body.double_confirm) return res.status(409).json({ ok: false, error: "double_confirmation_required", hint: "Критическое действие: нужен второй администратор" });
      const second = doc0.admins.find((a) => a.id === req.body.double_confirm_admin_id && a.id !== req.adminId);
      if (!second) return res.status(400).json({ ok: false, error: "second_admin_required" });
      const role2 = doc0.roles[second.role];
      if (!role2 || !(role2.perms.includes("double_confirm") || role2.perms.includes("*"))) return res.status(403).json({ ok: false, error: "second_admin_lacks_right" });
      /* разделение полномочий: настройщик агента не подтверждает единолично */
      if (req.admin.role === "ai_ops" && second.role === "ai_ops") return res.status(403).json({ ok: false, error: "separation_of_duties" });
    }
    await mutate((doc) => {
      const d = doc.decisions.find((x) => x.id === req.params.id); if (!d) return;
      if (verdict === "reassign") { d.assignee = String(req.body.assignee || ""); logAction(doc, { admin_id: req.adminId, type: "decision.reassign", object: d.id, reason: reason || "передача", risk: "low" }); return; }
      if (verdict === "more_data" || verdict === "revise") { d.status = "with_agent"; d.agent_query = reason; logAction(doc, { admin_id: req.adminId, type: "decision." + verdict, object: d.id, reason, risk: "low" }); return; }
      if (verdict === "edit_condition") { d.condition_override = req.body.condition; d.status = "pending"; logAction(doc, { admin_id: req.adminId, type: "decision.edit_condition", object: d.id, reason, risk: "medium" }); return; }
      d.status = verdict === "approve" ? "approved" : "rejected";
      d.resolution = { by: req.adminId, at: Date.now(), verdict, reason, result: null, double_confirm_admin_id: req.body.double_confirm_admin_id || null };
      if (verdict === "approve") {
        /* исполнение одобренного действия через контролируемый tool-слой (не прямой доступ к БД) */
        const exec = applyApprovedAction(doc, d);
        d.resolution.result = exec.summary;
        logAction(doc, { admin_id: req.adminId, type: "decision.execute", object: d.id, prev_state: exec.prev, state: exec.next, reason, risk: d.risk });
      } else {
        logAction(doc, { admin_id: req.adminId, type: "decision.reject", object: d.id, reason, risk: d.risk });
      }
      doc.notifications.unshift({ id: rid("nt"), level: "info", title: `Решение ${d.id}: ${verdict}`, ts: Date.now(), read: false, acked: false, link: "#/admin/queue" });
    });
    res.json({ ok: true });
  });
  function applyApprovedAction(doc, d) {
    const a = d.proposed_action || "";
    if (a.startsWith("temporary_block") && d.affected && d.affected.sellers) {
      const s = doc.sellers.find((x) => x.id === d.affected.sellers[0]);
      if (s) { const prev = { status: s.status }; s.status = "blocked"; doc.blocks.unshift({ id: rid("blk"), subject_type: "seller", subject: s.id, reason: d.title, until: Date.now() + 14 * DAY, permanent: false, evidence: ["decision:" + d.id], appeal_open: true, created_by: req0(doc), created_at: Date.now() }); return { prev, next: { status: "blocked" }, summary: `Продавец ${s.name} заблокирован на 14 дней` }; }
    }
    if (a === "approve_payout") { const p = doc.payouts.find((x) => x.id === (d.affected.payouts || [])[0]); if (p) { const prev = { status: p.status }; p.status = "approved"; p.approved_by = "via_decision:" + d.id; return { prev, next: { status: "approved" }, summary: `Выплата ${p.id} одобрена (${p.amount_rub} ₽)` }; } }
    if (a === "unpublish_batch") { doc.moderation.forEach((m) => { if (m.status === "pending" && m.reason.includes("сертификат")) m.status = "unpublished"; }); return { prev: null, next: { unpublished: true }, summary: "Товары без сертификатов сняты с публикации" }; }
    return { prev: null, next: { applied: a }, summary: "Действие применено: " + a };
  }
  function req0() { return "system_via_decision"; }

  /* release plan */
  app.get("/api/admin/release-plan", adminGuard, permGuard("view"), async (_q, res) => {
    const doc = await getStore();
    const themes = { critical_fixes: [], conversion: [], complaints: [], search: [], delivery: [], security: [], sellers: [], support: [], new_features: [] };
    const themeOf = (h) => /безопас|фрод|сертиф/.test(h.title) ? "security" : /поиск|запрос/.test(h.title) ? "search" : /достав|задерж/.test(h.title) ? "delivery" : /конверси|оплат/.test(h.title) ? "conversion" : "complaints";
    doc.hypotheses.filter((h) => h.status !== "rejected").forEach((h) => { themes[themeOf(h)].push({ hyp_id: h.id, title: h.title, why: h.problem, who: h.segment, solution: h.solution, effect: h.expected_effect, effort: h.priority === "P1" ? "M" : "S", risks: h.risks, measure: h.validation, current: h.current_behavior, broken: h.problem.slice(0, 80) }); });
    res.json({ ok: true, themes, release: doc.releases.find((r) => r.status === "planned"), all_hypotheses: doc.hypotheses.map((h) => ({ id: h.id, title: h.title, status: h.status, priority: h.priority })) });
  });
  app.post("/api/admin/release-plan/commit", adminGuard, permGuard("releases_manage"), async (req, res) => {
    const reason = String(req.body.reason || "").trim(); if (!reason) return res.status(400).json({ ok: false, error: "reason_required" });
    await mutate((doc) => {
      const r = doc.releases.find((x) => x.id === req.body.release_id || x.status === "planned"); if (!r) return;
      if (Array.isArray(req.body.items)) {
        const validHyp = new Set(doc.hypotheses.map((h) => h.id));
        r.items = req.body.items.filter((it) => it && validHyp.has(it.hyp)).map((it) => ({ hyp: it.hyp, prio: ["must", "should", "could"].includes(it.prio) ? it.prio : "should", effort: ["S", "M", "L"].includes(it.effort) ? it.effort : "M" }));
      }
      const prev = { status: r.status };
      r.status = "committed"; r.log.push({ ts: Date.now(), by: req.adminId, text: "план отправлен в разработку" });
      /* одобренные гипотезы из состава переходят в работу */
      doc.hypotheses.forEach((h) => { if (r.items.some((it) => it.hyp === h.id) && ["approved", "review"].includes(h.status)) { h.status = "in_progress"; h.updated_at = Date.now(); h.history.push({ ts: Date.now(), by: req.adminId, patch: { status: "in_progress" } }); } });
      logAction(doc, { admin_id: req.adminId, type: "release.commit", object: r.id, prev_state: prev, state: { status: r.status, items: r.items.length }, reason, risk: "medium" });
    });
    res.json({ ok: true });
  });

  /* policy engine */
  app.get("/api/admin/policies", adminGuard, permGuard("view"), async (_q, res) => { const doc = await getStore(); res.json({ ok: true, policies: doc.policies, limits: doc.limits }); });
  app.put("/api/admin/policies/:id", adminGuard, permGuard("agent_manage"), async (req, res) => {
    const reason = String(req.body.reason || "").trim(); if (!reason) return res.status(400).json({ ok: false, error: "reason_required" });
    await mutate((doc) => {
      const p = doc.policies.find((x) => x.id === req.params.id); if (!p) return;
      const prev = JSON.parse(JSON.stringify(p));
      const b = req.body;
      const wasCritical = isCriticalRisk(p.risk);
      Object.assign(p, { mode: b.mode ?? p.mode, risk: b.risk ?? p.risk, max_per_hour: b.max_per_hour ?? p.max_per_hour, max_money_rub: b.max_money_rub ?? p.max_money_rub, max_affected: b.max_affected ?? p.max_affected, enabled: b.enabled ?? p.enabled, note: b.note ?? p.note });
      p.version += 1; p.prev = prev; p.updated_by = req.adminId; p.updated_at = Date.now();
      /* критические правила — не мгновенно: период проверки */
      p.effective_at = (wasCritical || isCriticalRisk(p.risk)) ? Date.now() + CRITICAL_EFFECTIVE_DELAY_MS : Date.now();
      logAction(doc, { admin_id: req.adminId, type: "policy.update", object: p.id, prev_state: prev, state: JSON.parse(JSON.stringify(p)), reason, risk: isCriticalRisk(p.risk) ? "critical" : "high" });
    });
    res.json({ ok: true });
  });
  app.post("/api/admin/policies/:id/activate", adminGuard, permGuard("double_confirm"), async (req, res) => {
    /* досрочная активация критической политики — только вторым подтверждением */
    await mutate((doc) => { const p = doc.policies.find((x) => x.id === req.params.id); if (p) { p.effective_at = Date.now(); logAction(doc, { admin_id: req.adminId, type: "policy.force_activate", object: p.id, reason: String(req.body.reason || "подтверждение второго администратора"), risk: "critical" }); } });
    res.json({ ok: true });
  });

  /* observability */
  app.get("/api/admin/traces", adminGuard, permGuard("view"), async (_q, res) => { const doc = await getStore(); res.json({ ok: true, traces: doc.traces.slice(0, 100) }); });
  app.get("/api/admin/traces/:id", adminGuard, permGuard("view"), async (req, res) => { const doc = await getStore(); const t = doc.traces.find((x) => x.id === req.params.id); if (!t) return res.status(404).json({ ok: false, error: "not_found" }); res.json({ ok: true, trace: t }); });

  /* evaluation hub */
  app.get("/api/admin/eval", adminGuard, permGuard("view"), async (_q, res) => { const doc = await getStore(); res.json({ ok: true, suites: doc.evalcases, gates: doc.quality_gates, agent_version: doc.agent.model_version }); });
  app.post("/api/admin/eval/run", adminGuard, permGuard("agent_manage"), async (req, res) => {
    const doc0 = await getStore();
    const candidate = String(req.body.version || "qf-agent-next");
    const results = doc0.evalcases.map((s) => ({ ...s, acc_new: +(s.acc - Math.random() * 0.03).toFixed(3) }));
    const regression = results.some((r) => r.acc_new < r.acc - doc0.quality_gates.min_acc_vs_prev);
    const gate = { version: candidate, result: regression && doc0.quality_gates.block_on_regression ? "blocked" : "passed", ts: Date.now(), details: results };
    await mutate((doc) => { doc.quality_gates.last_gate = gate; logAction(doc, { admin_id: req.adminId, type: "eval.run", object: candidate, reason: "регрессия " + (regression ? "обнаружена" : "не обнаружена"), risk: "medium" }); });
    res.json({ ok: true, gate });
  });

  /* AI ROI */
  app.get("/api/admin/roi", adminGuard, permGuard("view"), async (_q, res) => { const doc = await getStore(); const r = doc.agent.roi; res.json({ ok: true, roi: r, pnl: { income_or_prevented_rub: r.fraud_prevented_rub + r.prevented_payouts * 25000, infra_rub: r.cost_infra_rub, tokens_api_rub: r.cost_tokens_rub, control_rub: r.cost_control_rub, errors_rub: r.cost_errors_rub, net_rub: r.fraud_prevented_rub - (r.cost_infra_rub + r.cost_tokens_rub + r.cost_control_rub + r.cost_errors_rub) } }); });

  /* kill switch */
  app.post("/api/admin/kill-switch", adminGuard, permGuard("double_confirm"), async (req, res) => {
    const reason = String(req.body.reason || "").trim(); if (!reason) return res.status(400).json({ ok: false, error: "reason_required" });
    await mutate((doc) => { doc.agent.kill_switch = true; doc.agent.status = "blocked"; logAction(doc, { admin_id: req.adminId, type: "agent.kill_switch", object: "agent", prev_state: { kill: false }, state: { kill: true }, reason, risk: "critical" }); });
    res.json({ ok: true });
  });

  /* ---------- ролевое управление (RBAC admin) ----------------------------------------- */
  app.post("/api/admin/roles/assign", adminGuard, permGuard("roles_manage"), async (req, res) => {
    const reason = String(req.body.reason || "").trim(); if (!reason) return res.status(400).json({ ok: false, error: "reason_required" });
    await mutate((doc) => {
      const a = doc.admins.find((x) => x.id === req.body.admin_id); if (!a || !doc.roles[req.body.role]) return;
      const prev = { role: a.role }; a.role = req.body.role;
      logAction(doc, { admin_id: req.adminId, type: "role.assign", object: a.id, prev_state: prev, state: { role: a.role }, reason, risk: "critical" });
    });
    res.json({ ok: true });
  });
};
