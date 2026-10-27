import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { ShoppingBag, User, LogOut, Search, ArrowRight, X, MapPin, Bell, ClipboardList, HelpCircle, UserCheck, BellRing , Trash2} from "lucide-react";
import { useMarketProducts } from "../lib/market";
import { CATEGORIES, fmt, catBySlug, groupById } from "../data/seed";
import { useAppStore } from "../lib/store";
import { CITIES } from "../lib/geo";
import { useSellerAccount } from "../lib/seller";
import { useSellerReg } from "../lib/seller";
import { GroupImg } from "./ui";

/* ---------- контурный логотип-домик ---------- */
import { useNotifyStore } from "../lib/notify";
import { startAgentWorker } from "../lib/agent";
import { createPortal } from "react-dom";

/* ---------- глобальные тосты уведомлений ---------- */
const TOAST_DISMISS_MS = 6000;

export function Toasts() {
  const items = useNotifyStore((s) => s.items);
  const [visibleIds, setVisibleIds] = useState<string[]>([]);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const fresh = items.filter((i) => !i.read && !seenRef.current.has(i.id));
    if (fresh.length === 0) return;
    fresh.forEach((i) => seenRef.current.add(i.id));
    setVisibleIds((prev) => [...prev, ...fresh.map((i) => i.id)].slice(-3));
  }, [items]);

  useEffect(() => {
    if (visibleIds.length === 0) return;
    const t = window.setTimeout(() => setVisibleIds((p) => p.slice(1)), TOAST_DISMISS_MS);
    return () => clearTimeout(t);
  }, [visibleIds]);

  const shown = items.filter((i) => visibleIds.includes(i.id));
  if (shown.length === 0) return null;
  return createPortal(
    <div className="fixed z-[200] right-3 bottom-3 pb-[env(safe-area-inset-bottom,0px)] md:right-5 md:top-[84px] md:bottom-auto w-[calc(100vw-24px)] md:w-[360px] flex flex-col gap-2 pointer-events-none">
      {shown.map((i) => (
        <div key={i.id} role="status" aria-live="polite"
          className="pointer-events-auto bg-surface border border-line rounded-[14px] shadow-lift px-4 py-3 pop-in flex items-start gap-2">
          <button onClick={() => { setVisibleIds((p) => p.filter((x) => x !== i.id)); useNotifyStore.getState().markRead(i.id); }}
            aria-label="Скрыть уведомление"
            className="shrink-0 -ml-1 w-7 h-7 -mt-0.5 rounded-full flex items-center justify-center hover:bg-line-soft text-ink-mute cursor-pointer">
            <X size={14} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-ink mb-0.5 truncate">{i.title}</p>
            {i.text && <p className="text-[12px] text-ink-soft line-clamp-2">{i.text}</p>}
          </div>
        </div>
      ))}
    </div>,
    document.body,
  );
}

function NotifyBell() {
  const items = useNotifyStore((s) => s.items);
  const nav = useNavigate();
  const markRead = useNotifyStore((s) => s.markRead);

  const handleMarkRead = (id: string) => {
    markRead(id);
    fetch(`/api/notifications/${id}/read`, { method: 'PUT' }).catch(console.error);
  };
  const markAll = useNotifyStore((s) => s.markAll);
  const remove = useNotifyStore((s) => s.remove);
  const resolve = useNotifyStore((s) => s.resolve);
  const [open, setOpen] = useState(false);
  const unread = items.filter((i) => !i.read).length;
  useEffect(() => {
    if (open) {
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const toClean = items.filter((i) => i.read && i.createdAt < sevenDaysAgo);
      toClean.forEach((i) => remove(i.id));

      fetch('/api/notifications')
        .then(res => res.json())
        .then(data => {
          if (data.ok && data.notifications) {
            const store = useNotifyStore.getState();
            const mapped = data.notifications.map((n: any) => {
              const kind: any = n.type === 'message' ? 'question' : (n.type === 'accepted' ? 'confirm' : 'alert');
              return {
                id: n.id,
                kind,
                title: n.title,
                text: n.text,
                deepLink: n.link,
                createdAt: new Date(n.created_at).getTime(),
                read: n.read
              };
            });
            store.mergeServerNotifications(mapped);
          }
        })
        .catch(err => console.error("Ошибка загрузки уведомлений биржи", err));
    }
  }, [open]);

  const groupByDate = (list: typeof items) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const groups: { label: string; list: typeof items }[] = [];
    const t = list.filter((i) => i.createdAt >= today.getTime());
    const y = list.filter((i) => i.createdAt >= yesterday.getTime() && i.createdAt < today.getTime());
    const o = list.filter((i) => i.createdAt < yesterday.getTime());
    if (t.length) groups.push({ label: "Сегодня", list: t });
    if (y.length) groups.push({ label: "Вчера", list: y });
    if (o.length) groups.push({ label: "Ранее", list: o });
    return groups;
  };

  const clearRead = () => { items.filter((i) => i.read).forEach((i) => remove(i.id)); };

  const [filter, setFilter] = useState<"all" | "unread" | "pending">("all");
  const pending = items.filter((i) => i.kind === "confirm" && !i.resolved).length;
  const kindIcon = (k: string) =>
    k === "confirm" ? <UserCheck size={15} className="text-accent" /> :
    k === "question" ? <HelpCircle size={15} className="text-ai" /> :
    k === "alert" ? <BellRing size={15} className="text-error" /> :
    <ClipboardList size={15} className="text-success" />;
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} aria-label="Уведомления" className="relative w-11 h-11 rounded-[10px] flex items-center justify-center text-ink hover:bg-line-soft transition-colors cursor-pointer">
        <Bell size={21} />
        {unread > 0 && <span className="absolute -top-1 -right-1 min-w-[19px] h-[19px] px-1 rounded-full bg-accent text-ink text-[10px] font-bold flex items-center justify-center">{unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-[52px] w-[360px] max-h-[440px] overflow-auto bg-surface rounded-2xl shadow-card border border-line-soft z-50 p-3">
          <div className="flex items-center justify-between px-2 pb-2">
            <span className="text-[13px] font-bold text-ink">Уведомления</span>
            <div className="flex gap-2">
              <button onClick={clearRead} className="text-[11.5px] font-semibold text-ink-mute hover:text-error cursor-pointer">Очистить прочитанные</button>
              <button onClick={markAll} className="text-[11.5px] font-semibold text-accent-deep hover:text-accent cursor-pointer">Прочитать все</button>
            </div>
          </div>
          <div className="flex gap-1 px-1 pb-3 border-b border-line-soft mb-2">
            <button onClick={() => setFilter("all")} className={`flex-1 h-8 px-2 rounded-[8px] text-[11.5px] font-bold transition-colors cursor-pointer ${filter === "all" ? "bg-dark text-cream" : "bg-line-soft text-ink-soft hover:bg-line"}`}>Все ({items.length})</button>
            <button onClick={() => setFilter("unread")} className={`flex-1 h-8 px-2 rounded-[8px] text-[11.5px] font-bold transition-colors cursor-pointer ${filter === "unread" ? "bg-dark text-cream" : "bg-line-soft text-ink-soft hover:bg-line"}`}>Непрочит. ({unread})</button>
            <button onClick={() => setFilter("pending")} className={`flex-1 h-8 px-2 rounded-[8px] text-[11.5px] font-bold transition-colors cursor-pointer ${filter === "pending" ? "bg-dark text-cream" : "bg-line-soft text-ink-soft hover:bg-line"}`}>Действие ({pending})</button>
          </div>
          {items.filter((i) => filter === "all" ? true : filter === "unread" ? !i.read : i.kind === "confirm" && !i.resolved).length === 0 && <p className="text-[12.5px] text-ink-mute px-2 py-6 text-center">Пока тихо. Агент и сервис будут писать сюда.</p>}
          {groupByDate(items.filter((i) => filter === "all" ? true : filter === "unread" ? !i.read : i.kind === "confirm" && !i.resolved)).map((g) => (
            <div key={g.label}>
              <p className="text-[10.5px] font-bold text-ink-mute uppercase tracking-wide px-2 pt-1 pb-1.5">{g.label}</p>
              {g.list.map((i) => (
                <div key={i.id} onClick={() => { handleMarkRead(i.id); if ((i as any).deepLink) nav((i as any).deepLink); }} className={`group rounded-xl p-3 mb-2 cursor-pointer ${i.read ? "bg-cream/60" : "bg-accent-soft/60"} ${(i as any).deepLink ? "hover:ring-2 hover:ring-accent/30" : ""}`}>
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5">{kindIcon(i.kind)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-bold text-ink leading-snug">{i.title}</p>
                      <p className="text-[12px] text-ink-soft leading-snug mt-1">{i.text}</p>
                  {i.kind === "confirm" && !i.resolved && (
                    <div className="flex gap-2 mt-2.5">
                      <button onClick={(e) => { e.stopPropagation(); resolve(i.id, "accepted"); }} className="h-8 px-3 rounded-[8px] bg-dark text-cream text-[11.5px] font-bold hover:bg-dark-deep cursor-pointer">Подтвердить</button>
                      <button onClick={(e) => { e.stopPropagation(); resolve(i.id, "declined"); }} className="h-8 px-3 rounded-[8px] bg-line-soft text-ink-soft text-[11.5px] font-bold hover:bg-line cursor-pointer">Отклонить</button>
                    </div>
                  )}
                  {i.resolved && <p className={`text-[11px] font-bold mt-1.5 ${i.resolved === "accepted" ? "text-success" : "text-ink-mute"}`}>{i.resolved === "accepted" ? "Подтверждено ✓" : "Отклонено"}</p>}
                </div>
                <button onClick={(e) => { e.stopPropagation(); remove(i.id); }} className="opacity-0 group-hover:opacity-100 mt-0.5 text-ink-mute hover:text-error cursor-pointer shrink-0" aria-label="Удалить уведомление"><Trash2 size={14} /></button>
              </div>
            </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function HouseMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className={`house-mark ${className}`} aria-hidden="true">
      <path d="M7 19L20 7l13 12" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 18v13h20V18" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 31v-8a3 3 0 0 1 6 0v8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link to="/" className="group flex items-center gap-2.5 shrink-0" aria-label="Quantiform — на главную">
      <svg viewBox="0 0 64 64" className="logo-q w-9 h-9" fill="none" aria-hidden="true">
          <rect className="logo-q-frame" x="7" y="9" width="46" height="46" rx="13" stroke="#1e3a2f" strokeWidth="1.8" opacity="0.85" />
          <path className="logo-q-ring" d="M48.8 38.8 A 20 20 0 1 0 36.8 50.8" stroke="#1e3a2f" strokeWidth="5.5" strokeLinecap="round" />
          <path className="logo-q-tail" d="M38 40 L54 56" stroke="#d98e32" strokeWidth="5.5" strokeLinecap="round" />
        </svg>
      <span className="leading-tight">
        <span className="block font-display font-medium text-[18px] text-ink tracking-tight">Quantiform</span>
        <span className="block text-[9px] font-semibold tracking-[0.14em] uppercase text-ink-mute">AI marketplace</span>
      </span>
    </Link>
  );
}

/* ---------- умный поиск ---------- */
function SmartSearch() {
  const [q, setQ] = useState("");
  const [cityOpen, setCityOpen] = useState(false);
  const [cityInput, setCityInput] = useState("");
  const viewerCity = useAppStore((s) => s.viewerCity);
  const setViewerCity = useAppStore((s) => s.setViewerCity);
  const defaultCity = useAppStore((s) => s.addresses.find((a) => a.isDefault)?.city || "");
  const queryCity = useMemo(() => {
    const qq = q.toLowerCase();
    const fromList = CITIES.find((x) => qq.includes(x.name.toLowerCase()));
    if (fromList) return fromList.name;
    return useSellerAccount.getState().products.map((pr) => pr.sellerCity || "").find((c) => c && qq.includes(c.toLowerCase()));
  }, [q]);
  const [open, setOpen] = useState(false);
  const marketList = useMarketProducts(queryCity || undefined);
  const inputRef = useRef<HTMLInputElement>(null);
  const nav = useNavigate();

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || "").toUpperCase();
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    return marketList.filter((p) => {
      const cat = catBySlug(p.categoryId);
      const g = cat ? groupById(cat.group) : undefined;
      const subName = cat?.subs.find((s) => s.slug === p.sub)?.name.toLowerCase() ?? "";
      return (
        p.name.toLowerCase().includes(t) ||
        p.material.toLowerCase().includes(t) ||
        p.tags.some((tag) => tag.toLowerCase().includes(t)) ||
        subName.includes(t) ||
        (cat?.name.toLowerCase().includes(t) ?? false) ||
        (g?.name.toLowerCase().includes(t) ?? false)
      );
    }).slice(0, 6);
  }, [q, marketList]);

  const showPanel = open && q.trim().length >= 2;
  const go = (to: string) => { setOpen(false); setQ(""); inputRef.current?.blur(); nav(to); };

  return (
    <div className="relative w-full sm:flex-1 sm:max-w-xl min-w-0">
      <div className={`flex items-center gap-2 sm:gap-2.5 h-[46px] px-3 sm:px-4 rounded-full border bg-surface transition-all duration-300 ease-out ${open ? "border-dark shadow-card" : "border-line hover:border-ink-mute"}`}>
        <Search size={17} className={`shrink-0 transition-colors duration-200 ${open ? "text-accent-deep" : "text-ink-mute"}`} />
        <div className="relative shrink-0 min-w-0">
          <button onClick={() => setCityOpen((v) => !v)} aria-label="Город просмотра"
            className="flex items-center gap-1.5 h-8 px-2 sm:px-2.5 rounded-lg hover:bg-line-soft transition-colors cursor-pointer text-[12.5px] font-semibold text-ink-soft max-w-[92px] sm:max-w-none whitespace-nowrap overflow-hidden">
            <MapPin size={13} className="text-accent-deep shrink-0" />
            <span className="truncate">{viewerCity || defaultCity || "Город"}</span>
          </button>
          {cityOpen && (
            <div className="absolute left-0 top-9 z-50 w-[250px] bg-surface rounded-xl shadow-lift border border-line p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute mb-2">Город просмотра</p>
              <input className="field mb-2" list="uyt-header-cities" placeholder="Ваш город" value={cityInput} onChange={(e) => setCityInput(e.target.value)} />
              <datalist id="uyt-header-cities">{CITIES.map((c) => <option key={c.name} value={c.name} />)}</datalist>
              <div className="flex flex-col gap-1.5">
                <button onClick={() => { setViewerCity(cityInput.trim() || null); setCityOpen(false); }}
                  className="h-9 rounded-lg bg-dark text-cream text-[12.5px] font-semibold hover:bg-dark-deep transition-colors cursor-pointer">Применить</button>
                <button onClick={() => { setViewerCity(null); setCityInput(""); setCityOpen(false); }}
                  className="h-9 rounded-lg border border-line text-[12.5px] font-semibold text-ink-soft hover:bg-line-soft transition-colors cursor-pointer">Как в адресе доставки{defaultCity ? ` (${defaultCity})` : ""}</button>
              </div>
            </div>
          )}
        </div>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 160)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && q.trim()) go(`/catalog?q=${encodeURIComponent(q.trim())}`);
            if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); }
          }}
          placeholder="Найти вазу, куртку, крепёж…"
          aria-label="Поиск по товарам"
          className="flex-1 min-w-0 bg-transparent outline-none text-[16px] sm:text-[14px] text-ink placeholder:text-ink-mute"
        />
        {q ? (
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => { setQ(""); inputRef.current?.focus(); }} aria-label="Очистить"
            className="w-7 h-7 rounded-full flex items-center justify-center text-ink-mute hover:bg-line-soft hover:text-ink cursor-pointer transition-colors">
            <X size={14} />
          </button>
        ) : (
          <kbd className="hidden md:flex w-6 h-6 items-center justify-center rounded-md border border-line bg-cream text-[11px] font-bold text-ink-mute select-none">/</kbd>
        )}
      </div>
      {showPanel && (
        <div className="absolute left-0 right-0 top-full mt-2.5 bg-surface rounded-[14px] shadow-lift border border-line-soft overflow-hidden z-[95] pop-in">
          {results.length > 0 ? (
            <ul className="py-1.5">
              {results.map((p) => {
                const cat = catBySlug(p.categoryId);
                const g = cat ? groupById(cat.group) : undefined;
                return (
                  <li key={p.id}>
                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => go(`/product/${p.slug}`)}
                      className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-cream cursor-pointer transition-colors">
                      <span className="w-11 h-11 rounded-[10px] overflow-hidden shrink-0 group">
                        <GroupImg src={p.image} emoji={p.emoji} alt={p.name} />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[13.5px] font-semibold text-ink truncate">{p.name}</span>
                        <span className="block text-[11.5px] text-ink-mute">{g?.name} · {cat?.name}</span>
                      </span>
                      <span className="font-display font-bold text-[14px] text-ink shrink-0">{fmt(p.price)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-5 py-4 text-[13px] text-ink-soft">Ничего не нашлось — попробуйте «керамика», «куртка» или «крепёж».</p>
          )}
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => go(`/catalog?q=${encodeURIComponent(q.trim())}`)}
            className="w-full flex items-center justify-center gap-2 h-11 border-t border-line-soft text-[13px] font-bold text-accent-deep hover:bg-cream cursor-pointer transition-colors">
            Все результаты по «{q.trim()}» <ArrowRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- Cookie-баннер с категориями (Итерация два, Пункт Б) ---------- */
const COOKIE_CATEGORIES: { key: "functional" | "analytics" | "marketing"; title: string; desc: string }[] = [
  { key: "functional", title: "Функциональные", desc: "Запоминают выбранные настройки: город, тему оформления, содержимое корзины и избранного." },
  { key: "analytics", title: "Аналитические", desc: "Помогают понять, какие разделы и товары востребованы, чтобы улучшать сервис (собираются в обезличенном виде)." },
  { key: "marketing", title: "Маркетинговые", desc: "Используются для показа релевантных предложений и оценки эффективности кампаний. Включаются только с вашего согласия." },
];

export function CookieBanner() {
  const location = useLocation();
  const cookieConsent = useAppStore((s) => s.cookieConsent);
  const setCookieConsent = useAppStore((s) => s.setCookieConsent);
  const [customized, setCustomized] = useState(false);
  const [toggles, setToggles] = useState({ functional: false, analytics: false, marketing: false });

  if (cookieConsent || location.pathname.startsWith("/admin")) return null;

  const acceptAll = () => setCookieConsent({ functional: true, analytics: true, marketing: true });
  const onlyNecessary = () => setCookieConsent({ functional: false, analytics: false, marketing: false });
  const saveCustom = () => setCookieConsent(toggles);

  return (
    <div role="dialog" aria-modal="false" aria-label="Уведомление об использовании cookie"
      className="fixed z-[150] left-3 right-3 bottom-3 md:left-auto md:right-5 md:bottom-5 md:w-[420px] pop-in">
      <div className="bg-surface border border-line rounded-2xl shadow-lift p-4 sm:p-5">
        <p className="text-[13.5px] font-display font-bold text-ink mb-1.5">Мы используем файлы cookie</p>
        <p className="text-[12.5px] leading-snug text-ink-soft mb-3">
          Сайту нужны строго необходимые файлы cookie для работы. Дополнительные категории включаются только с вашего согласия.
          Подробнее — <Link to="/legal/privacy" className="font-semibold text-accent-deep hover:underline">cookie-матрица в политике конфиденциальности</Link>.
        </p>

        {customized && (
          <div className="flex flex-col gap-2 mb-3 border-t border-line-soft pt-3">
            <label className="flex items-start gap-2.5 opacity-70 cursor-not-allowed">
              <input type="checkbox" checked disabled className="mt-0.5" aria-label="Строго необходимые файлы cookie — всегда включены" />
              <span>
                <span className="block text-[12.5px] font-bold text-ink">Строго необходимые</span>
                <span className="block text-[11.5px] text-ink-soft leading-snug">Обеспечивают работу корзины, авторизации и безопасности. Включены всегда, основание — ст. 18.1 ФЗ-152.</span>
              </span>
            </label>
            {COOKIE_CATEGORIES.map((c) => (
              <label key={c.key} className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" checked={toggles[c.key]} className="mt-0.5"
                  onChange={(e) => setToggles((t) => ({ ...t, [c.key]: e.target.checked }))}
                  aria-label={`Разрешить ${c.title.toLowerCase()} файлы cookie`} />
                <span>
                  <span className="block text-[12.5px] font-bold text-ink">{c.title}</span>
                  <span className="block text-[11.5px] text-ink-soft leading-snug">{c.desc}</span>
                </span>
              </label>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button onClick={acceptAll}
            className="h-10 px-4 rounded-[10px] bg-dark text-cream text-[13px] font-bold hover:bg-dark-deep transition-colors cursor-pointer">
            Принять все
          </button>
          <button onClick={onlyNecessary}
            className="h-10 px-4 rounded-[10px] border border-line bg-surface text-ink text-[13px] font-bold hover:border-dark transition-colors cursor-pointer">
            Только необходимые
          </button>
          <button onClick={() => (customized ? saveCustom() : setCustomized(true))}
            className="h-10 px-4 rounded-[10px] text-[13px] font-bold text-accent-deep hover:text-accent hover:underline cursor-pointer">
            {customized ? "Сохранить выбор" : "Настроить"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- шапка ---------- */
export function Header() {
  const cart = useAppStore((s) => s.cart);
  const session = useAppStore((s) => s.session);

  const logout = useAppStore((s) => s.logout);
  useEffect(() => { startAgentWorker(); }, []);
  const sellerReg = useSellerReg();
  const [menuOpen, setMenuOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const nav = useNavigate();
  const cartCount = cart.reduce((s, c) => s + c.qty, 0);

  const links = [
    { to: "/catalog", label: "Каталог" },
    { to: "/market", label: "Заказы" },
    { to: "/masters", label: "Мастера" },
    { to: "/shops", label: "Магазины" },
    { to: "/ai-designer", label: "AI-дизайнер" },
    { to: "/about", label: "О нас" },
    { to: "/contacts", label: "Контакты" },
    { to: "/legal", label: "Документы" },
  ];

  const closeMenu = () => {
    if (closing || !menuOpen) return;
    setClosing(true);
    setTimeout(() => { setMenuOpen(false); setClosing(false); }, 300);
  };

  useEffect(() => {
    if (!menuOpen) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && closeMenu();
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", h); document.body.style.overflow = ""; };
  }, [menuOpen]);

  return (
    <>
      <header className="sticky top-0 z-[90] bg-cream/90 backdrop-blur-md border-b border-line">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-5 py-2.5 sm:py-0 sm:h-[68px]">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => (menuOpen ? closeMenu() : setMenuOpen(true))} aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"} aria-expanded={menuOpen} className={`burger shrink-0 ${menuOpen ? "is-open" : ""}`}>
              <span className="burger-box">
                <span className="burger-line" /><span className="burger-line" /><span className="burger-line" />
                <span className="burger-cross" />
              </span>
            </button>
            <Logo />
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto sm:hidden">
              <NotifyBell />
              <Link to="/cart" aria-label={`Корзина, товаров: ${cartCount}`} className="relative w-11 h-11 rounded-[10px] flex items-center justify-center text-ink hover:bg-line-soft transition-colors">
                <ShoppingBag size={21} />
                {cartCount > 0 && <span className="absolute -top-1 -right-1 min-w-[19px] h-[19px] px-1 rounded-full bg-accent text-ink text-[10px] font-bold flex items-center justify-center">{cartCount}</span>}
              </Link>
              {session ? (
                <Link to={sellerReg.status === "active" && session.role === "seller" ? "/seller/dashboard" : "/profile"} aria-label="Личный кабинет" className="w-11 h-11 rounded-[10px] flex items-center justify-center shrink-0">
                  {(session.avatar || (sellerReg.status === "active" && session.role === "seller" ? (sellerReg.shopLogo || sellerReg.masterAvatar) : "")) ? (
                    <img src={(session.avatar || (sellerReg.status === "active" && session.role === "seller" ? (sellerReg.shopLogo || sellerReg.masterAvatar) : "")) as string} alt="" className="w-9 h-9 rounded-full object-cover" />
                  ) : (
                    <span className="w-9 h-9 rounded-full bg-dark text-accent flex items-center justify-center font-display font-bold text-[13px]">{((sellerReg.status === "active" && session.role === "seller" ? sellerReg.shopName : session.name.split(" ")[0])[0] || "?").toUpperCase()}</span>
                  )}
                </Link>
              ) : (
                <Link to="/auth" aria-label="Войти" className="w-11 h-11 rounded-[10px] bg-dark text-cream flex items-center justify-center hover:bg-dark-deep transition-colors">
                  <User size={18} />
                </Link>
              )}
            </div>
          </div>
          <SmartSearch />
          <div className="hidden sm:flex items-center gap-2 shrink-0 sm:ml-auto">
            <NotifyBell />
            <Link to="/cart" aria-label={`Корзина, товаров: ${cartCount}`} className="relative w-11 h-11 rounded-[10px] flex items-center justify-center text-ink hover:bg-line-soft transition-colors">
              <ShoppingBag size={21} />
              {cartCount > 0 && <span className="absolute -top-1 -right-1 min-w-[19px] h-[19px] px-1 rounded-full bg-accent text-ink text-[10px] font-bold flex items-center justify-center">{cartCount}</span>}
            </Link>
            {session ? (
              (() => {
                const isSeller = sellerReg.status === "active" && session.role === "seller";
                const cabinetTo = isSeller ? "/seller/dashboard" : "/profile";
                const displayName = isSeller ? sellerReg.shopName : session.name.split(" ")[0];
                return (
                  <div className="flex items-center gap-2">
                    <Link
                      to={cabinetTo}
                      title={isSeller ? "Кабинет продавца" : "Личный кабинет"}
                      aria-label={isSeller ? "Открыть кабинет продавца" : "Открыть личный кабинет"}
                      className="group flex items-center gap-2 h-11 pl-1.5 pr-3 rounded-[10px] border border-line bg-surface text-sm font-semibold text-ink hover:border-dark hover:-translate-y-px transition-all duration-200"
                    >
                      {(session.avatar || (isSeller ? (sellerReg.shopLogo || sellerReg.masterAvatar) : "")) ? (
                        <img src={(session.avatar || (isSeller ? (sellerReg.shopLogo || sellerReg.masterAvatar) : "")) as string} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <span className="w-8 h-8 rounded-full bg-dark text-accent flex items-center justify-center font-display font-bold text-[13px] group-hover:bg-dark-deep transition-colors">
                          {(displayName[0] || "?").toUpperCase()}
                        </span>
                      )}
                      <span className="hidden sm:inline max-w-[160px] truncate">{displayName}</span>
                    </Link>
                    <button onClick={() => { logout(); nav("/"); }} aria-label="Выйти" className="w-11 h-11 rounded-[10px] flex items-center justify-center text-ink-mute hover:text-error hover:bg-error-soft transition-colors cursor-pointer">
                      <LogOut size={18} />
                    </button>
                  </div>
                );
              })()
            ) : (
              <Link to="/auth" className="h-11 px-4 sm:px-5 rounded-[10px] bg-dark text-cream text-sm font-semibold flex items-center gap-2 hover:bg-dark-deep transition-colors">
                <User size={16} /> <span className="hidden sm:inline">Войти</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Cookie-баннер с категориями (Пункт Б) */}
      <CookieBanner />

      {menuOpen && (
        <div className="fixed inset-0 z-[94]" role="dialog" aria-modal="true" aria-label="Меню">
          <div className="absolute inset-0 backdrop-in" style={{ background: "rgba(44,44,44,0.4)" }} onClick={closeMenu} />
          <div className="absolute left-0 top-0 bottom-0 w-[320px] max-w-[88vw] bg-cream shadow-lift drawer-in flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between px-5 h-[68px] border-b border-line-soft shrink-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-mute">Меню</p>
              <button onClick={closeMenu} aria-label="Закрыть меню" className={`burger is-open ${closing ? "is-closing" : ""}`}>
                <span className="burger-box"><span className="burger-cross" style={{ opacity: 1 }} /></span>
              </button>
            </div>
            <nav className="px-3 pt-4" aria-label="Основная навигация">
              {links.map((l, i) => (
                <Link key={l.to} to={l.to} onClick={closeMenu}
                  className="group flex items-center gap-3 px-3 h-[52px] rounded-[10px] text-[16px] font-bold text-ink hover:bg-surface transition-colors duration-200 fade-up"
                  style={{ animationDelay: `${60 + i * 50}ms` }}>
                  {l.label}
                  <ArrowRight size={16} className="ml-auto text-ink-mute opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
                </Link>
              ))}
            </nav>
            <div className="mt-auto px-5 py-6 border-t border-line-soft">
              {!session && (
                <Link to="/auth" onClick={closeMenu} className="flex items-center justify-center gap-2 h-11 rounded-[10px] bg-dark text-cream text-sm font-bold hover:bg-dark-deep transition-colors">
                  <User size={16} /> Войти или зарегистрироваться
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- иконки соцсетей ---------- */
function TelegramIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M9.04 15.51l-.37 5.27c.53 0 .76-.23 1.04-.5l2.5-2.4 5.18 3.8c.95.52 1.63.25 1.88-.88l3.4-15.98c.3-1.4-.51-1.95-1.43-1.6L1.35 10.9c-1.36.53-1.34 1.29-.23 1.63l5.1 1.59L18.06 6.7c.56-.37 1.07-.16.65.2L9.04 15.5z" />
    </svg>
  );
}
function VkIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13.16 17.5c-5.66 0-8.9-3.88-9.03-10.33h2.83c.09 4.73 2.17 6.73 3.82 7.14V7.17h2.67v4.09c1.63-.18 3.34-2.03 3.92-4.09h2.66c-.44 2.54-2.3 4.39-3.62 5.15 1.32.61 3.44 2.22 4.25 5.18h-2.93c-.63-1.96-2.2-3.47-4.28-3.68v3.68h-.29z" />
    </svg>
  );
}
function PinterestIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12c0 4.24 2.64 7.86 6.36 9.31-.09-.79-.17-2 .03-2.86.18-.78 1.17-4.97 1.17-4.97s-.3-.6-.3-1.48c0-1.39.81-2.43 1.81-2.43.85 0 1.27.64 1.27 1.41 0 .86-.55 2.14-.83 3.33-.24 1 .5 1.81 1.48 1.81 1.78 0 3.14-1.87 3.14-4.58 0-2.39-1.72-4.06-4.18-4.06-2.85 0-4.52 2.14-4.52 4.35 0 .86.33 1.79.75 2.29.08.1.09.19.07.29l-.28 1.14c-.04.19-.15.23-.34.14-1.25-.58-2.03-2.41-2.03-3.88 0-3.16 2.29-6.06 6.62-6.06 3.47 0 6.17 2.47 6.17 5.78 0 3.45-2.18 6.23-5.2 6.23-1.02 0-1.97-.53-2.3-1.15l-.62 2.38c-.23.87-.84 1.96-1.25 2.62.94.29 1.94.45 2.97.45 5.52 0 10-4.48 10-10S17.52 2 12 2z" />
    </svg>
  );
}

/* ---------- футер ---------- */
export function Footer() {
  return (
    <footer className="bg-dark text-cream mt-16">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <span className="text-[12px] text-cream/50">© 2026 Quantiform. Все права защищены</span>
        <div className="flex items-center gap-3 sm:gap-4">
          <a href="mailto:info@starttechpro.ru" className="text-[12px] text-cream/70 hover:text-cream transition-colors">info@starttechpro.ru</a>
          <div className="flex items-center gap-2">
            <a href="https://t.me/uyutart" target="_blank" rel="noopener noreferrer" aria-label="Telegram"
              className="w-9 h-9 rounded-[10px] bg-white/10 flex items-center justify-center text-cream/80 hover:bg-accent hover:text-ink transition-colors duration-200">
              <TelegramIcon />
            </a>
            <a href="https://vk.com/uyutart" target="_blank" rel="noopener noreferrer" aria-label="ВКонтакте"
              className="w-9 h-9 rounded-[10px] bg-white/10 flex items-center justify-center text-cream/80 hover:bg-accent hover:text-ink transition-colors duration-200">
              <VkIcon />
            </a>
            <a href="https://pinterest.com/uyutart" target="_blank" rel="noopener noreferrer" aria-label="Pinterest"
              className="w-9 h-9 rounded-[10px] bg-white/10 flex items-center justify-center text-cream/80 hover:bg-accent hover:text-ink transition-colors duration-200">
              <PinterestIcon />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
