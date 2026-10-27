/* ============================================================
   ЗАДАЧА 2, п.15: тесты серверной логики подписок
   (репозиторий + HTTP-эндпоинты) на PostgreSQL из DATABASE_URL.
   Запуск: DATABASE_URL=postgres://... node tests/subscriptions-repo.test.cjs
   ============================================================ */
const assert = require('assert');
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/uyart_test';
const express = require('express');
const cookieParser = require('cookie-parser');
const { Pool } = require('pg');
const crypto = require('crypto');
const createRepo = require('../server/repo.cjs');

(async () => {
  const repo = createRepo({});
  assert.strictEqual(repo.mode, 'postgres', 'режим postgres определяется DATABASE_URL');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const q = (sql, p) => pool.query(sql, p);
  await q('TRUNCATE notifications, subscriptions, products, sellers, users CASCADE');
  const uuid = () => crypto.randomUUID();
  const u1 = uuid(), u2 = uuid(), u3 = uuid();
  for (const [id, em] of [[u1,'t-buyer@test.ru'],[u2,'t-seller@test.ru'],[u3,'t-seller2@test.ru']])
    await q(`INSERT INTO users (id,email,password_hash,name) VALUES ($1,$2,'x','T')`, [id, em]);
  const s1 = uuid(), s2 = uuid();
  await q(`INSERT INTO sellers (id,user_id,name,slug,avatar_url) VALUES ($1,$2,$3,'rezba','/a1.png')`, [s1,u2,'Лавка Резьба']);
  await q(`INSERT INTO sellers (id,user_id,name,slug) VALUES ($1,$2,'Гончар','potter')`, [s2,u3]);

  /* п.5 sellerExists + создание подписки */
  const sub1 = await repo.createSubscription(u1, 'shop', s1);
  assert.ok(sub1.id && sub1.created_at, 'подписка создана');
  assert.strictEqual(await repo.sellerExists(s1), true);
  assert.strictEqual(await repo.sellerExists(uuid()), false);
  /* п.6 дубликат -> уникальный индекс БД (23505) */
  let dup=false; try { await repo.createSubscription(u1,'shop',s1); } catch(e){ dup = e.code==='23505'; }
  assert.ok(dup, 'дубликат через уникальный индекс subscriptions_user_target_ux');

  /* товары для new_count */
  await q(`INSERT INTO products (seller_id,name,price) VALUES ($1,'Товар 1',100)`, [s1]);
  await q(`INSERT INTO products (seller_id,name,price) VALUES ($1,'Товар 2',200)`, [s1]);

  /* п.2 список с обогащением */
  const list = await repo.listSubscriptions(u1, {});
  assert.strictEqual(list.items.length, 1);
  const it = list.items[0];
  assert.strictEqual(it.target_name, 'Лавка Резьба');
  assert.strictEqual(it.target_slug, 'rezba');
  assert.strictEqual(it.target_avatar, '/a1.png');
  assert.strictEqual(it.target_url, '/shops/rezba');
  const ghost = await repo.createSubscription(u1, 'shop', uuid());
  const list2 = await repo.listSubscriptions(u1, {});
  const g = list2.items.find(x=>x.id===ghost.id);
  assert.strictEqual(g.target_name, null, 'продавец не найден -> null');
  assert.strictEqual(g.target_url, null);

  /* п.3 подсчёт новинок: карта id подписки -> количество */
  const counts = await repo.countNewProductsForSubscriptions([it]);
  assert.strictEqual(counts[it.id], 2, 'new_count=2 относительно created_at подписки');

  /* п.8 last_seen_at: после read новые товары считаются относительно last_seen_at */
  const seen = await repo.markSubscriptionSeen(u1, 'shop', s1);
  assert.ok(seen.last_seen_at, 'last_seen_at обновлён');
  await new Promise(r => setTimeout(r, 50));
  await q(`INSERT INTO products (seller_id,name,price) VALUES ($1,'Товар до прочтения',50)`, [s1]);
  await new Promise(r => setTimeout(r, 50));
  const seen2 = await repo.markSubscriptionSeen(u1, 'shop', s1);
  const fresh = await repo.listSubscriptions(u1, {});
  const it2 = fresh.items.find(x => String(x.target_id) === String(s1));
  const counts2 = await repo.countNewProductsForSubscriptions([it2]);
  assert.strictEqual(counts2[it2.id], 0, 'после read — 0 новинок (товары раньше last_seen_at не считаются)');
  /* товар, опубликованный ПОСЛЕ read, снова считается новинкой */
  await new Promise(r => setTimeout(r, 50));
  await q(`INSERT INTO products (seller_id,name,price) VALUES ($1,'Новинка после read',70)`, [s1]);
  const counts3 = await repo.countNewProductsForSubscriptions([it2]);
  assert.strictEqual(counts3[it2.id], 1, 'новинка после last_seen_at учтена');

  /* п.9 пагинация limit/cursor/next_cursor */
  const extra=[];
  for (let i=0;i<6;i++){ const sid=uuid(), uid=uuid();
    await q(`INSERT INTO users (id,email,password_hash) VALUES ($1,$2,'x')`,[uid,'ex'+i+'@test.ru']);
    await q(`INSERT INTO sellers (id,user_id,name,slug) VALUES ($1,$2,$3,$4)`,[sid,uid,'Магазин '+i,'shop'+i]);
    extra.push(await repo.createSubscription(u1,'shop',sid));
  }
  const page1 = await repo.listSubscriptions(u1, { limit: 3 });
  assert.strictEqual(page1.items.length, 3);
  assert.ok(page1.next_cursor, 'next_cursor есть');
  const page2 = await repo.listSubscriptions(u1, { limit: 3, cursor: page1.next_cursor });
  assert.strictEqual(page2.items.length, 3);
  assert.notStrictEqual(page2.items[0].id, page1.items[0].id, 'cursor смещает страницу');
  const totalNow = (await repo.listSubscriptions(u1, { limit: 100 })).items.length;
  const exact = await repo.listSubscriptions(u1, { limit: totalNow });
  assert.strictEqual(exact.next_cursor, null, 'последняя страница без next_cursor');
  const all = await repo.listSubscriptions(u1, { limit: 100 });
  assert.ok(all.items.length >= 6);
  const dates = all.items.map(x=>new Date(x.created_at).getTime());
  assert.ok(dates.every((d,i)=> i===0 || dates[i-1]>=d), 'сортировка по created_at DESC');

  /* ghost-подписка на несуществующую цель больше не мешает тестам поиска */
  await repo.deleteSubscription(u1, 'shop', String(ghost.target_id));

  /* п.10 sort_by=new_count/name */
  await q(`INSERT INTO products (seller_id,name,price) VALUES ($1,'Хит',50)`,[extra[3].target_id]);
  const byNew = await repo.listSubscriptions(u1, { sortBy:'new_count', limit:100 });
  assert.ok(byNew.items[0].new_count >= 1, 'sort_by=new_count: новинки сверху');
  const byName = await repo.listSubscriptions(u1, { sortBy:'name', limit:100 });
  assert.ok(Array.isArray(byName.items) && byName.items.length >= 6);

  /* п.11 search LIKE %...% по target_name */
  const found = await repo.listSubscriptions(u1, { search: 'Гончар' });
  assert.strictEqual(found.items.length, 1);
  const none = await repo.listSubscriptions(u1, { search: 'нет-такого' });
  assert.strictEqual(none.items.length, 0);

  /* дубликат подписки на несуществующую цель тоже блокируется индексом (проверка без FK) */
  let dup2=false; try { await repo.createSubscription(u1,'shop',String(ghost.target_id)); } catch(e){ dup2 = e.code==='23505'; }
  assert.ok(dup2, 'повтор ghost-подписки -> 23505');

  /* п.7 deleteSubscription */
  assert.strictEqual(await repo.deleteSubscription(u1, 'shop', String(ghost.target_id)), true);
  assert.strictEqual(await repo.deleteSubscription(u1, 'shop', String(ghost.target_id)), false);

  /* п.12–п.14: транзакционное создание товара + уведомления, группировка, настройки */
  await repo.setNotificationPreferences(u1, { email:true, push:false, in_app:true });
  const channels = [];
  const ctx = { sendChannel: (m)=>channels.push(m) };
  let PROD_SELLER = s1;
  try { PROD_SELLER = (await q(`INSERT INTO products (seller_id,name,price) VALUES ($1,'Продавец-товар',10) RETURNING id`, [s1])).rows[0].id; } catch { PROD_SELLER = s1; }
  const r1 = await repo.createProductWithNotifications({ seller_id:PROD_SELLER, name:'Разделочная доска', price:1200 }, ctx);
  assert.ok(r1.product.id, 'товар создан транзакционно вместе с уведомлениями');
  let n = await q(`SELECT count(*)::int c FROM notifications WHERE user_id=$1 AND type='product_published'`,[u1]);
  assert.strictEqual(n.rows[0].c, 1, 'одно уведомление подписчику');
  assert.strictEqual(channels.filter(c=>c.userId===u1).length, 1);
  assert.strictEqual(channels[0].push, false, 'п.14: push отключён настройкой — канал не отправляется');
  await repo.createProductWithNotifications({ seller_id:PROD_SELLER, name:'Подставка', price:800 }, ctx);
  await repo.createProductWithNotifications({ seller_id:PROD_SELLER, name:'Полка', price:900 }, ctx);
  n = await q(`SELECT count(*)::int c FROM notifications WHERE user_id=$1 AND type='product_published'`,[u1]);
  assert.strictEqual(n.rows[0].c, 1, 'п.13: три товара подряд -> одно сгруппированное уведомление');
  const txt = await q(`SELECT text FROM notifications WHERE user_id=$1 AND type='product_published'`,[u1]);
  assert.ok(/и ещё 2 шт\./.test(txt.rows[0].text), 'текст группы со счётчиком: '+txt.rows[0].text);

  console.log('REPO TESTS PASSED');

  /* ---------- HTTP-эндпоинты ---------- */
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  require('../server/subscriptions.cjs')(app, { JWT_SECRET: 'test-secret' }, repo);
  const srv = app.listen(0);
  await new Promise(r=>srv.on('listening',r));
  const base = 'http://127.0.0.1:'+srv.address().port;
  const H = { 'content-type':'application/json', 'x-user-id': u1 };

  /* POST: продавец не найден -> 400 "Продавец не найден" (п.5) */
  let r = await fetch(base+'/api/subscriptions',{method:'POST',headers:H,body:JSON.stringify({targetType:'shop',targetId:uuid()})});
  let b = await r.json();
  assert.strictEqual(r.status,400); assert.strictEqual(b.error,'Продавец не найден');
  /* POST: существующий -> успешный ответ (п.5) */
  r = await fetch(base+'/api/subscriptions',{method:'POST',headers:H,body:JSON.stringify({targetType:'shop',targetId:s2})});
  b = await r.json(); assert.ok(b.ok && b.subscription.id, 'POST подписка ок');
  /* POST: дубликат -> "Уже подписаны" (п.6) */
  r = await fetch(base+'/api/subscriptions',{method:'POST',headers:H,body:JSON.stringify({targetType:'shop',targetId:s2})});
  b = await r.json(); assert.strictEqual(b.message,'Уже подписаны');
  /* GET: обогащённый список + new_count + next_cursor (п.4, п.9) */
  r = await fetch(base+'/api/subscriptions?limit=2',{headers:H}); b = await r.json();
  assert.strictEqual(r.status,200);
  assert.ok(b.subscriptions.length===2 && b.next_cursor, 'пагинация через эндпоинт');
  const s0 = b.subscriptions[0];
  for (const f of ['id','user_id','target_type','target_id','target_name','target_slug','target_avatar','target_url','created_at','updated_at','last_seen_at','new_count'])
    assert.ok(f in s0, 'поле '+f+' в ответе GET');
  /* GET: search + sort_by (п.10, п.11) */
  r = await fetch(base+'/api/subscriptions?search='+encodeURIComponent('Гончар')+'&sort_by=name',{headers:H}); b = await r.json();
  assert.strictEqual(b.subscriptions.length,1);
  /* POST read -> last_seen_at (п.8) */
  r = await fetch(base+`/api/subscriptions/shop/${s2}/read`,{method:'POST',headers:H}); b = await r.json();
  assert.ok(b.ok && b.last_seen_at, 'эндпоинт read обновляет last_seen_at');
  /* DELETE (п.7) */
  r = await fetch(base+`/api/subscriptions/shop/${s2}`,{method:'DELETE',headers:H}); b = await r.json();
  assert.ok(b.ok && b.message==='Подписка удалена');
  r = await fetch(base+`/api/subscriptions/shop/${s2}`,{method:'DELETE',headers:H});
  assert.strictEqual(r.status,404);

  srv.close(); await pool.end(); await repo.close();
  console.log('HTTP ENDPOINT TESTS PASSED');
  process.exit(0);
})().catch(e=>{ console.error('TEST FAIL:', e); process.exit(1); });
