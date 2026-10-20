/* E2E-проверка: автоматический вход после регистрации (dev-режим) */
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const email = "e2e-" + Date.now() + "@test.ru";
const NAME = "Елена Тестова";

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
const failures = [];

try {
  /* 1. Открыть страницу входа и перейти к регистрации покупателя */
  await page.goto(BASE + "/#/auth?mode=register", { waitUntil: "networkidle" });
  await page.waitForSelector("text=Создайте аккаунт", { timeout: 10000 });

  /* Убедиться, что устаревших категорий нет */
  const hasOldCats = await page.locator("text=/декор|фурнитура|хобби/i").count();
  if (hasOldCats > 0) failures.push("На форме регистрации остались старые категории интересов");

  /* 2. Заполнить форму */
  await page.fill('input[placeholder="Анна"]', NAME);
  await page.fill('input[type="email"]', email.toUpperCase()); // проверка нормализации
  await page.fill('input[placeholder="+7 (___) ___-__-__"]', "+7 912 555 12-34");
  await page.fill('input[autocomplete="new-password"]', "superpass123");
  await page.check('input[type="checkbox"]');

  /* 3. Отправить — ждём автологина */
  const respPromise = page.waitForResponse((r) => r.url().includes("/api/auth/register"), { timeout: 15000 });
  await page.click('button:has-text("Зарегистрироваться")');
  const resp = await respPromise;
  const body = await resp.json();
  console.log("REGISTER RESPONSE:", JSON.stringify(body));
  if (!body.ok || !body.userId || body.role !== "buyer") failures.push("Сервер не вернул userId/role: " + JSON.stringify(body));
  if (body.needConfirm !== false) failures.push("needConfirm должен быть false в dev-режиме");

  /* 4. Редирект на /profile без кликов */
  await page.waitForURL(/#\/profile/, { timeout: 10000 }).catch(() => failures.push("Не произошёл редирект на /profile после регистрации"));

  /* 5. Имя пользователя отображается в кабинете (приветствие «Здравствуйте, <имя>!») */
  const hello = await page.locator(`text=Здравствуйте, ${NAME.split(" ")[0]}`).count();
  if (hello === 0) failures.push("Имя «" + NAME + "» не отображается после автологина");

  /* 6. Состояние store через window-хук zustand или localStorage persist */
  const state = await page.evaluate(() => {
    const keys = Object.keys(localStorage);
    for (const k of keys) {
      try {
        const v = JSON.parse(localStorage.getItem(k) || "");
        const s = v && v.state;
        if (s && (s.user || s.activeUser || s.session)) return { key: k, user: s.user || s.activeUser || s.session };
      } catch {}
    }
    return null;
  });
  console.log("STORE USER:", JSON.stringify(state));
  if (state && state.user && state.user.name !== NAME) failures.push("В store имя не совпадает: " + state.user.name);
} catch (e) {
  failures.push("EXCEPTION: " + e.message);
}

/* 7. Дубль email → понятная ошибка exists */
try {
  const p2 = await ctx.newPage();
  await p2.goto(BASE + "/#/auth?mode=register", { waitUntil: "networkidle" });
  await p2.waitForSelector("text=Создайте аккаунт", { timeout: 10000 });
  await p2.fill('input[placeholder="Анна"]', NAME);
  await p2.fill('input[type="email"]', email);
  await p2.fill('input[autocomplete="new-password"]', "superpass123");
  await p2.check('input[type="checkbox"]');
  await p2.click('button:has-text("Зарегистрироваться")');
  await p2.waitForSelector("text=уже зарегистрирован", { timeout: 10000 }).catch(() =>
    failures.push("Не показано сообщение «уже зарегистрирован» для дубля email"));
  await p2.close();
} catch (e) {
  failures.push("EXCEPTION (exists): " + e.message);
}

/* 8. Регистрация продавца → автологин в /seller/dashboard */
try {
  const p3 = await ctx.newPage();
  const selEmail = "e2e-seller-" + Date.now() + "@test.ru";
  /* напрямую через API + проверка клиента невозможна (у продавца мастер-виджет),
     поэтому проверяем серверный контракт: role seller возвращается */
  const r = await p3.evaluate(async (em) => {
    const res = await fetch(location.origin + "/api/auth/register", {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ name: "Продавец E2E", email: em, password: "superpass123", role: "seller", legalType: "ip" }),
    });
    return res.json();
  }, selEmail);
  console.log("SELLER REGISTER RESPONSE:", JSON.stringify(r));
  if (!r.ok || r.role !== "seller" || !r.userId) failures.push("Сервер не вернул роль seller/userId: " + JSON.stringify(r));
  await p3.close();
} catch (e) {
  failures.push("EXCEPTION (seller): " + e.message);
}

await browser.close();

if (failures.length) {
  console.error("\n❌ FAILURES:\n" + failures.map((f) => " - " + f).join("\n"));
  process.exit(1);
} else {
  console.log("\n✅ ALL E2E CHECKS PASSED");
}
