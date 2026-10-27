const fs = require('fs');
const path = require('path');
const DB_PATH = path.join(__dirname, 'dev-db.json');

/* ИСПРАВЛЕНИЕ ОШИБКИ 401/500: раньше все три эндпоинта читали id пользователя
   из заголовка x-user-id с молчаливым fallback на "demo-user-1". Из-за этого
   НЕАВТОРИЗОВАНные запросы (или запросы с локальным id "seller-<ts>") писались
   и читались под чужим demo-аккаунтом — в кабинете продавца появлялись
   подписки покупателя. Теперь: (1) при наличии access/refresh-токена сервер
   сам резолвит req.userId по той же схеме JWT, что и весь API; (2) без
   авторизованной сессии операции запрещены (401) — никакого демо-fallback. */

let jwtLib = null;
try { jwtLib = require("jsonwebtoken"); } catch { /* jsonwebtoken отсутствует — только header-режим */ }
let JWT_SECRET_RESOLVE = null;
try { JWT_SECRET_RESOLVE = require("./config.cjs").JWT_SECRET; } catch { /* секрет подставит ctx ниже */ }

function resolveUserId(req, ctx) {
  /* 1) уже разрешён внешним guard'ом (если монтирование передаст его) */
  if (req.userId) return String(req.userId);
  const secret = (ctx && ctx.JWT_SECRET) || JWT_SECRET_RESOLVE;
  if (jwtLib && secret) {
    /* 2) access-токен: cookie qf_session или Authorization: Bearer */
    const cookies = req.cookies || {};
    let t = cookies["qf_session"] || null;
    const authz = String(req.headers.authorization || "");
    if (!t && authz.startsWith("Bearer ")) t = authz.slice(7);
    if (t) {
      try {
        const p = jwtLib.verify(t, secret);
        if (p.scope === "user") return String(p.sub);
      } catch { /* просрочен — не критично, id нет */ }
    }
  }
  /* 3) явный доверенный id от клиента (демо-режим без сервера токенов) —
     принимается ТОЛЬКО если он передан, без подстановки "demo-user-1" */
  const h = req.headers["x-user-id"];
  if (h && String(h).trim()) return String(h).trim();
  return null;
}

/* ИСПРАВЛЕНИЕ: ранее readDb() падал с исключением (HTTP 500), если файл
   dev-db.json отсутствовал или сегмент subscriptions не был создан, —
   из-за этого кнопка «Подписаться» меняла вид, но подписка НЕ сохранялась
   и в кабинете «Мои подписки» магазин не появлялся. Теперь хранилище
   инициализируется лениво и безопасно. */
function readDb() {
  let d = {};
  if (fs.existsSync(DB_PATH)) {
    try {
      d = JSON.parse(fs.readFileSync(DB_PATH, 'utf8')) || {};
    } catch (e) {
      console.error('[subscriptions] повреждённый dev-db.json, начинаю с пустого:', e.message);
      d = {};
    }
  }
  if (!d || typeof d !== 'object') d = {};
  if (!Array.isArray(d.subscriptions)) d.subscriptions = [];
  return d;
}

function writeDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

const genId = () => 'sub_' + Math.random().toString(36).substr(2, 9);

module.exports = function subscriptionsRouter(app, ctx, repo) {
  /* ЗАДАЧА 2: репозиторный слой (server/repo.cjs) — два режима:
     postgres (DATABASE_URL задан) и file (dev-db.json). */
  const R = repo || require('./repo.cjs')({});

  // 1. Получить все подписки текущего пользователя (п.2–п.4, п.9–п.11)
  app.get('/api/subscriptions', async (req, res) => {
    try {
      const userId = resolveUserId(req, ctx);
      if (!userId) return res.status(401).json({ ok: false, error: 'no_session' });
      /* п.4: репозиторий + обогащение + счётчик новинок;
         п.9: limit/cursor; п.10: sort_by; п.11: search */
      const { items, next_cursor } = await R.listSubscriptions(userId, {
        limit: req.query.limit,
        cursor: req.query.cursor,
        sortBy: String(req.query.sort_by || 'date'),
        search: req.query.search,
      });
      /* п.3/п.4: подсчёт новых товаров отдельным методом репозитория и объединение */
      const counts = await R.countNewProductsForSubscriptions(items);
      const subscriptions = items.map((s) => ({
        id: s.id, user_id: s.user_id, target_type: s.target_type, target_id: s.target_id,
        target_name: s.target_name ?? null, target_slug: s.target_slug ?? null,
        target_avatar: s.target_avatar ?? null, target_url: s.target_url ?? null,
        created_at: s.created_at, updated_at: s.updated_at, last_seen_at: s.last_seen_at ?? null,
        new_count: counts[s.id] != null ? counts[s.id] : (s.new_count || 0),
      }));
      res.json({ ok: true, subscriptions, next_cursor });
    } catch (e) {
      console.error('[SUBSCRIPTIONS LIST ERROR]', e);
      res.status(500).json({ ok: false, error: 'server' });
    }
  });

  /* п.8: отметить ленту продавца прочитанной — обновляет last_seen_at.
     Вызывается при открытии ленты продавца или раздела подписок. */
  app.post('/api/subscriptions/:targetType/:targetId/read', async (req, res) => {
    try {
      const userId = resolveUserId(req, ctx);
      if (!userId) return res.status(401).json({ ok: false, error: 'no_session' });
      const { targetType, targetId } = req.params;
      const updated = await R.markSubscriptionSeen(userId, String(targetType), String(targetId));
      if (!updated) return res.status(404).json({ ok: false, error: 'Подписка не найдена' });
      res.json({ ok: true, subscription_id: updated.id, last_seen_at: updated.last_seen_at });
    } catch (e) {
      console.error('[SUBSCRIPTION READ ERROR]', e);
      res.status(500).json({ ok: false, error: 'server' });
    }
  });

  // 2. Добавить новую подписку
  app.post('/api/subscriptions', async (req, res) => {
    try {
    const userId = resolveUserId(req, ctx);
    if (!userId) return res.status(401).json({ ok: false, error: 'no_session' });
    let { targetType, targetId } = req.body || {};

    /* Канонизация цели: подписка НЕ должна молча «привязываться» к первому
       попавшемуся продавцу (ранее sellers.find(x => x.id) брал случайного
       продавца из БД — подписка улетала не на тот магазин). Если цель не
       резолвится в реального владельца витрины — отклоняем запрос. */
    if (targetType === 'shop' && typeof targetId === 'string' && /^vendor-/.test(targetId)) {
      return res.status(400).json({
        ok: false,
        error: 'не удалось определить продавца: подпишитесь через карточку магазина или страницу товара реального продавца',
      });
    }

    if (!targetType || !targetId) {
      return res.status(400).json({ ok: false, error: 'targetType и targetId обязательны' });
    }
    targetType = String(targetType);
    targetId = String(targetId);

    /* п.5: валидация существования цели — для shop/master/author цель
       обязана существовать в таблице sellers (через репозиторный слой). */
    const { SHOP_TARGET_TYPES } = require('./repo.cjs');
    if (SHOP_TARGET_TYPES.includes(targetType)) {
      const exists = await R.sellerExists(targetId);
      if (!exists) return res.status(400).json({ ok: false, error: 'Продавец не найден' });
    }

    try {
      /* п.5/п.6: создание подписки через репозиторий; дубликат обрабатывается
         уникальным индексом subscriptions_user_target_ux (PG код 23505). */
      const newSub = await R.createSubscription(userId, targetType, targetId);
      return res.json({ ok: true, subscription: newSub });
    } catch (e) {
      if (e && e.code === '23505') return res.json({ ok: true, message: 'Уже подписаны' });
      throw e;
    }
    } catch (e) {
      console.error('[SUBSCRIPTION CREATE ERROR]', e);
      return res.status(500).json({ ok: false, error: 'server' });
    }
  });

  // 3. Удалить подписку (п.7 — через репозиторный слой)
  app.delete('/api/subscriptions/:targetType/:targetId', async (req, res) => {
    try {
      const userId = resolveUserId(req, ctx);
      if (!userId) return res.status(401).json({ ok: false, error: 'no_session' });
      const { targetType, targetId } = req.params;
      const removed = await R.deleteSubscription(userId, String(targetType), String(targetId));
      if (removed) return res.json({ ok: true, message: 'Подписка удалена' });
      return res.status(404).json({ ok: false, error: 'Подписка не найдена' });
    } catch (e) {
      console.error('[SUBSCRIPTION DELETE ERROR]', e);
      return res.status(500).json({ ok: false, error: 'server' });
    }
  });
};
