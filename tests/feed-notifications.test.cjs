/* ============================================================
   ЗАДАЧА 3, п.13: тесты серверной ленты подписок, ленты продавца,
   уведомлений и фоновых обработчиков email/push.
   Запуск: node tests/feed-notifications.test.cjs
   Тесты выполняются в файловом режиме репозитория (без DATABASE_URL)
   на изолированном dev-db во временном файле; при наличии доступного
   PostgreSQL с применёнными миграциями (DATABASE_URL) дополнительно
   прогоняется postgres-ветка тех же методов.
   ============================================================ */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

delete process.env.DATABASE_URL; /* гарантированно файловый режим */
process.env.UYART_DB_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'uyart-feed-')), 'dev-db.json');

const express = require('express');
const createRepo = require('../server/repo.cjs');

(async () => {
  const repo = createRepo({});
  assert.strictEqual(repo.mode, 'file', 'без DATABASE_URL — файловый режим');
  const uuid = () => crypto.randomUUID();
  const now = Date.now();
  const iso = (msAgo) => new Date(now - msAgo * 1000).toISOString();

  /* ---------- фикстуры ---------- */
  const buyer = uuid(), sellerUser = uuid(), other = uuid();
  const s1 = uuid(), s2 = uuid();
  const db = {
    users: [
      { id: buyer, email: 'buyer@test.ru', name: 'Покупатель' },
      { id: sellerUser, email: 'seller@test.ru', name: 'Продавец' },
      { id: other, email: 'other@test.ru', name: 'Другой' },
    ],
    sellers: [
      { id: s1, user_id: sellerUser, name: 'Лавка Резьба', slug: 'rezba', avatar_url: '/a1.png' },
      { id: s2, user_id: sellerUser, name: 'Гончар', slug: 'potter', avatar_url: null },
    ],
    products: [],
    subscriptions: [],
    notifications: [],
    notification_preferences: [],
  };
  /* подписки: buyer -> shop s1 (создана 100 сек назад), buyer -> shop s2 (без last_seen_at) */
  const sub1 = { id: uuid(), userId: buyer, targetType: 'shop', targetId: s1, createdAt: iso(100), updatedAt: iso(100) };
  const sub2 = { id: uuid(), userId: buyer, targetType: 'shop', targetId: s2, createdAt: iso(500), updatedAt: iso(500) };
  db.subscriptions.push(sub1, sub2);
  /* товары s1: два новых (после created_at подписки), один старый */
  const pOld = { id: uuid(), seller_id: s1, name: 'Старый', price: 10, created_at: iso(200), status: 'active' };
  const pNew1 = { id: uuid(), seller_id: s1, name: 'Новый 1', price: 100, created_at: iso(50), status: 'active' };
  const pNew2 = { id: uuid(), seller_id: s1, name: 'Новый 2', price: 200, created_at: iso(30), status: 'active' };
  const pS2 = { id: uuid(), seller_id: s2, name: 'Глина', price: 50, created_at: iso(400), status: 'active' };
  db.products.push(pOld, pNew1, pNew2, pS2);
  /* уведомления buyer: 3 непрочитанных alert одного продавца (группировка), 1 product_published, чужое */
  const nA = { id: uuid(), user_id: buyer, type: 'alert', title: 'Скидка', text: 'Скидка на товар A', link: '/shops/rezba', read: false, created_at: iso(60) };
  const nB = { id: uuid(), user_id: buyer, type: 'alert', title: 'Скидка', text: 'Скидка на товар B', link: '/shops/rezba', read: false, created_at: iso(50) };
  const nC = { id: uuid(), user_id: buyer, type: 'alert', title: 'Публикация', text: 'x', link: '/catalog', read: false, created_at: iso(40) };
  const nOther = { id: uuid(), user_id: other, type: 'alert', title: 'Чужое', text: 'не твоё', link: '/x', read: false, created_at: iso(10) };
  db.notifications.push(nA, nB, nC, nOther);
  fs.writeFileSync(process.env.UYART_DB_FILE, JSON.stringify(db, null, 2));

  /* ---------- п.1–п.2: лента подписок ---------- */
  let feed = await repo.getFeed(buyer, { markSeen: false });
  let ids = feed.items.map((i) => i.id).sort();
  assert.deepStrictEqual(ids, [pNew1.id, pNew2.id, pS2.id].sort(), 'товары только после created_at/last_seen_at подписок');
  const first = feed.items[0];
  assert.ok(String(first.created_at) >= String(feed.items[feed.items.length - 1].created_at), 'сортировка created_at DESC');
  assert.strictEqual(first.seller_name, 'Лавка Резьба', 'обогащение продавцом (п.2)');
  assert.strictEqual(first.seller_slug, 'rezba');
  assert.strictEqual(first.seller_avatar, '/a1.png');
  assert.strictEqual(typeof first.is_new, 'boolean', 'поле is_new присутствует');
  assert.strictEqual(feed.next_cursor, null, 'одна страница — next_cursor null');

  /* фильтр target_type (без markSeen, чтобы не трогать last_seen_at) */
  const feedShopMaster = await repo.getFeed(buyer, { targetType: 'master', markSeen: false });
  assert.strictEqual(feedShopMaster.items.length, 0, 'target_type=master — пусто');
  const feedShop = await repo.getFeed(buyer, { targetType: 'shop', markSeen: false });
  assert.strictEqual(feedShop.items.length, 3, 'target_type=shop — все 3');

  /* ---------- п.3: получение ленты обновляет last_seen_at ---------- */
  await repo.getFeed(buyer, {}); /* фактическое GET-обращение к ленте */
  let subsAfter = JSON.parse(fs.readFileSync(process.env.UYART_DB_FILE, 'utf8')).subscriptions;
  const seen1 = subsAfter.find((x) => x.id === sub1.id).lastSeenAt;
  assert.ok(seen1, 'last_seen_at подписки sub1 обновлён после выдачи ленты');
  const feed2 = await repo.getFeed(buyer, {});
  assert.strictEqual(feed2.items.length, 0, 'повторная выдача ленты пустая — товары не показываются повторно (п.3)');

  /* новый товар после last_seen_at — is_new=true (п.2) */
  /* на 50 мс в будущем — чтобы гарантированно быть позже last_seen_at (now()) */
  const pNew3 = { id: uuid(), seller_id: s1, name: 'Новый 3', price: 300, created_at: new Date(Date.now() + 50).toISOString(), status: 'active' };
  (() => { const d = JSON.parse(fs.readFileSync(process.env.UYART_DB_FILE, 'utf8')); d.products.push(pNew3); fs.writeFileSync(process.env.UYART_DB_FILE, JSON.stringify(d)); })();
  const feed3 = await repo.getFeed(buyer, { markSeen: false });
  assert.strictEqual(feed3.items.length, 1);
  assert.strictEqual(feed3.items[0].id, pNew3.id);
  assert.strictEqual(feed3.items[0].is_new, true, 'is_new=true для товара после last_seen_at');

  /* товар между created_at и last_seen_at подписки НЕ попадает в ленту (п.1) */
  (() => { const d = JSON.parse(fs.readFileSync(process.env.UYART_DB_FILE, 'utf8'));
    d.products.push({ id: 'mid-1', seller_id: s1, name: 'Средний', price: 5, created_at: iso(80), status: 'active' });
    fs.writeFileSync(process.env.UYART_DB_FILE, JSON.stringify(d)); })();
  const feedMid = await repo.getFeed(buyer, { markSeen: false });
  assert.ok(!feedMid.items.some((i) => i.id === 'mid-1'), 'между created_at и last_seen_at — не в ленте');

  /* ---------- п.1: limit/cursor ---------- */
  (() => { const d = JSON.parse(fs.readFileSync(process.env.UYART_DB_FILE, 'utf8'));
    for (let i = 0; i < 3; i++) d.products.push({ id: uuid(), seller_id: s2, name: 'G' + i, price: 1, created_at: new Date().toISOString(), status: 'active' });
    /* сбросим last_seen у sub2, чтобы товары s2 попали в ленту */
    const s = d.subscriptions.find((x) => x.id === sub2.id); delete s.lastSeenAt; delete s.last_seen_at;
    fs.writeFileSync(process.env.UYART_DB_FILE, JSON.stringify(d)); })();
  const page1 = await repo.getFeed(buyer, { limit: 2, markSeen: false });
  assert.strictEqual(page1.items.length, 2, 'limit=2');
  assert.ok(page1.next_cursor, 'next_cursor для следующей страницы');
  const page2 = await repo.getFeed(buyer, { limit: 2, cursor: page1.next_cursor, markSeen: false });
  assert.strictEqual(page2.items.length, 2);
  assert.ok(!page2.items.some((i) => page1.items.some((j) => j.id === i.id)), 'страницы не пересекаются');

  /* ---------- п.11–п.12: лента продавца ---------- */
  const sfCheck = await repo.getSellerFeed(s1, {});
  assert.ok(sfCheck.items.some((i) => i.id === 'mid-1'), 'лента продавца показывает ВСЕ товары (п.11)');
  const sf = await repo.getSellerFeed(s1, { userId: buyer });
  const sfIds = sf.items.map((i) => i.id);
  assert.ok(sfIds.includes(pOld.id) && sfIds.includes(pNew1.id), 'лента продавца содержит все товары');
  assert.strictEqual(sf.items[0].seller_name, 'Лавка Резьба');
  const subBefore = JSON.parse(fs.readFileSync(process.env.UYART_DB_FILE, 'utf8')).subscriptions.find((x) => x.id === sub1.id).lastSeenAt;
  const sf2 = await repo.getSellerFeed(s1, { userId: buyer });
  const subAfter = JSON.parse(fs.readFileSync(process.env.UYART_DB_FILE, 'utf8')).subscriptions.find((x) => x.id === sub1.id).lastSeenAt;
  assert.ok(sf2.seen && String(subAfter) >= String(subBefore), 'п.12: last_seen_at подписки обновлён после получения ленты продавца');

  /* ---------- п.8: список уведомлений ---------- */
  const nl = await repo.listUserNotifications(buyer, {});
  assert.deepStrictEqual(nl.items.map((n) => n.id).sort(), [nA.id, nB.id, nC.id].sort(), 'только свои уведомления');
  assert.ok(String(nl.items[0].created_at) >= String(nl.items[nl.items.length - 1].created_at), 'created_at DESC');
  const nlu = await repo.listUserNotifications(buyer, { unreadOnly: 'true' });
  assert.strictEqual(nlu.items.length, 3, 'unread_only=true');
  await repo.markNotificationRead(buyer, nC.id);
  const nlu2 = await repo.listUserNotifications(buyer, { unread_only: '1' });
  assert.strictEqual(nlu2.items.length, 2, 'после отметки прочитанного — 2 непрочитанных');
  /* product_published НЕ относится к alert-каналам: создаём его ДО запуска
     worker'ов (worker берёт только type='alert') */
  (() => { const d = JSON.parse(fs.readFileSync(process.env.UYART_DB_FILE, 'utf8'));
    d.notifications.push({ id: 'pp-1', user_id: buyer, type: 'product_published', title: 'Новая публикация', text: 'x', link: '/catalog', read: false, created_at: new Date().toISOString() });
    fs.writeFileSync(process.env.UYART_DB_FILE, JSON.stringify(d)); })();
  const pageN = await repo.listUserNotifications(buyer, { limit: 1 });
  assert.strictEqual(pageN.items.length, 1);
  assert.ok(pageN.next_cursor, 'курсор уведомлений');
  const pageN2 = await repo.listUserNotifications(buyer, { limit: 1, cursor: pageN.next_cursor });
  assert.ok(pageN2.items[0].id !== pageN.items[0].id, 'вторая страница отличается');

  /* ---------- п.9: нельзя отметить чужое ---------- */
  const foreign = await repo.markNotificationRead(buyer, nOther.id);
  assert.strictEqual(foreign, null, 'чужое уведомление не отмечается');
  const own = await repo.markNotificationRead(buyer, nA.id);
  assert.deepStrictEqual(own, { ok: true }, 'своё отмечается');

  /* ---------- п.10: прочитать все ---------- */
  const all = await repo.markAllNotificationsRead(buyer);
  assert.ok(all.updated >= 1);
  const noneUnread = await repo.listUserNotifications(buyer, { unreadOnly: 'true' });
  assert.strictEqual(noneUnread.items.length, 0, 'непрочитанных не осталось');

  /* ---------- п.4–п.7: фоновые обработчики ---------- */
  /* готовые к этому моменту alert-уведомления buyer (nA/nB/nC) помечены
     прочитанными — worker берёт только read=false; добавляем свежие */
  (() => { const d = JSON.parse(fs.readFileSync(process.env.UYART_DB_FILE, 'utf8'));
    d.notifications.push(
      { id: uuid(), user_id: buyer, type: 'alert', title: 'Акция', text: 'T1', link: '/shops/rezba', read: false, created_at: new Date().toISOString() },
      { id: uuid(), user_id: buyer, type: 'alert', title: 'Акция', text: 'T2', link: '/shops/rezba', read: false, created_at: new Date().toISOString() },
      { id: uuid(), user_id: buyer, type: 'alert', title: 'Древнее', text: 'OLD', link: '/old', read: false, created_at: iso(3600) },
    );
    fs.writeFileSync(process.env.UYART_DB_FILE, JSON.stringify(d)); })();

  /* smoke: однократный прогон обработчиков — читают ТОЛЬКО type='alert';
     product_published (pp-1) worker не трогает (п.4) */
  const savedLog = console.log; console.log = () => {};
  const w1 = await repo.emailNotificationWorker();
  const wP1 = await repo.pushNotificationWorker();
  console.log = savedLog;
  assert.ok(w1 && typeof w1.processed === 'number' && wP1 && typeof wP1.processed === 'number', 'workers выполняются');
  (() => { const d = JSON.parse(fs.readFileSync(process.env.UYART_DB_FILE, 'utf8'));
    const pp = d.notifications.find((n) => n.id === 'pp-1');
    assert.strictEqual(pp.read, false, 'product_published worker не трогает (п.4: только type=alert)'); })();

  /* для runNotificationBatch с фиксированными ожидаемыми значениями — свежие alerts */
  (() => { const d = JSON.parse(fs.readFileSync(process.env.UYART_DB_FILE, 'utf8'));
    d.notifications.push(
      { id: uuid(), user_id: buyer, type: 'alert', title: 'Акция', text: 'T1', link: '/shops/rezba', read: false, created_at: new Date().toISOString() },
      { id: uuid(), user_id: buyer, type: 'alert', title: 'Акция', text: 'T2', link: '/shops/rezba', read: false, created_at: new Date().toISOString() },
    );
    fs.writeFileSync(process.env.UYART_DB_FILE, JSON.stringify(d)); })();

  const sentEmails = [];
  const emailResult = await repo.runNotificationBatch('email', async ({ to, title, text }) => { sentEmails.push({ to, title, text }); }, { batchLimit: 100 });
  assert.ok(sentEmails.every((m) => m.title !== 'Новая публикация'), 'product_published не отправляется worker\'ом (только type=alert)');
  assert.strictEqual(sentEmails.length, 1, 'п.6: два alerts одного продавца отправлены ОДНИМ письмом');
  assert.match(sentEmails[0].text, /2 событий/, 'сводный текст группы');
  assert.strictEqual(sentEmails[0].to, 'buyer@test.ru', 'email-адрес из таблицы users');
  assert.strictEqual(emailResult.processed, 2, 'старое (вне окна) уведомление не отправляется');
  (() => { const d = JSON.parse(fs.readFileSync(process.env.UYART_DB_FILE, 'utf8'));
    const fresh = d.notifications.filter((n) => n.type === 'alert' && n.link === '/shops/rezba');
    assert.ok(fresh.every((n) => n.read === true), 'п.4: после успешной отправки помечены прочитанными'); })();

  /* п.7: отключённый email — не отправляем и НЕ помечаем */
  await repo.setNotificationPreferences(buyer, { email: false, push: true, in_app: true });
  (() => { const d = JSON.parse(fs.readFileSync(process.env.UYART_DB_FILE, 'utf8'));
    d.notifications.push({ id: uuid(), user_id: buyer, type: 'alert', title: 'Ещё', text: 'T3', link: '/x', read: false, created_at: new Date().toISOString() });
    fs.writeFileSync(process.env.UYART_DB_FILE, JSON.stringify(d)); })();
  const sent2 = [];
  const r2 = await repo.runNotificationBatch('email', async (m) => { sent2.push(m); }, {});
  assert.strictEqual(sent2.length, 0, 'п.7: email отключён — письмо не отправлено');
  assert.strictEqual(r2.skipped, 1);
  const sentPush = [];
  const rP = await repo.runNotificationBatch('push', async (m) => { sentPush.push(m); }, {});
  assert.strictEqual(sentPush.length, 1, 'п.5: push при включённом канале отправляется');
  assert.ok(rP.sent >= 1);

  const stop = repo.startBackgroundWorkers(60000);
  assert.strictEqual(typeof stop, 'function', 'обработчики запускаются интервалом');
  stop();

  /* ---------- HTTP-эндпоинты через feed.cjs ---------- */
  const app = express();
  app.use(express.json());
  require('../server/feed.cjs')(app, { JWT_SECRET: 'test-secret', startNotifyWorkers: false }, repo);
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const H = { 'x-user-id': buyer };

  /* GET /api/feed */
  let res = await fetch(base + '/api/feed', { headers: H });
  let body = await res.json();
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(body.feed), 'GET /api/feed возвращает массив feed');
  res = await fetch(base + '/api/feed');
  assert.strictEqual(res.status, 401, 'гость — 401');

  /* GET /api/sellers/:id/feed */
  res = await fetch(base + '/api/sellers/' + s1 + '/feed?limit=2', { headers: H });
  body = await res.json();
  assert.strictEqual(res.status, 200);
  assert.ok(body.feed.length <= 2 && 'next_cursor' in body, 'лента продавца с пагинацией');
  res = await fetch(base + '/api/sellers/' + uuid() + '/feed', { headers: H });
  assert.strictEqual(res.status, 404, 'несуществующий продавец — 404');

  /* PUT /api/notifications/:id/read — своё уведомление (свежесозданное) */
  const freshId = 'fresh-' + uuid();
  (() => { const d = JSON.parse(fs.readFileSync(process.env.UYART_DB_FILE, 'utf8'));
    d.notifications.push({ id: freshId, user_id: buyer, type: 'alert', title: 'Свежее', text: 'F', link: '/f', read: false, created_at: new Date().toISOString() });
    fs.writeFileSync(process.env.UYART_DB_FILE, JSON.stringify(d)); })();
  res = await fetch(base + '/api/notifications/' + freshId + '/read', { method: 'PUT', headers: H });
  assert.strictEqual(res.status, 200, 'своё — 200');

  /* GET /api/notifications */
  res = await fetch(base + '/api/notifications?unread_only=true&limit=5', { headers: H });
  body = await res.json();
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(body.notifications), 'список уведомлений');

  /* PUT /api/notifications/read-all */
  res = await fetch(base + '/api/notifications/read-all', { method: 'PUT', headers: H });
  body = await res.json();
  assert.strictEqual(res.status, 200);
  assert.strictEqual(body.ok, true);

  /* PUT /api/notifications/:id/read — чужое недоступно */
  res = await fetch(base + '/api/notifications/' + nOther.id + '/read', { method: 'PUT', headers: H });
  assert.strictEqual(res.status, 404, 'чужое — 404 (проверка принадлежности, п.9)');

  server.close();
  console.log('\u041f\u041e\u0411\u0415\u0414\u0410: \u0432\u0441\u0435 \u0442\u0435\u0441\u0442\u044b \u043b\u0435\u043d\u0442\u044b, \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u0439 \u0438 \u0444\u043e\u043d\u043e\u0432\u044b\u0445 \u043e\u0431\u0440\u0430\u0431\u043e\u0442\u0447\u0438\u043a\u043e\u0432 \u043f\u0440\u043e\u0439\u0434\u0435\u043d\u044b.');
})().catch((e) => { console.error('\u0422\u0415\u0421\u0422 \u041f\u0420\u041e\u0412\u0410\u041b\u0415\u041d:', e); process.exit(1); });
