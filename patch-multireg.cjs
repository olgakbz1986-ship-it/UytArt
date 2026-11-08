/* ПАТЧ: мультимодальная регистрация (самозанятый / ИП / ООО) */
const fs = require("fs");
const fails = [];
const rx = (t) => new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"));
function patch(file, find, repl, label) {
  let src;
  try { src = fs.readFileSync(file, "utf8"); }
  catch (e) { fails.push(label + " (файл не найден)"); return; }
  const re = rx(find);
  if (rx(repl).test(src)) { console.log("SKIP:", label); return; }
  if (!re.test(src)) { fails.push(label); return; }
  fs.writeFileSync(file, src.replace(re, repl));
  console.log("OK  :", label);
}
function patchAll(file, find, repl, label) {
  let src;
  try { src = fs.readFileSync(file, "utf8"); }
  catch (e) { fails.push(label + " (файл не найден)"); return; }
  const re = new RegExp(rx(find).source, "g");
  if (!re.test(src)) { fails.push(label); return; }
  fs.writeFileSync(file, src.replace(re, repl));
  console.log("OK  :", label);
}

/* ---------- БЭКЕНД: принимаем и сохраняем реквизиты ---------- */
patch("server/validators.cjs",
`const REGISTER = z.object({
  email: z.string().trim().toLowerCase().regex(/^\\S+@\\S+\\.\\S+$/, "bad_email"),
  password: z.string().min(8, "password слишком короткий (мин. 8)").max(200),
  name: z.string().trim().min(2).max(100),
  role: z.enum(["buyer", "seller", "designer"]).catch("buyer"),
  legalType: z.enum(LEGAL_TYPES).or(z.literal("")).catch(""),
});`,
`const digitStr = (len) => z.string().trim().regex(new RegExp("^\\\\d{" + len + "}$"), "bad_digits");
const REGISTER = z.object({
  email: z.string().trim().toLowerCase().regex(/^\\S+@\\S+\\.\\S+$/, "bad_email"),
  password: z.string().min(8, "password слишком короткий (мин. 8)").max(200),
  name: z.string().trim().min(2).max(100),
  role: z.enum(["buyer", "seller", "designer"]).catch("buyer"),
  legalType: z.enum(LEGAL_TYPES).or(z.literal("")).catch(""),
  /* Реквизиты продавца по юр. статусу: самозанятый/ИП — ИНН 12 цифр, ОГРНИП 15;
     ООО — ИНН 10, ОГРН 13, КПП 9. Пустые строки допускаются (заполнят позже). */
  legalInfo: z.object({
    inn: z.union([digitStr(12), digitStr(10), z.literal("")]).optional().catch(""),
    ogrn: z.union([digitStr(15), digitStr(13), z.literal("")]).optional().catch(""),
    kpp: z.union([digitStr(9), z.literal("")]).optional().catch(""),
    bankDetails: optionalText(300),
  }).optional(),
});`,
"validators.cjs: схема REGISTER + legalInfo");

patch("server/index.cjs",
`const legalType = role === "seller" ? (LEGAL_OK.includes(reqLegal) ? reqLegal : "self_employed") :"";`,
`const legalType = role === "seller" ? (LEGAL_OK.includes(reqLegal) ? reqLegal : "self_employed") :"";
    /* Реквизиты продавца: сохраняем только для роли seller. Только цифры,
       с ограничением длины — защита от мусора в dev-db (аудит регистрации). */
    const rawLi = req.body.legalInfo || {};
    const legal_info = role === "seller" ? {
      inn: String(rawLi.inn || "").replace(/\\D/g, "").slice(0, 12),
      ogrn: String(rawLi.ogrn || "").replace(/\\D/g, "").slice(0, 15),
      kpp: String(rawLi.kpp || "").replace(/\\D/g, "").slice(0, 9),
      bankDetails: String(rawLi.bankDetails || "").trim().slice(0, 300),
    } : null;`,
"index.cjs: приём legal_info");

patch("server/index.cjs",
`...(consents.length ? { consents } : {}) });`,
`...(consents.length ? { consents } : {}), ...(legal_info ? { legal_info } : {}) });`,
"index.cjs: legal_info в db.create");

patch("server/index.cjs",
`confirm_token: token,
        confirm_expires: exp,
      }) || existingU;`,
`confirm_token: token,
        confirm_expires: exp,
        ...(legal_info ? { legal_info } : {}),
      }) || existingU;`,
"index.cjs: legal_info в db.update");

/* ---------- ФРОНТ: стейт (новые поля для ООО) ---------- */
patchAll("src/lib/seller.ts",
`\n  inn: string;\n`,
`\n  inn: string;\n  kpp?: string;\n  bankAccount?: string;\n  directorTitle?: string;\n`,
"seller.ts: интерфейсы + kpp/bankAccount/directorTitle");

patch("src/lib/seller.ts",
`"city" | "inn" | "ogrn" | "legalName"`,
`"city" | "inn" | "ogrn" | "kpp" | "bankAccount" | "directorTitle" | "legalName"`,
"seller.ts: setInfo принимает новые поля");

patch("src/lib/seller.ts",
`inn: "",
      ogrn: "",`,
`inn: "",
      ogrn: "",
      kpp: "",
      bankAccount: "",
      directorTitle: "",`,
"seller.ts: начальные значения новых полей");

/* ---------- ФРОНТ: мультимодальная анкета шага 1 ---------- */
patch("src/pages/extras.tsx",
`<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Название магазина" required><input className="field" value={s.shopName} onChange={(e) => s.setInfo({ shopName: e.target.value })} placeholder="Глиняный дом" /></Field>
            <Field label="Имя мастера" required><input className="field" value={s.masterName} onChange={(e) => s.setInfo({ masterName: e.target.value })} placeholder="Мария" /></Field>
            <Field label="ФИО" required><input className="field" value={s.contactName} onChange={(e) => s.setInfo({ contactName: e.target.value })} placeholder="Ковалёва Мария Сергеевна" /></Field>
            <Field label="Email" required><input className="field" type="email" value={s.email} onChange={(e) => s.setInfo({ email: e.target.value })} placeholder="maria@studio.ru" /></Field>
            <Field label="Город"><input className="field" value={s.city} onChange={(e) => s.setInfo({ city: e.target.value })} placeholder="Псков" /></Field>
            <Field label="ИНН"><input className="field" value={s.inn} onChange={(e) => s.setInfo({ inn: e.target.value.replace(/\\D/g, "") })} placeholder="602709876543" /></Field>`,
`<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {s.legalType === "ooo" ? (
              <>
                <Field label="Название организации" required><input className="field" value={s.legalName || ""} onChange={(e) => s.setInfo({ legalName: e.target.value })} placeholder="ООО «Глиняный дом»" /></Field>
                <Field label="Название магазина" required><input className="field" value={s.shopName} onChange={(e) => s.setInfo({ shopName: e.target.value })} placeholder="Глиняный дом" /></Field>
                <Field label="ФИО руководителя" required><input className="field" value={s.contactName} onChange={(e) => s.setInfo({ contactName: e.target.value })} placeholder="Ковалёва Мария Сергеевна" /></Field>
                <Field label="Должность руководителя"><input className="field" value={s.directorTitle || ""} onChange={(e) => s.setInfo({ directorTitle: e.target.value })} placeholder="Генеральный директор" /></Field>
              </>
            ) : (
              <>
                <Field label="Название магазина" required><input className="field" value={s.shopName} onChange={(e) => s.setInfo({ shopName: e.target.value })} placeholder="Глиняный дом" /></Field>
                <Field label="Имя мастера" required><input className="field" value={s.masterName} onChange={(e) => s.setInfo({ masterName: e.target.value })} placeholder="Мария" /></Field>
                <Field label="ФИО" required><input className="field" value={s.contactName} onChange={(e) => s.setInfo({ contactName: e.target.value })} placeholder="Ковалёва Мария Сергеевна" /></Field>
              </>
            )}
            <Field label="Email" required><input className="field" type="email" value={s.email} onChange={(e) => s.setInfo({ email: e.target.value })} placeholder="maria@studio.ru" /></Field>
            <Field label="Город"><input className="field" value={s.city} onChange={(e) => s.setInfo({ city: e.target.value })} placeholder="Псков" /></Field>
            {s.legalType === "ooo" ? (
              <>
                <Field label="ИНН организации (10 цифр)" required><input className="field" inputMode="numeric" value={s.inn} onChange={(e) => s.setInfo({ inn: e.target.value.replace(/\\D/g, "").slice(0, 10) })} placeholder="6027000000" /></Field>
                <Field label="КПП (9 цифр)" required><input className="field" inputMode="numeric" value={s.kpp || ""} onChange={(e) => s.setInfo({ kpp: e.target.value.replace(/\\D/g, "").slice(0, 9) })} placeholder="602701001" /></Field>
                <Field label="ОГРН (13 цифр)" required><input className="field" inputMode="numeric" value={s.ogrn || ""} onChange={(e) => s.setInfo({ ogrn: e.target.value.replace(/\\D/g, "").slice(0, 13) })} placeholder="1026000000000" /></Field>
                <Field label="Юридический адрес"><input className="field" value={s.legalAddress || ""} onChange={(e) => s.setInfo({ legalAddress: e.target.value })} placeholder="180000, г. Псков, ул. ..." /></Field>
              </>
            ) : (
              <>
                <Field label="ИНН (12 цифр)" required><input className="field" inputMode="numeric" value={s.inn} onChange={(e) => s.setInfo({ inn: e.target.value.replace(/\\D/g, "").slice(0, 12) })} placeholder="602709876543" /></Field>
                {s.legalType === "ip" && (
                  <Field label="ОГРНИП (15 цифр)" required><input className="field" inputMode="numeric" value={s.ogrn || ""} onChange={(e) => s.setInfo({ ogrn: e.target.value.replace(/\\D/g, "").slice(0, 15) })} placeholder="302600000000000" /></Field>
                )}
              </>
            )}
            <Field label={s.legalType === "ooo" ? "Расчётный счёт организации" : s.legalType === "ip" ? "Расчётный счёт ИП" : "Реквизиты банковской карты"}><input className="field" value={s.bankAccount || ""} onChange={(e) => s.setInfo({ bankAccount: e.target.value })} placeholder={s.legalType === "ooo" || s.legalType === "ip" ? "40817810…" : "2202 2006 …"} /></Field>`,
"extras.tsx: анкета шага 1 по типу юрлица");

patch("src/pages/extras.tsx",
`if (s.shopName.trim().length < 2 || s.contactName.trim().length < 2 || !s.email.includes("@") || s.masterName.trim().length < 2) {
      setErr("Заполните магазин, ФИО, email и имя мастера."); return;
    }`,
`if (s.shopName.trim().length < 2 || s.contactName.trim().length < 2 || !s.email.includes("@") || (s.legalType !== "ooo" && s.masterName.trim().length < 2)) {
      setErr("Заполните название магазина, ФИО, email" + (s.legalType !== "ooo" ? " и имя мастера." : ".")); return;
    }
    /* Валидация реквизитов по типу: ИНН 12/10, ОГРНИП 15, ОГРН 13, КПП 9 */
    const needInn = s.legalType === "ooo" ? 10 : 12;
    if (s.inn.length !== needInn) { setErr("ИНН должен содержать " + needInn + " цифр."); return; }
    if (s.legalType === "ip" && (s.ogrn || "").length !== 15) { setErr("ОГРНИП должен содержать 15 цифр."); return; }
    if (s.legalType === "ooo" && ((s.ogrn || "").length !== 13 || (s.kpp || "").length !== 9)) { setErr("Для ООО нужны ОГРН (13 цифр) и КПП (9 цифр)."); return; }`,
"extras.tsx: валидация по типу");

patch("src/pages/extras.tsx",
`authRegister({ name: s.contactName || s.masterName|| s.shopName, email: s.email, password: pwd, role: "seller", legalType: s.legalType || "self_employed" })`,
`authRegister({ name: s.contactName || s.masterName || s.shopName, email: s.email, password: pwd, role: "seller", legalType: s.legalType || "self_employed", legalInfo: { inn: s.inn, ogrn: s.ogrn || "", kpp: s.kpp || "", bankDetails: s.bankAccount || "" } })`,
"extras.tsx: отправка реквизитов на сервер");

patch("src/lib/store.ts",
`role?: string; legalType?: string; consents?: ConsentRecord[] }`,
`role?: string; legalType?: string; legalInfo?: { inn?: string; ogrn?: string; kpp?: string; bankDetails?: string }; consents?: ConsentRecord[] }`,
"store.ts: authRegister принимает legalInfo");

if (fails.length) {
  console.log("\nНЕ НАЙДЕНО (эти фрагменты не заменены):");
  fails.forEach((f) => console.log("  -", f));
  process.exit(2);
}
console.log("\nВсе патчи применены успешно.");
/* Диагностика: как api.register формирует тело запроса */
const apiSrc = fs.readFileSync("src/lib/api.ts", "utf8");
const i = apiSrc.search(/register\s*[:(]/);
if (i >= 0) { console.log("--- api.register (первые 700 символов) ---"); console.log(apiSrc.slice(i, i + 700)); }
