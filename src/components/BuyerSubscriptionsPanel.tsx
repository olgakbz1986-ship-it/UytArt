/* ============================================================
   Панель «Мои подписки» — переиспользуемый компонент кабинетов
   покупателя (/profile) и продавца (/seller/dashboard).

   ЗАДАЧА 4: переведена на TanStack Query (useSubscriptions +
   мутации). Сервер возвращает готовые enriched-поля target_name /
   target_avatar / new_count — ручные резолверы и клиентские
   счётчики удалены. Добавлены сортировка, поиск, пагинация
   «Загрузить ещё», отметка прочитанного по клику; confirm/alert
   заменены доступными ConfirmModal/Toast; вкладки и список —
   с aria-атрибутами и тач-целями ≥44px.
   ============================================================ */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, Store, Wrench, BookOpen, Palette, RefreshCw, Search, X } from "lucide-react";
import { loadMoreSubscriptions, useSubscriptions, type SubscriptionItem } from "../hooks/useSubscriptions";
import { useMarkSubscriptionReadMutation, useUnsubscribeMutation, subscriptionErrorMessage } from "../hooks/useSubscriptionMutations";
import { useConfirm, useToast } from "./a11y";

const SORT_OPTIONS = [
  { value: "date", label: "По дате" },
  { value: "new_count", label: "По количеству новинок" },
  { value: "name", label: "По имени" },
] as const;

const PAGE_SIZE = 20;

export function BuyerSubscriptionsPanel() {
  const [sortBy, setSortBy] = useState<string>("date");
  /* search — значение поля ввода; debouncedSearch — параметр запроса (п.12) */
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const timerRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setDebounced(search.trim()), 350);
    return () => window.clearTimeout(timerRef.current);
  }, [search]);

  const opts = useMemo(() => ({ sortBy, search: debounced, limit: PAGE_SIZE }), [sortBy, debounced]);
  const { data: subscriptions, isLoading, error, refetch, isFetching } = useSubscriptions(opts);
  const list = subscriptions || [];

  const markRead = useMarkSubscriptionReadMutation();
  const unsubscribe = useUnsubscribeMutation();
  const { ask, modal: confirmModal } = useConfirm();
  const { toast } = useToast();

  /* п.13: курсор следующей страницы берём из последнего id загруженного списка */
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  useEffect(() => { setCursor(null); }, [sortBy, debounced]); // новой фильтре — новая страница
  const nextCursor = cursor === null && list.length >= PAGE_SIZE ? String(list[list.length - 1]?.id ?? "") : cursor;

  const loadMore = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const { hasMore } = await loadMoreSubscriptions(opts, nextCursor);
      setCursor(hasMore ? nextCursor : ""); // "" — больше страниц нет
    } catch (e) {
      toast("error", subscriptionErrorMessage(e));
    } finally {
      setLoadingMore(false);
    }
  };

  /* п.15: клик по карточке открывает ленту продавца И отмечает прочитанным */
  const openSubscription = (sub: SubscriptionItem) => {
    if ((sub.new_count || 0) > 0 && ["shop", "master", "author"].includes(sub.target_type)) {
      markRead.mutate({ targetType: sub.target_type, targetId: String(sub.target_id) });
    }
  };

  const onUnsubscribe = async (sub: SubscriptionItem) => {
    const ok = await ask({
      title: "Отписаться?",
      text: `Вы больше не будете получать новинки «${sub.target_name || sub.target_id}» в ленте.`,
      confirmLabel: "Отписаться",
      danger: true,
    });
    if (!ok) return;
    try {
      await unsubscribe.mutateAsync({ targetType: sub.target_type, targetId: String(sub.target_id) });
      toast("success", "Вы отписаны от обновлений");
    } catch (e) {
      toast("error", subscriptionErrorMessage(e));
    }
  };

  const getSubIcon = (type: string) => {
    const map: Record<string, any> = { shop: Store, master: Wrench, author: BookOpen, category: Bell, product: Palette };
    return map[type] || Bell;
  };
  const getSubLabel = (type: string) => {
    const map: Record<string, string> = { shop: "Магазин", master: "Мастер", author: "Автор", category: "Категория", product: "Товар" };
    return map[type] || type;
  };

  const cardClass = "group bg-surface rounded-xl border border-line p-4 flex items-center gap-4 hover:border-accent-deep/50 transition-colors min-h-[76px]";

  const renderCard = (sub: SubscriptionItem) => {
    const Icon = getSubIcon(sub.target_type);
    const newCount = sub.new_count || 0;
    const name = sub.target_name || sub.target_id; /* сервер отдаёт готовое имя (п.10) */
    const inner = (
      <>
        {sub.target_avatar ? (
          <img src={sub.target_avatar} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
        ) : (
          <div aria-hidden="true" className="w-12 h-12 rounded-lg bg-line-soft flex items-center justify-center text-ink-mute shrink-0">
            <Icon size={24} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-ink truncate">{name}</div>
          <p className="text-sm text-ink-soft">
            {getSubLabel(sub.target_type)} • Подписан {new Date(sub.created_at).toLocaleDateString("ru-RU")}
          </p>
        </div>
        {newCount > 0 && (
          <span
            className="shrink-0 inline-flex items-center justify-center min-w-[26px] h-[26px] px-2 rounded-full bg-accent-deep text-white text-[12.5px] font-bold"
            aria-label={`Новых товаров: ${newCount}`}
            title="Новых позиций с момента последнего просмотра"
          >
            {newCount}
          </span>
        )}
        <span aria-hidden="true" className="text-ink-mute text-[18px] group-hover:translate-x-1 transition-transform shrink-0">›</span>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onUnsubscribe(sub); }}
          className="w-11 h-11 rounded-lg grid place-items-center text-ink-mute hover:text-error hover:bg-error/10 transition-colors shrink-0 cursor-pointer"
          title="Отписаться"
          aria-label={`Отписаться от «${name}»`}
        >
          <X size={18} />
        </button>
      </>
    );
    /* ссылка: у продавца — target_url с сервера, иначе — канонический путь */
    const to =
      sub.target_url ||
      (["shop", "master", "author"].includes(sub.target_type)
        ? `/shop/${encodeURIComponent(String(sub.target_id))}`
        : sub.target_type === "product"
          ? `/product/${encodeURIComponent(String(sub.target_id))}`
          : null);
    if (to) {
      return (
        <Link key={sub.id} to={to} onClick={() => openSubscription(sub)} className={cardClass}>
          {inner}
        </Link>
      );
    }
    return <div key={sub.id} className={cardClass}>{inner}</div>;
  };

  return (
    <div className="space-y-4 fade-up">
      <h2 className="font-display font-bold text-xl text-ink">Мои подписки</h2>
      <p className="text-sm text-ink-soft">Управляйте подписками на авторов, магазины, мастеров и категории. Цифра на карточке — количество новых позиций витрины с момента последнего просмотра; клик открывает ленту товаров и обнуляет счётчик.</p>

      {/* п.11–п.12: поиск и сортировка */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[220px]">
          <label htmlFor="subs-search" className="block text-[12.5px] font-bold text-ink mb-1">Поиск по названию</label>
          <div className="relative">
            <Search size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" />
            <input
              id="subs-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Например: мастерская керамики"
              className="field pl-9 min-h-[44px]"
              aria-describedby="subs-search-hint"
            />
          </div>
          <p id="subs-search-hint" className="sr-only">Список обновляется автоматически при вводе</p>
        </div>
        <div>
          <label htmlFor="subs-sort" className="block text-[12.5px] font-bold text-ink mb-1">Сортировка</label>
          <select
            id="subs-sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="field min-h-[44px] cursor-pointer"
          >
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* п.22: состояния загрузки / ошибки / пустого списка */}
      {isLoading ? (
        <div className="py-8 text-center text-ink-soft" role="status" aria-live="polite">Загрузка подписок...</div>
      ) : error ? (
        <div className="bg-surface rounded-2xl border border-error/30 p-8 text-center" role="alert">
          <p className="text-ink-soft mb-3">Не удалось загрузить подписки: {(error as Error).message}</p>
          <button onClick={() => refetch()} className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl border border-line font-semibold text-ink hover:border-accent-deep cursor-pointer">
            <RefreshCw size={15} /> Повторить
          </button>
        </div>
      ) : list.length === 0 ? (
        <div className="text-center py-12 rounded-2xl border border-dashed border-line bg-surface/50">
          <Bell size={48} className="mx-auto text-ink-mute mb-4" aria-hidden="true" />
          <h3 className="font-display font-bold text-lg text-ink mb-2">
            {debounced ? "Ничего не найдено" : "У вас пока нет подписок"}
          </h3>
          <p className="text-ink-soft mb-6 max-w-md mx-auto">
            {debounced
              ? "Попробуйте изменить запрос или сбросить поиск."
              : "Подпишитесь на интересные магазины, мастеров или категории, чтобы видеть их новинки в ленте"}
          </p>
          {debounced ? (
            <button onClick={() => setSearch("")} className="inline-flex items-center gap-2 min-h-[44px] px-5 rounded-xl border border-line font-semibold text-ink hover:border-accent-deep cursor-pointer">
              Сбросить поиск
            </button>
          ) : (
            <Link to="/catalog" className="inline-flex items-center gap-2 min-h-[44px] px-6 py-3 bg-accent-deep text-white rounded-xl font-semibold hover:bg-accent-deep/90 transition-colors">
              Перейти в каталог
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-ink-soft">
            Показано: <b className="text-ink">{list.length}</b>
            {isFetching && <span className="ml-2 text-ink-mute" role="status" aria-live="polite">обновляем…</span>}
          </p>
          {list.map(renderCard)}
          {/* п.13: пагинация «Загрузить ещё» */}
          {nextCursor && (
            <div className="text-center pt-2">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 min-h-[44px] px-5 rounded-xl border border-line font-semibold text-ink hover:border-accent-deep cursor-pointer disabled:opacity-60"
              >
                {loadingMore ? "Загружаем…" : "Загрузить ещё"}
              </button>
            </div>
          )}
        </div>
      )}
      {confirmModal}
    </div>
  );
}
