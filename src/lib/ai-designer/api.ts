/* ============================================================
   AI-дизайнер — внутренний backend-контракт (Этап 8).

   ВНИМАНИЕ: это НЕ внешние AI API. Это контракт внутреннего
   backend-прокси маркетплейса, через который позже пойдут
   боевые запросы к GigaChat / YandexGPT / Yandex Vision.

   Клиент никогда не хранит ключи и не ходит в сторонние
   AI-сервисы напрямую — только на свои /api/ai-designer/*.

   На этапе mock страница работает без бэкенда (MockAIProvider),
   но контракты зафиксированы здесь и совпадают с ТЗ §13.
   ============================================================ */

import type {
  ClarifyingQuestion, DesignPreferences, DesignerMode, DesignVariant,
  FashionAnalysisResult, InteriorAnalysisResult, ShoppingSet,
} from "./types";

export const AI_DESIGNER_API = {
  createProject: "/api/ai-designer/projects",                                   // POST
  analyze: (projectId: string) => `/api/ai-designer/projects/${projectId}/analyze`,        // POST
  generate: (projectId: string) => `/api/ai-designer/projects/${projectId}/generate`,      // POST
  selectVariant: (projectId: string, variantId: string) =>
    `/api/ai-designer/projects/${projectId}/variants/${variantId}/select`,                 // POST
  replaceObject: (projectId: string, variantId: string, objectId: string) =>
    `/api/ai-designer/projects/${projectId}/variants/${variantId}/objects/${objectId}/replace`, // POST
  editVariant: (projectId: string, variantId: string) =>
    `/api/ai-designer/projects/${projectId}/variants/${variantId}/edit`,                   // POST
  addToCart: (projectId: string) => `/api/ai-designer/projects/${projectId}/shopping-set/add-to-cart`, // POST
  projects: "/api/ai-designer/projects",                                       // GET список владельца
  project: (id: string) => `/api/ai-designer/projects/${id}`,                  // GET / DELETE
} as const;

/* ---------- контракты запросов/ответов (ТЗ §13) ---------- */
export interface CreateProjectRequest {
  mode: DesignerMode;
  sourceImageId: string;
  preferences: DesignPreferences;
}
export interface CreateProjectResponse { projectId: string; status: string }

export interface AnalyzeResponse {
  status: "clarifying" | "error";
  detected?: Partial<InteriorAnalysisResult> & Partial<FashionAnalysisResult>;
  questions?: ClarifyingQuestion[];
  error?: string;
}

export interface GenerateResponse { status: "variants"; variants: DesignVariant[] }

export interface SelectVariantResponse { status: "shopping"; shoppingSet: ShoppingSet }

export interface ReplaceProductRequest { productId: string }

export interface EditDesignRequest { objectId?: string; instruction: string }

export interface AddToCartRequest { productIds: string[]; mode: "all" | "selected" | "available" }

export interface AddToCartResponse {
  added: number;
  skippedUnavailable: number;
  cartVersion: number;
}

/* Единая обёртка ошибок: технические детали не попадают в UI (§16.2) */
export interface ApiError { ok: false; code: string; userMessage: string }
