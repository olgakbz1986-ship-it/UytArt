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

export function SpecGroupsEditor({ category, specs, onChange }: { category: string; specs: SpecRow[]; onChange: (next: SpecRow[]) => void }) {
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
  return (
    <div className="mt-5 space-y-2">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-[12px] font-bold text-ink"> Подробные характеристики под категорию</span>
        <span className="text-[11px] text-ink-mute">откройте нужные группы и заполните только то, что важно для вашего товара</span>
      </div>
      {allGroups.map((g) => {
        const filled = g.fields.filter((f) => getVal(f).trim()).length;
        const opened = isOpen(g.id, !!g.defaultOpen);
        return (
          <div key={g.id} className="rounded-[12px] border border-line bg-cream overflow-hidden">
            <button type="button" onClick={() => setOpen((o) => ({ ...o, [g.id]: !opened }))}
              className="w-full flex items-center justify-between gap-2 px-4 py-3 cursor-pointer hover:bg-line-soft transition-colors">
              <span className="text-[13px] font-bold text-ink">{g.icon} {g.label}</span>
              <span className="text-[11px] font-bold text-ink-mute">{filled ? `заполнено: ${filled} · ` : ""}{opened ? "скрыть ▴" : "открыть ▾"}</span>
            </button>
            {opened && (
              <div className="px-4 pb-4 grid sm:grid-cols-2 gap-3">
                {g.fields.filter((f) => !(f.hideIf && f.hideIf.test(category))).map((f) => (
                  <div key={f.id}>
                    <label className={`text-[11.5px] font-bold block mb-1 ${f.important ? "text-accent-deep" : "text-ink-mute"}`}>{f.important && <span title="Важное поле для категории">⭐ </span>}{f.label}{f.unit ? `, ${f.unit}` : ""}</label>
                    <FieldInput f={f} value={getVal(f)} onChange={(v) => setVal(f, v)} />
                    {f.hint && <p className="text-[10.5px] text-ink-mute mt-1">{f.hint}</p>}
                  </div>
                ))}
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
