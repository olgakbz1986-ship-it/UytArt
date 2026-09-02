import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  LogOut, MapPin, Heart, Gift, Settings, Package, CheckCircle2, MessageSquare, ShieldAlert,
  Crown, Sparkles, BellRing, ClipboardList, Bookmark, Trash2, Flag, ChevronRight,
} from "lucide-react";
import { fmt, fmtDate, productById, PRODUCTS } from "../data/seed";
import { useAppStore, NEXT_STATUS, type Order } from "../lib/store";
import { Badge, Btn, Field, ProductImg } from "../components/ui";
import { ChatModal } from "../components/chat";
import { ReviewModal, TicketModal } from "../components/review";
import { useReviewStore } from "../lib/review";
import { useComplaintStore } from "../lib/complaint";
import { useSubStore, buyerLimits, selectAiLeft, fmtLimit, currentMonth } from "../lib/subscriptions";

type Tab = "orders" | "favorites" | "concepts" | "prices" | "custom" | "addresses" | "bonus" | "complaints" | "settings";

const PLAN_NAME: Record<string, string> = { free: "Базовый", start: "Старт", designer: "Дизайнер", premium: "Премиум" };
const ORDER_LABEL: Record<string, { label: string; tone: "honey" | "ai" | "success" | "premium" }> = {
  paid: { label: "Принят", tone: "honey" },
  shipped: { label: "В пути", tone: "ai" },
  delivered: { label: "Готов к выдаче", tone: "premium" },
  received: { label: "Получен", tone: "success" },
};

export default function ProfilePage() {
  const user = useAppStore((s) => s.user);
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
  const addBonus = useAppStore((s) => s.addBonus);
  const bonusBalance = useAppStore((s) => s.bonusBalance);
  const bonusHistory = useAppStore((s) => s.bonusHistory);
  const hasReviewed = useReviewStore((s) => s.hasReviewed);
  const complaints = useComplaintStore((s) => s.complaints);
  const nav = useNavigate();

  const buyerPlan = useSubStore((s) => s.buyerPlan);
  const aiLeft = useSubStore(selectAiLeft);
  const concepts = useSubStore((s) => s.concepts);
  const removeConcept = useSubStore((s) => s.removeConcept);
  const priceWatches = useSubStore((s) => s.priceWatches);
  const removePriceWatch = useSubStore((s) => s.removePriceWatch);
  const lim = buyerLimits(buyerPlan);
  const isPaid = buyerPlan !== "free";

  const [tab, setTab] = useState<Tab>("orders");
  const [addr, setAddr] = useState({ label: "Дом", city: "", street: "", zip: "" });
  const [profile, setProfile] = useState({ name: user?.name || "", email: user?.email || "", phone: user?.phone || "" });
  const [saved, setSaved] = useState(false);
  const [chatOrder, setChatOrder] = useState<Order | null>(null);
  const [reviewFor, setReviewFor] = useState<{ order: Order; productId: string } | null>(null);
  const [ticketFor, setTicketFor] = useState<{ order: Order; kind: "problem" | "return" } | null>(null);

  /* демо-уведомление о бонусе за отзыв: через 2 дня после получения */
  const [bonusHint, setBonusHint] = useState<Order | null>(null);
  useEffect(() => {
    const o = orders.find((x) => x.status === "received" && Date.now() - +new Date(x.date) > 1 * 864e5);
    if (o) setBonusHint(o);
  }, [orders]);

  if (!user) {
    return (
      <div className="max-w-[700px] mx-auto px-4 py-24 text-center">
        <p className="text-[56px] mb-3">👤</p>
        <h1 className="font-display font-bold text-[28px] text-ink mb-2">Вы не вошли в аккаунт</h1>
        <p className="text-[14px] text-ink-soft mb-7">Войдите, чтобы видеть заказы, избранное и бонусы.</p>
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
      {/* шапка кабинета */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <span className="w-16 h-16 rounded-full bg-dark text-accent flex items-center justify-center font-display font-bold text-[24px]">{user.name[0]?.toUpperCase()}</span>
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-display font-bold text-[clamp(24px,3vw,32px)] text-ink">Здравствуйте, {user.name.split(" ")[0]}!</h1>
            <Badge tone={isPaid ? "premium" : "neutral"}><Crown size={12} /> {PLAN_NAME[buyerPlan]}</Badge>
            {lim.vip && <Badge tone="honey"><Sparkles size={12} /> VIP</Badge>}
          </div>
          <p className="text-[13.5px] text-ink-soft mt-1">{user.email}{user.phone ? ` · ${user.phone}` : ""}</p>
        </div>
        <button onClick={() => { logout(); nav("/"); }} className="flex items-center gap-2 h-11 px-4 rounded-[10px] border border-line bg-surface text-sm font-semibold text-ink-soft hover:text-error hover:border-error transition-colors cursor-pointer">
          <LogOut size={16} /> Выйти
        </button>
      </div>

      {/* прогресс-бар AI-генераций */}
      <div className="bg-surface rounded-xl border border-line-soft shadow-card px-5 py-4 mb-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
          <p className="flex items-center gap-2 text-[13px] font-bold text-ink"><Sparkles size={15} className="text-ai" /> AI-генерации в этом месяце</p>
          <p className="text-[12.5px] text-ink-soft font-semibold">
            {Number.isFinite(lim.aiGens) ? `Осталось ${fmtLimit(aiLeft)} из ${lim.aiGens}` : "Безлимит"}
          </p>
        </div>
        <div className="h-2 rounded-full bg-line-soft overflow-hidden">
          <div className="h-full rounded-full bg-ai transition-all duration-500"
            style={{ width: `${Number.isFinite(lim.aiGens) ? Math.max(4, ((lim.aiGens - Math.max(0, aiLeft)) / lim.aiGens) * 100) : 100}%` }} />
        </div>
        {!isPaid && (
          <p className="text-[12px] text-ink-mute mt-2">
            На бесплатном тарифе 2 генерации в месяц. <Link to="/plans" className="text-accent-deep font-bold underline">Улучшить тариф</Link>
          </p>
        )}
        {isPaid && lim.discountPct > 0 && (
          <p className="text-[12px] text-ink-mute mt-2 flex items-center gap-1.5"><Crown size={12} className="text-accent-deep" /> Скидка {lim.discountPct}% на все заказы применяется в корзине автоматически{lim.earlyAccess ? " · ранний доступ к коллекциям за 48 ч" : ""}{lim.curator ? " · персональный куратор: curator@uyutart.ru" : ""}</p>
        )}
      </div>

      {/* вкладки */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-8">
        {TABS.filter((t) => t.show).map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 min-h-[44px] rounded-full text-[13.5px] font-bold whitespace-nowrap transition-all duration-200 cursor-pointer ${tab === t.id ? "bg-dark text-cream" : "bg-surface border border-line text-ink-soft hover:border-dark hover:text-ink"}`}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {/* ========== ЗАКАЗЫ ========== */}
      {tab === "orders" && (
        <div className="space-y-4 fade-up">
          {bonusHint && (
            <div className="bg-accent-soft border border-accent/40 rounded-2xl px-5 py-4 flex items-center gap-3.5 flex-wrap fade-up">
              <Gift size={20} className="text-accent-deep shrink-0" />
              <p className="text-[13px] text-ink flex-1 min-w-[220px]">
                Заказ <strong>{bonusHint.number}</strong> получен! Оставьте отзыв с фото в интерьере — <strong className="text-accent-deep">+300 бонусов</strong>.
              </p>
              <Btn size="sm" onClick={() => setReviewFor({ order: bonusHint, productId: bonusHint.items[0]?.productId || "" })}>Оставить отзыв</Btn>
            </div>
          )}
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
                  <p className="font-bold text-[15px] text-ink flex items-center gap-2">Заказ {o.number}
                    <Badge tone={ORDER_LABEL[o.status]?.tone || "honey"}>{ORDER_LABEL[o.status]?.label || o.status}</Badge>
                  </p>
                  <p className="text-[12px] text-ink-mute mt-0.5">{fmtDate(o.date)} · {o.deliveryMethod} · {o.address}</p>
                </div>
                <span className="font-display font-bold text-[19px] text-ink">{fmt(o.total)}</span>
              </div>
              <div className="flex gap-2.5 mb-3 overflow-x-auto no-scrollbar">
                {o.items.map((it) => {
                  const p = productById(it.productId);
                  return p ? (
                    <Link key={it.productId} to={`/product/${p.slug}`} className="w-[64px] h-[64px] rounded-[10px] overflow-hidden shrink-0 group"><ProductImg p={p} /></Link>
                  ) : null;
                })}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Btn size="sm" variant="outline" onClick={() => setChatOrder(o)}><MessageSquare size={14} /> Чат по заказу</Btn>
                {o.status !== "received" && (
                  <Btn size="sm" variant="outline" onClick={() => advanceStatus(o.id)}>
                    <ChevronRight size={14} /> {o.status === "paid" ? "Демо: отправить" : o.status === "shipped" ? "Демо: в пункт выдачи" : "Демо: доставлен"}
                  </Btn>
                )}
                {o.status === "delivered" && (
                  <Btn size="sm" onClick={() => { confirmReceipt(o.id); addBonus(50, "Подтверждение получения"); }}>
                    <CheckCircle2 size={14} /> Подтвердить получение
                  </Btn>
                )}
                {o.status === "received" && !hasReviewed(o.items[0]?.productId || "", o.id) && (
                  <Btn size="sm" variant="outline" onClick={() => setReviewFor({ order: o, productId: o.items[0]?.productId || "" })}><Gift size={14} /> Отзыв +300</Btn>
                )}
                {o.status === "received" && (
                  <>
                    <Btn size="sm" variant="ghost" className="!text-error" onClick={() => setTicketFor({ order: o, kind: "return" })}>Оформить возврат</Btn>
                    <Btn size="sm" variant="ghost" className="!text-error" onClick={() => setTicketFor({ order: o, kind: "problem" })}><ShieldAlert size={14} /> Сообщить о проблеме</Btn>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========== ИЗБРАННОЕ ========== */}
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

      {/* ========== КОНЦЕПТЫ (платно) ========== */}
      {tab === "concepts" && (
        <div className="fade-up">
          {concepts.length === 0 ? (
            <div className="bg-surface rounded-2xl shadow-card px-8 py-16 text-center">
              <p className="text-[44px] mb-3">🎨</p>
              <p className="font-display font-bold text-[19px] text-ink mb-2">Концептов пока нет</p>
              <p className="text-[14px] text-ink-soft mb-6">Сгенерируйте дизайн комнаты в AI-дизайнере и сохраните понравившийся вариант.</p>
              <Link to="/ai-assistant" className="inline-flex items-center justify-center h-11 px-6 rounded-[10px] bg-dark text-cream text-sm font-semibold hover:bg-dark-deep transition-colors"><Sparkles size={16} className="mr-2" /> Открыть AI-дизайнер</Link>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {concepts.map((c) => (
                <div key={c.id} className="bg-surface rounded-2xl shadow-card overflow-hidden">
                  {c.image
                    ? <img src={c.image} alt={`Концепт ${c.style}`} className="w-full aspect-[4/3] object-cover" />
                    : <div className="w-full aspect-[4/3] bg-ai-soft flex items-center justify-center text-[36px]">🛋️</div>}
                  <div className="p-4 flex items-center justify-between">
                    <div>
                      <Badge tone="ai">{c.style}</Badge>
                      <p className="text-[12px] text-ink-mute mt-1.5">{fmtDate(c.createdAt)}</p>
                    </div>
                    <div className="flex gap-2">
                      <Link to="/ai-assistant" className="text-[12px] font-bold text-accent-deep underline">Подобрать товары</Link>
                      <button onClick={() => removeConcept(c.id)} aria-label="Удалить концепт" className="w-8 h-8 rounded-[8px] flex items-center justify-center text-ink-mute hover:text-error hover:bg-error-soft cursor-pointer transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========== ОТСЛЕЖИВАНИЕ ЦЕН (платно) ========== */}
      {tab === "prices" && (
        <div className="fade-up space-y-3">
          <p className="text-[13px] text-ink-soft">Следите за товарами — пришлём push, email и SMS, когда цена снизится. Лимит тарифа: {fmtLimit(lim.priceWatches)} товаров.</p>
          {priceWatches.length === 0 && (
            <div className="bg-surface rounded-2xl shadow-card px-8 py-14 text-center">
              <p className="text-[40px] mb-3">🔔</p>
              <p className="font-display font-bold text-[18px] text-ink mb-1.5">Список пуст</p>
              <p className="text-[13.5px] text-ink-soft">Добавляйте товары в отслеживание из карточки товара.</p>
            </div>
          )}
          {priceWatches.map((w) => {
            const p = productById(w.productId);
            return (
              <div key={w.id} className="bg-surface rounded-2xl shadow-card px-5 py-4 flex items-center gap-4 flex-wrap">
                {p && <Link to={`/product/${p.slug}`} className="w-14 h-14 rounded-[10px] overflow-hidden shrink-0 group"><ProductImg p={p} /></Link>}
                <div className="flex-1 min-w-[180px]">
                  <p className="font-bold text-[14px] text-ink">{p?.name || "Товар"}</p>
                  <p className="text-[12.5px] text-ink-soft mt-0.5">
                    Сейчас <strong className="text-ink">{fmt(p?.price ?? w.oldPrice)}</strong> · ждём <strong className="text-[#4d7327]">{fmt(w.targetPrice)}</strong>
                  </p>
                </div>
                <Badge tone="ai"><BellRing size={11} /> следим</Badge>
                <button onClick={() => removePriceWatch(w.id)} aria-label="Убрать из отслеживания" className="w-10 h-10 rounded-[10px] flex items-center justify-center text-ink-mute hover:text-error hover:bg-error-soft cursor-pointer transition-colors"><Trash2 size={15} /></button>
              </div>
            );
          })}
          <PriceWatchAdder limit={lim.priceWatches} current={priceWatches.length} />
        </div>
      )}

      {/* ========== ИНДИВИДУАЛЬНЫЕ ЗАКАЗЫ (платно) ========== */}
      {tab === "custom" && (
        <div className="fade-up">
          <div className="bg-surface rounded-2xl shadow-card px-8 py-14 text-center">
            <p className="text-[44px] mb-3">🛠️</p>
            <p className="font-display font-bold text-[19px] text-ink mb-2">Ваши индивидуальные заказы</p>
            <p className="text-[14px] text-ink-soft mb-6 max-w-md mx-auto">
              Лимит тарифа «{PLAN_NAME[buyerPlan]}»: {fmtLimit(lim.marketOrders)} активных заказов. Создайте заказ на бирже — мастера округа пришлют предложения.
            </p>
            <Link to="/market" className="inline-flex items-center justify-center h-11 px-6 rounded-[10px] bg-dark text-cream text-sm font-semibold hover:bg-dark-deep transition-colors"><ClipboardList size={16} className="mr-2" /> Открыть биржу заказов</Link>
          </div>
        </div>
      )}

      {/* ========== АДРЕСА ========== */}
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
              <Btn className="w-full" disabled={!addr.city || !addr.street || addr.zip.length !== 6}
                onClick={() => { addAddress(addr); setAddr({ label: "Дом", city: "", street: "", zip: "" }); }}>
                Сохранить адрес
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* ========== БОНУСЫ ========== */}
      {tab === "bonus" && (
        <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start fade-up">
          <div className="bg-surface rounded-2xl shadow-card p-6">
            <h2 className="font-display font-bold text-[18px] text-ink mb-4">История начислений</h2>
            <div className="space-y-2.5">
              {bonusHistory.length === 0 && <p className="text-[13.5px] text-ink-soft">Начислений пока нет.</p>}
              {bonusHistory.map((b) => (
                <div key={b.id} className="flex items-center justify-between border-b border-line-soft pb-2.5 last:border-0">
                  <div>
                    <p className="text-[13.5px] font-semibold text-ink">{b.reason}</p>
                    <p className="text-[11.5px] text-ink-mute mt-0.5">{fmtDate(b.date)}</p>
                  </div>
                  <span className={`font-display font-bold text-[15px] ${b.amount >= 0 ? "text-[#4d7327]" : "text-error"}`}>{b.amount >= 0 ? "+" : ""}{b.amount}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-dark text-cream rounded-2xl p-6">
            <p className="text-[12px] font-bold uppercase tracking-wide text-cream/50">Бонусный счёт</p>
            <p className="font-display font-extrabold text-[40px] mt-2">{bonusBalance}</p>
            <p className="text-[13px] text-cream/60 mt-1">1 бонус = 1 ₽ · до 30% заказа</p>
            <div className="mt-5 pt-5 border-t border-white/15 text-[13px] text-cream/70 space-y-1.5">
              <p className="flex justify-between"><span>Отзыв с фото в интерьере</span><span className="font-bold text-cream">+300</span></p>
              <p className="flex justify-between"><span>Подтверждение получения</span><span className="font-bold text-cream">+50</span></p>
            </div>
          </div>
        </div>
      )}

      {/* ========== ЖАЛОБЫ ========== */}
      {tab === "complaints" && (
        <div className="fade-up space-y-3">
          <p className="text-[13px] text-ink-soft">Жалобы на продавцов рассматриваются арбитражем платформы. Пожаловаться можно со страницы магазина.</p>
          {complaints.length === 0 && (
            <div className="bg-surface rounded-2xl shadow-card px-8 py-14 text-center">
              <p className="text-[40px] mb-3">⚖️</p>
              <p className="font-display font-bold text-[18px] text-ink mb-1.5">Жалоб нет</p>
              <p className="text-[13.5px] text-ink-soft">И это отлично.</p>
            </div>
          )}
          {complaints.map((c) => (
            <div key={c.id} className="bg-surface rounded-2xl shadow-card px-5 py-4 flex items-center gap-4 flex-wrap">
              <span className="w-11 h-11 rounded-[10px] bg-error-soft text-error flex items-center justify-center shrink-0"><Flag size={18} /></span>
              <div className="flex-1 min-w-[200px]">
                <p className="font-bold text-[14px] text-ink">На «{c.vendorName}» · {c.category}</p>
                <p className="text-[12.5px] text-ink-soft mt-0.5 line-clamp-1">{c.description}</p>
                <p className="text-[11.5px] text-ink-mute mt-0.5">{fmtDate(c.createdAt)}</p>
              </div>
              <Badge tone={c.status === "new" ? "honey" : c.status === "in_review" ? "ai" : "success"}>
                {c.status === "new" ? "Принята" : c.status === "in_review" ? "На рассмотрении" : "Решена"}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {/* ========== НАСТРОЙКИ ========== */}
      {tab === "settings" && (
        <div className="max-w-[560px] bg-surface rounded-2xl shadow-card p-7 fade-up">
          <h2 className="font-display font-bold text-[20px] text-ink mb-5">Настройки профиля</h2>
          <div className="space-y-4">
            <Field label="Имя"><input className="field" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></Field>
            <Field label="Email"><input className="field" type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} /></Field>
            <Field label="Телефон"><input className="field" placeholder="+7 (___) ___-__-__" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></Field>
            <Btn onClick={() => { updateUser(profile); setSaved(true); setTimeout(() => setSaved(false), 2000); }}>
              {saved ? "Сохранено ✓" : "Сохранить изменения"}
            </Btn>
          </div>
          <div className="mt-6 pt-5 border-t border-line-soft">
            <p className="text-[13px] font-bold text-ink mb-2">Тариф: {PLAN_NAME[buyerPlan]}</p>
            <Link to="/plans" className="text-[13px] font-bold text-accent-deep underline">Управлять подпиской →</Link>
          </div>
        </div>
      )}

      {/* модалки */}
      {chatOrder && (
        <ChatModal open onClose={() => setChatOrder(null)} kind="order" order={chatOrder} />
      )}
      {reviewFor && productById(reviewFor.productId) && (
        <ReviewModal open onClose={() => setReviewFor(null)} product={productById(reviewFor.productId)!} orderId={reviewFor.order.id} orderNumber={reviewFor.order.number} />
      )}
      {ticketFor && (
        <TicketModal open onClose={() => setTicketFor(null)} orderId={ticketFor.order.id} orderNumber={ticketFor.order.number} kind={ticketFor.kind} />
      )}
    </div>
  );
}

/* добавление товара в отслеживание цен */
function PriceWatchAdder({ limit, current }: { limit: number; current: number }) {
  const addPriceWatch = useSubStore((s) => s.addPriceWatch);
  const [productId, setProductId] = useState(PRODUCTS[0]?.id || "");
  const [target, setTarget] = useState("");
  const atLimit = current >= limit;
  const p = productById(productId);
  return (
    <div className="bg-cream border border-line-soft rounded-xl px-4 py-3.5 flex items-center gap-3 flex-wrap">
      <select className="field !w-auto max-w-[240px]" value={productId} onChange={(e) => setProductId(e.target.value)} aria-label="Товар для отслеживания">
        {PRODUCTS.slice(0, 40).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
      <input className="field !w-28" inputMode="numeric" placeholder="Цель, ₽" value={target} onChange={(e) => setTarget(e.target.value.replace(/\D/g, ""))} />
      <Btn size="sm" disabled={atLimit || !+target}
        onClick={() => { addPriceWatch({ productId, oldPrice: p?.price || 0, targetPrice: +target }); setTarget(""); }}>
        <BellRing size={14} /> Следить
      </Btn>
      {atLimit && <span className="text-[12px] text-error font-semibold">Лимит тарифа достигнут</span>}
    </div>
  );
}
