/* Панель «Мои подписки» — единый переиспользуемый компонент для кабинетов
   покупателя (/profile) и продавца (/seller/dashboard).
   Источник истины — сервер (/api/subscriptions), см. src/lib/userFeed.ts. */
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Bell, Store, Wrench, BookOpen, Palette, X } from "lucide-react";
import { useMarketProducts } from "../lib/market";
import {
  useUserSubscriptions,
  resolveTargetName,
  canonicalSellerId,
  unsubscribeOnServer,
  type ServerSubscription,
} from "../lib/userFeed";

export function BuyerSubscriptionsPanel() {
  /* Единый серверный источник подписок — общий с кнопкой «Подписаться» */
  const { subscriptions, loading: subsLoading, refresh: refreshSubs } = useUserSubscriptions();
  const marketForSubs = useMarketProducts();

  /* Магазин/мастерская/автор → число новых позиций с момента подписки */
  const newCounts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const s of subscriptions) {
      if (s.targetType !== "shop" && s.targetType !== "master" && s.targetType !== "author") continue;
      const key = `${s.targetType}:${s.targetId}`;
      if (out[key] !== undefined) continue;
      const since = Date.parse(s.createdAt || "") || 0;
      out[key] = (marketForSubs as any[]).filter(
        (x) => canonicalSellerId(x) === String(s.targetId) && Date.parse(String(x.createdAt || "")) > since
      ).length;
    }
    return out;
  }, [subscriptions, marketForSubs]);

  const unsubscribe = async (targetType: string, targetId: string) => {
    if (!confirm("Отписаться от этой подписки?")) return;
    const ok = await unsubscribeOnServer(targetType, String(targetId));
    if (ok) refreshSubs();
  };

  const getSubIcon = (type: string) => {
    const map: Record<string, any> = { shop: Store, master: Wrench, author: BookOpen, category: Bell, product: Palette };
    return map[type] || Bell;
  };
  const getSubLabel = (type: string) => {
    const map: Record<string, string> = { shop: "Магазин", master: "Мастер", author: "Автор", category: "Категория", product: "Товар" };
    return map[type] || type;
  };

  return (
    <div className="space-y-4 fade-up">
      <h2 className="font-display font-bold text-xl text-ink">Мои подписки</h2>
      <p className="text-sm text-ink-soft">Управляйте подписками на авторов, магазины, мастеров и категории. Цифра на карточке — количество новых позиций витрины с момента подписки; клик открывает ленту товаров.</p>
      {subsLoading ? (
        <div className="py-8 text-center text-ink-soft">Загрузка подписок...</div>
      ) : subscriptions.length === 0 ? (
        <div className="text-center py-12 rounded-2xl border border-dashed border-line bg-surface/50">
          <Bell size={48} className="mx-auto text-ink-mute mb-4" />
          <h3 className="font-display font-bold text-lg text-ink mb-2">У вас пока нет подписок</h3>
          <p className="text-ink-soft mb-6 max-w-md mx-auto">Подпишитесь на интересные магазины, мастеров или категории, чтобы видеть их новинки в ленте</p>
          <Link to="/catalog" className="inline-flex items-center gap-2 px-6 py-3 bg-accent-deep text-white rounded-xl font-semibold hover:bg-accent-deep/90 transition-colors">
            Перейти в каталог
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-ink-soft">Всего подписок: <b className="text-ink">{subscriptions.length}</b></p>
          {subscriptions.map((sub: ServerSubscription) => {
            const Icon = getSubIcon(sub.targetType);
            const newCount = newCounts[`${sub.targetType}:${sub.targetId}`] || 0;
            const inner = (
              <>
                <div className="w-12 h-12 rounded-lg bg-line-soft flex items-center justify-center text-ink-mute shrink-0">
                  <Icon size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-ink truncate">{resolveTargetName(sub.targetType, sub.targetId)}</div>
                  <p className="text-sm text-ink-soft">{getSubLabel(sub.targetType)} • Подписан {new Date(sub.createdAt).toLocaleDateString("ru-RU")}</p>
                </div>
                {newCount > 0 && (
                  <span className="shrink-0 inline-flex items-center justify-center min-w-[26px] h-[26px] px-2 rounded-full bg-accent-deep text-white text-[12.5px] font-bold" title="Новых позиций с момента подписки">
                    {newCount}
                  </span>
                )}
                <span className="text-ink-mute text-[18px] group-hover:translate-x-1 transition-transform shrink-0">›</span>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); unsubscribe(sub.targetType, String(sub.targetId)); }}
                  className="w-10 h-10 rounded-lg grid place-items-center text-ink-mute hover:text-error hover:bg-error/10 transition-colors shrink-0"
                  title="Отписаться"
                  aria-label="Отписаться"
                >
                  <X size={18} />
                </button>
              </>
            );
            /* Клик по подписке открывает ленту товаров магазина/мастерской/автора */
            if (sub.targetType === "shop" || sub.targetType === "master" || sub.targetType === "author") {
              return (
                <Link key={sub.id} to={`/shop/${encodeURIComponent(sub.targetId)}`}
                  className="group bg-surface rounded-xl border border-line p-4 flex items-center gap-4 hover:border-accent-deep/50 transition-colors">
                  {inner}
                </Link>
              );
            }
            if (sub.targetType === "product") {
              return (
                <Link key={sub.id} to={`/product/${encodeURIComponent(sub.targetId)}`}
                  className="group bg-surface rounded-xl border border-line p-4 flex items-center gap-4 hover:border-accent-deep/50 transition-colors">
                  {inner}
                </Link>
              );
            }
            return (
              <div key={sub.id} className="group bg-surface rounded-xl border border-line p-4 flex items-center gap-4 hover:border-accent-deep/50 transition-colors">
                {inner}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
