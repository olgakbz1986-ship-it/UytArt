import { getGroupsForCategory, type SpecFieldDef } from "../lib/specSystem";

export interface SpecRow { id: string; key: string; value: string }

const specKey = (f: SpecFieldDef) => (f.unit ? `${f.label}, ${f.unit}` : f.label);

export function SpecSections({ category, specs }: { category: string; specs: SpecRow[] }) {
  const groups = getGroupsForCategory(category);

  const sections = groups
    .map((g) => {
      const rows = g.fields
        .map((f) => ({
          label: f.label + (f.unit ? `, ${f.unit}` : ""),
          value: specs.find((s) => s.key === specKey(f))?.value || "",
        }))
        .filter((r) => r.value.trim());
      return { group: g, rows };
    })
    .filter((s) => s.rows.length > 0);

  const rest = specs.filter((s) => !groups.some((g) => g.fields.some((f) => specKey(f) === s.key)));

  if (sections.length === 0 && rest.length === 0) return null;

  return (
    <div className="space-y-4 mt-4">
      {sections.map(({ group, rows }) => (
        <div key={group.id} className="bg-surface rounded-2xl shadow-card overflow-hidden">
          <div className="px-5 py-3 bg-cream/70 border-b border-line-soft">
            <span className="text-[13px] font-bold text-ink">{group.icon} {group.label}</span>
          </div>
          {rows.map((r, i) => (
            <div key={r.label} className={`flex justify-between gap-4 px-5 py-3 text-[14px] ${i % 2 ? "bg-cream/50" : ""}`}>
              <span className="text-ink-soft">{r.label}</span>
              <span className="font-semibold text-ink text-right">{r.value}</span>
            </div>
          ))}
        </div>
      ))}
      {rest.length > 0 && (
        <div className="bg-surface rounded-2xl shadow-card overflow-hidden">
          <div className="px-5 py-3 bg-cream/70 border-b border-line-soft">
            <span className="text-[13px] font-bold text-ink">📋 Дополнительные характеристики</span>
          </div>
          {rest.map((r, i) => (
            <div key={r.id} className={`flex justify-between gap-4 px-5 py-3 text-[14px] ${i % 2 ? "bg-cream/50" : ""}`}>
              <span className="text-ink-soft">{r.key}</span>
              <span className="font-semibold text-ink text-right">{r.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
