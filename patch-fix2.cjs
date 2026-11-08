/* ДОПАТЧ: чиним два фрагмента, не применившиеся с первого раза */
const fs = require("fs");
const fails = [];
function patch(file, find, repl, label) {
  let src;
  try { src = fs.readFileSync(file, "utf8"); }
  catch (e) { fails.push(label + " (файл не найден)"); return; }
  if (src.includes(repl)) { console.log("SKIP:", label); return; }
  if (!src.includes(find)) { fails.push(label); return; }
  fs.writeFileSync(file, src.replace(find, repl));
  console.log("OK  :", label);
}

/* 1. Объявление legal_info в index.cjs — привязка к строке token */
patch("server/index.cjs",
"const token = crypto.randomUUID();",
`/* Реквизиты продавца: сохраняем только для роли seller. Только цифры,
   с ограничением длины — защита от мусора в dev-db (аудит регистрации). */
const rawLi = req.body.legalInfo || {};
const legal_info = role === "seller" ? {
  inn: String(rawLi.inn || "").replace(/\\D/g, "").slice(0, 12),
  ogrn: String(rawLi.ogrn || "").replace(/\\D/g, "").slice(0, 15),
  kpp: String(rawLi.kpp || "").replace(/\\D/g, "").slice(0, 9),
  bankDetails: String(rawLi.bankDetails || "").trim().slice(0, 300),
} : null;
const token = crypto.randomUUID();`,
"index.cjs: объявление legal_info перед token");

/* 2. Отправка реквизитов в finish() — привязка к хвосту вызова */
patch("src/pages/extras.tsx",
'legalType: s.legalType || "self_employed" })',
'legalType: s.legalType || "self_employed", legalInfo: { inn: s.inn, ogrn: s.ogrn || "", kpp: s.kpp || "", bankDetails: s.bankAccount || "" } })',
"extras.tsx: отправка legalInfo на сервер");

if (fails.length) { console.log("\nНЕ НАЙДЕНО:"); fails.forEach((f) => console.log("  -", f)); process.exit(2); }
console.log("\nДопатч применён успешно.");
