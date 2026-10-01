import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Upload, Trash2, Sparkles, Check, Image as ImageIcon, Video, Save, Send } from "lucide-react";
import { useSellerAccount, useSellerReg, type SellerProductItem, type DeliveryZone } from "../lib/seller";
import { CATEGORIES } from "../data/seed";
import { Btn, Field } from "../components/ui";
import { StudioCanvas } from "../components/StudioCanvas";
import { StudioPhoto } from "../components/StudioPhoto";
import { StudioSEO } from "../components/StudioSEO";

type Media = { type: "image" | "video"; url: string; name: string };

type Draft = {
  media: Media[];
  name: string;
  category: string;
  price: string;
  materials: string[];
  style: string;
  color: string;
  size: string;
  weight: string;
  specs: { id: string; key: string; value: string }[];
  description: string;
  sellerCity: string;
  processingDays: string;
  deliveryPickup: boolean;
  deliveryCourier: boolean;
  deliveryRussia: boolean;
  instant: boolean;
  deliveryZoneText: string;
  serviceMode: "online" | "visit" | "both";
  manufacturer: string;
  sku: string;
  tags: string[];
};

const empty: Draft = {
  media: [],
  name: "",
  category: CATEGORIES[0]?.name || "",
  price: "",
  materials: [],
  style: "",
  color: "",
  size: "",
  weight: "",
  specs: [],
  description: "",
  manufacturer: "",
  sku: "",
  tags: [],
  sellerCity: "",
  processingDays: "1",
  deliveryPickup: false,
  deliveryCourier: false,
  deliveryRussia: true,
  instant: false,
  deliveryZoneText: "",
  serviceMode: "both",
};

export function ProductEditorPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const acc = useSellerAccount();
  const sellerReg = useSellerReg();
  const fileRef = useRef<HTMLInputElement>(null);
  const autoSaveTimerRef = useRef<number | null>(null);

  const [draft, setDraft] = useState<Draft>(empty);
  const [studioOpen, setStudioOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [seoOpen, setSeoOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [savedDraft, setSavedDraft] = useState(false);
  const [published, setPublished] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const editItem = id ? acc.products.find((pp) => pp.id === id) : undefined;

  useEffect(() => {
    if (editItem) {
      setDraft({
        ...empty,
        media: editItem.media || [],
        name: editItem.name,
        category: editItem.category,
        price: String(editItem.price),
        materials: editItem.materials || [],
        style: editItem.style || "",
        color: editItem.color || "",
        size: editItem.size || "",
        weight: editItem.weight ? String(editItem.weight) : "",
        tags: editItem.tags || [],
        manufacturer: editItem.manufacturer || "",
        sku: editItem.sku || "",
        specs: (editItem.specs || []).map((sp: any) => ({ id: sp.id || "spec-" + Math.random().toString(36).slice(2), key: sp.key || "", value: sp.value || "" })),
        description: editItem.description || "",
        sellerCity: editItem.sellerCity || sellerReg.city || "",
      });
    } else {
      setDraft({ ...empty, sellerCity: sellerReg.city || "" });
    }
  }, [editItem, sellerReg.city]);

  // Автосохранение при изменениях draft (кроме specs чтобы не схлопывались поля)
  useEffect(() => {
    // Создаём объект без specs для триггера автосохранения
    const draftWithoutSpecs = {
      ...draft,
      specs: undefined,
    };
    autoSaveDraft();
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [
    draft.name,
    draft.category,
    draft.price,
    draft.description,
    draft.materials,
    draft.style,
    draft.color,
    draft.size,
    draft.weight,
    draft.media,
    draft.sellerCity,
    draft.instant,
  ]);

  // Сохранение при закрытии вкладки/переходе
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (draft.name.trim() || draft.media.length > 0 || draft.description.trim()) {
        const draftIdToUse = id || draftId || "d" + Date.now().toString(36);
        const data = {
          id: draftIdToUse,
          name: draft.name.trim() || "Без названия",
          category: draft.category,
          price: draft.price ? +draft.price : 0,
          description: draft.description.trim(),
          materials: draft.materials,
          style: draft.style || undefined,
          color: draft.color || undefined,
          size: draft.size || undefined,
          weight: draft.weight ? +draft.weight : undefined,
          specs: draft.specs.filter((s) => s.key.trim() && s.value.trim()).map(({ id, key, value }) => ({ id, key, value })),
          media: draft.media,
          sellerCity: draft.sellerCity,
          instant: draft.instant,
          isDraft: true,
          draftSavedAt: new Date().toISOString(),
          createdAt: editItem?.createdAt || new Date().toISOString(),
        };
        
        if (id) {
          acc.updateProduct(id, data);
        } else {
          if (!draftId) {
            acc.addProduct(data);
            setDraftId(draftIdToUse);
          } else {
            acc.updateProduct(draftId, data);
          }
        }
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [draft, id, draftId]);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const list = Array.from(files).slice(0, Math.max(0, 10 - draft.media.length));
    list.forEach((f) => {
      const r = new FileReader();
      r.onload = () => {
        setDraft({
          ...draft,
          media: [...draft.media, { type: f.type.startsWith("video") ? "video" : "image", url: r.result as string, name: f.name }],
        });
      };
      r.readAsDataURL(f);
    });
  };

  const removeMedia = (idx: number) => {
    setDraft({ ...draft, media: draft.media.filter((_, i) => i !== idx) });
  };

  // База знаний для "умных" подсказок ИИ
  const aiSuggestions = {
    vases: {
      material: "Керамика, шамотная глина",
      style: "Бохо, скандинавский минимализм",
      color: "Терракота, шалфей, натуральный",
      tags: ["ваза", "керамика", "ручная работа", "декор", "интерьер"],
      sizeHint: "Например: Ø 15 см, высота 25 см",
      weightHint: "Например: 1.2",
      description: `Уникальная [Название] ручной работы. Идеально дополнит интерьер в стиле [Стиль].

Особенности:
- Материал: [Материал]
- Уход: Протирать влажной тканью, беречь от ударов.

Каждое изделие уникально и может незначительно отличаться от фото.`
    },
    textile: {
      material: "100% хлопок, лен",
      style: "Скандинавский, прованс",
      color: "Натуральный, бежевый, молочный",
      tags: ["текстиль", "хлопок", "уют", "ручная работа", "эко"],
      sizeHint: "Например: 40x60 см",
      weightHint: "Например: 0.3",
      description: `Уютный текстиль ручной работы из натуральных материалов.

Особенности:
- Состав: [Материал]
- Уход: Бережная стирка при 30°C.

Создаст атмосферу тепла и комфорта в вашем доме.`
    },
    candles: {
      material: "Соевый воск, хлопковый фитиль",
      style: "Минимализм, лофт",
      color: "Белый, черный, пастельные тона",
      tags: ["свеча", "соевый воск", "аромат", "уют", "подарок"],
      sizeHint: "Например: Ø 7 см, высота 10 см",
      weightHint: "Например: 0.2",
      description: `Ароматическая свеча ручной работы из натурального воска.

Особенности:
- Материал: [Материал]
- Время горения: около 30-40 часов.

Идеальный подарок или элемент декора для создания атмосферы.`
    },
    toys: {
      material: "Дерево, гипоаллергенные краски",
      style: "Эко, Монтессори",
      color: "Натуральный, пастельный",
      tags: ["игрушка", "дерево", "эко", "для детей", "ручная работа"],
      sizeHint: "Например: 15x10x5 см",
      weightHint: "Например: 0.15",
      description: `Безопасная деревянная игрушка ручной работы.

Особенности:
- Материал: [Материал]
- Безопасность: Покрыта натуральным маслом или гипоаллергенной краской.

Развивает мелкую моторику и воображение ребенка.`
    },
    default: {
      material: "Натуральные материалы",
      style: "Универсальный, современный",
      color: "Уточняется",
      tags: ["ручная работа", "уникальный дизайн", "подарок", "авторская работа"],
      sizeHint: "Укажите точные габариты (ДхШхВ)",
      weightHint: "Укажите вес в кг",
      description: `Уникальное изделие ручной работы.

Особенности:
- Материал: [Материал]
- Уход: [Уточните правила ухода]

Сделано с любовью и вниманием к деталям.`
    }
  };

  const autoFillCharacteristics = () => {
    setIsAiLoading(true);
    
    setTimeout(() => {
      const cat = draft.category.toLowerCase();
      let suggestion = aiSuggestions.default;
      
      if (cat.includes("ваз") || cat.includes("кашпо")) suggestion = aiSuggestions.vases;
      else if (cat.includes("текстиль") || cat.includes("плед") || cat.includes("подушк")) suggestion = aiSuggestions.textile;
      else if (cat.includes("свеч") || cat.includes("мыло")) suggestion = aiSuggestions.candles;
      else if (cat.includes("игруш") || cat.includes("кукл")) suggestion = aiSuggestions.toys;

      setDraft({
        ...draft,
        materials: [suggestion.material],
        style: suggestion.style,
        color: suggestion.color,
        tags: suggestion.tags,
        size: suggestion.sizeHint,
        weight: suggestion.weightHint,
        description: suggestion.description.replace("[Название]", draft.name || "Изделие").replace("[Стиль]", suggestion.style).replace("[Материал]", suggestion.material),
      });
      
      setIsAiLoading(false);
      setSavedDraft(true);
      setTimeout(() => setSavedDraft(false), 2000);
    }, 1500);
  };

  const generateAIDescription = () => {
    const name = draft.name || "Этот товар";
    const mat = draft.materials[0] || "качественных материалов";
    const style = draft.style || "современном";
    
    const desc = `${name} — это идеальное сочетание стиля и функциональности. Изделие выполнено из ${mat} в ${style} стиле, что делает его отличным выбором для вашего интерьера или повседневного использования.

✅ Преимущества:
• Высокое качество исполнения и внимание к деталям.
• Экологичные и безопасные материалы.
• Эргономичный дизайн, проверенный временем.
• Подходит как для личного использования, так и в качестве стильного подарка.

📦 Комплектация: товар в фирменной упаковке, инструкция по уходу.

🚚 Доставка: отправляем в день заказа или на следующий день. Надежная упаковка гарантирует сохранность при транспортировке по всей России.`;
    
    setDraft({ ...draft, description: desc });
  };

  const handlePublish = () => {
    if (!draft.name.trim() || !draft.price || draft.media.length === 0) {
      alert("Заполните название, цену и загрузите хотя бы одно фото");
      return;
    }
    
    setPublishing(true);
    setTimeout(() => {
      const data = {
        id: id || "p" + Date.now().toString(36),
        name: draft.name.trim(),
        category: draft.category,
        price: +draft.price,
        description: draft.description.trim(),
        materials: draft.materials,
        style: draft.style || undefined,
        color: draft.color || undefined,
        size: draft.size || undefined,
        weight: draft.weight ? +draft.weight : undefined,
        specs: draft.specs.filter((s) => s.key.trim() && s.value.trim()).map(({ id, key, value }) => ({ id, key, value })),
        media: draft.media,
        sellerCity: draft.sellerCity,
        instant: draft.instant,
        isDraft: false,
        draftSavedAt: undefined,
        createdAt: editItem?.createdAt || new Date().toISOString(),
      };
      
      if (id) {
        acc.updateProduct(id, data);
      } else {
        acc.addProduct(data);
      }
      
      setPublishing(false);
      setPublished(true);
      setTimeout(() => navigate("/seller/dashboard"), 1500);
    }, 1000);
  };

  const handleSaveDraft = () => {
    const draftIdToUse = id || draftId || "d" + Date.now().toString(36);
    const data = {
      id: draftIdToUse,
      name: draft.name.trim() || "Без названия",
      category: draft.category,
      price: draft.price ? +draft.price : 0,
      description: draft.description.trim(),
      materials: draft.materials,
      style: draft.style || undefined,
      color: draft.color || undefined,
      size: draft.size || undefined,
      weight: draft.weight ? +draft.weight : undefined,
      specs: draft.specs.filter((s) => s.key.trim() && s.value.trim()).map(({ id, key, value }) => ({ id, key, value })),
      media: draft.media,
      sellerCity: draft.sellerCity,
      instant: draft.instant,
      isDraft: true,
      draftSavedAt: new Date().toISOString(),
      createdAt: editItem?.createdAt || new Date().toISOString(),
    };
    
    if (id) {
      acc.updateProduct(id, data);
    } else {
      if (!draftId) {
        // Первый раз создаём черновик
        acc.addProduct(data);
        setDraftId(draftIdToUse);
      } else {
        // Обновляем существующий черновик
        acc.updateProduct(draftId, data);
      }
    }
    
    setSavedDraft(true);
    setTimeout(() => setSavedDraft(false), 2000);
  };

  // Автосохранение черновика (вызывается при изменениях с дебаунсом)
  const autoSaveDraft = () => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = window.setTimeout(() => {
      // Автосохраняем только если есть хоть какие-то данные
      if (draft.name.trim() || draft.media.length > 0 || draft.description.trim()) {
        const draftIdToUse = id || draftId || "d" + Date.now().toString(36);
        const data = {
          id: draftIdToUse,
          name: draft.name.trim() || "Без названия",
          category: draft.category,
          price: draft.price ? +draft.price : 0,
          description: draft.description.trim(),
          materials: draft.materials,
          style: draft.style || undefined,
          color: draft.color || undefined,
          size: draft.size || undefined,
          weight: draft.weight ? +draft.weight : undefined,
          specs: draft.specs.filter((s) => s.key.trim() && s.value.trim()).map(({ id, key, value }) => ({ id, key, value })),
          media: draft.media,
          sellerCity: draft.sellerCity,
          instant: draft.instant,
          isDraft: true,
          draftSavedAt: new Date().toISOString(),
          createdAt: editItem?.createdAt || new Date().toISOString(),
        };
        
        if (id) {
          acc.updateProduct(id, data);
        } else {
          if (!draftId) {
            // Первый раз создаём черновик
            acc.addProduct(data);
            setDraftId(draftIdToUse);
          } else {
            // Обновляем существующий черновик
            acc.updateProduct(draftId, data);
          }
        }
      }
    }, 3000); // Сохраняем через 3 секунды после последнего изменения
  };

  return (
    <div className="min-h-screen bg-[#f5f1eb]">
      {/* Хедер страницы */}
      <div className="bg-white border-b border-line-soft sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/seller/dashboard")} className="w-9 h-9 rounded-lg bg-line-soft text-ink-mute hover:bg-line flex items-center justify-center cursor-pointer">
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="font-display font-bold text-[20px] text-ink">{id ? "Редактирование позиции" : "Создание позиции товара"}</h1>
              <p className="text-[12px] text-ink-soft">Заполните все блоки и опубликуйте товар</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSaveDraft} disabled={savedDraft} className="h-10 px-4 rounded-[10px] bg-line-soft text-ink font-bold hover:bg-line transition-colors disabled:opacity-50 cursor-pointer flex items-center">{savedDraft ? <><Check size={16} className="mr-2" /> Сохранено!</> : <><Save size={16} className="mr-2" /> Сохранить черновик</>}</button>
            <button onClick={handlePublish} disabled={publishing || published} className="h-10 px-4 rounded-[10px] bg-dark text-cream font-bold hover:bg-accent-deep transition-colors disabled:opacity-50 cursor-pointer flex items-center">
              {published ? <><Check size={16} className="mr-2" /> Опубликовано!</> : publishing ? "Публикация..." : <><Send size={16} className="mr-2" /> Опубликовать товар</>}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* БЛОК 1: МЕДИА */}
        <section className="bg-white rounded-2xl shadow-card p-6 border border-line-soft">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center font-bold text-[14px]">1</span>
              <h2 className="font-display font-bold text-[18px] text-ink">📸 Фото и видео товара</h2>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPhotoOpen(true)} className="h-9 px-3 rounded-[8px] bg-accent text-ink text-[11px] font-bold hover:bg-accent-deep hover:text-cream transition-colors cursor-pointer flex items-center gap-1.5">📸 ИИ-фотосессия</button>
              <button type="button" onClick={() => setStudioOpen(true)} className="h-9 px-3 rounded-[8px] bg-dark text-cream text-[11px] font-bold hover:bg-accent-deep transition-colors cursor-pointer flex items-center gap-1.5">🎨 Конструктор карточек</button>
            </div>
          </div>
          <p className="text-[13px] text-ink-soft mb-4">Загрузите до 10 файлов. Первое фото станет обложкой. Видео повышает конверсию на 30%.</p>
          
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mb-4">
            {draft.media.map((m, i) => (
              <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-line-soft group">
                {m.type === "video" ? (
                  <video src={m.url} className="w-full h-full object-cover" muted />
                ) : (
                  <img src={m.url} alt={m.name} className="w-full h-full object-cover" />
                )}
                {i === 0 && <span className="absolute top-1 left-1 text-[10px] font-bold bg-dark text-cream px-1.5 py-0.5 rounded">Обложка</span>}
                <button onClick={() => removeMedia(i)} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-error text-white flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer">×</button>
              </div>
            ))}
            {draft.media.length < 10 && (
              <label className="aspect-square rounded-xl border-2 border-dashed border-line-soft flex flex-col items-center justify-center gap-1 text-ink-mute hover:border-accent cursor-pointer transition-colors">
                <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} ref={fileRef} />
                <Upload size={20} />
                <span className="text-[10px] text-center">Загрузить</span>
              </label>
            )}
          </div>
          <p className="text-[11px] text-ink-mute bg-cream p-3 rounded-lg">💡 Совет: используйте качественные фото с разных ракурсов. ИИ-фотосессия поможет создать профессиональные сцены без студии.</p>
        </section>

        {/* БЛОК 2: ОСНОВНАЯ ИНФОРМАЦИЯ */}
        <section className="bg-white rounded-2xl shadow-card p-6 border border-line-soft">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center font-bold text-[14px]">2</span>
            <h2 className="font-display font-bold text-[18px] text-ink">📋 Основная информация</h2>
          </div>
          
          <div className="space-y-4">
            <Field label="Название товара *" hint="Минимум 3 символа. Используйте ключевые слова">
              <input className="field" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Например: Ваза керамическая «Утро» в стиле бохо, 25 см" maxLength={120} />
            </Field>

            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Категория *">
                <select className="field" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                  {CATEGORIES.map((c) => (
                    <option key={c.slug} value={c.name}>{c.emoji} {c.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Цена, ₽ *">
                <input className="field" inputMode="numeric" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value.replace(/\D/g, "") })} placeholder="4900" />
              </Field>
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
              <label className="text-[11.5px] font-bold text-ink-mute">Описание товара</label>
              <button type="button" onClick={generateAIDescription} className="h-8 px-3 rounded-[8px] bg-accent text-ink text-[11px] font-bold hover:bg-accent-deep hover:text-cream transition-colors cursor-pointer flex items-center gap-1.5">✨ Сгенерировать описание с AI</button>
            </div>
            <textarea className="field" rows={8} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Уникальная ручная работа. Идеально подойдёт для интерьера в стиле бохо..." />
          </div>
        </section>

        {/* БЛОК 3: ХАРАКТЕРИСТИКИ */}
        <section className="bg-white rounded-2xl shadow-card p-6 border border-line-soft">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center font-bold text-[14px]">3</span>
              <h2 className="font-display font-bold text-[18px] text-ink">📊 Характеристики товара</h2>
            </div>
            <button type="button" onClick={autoFillCharacteristics} className="h-9 px-3 rounded-[8px] bg-accent text-ink text-[11px] font-bold hover:bg-accent-deep hover:text-cream transition-colors cursor-pointer flex items-center gap-1.5">✨ Автозаполнить ИИ</button>
          </div>
          <p className="text-[13px] text-ink-soft mb-4">Заполните характеристики для лучшей видимости в поиске.</p>

          <div className="grid sm:grid-cols-2 gap-3 mb-4">
            <Field label="Материал">
              <input className="field" value={draft.materials[0] || ""} onChange={(e) => setDraft({ ...draft, materials: [e.target.value] })} placeholder="Керамика, дерево, металл..." />
            </Field>
            <Field label="Стиль">
              <input className="field" value={draft.style} onChange={(e) => setDraft({ ...draft, style: e.target.value })} placeholder="Бохо, лофт, сканди, минимализм..." />
            </Field>
            <Field label="Цвет">
              <input className="field" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} placeholder="Шалфей, терракота, графит..." />
            </Field>
            <Field label="Размер / Габариты">
              <input className="field" value={draft.size} onChange={(e) => setDraft({ ...draft, size: e.target.value })} placeholder="Ø 20 см, 40×60×15 см..." />
            </Field>
            <Field label="Вес, кг">
              <input className="field" inputMode="decimal" value={draft.weight} onChange={(e) => setDraft({ ...draft, weight: e.target.value.replace(/[^\d.]/g, "") })} placeholder="1.2" />
            </Field>
          </div>

          <p className="text-[11px] font-bold text-ink-mute mb-2">Дополнительные параметры (ключ — значение)</p>
          {draft.specs.map((sp) => (
            <div key={sp.id} className="flex gap-2 mb-2">
              <input 
                className="field flex-1" 
                value={sp.key} 
                onChange={(e) => {
                  const newSpecs = draft.specs.map((s) => 
                    s.id === sp.id ? { ...s, key: e.target.value } : s
                  );
                  setDraft({ ...draft, specs: newSpecs });
                }} 
                placeholder="Параметр (например, Комплектация)" 
              />
              <input 
                className="field flex-1" 
                value={sp.value} 
                onChange={(e) => {
                  const newSpecs = draft.specs.map((s) => 
                    s.id === sp.id ? { ...s, value: e.target.value } : s
                  );
                  setDraft({ ...draft, specs: newSpecs });
                }} 
                placeholder="Значение" 
              />
              <button 
                type="button" 
                onClick={() => {
                  const newSpecs = draft.specs.filter((s) => s.id !== sp.id);
                  setDraft({ ...draft, specs: newSpecs });
                }} 
                className="w-9 h-9 shrink-0 rounded-[8px] bg-line-soft text-ink-mute hover:bg-error hover:text-white flex items-center justify-center cursor-pointer"
              >×</button>
            </div>
          ))}
          <button 
            type="button" 
            onClick={() => {
              const newSpecs = [...draft.specs, { id: "spec-" + Date.now().toString(36), key: "", value: "" }];
              setDraft({ ...draft, specs: newSpecs });
            }} 
            className="h-8 px-3 rounded-[8px] bg-line-soft text-[11.5px] font-bold text-ink-soft hover:bg-line cursor-pointer mb-4"
          >+ Добавить параметр</button>
        </section>

        {/* БЛОК 4: ЛОГИСТИКА */}
        <section className="bg-white rounded-2xl shadow-card p-6 border border-line-soft">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center font-bold text-[14px]">4</span>
            <h2 className="font-display font-bold text-[18px] text-ink">🚚 Логистика и условия продажи</h2>
          </div>
          
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <Field label="Город отправления">
              <input className="field" value={draft.sellerCity} onChange={(e) => setDraft({...draft, sellerCity: e.target.value})} placeholder="Москва" />
            </Field>
            <Field label="Срок обработки заказа (дней)">
              <input className="field" type="number" min="0" max="30" value={draft.processingDays || "1"} onChange={(e) => setDraft({...draft, processingDays: e.target.value})} />
            </Field>
          </div>

          <p className="text-[12px] font-bold text-ink-mute mb-2">СПОСОБЫ ДОСТАВКИ</p>
          <div className="space-y-2 mb-4">
            <label className="flex items-center gap-3 p-3 rounded-lg border border-line-soft hover:bg-surface-soft cursor-pointer">
              <input type="checkbox" checked={draft.deliveryPickup} onChange={(e) => setDraft({...draft, deliveryPickup: e.target.checked})} className="w-4 h-4 accent-dark" />
              <div>
                <span className="text-[13px] font-bold text-ink">Самовывоз</span>
                <p className="text-[11px] text-ink-soft">Покупатель забирает товар лично по адресу</p>
              </div>
            </label>
            <label className="flex items-center gap-3 p-3 rounded-lg border border-line-soft hover:bg-surface-soft cursor-pointer">
              <input type="checkbox" checked={draft.deliveryCourier} onChange={(e) => setDraft({...draft, deliveryCourier: e.target.checked})} className="w-4 h-4 accent-dark" />
              <div>
                <span className="text-[13px] font-bold text-ink">Курьер по городу</span>
                <p className="text-[11px] text-ink-soft">Доставка силами продавца или Яндекс.Доставки</p>
              </div>
            </label>
            <label className="flex items-center gap-3 p-3 rounded-lg border border-line-soft hover:bg-surface-soft cursor-pointer">
              <input type="checkbox" checked={draft.deliveryRussia} onChange={(e) => setDraft({...draft, deliveryRussia: e.target.checked})} className="w-4 h-4 accent-dark" />
              <div>
                <span className="text-[13px] font-bold text-ink">Доставка по РФ (СДЭК / Почта)</span>
                <p className="text-[11px] text-ink-soft">Отправка транспортными компаниями в любой регион</p>
              </div>
            </label>
            <label className="flex items-center gap-3 p-3 rounded-lg border border-line-soft hover:bg-surface-soft cursor-pointer">
              <input type="checkbox" checked={draft.instant} onChange={(e) => setDraft({...draft, instant: e.target.checked})} className="w-4 h-4 accent-dark" />
              <div>
                <span className="text-[13px] font-bold text-ink">⚡ Мгновенная цифровая доставка</span>
                <p className="text-[11px] text-ink-soft">Для цифровых товаров: файл приходит сразу после оплаты</p>
              </div>
            </label>
          </div>
        </section>

        {/* БЛОК 5: ПРЕДПРОСМОТР */}
        <section className="bg-white rounded-2xl shadow-card p-6 border border-line-soft">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center font-bold text-[14px]">5</span>
            <h2 className="font-display font-bold text-[18px] text-ink">👁 Предпросмотр карточки (как увидит покупатель)</h2>
          </div>
          
          <div className="bg-cream rounded-xl p-6 border border-line-soft">
            <div className="grid md:grid-cols-[300px_1fr] gap-6">
              <div className="aspect-square rounded-xl overflow-hidden bg-line-soft">
                {draft.media[0] ? (
                  draft.media[0].type === "video" ? (
                    <video src={draft.media[0].url} className="w-full h-full object-cover" muted />
                  ) : (
                    <img src={draft.media[0].url} alt="" className="w-full h-full object-cover" />
                  )
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-ink-mute">
                    <ImageIcon size={48} className="opacity-30" />
                  </div>
                )}
              </div>
              <div>
                <h3 className="font-display font-bold text-[20px] text-ink mb-2">{draft.name || "Название товара"}</h3>
                <p className="text-[24px] font-bold text-accent mb-3">{draft.price ? `${+draft.price.toLocaleString()} ₽` : "Цена"}</p>
                <p className="text-[13px] text-ink-soft mb-3">{draft.category}</p>
                {draft.description && (
                  <p className="text-[13px] text-ink-soft mb-4 whitespace-pre-wrap">{draft.description.slice(0, 300)}{draft.description.length > 300 ? "..." : ""}</p>
                )}
                {(draft.materials.length > 0 || draft.style || draft.color || draft.size) && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {draft.materials.map((m, i) => <span key={i} className="text-[11px] px-2 py-1 bg-line-soft rounded-full text-ink-soft">{m}</span>)}
                    {draft.style && <span className="text-[11px] px-2 py-1 bg-line-soft rounded-full text-ink-soft">{draft.style}</span>}
                    {draft.color && <span className="text-[11px] px-2 py-1 bg-line-soft rounded-full text-ink-soft">{draft.color}</span>}
                    {draft.size && <span className="text-[11px] px-2 py-1 bg-line-soft rounded-full text-ink-soft">{draft.size}</span>}
                  </div>
                )}
                <div className="text-[12px] text-ink-soft space-y-1">
                  <p>📍 {draft.sellerCity || "Город не указан"}</p>
                  <p> {draft.deliveryRussia ? "Доставка по РФ" : "Самовывоз"}</p>
                  <p>⏱ Обработка: {draft.processingDays || 1} дн.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Кнопки публикации */}
        <div className="flex gap-3 pb-8">
          <button onClick={() => navigate("/seller/dashboard")} className="h-10 px-4 rounded-[10px] bg-line-soft text-ink font-bold hover:bg-line transition-colors cursor-pointer">← Отмена</button>
          <button onClick={handlePublish} disabled={publishing || published} className="flex-1 h-10 px-4 rounded-[10px] bg-dark text-cream font-bold hover:bg-accent-deep transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center">
            {published ? <><Check size={16} className="mr-2" /> Опубликовано! Переход в кабинет...</> : publishing ? "Публикация..." : <><Send size={16} className="mr-2" /> Опубликовать товар</>}
          </button>
        </div>
      </div>

      {/* Модальные окна Студии */}
      <StudioCanvas open={studioOpen} onClose={() => setStudioOpen(false)} />
      <StudioPhoto open={photoOpen} onClose={() => setPhotoOpen(false)} onApply={(photo) => { setDraft({ ...draft, media: [...draft.media, { type: "image", url: photo, name: "from-photo-studio.jpg" }] }); setPhotoOpen(false); }} />
      <StudioSEO open={seoOpen} onClose={() => setSeoOpen(false)} initialName={draft.name} initialCategory={draft.category} onApply={(data) => { setDraft({ ...draft, name: data.name, description: data.description }); setSeoOpen(false); }} />
    </div>
  );
}
