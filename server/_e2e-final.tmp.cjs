/* Финальный E2E: sweep-таймаут + POST отзыва по сделке (через экспортируемую escrowTimeoutSweep и живой HTTP) */
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

process.env.JWT_SECRET = "dev-only." + crypto.createHash("sha256").update("quantiform-dev-jwt-stub").digest("hex");
process.env.PORT = "8811";

const FILE = path.resolve(__dirname, "dev-db.json");
const mod = require("/workspace/server/index.cjs");

setTimeout(async () => {
  const token = jwt.sign({ sub: "e2e-buyer", scope: "user", typ: "access" }, process.env.JWT_SECRET, { expiresIn: 300 });
  const H = { Authorization: "Bearer " + token, "Content-Type": "application/json" };
  let fails = 0;
  const ok = (name, cond, extra) => { console.log((cond ? "PASS" : "FAIL") + " | " + name + (extra ? " | " + extra : "")); if (!cond) fails++; };

  // 1. POST отзыв по завершённой финансово сделке (покупатель e2e-buyer)
  let r = await fetch("http://127.0.0.1:8811/api/market/orders/rev-final-1/reviews", { method: "POST", headers: H, body: JSON.stringify({ rating: 5, text: "Отличная работа, всё по срокам!" }) });
  let j = await r.json();
  ok("POST review 200", r.status === 200, "status=" + r.status);
  ok("review привязан к товару sp-p-kursk", j.review && j.review.product_id === "sp-p-kursk", j.review && String(j.review.product_id));
  ok("reviewee = мастер сделки", j.review && j.review.reviewee_id === "sweep-master");

  // 2. Дубль-отзыв той же стороны -> 409 already_reviewed (антинакрутка)
  r = await fetch("http://127.0.0.1:8811/api/market/orders/rev-final-1/reviews", { method: "POST", headers: H, body: JSON.stringify({ rating: 1, text: "дубль" }) });
  j = await r.json();
  ok("дубль отзыва -> 409 already_reviewed", r.status === 409 && j.error === "already_reviewed", "status=" + r.status);

  // 3. Чужой пользователь не из сделки -> 403
  const alienToken = jwt.sign({ sub: "alien-user", scope: "user", typ: "access" }, process.env.JWT_SECRET, { expiresIn: 300 });
  r = await fetch("http://127.0.0.1:8811/api/market/orders/rev-final-1/reviews", { method: "POST", headers: { ...H, Authorization: "Bearer " + alienToken }, body: JSON.stringify({ rating: 5, text: "накрутка" }) });
  j = await r.json();
  ok("чужой -> 403 not_participant", r.status === 403 && j.error === "not_participant", "status=" + r.status);

  // 4. Агрегация в карточку товара
  r = await fetch("http://127.0.0.1:8811/api/products/p-kursk/reviews");
  j = await r.json();
  ok("GET product reviews содержит новый отзыв", j.ok && j.reviews.some((x) => x.order_id === "rev-final-1"), "count=" + j.count + " avg=" + j.avgRating);

  // 5. Агрегация в профиль мастера
  r = await fetch("http://127.0.0.1:8811/api/market/users/sweep-master/reviews");
  j = await r.json();
  ok("GET user reviews (сделочный отзыв)", j.ok && j.reviews.some((x) => x.order_id === "rev-final-1"));

  // 6. SWEEP: held + просроченный expires_at -> released/settled (прямой вызов экспортированной функции)
  await mod.escrowTimeoutSweep();
  const d = JSON.parse(fs.readFileSync(FILE, "utf8"));
  const sw = d.custom_orders.find((o) => o.id === "sweep-final-1");
  ok("sweep: escrow released", sw.deal.escrow === "released", "escrow=" + sw.deal.escrow);
  ok("sweep: status settled", sw.deal.status === "settled");
  ok("sweep: reason timeout_no_disputes", sw.deal.release_reason === "timeout_no_disputes");
  const nMaster = d.notifications.filter((n) => n.user_id === "sweep-master" && n.type === "escrow_released").length;
  const nBuyer = d.notifications.filter((n) => n.user_id === "e2e-buyer" && n.type === "escrow_released").length;
  ok("sweep: уведомление мастеру ровно 1", nMaster === 1, "n=" + nMaster);
  ok("sweep: уведомление покупателю ровно 1", nBuyer === 1, "n=" + nBuyer);

  // 7. Идемпотентность: повторный sweep не создаёт дублей
  await mod.escrowTimeoutSweep();
  const d2 = JSON.parse(fs.readFileSync(FILE, "utf8"));
  const n2 = d2.notifications.filter((n) => n.type === "escrow_released").length;
  ok("sweep идемпотентен (тот же счётчик)", n2 === nMaster + nBuyer, "total=" + n2);

  // 8. Спор замораживает выпуск
  d2.custom_orders.push({ id: "sweep-frozen-1", user_id: "e2e-buyer", title: "frozen", status: "in_progress",
    deal: { status: "prepaid", escrow: "held", prepay_amount: 7000, master_id: "sweep-master", paid_at: new Date().toISOString(), expires_at: new Date(Date.now() - 3600_000).toISOString() } });
  d2.complaints = d2.complaints || [];
  d2.complaints.push({ id: "cmp-frozen-1", order_id: "sweep-frozen-1", status: "open", created_at: new Date().toISOString() });
  fs.writeFileSync(FILE, JSON.stringify(d2, null, 2));
  await mod.escrowTimeoutSweep();
  const d3 = JSON.parse(fs.readFileSync(FILE, "utf8"));
  const fz = d3.custom_orders.find((o) => o.id === "sweep-frozen-1");
  ok("спор -> escrow остаётся held", fz.deal.escrow === "held", "escrow=" + fz.deal.escrow);

  console.log(fails === 0 ? "\nALL_E2E_PASS" : "\nE2E_FAILURES=" + fails);
  process.exit(fails === 0 ? 0 : 1);
}, 1200);
