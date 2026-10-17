/* ============================================================
   CABINET ADMIN — общий каркас и переиспользуемые компоненты.
   Единая дизайн-система сайта: токены ink/surface/line/accent/honey,
   radii rounded-xl/2xl, shadow-card, шрифты display/body.
   Принцип экранов: сначала «что требует решения», затем «что произошло»,
   затем «почему». Все цифры кликабельны там, где есть детальная карточка.
   ============================================================ */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Bot, ClipboardCheck, Users, Store, Package, ShoppingCart, Wallet,
  Scale, LifeBuoy, Shield, Megaphone, BarChart3, Rocket, Settings, ScrollText,
  Search, Bell, ChevronDown, X, AlertTriangle, Inbox, LogOut, Sparkles, ChevronRight,
  GraduationCap, Radar,
} from "lucide-react";
import { Btn, Badge, Field, Modal, Switch } from "../../components/ui";
import { adminApi } from "../../lib/admin-api";

export const cn = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(" ");

/* ── типы и константы риска ─────────────────────────────── */
export type Risk = "low" | "medium" | "high" | "critical";
export const RISK_META: Record<Risk, { label: string; cls: string }> = {
  low: { label: "Низкий риск", cls: "bg-success/10 text-success border-success/30" },
  medium: { label: "Средний риск", cls: "bg-honey/15 text-[#8a6410] border-honey/40" },
  high: { label: "Высокий риск", cls: "bg-warning/10 text-warning border-warning/30" },
  critical: { label: "Критический риск", cls: "bg-error/10 text-error border-error/40" },
};
export function RiskTag({ r }: { r: Risk }) {
  return <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-bold whitespace-nowrap", RISK_META[r]?.cls || RISK_META.medium.cls)}>{RISK_META[r]?.label || r}</span>;
}

/* ── хук данных с обязательными состояниями UI ──────────── */
export function useCabinetData<T>(loader: () => Promise<any>, deps: any[] = []): { data: T | null; loading: boolean; error: string | null; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const { reloadKey } = useCabinet();
  useEffect(() => {
    let on = true; setLoading(true); setError(null);
    loader().then((r: any) => {
      if (!on) return;
      if (r && r.ok === false) setError(mapError(r));
      else setData(r);
    }).catch(() => on && setError("Сервер недоступен. Проверьте соединение и попробуйте ещё раз."))
      .finally(() => on && setLoading(false));
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick, reloadKey]);
  return { data, loading, error, reload: () => setTick((t) => t + 1) };
}
export function mapError(r: any): string {
  switch (r?.error) {
    case "no_session": return "Сессия истекла. Войдите заново через страницу входа.";
    case "forbidden": return "Нет доступа к этому разделу для вашей роли. Запросите права у Super Admin.";
    case "reason_required": return "Действие не выполнено: требуется причина.";
    case "double_confirmation_required": return "Критическое действие: требуется подтверждение второго администратора.";
    case "second_admin_required": return "Укажите второго администратора для подтверждения.";
    case "separation_of_duties": return "Разделение полномочий: настройщик агента не может подтверждать единолично.";
    case "irreversible_needs_confirm_text": return "Необратимое действие: введите текст подтверждения.";
    default: return "Ошибка выполнения. Детали зафиксированы в журнале.";
  }
}

/* ── состояния экранов ──────────────────────────────────── */
export function SkeletonRows({ n = 5, h = 56 }: { n?: number; h?: number }) {
  return (
    <div className="space-y-2.5" aria-busy="true" aria-label="Загрузка данных">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="rounded-xl bg-line-soft animate-pulse" style={{ height: h }} />
      ))}
    </div>
  );
}
export function EmptyState({ icon, title, why, action }: { icon?: ReactNode; title: string; why: string; action?: ReactNode }) {
  return (
    <div className="text-center py-12 px-6 rounded-2xl border border-dashed border-line bg-surface/50">
      <span className="inline-flex w-12 h-12 rounded-full bg-line-soft text-ink-mute items-center justify-center mb-3">{icon || <Inbox size={22} />}</span>
      <h4 className="font-display font-bold text-[17px] text-ink mb-1">{title}</h4>
      <p className="text-[13px] text-ink-soft max-w-md mx-auto mb-4">{why}</p>
      {action}
    </div>
  );
}
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="text-center py-10 rounded-2xl border border-error/30 bg-error/5">
      <AlertTriangle size={26} className="mx-auto text-error mb-2" />
      <p className="text-[13.5px] font-semibold text-ink mb-3">{message}</p>
      {onRetry && <Btn variant="outline" size="sm" onClick={onRetry}>Повторить</Btn>}
    </div>
  );
}
export function LoadingBlock({ rows = 4 }: { rows?: number }) { return <SkeletonRows n={rows} />; }

/* ── панель / карточка ──────────────────────────────────── */
export function Panel({ title, sub, right, children, className }: { title?: ReactNode; sub?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("bg-surface rounded-2xl shadow-card border border-line/60 p-5", className)}>
      {(title || right) && (
        <header className="flex items-start justify-between gap-3 mb-4">
          <div>
            {title && <h3 className="font-display font-bold text-[16px] text-ink leading-tight">{title}</h3>}
            {sub && <p className="text-[12.5px] text-ink-soft mt-0.5">{sub}</p>}
          </div>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

/* ── универсальная таблица с кликабельными строками ─────── */
export function DataTable<T extends Record<string, any>>({ cols, rows, onRow, rowKey, empty }: {
  cols: { key: string; title: string; render?: (r: T) => ReactNode; mono?: boolean; right?: boolean }[];
  rows: T[]; onRow?: (r: T) => void; rowKey?: (r: T) => string; empty?: ReactNode;
}) {
  if (!rows.length) return empty || <EmptyState title="Нет данных" why="В текущей выборке объектов нет. Измените фильтры или дождитесь поступления данных." />;
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-[11.5px] uppercase tracking-wide text-ink-mute border-b border-line">
            {cols.map((c) => <th key={c.key} className={cn("py-2 px-3 font-bold", c.right && "text-right")}>{c.title}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={rowKey ? rowKey(r) : i} onClick={() => onRow?.(r)}
              className={cn("border-b border-line/50 last:border-0 transition-colors", onRow && "cursor-pointer hover:bg-line-soft/60")}>
              {cols.map((c) => (
                <td key={c.key} className={cn("py-2.5 px-3 text-ink", c.mono && "font-mono text-[12px]", c.right && "text-right")}>
                  {c.render ? c.render(r) : String(r[c.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── drawer ─────────────────────────────────────────────── */
export function Drawer({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90]">
      <div className="absolute inset-0 bg-dark/40 backdrop-blur-[2px]" onClick={onClose} />
      <aside className={cn("absolute right-0 top-0 h-full bg-surface border-l border-line shadow-modal overflow-y-auto fade-up", wide ? "w-[min(760px,94vw)]" : "w-[min(560px,94vw)]")}>
        <header className="sticky top-0 bg-surface/95 backdrop-blur border-b border-line px-6 py-4 flex items-center justify-between z-10">
          <h3 className="font-display font-bold text-[18px] text-ink">{title}</h3>
          <button onClick={onClose} className="w-9 h-9 rounded-lg grid place-items-center text-ink-soft hover:bg-line-soft cursor-pointer"><X size={18} /></button>
        </header>
        <div className="p-6 space-y-5">{children}</div>
      </aside>
    </div>
  );
}

/* ── подтверждение опасных действий ─────────────────────── */
export interface ConfirmSpec {
  title: string;
  risk: Risk;
  affected: string;
  changes: string[];
  reversible: boolean;
  reasonLabel?: string;
  requireConfirmText?: boolean;
  extra?: ReactNode;
}
export function DangerConfirm({ spec, busy, onCancel, onConfirm }: { spec: ConfirmSpec; busy?: boolean; onCancel: () => void; onConfirm: (reason: string, confirmText: string) => void }) {
  const [reason, setReason] = useState("");
  const [ctext, setCtext] = useState("");
  const ok = reason.trim().length >= 5 && (!spec.requireConfirmText || ctext.trim() === "ПОДТВЕРЖДАЮ");
  return (
    <Modal open onClose={onCancel} title={spec.title}>
      <div className="space-y-4">
        <div className="flex items-center gap-2"><RiskTag r={spec.risk} />
          {!spec.reversible && <Badge tone="error">Необратимо</Badge>}
        </div>
        <div className="bg-line-soft/60 rounded-xl p-4 text-[13px] space-y-2">
          <p><b>Затронет:</b> {spec.affected}</p>
          <div><b>Изменения:</b><ul className="list-disc pl-5 mt-1 space-y-0.5">{spec.changes.map((c, i) => <li key={i}>{c}</li>)}</ul></div>
          <p><b>Отмена:</b> {spec.reversible ? "действие обратимо через журнал" : "НЕОБРАТИМО — откат невозможен"}</p>
        </div>
        {spec.extra}
        <Field label={"Причина" + (spec.reasonLabel ? ` (${spec.reasonLabel})` : "")} required>
          <textarea className="field min-h-[70px]" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Обязательное обоснование — попадёт в неизменяемый журнал" />
        </Field>
        {spec.requireConfirmText && (
          <Field label="Введите ПОДТВЕРЖДАЮ для необратимого действия" required>
            <input className="field" value={ctext} onChange={(e) => setCtext(e.target.value)} placeholder="ПОДТВЕРЖДАЮ" />
          </Field>
        )}
        <div className="flex gap-3 pt-1">
          <Btn variant="outline" className="flex-1" onClick={onCancel} disabled={busy}>Отмена</Btn>
          <Btn className="flex-1" disabled={!ok || busy} onClick={() => onConfirm(reason.trim(), ctext.trim())}>{busy ? "Выполняется…" : "Подтвердить действие"}</Btn>
        </div>
      </div>
    </Modal>
  );
}

/* ── тосты ──────────────────────────────────────────────── */
type Toast = { id: number; text: string; kind: "ok" | "err" | "info" };
const ToastCtx = createContext<{ push: (text: string, kind?: Toast["kind"]) => void }>({ push: () => {} });
export const useToast = () => useContext(ToastCtx);

/* ── контекст кабинета ──────────────────────────────────── */
export interface AdminProfile { id: string; email: string; name: string; role: string; role_title: string; perms: string[]; sections: string[]; env: string; passkey?: boolean }
interface CabCtx { profile: AdminProfile | null; can: (perm: string) => boolean; inSection: (s: string) => boolean; logout: () => void; reloadKey: number; bump: () => void }
const Ctx = createContext<CabCtx>({ profile: null, can: () => false, inSection: () => false, logout: () => {}, reloadKey: 0, bump: () => {} });
export const useCabinet = () => useContext(Ctx);

/* ── навигация по задачам ───────────────────────────────── */
export const NAV: { id: string; title: string; icon: any; subs?: { to: string; title: string }[] }[] = [
  { id: "home", title: "Главная", icon: LayoutDashboard },
  { id: "agent", title: "Агент", icon: Bot, subs: [{ to: "#/admin/agent", title: "Обзор и режим" }, { to: "#/admin/sources", title: "Источники данных" }, { to: "#/admin/observations", title: "Журнал наблюдений" }, { to: "#/admin/traces", title: "Agent Trace Explorer" }, { to: "#/admin/eval", title: "Evaluation Hub" }, { to: "#/admin/roi", title: "AI ROI Center" }] },
  { id: "decisions", title: "Решения", icon: ClipboardCheck, subs: [{ to: "#/admin/queue", title: "Очередь решений" }, { to: "#/admin/policies", title: "Policy Engine" }, { to: "#/admin/release-plan", title: "План релиза" }] },
  { id: "users", title: "Пользователи", icon: Users },
  { id: "sellers", title: "Продавцы", icon: Store },
  { id: "catalog", title: "Каталог", icon: Package, subs: [{ to: "#/admin/catalog", title: "Модерация" }, { to: "#/admin/search-analytics", title: "Поиск" }] },
  { id: "orders", title: "Заказы", icon: ShoppingCart },
  { id: "finance", title: "Финансы", icon: Wallet },
  { id: "disputes", title: "Споры", icon: Scale },
  { id: "support", title: "Поддержка", icon: LifeBuoy },
  { id: "security", title: "Безопасность", icon: Shield },
  { id: "content", title: "Контент", icon: Megaphone },
  { id: "analytics", title: "Аналитика", icon: BarChart3 },
  { id: "releases", title: "Релизы", icon: Rocket },
  { id: "settings", title: "Настройки", icon: Settings },
  { id: "logs", title: "Журналы", icon: ScrollText },
];

/* ── глобальный поиск ───────────────────────────────────── */
function GlobalSearch() {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<any>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (q.trim().length < 2) { setRes(null); return; }
    const t = setTimeout(() => adminApi.search(q.trim()).then(setRes), 250);
    return () => clearTimeout(t);
  }, [q]);
  const groups = res?.groups || {};
  const LINKS: Record<string, string> = { users: "#/admin/users", sellers: "#/admin/sellers", orders: "#/admin/orders", products: "#/admin/catalog", disputes: "#/admin/disputes", tickets: "#/admin/support", hypotheses: "#/admin/agent", incidents: "#/admin/traces", transactions: "#/admin/finance", rules: "#/admin/policies", settings: "#/admin/settings" };
  return (
    <div className="relative flex-1 max-w-[420px]">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute pointer-events-none" />
      <input className="field !pl-9 !h-9 text-[13px]" placeholder="Поиск: email, ID, заказ, артикул, спор…" value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 200)} />
      {open && q.length >= 2 && (
        <div className="absolute top-10 left-0 right-0 bg-surface border border-line rounded-xl shadow-modal max-h-[420px] overflow-y-auto z-50 p-2">
          {Object.keys(groups).length === 0 && <p className="text-[12.5px] text-ink-mute p-3">Ничего не найдено по «{q}». Проверьте ID, email или номер заказа.</p>}
          {Object.entries(groups).map(([g, items]: [string, any]) => (
            <div key={g} className="mb-1.5">
              <p className="text-[10.5px] uppercase font-bold text-ink-mute px-2 py-1">{g}</p>
              {(items as any[]).slice(0, 5).map((it) => (
                <a key={it.id} href={(LINKS[g] || "#/admin") + "?focus=" + it.id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-line-soft text-[12.5px] text-ink no-underline">
                  <span className="truncate"><b>{it.title}</b> · <span className="text-ink-soft">{it.sub}</span></span>
                  <ChevronRight size={13} className="shrink-0 text-ink-mute" />
                </a>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── центр уведомлений ──────────────────────────────────── */
function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const { bump } = useCabinet();
  useEffect(() => { adminApi.notifications().then((r: any) => r?.ok && setItems(r.items || [])); }, [open]);
  const unread = items.filter((n) => !n.read).length;
  const critOpen = items.filter((n) => n.level === "critical" && !n.acked).length;
  const ack = async (id: string) => { await adminApi.notifAck(id, "принято к рассмотрению"); await adminApi.notifRead(id); setItems((x) => x.map((n) => n.id === id ? { ...n, read: true, acked: true } : n)); bump(); };
  const TONE: Record<string, string> = { critical: "border-error/40 bg-error/5", important: "border-warning/40 bg-warning/5", info: "border-line bg-surface" };
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="relative w-9 h-9 rounded-lg grid place-items-center hover:bg-line-soft cursor-pointer text-ink-soft" aria-label="Уведомления">
        <Bell size={17} />
        {(unread > 0 || critOpen > 0) && <span className={cn("absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold grid place-items-center text-white", critOpen ? "bg-error" : "bg-warning")}>{unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-10 w-[360px] max-h-[480px] overflow-y-auto bg-surface border border-line rounded-xl shadow-modal z-50 p-2">
          <p className="px-2 py-1.5 text-[11px] uppercase font-bold text-ink-mute">Центр уведомлений</p>
          {!items.length && <p className="p-3 text-[12.5px] text-ink-mute">Новых событий нет.</p>}
          {items.map((n) => (
            <div key={n.id} className={cn("border rounded-lg p-2.5 mb-1.5", TONE[n.level] || TONE.info)}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Badge tone={n.level === "critical" ? "error" : n.level === "important" ? "warning" : "neutral"}>{n.level === "critical" ? "критично" : n.level === "important" ? "важно" : "инфо"}</Badge>
                  <p className="text-[12.5px] font-semibold text-ink mt-1">{n.title}</p>
                </div>
                <a href={n.link} onClick={() => adminApi.notifRead(n.id)} className="text-[11px] font-bold text-accent-deep shrink-0">открыть</a>
              </div>
              {n.level === "critical" && !n.acked && (
                <button onClick={() => ack(n.id)} className="mt-1.5 text-[11px] font-bold text-error hover:underline cursor-pointer">Принято к рассмотрению</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── оболочка кабинета ──────────────────────────────────── */
export default function CabinetLayout({ content }: { content: ReactNode }) {
  const loc = useLocation();
  const nav = useNavigate();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [profile, setProfile] = useState<AdminProfile | null>((window as any).__QF_ADMIN__ || null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    adminApi.me().then((r: any) => {
      if (r && r.ok) { setProfile(r.profile); (window as any).__QF_ADMIN__ = r.profile; }
      else if (r && r.error === "no_session") setProfile(null);
    }).catch(() => {}).finally(() => setSessionChecked(true));
  }, []);

  const push = (text: string, kind: Toast["kind"] = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  };

  const can = (perm: string) => !!profile && (profile.perms.includes(perm) || profile.perms.includes("*"));
  const inSection = (s: string) => !!profile && (profile.sections.includes("*") || profile.sections.includes(s));
  const logout = async () => { await adminApi.logout(); delete (window as any).__QF_ADMIN__; nav("/auth", { replace: true }); };

  const sectionId = (() => {
    const p = loc.pathname.replace("/admin", "").replace(/^\//, "");
    if (!p) return "home";
    if (p.startsWith("queue") || p.startsWith("policies") || p.startsWith("release-plan")) return "decisions";
    if (p.startsWith("sources") || p.startsWith("observations") || p.startsWith("traces") || p.startsWith("eval") || p.startsWith("roi") || p.startsWith("agent")) return "agent";
    if (p.startsWith("catalog") || p.startsWith("search-analytics")) return "catalog";
    if (p.startsWith("release")) return "releases";
    return p.split("/")[0].split("-")[0];
  })();

  /* Нет служебной сессии — тихо возвращаем на страницу входа (без промежуточных
     экранов и перезагрузок: именно они давали «моргание» чужой страницей). */
  if (!profile) {
    if (!sessionChecked) return <div className="min-h-screen bg-canvas" />;
    return <Navigate to="/auth" replace />;
  }

  return (
    <ToastCtx.Provider value={{ push }}>
      <Ctx.Provider value={{ profile, can, inSection, logout, reloadKey, bump: () => setReloadKey((k) => k + 1) }}>
        <div className="min-h-screen bg-canvas flex">
          <aside className={cn("fixed lg:sticky top-0 z-40 h-screen bg-dark text-cream flex flex-col transition-all duration-200", collapsed ? "w-[64px]" : "w-[230px]", menuOpen ? "left-0" : "-left-[260px] lg:left-0")}>
            <div className="h-[56px] flex items-center gap-2 px-4 border-b border-white/10">
              <Sparkles size={18} className="text-honey shrink-0" />
              {!collapsed && <span className="font-display font-bold text-[15px] tracking-wide">Quantiform · Оператор</span>}
              <button onClick={() => setCollapsed(!collapsed)} className="ml-auto hidden lg:grid w-7 h-7 place-items-center rounded-md hover:bg-white/10 cursor-pointer text-cream/70"><ChevronDown size={14} className={cn("transition-transform", collapsed ? "-rotate-90" : "rotate-90")} /></button>
            </div>
            <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
              {NAV.filter((n) => inSection(n.id)).map((n) => {
                const active = sectionId === n.id;
                return (
                  <div key={n.id}>
                    <Link to={"/admin/" + (n.id === "home" ? "" : n.id)} onClick={() => setMenuOpen(false)}
                      className={cn("flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-semibold no-underline transition-colors cursor-pointer", active ? "bg-honey text-dark" : "text-cream/80 hover:bg-white/10")}>
                      <n.icon size={16} className="shrink-0" />
                      {!collapsed && <span className="truncate">{n.title}</span>}
                    </Link>
                    {!collapsed && active && n.subs && (
                      <div className="ml-8 border-l border-white/15 pl-2 my-1 space-y-0.5">
                        {n.subs.map((s) => (
                          <Link key={s.to} to={s.to.replace("#/admin", "/admin")} className="block text-[12px] text-cream/60 hover:text-cream no-underline py-0.5">{s.title}</Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
            <div className="p-3 border-t border-white/10">
              <button onClick={logout} className="flex items-center gap-2 w-full rounded-lg px-2.5 py-2 text-[12.5px] font-semibold text-cream/70 hover:bg-white/10 cursor-pointer"><LogOut size={15} /> Выход</button>
            </div>
          </aside>
          {menuOpen && <div className="fixed inset-0 bg-dark/40 z-30 lg:hidden" onClick={() => setMenuOpen(false)} />}

          <div className="flex-1 min-w-0">
            <header className="sticky top-0 z-30 h-[56px] bg-surface/95 backdrop-blur border-b border-line flex items-center gap-3 px-4">
              <button onClick={() => setMenuOpen(true)} className="lg:hidden w-9 h-9 grid place-items-center rounded-lg hover:bg-line-soft cursor-pointer"><ScrollText size={17} /></button>
              <GlobalSearch />
              <NotificationCenter />
              <span className={cn("hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border", profile.env === "production" ? "bg-error/10 text-error border-error/30" : "bg-success/10 text-success border-success/30")}>
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" /> {profile.env.toUpperCase()}
              </span>
              <div className="ml-auto flex items-center gap-2 min-w-0">
                <div className="text-right hidden md:block min-w-0">
                  <p className="text-[12.5px] font-bold text-ink truncate">{profile.name}</p>
                  <p className="text-[11px] text-ink-mute truncate">{profile.role_title}</p>
                </div>
                <span className="w-9 h-9 rounded-full bg-dark text-cream grid place-items-center text-[13px] font-bold shrink-0">{profile.name.slice(0, 1)}</span>
              </div>
            </header>
            {profile.env === "production" && (
              <div className="bg-error/5 border-b border-error/20 px-4 py-1.5 text-[11.5px] font-semibold text-error">
                Опасные действия в production выполняются только с причиной и фиксируются в неизменяемом журнале.
              </div>
            )}
            <main className="p-4 sm:p-6 max-w-[1400px] mx-auto">{content}</main>
          </div>
        </div>
        <div className="fixed bottom-4 right-4 z-[95] space-y-2 w-[min(360px,90vw)]">
          {toasts.map((t) => (
            <div key={t.id} className={cn("rounded-xl px-4 py-3 text-[13px] font-semibold shadow-modal fade-up flex items-start gap-2", t.kind === "ok" ? "bg-dark text-cream" : t.kind === "err" ? "bg-error text-white" : "bg-surface border border-line text-ink")}>
              {t.text}
            </div>
          ))}
        </div>
      </Ctx.Provider>
    </ToastCtx.Provider>
  );
}

/* мелкая утилита форматирования */
export const fmtRub = (n: number) => new Intl.NumberFormat("ru-RU").format(Math.round(n || 0)) + " ₽";
export const fmtNum = (n: number) => new Intl.NumberFormat("ru-RU").format(n || 0);
export const timeAgo = (ts: number) => {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return "сейчас";
  if (m < 60) return m + " мин назад";
  if (m < 1440) return Math.round(m / 60) + " ч назад";
  return Math.round(m / 1440) + " дн назад";
};
export const dueIn = (ts: number) => {
  const h = Math.round((ts - Date.now()) / 3600000);
  return h < 0 ? "просрочено" : h < 24 ? h + " ч" : Math.round(h / 24) + " дн";
};
