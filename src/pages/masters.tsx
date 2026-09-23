import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { MapPin, ShieldCheck, Flag, Store, MessageSquare } from "lucide-react";
import { fmt, vendorById } from "../data/seed";
import { useSellerReg, useSellerAccount } from "../lib/seller";
import { marketProducts } from "../lib/market";
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

const REGION_CITIES: [string, string[]][] = [
  ["ЦФО", ["москва", "тула", "тверь", "ярослав", "владимир", "рязань", "калуга", "брянск", "орел", "курск", "воронеж", "липецк", "тамбов", "иваново", "кострома", "смоленск", "белгород"]],
  ["СЗФО", ["санкт-петербург", "псков", "новгород", "калининград", "мурманск", "архангельск", "вологда", "череповец", "сыктывкар", "петрозаводск"]],
  ["ЮФО", ["ростов", "краснодар", "сочи", "волгоград", "астрахань", "майкоп", "элиста", "симферополь", "севастополь", "адлер"]],
  ["СКФО", ["ставрополь", "пятогорск", "кисловодск", "нальчик", "владикавказ", "грозный", "махачкала", "дербент", "черкесск", "ессентуки"]],
  ["ПФО", ["нижний новгород", "казань", "самара", "саратов", "уфа", "пермь", "ульяновск", "киров", "ижевск", "чебоксары", "йошкар-ола", "пенза", "саранск", "оренбург"]],
  ["УФО", ["екатеринбург", "челябинск", "тюмень", "сургут", "курган", "магнитогорск", "нижний тагил", "ханты-мансийск"]],
  ["СФО", ["новосибирск", "омск", "красноярск", "томск", "кемерово", "барнаул", "иркутск", "новокузнецк"]],
  ["ДФО", ["владивосток", "хабаровск", "якутск", "южно-сахалинск", "петропавловск", "магадан", "благовещенск", "чита", "улан-удэ"]],
];
const regionByCity = (city: string): string => {
  const c = (city || "").toLowerCase();
  if (!c.trim()) return "";
  for (const [r, list] of REGION_CITIES) if (list.some((w) => c.includes(w))) return r;
  return "";
};

const buildRealMaster = (reg: any): any => {
  if (!reg || reg.status !== "active" || !reg.shopName || !reg.isMaster) return null;
  const lm = LEGAL_META[reg.legalType] || LEGAL_META.self_employed;
  const goods = marketProducts().filter((x) => x.id.startsWith("sp-"));
  const ids = new Set(goods.map((g) => g.id));
  const revs = useReviewStore.getState().reviews.filter((r: any) => r.status === "approved" && ids.has(r.productId));
  const rating = revs.length ? Math.round((revs.reduce((a: number, r: any) => a + r.rating, 0) / revs.length) * 10) / 10 : 0;
  const sales = useSellerAccount.getState().transactions.filter((t: any) => t.kind === "sale").length;
  return {
    id: "self",
    slug: "self",
    name: reg.shopName,
    city: reg.city || "",
    region: regionByCity(reg.city),
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
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("all");

  const list = useMemo(
    () =>
[buildRealMaster(useSellerReg.getState())].filter(Boolean).filter((v: any) => {
        const okQ = !q.trim() || (v.name + " " + v.city + " " + v.story).toLowerCase().includes(q.toLowerCase());
        const okR = region === "all" || v.region === region;
        return okQ && okR;
      }),
    [q, region]
  );
  const totalMasters = useMemo(() => [buildRealMaster(useSellerReg.getState())].filter(Boolean).length, []);

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-10">
      <h1 className="font-display font-bold text-[clamp(26px,3vw,34px)] text-ink mb-2">Мастера со всей России</h1>
      <p className="text-[14px] text-ink-soft mb-7 max-w-xl">Проверенные мастерские и производства. Каждый прошёл верификацию документов.</p>

      <div className="flex gap-3 flex-wrap mb-7">
        <input className="field max-w-[320px]" placeholder="Поиск по имени или городу…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="field max-w-[240px] cursor-pointer" value={region} onChange={(e) => setRegion(e.target.value)}>
          <option value="all">Все округа</option>
          {["ЦФО", "СЗФО", "ЮФО", "СКФО", "ПФО", "УФО", "СФО", "ДФО"].map((r) => <option key={r} value={r}>{r}</option>)}
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
          <p className="text-[14px] text-ink-soft">Попробуйте изменить запрос или округ.</p>
        </div>
      )}
    </div>
  );
}

export function ShopPage() {
  const { slug } = useParams();
  const reg = useSellerReg();
  const master = buildRealMaster(reg);
  const reviews = useReviewStore((s) => s.reviews);
  const goods = useMemo(() => marketProducts().filter((x) => x.id.startsWith("sp-")), []);
  const goodsIds = new Set(goods.map((g) => g.id));
  const shopReviews = reviews.filter((r) => r.status === "approved" && goodsIds.has(r.productId));

  if (!master || (slug !== "self" && slug !== reg.slug)) {
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
