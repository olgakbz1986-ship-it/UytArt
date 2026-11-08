/* ПАТЧ: серверный канал профиля продавца (кабинет ↔ dev-db) */
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

/* ---------- 1. Валидатор (по образцу PROFILE_PATCH) ---------- */
patch("server/validators.cjs",
`/* POST /api/tariff/set`,
`/* PATCH /api/seller/profile — анкета продавца из кабинета */
const SELLER_PROFILE_PATCH = z
  .object({
    shopName: optionalText(120), contactName: optionalText(120), phone: optionalText(30),
    city: optionalText(80), masterName: optionalText(120), yearsExperience: optionalText(10),
    achievements: optionalText(500), businessStory: optionalText(2000),
    isMaster: z.boolean().optional(), acceptsCustomOrders: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "нет полей для обновления" });

/* POST /api/tariff/set`,
"validators.cjs: схема SELLER_PROFILE_PATCH");

patch("server/validators.cjs",
"REGISTER, LOGIN, RESEND, PROFILE_PATCH,",
"REGISTER, LOGIN, RESEND, PROFILE_PATCH, SELLER_PROFILE_PATCH,",
"validators.cjs: экспорт схемы");

/* ---------- 2. Обработчики GET/PATCH /api/seller/profile ---------- */
patch("server/index.cjs",
`app.patch("/api/profile", guard, async (req, res) => {`,
`/* Серверное хранение профиля продавца (канал «кабинет ↔ база»):
   анкета, внесённая при регистрации, доступна из кабинета на любом
   устройстве. Храним в записи пользователя как seller_profile. */
const sanitizeSellerProfile = (raw) => {
  if (!raw || typeof raw !== "object") return null;
  const out = {};
  for (const [k, max] of [["shopName",120],["contactName",120],["phone",30],["city",80],["masterName",120],["yearsExperience",10],["achievements",500],["businessStory",2000]]) {
    if (raw[k] !== undefined && raw[k] !== null) out[k] = String(raw[k]).trim().slice(0, max);
  }
  if (raw.isMaster !== undefined) out.isMaster = !!raw.isMaster;
  if (raw.acceptsCustomOrders !== undefined) out.acceptsCustomOrders = !!raw.acceptsCustomOrders;
  return Object.keys(out).length ? out : null;
};

app.get("/api/seller/profile", guard, async (req, res) => {
  try {
    const u = (typeof db.byId === "function" ? await db.byId(req.userId) : null) || await db.update(req.userId, {});
    res.json({ ok: true, profile: u?.seller_profile || null, legal_info: u?.legal_info || null });
  } catch (e) { res.status(500).json({ error: "server", message: String(e && e.message || e) }); }
});

app.patch("/api/seller/profile", guard, async (req, res) => {
  try {
    const patch = sanitizeSellerProfile(req.body);
    if (!patch) return res.status(400).json({ error: "no_fields" });
    const cur = (typeof db.byId === "function" ? await db.byId(req.userId) : null) || await db.update(req.userId, {});
    const merged = { ...(cur?.seller_profile || {}), ...patch };
    const u = await db.update(req.userId, { seller_profile: merged });
    res.json({ ok: true, profile: u?.seller_profile || merged });
  } catch (e) { res.status(500).json({ error: "server", message: String(e && e.message || e) }); }
});

app.patch("/api/profile", guard, async (req, res) => {`,
"index.cjs: GET/PATCH /api/seller/profile");

/* ---------- 3. api.ts: два метода ---------- */
patch("src/lib/api.ts",
`  updateProfile: (p: { name?: string; phone?: string }) =>
    req<{ ok: boolean; profile?: ApiProfile }>("/profile", { method: "PATCH", body: JSON.stringify(p) }),`,
`  updateProfile: (p: { name?: string; phone?: string }) =>
    req<{ ok: boolean; profile?: ApiProfile }>("/profile", { method: "PATCH", body: JSON.stringify(p) }),

  /* Серверный профиль продавца: анкета из регистрации видна в кабинете */
  sellerProfileGet: () =>
    req<{ ok: boolean; profile?: Record<string, any> | null; legal_info?: Record<string, string> | null; error?: string }>("/seller/profile"),
  sellerProfilePatch: (p: Record<string, any>) =>
    req<{ ok: boolean; profile?: Record<string, any>; error?: string }>("/seller/profile", { method: "PATCH", body: JSON.stringify(p) }),`,
"api.ts: методы sellerProfileGet/Patch");

/* ---------- 4. extras.tsx: импорт api (если ещё нет) ---------- */
{
  const src = fs.readFileSync("src/pages/extras.tsx", "utf8");
  if (src.includes('from "../lib/api"') || src.includes("from '../lib/api'")) {
    console.log("SKIP: extras.tsx: импорт api уже есть");
  } else {
    const i = src.indexOf("import ");
    const j = src.indexOf("\n", i);
    fs.writeFileSync("src/pages/extras.tsx", src.slice(0, j + 1) + 'import { api } from "../lib/api";\n' + src.slice(j + 1));
    console.log("OK  : extras.tsx: импорт api добавлен");
  }
}

/* ---------- 5. extras.tsx: загрузка профиля с сервера при открытии кабинета ---------- */
patch("src/pages/extras.tsx",
`  const [sProfSaved, setSProfSaved] = useState(false);
  const saveSProf = () => {
    s.setInfo(sProf);
    setSProfSaved(true);
    setTimeout(() => setSProfSaved(false), 2200);
  };`,
`  const [sProfSaved, setSProfSaved] = useState(false);
  /* Синхронизация с сервером: при открытии кабинета подтягиваем анкету,
     внесённую при регистрации (работает на любом устройстве). */
  useEffect(() => {
    let alive = true;
    api.sellerProfileGet().then((r) => {
      if (!alive || !r.ok || !r.profile) return;
      const p = r.profile as Record<string, any>;
      setSProf((prev) => ({ ...prev, ...p }));
      const li = r.legal_info as Record<string, string> | null;
      const liPatch: Record<string, string> = {};
      if (li) {
        if (li.inn) liPatch.inn = li.inn;
        if (li.ogrn) liPatch.ogrn = li.ogrn;
        if (li.kpp) liPatch.kpp = li.kpp;
        if (li.bankDetails) liPatch.bankAccount = li.bankDetails;
      }
      if (Object.keys(liPatch).length) useSellerReg.getState().setInfo(liPatch);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const saveSProf = () => {
    s.setInfo(sProf);
    api.sellerProfilePatch(sProf).catch(() => {});
    setSProfSaved(true);
    setTimeout(() => setSProfSaved(false), 2200);
  };`,
"extras.tsx: синхронизация кабинета с сервером");

if (fails.length) { console.log("\nНЕ НАЙДЕНО:"); fails.forEach((f) => console.log("  -", f)); process.exit(2); }
console.log("\nПатч канала «кабинет ↔ сервер» применён успешно.");
