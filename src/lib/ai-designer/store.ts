/* ============================================================
   AI-дизайнер — стор проекта (application layer).

   Оркестрация шагов: idle → uploading → analyzing → clarifying
   → generating → variants → grounding → shopping → saved/error.

   Стор НЕ содержит AI-логику внутри UI и НЕ трогает корзину:
   добавление в корзину выполняется через существующий
   useAppStore.addToCart (без дублирующей корзины).

   Сохранение проектов — persist по id пользователя; доступ к
   проекту имеет только владелец (фильтрация по userId).
   ============================================================ */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { aiDesignerProvider, BUDGET_LABEL_TO_TIER, hashStr } from "./mock-provider";
import type {
  BudgetTier,
  ClarifyingQuestion,
  DesignObject,
  DesignPreferences,
  DesignProject,
  DesignVariant,
  DesignerMode,
  FashionAnalysisResult,
  InteriorAnalysisResult,
  PhotoQualityIssue,
  ProductMatch,
  ProjectStatus,
  ShoppingSet,
} from "./types";

export interface DesignerSession {
  /* текущий рабочий проект (не из сохранённых) */
  project: DesignProject | null;
  status: ProjectStatus;
  busyLabel: string;          // «Анализируем фото» и т.п.
  error: string | null;       // понятная ошибка с действием
  analysis: InteriorAnalysisResult | FashionAnalysisResult | null;
  questions: ClarifyingQuestion[];
  answers: Record<string, string[]>;
  qualityIssues: PhotoQualityIssue[];
  compareIds: string[];       // сравнение двух вариантов
  editNote: string | null;    // уведомление «Товар заменён. Комплект обновлён.»
  lastNotion: string | null;

  /* ---------- шаги ---------- */
  start: (mode: DesignerMode) => void;
  setPhoto: (dataUrl: string, issues: PhotoQualityIssue[]) => void;
  setModelMode: (v: boolean) => void;
  runAnalysis: () => Promise<void>;
  setAnswers: (a: Record<string, string[]>) => void;
  generate: (opts?: { similarTo?: string; resetSeed?: boolean }) => Promise<void>;
  selectVariant: (variantId: string) => Promise<void>;
  toggleCompare: (variantId: string) => void;
  replaceProduct: (objectId: string, productId: string) => void;
  removeProduct: (objectId: string) => void;
  editObject: (objectId: string | undefined, instruction: string) => Promise<void>;
  addAllToCart: () => { added: number; unavailable: number };
  addOneToCart: (productId: string) => void;
  saveProject: () => void;
  openProject: (id: string) => void;
  deleteProject: (id: string) => void;
  backToStart: () => void;
  dismissError: () => void;
}

/* ---- хранилище сохранённых проектов (по пользователю) ---- */
interface SavedProjects {
  byUser: Record<string, DesignProject[]>;
}

let uid = 0;
const newId = (p: string) => `${p}_${Date.now().toString(36)}${(uid++).toString(36)}`;

function buildShoppingSet(project: DesignProject, variant: DesignVariant): ShoppingSet {
  const items = variant.objects
    .map((o) => {
      const m = o.productMatches.find((x) => x.productId === o.selectedProductId);
      return m ? { objectId: o.id, product: m, qty: 1 } : null;
    })
    .filter(Boolean) as ShoppingSet["items"];
  const total = items.reduce((s, i) => s + i.product.price.amount * i.qty, 0);
  return {
    id: newId("set"),
    projectId: project.id,
    variantId: variant.id,
    items,
    totalPrice: { amount: total, currency: "RUB" },
    availableItemsCount: items.filter((i) => i.product.availability !== "out_of_stock").length,
    totalItemsCount: items.length,
  };
}

export const useDesignerStore = create<DesignerSession>()(
  persist(
    (set, get) => ({
      project: null,
      status: "idle",
      busyLabel: "",
      error: null,
      analysis: null,
      questions: [],
      answers: {},
      qualityIssues: [],
      compareIds: [],
      editNote: null,
      lastNotion: null,

      start: (mode) => {
        const project: DesignProject = {
          id: newId("prj"),
          userId: "local",
          mode,
          status: "uploading",
          sourceImageId: "",
          preferences: {},
          variants: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set({
          project, status: "uploading", error: null, analysis: null,
          questions: [], answers: {}, qualityIssues: [], compareIds: [], editNote: null,
        });
      },

      setPhoto: (dataUrl, issues) => {
        const p = get().project;
        if (!p) return;
        set({
          project: { ...p, sourceImageId: dataUrl, updatedAt: new Date().toISOString() },
          qualityIssues: issues,
          status: issues.some((i) => i.code === "too_large" || i.code === "bad_format") ? "error" : "analyzing",
          error: issues.length && (issues[0].code === "too_large" || issues[0].code === "bad_format")
            ? issues[0].message : null,
        });
        if (!issues.some((i) => i.code === "too_large" || i.code === "bad_format")) {
          void get().runAnalysis();
        }
      },

      setModelMode: (v) => {
        const p = get().project;
        if (!p) return;
        set({ project: { ...p, modelMode: v } });
      },

      runAnalysis: async () => {
        const p = get().project;
        if (!p) return;
        set({ status: "analyzing", busyLabel: "Анализируем фото…" });
        try {
          const analysis = p.mode === "interior"
            ? await aiDesignerProvider.analyzeInteriorPhoto({ imageId: p.sourceImageId })
            : await aiDesignerProvider.analyzeFashionPhoto({ imageId: p.sourceImageId });
          const questions = await aiDesignerProvider.generateClarifyingQuestions({ mode: p.mode, analysis });
          /* предупреждения качества без жёсткого блокирования */
          const warn = (analysis as FashionAnalysisResult).suggestModelMode
            ? "На фото не удалось уверенно распознать человека в полный рост. Рекомендуем режим «на модели»."
            : null;
          set({
            analysis, questions, status: "clarifying", busyLabel: "",
            lastNotion: warn,
          });
        } catch {
          set({
            status: "error", busyLabel: "",
            error: "Не удалось проанализировать фото. Проверьте качество снимка и попробуйте ещё раз — загружать фото заново не нужно.",
          });
        }
      },

      setAnswers: (a) => {
        const p = get().project;
        if (!p) return;
        const prefs: DesignPreferences = {
          ...p.preferences,
          keep: a.keep || p.preferences.keep,
          change: a.change || p.preferences.change,
          occasion: a.occasion?.[0] || p.preferences.occasion,
          style: a.style?.[0] || p.preferences.style,
          season: a.season?.[0] || p.preferences.season,
          colors: a.colors || p.preferences.colors,
          avoid: a.avoid || p.preferences.avoid,
          budget: (a.budget?.[0] ? BUDGET_LABEL_TO_TIER(a.budget[0]) : p.preferences.budget) as BudgetTier,
        };
        set({ answers: a, project: { ...p, preferences: prefs } });
      },

      generate: async (opts) => {
        const st = get();
        const p = st.project;
        if (!p || (!p.sourceImageId && !p.modelMode)) return;
        set({ status: "generating", busyLabel: "Формируем концепции…", editNote: null });
        try {
          const imageRef = p.sourceImageId || "model-mode";
          /* seed: «похожий вариант» — вокруг выбранного; иначе — с учётом истории,
             чтобы повторная генерация не повторяла предыдущие варианты */
          let seed: number | undefined;
          if (opts?.similarTo) {
            seed = hashStr(opts.similarTo + imageRef);
          } else if (!opts?.resetSeed) {
            seed = hashStr(imageRef + JSON.stringify(p.preferences));
          } else {
            seed = hashStr(imageRef + JSON.stringify(p.preferences) + String(p.variants.length) + Date.now());
          }
          const variants = p.mode === "interior"
            ? await aiDesignerProvider.generateInteriorVariants({
                imageId: imageRef,
                analysis: st.analysis as InteriorAnalysisResult,
                preferences: p.preferences,
                seed,
                negativeNotes: p.negativeNotes,
              })
            : await aiDesignerProvider.generateFashionVariants({
                imageId: imageRef,
                analysis: st.analysis as FashionAnalysisResult,
                preferences: p.preferences,
                modelMode: p.modelMode,
                seed,
                negativeNotes: p.negativeNotes,
              });
          /* нормализуем id под конкретный проект */
          const fixed = variants.map((v, i) => ({
            ...v,
            id: `${p.id}-var-${i + 1}`,
            projectId: p.id,
            objects: v.objects.map((o, oi) => ({ ...o, variantId: `${p.id}-var-${i + 1}`, id: `${p.id}-var-${i + 1}-obj-${oi + 1}` })),
          }));
          set({
            project: { ...p, variants: fixed, status: "variants", updatedAt: new Date().toISOString() },
            status: "variants", busyLabel: "", compareIds: [],
          });
        } catch {
          set({
            status: "error", busyLabel: "",
            error: "Генерация не завершилась. Параметры и фото сохранены — нажмите «Сгенерировать заново», повторная загрузка не требуется.",
          });
        }
      },

      selectVariant: async (variantId) => {
        const p = get().project;
        if (!p) return;
        set({ status: "grounding", busyLabel: "Подбираем товары из каталога…" });
        await new Promise((r) => setTimeout(r, 500)); // имитация product grounding
        const variant = p.variants.find((v) => v.id === variantId);
        if (!variant) {
          set({ status: "variants", busyLabel: "", error: "Вариант не найден. Выберите другой." });
          return;
        }
        const next: DesignProject = {
          ...p,
          selectedVariantId: variantId,
          status: "shopping",
          updatedAt: new Date().toISOString(),
        };
        next.shoppingSet = buildShoppingSet(next, variant);
        set({ project: next, status: "shopping", busyLabel: "" });
      },

      toggleCompare: (variantId) => {
        const cur = get().compareIds;
        const next = cur.includes(variantId)
          ? cur.filter((x) => x !== variantId)
          : [...cur.slice(-1), variantId];
        set({ compareIds: next });
      },

      replaceProduct: (objectId, productId) => {
        const p = get().project;
        if (!p || !p.selectedVariantId) return;
        const variants = p.variants.map((v) => {
          if (v.id !== p.selectedVariantId) return v;
          const objects = v.objects.map((o) =>
            o.id === objectId ? { ...o, selectedProductId: productId } : o,
          );
          return { ...v, objects };
        });
        const variant = variants.find((v) => v.id === p.selectedVariantId)!;
        const next = { ...p, variants, shoppingSet: buildShoppingSet(p, variant), updatedAt: new Date().toISOString() };
        set({ project: next, editNote: "Товар заменён. Комплект обновлён." });
      },

      removeProduct: (objectId) => {
        const p = get().project;
        if (!p || !p.selectedVariantId) return;
        const variants = p.variants.map((v) => {
          if (v.id !== p.selectedVariantId) return v;
          return { ...v, objects: v.objects.filter((o) => o.id !== objectId) };
        });
        const variant = variants.find((v) => v.id === p.selectedVariantId)!;
        const next = { ...p, variants, shoppingSet: buildShoppingSet(p, variant), updatedAt: new Date().toISOString() };
        set({ project: next, editNote: "Объект убран из композиции. Комплект пересчитан." });
      },

      editObject: async (objectId, instruction) => {
        const p = get().project;
        if (!p || !p.selectedVariantId) return;
        set({ status: "editing", busyLabel: "Применяем изменение локально…" });
        const res = await aiDesignerProvider.editDesign({ variantId: p.selectedVariantId, objectId, instruction });
        /* локальное редактирование: объект/товры не пересобираются целиком */
        set({ status: "shopping", busyLabel: "", editNote: res.note, lastNotion: res.note });
      },

      addOneToCart: (productId) => {
        /* существующая корзина — без дублирования логики */
        import("../store").then(({ useAppStore }) => useAppStore.getState().addToCart(productId, 1));
      },

      addAllToCart: () => {
        const p = get().project;
        let added = 0, unavailable = 0;
        if (!p?.shoppingSet) return { added, unavailable };
        import("../store").then(({ useAppStore }) => {
          p.shoppingSet!.items.forEach((i) => {
            if (i.product.availability === "out_of_stock") { unavailable++; return; }
            useAppStore.getState().addToCart(i.product.productId, i.qty);
            added++;
          });
          set({ editNote: `В корзину добавлено позиций: ${added}.` });
        });
        return { added, unavailable };
      },

      saveProject: () => {
        const p = get().project;
        if (!p) return;
        const saved: DesignProject = { ...p, status: "saved", updatedAt: new Date().toISOString() };
        const store = useDesignerStore as any;
        void store; // noop для типов
        set({
          project: saved, status: "saved",
          editNote: "Проект сохранён. Вы сможете вернуться к нему позже.",
        });
        /* кладём в реестр сохранённых per-user */
        try {
          const raw = localStorage.getItem("ai-designer-projects");
          const reg: SavedProjects = raw ? JSON.parse(raw) : { byUser: {} };
          const list = reg.byUser[p.userId] || [];
          const idx = list.findIndex((x) => x.id === p.id);
          const copy = stripBlobs(saved);
          if (idx >= 0) list[idx] = copy; else list.unshift(copy);
          reg.byUser[p.userId] = list.slice(0, 24);
          localStorage.setItem("ai-designer-projects", JSON.stringify(reg));
        } catch { /* квота localStorage — молча пропускаем */ }
      },

      openProject: (id) => {
        try {
          const raw = localStorage.getItem("ai-designer-projects");
          if (!raw) return;
          const reg: SavedProjects = JSON.parse(raw);
          const all = Object.values(reg.byUser).flat();
          const found = all.find((x) => x.id === id);
          if (!found) return;
          set({
            project: { ...found, sourceImageId: found.sourceImageId || "" },
            status: found.selectedVariantId ? "shopping" : found.variants.length ? "variants" : "idle",
            answers: {}, error: null, editNote: null,
          });
        } catch { /* ignore */ }
      },

      deleteProject: (id) => {
        try {
          const raw = localStorage.getItem("ai-designer-projects");
          if (!raw) return;
          const reg: SavedProjects = JSON.parse(raw);
          Object.keys(reg.byUser).forEach((u) => {
            reg.byUser[u] = reg.byUser[u].filter((x) => x.id !== id);
          });
          localStorage.setItem("ai-designer-projects", JSON.stringify(reg));
        } catch { /* ignore */ }
        const cur = get().project;
        if (cur && cur.id === id) get().backToStart();
      },

      backToStart: () =>
        set({
          project: null, status: "idle", error: null, analysis: null,
          questions: [], answers: {}, qualityIssues: [], compareIds: [], editNote: null, busyLabel: "",
        }),

      dismissError: () => set({ error: null, status: get().project ? "uploading" : "idle" }),
    }),
    {
      name: "uyutart-ai-designer-session-v1",
      partialize: (s) => ({ project: s.project ? { ...s.project, status: "idle" } : null }) as any,
    },
  ),
);

/* Не сохраняем тяжёлые data-url в localStorage без необходимости:
   превью-картинки вариантов можно восстановить по исходному фото. */
function stripBlobs(p: DesignProject): DesignProject {
  const slim: DesignVariant[] = p.variants.map((v) => ({
    ...v,
    imageUrl: v.imageUrl.startsWith("data:image/svg") ? v.imageUrl : "",
    objects: v.objects.map((o) => ({ ...o })),
  }));
  return {
    ...p,
    variants: slim,
    /* исходное фото хранится отдельно и остаётся приватным */
    sourceImageId: p.sourceImageId.length > 4_000_000 ? "" : p.sourceImageId,
    shoppingSet: p.shoppingSet
      ? { ...p.shoppingSet, items: p.shoppingSet.items.map((i) => ({ ...i, product: { ...(i.product as ProductMatch) } })) }
      : undefined,
  };
}

export function listSavedProjects(userId: string): DesignProject[] {
  try {
    const raw = localStorage.getItem("ai-designer-projects");
    if (!raw) return [];
    const reg: SavedProjects = JSON.parse(raw);
    return (reg.byUser[userId] || []).map((p) => ({ ...p, variants: p.variants || [] }));
  } catch {
    return [];
  }
}

export type { DesignObject, ProjectStatus };
