import { useMemo, useState } from "react";
import { getGroupsForCategory, type SpecFieldDef, type SpecGroupDef } from "../lib/specSystem";
import { SpecGroupBuilder } from "./SpecGroupBuilder";

export interface SpecRow { id: string; key: string; value: string }
const specKey = (f: SpecFieldDef) => (f.unit ? `${f.label}, ${f.unit}` : f.label);

function FieldInput({ f, value, onChange }: { f: SpecFieldDef; value: string; onChange: (v: string) => void }) {
  if (f.type === "boolean") {
    const on = value === "Да";
    return (
      <button type="button" onClick={() => onChange(on ? "" : "Да")}
        className={"h-9 px-4 rounded-[8px] text-[12px] font-bold cursor-pointer transition-colors " + (on ? "bg-dark text-cream" : "bg-line-soft text-ink-mute hover:bg-line")}>
        {on ? "✓ Да" : "Нет"}
      </button>
    );
  }
  if (f.type === "select") {
    return (
      <select className="field" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Не выбрано</option>
        {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  if (f.type === "multiselect") {
    const picked = value ? value.split(", ") : [];
    const toggle = (o: string) => onChange(picked.includes(o) ? picked.filter((p) => p !== o).join(", ") : [...picked, o].join(", "));
    return (
      <div className="flex flex-wrap gap-1.5">
        {(f.options || []).map((o) => {
          const on = picked.includes(o);
          return (
            <button key={o} type="button" onClick={() => toggle(o)}
              className={"h-7 px-2.5 rounded-full text-[11px] font-bold cursor-pointer transition-colors " + (on ? "bg-accent text-ink" : "bg-line-soft text-ink-mute hover:bg-line")}>
              {on ? "✓ " : "+ "}{o}
            </button>
          );
        })}
      </div>
    );
  }
  if (f.type === "range") {
    const [a, b] = value.split("…");
    return (
      <div className="flex items-center gap-2">
        <input className="field" placeholder="от" value={a || ""} onChange={(e) => onChange(`${e.target.value}…${b || ""}`)} />
        <span className="text-ink-mute text-[12px]">—</span>
        <input className="field" placeholder="до" value={b || ""} onChange={(e) => onChange(`${a || ""}…${e.target.value}`)} />
      </div>
    );
  }
  return <input className="field" type={f.type === "number" ? "number" : "text"} placeholder={f.placeholder || ""} value={value} onChange={(e) => onChange(e.target.value)} />;
}

const CERAMIC_ONLY = ["firing", "glaze", "foodsafe", "dishwash"];
const NON_CERAMIC = /дерев|метал|стекл|пласт|бетон|гипс|текстил|кож|латун|медн|бронз/i;

export interface BasicSpecs {
  material: string; color: string; style: string; size: string; weight: string;
  matLabel: string;
  show: { mat: boolean; style: boolean; color: boolean; size: boolean; weight: boolean };
  onChange: (patch: Partial<{ material: string; color: string; style: string; size: string; weight: string }>) => void;
}
interface BasicRow { key: string; label: string; important?: boolean; unit?: string; placeholder?: string; value: string; set: (v: string) => void }

export function SpecGroupsEditor({ category, sub = "", material = "", specs, onChange, basic }: { category: string; sub?: string; material?: string; specs: SpecRow[]; onChange: (next: SpecRow[]) => void; basic?: BasicSpecs }){
  const groups = useMemo(() => getGroupsForCategory(category), [category]);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [customGroups, setCustomGroups] = useState<SpecGroupDef[]>([]);
  const [building, setBuilding] = useState(false);
  const allGroups = [...groups, ...customGroups];
  const isOpen = (gid: string, def: boolean) => (open[gid] === undefined ? def : open[gid]);
  const getVal = (f: SpecFieldDef) => specs.find((s) => s.key === specKey(f))?.value || "";
  const setVal = (f: SpecFieldDef, v: string) => {
    const k = specKey(f);
    if (!v.trim()) onChange(specs.filter((s) => s.key !== k));
    else if (specs.some((s) => s.key === k)) onChange(specs.map((s) => (s.key === k ? { ...s, value: v } : s)));
    else onChange([...specs, { id: "spec-" + Math.random().toString(36).slice(2), key: k, value: v }]);
  };
  const ctx = `${category} ${sub} ${material}`;
  const isHidden = (g: SpecGroupDef, f: SpecFieldDef) =>
    !!(f.hideIf && f.hideIf.test(category)) ||
    (g.id === "ceramic" && CERAMIC_ONLY.includes(f.id) && NON_CERAMIC.test(ctx));
  const visibleFields = (g: SpecGroupDef) => g.fields.filter((f) => !isHidden(g, f));
  const importantAll = allGroups.flatMap((g) => visibleFields(g).filter((f) => f.important));
  const doneImportant = importantAll.filter((f) => getVal(f).trim()).length;
  const basicRows: BasicRow[] = basic ? ([
    basic.show.mat ? { key: "material", label: basic.matLabel, important: true, placeholder: basic.matLabel !== "Материал" ? "Натуральные ингредиенты, состав..." : "Керамика, дерево, металл...", value: basic.material, set: (v: string) => basic.onChange({ material: v }) } : null,
    basic.show.color ? { key: "color", label: "Цвет", placeholder: "Шалфей, терракота, графит...", value: basic.color, set: (v: string) => basic.onChange({ color: v }) } : null,
    basic.show.style ? { key: "style", label: "Стиль", placeholder: "Бохо, лофт, сканди, минимализм...", value: basic.style, set: (v: string) => basic.onChange({ style: v }) } : null,
    basic.show.size ? { key: "size", label: "Размер / Габариты", placeholder: "Ø 20 см, 40×60×15 см...", value: basic.size, set: (v: string) => basic.onChange({ size: v }) } : null,
    basic.show.weight ? { key: "weight", label: "Вес изделия", unit: "кг", placeholder: "1.2", value: basic.weight, set: (v: string) => basic.onChange({ weight: v.replace(/[^\d.]/g, "") }) } : null,
  ].filter(Boolean) as BasicRow[]) : [];
  const basicImportantCount = basic && basic.show.mat ? 1 : 0;
  const basicDoneCount = basic && basic.show.mat && basic.material.trim() ? 1 : 0;

  return (
    <div className="mt-5 space-y-2">
      <div className="rounded-[12px] border border-line bg-cream p-3">
        <div className="flex items-center justify-between text-[11px] font-bold text-ink">
          <span>⭐ Обязательные характеристики</span>
          <span className={doneImportant + basicDoneCount === importantAll.length + basicImportantCount ? "text-success" : "text-accent-deep"}>{doneImportant + basicDoneCount} из {importantAll.length + basicImportantCount}</span>
        </div>
        <div className="h-2 rounded-full bg-line-soft mt-2 overflow-hidden">
          <div className="h-full rounded-full bg-success transition-all duration-500" style={{ width: `${(importantAll.length + basicImportantCount) ? ((doneImportant + basicDoneCount) / (importantAll.length + basicImportantCount)) * 100 : 0}%` }} />
        </div>
        <p className="text-[10.5px] text-ink-mute mt-1.5">Заполните обязательные поля или отметьте «—» (не применимо), чтобы опубликовать товар.</p>
      </div>

      {basic && basicRows.length > 0 && (
        <div className="rounded-[12px] border border-line bg-cream overflow-hidden">
          <div className="w-full flex items-center justify-between gap-2 px-4 py-3">
            <span className="text-[13px] font-bold text-ink">🎯 Основные свойства</span>
            <span className="text-[11px] font-bold text-ink-mute">заполнено: {basicRows.filter((r) => r.value.trim()).length}/{basicRows.length}</span>
          </div>
          <div className="px-4 pb-3">
            <div className="grid grid-cols-[minmax(120px,1fr)_minmax(140px,1.6fr)_48px_110px] gap-2 py-1.5 border-b border-line text-[10px] font-bold text-ink-mute uppercase tracking-wide">
              <span>Характеристика</span><span>Значение</span><span>Ед.</span><span className="text-right">Статус</span>
            </div>
            {basicRows.map((r) => (
              <div key={r.key} className="grid grid-cols-[minmax(120px,1fr)_minmax(140px,1.6fr)_48px_110px] gap-2 items-center py-2 border-b border-line-soft last:border-0">
                <span className={`text-[12px] font-bold ${r.important ? "text-accent-deep" : "text-ink"}`}>{r.important ? "⭐ " : ""}{r.label}</span>
                <input className="field" type={r.key === "weight" ? "number" : "text"} placeholder={r.placeholder || ""} value={r.value} onChange={(e) => r.set(e.target.value)} />
                <span className="text-[11px] text-ink-mute">{r.unit || "—"}</span>
                <div className="flex items-center justify-end">
                  {r.value.trim() ? (
                    <span className="text-[10px] font-bold text-success px-1.5 py-0.5 rounded bg-success/10">✓ готово</span>
                  ) : r.important ? (
                    <span className="text-[10px] font-bold text-accent-deep px-1.5 py-0.5 rounded bg-accent/10">обязат.</span>
                  ) : (
                    <span className="text-[10px] text-ink-mute">опцион.</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {allGroups.map((g) => {
        const fields = visibleFields(g);
        if (!fields.length) return null;
        const filled = fields.filter((f) => getVal(f).trim()).length;
        const opened = isOpen(g.id, !!g.defaultOpen);
        return (
          <div key={g.id} className="rounded-[12px] border border-line bg-cream overflow-hidden">
            <button type="button" onClick={() => setOpen((o) => ({ ...o, [g.id]: !opened }))}
              className="w-full flex items-center justify-between gap-2 px-4 py-3 cursor-pointer hover:bg-line-soft transition-colors">
              <span className="text-[13px] font-bold text-ink">{g.icon} {g.label}</span>
              <span className="text-[11px] font-bold text-ink-mute">{filled ? `заполнено: ${filled}/${fields.length} · ` : ""}{opened ? "скрыть ▴" : "открыть ▾"}</span>
            </button>
            {opened && (
              <div className="px-4 pb-3">
                <div className="grid grid-cols-[minmax(120px,1fr)_minmax(140px,1.6fr)_48px_110px] gap-2 py-1.5 border-b border-line text-[10px] font-bold text-ink-mute uppercase tracking-wide">
                  <span>Характеристика</span><span>Значение</span><span>Ед.</span><span className="text-right">Статус</span>
                </div>
                {fields.map((f) => {
                  const val = getVal(f);
                  return (
                    <div key={f.id} className="grid grid-cols-[minmax(120px,1fr)_minmax(140px,1.6fr)_48px_110px] gap-2 items-center py-2 border-b border-line-soft last:border-0">
                      <div>
                        <span className={`text-[12px] font-bold ${f.important ? "text-accent-deep" : "text-ink"}`}>{f.important ? "⭐ " : ""}{f.label}</span>
                        {f.hint && <p className="text-[10px] text-ink-mute mt-0.5">{f.hint}</p>}
                      </div>
                      <FieldInput f={f} value={val === "—" ? "" : val} onChange={(v) => setVal(f, v)} />
                      <span className="text-[11px] text-ink-mute">{f.unit || "—"}</span>
                      <div className="flex items-center justify-end gap-1.5">
                        {val === "—" ? (
                          <span className="text-[10px] font-bold text-ink-mute px-1.5 py-0.5 rounded bg-line-soft">Н/П</span>
                        ) : val ? (
                          <span className="text-[10px] font-bold text-success px-1.5 py-0.5 rounded bg-success/10">✓ готово</span>
                        ) : f.important ? (
                          <span className="text-[10px] font-bold text-accent-deep px-1.5 py-0.5 rounded bg-accent/10">обязат.</span>
                        ) : (
                          <span className="text-[10px] text-ink-mute">опцион.</span>
                        )}
                        <button type="button" title="Не применимо к товару" onClick={() => setVal(f, val === "—" ? "" : "—")}
                          className={"w-6 h-6 rounded-md text-[12px] font-bold cursor-pointer transition-colors " + (val === "—" ? "bg-dark text-cream" : "bg-line-soft text-ink-mute hover:bg-line")}>—</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      <button type="button" onClick={() => setBuilding(true)} className="w-full h-10 rounded-[12px] border-2 border-dashed border-line text-ink-mute text-[12px] font-bold hover:border-accent hover:text-accent cursor-pointer transition-colors">
        🛠 + Создать свою группу характеристик
      </button>
      {building && <SpecGroupBuilder onAdd={(g) => { setCustomGroups([...customGroups, g]); setBuilding(false); }} onCancel={() => setBuilding(false)} />}
    </div>
  );
}
