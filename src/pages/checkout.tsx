import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Trash2, Minus, Plus, ShoppingBag, ShieldCheck, CreditCard, Smartphone, Wallet, CheckCircle2 } from "lucide-react";
import { PRODUCTS, fmt, productById, legalDoc } from "../data/seed";
import { useAppStore } from "../lib/store";
import { useSubStore, buyerLimits } from "../lib/subscriptions";
import { Badge, Btn, ProductImg, Field } from "../components/ui";

const DELIVERY = [
  { id: "sdek", label: "СДЭК до пункта выдачи", price: 350, days: "2–5 дней" },
  { id: "sdek-courier", label: "СДЭК курьером", price: 500, days: "1–3 дня" },
  { id: "post", label: "Почта России", price: 200, days: "5–14 дней" },
  { id: "boxberry", label: "Boxberry", price: 300, days: "3–7 дней" },
];

export function CartPage() {
  const cart = useAppStore((s) => s.cart);
  const setQty = useAppStore((s) => s.setQty);
  const removeFromCart = useAppStore((s) => s.removeFromCart);
  const bonusBalance = useAppStore((s) => s.bonusBalance);
  const buyerPlan = useSubStore((s) => s.buyerPlan);
  const lim = buyerLimits(buyerPlan);

  const rows = cart.map((c) => ({ ...c, p: productById(c.productId) })).filter((r) => r.p);
  const subtotal = rows.reduce((s, r) => s + (r.p!.price * r.qty), 0);
  const discount = Math.round((subtotal * lim.discountPct) / 100);
  const hasCustom = rows.some((r) => r.p!.is_non_returnable);

  if (rows.length === 0) {
    return (
      <div className="max-w-[700px] mx-auto px-4 py-24 text-center">
        <p className="text-[56px] mb-3">🛒</p>
        <h1 className="font-display font-bold text-[28px] text-ink mb-2">Корзина пуста</h1>
        <p className="text-[14px] text-ink-soft mb-7">Добавьте что-нибудь из каталога.</p>
        <Link to="/catalog" className="inline-flex items-center justify-center h-[52px] px-7 rounded-[10px] bg-dark text-cream text-[15px] font-semibold hover:bg-dark-deep transition-colors">В каталог</Link>
      </div>
    );
  }

  return (
    <div className="max-w-[980px] mx-auto px-4 sm:px-6 py-10">
      <h1 className="font-display font-bold text-[clamp(26px,3vw,34px)] text-ink mb-7">Корзина</h1>
      <div className="space-y-3.5">
        {rows.map((r) => (
          <div key={r.productId} className="bg-surface rounded-2xl shadow-card p-4 flex items-center gap-4">
            <Link to={`/product/${r.p!.slug}`} className="w-[84px] h-[72px] rounded-[10px] overflow-hidden shrink-0 group">
              <ProductImg p={r.p!} />
            </Link>
            <div className="flex-1 min-w-0">
              <Link to={`/product/${r.p!.slug}`} className="text-[14px] font-semibold text-ink hover:text-accent-deep transition-colors line-clamp-1">{r.p!.name}</Link>
              <p className="text-[12px] text-ink-mute mt-0.5">{fmt(r.p!.price)}</p>
              {r.p!.is_non_returnable && <Badge tone="error" className="mt-1.5">На заказ · без возврата</Badge>}
            </div>
            <div className="flex items-center border border-line rounded-[10px] bg-surface overflow-hidden shrink-0">
              <button onClick={() => setQty(r.productId, r.qty - 1)} aria-label="Меньше" className="w-10 h-10 flex items-center justify-center text-ink-soft hover:bg-line-soft cursor-pointer transition-colors"><Minus size={14} /></button>
              <span className="w-9 text-center font-bold text-[14px] text-ink">{r.qty}</span>
              <button onClick={() => setQty(r.productId, r.qty + 1)} aria-label="Больше" className="w-10 h-10 flex items-center justify-center text-ink-soft hover:bg-line-soft cursor-pointer transition-colors"><Plus size={14} /></button>
            </div>
            <span className="font-display font-bold text-[16px] text-ink w-[90px] text-right shrink-0">{fmt(r.p!.price * r.qty)}</span>
            <button onClick={() => removeFromCart(r.productId)} aria-label="Удалить" className="w-10 h-10 rounded-[10px] flex items-center justify-center text-ink-mute hover:text-error hover:bg-error-soft cursor-pointer transition-colors shrink-0"><Trash2 size={16} /></button>
          </div>
        ))}
      </div>

      <div className="mt-7 bg-surface rounded-2xl shadow-card p-6 max-w-[420px] ml-auto">
        {lim.discountPct > 0 && discount > 0 && (
          <p className="flex justify-between text-[13.5px] mb-2 text-[#4d7327] font-semibold">
            <span>Скидка тарифа {lim.discountPct}%</span><span>−{fmt(discount)}</span>
          </p>
        )}
        <p className="flex justify-between text-[14px] mb-1"><span className="text-ink-soft">Товары</span><span className="font-bold">{fmt(subtotal)}</span></p>
        <div className="border-t border-line-soft pt-3 mt-3 flex justify-between items-center">
          <span className="font-bold">Итого</span>
          <span className="font-display font-extrabold text-[26px] text-ink">{fmt(subtotal - discount)}</span>
        </div>
        {bonusBalance > 0 && <p className="text-[12px] text-ink-mute mt-2">Доступно {bonusBalance} бонусов — можно списать при оплате</p>}
        {hasCustom && (
          <p className="text-[12px] text-error font-semibold mt-3">В корзине есть товар на заказ — он не подлежит возврату.</p>
        )}
        <Link to="/checkout" className="mt-4 w-full h-[52px] rounded-[10px] bg-accent text-ink font-semibold hover:bg-accent-deep hover:text-cream transition-colors flex items-center justify-center gap-2">
          <ShoppingBag size={18} /> Оформить заказ
        </Link>
      </div>
    </div>
  );
}

/* ============================================================
   Одностраничный чекаут: адрес + доставка + оплата + юр. согласия
   ============================================================ */
export function CheckoutPage() {
  const cart = useAppStore((s) => s.cart);
  const addresses = useAppStore((s) => s.addresses);
  const placeOrder = useAppStore((s) => s.placeOrder);
  const clearCart = useAppStore((s) => s.clearCart);
  const bonusBalance = useAppStore((s) => s.bonusBalance);
  const addBonus = useAppStore((s) => s.addBonus);
  const buyerPlan = useSubStore((s) => s.buyerPlan);
  const lim = buyerLimits(buyerPlan);
  const nav = useNavigate();

  const [addrId, setAddrId] = useState(addresses[0]?.id || "");
  const [deliveryId, setDeliveryId] = useState(DELIVERY[0].id);
  const [pay, setPay] = useState("card");
  const [useBonuses, setUseBonuses] = useState(false);
  const [agreeTos, setAgreeTos] = useState(false);
  const [agreeEscrow, setAgreeEscrow] = useState(false);
  const [agreeCustom, setAgreeCustom] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<string | null>(null);

  const rows = cart.map((c) => ({ ...c, p: productById(c.productId) })).filter((r) => r.p);
  const subtotal = rows.reduce((s, r) => s + (r.p!.price * r.qty), 0);
  const discount = Math.round((subtotal * lim.discountPct) / 100);
  const delivery = DELIVERY.find((d) => d.id === deliveryId)!;
  const bonusDiscount = useBonuses ? Math.min(bonusBalance, Math.round((subtotal - discount) * 0.3)) : 0;
  const total = subtotal - discount + delivery.price - bonusDiscount;
  const hasCustom = rows.some((r) => r.p!.is_non_returnable);
  const addr = addresses.find((a) => a.id === addrId);

  const submit = () => {
    if (!addr) { setErr("Выберите адрес доставки."); return; }
    if (!agreeTos || !agreeEscrow) { setErr("Примите Оферту и Регламент безопасной сделки."); return; }
    if (hasCustom && !agreeCustom) { setErr("Подтвердите, что товар на заказ не подлежит возврату."); return; }
    const order = placeOrder({
      items: rows.map((r) => ({ productId: r.productId, qty: r.qty, price: r.p!.price })),
      total,
      delivery: delivery.price,
      deliveryMethod: delivery.label,
      address: `${addr.city}, ${addr.street}`,
      hasCustom,
      payMethod: pay === "card" ? "Банковская карта (ЮKassa)" : pay === "sbp" ? "СБП" : "Электронный кошелёк",
    });
    if (bonusDiscount > 0) addBonus(-bonusDiscount, "Списание бонусов при оплате");
    addBonus(50, "Кэшбэк за заказ");
    clearCart();
    setDone(order.number);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (done) {
    return (
      <div className="max-w-[640px] mx-auto px-4 py-24 text-center fade-up">
        <span className="inline-flex w-20 h-20 rounded-full bg-success-soft text-success items-center justify-center mb-6"><CheckCircle2 size={42} /></span>
        <h1 className="font-display font-bold text-[30px] text-ink mb-3">Заказ {done} оформлен</h1>
        <p className="text-[14.5px] text-ink-soft leading-relaxed max-w-md mx-auto mb-8">
          Деньги зарезервированы на транзитном счёте (безопасная сделка). Мастер получит их после отправки.
          Чек по 54-ФЗ придёт на email.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Link to="/profile" className="h-[52px] px-7 rounded-[10px] bg-dark text-cream text-[15px] font-semibold hover:bg-dark-deep transition-colors flex items-center">Мои заказы</Link>
          <Link to="/catalog" className="h-[52px] px-7 rounded-[10px] border border-line bg-surface text-[15px] font-semibold hover:bg-cream transition-colors flex items-center">В каталог</Link>
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="max-w-[700px] mx-auto px-4 py-24 text-center">
        <p className="text-[56px] mb-3">🛒</p>
        <h1 className="font-display font-bold text-[28px] text-ink mb-2">Оформлять пока нечего</h1>
        <Link to="/catalog" className="text-[14px] font-bold text-accent-deep hover:text-accent transition-colors">В каталог →</Link>
      </div>
    );
  }

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-10">
      <h1 className="font-display font-bold text-[clamp(26px,3vw,34px)] text-ink mb-7">Оформление заказа</h1>
      <div className="grid lg:grid-cols-[1fr_380px] gap-8 items-start">
        <div className="space-y-6">
          {/* адрес */}
          <div className="bg-surface rounded-2xl shadow-card p-6">
            <h2 className="font-display font-bold text-[18px] text-ink mb-4">1. Адрес доставки</h2>
            <div className="space-y-2.5">
              {addresses.map((a) => (
                <label key={a.id} className={`flex items-center gap-3 border rounded-[10px] px-4 py-3 cursor-pointer transition-colors ${addrId === a.id ? "border-dark bg-cream" : "border-line hover:border-ink-mute"}`}>
                  <input type="radio" name="addr" checked={addrId === a.id} onChange={() => setAddrId(a.id)} />
                  <span className="flex-1">
                    <span className="block text-[13.5px] font-semibold text-ink">{a.label}</span>
                    <span className="block text-[12px] text-ink-mute">{a.city}, {a.street} · {a.zip}</span>
                  </span>
                </label>
              ))}
            </div>
            <Link to="/profile" className="inline-block mt-3 text-[13px] font-bold text-accent-deep hover:text-accent underline">Добавить адрес</Link>
          </div>

          {/* доставка */}
          <div className="bg-surface rounded-2xl shadow-card p-6">
            <h2 className="font-display font-bold text-[18px] text-ink mb-4">2. Способ доставки</h2>
            <div className="grid sm:grid-cols-2 gap-2.5">
              {DELIVERY.map((d) => (
                <label key={d.id} className={`flex items-center justify-between gap-3 border rounded-[10px] px-4 py-3 cursor-pointer transition-colors ${deliveryId === d.id ? "border-dark bg-cream" : "border-line hover:border-ink-mute"}`}>
                  <span className="flex items-center gap-2.5">
                    <input type="radio" name="delivery" checked={deliveryId === d.id} onChange={() => setDeliveryId(d.id)} />
                    <span>
                      <span className="block text-[13px] font-semibold text-ink">{d.label}</span>
                      <span className="block text-[11.5px] text-ink-mute">{d.days}</span>
                    </span>
                  </span>
                  <span className="font-display font-bold text-[14px] text-ink">{fmt(d.price)}</span>
                </label>
              ))}
            </div>
          </div>

          {/* оплата */}
          <div className="bg-surface rounded-2xl shadow-card p-6">
            <h2 className="font-display font-bold text-[18px] text-ink mb-4">3. Оплата</h2>
            <div className="grid sm:grid-cols-3 gap-2.5">
              {([["card", "Карта (ЮKassa)", CreditCard], ["sbp", "СБП", Smartphone], ["wallet", "Кошелёк", Wallet]] as const).map(([id, label, Ic]) => (
                <label key={id} className={`flex items-center gap-2.5 border rounded-[10px] px-4 py-3 cursor-pointer transition-colors ${pay === id ? "border-dark bg-cream" : "border-line hover:border-ink-mute"}`}>
                  <input type="radio" name="pay" checked={pay === id} onChange={() => setPay(id)} />
                  <Ic size={17} className="text-accent-deep" />
                  <span className="text-[13px] font-semibold text-ink">{label}</span>
                </label>
              ))}
            </div>
            <p className="flex items-center gap-2 text-[12px] text-ink-mute mt-4"><ShieldCheck size={14} className="text-success" /> Безопасная сделка: деньги уходят мастеру только после отправки.</p>
          </div>

          {/* юр. согласия */}
          <div className="bg-surface rounded-2xl shadow-card p-6 space-y-3">
            <h2 className="font-display font-bold text-[18px] text-ink mb-2">4. Согласия</h2>
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input type="checkbox" checked={agreeTos} onChange={(e) => setAgreeTos(e.target.checked)} className="mt-0.5" />
              <span className="text-[13px] text-ink-soft leading-relaxed">Принимаю условия <Link to="/legal/buyer_tos" className="font-bold text-accent-deep underline">Оферты</Link> и <Link to="/legal/privacy" className="font-bold text-accent-deep underline">Политики конфиденциальности</Link> <span className="text-error">*</span></span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input type="checkbox" checked={agreeEscrow} onChange={(e) => setAgreeEscrow(e.target.checked)} className="mt-0.5" />
              <span className="text-[13px] text-ink-soft leading-relaxed">Принимаю <Link to="/legal/escrow_rules" className="font-bold text-accent-deep underline">Регламент «Безопасной сделки»</Link> <span className="text-error">*</span></span>
            </label>
            {hasCustom && (
              <div className="bg-error-soft border border-error/30 rounded-[10px] px-4 py-3 fade-up">
                <p className="text-[12.5px] text-ink font-semibold mb-2">В заказе есть товар на заказ (custom-made). Он изготавливается по индивидуальным параметрам и возврату не подлежит (абз. 4 п. 4 ст. 26.1 ЗоЗПП).</p>
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input type="checkbox" checked={agreeCustom} onChange={(e) => setAgreeCustom(e.target.checked)} className="mt-0.5" />
                  <span className="text-[13px] text-ink font-bold">Понимаю, что товар на заказ не подлежит возврату <span className="text-error">*</span></span>
                </label>
              </div>
            )}
          </div>
        </div>

        {/* итог */}
        <aside className="bg-surface rounded-2xl shadow-card p-6 sticky top-24">
          <h2 className="font-display font-bold text-[18px] text-ink mb-4">Ваш заказ</h2>
          <div className="space-y-2.5 text-[14px]">
            {rows.map((r) => (
              <p key={r.productId} className="flex justify-between gap-3 text-[13px]">
                <span className="text-ink-soft line-clamp-1">{r.p!.name} × {r.qty}</span>
                <span className="font-bold shrink-0">{fmt(r.p!.price * r.qty)}</span>
              </p>
            ))}
            <div className="border-t border-line-soft pt-3 mt-3 space-y-1.5">
              {discount > 0 && <p className="flex justify-between text-[#4d7327] font-semibold text-[13px]"><span>Скидка тарифа {lim.discountPct}%</span><span>−{fmt(discount)}</span></p>}
              <p className="flex justify-between"><span className="text-ink-soft">Доставка</span><span className="font-bold">{fmt(delivery.price)}</span></p>
              {bonusDiscount > 0 && <p className="flex justify-between text-[#4d7327] font-semibold text-[13px]"><span>Бонусы</span><span>−{fmt(bonusDiscount)}</span></p>}
            </div>
            <div className="border-t border-line-soft pt-3 mt-3 flex justify-between items-center">
              <span className="font-bold">Итого</span>
              <span className="font-display font-extrabold text-[26px] text-ink">{fmt(total)}</span>
            </div>
          </div>
          {bonusBalance > 0 && (
            <label className="flex items-center justify-between mt-4 cursor-pointer select-none">
              <span className="text-[12.5px] font-semibold text-ink-soft">Списать бонусы ({bonusBalance})</span>
              <input type="checkbox" checked={useBonuses} onChange={(e) => setUseBonuses(e.target.checked)} />
            </label>
          )}
          {err && <p className="text-[12.5px] font-semibold text-error mt-3">{err}</p>}
          <Btn size="lg" className="w-full mt-4" onClick={submit}><CreditCard size={18} /> Оплатить {fmt(total)}</Btn>
          <p className="text-[11px] text-ink-mute text-center mt-3">Чеки по 54-ФЗ · возврат 7 дней (кроме custom-made)</p>
        </aside>
      </div>
    </div>
  );
}
