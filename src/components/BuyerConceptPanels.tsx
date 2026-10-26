/* ============================================================================
   Переиспользуемые панели «Мои концепты» и «Отслеживание цен».

   Вынесены из profile.tsx в общий слой, чтобы кабинет продавца (extras.tsx)
   использовал ТОЙ ЖЕ самую архитектуру раздела, что и кабинет покупателя:
   единый источник данных (useSubStore: concepts / priceWatches), одинаковый
   UI и одинаковые правила тарификации (закрыто на free, открыто с paid-тарифа).
   ========================================================================== */
import { Link } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { fmt, productById } from "../data/seed";
import { useSubStore } from "../lib/subscriptions";
import { useMarketProducts } from "../lib/market";
import { Badge, ProductImg } from "./ui";

/** Резолв товара: сначала динамические (опубликованные пользователями), затем seed. */
function resolveProduct(market: any[], id: string) {
  return (market as any[]).find((p) => p.id === id) || productById(id);
}

/* ------------------------------------------------------------------ */
/* МОИ КОНЦЕПТЫ                                                        */
/* ------------------------------------------------------------------ */
export function BuyerConceptsPanel() {
  const concepts = useSubStore((s) => s.concepts);
  const removeConcept = useSubStore((s) => s.removeConcept);

  return (
    <div className="fade-up">
      {concepts.length === 0 ? (
        <div className="bg-surface rounded-2xl shadow-card px-8 py-16 text-center">
          <p className="text-[44px] mb-3">🎨</p>
          <p className="font-display font-bold text-[19px] text-ink mb-2">Концептов пока нет</p>
          <Link to="/ai-assistant" className="text-[14px] font-bold text-accent-deep hover:text-accent transition-colors">Создать в AI-дизайнере →</Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {concepts.map((c) => (
            <div key={c.id} className="bg-surface rounded-2xl shadow-card overflow-hidden">
              {c.image ? (
                <img src={c.image} alt={c.roomName} className="w-full aspect-[4/3] object-cover" />
              ) : (
                <div className="w-full aspect-[4/3] bg-dark flex items-center justify-center text-[40px]">🛋️</div>
              )}
              <div className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[13.5px] font-semibold text-ink">{c.roomName}</p>
                  <p className="text-[11.5px] text-ink-mute mt-0.5">{c.style} · {new Date(c.createdAt).toLocaleDateString("ru-RU")}</p>
                </div>
                <button onClick={() => removeConcept(c.id)} aria-label="Удалить концепт" className="w-9 h-9 rounded-[10px] flex items-center justify-center text-ink-mute hover:text-error hover:bg-error-soft cursor-pointer transition-colors"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ОТСЛЕЖИВАНИЕ ЦЕН                                                    */
/* ------------------------------------------------------------------ */
export function BuyerPriceWatchesPanel({ limitLabel }: { limitLabel?: string }) {
  const priceWatches = useSubStore((s) => s.priceWatches);
  const removePriceWatch = useSubStore((s) => s.removePriceWatch);
  const market = useMarketProducts();

  return (
    <div className="fade-up space-y-3">
      {priceWatches.length === 0 ? (
        <div className="bg-surface rounded-2xl shadow-card px-8 py-16 text-center">
          <p className="text-[44px] mb-3">🔔</p>
          <p className="font-display font-bold text-[19px] text-ink mb-2">Список отслеживания пуст</p>
          <p className="text-[13.5px] text-ink-soft max-w-sm mx-auto">Добавляйте товары — мы пришлём push, email и SMS, когда цена снизится.{limitLabel ? ` Лимит тарифа: ${limitLabel}.` : ""}</p>
        </div>
      ) : (
        priceWatches.map((w) => {
          const p = resolveProduct(market as any[], w.productId);
          return (
            <div key={w.id} className="bg-surface rounded-2xl shadow-card p-4 flex items-center gap-4">
              {p && <Link to={`/product/${(p as any).slug}`} className="w-[72px] h-[60px] rounded-[10px] overflow-hidden shrink-0 group"><ProductImg p={p as any} /></Link>}
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-semibold text-ink line-clamp-1">{(p as any)?.name || "Товар"}</p>
                <p className="text-[12px] text-ink-mute mt-0.5">Было {fmt(w.oldPrice)} → хотим {fmt(w.targetPrice)}</p>
              </div>
              <Badge tone={w.notified ? "success" : "honey"}>{w.notified ? "Цена снизилась!" : "Ждём снижения"}</Badge>
              <button onClick={() => removePriceWatch(w.id)} aria-label="Убрать" className="w-9 h-9 rounded-[10px] flex items-center justify-center text-ink-mute hover:text-error hover:bg-error-soft cursor-pointer transition-colors"><Trash2 size={15} /></button>
            </div>
          );
        })
      )}
    </div>
  );
}
