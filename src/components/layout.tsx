import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShoppingBag, Sparkles, User, LogOut, Search, ArrowRight, X, ClipboardList, Gem, Mail } from "lucide-react";
import { GROUPS, GROUP_IMG, CATEGORIES, OPERATOR, PRODUCTS, fmt, catBySlug, groupById } from "../data/seed";
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
    { to: "/catalog", label: "Каталог", icon: null },
    { to: "/market", label: "Заказы", icon: <ClipboardList size={17} className="text-accent-deep" /> },
    { to: "/masters", label: "Мастера", icon: null },
    { to: "/ai-assistant", label: "AI-дизайнер", icon: <Sparkles size={17} className="text-ai" /> },
    { to: "/plans", label: "Тарифы", icon: <Gem size={17} className="text-premium" /> },
    { to: "/about", label: "О нас", icon: null },
    { to: "/contacts", label: "Контакты", icon: <Mail size={17} className="text-accent" /> },
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
                  <span className="w-8 text-center text-accent-deep font-display text-[13px]">0{i + 1}</span>
                  {l.icon}
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
              <p className="text-[11px] text-ink-mute text-center mt-3">{OPERATOR.short} · ИНН {OPERATOR.inn}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- футер ---------- */
export function Footer() {
  return (
    <footer className="bg-dark text-cream mt-16">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-12 grid md:grid-cols-4 gap-8">
        <div>
          <div className="flex items-center gap-2.5">
            <HouseMark size={34} className="text-cream" />
            <span className="font-display font-bold text-[18px]">УютАрт</span>
          </div>
          <p className="text-[13px] text-cream/60 leading-relaxed mt-4 max-w-[260px]">
            AI-маркетплейс огромного ассортимента: от авторского декора до техники, одежды и товаров для дома — от проверенных продавцов со всей России.
          </p>
        </div>
        <div>
          <p className="text-[12px] font-bold uppercase tracking-widest text-cream/40 mb-4">Покупателям</p>
          {[["/catalog", "Каталог"], ["/market", "Биржа заказов"], ["/ai-assistant", "AI-дизайнер"], ["/plans", "Тарифы"], ["/profile", "Личный кабинет"]].map(([to, label]) => (
            <Link key={to} to={to} className="block text-[13px] text-cream/70 hover:text-cream py-1.5 transition-colors">{label}</Link>
          ))}
        </div>
        <div>
          <p className="text-[12px] font-bold uppercase tracking-widest text-cream/40 mb-4">Продавцам</p>
          {[["/seller/register", "Стать продавцом"], ["/seller/dashboard", "Кабинет продавца"], ["/legal/seller_agreement", "Агентский договор"]].map(([to, label]) => (
            <Link key={to} to={to} className="block text-[13px] text-cream/70 hover:text-cream py-1.5 transition-colors">{label}</Link>
          ))}
        </div>
        <div>
          <p className="text-[12px] font-bold uppercase tracking-widest text-cream/40 mb-4">Право и помощь</p>
          {[["/legal/buyer_tos", "Оферта"], ["/legal/return_policy", "Возврат товара"], ["/legal/escrow_rules", "Безопасная сделка"], ["/legal/privacy", "Конфиденциальность"], ["/legal/ip_policy", "Политика ИС"], ["/about", "О нас"], ["/contacts", "Контакты"]].map(([to, label]) => (
            <Link key={to} to={to} className="block text-[13px] text-cream/70 hover:text-cream py-1.5 transition-colors">{label}</Link>
          ))}
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-[12px] text-cream/50">
          <span>© {new Date().getFullYear()} {OPERATOR.short} · ИНН {OPERATOR.inn} · {OPERATOR.status}</span>
          <span>{OPERATOR.domain} · {OPERATOR.legalEmail}</span>
        </div>
      </div>
    </footer>
  );
}
