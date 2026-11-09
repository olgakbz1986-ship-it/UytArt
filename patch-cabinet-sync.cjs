/* ПАТЧ: кабинет продавца восстанавливается с сервера при входе. */
const fs = require("fs");
const fails = [];
const rx = (t) => new RegExp(t.replace(/[.*+?^${}()|[\]]/g, "\\$&").replace(/\s+/g, "\\s+"));
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
patch("src/lib/seller.ts",
`let lastSyncedUid = "";`,
`export async function initSellerFromServer(uid: string): Promise<void> {
  if (!uid) return;
  try {
    const sess = useAppStore.getState().session;
    let shopName = "";
    let city = "";
    let slug = "";
    let inn = "";
    let ogrn = "";
    let shopLogo: string | undefined;
    let legalType: SellerLegalType | null = (sess && sess.sellerType) || null;
    try {
      const sp = await api.sellerProfileGet();
      const p: Record<string, any> = (sp && sp.ok && sp.profile) ? sp.profile : {};
      const li: Record<string, any> = ((sp as any) && (sp as any).legal_info) || {};
      shopName = String(p.shopName || p.shop_name || p.name || "");
      city = String(p.city || "");
      slug = String(p.slug || "");
      inn = String(p.inn || li.inn || "");
      ogrn = String(p.ogrn || li.ogrn || "");
      shopLogo = p.shopLogo || undefined;
      const lt = p.legalType || p.legal_type;
      if (lt === "self_employed" || lt === "ip" || lt === "ooo") legalType = lt;
    } catch { /* сервер без анкеты — не фатально */ }
    if (!shopName) {
      try {
        const r = await fetch("/api/shops", { credentials: "include" }).then((x) => x.json());
        const arr: any[] = Array.isArray(r) ? r : ((r && (r.shops || r.items)) || []);
        const shop = arr.find((x) => String(x.id) === String(uid) || String(x.owner_id || x.user_id || x.userId || "") === String(uid));
        if (shop) {
          shopName = String(shop.name || "");
          city = city || String(shop.city || shop.sellerCity || "");
          slug = slug || String(shop.slug || "");
          shopLogo = shopLogo || shop.avatar_url || shop.avatarUrl || undefined;
        }
      } catch { /* сервер недоступен */ }
    }
    if (!legalType) legalType = "self_employed";
    const prof: SellerProfile = {
      accountId: uid, status: "active", legalType, shopName,
      contactName: (sess && sess.name) || "", email: (sess && sess.email) || "",
      phone: (sess && sess.phone) || "", city, inn, ogrn, legalName: "", legalAddress: "",
      shopLogo, slug, production_region: city, production_city: city,
      commissionRate: getCommissionRate(legalType, "free"),
      submittedAt: new Date().toISOString(), isMaster: true, acceptsCustomOrders: true,
      masterName: "", yearsExperience: "", businessStory: "", achievements: "",
      categories: [], productionGallery: [], videoTourUrl: "", docs: {},
    };
    useSellerReg.setState((st) => ({ profilesByAccount: { ...st.profilesByAccount, [uid]: prof } }));
    useSellerReg.getState().loadProfile(uid);
  } catch { /* noop */ }
}

let lastSyncedUid = "";`,
"seller.ts: функция initSellerFromServer");
patch("src/lib/seller.ts",
`if (reg.profilesByAccount[uid]) reg.loadProfile(uid);
      else if (reg.status !== "active") reg.clearActive();`,
`if (reg.profilesByAccount[uid]) reg.loadProfile(uid);
      else void initSellerFromServer(uid);`,
"seller.ts: подписка восстанавливает профиль с сервера");
patch("src/pages/extras.tsx",
`previewLegalTypeChange, LegalTypePreview, SellerProfile,
} from "../lib/seller";`,
`previewLegalTypeChange, LegalTypePreview, SellerProfile,
  initSellerFromServer,
} from "../lib/seller";`,
"extras.tsx: импорт initSellerFromServer");
patch("src/pages/extras.tsx",
`const user = useAppStore((st) => st.session);`,
`const user = useAppStore((st) => st.session);
  const [gateState, setGateState] = useState<"checking" | "open" | "closed">("checking");
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user || user.role !== "seller") { if (alive) setGateState("closed"); return; }
      if (useSellerReg.getState().status === "active") { if (alive) setGateState("open"); return; }
      await initSellerFromServer(user.userId);
      if (!alive) return;
      setGateState(useSellerReg.getState().status === "active" ? "open" : "closed");
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId, user?.role]);`,
"extras.tsx: состояние гейта + эффект синхронизации");
patch("src/pages/extras.tsx",
`if (s.status !== "active" || !user || user.role !== "seller") {
    return (
      <div className="max-w-[700px] mx-auto px-4 py-24 text-center">
        <p className="text-[56px] mb-3">🏪</p>
        <h1 className="font-display font-bold text-[28px] text-ink mb-2">Кабинет продавца недоступен</h1>
        <p className="text-[14px] text-ink-soft mb-7">Войдите в аккаунт продавца для просмотра кабинета.</p>
        <div className="flex justify-center gap-4">
          <Link to="/auth" className="inline-flex items-center justify-center h-[52px] px-7 rounded-[10px] bg-accent text-ink font-semibold hover:bg-accent-deep transition-colors">Войти</Link>
          <Link to="/seller/register" className="inline-flex items-center justify-center h-[52px] px-7 rounded-[10px] bg-dark text-cream text-[15px] font-semibold hover:bg-dark-deep transition-colors">Стать продавцом</Link>
        </div>
      </div>
    );
  }`,
`if (gateState !== "open") {
    if (gateState === "checking") {
      return (
        <div className="max-w-[700px] mx-auto px-4 py-24 text-center">
          <p className="text-[40px] mb-3">⏳</p>
          <h1 className="font-display font-bold text-[28px] text-ink mb-2">Синхронизация кабинета с сервером…</h1>
          <p className="text-[14px] text-ink-soft mb-7">Восстанавливаем профиль мастерской по данным аккаунта.</p>
        </div>
      );
    }
    return (
      <div className="max-w-[700px] mx-auto px-4 py-24 text-center">
        <p className="text-[56px] mb-3">🏪</p>
        <h1 className="font-display font-bold text-[28px] text-ink mb-2">Кабинет продавца недоступен</h1>
        <p className="text-[14px] text-ink-soft mb-7">Войдите в аккаунт продавца для просмотра кабинета.</p>
        <div className="flex justify-center gap-4">
          <Link to="/auth" className="inline-flex items-center justify-center h-[52px] px-7 rounded-[10px] bg-accent text-ink font-semibold hover:bg-accent-deep transition-colors">Войти</Link>
          <Link to="/seller/register" className="inline-flex items-center justify-center h-[52px] px-7 rounded-[10px] bg-dark text-cream text-[15px] font-semibold hover:bg-dark-deep transition-colors">Стать продавцом</Link>
        </div>
      </div>
    );
  }`,
"extras.tsx: гейт через gateState");
patch("src/lib/store.ts",
`useAppStore.getState().login(user, true);
        return { ok: true, role: serverRole }`,
`if (serverRole === "seller") {
          try {
            const sr = await fetch("/api/shops", { credentials: "include" }).then((x) => x.json());
            const sarr: any[] = Array.isArray(sr) ? sr : ((sr && (sr.shops || sr.items)) || []);
            const shopRec = sarr.find((x) => String(x.id) === String(pr.id) || String(x.owner_id || x.user_id || x.userId || "") === String(pr.id));
            if (shopRec && shopRec.name) user.name = String(shopRec.name);
          } catch { /* оставляем имя из профиля */ }
        }
        useAppStore.getState().login(user, true);
        return { ok: true, role: serverRole }`,
"store.ts: authLogin — имя магазина");
patch("src/lib/store.ts",
`const rsLocal = (useAppStore.getState().accounts[rsEmailKey] || []).find((a) => a.id === pr.id);
            useAppStore.getState().login({
              id: pr.id,
              name: rsLocal?.name || pr.name || pr.email.split("@")[0],`,
`const rsLocal = (useAppStore.getState().accounts[rsEmailKey] || []).find((a) => a.id === pr.id);
            let rsName = rsLocal?.name || pr.name || pr.email.split("@")[0];
            if (serverRole === "seller") {
              try {
                const rr = await fetch("/api/shops", { credentials: "include" }).then((x) => x.json());
                const arr2: any[] = Array.isArray(rr) ? rr : ((rr && (rr.shops || rr.items)) || []);
                const shop2 = arr2.find((x) => String(x.id) === String(pr.id) || String(x.owner_id || x.user_id || x.userId || "") === String(pr.id));
                if (shop2 && shop2.name) rsName = String(shop2.name);
              } catch { /* оставляем имя из профиля */ }
            }
            useAppStore.getState().login({
              id: pr.id,
              name: rsName,`,
"store.ts: restoreSession — имя магазина");
if (fails.length) {
  console.log("\nНЕ НАЙДЕНО:");
  fails.forEach((f) => console.log("  -", f));
  process.exit(2);
}
console.log("\nПатч кабинета продавца применён успешно.");