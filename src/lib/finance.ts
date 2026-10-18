import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useAppStore } from "./store";
import { useSellerReg, useSellerAccount } from "./seller";
import { useTariffStore } from "./tariff";
import { useSubStore, currentMonth } from "./subscriptions";

/* ============================================================
   ФИНАНСОВОЕ ЯДРО Quantiform
   Эскроу-модель: деньги покупателя держатся на защищённом счёте
   платформы и выпускаются мастеру в момент «Выдан в ПВЗ СДЭК»
   (мок-webhook по таймеру), либо раньше — при подтверждении покупателя.
   Спор до выдачи замораживает средства.
   ============================================================ */

export type PayoutMethodType = "card" | "sbp" | "yoomoney" | "account";
export const PAYOUT_METHOD_META: Record<PayoutMethodType, { title: string; hint: string; icon: string }> = {
  card: { title: "Карта российского банка", hint: "Мир / Visa RF / Mastercard RF", icon: "💳" },
  sbp: { title: "СБП по номеру телефона", hint: "Любой банк РФ", icon: "📱" },
  yoomoney: { title: "Кошелёк ЮMoney", hint: "Зачисление на кошелёк", icon: "👛" },
  account: { title: "Расчётный счёт самозанятого / ИП", hint: "По реквизитам", icon: "🏦" },
};

export interface PayoutMethod { id: string; type: PayoutMethodType; mask: string; }
export interface LedgerEntry { id: string; ts: string; type: "hold" | "release_seller" | "release_platform" | "release_cdek" | "delivery_subsidy" | "payout_hold" | "payout_paid" | "refund"; amount: number; orderId?: string; comment: string; }
export interface EscrowHold { orderId: string; amount: number; status: "held" | "released" | "refunded" | "frozen"; createdAt: string; releasedAt?: string; trigger?: string; }
export interface DeliveryRec { orderId: string; from: string; to: string; weight: number; cost: number; status: "in_transit" | "at_pvz" | "issued"; atPvzAt: number; issuedAt: number; track: string; subsidy?: number; /* §3.4: субсидия платформы (премиум-доставка) */ }
export interface PayoutReq { id: string; amount: number; methodId: string; status: "processing" | "paid"; createdAt: string; paidAt?: string; }
export interface DisputeRec { orderId: string; reason: string; status: "open" | "resolved_release" | "resolved_refund"; ts: string; }

const FED: [string, string[]][] = [
  ["ЦФО", ["москва", "тула", "тверь", "ярослав", "владимир", "рязань", "калуга", "брянск", "орел", "курск", "воронеж", "липецк", "тамбов", "иваново", "кострома", "смоленск", "белгород"]],
  ["СЗФО", ["санкт-петербург", "псков", "новгород", "калининград", "мурманск", "архангельск", "вологда", "череповец", "сыктывкар", "петрозаводск"]],
  ["ЮФО", ["ростов", "краснодар", "сочи", "волгоград", "астрахань", "майкоп", "элиста", "симферополь", "севастополь", "адлер"]],
  ["СКФО", ["ставрополь", "пятогорск", "кисловодск", "нальчик", "владикавказ", "грозный", "махачкала", "дербент", "черкесск", "ессентуки"]],
  ["ПФО", ["нижний новгород", "казань", "самара", "саратов", "уфа", "пермь", "ульяновск", "киров", "ижевск", "чебоксары", "йошкар-ола", "пенза", "саранск", "оренбург"]],
  ["УФО", ["екатеринбург", "челябинск", "тюмень", "сургут", "курган", "магнитогорск", "нижний тагил", "ханты-мансийск"]],
  ["СФО", ["новосибирск", "омск", "красноярск", "томск", "кемерово", "барнаул", "иркутск", "новокузнецк"]],
  ["ДФО", ["владивосток", "хабаровск", "якутск", "южно-сахалинск", "петропавловск", "магадан", "благовещенск", "чита", "улан-удэ"]],
];
const fedOf = (city: string) => {
  const c = (city || "").toLowerCase();
  for (const [r, list] of FED) if (list.some((w) => c.includes(w))) return r;
  return "";
};

/* Тариф СДЭК: зона маршрута × вес (кг). Production: калькулятор СДЭК API */
export function cdekRate(from: string, to: string, weight: number): number {
  const w = weight <= 1 ? 0 : weight <= 3 ? 1 : weight <= 10 ? 2 : 3;
  if ((from || "").trim() === (to || "").trim()) return 0;
  const a = fedOf(from), b = fedOf(to);
  if (a && a === b) return [350, 450, 650, 900][w];
  return [690, 890, 1290, 1790][w];
}

const uid = (p: string) => p + "-" + Math.random().toString(36).slice(2, 9);

/* ============================================================
   §3.4/Задача 7: БЕСПЛАТНАЯ ДОСТАВКА ПРЕМИУМА
   Не более 2 заказов в месяц по федеральному округу продавца;
   далее — по себестоимости (полный тариф СДЭК). Субсидия
   отражается отдельной проводкой финансового журнала
   с типом "delivery_subsidy".
   ============================================================ */
export const PREMIUM_FREE_DELIVERY_LIMIT = 2;

export function premiumDeliveryForOrder(opts: {
  accountId: string;
  fromCity: string;
  toCity: string;
  weight: number;
}): { price: number; subsidy: number; free: boolean } {
  const full = cdekRate(opts.fromCity, opts.toCity, opts.weight);
  let plan: string = "free";
  try { plan = useSubStore.getState().getBuyerPlan(opts.accountId); } catch { /* noop */ }
  if (plan !== "premium") return { price: full, subsidy: 0, free: false };
  const month = currentMonth();
  const used = useSubStore.getState().premiumFreeDeliveries[month] || 0;
  if (used >= PREMIUM_FREE_DELIVERY_LIMIT) return { price: full, subsidy: 0, free: false };
  return { price: 0, subsidy: full, free: true };
}

interface FinanceState {
  ledger: LedgerEntry[];
  holds: EscrowHold[];
  deliveries: DeliveryRec[];
  payouts: PayoutReq[];
  methods: PayoutMethod[];
  disputes: DisputeRec[];
  tick: () => void;
  addMethod: (type: PayoutMethodType, mask: string) => void;
  removeMethod: (id: string) => void;
  requestPayout: (amount: number, methodId: string) => string | null;
  openDispute: (orderId: string, reason: string) => void;
  resolveDispute: (orderId: string, refund: boolean) => void;
}

export const useFinance = create<FinanceState>()(
  persist(
    (set, get) => ({
      ledger: [], holds: [], deliveries: [], payouts: [], methods: [], disputes: [],

      tick: () => {
        const s = get();
        const orders = useAppStore.getState().orders as any[];
        const reg = useSellerReg.getState() as any;
        const now = Date.now();
        const ledger = [...s.ledger];
        const holds = [...s.holds];
        const deliveries = [...s.deliveries];
        const payouts = [...s.payouts];
        let changed = false;

        const release = (h: EscrowHold, trigger: string) => {
          const acc = useSellerAccount.getState() as any;
          /* §1.1: ставка берётся ШТАТНЫМ вызовом получения тарифа аккаунта
             с сервера (useTariffStore.commissionPercent), а не чтением
             несуществующего поля идентификатора тарифа. Резервные 15% —
             только при полном отсутствии данных о тарифе. */
          let rate = useTariffStore.getState().commissionPercent();
          if (!Number.isFinite(rate)) rate = 15;
          const d = deliveries.find((x) => x.orderId === h.orderId);
          const D = d ? d.cost : 0;
          const K = Math.round((h.amount * rate) / 100);
          const seller = h.amount - D - K;
          h.status = "released";
          h.releasedAt = new Date().toISOString();
          h.trigger = trigger;
          ledger.push({ id: uid("l"), ts: h.releasedAt, type: "release_seller", amount: seller, orderId: h.orderId, comment: "Выплата мастеру (цена − СДЭК − комиссия)" });
          ledger.push({ id: uid("l"), ts: h.releasedAt, type: "release_platform", amount: K, orderId: h.orderId, comment: "Комиссия платформы по тарифу" });
          ledger.push({ id: uid("l"), ts: h.releasedAt, type: "release_cdek", amount: D, orderId: h.orderId, comment: "Стоимость доставки СДЭК" });
          /* §3.4/Задача 7: субсидия бесплатной премиум-доставки — отдельная проводка */
          const sub = d && d.subsidy ? d.subsidy : 0;
          if (sub > 0) {
            ledger.push({ id: uid("l"), ts: h.releasedAt, type: "delivery_subsidy", amount: -sub, orderId: h.orderId, comment: "Субсидия платформы: бесплатная доставка Премиум (2/мес по федеральному округу)" });
          }
          useSellerAccount.setState((st: any) => ({
            transactions: [{ id: uid("t"), date: h.releasedAt, kind: "sale", orderId: h.orderId, productPrice: h.amount, commissionAmount: K, sellerPayout: seller }, ...st.transactions],
          }));
          changed = true;
        };

        for (const o of orders) {
          const mine = (o.items || []).filter((i: any) => String(i.productId).startsWith("sp-"));
          if (!mine.length) continue;
          const amount = mine.reduce((a: number, i: any) => a + (i.price || 0) * (i.qty || 1), 0);
          let hold = holds.find((h) => h.orderId === o.id);
          if (!hold && o.status !== "cancelled") {
            hold = { orderId: o.id, amount, status: "held", createdAt: o.date || new Date().toISOString() };
            holds.push(hold);
            ledger.push({ id: uid("l"), ts: hold.createdAt, type: "hold", amount, orderId: o.id, comment: "Оплата покупателя → защищённый счёт платформы" });
            if (!deliveries.find((d) => d.orderId === o.id)) {
              const weight = mine.reduce((a: number, i: any) => a + (i.qty || 1) * 0.8, 0);
              const to = o.city || (o.address && o.address.city) || "";
              const created = new Date(hold.createdAt).getTime();
              /* §3.4/Задача 7: бесплатная доставка Премиума — до 2 заказов в месяц;
                 cost для продавца остаётся себестоимостью, subsidy — расход платформы */
              const fullCost = cdekRate(reg.city || "", to, weight);
              const cityOf = (s: string) => String(s || "").split(",")[0].trim();
              const prem = premiumDeliveryForOrder({ accountId: useAppStore.getState().session?.userId || "guest", fromCity: reg.city || "", toCity: cityOf(to), weight });
              deliveries.push({ orderId: o.id, from: reg.city || "", to, weight: Math.round(weight * 10) / 10, cost: fullCost, subsidy: prem.free ? prem.subsidy : undefined, status: "in_transit", atPvzAt: created + 4 * 864e5, issuedAt: created + 5 * 864e5, track: "CDEK-" + String(o.id).slice(-6).toUpperCase() });
              if (prem.free) useSubStore.getState().consumePremiumFreeDelivery();
            }
            changed = true;
          }
          if (hold && hold.status === "held") {
            const d = deliveries.find((x) => x.orderId === o.id);
            if (o.status === "received") release(hold, "buyer_confirmed");
            else if (d && now >= d.issuedAt) { d.status = "issued"; release(hold, "cdek_issued"); }
            else if (d && d.status === "in_transit" && now >= d.atPvzAt) { d.status = "at_pvz"; changed = true; }
          }
        }

        for (const p of payouts) {
          if (p.status === "processing" && now >= new Date(p.createdAt).getTime() + 864e5) {
            p.status = "paid";
            p.paidAt = new Date().toISOString();
            ledger.push({ id: uid("l"), ts: p.paidAt, type: "payout_paid", amount: p.amount, comment: "ЮKassa Payout: средства зачислены мастеру" });
            changed = true;
          }
        }

        if (changed) set({ ledger, holds, deliveries, payouts });
      },

      addMethod: (type, mask) => set((s) => ({ methods: [...s.methods, { id: uid("m"), type, mask }] })),
      removeMethod: (id) => set((s) => ({ methods: s.methods.filter((m) => m.id !== id) })),

      requestPayout: (amount, methodId) => {
        const s = get();
        if (!amount || amount < 100) return "Минимальная сумма вывода — 100 ₽";
        const available = selectAvailable(s);
        if (amount > available) return "Недостаточно доступных средств";
        const m = s.methods.find((x) => x.id === methodId);
        if (!m) return "Добавьте способ вывода";
        const nowIso = new Date().toISOString();
        set({
          payouts: [{ id: uid("p"), amount, methodId, status: "processing", createdAt: nowIso }, ...s.payouts],
          ledger: [{ id: uid("l"), ts: nowIso, type: "payout_hold" as const, amount, comment: "Заявка на вывод → обработка ЮKassa" }, ...s.ledger],
        });
        return null;
      },

      openDispute: (orderId, reason) => set((s) => ({
        disputes: [{ orderId, reason, status: "open", ts: new Date().toISOString() }, ...s.disputes],
        holds: s.holds.map((h) => (h.orderId === orderId && h.status === "held" ? { ...h, status: "frozen" as const } : h)),
      })),

      resolveDispute: (orderId, refund) => set((s) => {
        const holds = s.holds.map((h) => {
          if (h.orderId !== orderId || h.status !== "frozen") return h;
          if (refund) return { ...h, status: "refunded" as const, releasedAt: new Date().toISOString(), trigger: "dispute_refund" };
          return { ...h, status: "released" as const, releasedAt: new Date().toISOString(), trigger: "dispute_release" };
        });
        const h = s.holds.find((x) => x.orderId === orderId);
        const ledger = h && refund
          ? [{ id: uid("l"), ts: new Date().toISOString(), type: "refund" as const, amount: h.amount, orderId, comment: "Возврат покупателю по спору" }, ...s.ledger]
          : s.ledger;
        return { holds, ledger, disputes: s.disputes.map((d) => (d.orderId === orderId && d.status === "open" ? { ...d, status: refund ? ("resolved_refund" as const) : ("resolved_release" as const) } : d)) };
      }),
    }),
    { name: "uyutart-finance-v1" }
  )
);

export const selectAvailable = (f: FinanceState) =>
  f.ledger.filter((e) => e.type === "release_seller").reduce((a, e) => a + e.amount, 0) -
  f.ledger.filter((e) => e.type === "payout_hold").reduce((a, e) => a + e.amount, 0);
export const selectHeld = (f: FinanceState) =>
  f.holds.filter((h) => h.status === "held" || h.status === "frozen").reduce((a, h) => a + h.amount, 0);
export const selectInTransit = (f: FinanceState) =>
  f.payouts.filter((p) => p.status === "processing").reduce((a, p) => a + p.amount, 0);
