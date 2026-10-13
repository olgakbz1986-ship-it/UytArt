/* ============================================================
   AI-дизайнер — abstraction layer над AI-провайдерами.

   На текущем этапе реализован только MockAIProvider.
   Реальные вызовы GigaChat / YandexGPT / Yandex Vision
   подключаются позже через тот же интерфейс, выбор —
   через конфигурацию (VITE_AI_DESIGNER_PROVIDER).

   ЗАПРЕЩЕНО: внешние AI SDK и ключи в клиентском бандле.
   Все боевые запросы пойдут через backend-прокси /api/ai-designer.
   ============================================================ */

import type {
  AIProviderName,
} from "./config";
import type {
  ClarifyingQuestion,
  DesignEditInput,
  DesignEditResult,
  DesignObject,
  DesignObjectExtractionInput,
  DesignVariant,
  FashionAnalysisInput,
  FashionAnalysisResult,
  FashionGenerationInput,
  InteriorAnalysisInput,
  InteriorAnalysisResult,
  InteriorGenerationInput,
  ClarificationInput,
} from "./types";

export interface AIProvider {
  /** Имя провайдера для диагностики (в UI не показывается) */
  readonly name: AIProviderName;

  analyzeInteriorPhoto(input: InteriorAnalysisInput): Promise<InteriorAnalysisResult>;
  analyzeFashionPhoto(input: FashionAnalysisInput): Promise<FashionAnalysisResult>;
  generateInteriorVariants(input: InteriorGenerationInput): Promise<DesignVariant[]>;
  generateFashionVariants(input: FashionGenerationInput): Promise<DesignVariant[]>;
  extractDesignObjects(input: DesignObjectExtractionInput): Promise<DesignObject[]>;
  editDesign(input: DesignEditInput): Promise<DesignEditResult>;
  generateClarifyingQuestions(input: ClarificationInput): Promise<ClarifyingQuestion[]>;
}

export type {
  ClarifyingQuestion,
  DesignVariant,
  DesignObject,
};
