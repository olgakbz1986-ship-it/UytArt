import { Link } from "react-router-dom";
import { Heart, ShoppingBag, Ban, Play, Download } from "lucide-react";
import { Product, catBySlug, fmt, vendorById } from "../data/seed";
import { useAppStore } from "../lib/store";
import { Badge, ProductImg, Rating } from "./ui";
import { DIGITAL_TYPE_META, type DigitalProductType } from "../types/digital";

// Компонент AI-анимации карточки (Ken Burns + кроссфейд)
export function CardAnimation({ frames, captions, frameMs }: { frames: string[]; captions: string[]; frameMs?: number }) {
  const duration = frameMs || 2200;
  return (
    <div className="relative w-full h-full overflow-hidden bg-gray-100">
      {frames.map((frame, i) => (
        <div
          key={i}
          className="ai-frame"
          style={{
            backgroundImage: `url(${frame})`,
            animationDelay: `${i * (duration / 1000)}s`,
            animationDuration: `${(frames.length * duration) / 1000}s`,
          }}
        />
      ))}
      {captions.length > 0 && (
        <div className="ai-caption" style={{ animationDuration: `${(frames.length * duration) / 1000}s` }}>
          {captions[0]}
        </div>
      )}
    </div>
  );
}

export function ProductCard({ p, index = 0 }: { p: Product; index?: number }) {
  const toggleFav = useAppStore((s) => s.toggleFav);
  const favorites = useAppStore((s) => s.favorites);
  const onFav = favorites.includes(p.id);
  const cat = catBySlug(p.categoryId);
  const vendor = vendorById(p.vendorId);

  /* Цифровой товар (префикс id "dp-") — двойной рендер в том же layout.
     Переход ведёт на существующую страницу /digital/:id (оригинальный id). */
  if (p.digitalId) {
    const meta = DIGITAL_TYPE_META[p.digitalType as DigitalProductType];
    const toDigital = `/digital/${p.digitalId}`;
    return (
      <Link
        to={toDigital}
        className="group bg-surface rounded-2xl shadow-card hover:shadow-lift hover:-translate-y-1.5 transition-all duration-300 overflow-hidden flex flex-col fade-up"
        style={{ animationDelay: `${(index % 12) * 45}ms` }}
      >
        <div className="relative aspect-[4/3.4]">
          <ProductImg p={p} variant={index % 5} />
          <div className="absolute top-2.5 left-2.5 flex flex-col items-start gap-1.5 z-10">
            {meta && <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${meta.accentClass}`}>{meta.icon} {meta.label}</span>}
            {(p.testDriveLimit || 0) > 0 && (p.digitalType === "prompt" || p.digitalType === "agent") && (
              <Badge tone="honey">Тест-драйв</Badge>
            )}
          </div>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFav(p.id); }}
            aria-label={onFav ? "Убрать из избранного" : "В избранное"}
            className={`absolute top-2.5 right-2.5 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer z-10 ${
              onFav ? "bg-error text-white scale-105" : "bg-cream/90 text-ink-soft hover:text-error opacity-0 group-hover:opacity-100"
            }`}
          >
            <Heart size={15} fill={onFav ? "currentColor" : "none"} />
          </button>
          <span
            aria-label="Мгновенная выдача"
            className="absolute bottom-2.5 right-2.5 w-10 h-10 rounded-full bg-dark text-cream flex items-center justify-center z-10"
          >
            <Download size={17} />
          </span>
        </div>
        <div className="p-4 flex flex-col flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wide text-ink-mute mb-1.5">{p.shopName || cat?.name}</p>
          <h3 className="text-[13.5px] font-semibold leading-snug text-ink line-clamp-2 group-hover:text-accent-deep transition-colors">{p.name}</h3>
          <p className="text-[11px] text-ink-mute mt-1">{cat?.name}</p>
          <div className="mt-auto pt-3 flex items-end justify-between gap-2">
            <div>
              <span className="font-display font-bold text-[17px] text-ink">{fmt(p.price)}</span>
              <span className="block text-[11px] text-ink-soft">Версия {p.digitalVersion || "1.0"}</span>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <Rating value={p.rating} size={10} />
              <span className="text-[11px] text-ink-mute">{p.digitalSalesCount || 0} продаж</span>
            </div>
          </div>
          <p className="text-[11px] font-bold text-ink-soft mt-1.5 flex items-center gap-1"><Download size={11} /> Мгновенная выдача после оплаты</p>
          {/* Кнопки действий цифрового товара (ТЗ п.9): тест-драйв с автофокусом + покупка */}
          <div className="flex gap-2 mt-3" onClick={(e) => e.preventDefault()}>
            {(p.testDriveLimit || 0) > 0 && (p.digitalType === "prompt" || p.digitalType === "agent") && (
              <Link to={`${toDigital}?section=test-drive`}
                className="flex-1 inline-flex items-center justify-center h-10 px-4 text-[13px] font-semibold rounded-[10px] border border-line bg-surface text-ink hover:bg-cream transition-all duration-200">
                Тест-драйв
              </Link>
            )}
            <Link to={toDigital}
              className="flex-1 inline-flex items-center justify-center h-10 px-4 text-[13px] font-semibold rounded-[10px] bg-dark text-cream hover:bg-dark-deep transition-all duration-200">
              Купить
            </Link>
          </div>
        </div>
      </Link>
    );
  }

  const addToCart = useAppStore((s) => s.addToCart);
  return (
    <Link
      to={`/product/${p.slug}`}
      className="group bg-surface rounded-2xl shadow-card hover:shadow-lift hover:-translate-y-1.5 transition-all duration-300 overflow-hidden flex flex-col fade-up"
      style={{ animationDelay: `${(index % 12) * 45}ms` }}
    >
      <div className="relative aspect-[4/3.4]">
        {p.animation ? (
          <>
            <CardAnimation frames={p.animation.frames} captions={p.animation.captions} frameMs={p.animation.frameMs} />
            <span className="absolute top-2.5 right-2.5 bg-black/80 text-white text-xs font-bold px-2 py-1 rounded z-20 animate-pulse flex items-center gap-1">
              <Play size={10} fill="currentColor" /> AI-видео
            </span>
          </>
        ) : (
          <ProductImg p={p} variant={index % 5} />
        )}
        <div className="absolute top-2.5 left-2.5 flex flex-col items-start gap-1.5 z-10">
          {p.oldPrice && <Badge tone="honey">−{Math.round((1 - p.price / p.oldPrice) * 100)}%</Badge>}
          {p.isHit && <Badge tone="premium">Хит</Badge>}
          {p.isNew && <Badge tone="dark">Новинка</Badge>}
          {p.is_non_returnable && <Badge tone="error"><Ban size={10} /> На заказ</Badge>}
        </div>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFav(p.id); }}
          aria-label={onFav ? "Убрать из избранного" : "В избранное"}
          className={`absolute top-2.5 right-2.5 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer z-10 ${
            onFav ? "bg-error text-white scale-105" : "bg-cream/90 text-ink-soft hover:text-error opacity-0 group-hover:opacity-100"
          }`}
        >
          <Heart size={15} fill={onFav ? "currentColor" : "none"} />
        </button>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); addToCart(p.id); }}
          aria-label="Добавить в корзину"
          className="absolute bottom-2.5 right-2.5 w-10 h-10 rounded-full bg-dark text-cream flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-300 cursor-pointer hover:bg-accent hover:text-ink z-10"
        >
          <ShoppingBag size={17} />
        </button>
      </div>
      <div className="p-4 flex flex-col flex-1">
        <p className="text-[11px] font-bold uppercase tracking-wide text-ink-mute mb-1.5">{vendor?.name}</p>
        <h3 className="text-[13.5px] font-semibold leading-snug text-ink line-clamp-2 group-hover:text-accent-deep transition-colors">{p.name}</h3>
        <p className="text-[11px] text-ink-mute mt-1">{cat?.name}</p>
        <div className="mt-auto pt-3 flex items-end justify-between gap-2">
          <div>
            <span className="font-display font-bold text-[17px] text-ink">{fmt(p.price)}</span>
            {p.oldPrice && <span className="block text-[12px] text-ink-mute line-through">{fmt(p.oldPrice)}</span>}
          </div>
          <Rating value={p.rating} size={10} />
        </div>
        {p.stock === 0 && <p className="text-[11px] font-bold text-ink-soft mt-1.5">Под заказ · {p.production_time_days || 14} дней</p>}
      </div>
    </Link>
  );
}

export function ProductGrid({ items }: { items: Product[] }) {
  /* ТЗ 9.4: 2 колонки на мобильных → 3 на планшетах → 4 на десктопе → 5 на больших экранах */
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 xs:gap-4 sm:gap-5">
      {items.map((p, i) => <ProductCard key={p.id} p={p} index={i} />)}
    </div>
  );
}
