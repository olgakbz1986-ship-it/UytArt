import { useState, useRef, useEffect, useMemo, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogOut, MapPin, Heart, Gift, Settings, Package, CheckCircle2, MessageSquare, ShieldAlert, Sparkles, BellRing, ClipboardList, Trash2, Flag, CreditCard, X, Lock, Palette, Bell, Shield, Camera, Check , Bot, Store, Wrench, BookOpen} from "lucide-react";
import { fmt, fmtDate, productById } from "../data/seed";
import { useMarketProducts } from "../lib/market";
import { useAppStore, type Order } from "../lib/store";
import { useSubStore, buyerLimits, fmtLimit, selectAiLeft } from "../lib/subscriptions";
import { useChatStore } from "../lib/chat";
import { useComplaintStore } from "../lib/complaint";
import { orderOwnerIdLike as orderOwnerId } from "../lib/ownership";
import { useMarketStore } from "../lib/marketStore";
import AgentPanel from "../components/agent-panel";
import { Badge, Btn, Field, ProductImg, ProgressBar, SettingsSection, Switch } from "../components/ui";
import { usePrefsStore } from "../lib/prefs";
import { useNotifyStore } from "../lib/notify";
import { ChatModal } from "../components/chat";
import MarketOrderDetail from "../components/MarketOrderDetail";
import { ReviewModal, TicketModal } from "../components/review";
import { BuyerPremiumSection } from "../components/PremiumBlocks";
import LimitWarning, { LimitCounters, DEFAULT_WATCHED } from "../components/LimitWarning";
import { BuyerSubscriptionsPanel } from "../components/BuyerSubscriptionsPanel";
import { BuyerOrdersPanel } from "../components/BuyerOrdersPanel";
import { BuyerCustomOrdersPanel } from "../components/BuyerCustomOrdersPanel";
import { BuyerFavoritesPanel, BuyerAddressesPanel, BuyerBonusPanel, BuyerComplaintsPanel } from "../components/BuyerPanels";
import {
  useUserSubscriptions,
  resolveTargetName,
  canonicalSellerId,
  unsubscribeOnServer,
  type ServerSubscription,
} from "../lib/userFeed";

export type Tab = "orders" | "agent" | "favorites" | "subscriptions" | "concepts" | "prices" | "custom" | "addresses" | "bonus" | "complaints" | "settings";

/* ============================================================
   ПАНЕЛИ «МОИ ПОДПИСКИ» И «МОИ ЗАКАЗЫ (покупателя)»
   ------------------------------------------------------------
   ВЫНЕСЕНЫ В ОТДЕЛЬНЫЕ ЭКСПОРТИРУЕМЫЕ КОМПОНЕНТЫ, чтобы их мог
   рендерить НЕ ТОЛЬКО кабинет покупателя (/profile), но и кабинет
   продавца (/seller/dashboard): продавец — тоже покупатель и имеет
   полное право подписываться на магазины/мастерские/авторов и
   совершать покупки. Ранее эти разделы существовали только в
   кабинете покупателя, поэтому в меню продавца были пустые
   переключатели без контента.
   Логика единая (общий серверный источник истины src/lib/userFeed.ts:
   /api/subscriptions), поэтому подписка, оформленная из любого
   кабинета, видна в обоих.
   ============================================================ */
const PLAN_NAME: Record<string, string> = { free: "Базовый", start: "Старт", designer: "Дизайнер", premium: "Премиум" };

/* Визуальные токены и возможности каждого уровня покупателя */
const BUYER_TIER: Record<string, { level: number; accent: string; soft: string; tagline: string; unlocked: string[]; locked: string[]; next?: string }> = {
  free: {
    level: 0,
    accent: "#6b6b66", soft: "#eae4d4", tagline: "Знакомство с платформой",
    unlocked: ["Покупки и безопасная сделка", "Подписки на магазины, мастерские и авторов", "Избранное, адреса и бонусы", "2 AI-генерации в месяц", "1 индивидуальный заказ"],
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
    locked: ["AI-агент: проекты интерьера и корзина (10 задач)", "VIP-статус и закрытые распродажи"],
    next: "premium",
  },
  premium: {
    level: 3,
    accent: "#d4a574", soft: "#f3e7d8", tagline: "Максимум возможностей",
    unlocked: ["Безлимит AI-генераций и заказов", "Скидка 7%", "AI-агент-партнёр: безлимит задач и черновики заказов", "Бесплатная доставка по округу", "Закрытые распродажи", "VIP-бейдж"],
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
  const market = useMarketProducts();
  const toggleFav = useAppStore((s) => s.toggleFav);
  const addresses = useAppStore((s) => s.addresses);
  const addAddress = useAppStore((s) => s.addAddress);
  const removeAddress = useAppStore((s) => s.removeAddress);
  const advanceStatus = useAppStore((s) => s.advanceStatus);
  const confirmReceipt = useAppStore((s) => s.confirmReceipt);
  const bonusBalance = useAppStore((s) => s.bonusBalance);
  const bonusHistory = useAppStore((s) => s.bonusHistory);
  const nav = useNavigate();

  const buyerPlan = useSubStore((s) => s.getBuyerPlan(session?.userId || "guest"));
  const concepts = useSubStore((s) => s.concepts);

  const removeConcept = useSubStore((s) => s.removeConcept);
  const priceWatches = useSubStore((s) => s.priceWatches);
  const removePriceWatch = useSubStore((s) => s.removePriceWatch);
  const aiLeft = useSubStore((s) => selectAiLeft(s, session?.userId || "guest"));
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
  const [responsesMap, setResponsesMap] = useState<Record<string, any[]>>({});
  const [loadingResponses, setLoadingResponses] = useState<Record<string, boolean>>({});
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [selectedMarketOrder, setSelectedMarketOrder] = useState<any>(null);

  const loadResponses = async (orderId: string) => {
    setLoadingResponses(prev => ({ ...prev, [orderId]: true }));
    try {
      const res = await fetch(`/api/orders/${orderId}/responses`);
      const data = await res.json();
      if (data.ok) {
        setResponsesMap(prev => ({ ...prev, [orderId]: data.responses }));
        setExpandedOrderId(orderId);
      }
    } catch (e) {
      console.error("Failed to load responses", e);
    } finally {
      setLoadingResponses(prev => ({ ...prev, [orderId]: false }));
    }
  };

  const handleAcceptResponse = async (orderId: string, responseId: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/responses/${responseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'accepted' })
      });
      const data = await res.json();
      if (data.ok) {
        useMarketStore.setState((s: any) => ({
          orders: s.orders.map((o: any) => o.id === orderId ? { ...o, status: 'in_progress' } : o)
        }));
        loadResponses(orderId);
        alert("Исполнитель принят! Заказ переведен в статус 'В работе'.");
      }
    } catch (e) {
      console.error("Failed to accept response", e);
    }
  };

  const handleRejectResponse = async (orderId: string, responseId: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/responses/${responseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected' })
      });
      if (res.ok) {
        loadResponses(orderId);
      }
    } catch (e) {
      console.error("Failed to reject response", e);
    }
  };


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

  const favProducts = favorites.map((id) => {
    // Сначала ищем в динамических товарах (созданных пользователями)
    const dynamicProduct = market.find((p: any) => p.id === id);
    if (dynamicProduct) return dynamicProduct;
    // Если нет, ищем в статических (из seed.ts)
    return productById(id);
  }).filter(Boolean) as any[];

  const TABS: { id: Tab; label: string; icon: typeof Package; locked?: boolean }[] = [
    { id: "orders", label: "Заказы", icon: Package },
    { id: "agent", label: "Агент", icon: Bot },
    { id: "favorites", label: "Избранное", icon: Heart },
    { id: "subscriptions", label: "Мои подписки", icon: Bell },
    { id: "concepts", label: "Мои концепты", icon: Sparkles, locked: !isPaid },
    { id: "prices", label: "Отслеживание цен", icon: BellRing, locked: !isPaid },
    { id: "custom", label: "Индивидуальные заказы", icon: ClipboardList, locked: !isPaid },
    { id: "addresses", label: "Адреса", icon: MapPin },
    { id: "bonus", label: "Бонусы", icon: Gift },
    { id: "complaints", label: "Жалобы", icon: Flag },
    { id: "settings", label: "Настройки", icon: Settings },
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
      <div className={`flex items-center gap-4 mb-4 flex-wrap ${tier.level === 3 ? "bg-[#1a3d2e] p-6 rounded-2xl shadow-lift" : tier.level === 2 ? "border-b-2 border-[#c77e28] pb-3" : tier.level === 1 ? "border-b-2 border-[#2d5f4c] pb-3" : ""}`}>
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
            <h1 className={`font-display font-bold text-[clamp(24px,3vw,32px)] ${tier.level === 3 ? "text-[#d4af37] font-serif" : "text-ink"}`}>Здравствуйте, {session.name.split(" ")[0]}!</h1>
            <span className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[12px] font-bold text-white" style={{ background: tier.accent, border: tier.level === 3 ? "2px solid #d4af37" : "none" }}>
              {lim.vip && <Sparkles size={11} />}{PLAN_NAME[buyerPlan]}
            </span>
          </div>
          <p className="text-[13.5px] text-ink-soft mt-1">{tier.tagline} · {session.email}{session.region ? ` · ${session.region}` : ""}</p>
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
        <nav className="flex flex-col lg:grid gap-2 fade-up">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => {
                if (t.locked) {
                  useNotifyStore.getState().push({ kind: "alert", title: "Раздел закрыт тарифом", text: `«${t.label}» доступно с тарифа «Старт». Переключитесь в Настройках.` });
                  return;
                }
                setTab(t.id);
              }}
              aria-current={tab === t.id ? "page" : undefined}
              className={`flex items-center gap-3 px-4 h-[48px] rounded-[10px] text-[13.5px] font-bold text-left transition-all ${t.locked ? "cursor-not-allowed opacity-60" : "cursor-pointer"} ${tab === t.id ? "bg-dark text-cream" : "bg-surface border border-line text-ink-soft hover:border-dark hover:text-ink"}`}>
              <t.icon size={17} /> {t.label}{t.locked && <Lock size={13} className="ml-auto text-ink-mute" />}
            </button>
          ))}
        </nav>

        {/* Контент кабинета */}
        <div className="min-w-0">

      {/* ЗАКАЗЫ */}
      {tab === "agent" && (
        <div className="fade-up">
          {/* §2.8: счётчики потребления + предупреждение при 80% лимита */}
          <LimitWarning actions={DEFAULT_WATCHED} refreshKey={tab} />
          <LimitCounters actions={DEFAULT_WATCHED} refreshKey={tab} />
          <AgentPanel />
        </div>
      )}

      {/* ЗАКАЗЫ ПОКУПАТЕЛЯ — переиспользуемая панель (та же, что в кабинете продавца) */}
      {tab === "orders" && <BuyerOrdersPanel orders={orders} />}

      {/* ИНДИВИДУАЛЬНЫЕ ЗАКАЗЫ С БИРЖИ (отдельный раздел) */}
      {/* ИНДИВИДУАЛЬНЫЕ ЗАКАЗЫ — общая панель src/components/BuyerCustomOrdersPanel
          (та же, что в кабинете продавца): карточки + модалка деталей со чатом,
          откликами, сделкой и оплатой. */}
      {tab === "custom" && <BuyerCustomOrdersPanel />}

      {/* ИЗБРАННОЕ */}
      {tab === "favorites" && <BuyerFavoritesPanel />}

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
      
      {/* МОИ ПОДПИСКИ — общая панель src/components/BuyerSubscriptionsPanel (идентична кабинету продавца) */}
      {tab === "subscriptions" && <BuyerSubscriptionsPanel />}

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
                  {(o as any).agentDraft && <span className="ml-2 px-2 py-0.5 rounded-full bg-accent-soft text-accent-deep text-[10.5px] font-bold">Черновик агента</span>}
                  {(o as any).agentPhoto && <img src={(o as any).agentPhoto} alt="" className="mt-2 w-16 h-16 object-cover rounded-[10px]" />}
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
      {tab === "addresses" && <BuyerAddressesPanel />}

      {/* БОНУСЫ */}
      {tab === "bonus" && <BuyerBonusPanel />}

      {/* ЖАЛОБЫ */}
      {tab === "complaints" && <BuyerComplaintsPanel />}

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
                  {(avatarDraft ?? session?.avatar) ? (
                    <img src={avatarDraft ?? session?.avatar} alt="Превью аватара" className="w-28 h-28 rounded-full object-cover ring-4 ring-offset-2 ring-offset-surface transition-transform duration-200" style={{ ["--tw-ring-color" as string]: tier.accent, transform: dragOver ? "scale(1.04)" : undefined }} />
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
                  ) : session?.avatar ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success-soft text-[#4d7327] text-[11px] font-bold mb-3"><CheckCircle2 size={12} /> Фото сохранено</span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-line-soft text-ink-mute text-[11px] font-bold mb-3">Фото не загружено</span>
                  )}
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <Btn size="sm" onClick={() => openAvatarPicker(false)}><Camera size={15} /> Выбрать фото</Btn>
                    {(avatarDraft ?? session?.avatar) && (
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
              <Field label="Имя и фамилия"><input className="field" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} placeholder="Анна Смирнова" autoComplete="name" /></Field>
              <Field label="Email"><input className="field" type="email" inputMode="email" autoComplete="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} placeholder="anna@mail.ru" /></Field>
              <Field label="Телефон"><input className="field" type="tel" inputMode="tel" autoComplete="tel" placeholder="+7 (___) ___-__-__" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></Field>
              <Field label="Город"><input className="field" value={profile.city} onChange={(e) => setProfile({ ...profile, city: e.target.value })} placeholder="Москва" autoComplete="address-level2" /></Field>
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
            <div className="flex gap-2 sm:gap-3 flex-wrap">
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

          <div className="bg-surface rounded-2xl shadow-card p-5">
            <p className="text-[13px] font-semibold text-ink mb-1 flex items-center gap-2"><CreditCard size={16} className="text-accent-deep" /> Тариф: {PLAN_NAME[buyerPlan]}</p>
            <Link to="/plans" className="text-[13px] font-bold text-accent-deep hover:text-accent underline">Управлять подпиской</Link>
          </div>
        </div>
      )}</div></div>

      {/* модалки */}
      {chatOrder && <ChatModal open onClose={() => setChatOrder(null)} kind="order" order={chatOrder} />}
      {selectedMarketOrder && (
        <MarketOrderDetail 
          order={selectedMarketOrder} 
          onClose={() => setSelectedMarketOrder(null)} 
        />
      )}
      {ticketFor && <TicketModal open onClose={() => setTicketFor(null)} orderId={ticketFor.order.id} orderNumber={ticketFor.order.number} kind={ticketFor.kind} />}
      {reviewFor && reviewFor.items[0] && (() => {
        const p = productById(reviewFor.items[0].productId);
        return p ? <ReviewModal open onClose={() => setReviewFor(null)} product={p} orderId={reviewFor.id} orderNumber={reviewFor.number} /> : null;
      })()}
    </div>
  );
}
