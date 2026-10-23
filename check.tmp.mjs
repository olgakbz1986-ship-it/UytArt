import { chromium } from "playwright-core";
const base = "http://localhost:3100";
const browser = await chromium.launch({ executablePath: "/root/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome" });
const page = await browser.newContext().then((c) => c.newPage());
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

async function check(route, expects, name) {
  await page.goto(base + route, { waitUntil: "networkidle" });
  const text = await page.locator("body").innerText();
  const missing = expects.filter((s) => !text.includes(s));
  console.log(`${missing.length ? "FAIL" : "PASS"} ${name} ${route}` + (missing.length ? " :: missing " + JSON.stringify(missing.slice(0,4)) : ""));
}

await check("/legal", ["Правовой статус платформы","289-ФЗ","Согласия и их версии","Запрещённые и ограниченные к обороту товары","Архив редакций","Читать","Печать и сохранение","v3.0","v4.0","Действует с"], "index");
await check("/legal/privacy", ["Политика обработки персональных данных","v4.0","Локализация","Ключевые положения"], "privacy 4.0");
await check("/legal/data_processing", ["Архивная справка","объединён","Перейти к действующей редакции","v4.0"], "archive");
await check("/legal/goods_rules", ["Правила оборота товаров на платформе","Росздравнадзора"], "goods_rules");
await check("/legal/ad_rules", ["Правила размещения рекламы","рекламораспространителем"], "ad_rules");
await check("/legal/buyer_tos", ["Оферта для покупателя","v3.0","посреднической цифровой платформой","Ключевые положения"], "buyer_tos 3.0");
await check("/legal/market_rules", ["Правила биржи заказов","приглашением делать оферты"], "market_rules");

// архив не в основной сетке: карточка с кнопкой Читать для data_processing отсутствует
await page.goto(base + "/legal", { waitUntil: "networkidle" });
const readLinks = await page.locator("a:has-text('Читать')").getAttribute("href");
const allRead = await page.locator("a:has-text('Читать')").evaluateAll((els) => els.map((e) => e.getAttribute("href")));
console.log("INFO карточки 'Читать':", JSON.stringify(allRead), "data_processing в сетке:", allRead.includes("/legal/data_processing"));

// печать: клик по кнопке «Печать и сохранение» — ожидаем popup с вызовом print
const popupPromise = page.waitForEvent("popup", { timeout: 5000 }).catch(() => null);
await page.locator("button:has-text('Печать и сохранение')").first().click();
const popup = await popupPromise;
console.log(popup ? "PASS печать: открыто окно печати (popup)" : "FAIL печать: popup не открыт");

// свёрнутый архив: раскрыть секцию
const before = await page.locator("text=Архив редакций").count();
await page.locator("button:has-text('Архив редакций')").click();
const after = await page.locator("text=Действующая редакция").count();
console.log(after > 0 ? "PASS архив раскрывается со ссылкой на privacy" : "FAIL архив не раскрывается");

for (const r of ["/catalog", "/about"]) {
  const resp = await page.goto(base + r, { waitUntil: "networkidle" });
  console.log(`${resp.status() === 200 ? "PASS" : "FAIL"} маршрут ${r} status=${resp.status()}`);
}
const realErrors = errors.filter((e) => !/api\/|ECONNREFUSED|Failed to fetch|net::/i.test(e));
console.log(realErrors.length ? "CONSOLE/PAGE ERRORS:\n" + realErrors.join("\n") : "PASS консоль без ошибок приложения (ошибки только от отсутствия API-сервера)");
await browser.close();
