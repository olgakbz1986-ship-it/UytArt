/* Quantiform Доставка — единый слой логистики (Фаза 1).
   Платформа = комфорт + фиксация данных. Не участник сделки. */

const FLOW = ["created","label_ready","shipped","in_transit","at_point","delivered","closed"];
const NEXT = { created:"label_ready", label_ready:"shipped", shipped:"in_transit", in_transit:"at_point", at_point:"delivered", delivered:"closed" };
const LABELS = { created:"Заявка создана", label_ready:"Этикетка готова", shipped:"Передана в доставку", in_transit:"В пути", at_point:"На пункте выдачи", delivered:"Получена", closed:"Сделка закрыта", return_requested:"Возврат запрошен" };

function now(){ return new Date().toISOString(); }
function uid(p){ return p + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

function journal(sh, actor, actorId, action, from, to, meta){
  sh.journal.push({ ts: now(), actor, actorId: String(actorId||""), action, from: from||null, to: to||null, meta: meta||null });
}

/* Эскроу — технический шлюз, не ответственность платформы. */
function settleEscrow(db){
  const t = Date.now();
  (db.shipments||[]).forEach(sh => {
    const e = sh.escrow;
    if (e && e.state === "held" && e.releaseAt && t >= Date.parse(e.releaseAt)) {
      e.state = "released"; e.releasedAt = now();
      journal(sh, "system", "", "escrow_auto_release", null, null, { reason: "timer" });
    }
  });
}

/* Минимальный валидный PDF (этикетка MockAdapter). */
function translit(s){
  const m = {"а":"a","б":"b","в":"v","г":"g","д":"d","е":"e","ё":"e","ж":"zh","з":"z","и":"i","й":"y","к":"k","л":"l","м":"m","н":"n","о":"o","п":"p","р":"r","с":"s","т":"t","у":"u","ф":"f","х":"h","ц":"ts","ч":"ch","ш":"sh","щ":"sch","ъ":"","ы":"y","ь":"","э":"e","ю":"yu","я":"ya"};
  return String(s||"").split("").map(c => { const l=c.toLowerCase(); const r=m[l]!==undefined?m[l]:c; return c===l?r:r.toUpperCase(); }).join("");
}
function buildLabelPdf(sh){
  const lines = [
    "QUANTIFORM DELIVERY",
    "TRACK: " + sh.trackingNumber,
    "SERVICE: " + sh.carrier.toUpperCase(),
    "TO: " + translit(sh.buyerName) + "  " + sh.buyerPhone,
    "ADDR: " + translit(sh.buyerAddress),
    "ORDER: " + sh.orderId,
    "STATUS: " + sh.status
  ];
  let content = "BT /F1 12 Tf 50 780 Td 16 TL\n";
  lines.forEach(l => { content += "(" + l.replace(/[()\\]/g, "") + ") Tj T*\n"; });
  content += "ET";
  const objs = [];
  objs[1] = "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n";
  objs[2] = "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n";
  objs[3] = "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj\n";
  objs[4] = "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n";
  objs[5] = "5 0 obj << /Length " + content.length + " >> stream\n" + content + "\nendstream endobj\n";
  let pdf = "%PDF-1.4\n"; const offsets = [0];
  for (let i=1;i<objs.length;i++){ offsets[i] = pdf.length; pdf += objs[i]; }
  const xref = pdf.length;
  pdf += "xref\n0 " + objs.length + "\n0000000000 65535 f \n";
  for (let i=1;i<objs.length;i++) pdf += String(offsets[i]).padStart(10,"0") + " 00000 n \n";
  pdf += "trailer << /Size " + objs.length + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF";
  return Buffer.from(pdf, "binary");
}

/* CarrierAdapter contract + MockAdapter (без ключей). */
const MockAdapter = {
  id: "mock",
  calculate(){ return { price: 350, days: "2-4", options: ["pvz","courier","post"] }; },
  createShipment(sh){ sh.trackingNumber = "QF" + Date.now().toString().slice(-10); return sh; },
  getLabel(sh){ return buildLabelPdf(sh); },
  nextStatus(sh){ return NEXT[sh.status] || null; }
};
const ADAPTERS = { mock: MockAdapter };

function register(app, getDb, guard){
  const db = getDb();
  if (!db.shipments) db.shipments = [];

  function ownShop(req, shopId){
    const s = (db.shops||[]).find(x => String(x.id) === String(shopId));
    return s && String(s.accountId) === String(req.userId) ? s : null;
  }
  function findSh(req, res){
    const sh = (db.shipments||[]).find(x => x.id === req.params.id);
    if (!sh) { res.status(404).json({ error: "Отправление не найдено." }); return null; }
    const isSeller = ownShop(req, sh.shopId);
    const isBuyer = String(sh.buyerId) === String(req.userId);
    if (!isSeller && !isBuyer) { res.status(403).json({ error: "Нет доступа к этому отправлению." }); return null; }
    return { sh, isSeller, isBuyer };
  }

  /* Создать отправление из заявки на доставку (продавец). */
  app.post("/api/shipments", guard, (req, res) => {
    const { requestId } = req.body || {};
    const rq = (db.deliveryRequests||[]).find(x => x.id === requestId);
    if (!rq) return res.status(404).json({ error: "Заявка на доставку не найдена." });
    if (!ownShop(req, rq.shopId)) return res.status(403).json({ error: "Эта заявка принадлежит другому магазину." });
    if (rq.shipmentId) return res.status(409).json({ error: "Отправление по этой заявке уже создано." });
    const sh = {
      id: uid("sh"), requestId: rq.id, orderId: rq.orderId, shopId: rq.shopId,
      buyerId: rq.buyerId || "", buyerName: rq.buyerName, buyerPhone: rq.buyerPhone, buyerAddress: rq.buyerAddress,
      carrier: "mock", trackingNumber: "", status: "created", issue: false,
      itemsSummary: rq.itemsSummary, totalPrice: rq.totalPrice,
      storageUntil: null, createdAt: now(), updatedAt: now(),
      escrow: { state: "held", heldAt: now(), releaseAt: null, frozenAt: null, releasedAt: null },
      journal: []
    };
    MockAdapter.createShipment(sh);
    journal(sh, "seller", req.userId, "shipment_created", null, "created", { carrier: "mock" });
    db.shipments.push(sh);
    rq.shipmentId = sh.id;
    res.json({ ok: true, shipment: sh });
  });

  /* Список: продавец — свои, покупатель — свои. */
  app.get("/api/shipments", guard, (req, res) => {
    settleEscrow(db);
    const role = req.query.role === "buyer" ? "buyer" : "seller";
    let list;
    if (role === "buyer") list = db.shipments.filter(x => String(x.buyerId) === String(req.userId));
    else {
      const ids = (db.shops||[]).filter(s => String(s.accountId) === String(req.userId)).map(s => String(s.id));
      list = db.shipments.filter(x => ids.includes(String(x.shopId)));
    }
    list = list.slice().sort((a,b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    res.json({ ok: true, shipments: list, labels: LABELS, flow: FLOW });
  });

  /* Деталь + журнал. */
  app.get("/api/shipments/:id", guard, (req, res) => {
    settleEscrow(db);
    const f = findSh(req, res); if (!f) return;
    res.json({ ok: true, shipment: f.sh, labels: LABELS, flow: FLOW });
  });

  /* Этикетка PDF (продавец). */
  app.get("/api/shipments/:id/label", guard, (req, res) => {
    const f = findSh(req, res); if (!f) return;
    if (!f.isSeller) return res.status(403).json({ error: "Этикетка доступна только продавцу." });
    const pdf = ADAPTERS[f.sh.carrier].getLabel(f.sh);
    if (f.sh.status === "created") { const to = NEXT[f.sh.status]; journal(f.sh,"seller",req.userId,"label_printed",f.sh.status,to); f.sh.status = to; f.sh.updatedAt = now(); }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=label-" + f.sh.trackingNumber + ".pdf");
    res.send(pdf);
  });

  /* Mock-перевозчик: следующий статус (продавец). */
  app.post("/api/shipments/:id/advance", guard, (req, res) => {
    const f = findSh(req, res); if (!f) return;
    if (!f.isSeller) return res.status(403).json({ error: "Управлять перевозчиком может только продавец." });
    const to = ADAPTERS[f.sh.carrier].nextStatus(f.sh);
    if (!to || f.sh.status === "at_point") return res.status(409).json({ error: "Дальнейшее движение подтверждает покупатель." });
    const from = f.sh.status;
    f.sh.status = to; f.sh.updatedAt = now();
    if (to === "at_point") { const d = new Date(); d.setDate(d.getDate()+7); f.sh.storageUntil = d.toISOString(); }
    journal(f.sh, "carrier", f.sh.carrier, "status_advanced", from, to);
    res.json({ ok: true, shipment: f.sh });
  });

  /* Покупатель подтверждает получение -> delivered -> closed + escrow release. */
  app.post("/api/shipments/:id/confirm", guard, (req, res) => {
    const f = findSh(req, res); if (!f) return;
    if (!f.isBuyer) return res.status(403).json({ error: "Подтвердить получение может только покупатель." });
    if (f.sh.status !== "at_point") return res.status(409).json({ error: "Подтверждение доступно, когда посылка на пункте выдачи." });
    const from = f.sh.status;
    f.sh.status = "delivered"; journal(f.sh,"buyer",req.userId,"receipt_confirmed",from,"delivered");
    f.sh.status = "closed"; journal(f.sh,"system","","deal_closed","delivered","closed");
    if (f.sh.escrow.state === "held") { f.sh.escrow.state = "released"; f.sh.escrow.releasedAt = now(); journal(f.sh,"system","","escrow_released",null,null,{ reason:"confirm" }); }
    f.sh.updatedAt = now();
    res.json({ ok: true, shipment: f.sh });
  });

  /* Жалоба -> фиксация данных + freeze эскроу (модерация по данным). */
  app.post("/api/shipments/:id/complaint", guard, (req, res) => {
    const f = findSh(req, res); if (!f) return;
    const text = String((req.body||{}).text || "").trim();
    if (!text) return res.status(400).json({ error: "Опишите суть жалобы — данные фиксируются в журнале." });
    f.sh.issue = true;
    if (f.sh.escrow.state === "held") { f.sh.escrow.state = "frozen"; f.sh.escrow.frozenAt = now(); }
    journal(f.sh, f.isBuyer?"buyer":"seller", req.userId, "complaint_filed", null, null, { text });
    f.sh.updatedAt = now();
    res.json({ ok: true, shipment: f.sh });
  });

  /* Возврат (покупатель, 7 дней после получения). */
  app.post("/api/shipments/:id/return", guard, (req, res) => {
    const f = findSh(req, res); if (!f) return;
    if (!f.isBuyer) return res.status(403).json({ error: "Возврат оформляет покупатель." });
    if (!["delivered","closed"].includes(f.sh.status)) return res.status(409).json({ error: "Возврат доступен после получения." });
    const from = f.sh.status;
    f.sh.status = "return_requested"; journal(f.sh,"buyer",req.userId,"return_requested",from,"return_requested");
    f.sh.updatedAt = now();
    res.json({ ok: true, shipment: f.sh });
  });
}

module.exports = { register, FLOW, NEXT, LABELS };
