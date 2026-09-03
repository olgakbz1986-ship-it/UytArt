import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { MapPin, Ban, Minus, Plus, ShoppingBag, Heart, ShieldCheck, MessageSquare } from "lucide-react";
import {
  GROUPS, GROUP_IMG, PRODUCTS, fmt, fmtDate, catBySlug, groupById, catsByGroup, catImage,
  vendorById, productBySlug,
} from "../data/seed";
import { canDeliver, DISTRICTS, DistrictId } from "../lib/geo";
import { useAppStore } from "../lib/store";
import { useSubStore, buyerLimits } from "../lib/subscriptions";
import { ProductGrid } from "../components/product";
import { Badge, Btn, GroupImg, ProductImg, Rating } from "../components/ui";
import { ChatModal } from "../components/chat";
import { ReviewsSection } from "../components/review";

type SortId = "popular" | "price-asc" | "price-desc" | "new" | "rating";
const SORTS: { id: SortId; label: string }[] = [
  { id: "popular", label: "По популярности" },
  { id: "price-asc", label: "Сначала дешевле" },
  { id: "price-desc", label: "Сначала дороже" },
  { id: "new", label: "По новизне" },
  { id: "rating", label: "По рейтингу" },
];

function Crumbs({ parts }: { parts: { label: string; to?: string }[] }) {
  return (
    <nav className="flex items-center gap-1.5 text-[12.5px] text-ink-mute flex-wrap mb-4" aria-label="Хлебные крошки">
      <Link to="/catalog" className="hover:text-accent-deep transition-colors font-semibold">Каталог</Link>
      {parts.map((p, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <span>/</span>
          {p.to ? <Link to={p.to} className="hover:text-accent-deep transition-colors font-semibold">{p.label}</Link> : <span className="text-ink-soft font-semibold">{p.label}</span>}
        </span>
      ))}
    </nav>
  );
}

export function CatalogPage() {
  const [sp] = useSearchParams();
  const group = sp.get("group") || "all";
  const cat = sp.get("cat") || "all";
  const sub = sp.get("sub") || "all";
  const q = (sp.get("q") || "").trim().toLowerCase();
  const [sort, setSort] = useState<SortId>("popular");
  const [inStock, setInStock] = useState(false);
  const [region, setRegion] = useState<DistrictId | "all">("all");
  const [showOther, setShowOther] = useState(true);
  const [quality, setQuality] = useState(false);

  const buyerPlan = useSubStore((s) => s.buyerPlan);
  const lim = buyerLimits(buyerPlan);

  const activeGroup = groupById(group);
  const activeCat = catBySlug(cat);
  const activeSub = activeCat?.subs.find((s) => s.slug === sub);
  const groupCats = catsByGroup(group);
  const browseMode = !q && group === "all" && cat === "all";

  const items = useMemo(() => {
    let l = [...PRODUCTS];
    if (q) {
      l = l.filter((p) => {
        const c = catBySlug(p.categoryId);
        const g = c ? groupById(c.group) : undefined;
        const subName = c?.subs.find((s) => s.slug === p.sub)?.name.toLowerCase() ?? "";
        return (
          p.name.toLowerCase().includes(q) ||
          p.material.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q)) ||
          subName.includes(q) ||
          (c?.name.toLowerCase().includes(q) ?? false) ||
          (g?.name.toLowerCase().includes(q) ?? false)
        );
      });
    } else if (sub !== "all" && cat !== "all") {
      l = l.filter((p) => p.categoryId === cat && p.sub === sub);
    } else if (cat !== "all") {
      l = l.filter((p) => p.categoryId === cat);
    } else if (group !== "all") {
      l = l.filter((p) => catBySlug(p.categoryId)?.group === group);
    }
    if (inStock) l = l.filter((p) => p.stock > 0);
    if (region !== "all" && !showOther) l = l.filter((p) => canDeliver(p, region));
    /* премиум-фильтр качества: рейтинг мастера от 4.8 + ручная работа */
    if (quality && lim.qualityFilters) {
      l = l.filter((p) => (vendorById(p.vendorId)?.rating || 0) >= 4.8);
    }
    switch (sort) {
      case "price-asc": return l.sort((a, b) => a.price - b.price);
      case "price-desc": return l.sort((a, b) => b.price - a.price);
      case "new": return l.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
      case "rating": return l.sort((a, b) => b.rating - a.rating);
      default: return l.sort((a, b) => (b.isHit ? 1 : 0) + b.views / 10000 - ((a.isHit ? 1 : 0) + a.views / 10000));
    }
  }, [group, cat, sub, q, sort, inStock, region, showOther, quality, lim.qualityFilters]);

  return (
    <div className="max-w-[1320px] mx-auto px-4 sm:px-6 py-8">
      <Crumbs parts={[
        ...(activeGroup ? [{ label: activeGroup.name, to: `/catalog?group=${activeGroup.id}` }] : []),
        ...(activeCat ? [{ label: activeCat.name, to: `/catalog?cat=${activeCat.slug}` }] : []),
        ...(activeSub ? [{ label: activeSub.name }] : []),
      ]} />

      <div className="flex items-end justify-between flex-wrap gap-4 mt-2 mb-7">
        <div>
          <h1 className="font-display font-bold text-[clamp(26px,3vw,34px)] text-ink">
            {q ? `По запросу «${q}»` : activeSub ? activeSub.name : activeCat ? activeCat.name : activeGroup ? activeGroup.name : "Каталог"}
          </h1>
          <p className="text-sm text-ink-soft mt-1.5 max-w-xl">
            {q ? `Найдено ${items.length} товаров.` : activeCat ? activeCat.desc : activeGroup ? activeGroup.desc : "От авторского декора до техники и одежды — выбирайте группу."}
          </p>
        </div>
      </div>

      {/* верхний уровень — группы (при просмотре «всё») */}
      {browseMode && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-8">
          {GROUPS.map((g, i) => (
            <Link key={g.id} to={`/catalog?group=${g.id}`}
              className="group relative rounded-2xl overflow-hidden shadow-card hover:shadow-lift hover:-translate-y-1.5 transition-all duration-300 block bg-surface fade-up"
              style={{ animationDelay: `${(i % 8) * 50}ms` }}>
              <div className="aspect-[4/3]">
                <GroupImg src={GROUP_IMG[g.id]} emoji={g.emoji} alt={g.name} pos={i} />
              </div>
              <div className="p-4">
                <span className="block font-bold text-[15px] text-ink leading-tight group-hover:text-accent-deep transition-colors">{g.name}</span>
                <span className="block text-[11.5px] text-ink-mute mt-1 leading-snug">{catsByGroup(g.id).length} категорий</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* второй уровень — категории группы */}
      {!q && group !== "all" && (
        <>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-5">
            <button onClick={() => (window.location.hash = `#/catalog?group=${group}`)}
              className={`shrink-0 px-4 min-h-[44px] rounded-full text-[13px] font-bold transition-all duration-200 cursor-pointer ${cat === "all" ? "bg-dark text-cream" : "bg-surface border border-line text-ink-soft hover:border-dark hover:text-ink"}`}>
              Все
            </button>
            {groupCats.map((c) => (
              <button key={c.slug} onClick={() => (window.location.hash = `#/catalog?cat=${c.slug}`)}
                className={`shrink-0 px-4 min-h-[44px] rounded-full text-[13px] font-bold transition-all duration-200 cursor-pointer ${cat === c.slug ? "bg-dark text-cream" : "bg-surface border border-line text-ink-soft hover:border-dark hover:text-ink"}`}>
                {c.emoji} {c.name}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3.5 mb-8">
            {groupCats.map((c, ci) => (
              <Link key={c.slug} to={`/catalog?cat=${c.slug}`}
                className="group bg-surface rounded-2xl shadow-card hover:shadow-lift hover:-translate-y-1 transition-all duration-300 overflow-hidden">
                <div className="aspect-[16/10]">
                  <GroupImg src={catImage(c.slug)} emoji={c.emoji} alt={c.name} pos={ci + 1} />
                </div>
                <div className="p-3.5">
                  <span className="block font-bold text-[13.5px] text-ink leading-tight group-hover:text-accent-deep transition-colors">{c.name}</span>
                  <span className="block text-[11px] text-ink-mute mt-0.5">{c.subs.length} подкатегорий</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* третий уровень — подкатегории */}
      {!q && cat !== "all" && activeCat && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-6">
          <button onClick={() => (window.location.hash = `#/catalog?cat=${cat}`)}
            className={`shrink-0 px-3.5 min-h-[40px] rounded-full text-[12.5px] font-semibold transition-all duration-200 cursor-pointer ${sub === "all" ? "bg-accent text-ink" : "bg-line-soft text-ink-soft hover:bg-line"}`}>
            Все
          </button>
          {activeCat.subs.map((s) => (
            <button key={s.slug} onClick={() => (window.location.hash = `#/catalog?cat=${cat}&sub=${s.slug}`)}
              className={`shrink-0 px-3.5 min-h-[40px] rounded-full text-[12.5px] font-semibold transition-all duration-200 cursor-pointer ${sub === s.slug ? "bg-accent text-ink" : "bg-line-soft text-ink-soft hover:bg-line"}`}>
              {s.name}
            </button>
          ))}
        </div>
      )}

      {/* панель управления */}
      {!browseMode && (
        <div className="flex items-center gap-3 flex-wrap mb-6">
          <span className="text-sm text-ink-soft">
            <span className="font-display font-bold text-ink">{items.length}</span>{" "}
            {items.length === 1 ? "товар" : items.length < 5 ? "товара" : "товаров"}
          </span>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <label className="flex items-center gap-2 text-[13px] font-semibold text-ink-soft cursor-pointer select-none">
              <input type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} /> В наличии
            </label>
            {lim.qualityFilters ? (
              <label className="flex items-center gap-2 text-[13px] font-semibold text-ink-soft cursor-pointer select-none">
                <input type="checkbox" checked={quality} onChange={(e) => setQuality(e.target.checked)} /> Премиум-качество
              </label>
            ) : (
              <Link to="/plans" className="text-[12.5px] font-bold text-premium" title="Доступно на платных тарифах">★ Премиум-фильтры</Link>
            )}
            <select value={region} onChange={(e) => setRegion(e.target.value as DistrictId | "all")} aria-label="Регион доставки"
              className="h-[44px] px-3.5 rounded-[10px] border border-line bg-surface text-sm text-ink font-medium cursor-pointer outline-none focus:border-ai">
              <option value="all">🌍 Вся Россия</option>
              {DISTRICTS.map((d) => <option key={d.id} value={d.id}>{d.name} округ</option>)}
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortId)} aria-label="Сортировка"
              className="h-[44px] px-3.5 rounded-[10px] border border-line bg-surface text-sm text-ink font-medium cursor-pointer outline-none focus:border-ai">
              {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        </div>
      )}

      {region !== "all" && !browseMode && (
        <div className="flex items-center gap-2.5 bg-ai-soft border border-ai/20 rounded-[10px] px-4 py-3 mb-6 fade-up">
          <MapPin size={16} className="text-ai shrink-0" />
          <p className="text-[13px] text-ink flex-1">
            Выбран <strong>{DISTRICTS.find((d) => d.id === region)?.name}</strong> округ. Крупногабарит показывается только от мастеров, которые сюда доставляют.
          </p>
          <label className="flex items-center gap-2 text-[13px] font-semibold text-ink-soft cursor-pointer select-none whitespace-nowrap">
            <input type="checkbox" checked={showOther} onChange={(e) => setShowOther(e.target.checked)} /> Показывать из других регионов
          </label>
        </div>
      )}

      {!browseMode && (
        items.length ? (
          <ProductGrid items={items} />
        ) : (
          <div className="bg-surface rounded-2xl shadow-card px-8 py-16 text-center">
            <p className="text-[44px] mb-3">🔍</p>
            <p className="font-display font-bold text-[20px] text-ink mb-2">Ничего не нашлось</p>
            <p className="text-[14px] text-ink-soft">Попробуйте другой запрос или сбросьте фильтры.</p>
          </div>
        )
      )}
    </div>
  );
}

/* ============================================================
   Карточка товара
   ============================================================ */
export function ProductPage() {
  const { slug = "" } = useParams();
  const p = productBySlug(slug);
  const addToCart = useAppStore((s) => s.addToCart);
  const toggleFav = useAppStore((s) => s.toggleFav);
  const favs = useAppStore((s) => s.favorites);
  const [qty, setQty] = useState(1);
  const [variant, setVariant] = useState(0);
  const [tab, setTab] = useState<"desc" | "specs" | "delivery" | "reviews">("desc");
  const [chatOpen, setChatOpen] = useState(false);

  const cat = p ? catBySlug(p.categoryId) : undefined;
  const vendor = p ? vendorById(p.vendorId) : undefined;
  const similar = useMemo(
    () => (p ? PRODUCTS.filter((x) => x.categoryId === p.categoryId && x.id !== p.id).slice(0, 4) : []),
    [p]
  );

  if (!p) {
    return (
      <div className="max-w-[700px] mx-auto px-4 py-24 text-center">
        <p className="text-[56px] mb-3">🧐</p>
        <h1 className="font-display font-bold text-[28px] text-ink mb-3">Товар не найден</h1>
        <Link to="/catalog" className="inline-flex items-center justify-center h-11 px-6 rounded-[10px] bg-dark text-cream text-sm font-semibold hover:bg-dark-deep transition-colors">В каталог</Link>
      </div>
    );
  }

  const onFav = favs.includes(p.id);
  const custom = p.is_non_returnable;

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8">
      <Crumbs parts={[
        { label: cat ? (groupById(cat.group)?.name || "") : "", to: cat ? `/catalog?group=${cat.group}` : undefined },
        { label: cat?.name || "", to: cat ? `/catalog?cat=${cat.slug}` : undefined },
        { label: p.name },
      ]} />

      <div className="grid lg:grid-cols-2 gap-10 items-start">
        <div>
          <div className="rounded-2xl overflow-hidden shadow-card aspect-square group">
            <ProductImg p={p} variant={variant} />
          </div>
          <div className="flex gap-2.5 mt-3.5">
            {[0, 1, 2, 3].map((v) => (
              <button key={v} onClick={() => setVariant(v)} aria-label={`Вариант фото ${v + 1}`}
                className={`w-[76px] h-[64px] rounded-xl overflow-hidden border-2 transition-all duration-200 cursor-pointer group ${variant === v ? "border-accent shadow-card" : "border-transparent opacity-70 hover:opacity-100"}`}>
                <ProductImg p={p} variant={v} />
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex flex-wrap gap-2 mb-3">
            {p.isHit && <Badge tone="premium">Хит</Badge>}
            {p.isNew && <Badge tone="dark">Новинка</Badge>}
            {p.oldPrice && <Badge tone="honey">−{Math.round((1 - p.price / p.oldPrice) * 100)}%</Badge>}
            {custom && <Badge tone="error"><Ban size={12} /> Товар на заказ: возврат невозможен</Badge>}
          </div>
          <h1 className="font-display font-bold text-[clamp(24px,3vw,32px)] leading-tight text-ink">{p.name}</h1>
          <div className="flex items-center gap-3 mt-2.5 flex-wrap">
            <Rating value={p.rating} />
            <span className="text-[12.5px] text-ink-mute">{p.reviewsCount} отзывов · арт. {p.sku}</span>
          </div>

          <div className="flex items-end gap-3.5 mt-5">
            <span className="font-display font-extrabold text-[34px] leading-none text-ink">{fmt(p.price)}</span>
            {p.oldPrice && <span className="text-lg text-ink-mute line-through mb-0.5">{fmt(p.oldPrice)}</span>}
          </div>
          <p className="text-[13px] mt-2.5 flex items-center gap-2">
            {p.stock > 0
              ? <><span className="w-2 h-2 rounded-full bg-success" /><span className="text-[#4d7327] font-bold">В наличии: {p.stock} шт</span></>
              : <><span className="w-2 h-2 rounded-full bg-ink-mute" /><span className="text-ink-soft font-bold">Под заказ{p.production_time_days ? ` · изготовление ${p.production_time_days} дней` : ""}</span></>}
          </p>

          <div className="flex items-center gap-3 mt-6 flex-wrap">
            <div className="flex items-center border border-line rounded-[10px] bg-surface overflow-hidden">
              <button onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Меньше" className="w-11 h-[46px] flex items-center justify-center text-ink-soft hover:bg-line-soft cursor-pointer transition-colors"><Minus size={16} /></button>
              <span className="w-10 text-center font-bold text-[15px] text-ink">{qty}</span>
              <button onClick={() => setQty(qty + 1)} aria-label="Больше" className="w-11 h-[46px] flex items-center justify-center text-ink-soft hover:bg-line-soft cursor-pointer transition-colors"><Plus size={16} /></button>
            </div>
            <Btn size="lg" className="flex-1 min-w-[200px]" onClick={() => addToCart(p.id, qty)}>
              <ShoppingBag size={18} /> В корзину
            </Btn>
            <button onClick={() => toggleFav(p.id)} aria-label="В избранное"
              className={`w-[52px] h-[52px] rounded-[10px] flex items-center justify-center transition-colors cursor-pointer ${onFav ? "bg-error text-white" : "border border-line bg-surface text-ink-soft hover:text-error"}`}>
              <Heart size={20} fill={onFav ? "currentColor" : "none"} />
            </button>
          </div>

          <div className="mt-3.5">
            <Btn variant="outline" className="w-full" onClick={() => setChatOpen(true)}>
              <MessageSquare size={17} /> Написать продавцу
            </Btn>
          </div>

          {/* продавец — обязателен по ст. 12 ЗоЗПП */}
          <div className="mt-7 bg-surface rounded-2xl shadow-card p-5">
            <div className="flex items-center gap-3.5">
              <span className="w-12 h-12 rounded-[14px] flex items-center justify-center text-[22px] text-cream" style={{ background: vendor?.avatarColor }}>{vendor?.emoji}</span>
              <div className="flex-1 min-w-0">
                <Link to={`/shop/${vendor?.slug}`} className="font-bold text-[15px] text-ink hover:text-accent-deep transition-colors">{vendor?.name}</Link>
                <p className="text-[12px] text-ink-mute flex items-center gap-1.5 mt-0.5">
                  <MapPin size={12} /> {vendor?.city} · <Rating value={vendor?.rating || 0} size={10} />
                </p>
              </div>
              {vendor?.verified
                ? <Badge tone="success"><ShieldCheck size={12} /> Проверен</Badge>
                : <Badge tone="honey">На проверке</Badge>}
            </div>
            <div className="mt-4 pt-4 border-t border-line-soft grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12.5px]">
              <p><span className="text-ink-mute">Продавец:</span> <span className="font-semibold text-ink">{vendor?.legal_name}</span></p>
              <p><span className="text-ink-mute">ИНН:</span> <span className="font-semibold text-ink">{vendor?.inn}</span></p>
              <p className="col-span-2"><span className="text-ink-mute">ОГРН:</span> <span className="font-semibold text-ink">{vendor?.ogrn}</span></p>
            </div>
          </div>
        </div>
      </div>

      {/* вкладки */}
      <div className="mt-12">
        <div className="flex gap-1.5 border-b border-line-soft overflow-x-auto no-scrollbar">
          {[["desc", "Описание"], ["specs", "Характеристики"], ["delivery", "Доставка"], ["reviews", "Отзывы"]].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id as typeof tab)}
              className={`px-5 py-3 text-sm font-bold whitespace-nowrap border-b-[2.5px] -mb-px transition-colors cursor-pointer ${tab === id ? "border-accent text-ink" : "border-transparent text-ink-mute hover:text-ink"}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="py-7 max-w-3xl">
          {tab === "desc" && <p className="text-[15px] leading-[1.75] text-ink-soft">{p.description}</p>}
          {tab === "specs" && (
            <div className="bg-surface rounded-2xl shadow-card overflow-hidden">
              {[["Материал", p.material], ["Стиль", p.style], ["Цвет", p.color], ["Размер", p.size], ["Категория", cat?.name || ""], ["Артикул", p.sku], ["Тип", custom ? "На заказ (custom-made)" : "Готовый (ready-made)"], ["Добавлен", fmtDate(p.createdAt)]].map(([k, v], i) => (
                <div key={k} className={`flex justify-between gap-4 px-5 py-3 text-[14px] ${i % 2 ? "bg-cream/50" : ""}`}>
                  <span className="text-ink-soft">{k}</span><span className="font-semibold text-ink text-right">{v}</span>
                </div>
              ))}
            </div>
          )}
          {tab === "delivery" && (
            <div className="space-y-3 text-[14px] text-ink-soft leading-relaxed">
              <p className="flex gap-2.5"><ShieldCheck size={17} className="text-success shrink-0 mt-0.5" /> <span><strong className="text-ink">Безопасная сделка:</strong> деньги резервируются на транзитном счёте и уходят мастеру только после отправки.</span></p>
              <p className="flex gap-2.5"><MapPin size={17} className="text-ai shrink-0 mt-0.5" /> <span>СДЭК, Boxberry и Почта России — 2–7 дней по России. Отправка из г. {vendor?.city}.</span></p>
              <p className="flex gap-2.5"><Ban size={17} className="text-error shrink-0 mt-0.5" /> <span>{custom ? "Товар изготавливается по индивидуальным параметрам и возврату не подлежит (абз. 4 п. 4 ст. 26.1 ЗоЗПП)." : "Возврат в течение 7 дней с момента получения (ст. 26.1 ЗоЗПП)."}</span></p>
            </div>
          )}
          {tab === "reviews" && <ReviewsSection product={p} />}
        </div>
      </div>

      {/* похожие */}
      {similar.length > 0 && (
        <div className="mt-10">
          <h2 className="font-display font-bold text-[22px] text-ink mb-5">Похожие товары</h2>
          <ProductGrid items={similar} />
        </div>
      )}

      <ChatModal open={chatOpen} onClose={() => setChatOpen(false)} kind="product" product={p} />
    </div>
  );
}
