import { useMemo, useRef, useState } from "react";
import { CATEGORIES } from "../data/seed";

const GROUP_LABELS: Record<string, string> = {
  decor_home: "🏠 Декор и дом",
  clothing_shoes: "👗 Одежда и обувь",
  accessories: "👜 Аксессуары",
  beauty: "💄 Красота и уход",
  construction: "🏗 Строительство",
  digital: "💾 Цифровые товары",
  finishing: "🖌 Отделка",
  foodcourt: "🍽 Продукты",
  furniture_textile: "🛋 Мебель и текстиль",
  hardware: "🔧 Инструменты",
  hobby: "🎨 Хобби и творчество",
  home_garden: "🌿 Дом и сад",
  plumbing_comms: "🚿 Сантехника",
  services: "🤝 Услуги",
  tech: "📱 Электроника",
};

const POPULAR_SLUGS = ["vases-cachepots", "figurines-sculptures", "paintings-posters-panels", "womens-clothing", "home-aromas", "candles-holders", "photo-frames-albums", "decorative-figures-souvenirs"];

export function CategoryPicker({ value, sub, onChange }: { value: string; sub: string; onChange: (category: string, sub: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  const current = CATEGORIES.find((c) => c.name === value) || null;

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return CATEGORIES;
    return CATEGORIES.filter((c) => c.name.toLowerCase().includes(query) || c.subs.some((s) => s.name.toLowerCase().includes(query)));
  }, [q]);

  const grouped = useMemo(() => {
    const order: string[] = [];
    const map: Record<string, typeof CATEGORIES> = {};
    filtered.forEach((c) => {
      if (!map[c.group]) { map[c.group] = []; order.push(c.group); }
      map[c.group].push(c);
    });
    return order.map((g) => [g, map[g]] as [string, typeof CATEGORIES]);
  }, [filtered]);

  const popular = useMemo(() => CATEGORIES.filter((c) => POPULAR_SLUGS.includes(c.slug)), []);
  const pick = (name: string) => { onChange(name, ""); setQ(""); setOpen(false); };

  return (
    <div className="relative" ref={boxRef}>
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="field w-full flex items-center justify-between gap-2 text-left cursor-pointer">
        <span className={current ? "text-ink font-bold" : "text-ink-mute"}>
          {current ? `${current.emoji} ${current.name}` : "Выберите категорию…"}
          {current && sub ? <span className="ml-1 text-[11px] text-accent-deep font-bold">› {sub}</span> : null}
        </span>
        <span className="text-ink-mute text-[12px]">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 mt-2 w-full min-w-[320px] rounded-[14px] border border-line bg-white shadow-card overflow-hidden">
            <div className="p-2 border-b border-line-soft">
              <input autoFocus className="field" placeholder="🔍 Поиск: кашпо, платье, ваза…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="max-h-72 overflow-auto p-2 space-y-3">
              {!q && (
                <div>
                  <p className="text-[11px] font-bold text-ink-mute mb-1.5">🏆 Популярные</p>
                  <div className="flex flex-wrap gap-1.5">
                    {popular.map((c) => (
                      <button key={c.slug} type="button" onClick={() => pick(c.name)}
                        className="h-7 px-2.5 rounded-full bg-accent/10 text-accent-deep text-[11px] font-bold hover:bg-accent hover:text-ink cursor-pointer transition-colors">
                        {c.emoji} {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {grouped.map(([g, list]) => (
                <div key={g}>
                  <p className="text-[11px] font-bold text-ink-mute mb-1.5">{GROUP_LABELS[g] || g}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {list.map((c) => (
                      <button key={c.slug} type="button" onClick={() => pick(c.name)}
                        className={"h-7 px-2.5 rounded-full text-[11px] font-bold cursor-pointer transition-colors border " + (c.name === value ? "bg-dark text-cream border-dark" : "bg-cream text-ink border-line-soft hover:border-accent hover:text-accent-deep")}>
                        {c.emoji} {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {grouped.length === 0 && <p className="text-[12px] text-ink-mute p-2">Ничего не найдено по запросу «{q}»</p>}
            </div>
          </div>
        </>
      )}

      {current && current.subs.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          <button type="button" onClick={() => onChange(current.name, "")}
            className={"h-7 px-2.5 rounded-full text-[11px] font-bold cursor-pointer transition-colors border " + (!sub ? "bg-accent text-ink border-accent" : "bg-cream text-ink-mute border-line-soft hover:border-accent")}>
            Без подкатегории
          </button>
          {current.subs.map((s) => (
            <button key={s.slug} type="button" onClick={() => onChange(current.name, s.name)}
              className={"h-7 px-2.5 rounded-full text-[11px] font-bold cursor-pointer transition-colors border " + (sub === s.name ? "bg-accent text-ink border-accent" : "bg-cream text-ink-mute border-line-soft hover:border-accent")}>
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
