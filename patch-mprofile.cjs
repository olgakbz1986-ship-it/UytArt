/* ПАТЧ: «Мастер-профиль» по типу юрлица (используется в регистрации И в профиле) */
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

/* 1. Заголовок: Мастер-профиль / Профиль продавца / Профиль производства */
patch("src/pages/extras.tsx",
'<p className="font-display font-bold text-[16px] text-ink mb-1">Мастер-профиль</p>',
'<p className="font-display font-bold text-[16px] text-ink mb-1">{s.legalType === "ooo" ? "Профиль производства" : s.legalType === "ip" ? "Профиль продавца" : "Мастер-профиль"}</p>',
"заголовок блока по типу");

/* 2. Подпись блока */
patch("src/pages/extras.tsx",
'<p className="text-[12px] text-ink-mute mb-4">Эти данные формируют вашу карточку на странице «Мастера» и мини-сайт мастерской.</p>',
'<p className="text-[12px] text-ink-mute mb-4">{s.legalType === "ooo" ? "Эти данные формируют карточку компании на странице «Мастера» и мини-сайт бренда." : "Эти данные формируют вашу карточку на странице «Мастера» и мини-сайт мастерской."}</p>',
"подпись блока по типу");

/* 3. Чекбокс 1: Я мастер-производитель → Есть собственное производство */
patch("src/pages/extras.tsx",
'Я мастер-производитель — показывать мастерскую на странице «Мастера»',
'{s.legalType === "ooo" || s.legalType === "ip" ? "Есть собственное производство — показывать на странице «Мастера»" : "Я мастер-производитель — показывать мастерскую на странице «Мастера»"}',
"чекбокс «мастер-производитель» по типу");

/* 4. Чекбокс 2: индивидуальные заказы → оптовые для ООО */
patch("src/pages/extras.tsx",
'Принимаю индивидуальные заказы',
'{s.legalType === "ooo" ? "Принимаем оптовые и корпоративные заказы" : s.legalType === "ip" ? "Принимаем индивидуальные заказы" : "Принимаю индивидуальные заказы"}',
"чекбокс «заказы» по типу");

/* 5. Аватар мастера: скрываем для ООО (у компании лицо бренда — логотип) */
patch("src/pages/extras.tsx",
'</div>\n                  <div>\n                    <p className="text-[12.5px] font-semibold text-ink mb-1.5">Аватар мастера',
'</div>\n                  {s.legalType !== "ooo" && (<div>\n                    <p className="text-[12.5px] font-semibold text-ink mb-1.5">Аватар мастера',
"аватар: открытие условия");

patch("src/pages/extras.tsx",
'{s.masterAvatar && <img src={s.masterAvatar} alt="Аватар" className="w-14 h-14 rounded-[12px] object-cover mt-2" />}\n                  </div>',
'{s.masterAvatar && <img src={s.masterAvatar} alt="Аватар" className="w-14 h-14 rounded-[12px] object-cover mt-2" />}\n                  </div>\n                  )}',
"аватар: закрытие условия");

/* 6. Видео: для ООО — «Видео о компании» */
patch("src/pages/extras.tsx",
'"🎬 Видео о себе — презентация компании или услуг"',
'(s.legalType === "ooo" ? "🎬 Видео о компании — презентация производства" : "🎬 Видео о себе — презентация компании или услуг")',
"видео-лейбл по типу");

if (fails.length) { console.log("\nНЕ НАЙДЕНО:"); fails.forEach((f) => console.log("  -", f)); process.exit(2); }
console.log("\nПатч «Мастер-профиля» применён успешно.");
