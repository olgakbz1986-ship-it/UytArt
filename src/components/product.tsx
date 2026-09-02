import { Link } from "react-router-dom";
import { Heart, ShoppingBag } from "lucide-react";
import { Product, catBySlug, fmt, vendorById } from "../data/seed";
import { useAppStore } from "../lib/store";
import { Badge, ProductImg, Rating } from "./ui";

export function ProductCard({ p, index = 0 }: { p: Product; index?: number }) {
  const addToCart = useAppStore((s) => s.addToCart);
  const toggleFav = useAppStore((s) => s.toggleFav);
  const favorites = useAppStore((s) => s.favorites);
  const onFav = favorites.includes(p.id);
  const cat = catBySlug(p.categoryId);
  const vendor = vendorById(p.vendorId);

  return (
    <Link
      to={`/product/${p.slug}`}
      className="group bg-surface rounded-2xl shadow-card hover:shadow-lift hover:-translate-y-1.5 transition-all duration-300 overflow-hidden flex flex-col fade-up"
      style={{ animationDelay: `${(index % 12) * 45}ms` }}
    >
      <div className="relative aspect-[4/3.4]">
        <ProductImg p={p} variant={index % 5} />
        <div className="absolute top-2.5 left-2.5 flex flex-col items-start gap-1.5 z-10">
          {p.oldPrice && <Badge tone="honey">−{Math.round((1 - p.price / p.oldPrice) * 100)}%</Badge>}
          {p.isHit && <Badge tone="premium">Хит</Badge>}
          {p.isNew && <Badge tone="dark">Новинка</Badge>}
          {p.is_non_returnable && <Badge tone="error">На заказ</Badge>}
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
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
      {items.map((p, i) => <ProductCard key={p.id} p={p} index={i} />)}
    </div>
  );
}
