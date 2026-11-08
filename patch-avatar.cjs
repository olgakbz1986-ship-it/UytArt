/* ДОПАТЧ: скрытие аватара мастера для ООО (гибкий поиск по пробелам) */
const fs = require("fs");
const rx = (t) => new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"));
function rpatch(file, find, repl, label) {
  let src;
  try { src = fs.readFileSync(file, "utf8"); }
  catch (e) { console.log("FAIL:", label, "(файл не найден)"); process.exit(2); }
  if (rx(repl).test(src)) { console.log("SKIP:", label); return; }
  const re = rx(find);
  if (!re.test(src)) { console.log("FAIL:", label); process.exit(2); }
  fs.writeFileSync(file, src.replace(re, repl));
  console.log("OK  :", label);
}

rpatch("src/pages/extras.tsx",
`</div> <div> <p className="text-[12.5px] font-semibold text-ink mb-1.5">Аватар мастера`,
`</div> {s.legalType !== "ooo" && (<div> <p className="text-[12.5px] font-semibold text-ink mb-1.5">Аватар мастера`,
"аватар: открытие условия");

rpatch("src/pages/extras.tsx",
`{s.masterAvatar && <img src={s.masterAvatar} alt="Аватар" className="w-14 h-14 rounded-[12px] object-cover mt-2" />} </div>`,
`{s.masterAvatar && <img src={s.masterAvatar} alt="Аватар" className="w-14 h-14 rounded-[12px] object-cover mt-2" />} </div> )}`,
"аватар: закрытие условия");
