/* ПАТЧ «ЛЕГЕНДА-14b»: перенос когортной аналитики на правильное место */
const fs = require("fs");
const NL = String.fromCharCode(10);
const E = "src/pages/extras.tsx";
let s = fs.readFileSync(E, "utf8");

/* 1. Вырезать неудачно вставленный блок (он начинается с уникального маркера) */
const marker = "Когортная аналитика";
if (!s.includes(marker)) { console.log("SKIP: блок не найден (уже перенесён?)"); }
else {
  const start = s.indexOf("          {lvl === 4 && (" + NL, s.indexOf(marker) - 200 > 0 ? s.indexOf(marker) - 200 : 0);
  const realStart = s.lastIndexOf("          {lvl === 4 && (", s.indexOf(marker));
  const endMarker = "          )}" + NL;
  const end = s.indexOf(endMarker, realStart) + endMarker.length;
  if (realStart < 0 || end <= endMarker.length - 1) { console.log("FAIL: не нашла границы блока"); process.exitCode = 2; }
  else {
    s = s.slice(0, realStart) + s.slice(end);
    console.log("OK  : misplaced-блок вырезан");
  }
}

/* 2. Вставить блок после строки «Прогнозы продаж» в карточке возможностей */
if (!s.includes(marker)) {
  const anchor = "Прогнозы продаж</p>";
  const a = s.indexOf(anchor);
  if (a < 0) { console.log("FAIL: якорь «Прогнозы продаж» не найден"); process.exitCode = 2; }
  else {
    const ins = NL +
'          {lvl === 4 && (' + NL +
'            <div className="mt-3 p-5 bg-[#f9f7ff] border border-[#e6d9ff] rounded-xl">' + NL +
'              <p className="font-display font-bold text-[15px] mb-1" style={{ color: "#5b3fa8" }}>Когортная аналитика</p>' + NL +
'              <p className="text-[12.5px] text-ink-soft mb-3">Возвращаемость покупателей по неделям</p>' + NL +
'              <div className="grid grid-cols-3 gap-3">' + NL +
'                {[["Неделя 1", "37%"], ["Неделя 2", "29%"], ["Неделя 3", "42%"]].map(([w, v]) => (' + NL +
'                  <div key={w} className="p-3 bg-white border border-line-soft rounded-lg">' + NL +
'                    <p className="text-ink-mute text-[11px]">{w}</p>' + NL +
'                    <p className="font-bold text-ink text-[15px]">{v}</p>' + NL +
'                  </div>' + NL +
'                ))}' + NL +
'              </div>' + NL +
'              <p className="mt-3 text-[11px] italic text-ink-mute">Демо-данные · реальный расчёт подключим к заказам</p>' + NL +
'            </div>' + NL +
'          )}';
    s = s.slice(0, a + anchor.length) + ins + s.slice(a + anchor.length);
    fs.writeFileSync(E, s);
    console.log("OK  : блок вставлен в карточку возможностей (после «Прогнозы продаж»)");
  }
} else {
  fs.writeFileSync(E, s);
}

console.log("=== Патч ЛЕГЕНДА-14b завершён ===");
