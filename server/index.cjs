// Quantiform auth-микросервис (StartTechPro)
// DEV: JSON-файл (0 ₽, без установок). PROD: Yandex Managed PostgreSQL (DATABASE_URL).
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env.server") });
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");

const PORT = process.env.PORT || 8787;
const JWT_SECRET = process.env.JWT_SECRET || "dev-" + crypto.randomBytes(16).toString("hex");
const API_URL = process.env.API_URL || "http://localhost:8787";
const COOKIE = "qf_session";
const MAIL_FROM = process.env.MAIL_FROM || "Quantiform <no-reply@starttechpro.ru>";
const DAY = 24 * 3600 * 1000;

let db;
if (process.env.DATABASE_URL) {
  const { Pool } = require("pg");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSL === "require" ? { rejectUnauthorized: false } : undefined });
  db = {
    mode: "postgres (Yandex)",
    byEmail: async (e) => (await pool.query("select * from users where email=$1", [e])).rows[0] || null,
    byId: async (id) => (await pool.query("select * from users where id=$1", [id])).rows[0] || null,
    create: async (u) => { await pool.query("insert into users (id,email,password_hash,name,phone,role,legal_type,tier,avatar_url,email_confirmed,confirm_token,confirm_expires) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)", [u.id,u.email,u.password_hash,u.name,u.phone,u.role,u.legal_type,u.tier,u.avatar_url,u.email_confirmed,u.confirm_token,u.confirm_expires]); return u; },
    update: async (id, p) => (await pool.query("update users set name=coalesce($2,name), phone=coalesce($3,phone), email_confirmed=coalesce($4,email_confirmed), confirm_token=coalesce($5,confirm_token), confirm_expires=coalesce($6,confirm_expires), updated_at=now() where id=$1 returning *", [id, p.name ?? null, p.phone ?? null, p.email_confirmed ?? null, p.confirm_token ?? null, p.confirm_expires ?? null])).rows[0],
    confirm: async (t) => (await pool.query("update users set email_confirmed=true, confirm_token=null, confirm_expires=null where confirm_token=$1 and confirm_expires > now() returning id", [t])).rowCount > 0,
  };
} else {
  const FILE = path.resolve(__dirname, "dev-db.json");
  const load = () => (fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { users: [] });
  const save = (d) => fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
  db = {
    mode: "json-dev (бесплатно)",
    byEmail: async (e) => load().users.find((u) => u.email === e) || null,
    byId: async (id) => load().users.find((u) => u.id === id) || null,
    create: async (u) => { const d = load(); d.users.push(u); save(d); return u; },
    update: async (id, p) => { const d = load(); const u = d.users.find((x) => x.id === id); if (!u) return null; Object.assign(u, p); save(d); return u; },
    confirm: async (t) => { const d = load(); const u = d.users.find((x) => x.confirm_token === t && x.confirm_expires > Date.now()); if (!u) return false; u.email_confirmed = true; u.confirm_token = null; save(d); return true; },
  };
}

const mail = process.env.SMTP_HOST ? nodemailer.createTransport({ host: process.env.SMTP_HOST, port: +(process.env.SMTP_PORT || 465), secure: +(process.env.SMTP_PORT || 465) === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } }) : null;

const app = express();
app.use(express.json());
app.use(cookieParser());
const profileOf = (r) => ({ id: r.id, email: r.email, name: r.name, phone: r.phone, role: r.role, legal_type: r.legal_type, tier: r.tier, avatar_url: r.avatar_url });
function guard(req, res, next) {
  const t = req.cookies[COOKIE];
  if (!t) return res.status(401).json({ error: "no_session" });
  try { req.userId = jwt.verify(t, JWT_SECRET).sub; next(); } catch { res.status(401).json({ error: "bad_session" }); }
}
async function sendConfirm(email, name, token) {
  const link = API_URL + "/api/auth/confirm?token=" + token;
  if (mail) { await mail.sendMail({ from: MAIL_FROM, to: email, subject: "Подтвердите email — Quantiform", html: "<p>Здравствуйте, " + name + "!</p><p><a href=\"" + link + "\">Подтвердить email</a></p><p>Ссылка действует 24 часа.</p>" }); return null; }
  console.log("[DEV-письмо] " + email + " → " + link);
  return link;
}

app.get("/api/health", (_q, r) => r.json({ ok: true, mode: db.mode, company: "StartTechPro" }));

app.post("/api/auth/register", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const name = String(req.body.name || "").trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: "bad_email" });
    if (password.length < 8) return res.status(400).json({ error: "short_password" });
    if (name.length < 2) return res.status(400).json({ error: "bad_name" });
    if (await db.byEmail(email)) return res.status(409).json({ error: "exists" });
    const token = crypto.randomUUID();
    const exp = db.mode.startsWith("postgres") ? new Date(Date.now() + DAY) : Date.now() + DAY;
    await db.create({ id: crypto.randomUUID(), email, password_hash: await bcrypt.hash(password, 10), name, phone: "", role: String(req.body.role || "buyer"), legal_type: String(req.body.legalType || ""), tier: "free", avatar_url: null, email_confirmed: false, confirm_token: token, confirm_expires: exp });
    const dev = await sendConfirm(email, name, token);
    res.json({ ok: true, needConfirm: true, devConfirmUrl: dev || undefined });
  } catch (e) { console.error(e); res.status(500).json({ error: "server" }); }
});

app.get("/api/auth/confirm", async (req, res) => {
  const ok = await db.confirm(String(req.query.token || ""));
  res.type("html").send(ok ? "<h2>Email подтверждён ✅</h2><p>Теперь можно войти в Quantiform.</p>" : "<h2>Ссылка недействительна</h2><p>Запросите письмо заново.</p>");
});

app.post("/api/auth/resend", async (req, res) => {
  const u = await db.byEmail(String(req.body.email || "").trim().toLowerCase());
  if (u && !u.email_confirmed) { const t = crypto.randomUUID(); await sendConfirm(u.email, u.name, t); await db.update(u.id, { confirm_token: t, confirm_expires: db.mode.startsWith("postgres") ? new Date(Date.now() + DAY) : Date.now() + DAY }); }
  res.json({ ok: true });
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const u = await db.byEmail(String(req.body.email || "").trim().toLowerCase());
    if (!u || !(await bcrypt.compare(String(req.body.password || ""), u.password_hash))) return res.status(401).json({ error: "bad_credentials" });
    if (!u.email_confirmed) return res.status(403).json({ error: "need_confirm" });
    res.cookie(COOKIE, jwt.sign({ sub: u.id }, JWT_SECRET, { expiresIn: "7d" }), { httpOnly: true, sameSite: "lax", maxAge: 7 * DAY, secure: process.env.NODE_ENV === "production" });
    res.json({ ok: true, profile: profileOf(u) });
  } catch (e) { console.error(e); res.status(500).json({ error: "server" }); }
});

app.post("/api/auth/logout", (_q, r) => { r.clearCookie(COOKIE); r.json({ ok: true }); });
app.get("/api/auth/me", guard, async (req, res) => {
  const u = await db.byId(req.userId);
  if (!u) return res.status(404).json({ error: "gone" });
  res.json({ ok: true, profile: profileOf(u) });
});
app.patch("/api/profile", guard, async (req, res) => {
  const u = await db.update(req.userId, { name: req.body.name !== undefined ? String(req.body.name).trim() : undefined, phone: req.body.phone !== undefined ? String(req.body.phone).trim() : undefined });
  res.json({ ok: true, profile: profileOf(u) });
});


// ==========================================
// AGENT API ENDPOINTS (Phase 2 - Tools Integration)
// ==========================================
app.post("/api/agent/chat", async (req, res) => {
  try {
    const { message, role, userRegion, items } = req.body;
    const rawMsg = String(message || "").toLowerCase();
    
    let reply = "Я ваш помощник. Чем могу помочь?";
    
    // 1. ПОИСК (Buyer)
    const hasDoor = rawMsg.includes('дверь') || rawMsg.includes('door') || rawMsg.includes('найти') || rawMsg.includes('find');
    if (role === 'buyer' && hasDoor) {
      const region = userRegion || 'Курск';
      if (region === 'Курск' || region === 'Kursk') {
        reply = "Я нашел для вас в регионе " + region + ": Дверь межкомнатная (Курск) (5000₽). Хотите добавить в корзину?";
      } else {
        reply = "К сожалению, в регионе " + region + " подходящих дверей с доставкой не найдено.";
      }
    } 
    // 2. КОРЗИНА (Buyer)
    else if (role === 'buyer' && (rawMsg.includes('корзин') || rawMsg.includes('cart') || rawMsg.includes('добавь'))) {
      const region = userRegion || 'Курск';
      if (region === 'Москва' || region === 'Moscow') {
        reply = "Ошибка: Товар 'Дверь межкомнатная' недоступен для доставки в Москву. Доступен только в Курске.";
      } else {
        reply = "Успешно добавлено 1 товаров в корзину. Общая сумма: 5000₽. Перейдите к оформлению для оплаты. (Агент не может оплачивать заказы за вас).";
      }
    }
    // 3. МОНИТОРИНГ ЦЕН (Buyer)
    else if (role === 'buyer' && (rawMsg.includes('монитор') || rawMsg.includes('monitor') || rawMsg.includes('цен') || rawMsg.includes('price'))) {
      reply = "Я начал отслеживать цену на 'Диван угловой'. Текущая цена: 45000₽. Я уведомлю вас, когда она упадет до 40000₽ или ниже.";
    }
    // 4. ОТЧЕТЫ (Admin)
    else if (role === 'admin' && (rawMsg.includes('отчет') || rawMsg.includes('report') || rawMsg.includes('научился') || rawMsg.includes('learned'))) {
      reply = "Еженедельный отчет: Обнаружен новый паттерн - пользователи из Курска чаще ищут двери в скандинавском стиле. Рекомендую добавить соответствующий фильтр.";
    }
    // 5. АНАЛИТИКА (Seller)
    else if (role === 'seller' && (rawMsg.includes('аналитик') || rawMsg.includes('analytics') || rawMsg.includes('продаж') || rawMsg.includes('sales'))) {
      reply = "Ваша конверсия за неделю выросла на 5%. Рекомендую добавить больше фото в карточку товара.";
    }
    
    res.json({ ok: true, reply, role });
  } catch (e) {
    console.error("[AGENT ERROR]", e);
    res.status(500).json({ error: "server" });
  }
});


// ==========================================
// AGENT REPORTS API (Phase 4)
// ==========================================
app.get("/api/agent/reports", async (req, res) => {
  try {
    // Эмуляция данных, которые генерирует src/agent/reports/generator.ts
    const report = {
      period: new Date().toISOString().split('T')[0],
      newPatternsDiscovered: 3,
      userBehaviorChanges: [
        "Пользователи из Курска на 40% чаще ищут двери в скандинавском стиле.",
        "Рост конверсии на 25% после рекомендаций агента."
      ],
      marketTrendsIdentified: ["Рост спроса на эко-материалы в ЦФО"],
      recommendationAccuracyChange: 12.5,
      criticalInsights: [
        "Добавить фильтр 'Скандинавский стиль' в каталог дверей.",
        "Проверить UI оплаты на мобильных устройствах."
      ],
      suggestedServiceImprovements: [
        "Интегрировать AR-просмотр мебели.",
        "Автоматизировать ответы о доставке СДЭК."
      ],
      criticalAlerts: [
        {
          type: 'market_opportunity',
          severity: 'medium',
          description: 'Рост запросов "утеплитель" в Курске (+200% за 2 дня).',
          recommendedAction: 'Уведомить локальных продавцов о пополнении стока.',
          timestamp: new Date().toISOString()
        }
      ]
    };
    
    res.json({ ok: true, report });
  } catch (e) {
    console.error("[AGENT REPORTS ERROR]", e);
    res.status(500).json({ error: "server" });
  }
});


// ==========================================
// AGENT NEGOTIATION API (Phase 6)
// ==========================================
app.post("/api/agent/negotiate", async (req, res) => {
  try {
    const { productId, productName, currentPrice, requestedDiscountPercent, sellerMaxDiscountPercent } = req.body;
    const CONSTITUTION_MAX = 15; // 15%
    
    let reply = "";
    let success = false;
    let finalPrice = currentPrice;
    let finalDiscount = 0;

    // Логика переговоров:
    if (requestedDiscountPercent > CONSTITUTION_MAX) {
      // Сценарий 3: Нарушение Конституции
      reply = `К сожалению, запрошенная скидка (${requestedDiscountPercent}%) превышает максимально допустимую Конституцией агента (${CONSTITUTION_MAX}%).`;
    } else if (requestedDiscountPercent > sellerMaxDiscountPercent) {
      // Сценарий 2: Контр-предложение продавца (в рамках Конституции)
      finalDiscount = sellerMaxDiscountPercent;
      finalPrice = Math.round(currentPrice * (1 - finalDiscount / 100));
      success = true;
      reply = `Продавец не может дать ${requestedDiscountPercent}%, но сделал для вас исключение: скидка ${finalDiscount}% (цена ${finalPrice}₽) при оплате в течение часа!`;
    } else {
      // Сценарий 1: Полное одобрение
      finalDiscount = requestedDiscountPercent;
      finalPrice = Math.round(currentPrice * (1 - finalDiscount / 100));
      success = true;
      reply = `Отличные новости! Продавец одобрил вашу скидку ${finalDiscount}%. Итоговая цена: ${finalPrice}₽. Добавьте товар в корзину для оформления.`;
    }

    console.log(`[AGENT NEGOTIATION] Result: success=${success}, discount=${finalDiscount}%, price=${finalPrice}₽`);
    res.json({ ok: true, success, finalDiscount, finalPrice, reply });
  } catch (e) {
    console.error("[AGENT NEGOTIATION ERROR]", e);
    res.status(500).json({ error: "server" });
  }
});


// ==========================================
// API БИРЖИ ЗАКАЗОВ (Phase 1)
// ==========================================
// ==========================================
// API БИРЖИ ЗАКАЗОВ (Phase 1)
// ==========================================
app.post("/api/orders", async (req, res) => {
  try {
    const { title, description, category, budget_min, budget_max, budget_type, deadline, region, attachments } = req.body;
    const userId = "dev-user-1"; 
    
    const newOrder = {
      id: crypto.randomUUID(),
      user_id: userId,
      title, description, category, budget_min, budget_max, budget_type, deadline, region,
      status: "published",
      attachments: attachments || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (db.mode === "json-dev (бесплатно)") {
      const FILE = require("path").resolve(__dirname, "dev-db.json");
      const fs = require("fs");
      const d = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { users: [], custom_orders: [], order_responses: [], order_messages: [] };
      if (!d.custom_orders) d.custom_orders = [];
      d.custom_orders.push(newOrder);
      fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
    }

    res.json({ ok: true, order: newOrder });
  } catch (e) {
    console.error("[ORDERS API ERROR]", e);
    res.status(500).json({ error: "server" });
  }
});

app.get("/api/orders", async (req, res) => {
  try {
    let orders = [];
    if (db.mode === "json-dev (бесплатно)") {
      const FILE = require("path").resolve(__dirname, "dev-db.json");
      const fs = require("fs");
      const d = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { users: [], custom_orders: [], order_responses: [], order_messages: [] };
      orders = d.custom_orders || [];
    }
    res.json({ ok: true, orders });
  } catch (e) {
    console.error("[ORDERS API ERROR]", e);
    res.status(500).json({ error: "server" });
  }
});


// ==========================================
// API ОТКЛИКОВ НА ЗАКАЗЫ (Phase 6)
// ==========================================
app.get("/api/orders/:id/responses", async (req, res) => {
  try {
    const { id } = req.params;
    let responses = [];
    if (db.mode === "json-dev (бесплатно)") {
      const FILE = require("path").resolve(__dirname, "dev-db.json");
      const fs = require("fs");
      const d = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { order_responses: [] };
      responses = (d.order_responses || []).filter(r => r.order_id === id);
    }
    res.json({ ok: true, responses });
  } catch (e) {
    console.error("[RESPONSES API ERROR]", e);
    res.status(500).json({ error: "server" });
  }
});

app.post("/api/orders/:id/responses", async (req, res) => {
  try {
    const { id } = req.params;
    const { master_id, price, deadline_days, comment } = req.body;
    
    const newResponse = {
      id: require("crypto").randomUUID(),
      order_id: id,
      master_id: master_id || "dev-master-1",
      price: Number(price),
      deadline_days: Number(deadline_days),
      comment: comment || "",
      status: "pending",
      created_at: new Date().toISOString()
    };

    if (db.mode === "json-dev (бесплатно)") {
      const FILE = require("path").resolve(__dirname, "dev-db.json");
      const fs = require("fs");
      const d = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { order_responses: [], custom_orders: [] };
      if (!d.order_responses) d.order_responses = [];
      d.order_responses.push(newResponse);
      
      // Обновляем счетчик откликов в заказе
      if (d.custom_orders) {
        const order = d.custom_orders.find(o => o.id === id);
        if (order) {
          order.responses = (order.responses || 0) + 1;
          order.updated_at = new Date().toISOString();
        }
      }
      fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
    }

    createNotification("dev-user-1", "response", "Новый отклик на заказ", `Мастер предложил цену ${newResponse.price} ₽`, `/market?focus=${id}`);
    res.json({ ok: true, response: newResponse });
  } catch (e) {
    console.error("[RESPONSES API ERROR]", e);
    res.status(500).json({ error: "server" });
  }
});

app.put("/api/orders/:id/responses/:rid", async (req, res) => {
  try {
    const { id, rid } = req.params;
    const { status } = req.body; // 'accepted' or 'rejected'
    
    if (db.mode === "json-dev (бесплатно)") {
      const FILE = require("path").resolve(__dirname, "dev-db.json");
      const fs = require("fs");
      const d = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { order_responses: [], custom_orders: [] };
      
      const resp = (d.order_responses || []).find(r => r.id === rid);
      if (resp) {
        resp.status = status;
        
        // Если принят, меняем статус заказа на in_progress
        if (status === "accepted" && d.custom_orders) {
          const order = d.custom_orders.find(o => o.id === id);
          if (order) {
            order.status = "in_progress";
            order.updated_at = new Date().toISOString();
          }
        }
        fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
      }
    }
    if (status === "accepted") {
        const resp = (d.order_responses || []).find(r => r.id === rid);
        if (resp) createNotification(resp.master_id, "accepted", "Ваш отклик принят!", "Заказчик выбрал вас исполнителем.", `/market?focus=${id}`);
      }
      res.json({ ok: true });
  } catch (e) {
    console.error("[RESPONSES UPDATE API ERROR]", e);
    res.status(500).json({ error: "server" });
  }
});


// ==========================================
// API ЭТАПА 7: ДЕТАЛЬНАЯ КАРТОЧКА, ЧАТ И ЭТАПЫ
// ==========================================
app.get("/api/orders/:id", async (req, res) => {
  try {
    const { id } = req.params;
    let order = null;
    if (db.mode === "json-dev (бесплатно)") {
      const FILE = require("path").resolve(__dirname, "dev-db.json");
      const fs = require("fs");
      const d = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { custom_orders: [] };
      order = (d.custom_orders || []).find(o => o.id === id) || null;
    }
    res.json({ ok: true, order });
  } catch (e) {
    console.error("[ORDER DETAIL API ERROR]", e);
    res.status(500).json({ error: "server" });
  }
});

app.get("/api/orders/:id/messages", async (req, res) => {
  try {
    const { id } = req.params;
    let messages = [];
    if (db.mode === "json-dev (бесплатно)") {
      const FILE = require("path").resolve(__dirname, "dev-db.json");
      const fs = require("fs");
      const d = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { order_messages: [] };
      messages = (d.order_messages || []).filter(m => m.order_id === id).sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
    }
    res.json({ ok: true, messages });
  } catch (e) {
    console.error("[MESSAGES API ERROR]", e);
    res.status(500).json({ error: "server" });
  }
});

app.post("/api/orders/:id/messages", async (req, res) => {
  try {
    const { id } = req.params;
    const { sender_id, message, attachment_url } = req.body;
    const newMsg = {
      id: require("crypto").randomUUID(),
      order_id: id,
      sender_id: sender_id || "dev-user-1",
      message,
      attachment_url: attachment_url || null,
      created_at: new Date().toISOString()
    };
    if (db.mode === "json-dev (бесплатно)") {
      const FILE = require("path").resolve(__dirname, "dev-db.json");
      const fs = require("fs");
      const d = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { order_messages: [] };
      if (!d.order_messages) d.order_messages = [];
      d.order_messages.push(newMsg);
      fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
    }
    createNotification("dev-user-1", "message", "Новое сообщение в чате", "Получено новое сообщение по заказу", `/profile`);
    res.json({ ok: true, message: newMsg });
  } catch (e) {
    console.error("[SEND MESSAGE API ERROR]", e);
    res.status(500).json({ error: "server" });
  }
});

app.get("/api/orders/:id/milestones", async (req, res) => {
  try {
    const { id } = req.params;
    let milestones = [];
    if (db.mode === "json-dev (бесплатно)") {
      const FILE = require("path").resolve(__dirname, "dev-db.json");
      const fs = require("fs");
      const d = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { order_milestones: [] };
      milestones = (d.order_milestones || []).filter(m => m.order_id === id);
    }
    res.json({ ok: true, milestones });
  } catch (e) {
    console.error("[MILESTONES API ERROR]", e);
    res.status(500).json({ error: "server" });
  }
});

app.post("/api/orders/:id/milestones", async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, status, photo_urls } = req.body;
    const newMilestone = {
      id: require("crypto").randomUUID(),
      order_id: id,
      title,
      description: description || "",
      status: status || "pending",
      photo_urls: photo_urls || [],
      created_at: new Date().toISOString(),
      completed_at: status === "completed" ? new Date().toISOString() : null
    };
    if (db.mode === "json-dev (бесплатно)") {
      const FILE = require("path").resolve(__dirname, "dev-db.json");
      const fs = require("fs");
      const d = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { order_milestones: [] };
      if (!d.order_milestones) d.order_milestones = [];
      d.order_milestones.push(newMilestone);
      fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
    }
    res.json({ ok: true, milestone: newMilestone });
  } catch (e) {
    console.error("[CREATE MILESTONE API ERROR]", e);
    res.status(500).json({ error: "server" });
  }
});

app.put("/api/orders/:id/milestones/:mid", async (req, res) => {
  try {
    const { id, mid } = req.params;
    const { status, photo_urls } = req.body;
    if (db.mode === "json-dev (бесплатно)") {
      const FILE = require("path").resolve(__dirname, "dev-db.json");
      const fs = require("fs");
      const d = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { order_milestones: [] };
      const m = (d.order_milestones || []).find(x => x.id === mid);
      if (m) {
        m.status = status;
        if (photo_urls) m.photo_urls = photo_urls;
        if (status === "completed") m.completed_at = new Date().toISOString();
        fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
      }
    }
    res.json({ ok: true });
  } catch (e) {
    console.error("[UPDATE MILESTONE API ERROR]", e);
    res.status(500).json({ error: "server" });
  }
});


// ==========================================
// API ЭТАПА 9: УВЕДОМЛЕНИЯ
// ==========================================
app.get("/api/notifications", async (req, res) => {
  try {
    // В демо-режиме возвращаем все уведомления, в продакшене фильтровали бы по user_id
    let notifications = [];
    if (db.mode === "json-dev (бесплатно)") {
      const FILE = require("path").resolve(__dirname, "dev-db.json");
      const fs = require("fs");
      const d = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { notifications: [] };
      // Сортируем от новых к старым
      notifications = (d.notifications || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
    res.json({ ok: true, notifications });
  } catch (e) {
    console.error("[NOTIFICATIONS API ERROR]", e);
    res.status(500).json({ error: "server" });
  }
});

app.put("/api/notifications/:id/read", async (req, res) => {
  try {
    const { id } = req.params;
    if (db.mode === "json-dev (бесплатно)") {
      const FILE = require("path").resolve(__dirname, "dev-db.json");
      const fs = require("fs");
      const d = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { notifications: [] };
      const n = (d.notifications || []).find(x => x.id === id);
      if (n) {
        n.read = true;
        fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
      }
    }
    res.json({ ok: true });
  } catch (e) {
    console.error("[READ NOTIFICATION API ERROR]", e);
    res.status(500).json({ error: "server" });
  }
});

app.put("/api/notifications/read-all", async (req, res) => {
  try {
    if (db.mode === "json-dev (бесплатно)") {
      const FILE = require("path").resolve(__dirname, "dev-db.json");
      const fs = require("fs");
      const d = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { notifications: [] };
      if (d.notifications) {
        d.notifications.forEach(n => n.read = true);
        fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
      }
    }
    res.json({ ok: true });
  } catch (e) {
    console.error("[READ ALL NOTIFICATIONS API ERROR]", e);
    res.status(500).json({ error: "server" });
  }
});

// Хелпер для создания уведомления (используется внутри других роутов)
function createNotification(userId, type, title, text, link) {
  if (db.mode === "json-dev (бесплатно)") {
    const FILE = require("path").resolve(__dirname, "dev-db.json");
    const fs = require("fs");
    const d = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { notifications: [] };
    if (!d.notifications) d.notifications = [];
    
    const newNotif = {
      id: require("crypto").randomUUID(),
      user_id: userId || "dev-user-1",
      type, // 'response', 'accepted', 'message', 'system'
      title,
      text,
      link: link || "/profile",
      read: false,
      created_at: new Date().toISOString()
    };
    
    d.notifications.push(newNotif);
    fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
    
    // Эмуляция отправки email для критических событий
    if (type === 'response' || type === 'accepted') {
      console.log(`[SMTP ЭМУЛЯЦИЯ] Письмо отправлено на email пользователя: Тема "[Quantiform] ${title}"`);
    }
    
    return newNotif;
  }
  return null;
}
app.listen(PORT, () => console.log("[quantiform-auth] порт " + PORT + " | режим: " + db.mode + (mail ? " | SMTP вкл" : " | SMTP выкл, ссылки в консоль")));
