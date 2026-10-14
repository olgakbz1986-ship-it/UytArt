/* ============================================================
   ЦИФРОВЫЕ ПРОДУКТЫ — модели данных (ТЗ §3)

   Пять базовых типов: site | prompt | skill | agent | subscription.
   Каждый продукт — самостоятельная сущность со строгим владельцем
   (ownerId), приватным файлом (fileUrl, вне публичной зоны),
   публичным превью (previewUrl), ценой, лицензией и версией.
   ============================================================ */

export type DigitalProductType = "site" | "prompt" | "skill" | "agent" | "subscription";
export type LicenseType = "personal" | "commercial" | "resell";
export type DigitalProductStatus = "published" | "archived";

export interface DigitalStats {
  downloads: number;
  revenue: number;
  rating: number;
  salesCount: number;
}

/** Базовый интерфейс любого цифрового продукта. */
export interface DigitalProduct {
  id: string;
  ownerId: string;
  type: DigitalProductType;
  title: string;
  description: string;
  price: number;              /* ₽ */
  licenseType: LicenseType;
  version: string;            /* "major.minor", напр. "1.0" */
  fileUrl: string;            /* приватный путь server/uploads/digital — НЕ отдаётся клиенту напрямую */
  previewUrl: string;         /* публичный путь /previews/... */
  stats: DigitalStats;
  testDriveLimit: number;     /* бесплатных тестов на пару userId+productId, по умолчанию 2 */
  status: DigitalProductStatus;
  createdAt: string;
  updatedAt: string;
}

/* ---------- специфичные расширения по типам ---------- */

export interface SiteProduct extends DigitalProduct {
  type: "site";
  techStack: string[];
  demoUrl?: string;
  includesSourceCode: boolean;
}

export type TargetAIModel = "gpt4" | "claude" | "midjourney" | "stable-diffusion" | "other";

export interface PromptProduct extends DigitalProduct {
  type: "prompt";
  /** Системный промт — секреты продавца. Сервер отдаёт ТОЛЬКО после покупки (hasDigitalAccess). */
  systemPrompt: string;
  exampleInputs: string[];
  exampleOutputs: string[];
  targetAI: TargetAIModel;
}

export type SkillFormat = "json" | "yaml" | "python";

export interface SkillProduct extends DigitalProduct {
  type: "skill";
  skillFormat: SkillFormat;
  compatibleAgents: string[];
  documentation: string;
}

export type ModelProvider = "openai" | "local" | "anthropic" | "other";

export interface AgentProduct extends DigitalProduct {
  type: "agent";
  /** Конфиг агента — секрет, выдаётся только покупателю через /content. */
  agentConfig: Record<string, unknown>;
  modelProvider: ModelProvider;
  requiresHosting: boolean;
  monthlyTokenLimit: number;
}

export type BillingCycle = "monthly" | "yearly";
export type SubscriptionTier = "basic" | "pro" | "enterprise";

export interface SubscriptionProduct extends DigitalProduct {
  type: "subscription";
  billingCycle: BillingCycle;
  includedProducts: string[];
  tier: SubscriptionTier;
  features: string[];
}

export type AnyDigitalProduct =
  | SiteProduct | PromptProduct | SkillProduct | AgentProduct | SubscriptionProduct;

/* ---------- покупки и доступ ---------- */

/** Единственный источник истины о праве доступа к продукту. */
export interface DigitalPurchase {
  id: string;
  userId: string;
  productId: string;
  purchasedAt: string;
  downloadCount: number;
  /** версия, купленная изначально (для бейджа «Доступно обновление») */
  purchasedVersion: string;
}

/* ---------- подписки как право доступа (§10) ---------- */

export type SubscriptionStatus = "active" | "cancelled" | "expired" | "past_due";

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  autoRenew: boolean;
  paymentMethodId?: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;               /* ₽ за период */
  billingCycle: BillingCycle;
  includedProducts: string[];
  features: string[];
  tier: SubscriptionTier;
}

/** Три публичных тарифа подписки на каталог цифровых продуктов. */
export const DIGITAL_SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "dsp-basic", name: "Basic", price: 990, billingCycle: "monthly",
    includedProducts: [], tier: "basic",
    features: ["Доступ к базовому каталогу подписки", "До 5 скачиваний в месяц", "Обновления включённых продуктов"],
  },
  {
    id: "dsp-pro", name: "Pro", price: 2490, billingCycle: "monthly",
    includedProducts: [], tier: "pro",
    features: ["Полный каталог подписки", "Безлимитные скачивания", "Ранний доступ к новинкам", "Приоритетная поддержка"],
  },
  {
    id: "dsp-enterprise", name: "Enterprise", price: 8900, billingCycle: "monthly",
    includedProducts: [], tier: "enterprise",
    features: ["Всё из Pro", "Коммерческая лицензия включена", "Персональный менеджер", "API-доступ к каталогу"],
  },
];

/* ---------- история версий (§11) ---------- */

export interface ProductVersion {
  id: string;
  productId: string;
  version: string;
  fileUrl: string;
  releasedAt: string;
}

/* ---------- цветовые акценты типов (ТЗ §14, Gumroad/PromptBase style) ---------- */

export const DIGITAL_TYPE_META: Record<DigitalProductType, { label: string; accentClass: string; icon: string }> = {
  prompt:       { label: "Промт",      accentClass: "bg-violet-500/15 text-violet-600 dark:text-violet-400", icon: "💬" },
  agent:        { label: "ИИ-агент",   accentClass: "bg-blue-500/15 text-blue-600 dark:text-blue-400",       icon: "🤖" },
  site:         { label: "Сайт/шаблон",accentClass: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", icon: "🌐" },
  skill:        { label: "Скилл",      accentClass: "bg-orange-500/15 text-orange-600 dark:text-orange-400", icon: "⚙️" },
  subscription: { label: "Подписка",   accentClass: "bg-amber-500/15 text-amber-600 dark:text-amber-400",    icon: "🎫" },
};

export const LICENSE_LABELS: Record<LicenseType, string> = {
  personal: "Личное использование",
  commercial: "Коммерческое использование",
  resell: "Перепродажа разрешена",
};

/** Разрешённые форматы файлов продукта по типу (валидация мастера создания). */
export const ALLOWED_FILE_FORMATS: Record<DigitalProductType, string[]> = {
  site: ["zip", "glb", "mp4"],
  prompt: ["txt", "json", "yaml"],
  skill: ["json", "yaml", "py"],
  agent: ["json", "yaml", "zip", "py"],
  subscription: ["zip", "json"],
};
