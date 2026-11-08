/* ПАТЧ: «О мастере»/«О бизнесе»/«О компании» по типу юрлица + тип api.register */
const fs = require("fs");
const fails = [];
function patch(file, find, repl, label, skipMarker) {
  let src;
  try { src = fs.readFileSync(file, "utf8"); }
  catch (e) { fails.push(label + " (файл не найден)"); return; }
  if (skipMarker && src.includes(skipMarker)) { console.log("SKIP:", label); return; }
  if (!src.includes(find)) { fails.push(label); return; }
  fs.writeFileSync(file, src.replace(find, repl));
  console.log("OK  :", label);
}

/* 0. api.register: расширяем тип — иначе TS может ругаться на legalInfo */
patch("src/lib/api.ts",
"register: (p: { name: string; email: string; password: string; role?: string; legalType?: string;",
"register: (p: { name: string; email: string; password: string; role?: string; legalType?: string; legalInfo?: { inn?: string; ogrn?: string; kpp?: string; bankDetails?: string };",
"api.ts: тип register + legalInfo",
"legalInfo?: { inn?: string; ogrn?: string; kpp?: string; bankDetails?: string };");

/* 1. Заголовок блока: О мастере / О бизнесе / О компании */
patch("src/pages/extras.tsx",
'<p className="font-display font-bold text-[16px] text-ink mb-1">О мастере</p>',
'<p className="font-display font-bold text-[16px] text-ink mb-1">{s.legalType === "ooo" ? "О компании" : s.legalType === "ip" ? "О бизнесе" : "О мастере"}</p>',
"extras.tsx: заголовок блока по типу",
'О компании" : s.legalType === "ip"');

/* 2. Подпись блока */
patch("src/pages/extras.tsx",
'<p className="text-[12px] text-ink-mute mb-4">Расскажите о становлении бизнеса — это повышает доверие покупателей. Сервис распределит вас по категориям.</p>',
'<p className="text-[12px] text-ink-mute mb-4">{s.legalType === "ooo" ? "Расскажите о компании — это повышает доверие покупателей. Сервис распределит вас по категориям." : "Расскажите о становлении бизнеса — это повышает доверие покупателей. Сервис распределит вас по категориям."}</p>',
"extras.tsx: подпись блока по типу",
'Расскажите о компании');

/* 3. Поле «Лет опыта» → «Лет на рынке» для ИП и ООО */
patch("src/pages/extras.tsx",
'<Field label="Лет опыта"><input className="field" value={s.yearsExperience} onChange={(e) => s.setInfo({ yearsExperience: e.target.value })} placeholder="7" /></Field>',
'<Field label={s.legalType === "ooo" || s.legalType === "ip" ? "Лет на рынке" : "Лет опыта"}><input className="field" value={s.yearsExperience} onChange={(e) => s.setInfo({ yearsExperience: e.target.value })} placeholder="7" /></Field>',
"extras.tsx: лейбл опыта по типу",
'Лет на рынке" : "Лет опыта"');

/* 4. Достижения → «Достижения компании» для ООО */
patch("src/pages/extras.tsx",
'<Field label="Достижения"><input className="field" value={s.achievements} onChange={(e) => s.setInfo({ achievements: e.target.value })} placeholder="Ярмарки, конкурсы, публикации…" /></Field>',
'<Field label={s.legalType === "ooo" ? "Достижения компании" : "Достижения"}><input className="field" value={s.achievements} onChange={(e) => s.setInfo({ achievements: e.target.value })} placeholder="Ярмарки, конкурсы, публикации…" /></Field>',
"extras.tsx: лейбл достижений по типу",
'Достижения компании"');

/* 5. История → «История бренда» для ООО */
patch("src/pages/extras.tsx",
'<Field label="История бизнеса — взлёты и падения">',
'<Field label={s.legalType === "ooo" ? "История бренда" : "История бизнеса — взлёты и падения"}>',
"extras.tsx: лейбл истории по типу",
'История бренда"');

if (fails.length) { console.log("\nНЕ НАЙДЕНО:"); fails.forEach((f) => console.log("  -", f)); process.exit(2); }
console.log("\nПатч блока «О мастере» применён успешно.");
