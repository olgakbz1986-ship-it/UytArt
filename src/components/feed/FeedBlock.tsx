/* ============================================================
   Лента новинок по подпискам (ЗАДАЧА 4, п.16): блок «Лента новинок»
   на основе useFeed (TanStack Query, infinite через cursor).
   Доступность: alt у изображений, aria-label счётчиков, тач-цели ≥44px,
   состояния загрузка/ошибка/повторить/пусто (п.22).
   ============================================================ */
import { Link } from "react-router-dom";
import { RefreshCw, Sparkles } from "lucide-react";
import { useFeed } from "../../hooks/useSubscriptions";

export function FeedBlock({ limit = 12 }: { limit?: number }) {
  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = useFeed({ limit });
  const items = (data?.pages || []).flatMap((p) => p.items);

  if (isLoading) return <div className="bg-surface rounded-2xl shadow-card p-8 text-center text-ink-soft">Загружаем ленту новинок…</div>;
  if (error) {
    return (
      <div className="bg-surface rounded-2xl shadow-card p-8 text-center" role="alert">
        <p className="text-ink-soft mb-3">Не удалось загрузить ленту: {(error as Error).message}</p>
        <button onClick={() => refetch()} className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl border border-line font-semibold text-ink hover:border-accent-deep cursor-pointer">
          <RefreshCw size={15} /> Повторить
        </button>
      </div>
    );
  }
  if (!items.length) {
    return (
      <div className="bg-surface rounded-2xl shadow-card px-8 py-12 text-center">
        <Sparkles size={40} className="mx-auto text-ink-mute mb-3" />
        <p className="font-display font-bold text-[17px] text-ink mb-1">Новинок пока нет</p>
        <p className="text-[13px] text-ink-soft max-w-sm mx-auto">Подпишитесь на магазины и мастеров — их новые товары появятся здесь первыми.</p>
        <Link to="/catalog" className="inline-flex items-center min-h-[44px] mt-4 px-5 rounded-xl bg-accent-deep text-white font-semibold hover:bg-accent-deep/90 transition-colors">В каталог</Link>
      </div>
    );
  }
  return (
    <div className="fade-up space-y-4">
      <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 m-0 p-0 list-none" aria-label="Лента новых товаров от подписок">
        {items.map((it) => {
          const href = it.url || `/product/${encodeURIComponent(String(it.id))}`;
          const img = it.image || (Array.isArray(it.images) ? it.images[0] : undefined);
          return (
            <li key={it.id}>
              <Link to={href} className="block bg-surface rounded-2xl shadow-card overflow-hidden hover:shadow-lift transition-shadow">
                {img ? (
                  <img src={img} alt={it.name || "Товар"} className="w-full aspect-[4/3] object-cover" loading="lazy" />
                ) : (
                  <div aria-hidden="true" className="w-full aspect-[4/3] bg-line-soft grid place-items-center text-[32px]">🛍️</div>
                )}
                <div className="p-4">
                  <p className="text-[13.5px] font-semibold text-ink line-clamp-1">{it.name}</p>
                  <p className="text-[12px] text-ink-mute mt-1 line-clamp-1">{it.seller_name || ""}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[13px] font-bold text-accent-deep">{typeof it.price === "number" ? `${it.price.toLocaleString("ru-RU")} ₽` : it.price || ""}</span>
                    {it.is_new && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success-soft text-[#4d7327] text-[10.5px] font-bold" aria-label="Новый товар с момента последнего просмотра">
                        новое
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      {hasNextPage && (
        <div className="text-center">
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="inline-flex items-center gap-2 min-h-[44px] px-5 rounded-xl border border-line font-semibold text-ink hover:border-accent-deep cursor-pointer disabled:opacity-60"
          >
            {isFetchingNextPage ? "Загружаем…" : "Загрузить ещё"}
          </button>
        </div>
      )}
    </div>
  );
}
