/* Сквозная HTTP-проверка полного цикла (п.6). Запуск: node e2e-check.cjs <baseURL> */
const BASE = process.argv[2] || 'http://127.0.0.1:8790';
let pass = 0, fail = 0;
const results = [];
function ok(name, cond, detail) {
  if (cond) { pass++; results.push('PASS ' + name); }
  else { fail++; results.push('FAIL ' + name + ' :: ' + detail); }
}
async function req(method, path, { token, body, form } = {}) {
  const headers = {};
  if (token) headers['Authorization'] = 'Bearer ' + token;
  let cookie = '';
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' });
  const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  let data = null; const txt = await res.text();
  try { data = JSON.parse(txt); } catch { data = txt; }
  return { status: res.status, data, setCookies };
}
(async () => {
  const rnd = Math.random().toString(36).slice(2, 8);
  // 1. Регистрация продавца и покупателя
  const regS = await req('POST', '/api/auth/register', { body: { email: `seller_${rnd}@e2e.test`, password: 'passw0rd123', name: 'Продавец E2E' } });
  ok('register seller', regS.status === 200, JSON.stringify(regS.data));
  const regB = await req('POST', '/api/auth/register', { body: { email: `buyer_${rnd}@e2e.test`, password: 'passw0rd123', name: 'Покупатель E2E' } });
  ok('register buyer', regB.status === 200, JSON.stringify(regB.data));
  // подтверждение email: берём токен из ответа регистрации (confirmToken или devConfirmUrl)
  async function confirmEmail(reg) {
    const d = reg.data || {};
    const tok = d.confirmToken || d.confirm_token || (d.devConfirmUrl ? String(d.devConfirmUrl).split('token=')[1] : null);
    if (!tok) return false;
    const r = await req('GET', '/api/auth/confirm?token=' + encodeURIComponent(tok));
    return r.status === 200;
  }
  await confirmEmail(regS);
  await confirmEmail(regB);
  const logS = await req('POST', '/api/auth/login', { body: { email: `seller_${rnd}@e2e.test`, password: 'passw0rd123' } });
  const logB = await req('POST', '/api/auth/login', { body: { email: `buyer_${rnd}@e2e.test`, password: 'passw0rd123' } });
  if (logS.status === 403 && logS.data && logS.data.error === 'need_confirm') {
    console.log('NOTE: postgres-режим требует подтверждения email — подтверждаю напрямую');
  }
  ok('login seller', !!logS.data && !!logS.data.accessToken, JSON.stringify(logS.data));
  ok('login buyer', !!logB.data && !!logB.data.accessToken, JSON.stringify(logB.data));
  const tS = logS.data && logS.data.accessToken, tB = logB.data && logB.data.accessToken;
  const uidS = logS.data && logS.data.profile && logS.data.profile.id;
  if (!tS || !tB) { console.log(results.join('\n')); console.log(`ИТОГ: ${pass}/${pass+fail}`); process.exit(1); }
  // 2. Создание магазина
  const shop = await req('POST', '/api/shops', { token: tS, body: { id: uidS, name: 'Лавка «Дом и Тепло»', city: 'Казань', description: 'Уютные товары для дома', avatarUrl: '/img/a.jpg' } });
  ok('create shop', shop.status === 200 && shop.data.ok, JSON.stringify(shop.data));
  // ФИНАЛЬНАЯ ПРАВКА: в postgres-режиме id карточки продавца (sellers.id) != user_id.
  // Резолвим реальный id витрины через GET /api/shops по owner_id/user_id.
  let sid = uidS;
  try {
    const shopsList = await req('GET', '/api/shops', {});
    const arr = (shopsList.data && (shopsList.data.shops || shopsList.data.items || shopsList.data)) || [];
    if (Array.isArray(arr)) {
      const mine = arr.find((x) => String(x.owner_id || x.ownerId || x.user_id || x.userId || x.id) === String(uidS));
      if (mine && mine.id) sid = String(mine.id);
    }
  } catch {}
  console.log('NOTE: resolved seller card id =', sid, '(user id =', uidS + ')');
  // 3. Публикация товара №1
  const prod1 = await req('POST', '/api/products', { token: tS, body: { id: require('crypto').randomUUID(), name: 'Тёплый плед ручной работы', price: 2450, group: 'home_garden', category: 'textile', description: 'Шерстяной плед', sellerCity: 'Казань' } });
  ok('publish product 1', prod1.status === 200 && prod1.data.ok, JSON.stringify(prod1.data));
  // 4. Подписка покупателя на продавца
  const sub = await req('POST', '/api/subscriptions', { token: tB, body: { targetType: 'shop', targetId: sid } });
  ok('subscribe', sub.status === 200 && sub.data.ok, JSON.stringify(sub.data));
  // дубликат → "Уже подписаны"
  const dup = await req('POST', '/api/subscriptions', { token: tB, body: { targetType: 'shop', targetId: sid } });
  ok('duplicate subscribe handled', dup.status === 200 && /уже подписаны/i.test(JSON.stringify(dup.data)), JSON.stringify(dup.data));
  // 5. GET /api/subscriptions — обогащение target_name/target_avatar
  const list = await req('GET', '/api/subscriptions', { token: tB });
  const s0 = list.data && Array.isArray(list.data.subscriptions) && list.data.subscriptions[0];
  ok('subscriptions enriched target_name', !!(s0 && s0.target_name && /Лавка/.test(s0.target_name)), JSON.stringify(s0));
  ok('subscriptions has target_avatar field', !!(s0 && 'target_avatar' in s0), JSON.stringify(s0));
  ok('new_count >= 1 after publish', !!(s0 && Number(s0.new_count) >= 1), JSON.stringify(s0 && s0.new_count));
  // 6. GET /api/feed — товар с информацией о продавце
  /* лента обновляет last_seen_at при выдаче (п.3), поэтому читаем её БЕЗ
     отметки прочитанного (?mark_seen=false), иначе счётчик новинок обнулится */
  const feed = await req('GET', '/api/feed?limit=10&mark_seen=false', { token: tB });
  const items = feed.data && (feed.data.feed || feed.data.items || feed.data.products);
  ok('feed returns items', Array.isArray(items) && items.length >= 1, JSON.stringify(feed.data ?? null).slice(0, 200));
  ok('feed item has seller info', !!(items && items[0] && (items[0].seller_name || items[0].sellerName || items[0].shopName)), JSON.stringify((items && items[0]) ?? null).slice(0, 300));
  ok('feed item is_new true', !!(items && items[0] && items[0].is_new === true), JSON.stringify(items && items[0] && items[0].is_new));
  // пагинация cursor
  if (items && items[0]) {
    const feed2 = await req('GET', '/api/feed?limit=1&cursor=' + encodeURIComponent(items[0].id) + '&mark_seen=false', { token: tB });
    ok('feed cursor pagination', feed2.status === 200, JSON.stringify(feed2.data ?? null).slice(0, 150));
  } else { ok('feed cursor pagination', false, 'нет элементов ленты'); }
  // 7. Сортировка и поиск подписок
  const sorted = await req('GET', '/api/subscriptions?sort_by=name', { token: tB });
  ok('subscriptions sort_by=name', sorted.status === 200 && Array.isArray(sorted.data.subscriptions), JSON.stringify(sorted.data ?? null).slice(0, 150));
  const search = await req('GET', '/api/subscriptions?search=' + encodeURIComponent('Дом и Тепло'), { token: tB });
  ok('subscriptions search cyrillic', search.status === 200 && ((search.data && search.data.subscriptions) || []).length >= 1, JSON.stringify(search.data ?? null).slice(0, 200));
  const searchMiss = await req('GET', '/api/subscriptions?search=' + encodeURIComponent('несуществующиймагазинXYZ'), { token: tB });
  ok('subscriptions search negative', searchMiss.status === 200 && ((searchMiss.data && searchMiss.data.subscriptions) || [1]).length === 0, JSON.stringify(searchMiss.data ?? null).slice(0, 150));
  // 8. Товар №2 → уведомление подписчику
  const prod2 = await req('POST', '/api/products', { token: tS, body: { id: require('crypto').randomUUID(), name: 'Вязаные носки уюта', price: 690, group: 'clothing_shoes', category: 'socks', sellerCity: 'Казань' } });
  ok('publish product 2', prod2.status === 200 && prod2.data.ok, JSON.stringify(prod2.data));
  const notifs = await req('GET', '/api/notifications?limit=20', { token: tB });
  const nlist = notifs.data && (notifs.data.notifications || notifs.data.items);
  ok('subscriber got notification', Array.isArray(nlist) && nlist.some((n) => /Тёплый плед|Вязаные носки|новый товар|Новый товар/i.test((n.title || '') + ' ' + (n.text || ''))), JSON.stringify(nlist ?? null).slice(0, 400));
  // 9. Отметка прочитанного → new_count обнуляется
  const read = await req('POST', `/api/subscriptions/shop/${sid}/read`, { token: tB });
  ok('mark subscription read', read.status === 200 && read.data.ok, JSON.stringify(read.data));
  const list2 = await req('GET', '/api/subscriptions', { token: tB });
  const s1 = (list2.data && list2.data.subscriptions || []).find((x) => String(x.target_id) === String(sid));
  ok('new_count zeroed after read', !!(s1 && Number(s1.new_count) === 0), JSON.stringify(s1));
  // 10. Уведомления: mark read
  if (Array.isArray(nlist) && nlist.length) {
    const mr = await req('PUT', `/api/notifications/${nlist[0].id}/read`, { token: tB });
    ok('notification mark read', mr.status === 200, JSON.stringify(mr.data));
    const ra = await req('PUT', '/api/notifications/read-all', { token: tB });
    ok('notifications read-all', ra.status === 200, JSON.stringify(ra.data));
  } else { ok('notification mark read', false, 'нет уведомлений для проверки'); ok('notifications read-all', false, 'нет уведомлений'); }
  // 11. 401 без авторизации
  const noauth = await req('GET', '/api/subscriptions');
  ok('subscriptions 401 without auth', noauth.status === 401, String(noauth.status));
  const noauthFeed = await req('GET', '/api/feed');
  ok('feed 401 without auth', noauthFeed.status === 401, String(noauthFeed.status));
  // 12. Отписка
  const unsub = await req('DELETE', `/api/subscriptions/shop/${sid}`, { token: tB });
  ok('unsubscribe', unsub.status === 200 && unsub.data.ok, JSON.stringify(unsub.data));
  const list3 = await req('GET', '/api/subscriptions', { token: tB });
  ok('subscription removed', (list3.data && list3.data.subscriptions || []).every((x) => String(x.target_id) !== String(uidS)), JSON.stringify(list3.data.subscriptions));
  const unsub2 = await req('DELETE', `/api/subscriptions/shop/${sid}`, { token: tB });
  ok('unsubscribe again 404', unsub2.status === 404, String(unsub2.status) + ' ' + JSON.stringify(unsub2.data));
  // 13. Права владельца: чужой товар удалить нельзя (403)
  const delForeign = await req('DELETE', '/api/products/' + (prod1.data.id), { token: tB });
  ok('delete foreign product forbidden', delForeign.status === 403 || delForeign.status === 404, String(delForeign.status));
  // удаление своего товара
  const delOwn = await req('DELETE', '/api/products/' + (prod1.data.id), { token: tS });
  ok('delete own product', delOwn.status === 200, JSON.stringify(delOwn.data));
  console.log(results.join('\n'));
  console.log(`\nИТОГ: ${pass}/${pass + fail} пройдено, ${fail} упало`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
