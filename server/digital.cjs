// Цифровые продукты: API + хранилище (ТЗ Разделы 4, 6, 7, 10, 11, 12, 13)
// Хранение в dev — server/dev-db.json (сегмент digital), в prod — PostgreSQL (таблицы см. schema.sql).
// Приватные файлы — ТОЛЬКО через /api/digital/:id/download с проверкой факта покупки.
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const storage = require("./digital-storage.cjs");

const DAY = 24 * 3600 * 1000;

/* ---------- хранилище записей (JSON-dev) ---------- */
const FILE = path.resolve(__dirname, "dev-db.json");
function load() { return fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : {}; }
function save(d) { fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); }
function seg() {
  const d = load();
  if (!d.digital) d.digital = { products: [], purchases: [], versions: [], subscriptions: [], testDrives: {}, securityLogs: [], blockedIps: {} };
  return d.digital;
}
function writeSeg(mutator) {
  const d = load();
  if (!d.digital) d.digital = { products: [], purchases: [], versions: [], subscriptions: [], testDrives: {}, securityLogs: [], blockedIps: {} };
  mutator(d.digital);
  save(d);
}

/* ---------- безопасность (§13): rate limiting и бан по IP ---------- */
function clientIp(req) { return String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress || "unknown"; }
const SECURITY_ACTIONS = ["ownership_violation", "access_denied", "content_access_denied"]; // исчерпание тест-драйва — не нарушение, а штатный лимит
function logSecurity(ctx, entry) {
  writeSeg((s) => {
    s.securityLogs.push({ timestamp: new Date().toISOString(), ...entry });
    if (s.securityLogs.length > 5000) s.securityLogs = s.securityLogs.slice(-5000);
    // 3+ НАРУШЕНИЙ доступа с одного IP за час → блокировка на 24 часа
    if (!SECURITY_ACTIONS.includes(entry.action)) return;
    const hourAgo = Date.now() - 3600 * 1000;
    const hits = s.securityLogs.filter((l) => l.ipAddress === entry.ipAddress && SECURITY_ACTIONS.includes(l.action) && Date.parse(l.timestamp) > hourAgo).length;
    if (hits >= 3) s.blockedIps[entry.ipAddress] = Date.now() + 24 * HOUR;
  });
}
const HOUR = 3600 * 1000;
function isBlocked(req) {
  const s = seg();
  const until = s.blockedIps[clientIp(req)];
  if (!until) return false;
  if (Date.now() > until) { writeSeg((x) => { delete x.blockedIps[clientIp(req)]; }); return false; }
  return true;
}

/* ---------- hasDigitalAccess (дубликат логики ownership.ts на сервере) ---------- */
function hasPurchase(s, userId, productId) {
  return s.purchases.find((p) => p.userId === userId && p.productId === productId) || null;
}
/* доступ = покупка ИЛИ активная подписка, включающая продукт */
function hasDigitalAccess(s, userId, product) {
  if (hasPurchase(s, userId, product.id)) return { ok: true, via: "purchase", record: hasPurchase(s, userId, product.id) };
  const subs = (s.subscriptions || []).filter((x) => x.userId === userId && x.status === "active" && Date.parse(x.currentPeriodEnd) > Date.now());
  for (const sub of subs) {
    const plan = PLANS.find((p) => p.id === sub.planId);
    if (plan && plan.includedProducts.includes(product.id)) return { ok: true, via: "subscription", record: sub };
  }
  return { ok: false };
}

/* ---------- публичные тарифы подписок (§10) ---------- */
const PLANS = [
  { id: "basic", name: "Базовый", price: 990, billingCycle: "monthly", tier: "basic", includedProducts: ["demo-prompt-1"], features: ["Доступ к базовому каталогу", "1 скачивание в день", "Поддержка в чате"] },
  { id: "pro", name: "Про", price: 2490, billingCycle: "monthly", tier: "pro", includedProducts: ["demo-prompt-1", "demo-agent-1"], features: ["Полный каталог промтов", "Безлимит скачиваний", "Ранний доступ к новинкам", "Коммерческая лицензия"] },
  { id: "enterprise", name: "Энтерпрайз", price: 19900, billingCycle: "yearly", tier: "enterprise", includedProducts: ["demo-prompt-1", "demo-agent-1", "demo-site-1"], features: ["Все продукты каталога", "Выделенный менеджер", "SLA 99.9%", "Resell-лицензия"] },
];

/* ---------- демо-продукты для первого запуска ---------- */
function seedDemo(s) {
  if (s.products.length) return;
  const now = new Date().toISOString();
  s.products.push(
    { id: "demo-prompt-1", ownerId: "demo-seller-1", type: "prompt", title: "Набор промтов «Интерьер-стилист»", description: "25 протестированных системных промтов для генерации дизайн-концепций интерьеров. Работают с GPT-4 и YandexGPT.", price: 990, licenseType: "personal", version: "1.0", fileUrl: "", previewUrl: "", stats: { downloads: 0, revenue: 0, rating: 4.8, salesCount: 12 }, testDriveLimit: 2, status: "published", systemPrompt: "Ты — интерьерный стилист. Отвечай лаконично, предлагай палитру и материалы.", exampleInputs: ["Гостиная 18 м², северная сторона"], exampleOutputs: ["Тёплый минимализм: дуб, лён, латунь…"], targetAI: "gpt4", createdAt: now, updatedAt: now },
    { id: "demo-agent-1", ownerId: "demo-seller-1", type: "agent", title: "ИИ-агент «Менеджер маркетплейса»", description: "Готовый агент для мониторинга цен и автоответов покупателям. Конфигурация + инструкция запуска.", price: 4900, licenseType: "commercial", version: "1.0", fileUrl: "", previewUrl: "", stats: { downloads: 0, revenue: 0, rating: 4.6, salesCount: 5 }, testDriveLimit: 2, status: "published", agentConfig: { tools: ["price_monitor", "reply_agent"], loop: "react" }, modelProvider: "local", requiresHosting: false, monthlyTokenLimit: 1000000, createdAt: now, updatedAt: now },
    { id: "demo-site-1", ownerId: "demo-seller-1", type: "site", title: "Шаблон «Магазин мастера»", description: "Лендинг-шаблон портфолио мастера на React + Tailwind. Исходный код включён.", price: 3500, licenseType: "resell", version: "1.0", fileUrl: "", previewUrl: "", stats: { downloads: 0, revenue: 0, rating: 4.9, salesCount: 30 }, testDriveLimit: 0, status: "published", techStack: ["React", "Tailwind"], includesSourceCode: true, demoUrl: "https://example.com/demo", createdAt: now, updatedAt: now },
  );
}

module.exports = { mount };

function mount(app, { guard, softGuard, db }) {
  writeSeg((s) => seedDemo(s));

  /* ===== список продуктов (витрина / кабинет) ===== */
  app.get("/api/digital/products", softGuard, async (req, res) => {
    try {
      const s = seg();
      let list = s.products;
      if (req.query.ownerId) {
        // кабинет продавца — только свои (canMutate-логика на уровне выдачи)
        if (req.userId !== req.query.ownerId) return res.status(403).json({ error: "forbidden" });
      } else {
        list = list.filter((p) => p.status === "published");
      }
      // приватные поля не покидают сервер до покупки
      const safe = list.map(({ systemPrompt, agentConfig, fileUrl, ...rest }) => rest);
      res.json({ products: safe });
    } catch (e) { console.error("[DIGITAL LIST ERROR]", e); res.status(500).json({ error: "server" }); }
  });

  /* ===== карточка продукта ===== */
  app.get("/api/digital/products/:id", softGuard, async (req, res) => {
    try {
      const s = seg();
      const p = s.products.find((x) => x.id === req.params.id);
      if (!p) return res.status(404).json({ error: "not_found" });
      const access = req.userId ? hasDigitalAccess(s, req.userId, p) : { ok: false };
      const { systemPrompt, agentConfig, fileUrl, ...pub } = p;
      const used = req.userId ? (s.testDrives[`${req.userId}:${p.id}`]?.count || 0) : 0;
      res.json({ product: pub, hasAccess: access.ok, accessVia: access.via || null, testDrivesUsed: used, testDrivesLeft: Math.max(0, (p.testDriveLimit || 2) - used) });
    } catch (e) { console.error("[DIGITAL GET ERROR]", e); res.status(500).json({ error: "server" }); }
  });

  /* ===== создание продукта (мастер, шаг 5) ===== */
  app.post("/api/digital/products", guard, async (req, res) => {
    try {
      if (isBlocked(req)) return res.status(423).json({ error: "ip_blocked" });
      const b = req.body || {};
      const types = ["site", "prompt", "skill", "agent", "subscription"];
      if (!types.includes(b.type)) return res.status(400).json({ error: "bad_type" });
      if (!b.title || b.title.length < 5 || b.title.length > 100) return res.status(400).json({ error: "bad_title" });
      if (!b.description || b.description.length < 20 || b.description.length > 2000) return res.status(400).json({ error: "bad_description" });
      if (typeof b.price !== "number" || b.price < 0 || b.price > 1000000) return res.status(400).json({ error: "bad_price" });
      if (!["personal", "commercial", "resell"].includes(b.licenseType)) return res.status(400).json({ error: "bad_license" });
      const now = new Date().toISOString();
      const product = {
        id: "dp_" + crypto.randomUUID(),
        ownerId: req.userId,                       // владелец фиксируется навсегда
        type: b.type, title: b.title, description: b.description,
        price: b.price, licenseType: b.licenseType, version: "1.0",
        fileUrl: b.fileUrl || "", previewUrl: b.previewUrl || "",
        stats: { downloads: 0, revenue: 0, rating: 0, salesCount: 0 },
        testDriveLimit: typeof b.testDriveLimit === "number" ? b.testDriveLimit : 2,
        status: "published", createdAt: now, updatedAt: now,
        ...(b.extras || {}),                        // специфичные поля типа (systemPrompt, techStack…)
      };
      writeSeg((s) => { s.products.push(product); s.versions.push({ id: crypto.randomUUID(), productId: product.id, version: "1.0", fileUrl: product.fileUrl, releasedAt: now }); });
      res.json({ productId: product.id });
    } catch (e) { console.error("[DIGITAL CREATE ERROR]", e); res.status(500).json({ error: "server" }); }
  });

  /* ===== редактирование (только владелец — canMutate) ===== */
  app.patch("/api/digital/products/:id", guard, async (req, res) => {
    try {
      let updated = null, denied = false;
      writeSeg((s) => {
        const p = s.products.find((x) => x.id === req.params.id);
        if (!p) return;
        if (p.ownerId !== req.userId) { denied = true; return; }   // canMutate: строгое совпадение ownerId
        const allowed = ["title", "description", "price", "licenseType", "previewUrl", "status", "testDriveLimit", "extras"];
        for (const k of allowed) if (req.body[k] !== undefined) {
          if (k === "extras") Object.assign(p, req.body.extras); else p[k] = req.body[k];
        }
        p.updatedAt = new Date().toISOString();
        updated = p;
      });
      if (denied) { logSecurity(null, { userId: req.userId, endpoint: "PATCH /api/digital/products/" + req.params.id, productId: req.params.id, ipAddress: clientIp(req), action: "ownership_violation" }); return res.status(403).json({ error: "forbidden" }); }
      if (!updated) return res.status(404).json({ error: "not_found" });
      const { systemPrompt, agentConfig, fileUrl, ...pub } = updated;
      res.json({ product: pub });
    } catch (e) { console.error("[DIGITAL PATCH ERROR]", e); res.status(500).json({ error: "server" }); }
  });

  /* ===== снятие с продажи / удаление (только владелец) ===== */
  app.delete("/api/digital/products/:id", guard, async (req, res) => {
    try {
      let code = 200;
      writeSeg((s) => {
        const i = s.products.findIndex((x) => x.id === req.params.id);
        if (i < 0) { code = 404; return; }
        if (s.products[i].ownerId !== req.userId) { code = 403; return; }
        if (String(req.query.action) === "archive") s.products[i].status = "archived"; // купленные сохраняют доступ
        else s.products.splice(i, 1);
      });
      if (code === 403) logSecurity(null, { userId: req.userId, endpoint: "DELETE /api/digital/products/" + req.params.id, productId: req.params.id, ipAddress: clientIp(req), action: "ownership_violation" });
      res.status(code).json(code === 200 ? { ok: true } : { error: code === 403 ? "forbidden" : "not_found" });
    } catch (e) { console.error("[DIGITAL DELETE ERROR]", e); res.status(500).json({ error: "server" }); }
  });

  /* ===== загрузка приватного файла (только владелец продукта) ===== */
  app.post("/api/digital/upload", guard, async (req, res) => {
    try {
      const { base64, filename, productId } = req.body || {};
      if (!base64 || !filename) return res.status(400).json({ error: "no_file" });
      const buf = Buffer.from(String(base64).replace(/^data:.*?;base64,/, ""), "base64");
      if (buf.length > 15 * 1024 * 1024) return res.status(413).json({ error: "too_large" });
      const fileUrl = storage.uploadDigitalFile(buf, String(filename));
      if (productId) { // если продукт уже создан — привязка строго владельцем
        let denied = false, found = false;
        writeSeg((s) => {
          const p = s.products.find((x) => x.id === productId);
          if (!p) return; found = true;
          if (p.ownerId !== req.userId) { denied = true; return; }
          p.fileUrl = fileUrl; p.updatedAt = new Date().toISOString();
        });
        if (denied) return res.status(403).json({ error: "forbidden" });
        if (!found && String(productId).startsWith("dp_")) return res.status(404).json({ error: "not_found" });
      }
      res.json({ fileUrl });
    } catch (e) { console.error("[DIGITAL UPLOAD ERROR]", e); res.status(500).json({ error: "server" }); }
  });

  /* ===== загрузка публичного превью ===== */
  app.post("/api/digital/preview", guard, async (req, res) => {
    try {
      const { base64, filename } = req.body || {};
      if (!base64 || !/\.(png|jpe?g)$/i.test(filename || "")) return res.status(400).json({ error: "bad_preview_format" });
      const buf = Buffer.from(String(base64).replace(/^data:.*?;base64,/, ""), "base64");
      if (buf.length > 15 * 1024 * 1024) return res.status(413).json({ error: "too_large" });
      res.json({ previewUrl: storage.uploadPreview(buf, String(filename)) });
    } catch (e) { console.error("[DIGITAL PREVIEW ERROR]", e); res.status(500).json({ error: "server" }); }
  });

  /* ===== скачивание через presigned URL (проверка покупки обязательна) ===== */
  app.get("/api/digital/:id/download", guard, async (req, res) => {
    try {
      const s = seg();
      const p = s.products.find((x) => x.id === req.params.id);
      if (!p) return res.status(404).json({ error: "not_found" });
      const access = hasDigitalAccess(s, req.userId, p);
      if (!access.ok && p.ownerId !== req.userId) { // владелец может скачать свой файл, но это НЕ покупка
        logSecurity(null, { userId: req.userId, endpoint: "GET /api/digital/:id/download", productId: p.id, ipAddress: clientIp(req), action: "access_denied" });
        return res.status(403).json({ error: "no_access" });
      }
      if (!p.fileUrl) return res.status(409).json({ error: "file_not_uploaded" });
      let url = "";
      writeSeg((x) => {
        const rec = x.purchases.find((pp) => pp.userId === req.userId && pp.productId === p.id);
        if (rec) rec.downloadCount += 1;
        p.stats.downloads += 1;
        url = storage.generatePresignedUrl(p.fileUrl); // путь вида /uploads/digital/<file> — раздаётся regex-маршрутом ниже
      });
      res.json({ downloadUrl: url, expiresInMinutes: 15 });
    } catch (e) { console.error("[DIGITAL DOWNLOAD ERROR]", e); res.status(500).json({ error: "server" }); }
  });

  /* ===== раздача файла по presigned ссылке (токен + срок) ===== */
  // Приватная папка server/uploads НЕ отдаётся статикой; единственный путь наружу — этот маршрут.
  // NB: Express 5 не поддерживает параметр с расширением (:filename.txt),
  // поэтому имя файла любого расширения матчится одним regex-маршрутом.
  app.get(/^\/uploads\/digital\/(.+)$/, async (req, res) => {
    try {
      const filename = req.params[0];
      const qs = `token=${req.query.token || ""}&expires=${req.query.expires || ""}`;
      const full = `/uploads/digital/${filename}?${qs}`;
      if (!storage.validatePresignedUrl(full)) return res.status(403).json({ error: "link_expired_or_invalid" });
      const filepath = path.join(__dirname, "uploads", "digital", path.basename(filename));
      if (!fs.existsSync(filepath)) return res.status(404).json({ error: "file_not_found" });
      res.sendFile(filepath);
    } catch (e) { console.error("[DIGITAL SERVE ERROR]", e); res.status(500).json({ error: "server" }); }
  });

  /* ===== содержимое промта/агента (только после покупки) ===== */
  app.get("/api/digital/:id/content", guard, async (req, res) => {
    try {
      const s = seg();
      const p = s.products.find((x) => x.id === req.params.id);
      if (!p) return res.status(404).json({ error: "not_found" });
      const access = hasDigitalAccess(s, req.userId, p);
      if (!access.ok && p.ownerId !== req.userId) {
        logSecurity(null, { userId: req.userId, endpoint: "GET /api/digital/:id/content", productId: p.id, ipAddress: clientIp(req), action: "content_access_denied" });
        return res.status(403).json({ error: "no_access" });
      }
      res.json({ type: p.type, systemPrompt: p.systemPrompt || null, agentConfig: p.agentConfig || null, documentation: p.documentation || null, version: p.version });
      // фиксируем просмотр контента как скачивание (для статистики продавца)
      if (access.ok) writeSeg((x) => { const rec = x.purchases.find((pp) => pp.userId === req.userId && pp.productId === p.id); if (rec) rec.downloadCount += 1; const pr = x.products.find((pp) => pp.id === p.id); pr.stats.downloads += 1; });
    } catch (e) { console.error("[DIGITAL CONTENT ERROR]", e); res.status(500).json({ error: "server" }); }
  });

  /* ===== тест-драйв (промты и агенты): лимит 2 на пару + rate limit 5/час/IP ===== */
  app.post("/api/digital/:id/test-drive", guard, async (req, res) => {
    try {
      if (isBlocked(req)) return res.status(423).json({ error: "ip_blocked" });
      const s = seg();
      const p = s.products.find((x) => x.id === req.params.id);
      if (!p || !["prompt", "agent"].includes(p.type)) return res.status(400).json({ error: "test_drive_unavailable" });
      // rate limit: 5 попыток в час с IP
      const key = `${req.userId}:${p.id}`;
      const ipKey = `ip:${clientIp(req)}`;
      writeSeg(() => {}); // гарантируем существование сегмента
      const st = seg();
      const nowHour = new Date().toISOString().slice(0, 13);
      st.testDrives[ipKey] = st.testDrives[ipKey] || { hour: nowHour, count: 0 };
      if (st.testDrives[ipKey].hour !== nowHour) st.testDrives[ipKey] = { hour: nowHour, count: 0 };
      if (st.testDrives[ipKey].count >= 5) return res.status(429).json({ error: "rate_limit" });
      st.testDrives[ipKey].count += 1;
      const td = st.testDrives[key] || { count: 0 };
      if (td.count >= (p.testDriveLimit || 2)) {
        logSecurity(null, { userId: req.userId, endpoint: "POST test-drive", productId: p.id, ipAddress: clientIp(req), action: "test_drive_exhausted" });
        return res.status(403).json({ error: "limit_reached", message: "Лимит бесплатных тестов исчерпан. Купите продукт, чтобы получить полный доступ." });
      }
      td.count += 1;
      writeSeg((x) => { x.testDrives[key] = td; x.testDrives[ipKey] = st.testDrives[ipKey]; });
      // mock-результат: эмулирует работу модели, реальный AI подключается позже
      const input = String(req.body.input || "").slice(0, 500);
      const result = p.type === "prompt"
        ? `[тест-драйв промта · ${p.targetAI}] Пример ответа на «${input}»: тёплая палитра, натуральные материалы, компактная мебель. Полный результат — после покупки.`
        : `[тест-драйв агента · ${p.modelProvider}] Агент получил «${input}» → шаг 1: анализ, шаг 2: подготовка ответа. Полная конфигурация — после покупки.`;
      res.json({ result, attemptsLeft: Math.max(0, (p.testDriveLimit || 2) - td.count) });
    } catch (e) { console.error("[DIGITAL TESTDRIVE ERROR]", e); res.status(500).json({ error: "server" }); }
  });

  /* ===== покупка (эмуляция успешной оплаты) ===== */
  app.post("/api/digital/:id/purchase", guard, async (req, res) => {
    try {
      const s = seg();
      const p = s.products.find((x) => x.id === req.params.id);
      if (!p) return res.status(404).json({ error: "not_found" });
      if (p.status !== "published") return res.status(409).json({ error: "not_available" });
      if (p.ownerId === req.userId) return res.status(400).json({ error: "own_product" });
      if (hasPurchase(s, req.userId, p.id)) return res.json({ ok: true, already: true });
      const purchase = { id: "pur_" + crypto.randomUUID(), userId: req.userId, productId: p.id, purchasedAt: new Date().toISOString(), downloadCount: 0, purchasedVersion: p.version };
      writeSeg((x) => {
        x.purchases.push(purchase);
        const pr = x.products.find((pp) => pp.id === p.id);
        pr.stats.salesCount += 1; pr.stats.revenue += p.price;
      });
      const buyer = await db.byId(req.userId);
      notifySeller(p.ownerId, "digital_product_purchased", "Новая продажа цифрового товара", `Куплен продукт «${p.title}» за ${p.price} ₽. Покупатель: ${(buyer && (buyer.name || buyer.email)) || "гость"}.`, `/profile/digital-sales`);
      notifyBuyer(req.userId, "digital_product_purchased", "Покупка подтверждена", `«${p.title}» доступен в разделе «Цифровые покупки». ${p.type === "prompt" || p.type === "agent" ? "Откройте доступ в интерфейсе." : "Скачайте файл в любое время."}`, `/profile/digital-purchases`);
      res.json({ ok: true, purchaseId: purchase.id });
    } catch (e) { console.error("[DIGITAL PURCHASE ERROR]", e); res.status(500).json({ error: "server" }); }
  });

  /* ===== мои покупки (кабинет покупателя) ===== */
  app.get("/api/digital/my/purchases", guard, async (req, res) => {
    try {
      const s = seg();
      const items = s.purchases.filter((x) => x.userId === req.userId).sort((a, b) => Date.parse(b.purchasedAt) - Date.parse(a.purchasedAt)).map((x) => {
        const p = s.products.find((pp) => pp.id === x.productId);
        if (!p) return { ...x, product: null, note: "Продавец удалил товар. Скачанные файлы остаются у вас." };
        const { systemPrompt, agentConfig, fileUrl, ...pub } = p;
        return { ...x, product: pub, updateAvailable: pub.version !== x.purchasedVersion };
      });
      res.json({ purchases: items });
    } catch (e) { console.error("[DIGITAL MY-PURCHASES ERROR]", e); res.status(500).json({ error: "server" }); }
  });

  /* ===== история версий ===== */
  app.get("/api/digital/:id/versions", softGuard, async (req, res) => {
    try {
      const s = seg();
      const p = s.products.find((x) => x.id === req.params.id);
      if (!p) return res.status(404).json({ error: "not_found" });
      const access = req.userId ? hasDigitalAccess(s, req.userId, p) : { ok: false };
      if (!access.ok && p.ownerId !== req.userId) return res.status(403).json({ error: "no_access" });
      res.json({ versions: s.versions.filter((v) => v.productId === p.id).sort((a, b) => Date.parse(b.releasedAt) - Date.parse(a.releasedAt)).map(({ fileUrl, ...v }) => v) });
    } catch (e) { console.error("[DIGITAL VERSIONS ERROR]", e); res.status(500).json({ error: "server" }); }
  });

  /* ===== новая версия (только владелец) + уведомления всем покупателям ===== */
  app.post("/api/digital/:id/version", guard, async (req, res) => {
    try {
      const { version, base64, filename } = req.body || {};
      if (!/^\d+\.\d+$/.test(String(version || ""))) return res.status(400).json({ error: "bad_version" });
      let err = null, oldVer = "";
      writeSeg((s) => {
        const p = s.products.find((x) => x.id === req.params.id);
        if (!p) { err = 404; return; }
        if (p.ownerId !== req.userId) { err = 403; return; }
        oldVer = p.version;
        if (Date.parse(version) <= 0) {} // noop
        if (parseFloat(version) <= parseFloat(p.version)) { err = 400; return; }
        let fileUrl = p.fileUrl;
        if (base64 && filename) fileUrl = storage.uploadDigitalFile(Buffer.from(String(base64).replace(/^data:.*?;base64,/, ""), "base64"), String(filename));
        p.version = version; p.fileUrl = fileUrl; p.updatedAt = new Date().toISOString();
        s.versions.push({ id: crypto.randomUUID(), productId: p.id, version, fileUrl, releasedAt: p.updatedAt });
        const buyers = [...new Set(s.purchases.filter((x) => x.productId === p.id).map((x) => x.userId))];
        for (const b of buyers) queueNotify(b, "digital_product_updated", "Продукт обновлён", `«${p.title}»: доступна версия ${version} (была ${oldVer}). Скачать бесплатно можно в «Моих цифровых покупках».`, `/profile/digital-purchases`);
      });
      if (err) return res.status(err).json({ error: err === 403 ? "forbidden" : err === 404 ? "not_found" : "bad_version" });
      res.json({ ok: true, version });
    } catch (e) { console.error("[DIGITAL VERSION ERROR]", e); res.status(500).json({ error: "server" }); }
  });

  /* ===== аналитика продавца + CSV ===== */
  app.get("/api/digital/seller/analytics", guard, async (req, res) => {
    try {
      const s = seg();
      const mine = s.products.filter((p) => p.ownerId === req.userId);
      const ids = new Set(mine.map((p) => p.id));
      const myPurchases = s.purchases.filter((x) => ids.has(x.productId));
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
      const byDay = {};
      for (const pu of myPurchases) { const d = pu.purchasedAt.slice(0, 10); byDay[d] = (byDay[d] || 0) + 1; }
      if (String(req.query.format) === "csv") {
        const rows = ["product_id,title,type,version,sales,revenue,downloads,rating"];
        for (const p of mine) rows.push([p.id, `"${p.title.replace(/"/g, '""')}"`, p.type, p.version, p.stats.salesCount, p.stats.revenue, p.stats.downloads, p.stats.rating].join(","));
        res.setHeader("Content-Type", "text/csv; charset=utf-8").setHeader("Content-Disposition", "attachment; filename=digital-analytics.csv");
        return res.send("\uFEFF" + rows.join("\n"));
      }
      res.json({
        dashboard: {
          totalRevenue: mine.reduce((a, p) => a + p.stats.revenue, 0),
          salesThisMonth: myPurchases.filter((x) => Date.parse(x.purchasedAt) >= monthStart.getTime()).length,
          totalDownloads: mine.reduce((a, p) => a + p.stats.downloads, 0),
          avgRating: mine.length ? +(mine.reduce((a, p) => a + p.stats.rating, 0) / mine.length).toFixed(2) : 0,
        },
        salesByDay: byDay,
        recentPurchases: myPurchases.slice(-20).reverse(),
        products: mine.map(({ systemPrompt, agentConfig, fileUrl, ...rest }) => rest),
      });
    } catch (e) { console.error("[DIGITAL ANALYTICS ERROR]", e); res.status(500).json({ error: "server" }); }
  });

  /* ===== подписки (§10) ===== */
  app.get("/api/digital/subscriptions/plans", (_q, res) => res.json({ plans: PLANS }));

  app.post("/api/digital/subscriptions/checkout", guard, async (req, res) => {
    try {
      const plan = PLANS.find((p) => p.id === req.body.planId);
      if (!plan) return res.status(400).json({ error: "bad_plan" });
      const start = new Date();
      const end = new Date(start.getTime() + (plan.billingCycle === "yearly" ? 365 : 30) * DAY);
      const sub = { id: "sub_" + crypto.randomUUID(), userId: req.userId, planId: plan.id, status: "active", currentPeriodStart: start.toISOString(), currentPeriodEnd: end.toISOString(), autoRenew: true, paymentMethodId: req.body.paymentMethodId || "pm_mock" };
      writeSeg((s) => { (s.subscriptions = s.subscriptions || []).push(sub); });
      queueNotify(req.userId, "subscription_renewed", "Подписка оформлена", `Тариф «${plan.name}» активен до ${end.toLocaleDateString("ru-RU")}.`, "/profile/subscriptions");
      res.json({ subscription: sub });
    } catch (e) { console.error("[SUB CHECKOUT ERROR]", e); res.status(500).json({ error: "server" }); }
  });

  app.get("/api/digital/my/subscriptions", guard, async (req, res) => {
    try {
      const s = seg();
      const subs = (s.subscriptions || []).filter((x) => x.userId === req.userId).map((x) => ({ ...x, plan: PLANS.find((p) => p.id === x.planId) }));
      res.json({ subscriptions: subs });
    } catch (e) { res.status(500).json({ error: "server" }); }
  });

  app.post("/api/digital/my/subscriptions/:planId/auto-renew", guard, async (req, res) => {
    try {
      let ok = false;
      writeSeg((s) => {
        const sub = (s.subscriptions || []).find((x) => x.userId === req.userId && x.planId === req.params.planId && x.status === "active");
        if (!sub) return;
        sub.autoRenew = !!req.body.enabled; ok = true;
      });
      if (!ok) return res.status(404).json({ error: "not_found" });
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: "server" }); }
  });

  /* фоновый процесс суточного обслуживания подписок + очистка просроченных presigned */
  setInterval(() => {
    try {
      const now = Date.now();
      writeSeg((s) => {
        for (const sub of s.subscriptions || []) {
          const end = Date.parse(sub.currentPeriodEnd);
          if (sub.status === "active" && end <= now) {
            if (sub.autoRenew) {
              const plan = PLANS.find((p) => p.id === sub.planId);
              sub.currentPeriodStart = new Date(end).toISOString();
              sub.currentPeriodEnd = new Date(end + (plan.billingCycle === "yearly" ? 365 : 30) * DAY).toISOString();
              queueNotify(sub.userId, "subscription_renewed", "Подписка продлена", `Тариф «${plan.name}» продлён на следующий период.`, "/profile/subscriptions");
            } else { sub.status = "expired"; queueNotify(sub.userId, "subscription_expired", "Подписка истекла", "Доступ к каталогу подписки закрыт. Скачанные файлы остались у вас навсегда.", "/profile/subscriptions"); }
          }
          if (sub.status === "active" && !sub.autoRenew && end - now <= 3 * DAY && end - now > 2 * DAY) {
            queueNotify(sub.userId, "subscription_expiring", "Подписка скоро истекает", `Осталось 3 дня. Автопродление выключено.`, "/profile/subscriptions");
          }
        }
      });
    } catch (e) { console.error("[SUB DAEMON ERROR]", e); }
  }, 24 * 3600 * 1000);

  console.log("[digital] routes mounted | приватное хранилище: server/uploads/digital | подписки: " + PLANS.length + " тарифа");
}

/* ---------- уведомления: переиспользуем createNotification из index.cjs, если он проброшен; иначе пишем напрямую ---------- */
let _notifySink = null;
function setNotifySink(fn) { _notifySink = fn; }
function queueNotify(userId, type, title, text, link) {
  if (_notifySink) { _notifySink(userId, type, title, text, link); return; }
  directNotify(userId, type, title, text, link);
}
function directNotify(userId, type, title, text, link) {
  const d = load();
  if (!d.notifications) d.notifications = [];
  d.notifications.push({ id: crypto.randomUUID(), user_id: userId, type, title, text, link: link || "/profile", read: false, created_at: new Date().toISOString() });
  save(d);
  console.log(`[SMTP ЭМУЛЯЦИЯ] Письмо пользователю ${userId}: Тема "[Quantiform] ${title}"`);
}
function notifySeller(ownerId, type, title, text, link) { queueNotify(ownerId, type, title, text, link); }
function notifyBuyer(userId, type, title, text, link) { queueNotify(userId, type, title, text, link); }

module.exports.setNotifySink = setNotifySink;
module.exports.hasDigitalAccess = function (userId, productId) { const s = seg(); const p = s.products.find((x) => x.id === productId); return p ? hasDigitalAccess(s, userId, p).ok : false; };
