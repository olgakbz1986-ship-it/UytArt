import { useMemo, useState } from "react";
import { Check, Clock, Home, Mail, MapPin, Search, Truck } from "lucide-react";
import { fmt } from "../data/seed";

export type DeliveryMethod = "pvz" | "courier" | "post";

export interface DeliveryPoint {
  id: string;
  kind: "pvz" | "post";
  carrier: string;
  name: string;
  address: string;
  city: string;
  metro?: string;
  hours: string;
  distanceKm: number;
  tags: string[];
  zip?: string;
}

export interface DeliverySelection {
  method: DeliveryMethod;
  deliveryId: string;
  label: string;
  price: number;
  days: string;
  carrier: string;
  point: DeliveryPoint | null;
  slot?: string;
}

const PVZ: DeliveryPoint[] = [
  { id: "cdek-msk-001", kind: "pvz", carrier: "СДЭК", name: "СДЭК · Тверская", address: "ул. Тверская, 12, стр. 1", city: "Москва", metro: "Тверская", hours: "09:00–21:00", distanceKm: 1.2, tags: ["Примерка", "Оплата картой"] },
  { id: "cdek-msk-002", kind: "pvz", carrier: "СДЭК", name: "СДЭК · Арбат", address: "ул. Новый Арбат, 21", city: "Москва", metro: "Арбатская", hours: "круглосуточно", distanceKm: 2.4, tags: ["24/7", "Постамат"] },
  { id: "cdek-msk-003", kind: "pvz", carrier: "СДЭК", name: "СДЭК · Сокол", address: "Ленинградский пр-т, 74", city: "Москва", metro: "Сокол", hours: "10:00–20:00", distanceKm: 4.8, tags: ["Примерка"] },
  { id: "box-msk-001", kind: "pvz", carrier: "Boxberry", name: "Boxberry · Киевская", address: "ул. Брянская, 2", city: "Москва", metro: "Киевская", hours: "09:00–21:00", distanceKm: 3.1, tags: ["Примерка", "Оплата картой"] },
  { id: "box-msk-002", kind: "pvz", carrier: "Boxberry", name: "Boxberry · ВДНХ", address: "пр-т Мира, 119", city: "Москва", metro: "ВДНХ", hours: "10:00–22:00", distanceKm: 6.2, tags: ["Постамат"] },
  { id: "cdek-spb-001", kind: "pvz", carrier: "СДЭК", name: "СДЭК · Невский", address: "Невский пр-т, 88", city: "Санкт-Петербург", metro: "Площадь Восстания", hours: "09:00–21:00", distanceKm: 1.5, tags: ["Примерка"] },
  { id: "cdek-spb-002", kind: "pvz", carrier: "СДЭК", name: "СДЭК · Петроградская", address: "ул. Большая Пушкарская, 47", city: "Санкт-Петербург", metro: "Петроградская", hours: "10:00–20:00", distanceKm: 3.7, tags: ["Оплата картой"] },
  { id: "cdek-ekb-001", kind: "pvz", carrier: "СДЭК", name: "СДЭК · Центр", address: "ул. Малышева, 51", city: "Екатеринбург", metro: "Площадь 1905 года", hours: "09:00–20:00", distanceKm: 0.9, tags: ["Примерка", "24/7"] },
  { id: "cdek-kzn-001", kind: "pvz", carrier: "СДЭК", name: "СДЭК · Кремлёвская", address: "ул. Баумана, 44", city: "Казань", metro: "Кремлёвская", hours: "10:00–21:00", distanceKm: 1.1, tags: ["Оплата картой"] },
];

const POST: DeliveryPoint[] = [
  { id: "post-msk-101000", kind: "post", carrier: "Почта России", name: "Отделение 101000", address: "ул. Мясницкая, 26", city: "Москва", hours: "08:00–20:00", distanceKm: 2.0, tags: ["Индекс 101000"], zip: "101000" },
  { id: "post-msk-119019", kind: "post", carrier: "Почта России", name: "Отделение 119019", address: "ул. Новый Арбат, 15", city: "Москва", hours: "09:00–21:00", distanceKm: 2.8, tags: ["Индекс 119019"], zip: "119019" },
  { id: "post-spb-190000", kind: "post", carrier: "Почта России", name: "Отделение 190000", address: "Почтамтская ул., 3", city: "Санкт-Петербург", hours: "08:00–20:00", distanceKm: 2.2, tags: ["Индекс 190000"], zip: "190000" },
  { id: "post-spb-197101", kind: "post", carrier: "Почта России", name: "Отделение 197101", address: "Каменноостровский пр-т, 20", city: "Санкт-Петербург", hours: "09:00–19:00", distanceKm: 4.1, tags: ["Индекс 197101"], zip: "197101" },
  { id: "post-ekb-620014", kind: "post", carrier: "Почта России", name: "Отделение 620014", address: "пр-т Ленина, 24", city: "Екатеринбург", hours: "08:00–20:00", distanceKm: 1.4, tags: ["Индекс 620014"], zip: "620014" },
  { id: "post-kzn-420111", kind: "post", carrier: "Почта России", name: "Отделение 420111", address: "ул. Кремлёвская, 1", city: "Казань", hours: "08:00–19:00", distanceKm: 1.0, tags: ["Индекс 420111"], zip: "420111" },
];

const SLOTS = ["10:00–14:00", "14:00–18:00", "18:00–22:00"];

const METHODS: { method: DeliveryMethod; title: string; sub: string; price: number; days: string; Icon: typeof MapPin; hint: string }[] = [
  { method: "pvz", title: "Пункт выдачи", sub: "СДЭК / Boxberry", price: 350, days: "2–5 дней", Icon: MapPin, hint: "Заберите заказ рядом с домом" },
  { method: "courier", title: "Курьером", sub: "До двери", price: 500, days: "1–3 дня", Icon: Home, hint: "Привезём в удобное время" },
  { method: "post", title: "Отделение почты", sub: "Почта России", price: 200, days: "5–14 дней", Icon: Mail, hint: "Доставка по всей России" },
];

const PVZ_CARRIERS = [
  { carrier: "СДЭК", deliveryId: "sdek", price: 350, days: "2–5 дней" },
  { carrier: "Boxberry", deliveryId: "boxberry", price: 300, days: "3–7 дней" },
];

interface Props {
  value: DeliverySelection;
  onChange: (s: DeliverySelection) => void;
  city?: string;
  address?: string;
}

export function DeliveryPicker({ value, onChange, city, address }: Props) {
  const [query, setQuery] = useState("");
  const [carrier, setCarrier] = useState(value.carrier || "СДЭК");
  const [slot, setSlot] = useState(value.slot || SLOTS[1]);

  const points = useMemo(() => {
    const source = value.method === "post" ? POST : PVZ.filter((p) => p.carrier === carrier);
    const q = query.trim().toLowerCase();
    const inCity = source.filter((p) => !city || p.city.toLowerCase().includes(city.toLowerCase()));
    const base = inCity.length ? inCity : source;
    return base
      .filter((p) => !q || [p.name, p.address, p.city, p.metro, p.zip].filter(Boolean).join(" ").toLowerCase().includes(q))
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [value.method, carrier, query, city]);

  const pickMethod = (m: typeof METHODS[number]) => {
    if (m.method === "pvz") {
      const c = PVZ_CARRIERS.find((x) => x.carrier === carrier) || PVZ_CARRIERS[0];
      onChange({ method: "pvz", deliveryId: c.deliveryId, label: c.carrier + " до пункта выдачи", price: c.price, days: c.days, carrier: c.carrier, point: null });
    } else if (m.method === "courier") {
      onChange({ method: "courier", deliveryId: "sdek-courier", label: "СДЭК курьером", price: 500, days: "1–3 дня", carrier: "СДЭК", point: null, slot });
    } else {
      onChange({ method: "post", deliveryId: "post", label: "Почта России", price: 200, days: "5–14 дней", carrier: "Почта России", point: null });
    }
    setQuery("");
  };

  const pickCarrier = (c: typeof PVZ_CARRIERS[number]) => {
    setCarrier(c.carrier);
    onChange({ method: "pvz", deliveryId: c.deliveryId, label: c.carrier + " до пункта выдачи", price: c.price, days: c.days, carrier: c.carrier, point: null });
    setQuery("");
  };

  const pickPoint = (p: DeliveryPoint) => onChange({ ...value, point: p });
  const pickSlot = (s: string) => { setSlot(s); onChange({ ...value, slot: s }); };

  const summary = value.point
    ? value.point.name + " · " + value.point.address
    : value.method === "courier"
      ? (address || "Адрес из профиля") + " · " + slot
      : "Выберите " + (value.method === "post" ? "отделение почты" : "пункт выдачи");

  return (
    <div className="bg-surface rounded-2xl shadow-card p-6">
      <style>{".qf-pvz-scroll::-webkit-scrollbar{width:8px}.qf-pvz-scroll::-webkit-scrollbar-track{background:var(--color-cream)}.qf-pvz-scroll::-webkit-scrollbar-thumb{background:var(--color-dark);border-radius:4px}.qf-pvz-scroll::-webkit-scrollbar-thumb:hover{background:var(--color-accent-deep)}"}</style>

      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="font-display font-bold text-[18px] text-ink">2. Способ доставки</h2>
          <p className="text-[12px] text-ink-mute mt-0.5">Стоимость и срок видны сразу — без сюрпризов при оплате</p>
        </div>
        <span className="hidden sm:flex items-center gap-1.5 text-[11px] font-bold text-accent-deep bg-accent/10 px-2.5 py-1 rounded-full"><Truck size={12} /> Единый интерфейс</span>
      </div>

      <div className="grid sm:grid-cols-3 gap-2.5">
        {METHODS.map((m) => {
          const active = value.method === m.method;
          const price = m.method === "pvz" ? (PVZ_CARRIERS.find((c) => c.carrier === carrier)?.price ?? m.price) : m.price;
          return (
            <button key={m.method} type="button" onClick={() => pickMethod(m)}
              className={"relative text-left rounded-xl border p-4 transition-all cursor-pointer " + (active ? "border-dark bg-cream shadow-card" : "border-line bg-surface hover:border-ink-mute hover:-translate-y-0.5")}>
              {active && <span className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-dark text-cream flex items-center justify-center"><Check size={12} /></span>}
              <m.Icon size={18} className={active ? "text-accent-deep" : "text-ink-mute"} />
              <span className="block font-bold text-[13.5px] text-ink mt-2">{m.title}</span>
              <span className="block text-[11px] text-ink-mute">{m.sub}</span>
              <span className="block font-display font-bold text-[17px] text-ink mt-2">{fmt(price)}</span>
              <span className="block text-[11px] text-ink-mute">{m.days}</span>
              <span className="block text-[11px] text-ink-soft mt-1.5 leading-snug">{m.hint}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 rounded-xl border border-line bg-cream/40 p-4">
        {value.method === "pvz" && (
          <div className="flex flex-wrap gap-2 mb-3">
            {PVZ_CARRIERS.map((c) => (
              <button key={c.carrier} type="button" onClick={() => pickCarrier(c)}
                className={"px-3 py-1.5 rounded-full text-[12px] font-bold border transition-colors cursor-pointer " + (carrier === c.carrier ? "bg-dark text-cream border-dark" : "bg-surface text-ink-soft border-line hover:border-dark")}>
                {c.carrier} · {fmt(c.price)}
              </button>
            ))}
          </div>
        )}

        {value.method === "courier" ? (
          <div>
            <p className="text-[12px] font-bold text-ink mb-2">Интервал доставки</p>
            <div className="flex flex-wrap gap-2">
              {SLOTS.map((s) => (
                <button key={s} type="button" onClick={() => pickSlot(s)}
                  className={"px-3 py-1.5 rounded-lg text-[12px] font-bold border transition-colors cursor-pointer " + (slot === s ? "bg-dark text-cream border-dark" : "bg-surface text-ink-soft border-line hover:border-dark")}>
                  {s}
                </button>
              ))}
            </div>
            <p className="text-[12px] text-ink-soft mt-3 flex items-center gap-1.5"><Home size={13} className="text-accent-deep" /> {address || "Выберите адрес в шаге 1"}</p>
          </div>
        ) : (
          <div>
            <div className="relative mb-3">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" />
              <input value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder={value.method === "post" ? "Поиск по индексу или адресу" : "Поиск по адресу, метро или городу"}
                className="w-full h-[42px] pl-9 pr-3 rounded-lg border border-line bg-surface text-[13px] text-ink placeholder:text-ink-mute focus:outline-none focus:border-dark" />
            </div>
            <div className="qf-pvz-scroll max-h-[260px] overflow-y-auto space-y-2 pr-1">
              {points.map((p) => {
                const active = value.point?.id === p.id;
                return (
                  <button key={p.id} type="button" onClick={() => pickPoint(p)}
                    className={"w-full text-left rounded-lg border p-3 transition-all cursor-pointer " + (active ? "border-dark bg-surface shadow-card" : "border-line bg-surface hover:border-ink-mute")}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-ink truncate">{p.name}</p>
                        <p className="text-[12px] text-ink-soft truncate">{p.city}, {p.address}</p>
                        <p className="text-[11px] text-ink-mute mt-0.5 flex items-center gap-1"><Clock size={11} /> {p.hours}{p.metro ? " · м. " + p.metro : ""}</p>
                      </div>
                      <div className="text-right shrink-0">
                        {active && <span className="inline-flex w-5 h-5 rounded-full bg-dark text-cream items-center justify-center mb-1"><Check size={12} /></span>}
                        <p className="text-[11px] font-bold text-accent-deep">{p.distanceKm} км</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {p.tags.map((t) => <span key={t} className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cream text-ink-soft border border-line">{t}</span>)}
                    </div>
                  </button>
                );
              })}
              {points.length === 0 && <p className="text-[12px] text-ink-mute text-center py-6">Ничего не найдено — измените запрос</p>}
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-dark text-cream px-4 py-2.5">
        <span className="text-[12px] truncate">{summary}</span>
        <span className="text-[12px] font-bold shrink-0">{fmt(value.price)} · {value.days}</span>
      </div>
    </div>
  );
}
