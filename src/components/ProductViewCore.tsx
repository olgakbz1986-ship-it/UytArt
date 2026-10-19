import { useEffect, useState } from "react";
import { ShoppingBag, Heart, MessageSquare, Star, MapPin , Building2, Truck, PackageCheck, Wrench, ShieldCheck } from "lucide-react";
import { SellerAboutModal } from "./SellerAboutModal";
import { SpecSections } from "./SpecSections";

/* ЭТАП 2 (п.3): контракт ответа серверного калькулятора логистики
   GET /api/products/:id/logistics (server/index.cjs) совпадает с типом
   LogisticsResp внутри компонента и с карточкой товара в каталоге. */

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
  /* ID товара на сервере — при наличии карточка запрашивает персональное
     предложение доставки для города текущего покупателя. */
  productId?: string;
  /* Явный город покупателя (например, из профиля/адреса по умолчанию).
     Если не задан — сервер резолвит город из сессии пользователя. */
  buyerCity?: string;
  /* Товар крупногабаритный с монтажом — показываем подтверждение установки. */
  hasInstall?: boolean;
}

export function ProductViewCore(p: ProductViewCoreProps) {
  const [tab, setTab] = useState<"desc" | "specs" | "delivery" | "reviews">("desc");
  const [sellerAboutOpen, setSellerAboutOpen] = useState(false);

  /* ЭТАП 2 (п.3): динамический калькулятор логистики. При открытии карточки
     система запрашивает у сервера персональное предложение доставки для пары
     «город продавца → город покупателя» (СДЭК / Почта России: цена и сроки),
     а также подтверждение монтажа в городе покупателя. Расчёт выполняется на
     сервере — клиент не подменит ни тариф, ни географию.
     Контракт совпадает с LogisticsResp в src/pages/catalog.tsx (тот же эндпоинт). */
  interface QuoteOption { carrier: string; title: string; price: number; daysMin: number; daysMax: number }
  interface LogisticsResp {
    ok: boolean;
    sellerCity?: string;
    buyerCity?: string | null;
    deliverable: boolean;
    installAvailable: boolean;
    quote: null | { km: number; from: string; to: string; options: QuoteOption[] };
  }
  const [logistics, setLogistics] = useState<LogisticsResp | null>(null);
  const [logisticsLoading, setLogisticsLoading] = useState(false);
  useEffect(() => {
    if (!p.productId) { setLogistics(null); return; }
    let cancelled = false;
    setLogisticsLoading(true);
    const qs = p.buyerCity ? "?city=" + encodeURIComponent(p.buyerCity) : "";
    fetch(`/api/products/${encodeURIComponent(p.productId)}/logistics${qs}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!cancelled && j && j.ok) setLogistics(j as LogisticsResp); })
      .catch(() => { /* деградация: показываем статичный блок без расчёта */ })
      .finally(() => { if (!cancelled) setLogisticsLoading(false); });
    return () => { cancelled = true; };
  }, [p.productId, p.buyerCity]);
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

          <div className="rounded-xl border border-line-soft overflow-hidden">
            <div className="flex items-center gap-3 p-4">
              <div className="w-10 h-10 rounded-lg bg-dark text-cream flex items-center justify-center font-bold">{(p.sellerName || "П").slice(0, 1).toUpperCase()}</div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold text-ink truncate">{p.sellerName || "Продавец"}</div>
                <div className="flex items-center gap-1 text-[11px] text-ink-mute"><MapPin size={11} /> {p.sellerCity || "Россия"}</div>
              </div>
            </div>
            <button type="button" onClick={() => setSellerAboutOpen(true)}
              className="w-full border-t border-line-soft px-4 py-3 text-[12px] font-bold text-accent-deep hover:bg-accent/5 transition-colors flex items-center justify-between gap-2 cursor-pointer">
              <span className="flex items-center gap-1.5"><Building2 size={13} /> Подробнее о продавце</span>
              <span className="text-[16px]">›</span>
            </button>
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
              <p><strong className="text-ink">Отправка:</strong> {logistics?.sellerCity || p.sellerCity ? `из г. ${logistics?.sellerCity || p.sellerCity}` : "по России"}</p>
              <p><strong className="text-ink">Обработка заказа:</strong> {p.processingDays || "1"} дн.</p>

              {/* ЭТАП 2 (п.3): персональное предложение доставки для города
                  покупателя — серверный расчёт СДЭК / Почты России. */}
              {logisticsLoading && <p className="text-[13px] text-ink-mute animate-pulse">Рассчитываем доставку для вашего города…</p>}
              {!logisticsLoading && logistics?.quote && (
                <div className="rounded-xl border border-line-soft overflow-hidden mt-2">
                  <div className="px-4 py-2.5 bg-cream/60 text-[12px] font-bold text-ink flex items-center gap-1.5">
                    <Truck size={13} /> Доставка в {logistics.buyerCity} · {logistics.quote.km} км от {(logistics.sellerCity || p.sellerCity || "").replace(/^г\.?\s*/i, "")}
                  </div>
                  <div className="divide-y divide-line-soft">
                    {logistics.quote.options.map((o) => (
                      <div key={o.carrier} className="flex items-center justify-between px-4 py-3">
                        <span className="font-semibold text-ink">{o.title}</span>
                        <span className="text-right">
                          <span className="block font-bold text-ink">{o.price.toLocaleString("ru-RU")} ₽</span>
                          <span className="block text-[12px] text-ink-mute">{o.daysMin}–{o.daysMax} дн.</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!logisticsLoading && logistics && !logistics.deliverable && (
                <p className="text-[13px] text-red-600 font-semibold flex items-center gap-1.5"><PackageCheck size={14} /> Доставка в {logistics.buyerCity || "ваш город"} недоступна: продавец не работает в этом регионе.</p>
              )}
              {/* Подтверждение монтажа крупногабарита именно в городе покупателя. */}
              {p.hasInstall && (
                logistics?.installAvailable ? (
                  <p className="text-[13px] text-success font-semibold flex items-center gap-1.5"><Wrench size={14} /> Монтаж и установка в г. {logistics.buyerCity} подтверждены продавцом; ориентировочно +{Number(p.processingDays || 1) + 2} дн. после доставки.</p>
                ) : logistics && !logistics.installAvailable ? (
                  <p className="text-[13px] text-ink-mute flex items-center gap-1.5"><Wrench size={14} /> Установка в г. {logistics.buyerCity || "вашем городе"} не выполняется — только доставка до пункта выдачи.</p>
                ) : null
              )}
              {!logistics && <p>СДЭК, Boxberry и Почта России — 2–7 дней по России.</p>}
            </div>
          )}
          {tab === "reviews" && <ProductServerReviews productId={p.productId} />}
        </div>
      </div>
      <SellerAboutModal open={sellerAboutOpen} onClose={() => setSellerAboutOpen(false)} />
    </div>
  );
}

/* ЭТАП 4 (§4.3): серверные отзывы по проданному товару — агрегация
   финансово подтверждённых сделок (GET /api/products/:id/reviews). */
interface ServerReview { id: string; reviewer_name: string; rating: number; text: string; created_at: string }
function ProductServerReviews({ productId }: { productId?: string }) {
  const [server, setServer] = useState<ServerReview[] | null>(null);
  useEffect(() => {
    if (!productId) { setServer(null); return; }
    let alive = true;
    fetch(`/api/products/${encodeURIComponent(productId)}/reviews`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive && j && j.ok) setServer(j.reviews || []); })
      .catch(() => { /* деградация: показываем статичную заглушку */ });
    return () => { alive = false; };
  }, [productId]);

  if (!productId || !server || server.length === 0) {
    return <p className="text-[14px] text-ink-mute">Отзывов пока нет — станьте первым!</p>;
  }
  return (
    <div className="space-y-3">
      {server.map((r) => (
        <div key={r.id} className="bg-surface rounded-[14px] shadow-card p-5">
          <div className="flex items-center gap-2.5 mb-2">
            <span className="w-9 h-9 rounded-full bg-dark text-cream flex items-center justify-center font-display font-bold text-[14px]">{(r.reviewer_name || "?")[0].toUpperCase()}</span>
            <div>
              <p className="text-[13.5px] font-bold text-ink">{r.reviewer_name}</p>
              <p className="text-[11px] text-ink-mute">{new Date(r.created_at).toLocaleDateString("ru-RU")}</p>
            </div>
            <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success-soft text-[#4d7327] text-[10.5px] font-bold"><ShieldCheck size={11} /> Проверенная сделка</span>
          </div>
          <span className="inline-flex items-center gap-0.5">{[...Array(5)].map((_, i) => <Star key={i} size={13} className={i < Math.round(r.rating) ? "text-accent" : "text-line"} fill="currentColor" />)}</span>
          <p className="text-[13.5px] text-ink-soft leading-relaxed mt-1.5">{r.text}</p>
        </div>
      ))}
    </div>
  );
}
