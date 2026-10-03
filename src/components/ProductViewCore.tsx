import { useState } from "react";
import { ShoppingBag, Heart, MessageSquare, Star, MapPin } from "lucide-react";
import { SpecSections } from "./SpecSections";

export interface ProductViewCoreProps {
  name: string;
  price: number;
  media: { type: "image" | "video"; url: string }[];
  description: string;
  categoryName: string;
  manufacturer?: string;
  sku?: string;
  tags?: string[];
  specs?: { id: string; key: string; value: string }[];
  sellerCity?: string;
  sellerName?: string;
  processingDays?: string;
  interactive?: boolean;
}

export function ProductViewCore(p: ProductViewCoreProps) {
  const [tab, setTab] = useState<"desc" | "specs" | "delivery" | "reviews">("desc");
  const [mainIdx, setMainIdx] = useState(0);
  const media = p.media && p.media.length ? p.media : [];
  const main = media[mainIdx] || media[0];

  return (
    <div className="bg-surface rounded-2xl shadow-card overflow-hidden">
      {/* ВЕРХ: галерея + инфо */}
      <div className="grid md:grid-cols-2 gap-8 p-6 md:p-8">
        {/* Галерея */}
        <div>
          <div className="relative aspect-square rounded-2xl overflow-hidden bg-line-soft">
            {main ? (
              main.type === "video" ? (
                <video src={main.url} className="w-full h-full object-cover" muted controls={p.interactive} />
              ) : (
                <img src={main.url} alt={p.name} className="w-full h-full object-cover" />
              )
            ) : (
              <div className="w-full h-full flex items-center justify-center text-ink-mute text-[14px]">Нет фото</div>
            )}
            <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-dark text-cream text-[11px] font-bold">Новинка</span>
          </div>
          {media.length > 1 && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {media.map((m, i) => (
                <button key={i} type="button" onClick={() => setMainIdx(i)}
                  className={`w-16 h-16 rounded-lg overflow-hidden border-2 cursor-pointer ${i === mainIdx ? "border-accent" : "border-transparent opacity-70 hover:opacity-100"}`}>
                  {m.type === "video" ? <video src={m.url} className="w-full h-full object-cover" muted /> : <img src={m.url} className="w-full h-full object-cover" alt="" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Инфо */}
        <div>
          <h2 className="font-display font-bold text-[28px] text-ink mb-1">{p.name || "Название товара"}</h2>
          <div className="flex items-center gap-2 text-[12px] text-ink-mute mb-3">
            <span className="flex items-center gap-0.5">{[...Array(5)].map((_, i) => <Star key={i} size={13} className="text-line" fill="currentColor" />)}</span>
            <span>0.0</span><span>0 отзывов</span>{p.sku && <span>· арт. {p.sku}</span>}
          </div>
          <div className="text-[30px] font-bold text-ink mb-1">{p.price ? p.price.toLocaleString("ru-RU") : "0"} ₽</div>
          <div className="flex items-center gap-1.5 text-[12px] text-success font-semibold mb-4">
            <span className="w-2 h-2 rounded-full bg-success" /> В наличии: 99 шт
          </div>

          <div className="flex gap-2 mb-3">
            <button type="button" disabled={!p.interactive} className="flex-1 h-11 rounded-[10px] bg-accent text-ink font-bold flex items-center justify-center gap-2 disabled:opacity-90 cursor-pointer">
              <ShoppingBag size={17} /> В корзину
            </button>
            <button type="button" disabled={!p.interactive} className="w-11 h-11 rounded-[10px] border border-line flex items-center justify-center text-ink-mute">
              <Heart size={17} />
            </button>
          </div>
          <button type="button" disabled={!p.interactive} className="w-full h-11 rounded-[10px] border border-line flex items-center justify-center gap-2 text-[13px] font-semibold text-ink mb-4">
            <MessageSquare size={16} /> Написать продавцу
          </button>

          <div className="rounded-xl border border-line-soft p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-dark text-cream flex items-center justify-center font-bold">{(p.sellerName || "П").slice(0, 1).toUpperCase()}</div>
              <div>
                <div className="text-[13px] font-bold text-ink">{p.sellerName || "Продавец"}</div>
                <div className="flex items-center gap-1 text-[11px] text-ink-mute"><MapPin size={11} /> {p.sellerCity || "Россия"}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ВКЛАДКИ */}
      <div className="border-t border-line-soft px-6 md:px-8">
        <div className="flex gap-1 overflow-x-auto">
          {([["desc", "Описание"], ["specs", "Характеристики"], ["delivery", "Доставка"], ["reviews", "Отзывы"]] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setTab(id)}
              className={`px-5 py-3 text-sm font-bold whitespace-nowrap border-b-[2.5px] -mb-px transition-colors cursor-pointer ${tab === id ? "border-accent text-ink" : "border-transparent text-ink-mute hover:text-ink"}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="py-7">
          {tab === "desc" && <p className="text-[15px] leading-[1.75] text-ink-soft whitespace-pre-wrap">{p.description || "Описание не заполнено"}</p>}
          {tab === "specs" && (
            <div className="space-y-4">
              <div className="bg-surface rounded-2xl shadow-card overflow-hidden border border-line-soft">
                {[["Материалы", "—"], ["Производитель", p.manufacturer || "—"], ["Теги", (p.tags || []).map((t) => "#" + t).join(" ") || "—"], ["Категория", p.categoryName || "—"], ["Артикул", p.sku || "—"]]
                  .filter(([, v]) => v && v !== "—")
                  .map(([k, v], i) => (
                    <div key={k} className={`flex justify-between gap-4 px-5 py-3 text-[14px] ${i % 2 ? "bg-cream/50" : ""}`}>
                      <span className="text-ink-soft">{k}</span><span className="font-semibold text-ink text-right">{v}</span>
                    </div>
                  ))}
              </div>
              <SpecSections category={p.categoryName || ""} specs={p.specs || []} />
            </div>
          )}
          {tab === "delivery" && (
            <div className="space-y-3 text-[14px] text-ink-soft leading-relaxed">
              <p><strong className="text-ink">Отправка:</strong> {p.sellerCity ? `из г. ${p.sellerCity}` : "по России"}</p>
              <p><strong className="text-ink">Обработка заказа:</strong> {p.processingDays || "1"} дн.</p>
              <p>СДЭК, Boxberry и Почта России — 2–7 дней по России.</p>
            </div>
          )}
          {tab === "reviews" && <p className="text-[14px] text-ink-mute">Отзывов пока нет — станьте первым!</p>}
        </div>
      </div>
    </div>
  );
}
