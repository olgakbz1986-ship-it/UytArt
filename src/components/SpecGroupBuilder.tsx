import { useState } from "react";
import { type SpecGroupDef, type SpecFieldDef, type SpecFieldType } from "../lib/specSystem";

export function SpecGroupBuilder({ onAdd, onCancel }: { onAdd: (g: SpecGroupDef) => void; onCancel: () => void }) {
  const [label, setLabel] = useState("");
  const [icon, setIcon] = useState("📋");
  const [fields, setFields] = useState<SpecFieldDef[]>([]);
  const [newField, setNewField] = useState<Partial<SpecFieldDef>>({ type: "text" });
  const [optionsText, setOptionsText] = useState("");

  const addField = () => {
    if (!newField.label) return;
    const f: SpecFieldDef = {
      id: "custom-" + Date.now(),
      label: newField.label,
      type: (newField.type as SpecFieldType) || "text",
      unit: newField.unit,
      options: optionsText ? optionsText.split(",").map((s: string) => s.trim()) : undefined,
      placeholder: newField.placeholder,
    };
    setFields([...fields, f]);
    setNewField({ type: "text" });
    setOptionsText("");
  };

  const save = () => {
    if (!label.trim() || fields.length === 0) return;
    onAdd({ id: "custom-" + Date.now(), label, icon, fields });
  };

  return (
    <div className="mt-3 rounded-[12px] border-2 border-accent bg-cream p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[13px] font-bold text-ink">🛠 Создать свою группу характеристик</span>
      </div>
      <div className="grid sm:grid-cols-3 gap-3 mb-3">
        <div>
          <label className="text-[11px] font-bold text-ink-mute block mb-1">Название группы</label>
          <input className="field" placeholder="Например: Ювелирные изделия" value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div>
          <label className="text-[11px] font-bold text-ink-mute block mb-1">Иконка (эмодзи)</label>
          <input className="field" placeholder="💍" value={icon} onChange={(e) => setIcon(e.target.value)} />
        </div>
      </div>
      <div className="border-t border-line pt-3 mb-3">
        <div className="text-[11px] font-bold text-ink-mute mb-2">Добавить поле:</div>
        <div className="grid sm:grid-cols-4 gap-2 mb-2">
          <input className="field" placeholder="Название поля" value={(newField.label as string) || ""} onChange={(e) => setNewField({ ...newField, label: e.target.value })} />
          <select className="field" value={newField.type} onChange={(e) => setNewField({ ...newField, type: e.target.value as SpecFieldType })}>
            <option value="text">Текст</option>
            <option value="number">Число</option>
            <option value="select">Выбор</option>
            <option value="boolean">Да/Нет</option>
            <option value="multiselect">Мультиселект</option>
            <option value="range">Диапазон</option>
          </select>
          <input className="field" placeholder="Единица (мм, кг…)" value={(newField.unit as string) || ""} onChange={(e) => setNewField({ ...newField, unit: e.target.value })} />
          <input className="field" placeholder="Варианты через запятую" value={optionsText} onChange={(e) => setOptionsText(e.target.value)} />
        </div>
        <button type="button" onClick={addField} className="h-8 px-3 rounded-[8px] bg-line-soft text-ink text-[11px] font-bold hover:bg-line cursor-pointer">+ Добавить поле</button>
      </div>
      {fields.length > 0 && (
        <div className="mb-3">
          <div className="text-[11px] font-bold text-ink-mute mb-1">Поля группы:</div>
          <div className="flex flex-wrap gap-1.5">
            {fields.map((f) => (
              <span key={f.id} className="h-6 px-2 rounded-full bg-accent text-ink text-[10px] font-bold flex items-center gap-1">
                {f.label}{f.unit ? `, ${f.unit}` : ""}
                <button type="button" onClick={() => setFields(fields.filter((x) => x.id !== f.id))} className="hover:text-red-600">×</button>
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={save} className="h-9 px-4 rounded-[8px] bg-accent text-ink text-[12px] font-bold hover:bg-accent-deep cursor-pointer">Сохранить группу</button>
        <button type="button" onClick={onCancel} className="h-9 px-4 rounded-[8px] bg-line-soft text-ink-mute text-[12px] font-bold hover:bg-line cursor-pointer">Отмена</button>
      </div>
    </div>
  );
}
