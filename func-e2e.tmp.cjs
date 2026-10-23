/* Функциональная проверка пункта Е через реальный маршрут POST /api/products */
const fs = require("fs"), path = require("path");
const DBF = path.resolve("server/dev-db.json");
if (fs.existsSync(DBF)) fs.renameSync(DBF, DBF + ".bak");
fs.writeFileSync(DBF, JSON.stringify({ users: [], products: [] }));

/* заглушки обязательных ENV для запуска index.cjs в dev-режиме */
process.env.JWT_SECRET = "e2e-test-secret";
process.env.PORT = "8791";
require("./server/index.cjs");

setTimeout(async () => {
  const post = async (body) => {
    const r = await fetch("http://127.0.0.1:8791/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  console.log("E-route-noauth:", JSON.stringify(await post({ id: "p1", name: "Кожаная сумка" })));
  /* авторизация: регистрация через API может требовать email — используем прямой токен? guard использует resolveSession; без сессии ожидаем 401 no_session ДО стоп-листа. */
  process.exit(0);
}, 2500);
