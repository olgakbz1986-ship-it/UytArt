import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { MapPin, ShieldCheck, Flag, Store, MessageSquare } from "lucide-react";
import { VENDORS, PRODUCTS, fmt, vendorById } from "../data/seed";
import { useAppStore } from "../lib/store";
import { ProductGrid } from "../components/product";
import { Badge, Rating, Btn } from "../components/ui";
import { ComplaintModal } from "../components/review";

export function MastersPage() {
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("all");

  const list = useMemo(
    () =>
      VENDORS.filter((v) => {
        const okQ = !q.trim() || (v.name + " " + v.city + " " + v.description).toLowerCase().includes(q.toLowerCase());
        const okR = region === "all" || v.production_region === region;
        return okQ && okR;
      }),
    [q, region]
  );

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

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.map((v, i) => (
          <Link key={v.id} to={`/shop/${v.slug}`}
            className="group bg-surface rounded-2xl shadow-card hover:shadow-lift hover:-translate-y-1.5 transition-all duration-300 p-6 block fade-up"
            style={{ animationDelay: `${(i % 9) * 50}ms` }}>
            <div className="flex items-start justify-between mb-4">
              <span className="w-14 h-14 rounded-[16px] flex items-center justify-center text-[28px] text-cream" style={{ background: v.avatarColor }}>{v.emoji}</span>
              {v.verified
                ? <Badge tone="success"><ShieldCheck size={12} /> Проверен</Badge>
                : <Badge tone="honey">На проверке</Badge>}
            </div>
            <h2 className="font-bold text-[17px] text-ink group-hover:text-accent-deep transition-colors">{v.name}</h2>
            <p className="text-[12.5px] text-ink-mute mt-1 flex items-center gap-1.5"><MapPin size={12} /> {v.city} · {v.production_region} · с {v.since} года</p>
            <p className="text-[13px] text-ink-soft leading-relaxed mt-3 line-clamp-2">{v.description}</p>
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-line-soft">
              <Rating value={v.rating} />
              <span className="text-[12px] text-ink-mute">{v.sales.toLocaleString("ru-RU")} продаж</span>
            </div>
          </Link>
        ))}
      </div>

      {list.length === 0 && (
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
  const { slug = "" } = useParams();
  const vendor = vendorById(slug);
  const user = useAppStore((s) => s.user);
  const [tab, setTab] = useState<"goods" | "about" | "reviews">("goods");
  const [complaintOpen, setComplaintOpen] = useState(false);
  const goods = useMemo(() => PRODUCTS.filter((p) => p.vendorId === vendor?.id), [vendor]);

  if (!vendor) {
    return (
      <div className="max-w-[700px] mx-auto px-4 py-24 text-center">
        <p className="text-[56px] mb-3">🏪</p>
        <h1 className="font-display font-bold text-[28px] text-ink mb-3">Магазин не найден</h1>
        <Link to="/masters" className="inline-flex items-center justify-center h-11 px-6 rounded-[10px] bg-dark text-cream text-sm font-semibold hover:bg-dark-deep transition-colors">К мастерам</Link>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-10">
      {/* шапка магазина */}
      <div className="bg-surface rounded-3xl shadow-card p-7 sm:p-9 mb-8">
        <div className="flex items-start gap-5 flex-wrap">
          <span className="w-20 h-20 rounded-[20px] flex items-center justify-center text-[40px] text-cream shrink-0" style={{ background: vendor.avatarColor }}>{vendor.emoji}</span>
          <div className="flex-1 min-w-[220px]">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-display font-bold text-[clamp(24px,3vw,32px)] text-ink">{vendor.name}</h1>
              {vendor.verified ? <Badge tone="success"><ShieldCheck size={12} /> Проверен</Badge> : <Badge tone="honey">На проверке</Badge>}
            </div>
            <p className="text-[13px] text-ink-mute mt-1.5 flex items-center gap-1.5"><MapPin size={13} /> {vendor.city} · {vendor.production_region} · на платформе с {vendor.since} года</p>
            <p className="text-[14px] text-ink-soft leading-relaxed mt-3 max-w-2xl">{vendor.description}</p>
            <div className="flex items-center gap-5 mt-4 flex-wrap">
              <Rating value={vendor.rating} />
              <span className="text-[13px] text-ink-mute">{vendor.reviewsCount} отзывов · {vendor.sales.toLocaleString("ru-RU")} продаж</span>
            </div>
          </div>
          {user && (
            <button onClick={() => setComplaintOpen(true)} className="flex items-center gap-2 h-11 px-4 rounded-[10px] border border-line text-[13px] font-semibold text-ink-soft hover:text-error hover:border-error transition-colors cursor-pointer">
              <Flag size={15} /> Пожаловаться
            </button>
          )}
        </div>

        {/* реквизиты — ст. 12 ЗоЗПП */}
        <div className="mt-6 pt-6 border-t border-line-soft grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 text-[12.5px]">
          <p><span className="text-ink-mute block">Продавец</span><span className="font-semibold text-ink">{vendor.legal_name}</span></p>
          <p><span className="text-ink-mute block">Форма</span><span className="font-semibold text-ink">{vendor.legal_form}</span></p>
          <p><span className="text-ink-mute block">ИНН</span><span className="font-semibold text-ink">{vendor.inn}</span></p>
          <p><span className="text-ink-mute block">ОГРН</span><span className="font-semibold text-ink">{vendor.ogrn}</span></p>
        </div>
      </div>

      {/* вкладки */}
      <div className="flex gap-1.5 border-b border-line-soft overflow-x-auto no-scrollbar mb-7">
        {[["goods", "Товары"], ["about", "О магазине"], ["reviews", "Отзывы"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id as typeof tab)}
            className={`px-5 py-3 text-sm font-bold whitespace-nowrap border-b-[2.5px] -mb-px transition-colors cursor-pointer ${tab === id ? "border-accent text-ink" : "border-transparent text-ink-mute hover:text-ink"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "goods" && (goods.length ? <ProductGrid items={goods} /> : (
        <p className="text-[14px] text-ink-soft text-center py-12">У мастера пока нет опубликованных товаров.</p>
      ))}

      {tab === "about" && (
        <div className="max-w-2xl space-y-4">
          <p className="text-[15px] leading-[1.75] text-ink-soft">{vendor.description}</p>
          <div className="bg-surface rounded-2xl shadow-card p-6">
            <p className="font-display font-bold text-[17px] text-ink mb-3">Производство и доставка</p>
            <div className="space-y-2 text-[13.5px] text-ink-soft">
              <p className="flex gap-2"><Store size={16} className="text-accent-deep shrink-0" /> Производство: г. {vendor.city}, {vendor.production_region}</p>
              <p className="flex gap-2"><MapPin size={16} className="text-ai shrink-0" /> Доставка: СДЭК, Boxberry, Почта России по всей России</p>
              <p className="flex gap-2"><ShieldCheck size={16} className="text-success shrink-0" /> Безопасная сделка: деньги уходят мастеру после отправки</p>
            </div>
          </div>
        </div>
      )}

      {tab === "reviews" && (
        <div className="max-w-2xl">
          <p className="text-[14px] text-ink-soft mb-4">Средний рейтинг — {vendor.rating.toFixed(1)} на основе {vendor.reviewsCount} проверенных покупок.</p>
          <div className="bg-surface rounded-2xl shadow-card p-6 text-center">
            <Rating value={vendor.rating} size={20} showValue={false} />
            <p className="text-[13px] text-ink-mute mt-3">Отзывы на товары мастера отображаются в карточках товаров.</p>
          </div>
        </div>
      )}

      <ComplaintModal open={complaintOpen} onClose={() => setComplaintOpen(false)} vendorId={vendor.id} />
    </div>
  );
}
