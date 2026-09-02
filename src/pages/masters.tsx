import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Search, MapPin, Star, ShieldCheck, Flag, MessageSquare } from "lucide-react";
import { PRODUCTS, VENDORS, vendorById } from "../data/seed";
import { DISTRICTS } from "../lib/geo";
import { ProductGrid } from "../components/product";
import { Badge, Btn, Rating } from "../components/ui";
import { ComplaintModal, ReviewsSection } from "../components/review";
import { ChatModal } from "../components/chat";

/* ============================================================
   Список мастеров
   ============================================================ */
export function MastersPage() {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"rating" | "sales" | "new">("rating");
  const [onlyVerified, setOnlyVerified] = useState(false);

  const list = useMemo(() => {
    let l = VENDORS.filter(
      (v) => !q.trim() || `${v.name} ${v.city} ${v.description}`.toLowerCase().includes(q.toLowerCase())
    );
    if (onlyVerified) l = l.filter((v) => v.verified);
    switch (sort) {
      case "sales": return [...l].sort((a, b) => b.sales - a.sales);
      case "new": return [...l].sort((a, b) => b.since - a.since);
      default: return [...l].sort((a, b) => b.rating - a.rating);
    }
  }, [q, sort, onlyVerified]);

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-accent-deep mb-2">Лица платформы</p>
          <h1 className="font-display font-bold text-[clamp(26px,3vw,34px)] text-ink">Мастера со всей России</h1>
          <p className="text-[14px] text-ink-soft mt-2 max-w-xl">Каждая мастерская проходит верификацию документов. Реквизиты открыты — по ст. 12 ЗоЗПП.</p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap mb-7">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-mute" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Мастерская, город…"
            className="w-full h-[46px] rounded-full border border-line bg-surface pl-10 pr-4 text-[14px] outline-none focus:border-ai transition-colors" />
        </div>
        <label className="flex items-center gap-2 text-[13px] font-semibold text-ink-soft cursor-pointer select-none">
          <input type="checkbox" checked={onlyVerified} onChange={(e) => setOnlyVerified(e.target.checked)} /> Только проверенные
        </label>
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Сортировка"
          className="h-[44px] px-3.5 rounded-[10px] border border-line bg-surface text-sm text-ink font-medium cursor-pointer outline-none focus:border-ai ml-auto">
          <option value="rating">По рейтингу</option>
          <option value="sales">По продажам</option>
          <option value="new">Новые мастерские</option>
        </select>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.map((v, i) => (
          <Link key={v.id} to={`/shop/${v.slug}`}
            className="group bg-surface rounded-2xl shadow-card hover:shadow-lift hover:-translate-y-1.5 transition-all duration-300 overflow-hidden flex flex-col fade-up"
            style={{ animationDelay: `${(i % 9) * 50}ms` }}>
            <div className="h-28 relative" style={{ background: `linear-gradient(135deg, ${v.avatarColor}, #244534)` }}>
              <span className="absolute -bottom-7 left-5 w-16 h-16 rounded-[18px] flex items-center justify-center text-[32px] border-4 border-cream" style={{ background: v.avatarColor }}>{v.emoji}</span>
              {v.verified && (
                <span className="absolute top-3 right-3"><Badge tone="success"><ShieldCheck size={11} /> Проверен</Badge></span>
              )}
            </div>
            <div className="p-5 pt-10 flex flex-col flex-1">
              <h2 className="font-display font-bold text-[16px] text-ink group-hover:text-accent-deep transition-colors">{v.name}</h2>
              <p className="text-[12.5px] text-ink-mute mt-1 flex items-center gap-1.5">
                <MapPin size={12} /> {v.city} · {DISTRICTS.find((d) => d.id === v.production_region)?.name} округ
              </p>
              <p className="text-[13px] text-ink-soft mt-2.5 leading-relaxed line-clamp-2 flex-1">{v.description}</p>
              <div className="flex items-center justify-between mt-4 pt-3.5 border-t border-line-soft">
                <span className="flex items-center gap-1.5"><Star size={14} className="text-accent fill-accent" /><span className="font-bold text-[14px] text-ink">{v.rating.toFixed(1)}</span><span className="text-[12px] text-ink-mute">· {v.reviewsCount}</span></span>
                <span className="text-[12px] font-bold text-ink-soft">{v.sales.toLocaleString("ru-RU")} продаж</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   Магазин мастера: витрина, реквизиты, отзывы, жалоба
   ============================================================ */
export function ShopPage() {
  const { slug = "" } = useParams();
  const vendor = VENDORS.find((v) => v.slug === slug) || (slug ? vendorById(slug) : undefined);
  const [tab, setTab] = useState<"goods" | "about" | "reviews">("goods");
  const [complaintOpen, setComplaintOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const goods = useMemo(() => PRODUCTS.filter((p) => p.vendorId === vendor?.id), [vendor]);

  if (!vendor) {
    return (
      <div className="max-w-[700px] mx-auto px-4 py-24 text-center">
        <p className="text-[56px] mb-3">🏚️</p>
        <h1 className="font-display font-bold text-[28px] text-ink mb-3">Мастерская не найдена</h1>
        <Link to="/masters" className="inline-flex items-center justify-center h-11 px-6 rounded-[10px] bg-dark text-cream text-sm font-semibold hover:bg-dark-deep transition-colors">К мастерам</Link>
      </div>
    );
  }

  return (
    <div>
      {/* шапка магазина */}
      <section className="bg-dark text-cream">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-12 flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <span className="w-20 h-20 rounded-[22px] flex items-center justify-center text-[40px] shrink-0" style={{ background: vendor.avatarColor }}>{vendor.emoji}</span>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-display font-bold text-[clamp(24px,3vw,34px)]">{vendor.name}</h1>
              {vendor.verified ? <Badge tone="success"><ShieldCheck size={12} /> Проверен</Badge> : <Badge tone="honey">На проверке</Badge>}
            </div>
            <p className="text-cream/70 text-[14px] mt-2 max-w-xl leading-relaxed">{vendor.description}</p>
            <p className="text-cream/50 text-[12.5px] mt-2.5 flex items-center gap-4 flex-wrap">
              <span className="flex items-center gap-1.5"><MapPin size={13} /> {vendor.city} · {DISTRICTS.find((d) => d.id === vendor.production_region)?.name} округ</span>
              <span className="flex items-center gap-1.5"><Star size={13} className="text-accent" /> {vendor.rating.toFixed(1)} · {vendor.reviewsCount} отзывов</span>
              <span>на платформе с {vendor.since} г.</span>
            </p>
          </div>
          <div className="text-right shrink-0 flex sm:flex-col gap-3 sm:gap-1 items-center sm:items-end">
            <div>
              <p className="font-display font-extrabold text-[30px] text-accent">{vendor.sales.toLocaleString("ru-RU")}</p>
              <p className="text-[12px] text-cream/50">продаж за всё время</p>
            </div>
            <button onClick={() => setComplaintOpen(true)}
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-cream/50 hover:text-error transition-colors cursor-pointer">
              <Flag size={12} /> Пожаловаться на продавца
            </button>
          </div>
        </div>
      </section>

      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-10">
        {/* вкладки */}
        <div className="flex gap-1.5 border-b border-line-soft overflow-x-auto no-scrollbar mb-8">
          {([["goods", `Товары · ${goods.length}`], ["about", "О мастерской"], ["reviews", "Отзывы"]] as const).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`px-5 py-3 text-sm font-bold whitespace-nowrap border-b-[2.5px] -mb-px transition-colors cursor-pointer ${tab === id ? "border-accent text-ink" : "border-transparent text-ink-mute hover:text-ink"}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === "goods" && (
          <>
            {goods.length ? <ProductGrid items={goods} /> : <p className="text-[14px] text-ink-soft">Витрина пока пополняется.</p>}
            <div className="mt-10 bg-surface rounded-2xl shadow-card p-6 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="font-display font-bold text-[16px] text-ink">Есть вопрос мастеру?</p>
                <p className="text-[13px] text-ink-soft mt-1">Структурированный чат: готовые вопросы, никакой переписки впустую.</p>
              </div>
              {goods[0] && <Btn onClick={() => setAskOpen(true)}><MessageSquare size={16} /> Написать продавцу</Btn>}
            </div>
          </>
        )}

        {tab === "about" && (
          <div className="grid md:grid-cols-2 gap-5 max-w-4xl">
            <div className="bg-surface rounded-2xl shadow-card p-6">
              <h2 className="font-display font-bold text-[18px] text-ink mb-4">Реквизиты продавца <span className="text-[11px] font-sans font-bold text-ink-mute uppercase">ст. 12 ЗоЗПП</span></h2>
              <div className="space-y-2 text-[13.5px]">
                <p className="flex justify-between gap-4"><span className="text-ink-mute">Продавец</span><span className="font-semibold text-ink text-right">{vendor.legal_name}</span></p>
                <p className="flex justify-between gap-4"><span className="text-ink-mute">Форма</span><span className="font-semibold text-ink">{vendor.legal_form}</span></p>
                <p className="flex justify-between gap-4"><span className="text-ink-mute">ИНН</span><span className="font-semibold text-ink">{vendor.inn}</span></p>
                <p className="flex justify-between gap-4"><span className="text-ink-mute">ОГРН</span><span className="font-semibold text-ink">{vendor.ogrn}</span></p>
                <p className="flex justify-between gap-4"><span className="text-ink-mute">Город</span><span className="font-semibold text-ink">{vendor.city}</span></p>
              </div>
              <p className="text-[11.5px] text-ink-mute mt-4 leading-relaxed">
                УютАрт — информационный агрегатор (ст. 12 ЗоЗПП): договор купли-продажи вы заключаете напрямую с этим продавцом.
              </p>
            </div>
            <div className="bg-surface rounded-2xl shadow-card p-6">
              <h2 className="font-display font-bold text-[18px] text-ink mb-4">Мастерская</h2>
              <div className="space-y-2 text-[13.5px]">
                <p className="flex justify-between gap-4"><span className="text-ink-mute">Город производства</span><span className="font-semibold text-ink">{vendor.city}</span></p>
                <p className="flex justify-between gap-4"><span className="text-ink-mute">Округ доставки</span><span className="font-semibold text-ink">{DISTRICTS.find((d) => d.id === vendor.production_region)?.name}</span></p>
                <p className="flex justify-between gap-4"><span className="text-ink-mute">Работает с</span><span className="font-semibold text-ink">{vendor.since} года</span></p>
                <p className="flex justify-between gap-4"><span className="text-ink-mute">Рейтинг</span><span className="font-semibold text-ink"><Rating value={vendor.rating} size={11} /></span></p>
                <p className="flex justify-between gap-4"><span className="text-ink-mute">Продаж</span><span className="font-semibold text-ink">{vendor.sales.toLocaleString("ru-RU")}</span></p>
                <p className="flex justify-between gap-4"><span className="text-ink-mute">Товаров на витрине</span><span className="font-semibold text-ink">{goods.length}</span></p>
              </div>
              <div className="mt-4 pt-4 border-t border-line-soft">
                <p className="text-[12px] font-bold uppercase tracking-wide text-ink-mute mb-2">О мастерской</p>
                <p className="text-[13.5px] text-ink-soft leading-relaxed">{vendor.description}</p>
              </div>
            </div>
          </div>
        )}

        {tab === "reviews" && (
          goods[0]
            ? <div className="max-w-3xl"><ReviewsSection product={goods[0]} /></div>
            : <p className="text-[14px] text-ink-soft">Отзывы появятся после первых заказов.</p>
        )}
      </div>

      <ComplaintModal open={complaintOpen} onClose={() => setComplaintOpen(false)} vendorId={vendor.id} />
      {goods[0] && (
        <ChatModal open={askOpen} onClose={() => setAskOpen(false)} kind="product" product={goods[0]} />
      )}
    </div>
  );
}
