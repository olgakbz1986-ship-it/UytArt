/* ============================================================
   AI-дизайнер — доменные типы (изолированный модуль)
   Модель данных по ТЗ: DesignProject / DesignVariant /
   DesignObject / ProductMatch / ShoppingSet.
   ============================================================ */

export type DesignerMode = "interior" | "fashion";

export type ProjectStatus =
  | "idle"        // стартовый экран, выбор сценария
  | "uploading"   // загрузка и валидация фото
  | "analyzing"   // анализ фото
  | "clarifying"  // уточняющие вопросы
  | "generating"  // генерация трёх вариантов
  | "variants"    // выбор варианта
  | "grounding"   // product grounding
  | "shopping"    // shoppable-результат
  | "editing"     // точечное редактирование
  | "saved"       // проект сохранён
  | "error";      // ошибка с понятным действием

export type VariantIntensity = "soft" | "balanced" | "bold";

export const INTENSITY_LABEL_RU: Record<VariantIntensity, string> = {
  soft: "Мягкие изменения",
  balanced: "Сбалансированно",
  bold: "Выразительно",
};

export type Availability = "in_stock" | "low_stock" | "out_of_stock";

export interface Money {
  amount: number;
  currency: "RUB";
}

export interface BoundingBox {
  /* проценты от размеров изображения — маркеры адаптивны на любом экране */
  x: number;
  y: number;
  w: number;
  h: number;
}

export type InteriorObjectCategory =
  | "walls" | "wallpaper" | "floor" | "windows" | "curtains"
  | "sofa" | "chair" | "table" | "chairs" | "bed" | "storage"
  | "lighting" | "rug" | "textile" | "decor" | "vases" | "posters" | "plants";

export type FashionObjectCategory =
  | "outerwear" | "top" | "bottom" | "dress" | "shoes" | "bag"
  | "hat" | "jewelry" | "watch" | "glasses" | "belt";

export type DesignObjectCategory = InteriorObjectCategory | FashionObjectCategory;

export const CATEGORY_LABELS_RU: Record<string, string> = {
  /* интерьер */
  walls: "Стены", wallpaper: "Обои", floor: "Пол", windows: "Окна",
  curtains: "Шторы", sofa: "Диван", chair: "Кресло", table: "Стол",
  chairs: "Стулья", bed: "Кровать", storage: "Система хранения",
  lighting: "Освещение", rug: "Ковёр", textile: "Текстиль", decor: "Декор",
  vases: "Вазы", posters: "Картины и постеры", plants: "Растения",
  /* fashion */
  outerwear: "Верхняя одежда", top: "Верх", bottom: "Низ", dress: "Платье / комплект",
  shoes: "Обувь", bag: "Сумка", hat: "Головной убор", jewelry: "Украшения",
  watch: "Часы", glasses: "Очки", belt: "Ремень",
};

/* Группировка категорий для панели «Состав результата» */
export const INTERIOR_GROUPS: { title: string; cats: string[] }[] = [
  { title: "Стены", cats: ["walls", "wallpaper", "floor"] },
  { title: "Окна и шторы", cats: ["windows", "curtains"] },
  { title: "Мебель", cats: ["sofa", "chair", "table", "chairs", "bed", "storage"] },
  { title: "Освещение", cats: ["lighting"] },
  { title: "Текстиль", cats: ["rug", "textile"] },
  { title: "Декор", cats: ["decor", "vases", "posters", "plants"] },
];

export const FASHION_GROUPS: { title: string; cats: string[] }[] = [
  { title: "Верх", cats: ["top"] },
  { title: "Низ", cats: ["bottom", "dress"] },
  { title: "Обувь", cats: ["shoes"] },
  { title: "Верхняя одежда", cats: ["outerwear"] },
  { title: "Аксессуары", cats: ["bag", "hat", "jewelry", "watch", "glasses", "belt"] },
];

/* ---------- предпочтения пользователя ---------- */
export type BudgetTier = "low" | "mid" | "high" | "premium" | "any";

export const BUDGET_OPTIONS_INTERIOR: { id: BudgetTier; label: string }[] = [
  { id: "low", label: "До 50 000 ₽" },
  { id: "mid", label: "50 000–150 000 ₽" },
  { id: "high", label: "150 000–500 000 ₽" },
  { id: "premium", label: "Премиум" },
  { id: "any", label: "Без ограничений" },
];

export const BUDGET_OPTIONS_FASHION: { id: BudgetTier; label: string }[] = [
  { id: "low", label: "До 10 000 ₽" },
  { id: "mid", label: "10 000–30 000 ₽" },
  { id: "high", label: "30 000–100 000 ₽" },
  { id: "premium", label: "Премиум" },
  { id: "any", label: "Без ограничений" },
];

export interface DesignPreferences {
  /* интерьер */
  roomType?: string;
  style?: string;
  keep?: string[];      // что сохранить
  change?: string[];    // что изменить
  /* fashion */
  occasion?: string;
  season?: string;
  colors?: string[];
  avoid?: string[];
  sizes?: string;       // только с явного согласия пользователя
  /* общие */
  budget?: BudgetTier;
  freeText?: string;
}

export interface ClarifyingQuestion {
  id: "keep" | "budget" | "change" | "occasion" | "style" | "season" | "colors" | "avoid";
  title: string;
  type: "multi_select" | "single_select" | "text";
  options?: string[];
  placeholder?: string;
}

/* ---------- результаты анализа фото ---------- */
export interface PhotoQualityIssue {
  code: "too_large" | "bad_format" | "dark" | "blurred" | "overexposed"
      | "no_person" | "no_room" | "low_resolution";
  message: string;
}

export interface InteriorAnalysisResult {
  roomType: string;
  lighting: "low" | "medium" | "high";
  currentStyle: string;
  objects: string[];
  condition: { walls: string; floor: string; windows: string };
  constraints: string[];
  replaceable: string[];
  toKeep: string[];
}

export interface FashionAnalysisResult {
  pose: string;
  cameraAngle: string;
  lighting: "low" | "medium" | "high";
  personVisible: boolean;
  fullBody: boolean;
  currentStyle: string;
  palette: string[];
  tryOnLimitations: string[];
  suggestModelMode: boolean;
}

/* ---------- товарное соответствие ---------- */
export interface ProductMatch {
  productId: string;
  title: string;
  brand?: string;
  sellerId: string;
  price: Money;
  oldPrice?: Money;
  currency: "RUB";
  imageUrl: string;
  rating?: number;
  reviewsCount?: number;
  availability: Availability;
  matchScore: number;         // 0..100 — почему подходит, без «магии»
  matchReasons: string[];
  compatibilityScore: number; // 0..100 совместимость с комплектом
}

export interface DesignObject {
  id: string;
  variantId: string;
  label: string;
  category: DesignObjectCategory;
  bbox: BoundingBox;
  maskUrl?: string;
  description: string;
  productMatches: ProductMatch[];
  selectedProductId?: string;
  isRemovable: boolean;
  isEditable: boolean;
}

export interface DesignVariant {
  id: string;
  projectId: string;
  title: string;
  description: string;
  conceptTags: string[];
  changes: string[];
  estimatedBudget: Money;
  imageUrl: string;
  intensity: VariantIntensity;
  objects: DesignObject[];
  createdAt: string;
}

/* ---------- комплект для покупки ---------- */
export interface ShoppingSetItem {
  objectId: string;
  product: ProductMatch;
  qty: number;
}

export interface ShoppingSet {
  id: string;
  projectId: string;
  variantId: string;
  items: ShoppingSetItem[];
  totalPrice: Money;
  availableItemsCount: number;
  totalItemsCount: number;
}

/* ---------- проект ---------- */
export interface DesignProject {
  id: string;
  userId: string;
  mode: DesignerMode;
  status: ProjectStatus;
  sourceImageId: string;   // data-url на клиенте; на бэке — приватный объект
  preferences: DesignPreferences;
  variants: DesignVariant[];
  selectedVariantId?: string;
  shoppingSet?: ShoppingSet;
  modelMode?: boolean;     // fashion: примерка «на модели» без фото пользователя
  negativeNotes?: string[];// учитываются при повторной генерации
  createdAt: string;
  updatedAt: string;
}

/* ---------- контракты AI-провайдера ---------- */
export interface InteriorAnalysisInput { imageId: string; }
export interface FashionAnalysisInput { imageId: string; }
export interface InteriorGenerationInput {
  imageId: string;
  analysis: InteriorAnalysisResult;
  preferences: DesignPreferences;
  seed?: number;
  negativeNotes?: string[];
}
export interface FashionGenerationInput {
  imageId: string;
  analysis: FashionAnalysisResult;
  preferences: DesignPreferences;
  modelMode?: boolean;
  seed?: number;
  negativeNotes?: string[];
}
export interface DesignObjectExtractionInput {
  variantId: string;
  imageUrl: string;
  mode: DesignerMode;
}
export interface DesignEditInput {
  variantId: string;
  objectId?: string;
  instruction: string;
}
export interface DesignEditResult {
  imageUrl: string;
  updatedObjects: DesignObject[];
  note: string; // понятное объяснение, что изменилось
}
export interface ClarificationInput {
  mode: DesignerMode;
  analysis: InteriorAnalysisResult | FashionAnalysisResult;
}
