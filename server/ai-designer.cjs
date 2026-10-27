// ============================================================
// AI-дизайнер — backend-прокси и хранение проектов (Этап 8)
//
// Назначение:
//  1. Единая точка доступа клиента к AI-функциям модуля
//     (контракты совпадают с /src/lib/ai-designer/api.ts).
//  2. Хранение проектов пользователя (доступ только владельцу,
//     удаление проекта удаляет фото, варианты и товарные привязки).
//  3. Заглушки будущих боевых вызовов GigaChat / YandexGPT /
//     Yandex Vision. Ключи читаются ТОЛЬКО из окружения сервера
//     и НИКОГДА не отдаются клиенту. Реальные сетевые вызовы
//     подключаются отдельной задачей — сейчас возвращается
//     mock-ответ в том же формате.
//
// Подключение: require("./ai-designer").mount(app, { guard, db })
// ============================================================

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
/* БЛОК 4: защита от prompt-injection, маскирование PII, изоляция контекста */
const aiSec = require("./ai-security.cjs");

const AI_PROVIDER = process.env.AI_DESIGNER_PROVIDER || "mock"; // mock | gigachat | yandex | hybrid
const MAX_VARIANTS = Number(process.env.AI_DESIGNER_MAX_VARIANTS || 3);
const MOCK_DELAY_MS = Number(process.env.AI_DESIGNER_MOCK_DELAY_MS || 0);

/* dev-хранилище проектов (JSON), если нет DATABASE_URL */
const FILE = path.resolve(__dirname, "dev-ai-designer.json");
const loadAll = () => (fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { projects: [] });
const saveAll = (d) => fs.writeFileSync(FILE, JSON.stringify(d, null, 2));

const now = () => new Date().toISOString();
const uid = (p) => p + "_" + Date.now().toString(36) + crypto.randomBytes(3).toString("hex");

/* ---------- промпты (зеркало /src/lib/ai-designer/prompts.ts) ----------
   Используются будущими провайдерами; на этапе mock не отправляются. */
const PROMPTS = require("./ai-designer-prompts.cjs");

/* ---------- заглушки боевых провайдеров ----------
   Контракт фиксирован: каждая функция принимает payload и prompt,
   обязана вернуть JSON того же формата, что и mock. Реализация —
   отдельная задача (ключи: GIGACHAT_CLIENT_ID/SECRET, YANDEX_API_KEY). */
async function callProvider(task, payload) {
  if (AI_PROVIDER === "mock") return mockResponse(task, payload);
  /* TODO(отдельная задача): сетевые вызовы через защищённые SDK:
     - gigachat: POST https://gigachat.devices.sberbank.ru/api/v2/chat/completions (Vision/files/text2image)
     - yandex:   Generation completion + Vision OCR (Object Storage)
     - hybrid:   маршрутизация по таблице задач ТЗ §11.3 */
  console.warn(`[ai-designer] провайдер «${AI_PROVIDER}» ещё не подключён — mock-ответ`);
  return mockResponse(task, payload);
}

/* ---------- mock-ответы сервера (тот же формат, что у клиента) ---------- */
function mockResponse(task, payload) {
  const rnd = (n) => Math.floor(Math.random() * n);
  switch (task) {
    case "analyze_interior":
      return {
        status: "clarifying",
        detected: { roomType: "living_room", lighting: "medium", objects: ["sofa", "window", "rug"] },
        questions: [
          { id: "keep", title: "Что важно сохранить?", type: "multi_select", options: ["Планировку", "Окна", "Пол", "Крупную мебель"] },
          { id: "budget", title: "Какой бюджет комплекта?", type: "single_select", options: ["До 50 000 ₽", "50 000–150 000 ₽", "150 000–500 000 ₽", "Премиум", "Без ограничений"] },
          { id: "change", title: "Что изменить в первую очередь?", type: "multi_select", options: ["Мебель", "Свет", "Текстиль", "Отделку", "Декор", "Всё"] },
        ],
      };
    case "analyze_fashion":
      return {
        status: "clarifying",
        detected: { pose: "стоя, анфас", personVisible: true, fullBody: true, suggestModelMode: false },
        questions: [
          { id: "occasion", title: "Для какого повода нужен образ?", type: "single_select", options: ["Встреча с друзьями", "Работа", "Свидание", "Путешествие", "Повседневность", "Особое событие"] },
          { id: "style", title: "Какой стиль ближе?", type: "single_select", options: ["Минимализм", "Casual", "Smart casual", "Спортивный", "Вечерний", "Романтичный", "Дерзкий"] },
          { id: "budget", title: "Какой бюджет?", type: "single_select", options: ["До 10 000 ₽", "10 000–30 000 ₽", "30 000–100 000 ₽", "Премиум", "Без ограничений"] },
        ],
      };
    case "generate":
      return {
        status: "variants",
        variants: Array.from({ length: MAX_VARIANTS }, (_, i) => ({
          id: uid("var"), projectId: payload.projectId,
          title: ["Тёплый минимализм", "Современная классика", "Japandi"][i] || `Вариант ${i + 1}`,
          description: "Серверный mock-вариант — боевые концепции сформирует AI-провайдер.",
          conceptTags: [], changes: [],
          estimatedBudget: { amount: 90000 + rnd(60000), currency: "RUB" },
          imageUrl: "", intensity: ["soft", "balanced", "bold"][i], objects: [], createdAt: now(),
        })),
      };
    case "select":
      return { status: "shopping", shoppingSet: { id: uid("set"), projectId: payload.projectId, variantId: payload.variantId, items: [], totalPrice: { amount: 0, currency: "RUB" }, availableItemsCount: 0, totalItemsCount: 0 } };
    case "replace":
      return { ok: true, note: "Товар заменён. Комплект обновлён." };
    case "edit":
      return { ok: true, imageUrl: "", updatedObjects: [], note: "Локальное изменение применено mock-провайдером." };
    case "add_to_cart":
      return { added: (payload.productIds || []).length, skippedUnavailable: 0, cartVersion: Date.now() };
    default:
      return { ok: false, code: "unknown_task", userMessage: "Задача не распознана." };
  }
}

/* ---------- маршруты ---------- */
function mount(app, ctx) {
  const { guard } = ctx;
  /* §4.3: per-user rate limiting на все AI-эндпоинты модуля (≤10/мин) */
  const aiLimit = aiSec.makeAiRateLimiter({ windowMs: 60_000, max: Number(process.env.AI_DESIGNER_RATE_MAX || 10) });

  /* создание проекта */
  app.post("/api/ai-designer/projects", guard, aiLimit, async (req, res) => {
    try {
      const { mode, sourceImageId, preferences } = req.body || {};
      if (!["interior", "fashion"].includes(mode)) return res.status(400).json({ ok: false, code: "bad_mode", userMessage: "Неизвестный сценарий." });
      /* §4.1/§4.2: текстовые поля предпочтений санитизируются и очищаются от PII
         до сохранения и до будущей отправки провайдеру */
      const cleanPrefs = sanitizePreferences(preferences);
      const project = {
        id: uid("prj"), userId: req.userId, mode, status: "analyzing",
        /* уникальный id AI-сессии, привязанный к владельцу (§4.3) */
        aiSessionId: aiSec.aiSessionId(req.userId).sessionId,
        sourceImageId: typeof sourceImageId === "string" && sourceImageId.length < 8_000_000 ? sourceImageId : "",
        preferences: cleanPrefs, variants: [], createdAt: now(), updatedAt: now(),
      };
      const d = loadAll(); d.projects.unshift(project); saveAll(d);
      res.json({ projectId: project.id, status: "analyzing" });
    } catch (e) { console.error("[AI-DESIGNER ERROR]", e); res.status(500).json({ ok: false, code: "server", userMessage: "Не удалось создать проект. Попробуйте ещё раз." }); }
  });

  /* список проектов владельца (доступ — только свой) */
  app.get("/api/ai-designer/projects", guard, (_req, res) => {
    const d = loadAll();
    res.json({ ok: true, projects: d.projects.filter((p) => p.userId === _req.userId).map(stripPhoto) });
  });

  /* проект целиком */
  app.get("/api/ai-designer/projects/:id", guard, (req, res) => {
    const p = loadAll().projects.find((x) => x.id === req.params.id && x.userId === req.userId);
    if (!p) return res.status(404).json({ ok: false, code: "not_found", userMessage: "Проект не найден." });
    res.json({ ok: true, project: p });
  });

  /* удаление проекта: фото, варианты, товарные привязки */
  app.delete("/api/ai-designer/projects/:id", guard, (req, res) => {
    const d = loadAll();
    const before = d.projects.length;
    d.projects = d.projects.filter((x) => !(x.id === req.params.id && x.userId === req.userId));
    if (d.projects.length === before) return res.status(404).json({ ok: false, code: "not_found", userMessage: "Проект не найден." });
    saveAll(d);
    res.json({ ok: true });
  });

  /* анализ фото */
  app.post("/api/ai-designer/projects/:id/analyze", guard, aiLimit, wrap(callTask((req) =>
    req.body?.mode === "fashion" ? "analyze_fashion" : "analyze_interior")));

  /* генерация вариантов */
  app.post("/api/ai-designer/projects/:id/generate", guard, aiLimit, wrap(callTask(() => "generate")));

  /* выбор варианта + grounding */
  app.post("/api/ai-designer/projects/:id/variants/:variantId/select", guard, aiLimit, wrap(callTask(() => "select")));

  /* замена товара */
  app.post("/api/ai-designer/projects/:id/variants/:variantId/objects/:objectId/replace", guard, aiLimit, wrap(callTask(() => "replace")));

  /* точечное редактирование (свободный текстовый ввод пользователя → санитизация §4.1) */
  app.post("/api/ai-designer/projects/:id/variants/:variantId/edit", guard, aiLimit, wrap(callTask(() => "edit")));

  /* добавление комплекта в существующую корзину (клиентская корзина —
     единая для всего сайта; сюда приходят только productIds) */
  app.post("/api/ai-designer/projects/:id/shopping-set/add-to-cart", guard, wrap(callTask(() => "add_to_cart")));

  console.log(`[ai-designer] routes mounted | provider: ${AI_PROVIDER}`);
}

async function callTask(taskOf) {
  return async (req, res) => {
    const task = taskOf(req);
    const payload = { projectId: req.params.id, variantId: req.params.variantId, objectId: req.params.objectId, ...(req.body || {}) };
    /* §4.3: изоляция контекста — проект принадлежит только владельцу;
       история/данные чужого пользователя никогда не попадают в запрос. */
    const proj = loadAll().projects.find((x) => x.id === req.params.id);
    if (proj && req.userId) aiSec.assertSessionOwner({ userId: proj.userId }, req.userId);
    /* БЛОК 4 (§4.1/§4.2): весь свободный текстовый ввод пользователя
       санитизируется от prompt-injection и очищается от PII до того,
       как будет подставлен в промпт боевого провайдера. */
    for (const k of ["instruction", "prompt", "text", "note", "comment", "query"]) {
      if (typeof payload[k] === "string") payload[k] = aiSec.maskPII(aiSec.sanitizeUserInput(payload[k]));
    }
    /* Промпт будущего провайдера прикладывается к задаче (не логируется).
       Канонический порядок сообщений: system → history(same owner) → user. */
    void PROMPTS[task];
    void aiSec.buildChatMessages(JSON.stringify(payload));
    if (MOCK_DELAY_MS > 0) await new Promise((r) => setTimeout(r, MOCK_DELAY_MS));
    return await callProvider(task, payload);
  };
}

/* Санитизация объекта предпочтений проекта: строки проходят анти-инъекцию
   и маскирование PII (§4.1/§4.2), остальные значения сохраняются как есть. */
function sanitizePreferences(prefs) {
  if (!prefs || typeof prefs !== "object") return {};
  const out = {};
  for (const [k, v] of Object.entries(prefs)) {
    if (typeof v === "string") out[k] = aiSec.maskPII(aiSec.sanitizeUserInput(v));
    else if (Array.isArray(v)) out[k] = v.map((x) => (typeof x === "string" ? aiSec.maskPII(aiSec.sanitizeUserInput(x)) : x));
    else out[k] = v;
  }
  return out;
}

function wrap(fn) {
  return async (req, res) => {
    try {
      const out = await fn(req, res);
      res.json(out);
    } catch (e) {
      /* технические детали — только в лог; пользователю — понятная ошибка (§16.2) */
      console.error("[AI-DESIGNER ERROR]", e?.message || e);
      res.status(503).json({ ok: false, code: "provider_unavailable", userMessage: "Сервис временно недоступен. Введённые данные сохранены — повторите попытку без загрузки фото заново." });
    }
  };
}

function stripPhoto(p) { const c = { ...p }; c.sourceImageId = ""; return c; }

module.exports = { mount, AI_PROVIDER };
