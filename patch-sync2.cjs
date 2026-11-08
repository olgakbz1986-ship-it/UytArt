/* ДОПАТЧ: два фрагмента синхронизации (гибкий поиск, терпим к CRLF) */
const fs = require("fs");
const rx = (t) => new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"));
function rpatch(file, find, repl, label) {
  let src;
  try { src = fs.readFileSync(file, "utf8"); }
  catch (e) { console.log("FAIL:", label, "(файл не найден)"); process.exit(2); }
  if (rx(repl).test(src)) { console.log("SKIP:", label); return; }
  if (!rx(find).test(src)) { console.log("FAIL:", label); process.exit(2); }
  fs.writeFileSync(file, src.replace(rx(find), repl));
  console.log("OK  :", label);
}

/* 1. api.ts: методы sellerProfileGet / sellerProfilePatch */
rpatch("src/lib/api.ts",
`updateProfile: (p: { name?: string; phone?: string }) =>
    req<{ ok: boolean; profile?: ApiProfile }>("/profile", { method: "PATCH", body: JSON.stringify(p) }),`,
`updateProfile: (p: { name?: string; phone?: string }) =>
    req<{ ok: boolean; profile?: ApiProfile }>("/profile", { method: "PATCH", body: JSON.stringify(p) }),

  /* Серверный профиль продавца: анкета из регистрации видна в кабинете */
  sellerProfileGet: () =>
    req<{ ok: boolean; profile?: Record<string, any> | null; legal_info?: Record<string, string> | null; error?: string }>("/seller/profile"),
  sellerProfilePatch: (p: Record<string, any>) =>
    req<{ ok: boolean; profile?: Record<string, any>; error?: string }>("/seller/profile", { method: "PATCH", body: JSON.stringify(p) }),`,
"api.ts: методы sellerProfileGet/Patch");

/* 2. extras.tsx: загрузка профиля с сервера + сохранение на сервер */
rpatch("src/pages/extras.tsx",
`const [sProfSaved, setSProfSaved] = useState(false);
  const saveSProf = () => {
    s.setInfo(sProf);
    setSProfSaved(true);
    setTimeout(() => setSProfSaved(false), 2200);
  };`,
`const [sProfSaved, setSProfSaved] = useState(false);
  /* Синхронизация с сервером: при открытии кабинета подтягиваем анкету,
     внесённую при регистрации (работает на любом устройстве). */
  useEffect(() => {
    let alive = true;
    api.sellerProfileGet().then((r: any) => {
      if (!alive || !r.ok || !r.profile) return;
      const p = r.profile as Record<string, any>;
      setSProf((prev: any) => ({ ...prev, ...p }));
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
