import { useMemo } from "react";

interface QualityScoreProps {
  draft: {
    name: string;
    category: string;
    price: number | string;
    description: string;
    media: any[];
    specs: { key: string; value: string }[];
    tags: string[];
    manufacturer: string;
    sku: string;
    sellerCity: string;
    instant?: boolean;
  };
}

export function QualityScore({ draft }: QualityScoreProps) {
  const checks = useMemo(() => [
    { done: draft.name.trim().length >= 5, weight: 10 },
    { done: !!draft.category, weight: 5 },
    { done: !!draft.price && +draft.price > 0, weight: 10 },
    { done: draft.media.length >= 3, weight: 15 },
    { done: draft.media.some((m: any) => m.type === "video"), weight: 5 },
    { done: draft.description.trim().length >= 100, weight: 10 },
    { done: draft.specs.filter((s) => s.value.trim()).length >= 5, weight: 15 },
    { done: !!draft.manufacturer?.trim(), weight: 5 },
    { done: !!draft.sku?.trim(), weight: 5 },
    { done: draft.tags.length >= 3, weight: 10 },
    { done: !!draft.sellerCity?.trim(), weight: 5 },
    { done: !!draft.instant, weight: 5 },
  ], [draft]);

  const totalWeight = checks.reduce((s, c) => s + c.weight, 0);
  const earnedWeight = checks.filter((c) => c.done).reduce((s, c) => s + c.weight, 0);
  const percent = Math.round((earnedWeight / totalWeight) * 100);

  const getColor = (p: number) => {
    if (p >= 90) return "bg-emerald-500";
    if (p >= 70) return "bg-accent";
    if (p >= 50) return "bg-amber-500";
    return "bg-rose-500";
  };

  return (
    <div className="fixed top-[69px] left-0 right-0 z-[89] h-[3px] bg-line-soft/30">
      <div
        className={`h-full ${getColor(percent)} transition-all duration-700 ease-out`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
