/* ============================================================
   ЗАДАЧА 3: серверная лента подписок, лента продавца,
   уведомления и фоновые обработчики email/push.
   Все операции идут через репозиторный слой server/repo.cjs
   (postgres при DATABASE_URL, иначе — файловый dev-режим).
   ============================================================ */

module.exports = function feedRouter(app, ctx, repo) {
  /* Репозиторий внедряется из index.cjs; при прямом подключении — создаём свой. */
  const R = repo || require('./repo.cjs')({});

  /** Разрешение пользователя: guard (req.userId) либо JWT/x-user-id как в subscriptions.cjs. */
  function resolveUser(req) {
    if (req.userId) return String(req.userId);
    try {
      const jwt = require('jsonwebtoken');
      const secret = (ctx && ctx.JWT_SECRET) || null;
      const cookies = req.cookies || {};
      let t = cookies['qf_session'] || null;
      const authz = String(req.headers.authorization || '');
      if (!t && authz.startsWith('Bearer ')) t = authz.slice(7);
      if (t && secret) {
        const p = jwt.verify(t, secret);
        if (p.scope === 'user') return String(p.sub);
      }
    } catch { /* нет токена — гость */ }
    const h = req.headers['x-user-id'];
    if (h && String(h).trim()) return String(h).trim();
    return null;
  }

  /* ---------- п.1–п.3: общая лента новых товаров от всех подписок ---------- */
  app.get('/api/feed', async (req, res) => {
    try {
      const userId = resolveUser(req);
      if (!userId) return res.status(401).json({ ok: false, error: 'no_session' });
      /* п.1: limit (по умолчанию 20), cursor, target_type;
         п.2: обогащение продавцом + is_new;
         п.3: last_seen_at обновляется ПОСЛЕ формирования выдачи. */
      const { items, next_cursor } = await R.getFeed(userId, {
        limit: req.query.limit,
        cursor: req.query.cursor,
        targetType: req.query.target_type,
      });
      res.json({ ok: true, feed: items, next_cursor });
    } catch (e) {
      console.error('[FEED ERROR]', e);
      res.status(500).json({ ok: false, error: 'server' });
    }
  });

  /* ---------- п.8: список уведомлений пользователя ---------- */
  app.get('/api/notifications', async (req, res) => {
    try {
      const userId = resolveUser(req);
      if (!userId) return res.status(401).json({ ok: false, error: 'no_session' });
      /* limit (по умолчанию 20), cursor, unread_only (по умолчанию false),
         сортировка created_at DESC — всё в репозитории. */
      const { items, next_cursor } = await R.listUserNotifications(userId, {
        limit: req.query.limit,
        cursor: req.query.cursor,
        unreadOnly: req.query.unread_only,
      });
      res.json({ ok: true, notifications: items, next_cursor });
    } catch (e) {
      console.error('[NOTIFICATIONS LIST ERROR]', e);
      res.status(500).json({ ok: false, error: 'server' });
    }
  });

  /* ---------- п.9: отметить уведомление прочитанным (только своё) ---------- */
  app.put('/api/notifications/:id/read', async (req, res) => {
    try {
      const userId = resolveUser(req);
      if (!userId) return res.status(401).json({ ok: false, error: 'no_session' });
      const r = await R.markNotificationRead(userId, String(req.params.id));
      if (!r) return res.status(404).json({ ok: false, error: 'Уведомление не найдено' });
      res.json({ ok: true });
    } catch (e) {
      console.error('[NOTIFICATION READ ERROR]', e);
      res.status(500).json({ ok: false, error: 'server' });
    }
  });

  /* ---------- п.10: отметить все уведомления прочитанными ---------- */
  app.put('/api/notifications/read-all', async (req, res) => {
    try {
      const userId = resolveUser(req);
      if (!userId) return res.status(401).json({ ok: false, error: 'no_session' });
      const { updated } = await R.markAllNotificationsRead(userId);
      res.json({ ok: true, updated });
    } catch (e) {
      console.error('[NOTIFICATIONS READ ALL ERROR]', e);
      res.status(500).json({ ok: false, error: 'server' });
    }
  });

  /* ---------- п.11–п.12: лента товаров конкретного продавца ---------- */
  app.get('/api/sellers/:id/feed', async (req, res) => {
    try {
      const sellerId = String(req.params.id);
      const seller = await R.getSellerById(sellerId);
      if (!seller) return res.status(404).json({ ok: false, error: 'Продавец не найден' });
      const userId = resolveUser(req);
      /* п.12: last_seen_at подписки обновляется только для подписанного
         пользователя и только после того, как лента получена. */
      const { items, next_cursor, seen } = await R.getSellerFeed(sellerId, {
        limit: req.query.limit,
        cursor: req.query.cursor,
        userId: userId || undefined,
      });
      res.json({ ok: true, feed: items, next_cursor, last_seen_at: seen ? seen.last_seen_at : null });
    } catch (e) {
      console.error('[SELLER FEED ERROR]', e);
      res.status(500).json({ ok: false, error: 'server' });
    }
  });

  /* ---------- п.4–п.7: фоновые обработчики email/push ---------- */
  /* Запуск интервалом 60 секунд (NOTIFY_WORKER_INTERVAL_MS), не более 100
     уведомлений за запуск; группировка по продавцу/времени и учёт
     настроек пользователя выполняются в репозитории. */
  if (typeof ctx !== 'undefined' && ctx && ctx.startNotifyWorkers !== false) {
    try { R.startBackgroundWorkers(ctx.NOTIFY_WORKER_INTERVAL_MS || process.env.NOTIFY_WORKER_INTERVAL_MS); }
    catch (e) { console.error('[NOTIFY WORKERS START ERROR]', e); }
  }
};
