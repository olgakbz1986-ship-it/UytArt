/* ============================================================
   AI-дизайнер — конфигурация провайдера.
   Сейчас: mock. Позже: gigachat | yandex | hybrid —
   без изменения UI и доменного слоя.
   ============================================================ */

export type AIProviderName = "mock" | "gigachat" | "yandex" | "hybrid";

const env = (import.meta as any).env || {};

export const AI_DESIGNER_CONFIG = {
  /** VITE_AI_DESIGNER_PROVIDER=mock (по умолчанию) */
  provider: (env.VITE_AI_DESIGNER_PROVIDER || "mock") as AIProviderName,
  /** искусственная задержка mock-ответов, мс */
  mockDelayMs: Number(env.VITE_AI_DESIGNER_MOCK_DELAY_MS || 1200),
  /** максимум вариантов (по ТЗ — всегда 3) */
  maxVariants: Number(env.VITE_AI_DESIGNER_MAX_VARIANTS || 3),
  /** максимум товаров на объект */
  maxProductsPerObject: Number(env.VITE_AI_DESIGNER_MAX_PRODUCTS_PER_OBJECT || 8),
  /** лимиты загрузки фото */
  upload: {
    maxBytes: 15 * 1024 * 1024, // 15 МБ
    formats: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
    extensions: [".jpg", ".jpeg", ".png", ".webp"],
    minLongSide: 1024, // рекомендуемое разрешение
  },
} as const;

export function delay(ms = AI_DESIGNER_CONFIG.mockDelayMs): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
