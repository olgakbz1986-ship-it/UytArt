import { useMemo, useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { MapPin, ShieldCheck, Flag, Store, MessageSquare, Wrench } from "lucide-react";
import { CITIES } from "../lib/geo";
import { fmt, vendorById } from "../data/seed";
import { useSellerReg, useSellerAccount, type SellerProfile } from "../lib/seller";
import { useMarketProducts } from "../lib/market";
import { useAppStore } from "../lib/store";
import { useReviewStore } from "../lib/review";
import { ProductGrid } from "../components/product";
import { Badge, Rating, Btn } from "../components/ui";
import { ComplaintModal } from "../components/review";

const LEGAL_META: Record<string, { label: string; emoji: string; color: string }> = {
  self_employed: { label: "Самозанятый", emoji: "🧑‍🌾", color: "#7cb342" },
  ip: { label: "ИП", emoji: "👔", color: "#d98e32" },
  ooo: { label: "Производство", emoji: "🏭", color: "#1e3a2f" },
};


const buildRealMaster = (reg: any, userId?: string, allGoods?: any[]): any => {
  if (!reg || reg.status !== "active" || !reg.shopName || !reg.isMaster) return null;
  const lm = LEGAL_META[reg.legalType] || LEGAL_META.self_employed;
  /* Товары только ЭТОГО мастера — жёсткая привязка по ownerId */
  const goods = (allGoods || []).filter((x: any) => x.id.startsWith("sp-") && (!userId || x.ownerId === userId));
  const ids = new Set(goods.map((g) => g.id));
  const revs = useReviewStore.getState().reviews.filter((r: any) => r.status === "approved" && ids.has(r.productId));
  const rating = revs.length ? Math.round((revs.reduce((a: number, r: any) => a + r.rating, 0) / revs.length) * 10) / 10 : 0;
  const sales = useSellerAccount.getState().transactions.filter((t: any) => t.kind === "sale").length;
  return {
    id: userId || "self",
    slug: userId || "self",
    name: reg.shopName,
    city: reg.city || "",
    story: reg.businessStory || "",
    avatar: reg.shopLogo || reg.masterAvatar || (useAppStore.getState().session?.avatar || ""),
    initial: reg.shopName[0]?.toUpperCase() || "М",
    bg: "#1e3a2f",
    legal: lm,
    verified: true,
    acceptsCustom: !!reg.acceptsCustomOrders,
    sinceYear: reg.submittedAt ? new Date(reg.submittedAt).getFullYear() : new Date().getFullYear(),
    rating,
    ratingCount: revs.length,
    sales,
  };
};


export function MastersPage() {
  const reg = useSellerReg();
  const session = useAppStore((s) => s.session);
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("all");
  const [serverMasters, setServerMasters] = useState<any[]>([]);

  // Загрузка мастеров с сервера при монтировании (с защитой от бесконечного цикла)
  useEffect(() => {
    const syncMaster = () => {
      const state = useSellerReg.getState();
      if (state.status === "active" && state.shopName && state.isMaster) {
        const master = buildRealMaster(state, session?.userId);
        fetch('/api/masters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(master)
        }).catch(() => {});
      }
    };
    
    syncMaster();
    /* ЭТАП 2: серверный гео-фильтр списка мастеров — город покупателя
       (viewerCity или адрес по умолчанию) передаётся в запросе; выборка
       ограничивается на сервере ДО отправки ответа. */
    const loadMasters = () => {
      const st = useAppStore.getState();
      const city = st.viewerCity || (st.addresses.find((a) => a.isDefault)?.city || "");
      fetch('/api/masters' + (city ? '?city=' + encodeURIComponent(city) : ''), { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d && d.ok && Array.isArray(d.masters)) setServerMasters(d.masters); })
        .catch(() => {});
    };
    loadMasters();
    // Подписываемся только на изменения, которые действительно важны
    const unsub = useSellerReg.subscribe((state) => {
      // Синхронизируем только при критических изменениях статуса
      if (state.status === "active" && state.shopName && state.isMaster) {
        syncMaster();
      }
    });
    return unsub;
  }, [session?.userId]); // Зависимости указаны корректно

  const marketAll = useMarketProducts();
  const localMaster = buildRealMaster(useSellerReg.getState(), session?.userId, marketAll);
  
  const list = useMemo(() => {
    // Объединяем серверных мастеров с локальным (локальный перекрывает по id)
    const merged = new Map<string, any>();
    serverMasters.forEach((m) => merged.set(m.id, m));
    if (localMaster) merged.set(localMaster.id, localMaster);
    
    return Array.from(merged.values()).filter((v: any) => {
      const okQ = !q.trim() || (v.name + " " + v.city + " " + v.story).toLowerCase().includes(q.toLowerCase());
      const okR = region === "all" || (v.city || "").trim().toLowerCase() === region.toLowerCase();
      return okQ && okR;
    });
  }, [q, region, serverMasters, localMaster, marketAll]);
  const totalMasters = useMemo(() => list.length, [list]);

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-10">
      <h1 className="font-display font-bold text-[clamp(26px,3vw,34px)] text-ink mb-2">Мастера со всей России</h1>
      <p className="text-[14px] text-ink-soft mb-7 max-w-xl">Проверенные мастерские и производства. Каждый прошёл верификацию документов.</p>

      <div className="flex gap-3 flex-wrap mb-7">
        <input className="field max-w-[320px]" placeholder="Поиск по имени или городу…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="field max-w-[240px] cursor-pointer" value={region} onChange={(e) => setRegion(e.target.value)}>
          <option value="all">Все города</option>
          {[...new Set([...CITIES.map((c) => c.name), ...list.map((v: any) => (v.city || "").trim()).filter(Boolean)])].sort((a, b) => a.localeCompare(b, "ru")).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {totalMasters === 0 && (
        <div className="bg-surface rounded-2xl shadow-card p-10 text-center">
          <p className="text-[14px] font-bold text-ink mb-1">Первые мастерские проходят верификацию</p>
          <p className="text-[13px] text-ink-soft">Здесь появятся только мастера с подтверждёнными документами.</p>
          <Link to={reg.status === "active" ? "/seller/dashboard" : "/seller/register"} className="inline-flex h-[44px] px-6 mt-4 items-center rounded-[10px] bg-accent text-ink font-semibold hover:bg-accent-deep hover:text-cream transition-colors">{reg.status === "active" ? (reg.isMaster ? "Редактировать профиль мастера" : "Активировать профиль мастера") : "Стать мастером"}</Link>
        </div>
      )}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.map((v, i) => (
          <Link key={v.id} to={`/shop/${v.slug}`}
            className="group bg-surface rounded-2xl shadow-card hover:shadow-lift hover:-translate-y-1.5 transition-all duration-300 p-6 block fade-up"
            style={{ animationDelay: `${(i % 9) * 50}ms` }}>
            <div className="flex items-start justify-between mb-4">
              {v.avatar ? (
                <img src={v.avatar} alt={v.name} className="w-14 h-14 rounded-[16px] object-cover" />
              ) : (
                <span className="w-14 h-14 rounded-[16px] flex items-center justify-center text-[24px] text-cream font-display font-bold" style={{ background: v.bg }}>{v.initial}</span>
              )}
              <div className="flex flex-col items-end gap-1">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold text-cream" style={{ background: v.legal.color }}>
                  <span>{v.legal.emoji}</span>{v.legal.label}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#f5e7d0] text-accent-deep text-[10.5px] font-bold">🏺 Мастер-производитель</span>
                {v.verified && <Badge tone="success"><ShieldCheck size={11} /> Проверен</Badge>}
              </div>
            </div>
            <h2 className="font-bold text-[17px] text-ink group-hover:text-accent-deep transition-colors">{v.name}</h2>
            <p className="text-[12.5px] text-ink-mute mt-1 flex items-center gap-1.5"><MapPin size={12} /> {v.city || "Россия"} · на платформе с {v.sinceYear}</p>
            {v.story && <p className="text-[13px] text-ink-soft leading-relaxed mt-3 line-clamp-2">{v.story}</p>}
            <div className="flex flex-wrap gap-1.5 mt-3">
              {v.acceptsCustom && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cream text-ink-soft text-[10.5px] font-bold">✦ Индивидуальные заказы</span>}
            </div>
            {(v.ratingCount > 0 || v.sales > 0) && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-line-soft">
                {v.ratingCount > 0 ? <Rating value={v.rating} /> : <span className="text-[12px] text-ink-mute">Отзывов пока нет</span>}
                <span className="text-[12px] text-ink-mute">{v.sales} заказов</span>
              </div>
            )}
          </Link>
        ))}
      </div>

      {totalMasters > 0 && list.length === 0 && (
        <div className="bg-surface rounded-2xl shadow-card px-8 py-16 text-center">
          <p className="text-[44px] mb-3">🔍</p>
          <p className="font-display font-bold text-[20px] text-ink mb-2">Мастера не найдены</p>
          <p className="text-[14px] text-ink-soft">Попробуйте изменить запрос или город.</p>
        </div>
      )}
    </div>
  );
}

export function ShopPage() {
  const { slug } = useParams();
  const activeReg = useSellerReg();
  const profiles = useSellerReg((s) => s.profilesByAccount);
  const session = useAppStore((s) => s.session);
  const marketAll = useMarketProducts();

  /* Canonical id продавца: "self" -> активная сессия, иначе slug = id аккаунта */
  const ownerId = slug === "self" || !slug ? (session?.userId || "") : slug;
  /* Профиль из реестра по id владельца (Проблемы №1/№3); fallback — активный стор */
  const reg: SellerProfile | null = profiles[ownerId] || (ownerId === session?.userId ? (activeReg as unknown as SellerProfile) : null);
  const master = buildRealMaster(reg, ownerId, marketAll);
  const reviews = useReviewStore((s) => s.reviews);
  /* Витрина магазина: только товары этого продавца */
  const goods = useMemo(() => marketAll.filter((x) => x.id.startsWith("sp-") && (x as any).ownerId === ownerId), [marketAll, ownerId]);
  const goodsIds = new Set(goods.map((g) => g.id));
  const shopReviews = reviews.filter((r) => r.status === "approved" && goodsIds.has(r.productId));

  if (!master || !reg) {
    return (
      <div className="max-w-[720px] mx-auto px-4 py-24 text-center">
        <div className="text-[56px] mb-4">🏪</div>
        <h1 className="font-display font-bold text-[28px] text-ink mb-3">Магазин не найден</h1>
        <Link to="/masters" className="inline-flex h-[44px] px-6 items-center rounded-[10px] bg-dark text-cream font-semibold hover:bg-accent hover:text-ink transition-colors">К мастерам</Link>
      </div>
    );
  }

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-10">
      <div className="bg-surface rounded-[24px] shadow-card p-8 flex flex-col md:flex-row gap-6 items-start">
        {master.avatar ? (
          <img src={master.avatar} alt={master.name} className="w-24 h-24 rounded-[20px] object-cover" />
        ) : (
          <span className="w-24 h-24 rounded-[20px] flex items-center justify-center text-[40px] text-cream font-display font-bold" style={{ background: master.bg }}>{master.initial}</span>
        )}
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-cream" style={{ background: master.legal.color }}>
              <span>{master.legal.emoji}</span>{master.legal.label}
            </span>
            {/* ЭТАП 4 (§4.1): кнопка заказа — открывает форму индивидуального
                заказа с защищённо предзаполненным исполнителем (invite=<id>).
                Не отображается в собственном магазине. */}
            {master.acceptsCustom && ownerId !== session?.userId && (
              <Link to={`/market?invite=${encodeURIComponent(ownerId)}`}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent text-cream text-[11.5px] font-bold hover:bg-accent-deep transition-colors">
                <Wrench size={12} /> Заказать у мастера
              </Link>
            )}
            {master.verified && <Badge tone="success"><ShieldCheck size={12} /> Документы проверены</Badge>}
            {master.acceptsCustom && <Badge tone="honey">✦ Индивидуальные заказы</Badge>}
          </div>
          <h1 className="font-display font-bold text-[clamp(26px,3vw,36px)] text-ink">{master.name}</h1>
          <p className="text-[13px] text-ink-mute mt-1 flex items-center gap-1.5"><MapPin size={13} /> {master.city || "Россия"} · на платформе с {master.sinceYear} года</p>
          {reg.yearsExperience && <p className="text-[13px] text-ink-soft mt-2">Опыт мастерской: {reg.yearsExperience}</p>}
          {(master.ratingCount > 0 || master.sales > 0) && (
            <p className="text-[13px] text-ink-soft mt-2 flex items-center gap-2 flex-wrap">
              {master.ratingCount > 0 && <><Rating value={master.rating} /> <span className="text-ink-mute">· {master.ratingCount} отзывов</span></>}
              {master.sales > 0 && <span className="text-ink-mute">· {master.sales} заказов</span>}
            </p>
          )}
        </div>
      </div>

      {(reg.businessStory || reg.achievements) && (
        <section className="mt-8 bg-surface rounded-[24px] shadow-card p-8">
          <h2 className="font-display font-bold text-[22px] text-ink mb-4">История мастерской</h2>
          {reg.businessStory && <p className="text-[14px] text-ink-soft leading-relaxed whitespace-pre-line">{reg.businessStory}</p>}
          {reg.achievements && <p className="text-[13px] text-ink-mute mt-4">🏆 {reg.achievements}</p>}
        </section>
      )}

      {(reg.productionGallery.length > 0 || reg.videoTourUrl) && (
        <section className="mt-8">
          <h2 className="font-display font-bold text-[22px] text-ink mb-4">Производство</h2>
          {reg.videoTourUrl && (
            <div className="mb-4 rounded-[20px] overflow-hidden bg-dark aspect-video">
              <video src={reg.videoTourUrl} controls playsInline className="w-full h-full object-cover" />
            </div>
          )}
          {reg.productionGallery.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {reg.productionGallery.map((g, i) => (
                <img key={i} src={g} alt={`Производство ${i + 1}`} className="rounded-[16px] aspect-square object-cover" />
              ))}
            </div>
          )}
        </section>
      )}

      <section className="mt-10">
        <h2 className="font-display font-bold text-[22px] text-ink mb-4">Изделия мастерской</h2>
        {goods.length === 0 ? (
          <p className="text-[13.5px] text-ink-soft bg-cream rounded-[14px] px-5 py-6 text-center">Мастер ещё не добавил изделия — они появятся здесь.</p>
        ) : (
          <ProductGrid items={goods} />
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display font-bold text-[22px] text-ink mb-4">Отзывы покупателей</h2>
        {shopReviews.length === 0 ? (
          <p className="text-[13.5px] text-ink-soft bg-cream rounded-[14px] px-5 py-6 text-center">Отзывов пока нет — они появятся после первых покупок.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {shopReviews.map((r) => (
              <div key={r.id} className="bg-surface rounded-2xl shadow-card p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Rating value={r.rating} />
                  <span className="text-[12.5px] font-bold text-ink">{r.userName}</span>
                </div>
                <p className="text-[13px] text-ink-soft leading-relaxed">{r.text}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
