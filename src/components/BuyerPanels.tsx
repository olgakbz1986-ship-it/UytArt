/* ============================================================================
   Переиспользуемые панели покупателя (общие для кабинета покупателя и продавца).

   Вынесены из profile.tsx, чтобы избежать циклического импорта
   profile.tsx <-> extras.tsx: раньше extras тянул панели из profile,
   а profile — useMarketStore из extras. Теперь обе страницы тянут
   панели отсюда, а MarketStore живёт в src/lib/market.ts.
   ========================================================================== */
import { useState } from "react";
import { Link } from "react-router-dom";
import { Heart, MapPin, Trash2, Flag } from "lucide-react";
import { fmt, fmtDate, productById } from "../data/seed";
import { useAppStore } from "../lib/store";
import { useComplaintStore } from "../lib/complaint";
import { useMarketProducts } from "../lib/market";
import { Badge, Field, Btn, ProductImg } from "./ui";
import { BuyerPremiumSection } from "./PremiumBlocks";

/* ------------------------------------------------------------------ */
/* ИЗБРАННОЕ                                                          */
/* ------------------------------------------------------------------ */
export function BuyerFavoritesPanel() {
  const favorites = useAppStore((s) => s.favorites);
  const toggleFav = useAppStore((s) => s.toggleFav);
  const market = useMarketProducts();

  const favProducts = favorites
    .map((id) => {
      /* сначала динамические товары (опубликованные пользователями), затем seed */
      const dynamic = (market as any[]).find((p) => p.id === id);
      return dynamic || productById(id);
    })
    .filter(Boolean) as any[];

  return (
    <div className="fade-up">
      {favProducts.length === 0 ? (
        <div className="bg-surface rounded-2xl shadow-card px-8 py-16 text-center">
          <p className="text-[44px] mb-3">💛</p>
          <p className="font-display font-bold text-[19px] text-ink mb-2">В избранном пусто</p>
          <p className="text-[13.5px] text-ink-soft">Нажимайте на сердечко в карточке товара.</p>
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
  );
}

/* ------------------------------------------------------------------ */
/* АДРЕСА                                                             */
/* ------------------------------------------------------------------ */
export function BuyerAddressesPanel() {
  const addresses = useAppStore((s) => s.addresses);
  const addAddress = useAppStore((s) => s.addAddress);
  const removeAddress = useAppStore((s) => s.removeAddress);
  const [addr, setAddr] = useState({ label: "Дом", city: "", street: "", zip: "" });

  return (
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
          <Field label="Название"><input className="field" value={addr.label} onChange={(e) => setAddr({ ...addr, label: e.target.value })} placeholder="Дом / Работа / Дача" autoComplete="off" /></Field>
          <Field label="Город"><input className="field" value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} placeholder="Москва" autoComplete="address-level2" /></Field>
          <Field label="Улица, дом"><input className="field" value={addr.street} onChange={(e) => setAddr({ ...addr, street: e.target.value })} placeholder="ул. Пятницкая, 18" autoComplete="street-address" /></Field>
          <Field label="Индекс" hint="6 цифр"><input className="field" inputMode="numeric" autoComplete="postal-code" value={addr.zip} onChange={(e) => setAddr({ ...addr, zip: e.target.value.replace(/\D/g, "").slice(0, 6) })} placeholder="115035" /></Field>
          <Btn className="w-full" disabled={!addr.city.trim() || !addr.street.trim() || addr.zip.length !== 6} onClick={() => { addAddress(addr); setAddr({ label: "Дом", city: "", street: "", zip: "" }); }}>Сохранить адрес</Btn>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* БОНУСЫ                                                             */
/* ------------------------------------------------------------------ */
export function BuyerBonusPanel() {
  const bonusBalance = useAppStore((s) => s.bonusBalance);
  const bonusHistory = useAppStore((s) => s.bonusHistory);

  return (
    <div className="space-y-6 fade-up">
      <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
        <div className="bg-surface rounded-2xl shadow-card p-6">
          <h2 className="font-display font-bold text-[18px] text-ink mb-4">История начислений</h2>
          <div className="space-y-2.5">
            {bonusHistory.map((b) => (
              <div key={b.id} className="flex items-center justify-between border-b border-line-soft pb-2.5 last:border-0">
                <div>
                  <p className="text-[13.5px] font-semibold text-ink">{b.reason}{b.sellerName ? ` · ${b.sellerName}` : ""}</p>
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
      {/* §5.1: премиум-функции покупателя — закрытые распродажи, цифровой куратор */}
      <BuyerPremiumSection />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ЖАЛОБЫ                                                             */
/* ------------------------------------------------------------------ */
export function BuyerComplaintsPanel() {
  const complaints = useComplaintStore((s) => s.complaints);

  return (
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
              <p className="font-bold text-[14.5px] text-ink flex items-center gap-2"><Flag size={14} className="text-honey" /> Жалоба на «{c.vendorName}»</p>
              <Badge tone={c.status === "resolved" ? "success" : "honey"}>{c.status === "resolved" ? "Решено" : "На рассмотрении"}</Badge>
            </div>
            <p className="text-[12.5px] text-ink-mute">{c.category} · {fmtDate(c.createdAt)}</p>
            <p className="text-[13.5px] text-ink-soft mt-2">{c.description}</p>
          </div>
        ))
      )}
    </div>
  );
}


