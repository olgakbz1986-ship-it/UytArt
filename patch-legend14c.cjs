/* ПАТЧ «ЛЕГЕНДА-14c»: перенос когортной аналитики (устойчив к CRLF) */
const fs = require("fs");
const E = "src/pages/extras.tsx";
let s = fs.readFileSync(E, "utf8");

/* 1. Вырезать misplaced-блок: от {lvl === 4 && ( до первой )} после демо-подписи */
const m = s.indexOf("Когортная аналитика");
if (m < 0) {
  console.log("SKIP: misplaced-блок не найден (уже вырезан)");
} else {
  const start = s.lastIndexOf("{lvl === 4 && (", m);
  const demoTail = s.indexOf("интеграции с заказами", m);
  if (start < 0 || demoTail < 0) { console.log("FAIL: не нашла якоря блока"); process.exitCode = 2; }
  else {
    const end = s.indexOf(")}", demoTail) + 2;
    if (end < 2) { console.log("FAIL: не нашла закрывающую )}"); process.exitCode = 2; }
    else {
      s = s.slice(0, start) + s.slice(end);
      console.log("OK  : misplaced-блок вырезан (байты " + start + "..." + end + ")");
      fs.writeFileSync(E, s);
    }
  }
}

/* 2. Вставить блок в карточку возможностей после «Прогнозы продаж» */
s = fs.readFileSync(E, "utf8");
if (s.includes("Когортная аналитика")) {
  console.log("SKIP: блок уже на месте");
} else {
  const anchor = "Прогнозы продаж</p>";
  const a = s.indexOf(anchor);
  if (a < 0) { console.log("FAIL: якорь «Прогнозы продаж» не найден"); process.exitCode = 2; }
  else {
    const ins =
'          {lvl === 4 && (' +
'            <div className="mt-3 p-5 bg-[#f9f7ff] border border-[#e6d9ff] rounded-xl">' +
'              <p className="font-display font-bold text-[15px] mb-1" style={{ color: "#5b3fa8" }}>Когортная аналитика</p>' +
'              <p className="text-[12.5px] text-ink-soft mb-3">Возвращаемость покупателей по неделям</p>' +
'              <div className="grid grid-cols-3 gap-3">' +
'                {[["Неделя 1", "37%"], ["Неделя 2", "29%"], ["Неделя 3", "42%"]].map(([w, v]) => (' +
'                  <div key={w} className="p-3 bg-white border border-line-soft rounded-lg">' +
'                    <p className="text-ink-mute text-[11px]">{w}</p>' +
'                    <p className="font-bold text-ink text-[15px]">{v}</p>' +
'                  </div>' +
'                ))}' +
'              </div>' +
'              <p className="mt-3 text-[11px] italic text-ink-mute">Демо-данные · реальный расчёт подключим к заказам</p>' +
'            </div>' +
'          )}';
    s = s.slice(0, a + anchor.length) + ins + s.slice(a + anchor.length);
    fs.writeFileSync(E, s);
    console.log("OK  : блок вставлен в карточку возможностей (после «Прогнозы продаж»)");
  }
}

/* 3. Контроль: маркер встречается ровно один раз */
const cnt = s.split("Когортная аналитика").length - 1;
console.log("контроль: вхождений «Когортная аналитика» =", cnt);
console.log("=== Патч ЛЕГЕНДА-14c завершён ===");
