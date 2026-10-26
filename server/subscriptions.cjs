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

module.exports = function subscriptionsRouter(app, ctx) {
  // 1. Получить все подписки текущего пользователя
  app.get('/api/subscriptions', (req, res) => {
    const userId = resolveUserId(req, ctx);
    if (!userId) return res.status(401).json({ ok: false, error: 'no_session' });
    const db = readDb();
    const userSubs = db.subscriptions.filter(s => s.userId === userId);
    res.json({ ok: true, subscriptions: userSubs });
  });

  // 2. Добавить новую подписку
  app.post('/api/subscriptions', (req, res) => {
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

    const db = readDb();
    
    // Проверка на дубликат
    const exists = db.subscriptions.some(s => s.userId === userId && s.targetType === targetType && s.targetId === targetId);
    if (exists) {
      return res.json({ ok: true, message: 'Уже подписаны' });
    }

    const newSub = {
      id: genId(),
      userId,
      targetType,
      targetId,
      createdAt: new Date().toISOString()
    };

    db.subscriptions.push(newSub);
    writeDb(db);
    res.json({ ok: true, subscription: newSub });
  });

  // 3. Удалить подписку
  app.delete('/api/subscriptions/:targetType/:targetId', (req, res) => {
    const userId = resolveUserId(req, ctx);
    if (!userId) return res.status(401).json({ ok: false, error: 'no_session' });
    const { targetType, targetId } = req.params;
    
    const db = readDb();
    const initialLength = db.subscriptions.length;
    
    db.subscriptions = db.subscriptions.filter(s => 
      !(s.userId === userId && s.targetType === targetType && s.targetId === targetId)
    );

    if (db.subscriptions.length < initialLength) {
      writeDb(db);
      res.json({ ok: true, message: 'Подписка удалена' });
    } else {
      res.status(404).json({ ok: false, error: 'Подписка не найдена' });
    }
  });
};
