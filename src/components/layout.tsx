import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShoppingBag, User, LogOut, Search, ArrowRight, X } from "lucide-react";
import { GROUPS, GROUP_IMG, CATEGORIES, PRODUCTS, fmt, catBySlug, groupById } from "../data/seed";
import { useAppStore } from "../lib/store";
import { GroupImg } from "./ui";

/* ---------- контурный логотип-домик ---------- */
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
    <Link to="/" className="group flex items-center gap-2.5 shrink-0" aria-label="УютАрт — на главную">
      <HouseMark size={34} className="text-dark" />
      <span className="leading-tight">
        <span className="block font-display font-bold text-[18px] text-ink">УютАрт</span>
        <span className="block text-[9px] font-semibold tracking-[0.14em] uppercase text-ink-mute">AI-маркетплейс</span>
      </span>
    </Link>
  );
}

/* ---------- умный поиск ---------- */
function SmartSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
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
    return PRODUCTS.filter((p) => {
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
  }, [q]);

  const showPanel = open && q.trim().length >= 2;
  const go = (to: string) => { setOpen(false); setQ(""); inputRef.current?.blur(); nav(to); };

  return (
    <div className="relative flex-1 max-w-xl min-w-0 hidden sm:block">
      <div className={`flex items-center gap-2.5 h-[46px] px-4 rounded-full border bg-surface transition-all duration-300 ease-out ${open ? "border-dark shadow-card" : "border-line hover:border-ink-mute"}`}>
        <Search size={17} className={`shrink-0 transition-colors duration-200 ${open ? "text-accent-deep" : "text-ink-mute"}`} />
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
          className="flex-1 min-w-0 bg-transparent outline-none text-[14px] text-ink placeholder:text-ink-mute"
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

/* ---------- шапка ---------- */
export function Header() {
  const cart = useAppStore((s) => s.cart);
  const user = useAppStore((s) => s.user);
  const logout = useAppStore((s) => s.logout);
  const [menuOpen, setMenuOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const nav = useNavigate();
  const cartCount = cart.reduce((s, c) => s + c.qty, 0);

  const links = [
    { to: "/catalog", label: "Каталог" },
    { to: "/market", label: "Заказы" },
    { to: "/masters", label: "Мастера" },
    { to: "/ai-assistant", label: "AI-дизайнер" },
    { to: "/plans", label: "Тарифы" },
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
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-[68px] flex items-center gap-3 sm:gap-5">
          <button onClick={() => (menuOpen ? closeMenu() : setMenuOpen(true))} aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"} aria-expanded={menuOpen} className={`burger shrink-0 ${menuOpen ? "is-open" : ""}`}>
            <span className="burger-box">
              <span className="burger-line" /><span className="burger-line" /><span className="burger-line" />
              <span className="burger-cross" />
            </span>
          </button>
          <Logo />
          <SmartSearch />
          <div className="flex items-center gap-2 shrink-0 ml-auto">
            <Link to="/cart" aria-label={`Корзина, товаров: ${cartCount}`} className="relative w-11 h-11 rounded-[10px] flex items-center justify-center text-ink hover:bg-line-soft transition-colors">
              <ShoppingBag size={21} />
              {cartCount > 0 && <span className="absolute -top-1 -right-1 min-w-[19px] h-[19px] px-1 rounded-full bg-accent text-ink text-[10px] font-bold flex items-center justify-center">{cartCount}</span>}
            </Link>
            {user ? (
              <div className="flex items-center gap-2">
                <Link to="/profile" className="hidden md:flex items-center gap-2 h-11 px-3.5 rounded-[10px] border border-line bg-surface text-sm font-semibold text-ink hover:bg-line-soft transition-colors">
                  <User size={16} className="text-accent-deep" /> {user.name.split(" ")[0]}
                </Link>
                <button onClick={() => { logout(); nav("/"); }} aria-label="Выйти" className="w-11 h-11 rounded-[10px] flex items-center justify-center text-ink-mute hover:text-error hover:bg-error-soft transition-colors cursor-pointer">
                  <LogOut size={18} />
                </button>
              </div>
            ) : (
              <Link to="/auth" className="h-11 px-4 sm:px-5 rounded-[10px] bg-dark text-cream text-sm font-semibold flex items-center gap-2 hover:bg-dark-deep transition-colors">
                <User size={16} /> <span className="hidden sm:inline">Войти</span>
              </Link>
            )}
          </div>
        </div>
      </header>

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
            <div className="px-5 mt-6 pt-5 border-t border-line-soft">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-mute mb-3">Группы каталога</p>
              <div className="flex flex-wrap gap-1.5">
                {GROUPS.map((g) => (
                  <Link key={g.id} to={`/catalog?group=${g.id}`} onClick={closeMenu}
                    className="px-3 h-9 flex items-center rounded-full bg-surface border border-line-soft text-[12px] font-semibold text-ink-soft hover:border-dark hover:text-ink transition-colors duration-200">
                    {g.emoji} {g.name}
                  </Link>
                ))}
              </div>
            </div>
            <div className="mt-auto px-5 py-6 border-t border-line-soft">
              {!user && (
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

/* ---------- иконки соцсетей (инлайн-SVG, монохром) ---------- */
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

/* ---------- футер: одна строка — копирайт слева, почта и соцсети справа ---------- */
export function Footer() {
  return (
    <footer className="bg-dark text-cream mt-16">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <span className="text-[12px] text-cream/50">© 2026 УютАрт. Все права защищены</span>
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
