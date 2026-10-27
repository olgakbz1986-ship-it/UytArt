#!/usr/bin/env node
/* ============================================================
   СИДИРОВАНИЕ ТЕСТОВЫХ ДАННЫХ (ЗАДАЧА 1, п.15)
   ------------------------------------------------------------
   Создаёт тестовых пользователей, продавцов, товары, подписки и
   уведомления для локальной разработки и тестирования. Идемпотентно:
   повторный запуск не дублирует записи (проверка по email/slug).

   Использование:
     DATABASE_URL=postgres://... npm run seed
   ============================================================ */
const bcrypt = require("bcryptjs");
const u = require("./migrate-utils.cjs");

const DEMO_PASSWORD = "demo1234";

(async () => {
  const pool = u.createPool();
  const client = await pool.connect();
  try {
    await u.ensureMigrationsTable(client);
    const applied = await u.getAppliedVersions(client);
    const required = ["002_users", "003_sellers", "004_products", "005_subscriptions", "006_notifications"];
    for (const r of required) {
      if (!applied.has(r)) {
        throw new Error(`Миграция ${r} ещё не применена. Сначала выполните: npm run migrate`);
      }
    }

    const hash = await bcrypt.hash(DEMO_PASSWORD, 10);

    /* ---------- Пользователи ---------- */
    const usersSpec = [
      { email: "admin@uyart.test",  name: "Администратор", role: "admin",  legal_type: "company",       tier: "pro",    city: "Москва" },
      { email: "seller1@uyart.test", name: "Анна Мастерова", role: "seller", legal_type: "self_employed", tier: "pro",    city: "Санкт-Петербург" },
      { email: "seller2@uyart.test", name: "Борис Резчиков", role: "seller", legal_type: "individual",    tier: "free",   city: "Казань" },
      { email: "buyer1@uyart.test",  name: "Вера Покупателева", role: "buyer", legal_type: "self_employed", tier: "free", city: "Москва" },
      { email: "buyer2@uyart.test",  name: "Глеб Клиентов", role: "buyer",  legal_type: "individual",    tier: "free",   city: "Новосибирск" },
    ];
    const userIds = {};
    for (const sp of usersSpec) {
      const exists = await client.query("SELECT id FROM users WHERE lower(email) = lower($1)", [sp.email]);
      if (exists.rowCount) { userIds[sp.email] = exists.rows[0].id; continue; }
      const ins = await client.query(
        `INSERT INTO users (email, password_hash, name, phone, role, legal_type, tier, avatar_url, email_confirmed, city)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,$9) RETURNING id`,
        [sp.email, hash, sp.name, "+79000000000", sp.role, sp.legal_type, sp.tier,
         `https://avatars.uyart.test/${sp.email.split("@")[0]}.png`, sp.city]
      );
      userIds[sp.email] = ins.rows[0].id;
      console.log(`+ user: ${sp.email}`);
    }

    /* ---------- Продавцы ---------- */
    const sellersSpec = [
      { slug: "anna-masterova", user: "seller1@uyart.test", type: "self_employed", name: "Анна Мастерова",
        description: "Ручная керамика и декор", city: "Санкт-Петербург",
        geography: { lat: 59.9386, lng: 30.3141, radius_km: 100 } },
      { slug: "boris-rezchikov", user: "seller2@uyart.test", type: "individual", name: "Борис Резчиков",
        description: "Изделия из дерева на заказ", city: "Казань",
        geography: { lat: 55.796, lng: 49.1064, radius_km: 150 } },
    ];
    const sellerIds = {};
    for (const sp of sellersSpec) {
      const exists = await client.query("SELECT id FROM sellers WHERE slug = $1", [sp.slug]);
      if (exists.rowCount) { sellerIds[sp.slug] = exists.rows[0].id; continue; }
      const ins = await client.query(
        `INSERT INTO sellers (user_id, type, name, slug, description, avatar_url, city, geography, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,true) RETURNING id`,
        [userIds[sp.user], sp.type, sp.name, sp.slug, sp.description,
         `https://avatars.uyart.test/${sp.slug}.png`, sp.city, JSON.stringify(sp.geography)]
      );
      sellerIds[sp.slug] = ins.rows[0].id;
      console.log(`+ seller: ${sp.slug}`);
    }

    /* ---------- Товары ---------- */
    const productsSpec = [
      { seller: "anna-masterova", name: "Кружка «Закат»", price: 890,  group: "Посуда",   category: "ceramics", city: "Санкт-Петербург",
        media: [{ type: "image", url: "https://media.uyart.test/mug.jpg" }] },
      { seller: "anna-masterova", name: "Ваза «Лён»",     price: 2400, group: "Декор",    category: "ceramics", city: "Санкт-Петербург",
        media: [{ type: "image", url: "https://media.uyart.test/vase.jpg" }] },
      { seller: "boris-rezchikov", name: "Разделочная доска из дуба", price: 1500, group: "Кухня", category: "wood", city: "Казань",
        media: [{ type: "image", url: "https://media.uyart.test/board.jpg" }] },
      { seller: "boris-rezchikov", name: "Полка навесная «Сканди»", price: 3200, group: "Мебель", category: "wood", city: "Казань",
        media: [] },
    ];
    for (const p of productsSpec) {
      const exists = await client.query(
        "SELECT id FROM products WHERE seller_id = $1 AND name = $2", [sellerIds[p.seller], p.name]);
      if (exists.rowCount) continue;
      await client.query(
        `INSERT INTO products (seller_id, name, description, price, "group", category, geography, status, media, city)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,'active',$8::jsonb,$9)`,
        [sellerIds[p.seller], p.name, `${p.name} — ручной работы.`, p.price, p.group, p.category,
         JSON.stringify({ city: p.city }), JSON.stringify(p.media), p.city]
      );
      console.log(`+ product: ${p.name}`);
    }

    /* ---------- Подписки ---------- */
    const subsSpec = [
      { user: "buyer1@uyart.test", target_type: "seller",  target: "anna-masterova" },
      { user: "buyer1@uyart.test", target_type: "product", targetProduct: "Кружка «Закат»" },
      { user: "buyer2@uyart.test", target_type: "seller",  target: "boris-rezchikov" },
    ];
    for (const s of subsSpec) {
      let targetId;
      if (s.target_type === "seller") targetId = sellerIds[s.target];
      else {
        const pr = await client.query("SELECT id FROM products WHERE name = $1 LIMIT 1", [s.targetProduct]);
        if (!pr.rowCount) continue;
        targetId = pr.rows[0].id;
      }
      await client.query(
        `INSERT INTO subscriptions (user_id, target_type, target_id, last_seen_at)
         VALUES ($1,$2,$3,now())
         ON CONFLICT (user_id, target_type, target_id) DO NOTHING`,
        [userIds[s.user], s.target_type, targetId]
      );
      console.log(`+ subscription: ${s.user} -> ${s.target_type}`);
    }

    /* ---------- Уведомления ---------- */
    const notifSpec = [
      { user: "buyer1@uyart.test", type: "new_product", title: "Новый товар у вашей подписки",
        text: "Анна Мастерова добавила товар «Ваза «Лён»».", link: "/products/vase-len", read: false },
      { user: "buyer1@uyart.test", type: "system", title: "Добро пожаловать в UytArt!",
        text: "Подпишитесь на продавцов, чтобы получать новости о новых товарах.", link: "/", read: true },
      { user: "seller1@uyart.test", type: "subscription", title: "У вас новый подписчик",
        text: "Вера Покупателева подписалась на ваш магазин.", link: "/dashboard", read: false },
    ];
    for (const n of notifSpec) {
      const exists = await client.query(
        "SELECT id FROM notifications WHERE user_id = $1 AND title = $2 LIMIT 1", [userIds[n.user], n.title]);
      if (exists.rowCount) continue;
      await client.query(
        `INSERT INTO notifications (user_id, type, title, text, link, read) VALUES ($1,$2,$3,$4,$5,$6)`,
        [userIds[n.user], n.type, n.title, n.text, n.link, n.read]
      );
      console.log(`+ notification: ${n.title}`);
    }

    console.log("\nСидирование завершено.");
    console.log(`Тестовые аккаунты: ${usersSpec.map((x) => x.email).join(", ")}`);
    console.log(`Пароль для всех тестовых аккаунтов: ${DEMO_PASSWORD}`);
  } finally {
    client.release();
    await pool.end();
  }
})().catch((e) => {
  console.error("Ошибка сидирования:", e.message);
  process.exit(1);
});
