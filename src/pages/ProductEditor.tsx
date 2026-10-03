import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Upload, Trash2, Sparkles, Check, Image as ImageIcon, Video, Save, Send } from "lucide-react";
import { useSellerAccount, useSellerReg, type SellerProductItem, type DeliveryZone } from "../lib/seller";
import { SpecGroupsEditor } from "../components/SpecGroupsEditor";
import { getGroupsForCategory, type SpecGroupDef, type SpecFieldDef } from "../lib/specSystem";
import { QualityScore } from "../components/QualityScore";
import { ProductViewCore } from "../components/ProductViewCore";
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
  const draftRef = useRef<Draft>(empty);
  const [studioOpen, setStudioOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [seoOpen, setSeoOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [savedDraft, setSavedDraft] = useState(false);
  const [published, setPublished] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const idRef = useRef(id);
  const draftIdRef = useRef(draftId);
  const [showPreview, setShowPreview] = useState(true);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const editItem = id ? acc.products.find((pp) => pp.id === id) : undefined;
  const isPublishedMode = !!(editItem && editItem.isDraft === false);
  // УМНАЯ ФОРМА: категория диктует набор полей
  const catGroup = CATEGORIES.find((c) => c.name === draft.category)?.group || "";
  const FIELD_VIS: Record<string, { mat?: boolean; style?: boolean; color?: boolean; size?: boolean; weight?: boolean; matLabel?: string }> = {
    // 🏺 Декор и дом: вазы, статуэтки, свечи — все физические атрибуты важны
    decor_home: { mat: true, style: true, color: true, size: false, weight: true },
    // 👗 Одежда и обувь: материал, цвет — критичны; размер = автоскрытие (sizes в группе); стиль и вес — редко
    clothing_shoes: { mat: true, style: false, color: true, size: false, weight: false },
    // 👜 Аксессуары: сумки, украшения, часы — материал, стиль, цвет; размер — опц.; вес не важен
    accessories: { mat: true, style: true, color: true, size: false, weight: false },
    // 📱 Техника: цвет + вес; материала/стиля/размера нет (есть габариты в группе)
    tech: { mat: false, style: false, color: true, size: false, weight: true },
    // 🔧 Фурнитура: крепёж, ручки — материал, цвет, размер, вес; стиль не нужен
    hardware: { mat: true, style: false, color: true, size: true, weight: true },
    // 🪴 Быт и сад: инструменты, горшки — материал, цвет, размер, вес; стиль не нужен
    home_garden: { mat: true, style: false, color: true, size: true, weight: true },
    // 🧴 Красота: косметика — СОСТАВ, цвет, вес; стиль/размер не нужны
    beauty: { mat: true, matLabel: "Состав / ингредиенты", style: false, color: true, size: false, weight: true },
    // 🎨 Хобби: рукоделие, игры — материал, стиль, цвет, размер; вес не важен
    hobby: { mat: true, style: true, color: true, size: true, weight: false },
    // 🧱 Стройматериалы: кирпич, доски — материал, цвет, размер, вес; стиль не нужен
    construction: { mat: true, style: false, color: true, size: true, weight: true },
    // 🖌️ Отделка: краски, плитка — материал, цвет, размер, вес; стиль не нужен
    finishing: { mat: true, style: false, color: true, size: true, weight: true },
    // 🛋️ Мебель и текстиль: всё показываем, размер = автоскрытие (sleepsize/section в группе)
    furniture_textile: { mat: true, style: true, color: true, size: false, weight: true },
    // 🚿 Сантехника: ванны, смесители — материал, цвет, размер, вес; стиль не нужен
    plumbing_comms: { mat: true, style: false, color: true, size: true, weight: true },
    // 🤖 Цифровые товары: сайты, промты — физ. полей НЕТ
    digital: { mat: false, style: false, color: false, size: false, weight: false },
    // 🛠️ Услуги мастеров: пошив, монтаж — физ. полей НЕТ
    services: { mat: false, style: false, color: false, size: false, weight: false },
    // 🍽️ Фудкорт: кухня, фермеры — СОСТАВ и вес (для доставки); стиль/цвет/размер не нужны
    foodcourt: { mat: true, matLabel: "Состав / ингредиенты", style: false, color: false, size: false, weight: true },
  };
  const vis = FIELD_VIS[catGroup] || { mat: true, style: true, color: true, size: true, weight: true };
  const DIM_IDS = ["height", "diameter", "leaf", "sleepsize", "section", "sizes"];
  const hasDims = getGroupsForCategory(draft.category).some((g: SpecGroupDef) => g.fields.some((f: SpecFieldDef) => DIM_IDS.includes(f.id)));
  const showMat = vis.mat !== false;
  const showStyle = vis.style !== false;
  const showColor = vis.color !== false;
  const showSize = vis.size !== false && !hasDims; // скрыт, если есть точные габариты в группах
  const showWeight = vis.weight !== false;
  const matLabel = vis.matLabel || "Материал";
  const showAnyBasic = showMat || showStyle || showColor || showSize || showWeight;

  // СИНХРОНИЗАЦИЯ REF ПРИ КАЖДОМ РЕНДЕРЕ (гарантированно актуальные данные, включая фото)
  draftRef.current = draft;
  idRef.current = id;
  draftIdRef.current = draftId;

  const isInitialized = useRef(false);

  // Инициализация draft ТОЛЬКО ОДИН РАЗ при маунте или смене editItem
  useEffect(() => {
    if (isInitialized.current) return; 
    
    if (editItem) {
      const loaded = {
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
      };
      setDraft(loaded);
      draftRef.current = loaded;
    } else {
      const emptyDraft = { ...empty, sellerCity: sellerReg.city || "" };
      setDraft(emptyDraft);
      draftRef.current = emptyDraft;
    }
    isInitialized.current = true;
  }, [editItem]); // Убрали sellerReg.city отсюда!

  // Отдельно обновляем город, если он загрузился позже, но только если поле пустое
  useEffect(() => {
    if (sellerReg.city && !draft.sellerCity) {
      setDraft(prev => ({ ...prev, sellerCity: sellerReg.city }));
    }
  }, [sellerReg.city, draft.sellerCity]);

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
    draft.manufacturer,
    draft.sku,
    draft.tags,
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
          isDraft: editItem ? editItem.isDraft !== false : true,
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

  // СОХРАНЕНИЕ ПРИ ВЫХОДЕ СО СТРАНИЦЫ (навигация внутри SPA)
  useEffect(() => {
    return () => {
      const currentDraft = draftRef.current;
      const currentId = idRef.current;
      const currentDraftId = draftIdRef.current;
      
      if (currentDraft.name.trim() || currentDraft.media.length > 0 || currentDraft.description.trim() || currentDraft.manufacturer || currentDraft.sku || (currentDraft.tags && currentDraft.tags.length > 0)) {
        const draftIdToUse = currentId || currentDraftId || "d" + Date.now().toString(36);
        // MERGE: берём существующий черновик из store, чтобы пустые поля НЕ затирали сохранённые
        const existing: any = useSellerAccount.getState().products.find((pp: any) => pp.id === draftIdToUse);
        // ОПУБЛИКОВАННЫЙ товар не трогаем при автосохранении выхода (иначе он станет черновиком)
        if (existing && existing.isDraft === false) return;
        const data = {
          id: draftIdToUse,
          name: currentDraft.name.trim() || existing?.name || "Без названия",
          category: currentDraft.category || existing?.category || "",
          price: currentDraft.price ? +currentDraft.price : (existing?.price || 0),
          description: currentDraft.description.trim() || existing?.description || "",
          materials: (currentDraft.materials && currentDraft.materials.length) ? currentDraft.materials : (existing?.materials || []),
          manufacturer: currentDraft.manufacturer || existing?.manufacturer || "",
          sku: currentDraft.sku || existing?.sku || "",
          tags: (currentDraft.tags && currentDraft.tags.length) ? currentDraft.tags : (existing?.tags || []),
          style: currentDraft.style || existing?.style || undefined,
          color: currentDraft.color || existing?.color || undefined,
          size: currentDraft.size || existing?.size || undefined,
          weight: currentDraft.weight ? +currentDraft.weight : (existing?.weight || undefined),
          specs: (currentDraft.specs && currentDraft.specs.some((sp: any) => sp.key.trim() && sp.value.trim())) ? currentDraft.specs.filter((sp: any) => sp.key.trim() && sp.value.trim()).map(({ id: specId, key, value }: any) => ({ id: specId, key, value })) : (existing?.specs || []),
          media: (currentDraft.media && currentDraft.media.length) ? currentDraft.media : (existing?.media || []),
          sellerCity: currentDraft.sellerCity || existing?.sellerCity || "",
          instant: currentDraft.instant ?? existing?.instant,
          isDraft: existing ? existing.isDraft !== false : true,
          draftSavedAt: new Date().toISOString(),
          createdAt: existing?.createdAt || new Date().toISOString(),
        };
        
        // Используем getState() для доступа к АКТУАЛЬНОМУ store (не через замыкание acc)
        const store = useSellerAccount.getState();
        if (currentId) {
          store.updateProduct(currentId, data);
        } else if (currentDraftId) {
          store.updateProduct(currentDraftId, data);
        } else {
          store.addProduct(data);
        }
      }
    };
  }, []);

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
    const name = draft.name.trim() || "Изделие";
    const mat = draft.materials.length ? draft.materials.join(", ") : "";
    const style = draft.style;
    const color = draft.color;
    const size = draft.size;
    const specs = draft.specs.filter((sp) => sp.key.trim() && sp.value.trim());
    const specsLines = specs.slice(0, 6).map((s) => `• ${s.key}: ${s.value}`).join("\n");
    const hasSpecs = specs.length > 0;
    const catObj = CATEGORIES.find((c) => c.name === draft.category);
    const group = catObj?.group || "";
    const matLine = mat ? ` Материалы: ${mat.toLowerCase()}.` : "";
    const styleLine = style ? ` Стиль — «${style}».` : "";
    const colorLine = color ? ` Цвет — ${color.toLowerCase()}.` : "";

    const T: Record<string, { e: string; ft: string; bt: string; intro: string; defFeats: string[]; bens: string[]; close: string }> = {
      tech: { e: "🔧", ft: "Ключевые характеристики", bt: "Почему выбирают", intro: `${name} — современное технологическое решение для требовательных пользователей.${styleLine} Надёжность, эргономика и продуманная функциональность.`, defFeats: ["Высокая производительность", "Энергоэффективность", "Современная элементная база", "Простота настройки"], bens: ["Гарантия качества и надёжности", "Поддержка производителя", "Совместимость со стандартами", "Долгий срок службы"], close: "📦 В комплекте: устройство, документация, фирменная упаковка.\n🚚 Отправка в день заказа по всей России." },
      decor_home: { e: "🏺", ft: "Особенности изделия", bt: "Для вашего дома", intro: `${name} — авторский предмет декора, который оживляет интерьер.${matLine}${styleLine} Каждая деталь продумана и сделана с любовью.`, defFeats: ["Ручная работа", "Уникальный дизайн", "Экологичные материалы", "Гармоничные пропорции"], bens: ["Преображает интерьер", "Создаёт уют и настроение", "Отличный подарок", "Долго радует глаз"], close: "🎁 Бережно упакуем для доставки или подарка.\n🚚 Отправка по всей России с надёжной упаковкой." },
      furniture_textile: { e: "🛋️", ft: "Параметры изделия", bt: "Почему это удобно", intro: `${name} — комфорт и стиль для вашего дома.${matLine}${styleLine} Продуманная эргономика и качественные материалы.`, defFeats: ["Прочная конструкция", "Износостойкие материалы", "Продуманная эргономика", "Лёгкий уход"], bens: ["Комфорт каждый день", "Долговечность", "Впишется в любой интерьер", "Практичность в уходе"], close: "🚚 Доставка в собранном или разобранном виде — как удобнее.\n📦 Надёжная упаковка гарантирует сохранность." },
      clothing_shoes: { e: "👗", ft: "Детали изделия", bt: "Преимущества", intro: `${name} — стиль и комфорт в каждой детали.${matLine}${styleLine}${colorLine}`, defFeats: ["Аккуратные швы и фурнитура", "Комфортная посадка", "Износостойкие материалы", "Лёгкий уход"], bens: ["Комфорт при носке весь день", "Сохраняет вид после стирки", "Универсальный стиль", "Подходит для любого случая"], close: "📏 Поможем подобрать размер — напишите нам.\n🚚 Быстрая отправка и примерка при получении." },
      accessories: { e: "👜", ft: "Особенности", bt: "Почему выбирают", intro: `${name} — аксессуар, который завершает образ.${matLine}${styleLine}${colorLine} Качество деталей и внимание к мелочам.`, defFeats: ["Качественная фурнитура", "Продуманная организация", "Износостойкие материалы", "Универсальный дизайн"], bens: ["Подходит к любому образу", "Вместительность и удобство", "Долговечность", "Статусный внешний вид"], close: "🎁 Упакуем в подарочный пакет по запросу.\n🚚 Отправка в день заказа." },
      hardware: { e: "🔩", ft: "Технические параметры", bt: "Почему выбирают", intro: `${name} — надёжное решение для монтажа и сборки.${matLine} Проверенное качество и точность изготовления.`, defFeats: ["Точные размеры и допуски", "Коррозийная стойкость", "Высокая нагрузочная способность", "Простой монтаж"], bens: ["Надёжность крепления", "Долгий срок службы", "Совместимость со стандартами", "Проверенный производитель"], close: "📦 Комплектация согласно спецификации.\n🚚 Отгрузка со склада в день заказа." },
      home_garden: { e: "🪴", ft: "Особенности", bt: "Преимущества", intro: `${name} — практичный помощник для дома и сада.${matLine} Удобство, надёжность и продуманность.`, defFeats: ["Прочные материалы", "Удобство в использовании", "Компактное хранение", "Лёгкий уход"], bens: ["Экономит время и силы", "Служит несколько сезонов", "Безопасен для семьи и питомцев", "Универсальное применение"], close: "📦 Компактная упаковка для удобной доставки.\n🚚 Отправка по всей России." },
      beauty: { e: "🧴", ft: "Состав и действие", bt: "Почему выбирают", intro: `${name} — забота о вашей красоте и самочувствии.${matLine} Мягкие формулы и продуманный состав.`, defFeats: ["Натуральные компоненты", "Без агрессивных добавок", "Подходит для ежедневного ухода", "Приятная текстура и аромат"], bens: ["Видимый результат", "Безопасный состав", "Комфорт в применении", "Подходит для чувствительной кожи"], close: "🧴 Гигиеничная упаковка сохраняет свойства.\n🚚 Отправка с соблюдением условий хранения." },
      hobby: { e: "🎨", ft: "Особенности набора", bt: "Почему это увлекает", intro: `${name} — для творчества и вдохновения.${matLine}${styleLine} Качество, которое ценят мастера и новички.`, defFeats: ["Всё необходимое в комплекте", "Качественные материалы", "Понятная инструкция", "Подходит для любого уровня"], bens: ["Развивает навыки", "Отвлекает от рутины", "Готовый результат радует", "Отличный подарок творческим людям"], close: "🎨 Дополнения и расходники всегда в наличии.\n🚚 Бережная упаковка и быстрая отправка." },
      construction: { e: "🧱", ft: "Технические характеристики", bt: "Почему выбирают", intro: `${name} — прочность и надёжность для вашего объекта.${matLine} Соответствие стандартам и стабильное качество.`, defFeats: ["Высокая прочность", "Стойкость к нагрузкам", "Долговечность", "Соответствие ГОСТ"], bens: ["Проверенное качество", "Точная геометрия", "Удобство монтажа", "Долгий срок службы"], close: "🚚 Доставка на объект по графику.\n📦 Паллетная упаковка для сохранности." },
      finishing: { e: "🖌️", ft: "Характеристики покрытия", bt: "Преимущества отделки", intro: `${name} — эстетика и долговечность отделки.${matLine}${styleLine} Ровное покрытие и стойкий цвет.`, defFeats: ["Стойкий цвет", "Ровное нанесение", "Влагостойкость", "Экологичный состав"], bens: ["Преображает интерьер", "Скрывает неровности", "Лёгкий уход", "Долго сохраняет вид"], close: "📦 Бесплатно поможем рассчитать количество.\n🚚 Отправка по всей России." },
      plumbing_comms: { e: "🚿", ft: "Технические параметры", bt: "Почему выбирают", intro: `${name} — надёжность инженерных систем вашего дома.${matLine} Точность изготовления и герметичность.`, defFeats: ["Герметичность соединений", "Стойкость к давлению", "Коррозийная стойкость", "Простой монтаж"], bens: ["Без протечек и поломок", "Долгий срок службы", "Совместимость с системами", "Гарантия производителя"], close: "📦 Комплектация: изделие, паспорт, крепёж.\n🚚 Отправка в день заказа." },
      digital: { e: "🤖", ft: "Что входит", bt: "Преимущества", intro: `${name} — цифровой продукт нового поколения.${styleLine} Мгновенный доступ после оплаты.`, defFeats: ["Полный исходный комплект", "Инструкция по установке", "Поддержка при запуске", "Обновления включены"], bens: ["Мгновенная доставка", "Не требует склада и логистики", "Масштабируемость", "Экономия времени"], close: "⚡ Файл придёт сразу после оплаты.\n💬 Поддержка в чате 7 дней после покупки." },
      services: { e: "🛠️", ft: "Что входит в услугу", bt: "Почему доверяют", intro: `${name} — профессиональное выполнение под ключ.${matLine} Опыт, аккуратность и соблюдение сроков.`, defFeats: ["Консультация и замер", "Выполнение под ключ", "Уборка после работ", "Гарантия на работы"], bens: ["Опытные мастера", "Соблюдение сроков", "Прозрачная смета", "Гарантия результата"], close: "📅 Запись на удобное время в чате.\n📍 Работаем по городу и области." },
      foodcourt: { e: "🍽️", ft: "Состав и особенности", bt: "Почему выбирают", intro: `${name} — свежесть и вкус домашней кухни.${matLine} Готовим из проверенных локальных продуктов.`, defFeats: ["Натуральные ингредиенты", "Без консервантов", "Готовим в день заказа", "Порции как дома"], bens: ["Свежесть каждый день", "Домашний вкус", "Честные порции", "Гигиеничная упаковка"], close: "🍽 Доставка по слотам — выберите удобное время.\n❄️ Термоупаковка сохраняет температуру." },
      default: { e: "📋", ft: "Особенности", bt: "Преимущества", intro: `${name} — качественное изделие, созданное с вниманием к деталям.${matLine}${styleLine}`, defFeats: ["Продуманные пропорции", "Качественное исполнение", "Внимание к деталям", "Универсальное применение"], bens: ["Высокое качество", "Экологичность", "Долговечность", "Подходит в качестве подарка"], close: "📦 Фирменная упаковка, инструкция по уходу.\n🚚 Отправка в день заказа по России." },
    };

    const t = T[group] || T.default;
    const feats = hasSpecs ? specsLines : t.defFeats.map((f) => "• " + f).join("\n");
    const bens = t.bens.map((b) => "• " + b).join("\n");
    const extra = [size ? `• Размер: ${size}` : "", color && group !== "clothing_shoes" && group !== "accessories" ? `• Цвет: ${color}` : ""].filter(Boolean).join("\n");
    const desc = `${t.intro}\n\n${t.e} ${t.ft}:\n${feats}${extra ? "\n" + extra : ""}\n\n✅ ${t.bt}:\n${bens}\n\n${t.close}`;
    setDraft({ ...draft, description: desc });
  };

  const handlePublish = () => {
    if (!draft.name.trim() || !draft.price || draft.media.length === 0) {
      alert("Заполните название, цену и загрузите хотя бы одно фото");
      return;
    }
    
    setPublishing(true);
    setTimeout(() => {
      // Единый id: URL -> черновик -> новый
      const finalId = id || draftId || "p" + Date.now().toString(36);
      const data = {
        id: finalId,
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
        manufacturer: draft.manufacturer || undefined,
        sku: draft.sku || undefined,
        tags: draft.tags || [],
        sellerCity: draft.sellerCity,
        instant: draft.instant,
        isDraft: false,
        draftSavedAt: undefined,
        createdAt: editItem?.createdAt || new Date().toISOString(),
      };
      
      // Всегда обновляем существующую запись (addProduct только для brand-new)
      const existing = acc.products.find((x) => x.id === finalId);
      if (existing) {
        acc.updateProduct(finalId, data);
      } else {
        acc.addProduct(data);
      }
      
      // Обновляем URL чтобы не создавать дубликаты при следующем автосохранении
      if (!id) {
        navigate(`/seller/product/${finalId}/edit`, { replace: true });
      }
      
      setPublishing(false);
      setPublished(true);
      // Очищаем pending-буфер
      localStorage.removeItem(`pending-${finalId}`);
      setTimeout(() => navigate("/seller/dashboard"), 1500);
    }, 1000);
  };

  const handleSaveDraft = () => {
    const currentDraft = draftRef.current;
    const draftIdToUse = id || draftId || "d" + Date.now().toString(36);
    const data = {
      id: draftIdToUse,
      name: currentDraft.name.trim() || "Без названия",
      category: currentDraft.category,
      price: currentDraft.price ? +currentDraft.price : 0,
      description: currentDraft.description.trim(),
      materials: currentDraft.materials,
      style: currentDraft.style || undefined,
      color: currentDraft.color || undefined,
      size: currentDraft.size || undefined,
      weight: currentDraft.weight ? +currentDraft.weight : undefined,
      specs: currentDraft.specs.filter((s) => s.key.trim() && s.value.trim()).map(({ id, key, value }) => ({ id, key, value })),
      media: currentDraft.media,
      sellerCity: currentDraft.sellerCity,
      instant: currentDraft.instant,
      isDraft: editItem ? editItem.isDraft !== false : true,
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
      const currentDraft = draftRef.current;
      if (currentDraft.name.trim() || currentDraft.media.length > 0 || currentDraft.description.trim()) {
        // РЕЖИМ 1: Редактируем ОПУБЛИКОВАННЫЙ товар — сохраняем в pending-буфер (не трогаем products[])
        if (isPublishedMode && id) {
          try {
            localStorage.setItem(`pending-${id}`, JSON.stringify(currentDraft));
            console.log(`💾 Pending сохранён для товара ${id}`);
          } catch (e) { console.warn(e); }
          setSavedDraft(true);
          setTimeout(() => setSavedDraft(false), 2000);
          return;
        }
        
        // РЕЖИМ 2: Новый товар или черновик — сохраняем в products[]
        const draftIdToUse = id || draftId || "d" + Date.now().toString(36);
        const data = {
          id: draftIdToUse,
          name: currentDraft.name.trim() || "Без названия",
          category: currentDraft.category,
          price: currentDraft.price ? +currentDraft.price : 0,
          description: currentDraft.description.trim(),
          materials: currentDraft.materials,
          style: currentDraft.style || undefined,
          color: currentDraft.color || undefined,
          size: currentDraft.size || undefined,
          weight: currentDraft.weight ? +currentDraft.weight : undefined,
          specs: currentDraft.specs.filter((s) => s.key.trim() && s.value.trim()).map(({ id, key, value }) => ({ id, key, value })),
          media: currentDraft.media,
          sellerCity: currentDraft.sellerCity,
          instant: currentDraft.instant,
          isDraft: editItem ? editItem.isDraft !== false : true,
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
      <QualityScore draft={draft} importantLabels={getGroupsForCategory(draft.category).flatMap((g: SpecGroupDef) => g.fields.filter((f: SpecFieldDef) => f.important && !(f.hideIf && f.hideIf.test(draft.category))).map((f: SpecFieldDef) => f.unit ? `${f.label}, ${f.unit}` : f.label))} />

      {/* Хедер страницы */}
      <div className="bg-white border-b border-line-soft">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/seller/dashboard")} className="w-9 h-9 rounded-lg bg-line-soft text-ink-mute hover:bg-line flex items-center justify-center cursor-pointer">
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="font-display font-bold text-[20px] text-ink">{isPublishedMode ? "Редактирование опубликованной позиции" : (id ? "Редактирование черновика" : "Создание позиции товара")}</h1>
              <p className="text-[12px] text-ink-soft">Заполните все блоки и опубликуйте товар</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSaveDraft} disabled={savedDraft} className="h-10 px-4 rounded-[10px] bg-line-soft text-ink font-bold hover:bg-line transition-colors disabled:opacity-50 cursor-pointer flex items-center">{savedDraft ? <><Check size={16} className="mr-2" /> Сохранено!</> : <><Save size={16} className="mr-2" /> Сохранить черновик</>}</button>
            {isPublishedMode ? (
              <button onClick={handlePublish} disabled={publishing} className="h-10 px-4 rounded-[10px] bg-accent text-ink font-bold hover:bg-accent-deep transition-colors disabled:opacity-50 cursor-pointer flex items-center">
                {publishing ? "Применение..." : <><Check size={16} className="mr-2" /> Применить изменения</>}
              </button>
            ) : (
              <button onClick={handlePublish} disabled={publishing || published} className="h-10 px-4 rounded-[10px] bg-dark text-cream font-bold hover:bg-accent-deep transition-colors disabled:opacity-50 cursor-pointer flex items-center">
                {published ? <><Check size={16} className="mr-2" /> Опубликовано!</> : publishing ? "Публикация..." : <><Send size={16} className="mr-2" /> Опубликовать товар</>}
              </button>
            )}
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
          <p className="text-[11px] text-ink-mute bg-cream p-3 rounded-lg">💡 Совет: используйте качественные фото с разных ракурсов при хорошем освещении — так товар выглядит дороже и получает больше заказов.</p>
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
            
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Производитель / Бренд" hint="Автозаполнено из профиля | Можно изменить">
                <input className="field" value={draft.manufacturer} onChange={(e) => setDraft({ ...draft, manufacturer: e.target.value })} placeholder="Например: Мастерская «Утро», ИП Иванова" />
              </Field>
              <Field label="Артикул (SKU)">
                <div className="flex gap-2">
                  <input className="field flex-1" value={draft.sku} onChange={(e) => setDraft({ ...draft, sku: e.target.value })} placeholder="SP-123456" />
                  <button type="button" onClick={() => setDraft({ ...draft, sku: "SP-" + Math.floor(100000 + Math.random() * 900000) })} className="h-9 px-3 rounded-[8px] bg-line-soft text-ink-mute hover:bg-line cursor-pointer" title="Сгенерировать заново">🔄</button>
                </div>
              </Field>
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
              <label className="text-[11.5px] font-bold text-ink-mute">Описание товара</label>
              <button type="button" onClick={generateAIDescription} className="h-8 px-3 rounded-[8px] bg-accent text-ink text-[11px] font-bold hover:bg-accent-deep hover:text-cream transition-colors cursor-pointer flex items-center gap-1.5">✨ Сгенерировать описание с AI</button>
            </div>
            <textarea className="field" rows={8} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Уникальная ручная работа. Идеально подойдёт для интерьера в стиле бохо..." />
          </div>
                  {/* ТЕГИ */}
          <div className="mb-4">
            <Field label="Теги (ключевые слова для поиска)" hint="Максимум 10 тегов. Нажмите Enter или введите через запятую">
              <div className="flex flex-wrap gap-2 mb-2">
                {draft.tags.map((tag, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent/10 text-accent-deep text-[12px] font-medium border border-accent/20">
                    {tag}
                    <button type="button" onClick={() => setDraft({ ...draft, tags: draft.tags.filter((_, idx) => idx !== i) })} className="hover:text-error cursor-pointer">×</button>
                  </span>
                ))}
                {draft.tags.length < 10 && (
                  <input 
                    className="field flex-1 min-w-[120px] text-[13px] py-1" 
                    placeholder={draft.tags.length === 0 ? "Введите тег и нажмите Enter..." : "Ещё тег..."}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        const val = (e.target as HTMLInputElement).value.trim().replace(',', '');
                        if (val && !draft.tags.includes(val)) {
                          setDraft({ ...draft, tags: [...draft.tags, val] });
                          (e.target as HTMLInputElement).value = "";
                        }
                      }
                    }}
                    onBlur={(e) => {
                      const val = e.target.value.trim().replace(',', '');
                      if (val && !draft.tags.includes(val) && draft.tags.length < 10) {
                        setDraft({ ...draft, tags: [...draft.tags, val] });
                        e.target.value = "";
                      }
                    }}
                  />
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className="text-[11px] text-ink-mute mr-1">🏷️ Популярные:</span>
                {["ручная работа", "декор", "интерьер", "подарок", "эко", "дизайн"].map(t => (
                  <button key={t} type="button" onClick={() => {
                    if (!draft.tags.includes(t) && draft.tags.length < 10) {
                      setDraft({ ...draft, tags: [...draft.tags, t] });
                    }
                  }} className="text-[11px] px-2 py-0.5 rounded-full bg-line-soft text-ink-soft hover:bg-accent/10 hover:text-accent-deep transition-colors cursor-pointer">
                    + {t}
                  </button>
                ))}
              </div>
            </Field>
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

          {showAnyBasic && (
          <div className="grid sm:grid-cols-2 gap-3 mb-4">
            {showMat && (
            <Field label={matLabel}>
              <input className="field" value={draft.materials[0] || ""} onChange={(e) => setDraft({ ...draft, materials: [e.target.value] })} placeholder={matLabel !== "Материал" ? "Натуральные ингредиенты, состав..." : "Керамика, дерево, металл..."} />
            </Field>
            )}
            {showStyle && (
            <Field label="Стиль">
              <input className="field" value={draft.style} onChange={(e) => setDraft({ ...draft, style: e.target.value })} placeholder="Бохо, лофт, сканди, минимализм..." />
            </Field>
            )}
            {showColor && (
            <Field label="Цвет">
              <input className="field" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} placeholder="Шалфей, терракота, графит..." />
            </Field>
            )}
            {showSize && (
            <Field label="Размер / Габариты">
              <input className="field" value={draft.size} onChange={(e) => setDraft({ ...draft, size: e.target.value })} placeholder="Ø 20 см, 40×60×15 см..." />
            </Field>
            )}
            {showWeight && (
            <Field label="Вес изделия, кг">
              <input className="field" inputMode="decimal" value={draft.weight} onChange={(e) => setDraft({ ...draft, weight: e.target.value.replace(/[^\d.]/g, "") })} placeholder="1.2" />
            </Field>
            )}
          </div>
          )}

<SpecGroupsEditor key={draft.category} category={draft.category} specs={draft.specs} onChange={(next) => setDraft({ ...draft, specs: next })} />
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
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center font-bold text-[14px]">5</span>
              <h2 className="font-display font-bold text-[18px] text-ink">👁 Предпросмотр карточки</h2>
            </div>
            <button 
              type="button" 
              onClick={() => setShowPreview(!showPreview)} 
              className="h-8 px-3 rounded-[8px] bg-line-soft text-ink-mute text-[12px] font-bold hover:bg-line cursor-pointer flex items-center gap-1.5"
            >
              {showPreview ? "🙈 Скрыть" : "👁 Показать"}
            </button>
          </div>
          
          {showPreview && (
            <ProductViewCore
              name={draft.name}
              price={draft.price ? +draft.price : 0}
              media={draft.media}
              description={draft.description}
              categoryName={draft.category}
              manufacturer={draft.manufacturer}
              sku={draft.sku}
              tags={draft.tags}
              specs={draft.specs}
              sellerCity={draft.sellerCity}
              sellerName={(sellerReg as any)?.fullName || (sellerReg as any)?.name || (sellerReg as any)?.city || "Продавец"}
              processingDays={draft.processingDays}
            />
          )}
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
