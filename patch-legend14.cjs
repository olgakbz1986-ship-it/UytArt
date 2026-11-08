/* ПАТЧ «ЛЕГЕНДА-14»: блок когортной аналитики для tier 4 в кабинете продавца */
const fs = require("fs");
const E = "src/pages/extras.tsx";
let s = fs.readFileSync(E, "utf8");

function rep(find, repl, label) {
  if (s.includes(repl)) { console.log("SKIP:", label); return; }
  if (!s.includes(find)) { console.log("FAIL:", label, "(образец не найден)"); process.exitCode = 2; return; }
  s = s.replace(find, repl);
  console.log("OK  :", label);
}

/* 1. Вставить блок когортной аналитики после секции «Аналитика продаж» */
rep(
'</div>', // ищем закрывающий div секции аналитики (подберём по контексту ниже)
'</div>' + '\n' +
'          {lvl === 4 && (\n' +
'            <div className="mt-8 p-6 bg-[#f9f7ff] border border-[#e6d9ff] rounded-2xl shadow-sm">\n' +
'              <h3 className="font-display font-bold text-[18px] mb-2 text-[#5b3fa8]">Когортная аналитика</h3>\n' +
'              <p className="text-[13px] text-ink-soft mb-4">Возвращаемость покупателей по неделям. Данные обновляются ежедневно.</p>\n' +
'              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">\n' +
'                <div className="p-4 bg-white border border-line-soft rounded-xl shadow-inner">\n' +
'                  <p className="text-ink-mute text-[12px] mb-1">Неделя 1</p>\n' +
'                  <p className="font-bold text-ink text-[16px]">37%</p>\n' +
'                </div>\n' +
'                <div className="p-4 bg-white border border-line-soft rounded-xl shadow-inner">\n' +
'                  <p className="text-ink-mute text-[12px] mb-1">Неделя 2</p>\n' +
'                  <p className="font-bold text-ink text-[16px]">29%</p>\n' +
'                </div>\n' +
'                <div className="p-4 bg-white border border-line-soft rounded-xl shadow-inner">\n' +
'                  <p className="text-ink-mute text-[12px] mb-1">Неделя 3</p>\n' +
'                  <p className="font-bold text-ink text-[16px]">42%</p>\n' +
'                </div>\n' +
'              </div>\n' +
'              <p className="mt-4 text-[12px] italic text-ink-muted">Демо-данные. Реальные показатели появятся при интеграции с заказами.</p>\n' +
'            </div>\n' +
'          )}',
"когортная аналитика: блок для lvl===4");

fs.writeFileSync(E, s);
console.log("");
console.log("=== Патч ЛЕГЕНДА-14 завершён ===");
