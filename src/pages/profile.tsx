import { useState, useRef, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogOut, MapPin, Heart, Gift, Settings, Package, CheckCircle2, MessageSquare, ShieldAlert, Sparkles, BellRing, ClipboardList, Trash2, Flag, CreditCard, X, Lock, Palette, Bell, Shield, Camera, Check } from "lucide-react";
import { fmt, fmtDate, productById } from "../data/seed";
import { useAppStore, NEXT_STATUS, type Order } from "../lib/store";
import { useSubStore, buyerLimits, fmtLimit, selectAiLeft } from "../lib/subscriptions";
import { useChatStore } from "../lib/chat";
import { useComplaintStore } from "../lib/complaint";
import { useMarketStore } from "./extras";
import { Badge, Btn, Field, ProductImg, ProgressBar, SettingsSection, Switch } from "../components/ui";
import { usePrefsStore } from "../lib/prefs";
import { ChatModal } from "../components/chat";
import { ReviewModal, TicketModal } from "../components/review";

type Tab = "orders" | "favorites" | "concepts" | "prices" | "custom" | "addresses" | "bonus" | "complaints" | "settings";

const PLAN_NAME: Record<string, string> = { free: "Базовый", start: "Старт", designer: "Дизайнер", premium: "Премиум" };

/* Визуальные токены и возможности каждого уровня покупателя */
const BUYER_TIER: Record<string, { level: number; accent: string; soft: string; tagline: string; unlocked: string[]; locked: string[]; next?: string }> = {
  free: {
    level: 0,
    accent: "#6b6b66", soft: "#eae4d4", tagline: "Знакомство с платформой",
    unlocked: ["Покупки и безопасная сделка", "2 AI-генерации в месяц", "1 индивидуальный заказ", "Бонусная программа"],
    locked: ["Концепты и отслеживание цен", "Фильтры качества", "Скидка на заказы"],
    next: "start",
  },
  start: {
    level: 1,
    accent: "#2d5f4c", soft: "#eaf2ee", tagline: "Уверенный покупатель",
    unlocked: ["15 AI-генераций", "3 индивидуальных заказа", "Фильтры качества", "Скидка 3%", "Концепты и 10 отслеживаемых цен"],
    locked: ["Ранний доступ к коллекциям", "Скидка 5%"],
    next: "designer",
  },
  designer: {
    level: 2,
    accent: "#c77e28", soft: "#f9ebd2", tagline: "Ценитель уникального",
    unlocked: ["50 AI-генераций", "10 индивидуальных заказов", "Скидка 5%", "Ранний доступ к коллекциям", "Безлимит отслеживания цен"],
    locked: ["Персональный куратор", "VIP-статус и закрытые распродажи"],
    next: "premium",
  },
  premium: {
    level: 3,
    accent: "#d4a574", soft: "#f3e7d8", tagline: "Максимум возможностей",
    unlocked: ["Безлимит AI-генераций и заказов", "Скидка 7%", "Персональный куратор", "Бесплатная доставка по округу", "Закрытые распродажи", "VIP-бейдж"],
    locked: [],
  },
};

const ORDER_LABEL: Record<string, { label: string; tone: "honey" | "ai" | "success" | "premium" }> = {
  paid: { label: "Принят", tone: "honey" },
  shipped: { label: "В пути", tone: "ai" },
  delivered: { label: "Готов к выдаче", tone: "premium" },
  received: { label: "Получен", tone: "success" },
};

export default function ProfilePage() {
  const session = useAppStore((s) => s.session);
  const logout = useAppStore((s) => s.logout);
  const updateUser = useAppStore((s) => s.updateUser);
  const orders = useAppStore((s) => s.orders);
  const favorites = useAppStore((s) => s.favorites);
  const toggleFav = useAppStore((s) => s.toggleFav);
  const addresses = useAppStore((s) => s.addresses);
  const addAddress = useAppStore((s) => s.addAddress);
  const removeAddress = useAppStore((s) => s.removeAddress);
  const advanceStatus = useAppStore((s) => s.advanceStatus);
  const confirmReceipt = useAppStore((s) => s.confirmReceipt);
  const bonusBalance = useAppStore((s) => s.bonusBalance);
  const bonusHistory = useAppStore((s) => s.bonusHistory);
  const nav = useNavigate();

  const buyerPlan = useSubStore((s) => s.buyerPlan);
  const concepts = useSubStore((s) => s.concepts);
  const removeConcept = useSubStore((s) => s.removeConcept);
  const priceWatches = useSubStore((s) => s.priceWatches);
  const removePriceWatch = useSubStore((s) => s.removePriceWatch);
  const aiLeft = useSubStore(selectAiLeft);
  const tickets = useChatStore((s) => s.tickets);
  const complaints = useComplaintStore((s) => s.complaints);
  const marketOrders = useMarketStore((s) => s.orders);
  const myMarketOrders = marketOrders.filter((o) => o.myOwn);

  const lim = buyerLimits(buyerPlan);
  const isPaid = buyerPlan !== "free";

  /* настройки: тема, уведомления и приватность — глобальные и персистентные */
  const theme = usePrefsStore((s) => s.theme);
  const setTheme = usePrefsStore((s) => s.setTheme);
  const notif = usePrefsStore((s) => s.buyerNotif);
  const setNotif = usePrefsStore((s) => s.setBuyerNotif);
  const privacy = usePrefsStore((s) => s.buyerPrivacy);
  const setPrivacy = usePrefsStore((s) => s.setBuyerPrivacy);
  const tier = BUYER_TIER[buyerPlan] || BUYER_TIER.free;

  const [tab, setTab] = useState<Tab>("orders");
  const [addr, setAddr] = useState({ label: "Дом", city: "", street: "", zip: "" });
  const [profile, setProfile] = useState({
    name: session?.name || "", email: session?.email || "", phone: session?.phone || "",
    city: "", birth: "", about: "",
  });
  const [avatarDraft, setAvatarDraft] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);
  const [chatOrder, setChatOrder] = useState<Order | null>(null);
  const [ticketFor, setTicketFor] = useState<{ order: Order; kind: "problem" | "return" } | null>(null);
  const [reviewFor, setReviewFor] = useState<Order | null>(null);

  /* единая точка загрузки аватара: скрытый input + программный клик.
     Программный .click() на file input работает во всех браузерах,
     в отличие от label+display:none, который часть браузеров игнорирует.
     pendingInstant: true — сохранить сразу (клик по аватару в шапке),
                     false — только черновик, применение по «Сохранить изменения». */
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const pendingInstantRef = useRef(false);
  const [dragOver, setDragOver] = useState(false);
  const openAvatarPicker = (instant: boolean) => {
    pendingInstantRef.current = instant;
    const el = avatarInputRef.current;
    if (el) {
      el.click();
      return;
    }
    /* страховка: если ref пуст — создаём input динамически */
    const tmp = document.createElement("input");
    tmp.type = "file";
    tmp.accept = "image/*";
    tmp.style.position = "fixed";
    tmp.style.left = "-9999px";
    tmp.onchange = () => { onAvatarFile(tmp.files?.[0], instant); tmp.remove(); };
    document.body.appendChild(tmp);
    tmp.click();
  };

  /* загрузка аватара: кроп в квадрат и сжатие до 256px (чтобы не раздувать localStorage).
     instant=true — сохраняем сразу; иначе — только черновик до «Сохранить изменения». */
  const onAvatarFile = (f: File | undefined, instant = false) => {
    if (!f || !f.type.startsWith("image/")) return;
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      const size = 256;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const min = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, size, size);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      if (instant) {
        /* клик по аватару в шапке — применяем сразу, чтобы фото появилось везде */
        setAvatarDraft(null);
        updateUser({ avatar: dataUrl });
      } else {
        /* окно в настройках — черновик, применение по «Сохранить изменения» */
        setAvatarDraft(dataUrl);
      }
      URL.revokeObjectURL(url);
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  };
  const removeAvatar = () => {
    setAvatarDraft(null);
    updateUser({ avatar: undefined });
  };

  const saveProfile = () => {
    /* применяем черновик аватара (если выбран) — фото отобразится в хедере и кабинете */
    updateUser({ ...profile, avatar: avatarDraft !== null ? avatarDraft : session?.avatar });
    if (avatarDraft !== null) setAvatarDraft(null);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2200);
  };

  /* полнота профиля для премиального индикатора */
  const completeness = (() => {
    const checks = [
      profile.name.trim().length >= 2,
      profile.email.includes("@"),
      profile.phone.trim().length >= 6,
      !!(avatarDraft ?? session?.avatar),
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  })();

  if (!session || session.role !== "buyer") {
    return (
      <div className="max-w-[700px] mx-auto px-4 py-24 text-center">
        <p className="text-[56px] mb-3">👤</p>
        <h1 className="font-display font-bold text-[28px] text-ink mb-2">Кабинет покупателя недоступен</h1>
        <p className="text-[14px] text-ink-soft mb-7">Войдите как покупатель или зарегистрируйтесь.</p>
        <Link to="/auth" className="inline-flex items-center justify-center h-[52px] px-7 rounded-[10px] bg-dark text-cream text-[15px] font-semibold hover:bg-dark-deep transition-colors">Войти</Link>
      </div>
    );
  }

  const favProducts = favorites.map((id) => productById(id)).filter(Boolean) as NonNullable<ReturnType<typeof productById>>[];

  const TABS: { id: Tab; label: string; icon: typeof Package; show: boolean }[] = [
    { id: "orders", label: "Заказы", icon: Package, show: true },
    { id: "favorites", label: "Избранное", icon: Heart, show: true },
    { id: "concepts", label: "Мои концепты", icon: Sparkles, show: isPaid },
    { id: "prices", label: "Отслеживание цен", icon: BellRing, show: isPaid },
    { id: "custom", label: "Индивидуальные заказы", icon: ClipboardList, show: isPaid },
    { id: "addresses", label: "Адреса", icon: MapPin, show: true },
    { id: "bonus", label: "Бонусы", icon: Gift, show: true },
    { id: "complaints", label: "Жалобы", icon: Flag, show: true },
    { id: "settings", label: "Настройки", icon: Settings, show: true },
  ];

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-10">
      {/* единый input загрузки аватара (общий для шапки и настроек).
          Скрыт НЕ через display:none — Safari/WebKit блокируют программный
          клик по input с display:none. Используем visually-hidden (вне экрана). */}
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        aria-label="Загрузить фото профиля"
        style={{ position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden", pointerEvents: "none", clipPath: "inset(50%)" }}
        onChange={(e) => { onAvatarFile(e.target.files?.[0], pendingInstantRef.current); e.target.value = ""; }}
      />
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        {/* кликабельный аватар: мгновенная загрузка — фото сразу появляется в хедере и кабинете */}
        <button type="button" onClick={() => openAvatarPicker(true)} className="relative group shrink-0 cursor-pointer rounded-full" title="Загрузить фото профиля" aria-label="Загрузить фото профиля">
          {session.avatar ? (
            <img src={session.avatar} alt={session.name} className="w-16 h-16 rounded-full object-cover ring-2 ring-offset-2 ring-offset-cream" style={{ ["--tw-ring-color" as string]: tier.accent }} />
          ) : (
            <span className="w-16 h-16 rounded-full flex items-center justify-center font-display font-bold text-[24px] ring-2 ring-offset-2 ring-offset-cream" style={{ background: "var(--color-dark)", color: "var(--color-accent)", ["--tw-ring-color" as string]: tier.accent }}>{session.name[0]?.toUpperCase()}</span>
          )}
          <span className="absolute inset-0 rounded-full bg-dark/0 group-hover:bg-dark/45 flex items-center justify-center transition-colors">
            <Camera size={20} className="text-cream opacity-0 group-hover:opacity-100 transition-opacity" />
          </span>
        </button>
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-display font-bold text-[clamp(24px,3vw,32px)] text-ink">Здравствуйте, {session.name.split(" ")[0]}!</h1>
            <span className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[12px] font-bold text-white" style={{ background: tier.accent }}>
              {lim.vip && <Sparkles size={11} />}{PLAN_NAME[buyerPlan]}
            </span>
          </div>
          <p className="text-[13.5px] text-ink-soft mt-1">{tier.tagline} · {session.email}{session.phone ? ` · ${session.phone}` : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/plans" className="text-[13px] font-bold text-accent-deep hover:text-accent underline">Улучшить тариф</Link>
          <button onClick={() => { logout(); nav("/"); }} aria-label="Выйти" className="w-11 h-11 rounded-[10px] flex items-center justify-center text-ink-mute hover:text-error hover:bg-error-soft transition-colors cursor-pointer">
            <LogOut size={18} />
          </button>
        </div>
      </div>

      <div className="bg-surface rounded-[14px] shadow-card px-5 py-4 mb-7">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <p className="text-[12.5px] font-bold text-ink flex items-center gap-1.5"><Sparkles size={14} className="text-ai" /> AI-генерации в этом месяце</p>
          <p className="text-[12px] text-ink-soft font-semibold">
            {Number.isFinite(lim.aiGens) ? `Использовано ${lim.aiGens - aiLeft} из ${lim.aiGens}` : "Безлимит"}
          </p>
        </div>
        <ProgressBar value={Number.isFinite(lim.aiGens) ? lim.aiGens - aiLeft : 1} max={Number.isFinite(lim.aiGens) ? lim.aiGens : 1} tone="ai" />
      </div>

      {/* Возможности текущего тарифа */}
      <div className="rounded-[14px] shadow-card px-5 py-4 mb-7 border border-line-soft" style={{ background: `linear-gradient(120deg, ${tier.soft} 0%, var(--color-surface) 60%)` }}>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <p className="text-[12.5px] font-bold text-ink">Тариф «{PLAN_NAME[buyerPlan]}» — что вам доступно</p>
          {tier.next && <Link to="/plans" className="text-[12px] font-bold underline" style={{ color: tier.accent }}>Открыть больше →</Link>}
        </div>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
          {tier.unlocked.map((f) => (
            <p key={f} className="flex items-center gap-2 text-[12.5px] text-ink-soft"><CheckCircle2 size={13} style={{ color: tier.accent }} className="shrink-0" /> {f}</p>
          ))}
          {tier.locked.map((f) => (
            <p key={f} className="flex items-center gap-2 text-[12.5px] text-ink-mute line-through decoration-[1.5px]"><X size={13} className="shrink-0" /> {f}</p>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-[240px_1fr] gap-6 items-start">
        {/* Вертикальная навигация */}
        <nav className="flex flex-col gap-2 fade-up">
          {TABS.filter((t) => t.show).map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-3 px-4 h-[48px] rounded-[10px] text-[13.5px] font-bold text-left transition-all cursor-pointer ${tab === t.id ? "bg-dark text-cream" : "bg-surface border border-line text-ink-soft hover:border-dark hover:text-ink"}`}>
              <t.icon size={17} /> {t.label}
            </button>
          ))}
        </nav>

        {/* Контент кабинета */}
        <div className="min-w-0">

      {/* ЗАКАЗЫ */}
      {tab === "orders" && (
        <div className="space-y-4 fade-up">
          {orders.length === 0 && (
            <div className="bg-surface rounded-2xl shadow-card px-8 py-16 text-center">
              <p className="text-[44px] mb-3">📦</p>
              <p className="font-display font-bold text-[19px] text-ink mb-2">Заказов пока нет</p>
              <Link to="/catalog" className="text-[14px] font-bold text-accent-deep hover:text-accent transition-colors">Перейти в каталог →</Link>
            </div>
          )}
          {orders.map((o) => (
            <div key={o.id} className="bg-surface rounded-2xl shadow-card p-5">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <div>
                  <p className="font-bold text-[15px] text-ink">Заказ {o.number}</p>
                  <p className="text-[12px] text-ink-mute mt-0.5">{fmtDate(o.date)} · {o.deliveryMethod}</p>
                </div>
                <Badge tone={ORDER_LABEL[o.status]?.tone || "honey"}>{ORDER_LABEL[o.status]?.label || o.status}</Badge>
              </div>
              <div className="flex gap-2.5 mb-3 overflow-x-auto no-scrollbar">
                {o.items.map((it) => {
                  const p = productById(it.productId);
                  return p ? (
                    <Link key={it.productId} to={`/product/${p.slug}`} className="w-[64px] h-[64px] rounded-[10px] overflow-hidden shrink-0 group"><ProductImg p={p} /></Link>
                  ) : null;
                })}
              </div>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <span className="font-display font-bold text-[19px] text-ink">{fmt(o.total)}</span>
                <div className="flex gap-2 flex-wrap">
                  <Btn size="sm" variant="outline" onClick={() => setChatOrder(o)}><MessageSquare size={14} /> Чат</Btn>
                  {o.status !== "received" && (
                    <Btn size="sm" variant="ghost" onClick={() => advanceStatus(o.id)} title="Демо-продвижение статуса">
                      → {ORDER_LABEL[NEXT_STATUS[o.status]]?.label}
                    </Btn>
                  )}
                  {o.status === "delivered" && (
                    <Btn size="sm" onClick={() => { confirmReceipt(o.id); }}>
                      <CheckCircle2 size={14} /> Подтвердить получение
                    </Btn>
                  )}
                  {o.status === "received" && (
                    <>
                      <Btn size="sm" variant="outline" onClick={() => setReviewFor(o)}><Gift size={14} /> Отзыв</Btn>
                      <Btn size="sm" variant="ghost" onClick={() => setTicketFor({ order: o, kind: "return" })}><ShieldAlert size={14} /> Возврат</Btn>
                      <Btn size="sm" variant="ghost" onClick={() => setTicketFor({ order: o, kind: "problem" })}><Flag size={14} /> Проблема</Btn>
                    </>
                  )}
                </div>
              </div>
              {tickets.filter((t) => t.orderId === o.id).length > 0 && (
                <p className="text-[11.5px] text-ai font-semibold mt-3 flex items-center gap-1.5"><ShieldAlert size={12} /> Тикет в арбитраже: {tickets.find((t) => t.orderId === o.id)?.reason}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ИЗБРАННОЕ */}
      {tab === "favorites" && (
        <div className="fade-up">
          {favProducts.length === 0 ? (
            <div className="bg-surface rounded-2xl shadow-card px-8 py-16 text-center">
              <p className="text-[44px] mb-3">💛</p>
              <p className="font-display font-bold text-[19px] text-ink mb-2">В избранном пусто</p>
              <p className="text-[14px] text-ink-soft">Нажимайте на сердечко в карточке товара.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {favProducts.map((p) => (
                <div key={p.id} className="bg-surface rounded-2xl shadow-card overflow-hidden">
                  <Link to={`/product/${p.slug}`} className="block aspect-[4/3] group"><ProductImg p={p} /></Link>
                  <div className="p-4">
                    <p className="text-[13.5px] font-semibold text-ink line-clamp-1">{p.name}</p>
                    <div className="flex items-center justify-between mt-2.5">
                      <span className="font-display font-bold text-[16px] text-ink">{fmt(p.price)}</span>
                      <button onClick={() => toggleFav(p.id)} aria-label="Убрать из избранного" className="w-9 h-9 rounded-[10px] bg-error-soft text-error flex items-center justify-center cursor-pointer hover:bg-error hover:text-white transition-colors">
                        <Heart size={15} fill="currentColor" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* КОНЦЕПТЫ */}
      {tab === "concepts" && (
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
                      <p className="text-[11.5px] text-ink-mute mt-0.5">{c.style} · {fmtDate(c.createdAt)}</p>
                    </div>
                    <button onClick={() => removeConcept(c.id)} aria-label="Удалить концепт" className="w-9 h-9 rounded-[10px] flex items-center justify-center text-ink-mute hover:text-error hover:bg-error-soft cursor-pointer transition-colors"><Trash2 size={15} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ОТСЛЕЖИВАНИЕ ЦЕН */}
      {tab === "prices" && (
        <div className="fade-up space-y-3">
          {priceWatches.length === 0 ? (
            <div className="bg-surface rounded-2xl shadow-card px-8 py-16 text-center">
              <p className="text-[44px] mb-3">🔔</p>
              <p className="font-display font-bold text-[19px] text-ink mb-2">Список отслеживания пуст</p>
              <p className="text-[13.5px] text-ink-soft max-w-sm mx-auto">Добавляйте товары — мы пришлём push, email и SMS, когда цена снизится. Лимит тарифа: {fmtLimit(lim.priceWatches)}.</p>
            </div>
          ) : (
            priceWatches.map((w) => {
              const p = productById(w.productId);
              return (
                <div key={w.id} className="bg-surface rounded-2xl shadow-card p-4 flex items-center gap-4">
                  {p && <Link to={`/product/${p.slug}`} className="w-[72px] h-[60px] rounded-[10px] overflow-hidden shrink-0 group"><ProductImg p={p} /></Link>}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-semibold text-ink line-clamp-1">{p?.name || "Товар"}</p>
                    <p className="text-[12px] text-ink-mute mt-0.5">Было {fmt(w.oldPrice)} → хотим {fmt(w.targetPrice)}</p>
                  </div>
                  <Badge tone={w.notified ? "success" : "honey"}>{w.notified ? "Цена снизилась!" : "Ждём снижения"}</Badge>
                  <button onClick={() => removePriceWatch(w.id)} aria-label="Убрать" className="w-9 h-9 rounded-[10px] flex items-center justify-center text-ink-mute hover:text-error hover:bg-error-soft cursor-pointer transition-colors"><Trash2 size={15} /></button>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ИНДИВИДУАЛЬНЫЕ ЗАКАЗЫ */}
      {tab === "custom" && (
        <div className="fade-up space-y-3">
          {myMarketOrders.length === 0 ? (
            <div className="bg-surface rounded-2xl shadow-card px-8 py-16 text-center">
              <p className="text-[44px] mb-3">🛠️</p>
              <p className="font-display font-bold text-[19px] text-ink mb-2">Индивидуальных заказов нет</p>
              <Link to="/market" className="text-[14px] font-bold text-accent-deep hover:text-accent transition-colors">Разместить заказ на бирже →</Link>
            </div>
          ) : (
            myMarketOrders.map((o) => (
              <div key={o.id} className="bg-surface rounded-2xl shadow-card p-5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="font-bold text-[15px] text-ink">{o.title}</p>
                  <Badge tone={o.responses > 0 ? "ai" : "honey"}>{o.responses > 0 ? `Предложений: ${o.responses}` : "На рассмотрении"}</Badge>
                </div>
                <p className="text-[13px] text-ink-soft mt-2">{o.desc}</p>
                <p className="flex items-center gap-4 flex-wrap text-[12.5px] text-ink-mute mt-2.5">
                  <span>{o.type}</span><span>до {fmt(o.budget)}</span><span>{o.term}</span><span>{o.region}</span>
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {/* АДРЕСА */}
      {tab === "addresses" && (
        <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start fade-up">
          <div className="space-y-3">
            {addresses.map((a) => (
              <div key={a.id} className="bg-surface rounded-2xl shadow-card p-5 flex items-start gap-4">
                <span className="w-11 h-11 rounded-[10px] bg-ai-soft text-ai flex items-center justify-center shrink-0"><MapPin size={19} /></span>
                <div className="flex-1">
                  <p className="font-bold text-[14.5px] text-ink flex items-center gap-2">{a.label} {a.isDefault && <Badge tone="ai">по умолчанию</Badge>}</p>
                  <p className="text-[13px] text-ink-soft mt-1">{a.city}, {a.street}</p>
                  <p className="text-[12px] text-ink-mute mt-0.5">индекс {a.zip}</p>
                </div>
                <button onClick={() => removeAddress(a.id)} className="text-[12.5px] font-semibold text-ink-mute hover:text-error cursor-pointer transition-colors">Удалить</button>
              </div>
            ))}
          </div>
          <div className="bg-surface rounded-2xl shadow-card p-6">
            <h2 className="font-display font-bold text-[18px] text-ink mb-4">Новый адрес</h2>
            <div className="space-y-3.5">
              <Field label="Название"><input className="field" value={addr.label} onChange={(e) => setAddr({ ...addr, label: e.target.value })} placeholder="Дом / Работа / Дача" /></Field>
              <Field label="Город"><input className="field" value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} placeholder="Москва" /></Field>
              <Field label="Улица, дом"><input className="field" value={addr.street} onChange={(e) => setAddr({ ...addr, street: e.target.value })} placeholder="ул. Пятницкая, 18" /></Field>
              <Field label="Индекс" hint="6 цифр"><input className="field" value={addr.zip} onChange={(e) => setAddr({ ...addr, zip: e.target.value.replace(/\D/g, "").slice(0, 6) })} placeholder="115035" /></Field>
              <Btn className="w-full" disabled={!addr.city.trim() || !addr.street.trim() || addr.zip.length !== 6} onClick={() => { addAddress(addr); setAddr({ label: "Дом", city: "", street: "", zip: "" }); }}>Сохранить адрес</Btn>
            </div>
          </div>
        </div>
      )}

      {/* БОНУСЫ */}
      {tab === "bonus" && (
        <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start fade-up">
          <div className="bg-surface rounded-2xl shadow-card p-6">
            <h2 className="font-display font-bold text-[18px] text-ink mb-4">История начислений</h2>
            <div className="space-y-2.5">
              {bonusHistory.map((b) => (
                <div key={b.id} className="flex items-center justify-between border-b border-line-soft pb-2.5 last:border-0">
                  <div>
                    <p className="text-[13.5px] font-semibold text-ink">{b.reason}</p>
                    <p className="text-[11.5px] text-ink-mute mt-0.5">{fmtDate(b.date)}</p>
                  </div>
                  <span className={`font-display font-bold text-[15px] ${b.amount < 0 ? "text-error" : "text-[#4d7327]"}`}>{b.amount < 0 ? `−${-b.amount}` : `+${b.amount}`}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-dark text-cream rounded-2xl p-6">
            <p className="text-[12px] font-bold uppercase tracking-wide text-cream/50">Бонусный счёт</p>
            <p className="font-display font-extrabold text-[40px] mt-2">{bonusBalance}</p>
            <p className="text-[13px] text-cream/60 mt-1">1 бонус = 1 ₽ при оплате заказа</p>
            <div className="mt-5 pt-5 border-t border-white/15 text-[13px] text-cream/70 space-y-1.5">
              <p className="flex justify-between"><span>Отзыв с фото</span><span className="font-bold text-cream">+300</span></p>
              <p className="flex justify-between"><span>Отзыв о заказе</span><span className="font-bold text-cream">+100</span></p>
              <p className="flex justify-between"><span>Кэшбэк за заказ</span><span className="font-bold text-cream">+50</span></p>
            </div>
          </div>
        </div>
      )}

      {/* ЖАЛОБЫ */}
      {tab === "complaints" && (
        <div className="fade-up space-y-3">
          {complaints.length === 0 ? (
            <div className="bg-surface rounded-2xl shadow-card px-8 py-16 text-center">
              <p className="text-[44px] mb-3">🛡️</p>
              <p className="font-display font-bold text-[19px] text-ink mb-2">Жалоб нет</p>
              <p className="text-[13.5px] text-ink-soft">Если продавец нарушит правила — пожаловаться можно на странице его магазина.</p>
            </div>
          ) : (
            complaints.map((c) => (
              <div key={c.id} className="bg-surface rounded-2xl shadow-card p-5">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                  <p className="font-bold text-[14.5px] text-ink">Жалоба на «{c.vendorName}»</p>
                  <Badge tone={c.status === "resolved" ? "success" : "honey"}>{c.status === "resolved" ? "Решено" : "На рассмотрении"}</Badge>
                </div>
                <p className="text-[12.5px] text-ink-mute">{c.category} · {fmtDate(c.createdAt)}</p>
                <p className="text-[13.5px] text-ink-soft mt-2">{c.description}</p>
              </div>
            ))
          )}
        </div>
      )}

      {/* НАСТРОЙКИ */}
      {tab === "settings" && (
        <div className="fade-up space-y-4">
          <p className="text-[13px] text-ink-soft">Настройки · уровень тарифа <strong style={{ color: tier.accent }}>{PLAN_NAME[buyerPlan]}</strong> — чем выше тариф, тем больше разделов доступно.</p>

          {/* Профиль — доступен и полностью редактируем на любом тарифе */}
          <SettingsSection title="Профиль" icon={<Settings size={15} />} minLevel={0} level={tier.level} accent={tier.accent}>
            {/* ОКНО ЗАГРУЗКИ ФОТО ПРОФИЛЯ: черновик применяется по «Сохранить изменения» */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); onAvatarFile(e.dataTransfer.files?.[0], false); }}
              className={`relative rounded-2xl border-2 border-dashed p-5 mb-5 transition-all duration-200 ${dragOver ? "bg-accent-soft/60" : "bg-cream/40"}`}
              style={{ borderColor: dragOver ? tier.accent : "var(--color-line)", transform: dragOver ? "scale(1.01)" : undefined }}
            >
              <div className="flex items-center gap-5 flex-wrap">
                {/* большое превью с бейджем камеры */}
                <div className="relative shrink-0">
                  {(avatarDraft ?? user.avatar) ? (
                    <img src={avatarDraft ?? user.avatar} alt="Превью аватара" className="w-28 h-28 rounded-full object-cover ring-4 ring-offset-2 ring-offset-surface transition-transform duration-200" style={{ ["--tw-ring-color" as string]: tier.accent, transform: dragOver ? "scale(1.04)" : undefined }} />
                  ) : (
                    <span className="w-28 h-28 rounded-full flex items-center justify-center font-display font-bold text-[40px] transition-transform duration-200" style={{ background: "var(--color-dark)", color: "var(--color-accent)", transform: dragOver ? "scale(1.04)" : undefined }}>
                      {profile.name[0]?.toUpperCase() || "У"}
                    </span>
                  )}
                  <span className="absolute bottom-1 right-1 w-9 h-9 rounded-full bg-accent text-ink flex items-center justify-center ring-2 ring-surface shadow-card"><Camera size={17} /></span>
                </div>
                {/* описание, статус и действия */}
                <div className="flex-1 min-w-[220px]">
                  <p className="font-display font-bold text-[15px] text-ink mb-1">Фото профиля</p>
                  <p className="text-[12px] text-ink-mute mb-3 leading-relaxed">JPG или PNG · до 5 МБ. Обрежем в квадрат и сожмём автоматически. Выбранное фото появится в шапке сайта и в личном кабинете после нажатия «Сохранить изменения».</p>
                  {avatarDraft !== null ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold mb-3" style={{ background: "var(--color-accent-soft)", color: "var(--color-accent-deep)" }}>
                      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--color-accent-deep)" }} /> Новое фото — не сохранено
                    </span>
                  ) : user.avatar ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success-soft text-[#4d7327] text-[11px] font-bold mb-3"><CheckCircle2 size={12} /> Фото сохранено</span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-line-soft text-ink-mute text-[11px] font-bold mb-3">Фото не загружено</span>
                  )}
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <Btn size="sm" onClick={() => openAvatarPicker(false)}><Camera size={15} /> Выбрать фото</Btn>
                    {(avatarDraft ?? user.avatar) && (
                      <Btn size="sm" variant="ghost" onClick={removeAvatar}><Trash2 size={14} /> Удалить</Btn>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* полнота профиля */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[12.5px] font-bold text-ink">Полнота профиля</p>
                <p className="text-[12px] font-bold" style={{ color: tier.accent }}>{completeness}%</p>
              </div>
              <ProgressBar value={completeness} max={100} tone={completeness >= 80 ? "success" : "accent"} />
              <p className="text-[11.5px] text-ink-mute mt-1.5">
                {completeness >= 80 ? "Отличный профиль — мастера видят вас как надёжного покупателя" : "Заполните профиль — фото, город и контакты повышают доверие мастеров"}
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-x-4 gap-y-3.5">
              <Field label="Имя и фамилия"><input className="field" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} placeholder="Анна Смирнова" /></Field>
              <Field label="Email"><input className="field" type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} placeholder="anna@mail.ru" /></Field>
              <Field label="Телефон"><input className="field" placeholder="+7 (___) ___-__-__" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></Field>
              <Field label="Город"><input className="field" value={profile.city} onChange={(e) => setProfile({ ...profile, city: e.target.value })} placeholder="Москва" /></Field>
              <Field label="Дата рождения"><input className="field" type="date" value={profile.birth} onChange={(e) => setProfile({ ...profile, birth: e.target.value })} /></Field>
              <div className="sm:col-span-2">
                <Field label="О себе"><textarea className="field" rows={3} value={profile.about} onChange={(e) => setProfile({ ...profile, about: e.target.value })} placeholder="Пара слов о ваших вкусах — поможет мастерам и AI-подбору" /></Field>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-4">
              <Btn size="sm" onClick={saveProfile}>
                {profileSaved ? <><Check size={15} /> Сохранено</> : "Сохранить изменения"}
              </Btn>
              {avatarDraft !== null && (
                <span className="text-[11.5px] font-semibold" style={{ color: "var(--color-accent-deep)" }}>Не забудьте сохранить — новое фото применится после «Сохранить изменения»</span>
              )}
            </div>
          </SettingsSection>

          {/* Уведомления — всем */}
          <SettingsSection title="Уведомления" icon={<Bell size={15} />} minLevel={0} level={tier.level} accent={tier.accent}>
            <div className="space-y-3.5">
              {([["email", "Email", "Статусы заказов, чеки и ответы мастеров"], ["push", "Push", "Снижение цен, бонусы и акции"], ["telegram", "Telegram-бот", "Самое важное в мессенджер"]] as const).map(([k, t, d]) => (
                <div key={k} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-semibold text-ink">{t}</p>
                    <p className="text-[11.5px] text-ink-mute">{d}</p>
                  </div>
                  <Switch checked={notif[k]} onChange={(v) => setNotif({ [k]: v })} label={t} />
                </div>
              ))}
            </div>
          </SettingsSection>

          {/* Тема — со «Старт» */}
          <SettingsSection title="Тема оформления" icon={<Palette size={15} />} minLevel={1} level={tier.level} nextLabel="тариф «Старт»" accent={tier.accent}>
            <div className="flex gap-2 flex-wrap">
              {([["light", "Светлая"], ["dark", "Тёмная"], ["system", "Системная"]] as const).map(([id, label]) => (
                <button key={id} onClick={() => setTheme(id)}
                  className={`px-4 h-10 rounded-[10px] text-[13px] font-bold cursor-pointer transition-all ${theme === id ? "bg-dark text-cream" : "bg-line-soft text-ink-soft hover:bg-line"}`}>
                  {label}
                </button>
              ))}
            </div>
          </SettingsSection>

          {/* Приватность — с «Дизайнер» */}
          <SettingsSection title="Приватность и данные" icon={<Shield size={15} />} minLevel={2} level={tier.level} nextLabel="тариф «Дизайнер»" accent={tier.accent}>
            <div className="space-y-3.5">
              {([["aiProfiling", "AI-профилирование", "Персональные подборки на основе ваших предпочтений"], ["digest", "Дайджест новинок", "Еженедельная подборка нового от мастеров"]] as const).map(([k, t, d]) => (
                <div key={k} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-semibold text-ink">{t}</p>
                    <p className="text-[11.5px] text-ink-mute">{d}</p>
                  </div>
                  <Switch checked={privacy[k]} onChange={(v) => setPrivacy({ [k]: v })} label={t} />
                </div>
              ))}
            </div>
            <Btn size="sm" variant="ghost" className="mt-4 !text-error">Удалить аккаунт</Btn>
          </SettingsSection>

          {/* Куратор — «Премиум» */}
          <SettingsSection title="Персональный куратор" icon={<Sparkles size={15} />} minLevel={3} level={tier.level} nextLabel="тариф «Премиум»" accent={tier.accent}>
            <p className="text-[13px] text-ink-soft leading-relaxed">Ваш куратор — Анна. Приоритетная поддержка 24/7, помощь с подбором и индивидуальные предложения.</p>
          </SettingsSection>

          <div className="bg-surface rounded-2xl shadow-card p-5">
            <p className="text-[13px] font-semibold text-ink mb-1 flex items-center gap-2"><CreditCard size={16} className="text-accent-deep" /> Тариф: {PLAN_NAME[buyerPlan]}</p>
            <Link to="/plans" className="text-[13px] font-bold text-accent-deep hover:text-accent underline">Управлять подпиской</Link>
          </div>
        </div>
      )}</div></div>

      {/* модалки */}
      {chatOrder && <ChatModal open onClose={() => setChatOrder(null)} kind="order" order={chatOrder} />}
      {ticketFor && <TicketModal open onClose={() => setTicketFor(null)} orderId={ticketFor.order.id} orderNumber={ticketFor.order.number} kind={ticketFor.kind} />}
      {reviewFor && reviewFor.items[0] && (() => {
        const p = productById(reviewFor.items[0].productId);
        return p ? <ReviewModal open onClose={() => setReviewFor(null)} product={p} orderId={reviewFor.id} orderNumber={reviewFor.number} /> : null;
      })()}
    </div>
  );
}
