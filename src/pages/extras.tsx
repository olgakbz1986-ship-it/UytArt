import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  CheckCircle2, FileText, Upload, Wallet, Sparkles, Users, BarChart3, TrendingUp, Boxes, UserPlus,
  ShieldCheck, Mail, HelpCircle, Send, AlertTriangle, Camera, Video, Play, X, CreditCard, Smartphone, Gem,
} from "lucide-react";
import { CATEGORIES, OPERATOR, fmt, fmtDate, legalDoc, LEGAL_DOCUMENTS } from "../data/seed";
import { DISTRICTS } from "../lib/geo";
import { useAppStore } from "../lib/store";
import {
  useSellerReg, useSellerAccount, SELLER_TYPES, sellerTypeInfo, SELLER_PLANS, sellerPlanById,
  SellerLegalType, ProductMedia, selectCommissionSum, selectTurnover,
} from "../lib/seller";
import {
  useSubStore, BUYER_PLANS, buyerLimits, sellerLimits, currentMonth, fmtLimit, BuyerPlanId,
} from "../lib/subscriptions";
import { Badge, Btn, Field, Modal, ProgressBar } from "../components/ui";
import { Markdown } from "../components/markdown";

/* ============================================================
   Биржа индивидуальных заказов (пункт меню «Заказы»)
   ============================================================ */
export interface MarketOrder {
  id: string; title: string; type: string; desc: string; material: string;
  budget: number; term: string; region: string; refName?: string; refType?: "image" | "video";
  date: string; status: "moderation" | "published"; responses: number; myOwn?: boolean;
}
interface MarketState {
  orders: MarketOrder[];
  responded: string[];
  addOrder: (o: Omit<MarketOrder, "id" | "date" | "status" | "responses" | "myOwn">) => void;
  respond: (id: string) => void;
}
export const useMarketStore = create<MarketState>()(
  persist(
    (set) => ({
      orders: [
        { id: "mo1", title: "Дубовый стол на кухню", type: "Мебель", desc: "Нужен стол 160×90 из массива дуба, скандинавский стиль.", material: "Дуб", budget: 65000, term: "1–2 месяца", region: "ЦФО", date: new Date(Date.now() - 3 * 864e5).toISOString(), status: "published", responses: 4 },
        { id: "mo2", title: "Зеркало в раме из ротанга", type: "Зеркала", desc: "Круглое зеркало Ø 80 см в раме из ротанга.", material: "Ротанг", budget: 18000, term: "2–3 недели", region: "СЗФО", date: new Date(Date.now() - 1 * 864e5).toISOString(), status: "published", responses: 2 },
      ],
      responded: [],
      addOrder: (o) =>
        set((s) => ({ orders: [{ ...o, id: "mo-" + Date.now(), date: new Date().toISOString(), status: "moderation", responses: 0, myOwn: true }, ...s.orders] })),
      respond: (id) =>
        set((s) => ({
          responded: [...s.responded, id],
          orders: s.orders.map((o) => (o.id === id ? { ...o, responses: o.responses + 1 } : o)),
        })),
    }),
    { name: "uyutart-market-v2" }
  )
);

export function MarketPage() {
  const user = useAppStore((s) => s.user);
  const buyerPlan = useSubStore((s) => s.buyerPlan);
  const lim = buyerLimits(buyerPlan);
  const orders = useMarketStore((s) => s.orders);
  const responded = useMarketStore((s) => s.responded);
  const addOrder = useMarketStore((s) => s.addOrder);
  const respond = useMarketStore((s) => s.respond);
  const sellerActive = useSellerReg((s) => s.status === "active");

  const [wizardOpen, setWizardOpen] = useState(false);
  const [fType, setFType] = useState("Мебель");
  const [fBudget, setFBudget] = useState("30000");
  const [fTerm, setFTerm] = useState("1–2 месяца");
  const [fRegion, setFRegion] = useState("ЦФО");
  const [fMaterial, setFMaterial] = useState("Дуб");
  const [fTitle, setFTitle] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [ref, setRef] = useState<{ name: string; type: "image" | "video" } | null>(null);
  const [fErr, setFErr] = useState("");
  const [filterType, setFilterType] = useState("all");

  const myActive = orders.filter((o) => o.myOwn && o.status === "published").length;
  const overLimit = myActive >= lim.marketOrders;

  const TYPES = ["Мебель", "Зеркала", "Декор", "Освещение", "Текстиль"];
  const visible = orders.filter((o) => o.status === "published" || o.myOwn).filter((o) => filterType === "all" || o.type === filterType);

  const publish = () => {
    if (!user) { setFErr("Войдите, чтобы разместить заказ."); return; }
    if (overLimit) { setFErr(`Лимит тарифа: ${fmtLimit(lim.marketOrders)} активных заказов. Улучшите тариф.`); return; }
    if (fTitle.trim().length < 3 || fDesc.trim().length < 10) { setFErr("Заполните название и описание (минимум 10 символов)."); return; }
    addOrder({ title: fTitle.trim(), type: fType, desc: fDesc.trim(), material: fMaterial, budget: +fBudget || 0, term: fTerm, region: fRegion, refName: ref?.name, refType: ref?.type });
    setFTitle(""); setFDesc(""); setRef(null); setFErr("");
    setWizardOpen(false);
  };

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-7">
        <div>
          <h1 className="font-display font-bold text-[clamp(26px,3vw,34px)] text-ink mb-2">Биржа индивидуальных заказов</h1>
          <p className="text-[14px] text-ink-soft max-w-xl">Опишите, что нужно изготовить, — мастера пришлют предложения. Сделка защищена: предоплата резервируется на платформе.</p>
        </div>
        <Btn size="lg" onClick={() => setWizardOpen(true)}><Sparkles size={18} /> Создать заказ</Btn>
      </div>

      {overLimit && (
        <div className="flex items-center gap-2.5 bg-premium-soft border border-premium/40 rounded-[10px] px-4 py-3 mb-6">
          <AlertTriangle size={16} className="text-[#a07c50] shrink-0" />
          <p className="text-[13px] text-ink flex-1">Вы достигли лимита активных заказов ({fmtLimit(lim.marketOrders)}). <Link to="/plans" className="font-bold text-accent-deep underline">Улучшить тариф</Link></p>
        </div>
      )}

      {/* фильтр по типу (для мастеров) */}
      {sellerActive && (
        <div className="flex gap-2 flex-wrap mb-6">
          {["all", ...TYPES].map((t) => (
            <button key={t} onClick={() => setFilterType(t)}
              className={`px-4 min-h-[40px] rounded-full text-[12.5px] font-bold transition-all cursor-pointer ${filterType === t ? "bg-dark text-cream" : "bg-surface border border-line text-ink-soft hover:border-dark hover:text-ink"}`}>
              {t === "all" ? "Все типы" : t}
            </button>
          ))}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        {visible.map((o, i) => (
          <div key={o.id} className="bg-surface rounded-2xl shadow-card p-6 fade-up" style={{ animationDelay: `${(i % 6) * 60}ms` }}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <h2 className="font-bold text-[16px] text-ink">{o.title}</h2>
              {o.status === "moderation"
                ? <Badge tone="honey">На модерации</Badge>
                : o.myOwn ? <Badge tone="ai">Ваш заказ</Badge> : <Badge tone="neutral">{o.type}</Badge>}
            </div>
            <p className="text-[13.5px] text-ink-soft leading-relaxed mt-2">{o.desc}</p>
            {o.refName && (
              <p className="flex items-center gap-1.5 text-[11.5px] text-ai font-semibold mt-2.5">
                {o.refType === "video" ? <Video size={12} /> : <Camera size={12} />} Референс: {o.refName}
              </p>
            )}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12.5px] mt-4">
              <p><span className="text-ink-mute">Бюджет:</span> <span className="font-semibold text-ink">до {fmt(o.budget)}</span></p>
              <p><span className="text-ink-mute">Срок:</span> <span className="font-semibold text-ink">{o.term}</span></p>
              <p><span className="text-ink-mute">Материал:</span> <span className="font-semibold text-ink">{o.material}</span></p>
              <p><span className="text-ink-mute">Регион:</span> <span className="font-semibold text-ink">{o.region}</span></p>
            </div>
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-line-soft">
              <span className="text-[12px] text-ink-mute">{fmtDate(o.date)} · откликов: <strong className="text-ink">{o.responses + (responded.includes(o.id) ? 1 : 0)}</strong></span>
              {sellerActive && !o.myOwn && o.status === "published" && (
                responded.includes(o.id)
                  ? <Badge tone="success"><CheckCircle2 size={11} /> Вы откликнулись</Badge>
                  : <Btn size="sm" onClick={() => respond(o.id)}>Отправить предложение</Btn>
              )}
            </div>
          </div>
        ))}
      </div>

      {visible.length === 0 && (
        <div className="bg-surface rounded-2xl shadow-card px-8 py-16 text-center">
          <p className="text-[44px] mb-3">🛠️</p>
          <p className="font-display font-bold text-[20px] text-ink mb-2">Заказов пока нет</p>
          <p className="text-[14px] text-ink-soft">Создайте первый индивидуальный заказ.</p>
        </div>
      )}

      {/* AI-визард */}
      <Modal open={wizardOpen} onClose={() => setWizardOpen(false)} title="Новый индивидуальный заказ" wide>
        <p className="text-[13px] text-ink-soft mb-5 flex items-center gap-2"><Sparkles size={15} className="text-ai" /> AI-помощник поможет мастеру понять задачу. Прикрепите референс и опишите детали.</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Название" required>
            <input className="field" value={fTitle} onChange={(e) => setFTitle(e.target.value)} placeholder="Например: Дубовый стол на кухню" />
          </Field>
          <Field label="Тип изделия" required>
            <select className="field" value={fType} onChange={(e) => setFType(e.target.value)}>
              {TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Материал">
            <input className="field" value={fMaterial} onChange={(e) => setFMaterial(e.target.value)} placeholder="Дуб, ротанг, лён…" />
          </Field>
          <Field label="Бюджет, ₽" required>
            <input className="field" inputMode="numeric" value={fBudget} onChange={(e) => setFBudget(e.target.value.replace(/\D/g, ""))} placeholder="30000" />
          </Field>
          <Field label="Срок">
            <select className="field" value={fTerm} onChange={(e) => setFTerm(e.target.value)}>
              {["2–3 недели", "1–2 месяца", "2–3 месяца", "Не срочно"].map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Регион доставки">
            <select className="field" value={fRegion} onChange={(e) => setFRegion(e.target.value)}>
              {DISTRICTS.map((d) => <option key={d.id} value={d.id}>{d.name} округ</option>)}
            </select>
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Описание" required>
            <textarea className="field" rows={4} value={fDesc} onChange={(e) => setFDesc(e.target.value)} placeholder="Габариты, стиль, особые пожелания…" />
          </Field>
        </div>
        <div className="mt-4">
          <label className="flex items-center gap-3 border-2 border-dashed border-line rounded-[10px] px-4 py-3 cursor-pointer hover:border-ai hover:bg-ai-soft/40 transition-colors">
            <Upload size={16} className="text-ink-mute" />
            <span className="text-[13px] font-semibold text-ink-soft">
              {ref ? (
                <span className="flex items-center gap-1.5">{ref.type === "video" ? <Video size={13} className="text-ai" /> : <Camera size={13} className="text-ai" />} {ref.name}</span>
              ) : "Прикрепить фото или видео-референс"}
            </span>
            <input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setRef({ name: f.name, type: f.type.startsWith("video") ? "video" : "image" });
            }} />
            {ref && <button onClick={(e) => { e.preventDefault(); setRef(null); }} className="ml-auto text-ink-mute hover:text-error cursor-pointer" aria-label="Убрать референс"><X size={14} /></button>}
          </label>
        </div>
        {fErr && <p className="text-[12.5px] font-semibold text-error mt-3">{fErr}</p>}
        <Btn size="lg" className="w-full mt-5" onClick={publish}>Опубликовать заказ</Btn>
      </Modal>
    </div>
  );
}

/* ============================================================
   Тарифы: покупатели (4 тарифа, Месяц/Год) и продавцы (3 юрлица)
   ============================================================ */
export function PlansPage() {
  const [audience, setAudience] = useState<"buyer" | "seller">("buyer");
  const [period, setPeriod] = useState<"month" | "year">("month");
  const [sellerType, setSellerType] = useState<SellerLegalType>("self_employed");

  const buyerPlan = useSubStore((s) => s.buyerPlan);
  const setBuyerPlan = useSubStore((s) => s.setBuyerPlan);
  const acc = useSellerAccount();
  const reg = useSellerReg();

  const BUYER_PRICES: Record<BuyerPlanId, number> = { free: 0, start: 500, designer: 1000, premium: 1500 };
  const BUYER_NAMES: Record<BuyerPlanId, string> = { free: "Базовый", start: "Старт", designer: "Дизайнер", premium: "Премиум" };
  const BUYER_FEATURES: Record<BuyerPlanId, string[]> = {
    free: ["2 AI-генерации в месяц", "1 индивидуальный заказ", "Базовый поиск", "Без уведомлений о ценах"],
    start: ["15 AI-генераций", "3 индивидуальных заказа", "Фильтры качества", "Скидка 3% на заказы", "10 отслеживаемых цен"],
    designer: ["50 AI-генераций", "10 индивидуальных заказов", "Скидка 5%", "Ранний доступ к коллекциям", "Безлимит отслеживания цен"],
    premium: ["Безлимит AI-генераций", "Безлимит заказов", "Скидка 7%", "Персональный куратор", "Бесплатная доставка по округу", "Закрытые распродажи", "VIP-бейдж"],
  };

  const price = (id: BuyerPlanId) => {
    const m = BUYER_PRICES[id];
    if (m === 0) return "0 ₽";
    return period === "month" ? `${m} ₽/мес` : `${Math.round((m * 12 * 0.8) / 10) * 10} ₽/год`;
  };

  const activeSellerType = reg.legalType || sellerType;

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-10">
      <h1 className="font-display font-bold text-[clamp(26px,3vw,34px)] text-ink mb-2 text-center">Тарифы</h1>
      <p className="text-[14px] text-ink-soft mb-8 text-center max-w-xl mx-auto">Подписки открывают AI-инструменты, приоритеты и сниженные комиссии.</p>

      {/* переключатель аудиторий */}
      <div className="flex items-center justify-center mb-8">
        <div className="inline-flex bg-line-soft rounded-[14px] p-1.5">
          {([["buyer", "Покупателям"], ["seller", "Продавцам"]] as const).map(([id, label]) => (
            <button key={id} onClick={() => setAudience(id)}
              className={`h-12 px-8 rounded-[10px] text-[14px] font-bold transition-all duration-200 cursor-pointer ${audience === id ? "bg-dark text-cream shadow-card" : "text-ink-soft hover:text-ink"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {audience === "buyer" ? (
        <>
          <div className="flex justify-center mb-8">
            <div className="inline-flex bg-line-soft rounded-[12px] p-1.5">
              {([["month", "Месяц"], ["year", "Год −20%"]] as const).map(([id, label]) => (
                <button key={id} onClick={() => setPeriod(id)}
                  className={`h-10 px-6 rounded-[10px] text-[13px] font-bold transition-all cursor-pointer ${period === id ? "bg-surface text-ink shadow-card" : "text-ink-soft hover:text-ink"}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(Object.keys(BUYER_PRICES) as BuyerPlanId[]).map((id, i) => {
              const active = buyerPlan === id;
              const isPremium = id === "premium";
              return (
                <div key={id} className={`rounded-2xl p-6 flex flex-col fade-up ${isPremium ? "bg-dark text-cream shadow-lift" : "bg-surface shadow-card"}`} style={{ animationDelay: `${i * 60}ms` }}>
                  {isPremium && <Badge tone="premium" className="self-start mb-3"><Gem size={11} /> Максимум</Badge>}
                  <h2 className={`font-display font-bold text-[19px] ${isPremium ? "text-cream" : "text-ink"}`}>{BUYER_NAMES[id]}</h2>
                  <p className={`font-display font-extrabold text-[28px] mt-2 ${isPremium ? "text-accent" : "text-ink"}`}>{price(id)}</p>
                  <ul className="mt-4 space-y-2 flex-1">
                    {BUYER_FEATURES[id].map((f) => (
                      <li key={f} className={`flex items-start gap-2 text-[12.5px] ${isPremium ? "text-cream/80" : "text-ink-soft"}`}>
                        <CheckCircle2 size={14} className={isPremium ? "text-accent shrink-0 mt-0.5" : "text-success shrink-0 mt-0.5"} /> {f}
                      </li>
                    ))}
                  </ul>
                  <Btn className="w-full mt-5" variant={active ? "outline" : isPremium ? "primary" : "dark"} disabled={active}
                    onClick={() => setBuyerPlan(id)}>
                    {active ? "Текущий тариф" : id === "free" ? "Бесплатно" : "Подключить"}
                  </Btn>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <div className="flex justify-center mb-8">
            <div className="inline-flex bg-line-soft rounded-[12px] p-1.5">
              {SELLER_TYPES.map((t) => (
                <button key={t.type} onClick={() => setSellerType(t.type)}
                  className={`h-10 px-5 rounded-[10px] text-[13px] font-bold transition-all cursor-pointer ${sellerType === t.type ? "bg-surface text-ink shadow-card" : "text-ink-soft hover:text-ink"}`}>
                  {t.short} · {t.commission}%
                </button>
              ))}
            </div>
          </div>
          {reg.legalType && reg.legalType !== sellerType && (
            <p className="text-center text-[12.5px] text-ink-mute mb-4">Ваш зарегистрированный тип: <strong className="text-ink">{sellerTypeInfo(reg.legalType)?.short}</strong>. Показаны тарифы для «{sellerTypeInfo(sellerType)?.short}».</p>
          )}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {SELLER_PLANS[sellerType].map((plan, i) => {
              const active = acc.planIds[sellerType] === plan.id;
              const limits = sellerLimits(sellerType, plan.id);
              return (
                <div key={plan.id} className="bg-surface rounded-2xl shadow-card p-6 flex flex-col fade-up" style={{ animationDelay: `${i * 60}ms` }}>
                  <h2 className="font-display font-bold text-[18px] text-ink">{plan.name}</h2>
                  <p className="font-display font-extrabold text-[26px] text-ink mt-2">{plan.price === 0 ? "0 ₽" : `${plan.price} ₽/мес`}</p>
                  <p className="text-[11.5px] text-ink-mute mt-1">Товаров: {fmtLimit(limits.maxProducts)} · AI: {fmtLimit(limits.aiCardGens)}/мес</p>
                  <ul className="mt-4 space-y-2 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-[12.5px] text-ink-soft">
                        <CheckCircle2 size={14} className="text-success shrink-0 mt-0.5" /> {f}
                      </li>
                    ))}
                  </ul>
                  <Btn className="w-full mt-5" variant={active ? "outline" : "dark"} disabled={active}
                    onClick={() => acc.setPlan(sellerType, plan.id)}>
                    {active ? "Текущий тариф" : "Подключить"}
                  </Btn>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/* ============================================================
   Регистрация продавца: 4 этапа (юрлицо → документы → модерация → оплата)
   + блок «О мастере». Используется на /seller/register и в /auth.
   ============================================================ */
export function SellerRegWizard({ embedded = false }: { embedded?: boolean }) {
  const s = useSellerReg();
  const login = useAppStore((st) => st.login);
  const nav = useNavigate();
  const [ocrOk, setOcrOk] = useState<Record<string, boolean>>({});
  const [modScenario, setModScenario] = useState<"approve" | "reject">("approve");
  const [agree, setAgree] = useState(false);
  const [err, setErr] = useState("");

  const info = sellerTypeInfo(s.legalType);

  /* OCR-имитация: файл «проверяется» 1.2с */
  useEffect(() => {
    const pending = Object.entries(s.docs).filter(([k, d]) => d && !ocrOk[k]);
    if (!pending.length) return;
    const t = setTimeout(() => {
      setOcrOk((o) => ({ ...o, ...Object.fromEntries(pending.map(([k]) => [k, true])) }));
    }, 1200);
    return () => clearTimeout(t);
  }, [s.docs, ocrOk]);

  /* модерация 2.5с */
  useEffect(() => {
    if (s.status !== "moderation") return;
    const t = setTimeout(() => {
      if (modScenario === "approve") s.approveModeration();
      else s.rejectModeration("Документы нечитаемы или не соответствуют данным анкеты.");
    }, 2500);
    return () => clearTimeout(t);
  }, [s.status, modScenario, s]);

  const nextFromStep1 = () => {
    if (!s.legalType) { setErr("Выберите юридический статус."); return; }
    if (s.shopName.trim().length < 2 || s.contactName.trim().length < 2 || !s.email.includes("@") || s.masterName.trim().length < 2) {
      setErr("Заполните магазин, ФИО, email и имя мастера."); return;
    }
    if (!agree) { setErr("Примите агентский договор-оферту."); return; }
    setErr("");
    s.toDocs();
  };

  const finish = (method: string) => {
    s.payFee(method);
    login({ id: "seller-" + Date.now(), name: s.contactName || s.masterName, email: s.email, role: "seller" });
    if (!embedded) nav("/seller/dashboard");
  };

  return (
    <div className={embedded ? "" : "max-w-[760px] mx-auto"}>
      {!embedded && (
        <h1 className="font-display font-bold text-[clamp(26px,3vw,34px)] text-ink mb-2">Стать продавцом</h1>
      )}
      <p className="text-[13.5px] text-ink-soft mb-6">
        Регистрация платная и зависит от юридического статуса. Доступ к витрине откроется после верификации документов и оплаты.
      </p>

      {/* ШАГ 1: юрлицо */}
      {s.status === "inactive" && (
        <div className="bg-surface rounded-2xl shadow-card p-6 fade-up">
          <h2 className="font-display font-bold text-[19px] text-ink mb-1">Шаг 1 из 4 · Юридический статус</h2>
          <p className="text-[12.5px] text-ink-mute mb-5">От статуса зависят взнос, комиссия и комплект документов.</p>
          <div className="grid sm:grid-cols-3 gap-3 mb-6">
            {SELLER_TYPES.map((t) => (
              <button key={t.type} onClick={() => { s.setLegalType(t.type); setErr(""); }}
                className={`text-left rounded-xl border p-4 transition-all cursor-pointer ${s.legalType === t.type ? "border-dark bg-cream shadow-card" : "border-line hover:border-ink-mute"}`}>
                <p className="font-bold text-[15px] text-ink">{t.short}</p>
                <p className="text-[11.5px] text-ink-mute mt-0.5">{t.label}</p>
                <p className="text-[12.5px] font-bold text-accent-deep mt-2">Взнос {fmt(t.fee)}</p>
                <p className="text-[12px] text-ink-soft">Комиссия {t.commission}%</p>
              </button>
            ))}
          </div>

          {info && (
            <div className="bg-cream rounded-xl px-4 py-3 mb-5 fade-up">
              <p className="text-[12px] font-bold text-ink mb-1">Понадобятся документы:</p>
              <ul className="space-y-1">
                {info.docs.map((d) => <li key={d.key} className="text-[12px] text-ink-soft flex items-center gap-1.5"><FileText size={12} className="text-accent-deep" /> {d.name}</li>)}
              </ul>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Название магазина" required><input className="field" value={s.shopName} onChange={(e) => s.setInfo({ shopName: e.target.value })} placeholder="Глиняный дом" /></Field>
            <Field label="Имя мастера" required><input className="field" value={s.masterName} onChange={(e) => s.setInfo({ masterName: e.target.value })} placeholder="Мария" /></Field>
            <Field label="ФИО" required><input className="field" value={s.contactName} onChange={(e) => s.setInfo({ contactName: e.target.value })} placeholder="Ковалёва Мария Сергеевна" /></Field>
            <Field label="Email" required><input className="field" type="email" value={s.email} onChange={(e) => s.setInfo({ email: e.target.value })} placeholder="maria@studio.ru" /></Field>
            <Field label="Город"><input className="field" value={s.city} onChange={(e) => s.setInfo({ city: e.target.value })} placeholder="Псков" /></Field>
            <Field label="ИНН"><input className="field" value={s.inn} onChange={(e) => s.setInfo({ inn: e.target.value.replace(/\D/g, "") })} placeholder="602709876543" /></Field>
          </div>

          {/* блок «О мастере» */}
          <div className="mt-6 pt-6 border-t border-line-soft">
            <p className="font-display font-bold text-[16px] text-ink mb-1">О мастере</p>
            <p className="text-[12px] text-ink-mute mb-4">Расскажите о становлении бизнеса — это повышает доверие покупателей. Сервис распределит вас по категориям.</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Лет опыта"><input className="field" value={s.yearsExperience} onChange={(e) => s.setInfo({ yearsExperience: e.target.value })} placeholder="7" /></Field>
              <Field label="Достижения"><input className="field" value={s.achievements} onChange={(e) => s.setInfo({ achievements: e.target.value })} placeholder="Ярмарки, конкурсы, публикации…" /></Field>
            </div>
            <div className="mt-4">
              <Field label="Категории (минимум 1)">
                <div className="flex flex-wrap gap-2 mt-1">
                  {CATEGORIES.slice(0, 12).map((c) => (
                    <button key={c.slug} onClick={() => s.toggleCategory(c.slug)}
                      className={`px-3 min-h-[38px] rounded-full text-[12px] font-semibold transition-all cursor-pointer ${s.categories.includes(c.slug) ? "bg-dark text-cream" : "bg-line-soft text-ink-soft hover:bg-line"}`}>
                      {c.emoji} {c.name}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
            <div className="mt-4">
              <Field label="История бизнеса — взлёты и падения">
                <textarea className="field" rows={4} value={s.businessStory} onChange={(e) => s.setInfo({ businessStory: e.target.value })} placeholder="Как вы начинали, с какими трудностями столкнулись, чем гордитесь…" />
              </Field>
            </div>
          </div>

          <label className="flex items-start gap-3 cursor-pointer select-none mt-6">
            <input type="checkbox" checked={agree} onChange={(e) => { setAgree(e.target.checked); setErr(""); }} className="mt-0.5" />
            <span className="text-[13px] text-ink-soft leading-relaxed">
              Принимаю <Link to="/legal/seller_agreement" className="font-bold text-accent-deep underline">агентский договор-оферту</Link>, гарантирую авторство товаров и отвечаю за интеллектуальную собственность <span className="text-error">*</span>
            </span>
          </label>

          {err && <p className="text-[12.5px] font-semibold text-error mt-3">{err}</p>}
          <div className="flex justify-end mt-5">
            <Btn size="lg" onClick={nextFromStep1}>Продолжить</Btn>
          </div>
        </div>
      )}

      {/* ШАГ 2: документы */}
      {s.status === "docs" && info && (
        <div className="bg-surface rounded-2xl shadow-card p-6 fade-up">
          <h2 className="font-display font-bold text-[19px] text-ink mb-1">Шаг 2 из 4 · Документы</h2>
          <p className="text-[12.5px] text-ink-mute mb-5">JPG, PNG или PDF до 5 МБ. Каждый файл проходит OCR-проверку читаемости.</p>
          <div className="space-y-3">
            {info.docs.map((d) => {
              const doc = s.docs[d.key];
              const ok = !!ocrOk[d.key];
              return (
                <div key={d.key} className={`border rounded-xl p-4 ${doc ? (ok ? "border-success/40 bg-success-soft/40" : "border-line bg-cream") : "border-line"}`}>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-[13.5px] font-bold text-ink">{d.name}</p>
                      <p className="text-[11.5px] text-ink-mute">{d.note}</p>
                    </div>
                    {doc ? (
                      ok
                        ? <Badge tone="success"><CheckCircle2 size={11} /> Прочитано</Badge>
                        : <Badge tone="honey"><Sparkles size={11} /> OCR-проверка…</Badge>
                    ) : (
                      <label className="inline-flex items-center gap-2 h-10 px-4 rounded-[10px] border border-line bg-surface text-[12.5px] font-semibold text-ink-soft hover:border-dark hover:text-ink transition-colors cursor-pointer">
                        <Upload size={14} /> Загрузить
                        <input type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) s.addDoc(d.key, f.name, f.size); }} />
                      </label>
                    )}
                  </div>
                  {doc && <p className="text-[11.5px] text-ink-mute mt-2 flex items-center gap-1.5"><FileText size={12} /> {doc.fileName} · {(doc.size / 1024).toFixed(0)} КБ</p>}
                </div>
              );
            })}
          </div>
          {err && <p className="text-[12.5px] font-semibold text-error mt-3">{err}</p>}
          <div className="flex justify-between mt-5">
            <Btn variant="ghost" onClick={() => s.backToStep1()}>Назад</Btn>
            <Btn disabled={info.docs.some((d) => !s.docs[d.key] || !ocrOk[d.key])} onClick={() => s.submitForModeration()}>Отправить на модерацию</Btn>
          </div>
        </div>
      )}

      {/* ШАГ 3: модерация */}
      {s.status === "moderation" && (
        <div className="bg-surface rounded-2xl shadow-card p-8 text-center fade-up">
          <span className="inline-flex w-16 h-16 rounded-full bg-ai-soft text-ai items-center justify-center mb-4"><ShieldCheck size={30} /></span>
          <h2 className="font-display font-bold text-[20px] text-ink mb-2">Шаг 3 из 4 · Документы на модерации</h2>
          <p className="text-[13px] text-ink-soft mb-6">Проверяем подлинность и соответствие данных. Обычно — несколько часов.</p>
          <div className="inline-flex bg-line-soft rounded-[12px] p-1.5 mb-4">
            {([["approve", "Одобрить (демо)"], ["reject", "Отклонить (демо)"]] as const).map(([id, label]) => (
              <button key={id} onClick={() => setModScenario(id)}
                className={`h-10 px-5 rounded-[10px] text-[12.5px] font-bold transition-all cursor-pointer ${modScenario === id ? "bg-surface text-ink shadow-card" : "text-ink-soft hover:text-ink"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {s.status === "rejected" && (
        <div className="bg-surface rounded-2xl shadow-card p-8 text-center fade-up">
          <p className="text-[40px] mb-2">⚠️</p>
          <h2 className="font-display font-bold text-[20px] text-ink mb-2">Модерация отклонена ({s.rejectionCount}/3)</h2>
          <p className="text-[13px] text-ink-soft mb-6">{s.rejectionReason}</p>
          <Btn onClick={() => s.retryDocuments()}>Загрузить документы заново</Btn>
        </div>
      )}

      {s.status === "blocked" && (
        <div className="bg-surface rounded-2xl shadow-card p-8 text-center fade-up">
          <p className="text-[40px] mb-2">🚫</p>
          <h2 className="font-display font-bold text-[20px] text-ink mb-2">Аккаунт заблокирован</h2>
          <p className="text-[13px] text-ink-soft mb-6">Три отклонения подряд. Напишите в поддержку: {OPERATOR.supportEmail}</p>
          <Btn variant="ghost" onClick={() => s.resetFlow()}>Начать заново</Btn>
        </div>
      )}

      {/* ШАГ 4: оплата */}
      {s.status === "payment" && info && (
        <div className="bg-surface rounded-2xl shadow-card p-6 fade-up">
          <h2 className="font-display font-bold text-[19px] text-ink mb-1">Шаг 4 из 4 · Оплата взноса</h2>
          <p className="text-[12.5px] text-ink-mute mb-5">Документы подтверждены. Оплатите регистрационный взнос — и витрина откроется.</p>
          <div className="bg-dark text-cream rounded-xl p-5 mb-5 flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-[12px] text-cream/60">Регистрационный взнос · {info.short}</p>
              <p className="font-display font-extrabold text-[30px] text-accent">{fmt(info.fee)}</p>
            </div>
            <div className="text-right">
              <p className="text-[12px] text-cream/60">Комиссия с продаж</p>
              <p className="font-display font-bold text-[20px] text-cream">{info.commission}%</p>
            </div>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Btn size="lg" onClick={() => finish("Банковская карта (ЮKassa)")}><CreditCard size={17} /> Картой</Btn>
            <Btn size="lg" variant="dark" onClick={() => finish("СБП")}><Smartphone size={17} /> СБП</Btn>
          </div>
        </div>
      )}

      {s.status === "active" && (
        <div className="bg-surface rounded-2xl shadow-card p-8 text-center fade-up">
          <span className="inline-flex w-16 h-16 rounded-full bg-success-soft text-success items-center justify-center mb-4"><CheckCircle2 size={32} /></span>
          <h2 className="font-display font-bold text-[22px] text-ink mb-2">Витрина открыта!</h2>
          <p className="text-[13.5px] text-ink-soft mb-6">Магазин «{s.shopName}» активен. Комиссия {s.commissionRate}%. Добавьте первые товары.</p>
          <Link to="/seller/dashboard" className="inline-flex items-center justify-center h-[52px] px-7 rounded-[10px] bg-accent text-ink font-semibold hover:bg-accent-deep hover:text-cream transition-colors">В кабинет продавца</Link>
        </div>
      )}
    </div>
  );
}

export function SellerRegisterPage() {
  return (
    <div className="max-w-[860px] mx-auto px-4 sm:px-6 py-10">
      <SellerRegWizard />
    </div>
  );
}

/* ============================================================
   Кабинет продавца: товары (медиа + AI), заказы, финансы,
   аналитика, команда, настройки — гейтится тарифом
   ============================================================ */
export function SellerDashboardPage() {
  const s = useSellerReg();
  const acc = useSellerAccount();
  const user = useAppStore((st) => st.user);
  const [tab, setTab] = useState<"products" | "orders" | "finance" | "analytics" | "team" | "settings">("products");
  const [prod, setProd] = useState({ name: "", category: CATEGORIES[0].name, price: "" });
  const [media, setMedia] = useState<ProductMedia[]>([]);
  const [bulk, setBulk] = useState<string[]>([]);
  const [teamMember, setTeamMember] = useState({ name: "", role: "Менеджер" as "Менеджер" | "Мастер" | "Кладовщик" });
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawSum, setWithdrawSum] = useState("");

  const lt = s.legalType || "self_employed";
  const planId = acc.planIds[lt];
  const plan = sellerLimits(lt, planId);
  const month = currentMonth();
  const aiUsed = acc.aiCardGens[month] || 0;
  const balance = acc.transactions.reduce((sum, t) => sum + t.sellerPayout, 0);
  const commission = selectCommissionSum(acc);
  const turnover = selectTurnover(acc);

  if (s.status !== "active") {
    return (
      <div className="max-w-[700px] mx-auto px-4 py-24 text-center">
        <p className="text-[56px] mb-3">🏪</p>
        <h1 className="font-display font-bold text-[28px] text-ink mb-2">Кабинет продавца недоступен</h1>
        <p className="text-[14px] text-ink-soft mb-7">Зарегистрируйтесь как продавец, чтобы открыть витрину.</p>
        <Link to="/seller/register" className="inline-flex items-center justify-center h-[52px] px-7 rounded-[10px] bg-dark text-cream text-[15px] font-semibold hover:bg-dark-deep transition-colors">Стать продавцом</Link>
      </div>
    );
  }

  const activeProducts = acc.products.filter((p) => !p.archived);
  const overProducts = activeProducts.length >= plan.maxProducts;
  const aiLimitReached = Number.isFinite(plan.aiCardGens) && aiUsed >= plan.aiCardGens;
  const nextCharge = new Date(Date.now() + 20 * 864e5);

  const addMedia = (f: File) => {
    if (media.length >= 10) return;
    const isVideo = f.type.startsWith("video");
    if (isVideo && media.some((m) => m.type === "video")) return; /* только 1 видео */
    setMedia([...media, { type: isVideo ? "video" : "image", url: URL.createObjectURL(f), name: f.name }]);
  };

  const publishProduct = () => {
    if (prod.name.trim().length < 3 || !+prod.price || overProducts) return;
    acc.addProduct({ name: prod.name.trim(), category: prod.category, price: +prod.price, media: media.length ? media : undefined, aiGenerated: false });
    setProd({ name: "", category: CATEGORIES[0].name, price: "" });
    setMedia([]);
  };

  const TABS = [
    { id: "products" as const, label: "Товары", icon: Boxes },
    { id: "orders" as const, label: "Заказы", icon: FileText },
    { id: "finance" as const, label: "Финансы", icon: Wallet },
    ...(plan.analytics !== "basic" ? [{ id: "analytics" as const, label: "Аналитика", icon: BarChart3 }] : []),
    ...(plan.team > 0 ? [{ id: "team" as const, label: "Команда", icon: Users }] : []),
    { id: "settings" as const, label: "Настройки", icon: UserPlus },
  ];

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-10">
      {/* шапка кабинета */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <span className="w-14 h-14 rounded-[16px] bg-dark text-accent flex items-center justify-center text-[26px]">{s.shopName[0]?.toUpperCase()}</span>
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-display font-bold text-[clamp(22px,3vw,30px)] text-ink">{s.shopName}</h1>
            <Badge tone="ai">{sellerTypeInfo(lt)?.short} · {sellerPlanById(lt, planId)?.name}</Badge>
            {plan.badge && <Badge tone="premium"><ShieldCheck size={11} /> {plan.badge}</Badge>}
          </div>
          <p className="text-[12.5px] text-ink-mute mt-1">Комиссия {s.commissionRate}% · следующее списание {fmtDate(nextCharge.toISOString())}</p>
        </div>
        <Link to="/plans" className="text-[13px] font-bold text-accent-deep hover:text-accent underline">Сменить тариф</Link>
      </div>

      {/* лимиты */}
      <div className="grid sm:grid-cols-2 gap-3 mb-7">
        <div className="bg-surface rounded-[14px] shadow-card px-5 py-4">
          <div className="flex justify-between mb-2 flex-wrap gap-1">
            <p className="text-[12.5px] font-bold text-ink flex items-center gap-1.5"><Boxes size={14} className="text-accent-deep" /> Активные товары</p>
            <p className="text-[12px] text-ink-soft font-semibold">{activeProducts.length} из {fmtLimit(plan.maxProducts)}</p>
          </div>
          <ProgressBar value={activeProducts.length} max={Number.isFinite(plan.maxProducts) ? plan.maxProducts : activeProducts.length + 1} tone="accent" />
        </div>
        <div className="bg-surface rounded-[14px] shadow-card px-5 py-4">
          <div className="flex justify-between mb-2 flex-wrap gap-1">
            <p className="text-[12.5px] font-bold text-ink flex items-center gap-1.5"><Sparkles size={14} className="text-ai" /> AI-генерации карточек</p>
            <p className="text-[12px] text-ink-soft font-semibold">{Number.isFinite(plan.aiCardGens) ? `${aiUsed} из ${plan.aiCardGens}` : "Безлимит"}</p>
          </div>
          <ProgressBar value={aiUsed} max={Number.isFinite(plan.aiCardGens) ? plan.aiCardGens : aiUsed + 1} tone="ai" />
        </div>
      </div>

      {aiLimitReached && (
        <div className="flex items-center gap-2.5 bg-ai-soft border border-ai/20 rounded-[10px] px-4 py-3 mb-6">
          <Sparkles size={16} className="text-ai shrink-0" />
          <p className="text-[13px] text-ink flex-1">AI-генерации на этот месяц закончились. <Link to="/plans" className="font-bold text-accent-deep underline">Улучшите тариф для безлимита</Link></p>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-7">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 min-h-[44px] rounded-full text-[13.5px] font-bold whitespace-nowrap transition-all cursor-pointer ${tab === t.id ? "bg-dark text-cream" : "bg-surface border border-line text-ink-soft hover:border-dark hover:text-ink"}`}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {/* ТОВАРЫ */}
      {tab === "products" && (
        <div className="grid lg:grid-cols-[380px_1fr] gap-6 items-start fade-up">
          <div className="bg-surface rounded-2xl shadow-card p-6">
            <h2 className="font-display font-bold text-[17px] text-ink mb-4">Новый товар</h2>
            {overProducts && <p className="text-[12px] font-semibold text-error mb-3">Достигнут лимит товаров ({fmtLimit(plan.maxProducts)}). Улучшите тариф.</p>}
            <div className="space-y-3.5">
              <Field label="Название" required><input className="field" value={prod.name} onChange={(e) => setProd({ ...prod, name: e.target.value })} placeholder="Ваза «Утро»" /></Field>
              <Field label="Категория">
                <select className="field" value={prod.category} onChange={(e) => setProd({ ...prod, category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c.slug}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Цена, ₽" required><input className="field" inputMode="numeric" value={prod.price} onChange={(e) => setProd({ ...prod, price: e.target.value.replace(/\D/g, "") })} placeholder="4900" /></Field>

              {/* медиа: до 10, 1 может быть видео */}
              <div>
                <p className="text-[12.5px] font-semibold text-ink mb-2">Фото и видео <span className="text-[11px] text-ink-mute font-medium">до 10, 1 может быть видео</span></p>
                <div className="flex gap-2 flex-wrap">
                  {media.map((m, i) => (
                    <div key={i} className="relative w-[64px] h-[54px] rounded-[8px] overflow-hidden border border-line-soft group">
                      {m.type === "video"
                        ? <video src={m.url} className="w-full h-full object-cover" muted />
                        : <img src={m.url} alt={m.name} className="w-full h-full object-cover" />}
                      {m.type === "video" && <span className="absolute inset-0 flex items-center justify-center bg-dark/30"><Play size={14} className="text-cream" /></span>}
                      <button onClick={() => setMedia(media.filter((_, x) => x !== i))} aria-label="Удалить"
                        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-error text-white items-center justify-center hidden group-hover:flex cursor-pointer">
                        <X size={9} />
                      </button>
                    </div>
                  ))}
                  {media.length < 10 && (
                    <label className="w-[64px] h-[54px] rounded-[8px] border-2 border-dashed border-line flex items-center justify-center cursor-pointer hover:border-ai hover:bg-ai-soft/40 transition-colors">
                      <Upload size={15} className="text-ink-mute" />
                      <input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) addMedia(f); }} />
                    </label>
                  )}
                </div>
                <p className="text-[11px] text-ink-mute mt-1.5">{media.length}/10 · видео: {media.some((m) => m.type === "video") ? "1" : "0"}/1</p>
              </div>

              <Btn variant="outline" className="w-full" disabled={aiLimitReached} onClick={() => { if (!aiLimitReached) acc.consumeAiCardGen(month); }}>
                <Sparkles size={15} /> {aiLimitReached ? "AI-лимит исчерпан" : "Сгенерировать описание с AI"}
              </Btn>
              <Btn className="w-full" disabled={prod.name.trim().length < 3 || !+prod.price || overProducts} onClick={publishProduct}>Опубликовать</Btn>
            </div>
          </div>

          <div className="space-y-3">
            {plan.massEdit && bulk.length > 0 && (
              <div className="bg-surface rounded-2xl shadow-card p-4 flex items-center gap-3 flex-wrap fade-up">
                <p className="text-[13px] font-semibold text-ink">Выбрано: {bulk.length}</p>
                <Btn size="sm" onClick={() => { acc.bulkSetPrice(bulk, -10); setBulk([]); }}>−10%</Btn>
                <Btn size="sm" onClick={() => { acc.bulkSetPrice(bulk, 10); setBulk([]); }}>+10%</Btn>
                <Btn size="sm" variant="ghost" onClick={() => { bulk.forEach((id) => acc.toggleArchive(id)); setBulk([]); }}>В архив</Btn>
              </div>
            )}
            {acc.products.length === 0 && (
              <div className="bg-surface rounded-2xl shadow-card px-8 py-16 text-center">
                <p className="text-[44px] mb-3">📦</p>
                <p className="font-display font-bold text-[19px] text-ink mb-2">Товаров пока нет</p>
                <p className="text-[14px] text-ink-soft">Добавьте первый товар в форме слева.</p>
              </div>
            )}
            {acc.products.map((p) => (
              <div key={p.id} className="bg-surface rounded-2xl shadow-card p-4 flex items-center gap-4">
                {plan.massEdit && (
                  <input type="checkbox" checked={bulk.includes(p.id)} aria-label={`Выбрать ${p.name}`}
                    onChange={() => setBulk((sel) => (sel.includes(p.id) ? sel.filter((x) => x !== p.id) : [...sel, p.id]))} />
                )}
                {p.media && p.media.length > 0 && (
                  <div className="flex gap-1.5 shrink-0">
                    {p.media.slice(0, 3).map((m, i) => (
                      <span key={i} className="relative w-11 h-11 rounded-[8px] overflow-hidden border border-line-soft">
                        {m.type === "video" ? <video src={m.url} className="w-full h-full object-cover" muted /> : <img src={m.url} alt="" className="w-full h-full object-cover" />}
                        {m.type === "video" && <span className="absolute inset-0 flex items-center justify-center bg-dark/30"><Play size={11} className="text-cream" /></span>}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex-1 min-w-[200px]">
                  <p className="font-bold text-[14.5px] text-ink flex items-center gap-2">
                    {p.name}
                    {p.aiGenerated && <Badge tone="ai"><Sparkles size={10} /> AI</Badge>}
                    {p.archived && <Badge tone="neutral">Архив</Badge>}
                  </p>
                  <p className="text-[12px] text-ink-mute mt-0.5">{p.category} · {fmt(p.price)} · {fmtDate(p.createdAt)}</p>
                </div>
                <button onClick={() => acc.toggleArchive(p.id)} className="text-[12px] font-semibold text-ink-soft hover:text-ink cursor-pointer transition-colors">{p.archived ? "Вернуть" : "Архив"}</button>
                <button onClick={() => acc.removeProduct(p.id)} className="w-9 h-9 rounded-[10px] flex items-center justify-center text-ink-mute hover:text-error hover:bg-error-soft cursor-pointer transition-colors"><X size={16} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ЗАКАЗЫ */}
      {tab === "orders" && (
        <div className="space-y-3 fade-up">
          {[
            { id: "UYA-3127", buyer: "Анна М.", sum: 10000, status: "Ожидает отправки" },
            { id: "UYA-3084", buyer: "Дмитрий К.", sum: 4500, status: "Отправлен" },
          ].map((o) => (
            <div key={o.id} className="bg-surface rounded-2xl shadow-card p-5 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="font-bold text-[15px] text-ink">Заказ {o.id}</p>
                <p className="text-[12.5px] text-ink-mute mt-0.5">{o.buyer} · {fmt(o.sum)}</p>
              </div>
              <Badge tone={o.status === "Отправлен" ? "ai" : "honey"}>{o.status}</Badge>
            </div>
          ))}
        </div>
      )}

      {/* ФИНАНСЫ */}
      {tab === "finance" && (
        <div className="fade-up">
          <div className="grid sm:grid-cols-3 gap-3 mb-5">
            <div className="bg-surface rounded-2xl shadow-card p-5">
              <p className="text-[12px] text-ink-mute">Оборот</p>
              <p className="font-display font-extrabold text-[24px] text-ink mt-1">{fmt(turnover)}</p>
            </div>
            <div className="bg-surface rounded-2xl shadow-card p-5">
              <p className="text-[12px] text-ink-mute">Комиссия платформы</p>
              <p className="font-display font-extrabold text-[24px] text-accent-deep mt-1">{fmt(commission)}</p>
            </div>
            <div className="bg-surface rounded-2xl shadow-card p-5">
              <p className="text-[12px] text-ink-mute">К выводу</p>
              <p className="font-display font-extrabold text-[24px] text-[#4d7327] mt-1">{fmt(balance)}</p>
              <Btn size="sm" className="mt-3" disabled={balance <= 0} onClick={() => setWithdrawOpen(true)}><Wallet size={14} /> Вывести</Btn>
            </div>
          </div>
          <div className="bg-surface rounded-2xl shadow-card overflow-hidden">
            <p className="font-display font-bold text-[16px] text-ink px-6 pt-5 pb-3">История транзакций</p>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] min-w-[560px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-ink-mute border-y border-line-soft bg-cream/60">
                    <th className="px-6 py-3 font-bold">Дата</th><th className="px-3 py-3 font-bold">Операция</th>
                    <th className="px-3 py-3 font-bold text-right">Сумма</th><th className="px-3 py-3 font-bold text-right">Комиссия</th>
                    <th className="px-6 py-3 font-bold text-right">Выплата</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {acc.transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-cream/50 transition-colors">
                      <td className="px-6 py-3 text-ink-mute whitespace-nowrap">{fmtDate(t.date)}</td>
                      <td className="px-3 py-3 font-semibold text-ink">{t.kind === "sale" ? `Заказ ${t.orderId}` : `Вывод ${t.orderId}`}</td>
                      <td className="px-3 py-3 text-right text-ink">{t.productPrice ? fmt(t.productPrice) : "—"}</td>
                      <td className="px-3 py-3 text-right text-accent-deep font-semibold">{t.commissionAmount ? `−${fmt(t.commissionAmount)}` : "—"}</td>
                      <td className={`px-6 py-3 text-right font-bold ${t.sellerPayout < 0 ? "text-error" : "text-[#4d7327]"}`}>{t.sellerPayout < 0 ? `−${fmt(-t.sellerPayout)}` : `+${fmt(t.sellerPayout)}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* АНАЛИТИКА */}
      {tab === "analytics" && (
        <div className="fade-up grid sm:grid-cols-2 gap-4">
          <div className="bg-surface rounded-2xl shadow-card p-6">
            <p className="font-display font-bold text-[16px] text-ink mb-4 flex items-center gap-2"><BarChart3 size={17} className="text-accent-deep" /> Воронка продаж</p>
            {[["Просмотры", 4200, 100], ["В корзину", 640, 15], ["Заказы", 180, 4.3], ["Выкуп", 150, 3.6]].map(([label, val, pct]) => (
              <div key={label as string} className="mb-3">
                <div className="flex justify-between text-[12px] mb-1"><span className="font-semibold text-ink">{label}</span><span className="text-ink-mute">{(val as number).toLocaleString("ru-RU")} · {pct}%</span></div>
                <div className="h-2.5 rounded-full bg-line-soft overflow-hidden"><div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} /></div>
              </div>
            ))}
          </div>
          <div className="bg-surface rounded-2xl shadow-card p-6">
            <p className="font-display font-bold text-[16px] text-ink mb-4 flex items-center gap-2"><TrendingUp size={17} className="text-ai" /> Рекомендации по ценам</p>
            <p className="text-[13.5px] text-ink-soft leading-relaxed">Ваши товары в категории «{prod.category}» в среднем на 8% дороже рыночных. Снижение цены на 5% может поднять конверсию до 6%.</p>
            {plan.forecasts && <p className="text-[13.5px] text-ink-soft leading-relaxed mt-3 pt-3 border-t border-line-soft"><strong className="text-ink">Прогноз:</strong> при текущей динамике выручка следующего месяца ≈ {fmt(Math.round(turnover * 1.18))}.</p>}
          </div>
        </div>
      )}

      {/* КОМАНДА */}
      {tab === "team" && (
        <div className="fade-up max-w-[640px]">
          <div className="bg-surface rounded-2xl shadow-card p-6 mb-4">
            <p className="font-display font-bold text-[16px] text-ink mb-4">Сотрудники · {acc.team.length} из {fmtLimit(plan.team)}</p>
            {acc.team.length === 0 && <p className="text-[13.5px] text-ink-soft mb-4">Добавьте сотрудников с ролями: менеджер, мастер, кладовщик.</p>}
            <div className="space-y-2.5 mb-5">
              {acc.team.map((m) => (
                <div key={m.id} className="flex items-center justify-between border border-line-soft rounded-[10px] px-4 py-3">
                  <div>
                    <p className="text-[13.5px] font-semibold text-ink">{m.name}</p>
                    <p className="text-[11.5px] text-ink-mute">{m.role}</p>
                  </div>
                  <button onClick={() => acc.removeMember(m.id)} className="w-9 h-9 rounded-[10px] flex items-center justify-center text-ink-mute hover:text-error hover:bg-error-soft cursor-pointer transition-colors"><X size={16} /></button>
                </div>
              ))}
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <input className="field sm:col-span-1" placeholder="Имя" value={teamMember.name} onChange={(e) => setTeamMember({ ...teamMember, name: e.target.value })} />
              <select className="field" value={teamMember.role} onChange={(e) => setTeamMember({ ...teamMember, role: e.target.value as typeof teamMember.role })}>
                {["Менеджер", "Мастер", "Кладовщик"].map((r) => <option key={r}>{r}</option>)}
              </select>
              <Btn disabled={!teamMember.name.trim() || acc.team.length >= plan.team} onClick={() => { acc.addMember(teamMember); setTeamMember({ name: "", role: "Менеджер" }); }}>Добавить</Btn>
            </div>
          </div>
        </div>
      )}

      {/* НАСТРОЙКИ */}
      {tab === "settings" && (
        <div className="fade-up max-w-[640px] bg-surface rounded-2xl shadow-card p-6">
          <p className="font-display font-bold text-[16px] text-ink mb-4">Юридические данные</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12.5px]">
            <p><span className="text-ink-mute block">Продавец</span><span className="font-semibold text-ink">{s.legalName || sellerTypeInfo(lt)?.label}</span></p>
            <p><span className="text-ink-mute block">Форма</span><span className="font-semibold text-ink">{sellerTypeInfo(lt)?.short}</span></p>
            <p><span className="text-ink-mute block">ИНН</span><span className="font-semibold text-ink">{s.inn || "—"}</span></p>
            <p><span className="text-ink-mute block">Город</span><span className="font-semibold text-ink">{s.city || "—"}</span></p>
          </div>
          <div className="mt-5 pt-5 border-t border-line-soft">
            <p className="text-[13px] font-semibold text-ink mb-2">Тариф: {sellerPlanById(lt, planId)?.name} ({fmt(sellerPlanById(lt, planId)?.price || 0)}/мес)</p>
            <Link to="/plans" className="text-[13px] font-bold text-accent-deep hover:text-accent underline">Управлять подпиской</Link>
          </div>
          {s.masterName && (
            <div className="mt-5 pt-5 border-t border-line-soft">
              <p className="text-[13px] font-semibold text-ink mb-1">О мастере</p>
              <p className="text-[12.5px] text-ink-soft">{s.masterName}{s.yearsExperience ? ` · ${s.yearsExperience} лет опыта` : ""}{s.achievements ? ` · ${s.achievements}` : ""}</p>
              {s.businessStory && <p className="text-[12.5px] text-ink-soft mt-2 leading-relaxed">{s.businessStory}</p>}
            </div>
          )}
        </div>
      )}

      {/* вывод средств */}
      <Modal open={withdrawOpen} onClose={() => setWithdrawOpen(false)} title="Вывод средств">
        <p className="text-[13px] text-ink-soft mb-4">Доступно: <strong className="text-ink">{fmt(balance)}</strong>. Деньги уйдут на расчётный счёт в течение 1–3 рабочих дней.</p>
        <Field label="Сумма, ₽" required>
          <input className="field" inputMode="numeric" value={withdrawSum} onChange={(e) => setWithdrawSum(e.target.value.replace(/\D/g, ""))} placeholder={String(balance)} />
        </Field>
        <Btn className="w-full mt-5" disabled={!+withdrawSum || +withdrawSum > balance} onClick={() => { acc.requestWithdrawal(+withdrawSum); setWithdrawSum(""); setWithdrawOpen(false); }}>
          <Wallet size={16} /> Вывести
        </Btn>
      </Modal>
    </div>
  );
}

/* ============================================================
   О нас
   ============================================================ */
export function AboutPage() {
  return (
    <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-12">
      <h1 className="font-lux text-[clamp(34px,5vw,56px)] leading-[1.05] text-ink mb-6">Пространство,<br />у которого есть автор</h1>
      <p className="font-quote text-[22px] text-ink-soft leading-relaxed mb-8 max-w-2xl">
        УютАрт — AI-маркетплейс, где технологии помогают находить вещи с характером, а мастера получают честный доступ к покупателям по всей России.
      </p>
      <div className="grid sm:grid-cols-3 gap-4 mb-10">
        {[["1 240", "мастерских"], ["41", "категория товаров"], ["74", "города доставки"]].map(([n, l]) => (
          <div key={l} className="bg-surface rounded-2xl shadow-card p-6 text-center">
            <p className="font-display font-extrabold text-[34px] text-accent-deep">{n}</p>
            <p className="text-[13px] text-ink-soft mt-1">{l}</p>
          </div>
        ))}
      </div>
      <div className="space-y-5 text-[15px] leading-[1.75] text-ink-soft">
        <p>Мы — информационный агрегатор (ст. 12 ЗоЗПП): не продаём товары сами, а соединяем проверенных продавцов и покупателей. Каждый продавец проходит верификацию документов, каждая сделка защищена: деньги резервируются на транзитном счёте и уходят мастеру только после отправки.</p>
        <p>AI-дизайнер собирает образы из реальных товаров каталога, учитывая ваш регион: крупногабарит — только от мастеров, которые доставляют в ваш округ, декор — со всей страны.</p>
        <p>Оператор платформы — {OPERATOR.name}, ИНН {OPERATOR.inn}.</p>
      </div>
    </div>
  );
}

/* ============================================================
   Юридические документы
   ============================================================ */
export function LegalPage() {
  const { type = "buyer_tos" } = useParams();
  const doc = legalDoc(type);

  return (
    <div className="max-w-[1000px] mx-auto px-4 sm:px-6 py-10">
      <div className="grid md:grid-cols-[240px_1fr] gap-8 items-start">
        <nav className="bg-surface rounded-2xl shadow-card p-4 md:sticky md:top-24">
          <p className="text-[11px] font-bold uppercase tracking-widest text-ink-mute px-2 pb-2">Документы</p>
          {LEGAL_DOCUMENTS.map((d) => (
            <Link key={d.doc_type} to={`/legal/${d.doc_type}`}
              className={`block px-3 py-2.5 rounded-[10px] text-[13px] font-semibold transition-colors ${d.doc_type === type ? "bg-dark text-cream" : "text-ink-soft hover:bg-cream hover:text-ink"}`}>
              {d.title}
            </Link>
          ))}
        </nav>
        {doc ? (
          <div className="bg-surface rounded-2xl shadow-card p-7 sm:p-9">
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <h1 className="font-display font-bold text-[clamp(22px,3vw,30px)] text-ink">{doc.title}</h1>
              <Badge tone="ai">v{doc.version}</Badge>
            </div>
            <p className="text-[13px] text-ink-mute mb-6">{doc.summary}</p>
            <Markdown text={doc.content} />
            <p className="text-[12px] text-ink-mute mt-8 pt-6 border-t border-line-soft">Оператор: {OPERATOR.name} · ИНН {OPERATOR.inn} · {OPERATOR.legalEmail}</p>
          </div>
        ) : (
          <p className="text-[14px] text-ink-soft">Документ не найден.</p>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   Контакты: 3 сценария поддержки + FAQ + форма
   ============================================================ */
export function ContactsPage() {
  const user = useAppStore((s) => s.user);
  const [form, setForm] = useState({ name: user?.name || "", email: user?.email || "", topic: "Вопрос по заказу", message: "" });
  const [sent, setSent] = useState(false);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  const FAQ = [
    { q: "Как вернуть товар?", a: "В течение 7 дней с момента получения — через «Оформить возврат» в личном кабинете. Товары на заказ (custom-made) возврату не подлежат." },
    { q: "Когда мастер получит деньги?", a: "После отправки товара и ввода трек-номера — в рамках «Безопасной сделки». До этого деньги зарезервированы на транзитном счёте." },
    { q: "Как пожаловаться на продавца?", a: "На странице магазина есть кнопка «Пожаловаться». Жалоба уходит в арбитраж платформы, рассмотрение — 5 рабочих дней." },
    { q: "Есть ли доставка в мой регион?", a: "Декор доставляется по всей России. Крупногабарит — от мастеров вашего округа: каталог сам скрывает тех, кто не доставляет к вам." },
    { q: "Что делать, если AI-подбор не подошёл?", a: "Уточните запрос, добавьте стиль или бюджет. AI-подбор — экспериментальный инструмент и не является профессиональной рекомендацией." },
  ];

  return (
    <div className="max-w-[980px] mx-auto px-4 sm:px-6 py-10">
      <h1 className="font-display font-bold text-[clamp(26px,3vw,34px)] text-ink mb-2">Контакты</h1>
      <p className="text-[14px] text-ink-soft mb-8">Мы отвечаем в течение рабочего дня.</p>

      <div className="grid sm:grid-cols-3 gap-4 mb-10">
        {[["Покупателям", "Вопросы по заказам, возврату и доставке", OPERATOR.supportEmail, "🛒"], ["Продавцам", "Витрина, выплаты, верификация", "sellers@uyutart.ru", "🏪"], ["Партнёрам и юр. вопросы", "Договоры, интеграции, СМИ", OPERATOR.legalEmail, "🤝"]].map(([t, d, e, ic]) => (
          <div key={t} className="bg-surface rounded-2xl shadow-card p-6">
            <p className="text-[28px] mb-3">{ic}</p>
            <p className="font-bold text-[15px] text-ink">{t}</p>
            <p className="text-[12.5px] text-ink-soft mt-1 mb-3">{d}</p>
            <a href={`mailto:${e}`} className="text-[13px] font-bold text-accent-deep hover:text-accent break-all">{e}</a>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6 items-start">
        <div className="bg-surface rounded-2xl shadow-card p-6">
          <h2 className="font-display font-bold text-[18px] text-ink mb-4">Написать нам</h2>
          {sent ? (
            <p className="flex items-center gap-2 text-[14px] text-[#4d7327] font-semibold"><CheckCircle2 size={18} /> Сообщение отправлено — ответим на {form.email}.</p>
          ) : (
            <div className="space-y-3.5">
              <Field label="Имя" required><input className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              <Field label="Email" required><input className="field" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
              <Field label="Тема">
                <select className="field" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })}>
                  {["Вопрос по заказу", "Возврат", "Стать продавцом", "Жалоба", "Другое"].map((t) => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Сообщение" required><textarea className="field" rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></Field>
              <Btn className="w-full" disabled={!form.name.trim() || !form.email.includes("@") || form.message.trim().length < 5} onClick={() => setSent(true)}><Send size={16} /> Отправить</Btn>
            </div>
          )}
        </div>

        <div className="bg-surface rounded-2xl shadow-card p-6">
          <h2 className="font-display font-bold text-[18px] text-ink mb-4">Частые вопросы</h2>
          <div className="space-y-2">
            {FAQ.map((f, i) => (
              <div key={i} className="border border-line-soft rounded-[10px] overflow-hidden">
                <button onClick={() => setFaqOpen(faqOpen === i ? null : i)} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left cursor-pointer hover:bg-cream transition-colors">
                  <span className="text-[13.5px] font-semibold text-ink flex items-center gap-2"><HelpCircle size={15} className="text-accent-deep shrink-0" /> {f.q}</span>
                  <span className={`text-ink-mute transition-transform ${faqOpen === i ? "rotate-180" : ""}`}>▾</span>
                </button>
                {faqOpen === i && <p className="px-4 pb-3.5 text-[13px] text-ink-soft leading-relaxed fade-up">{f.a}</p>}
              </div>
            ))}
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
      <p className="text-[14px] text-ink-soft mb-8">Возможно, она переехала или никогда не существовала.</p>
      <div className="flex gap-3 justify-center flex-wrap">
        <Link to="/" className="h-[52px] px-7 rounded-[10px] bg-dark text-cream text-[15px] font-semibold hover:bg-dark-deep transition-colors flex items-center">На главную</Link>
        <Link to="/catalog" className="h-[52px] px-7 rounded-[10px] border border-line bg-surface text-[15px] font-semibold hover:bg-cream transition-colors flex items-center">В каталог</Link>
      </div>
    </div>
  );
}
