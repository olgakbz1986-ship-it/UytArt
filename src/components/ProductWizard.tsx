import { useState, useMemo } from "react";
import { CATEGORIES } from "../data/seed";
import { SellerProductItem } from "../lib/seller";
import { useSellerAccount, consumeAiCardGen, currentMonth } from "../lib/seller";
import { Btn, Field, Modal } from "./ui";
import { Upload, X, Sparkles, Check } from "lucide-react";
import { CardAnimation } from "./product";

// Шаблоны характеристик по категориям
const SPEC_TEMPLATES: Record<string, { key: string; label: string; required: boolean }[]> = {
  "Вазы и кашпо": [
    { key: "material", label: "Материал", required: true },
    { key: "height", label: "Высота (см)", required: true },
    { key: "diameter", label: "Диаметр (см)", required: true },
    { key: "style", label: "Стиль", required: true },
    { key: "care", label: "Уход", required: true },
  ],
  "Мебель и текстиль": [
    { key: "material", label: "Материал", required: true },
    { key: "dimensions", label: "Размеры (см)", required: true },
    { key: "style", label: "Стиль", required: true },
    { key: "color", label: "Цвет", required: false },
    { key: "complectation", label: "Комплектация", required: false },
  ],
  "Сантехника и коммуникации": [
    { key: "material", label: "Материал", required: true },
    { key: "connectionType", label: "Тип подключения", required: true },
    { key: "dimensions", label: "Размеры", required: true },
    { key: "warranty", label: "Гарантия (лет)", required: true },
  ],
  "Декор и дом": [
    { key: "material", label: "Материал", required: true },
    { key: "dimensions", label: "Размеры", required: true },
    { key: "style", label: "Стиль", required: false },
    { key: "purpose", label: "Назначение", required: false },
  ],
};

const DEFAULT_TEMPLATE = [
  { key: "material", label: "Материал", required: true },
  { key: "dimensions", label: "Размеры", required: true },
  { key: "style", label: "Стиль", required: false },
  { key: "complectation", label: "Комплектация", required: false },
  { key: "care", label: "Уход", required: false },
];

interface ProductWizardProps {
  onCancel: () => void;
  onPublish: (product: Omit<SellerProductItem, "id" | "createdAt">) => void;
  userId: string;
}

export function ProductWizard({ onCancel, onPublish, userId }: ProductWizardProps) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<any>({
    title: "",
    category: "",
    specs: {},
    media: [],
    description: "",
    tags: [],
    seoTitle: "",
    price: "",
    animation: undefined,
    aiGenerated: false,
  });
  const [tone, setTone] = useState<"sales" | "cozy" | "tech">("sales");
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState("");

  const acc = useSellerAccount();
  const month = currentMonth();
  const plan = acc.planId ? acc.plans?.[acc.planId] : null;
  const aiLimitReached = acc.aiCardGens >= (plan?.aiCardGens || 0);

  const template = useMemo(() => {
    return SPEC_TEMPLATES[data.category] || DEFAULT_TEMPLATE;
  }, [data.category]);

  // Шаг 1: Валидация
  const step1Valid = data.title.trim().length >= 3 && data.category;

  // Шаг 2: Валидация обязательных характеристик
  const step2Valid = template
    .filter((f) => f.required)
    .every((f) => data.specs[f.key]?.trim());

  // Шаг 5: Индикатор готовности
  const readiness = useMemo(() => {
    let score = 0;
    if (data.title.trim().length >= 3) score += 15;
    if (data.category) score += 10;
    const requiredSpecs = template.filter((f) => f.required);
    const filledRequired = requiredSpecs.filter((f) => data.specs[f.key]?.trim()).length;
    if (requiredSpecs.length > 0) {
      score += (filledRequired / requiredSpecs.length) * 25;
    } else {
      score += 25;
    }
    if (data.media.length > 0) score += 15;
    if (data.description.trim().length > 50) score += 20;
    if (data.price && +data.price > 0) score += 15;
    return Math.round(score);
  }, [data, template]);

  // Создание AI-анимации
  const createAnimation = () => {
    if (data.media.length < 2) return;
    const chars = Object.entries(data.specs || {})
      .slice(0, 2)
      .map(([_, v]) => String(v));
    setData((prev: any) => ({
      ...prev,
      animation: {
        frames: prev.media.slice(0, 5),
        captions: [prev.title || "Товар", ...chars].filter(Boolean),
        frameMs: 2200,
      },
    }));
  };

  // AI-генерация описания
  const handleAiGenerate = async () => {
    setError("");
    if (data.title.trim().length < 3 || !data.category) {
      setError("Заполните название (мин. 3 символа) и категорию");
      return;
    }
    if (aiLimitReached) {
      setError("AI-лимит исчерпан, улучшите тариф");
      return;
    }

    setIsGenerating(true);
    await new Promise((r) => setTimeout(r, 2000));

    const templates = {
      sales: `✨ ${data.title} — это идеальный выбор для вашего дома! Созданный с любовью и вниманием к деталям, этот товар станет настоящим украшением интерьера. ${data.category} премиум-качества по доступной цене. Не упустите возможность приобрести эксклюзивную вещь, которая подчеркнёт ваш стиль и вкус.`,
      cozy: `🏡 Уют начинается с мелочей. ${data.title} наполнит ваш дом теплом и гармонией. Натуральные материалы и продуманный дизайн делают эту ${data.category} особенной. Пусть каждый день приносит радость от обладания прекрасным.`,
      tech: `Технические характеристики: ${data.title}. Категория: ${data.category}. Материал: ${data.specs?.material || "указан в характеристиках"}. Размеры: ${data.specs?.dimensions || "индивидуально"}. Изделие соответствует всем стандартам качества и прошло многоступенчатый контроль.`,
    };

    const baseTags = [data.category, "новинка", "премиум", data.specs?.material, "ручная работа"].filter(Boolean);
    const seoTitle = `${data.title} — ${data.category.toLowerCase()}, ${data.specs?.material || "качественные материалы"}`;

    setData((prev: any) => ({
      ...prev,
      description: templates[tone],
      tags: baseTags.slice(0, 8),
      seoTitle,
      aiGenerated: true,
    }));

    consumeAiCardGen(month);
    setIsGenerating(false);
  };

  // Публикация
  const handlePublish = () => {
    if (readiness < 70) {
      setError("Заполните все обязательные поля для публикации");
      return;
    }
    onPublish({
      title: data.title.trim(),
      category: data.category,
      price: +data.price,
      specs: Object.entries(data.specs || {}).map(([key, value]) => ({ key, value: String(value) })),
      media: data.media,
      description: data.description,
      tags: data.tags,
      seoTitle: data.seoTitle,
      animation: data.animation,
      aiGenerated: data.aiGenerated,
    });
  };

  // Загрузка медиа
  const addMedia = (file: File) => {
    const url = URL.createObjectURL(file);
    const type = file.type.startsWith("video/") ? "video" : "image";
    setData((prev: any) => ({
      ...prev,
      media: [...prev.media, { url, type, name: file.name }],
    }));
  };

  return (
    <div className="bg-surface rounded-2xl shadow-card p-6 max-w-3xl mx-auto">
      {/* Прогресс шагов */}
      <div className="flex items-center gap-2 mb-6">
        {[1, 2, 3, 4, 5].map((s) => (
          <div
            key={s}
            className={`h-2 flex-1 rounded-full ${s <= step ? "bg-ai" : "bg-line"}`}
          />
        ))}
      </div>
      <p className="text-sm text-ink-mute mb-4">Шаг {step} из 5</p>

      {error && (
        <div className="bg-error/10 border border-error/30 text-error px-4 py-2 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Шаг 1: Название и категория */}
      {step === 1 && (
        <div className="space-y-4">
          <Field label="Название товара *" required>
            <input
              className="field"
              value={data.title}
              onChange={(e) => setData({ ...data, title: e.target.value })}
              placeholder='Ваза "Утро"'
              autoFocus
            />
          </Field>
          <Field label="Категория *" required>
            <div className="relative">
              <input
                className="field"
                value={data.category}
                onChange={(e) => setData({ ...data, category: e.target.value })}
                placeholder="Начните вводить название категории"
              />
              {data.category.length > 1 && (
                <ul className="absolute z-10 w-full bg-surface border border-line rounded-lg mt-1 max-h-48 overflow-y-auto shadow-lg">
                  {CATEGORIES.filter((c) =>
                    c.name.toLowerCase().includes(data.category.toLowerCase())
                  ).map((c) => (
                    <li
                      key={c.slug}
                      className="px-3 py-2 hover:bg-ai/10 cursor-pointer text-sm"
                      onClick={() => setData({ ...data, category: c.name })}
                    >
                      {c.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Field>
          <div className="flex gap-3 pt-4">
            <Btn variant="ghost" onClick={onCancel}>Отмена</Btn>
            <Btn disabled={!step1Valid} onClick={() => setStep(2)} className="ml-auto">
              Далее
            </Btn>
          </div>
        </div>
      )}

      {/* Шаг 2: Характеристики */}
      {step === 2 && (
        <div className="space-y-4">
          <h3 className="font-bold text-lg">Характеристики: {data.category}</h3>
          {template.map((field) => (
            <Field
              key={field.key}
              label={`${field.label}${field.required ? " *" : ""}`}
              required={field.required}
            >
              <input
                className="field"
                value={data.specs[field.key] || ""}
                onChange={(e) =>
                  setData({ ...data, specs: { ...data.specs, [field.key]: e.target.value } })
                }
                placeholder={`Пример: ${field.key === "material" ? "Дуб, керамика" : "150×80×60"}`}
              />
            </Field>
          ))}
          <div className="flex gap-3 pt-4">
            <Btn variant="ghost" onClick={() => setStep(1)}>Назад</Btn>
            <Btn disabled={!step2Valid} onClick={() => setStep(3)} className="ml-auto">
              Далее
            </Btn>
          </div>
        </div>
      )}

      {/* Шаг 3: Медиа */}
      {step === 3 && (
        <div className="space-y-4">
          <h3 className="font-bold text-lg">Фото и видео товара</h3>
          <p className="text-sm text-ink-mute">Загрузите до 10 фото и 1 видео</p>
          <div className="flex gap-2 flex-wrap">
            {data.media.map((m: any, i: number) => (
              <div
                key={i}
                className="relative w-[80px] h-[70px] rounded-lg overflow-hidden border border-line"
              >
                {m.type === "video" ? (
                  <video src={m.url} className="w-full h-full object-cover" muted />
                ) : (
                  <img src={m.url} alt={m.name} className="w-full h-full object-cover" />
                )}
                <button
                  onClick={() =>
                    setData({ ...data, media: data.media.filter((_: any, x: number) => x !== i) })
                  }
                  className="absolute top-1 right-1 w-5 h-5 bg-error text-white rounded-full flex items-center justify-center"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            {data.media.length < 10 && (
              <label className="w-[80px] h-[70px] border-2 border-dashed border-line rounded-lg flex items-center justify-center cursor-pointer hover:border-ai">
                <Upload size={20} className="text-ink-mute" />
                <input
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) addMedia(f);
                  }}
                />
              </label>
            )}
          </div>
          {data.media.length >= 2 && (
            <Btn variant="outline" onClick={createAnimation} className="w-full">
              <Sparkles size={15} /> Создать AI-анимацию
            </Btn>
          )}
          {data.animation && (
            <div className="mt-4">
              <p className="text-sm font-semibold mb-2">Предпросмотр анимации:</p>
              <div className="w-full max-w-xs rounded-lg overflow-hidden border border-line">
                <CardAnimation
                  frames={data.animation.frames}
                  captions={data.animation.captions}
                  frameMs={data.animation.frameMs}
                />
              </div>
            </div>
          )}
          <div className="flex gap-3 pt-4">
            <Btn variant="ghost" onClick={() => setStep(2)}>Назад</Btn>
            <Btn onClick={() => setStep(4)} className="ml-auto">
              Далее
            </Btn>
          </div>
        </div>
      )}

      {/* Шаг 4: AI-генерация */}
      {step === 4 && (
        <div className="space-y-4">
          <h3 className="font-bold text-lg">AI-генерация описания</h3>
          <div className="flex items-center gap-3">
            <span className="text-sm">Тон текста:</span>
            <select
              className="field text-sm"
              value={tone}
              onChange={(e) => setTone(e.target.value as any)}
            >
              <option value="sales">Продающий</option>
              <option value="cozy">Уютный</option>
              <option value="tech">Технический</option>
            </select>
          </div>
          <Btn
            variant="outline"
            disabled={isGenerating || aiLimitReached}
            onClick={handleAiGenerate}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Sparkles size={15} className="animate-spin" /> AI анализирует характеристики...
              </>
            ) : aiLimitReached ? (
              "AI-лимит исчерпан, улучшите тариф"
            ) : (
              <>
                <Sparkles size={15} /> Сгенерировать карточку
              </>
            )}
          </Btn>
          {data.description && (
            <>
              <Field label="Описание">
                <textarea
                  className="field min-h-[120px]"
                  value={data.description}
                  onChange={(e) => setData({ ...data, description: e.target.value })}
                />
              </Field>
              <Field label="Теги (через запятую)">
                <input
                  className="field"
                  value={data.tags.join(", ")}
                  onChange={(e) =>
                    setData({ ...data, tags: e.target.value.split(",").map((t: string) => t.trim()).filter(Boolean) })
                  }
                />
              </Field>
              <Field label="SEO-заголовок">
                <input
                  className="field"
                  value={data.seoTitle}
                  onChange={(e) => setData({ ...data, seoTitle: e.target.value })}
                />
              </Field>
            </>
          )}
          <div className="flex gap-3 pt-4">
            <Btn variant="ghost" onClick={() => setStep(3)}>Назад</Btn>
            <Btn onClick={() => setStep(5)} className="ml-auto">
              Далее
            </Btn>
          </div>
        </div>
      )}

      {/* Шаг 5: Цена и публикация */}
      {step === 5 && (
        <div className="space-y-4">
          <h3 className="font-bold text-lg">Цена и публикация</h3>
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#E5E7EB"
                  strokeWidth="3"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke={readiness >= 70 ? "#10B981" : "#F59E0B"}
                  strokeWidth="3"
                  strokeDasharray={`${readiness}, 100`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-sm font-bold">
                {readiness}%
              </div>
            </div>
            <div className="text-sm text-ink-mute">
              <p>Готовность карточки</p>
              <p className="text-xs">Минимум 70% для публикации</p>
            </div>
          </div>
          <Field label="Цена, ₽ *" required>
            <input
              className="field"
              inputMode="numeric"
              value={data.price}
              onChange={(e) => setData({ ...data, price: e.target.value.replace(/\D/g, "") })}
              placeholder="4900"
            />
          </Field>
          <div className="flex gap-3 pt-4">
            <Btn variant="ghost" onClick={() => setStep(4)}>Назад</Btn>
            <Btn
              variant="outline"
              onClick={() => setShowPreview(true)}
              disabled={!data.title || !data.price}
            >
              Предпросмотр
            </Btn>
            <Btn
              disabled={readiness < 70}
              onClick={handlePublish}
              className="ml-auto"
            >
              Опубликовать
            </Btn>
          </div>
        </div>
      )}

      {/* Модальное окно предпросмотра */}
      {showPreview && (
        <Modal onClose={() => setShowPreview(false)} title="Предпросмотр карточки">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              {data.animation ? (
                <CardAnimation
                  frames={data.animation.frames}
                  captions={data.animation.captions}
                  frameMs={data.animation.frameMs}
                />
              ) : data.media.length > 0 ? (
                <img
                  src={data.media[0].url}
                  alt={data.title}
                  className="w-full rounded-lg"
                />
              ) : (
                <div className="w-full h-48 bg-line/20 rounded-lg flex items-center justify-center text-ink-mute">
                  Нет фото
                </div>
              )}
            </div>
            <div className="space-y-3">
              <h3 className="font-bold text-xl">{data.title}</h3>
              <p className="text-2xl font-display font-bold text-ai">{data.price} ₽</p>
              {data.specs && Object.keys(data.specs).length > 0 && (
                <div>
                  <p className="font-semibold text-sm mb-1">Характеристики:</p>
                  <ul className="text-sm space-y-1">
                    {Object.entries(data.specs).map(([k, v]) => (
                      <li key={k}>
                        <b>{k}:</b> {String(v)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {data.tags && data.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {data.tags.map((tag: string, i: number) => (
                    <span
                      key={i}
                      className="px-2 py-1 bg-ai/10 text-ai text-xs rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {data.description && (
                <p className="text-sm text-ink-soft whitespace-pre-line">
                  {data.description}
                </p>
              )}
              <Btn disabled className="w-full">Купить (неактивно)</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
