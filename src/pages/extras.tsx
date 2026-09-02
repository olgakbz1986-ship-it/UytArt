import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  CheckCircle2, FileText, Upload, Wallet, Banknote, Smartphone, CreditCard,
  AlertTriangle, Store, Plus, Trash2, ClipboardList, MapPin, Lock, ArrowRight, Gem, Crown,
  Sparkles, Users, BarChart3, TrendingUp, Boxes, UserPlus, Video, Play, X, Mail, PhoneCall,
  Send, ChevronDown, ShieldCheck, Headphones, Briefcase, MessageSquare,
} from "lucide-react";
import { CATEGORIES, GROUPS, OPERATOR, PRODUCTS, fmt, fmtDate, legalDoc, LEGAL_DOCUMENTS, productById } from "../data/seed";
import { DISTRICTS, cityToDistrict } from "../lib/geo";
import { useAppStore, type Order } from "../lib/store";
import {
  useSellerReg, useSellerAccount, SELLER_TYPES, sellerTypeInfo, SELLER_PLANS, sellerPlanById,
  selectBalance, selectCommissionSum, selectTurnover, type SellerLegalType, type ProductMedia,
} from "../lib/seller";
import { useSubStore, buyerLimits, sellerLimits, currentMonth, fmtLimit, type BuyerPlanId } from "../lib/subscriptions";
import { Badge, Btn, Field, Modal, Switch } from "../components/ui";
import { Markdown } from "../components/markdown";
import { ChatModal } from "../components/chat";

/* ============================================================
   ТАРИФЫ: покупатели (4 уровня) + продавцы (3 матрицы по юрлицу)
   ============================================================ */
const BUYER_PLAN_META: Record<BuyerPlanId, { name: string; price: number; tagline: string }> = {
  free: { name: "Базовый", price: 0, tagline: "Познакомиться с платформой" },
  start: { name: "Старт", price: 500, tagline: "Для тех, кто обустраивает дом" },
  designer: { name: "Дизайнер", price: 1000, tagline: "Ремонт и большие проекты" },
  premium: { name: "Премиум", price: 1500, tagline: "Максимум возможностей и привилегий" },
};

const BUYER_FEATURES: Record<BuyerPlanId, string[]> = {
  free: ["2 AI-генерации дизайна в месяц", "1 активный индивидуальный заказ", "Базовый поиск", "Сохранение до 3 концептов"],
  start: ["15 AI-генераций в месяц", "До 3 индивидуальных заказов", "Фильтры по уровню качества", "Уведомления о снижении цен (10 товаров)", "Скидка 3% на все заказы"],
  designer: ["50 AI-генераций в месяц", "До 10 индивидуальных заказов", "Неограниченные уведомления о ценах", "Приоритет заказов у мастеров", "Скидка 5% + ранний доступ к коллекциям"],
  premium: ["Безлимит AI-генераций и заказов", "Бейдж «Срочный VIP-заказ»", "Персональный куратор-дизайнер", "Бесплатная доставка от мастеров округа", "Скидка 7% + закрытые распродажи"],
};

export function PlansPage() {
  const buyerPlan = useSubStore((s) => s.buyerPlan);
  const setBuyerPlan = useSubStore((s) => s.setBuyerPlan);
  const sellerReg = useSellerReg();
  const acc = useSellerAccount();

  const [audience, setAudience] = useState<"buyer" | "seller">("buyer");
  const [period, setPeriod] = useState<"month" | "year">("month");
  const [sellerType, setSellerType] = useState<SellerLegalType>(sellerReg.legalType || "self_employed");
  const [confirm, setConfirm] = useState<{ kind: "buyer" | "seller"; id: string; name: string; price: number } | null>(null);
  const [payMethod, setPayMethod] = useState("Банковская карта");
  const [paid, setPaid] = useState(false);

  const price = (base: number) => (period === "month" ? base : Math.round(base * 12 * 0.8));
  const periodLabel = (base: number) => (period === "month" ? `${fmt(base)} / мес` : `${fmt(price(base))} / год`);

  const doConfirm = () => {
    if (!confirm) return;
    if (confirm.kind === "buyer") setBuyerPlan(confirm.id as BuyerPlanId);
    else acc.setPlan(sellerType, confirm.id);
    setPaid(true);
    setTimeout(() => { setPaid(false); setConfirm(null); }, 1800);
  };

  return (
    <div className="max-w-[1180px] mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-accent-deep mb-2 flex items-center gap-2"><Gem size={14} /> Подписки</p>
          <h1 className="font-display font-bold text-[clamp(26px,3vw,34px)] text-ink">Тарифы, которые окупаются</h1>
          <p className="text-[14px] text-ink-soft mt-2 max-w-xl">Покупателям — безлимитный AI и привилегии. Продавцам — инструменты, приоритет и сниженная комиссия. Лимиты тарифов уже активны в кабинетах.</p>
        </div>
        {/* переключатель Месяц / Год */}
        <div className="inline-flex bg-line-soft rounded-[12px] p-1.5">
          {([["month", "Месяц"], ["year", "Год · −20%"]] as const).map(([id, label]) => (
            <button key={id} onClick={() => setPeriod(id)}
              className={`h-11 px-5 rounded-[10px] text-[13px] font-bold transition-all duration-200 cursor-pointer ${period === id ? "bg-dark text-cream shadow-card" : "text-ink-soft hover:text-ink"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* переключатель аудиторий */}
      <div className="flex justify-center mb-10">
        <div className="inline-flex bg-line-soft rounded-[14px] p-1.5">
          {([["buyer", "Покупателям"], ["seller", "Продавцам"]] as const).map(([id, label]) => (
            <button key={id} onClick={() => setAudience(id)}
              className={`h-12 px-8 rounded-[10px] text-[14px] font-bold transition-all duration-200 cursor-pointer ${audience === id ? "bg-dark text-cream shadow-card" : "text-ink-soft hover:text-ink"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {audience === "buyer" && (
        <div className="fade-up">
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
            {(Object.keys(BUYER_PLAN_META) as BuyerPlanId[]).map((id, i) => {
              const m = BUYER_PLAN_META[id];
              const lim = buyerLimits(id);
              const active = buyerPlan === id;
              return (
                <div key={id} className={`relative bg-surface rounded-2xl shadow-card p-6 transition-all duration-300 hover:shadow-lift hover:-translate-y-1 ${active ? "border-2 border-dark" : ""}`}>
                  {i === 2 && <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-ink text-[10.5px] font-extrabold px-3 py-1 rounded-full">Популярный</span>}
                  {id === "premium" && <span className="absolute top-4 right-4 text-premium"><Crown size={18} /></span>}
                  <p className="font-display font-bold text-[18px] text-ink">{m.name}</p>
                  <p className="text-[12px] text-ink-mute mt-1">{m.tagline}</p>
                  <p className="font-display font-extrabold text-[30px] text-ink mt-4">{m.price === 0 ? "0 ₽" : periodLabel(m.price)}</p>
                  {period === "year" && m.price > 0 && <p className="text-[11.5px] text-ink-mute">вместо {fmt(m.price * 12)} — экономия {fmt(m.price * 12 - price(m.price))}</p>}
                  <ul className="space-y-2 mt-5">
                    {BUYER_FEATURES[id].map((f) => (
                      <li key={f} className="flex items-start gap-2 text-[12.5px] text-ink-soft"><CheckCircle2 size={14} className="text-success shrink-0 mt-0.5" /> {f}</li>
                    ))}
                  </ul>
                  <Btn className="w-full mt-6" variant={active ? "outline" : "primary"} disabled={active}
                    onClick={() => (m.price === 0 ? setBuyerPlan("free") : setConfirm({ kind: "buyer", id, name: m.name, price: price(m.price) }))}>
                    {active ? "Текущий тариф" : m.price === 0 ? "Бесплатно" : "Подключить"}
                  </Btn>
                  {active && <p className="text-[11px] text-ink-mute text-center mt-2">AI-генераций осталось: {fmtLimit(useSubStore.getState().aiGensLeft())}</p>}
                </div>
              );
            })}
          </div>
          <p className="text-[12.5px] text-ink-mute text-center mt-6">Подписка продлевается автоматически, отмена — в любой момент, доступ сохраняется до конца оплаченного периода.</p>
        </div>
      )}

      {audience === "seller" && (
        <div className="fade-up">
          {/* выбор типа юрлица */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex bg-line-soft rounded-[12px] p-1.5 flex-wrap">
              {SELLER_TYPES.map((t) => (
                <button key={t.type} onClick={() => setSellerType(t.type)}
                  className={`h-11 px-5 rounded-[10px] text-[13px] font-bold transition-all duration-200 cursor-pointer ${sellerType === t.type ? "bg-dark text-cream shadow-card" : "text-ink-soft hover:text-ink"}`}>
                  {t.short}
                </button>
              ))}
            </div>
          </div>
          {sellerReg.legalType && sellerReg.legalType !== sellerType && (
            <p className="flex items-center justify-center gap-2 text-[12.5px] text-ink-soft mb-6"><AlertTriangle size={14} className="text-accent-deep" /> Ваш зарегистрированный статус — {sellerTypeInfo(sellerReg.legalType)?.short}. Тариф активируется для статуса «{sellerTypeInfo(sellerType)?.short}».</p>
          )}
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
            {SELLER_PLANS[sellerType].map((t) => {
              const lim = sellerLimits(sellerType, t.id);
              const active = acc.planIds[sellerType] === t.id;
              return (
                <div key={t.id} className={`relative bg-surface rounded-2xl shadow-card p-6 transition-all duration-300 hover:shadow-lift hover:-translate-y-1 ${active ? "border-2 border-dark" : ""}`}>
                  {lim.badge && <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-premium text-ink text-[10.5px] font-extrabold px-3 py-1 rounded-full whitespace-nowrap">{lim.badge}</span>}
                  <p className="font-display font-bold text-[18px] text-ink">{t.name}</p>
                  <p className="text-[12px] text-ink-mute mt-1">Комиссия {sellerTypeInfo(sellerType)?.commission}%{lim.marketPriority > 0 ? ` · приоритет ${lim.marketPriority}` : ""}</p>
                  <p className="font-display font-extrabold text-[30px] text-ink mt-4">{t.price === 0 ? "0 ₽" : periodLabel(t.price)}</p>
                  <ul className="space-y-2 mt-5">
                    <li className="flex items-start gap-2 text-[12.5px] text-ink-soft"><CheckCircle2 size={14} className="text-success shrink-0 mt-0.5" /> Товаров: {fmtLimit(lim.maxProducts)}</li>
                    <li className="flex items-start gap-2 text-[12.5px] text-ink-soft"><CheckCircle2 size={14} className="text-success shrink-0 mt-0.5" /> AI-карточек: {lim.aiCardGens === 0 ? "нет" : `${fmtLimit(lim.aiCardGens)} / мес`}</li>
                    {t.features.slice(2).map((f) => (
                      <li key={f} className="flex items-start gap-2 text-[12.5px] text-ink-soft"><CheckCircle2 size={14} className="text-success shrink-0 mt-0.5" /> {f}</li>
                    ))}
                  </ul>
                  <Btn className="w-full mt-6" variant={active ? "outline" : "primary"} disabled={active}
                    onClick={() => (t.price === 0 ? acc.setPlan(sellerType, t.id) : setConfirm({ kind: "seller", id: t.id, name: t.name, price: price(t.price) }))}>
                    {active ? "Текущий тариф" : t.price === 0 ? "Бесплатно" : "Подключить"}
                  </Btn>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* модалка подтверждения оплаты */}
      <Modal open={!!confirm} onClose={() => !paid && setConfirm(null)} title={paid ? "" : "Подключение тарифа"}>
        {paid ? (
          <div className="py-8 text-center fade-up">
            <span className="inline-flex w-16 h-16 rounded-full bg-success-soft text-[#4d7327] items-center justify-center mb-4"><CheckCircle2 size={32} /></span>
            <p className="font-display font-bold text-[18px] text-ink">Тариф «{confirm?.name}» активен</p>
            <p className="text-[13px] text-ink-soft mt-1">Лимиты уже применяются в кабинете. Чек — на email.</p>
          </div>
        ) : confirm && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-cream rounded-[10px] px-4 py-3">
              <span className="text-[13.5px] font-semibold text-ink">Тариф «{confirm.name}»</span>
              <span className="font-display font-extrabold text-[18px] text-ink">{fmt(confirm.price)}</span>
            </div>
            <div>
              <p className="text-[13px] font-semibold text-ink mb-2">Способ оплаты · ЮKassa</p>
              <div className="grid grid-cols-3 gap-2">
                {([["Банковская карта", CreditCard], ["СБП", Smartphone], ["Кошелёк", Banknote]] as const).map(([m, Ic]) => (
                  <button key={m} onClick={() => setPayMethod(m)}
                    className={`h-11 rounded-[10px] border text-[12px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${payMethod === m ? "border-dark bg-cream text-ink" : "border-line text-ink-soft hover:border-ink-mute"}`}>
                    <Ic size={14} /> {m}
                  </button>
                ))}
              </div>
            </div>
            <Btn className="w-full" size="lg" onClick={doConfirm}><Wallet size={16} /> Оплатить {fmt(confirm.price)}</Btn>
            <p className="text-[11.5px] text-ink-mute text-center">Автопродление. Отмена в любой момент — доступ до конца периода.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ============================================================
   БИРЖА ИНДИВИДУАЛЬНЫХ ЗАКАЗОВ (с фото/видео-референсами)
   ============================================================ */
interface MarketOrder { id: string; title: string; desc: string; budget: number; region: string; date: string; responses: number; status: string; mine?: boolean; media?: ProductMedia[]; }
const DEMO_ORDERS: MarketOrder[] = [
  { id: "m1", title: "Обеденный стол из дуба на 6 персон", desc: "Массив дуба, покрытие масло-воском, длина 180–200 см. Нужна бережная доставка до двери.", budget: 85000, region: "ЦФО", date: new Date(Date.now() - 1 * 864e5).toISOString(), responses: 4, status: "Опубликован" },
  { id: "m2", title: "Зеркало в раме из макраме, Ø 90 см", desc: "Хлопок молочного оттенка, рама — дуб. Хочу подвес на кожаном ремне.", budget: 24000, region: "СЗФО", date: new Date(Date.now() - 2 * 864e5).toISOString(), responses: 6, status: "Опубликован" },
  { id: "m3", title: "Комод в стиле джапанди", desc: "Ясень + чёрная сталь, 4 ящика, ширина 120 см. Эскиз пришлю в чате.", budget: 64000, region: "ПФО", date: new Date(Date.now() - 3 * 864e5).toISOString(), responses: 2, status: "Опубликован" },
  { id: "m4", title: "Набор керамических ваз, 5 шт", desc: "Шамот, глазурь «шалфей», высоты 15–35 см. Для съёмки интерьера.", budget: 18000, region: "ЮФО", date: new Date(Date.now() - 4 * 864e5).toISOString(), responses: 8, status: "Опубликован" },
  { id: "m5", title: "Стеллаж-лестница для растений", desc: "Сосна, 5 ступеней, высота 180 см. На дачу — важна компактная упаковка.", budget: 21000, region: "СФО", date: new Date(Date.now() - 5 * 864e5).toISOString(), responses: 3, status: "Опубликован" },
];

export function MarketPage() {
  const user = useAppStore((s) => s.user);
  const sellerReg = useSellerReg();
  const isSeller = sellerReg.status === "active";
  const [orders, setOrders] = useState<MarketOrder[]>(DEMO_ORDERS);
  const [region, setRegion] = useState("all");
  const [responded, setResponded] = useState<string[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ title: "", desc: "", budget: "", region: "ЦФО" });
  const [orderMedia, setOrderMedia] = useState<ProductMedia[]>([]);

  const list = orders.filter((o) => region === "all" || o.region === region);

  const onOrderMedia = (files: FileList | null) => {
    if (!files) return;
    const next = [...orderMedia];
    for (const f of Array.from(files)) {
      if (next.length >= 5) break;
      const isVideo = f.type.startsWith("video");
      const isImage = f.type.startsWith("image");
      if (!isVideo && !isImage) continue;
      next.push({ type: isVideo ? "video" : "image", url: URL.createObjectURL(f), name: f.name });
    }
    setOrderMedia(next);
  };

  const publish = () => {
    if (form.title.trim().length < 5 || form.desc.trim().length < 20 || !+form.budget) return;
    const o: MarketOrder = {
      id: "m" + Date.now(), title: form.title.trim(), desc: form.desc.trim(), budget: +form.budget,
      region: form.region, date: new Date().toISOString(), responses: 0, status: "На модерации", mine: true,
      media: orderMedia.length ? orderMedia : undefined,
    };
    setOrders((prev) => [o, ...prev]);
    setForm({ title: "", desc: "", budget: "", region: "ЦФО" });
    setOrderMedia([]);
    setFormOpen(false);
    setTimeout(() => setOrders((prev) => prev.map((x) => (x.id === o.id ? { ...x, status: "Опубликован" } : x))), 1500);
  };

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-accent-deep mb-2 flex items-center gap-2"><ClipboardList size={14} /> Биржа заказов</p>
          <h1 className="font-display font-bold text-[clamp(26px,3vw,34px)] text-ink">Индивидуальные заказы</h1>
          <p className="text-[14px] text-ink-soft mt-2 max-w-xl">
            {isSeller
              ? "Заказы покупателей вашего региона. Откликайтесь — покупатель сравнит предложения и внесёт предоплату через безопасную сделку."
              : "Опишите, что нужно изготовить, приложите фото или видео — мастера вашего округа пришлют коммерческие предложения."}
          </p>
        </div>
        {!isSeller && (
          <Btn onClick={() => setFormOpen(!formOpen)}>
            <Plus size={17} /> {formOpen ? "Свернуть" : "Создать заказ"}
          </Btn>
        )}
      </div>

      {formOpen && !isSeller && (
        <div className="bg-surface rounded-2xl shadow-card p-6 mb-8 fade-up">
          <h2 className="font-display font-bold text-[18px] text-ink mb-4">Новый индивидуальный заказ</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Что нужно изготовить" required className="sm:col-span-2">
              <input className="field" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Например: консоль из ясеня в прихожую" />
            </Field>
            <Field label="Техническое задание" required hint="Материалы, габариты, пожелания — минимум 20 символов" className="sm:col-span-2">
              <textarea className="field" rows={3} value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} placeholder="Ширина 110 см, глубина 35 см, масло-воск, ножки чёрные…" />
            </Field>
            <Field label="Бюджет, ₽" required>
              <input className="field" inputMode="numeric" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value.replace(/\D/g, "") })} placeholder="30000" />
            </Field>
            <Field label="Регион доставки">
              <select className="field" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })}>
                {DISTRICTS.map((d) => <option key={d.id} value={d.id}>{d.name} округ</option>)}
              </select>
            </Field>
          </div>

          {/* загрузка фото/видео референсов */}
          <div className="mt-4">
            <p className="text-[13px] font-semibold text-ink mb-2 flex items-center gap-1.5">
              Фото или видео изделия <span className="text-[11px] font-medium text-ink-mute">референс, эскиз или пример — до 5 файлов</span>
            </p>
            <div className="flex gap-2.5 flex-wrap">
              {orderMedia.map((m) => (
                <div key={m.url} className="relative w-[96px] h-[76px] rounded-[10px] overflow-hidden border border-line-soft group/om fade-up">
                  {m.type === "video"
                    ? <video src={m.url} className="w-full h-full object-cover" muted />
                    : <img src={m.url} alt={m.name} className="w-full h-full object-cover" />}
                  <span className="absolute bottom-1 left-1 flex items-center gap-1 bg-dark/75 text-cream text-[9px] font-bold px-1.5 py-0.5 rounded-md">
                    {m.type === "video" && <Play size={8} fill="currentColor" />}{m.type === "video" ? "видео" : "фото"}
                  </span>
                  <button onClick={() => setOrderMedia(orderMedia.filter((x) => x.url !== m.url))} aria-label="Удалить файл"
                    className="absolute top-1 right-1 w-[18px] h-[18px] rounded-full bg-error text-white items-center justify-center hidden group-hover/om:flex cursor-pointer">
                    <X size={10} />
                  </button>
                </div>
              ))}
              {orderMedia.length < 5 && (
                <label className="w-[96px] h-[76px] rounded-[10px] border-2 border-dashed border-line flex flex-col items-center justify-center cursor-pointer hover:border-accent hover:bg-accent-soft/40 transition-all duration-200">
                  <Upload size={16} className="text-ink-mute" />
                  <span className="text-[9.5px] font-bold text-ink-mute mt-1">Загрузить</span>
                  <span className="text-[8.5px] text-ink-mute">{orderMedia.length}/5</span>
                  <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => { onOrderMedia(e.target.files); e.target.value = ""; }} />
                </label>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 mt-5">
            <Btn onClick={publish} disabled={form.title.trim().length < 5 || form.desc.trim().length < 20 || !+form.budget}>Опубликовать заказ</Btn>
            <p className="text-[12px] text-ink-mute">Модерация — до 1–2 часов: проверяем адекватность и отсутствие запрещённого контента.</p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-6">
        <span className="text-sm text-ink-soft"><strong className="font-display text-ink">{list.length}</strong> {list.length === 1 ? "заказ" : "заказов"}</span>
        <select value={region} onChange={(e) => setRegion(e.target.value)} aria-label="Фильтр по региону"
          className="h-[44px] px-3.5 rounded-[10px] border border-line bg-surface text-sm text-ink font-medium cursor-pointer outline-none focus:border-ai ml-auto">
          <option value="all">Все регионы</option>
          {DISTRICTS.map((d) => <option key={d.id} value={d.id}>{d.name} округ</option>)}
        </select>
      </div>

      <div className="space-y-3.5">
        {list.map((o) => (
          <div key={o.id} className="bg-surface rounded-2xl shadow-card p-5 hover:shadow-lift transition-shadow duration-300">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-[240px]">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="font-display font-bold text-[16px] text-ink">{o.title}</h2>
                  <Badge tone={o.status === "Опубликован" ? "success" : "honey"}>{o.status}</Badge>
                  {o.mine && <Badge tone="ai">ваш заказ</Badge>}
                </div>
                <p className="text-[13.5px] text-ink-soft mt-2 leading-relaxed">{o.desc}</p>
                {o.media && o.media.length > 0 && (
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {o.media.map((m) => (
                      <div key={m.url} className="relative w-[92px] h-[72px] rounded-[10px] overflow-hidden border border-line-soft">
                        {m.type === "video"
                          ? <video src={m.url} className="w-full h-full object-cover" muted />
                          : <img src={m.url} alt={m.name} className="w-full h-full object-cover" />}
                        <span className="absolute bottom-1 left-1 flex items-center gap-1 bg-dark/75 text-cream text-[9px] font-bold px-1.5 py-0.5 rounded-md">
                          {m.type === "video" && <Play size={8} fill="currentColor" />}{m.type === "video" ? "видео" : "фото"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <p className="flex items-center gap-4 flex-wrap text-[12.5px] text-ink-mute mt-2.5">
                  <span className="flex items-center gap-1.5"><MapPin size={13} /> {o.region}</span>
                  <span>{fmtDate(o.date)}</span>
                  {o.media && o.media.length > 0 && (
                    <span className="flex items-center gap-1.5 text-accent-deep font-semibold"><Video size={13} /> {o.media.length} реф.</span>
                  )}
                  <span>откликов: <strong className="text-ink">{o.responses + (responded.includes(o.id) ? 1 : 0)}</strong></span>
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[11px] font-bold uppercase tracking-wide text-ink-mute">Бюджет</p>
                <p className="font-display font-extrabold text-[20px] text-ink">{fmt(o.budget)}</p>
                {isSeller ? (
                  <Btn size="sm" variant={responded.includes(o.id) ? "outline" : "primary"} className="mt-2"
                    onClick={() => setResponded((r) => (r.includes(o.id) ? r : [...r, o.id]))} disabled={responded.includes(o.id)}>
                    {responded.includes(o.id) ? "Отклик отправлен ✓" : "Откликнуться"}
                  </Btn>
                ) : !o.mine && (
                  <Btn size="sm" variant="outline" className="mt-2">Смотреть предложения</Btn>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      {!user && !isSeller && (
        <p className="text-center text-[13px] text-ink-soft mt-8">
          <Link to="/auth" className="font-bold text-accent-deep underline">Войдите</Link>, чтобы получать уведомления об откликах мастеров.
        </p>
      )}
    </div>
  );
}

/* ============================================================
   РЕГИСТРАЦИЯ ПРОДАВЦА: Самозанятый / ИП / ООО, 4 этапа
   ============================================================ */
const STEPS = ["Юр. статус", "Документы", "Модерация", "Оплата"];

export function SellerRegisterPage() {
  const s = useSellerReg();
  if (s.status === "active") {
    return (
      <div className="max-w-[640px] mx-auto px-4 py-24 text-center">
        <span className="inline-flex w-20 h-20 rounded-full bg-success-soft text-[#4d7327] items-center justify-center mb-6"><CheckCircle2 size={40} /></span>
        <h1 className="font-display font-bold text-[30px] text-ink mb-3">Вы уже продавец УютАрт</h1>
        <p className="text-[14.5px] text-ink-soft mb-8">Магазин «{s.shopName}» активен · комиссия {s.commissionRate}%.</p>
        <Link to="/seller/dashboard" className="inline-flex items-center justify-center gap-2 h-[52px] px-7 rounded-[10px] bg-dark text-cream font-semibold hover:bg-dark-deep transition-colors">
          <Store size={18} /> Открыть кабинет
        </Link>
      </div>
    );
  }
  return <SellerRegWizard />;
}

export function SellerRegWizard({ embedded = false }: { embedded?: boolean }) {
  const s = useSellerReg();
  const info = sellerTypeInfo(s.legalType);
  const [errs, setErrs] = useState<Record<string, boolean>>({});
  const [agree, setAgree] = useState(false);
  const [payMethod, setPayMethod] = useState("Банковская карта");

  /* OCR-проверка документов (демо) */
  useEffect(() => {
    if (s.status !== "docs") return;
    const pending = Object.entries(s.docs).filter(([, d]) => !d.ok);
    if (pending.length === 0) return;
    const t = setTimeout(() => {
      const cur = useSellerReg.getState().docs;
      useSellerReg.setState({ docs: Object.fromEntries(Object.entries(cur).map(([k, d]) => [k, { ...d, ok: true }])) });
    }, 1200);
    return () => clearTimeout(t);
  }, [s.docs, s.status]);

  /* демо-модерация */
  useEffect(() => {
    if (s.status !== "moderation") return;
    const t = setTimeout(() => useSellerReg.getState().approveModeration(), 2500);
    return () => clearTimeout(t);
  }, [s.status]);

  const stepIdx = s.status === "inactive" ? 0 : s.status === "docs" ? 1 : s.status === "moderation" || s.status === "rejected" || s.status === "blocked" ? 2 : 3;

  const step1Next = () => {
    const e: Record<string, boolean> = {};
    if (!s.legalType) { setErrs({ type: true }); return; }
    if (s.shopName.trim().length < 2) e.shopName = true;
    if (s.contactName.trim().length < 2) e.contactName = true;
    if (!s.email.includes("@")) e.email = true;
    if (s.masterName.trim().length < 2) e.masterName = true;
    if (s.businessStory.trim().length < 30) e.businessStory = true;
    if (s.categories.length === 0) e.categories = true;
    if (s.legalType === "ip" || s.legalType === "ooo") {
      if (s.inn.replace(/\D/g, "").length < 10) e.inn = true;
      if (s.legalName.trim().length < 2) e.legalName = true;
    }
    setErrs(e);
    if (Object.keys(e).length === 0) s.toDocs();
  };

  const allDocsOk = !!info && info.docs.every((d) => s.docs[d.key]?.ok);

  if (s.status === "active") {
    return (
      <div className="max-w-[560px] mx-auto py-10 text-center">
        <span className="inline-flex w-16 h-16 rounded-full bg-success-soft text-[#4d7327] items-center justify-center mb-5"><CheckCircle2 size={32} /></span>
        <h2 className="font-display font-bold text-[22px] text-ink mb-2">Магазин «{s.shopName}» активен</h2>
        <Link to="/seller/dashboard" className="text-[14px] font-bold text-accent-deep underline">Открыть кабинет продавца →</Link>
      </div>
    );
  }

  return (
    <div className={embedded ? "" : "max-w-[900px] mx-auto px-4 sm:px-6 py-10"}>
      {!embedded && (
        <>
          <div className="flex items-center gap-2 mb-2">
            <Store size={20} className="text-accent-deep" />
            <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-accent-deep">Регистрация продавца</p>
          </div>
          <h1 className="font-display font-bold text-[clamp(26px,3vw,34px)] text-ink mb-7">Станьте частью маркетплейса</h1>
        </>
      )}

      {/* прогресс */}
      <ol className="flex items-center gap-1 sm:gap-2 mb-9">
        {STEPS.map((label, i) => {
          const done = i < stepIdx;
          const now = i === stepIdx;
          return (
            <li key={label} className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
              <span className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold transition-colors ${done ? "bg-success text-white" : now ? "bg-dark text-cream" : "bg-line-soft text-ink-mute"}`}>
                {done ? <CheckCircle2 size={14} /> : i + 1}
              </span>
              <span className={`text-[12px] sm:text-[13px] font-semibold truncate ${now ? "text-ink" : "text-ink-mute"}`}>{label}</span>
              {i < STEPS.length - 1 && <span className="flex-1 h-px bg-line min-w-3" />}
            </li>
          );
        })}
      </ol>

      {/* ===== этап 1: юр. статус + о мастере ===== */}
      {s.status === "inactive" && (
        <div className="space-y-6 fade-up">
          <div>
            <h2 className="font-display font-bold text-[20px] text-ink mb-1.5">Выберите юридический статус</h2>
            <p className="text-[13.5px] text-ink-soft">От статуса зависят регистрационный взнос, комиссия и комплект документов.</p>
            {errs.type && <p className="text-[13px] font-semibold text-error mt-2">Выберите статус, чтобы продолжить</p>}
          </div>
          <div className="grid md:grid-cols-3 gap-3.5">
            {SELLER_TYPES.map((t) => {
              const sel = s.legalType === t.type;
              return (
                <button key={t.type} onClick={() => { s.setLegalType(t.type); setErrs({}); }}
                  className={`text-left rounded-2xl p-5 border-2 transition-all duration-200 cursor-pointer ${sel ? "border-dark bg-dark text-cream shadow-lift" : "border-line bg-surface hover:border-dark/50"}`}>
                  <span className={`block text-[11px] font-bold uppercase tracking-wide mb-2 ${sel ? "text-accent" : "text-ink-mute"}`}>{t.short}</span>
                  <span className={`block font-bold text-[15px] leading-snug mb-3 ${sel ? "text-cream" : "text-ink"}`}>{t.label}</span>
                  <span className={`block text-[13px] ${sel ? "text-cream/80" : "text-ink-soft"}`}>Регистрация <strong className={sel ? "text-cream" : "text-ink"}>{fmt(t.fee)}</strong></span>
                  <span className={`block text-[13px] ${sel ? "text-cream/80" : "text-ink-soft"}`}>Комиссия <strong className={sel ? "text-cream" : "text-ink"}>{t.commission}%</strong></span>
                  <span className={`block text-[12px] mt-2.5 ${sel ? "text-cream/60" : "text-ink-mute"}`}>{t.docs.length} документа для проверки</span>
                </button>
              );
            })}
          </div>

          {info && (
            <div className="bg-cream border border-line-soft rounded-2xl p-5">
              <p className="text-[12px] font-bold uppercase tracking-wide text-ink-mute mb-2.5">Понадобятся документы</p>
              <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
                {info.docs.map((d) => (
                  <li key={d.key} className="flex items-start gap-2 text-[13px] text-ink-soft"><FileText size={14} className="text-accent-deep shrink-0 mt-0.5" /> {d.name}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="bg-surface rounded-2xl shadow-card p-6">
            <h3 className="font-display font-bold text-[17px] text-ink mb-4">Данные магазина</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Название магазина" required error={errs.shopName ? "Минимум 2 символа" : undefined}>
                <input className={`field ${errs.shopName ? "field-error" : ""}`} value={s.shopName} onChange={(e) => s.setInfo({ shopName: e.target.value })} placeholder="Глиняный дом" />
              </Field>
              <Field label="Контактное лицо" required error={errs.contactName ? "Укажите ФИО" : undefined}>
                <input className={`field ${errs.contactName ? "field-error" : ""}`} value={s.contactName} onChange={(e) => s.setInfo({ contactName: e.target.value })} placeholder="Мария Ковалёва" />
              </Field>
              <Field label="Email" required error={errs.email ? "Некорректный email" : undefined}>
                <input className={`field ${errs.email ? "field-error" : ""}`} type="email" value={s.email} onChange={(e) => s.setInfo({ email: e.target.value })} placeholder="hello@studio.ru" />
              </Field>
              <Field label="Город производства">
                <input className="field" value={s.city} onChange={(e) => s.setInfo({ city: e.target.value })} placeholder="Псков" />
              </Field>
              {(s.legalType === "ip" || s.legalType === "ooo") && (
                <>
                  <Field label="ИНН" required error={errs.inn ? "10–12 цифр" : undefined}>
                    <input className={`field ${errs.inn ? "field-error" : ""}`} value={s.inn} onChange={(e) => s.setInfo({ inn: e.target.value.replace(/\D/g, "") })} placeholder="602709876543" />
                  </Field>
                  <Field label={s.legalType === "ooo" ? "ОГРН" : "ОГРНИП"}>
                    <input className="field" value={s.ogrn} onChange={(e) => s.setInfo({ ogrn: e.target.value.replace(/\D/g, "") })} placeholder="321602700012345" />
                  </Field>
                  <Field label="Юридическое наименование" required error={errs.legalName ? "Укажите наименование" : undefined} className="sm:col-span-2">
                    <input className={`field ${errs.legalName ? "field-error" : ""}`} value={s.legalName} onChange={(e) => s.setInfo({ legalName: e.target.value })} placeholder={s.legalType === "ooo" ? "ООО «Название»" : "ИП Фамилия Имя Отчество"} />
                  </Field>
                </>
              )}
            </div>
          </div>

          {/* ===== блок «О мастере» ===== */}
          <div className="bg-surface rounded-2xl shadow-card p-6">
            <h3 className="font-display font-bold text-[17px] text-ink mb-1">О мастере</h3>
            <p className="text-[13px] text-ink-soft mb-5">Расскажите о становлении бизнеса — взлёты, падения, заслуги. Покупатели выбирают людей с историей, а сервис распределит вас по категориям.</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Имя мастера / бренд" required error={errs.masterName ? "Минимум 2 символа" : undefined}>
                <input className={`field ${errs.masterName ? "field-error" : ""}`} value={s.masterName} onChange={(e) => s.setInfo({ masterName: e.target.value })} placeholder="Мария из «Глиняного дома»" />
              </Field>
              <Field label="Опыт, лет">
                <input className="field" value={s.yearsExperience} onChange={(e) => s.setInfo({ yearsExperience: e.target.value.replace(/\D/g, "") })} placeholder="12" />
              </Field>
              <Field label="История бизнеса" required error={errs.businessStory ? "Минимум 30 символов" : undefined} hint="Как начинали, что было самым трудным, чем гордитесь" className="sm:col-span-2">
                <textarea className={`field ${errs.businessStory ? "field-error" : ""}`} rows={4} value={s.businessStory} onChange={(e) => s.setInfo({ businessStory: e.target.value })}
                  placeholder="Начинали с гаража и одной печи в 2016-м. Первая партия кружек треснула при обжиге — пришлось учиться заново. Сейчас у нас две печи и 11 000 довольных покупателей…" />
              </Field>
              <Field label="Заслуги и достижения" hint="Выставки, премии, публикации, рекорды" className="sm:col-span-2">
                <textarea className="field" rows={2} value={s.achievements} onChange={(e) => s.setInfo({ achievements: e.target.value })}
                  placeholder="Финалист «Ремесло года 2023», публикации в «Красивых домах» и «Интерьере»…" />
              </Field>
            </div>
            <div className="mt-4">
              <p className="text-[13px] font-semibold text-ink mb-1.5">Что вы делаете? <span className="text-error">*</span> <span className="text-[11px] font-medium text-ink-mute">сервис распределит вас по этим категориям — так покупателям проще найти именно вас</span></p>
              {errs.categories && <p className="text-[12px] font-semibold text-error mb-2">Выберите хотя бы одну категорию</p>}
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => {
                  const on = s.categories.includes(c.slug);
                  return (
                    <button key={c.slug} onClick={() => s.toggleCategory(c.slug)}
                      className={`px-3.5 min-h-[40px] rounded-full text-[12.5px] font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${on ? "bg-dark text-cream" : "bg-line-soft text-ink-soft hover:bg-line"}`}>
                      {c.emoji} {c.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5" />
              <span className="text-[13px] text-ink-soft leading-relaxed">
                Принимаю условия <Link to="/legal/seller_agreement" className="font-bold text-accent-deep underline">агентского договора-оферты</Link>, гарантирую права на товары
                и понимаю механизм сплитования платежей <span className="text-error">*</span>
              </span>
            </label>
            <Btn size="lg" disabled={!agree || !s.legalType} onClick={step1Next}>
              Продолжить: документы <ArrowRight size={17} />
            </Btn>
          </div>
        </div>
      )}

      {/* ===== этап 2: документы ===== */}
      {s.status === "docs" && info && (
        <div className="space-y-4 fade-up">
          <div className="flex items-end justify-between flex-wrap gap-3">
            <div>
              <h2 className="font-display font-bold text-[20px] text-ink mb-1.5">Загрузите документы</h2>
              <p className="text-[13.5px] text-ink-soft">{info.label} · JPG, PNG или PDF до 5 МБ. Каждый файл проходит OCR-проверку читаемости.</p>
            </div>
            <button onClick={() => s.resetFlow()} className="text-[13px] font-semibold text-ink-mute hover:text-ink cursor-pointer transition-colors">← Изменить статус</button>
          </div>
          <div className="grid md:grid-cols-2 gap-3.5">
            {info.docs.map((d) => {
              const doc = s.docs[d.key];
              return (
                <div key={d.key} className={`rounded-2xl border p-5 transition-colors ${doc?.ok ? "border-success/50 bg-success-soft/40" : "border-line bg-surface"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-[14px] text-ink">{d.name}</p>
                      <p className="text-[12px] text-ink-mute mt-0.5">{d.note}</p>
                    </div>
                    {doc ? (
                      doc.ok ? <Badge tone="success"><CheckCircle2 size={11} /> Читаемо</Badge> : <Badge tone="honey">OCR-проверка…</Badge>
                    ) : null}
                  </div>
                  <label className={`mt-4 flex items-center gap-3 border border-dashed rounded-[10px] px-4 cursor-pointer transition-colors min-h-[52px] ${doc ? "border-success/40" : "border-line hover:border-dark"}`}>
                    <Upload size={17} className={doc ? "text-success" : "text-ink-mute"} />
                    <span className="text-[13px] font-semibold text-ink-soft truncate flex-1">
                      {doc ? `${doc.fileName} · ${(doc.size / 1024).toFixed(0)} КБ` : "Выбрать файл"}
                    </span>
                    {doc && (
                      <button onClick={(e) => { e.preventDefault(); s.removeDoc(d.key); }} aria-label="Удалить файл" className="text-ink-mute hover:text-error cursor-pointer">
                        <Trash2 size={15} />
                      </button>
                    )}
                    <input type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) s.addDoc(d.key, f.name, f.size); }} />
                  </label>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-3 flex-wrap pt-2">
            <Btn size="lg" disabled={!allDocsOk} onClick={() => s.submitForModeration()}>
              Отправить на модерацию <ArrowRight size={17} />
            </Btn>
            {!allDocsOk && <p className="text-[12.5px] text-ink-mute">Загрузите все документы — без полного комплекта модерация не начнётся.</p>}
          </div>
          <p className="text-[12px] text-ink-mute flex items-center gap-1.5"><Lock size={13} /> Файлы шифруются (AES-256) и хранятся в защищённом бакете. Доступ — только у модерации.</p>
        </div>
      )}

      {/* ===== этап 3: модерация ===== */}
      {s.status === "moderation" && (
        <div className="bg-surface rounded-2xl shadow-card p-10 text-center fade-up">
          <span className="inline-flex w-16 h-16 rounded-full bg-ai-soft text-ai items-center justify-center mb-5"><FileText size={30} /></span>
          <h2 className="font-display font-bold text-[22px] text-ink mb-2">Документы на модерации</h2>
          <p className="text-[14px] text-ink-soft max-w-md mx-auto leading-relaxed">
            Проверяем подлинность и соответствие данных. Обычно это занимает 1–2 рабочих дня, в демо — несколько секунд.
          </p>
          <div className="max-w-xs mx-auto mt-6 h-2 rounded-full bg-line-soft overflow-hidden">
            <div className="h-full bg-ai rounded-full" style={{ animation: "modProgress 2.5s ease-out forwards" }} />
          </div>
        </div>
      )}

      {s.status === "rejected" && (
        <div className="space-y-5 fade-up">
          <div className="bg-surface border-2 border-error/40 rounded-2xl p-7">
            <div className="flex items-center gap-3 mb-2">
              <span className="w-11 h-11 rounded-xl bg-error-soft text-error flex items-center justify-center"><AlertTriangle size={22} /></span>
              <h2 className="font-display font-bold text-[22px] text-ink">Модерация отклонена</h2>
            </div>
            <p className="text-[14px] text-ink-soft"><strong className="text-ink">Причина:</strong> {s.rejectionReason || "Документы нечитаемы или данные не совпадают."}</p>
            <p className="text-[13px] text-ink-mute mt-2">Попытка {s.rejectionCount} из 3. После третьей неудачной попытки аккаунт блокируется с обращением в поддержку.</p>
          </div>
          <Btn size="lg" onClick={() => s.retryDocuments()}>Загрузить документы заново</Btn>
        </div>
      )}

      {s.status === "blocked" && (
        <div className="bg-surface rounded-2xl shadow-card p-10 text-center fade-up">
          <span className="inline-flex w-16 h-16 rounded-full bg-error-soft text-error items-center justify-center mb-5"><Lock size={28} /></span>
          <h2 className="font-display font-bold text-[22px] text-ink mb-2">Регистрация заблокирована</h2>
          <p className="text-[14px] text-ink-soft max-w-md mx-auto leading-relaxed mb-6">
            Документы отклонены трижды. Напишите в поддержку — разберёмся вручную: <Link to="/contacts" className="font-bold text-accent-deep underline">страница контактов</Link>.
          </p>
          <Btn variant="outline" onClick={() => s.resetFlow()}>Начать заново</Btn>
        </div>
      )}

      {/* ===== этап 4: оплата ===== */}
      {s.status === "payment" && info && (
        <div className="max-w-[560px] mx-auto fade-up">
          <div className="bg-surface rounded-2xl shadow-card overflow-hidden">
            <div className="bg-dark text-cream px-6 py-5">
              <p className="text-[12px] font-bold uppercase tracking-wide text-cream/60 flex items-center gap-2"><CheckCircle2 size={14} className="text-success" /> Документы подтверждены</p>
              <p className="font-display font-extrabold text-[30px] mt-1.5">{fmt(info.fee)}</p>
              <p className="text-[13px] text-cream/70">Регистрационный взнос · {info.short} · комиссия с продаж {info.commission}%</p>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <p className="text-[13px] font-semibold text-ink mb-2">Способ оплаты · ЮKassa</p>
                <div className="grid grid-cols-3 gap-2">
                  {([["Банковская карта", CreditCard], ["СБП", Smartphone], ["Кошелёк", Banknote]] as const).map(([m, Ic]) => (
                    <button key={m} onClick={() => setPayMethod(m)}
                      className={`h-11 rounded-[10px] border text-[12px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${payMethod === m ? "border-dark bg-cream text-ink" : "border-line text-ink-soft hover:border-ink-mute"}`}>
                      <Ic size={14} /> {m.split(" ")[0]}
                    </button>
                  ))}
                </div>
              </div>
              <Btn size="lg" className="w-full" onClick={() => s.payFee(payMethod)}>
                <Wallet size={17} /> Оплатить {fmt(info.fee)}
              </Btn>
              <p className="text-[11.5px] text-ink-mute text-center">После оплаты магазин активируется, чек придёт на {s.email || "email"}.</p>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes modProgress { from { width: 4% } to { width: 100% } }`}</style>
    </div>
  );
}

/* ============================================================
   КАБИНЕТ ПРОДАВЦА: товары, заказы, финансы, аналитика, команда
   ============================================================ */
const DEMO_SELLER_ORDERS: Order[] = [
  { id: "so1", number: "UYA-3127", date: new Date(Date.now() - 2 * 864e5).toISOString(), status: "paid", items: [{ productId: PRODUCTS[0]?.id || "p1", qty: 2, price: PRODUCTS[0]?.price || 1900 }], total: 2 * (PRODUCTS[0]?.price || 1900) + 350, delivery: 350, deliveryMethod: "СДЭК до пункта выдачи", address: "Москва, ул. Пятницкая, 18", hasCustom: false, payMethod: "Банковская карта (ЮKassa)" },
  { id: "so2", number: "UYA-3084", date: new Date(Date.now() - 5 * 864e5).toISOString(), status: "shipped", items: [{ productId: PRODUCTS[3]?.id || "p4", qty: 1, price: PRODUCTS[3]?.price || 4500 }], total: (PRODUCTS[3]?.price || 4500) + 500, delivery: 500, deliveryMethod: "Курьер СДЭК", address: "Санкт-Петербург, Невский пр., 88", hasCustom: false, payMethod: "СБП" },
  { id: "so3", number: "UYA-2971", date: new Date(Date.now() - 9 * 864e5).toISOString(), status: "received", items: [{ productId: PRODUCTS[6]?.id || "p7", qty: 1, price: PRODUCTS[6]?.price || 7200 }], total: (PRODUCTS[6]?.price || 7200), delivery: 0, deliveryMethod: "Почта России", address: "Казань, ул. Баумана, 44", hasCustom: false, payMethod: "Банковская карта (ЮKassa)" },
];

export function SellerDashboardPage() {
  const s = useSellerReg();
  const acc = useSellerAccount();
  const nav = useNavigate();

  const [tab, setTab] = useState<"products" | "orders" | "finance" | "analytics" | "team" | "settings">("products");
  const [prod, setProd] = useState({ name: "", category: CATEGORIES[0].name, price: "" });
  const [prodMedia, setProdMedia] = useState<ProductMedia[]>([]);
  const [withdraw, setWithdraw] = useState("");
  const [aiGenBusy, setAiGenBusy] = useState(false);
  const [member, setMember] = useState({ name: "", role: "Менеджер" as "Менеджер" | "Мастер" | "Кладовщик" });
  const [selForBulk, setSelForBulk] = useState<string[]>([]);
  const [bulkPct, setBulkPct] = useState("");
  const [chatOrder, setChatOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (s.status !== "active") nav("/seller/register");
  }, [s.status, nav]);

  const lt: SellerLegalType = s.legalType || "self_employed";
  const planId = acc.planIds[lt] || "free";
  const plan = sellerPlanById(lt, planId);
  const lim = sellerLimits(lt, planId);

  const balance = acc.transactions.reduce((sum, t) => sum + t.sellerPayout, 0);
  const commission = acc.transactions.filter((t) => t.kind === "sale").reduce((sum, t) => sum + t.commissionAmount, 0);
  const turnover = acc.transactions.filter((t) => t.kind === "sale").reduce((sum, t) => sum + t.productPrice, 0);

  const month = currentMonth();
  const aiUsed = acc.aiCardGens[month] || 0;
  const activeProducts = acc.products.filter((p) => !p.archived).length;
  const UNLIM = !Number.isFinite(lim.maxProducts);
  const UNLIM_AI = !Number.isFinite(lim.aiCardGens);

  const aiNearLimit = !UNLIM_AI && lim.aiCardGens > 0 && aiUsed >= Math.ceil(lim.aiCardGens * 0.8);
  const productsNearLimit = !UNLIM && activeProducts >= Math.ceil(lim.maxProducts * 0.8);
  const nextBill = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });

  if (s.status !== "active") return null;

  const onProdMedia = (files: FileList | null) => {
    if (!files) return;
    const next = [...prodMedia];
    for (const f of Array.from(files)) {
      if (next.length >= 10) break;
      const isVideo = f.type.startsWith("video");
      const isImage = f.type.startsWith("image");
      if (!isVideo && !isImage) continue;
      if (isVideo && next.some((x) => x.type === "video")) continue;
      next.push({ type: isVideo ? "video" : "image", url: URL.createObjectURL(f), name: f.name });
    }
    setProdMedia(next);
  };

  const TABS: { id: typeof tab; label: string; icon: typeof Boxes; show: boolean }[] = [
    { id: "products", label: "Мои товары", icon: Boxes, show: true },
    { id: "orders", label: "Заказы", icon: ClipboardList, show: true },
    { id: "finance", label: "Финансы", icon: Wallet, show: true },
    { id: "analytics", label: "Аналитика", icon: BarChart3, show: lim.analytics !== "basic" },
    { id: "team", label: "Команда", icon: Users, show: lim.team > 0 },
    { id: "settings", label: "Настройки", icon: Store, show: true },
  ];

  return (
    <div className="max-w-[1180px] mx-auto px-4 sm:px-6 py-10">
      {/* шапка кабинета: тариф, лимиты, дата списания */}
      <div className="bg-dark text-cream rounded-2xl p-6 mb-6 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-accent/15 blur-3xl" />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <span className="w-14 h-14 rounded-[16px] bg-white/10 flex items-center justify-center text-[28px]">🏪</span>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="font-display font-bold text-[clamp(20px,2.6vw,26px)]">{s.shopName}</h1>
                <Badge tone="premium">{plan?.name || "Бесплатный"}</Badge>
                {lim.badge && <Badge tone="honey">{lim.badge}</Badge>}
              </div>
              <p className="text-[12.5px] text-cream/60 mt-1">
                {sellerTypeInfo(lt)?.label} · комиссия {s.commissionRate}% · списание {plan && plan.price > 0 ? nextBill : "—" }
              </p>
            </div>
          </div>
          <div className="flex gap-6 flex-wrap">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-cream/50">Товары</p>
              <p className="font-display font-extrabold text-[20px]">{activeProducts} <span className="text-[13px] text-cream/50">/ {fmtLimit(lim.maxProducts)}</span></p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-cream/50">AI-карточки</p>
              <p className="font-display font-extrabold text-[20px]">{UNLIM_AI ? "∞" : `${aiUsed} / ${lim.aiCardGens}`}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-cream/50">Баланс</p>
              <p className="font-display font-extrabold text-[20px] text-accent">{fmt(balance)}</p>
            </div>
          </div>
        </div>
      </div>

      {(aiNearLimit || productsNearLimit) && (
        <div className="flex items-center gap-3 bg-accent-soft border border-accent/40 rounded-xl px-4 py-3 mb-4 fade-up">
          <AlertTriangle size={18} className="text-accent-deep shrink-0" />
          <p className="text-[12.5px] text-ink-soft flex-1">
            {aiNearLimit && <>Осталось <strong className="text-ink">{Math.max(0, lim.aiCardGens - aiUsed)}</strong> AI-генераций в этом месяце. </>}
            {productsNearLimit && <>Вы используете <strong className="text-ink">{activeProducts} из {lim.maxProducts}</strong> товаров. </>}
            <Link to="/plans" className="font-bold text-accent-deep underline">Улучшите тариф для безлимита</Link>.
          </p>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-8">
        {TABS.filter((t) => t.show).map(({ id, label, icon: Ic }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 min-h-[44px] rounded-full text-[13.5px] font-bold whitespace-nowrap transition-all duration-200 cursor-pointer ${tab === id ? "bg-dark text-cream" : "bg-surface border border-line text-ink-soft hover:border-dark hover:text-ink"}`}>
            <Ic size={15} /> {label}
          </button>
        ))}
      </div>

      {/* ---------- ТОВАРЫ ---------- */}
      {tab === "products" && (
        <div className="space-y-6 fade-up">
          {!UNLIM && activeProducts >= lim.maxProducts && (
            <div className="flex items-center gap-3 bg-error-soft border border-error/30 rounded-xl px-4 py-3">
              <AlertTriangle size={18} className="text-error shrink-0" />
              <p className="text-[12.5px] text-ink-soft flex-1">
                Достигнут лимит <strong className="text-ink">{lim.maxProducts} активных товаров</strong> на тарифе «{plan?.name}». Созданные товары сохранены.
                <Link to="/plans" className="font-bold text-accent-deep underline ml-1">Улучшить тариф</Link>.
              </p>
            </div>
          )}

          <div className="grid lg:grid-cols-[380px_1fr] gap-6 items-start">
            <div className="bg-surface rounded-2xl shadow-card p-6">
              <h2 className="font-display font-bold text-[18px] text-ink mb-4">Новый товар</h2>
              <div className="space-y-3.5">
                <Field label="Название" required><input className="field" value={prod.name} onChange={(e) => setProd({ ...prod, name: e.target.value })} placeholder="Ваза «Утро»" /></Field>
                <Field label="Категория">
                  <select className="field" value={prod.category} onChange={(e) => setProd({ ...prod, category: e.target.value })}>
                    {CATEGORIES.map((c) => <option key={c.slug} value={c.name}>{c.name}</option>)}
                  </select>
                </Field>
                <Field label="Цена, ₽" required><input className="field" inputMode="numeric" value={prod.price} onChange={(e) => setProd({ ...prod, price: e.target.value.replace(/\D/g, "") })} placeholder="4900" /></Field>

                {/* медиа-карточки: до 10, одна может быть видео */}
                <div>
                  <p className="text-[12.5px] font-semibold text-ink mb-2 flex items-center gap-1.5">
                    Фото и видео <span className="text-[11px] font-medium text-ink-mute">до 10 карточек · 1 может быть видео</span>
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {prodMedia.map((m, i) => (
                      <div key={m.url} className="relative w-[72px] h-[60px] rounded-[10px] overflow-hidden border border-line-soft group/pm fade-up">
                        {m.type === "video"
                          ? <video src={m.url} className="w-full h-full object-cover" muted />
                          : <img src={m.url} alt={m.name} className="w-full h-full object-cover" />}
                        <span className="absolute bottom-0.5 left-0.5 flex items-center gap-0.5 bg-dark/75 text-cream text-[8.5px] font-bold px-1 py-px rounded">
                          {m.type === "video" && <Play size={8} fill="currentColor" />}{m.type === "video" ? "видео" : i + 1}
                        </span>
                        <button onClick={() => setProdMedia(prodMedia.filter((_, x) => x !== i))} aria-label="Удалить карточку"
                          className="absolute top-0.5 right-0.5 w-[18px] h-[18px] rounded-full bg-error text-white items-center justify-center hidden group-hover/pm:flex cursor-pointer">
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                    {prodMedia.length < 10 && (
                      <label className="w-[72px] h-[60px] rounded-[10px] border-2 border-dashed border-line flex flex-col items-center justify-center cursor-pointer hover:border-accent hover:bg-accent-soft/40 transition-all duration-200">
                        <Upload size={14} className="text-ink-mute" />
                        <span className="text-[9px] font-bold text-ink-mute mt-0.5">{prodMedia.length}/10</span>
                        <input type="file" accept="image/*,video/*" multiple className="hidden"
                          onChange={(e) => { onProdMedia(e.target.files); e.target.value = ""; }} />
                      </label>
                    )}
                  </div>
                  {prodMedia.some((m) => m.type === "video") && (
                    <p className="text-[10.5px] text-ink-mute mt-1.5 flex items-center gap-1"><Video size={11} className="text-accent-deep" /> Видео-карточка добавлена — покажется первой в галерее товара.</p>
                  )}
                </div>

                <Btn className="w-full" disabled={prod.name.trim().length < 3 || !+prod.price || (!UNLIM && activeProducts >= lim.maxProducts)}
                  onClick={() => {
                    acc.addProduct({ name: prod.name.trim(), category: prod.category, price: +prod.price, media: prodMedia.length ? prodMedia : undefined });
                    setProd({ name: "", category: CATEGORIES[0].name, price: "" });
                    setProdMedia([]);
                  }}>
                  <Plus size={16} /> Опубликовать
                </Btn>
                {lim.aiCardGens > 0 && (
                  <Btn variant="outline" className="w-full" disabled={aiGenBusy || (!UNLIM_AI && aiUsed >= lim.aiCardGens)}
                    onClick={() => {
                      if (!acc.consumeAiCardGen(month)) return;
                      setAiGenBusy(true);
                      setTimeout(() => {
                        acc.addProduct({ name: `${prod.category} «AI-образец ${aiUsed + 1}»`, category: prod.category, price: 3900 + (aiUsed % 5) * 500, aiGenerated: true });
                        setAiGenBusy(false);
                      }, 900);
                    }}>
                    <Sparkles size={16} className="text-ai" /> {aiGenBusy ? "Генерируем…" : "Создать товар с AI"}
                  </Btn>
                )}
                <p className="text-[11.5px] text-ink-mute">
                  {lim.aiCardGens === 0
                    ? "AI-генерация карточек доступна на платных тарифах."
                    : `AI-генераций в этом месяце: ${aiUsed} / ${UNLIM_AI ? "∞" : lim.aiCardGens}.`} Товар попадёт на модерацию.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {acc.products.length === 0 && (
                <div className="bg-surface rounded-2xl shadow-card px-8 py-14 text-center">
                  <p className="text-[40px] mb-3">📦</p>
                  <p className="font-display font-bold text-[18px] text-ink mb-1.5">Витрина пуста</p>
                  <p className="text-[13.5px] text-ink-soft">Добавьте первый товар — AI-описания доступны на тарифах с генерацией карточек.</p>
                </div>
              )}

              {lim.massEdit && acc.products.length > 0 && (
                <div className="bg-cream border border-line-soft rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
                  <input className="field !w-20 !py-2 text-center" inputMode="numeric" value={bulkPct} onChange={(e) => setBulkPct(e.target.value.replace(/[^\d-]/g, ""))} aria-label="Процент изменения" />
                  <span className="text-[12px] text-ink-soft">% к цене</span>
                  <Btn size="sm" variant="outline" disabled={selForBulk.length === 0 || !bulkPct}
                    onClick={() => { acc.bulkSetPrice(selForBulk, +bulkPct); setSelForBulk([]); }}>
                    Применить к выбранным ({selForBulk.length})
                  </Btn>
                </div>
              )}

              {acc.products.map((p) => (
                <div key={p.id} className={`bg-surface rounded-2xl shadow-card px-5 py-4 flex items-center gap-4 flex-wrap ${p.archived ? "opacity-55" : ""}`}>
                  {lim.massEdit && (
                    <input type="checkbox" checked={selForBulk.includes(p.id)} aria-label={`Выбрать ${p.name}`}
                      onChange={() => setSelForBulk((sel) => (sel.includes(p.id) ? sel.filter((x) => x !== p.id) : [...sel, p.id]))} />
                  )}
                  {p.media && p.media.length > 0 && (
                    <div className="flex gap-1.5 shrink-0">
                      {p.media.slice(0, 3).map((m) => (
                        <span key={m.url} className="relative w-11 h-11 rounded-[8px] overflow-hidden border border-line-soft">
                          {m.type === "video"
                            ? <video src={m.url} className="w-full h-full object-cover" muted />
                            : <img src={m.url} alt="" className="w-full h-full object-cover" />}
                          {m.type === "video" && <span className="absolute inset-0 flex items-center justify-center bg-dark/30"><Play size={11} className="text-cream" fill="currentColor" /></span>}
                        </span>
                      ))}
                      {p.media.length > 3 && (
                        <span className="w-11 h-11 rounded-[8px] bg-cream border border-line-soft flex items-center justify-center text-[11px] font-bold text-ink-soft">+{p.media.length - 3}</span>
                      )}
                    </div>
                  )}
                  <div className="flex-1 min-w-[200px]">
                    <p className="font-bold text-[14.5px] text-ink flex items-center gap-2">
                      {p.name}
                      {p.aiGenerated && <Badge tone="ai"><Sparkles size={10} /> AI</Badge>}
                      {p.archived && <Badge tone="neutral">Архив</Badge>}
                    </p>
                    <p className="text-[12px] text-ink-mute mt-0.5">
                      {p.category} · {fmt(p.price)} · {fmtDate(p.createdAt)}
                      {p.media && p.media.length > 0 && (
                        <span className="text-accent-deep font-semibold"> · {p.media.length} медиа{p.media.some((m) => m.type === "video") ? " + видео" : ""}</span>
                      )}
                    </p>
                  </div>
                  <Badge tone="honey">На модерации</Badge>
                  <button onClick={() => acc.toggleArchive(p.id)} aria-label={p.archived ? "Вернуть из архива" : "В архив"}
                    className="text-[12px] font-semibold text-ink-mute hover:text-ink cursor-pointer transition-colors">
                    {p.archived ? "Вернуть" : "Архив"}
                  </button>
                  <button onClick={() => acc.removeProduct(p.id)} aria-label="Удалить товар" className="w-10 h-10 rounded-[10px] flex items-center justify-center text-ink-mute hover:text-error hover:bg-error-soft cursor-pointer transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---------- ЗАКАЗЫ ---------- */}
      {tab === "orders" && (
        <div className="space-y-3 fade-up">
          {DEMO_SELLER_ORDERS.map((o) => (
            <div key={o.id} className="bg-surface rounded-2xl shadow-card px-5 py-4 flex items-center gap-4 flex-wrap">
              <div className="flex-1 min-w-[220px]">
                <p className="font-bold text-[14.5px] text-ink">Заказ {o.number}</p>
                <p className="text-[12px] text-ink-mute mt-0.5">{fmtDate(o.date)} · {o.address} · {o.deliveryMethod}</p>
              </div>
              <span className="font-display font-bold text-[17px] text-ink">{fmt(o.total)}</span>
              <Badge tone={o.status === "paid" ? "honey" : o.status === "shipped" ? "ai" : "success"}>
                {o.status === "paid" ? "Оплачен — отправьте" : o.status === "shipped" ? "В пути" : "Получен"}
              </Badge>
              <Btn size="sm" variant="outline" onClick={() => setChatOrder(o)}>
                <MessageSquare size={14} /> Чат по заказу
              </Btn>
            </div>
          ))}
          <p className="text-[12px] text-ink-mute">Чат заказа открывается после оплаты и архивируется после получения товара.</p>
        </div>
      )}

      {/* ---------- ФИНАНСЫ ---------- */}
      {tab === "finance" && (
        <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start fade-up">
          <div className="bg-surface rounded-2xl shadow-card overflow-hidden">
            <p className="font-display font-bold text-[16px] text-ink px-6 pt-5 pb-3">История транзакций</p>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] min-w-[640px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-ink-mute border-y border-line-soft bg-cream/60">
                    <th className="px-6 py-3 font-bold">Дата</th>
                    <th className="px-3 py-3 font-bold">Операция</th>
                    <th className="px-3 py-3 font-bold text-right">Сумма заказа</th>
                    <th className="px-3 py-3 font-bold text-right">Комиссия</th>
                    <th className="px-6 py-3 font-bold text-right">Выплата</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {acc.transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-cream/50 transition-colors">
                      <td className="px-6 py-3.5 text-ink-mute whitespace-nowrap">{fmtDate(t.date)}</td>
                      <td className="px-3 py-3.5 font-semibold text-ink">{t.kind === "sale" ? `Заказ ${t.orderId}` : `Вывод ${t.orderId}`}</td>
                      <td className="px-3 py-3.5 text-right text-ink">{t.productPrice ? fmt(t.productPrice) : "—"}</td>
                      <td className="px-3 py-3.5 text-right text-error font-semibold">{t.commissionAmount ? `−${fmt(t.commissionAmount)}` : "—"}</td>
                      <td className={`px-6 py-3.5 text-right font-bold ${t.sellerPayout < 0 ? "text-error" : "text-[#4d7327]"}`}>{t.sellerPayout < 0 ? `−${fmt(-t.sellerPayout)}` : `+${fmt(t.sellerPayout)}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="space-y-4">
            <div className="bg-dark text-cream rounded-2xl p-6">
              <p className="text-[12px] font-bold uppercase tracking-wide text-cream/50">Доступно к выводу</p>
              <p className="font-display font-extrabold text-[34px] mt-2 text-accent">{fmt(balance)}</p>
              <div className="grid grid-cols-2 gap-3 mt-4 text-[12.5px]">
                <p className="text-cream/70">Оборот<br /><span className="font-display font-bold text-[15px] text-cream">{fmt(turnover)}</span></p>
                <p className="text-cream/70">Комиссия<br /><span className="font-display font-bold text-[15px] text-cream">{fmt(commission)}</span></p>
              </div>
            </div>
            <div className="bg-surface rounded-2xl shadow-card p-6">
              <p className="font-display font-bold text-[15px] text-ink mb-3">Вывести средства</p>
              <div className="flex gap-2">
                <input className="field" inputMode="numeric" placeholder={String(Math.max(0, balance))} value={withdraw} onChange={(e) => setWithdraw(e.target.value.replace(/\D/g, ""))} />
                <Btn disabled={!+withdraw || +withdraw > balance} onClick={() => { acc.requestWithdrawal(+withdraw); setWithdraw(""); }}>Вывести</Btn>
              </div>
              <p className="text-[11.5px] text-ink-mute mt-2.5">На реквизиты из регистрации. Выплата 1–3 рабочих дня.</p>
            </div>
          </div>
        </div>
      )}

      {/* ---------- АНАЛИТИКА ---------- */}
      {tab === "analytics" && (
        <div className="grid lg:grid-cols-2 gap-5 items-start fade-up">
          <div className="bg-surface rounded-2xl shadow-card p-6">
            <h3 className="font-display font-bold text-[17px] text-ink mb-5 flex items-center gap-2"><BarChart3 size={18} className="text-accent-deep" /> Продажи по неделям</h3>
            <div className="flex items-end gap-3 h-[180px]">
              {[38, 52, 44, 71, 63, 88, 76, 94].map((v, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                  <span className="text-[10.5px] font-bold text-ink-mute opacity-0 group-hover:opacity-100 transition-opacity">{Math.round(v * 90).toLocaleString("ru-RU")} ₽</span>
                  <div className="w-full rounded-t-[8px] bg-dark group-hover:bg-accent transition-colors duration-200" style={{ height: `${v * 1.5}px` }} />
                  <span className="text-[10px] text-ink-mute">Н{i + 1}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-surface rounded-2xl shadow-card p-6">
            <h3 className="font-display font-bold text-[17px] text-ink mb-5 flex items-center gap-2"><TrendingUp size={18} className="text-accent-deep" /> Воронка продаж</h3>
            {[
              { l: "Просмотры карточек", v: 12400, w: 100 },
              { l: "Добавления в корзину", v: 1860, w: 62 },
              { l: "Заказы", v: 412, w: 34 },
              { l: "Повторные покупки", v: 96, w: 18 },
            ].map((f) => (
              <div key={f.l} className="mb-4">
                <div className="flex justify-between text-[12.5px] mb-1.5">
                  <span className="font-semibold text-ink">{f.l}</span>
                  <span className="text-ink-mute">{f.v.toLocaleString("ru-RU")}</span>
                </div>
                <div className="h-3 rounded-full bg-line-soft overflow-hidden">
                  <div className="h-full rounded-full bg-ai transition-all duration-500" style={{ width: `${f.w}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="bg-surface rounded-2xl shadow-card p-6">
            <h3 className="font-display font-bold text-[17px] text-ink mb-4 flex items-center gap-2"><TrendingUp size={18} className="text-accent-deep" /> Рекомендации по ценам</h3>
            <div className="space-y-3">
              {[
                { t: "«Кружка Авторская» — цена ниже медианы категории на 18%", a: "Можно поднять до 1 450 ₽ без потери спроса" },
                { t: "«Ваза Тёплая» — высокий спрос, низкий остаток", a: "Пополните витрину, упускаете ~12 заказов/мес" },
                { t: "«Пиала» — конверсия 3.1% (выше средней)", a: "Добавьте её в подборки и на главную" },
              ].map((r) => (
                <div key={r.t} className="border-l-[3px] border-accent pl-3.5">
                  <p className="text-[13px] font-semibold text-ink">{r.t}</p>
                  <p className="text-[12px] text-ink-mute mt-0.5">{r.a}</p>
                </div>
              ))}
            </div>
            <p className="text-[11.5px] text-ink-mute mt-4">Основано на данных платформы по вашей категории.</p>
          </div>
          <div className="bg-surface rounded-2xl shadow-card p-6">
            <h3 className="font-display font-bold text-[17px] text-ink mb-4">Прогноз и эксперименты</h3>
            {lim.forecasts ? (
              <div className="space-y-3">
                <p className="text-[13.5px] text-ink-soft leading-relaxed">Прогноз на следующий месяц: <strong className="text-ink">38 000–46 000 ₽</strong> при текущей активности (точность 87%).</p>
                {lim.abTest && <p className="text-[13.5px] text-ink-soft leading-relaxed">A/B-тест главной карточки: вариант с видео-обложкой даёт <strong className="text-[#4d7327]">+23% к конверсии</strong>. Рекомендуется включить.</p>}
                {lim.segmentation && <p className="text-[13.5px] text-ink-soft leading-relaxed">Сегмент «повторные из СЗФО» растёт на 12% — предложите им комплект со скидкой.</p>}
              </div>
            ) : (
              <p className="text-[13.5px] text-ink-soft">Прогнозы продаж и A/B-тестирование доступны на старших тарифах. <Link to="/plans" className="font-bold text-accent-deep underline">Улучшить тариф</Link></p>
            )}
          </div>
        </div>
      )}

      {/* ---------- КОМАНДА ---------- */}
      {tab === "team" && (
        <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start fade-up">
          <div className="space-y-3">
            {acc.team.length === 0 && (
              <div className="bg-surface rounded-2xl shadow-card px-8 py-14 text-center">
                <p className="text-[40px] mb-3">👥</p>
                <p className="font-display font-bold text-[18px] text-ink mb-1.5">В команде пока никого</p>
                <p className="text-[13.5px] text-ink-soft">Добавьте сотрудников с ролями: менеджер, мастер, кладовщик.</p>
              </div>
            )}
            {acc.team.map((m) => (
              <div key={m.id} className="bg-surface rounded-2xl shadow-card px-5 py-4 flex items-center gap-4">
                <span className="w-11 h-11 rounded-full bg-ai-soft text-ai flex items-center justify-center font-display font-bold text-[16px]">{m.name[0]?.toUpperCase()}</span>
                <div className="flex-1 min-w-[150px]">
                  <p className="font-bold text-[14.5px] text-ink">{m.name}</p>
                  <Badge tone="ai">{m.role}</Badge>
                </div>
                <button onClick={() => acc.removeMember(m.id)} aria-label={`Удалить ${m.name}`} className="w-10 h-10 rounded-[10px] flex items-center justify-center text-ink-mute hover:text-error hover:bg-error-soft cursor-pointer transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          <div className="bg-surface rounded-2xl shadow-card p-6">
            <h2 className="font-display font-bold text-[18px] text-ink mb-4 flex items-center gap-2"><UserPlus size={18} className="text-accent-deep" /> Добавить сотрудника</h2>
            <p className="text-[12.5px] text-ink-soft mb-4">Мест на тарифе: {acc.team.length} / {fmtLimit(lim.team)}</p>
            <div className="space-y-3.5">
              <Field label="Имя"><input className="field" value={member.name} onChange={(e) => setMember({ ...member, name: e.target.value })} placeholder="Иван" /></Field>
              <Field label="Роль">
                <select className="field" value={member.role} onChange={(e) => setMember({ ...member, role: e.target.value as typeof member.role })}>
                  <option>Менеджер</option><option>Мастер</option><option>Кладовщик</option>
                </select>
              </Field>
              <Btn className="w-full" disabled={!member.name.trim() || (Number.isFinite(lim.team) && acc.team.length >= lim.team)}
                onClick={() => { acc.addMember(member); setMember({ name: "", role: "Менеджер" }); }}>
                Добавить
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* ---------- НАСТРОЙКИ ---------- */}
      {tab === "settings" && (
        <div className="grid lg:grid-cols-2 gap-5 items-start fade-up">
          <div className="bg-surface rounded-2xl shadow-card p-6">
            <h2 className="font-display font-bold text-[17px] text-ink mb-4">Юридические данные</h2>
            <div className="space-y-2 text-[13.5px]">
              {[
                ["Статус", sellerTypeInfo(lt)?.label || "—"],
                ["Магазин", s.shopName],
                ["Мастер", s.masterName || "—"],
                ["Город", s.city || "—"],
                ["Округ производства", DISTRICTS.find((d) => d.id === s.production_region)?.name || "—"],
                ["ИНН", s.inn || "—"],
                ["Комиссия (фикс.)", `${s.commissionRate}%`],
              ].map(([k, v]) => (
                <p key={k} className="flex justify-between gap-4 border-b border-line-soft pb-2.5 last:border-0">
                  <span className="text-ink-mute">{k}</span><span className="font-semibold text-ink text-right">{v}</span>
                </p>
              ))}
            </div>
            <p className="text-[12px] text-ink-mute flex items-center gap-1.5 mt-4"><Lock size={13} /> Комиссия применяется автоматически и не может быть изменена вручную.</p>
          </div>
          <div className="bg-surface rounded-2xl shadow-card p-6">
            <h2 className="font-display font-bold text-[17px] text-ink mb-4">Тариф · {sellerTypeInfo(lt)?.short}</h2>
            <div className="space-y-2.5">
              {SELLER_PLANS[lt].map((t) => (
                <label key={t.id} className={`flex items-center gap-3.5 border rounded-xl px-4 py-3.5 cursor-pointer transition-colors ${acc.planIds[lt] === t.id ? "border-dark bg-cream" : "border-line hover:border-ink-mute"}`}>
                  <input type="radio" name="seller-plan" checked={acc.planIds[lt] === t.id} onChange={() => acc.setPlan(lt, t.id)} />
                  <span className="flex-1">
                    <span className="block text-[13.5px] font-bold text-ink">{t.name}</span>
                    <span className="block text-[11.5px] text-ink-mute">{t.price === 0 ? "бесплатно" : `${fmt(t.price)} / мес`}</span>
                  </span>
                  {acc.planIds[lt] === t.id && <Badge tone="success">активен</Badge>}
                </label>
              ))}
            </div>
            <div className="mt-5 pt-5 border-t border-line-soft">
              <p className="text-[12px] font-bold uppercase tracking-wide text-ink-mute mb-2.5">Возможности тарифа</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {([
                  ["AI-карточки", lim.aiCardGens > 0], ["Массовые цены", lim.massEdit], ["Комплекты", lim.bundles],
                  ["Прогнозы", lim.forecasts], ["Команда", lim.team > 0], ["Импорт", lim.importFile],
                  ["Бренд-витрина", lim.brandStore], ["A/B тесты", lim.abTest], ["B2B", lim.b2b], ["White-label", lim.whiteLabel],
                ] as [string, boolean][]).map(([f, on]) => (
                  <p key={f} className={`flex items-center gap-1.5 text-[12px] ${on ? "text-ink font-semibold" : "text-ink-mute line-through"}`}>
                    {on ? <CheckCircle2 size={13} className="text-success" /> : <X size={13} />} {f}
                  </p>
                ))}
              </div>
            </div>
            {lim.manager && (
              <div className="mt-5 pt-5 border-t border-line-soft flex items-center gap-3">
                <span className="w-11 h-11 rounded-full bg-dark text-accent flex items-center justify-center"><Headphones size={18} /></span>
                <div>
                  <p className="text-[13.5px] font-bold text-ink">Персональный менеджер</p>
                  <p className="text-[12px] text-ink-mute">Анна · manager@uyutart.ru · поддержка 24/7</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <ChatModal open={!!chatOrder} onClose={() => setChatOrder(null)} kind="order" order={chatOrder || undefined} />
    </div>
  );
}

/* ============================================================
   О НАС
   ============================================================ */
export function AboutPage() {
  return (
    <div>
      <section className="bg-dark text-cream relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.2]" style={{ backgroundImage: "radial-gradient(circle at 20% 30%, #D98E32 0, transparent 42%), radial-gradient(circle at 85% 75%, #2D5F4C 0, transparent 48%)" }} />
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-20 relative">
          <p className="font-lux text-[clamp(40px,5.5vw,68px)] leading-[1.05]">Не маркетплейс.<br />Новая категория.</p>
          <p className="text-cream/70 text-[16px] leading-relaxed mt-7 max-w-2xl">
            УютАрт — операционная система для эволюции жилого пространства. Мы соединяем искусственный интеллект
            с высоким искусством ручного труда: AI находит и проектирует, мастера — создают.
          </p>
        </div>
      </section>

      <section className="max-w-[1100px] mx-auto px-4 sm:px-6 py-16">
        <div className="grid md:grid-cols-2 gap-10 items-start">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-accent-deep mb-3">Миссия</p>
            <h2 className="font-display font-bold text-[clamp(24px,3vw,32px)] text-ink leading-tight">Уникальный интерьер — каждому, достойный доход — каждому мастеру</h2>
            <p className="text-[14.5px] text-ink-soft leading-relaxed mt-5">
              Технологии не заменяют человеческое творчество — они усиливают его. Подбор, покупка и создание декора
              должны быть интуитивными, безопасными и вдохновляющими.
            </p>
          </div>
          <div className="space-y-5">
            {[
              ["01", "AI-архитектор", "Не чат-бот, а персональный эксперт: помнит ваше помещение, стиль и бюджет, генерирует концепции и подбирает реальные товары."],
              ["02", "Кураторский отбор", "Каждый продавец проходит верификацию, каждый товар — премодерацию. За лотом стоит мастер, а не перекупщик."],
              ["03", "Экосистема для профессионалов", "Кабинеты дизайнеров и мастеров: мудборды, сметы, live-трансляции из мастерских, честная экономика."],
              ["04", "Безопасная сделка", "Деньги на транзитном счёте до отправки. Строгое соблюдение 152-ФЗ и 54-ФЗ, чеки — автоматически."],
            ].map(([n, t, d]) => (
              <div key={n} className="flex gap-5 group">
                <span className="font-display font-extrabold text-[26px] text-line group-hover:text-accent transition-colors duration-300 shrink-0 w-12">{n}</span>
                <div>
                  <p className="font-display font-bold text-[16px] text-ink">{t}</p>
                  <p className="text-[13.5px] text-ink-soft leading-relaxed mt-1.5">{d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-dark text-cream">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-14 grid grid-cols-2 md:grid-cols-4 gap-8">
          {[["1 240+", "мастерских"], ["18 500", "авторских товаров"], ["74", "города России"], ["8", "групп каталога"]].map(([n, l]) => (
            <div key={l} className="text-center md:text-left">
              <p className="font-display font-extrabold text-[clamp(26px,3vw,36px)] text-accent">{n}</p>
              <p className="text-[13px] text-cream/60 mt-1">{l}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-[1100px] mx-auto px-4 sm:px-6 py-16">
        <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-accent-deep mb-3">Ценности</p>
        <div className="grid sm:grid-cols-2 gap-x-12 gap-y-6">
          {[
            ["Уникальность вместо массовости", "Мы ценим историю, стоящую за каждой вещью."],
            ["Технологии с человеческим лицом", "AI помогает, а не усложняет. Тон — тёплый, заботливый, экспертный."],
            ["Прозрачность и честность", "Никаких скрытых условий, поддельных отзывов и недобросовестных продавцов."],
            ["Устойчивое развитие", "Поддерживаем локальное производство и культуру осознанного потребления."],
          ].map(([t, d]) => (
            <div key={t} className="border-l-[3px] border-accent pl-5">
              <p className="font-display font-bold text-[16px] text-ink">{t}</p>
              <p className="text-[13.5px] text-ink-soft leading-relaxed mt-1.5">{d}</p>
            </div>
          ))}
        </div>
        <div className="mt-12 bg-cream border border-line-soft rounded-2xl p-8 flex flex-col sm:flex-row items-center justify-between gap-5">
          <p className="font-quote text-[24px] text-ink text-center sm:text-left">Присоединяйтесь к эволюции интерьера</p>
          <div className="flex gap-3 shrink-0">
            <Link to="/catalog" className="inline-flex items-center justify-center h-12 px-6 rounded-[10px] bg-dark text-cream font-semibold hover:bg-dark-deep transition-colors">В каталог</Link>
            <Link to="/seller/register" className="inline-flex items-center justify-center h-12 px-6 rounded-[10px] border border-line bg-surface font-semibold hover:bg-cream transition-colors">Стать мастером</Link>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ============================================================
   ПРАВОВЫЕ ДОКУМЕНТЫ
   ============================================================ */
export function LegalPage() {
  const { type = "" } = useParams();
  const doc = legalDoc(type);

  if (!doc) {
    return (
      <div className="max-w-[700px] mx-auto px-4 py-24 text-center">
        <p className="text-[56px] mb-3">⚖️</p>
        <h1 className="font-display font-bold text-[26px] text-ink mb-3">Документ не найден</h1>
        <Link to="/contacts" className="text-[14px] font-bold text-accent-deep underline">Задать вопрос юристу →</Link>
      </div>
    );
  }

  return (
    <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-12">
      <div className="flex items-start justify-between gap-4 flex-wrap mt-5 mb-3">
        <h1 className="font-display font-bold text-[clamp(24px,3vw,32px)] text-ink leading-tight max-w-xl">{doc.title}</h1>
        <Badge tone="dark">Версия {doc.version}</Badge>
      </div>
      <p className="text-[14px] text-ink-soft bg-cream border-l-[3px] border-accent rounded-r-[10px] px-5 py-3.5 my-6 leading-relaxed">{doc.summary}</p>

      <div className="grid lg:grid-cols-[1fr_240px] gap-8 items-start">
        <div className="bg-surface rounded-2xl shadow-card px-6 sm:px-9 py-8">
          <Markdown text={doc.content} />
        </div>
        <aside className="bg-surface rounded-2xl shadow-card p-5 lg:sticky lg:top-24">
          <p className="text-[11px] font-bold uppercase tracking-widest text-ink-mute mb-3">Все документы</p>
          {LEGAL_DOCUMENTS.map((d) => (
            <Link key={d.doc_type} to={`/legal/${d.doc_type}`}
              className={`block text-[12.5px] py-2 border-b border-line-soft last:border-0 transition-colors ${d.doc_type === doc.doc_type ? "font-bold text-accent-deep" : "text-ink-soft hover:text-ink"}`}>
              {d.title}
            </Link>
          ))}
        </aside>
      </div>

      <div className="mt-8 bg-surface rounded-2xl shadow-card p-6">
        <p className="font-display font-bold text-[15px] text-ink mb-3">Оператор платформы</p>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-[13px] text-ink-soft">
          <p><span className="text-ink-mute">Наименование:</span> <span className="font-semibold text-ink">{OPERATOR.name}</span></p>
          <p><span className="text-ink-mute">ИНН / КПП:</span> <span className="font-semibold text-ink">{OPERATOR.inn} / {OPERATOR.kpp}</span></p>
          <p><span className="text-ink-mute">ОГРН:</span> <span className="font-semibold text-ink">{OPERATOR.ogrn}</span></p>
          <p><span className="text-ink-mute">Адрес:</span> <span className="font-semibold text-ink">{OPERATOR.address}</span></p>
          <p><span className="text-ink-mute">Юридические вопросы:</span> <span className="font-semibold text-ink">{OPERATOR.legalEmail}</span></p>
          <p><span className="text-ink-mute">Статус:</span> <span className="font-semibold text-ink">{OPERATOR.status}</span></p>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   КОНТАКТЫ
   ============================================================ */
export function ContactsPage() {
  const [form, setForm] = useState({ name: "", email: "", topic: "Вопрос по заказу", message: "" });
  const [sent, setSent] = useState(false);
  const [faqOpen, setFaqOpen] = useState<number | null>(0);

  const submit = () => {
    if (form.name.trim().length < 2 || !form.email.includes("@") || form.message.trim().length < 10) return;
    setSent(true);
  };

  const FAQ = [
    { q: "Платформа отвечает за качество товаров?", a: "УютАрт — информационный агрегатор (ст. 12 ЗоЗПП): договор купли-продажи заключается напрямую с продавцом. Платформа обеспечивает безопасную сделку, арбитраж и проверку продавцов, но не отвечает за качество товара — претензии адресуются продавцу." },
    { q: "Как быстро продавец получит деньги?", a: "После ввода трек-номера или подтверждения получения покупателем. Если продавец не отправил товар за 5 дней — деньги автоматически вернутся покупателю." },
    { q: "Можно ли вернуть товар, сделанный на заказ?", a: "Нет. Товары, изготовленные по индивидуальным параметрам (custom-made), возврату не подлежат согласно абз. 4 п. 4 ст. 26.1 ЗоЗПП. Готовые товары возвращаются в течение 7 дней." },
    { q: "Как пожаловаться на продавца?", a: "В карточке магазина нажмите «Пожаловаться на продавца» — жалоба уйдёт в арбитраж платформы. Также можно написать на support@uyutart.ru." },
    { q: "Как стать продавцом?", a: "Пройдите регистрацию: выберите статус (самозанятый, ИП или ООО), загрузите документы, дождитесь модерации и оплатите регистрационный взнос. Всё — на странице «Стать продавцом»." },
  ];

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-12">
      <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-accent-deep mb-2 flex items-center gap-2"><Headphones size={14} /> Контакты</p>
      <h1 className="font-display font-bold text-[clamp(26px,3vw,34px)] text-ink mb-3">Мы на связи</h1>
      <p className="text-[14px] text-ink-soft max-w-xl mb-10">Выберите свой сценарий — ответим в течение рабочего дня. Юридические вопросы рассматриваются приоритетно.</p>

      <div className="grid md:grid-cols-3 gap-4 mb-12">
        {[
          { ic: <Headphones size={20} />, t: "Покупателям", d: "Заказы, доставка, возвраты, бонусы", e: OPERATOR.supportEmail, extra: "Чат поддержки · ежедневно 9:00–21:00" },
          { ic: <Store size={20} />, t: "Продавцам", d: "Регистрация, витрина, выплаты, тарифы", e: "partners@uyutart.ru", extra: "Кабинет продавца · будни 10:00–19:00" },
          { ic: <Briefcase size={20} />, t: "Партнёрам и юристам", d: "B2B, интеграции, правовые вопросы", e: OPERATOR.legalEmail, extra: `${OPERATOR.short} · ИНН ${OPERATOR.inn}` },
        ].map((c, i) => (
          <div key={c.t} className="bg-surface rounded-2xl shadow-card p-6 hover:shadow-lift hover:-translate-y-1 transition-all duration-300 fade-up" style={{ animationDelay: `${i * 70}ms` }}>
            <span className="w-12 h-12 rounded-[14px] bg-dark text-accent flex items-center justify-center mb-4">{c.ic}</span>
            <p className="font-display font-bold text-[17px] text-ink">{c.t}</p>
            <p className="text-[13px] text-ink-soft mt-1.5">{c.d}</p>
            <a href={`mailto:${c.e}`} className="block text-[13.5px] font-bold text-accent-deep hover:text-accent mt-3 transition-colors">{c.e}</a>
            <p className="text-[11.5px] text-ink-mute mt-1.5">{c.extra}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-8 items-start">
        <div className="bg-surface rounded-2xl shadow-card p-7">
          <h2 className="font-display font-bold text-[20px] text-ink mb-5">Написать нам</h2>
          {sent ? (
            <div className="py-10 text-center fade-up">
              <span className="inline-flex w-16 h-16 rounded-full bg-success-soft text-[#4d7327] items-center justify-center mb-4"><CheckCircle2 size={32} /></span>
              <p className="font-display font-bold text-[18px] text-ink">Сообщение отправлено</p>
              <p className="text-[13px] text-ink-soft mt-1">Ответ придёт на {form.email} в течение рабочего дня.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Имя" required><input className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Анна" /></Field>
                <Field label="Email" required><input className="field" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="anna@mail.ru" /></Field>
              </div>
              <Field label="Тема">
                <select className="field" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })}>
                  {["Вопрос по заказу", "Доставка", "Возврат товара", "Жалоба на продавца", "Стать продавцом", "Тарифы и подписки", "Юридический вопрос", "Другое"].map((t) => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Сообщение" required hint="Минимум 10 символов">
                <textarea className="field" rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Опишите вопрос…" />
              </Field>
              <Btn size="lg" className="w-full" onClick={submit} disabled={form.name.trim().length < 2 || !form.email.includes("@") || form.message.trim().length < 10}>
                <Send size={16} /> Отправить
              </Btn>
            </div>
          )}
        </div>

        <div className="bg-surface rounded-2xl shadow-card p-7">
          <h2 className="font-display font-bold text-[20px] text-ink mb-5">Частые вопросы</h2>
          <div className="space-y-2.5">
            {FAQ.map((f, i) => (
              <div key={f.q} className="border border-line-soft rounded-[14px] overflow-hidden">
                <button onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left cursor-pointer hover:bg-cream/60 transition-colors">
                  <span className="text-[13.5px] font-bold text-ink">{f.q}</span>
                  <ChevronDown size={16} className={`text-ink-mute shrink-0 transition-transform duration-200 ${faqOpen === i ? "rotate-180" : ""}`} />
                </button>
                {faqOpen === i && <p className="px-4 pb-4 text-[13px] text-ink-soft leading-relaxed fade-up">{f.a}</p>}
              </div>
            ))}
          </div>
          <div className="mt-5 pt-5 border-t border-line-soft">
            <p className="font-display font-bold text-[15px] text-ink mb-2">Офис оператора</p>
            <p className="text-[13px] text-ink-soft leading-relaxed flex items-start gap-2"><MapPin size={15} className="text-accent-deep shrink-0 mt-0.5" /> {OPERATOR.address}</p>
            <p className="text-[12px] text-ink-mute mt-3">{OPERATOR.status}. Претензии по товарам направляются продавцу — реквизиты указаны в каждой карточке товара.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   404
   ============================================================ */
export function NotFoundPage() {
  return (
    <div className="max-w-[700px] mx-auto px-4 py-24 text-center">
      <p className="font-display font-extrabold text-[80px] text-line leading-none">404</p>
      <h1 className="font-display font-bold text-[26px] text-ink mt-4 mb-2">Такой страницы нет</h1>
      <p className="text-[14px] text-ink-soft mb-8">Возможно, она переехала — как и многие мастера на УютАрт.</p>
      <div className="flex gap-3 justify-center flex-wrap">
        <Link to="/" className="inline-flex items-center justify-center h-11 px-6 rounded-[10px] bg-dark text-cream text-sm font-semibold hover:bg-dark-deep transition-colors">На главную</Link>
        <Link to="/catalog" className="inline-flex items-center justify-center h-11 px-6 rounded-[10px] border border-line bg-surface text-sm font-semibold hover:bg-cream transition-colors">В каталог</Link>
      </div>
    </div>
  );
}
