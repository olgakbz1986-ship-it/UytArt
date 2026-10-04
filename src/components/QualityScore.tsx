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
    materials?: string[];
    style?: string;
    color?: string;
    size?: string;
    weight?: string;
  };
  importantLabels?: string[];
}


export function calculateQualityScore(draft: {
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
  materials?: string[];
  style?: string;
  color?: string;
  size?: string;
  weight?: string;
}, importantLabels: string[] = []): number {
  const filledImportant = importantLabels.filter((label) => draft.specs.some((s) => s.key === label && s.value.trim())).length;
  const totalImportant = importantLabels.length;
  const photoCount = draft.media.filter((m: any) => m.type === "image").length;
  const hasVideo = draft.media.some((m: any) => m.type === "video");

  const checks = [
    { done: draft.name.trim().length >= 5, weight: 10, hint: "Название короче 5 символов" },
    { done: !!draft.category, weight: 5, hint: "Выберите категорию" },
    { done: !!draft.price && +draft.price > 0, weight: 10, hint: "Укажите цену" },
    { done: photoCount >= 3, weight: 15, hint: "Добавьте ещё фото" },
    { done: hasVideo, weight: 0, hint: "Видео повышает конверсию" },
    { done: draft.description.trim().length >= 100, weight: 10, hint: "Описание короткое" },
    { done: (() => {
      const groupSpecs = draft.specs.filter((sp: any) => sp.value.trim()).length;
      const commonFields = [
        draft.materials?.[0]?.trim(),
        draft.style?.trim(),
        draft.color?.trim(),
        draft.size?.trim(),
        draft.weight?.trim(),
      ].filter(Boolean).length;
      return (groupSpecs + commonFields) >= 5;
    })(), weight: 10, hint: "Заполните характеристик" },
    { done: totalImportant === 0 || filledImportant === totalImportant, weight: 15, hint: "Заполните важные поля" },
    { done: !!draft.manufacturer?.trim(), weight: 5, hint: "Укажите производителя" },
    { done: !!draft.sku?.trim(), weight: 5, hint: "Укажите артикул" },
    { done: draft.tags.length >= 3, weight: 10, hint: "Добавьте теги" },
    { done: !!draft.sellerCity?.trim(), weight: 5, hint: "Укажите город" },
    { done: !!draft.processingDays && +draft.processingDays > 0, weight: 0, hint: "Укажите срок обработки" },
  ];

  const totalWeight = checks.reduce((s, c) => s + c.weight, 0);
  const earnedWeight = checks.filter((c) => c.done).reduce((s, c) => s + c.weight, 0);
  return Math.round((earnedWeight / totalWeight) * 100);
}

export function QualityScore({ draft, importantLabels = [] }: QualityScoreProps) {
  const percent = calculateQualityScore(draft, importantLabels);

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
