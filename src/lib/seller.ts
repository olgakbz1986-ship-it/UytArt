import { create } from "zustand";
import { persist } from "zustand/middleware";
import { cityToDistrict } from "./geo";

/* ============================================================
   Раздельные регистрации продавцов: самозанятый / ИП / ООО
   ============================================================ */

export type SellerLegalType = "self_employed" | "ip" | "ooo";

export interface DocReq { key: string; name: string; note: string; }
export interface SellerTypeInfo {
  type: SellerLegalType;
  short: string;
  label: string;
  fee: number;
  commission: number;
  docs: DocReq[];
}

export const SELLER_TYPES: SellerTypeInfo[] = [
  {
    type: "self_employed", short: "Самозанятый", label: "Самозанятые (НПД)", fee: 5000, commission: 10,
    docs: [
      { key: "passport", name: "Паспорт РФ", note: "Основная страница и прописка, JPG/PNG/PDF до 5 МБ" },
      { key: "nalog", name: "Справка о постановке на учёт", note: "Из приложения «Мой налог» или налогового органа" },
      { key: "card", name: "Реквизиты банковской карты", note: "Для выплат — номер карты и банк" },
    ],
  },
  {
    type: "ip", short: "ИП", label: "Индивидуальные предприниматели", fee: 10000, commission: 12,
    docs: [
      { key: "passport", name: "Паспорт РФ", note: "Основная страница и прописка" },
      { key: "egrip", name: "Выписка из ЕГРИП", note: "Не старше 30 дней" },
      { key: "account", name: "Реквизиты расчётного счёта ИП", note: "БИК, корр. счёт, расчётный счёт" },
      { key: "inn", name: "Свидетельство о постановке на учёт (ИНН)", note: "Скан или фото" },
    ],
  },
  {
    type: "ooo", short: "ООО", label: "Общества с ограниченной ответственностью", fee: 15000, commission: 15,
    docs: [
      { key: "passport", name: "Паспорт руководителя", note: "Или уполномоченного лица с доверенностью" },
      { key: "egrul", name: "Выписка из ЕГРЮЛ", note: "Не старше 30 дней" },
      { key: "charter", name: "Уставные документы", note: "Устав, решение о создании" },
      { key: "account", name: "Реквизиты расчётного счёта", note: "Банковские реквизиты организации" },
      { key: "order", name: "Протокол/приказ о назначении руководителя", note: "Подтверждение полномочий" },
    ],
  },
];
export const sellerTypeInfo = (t: SellerLegalType | null) => SELLER_TYPES.find((x) => x.type === t) || null;

/* ---------- тарифы продавцов по типу юрлица ---------- */
export interface SellerPlan { id: string; name: string; price: number; features: string[]; }
export const SELLER_PLANS: Record<SellerLegalType, SellerPlan[]> = {
  self_employed: [
    { id: "free", name: "Бесплатный", price: 0, features: ["До 5 активных товаров", "Ручное создание карточек", "Базовая статистика (просмотры)", "Биржа заказов — общая очередь"] },
    { id: "master", name: "Мастер", price: 300, features: ["До 30 товаров", "AI-генерация карточек (10/мес)", "Расширенная статистика", "Небольшой приоритет на бирже", "Комиссия 9% вместо 10%"] },
    { id: "profi", name: "Профи", price: 600, features: ["До 100 товаров", "Безлимитная AI-генерация", "Воронки продаж и рекомендации по ценам", "Приоритетный показ на бирже", "Комплекты товаров со скидкой", "Комиссия 8%"] },
    { id: "top", name: "Топ-мастер", price: 1200, features: ["Безлимит товаров", "Все AI-инструменты", "Прогнозы продаж", "Максимальный приоритет в поиске", "Бейдж «Проверенный мастер»", "Персональные подборки кураторов", "Комиссия 7%"] },
  ],
  ip: [
    { id: "free", name: "Бесплатный", price: 0, features: ["До 20 товаров", "Ручное создание карточек", "Базовая статистика", "Биржа заказов — общая очередь"] },
    { id: "business", name: "Бизнес", price: 800, features: ["До 100 товаров", "AI-генерация карточек (30/мес)", "Расширенная статистика", "Приоритет на бирже", "Массовое редактирование цен", "Комиссия 11% вместо 12%"] },
    { id: "business-pro", name: "Бизнес Про", price: 1800, features: ["До 500 товаров", "Безлимитная AI-генерация", "Воронки и рекомендации", "Максимальный приоритет на бирже", "Команда до 3 сотрудников", "Комиссия 10%"] },
    { id: "business-premium", name: "Бизнес Премиум", price: 4000, features: ["Безлимит товаров", "A/B-тестирование карточек", "Бейдж «Премиум продавец»", "Команда до 10 сотрудников", "Приоритет на главной и в категориях", "Персональный менеджер", "Закрытые B2B-заказы", "Комиссия 9%"] },
  ],
  ooo: [
    { id: "free", name: "Бесплатный", price: 0, features: ["До 50 товаров", "Ручное создание карточек", "Базовая статистика", "Биржа заказов — общая очередь", "Без командного доступа"] },
    { id: "corp", name: "Корпоративный", price: 2500, features: ["До 500 товаров", "AI-генерация карточек (100/мес)", "Расширенная статистика", "Приоритет на бирже", "Команда до 5 сотрудников", "Импорт товаров из файлов", "Бренд-витрина", "Комиссия 14% вместо 15%"] },
    { id: "corp-pro", name: "Корпоративный Про", price: 6000, features: ["До 2000 товаров", "Безлимитная AI-генерация", "Сегментация клиентов", "Максимальный приоритет на бирже", "Команда до 15 сотрудников", "B2B-программы и закрытые тендеры", "Комиссия 13%"] },
    { id: "corp-premium", name: "Корпоративный Премиум", price: 15000, features: ["Безлимит товаров", "Кастомные отчёты", "Бейдж «Официальный бренд»", "Безлимитная команда", "Менеджер и поддержка 24/7", "Топ-позиции категорий", "Промо в рассылках", "White-label с кастомным доменом", "Комиссия 11%"] },
  ],
};
export const sellerPlanById = (t: SellerLegalType, id: string) => (SELLER_PLANS[t] || []).find((p) => p.id === id);

/* ---------- состояние регистрации ---------- */
export type SellerRegStatus = "inactive" | "docs" | "moderation" | "rejected" | "payment" | "active" | "blocked";

interface SellerRegState {
  status: SellerRegStatus;
  legalType: SellerLegalType | null;
  shopName: string;
  contactName: string;
  email: string;
  phone: string;
  city: string;
  inn: string;
  ogrn: string;
  legalName: string;
  legalAddress: string;
  docs: Record<string, { fileName: string; size: number; ok: boolean }>;
  payMethod: string;
  commissionRate: number;
  rejectionCount: number;
  rejectionReason: string;
  moderationPassedAt: string | null;
  slug: string;
  production_region: string;

  /* ---------- блок «О мастере» ---------- */
  masterName: string;
  yearsExperience: string;
  categories: string[];
  businessStory: string;
  achievements: string;

  setLegalType: (t: SellerLegalType) => void;
  setInfo: (patch: Partial<Pick<SellerRegState, "shopName" | "contactName" | "email" | "phone" | "city" | "inn" | "ogrn" | "legalName" | "legalAddress" | "masterName" | "yearsExperience" | "businessStory" | "achievements">>) => void;
  toggleCategory: (slug: string) => void;
  backToStep1: () => void;
  toDocs: () => void;
  addDoc: (key: string, fileName: string, size: number) => void;
  removeDoc: (key: string) => void;
  submitForModeration: () => void;
  approveModeration: () => void;
  rejectModeration: (reason: string) => void;
  retryDocuments: () => void;
  payFee: (method: string) => void;
  resetFlow: () => void;
}

const slugify = (s: string) => s.trim().toLowerCase().replace(/[^a-zа-я0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "master";

export const useSellerReg = create<SellerRegState>()(
  persist(
    (set) => ({
      status: "inactive",
      legalType: null,
      shopName: "",
      contactName: "",
      email: "",
      phone: "",
      city: "",
      inn: "",
      ogrn: "",
      legalName: "",
      legalAddress: "",
      docs: {},
      payMethod: "",
      commissionRate: 15,
      rejectionCount: 0,
      rejectionReason: "",
      moderationPassedAt: null,
      slug: "",
      production_region: "ЦФО",

      masterName: "",
      yearsExperience: "",
      categories: [],
      businessStory: "",
      achievements: "",

      setLegalType: (t) => set({ legalType: t, docs: {} }),
      setInfo: (patch) => set(patch),
      toggleCategory: (slug) =>
        set((s) => ({
          categories: s.categories.includes(slug) ? s.categories.filter((c) => c !== slug) : [...s.categories, slug],
        })),
      backToStep1: () => set({ status: "inactive", docs: {} }),
      toDocs: () => set({ status: "docs", docs: {} }),
      addDoc: (key, fileName, size) =>
        set((s) => ({ docs: { ...s.docs, [key]: { fileName, size, ok: false } } })),
      removeDoc: (key) =>
        set((s) => {
          const d = { ...s.docs };
          delete d[key];
          return { docs: d };
        }),
      submitForModeration: () => set({ status: "moderation", rejectionReason: "" }),
      approveModeration: () => set({ status: "payment", moderationPassedAt: new Date().toISOString() }),
      rejectModeration: (reason) =>
        set((s) => {
          const count = s.rejectionCount + 1;
          return count >= 3
            ? { status: "blocked", rejectionCount: count, rejectionReason: reason }
            : { status: "rejected", rejectionCount: count, rejectionReason: reason };
        }),
      retryDocuments: () => set({ status: "docs", docs: {} }),
      payFee: (method) =>
        set((s) => {
          const info = sellerTypeInfo(s.legalType);
          return {
            status: "active",
            payMethod: method,
            commissionRate: info?.commission ?? 15,
            slug: slugify(s.shopName),
            production_region: cityToDistrict(s.city || "Москва"),
          };
        }),
      resetFlow: () =>
        set({
          status: "inactive", legalType: null, shopName: "", contactName: "", email: "", phone: "", city: "",
          inn: "", ogrn: "", legalName: "", legalAddress: "", docs: {}, payMethod: "", commissionRate: 15,
          rejectionCount: 0, rejectionReason: "", moderationPassedAt: null, slug: "", production_region: "ЦФО",
          masterName: "", yearsExperience: "", categories: [], businessStory: "", achievements: "",
        }),
    }),
    { name: "uyutart-seller-reg-v2" }
  )
);

/* ---------- кабинет продавца ---------- */
export interface SellerTx {
  id: string;
  date: string;
  kind: "sale" | "withdraw";
  orderId: string;
  productPrice: number;
  commissionAmount: number;
  sellerPayout: number;
}

export interface ProductMedia { type: "image" | "video"; url: string; name: string; }
export interface SellerProductItem { id: string; name: string; category: string; price: number; createdAt: string; archived?: boolean; aiGenerated?: boolean; media?: ProductMedia[]; }

export interface TeamMember { id: string; name: string; role: "Менеджер" | "Мастер" | "Кладовщик"; }

interface SellerAccountState {
  planIds: Record<SellerLegalType, string>;
  setPlan: (t: SellerLegalType, id: string) => void;
  transactions: SellerTx[];
  products: SellerProductItem[];
  team: TeamMember[];
  aiCardGens: Record<string, number>; /* месяц -> использовано */
  addProduct: (p: Omit<SellerProductItem, "id" | "createdAt">) => void;
  removeProduct: (id: string) => void;
  toggleArchive: (id: string) => void;
  bulkSetPrice: (ids: string[], percent: number) => void;
  addMember: (m: Omit<TeamMember, "id">) => void;
  removeMember: (id: string) => void;
  requestWithdrawal: (amount: number) => void;
  consumeAiCardGen: (month: string) => boolean;
}

const demoTx: SellerTx[] = [
  { id: "t1", date: new Date(Date.now() - 2 * 864e5).toISOString(), kind: "sale", orderId: "UYA-3127", productPrice: 10000, commissionAmount: 1200, sellerPayout: 8800 },
  { id: "t2", date: new Date(Date.now() - 5 * 864e5).toISOString(), kind: "sale", orderId: "UYA-3084", productPrice: 4500, commissionAmount: 540, sellerPayout: 3960 },
  { id: "t3", date: new Date(Date.now() - 9 * 864e5).toISOString(), kind: "sale", orderId: "UYA-2971", productPrice: 7200, commissionAmount: 864, sellerPayout: 6336 },
];

export const useSellerAccount = create<SellerAccountState>()(
  persist(
    (set, get) => ({
      planIds: { self_employed: "free", ip: "free", ooo: "free" },
      setPlan: (t, id) => set((s) => ({ planIds: { ...s.planIds, [t]: id } })),
      transactions: demoTx,
      products: [],
      team: [],
      aiCardGens: {},
      addProduct: (p) =>
        set((s) => ({
          products: [{ ...p, id: "sp-" + Date.now(), createdAt: new Date().toISOString() }, ...s.products],
        })),
      removeProduct: (id) => set((s) => ({ products: s.products.filter((p) => p.id !== id) })),
      toggleArchive: (id) =>
        set((s) => ({ products: s.products.map((p) => (p.id === id ? { ...p, archived: !p.archived } : p)) })),
      bulkSetPrice: (ids, percent) =>
        set((s) => ({
          products: s.products.map((p) =>
            ids.includes(p.id) ? { ...p, price: Math.max(1, Math.round((p.price * (100 + percent)) / 100)) } : p
          ),
        })),
      addMember: (m) => set((s) => ({ team: [...s.team, { ...m, id: "tm-" + Date.now() }] })),
      removeMember: (id) => set((s) => ({ team: s.team.filter((m) => m.id !== id) })),
      requestWithdrawal: (amount) =>
        set((s) => ({
          transactions: [
            {
              id: "t-" + Date.now(), date: new Date().toISOString(), kind: "withdraw", orderId: "W-" + Math.floor(100 + Math.random() * 900),
              productPrice: 0, commissionAmount: 0, sellerPayout: -amount,
            },
            ...s.transactions,
          ],
        })),
      consumeAiCardGen: (month) => {
        const used = get().aiCardGens[month] || 0;
        set((s) => ({ aiCardGens: { ...s.aiCardGens, [month]: used + 1 } }));
        return true;
      },
    }),
    { name: "uyutart-seller-account-v2" }
  )
);

/* ---------- финансовые селекторы ---------- */
export const selectTurnover = (s: SellerAccountState) =>
  s.transactions.filter((t) => t.kind === "sale").reduce((sum, t) => sum + t.productPrice, 0);
export const selectCommissionSum = (s: SellerAccountState) =>
  s.transactions.filter((t) => t.kind === "sale").reduce((sum, t) => sum + t.commissionAmount, 0);
export const selectBalance = (s: SellerAccountState) =>
  s.transactions.reduce((sum, t) => sum + t.sellerPayout, 0);
