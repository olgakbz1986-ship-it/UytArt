import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShoppingBag, Truck, CreditCard, CheckCircle2, ShieldCheck, Ban, MapPin, Minus, Plus, Trash2, Crown } from "lucide-react";
import { fmt, productById } from "../data/seed";
import { useAppStore } from "../lib/store";
import { useSubStore, buyerLimits } from "../lib/subscriptions";
import { Badge, Btn, Field, ProductImg } from "../components/ui";

const DELIVERY_METHODS = [
  { id: "cdek-pvz", carrier: "СДЭК", label: "СДЭК · пункт выдачи", price: 350, days: "2–4 дня" },
  { id: "cdek-door", carrier: "СДЭК", label: "СДЭК · курьером до двери", price: 550, days: "1–3 дня" },
  { id: "post", carrier: "Почта России", label: "Почта России · отделение", price: 250, days: "5–10 дней" },
];

const PROMO: Record<string, { type: "pct" | "fix"; value: number; min: number }> = {
  UYUT10: { type: "pct", value: 10, min: 0 },
  WELCOME500: { type: "fix", value: 500, min: 3000 },
};

/* ============================================================
   Корзина
   ============================================================ */
export function CartPage() {
  const cart = useAppStore((s) => s.cart);
  const setQty = useAppStore((s) => s.setQty);
  const removeFromCart = useAppStore((s) => s.removeFromCart);
  const nav = useNavigate();

  const items = cart
    .map((c) => ({ ...c, p: productById(c.productId) }))
    .filter((x) => x.p) as { productId: string; qty: number; p: NonNullable<ReturnType<typeof productById>> }[];

  const subtotal = items.reduce((s, x) => s + x.p.price * x.qty, 0);

  if (items.length === 0) {
    return (
      <div className="max-w-[700px] mx-auto px-4 py-24 text-center">
        <p className="text-[56px] mb-3">🧺</p>
        <h1 className="font-display font-bold text-[28px] text-ink mb-2">Корзина пуста</h1>
        <p className="text-[14px] text-ink-soft mb-7">Загляните в каталог — там {`«`}живые{`»`} вещи от мастеров со всей России.</p>
        <Link to="/catalog" className="inline-flex items-center justify-center h-[52px] px-7 rounded-[10px] bg-dark text-cream font-semibold hover:bg-dark-deep transition-colors">
          <ShoppingBag size={18} className="mr-2" /> В каталог
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-10">
      <h1 className="font-display font-bold text-[clamp(26px,3vw,34px)] text-ink mb-8">Корзина</h1>
      <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
        <div className="space-y-3">
          {items.map(({ p, qty }) => (
            <div key={p.id} className="bg-surface rounded-2xl shadow-card p-4 flex items-center gap-4 fade-up">
              <Link to={`/product/${p.slug}`} className="w-20 h-20 rounded-[12px] overflow-hidden shrink-0 group"><ProductImg p={p} /></Link>
              <div className="flex-1 min-w-[160px]">
                <Link to={`/product/${p.slug}`} className="font-bold text-[14.5px] text-ink hover:text-accent-deep transition-colors line-clamp-1">{p.name}</Link>
                <p className="text-[12px] text-ink-mute mt-0.5">{fmt(p.price)} / шт</p>
                {p.is_non_returnable && <Badge tone="error" className="mt-1.5"><Ban size={10} /> возврат невозможен</Badge>}
              </div>
              <div className="flex items-center border border-line rounded-[10px] overflow-hidden shrink-0">
                <button onClick={() => setQty(p.id, qty - 1)} aria-label="Меньше" className="w-10 h-10 flex items-center justify-center text-ink-soft hover:bg-line-soft cursor-pointer transition-colors"><Minus size={15} /></button>
                <span className="w-9 text-center font-bold text-[14px] text-ink">{qty}</span>
                <button onClick={() => setQty(p.id, qty + 1)} aria-label="Больше" className="w-10 h-10 flex items-center justify-center text-ink-soft hover:bg-line-soft cursor-pointer transition-colors"><Plus size={15} /></button>
              </div>
              <span className="font-display font-bold text-[16px] text-ink w-[92px] text-right shrink-0">{fmt(p.price * qty)}</span>
              <button onClick={() => removeFromCart(p.id)} aria-label="Удалить" className="w-10 h-10 rounded-[10px] flex items-center justify-center text-ink-mute hover:text-error hover:bg-error-soft cursor-pointer transition-colors shrink-0">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <aside className="bg-surface rounded-2xl shadow-card p-6 sticky top-24">
          <p className="flex justify-between text-[14px] text-ink-soft mb-4"><span>Товары</span><span className="font-bold text-ink">{fmt(subtotal)}</span></p>
          <Btn size="lg" className="w-full" onClick={() => nav("/checkout")}>Оформить заказ</Btn>
          <p className="text-[12px] text-ink-mute mt-3.5 flex items-start gap-1.5"><ShieldCheck size={13} className="shrink-0 mt-0.5 text-success" /> Оплата через безопасную сделку: мастер получит деньги только после отправки.</p>
        </aside>
      </div>
    </div>
  );
}

/* ============================================================
   Одностраничное оформление (one-page checkout)
   ============================================================ */
export function CheckoutPage() {
  const cart = useAppStore((s) => s.cart);
  const addresses = useAppStore((s) => s.addresses);
  const user = useAppStore((s) => s.user);
  const bonusBalance = useAppStore((s) => s.bonusBalance);
  const addBonus = useAppStore((s) => s.addBonus);
  const placeOrder = useAppStore((s) => s.placeOrder);
  const clearCart = useAppStore((s) => s.clearCart);
  const buyerPlan = useSubStore((s) => s.buyerPlan);
  const lim = buyerLimits(buyerPlan);
  const nav = useNavigate();

  const [deliveryId, setDeliveryId] = useState("cdek-pvz");
  const [addressId, setAddressId] = useState(addresses[0]?.id || "");
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<string | null>(null);
  const [promoErr, setPromoErr] = useState("");
  const [useBonuses, setUseBonuses] = useState(false);
  const [escrowOk, setEscrowOk] = useState(false);
  const [tosOk, setTosOk] = useState(false);
  const [customOk, setCustomOk] = useState(false);
  const [paying, setPaying] = useState(false);
  const [doneOrder, setDoneOrder] = useState<{ number: string; total: number } | null>(null);

  const items = useMemo(
    () =>
      cart
        .map((c) => ({ ...c, p: productById(c.productId) }))
        .filter((x) => x.p) as { productId: string; qty: number; p: NonNullable<ReturnType<typeof productById>> }[],
    [cart]
  );

  const subtotal = items.reduce((s, x) => s + x.p.price * x.qty, 0);
  const hasCustom = items.some((x) => x.p.is_non_returnable);
  const method = DELIVERY_METHODS.find((m) => m.id === deliveryId)!;
  const delivery = buyerPlan === "premium" ? 0 : method.price;

  const tariffDiscount = Math.round((subtotal * lim.discountPct) / 100);
  const promoDiscount = useMemo(() => {
    if (!promo) return 0;
    const p = PROMO[promo];
    if (subtotal < p.min) return 0;
    return p.type === "pct" ? Math.round((subtotal * p.value) / 100) : p.value;
  }, [promo, subtotal]);

  const bonusCap = Math.round((subtotal - tariffDiscount - promoDiscount) * 0.3);
  const bonusUsed = useBonuses ? Math.min(bonusBalance, bonusCap) : 0;
  const total = Math.max(0, subtotal - tariffDiscount - promoDiscount - bonusUsed) + delivery;
  const addr = addresses.find((a) => a.id === addressId);

  const applyPromo = () => {
    const code = promoInput.trim().toUpperCase();
    if (PROMO[code]) { setPromo(code); setPromoErr(""); }
    else { setPromo(null); setPromoErr("Такого промокода нет. Попробуйте UYUT10."); }
  };

  const pay = () => {
    if (!addr) return;
    setPaying(true);
    setTimeout(() => {
      const o = placeOrder({
        items: items.map((x) => ({ productId: x.productId, qty: x.qty, price: x.p.price })),
        total,
        delivery,
        deliveryMethod: method.label,
        address: `${addr.city}, ${addr.street}`,
        hasCustom,
        payMethod: "Банковская карта (ЮKassa)",
      });
      if (bonusUsed > 0) addBonus(-bonusUsed, `Оплата бонусами · заказ ${o.number}`);
      clearCart();
      setPaying(false);
      setDoneOrder({ number: o.number, total });
    }, 1200);
  };

  if (doneOrder) {
    return (
      <div className="max-w-[640px] mx-auto px-4 py-24 text-center">
        <span className="inline-flex w-20 h-20 rounded-full bg-success-soft text-[#4d7327] items-center justify-center mb-6 pop-in"><CheckCircle2 size={40} /></span>
        <h1 className="font-display font-bold text-[30px] text-ink mb-3">Заказ {doneOrder.number} оплачен</h1>
        <p className="text-[14.5px] text-ink-soft leading-relaxed max-w-md mx-auto">
          Деньги зарезервированы на транзитном счёте (безопасная сделка). Мастер получит их после отправки.
          Статусы и чат по заказу — в личном кабинете.
        </p>
        <p className="font-display font-extrabold text-[24px] text-ink mt-5">{fmt(doneOrder.total)}</p>
        <div className="flex gap-3 justify-center mt-8 flex-wrap">
          <Link to="/profile" className="inline-flex items-center justify-center h-[52px] px-7 rounded-[10px] bg-dark text-cream font-semibold hover:bg-dark-deep transition-colors">Мои заказы</Link>
          <Link to="/catalog" className="inline-flex items-center justify-center h-[52px] px-7 rounded-[10px] border border-line bg-surface font-semibold hover:bg-cream transition-colors">В каталог</Link>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-[700px] mx-auto px-4 py-24 text-center">
        <p className="text-[56px] mb-3">🧺</p>
        <h1 className="font-display font-bold text-[26px] text-ink mb-3">Оформлять пока нечего</h1>
        <Link to="/catalog" className="inline-flex items-center justify-center h-11 px-6 rounded-[10px] bg-dark text-cream text-sm font-semibold hover:bg-dark-deep transition-colors">В каталог</Link>
      </div>
    );
  }

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-10">
      <h1 className="font-display font-bold text-[clamp(26px,3vw,34px)] text-ink mb-8">Оформление заказа</h1>
      <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
        <div className="space-y-6">
          {/* 1. Товары */}
          <section className="bg-surface rounded-2xl shadow-card p-6">
            <h2 className="font-display font-bold text-[18px] text-ink mb-4 flex items-center gap-2.5"><ShoppingBag size={18} className="text-accent-deep" /> Ваш заказ</h2>
            <div className="space-y-3">
              {items.map(({ p, qty }) => (
                <div key={p.id} className="flex items-center gap-3.5">
                  <Link to={`/product/${p.slug}`} className="w-14 h-14 rounded-[10px] overflow-hidden shrink-0 group"><ProductImg p={p} /></Link>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[13.5px] text-ink truncate">{p.name}</p>
                    <p className="text-[12px] text-ink-mute">{fmt(p.price)} × {qty}</p>
                  </div>
                  {p.is_non_returnable && <Badge tone="error"><Ban size={10} /> на заказ</Badge>}
                  <span className="font-display font-bold text-[14px] text-ink">{fmt(p.price * qty)}</span>
                </div>
              ))}
            </div>
            {hasCustom && (
              <div className="mt-4 bg-error-soft border border-error/25 rounded-[12px] p-4">
                <p className="text-[13px] font-bold text-ink flex items-center gap-2 mb-1.5"><Ban size={15} className="text-error" /> В заказе есть товар, изготовленный по индивидуальным параметрам</p>
                <p className="text-[12.5px] text-ink-soft leading-relaxed">
                  Такой товар <strong className="text-ink">не подлежит возврату</strong> (абз. 4 п. 4 ст. 26.1 ЗоЗПП) — обязательство по возврату несёт продавец-изготовитель, не платформа.
                </p>
                <label className="flex items-start gap-2.5 mt-3 cursor-pointer select-none">
                  <input type="checkbox" checked={customOk} onChange={(e) => setCustomOk(e.target.checked)} className="mt-0.5" />
                  <span className="text-[12.5px] text-ink-soft">Я понимаю, что товар на заказ не возвращается, и принимаю <Link to="/legal/return_policy" className="font-bold text-accent-deep underline">Политику возврата</Link> <span className="text-error">*</span></span>
                </label>
              </div>
            )}
          </section>

          {/* 2. Доставка */}
          <section className="bg-surface rounded-2xl shadow-card p-6">
            <h2 className="font-display font-bold text-[18px] text-ink mb-4 flex items-center gap-2.5"><Truck size={18} className="text-accent-deep" /> Доставка</h2>
            <div className="grid sm:grid-cols-3 gap-2.5 mb-5">
              {DELIVERY_METHODS.map((m) => (
                <button key={m.id} onClick={() => setDeliveryId(m.id)}
                  className={`text-left rounded-[12px] border-2 p-4 transition-all duration-200 cursor-pointer ${deliveryId === m.id ? "border-dark bg-cream" : "border-line hover:border-ink-mute"}`}>
                  <span className="block text-[12px] font-bold uppercase tracking-wide text-ink-mute">{m.carrier}</span>
                  <span className="block font-bold text-[13px] text-ink mt-1 leading-snug">{m.label}</span>
                  <span className="block text-[12.5px] text-ink-soft mt-1.5">{m.days} · {buyerPlan === "premium" ? <span className="text-[#4d7327] font-bold">бесплатно (Премиум)</span> : <strong className="text-ink">{fmt(m.price)}</strong>}</span>
                </button>
              ))}
            </div>
            <p className="text-[12.5px] font-bold text-ink mb-2 flex items-center gap-1.5"><MapPin size={14} className="text-accent-deep" /> Адрес доставки</p>
            <div className="space-y-2">
              {addresses.map((a) => (
                <label key={a.id} className={`flex items-center gap-3 rounded-[12px] border px-4 py-3 cursor-pointer transition-colors ${addressId === a.id ? "border-dark bg-cream" : "border-line hover:border-ink-mute"}`}>
                  <input type="radio" name="addr" checked={addressId === a.id} onChange={() => setAddressId(a.id)} />
                  <span className="text-[13.5px]"><strong className="text-ink">{a.label}:</strong> <span className="text-ink-soft">{a.city}, {a.street}</span></span>
                </label>
              ))}
            </div>
            <Link to="/profile" className="inline-block text-[12.5px] font-bold text-accent-deep underline mt-3">+ добавить адрес в кабинете</Link>
          </section>

          {/* 3. Оплата */}
          <section className="bg-surface rounded-2xl shadow-card p-6">
            <h2 className="font-display font-bold text-[18px] text-ink mb-4 flex items-center gap-2.5"><CreditCard size={18} className="text-accent-deep" /> Оплата</h2>
            <div className="rounded-[12px] border-2 border-dark bg-cream p-4 mb-4">
              <p className="font-bold text-[14px] text-ink">Банковская карта (ЮKassa)</p>
              <p className="text-[12.5px] text-ink-soft mt-1">Visa · Mastercard · Мир. Деньги резервируются на транзитном счёте платформы.</p>
            </div>
            <div className="space-y-3 text-[13px]">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input type="checkbox" checked={escrowOk} onChange={(e) => setEscrowOk(e.target.checked)} className="mt-0.5" />
                <span className="text-ink-soft">Согласен с <Link to="/legal/escrow_rules" className="font-bold text-accent-deep underline">Регламентом «Безопасной сделки»</Link>: продавец получит деньги после отправки товара <span className="text-error">*</span></span>
              </label>
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input type="checkbox" checked={tosOk} onChange={(e) => setTosOk(e.target.checked)} className="mt-0.5" />
                <span className="text-ink-soft">Принимаю <Link to="/legal/buyer_tos" className="font-bold text-accent-deep underline">Оферту</Link>; понимаю, что УютАрт — информационный агрегатор (ст. 12 ЗоЗПП), а продавцом является мастер <span className="text-error">*</span></span>
              </label>
            </div>
          </section>
        </div>

        {/* Итог */}
        <aside className="bg-dark text-cream rounded-2xl p-6 sticky top-24">
          <h2 className="font-display font-bold text-[18px] mb-4">Итого</h2>
          <div className="space-y-2.5 text-[14px]">
            <p className="flex justify-between gap-3"><span className="text-cream/60">Товары</span><span className="font-bold">{fmt(subtotal)}</span></p>
            {tariffDiscount > 0 && (
              <p className="flex justify-between gap-3 text-accent"><span className="flex items-center gap-1.5"><Crown size={13} /> Скидка тарифа {lim.discountPct}%</span><span className="font-bold">−{fmt(tariffDiscount)}</span></p>
            )}
            {promoDiscount > 0 && <p className="flex justify-between gap-3 text-accent"><span>Промокод {promo}</span><span className="font-bold">−{fmt(promoDiscount)}</span></p>}
            {bonusUsed > 0 && <p className="flex justify-between gap-3 text-accent"><span>Бонусы</span><span className="font-bold">−{fmt(bonusUsed)}</span></p>}
            <p className="flex justify-between gap-3"><span className="text-cream/60">Доставка</span><span className="font-bold">{delivery === 0 ? "0 ₽" : fmt(delivery)}</span></p>
            <div className="border-t border-white/15 pt-3 mt-3 flex justify-between items-center">
              <span className="font-bold">К оплате</span>
              <span className="font-display font-extrabold text-[26px] text-accent">{fmt(total)}</span>
            </div>
          </div>

          {/* промокод */}
          <div className="mt-5">
            <div className="flex gap-2">
              <input value={promoInput} onChange={(e) => setPromoInput(e.target.value)} placeholder="Промокод"
                className="flex-1 h-11 rounded-[10px] bg-white/10 border border-white/15 px-3.5 text-[13.5px] text-cream placeholder:text-cream/40 outline-none focus:border-accent" />
              <button onClick={applyPromo} className="h-11 px-4 rounded-[10px] bg-white/10 border border-white/15 text-[13px] font-bold hover:bg-white/20 transition-colors cursor-pointer">OK</button>
            </div>
            {promoErr && <p className="text-[11.5px] text-accent mt-1.5">{promoErr}</p>}
          </div>

          {/* бонусы */}
          {bonusBalance > 0 && (
            <label className="flex items-center justify-between gap-3 mt-4 cursor-pointer select-none">
              <span className="text-[12.5px] text-cream/70">Оплатить бонусами <span className="block text-[11px] text-cream/45">доступно {bonusBalance}, до {fmt(bonusCap)}</span></span>
              <input type="checkbox" checked={useBonuses} onChange={(e) => setUseBonuses(e.target.checked)} className="w-4 h-4 accent-[#D98E32]" />
            </label>
          )}

          <Btn size="lg" className="w-full mt-5" disabled={paying || !escrowOk || !tosOk || (hasCustom && !customOk)} onClick={pay}>
            {paying ? "Обрабатываем платёж…" : `Оплатить ${fmt(total)}`}
          </Btn>
          <p className="text-[11px] text-cream/45 mt-3 text-center flex items-center justify-center gap-1.5"><ShieldCheck size={12} /> ЮKassa · чек по 54-ФЗ придёт на email</p>
        </aside>
      </div>
    </div>
  );
}
