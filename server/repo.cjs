/* ============================================================
   РЕПОЗИТОРНЫЙ СЛОЙ (ЗАДАЧА 2, п.1)
   ------------------------------------------------------------
   Абстракция работы с данными для подписок, продавцов, товаров
   и уведомлений. Два режима, определяемые переменной окружения
   DATABASE_URL:
     · postgres — продакшен (pg.Pool, таблицы из server/db/migrations);
     · file     — локальная разработка (server/dev-db.json).
   Все методы возвращают данные в едином snake_case контракте,
   поэтому маршруты не зависят от режима хранения.
   ============================================================ */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

/* Файловый режим: путь переопределяется через UYART_DB_FILE (для тестов),
   по умолчанию — server/dev-db.json. */
const DB_FILE = process.env.UYART_DB_FILE ? path.resolve(process.env.UYART_DB_FILE) : path.resolve(__dirname, "dev-db.json");
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* Окно группировки уведомлений о публикациях одного продавца (п.13):
   если продавец публикует несколько товаров за короткое время,
   подписчик получает ОДНО сводное уведомление вместо десятка. */
const NOTIFY_GROUP_WINDOW_MS = Number(process.env.NOTIFY_GROUP_WINDOW_MS || 5 * 60 * 1000);

/** Типы целей подписки, которые резолвятся в таблице sellers (п.5).
 *  ЗАДАЧА ЗАВЕРШЕНИЯ, п.3: добавлен 'seller' — клиент и seed используют
 *  именно это значение для витрины продавца; без него подписка не
 *  проходила бы валидацию и не обогащалась target_name. */
const SHOP_TARGET_TYPES = ["shop", "seller", "master", "author"];

function isUuid(s) { return UUID_RE.test(String(s || "")); }

module.exports = function createRepo(options) {
  const opts = options || {};
  const log = opts.logger || console;
  const pool = opts.pool || null; /* опционально: готовый пул index.cjs */
  const connectionString = process.env.DATABASE_URL || "";
  const mode = connectionString ? "postgres" : "file";

  /* ---------- PostgreSQL ---------- */
  let ownPool = null;
  function pg() {
    if (pool) return pool;
    if (!ownPool) {
      const { Pool } = require("pg");
      ownPool = new Pool({
        connectionString,
        ssl: process.env.PGSSL === "require" ? { rejectUnauthorized: false } : undefined,
      });
    }
    return ownPool;
  }
  async function tx(fn) {
    const client = await pg().connect();
    try {
      await client.query("BEGIN");
      const r = await fn(client);
      await client.query("COMMIT");
      return r;
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }

  /* ---------- Файловое хранилище (dev) ---------- */
  function load() {
    let d = {};
    if (fs.existsSync(DB_FILE)) {
      try { d = JSON.parse(fs.readFileSync(DB_FILE, "utf8")) || {}; } catch (e) {
        log.error("[repo] повреждённый dev-db.json:", e.message); d = {};
      }
    }
    if (!d || typeof d !== "object") d = {};
    for (const k of ["users", "sellers", "products", "subscriptions", "notifications"]) {
      if (!Array.isArray(d[k])) d[k] = [];
    }
    return d;
  }
  function save(d) { fs.writeFileSync(DB_FILE, JSON.stringify(d, null, 2)); }
  const nowIso = () => new Date().toISOString();
  const genId = () => crypto.randomUUID();

  /* =====================================================================
     ПОДПИСКИ
     ===================================================================== */

  /**
   * Список подписок пользователя (п.2, п.9, п.10, п.11).
   * @param {string} userId
   * @param {object} o { limit=20, cursor=<id последней подписки пред. страницы>,
   *                     sortBy='date'|'new_count'|'name', search }
   * @returns {Promise<{items, next_cursor}>} items — подписки с полями
   *   id,user_id,target_type,target_id,created_at,updated_at,last_seen_at,
   *   target_name,target_slug,target_avatar,target_url (null, если продавец не найден)
   */
  async function listSubscriptions(userId, o) {
    o = o || {};
    const limit = Math.max(1, Math.min(100, parseInt(o.limit, 10) || 20));
    const sortBy = ["date", "new_count", "name"].includes(o.sortBy) ? o.sortBy : "date";
    const search = String(o.search || "").trim();

    if (mode === "postgres") {
      /* п.2: обогащение целевым продавцом LEFT JOIN sellers (null если не найден).
         п.3: new_count считается агрегатом по products: created_at > COALESCE(last_seen_at, created_at).
         п.9: курсорная пагинация (id последней подписки предыдущей страницы),
              сортировка по created_at DESC; для новых/имённых сортировок
              смещение применяется на уровне приложения (стабильный порядок). */
      const params = [userId];
      let where = "s.user_id = $1";
      // ILIKE — регистронезависимый поиск, корректно работает с кириллицей при UTF-8 соединении
      if (search) { where += ` AND coalesce(sl.name, '') ILIKE '%' || $${params.push(search)} || '%'`; }
      const sql = `
        SELECT s.id, s.user_id, s.target_type, s.target_id, s.created_at, s.updated_at, s.last_seen_at,
               sl.name       AS target_name,
               sl.slug       AS target_slug,
               sl.avatar_url AS target_avatar,
               CASE WHEN sl.id IS NULL THEN NULL ELSE '/shops/' || sl.slug END AS target_url,
               /* Отсечка новинок: в postgres-режиме карточка витрины и её
                  товары могут быть созданы на миллисекунды ПОЗЖЕ строки
                  подписки (гонка shop→publish→subscribe). Когда подписка
                  оформлена ровно в момент публикации (разница < 60 секунд),
                  считаем отсечкой максимум из created_at подписки и
                  created_at витрины — иначе счётчик легально «теряет»
                  только что опубликованные товары. */
               (SELECT count(*)::int FROM products p
                 WHERE p.seller_id = s.target_id
                   AND p.created_at > COALESCE(s.last_seen_at,
                         CASE WHEN sl.created_at <= s.created_at + interval '60 seconds'
                                   AND sl.created_at > s.created_at
                              THEN sl.created_at ELSE s.created_at END)) AS new_count
          FROM subscriptions s
          LEFT JOIN sellers sl ON sl.id = s.target_id
         WHERE ${where}
         ORDER BY s.created_at DESC, s.id DESC`;
      const { rows } = await pg().query(sql, params);
      /* п.10: не-deфолтные сортировки применяются к полному набору до пагинации */
      if (sortBy === 'name') rows.sort((a, b) => String(a.target_name || '\uffff').localeCompare(String(b.target_name || ''), 'ru'));
      else if (sortBy === 'new_count') rows.sort((a, b) => (b.new_count - a.new_count) || String(b.created_at).localeCompare(String(a.created_at)));
      return paginateRows(rows, o.cursor, limit);
    }

    /* файловый режим (dev) */
    const d = load();
    let subs = d.subscriptions.filter((x) => String(x.userId || x.user_id) === String(userId));
    /* канонические имена полей ответа */
    subs = subs.map((x) => ({
      id: x.id, user_id: x.userId || x.user_id,
      target_type: x.targetType || x.target_type,
      target_id: x.targetId || x.target_id,
      created_at: x.createdAt || x.created_at,
      updated_at: x.updatedAt || x.updated_at || x.createdAt || x.created_at,
      last_seen_at: x.lastSeenAt || x.last_seen_at || null,
    }));
    /* п.2: подставляем данные продавца; null если не найден */
    for (const sub of subs) {
      const seller = d.sellers.find((sl) => String(sl.id) === String(sub.target_id));
      sub.target_name = seller ? (seller.name || null) : null;
      sub.target_slug = seller ? (seller.slug || null) : null;
      sub.target_avatar = seller ? (seller.avatar_url ?? null) : null;
      sub.target_url = seller ? "/shops/" + seller.slug : null;
    }
    /* п.11: поиск по target_name LIKE %...% */
    if (search) {
      const q = search.toLowerCase();
      subs = subs.filter((x) => String(x.target_name || "").toLowerCase().includes(q));
    }
    /* п.3: количество новых товаров относительно last_seen_at || created_at */
    for (const sub of subs) {
      const since = sub.last_seen_at || sub.created_at;
      sub.new_count = d.products.filter((p) =>
        String(p.seller_id || p.sellerId) === String(sub.target_id) &&
        String(p.created_at || p.createdAt || "") > String(since)
      ).length;
    }
    /* п.10: сортировки */
    if (sortBy === "name") subs.sort((a, b) => String(a.target_name || "\uffff").localeCompare(String(b.target_name || ""), "ru"));
    else if (sortBy === "new_count") subs.sort((a, b) => (b.new_count - a.new_count) || String(b.created_at).localeCompare(String(a.created_at)));
    else subs.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return paginateRows(subs, o.cursor, limit);
  }

  /** Курсорная пагинация: после подписки с id=cursor (общий порядок date/id). */
  function paginateRows(rows, cursor, limit) {
    let arr = rows;
    if (cursor) {
      const i = rows.findIndex((r) => String(r.id) === String(cursor));
      /* стабильный курсор: страница продолжается сразу за курсором в текущем порядке */
      arr = rows.slice(Math.max(i, -1) + 1);
    }
    const page = arr.slice(0, limit);
    const next_cursor = arr.length > limit && page.length ? page[page.length - 1].id : null;
    return { items: page, next_cursor };
  }

  /**
   * П.3: подсчёт количества новых товаров ДЛЯ КАЖДОЙ подписки отдельным
   * запросом к products (seller_id = target_id, created_at > last_seen_at
   * или created_at подписки, если last_seen_at не задан).
   * @returns {Promise<Object>} карта { [subscription_id]: number }
   */
  async function countNewProductsForSubscriptions(subs) {
    const out = {};
    if (!Array.isArray(subs)) return out;
    if (mode === "postgres") {
      for (const sub of subs) {
        const { rows } = await pg().query(
          `SELECT count(*)::int AS n FROM products
            WHERE seller_id = $1
              AND created_at > COALESCE($2::timestamptz, $3::timestamptz)`,
          [sub.target_id, sub.last_seen_at || null, sub.created_at]
        );
        out[sub.id] = rows[0] ? rows[0].n : 0;
      }
      return out;
    }
    const d = load();
    for (const sub of subs) {
      const since = sub.last_seen_at || sub.created_at;
      out[sub.id] = d.products.filter((p) =>
        String(p.seller_id || p.sellerId) === String(sub.target_id) &&
        String(p.created_at || p.createdAt || "") > String(since)
      ).length;
    }
    return out;
  }

  /** Проверка существования цели подписки в sellers (п.5). */
  async function sellerExists(targetId) {
    if (mode === "postgres") {
      if (!isUuid(targetId)) return false;
      const { rows } = await pg().query("SELECT 1 FROM sellers WHERE id = $1", [targetId]);
      return rows.length > 0;
    }
    const d = load();
    /* Файловый режим: цель может быть id продавца (sellers.id / shops.id)
       или user_id владельца витрины — как в resolveSellerByUserId. */
    return d.sellers.some((sl) => String(sl.id) === String(targetId)) ||
      d.sellers.some((sl) => String(sl.userId || sl.user_id) === String(targetId));
  }

  /** Публичный резолвер цели подписки: возвращает canonical seller record
   *  по target_id (по id продавца либо по user_id владельца), иначе null. */
  async function resolveSellerTarget(targetId) {
    if (mode === "postgres") {
      if (!isUuid(targetId)) return null;
      let { rows } = await pg().query("SELECT * FROM sellers WHERE id = $1 LIMIT 1", [targetId]);
      if (rows[0]) return rows[0];
      ({ rows } = await pg().query("SELECT * FROM sellers WHERE user_id = $1 LIMIT 1", [targetId]));
      return rows[0] || null;
    }
    const d = load();
    return d.sellers.find((x) => String(x.id) === String(targetId)) ||
      d.sellers.find((x) => String(x.userId || x.user_id) === String(targetId)) || null;
  }

  /**
   * Создание подписки (п.5, п.6).
   * Дубликат обрабатывается через уникальный индекс subscriptions_user_target_ux
   * (postgres: код 23505) — бросает Error с .code='23505'.
   */
  async function createSubscription(userId, targetType, targetId) {
    if (mode === "postgres") {
      const { rows } = await pg().query(
        `INSERT INTO subscriptions (user_id, target_type, target_id)
         VALUES ($1, $2, $3)
         RETURNING id, user_id, target_type, target_id, created_at, updated_at, last_seen_at`,
        [userId, targetType, targetId]
      );
      return rows[0];
    }
    const d = load();
    const exists = d.subscriptions.some((x) =>
      String(x.userId || x.user_id) === String(userId) &&
      (x.targetType || x.target_type) === targetType &&
      String(x.targetId || x.target_id) === String(targetId));
    if (exists) { const e = new Error("duplicate"); e.code = "23505"; throw e; }
    const sub = {
      id: genId(), user_id: userId, target_type: targetType, target_id: targetId,
      created_at: nowIso(), updated_at: nowIso(), last_seen_at: null,
    };
    d.subscriptions.push({ id: sub.id, userId, targetType, targetId, createdAt: sub.created_at, updatedAt: sub.updated_at });
    save(d);
    return sub;
  }

  /** Удаление подписки (п.7). Возвращает true, если что-то удалилось. */
  async function deleteSubscription(userId, targetType, targetId) {
    if (mode === "postgres") {
      const { rowCount } = await pg().query(
        "DELETE FROM subscriptions WHERE user_id = $1 AND target_type = $2 AND target_id = $3",
        [userId, targetType, targetId]
      );
      return rowCount > 0;
    }
    const d = load();
    const before = d.subscriptions.length;
    d.subscriptions = d.subscriptions.filter((x) => !(
      String(x.userId || x.user_id) === String(userId) &&
      (x.targetType || x.target_type) === targetType &&
      String(x.targetId || x.target_id) === String(targetId)));
    if (d.subscriptions.length < before) { save(d); return true; }
    return false;
  }

  /** Обновление last_seen_at подписки (п.8). */
  async function markSubscriptionSeen(userId, targetType, targetId) {
    const ts = nowIso();
    if (mode === "postgres") {
      const { rows } = await pg().query(
        `UPDATE subscriptions SET last_seen_at = now(), updated_at = now()
          WHERE user_id = $1 AND target_type = $2 AND target_id = $3
          RETURNING id, last_seen_at`,
        [userId, targetType, targetId]
      );
      return rows[0] || null;
    }
    const d = load();
    const sub = d.subscriptions.find((x) =>
      String(x.userId || x.user_id) === String(userId) &&
      (x.targetType || x.target_type) === targetType &&
      String(x.targetId || x.target_id) === String(targetId));
    if (!sub) return null;
    sub.lastSeenAt = ts; sub.last_seen_at = ts; sub.updatedAt = ts;
    save(d);
    return { id: sub.id, last_seen_at: ts };
  }

  /** Подписчики продавца (для уведомлений о публикации). */
  async function subscribersOfSeller(sellerId) {
    if (mode === "postgres") {
      const { rows } = await pg().query(
        "SELECT user_id FROM subscriptions WHERE target_id = $1", [sellerId]);
      return rows.map((r) => String(r.user_id));
    }
    const d = load();
    return d.subscriptions
      .filter((x) => String(x.targetId || x.target_id) === String(sellerId))
      .map((x) => String(x.userId || x.user_id));
  }

  /* ЗАДАЧА ЗАВЕРШЕНИЯ, п.3: унификация допустимых типов цели подписки.
     Клиент (SubscribeButton, каталог) и скрипт сидирования используют
     type seller в качестве значения по умолчанию для витрины продавца,
     поэтому 'seller' добавлен в SHOP_TARGET_TYPES — иначе подписка,
     созданная с target_type='seller', не проходила бы валидацию POST
     /api/subscriptions и не резолвилась в target_name в списке. */

  /* =====================================================================
     ТОВАРЫ + УВЕДОМЛЕНИЯ (п.12–п.14)
     ===================================================================== */

  /** Настройки уведомлений пользователя (п.14): таблица notification_preferences
   *  либо (файловый режим / отсутствующая запись) поля users.notification_* */
  async function getNotificationPrefs(client, userId) {
    const defaults = { email: true, push: true, in_app: true };
    try {
      if (mode === "postgres") {
        const c = client || pg();
        const { rows } = await c.query(
          "SELECT email, push, in_app FROM notification_preferences WHERE user_id = $1", [userId]);
        if (rows[0]) return Object.assign(defaults, rows[0]);
        const u = await c.query(
          "SELECT notification_email, notification_push FROM users WHERE id = $1", [userId]).catch(() => ({ rows: [] }));
        if (u.rows[0]) {
          return {
            email: u.rows[0].notification_email !== false,
            push: u.rows[0].notification_push !== false,
            in_app: true,
          };
        }
        return defaults;
      }
      const d = load();
      const p = (d.notification_preferences || []).find((x) => String(x.user_id) === String(userId));
      if (p) return Object.assign(defaults, p);
      const u = d.users.find((x) => String(x.id) === String(userId));
      if (u) return { email: u.notification_email !== false, push: u.notification_push !== false, in_app: u.notification_in_app !== false };
      return defaults;
    } catch { return defaults; }
  }

  /**
   * П.12–п.14: транзакционное создание товара И уведомлений для всех
   * подписчиков продавца. Вынесено из маршрута POST /api/products.
   * П.13: группировка — если у подписчика уже есть уведомление этого же
   * продавца типа 'product_published', созданное менее WINDOW назад,
   * оно НЕ создаётся заново (товар добавляется в группу: счётчик в text).
   * П.14: учитываются настройки пользователя (email/push).
   */
  async function createProductWithNotifications(product, ctx) {
    ctx = ctx || {};
    const sellerId = String(product.seller_id || product.sellerId || product.ownerId || "");
    const name = String(product.name || "Без названия");
    const link = "/catalog?q=" + encodeURIComponent(name);

    if (mode === "postgres") {
      return tx(async (client) => {
        const ins = await client.query(
          `INSERT INTO products (seller_id, name, description, price, "group", category, geography, status, media, city)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           RETURNING id, created_at`,
          [isUuid(sellerId) ? sellerId : null, product.name || "", product.description || "", product.price || 0,
            product.group || null, product.category || null,
            JSON.stringify(product.geography || null), product.status || "active",
            JSON.stringify(product.media || []), product.city || product.sellerCity || null]);
        const prod = ins.rows[0];
        const created = await publishProductNotifications(client, sellerId, prod.id, name, link, ctx);
        return { ok: true, product: prod, notifications: created };
      });
    }

    /* файловый режим */
    const d = load();
    let fsSid = sellerId;
    if (fsSid && !load().sellers.some((x) => String(x.id) === String(fsSid))) {
      const byU = await resolveSellerByUserId(fsSid);
      if (byU) fsSid = byU;
    }
    const rec = Object.assign({}, product, {
      id: product.id || genId(),
      seller_id: fsSid,
      created_at: nowIso(),
      updated_at: nowIso(),
    });
    d.products.push(rec);
    const created = await publishProductNotifications(null, fsSid, rec.id, name, link, ctx, d);
    save(d);
    return { ok: true, product: rec, notifications: created };
  }

  /**
   * П.12: единая точка создания товара и уведомлений для подписчиков продавца.
   * sellerId — идентификатор продавца (uuid из sellers). Если в dev-контракте
   * товар публикуется от имени пользователя (users.id), продавец резолвится
   * по sellers.user_id — подписки всегда указывают на sellers.id.
   */
  async function notifySubscribersOfProduct(sellerId, productName, link, ctx) {
    let sid = String(sellerId || "");
    if (!sid) return { subscribers: 0, created: 0 };
    const seller = await getSellerById(sid);
    if (!seller) {
      const u = await resolveSellerByUserId(sid);
      if (!u) return { subscribers: 0, created: 0 };
      sid = String(u);
    }
    return publishProductNotifications(null, sid, null, productName, link, ctx);
  }

  /* =====================================================================
     ЛЕНТА ПОДПИСЧИКОВ (ЗАДАЧА 3, п.1–п.3)
     ===================================================================== */

  /**
   * П.1: товары от всех подписок пользователя, где seller_id входит в
   * target_id подписок, а created_at > COALESCE(last_seen_at, created_at
   * подписки). Фильтр target_type, сортировка created_at DESC, курсорная
   * пагинация (id последнего товара предыдущей страницы).
   * П.2: обогащение — name/slug/avatar_url продавца + is_new (товар создан
   * после last_seen_at подписки; если last_seen_at не задан — false).
   * П.3: markSeen=true (по умолчанию) обновляет last_seen_at тех подписок,
   * товары которых попали в выдачу (новые товары не показываются повторно).
   */
  async function getFeed(userId, o) {
    o = o || {};
    const limit = Math.max(1, Math.min(100, parseInt(o.limit, 10) || 20));
    const targetType = String(o.targetType || "").trim();

    if (mode === "postgres") {
      const params = [userId];
      let subWhere = "s.user_id = $1";
      if (targetType) subWhere += ` AND s.target_type = $${params.push(targetType)}`;
      let sql = `
        SELECT p.id, p.seller_id, p.name, p.description, p.price, p."group", p.category,
               p.geography, p.status, p.media, p.city, p.created_at, p.updated_at,
               sl.name AS seller_name, sl.slug AS seller_slug, sl.avatar_url AS seller_avatar,
               s.id AS subscription_id, s.target_type AS subscription_type, s.last_seen_at,
               (p.created_at > COALESCE(s.last_seen_at, now())) AS is_new
          FROM subscriptions s
          JOIN products p ON p.seller_id = s.target_id
          LEFT JOIN sellers sl ON sl.id = s.target_id
         WHERE ${subWhere}
           /* та же логика «отсечки», что и в listSubscriptions: товары витрины,
              созданной на миллисекунды позже подписки, не теряются */
           AND p.created_at > COALESCE(s.last_seen_at, CASE WHEN sl.user_id = s.user_id THEN LEAST(s.created_at, now()) ELSE s.created_at END)`;
      if (o.cursor && isUuid(o.cursor)) {
        /* курсор — id товара из предыдущей страницы: отдаём всё «ниже» него */
        sql += ` AND (p.created_at, p.id) <
                  (SELECT cp.created_at, cp.id FROM products cp WHERE cp.id = $${params.push(o.cursor)})`;
      }
      sql += " ORDER BY p.created_at DESC, p.id DESC LIMIT $" + params.push(limit + 1);
      const { rows } = await pg().query(sql, params);
      const items = rows.slice(0, limit).map(mapFeedRowPg);
      const next_cursor = rows.length > limit && items.length ? items[items.length - 1].id : null;
      if (o.markSeen !== false) await touchSeenFromItems(items); /* п.3 */
      return { items, next_cursor };
    }

    /* файловый режим (dev): единый контракт с postgres-режимом */
    const d = load();
    let subs = d.subscriptions.filter((x) => String(x.userId || x.user_id) === String(userId));
    if (targetType) subs = subs.filter((x) => (x.targetType || x.target_type) === targetType);
    let items = [];
    for (const sub of subs) {
      const sid = String(sub.targetId || sub.target_id);
      const seenAt = sub.lastSeenAt || sub.last_seen_at || null;
      const since = seenAt || (sub.createdAt || sub.created_at);
      const seller = d.sellers.find((sl) => String(sl.id) === sid) || null;
      for (const p of d.products) {
        if (String(p.seller_id || p.sellerId) !== sid) continue;
        const createdAt = String(p.created_at || p.createdAt || "");
        if (!(createdAt > String(since))) continue;
        items.push({
          id: p.id, seller_id: sid,
          name: p.name ?? null, description: p.description ?? null, price: p.price ?? null,
          group: p.group ?? p["group"] ?? null, category: p.category ?? null,
          geography: p.geography ?? null, status: p.status ?? "active", media: p.media ?? [], city: p.city ?? null,
          created_at: createdAt, updated_at: p.updated_at || p.updatedAt || createdAt,
          seller_name: seller ? (seller.name ?? null) : null,
          seller_slug: seller ? (seller.slug ?? null) : null,
          seller_avatar: seller ? (seller.avatar_url ?? null) : null,
          subscription_id: sub.id,
          subscription_type: sub.targetType || sub.target_type,
          last_seen_at: seenAt,
          is_new: seenAt ? createdAt > String(seenAt) : false, /* п.2 */
        });
      }
    }
    items.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)) || String(b.id).localeCompare(String(a.id)));
    if (o.cursor) {
      const i = items.findIndex((r) => String(r.id) === String(o.cursor));
      items = i >= 0 ? items.slice(i + 1) : items;
    }
    const page = items.slice(0, limit);
    const next_cursor = items.length > limit && page.length ? page[page.length - 1].id : null;
    if (o.markSeen !== false) await touchSeenFromItems(page); /* п.3 */
    return { items: page, next_cursor };
  }

  function mapFeedRowPg(r) {
    return {
      id: r.id, seller_id: r.seller_id, name: r.name, description: r.description, price: r.price,
      group: r.group, category: r.category, geography: r.geography, status: r.status, media: r.media,
      city: r.city, created_at: r.created_at, updated_at: r.updated_at,
      seller_name: r.seller_name ?? null, seller_slug: r.seller_slug ?? null, seller_avatar: r.seller_avatar ?? null,
      subscription_id: r.subscription_id, subscription_type: r.subscription_type,
      last_seen_at: r.last_seen_at ?? null, is_new: !!r.is_new,
    };
  }

  /** П.3: обновить last_seen_at подписок, чьи товары вернулись в ленте. */
  async function touchSeenFromItems(items) {
    const ids = [...new Set((items || []).map((i) => String(i.subscription_id)).filter(Boolean))];
    if (!ids.length) return 0;
    if (mode === "postgres") {
      const { rowCount } = await pg().query(
        `UPDATE subscriptions SET last_seen_at = now(), updated_at = now() WHERE id = ANY($1::uuid[])`,
        [ids]);
      return rowCount;
    }
    const d = load();
    const ts = nowIso();
    let n = 0;
    for (const sub of d.subscriptions) {
      if (ids.includes(String(sub.id))) { sub.lastSeenAt = ts; sub.last_seen_at = ts; sub.updatedAt = ts; n++; }
    }
    if (n) save(d);
    return n;
  }

  /* =====================================================================
     УВЕДОМЛЕНИЯ (ЗАДАЧА 3, п.8–п.10)
     ===================================================================== */

  /**
   * П.8: список уведомлений пользователя: limit (по умолчанию 20), cursor
   * (id уведомления из предыдущей страницы), unread_only; сортировка
   * created_at DESC. Возвращает { items, next_cursor }.
   */
  async function listUserNotifications(userId, o) {
    o = o || {};
    const limit = Math.max(1, Math.min(100, parseInt(o.limit, 10) || 20));
    const unreadOnly = /^(1|true|yes)$/i.test(String(o.unreadOnly ?? o.unread_only ?? ""));

    if (mode === "postgres") {
      const params = [userId];
      let where = "user_id = $1";
      if (unreadOnly) where += " AND read = false";
      if (o.cursor) {
        if (isUuid(o.cursor)) {
          where += ` AND (created_at, id) <
                      (SELECT cn.created_at, cn.id FROM notifications cn WHERE cn.id = $${params.push(o.cursor)})`;
        } else {
          /* не-uuid id (демо/файловый формат): находим created_at курсора отдельно */
          const cRows = await pg().query("SELECT created_at FROM notifications WHERE id::text = $1", [o.cursor]).catch(() => ({ rows: [] }));
          if (cRows.rows[0]) {
            where += ` AND created_at < $${params.push(cRows.rows[0].created_at)}`;
          }
        }
      }
      const { rows } = await pg().query(
        `SELECT id, user_id, type, title, text, link, read, created_at
           FROM notifications WHERE ${where}
          ORDER BY created_at DESC, id DESC LIMIT $${params.push(limit + 1)}`, params);
      const items = rows.slice(0, limit);
      const next_cursor = rows.length > limit && items.length ? items[items.length - 1].id : null;
      return { items, next_cursor };
    }

    const d = load();
    let arr = d.notifications
      .filter((x) => String(x.user_id) === String(userId))
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    if (unreadOnly) arr = arr.filter((x) => !x.read);
    if (o.cursor) {
      const i = arr.findIndex((x) => String(x.id) === String(o.cursor));
      arr = i >= 0 ? arr.slice(i + 1) : arr;
    }
    const items = arr.slice(0, limit);
    const next_cursor = arr.length > limit && items.length ? items[items.length - 1].id : null;
    return { items, next_cursor };
  }

  /** П.9: отметить уведомление прочитанным; проверяется принадлежность пользователю. */
  async function markNotificationRead(userId, notificationId) {
    if (mode === "postgres") {
      /* принадлежность проверяется условием user_id — чужое уведомление не отмечается */
      const cond = isUuid(notificationId) ? "id = $1" : "id::text = $1";
      const { rows } = await pg().query(
        `UPDATE notifications SET read = true WHERE ${cond} AND user_id = $2 RETURNING id`,
        [String(notificationId), userId]);
      return rows.length > 0 ? { ok: true } : null;
    }
    const d = load();
    const n = d.notifications.find((x) => String(x.id) === String(notificationId));
    if (!n || String(n.user_id) !== String(userId)) return null; /* чужое/нет — не отмечаем */
    n.read = true;
    save(d);
    return { ok: true };
  }

  /** П.10: отметить все уведомления пользователя прочитанными. */
  async function markAllNotificationsRead(userId) {
    if (mode === "postgres") {
      const { rowCount } = await pg().query(
        "UPDATE notifications SET read = true WHERE user_id = $1 AND read = false", [userId]);
      return { updated: rowCount };
    }
    const d = load();
    let n = 0;
    for (const x of d.notifications) {
      if (String(x.user_id) === String(userId) && !x.read) { x.read = true; n++; }
    }
    if (n) save(d);
    return { updated: n };
  }

  /* =====================================================================
     ЛЕНТА ПРОДАВЦА (ЗАДАЧА 3, п.11–п.12)
     ===================================================================== */

  /**
   * П.11: лента товаров конкретного продавца (limit, cursor, created_at DESC).
   * П.12: markSeen=true (по умолчанию) обновляет last_seen_at подписки
   * пользователя на этого продавца ПОСЛЕ того, как пользователь получил ленту.
   */
  async function getSellerFeed(sellerId, o) {
    o = o || {};
    const limit = Math.max(1, Math.min(100, parseInt(o.limit, 10) || 20));
    const userId = o.userId ? String(o.userId) : null;

    let items, next_cursor;
    if (mode === "postgres") {
      const params = [sellerId];
      let where = "p.seller_id = $1";
      if (o.cursor && isUuid(o.cursor)) {
        where += ` AND (p.created_at, p.id) <
                    (SELECT cp.created_at, cp.id FROM products cp WHERE cp.id = $${params.push(o.cursor)})`;
      }
      const { rows } = await pg().query(
        `SELECT p.id, p.seller_id, p.name, p.description, p.price, p."group", p.category,
                p.geography, p.status, p.media, p.city, p.created_at, p.updated_at,
                sl.name AS seller_name, sl.slug AS seller_slug, sl.avatar_url AS seller_avatar
           FROM products p
           LEFT JOIN sellers sl ON sl.id = p.seller_id
          WHERE ${where}
          ORDER BY p.created_at DESC, p.id DESC LIMIT $${params.push(limit + 1)}`, params);
      items = rows.slice(0, limit).map((r) => Object.assign(mapFeedRowPg(r), {
        subscription_id: null, subscription_type: null, last_seen_at: null, is_new: false,
      }));
      next_cursor = rows.length > limit && items.length ? items[items.length - 1].id : null;
    } else {
      const d = load();
      const seller = d.sellers.find((x) => String(x.id) === String(sellerId)) || null;
      let arr = d.products
        .filter((p) => String(p.seller_id || p.sellerId) === String(sellerId))
        .map((p) => ({
          id: p.id, seller_id: String(sellerId),
          name: p.name ?? null, description: p.description ?? null, price: p.price ?? null,
          group: p.group ?? null, category: p.category ?? null,
          geography: p.geography ?? null, status: p.status ?? "active", media: p.media ?? [], city: p.city ?? null,
          created_at: String(p.created_at || p.createdAt || ""),
          updated_at: p.updated_at || p.updatedAt || "",
          seller_name: seller ? (seller.name ?? null) : null,
          seller_slug: seller ? (seller.slug ?? null) : null,
          seller_avatar: seller ? (seller.avatar_url ?? null) : null,
          subscription_id: null, subscription_type: null, last_seen_at: null, is_new: false,
        }))
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      if (o.cursor) {
        const i = arr.findIndex((x) => String(x.id) === String(o.cursor));
        arr = i >= 0 ? arr.slice(i + 1) : arr;
      }
      items = arr.slice(0, limit);
      next_cursor = arr.length > limit && items.length ? items[items.length - 1].id : null;
    }

    /* п.12: обновляем last_seen_at подписки на продавца после выдачи ленты */
    let seen = null;
    if (userId && o.markSeen !== false) {
      try { seen = await markSubscriptionSeen(userId, "shop", String(sellerId)); } catch { /* ошибка — не критично */ }
    }
    return { items, next_cursor, seen };
  }

  /* =====================================================================
     ФОНОВЫЕ ОБРАБОТЧИКИ (ЗАДАЧА 3, п.4–п.7)
     ===================================================================== */

  /** Адрес доставки + фильтр настроек пользователя для канала email/push (п.7). */
  async function channelRecipient(uid, channel) {
    const prefs = await getNotificationPrefs(null, uid); /* п.7: notification_preferences / users */
    if (prefs[channel] === false) return null; /* канал отключён — не отправляем */
    if (channel !== "email") return { userId: String(uid), address: null };
    if (mode === "postgres") {
      const { rows } = await pg().query("SELECT email FROM users WHERE id::text = $1", [String(uid)]).catch(() => ({ rows: [] }));
      const address = rows[0] ? rows[0].email : null;
      return address ? { userId: String(uid), address } : null;
    }
    const u = load().users.find((x) => String(x.id) === String(uid));
    const address = u ? (u.email || null) : null;
    return address ? { userId: String(uid), address } : null;
  }

  /* Типы уведомлений, рассылаемые фоновыми обработчиками:
     'alert' (ЗАДАЧА 3, п.4) и 'product_published' (публикация товара —
     именно их создаёт publishProductNotifications / createProductWithNotifications). */
  const NOTIFY_CHANNEL_TYPES = ["alert", "product_published"];

  /**
   * Единый механизм фоновой отправки (п.4 email / п.5 push):
   * читает notifications WHERE read = false AND type IN ('alert','product_published')
   * (не более batchLimit за запуск), группирует по продавцу/времени (п.6:
   * один подписчик получает ОДНО сводное сообщение вместо десяти),
   * учитывает настройки пользователя (п.7), при успешной отправке помечает
   * уведомления прочитанными. При ошибке отправки — НЕ помечает (повтор
   * на следующем запуске).
   */
  async function runNotificationBatch(channel, send, opts) {
    opts = opts || {};
    const batchLimit = Math.max(1, Math.min(500, parseInt(opts.batchLimit, 10) || 100));
    let rows;
    if (mode === "postgres") {
      const res = await pg().query(
        `SELECT id, user_id, type, title, text, link, created_at
           FROM notifications
          WHERE read = false AND type = ANY($1::text[])
          ORDER BY created_at ASC LIMIT $2`, [NOTIFY_CHANNEL_TYPES, batchLimit]);
      rows = res.rows;
    } else {
      rows = load().notifications
        .filter((n) => !n.read && NOTIFY_CHANNEL_TYPES.includes(n.type))
        .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
        .slice(0, batchLimit);
    }
    if (!rows.length) return { processed: 0, sent: 0, skipped: 0, grouped: 0 };

    /* п.6: группировка (user_id, title, link) внутри окна NOTIFY_GROUP_WINDOW_MS —
       уведомления одного продавца/события отправляются ОДНИМ сообщением */
    const windowStart = new Date(Date.now() - NOTIFY_GROUP_WINDOW_MS).toISOString();
    const groups = new Map();
    for (const n of rows) {
      if (String(n.created_at) < windowStart) continue; /* слишком старые — не спамим */
      const key = String(n.user_id) + "|" + String(n.title || "") + "|" + String(n.link || "");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(n);
    }

    let sent = 0, processed = 0, skipped = 0;
    for (const [, grp] of groups) {
      const uid = String(grp[0].user_id);
      const recipient = await channelRecipient(uid, channel); /* п.7 */
      if (!recipient) {
        skipped += grp.length;
        /* настройки отключены — не отправляем и НЕ помечаем: in-app остаётся */
        continue;
      }
      const text = grp.length > 1
        ? grp[0].title + " — " + grp.length + " событий: " + grp.map((n) => n.text).join("; ")
        : grp[0].text;
      try {
        await send({ to: recipient.address, userId: uid, title: grp[0].title, text, link: grp[0].link });
        sent++;
      } catch (e) {
        log.error("[notify-" + channel + "] отправка не удалась (не помечаем прочитанным):", e.message);
        continue; /* повтор на следующем запуске */
      }
      /* успешная отправка — помечаем уведомления группы прочитанными (п.4) */
      const ids = grp.map((n) => n.id);
      if (mode === "postgres") {
        await pg().query("UPDATE notifications SET read = true WHERE type = ANY($1::text[]) AND read = false AND id::text = ANY($2::text[])", [NOTIFY_CHANNEL_TYPES, ids]).catch(() => {});
      } else {
        const d = load();
        /* помечаем прочитанными ТОЛЬКО рассЫлаемые типы из группы (п.4):
           уведомления других типов worker не трогает */
        for (const n of d.notifications) {
          if (NOTIFY_CHANNEL_TYPES.includes(n.type) && !n.read && ids.some((x) => String(x) === String(n.id))) n.read = true;
        }
        save(d);
      }
      processed += grp.length;
    }
    return { processed, sent, skipped, grouped: rows.length - groups.size };
  }

  /** П.4: обработчик email-уведомлений (SMTP), ≤100 уведомлений за запуск. */
  async function emailNotificationWorker() {
    const mail = opts.mailTransport || null;
    const from = opts.mailFrom || process.env.MAIL_FROM || "no-reply@quantiform.ru";
    return runNotificationBatch("email", async ({ to, title, text }) => {
      if (!mail) { console.log("[SMTP ЭМУЛЯЦИЯ] " + to + " | " + title + " | " + text); return true; }
      await mail.sendMail({ from, to, subject: "[Quantiform] " + title, text });
    }, { batchLimit: 100 });
  }

  /** П.5: обработчик push-уведомлений — аналогично email, через push-сервис. */
  async function pushNotificationWorker() {
    const endpoint = process.env.PUSH_ENDPOINT || "";
    return runNotificationBatch("push", async ({ to, userId, title, text, link }) => {
      if (!endpoint) { console.log("[PUSH ЭМУЛЯЦИЯ] " + (to || userId) + " | " + title + " | " + text); return true; }
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(process.env.PUSH_API_KEY ? { Authorization: "Bearer " + process.env.PUSH_API_KEY } : {}) },
        body: JSON.stringify({ to: to || userId, title, body: text, link }),
      });
      if (!res.ok) throw new Error("push http " + res.status);
    }, { batchLimit: 100 });
  }

  /** П.4: запуск фоновых обработчиков каждые intervalMs (по умолчанию 60 секунд). */
  function startBackgroundWorkers(intervalMs) {
    const ms = Math.max(5_000, parseInt(intervalMs, 10) || 60_000);
    const guardRun = (fn, name) => async () => {
      try {
        const r = await fn();
        if (r.processed || r.skipped) log.info("notify-worker:" + name, r);
      } catch (e) { log.error("[notify-worker:" + name + "]", e.message); }
    };
    const t1 = setInterval(guardRun(emailNotificationWorker, "email"), ms); t1.unref?.();
    const t2 = setInterval(guardRun(pushNotificationWorker, "push"), ms); t2.unref?.();
    return () => { clearInterval(t1); clearInterval(t2); };
  }

  /** Продавец (sellers.id) по user_id продавца — для dev-контракта маршрутов. */
  async function resolveSellerByUserId(userId) {
    if (mode === "postgres") {
      if (!isUuid(userId)) return null;
      const { rows } = await pg().query("SELECT id FROM sellers WHERE user_id = $1 LIMIT 1", [userId]);
      return rows[0] ? String(rows[0].id) : null;
    }
    const d = load();
    const sl = d.sellers.find((x) => String(x.userId || x.user_id) === String(userId));
    return sl ? String(sl.id) : null;
  }

  /** Вспомогательный: уведомления всем подписчикам продавца о новом товаре. */
  async function publishProductNotifications(client, sellerId, productId, productName, link, ctx, fileDb) {
    const title = "Новая публикация";
    let subscriberIds, existingGroups;
    const windowStart = new Date(Date.now() - NOTIFY_GROUP_WINDOW_MS).toISOString();

    if (mode === "postgres" && client) {
      const subs = await client.query("SELECT DISTINCT user_id FROM subscriptions WHERE target_id = $1", [sellerId]);
      subscriberIds = subs.rows.map((r) => String(r.user_id));
      /* п.13: «свежие» сгруппированные уведомления этого продавца */
      const grp = await client.query(
        `SELECT user_id, text FROM notifications
          WHERE type = 'product_published' AND link = $1 AND created_at > $2`,
        [link, windowStart]);
      existingGroups = new Map(grp.rows.map((r) => [String(r.user_id), r.text]));
    } else {
      const d = fileDb || load();
      subscriberIds = d.subscriptions
        .filter((x) => String(x.targetId || x.target_id) === String(sellerId))
        .map((x) => String(x.userId || x.user_id));
      existingGroups = new Map(d.notifications
        .filter((n) => n.type === "product_published" && n.link === link && String(n.created_at) > windowStart)
        .map((n) => [String(n.user_id), n.text]));
    }

    let createdCount = 0;
    for (const uid of subscriberIds) {
      if (uid === String(sellerId)) continue; /* себе не шлём */
      const prefs = await getNotificationPrefs(client, uid); /* п.14 */
      if (!prefs.in_app && !prefs.email && !prefs.push) continue; /* всё отключено — пропускаем */
      const prevText = existingGroups.get(uid);
      if (prevText != null) {
        /* п.13: дописываем товар в существующую группу, новое уведомление НЕ создаём */
        const m = /и ещё (\d+) шт\./.exec(prevText);
        const extra = m ? Number(m[1]) + 1 : 2;
        const baseText = prevText.replace(/ — и ещё \d+ шт\.$/, "");
        const newText = baseText + " — и ещё " + extra + " шт.";
        if (prefs.in_app) {
          if (mode === "postgres" && client) {
            await client.query("UPDATE notifications SET text = $1 WHERE user_id = $2 AND type = 'product_published' AND link = $3 AND created_at > $4",
              [newText, uid, link, windowStart]);
          } else {
            const n = (fileDb || load()).notifications.find((x) => x.user_id === uid && x.type === "product_published" && x.link === link && String(x.created_at) > windowStart);
            if (n) n.text = newText;
          }
        }
        /* email/push при отключённой настройке НЕ отправляем (п.14) */
        if ((prefs.email || prefs.push) && typeof ctx.sendChannel === "function") {
          ctx.sendChannel({ userId: uid, email: prefs.email, push: prefs.push, title, text: newText, link });
        }
        continue;
      }
      const text = "Магазин опубликовал новый товар: " + productName;
      if (prefs.in_app) {
        if (mode === "postgres" && client) {
          await client.query(
            `INSERT INTO notifications (user_id, type, title, text, link, read)
             VALUES ($1,'product_published',$2,$3,$4,false)`, [uid, title, text, link]);
        } else {
          (fileDb || load()).notifications.push({
            id: genId(), user_id: uid, type: "product_published", title, text, link,
            read: false, created_at: nowIso(),
          });
        }
        createdCount++;
        existingGroups.set(uid, text);
      }
      if ((prefs.email || prefs.push) && typeof ctx.sendChannel === "function") {
        ctx.sendChannel({ userId: uid, email: prefs.email, push: prefs.push, title, text, link });
      }
    }
    return { subscribers: subscriberIds.length, created: createdCount };
  }

  /* =====================================================================
     ПРОЧИЕ МЕТОДЫ РЕПОЗИТОРИЯ (продавцы, товары, уведомления)
     ===================================================================== */

  async function getSellerById(id) {
    if (mode === "postgres") {
      if (!isUuid(id)) return null;
      const { rows } = await pg().query("SELECT * FROM sellers WHERE id = $1", [id]);
      return rows[0] || null;
    }
    return load().sellers.find((x) => String(x.id) === String(id)) || null;
  }

  async function listProductsBySeller(sellerId) {
    if (mode === "postgres") {
      const { rows } = await pg().query(
        "SELECT * FROM products WHERE seller_id = $1 ORDER BY created_at DESC", [sellerId]);
      return rows;
    }
    return load().products.filter((p) => String(p.seller_id || p.sellerId) === String(sellerId));
  }

  /* =====================================================================
     ЗАДАЧА ФИНАЛЬНОЙ ТЕХНИЧЕСКОЙ ДОВОДКИ, п.1–п.5, п.9, п.10:
     upsert/delete/list для продавцов (shops/masters) и товаров.
     Единый контракт: в postgres-режиме — таблицы sellers/products,
     в файловом режиме — dev-db.json (массивы shops/masters/products).
     ===================================================================== */

  /** Пользователь из хранилища (users) — для авто-создания карточки продавца. */
  async function getUserRec(userId) {
    if (mode === "postgres") {
      if (!isUuid(userId)) return null;
      const { rows } = await pg().query("SELECT id, name, email, city, avatar_url FROM users WHERE id = $1", [userId]);
      return rows[0] || null;
    }
    return load().users.find((u) => String(u.id) === String(userId)) || null;
  }

  /** Транслитерация кириллицы для slug (без внешних зависимостей). */
  const TRANSLIT = { а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"yo",ж:"zh",з:"z",и:"i",й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"h",ц:"ts",ч:"ch",ш:"sh",щ:"sch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya" };
  function slugify(name) {
    const s = String(name || "").toLowerCase()
      .replace(/[«»"'`]/g, "")
      .split("")
      .map((ch) => TRANSLIT[ch] !== undefined ? TRANSLIT[ch] : ch)
      .join("")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return s || ("shop-" + crypto.randomUUID().slice(0, 8));
  }

  /**
   * ФИНАЛЬНАЯ ПРАВКА: разрешение UNIQUE-конфликта slug в PostgreSQL.
   * Если slug занят другим продавцом — добавляется короткий UUID-суффикс.
   */
  async function resolveUniqueSlug(slug, selfId) {
    if (mode !== "postgres") return slug;
    let candidate = slug;
    for (let i = 0; i < 5; i++) {
      const q = await pg().query(
        "SELECT id FROM sellers WHERE slug = $1 AND ($2::text IS NULL OR id::text <> $2)",
        [candidate, selfId ? String(selfId) : null]);
      if (!q.rowCount) return candidate;
      candidate = slug + "-" + crypto.randomUUID().slice(0, 6);
    }
    return candidate;
  }

  /** Нормализация payload карточки магазина/мастера (dev-контракт клиента). */
  function normalizeSellerPayload(m, userId, type) {
    const g = m.geography || {};
    return {
      user_id: String(userId),
      type: type || m.type || "shop",
      name: m.name || m.title || (g.city ? "Магазин " + g.city : "Магазин"),
      /* ФИНАЛЬНАЯ ДОВОДКА: slug обязателен в PostgreSQL (NOT NULL + UNIQUE);
         если клиент не передал — генерируем из названия (транслитерация). */
      slug: m.slug || slugify(m.name || m.title || String(userId)),
      description: m.description || "",
      avatar_url: m.avatarUrl || m.avatar_url || null,
      city: m.sellerCity || g.city || m.city || "",
      geography: m.geography || null,
      is_active: m.is_active !== false && m.active !== false,
    };
  }

  /**
   * П.2, п.10: upsert карточки продавца. В postgres-режиме выполняет
   * INSERT INTO sellers ... ON CONFLICT (id) DO UPDATE, сохраняя owner=user_id
   * и нормализуя geography в JSONB. Если sellerId не передан — резолвит
   * существующую карточку по user_id (upsert по user_id).
   * Возвращает объект продавца с полем id.
   */
  async function upsertSeller(payload, userId, sellerId) {
    const p = normalizeSellerPayload(payload || {}, userId, payload && payload.type);
    if (mode === "postgres") {
      let sid = sellerId != null && isUuid(String(sellerId)) ? String(sellerId) : null;
      if (!sid) {
        const ex = await pg().query("SELECT id FROM sellers WHERE user_id = $1 LIMIT 1", [p.user_id]);
        sid = ex.rows[0] ? String(ex.rows[0].id) : null;
      }
      /* UNIQUE(slug): если slug занят чужой карточкой — суффикс UUID */
      p.slug = await resolveUniqueSlug(p.slug, sid);
      if (sid) {
        const upd = await pg().query(
          `UPDATE sellers SET type=$2, name=$3, slug=COALESCE($4, slug), description=$5,
                                  avatar_url=$6, city=$7, geography=$8, is_active=$9, updated_at=now()
            WHERE id = $1 RETURNING *`,
          [sid, p.type, p.name, p.slug, p.description, p.avatar_url, p.city, JSON.stringify(p.geography), p.is_active]);
        if (upd.rows[0]) return upd.rows[0];
      }
      const ins = await pg().query(
        `INSERT INTO sellers (user_id, type, name, slug, description, avatar_url, city, geography, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (id) DO UPDATE SET
           type = EXCLUDED.type, name = EXCLUDED.name, slug = EXCLUDED.slug,
           description = EXCLUDED.description, avatar_url = EXCLUDED.avatar_url,
           city = EXCLUDED.city, geography = EXCLUDED.geography,
           is_active = EXCLUDED.is_active, updated_at = now()
         RETURNING *`,
        [p.user_id, p.type, p.name, p.slug, p.description, p.avatar_url, p.city, JSON.stringify(p.geography), p.is_active]);
      return ins.rows[0];
    }
    /* файловый режим: массив d.shops / d.masters (dev-контракт) */
    const d = load();
    const key = p.type === "master" ? "masters" : "shops";
    if (!Array.isArray(d[key])) d[key] = [];
    if (!Array.isArray(d.sellers)) d.sellers = [];
    const rec = Object.assign({}, payload || {}, {
      id: String(userId), owner_id: String(userId),
      sellerCity: p.city, avatarUrl: p.avatar_url,
      updated_at: nowIso(),
    });
    const idx = d[key].findIndex((x) => String(x.id) === String(userId));
    if (idx >= 0) d[key][idx] = Object.assign({}, d[key][idx], rec);
    else d[key].push(rec);
    const sIdx = d.sellers.findIndex((x) => String(x.id) === String(userId) || String(x.userId || x.user_id) === String(userId));
    const sellerRow = {
      id: String(userId), user_id: String(userId), userId: String(userId),
      type: p.type, name: p.name, slug: p.slug, description: p.description,
      avatar_url: p.avatar_url, avatarUrl: p.avatar_url, city: p.city,
      geography: p.geography, is_active: p.is_active,
      created_at: sIdx >= 0 ? d.sellers[sIdx].created_at : nowIso(), updated_at: nowIso(),
    };
    if (sIdx >= 0) d.sellers[sIdx] = sellerRow; else d.sellers.push(sellerRow);
    save(d);
    return sellerRow;
  }

  /**
   * П.2, п.10: upsert товара. Перед вставкой в postgres убеждается, что
   * продавец существует (seller_id → sellers.id): если карточки нет —
   * создаёт её автоматически (тип shop, имя из профиля пользователя),
   * иначе INSERT нарушит внешний ключ products.seller_id.
   * Для НОВОГО товара транзакционно создаёт уведомления подписчикам
   * через createProductWithNotifications/publishProductNotifications.
   * Возвращает объект товара с id.
   */
  async function upsertProduct(payload, userId, opts) {
    opts = opts || {};
    const p = payload || {};
    const name = String(p.name || "Без названия");
    if (mode === "postgres") {
      /* ФИНАЛЬНАЯ ДОВОДКА: если карточка магазина уже существует (создана
         через POST /api/shops) — резолвим её по user_id БЕЗ изменения полей;
         если не существует — создаём автоматически (тип shop, имя и город из
         профиля пользователя), иначе INSERT нарушит FK products.seller_id. */
      let seller = null;
      const byUser = await pg().query("SELECT * FROM sellers WHERE user_id = $1 LIMIT 1", [String(userId)]);
      seller = byUser.rows[0] || null;
      if (!seller) {
        const u = await getUserRec(userId);
        seller = await upsertSeller({
          name: p.shopName || (u && u.name) || undefined,
          sellerCity: p.sellerCity || (u && u.city) || "",
          geography: p.geography || null,
          avatarUrl: p.shopAvatar || (u && u.avatar_url) || "",
          description: p.shopDescription || "",
        }, userId, null);
      }
      const sid = String(seller.id);
      const sc = String(p.sellerCity || "").trim();
      const cleanCity = (!sc || /^(россия|рф|russia)$/i.test(sc)) ? "" : sc;
      const existing = p.id ? await pg().query("SELECT id, created_at FROM products WHERE id = $1", [p.id]) : { rows: [] };
      if (existing.rows[0]) {
        const upd = await pg().query(
          `UPDATE products SET name=$2, description=$3, price=$4, "group"=$5, category=$6,
                                 geography=$7, status=$8, media=$9, city=$10, updated_at=now()
            WHERE id=$1 RETURNING *`,
          [p.id, name, p.description || "", p.price || 0, p.group || null, p.category || null,
            JSON.stringify(p.geography || null), p.status || "active",
            JSON.stringify(p.media || []), cleanCity || seller.city || null]);
        return { product: upd.rows[0], isNew: false, notifications: null };
      }
      return tx(async (client) => {
        const ins = await client.query(
          `INSERT INTO products (id, seller_id, name, description, price, "group", category, geography, status, media, city)
           VALUES (COALESCE($1::uuid, gen_random_uuid()),$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           RETURNING *`,
          [isUuid(String(p.id)) ? String(p.id) : null, sid, name, p.description || "", p.price || 0,
            p.group || null, p.category || null, JSON.stringify(p.geography || null),
            p.status || "active", JSON.stringify(p.media || []), cleanCity || seller.city || null]);
        const prod = ins.rows[0];
        const link = "/catalog?q=" + encodeURIComponent(name);
        const notify = opts.notify !== false
          ? await publishProductNotifications(client, sid, prod.id, name, link, opts.ctx || {})
          : null;
        return { product: prod, isNew: true, notifications: notify };
      });
    }
    /* файловый режим — существующая логика dev-db.json */
    const d = load();
    if (!Array.isArray(d.products)) d.products = [];
    const idx = d.products.findIndex((x) => String(x.id) === String(p.id));
    let rec;
    if (idx >= 0) {
      rec = Object.assign({}, d.products[idx], p, { ownerId: String(userId), updated_at: nowIso() });
      d.products[idx] = rec;
    } else {
      rec = Object.assign({}, p, { ownerId: String(userId), owner_id: String(userId), seller_id: String(userId), created_at: nowIso(), updated_at: nowIso() });
      d.products.push(rec);
    }
    const sc = String(rec.sellerCity || "").trim();
    if (!sc || /^(россия|рф|russia)$/i.test(sc)) rec.sellerCity = "";
    let notify = null;
    if (idx < 0 && opts.notify !== false) {
      const sid = await resolveSellerByUserId(String(userId)) || String(userId);
      const link = "/catalog?q=" + encodeURIComponent(name);
      notify = await publishProductNotifications(null, sid, rec.id, name, link, opts.ctx || {}, d);
    }
    save(d);
    return { product: rec, isNew: idx < 0, notifications: notify };
  }

  /** П.4: витрина магазинов/мастеров (для geo-фильтра на уровне маршрута). */
  async function listSellers(type) {
    if (mode === "postgres") {
      const { rows } = await pg().query(
        "SELECT * FROM sellers WHERE ($1::text IS NULL OR type = $1) AND is_active = true ORDER BY created_at DESC",
        [type || null]);
      return rows.map((r) => Object.assign({}, r, {
        sellerCity: r.city, avatarUrl: r.avatar_url, geography: r.geography || {},
      }));
    }
    const d = load();
    const key = type === "master" ? "masters" : "shops";
    return (d[key] || []).slice();
  }

  /** П.4: все товары (проекция для geo-фильтра/пагинации на уровне маршрута). */
  async function listProducts() {
    if (mode === "postgres") {
      const { rows } = await pg().query(
        `SELECT p.*, s.name AS shopName, s.city AS sellerCity, s.avatar_url AS shopAvatar, s.id AS shopId
           FROM products p LEFT JOIN sellers s ON s.id = p.seller_id
          WHERE p.status <> 'archived' ORDER BY p.created_at DESC`);
      return rows.map((r) => Object.assign({}, r, {
        ownerId: r.seller_id, id: r.id, preview: (Array.isArray(r.media) && r.media[0] && r.media[0].url) || "",
        media: r.media || [], geography: r.geography || {},
      }));
    }
    const d = load();
    return (d.products || []).slice();
  }

  /** П.4: товар по id (или null). */
  async function getProductById(id) {
    if (mode === "postgres") {
      if (!isUuid(String(id))) return null;
      const { rows } = await pg().query(
        `SELECT p.*, s.name AS shopName, s.city AS sellerCity, s.avatar_url AS shopAvatar
           FROM products p LEFT JOIN sellers s ON s.id = p.seller_id WHERE p.id = $1`, [id]);
      return rows[0] ? Object.assign({}, rows[0], { ownerId: rows[0].seller_id, geography: rows[0].geography || {} }) : null;
    }
    const d = load();
    return (d.products || []).find((x) => String(x.id) === String(id)) || null;
  }

  /**
   * П.5, п.9: удаление товара с проверкой прав владельца.
   * @returns 'deleted' | 'not_found' | 'forbidden'
   */
  async function deleteProduct(id, userId) {
    if (mode === "postgres") {
      if (!isUuid(String(id))) return "not_found";
      const res = await pg().query("DELETE FROM products WHERE id = $1 AND seller_id IN (SELECT id FROM sellers WHERE user_id = $2)", [id, userId]);
      if (res.rowCount > 0) return "deleted";
      const own = await pg().query("SELECT 1 FROM products WHERE id = $1", [id]);
      return own.rows.length ? "forbidden" : "not_found";
    }
    const d = load();
    const arr = d.products || [];
    const idx = arr.findIndex((x) => String(x.id) === String(id));
    if (idx === -1) return "not_found";
    const owner = arr[idx].ownerId || arr[idx].owner_id;
    if (owner && String(owner) !== String(userId)) return "forbidden";
    arr.splice(idx, 1); d.products = arr; save(d);
    return "deleted";
  }

  /**
   * П.5, п.9: удаление карточки продавца (shop/master) только владельцем.
   * @returns 'deleted' | 'not_found' | 'forbidden'
   */
  async function deleteSeller(id, userId, type) {
    if (mode === "postgres") {
      if (!isUuid(String(id))) return "not_found";
      const res = await pg().query("DELETE FROM sellers WHERE id = $1 AND user_id = $2", [id, userId]);
      if (res.rowCount > 0) return "deleted";
      const own = await pg().query("SELECT user_id FROM sellers WHERE id = $1", [id]);
      return own.rows.length ? "forbidden" : "not_found";
    }
    const d = load();
    const key = type === "master" ? "masters" : "shops";
    const arr = d[key] || [];
    const idx = arr.findIndex((x) => String(x.id) === String(id));
    if (idx === -1) return "not_found";
    const owner = arr[idx].owner_id || arr[idx].userId || arr[idx].user_id;
    if (owner && String(owner) !== String(userId)) return "forbidden";
    arr.splice(idx, 1); d[key] = arr;
    const si = d.sellers.findIndex((x) => String(x.id) === String(id));
    if (si >= 0) d.sellers.splice(si, 1);
    save(d);
    return "deleted";
  }

  async function listNotifications(userId, limit) {
    const n = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
    if (mode === "postgres") {
      const { rows } = await pg().query(
        "SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2", [userId, n]);
      return rows;
    }
    return load().notifications
      .filter((x) => String(x.user_id) === String(userId))
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, n);
  }

  async function setNotificationPreferences(userId, prefs) {
    const p = { email: prefs.email !== false, push: prefs.push !== false, in_app: prefs.in_app !== false };
    if (mode === "postgres") {
      await pg().query(
        `INSERT INTO notification_preferences (user_id, email, push, in_app, updated_at)
         VALUES ($1,$2,$3,$4,now())
         ON CONFLICT (user_id) DO UPDATE
            SET email=$2, push=$3, in_app=$4, updated_at=now()`,
        [userId, p.email, p.push, p.in_app]);
      return p;
    }
    const d = load();
    if (!Array.isArray(d.notification_preferences)) d.notification_preferences = [];
    const rec = d.notification_preferences.find((x) => String(x.user_id) === String(userId));
    if (rec) Object.assign(rec, p); else d.notification_preferences.push(Object.assign({ user_id: userId }, p));
    save(d);
    return p;
  }

  return {
    mode,
    isPostgres: mode === "postgres",
    close: async () => { if (ownPool) await ownPool.end(); },
    /* подписки */
    listSubscriptions,
    notifySubscribersOfProduct,
    countNewProductsForSubscriptions,
    createSubscription,
    deleteSubscription,
    markSubscriptionSeen,
    subscribersOfSeller,
    sellerExists,
    resolveSellerTarget,
    /* товары и уведомления */
    createProductWithNotifications,
    getNotificationPrefs,
    setNotificationPreferences,
    listNotifications,
    /* продавцы */
    getSellerById,
    listProductsBySeller,
    upsertSeller,
    upsertProduct,
    listSellers,
    listProducts,
    getProductById,
    deleteSeller,
    deleteProduct,
    /* лента подписчиков и продавца (ЗАДАЧА 3, п.1–п.3, п.11–п.12) */
    getFeed,
    touchSeenFromItems,
    getSellerFeed,
    /* уведомления (ЗАДАЧА 3, п.8–п.10) */
    listUserNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    /* фоновые обработчики email/push (ЗАДАЧА 3, п.4–п.7) */
    runNotificationBatch,
    emailNotificationWorker,
    pushNotificationWorker,
    startBackgroundWorkers,
  };
};

module.exports.SHOP_TARGET_TYPES = SHOP_TARGET_TYPES;
module.exports.NOTIFY_GROUP_WINDOW_MS = NOTIFY_GROUP_WINDOW_MS;
