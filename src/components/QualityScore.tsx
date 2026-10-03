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
    processingDays?: string;
  };
  importantLabels?: string[];
}

export function QualityScore({ draft, importantLabels = [] }: QualityScoreProps) {
  const filledImportant = importantLabels.filter((label) => draft.specs.some((s) => s.key === label && s.value.trim())).length;
  const totalImportant = importantLabels.length;
  const photoCount = draft.media.filter((m) => m.type === "image").length;
  const hasVideo = draft.media.some((m) => m.type === "video");

  const checks = useMemo(() => [
    { done: draft.name.trim().length >= 5, weight: 10, hint: "Название короче 5 символов" },
    { done: !!draft.category, weight: 5, hint: "Выберите категорию" },
    { done: !!draft.price && +draft.price > 0, weight: 10, hint: "Укажите цену" },
    { done: photoCount >= 3, weight: 15, hint: `Добавьте ещё ${Math.max(0, 3 - photoCount)} фото` },
    { done: hasVideo, weight: 0, hint: "Видео повышает конверсию на 30%" },
    { done: draft.description.trim().length >= 100, weight: 10, hint: `Описание короткое (сейчас ${draft.description.trim().length} из 100 символов)` },
    { done: (() => {
      const groupSpecs = draft.specs.filter((sp) => sp.value.trim()).length;
      const commonFields = [
        draft.materials?.[0]?.trim(),
        draft.style?.trim(),
        draft.color?.trim(),
        draft.size?.trim(),
        draft.weight?.trim(),
      ].filter(Boolean).length;
      return (groupSpecs + commonFields) >= 5;
    })(), weight: 10, hint: "Заполните ещё характеристик (общих или из групп)" },
    { done: totalImportant === 0 || filledImportant === totalImportant, weight: 15, hint: totalImportant > 0 ? `⭐ Заполните важные поля: ${filledImportant}/${totalImportant}` : "" },
    { done: !!draft.manufacturer?.trim(), weight: 5, hint: "Укажите производителя" },
    { done: !!draft.sku?.trim(), weight: 5, hint: "Укажите артикул" },
    { done: draft.tags.length >= 3, weight: 10, hint: `Добавьте ${Math.max(0, 3 - draft.tags.length)} тег(ов)` },
    { done: !!draft.sellerCity?.trim(), weight: 5, hint: "Укажите город" },
    { done: !!draft.processingDays && +draft.processingDays > 0, weight: 0, hint: "Укажите срок обработки" },
  ], [draft, filledImportant, totalImportant, photoCount, hasVideo]);

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
    <div className="sticky top-[69px] z-[89] w-full bg-surface/95 backdrop-blur border-b border-line-soft/50 shadow-sm">
      <div className="h-[5px] bg-line-soft/30 relative">
        <div
          className={`h-full ${getColor(percent)} transition-all duration-700 ease-out`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="flex items-center px-4 py-1 text-[11.5px]">
        <span className="font-bold text-ink-mute">Качество карточки: <span className={percent >= 90 ? "text-emerald-600" : percent >= 70 ? "text-accent-deep" : percent >= 50 ? "text-amber-600" : "text-rose-600"}>{percent}%</span></span>
      </div>
    </div>
  );
}
