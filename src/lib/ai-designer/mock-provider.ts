/* ============================================================
   AI-дизайнер — MockAIProvider.

   Полностью соответствует интерфейсу AIProvider: позже боевые
   GigaChatProvider / YandexGPTProvider / YandexVisionProvider
   подставляются сюда без изменения UI.

   Поведение mock (ТЗ §15):
   - возвращает 3 варианта с реалистичными названиями/бюджетами;
   - детерминирован по seed («сделать похожий вариант»);
   - создаёт 5–10 объектов на изображение;
   - подбирает РЕАЛЬНЫЕ товары из существующего каталога витрины
     (marketProducts) — никакой дублирующей корзины и своего каталога;
   - все тексты на русском.
   ============================================================ */

import type { AIProvider } from "./provider";
import { AI_DESIGNER_CONFIG, delay } from "./config";
import { marketProducts } from "../market";
import type { Product } from "../../data/seed";
import { CATEGORIES } from "../../data/seed";
import type {
  BudgetTier,
  ClarificationInput,
  ClarifyingQuestion,
  DesignEditInput,
  DesignEditResult,
  DesignObject,
  DesignObjectCategory,
  DesignObjectExtractionInput,
  DesignVariant,
  FashionAnalysisInput,
  FashionAnalysisResult,
  FashionGenerationInput,
  InteriorAnalysisInput,
  InteriorAnalysisResult,
  InteriorGenerationInput,
  Money,
  ProductMatch,
  VariantIntensity,
} from "./types";
import { CATEGORY_LABELS_RU } from "./types";

/* ---------- детерминированный PRNG (mulberry32) ---------- */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const hashStr = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};

/* ---------- категории товаров каталога для подбора ---------- */
interface CatRule { keywords: string[]; cats: string[] }

const INTERIOR_RULES: Record<string, CatRule> = {
  sofa:     { keywords: ["диван", "пуф", "кровать"], cats: ["furniture_textile"] },
  chair:    { keywords: ["кресло", "стул", "лавка"], cats: ["furniture_textile"] },
  table:    { keywords: ["стол", "кофейный", "журнальный", "подставка"], cats: ["furniture_textile", "decor_home"] },
  bed:      { keywords: ["кровать", "спальня"], cats: ["furniture_textile"] },
  storage:  { keywords: ["шкаф", "полка", "стеллаж", "комод", "корзина", "хранение"], cats: ["furniture_textile", "home_garden"] },
  lighting: { keywords: ["лампа", "свет", "люстра", "бра", "подсвечник", "свеча"], cats: ["plumbing_comms", "decor_home"] },
  rug:      { keywords: ["ковёр", "палас", "циновка"], cats: ["furniture_textile", "home_garden"] },
  curtains: { keywords: ["шторы", "занавес", "текстиль", "плед", "подушк", "бельё"], cats: ["furniture_textile"] },
  textile:  { keywords: ["подушк", "плед", "салфетк", "скатерть"], cats: ["furniture_textile"] },
  vases:    { keywords: ["ваза", "кашпо", "горшок"], cats: ["decor_home", "home_garden"] },
  posters:  { keywords: ["картин", "постер", "панно", "плакат"], cats: ["decor_home"] },
  decor:    { keywords: ["декор", "статуэтк", "фигурк", "сувенир", "зеркало", "рамк", "аромат", "свеч"], cats: ["decor_home"] },
  plants:   { keywords: ["растени", "цвет", "бонсай", "кашпо"], cats: ["home_garden", "decor_home"] },
  walls:    { keywords: ["панель", "облицовка", "лепнин", "3d"], cats: ["finishing", "construction", "decor_home"] },
  wallpaper:{ keywords: ["обои", "панель"], cats: ["finishing"] },
  floor:    { keywords: ["ковёр", "панно", "доска", "пиломатериал"], cats: ["finishing", "construction", "home_garden"] },
  windows:  { keywords: ["окно", "зеркало", "свет"], cats: ["construction", "decor_home"] },
};

const FASHION_RULES: Record<string, CatRule> = {
  top:       { keywords: ["блуз", "рубашк", "свитер", "джемпер", "футболк", "топ", "лонгслив", "худи"], cats: ["clothing_shoes"] },
  bottom:    { keywords: ["брюк", "джинс", "юбк", "шорт", "карго"], cats: ["clothing_shoes"] },
  dress:     { keywords: ["платье", "сарафан", "костюм"], cats: ["clothing_shoes"] },
  outerwear: { keywords: ["пальто", "куртк", "плащ", "пуховик", "жилет", "кардиган"], cats: ["clothing_shoes"] },
  shoes:     { keywords: ["обув", "туфли", "ботинк", "кроссовк", "сапог", "босоножк", "мокас", "sandali"], cats: ["clothing_shoes"] },
  bag:       { keywords: ["сумк", "шоппер", "рюкзак", "клатч", "кошел"], cats: ["accessories"] },
  hat:       { keywords: ["шапк", "шляп", "панама", "берет", "косынк"], cats: ["accessories", "clothing_shoes"] },
  jewelry:   { keywords: ["украшен", "кольц", "серьг", "ожерел", "браслет", "подвеск"], cats: ["accessories"] },
  watch:     { keywords: ["час", "наручные"], cats: ["accessories"] },
  glasses:   { keywords: ["очк"], cats: ["accessories"] },
  belt:      { keywords: ["ремень", "пояс"], cats: ["accessories"] },
};

/* ---------- подбор реальных товаров из витрины ---------- */
function norm(s: string) {
  return (s || "").toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9]+/g, " ");
}
const singularize = (w: string) =>
  w.replace(/ами$/, "а").replace(/ями$/, "я").replace(/ах$/, "а").replace(/ях$/, "я")
   .replace(/(ов|ев)ам$/, "$1").replace(/ам$/, "а").replace(/ям$/, "е")
   .replace(/ами$/, "а").replace(/ов$/, "").replace(/ев$/, "")
   .replace(/ы$/, "").replace(/и$/, "").replace(/а$/, "").replace(/е$/, "");

function toMatch(p: Product, reasons: string[], score: number, compat: number): ProductMatch {
  const availability: ProductMatch["availability"] =
    p.stock <= 0 ? "out_of_stock" : p.stock <= 3 ? "low_stock" : "in_stock";
  return {
    productId: p.id,
    title: p.name,
    brand: p.sub,
    sellerId: (p as any).ownerId || p.vendorId || "demo",
    price: { amount: p.price, currency: "RUB" } as Money,
    oldPrice: p.oldPrice ? { amount: p.oldPrice, currency: "RUB" } : undefined,
    currency: "RUB",
    imageUrl: p.image || "",
    rating: p.rating || undefined,
    reviewsCount: p.reviewsCount || undefined,
    availability,
    matchScore: score,
    matchReasons: reasons,
    compatibilityScore: compat,
  };
}

function pickProducts(category: string, styleHint: string, budget: BudgetTier, seed: number): ProductMatch[] {
  const rule = INTERIOR_RULES[category] || FASHION_RULES[category];
  if (!rule) return [];
  const r = rng(seed + hashStr(category));
  const all = marketProducts();
  /* ключевые слова в единственном числе для устойчивого совпадения */
  const kw = rule.keywords.map((k) => singularize(norm(k)));
  const textOf = (p: Product) => norm(p.name + " " + p.tags.join(" ") + " " + p.sub + " " + findGroupOf(p.categoryId));
  /* 1) совпадение по названию/тегам (подстрока — «диван» ловит «диваны») */
  const kwHits = all.filter((p) => { const t = textOf(p); return kw.some((k) => k.length >= 3 && t.includes(k)); });
  /* 2) внутри совпавших — товары стиля концепции */
  const sh = norm(styleHint || "");
  const styled = sh ? kwHits.filter((p) => norm(p.style).includes(sh)) : [];
  /* 3) пул группы как последний резерв */
  const groupPool = all.filter((p) => findGroupOf(p.categoryId) === rule.cats[0]);
  const base = styled.length >= 3 ? styled : kwHits.length >= 3 ? kwHits : groupPool;
  if (base.length === 0) return [];
  /* 4) бюджетная фильтрация */
  const cap = BUDGET_CAP[budget];
  const within = cap ? base.filter((p) => p.price <= cap * 3) : base; // ×3 — чтобы не остаться без пула
  const chosen = ((within.length >= 3 ? within : base)).slice(0, 60);
  /* детерминированное перемешивание */
  const shuffled = chosen.map((p, i) => ({ p, k: r() * 1000 + i })).sort((a, b) => a.k - b.k).map((x) => x.p);
  return shuffled.slice(0, AI_DESIGNER_CONFIG.maxProductsPerObject).map((p, i) => {
    const reasons: string[] = [];
    if (sh && norm(p.style).includes(sh)) reasons.push(`Стиль «${p.style}» совпадает с концепцией`);
    else reasons.push("Подходит по палитре и настроению концепции");
    if (kwHits.includes(p)) reasons.push("Категория товара точно соответствует объекту на изображении");
    reasons.push(i === 0 ? "Лучшее сочетание цены и наличия в вашем бюджете" : `Цена ${p.price.toLocaleString("ru-RU")} ₽ вписана в бюджет комплекта`);
    if (p.rating >= 4.5) reasons.push(`Высокий рейтинг продавца: ${p.rating.toFixed(1)}`);
    const score = Math.max(55, Math.round(97 - i * 5 - r() * 6));
    return toMatch(p, reasons, score, Math.max(60, Math.round(95 - i * 4 - r() * 8)));
  });
}

const BUDGET_CAP: Record<BudgetTier, number | null> = {
  low: 50000, mid: 150000, high: 500000, premium: null, any: null,
};

/* slug категории → id группы (для фильтрации пула) */
const groupCache = new Map<string, string>();
function findGroupOf(catSlug: string): string {
  if (groupCache.has(catSlug)) return groupCache.get(catSlug)!;
  const c = CATEGORIES.find((x) => x.slug === catSlug);
  const g = c ? c.group : "";
  groupCache.set(catSlug, g);
  return g;
}

/* ---------- макеты вариантов ---------- */
const INTERIOR_CONCEPTS: {
  title: string; description: string; tags: string[]; changes: string[];
  intensity: VariantIntensity; style: string; palette: [string, string];
}[] = [
  {
    title: "Тёплый минимализм",
    description: "Спокойная палитра, натуральные материалы и больше света. Диван заменён на компактную модель, добавлены тёплый свет и лёгкий текстиль.",
    tags: ["Минимализм", "Натуральные материалы", "Много света"],
    changes: ["Светлая отделка стен", "Деревянные акценты", "Компактный диван", "Тёплый сценарий освещения", "Лёгкий текстиль"],
    intensity: "soft", style: "Минимализм", palette: ["#efe9dc", "#c9b896"],
  },
  {
    title: "Современная классика",
    description: "Более собранная композиция, глубокие оттенки и выразительные детали: молдинги, плотный текстиль, акцентное освещение.",
    tags: ["Неоклассика", "Глубокие оттенки", "Выразительные детали"],
    changes: ["Акцентная стена с молдингами", "Плотный текстиль на окнах", "Обеденная группа из массива", "Декоративное освещение", "Картины в багете"],
    intensity: "balanced", style: "Неоклассика", palette: ["#e6ddd0", "#8d7a5f"],
  },
  {
    title: "Japandi",
    description: "Натуральное дерево, лаконичные формы, мягкий свет и минимум лишних предметов. Планировка и окна полностью сохранены.",
    tags: ["Джапанди", "Дерево и лён", "Воздух и порядок"],
    changes: ["Низкая мебель из светлого дерева", "Льняные шторы без рисунка", "Бумажные и латунные светильники", "Керамика ручной работы", "Одно крупное растение"],
    intensity: "bold", style: "Джапанди", palette: ["#ece5d3", "#a3b18a"],
  },
];

const FASHION_CONCEPTS: {
  title: string; description: string; tags: string[]; changes: string[];
  intensity: VariantIntensity; style: string; palette: [string, string];
}[] = [
  {
    title: "Спокойный smart casual",
    description: "Универсальный образ для встречи с друзьями: прямой крой, нейтральные оттенки и удобная обувь. Идентичность и пропорции сохранены.",
    tags: ["Smart casual", "Нейтральная палитра", "Комфорт"],
    changes: ["Рубашка приглушённого тона", "Брюки прямого кроя", "Кроссовки из натуральной кожи", "Минимальные аксессуары"],
    intensity: "soft", style: "Casual", palette: ["#e8e2d4", "#9aa5b1"],
  },
  {
    title: "Городской casual",
    description: "Расслабленный многослойный образ для города и непогоды: фактурный верх, практичный низ, вместительная сумка.",
    tags: ["Casual", "Многослойность", "Городской ритм"],
    changes: ["Свитер крупной вязки", "Джинсы прямого кроя", "Куртка-анорак", "Шоппер через плечо"],
    intensity: "balanced", style: "Лофт", palette: ["#dcd6cb", "#6b705c"],
  },
  {
    title: "Вечерний минимализм",
    description: "Сдержанная элегантность: чистые линии, глубокий однотонный комплект и акцентные украшения. Лицо и фигура без искажений.",
    tags: ["Вечерний", "Минимализм", "Акцент на деталях"],
    changes: ["Платье-комбинация или костюм", "Лоферы или туфли-миди", "Украшения из серебра", "Компактный клатч"],
    intensity: "bold", style: "Минимализм", palette: ["#d8d3da", "#4a4e69"],
  },
];

const INTERIOR_OBJECT_PLAN: { cat: DesignObjectCategory; bbox: [number, number, number, number]; desc: string }[] = [
  { cat: "sofa",     bbox: [10, 55, 34, 26], desc: "Основной посадочный объект в зоне отдыха" },
  { cat: "lighting", bbox: [62, 12, 16, 18], desc: "Верхний и локальный свет" },
  { cat: "rug",      bbox: [22, 80, 40, 14], desc: "Текстильное покрытие зоны" },
  { cat: "curtains", bbox: [74, 20, 20, 45], desc: "Оформление оконного проёма" },
  { cat: "table",    bbox: [46, 60, 20, 18], desc: "Столик в центре композиции" },
  { cat: "vases",    bbox: [50, 52, 10, 10], desc: "Декор на столешнице" },
  { cat: "posters",  bbox: [28, 18, 22, 20], desc: "Настенное оформление" },
  { cat: "plants",   bbox: [86, 58, 12, 26], desc: "Зелёный акцент у окна" },
];

const FASHION_OBJECT_PLAN: { cat: DesignObjectCategory; bbox: [number, number, number, number]; desc: string }[] = [
  { cat: "top",       bbox: [34, 18, 32, 26], desc: "Верхняя часть образа" },
  { cat: "bottom",    bbox: [36, 46, 28, 30], desc: "Низ образа" },
  { cat: "shoes",     bbox: [40, 80, 22, 12], desc: "Обувь" },
  { cat: "bag",       bbox: [66, 42, 16, 18], desc: "Сумка" },
  { cat: "outerwear", bbox: [26, 20, 14, 34], desc: "Верхняя одежда (слоем)" },
  { cat: "jewelry",   bbox: [46, 12, 10, 8],  desc: "Украшения" },
  { cat: "watch",     bbox: [68, 56, 8, 6],   desc: "Часы" },
];

/* SVG-превью концепции: исходное фото затемняется цветовой палитрой
   варианта — «результат редизайна» без хардкода картинок в UI. */
function conceptPreview(sourceImageId: string, palette: [string, string], title: string, mode: "interior" | "fashion"): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${palette[0]}"/><stop offset="1" stop-color="${palette[1]}"/>
  </linearGradient></defs>
  <rect width="800" height="600" fill="url(#g)"/>
  <image href="${sourceImageId.replace(/&/g, "&amp;")}" x="0" y="0" width="800" height="600" preserveAspectRatio="xMidYMid slice" opacity="0.55"/>
  <rect width="800" height="600" fill="url(#g)" opacity="0.28"/>
  <text x="28" y="566" font-family="Georgia, serif" font-size="30" fill="#1e1b14" opacity="0.85">${title}</text>
  <text x="28" y="596" font-family="sans-serif" font-size="15" fill="#1e1b14" opacity="0.55">${mode === "interior" ? "Концепция редизайна · планировка сохранена" : "Образ · идентичность сохранена"}</text>
</svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

/* ---------- вопросы уточнения (не более трёх за шаг) ---------- */
function interiorQuestions(): ClarifyingQuestion[] {
  return [
    { id: "keep", title: "Что важно сохранить?", type: "multi_select", options: ["Планировку", "Окна", "Пол", "Крупную мебель", "Цвет стен"] },
    { id: "budget", title: "Какой бюджет комплекта?", type: "single_select", options: ["До 50 000 ₽", "50 000–150 000 ₽", "150 000–500 000 ₽", "Премиум", "Без ограничений"] },
    { id: "change", title: "Что изменить в первую очередь?", type: "multi_select", options: ["Мебель", "Свет", "Текстиль", "Отделку", "Декор", "Всё"] },
  ];
}
function fashionQuestions(): ClarifyingQuestion[] {
  return [
    { id: "occasion", title: "Для какого повода нужен образ?", type: "single_select", options: ["Встреча с друзьями", "Работа", "Свидание", "Путешествие", "Повседневность", "Особое событие"] },
    { id: "style", title: "Какой стиль ближе?", type: "single_select", options: ["Минимализм", "Casual", "Smart casual", "Спортивный", "Вечерний", "Романтичный", "Дерзкий"] },
    { id: "budget", title: "Какой бюджет?", type: "single_select", options: ["До 10 000 ₽", "10 000–30 000 ₽", "30 000–100 000 ₽", "Премиум", "Без ограничений"] },
  ];
}

const BUDGET_LABEL_TO_TIER = (label?: string): BudgetTier => {
  if (!label) return "mid";
  if (label.startsWith("До")) return "low";
  if (label.includes("10 000–30") || label.includes("50 000–150")) return "mid";
  if (label.includes("30 000–100") || label.includes("150 000–500")) return "high";
  if (label === "Премиум") return "premium";
  return "any";
};

/* ============================================================
   MockAIProvider
   ============================================================ */
export class MockAIProvider implements AIProvider {
  readonly name = "mock" as const;

  async analyzeInteriorPhoto(_input: InteriorAnalysisInput): Promise<InteriorAnalysisResult> {
    await delay(700);
    return {
      roomType: "living_room",
      lighting: "medium",
      currentStyle: "нейтральный современный интерьер",
      objects: ["стена", "окно", "мебель", "освещение", "текстиль"],
      condition: { walls: "ровные, без отделки цветом", floor: "светлое покрытие, хорошее состояние", windows: "стандартный профиль, достаточно света" },
      constraints: ["несущая стена слева — не предлагается к изменению", "радиатор под окном — учитывается в расстановке"],
      replaceable: ["мягкая мебель", "освещение", "текстиль", "декор", "ковёр"],
      toKeep: ["планировка", "оконный проём", "дверной проём"],
    };
  }

  async analyzeFashionPhoto(_input: FashionAnalysisInput): Promise<FashionAnalysisResult> {
    await delay(700);
    return {
      pose: "стоя, анфас",
      cameraAngle: "на уровне груди",
      lighting: "medium",
      personVisible: true,
      fullBody: true,
      currentStyle: "повседневный",
      palette: ["нейтральные тона"],
      tryOnLimitations: ["рекомендуется фото в полный рост для точной примерки низа и обуви"],
      suggestModelMode: false,
    };
  }

  private buildVariants(
    concepts: typeof INTERIOR_CONCEPTS,
    plan: { cat: DesignObjectCategory; bbox: [number, number, number, number]; desc: string }[],
    imageId: string,
    projectId: string,
    prefs: { budget?: BudgetTier; style?: string },
    seed: number,
  ): DesignVariant[] {
    const now = new Date().toISOString();
    const budget = prefs.budget || "mid";
    return concepts.slice(0, AI_DESIGNER_CONFIG.maxVariants).map((c, vi) => {
      const vSeed = seed + vi * 977;
      const r = rng(vSeed);
      const variantId = `${projectId}-var-${vi + 1}`;
      const objects: DesignObject[] = plan.map((o, oi) => {
        const matches = pickProducts(o.cat, c.style, budget, vSeed + oi * 31);
        const id = `${variantId}-obj-${oi + 1}`;
        return {
          id,
          variantId,
          label: CATEGORY_LABELS_RU[o.cat] || o.cat,
          category: o.cat,
          bbox: { x: o.bbox[0], y: o.bbox[1], w: o.bbox[2], h: o.bbox[3] },
          description: o.desc,
          productMatches: matches,
          selectedProductId: matches[0]?.productId,
          isRemovable: o.cat !== "walls" && o.cat !== "windows",
          isEditable: true,
        } as DesignObject;
      }).filter((o) => o.productMatches.length > 0);
      const total = objects.reduce((s, o) => {
        const m = o.productMatches.find((x) => x.productId === o.selectedProductId) || o.productMatches[0];
        return s + (m?.price.amount || 0);
      }, 0);
      const budgetAdj = budget === "low" ? 0.7 : budget === "premium" || budget === "any" ? 1.25 : 1;
      const estimated = Math.round((total || 80000) * budgetAdj * (0.92 + r() * 0.16) / 100) * 100;
      return {
        id: variantId,
        projectId,
        title: c.title,
        description: c.description,
        conceptTags: c.tags,
        changes: c.changes,
        estimatedBudget: { amount: estimated, currency: "RUB" },
        imageUrl: conceptPreview(imageId, c.palette, c.title, concepts === INTERIOR_CONCEPTS ? "interior" : "fashion"),
        intensity: c.intensity,
        objects,
        createdAt: now,
      } as DesignVariant;
    });
  }

  async generateInteriorVariants(input: InteriorGenerationInput): Promise<DesignVariant[]> {
    await delay(AI_DESIGNER_CONFIG.mockDelayMs);
    const seed = input.seed ?? hashStr(input.imageId + JSON.stringify(input.preferences));
    return this.buildVariants(INTERIOR_CONCEPTS, INTERIOR_OBJECT_PLAN, input.imageId, "prj", {
      budget: input.preferences.budget, style: input.preferences.style,
    }, seed);
  }

  async generateFashionVariants(input: FashionGenerationInput): Promise<DesignVariant[]> {
    await delay(AI_DESIGNER_CONFIG.mockDelayMs);
    const seed = input.seed ?? hashStr(input.imageId + JSON.stringify(input.preferences));
    return this.buildVariants(FASHION_CONCEPTS, FASHION_OBJECT_PLAN, input.imageId, "prj", {
      budget: input.preferences.budget, style: input.preferences.style,
    }, seed);
  }

  async extractDesignObjects(input: DesignObjectExtractionInput): Promise<DesignObject[]> {
    /* grounding уже выполнен при генерации варианта — здесь только повторное ранжирование совместимости */
    await delay(500);
    const plan = input.mode === "interior" ? INTERIOR_OBJECT_PLAN : FASHION_OBJECT_PLAN;
    return plan.map((o, oi) => {
      const matches = pickProducts(o.cat, "", "mid", hashStr(input.variantId) + oi * 31);
      return {
        id: `${input.variantId}-obj-${oi + 1}`,
        variantId: input.variantId,
        label: CATEGORY_LABELS_RU[o.cat] || o.cat,
        category: o.cat,
        bbox: { x: o.bbox[0], y: o.bbox[1], w: o.bbox[2], h: o.bbox[3] },
        description: o.desc,
        productMatches: matches,
        selectedProductId: matches[0]?.productId,
        isRemovable: true,
        isEditable: true,
      } as DesignObject;
    });
  }

  async editDesign(input: DesignEditInput): Promise<DesignEditResult> {
    await delay(Math.round(AI_DESIGNER_CONFIG.mockDelayMs * 0.8));
    const instr = input.instruction.toLowerCase();
    let note = "Изменение применено локально — остальной дизайн не затронут.";
    const updated: DesignObject[] = [];
    if (instr.includes("светлее") || instr.includes("больше света")) {
      note = "Палитра осветлена, добавлен тёплый сценарий освещения. Архитектура и планировка не менялись.";
    } else if (instr.includes("тепл")) {
      note = "Палитра стала теплее: медовые и песочные оттенки. Состав товаров пересобран под новую палитру.";
    } else if (instr.includes("компакт")) {
      note = "Объект заменён на более компактный аналог из каталога. Габариты подобраны под свободную зону.";
    } else if (instr.includes("убер") || instr.includes("убері") || instr.includes("убрать")) {
      note = "Объект убран из композиции, связанные товары удалены из комплекта.";
    } else if (instr.includes("хранени") || instr.includes("больше хранения")) {
      note = "Добавлена система хранения: подобраны закрытые модели в стиле концепции.";
    } else if (instr.includes("вечерн")) {
      note = "Образ стал вечерним: глубже тон, чище линии, акцентные украшения.";
    } else if (instr.includes("сдержан") || instr.includes("строг")) {
      note = "Образ стал сдержаннее: нейтральная палитра, спокойный крой, минимум декора.";
    }
    updated.push(...[]); // объекты патчатся на стороне стора проекта
    void input.objectId;
    return { imageUrl: "", updatedObjects: updated, note };
  }

  async generateClarifyingQuestions(input: ClarificationInput): Promise<ClarifyingQuestion[]> {
    await delay(300);
    return input.mode === "interior" ? interiorQuestions() : fashionQuestions();
  }
}

/* ---------- фабрика провайдеров (боевые — заглушки до отдельной задачи) ---------- */
export function createAIProvider(): AIProvider {
  switch (AI_DESIGNER_CONFIG.provider) {
    case "gigachat":
    case "yandex":
    case "hybrid":
      /* Реальные провайдеры подключаются через backend-прокси /api/ai-designer.
         До отдельной задачи падаем на mock, чтобы UI оставался работоспособным. */
      console.warn(`[ai-designer] провайдер «${AI_DESIGNER_CONFIG.provider}» ещё не подключён — используется mock`);
      return new MockAIProvider();
    case "mock":
    default:
      return new MockAIProvider();
  }
}

export const aiDesignerProvider: AIProvider = createAIProvider();
export { BUDGET_LABEL_TO_TIER };
