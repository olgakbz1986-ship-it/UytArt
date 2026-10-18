import { create } from "zustand";
import { validateINN } from "./inn";
import { persist } from "zustand/middleware";
import { api } from "./api";
import { useTariffStore, applyServerTariff } from "./tariff";

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
/* §3.2: годовая оплата со скидкой 20% — ЕДИНАЯ ФОРМУЛА для всех
   двенадцати тарифов продавцов: yearPrice = round(price*12*0.8/10)*10.
   §3.1: тексты фич приведены в соответствие таблице лимитов
   (SELLER_LIMITS в subscriptions.ts) — противоречий больше нет. */
export interface SellerPlan { id: string; name: string; price: number; features: string[]; }
export const YEAR_DISCOUNT = 0.2; /* 20% при оплате за год */
export const yearPriceOf = (monthly: number) => (monthly === 0 ? 0 : Math.round((monthly * 12 * (1 - YEAR_DISCOUNT)) / 10) * 10);
export const SELLER_PLANS: Record<SellerLegalType, SellerPlan[]> = {
  self_employed: [
    { id: "free", name: "Бесплатный", price: 0, features: ["AI-агент: диалог и правила сервиса", "До 50 товаров", "Ручное создание карточек", "Базовая статистика (просмотры)", "Биржа заказов — общая очередь"] },
    { id: "master", name: "Мастер", price: 300, features: ["AI-агент: рекомендации цен и скидок", "До 500 товаров", "AI-генерация карточек (100/мес)", "Расширенная статистика", "Небольшой приоритет на бирже", "Команда до 5 сотрудников", "Комиссия 9% вместо 10%"] },
    { id: "profi", name: "Профи", price: 600, features: ["AI-агент: мониторинг биржи и черновики откликов", "До 2000 товаров", "Безлимитная AI-генерация", "Воронки продаж и рекомендации по ценам", "Приоритетный показ на бирже", "Комплекты товаров со скидкой", "Команда до 15 сотрудников", "Комиссия 8%"] },
    { id: "top", name: "Топ-мастер", price: 1200, features: ["AI-агент-партнёр: безлимит задач и авто-аналитика недели", "Безлимит товаров", "Все AI-инструменты", "Прогнозы продаж", "Максимальный приоритет в поиске", "Бейдж «Проверенный мастер»", "Безлимитная команда", "Персональные подборки кураторов", "Комиссия 7%"] },
  ],
  ip: [
    { id: "free", name: "Бесплатный", price: 0, features: ["AI-агент: диалог и правила сервиса", "До 50 товаров", "Ручное создание карточек", "Базовая статистика", "Биржа заказов — общая очередь"] },
    { id: "business", name: "Бизнес", price: 800, features: ["AI-агент: рекомендации цен и скидок", "До 500 товаров", "AI-генерация карточек (100/мес)", "Расширенная статистика", "Приоритет на бирже", "Массовое редактирование цен", "Команда до 5 сотрудников", "Комиссия 11% вместо 12%"] },
    { id: "business-pro", name: "Бизнес Про", price: 1800, features: ["AI-агент: мониторинг биржи и черновики откликов", "До 2000 товаров", "Безлимитная AI-генерация", "Воронки и рекомендации", "Максимальный приоритет на бирже", "Команда до 15 сотрудников", "Комиссия 10%"] },
    { id: "business-premium", name: "Бизнес Премиум", price: 4000, features: ["AI-агент-партнёр: безлимит задач и авто-аналитика недели", "Безлимит товаров", "A/B-тестирование карточек", "Бейдж «Официальный бренд»", "Безлимитная команда", "Приоритет на главной и в категориях", "Персональный менеджер", "Закрытые B2B-заказы", "Комиссия 9%"] },
  ],
  ooo: [
    { id: "free", name: "Бесплатный", price: 0, features: ["AI-агент: диалог и правила сервиса", "До 50 товаров", "Ручное создание карточек", "Базовая статистика", "Биржа заказов — общая очередь", "Без командного доступа"] },
    { id: "corp", name: "Корпоративный", price: 2500, features: ["AI-агент: рекомендации цен и скидок", "До 500 товаров", "AI-генерация карточек (100/мес)", "Расширенная статистика", "Приоритет на бирже", "Команда до 5 сотрудников", "Импорт товаров из файлов", "Бренд-витрина", "Комиссия 14% вместо 15%"] },
    { id: "corp-pro", name: "Корпоративный Про", price: 6000, features: ["AI-агент: мониторинг биржи и черновики откликов", "До 2000 товаров", "Безлимитная AI-генерация", "Сегментация клиентов", "Максимальный приоритет на бирже", "Команда до 15 сотрудников", "B2B-программы и закрытые тендеры", "Комиссия 13%"] },
    { id: "corp-premium", name: "Корпоративный Премиум", price: 15000, features: ["AI-агент-партнёр: безлимит задач и авто-аналитика недели", "Безлимит товаров", "Кастомные отчёты", "Бейдж «Официальный бренд»", "Безлимитная команда", "Менеджер и поддержка 24/7", "Топ-позиции категорий", "Промо в рассылках", "White-label с кастомным доменом", "Комиссия 11%"] },
  ],
};
export const sellerPlanById = (t: SellerLegalType, id: string) => (SELLER_PLANS[t] || []).find((p) => p.id === id);

/* ---------- матрица комиссий по типу юрлица и тарифу ---------- */
export const COMMISSION_MATRIX: Record<SellerLegalType, Record<string, number>> = {
  self_employed: { free: 10, master: 9, profi: 8, top: 7 },
  ip: { free: 12, business: 11, "business-pro": 10, "business-premium": 9 },
  ooo: { free: 15, corp: 14, "corp-pro": 13, "corp-premium": 11 },
};

/* §1.1: 15% — резерв ТОЛЬКО при полном отсутствии данных о тарифе
   (нет типа юрлица / нет строки матрицы). Штатный вызов getCommissionRate
   всегда возвращает ставку ИЗ МАТРИЦЫ по идентификатору аккаунта и типу
   юрлица; базовая ставка типа не хранится «навсегда» (§1.2). */
export function getCommissionRate(type: SellerLegalType | null | undefined, planId: string): number {
  if (!type) return 15;
  const row = COMMISSION_MATRIX[type];
  if (!row) return 15;
  if (row[planId] != null) return row[planId];
  const LEVEL: Record<string, number> = { free: 0, master: 1, business: 1, corp: 1, "master-pro": 2, "business-pro": 2, "corp-pro": 2, profi: 2, "master-premium": 3, "business-premium": 3, "corp-premium": 3, top: 3 };
  const keys = Object.keys(row);
  return row[keys[Math.min(LEVEL[planId] ?? 0, keys.length - 1)]] ?? 15;
}

/* §3.1: унификация бейджей — самозанятым «Проверенный мастер»,
   юридическим лицам (ИП/ООО) «Официальный бренд». Верхний тариф любой
   линейки выдаёт бейдж; на средних тарифах бейджа нет. */
export const BADGE_BY_LEGAL: Record<SellerLegalType, string> = {
  self_employed: "Проверенный мастер",
  ip: "Официальный бренд",
  ooo: "Официальный бренд",
};
export function sellerBadgeOf(type: SellerLegalType | null | undefined, planId: string): string | null {
  if (!type) return null;
  const list = SELLER_PLANS[type] || [];
  const idx = list.findIndex((p) => p.id === planId);
  if (idx < 0) return null;
  /* верхний тариф линейки (уровень 3) получает унифицированный бейдж */
  return idx === list.length - 1 ? BADGE_BY_LEGAL[type] : null;
}

export function getCurrentPlanKey(type: SellerLegalType | null | undefined, accountId?: string): string {
  if (!type) return "free";
  // Эта функция должна вызываться из компонента, где доступен стейт
  // Для использования в extras.tsx передавайте accountId явно
  return "free"; // заглушка, реальное значение берётся в компоненте
}

/* ---------- состояние регистрации + реестр профилей по аккаунтам ---------- */
export type SellerRegStatus = "inactive" | "docs" | "moderation" | "rejected" | "payment" | "active" | "blocked";

/* ---------- аудит-лог изменений реквизитов ---------- */
export interface AuditEntry {
  timestamp: string;
  field: string;
  oldValue: string;
  newValue: string;
  reason?: string;
  status: "pending" | "approved" | "rejected";
  approvedAt?: string;
}

/* ---------- предпросмотр смены правовой формы (чистая функция, без побочных эффектов) ---------- */
/* NOTE: дублирует матрицу уровней из getCommissionRate — техдолг: унифицировать при рефакторинге тарифов */
const PLAN_LEVEL: Record<string, number> = {
  free: 0, master: 1, business: 1, corp: 1,
  profi: 2, "business-pro": 2, "corp-pro": 2,
  top: 3, "business-premium": 3, "corp-premium": 3,
};

export interface LegalTypePreview {
  newPlanId: string;
  newPlanName: string;
  newPrice: number;
  oldCommission: number;
  newCommission: number;
  docsRequired: DocReq[];
  warnings: string[];
}

export function previewLegalTypeChange(
  oldType: SellerLegalType | null,
  oldPlanId: string,
  newType: SellerLegalType,
): LegalTypePreview {
  const oldInfo = sellerTypeInfo(oldType);
  const newInfo = sellerTypeInfo(newType)!;
  const oldCommission = oldType ? getCommissionRate(oldType, oldPlanId) : 15;
  const oldLevel = PLAN_LEVEL[oldPlanId] ?? 0;
  const plans = SELLER_PLANS[newType];
  const target = plans.find((p) => (PLAN_LEVEL[p.id] ?? 0) === oldLevel)
    || plans.slice().sort((a, b) => Math.abs((PLAN_LEVEL[a.id] ?? 0) - oldLevel) - Math.abs((PLAN_LEVEL[b.id] ?? 0) - oldLevel))[0]
    || plans[0];
  const newCommission = getCommissionRate(newType, target.id);
  const warnings: string[] = [];
  if (oldInfo && newInfo.fee > oldInfo.fee) warnings.push(`Разовый сбор: ${oldInfo.fee} ₽ → ${newInfo.fee} ₽`);
  if (newCommission !== oldCommission) warnings.push(`Комиссия: ${oldCommission}% → ${newCommission}%`);
  const oldPlan = oldType ? sellerPlanById(oldType, oldPlanId) : null;
  if (oldPlan && oldPlan.price !== target.price) warnings.push(`Цена тарифа: ${oldPlan.price} ₽/мес → ${target.price} ₽/мес`);
  return {
    newPlanId: target.id,
    newPlanName: target.name,
    newPrice: target.price,
    oldCommission,
    newCommission,
    docsRequired: newInfo.docs,
    warnings,
  };
}

export interface SellerProfile {
  accountId: string;
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
  shopLogo?: string;
  masterAvatar?: string;
  slug: string;
  production_region: string;
  production_city?: string;
  commissionRate: number;
  submittedAt: string;
  isMaster: boolean;
  acceptsCustomOrders: boolean;
  masterName: string;
  yearsExperience: string;
  businessStory: string;
  achievements: string;
  categories: string[];
  productionGallery: string[];
  videoTourUrl: string;

  /* ---------- статусы проверки и аудит (премиум-блок) ---------- */
  verificationStatus?: "verified" | "pending" | "rejected";
  innValid?: boolean;
  dataSource?: "manual" | "api";
  changeReason?: string;
  auditLog?: AuditEntry[];
  docs?: Record<string, { fileName: string; size: number; ok: boolean }>;
}

interface SellerRegState {
  /* Активный черновик/профиль регистрации (заполняется в текущей сессии) */
  status: SellerRegStatus;
  legalType: SellerLegalType | null;
  shopName: string;
  shopLogo?: string;
  masterAvatar?: string;
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
  production_city: string;

  /* ---------- блок «О мастере» ---------- */
  masterName: string;
  yearsExperience: string;
  categories: string[];
  businessStory: string;
  achievements: string;
  isMaster: boolean;
  acceptsCustomOrders: boolean;
  productionGallery: string[];
  videoTourUrl: string;
  submittedAt: string;

  /* РЕЕСТР ПРОФИЛЕЙ: id аккаунта -> профиль продавца.
     Ключ к решению Проблем №1 и №3: каждый магазин живёт отдельно. */
  profilesByAccount: Record<string, SellerProfile>;

  setLegalType: (t: SellerLegalType) => void;
  setInfo: (patch: Partial<Pick<SellerRegState, "shopName" | "contactName" | "email" | "phone" | "city" | "inn" | "ogrn" | "legalName" | "legalAddress" | "masterName" | "yearsExperience" | "businessStory" | "achievements" | "shopLogo" | "masterAvatar" | "isMaster" | "acceptsCustomOrders" | "productionGallery" | "videoTourUrl" | "submittedAt">>) => void;
  toggleCategory: (slug: string) => void;
  backToStep1: () => void;
  toDocs: () => void;
  addDoc: (key: string, fileName: string, size: number) => void;
  removeDoc: (key: string) => void;
  submitForModeration: () => void;
  approveModeration: () => void;
  rejectModeration: (reason: string) => void;
  retryDocuments: () => void;
  /* §1.4: оплата разового взноса — реальный платёж; возвращает результат,
     статус «active» выставляется только при успешной оплате на сервере */
  payFee: (method: string) => Promise<{ ok: boolean; offline?: boolean; error?: string; paymentId?: string; receipt?: any }>;
  resetFlow: () => void;
  /* Загрузить в активный стор профиль аккаунта uid (при входе/переключении) */
  loadProfile: (uid: string) => void;
  /* Сохранить активный профиль в реестр под uid */
  saveProfile: (uid: string) => void;
  /* Сброс при выходе (чтобы следующий пользователь не увидел чужой кабинет) */
  clearActive: () => void;
  /* Изменить юридические реквизиты с записью в аудит-лог и статусом перепроверки */
  updateLegalFields: (uid: string, patch: Partial<Pick<SellerProfile, "inn" | "ogrn" | "legalName" | "legalAddress" | "production_region" | "production_city" | "legalType">>, reason: string) => { ok: boolean; error?: string };
  /* Прочитать историю изменений реквизитов аккаунта */
  getAuditLog: (uid: string) => AuditEntry[];
  /* Сменить правовую форму аккаунта с предпросмотром последствий и аудит-логом */
  changeLegalType: (uid: string, newType: SellerLegalType, oldPlanId: string) => { ok: boolean; error?: string; preview?: LegalTypePreview };
}

const slugify = (s: string) => s.trim().toLowerCase().replace(/[^a-zа-я0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "master";

export const useSellerReg = create<SellerRegState>()(
  persist(
    (set, get) => ({
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
      production_region: "",
      production_city: "",

      masterName: "",
      yearsExperience: "",
      categories: [],
      businessStory: "",
      achievements: "",
      isMaster: false,
      acceptsCustomOrders: false,
      productionGallery: [],
      videoTourUrl: "",
      submittedAt: "",
      profilesByAccount: {},

      setLegalType: (t) => set({ legalType: t, docs: {} }),
      /* Любая правка профиля сохраняет активный профиль в реестр под id аккаунта.
         Это обеспечивает Проблему №3: изменил профиль → товары «отзеркалят» новые данные. */
      setInfo: (patch) => {
        set(patch as Partial<SellerRegState>);
        const uid = activeUserId();
        if (uid) get().saveProfile(uid);
      },
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
      payFee: (method) => {
        /* §1.2: комиссия профиля пересчитывается ИЗ МАТРИЦЫ по текущему
           тарифу, а не берётся как базовая ставка типа юрлица навсегда. */
        const s = get();
        const info = sellerTypeInfo(s.legalType);
        const uid = activeUserId();
        const planId = uid ? useSellerAccount.getState().getPlan(uid, s.legalType || "self_employed") : "free";
        const matrixRate = getCommissionRate(s.legalType, planId);
        set({
          status: "payment" as const,
          payMethod: method,
          commissionRate: matrixRate,
        });
        /* ЭТАП 1 (§1.4): реальная оплата разового взноса 5/10/15 тыс. ₽.
           Регистрация переходит в «active» ТОЛЬКО после успешного платежа,
           подтверждённого сервером (платёжный провайдер → журнал → чек). */
        const fee = info?.fee ?? 0;
        if (!api || !uid || fee <= 0) {
          /* Офлайн-демо без сервера: локальный режим сохранён */
          set((st) => ({
            status: "active" as const,
            submittedAt: new Date().toISOString(),
            slug: slugify(st.shopName),
            production_city: (st.city || "").trim(), production_region: (st.city || "").trim(),
          }));
          const uid2 = activeUserId();
          if (uid2) get().saveProfile(uid2);
          return Promise.resolve({ ok: true, offline: true } as any);
        }
        return api.createFeePayment(s.legalType as string, method === "card" ? "card" : method, planId)
          .then(async (r) => {
            if (!r || !r.ok || !r.payment) {
              set({ status: "payment", rejectionReason: "Платёж не создан: сервис оплаты недоступен" });
              return { ok: false, error: (r && r.error) || "provider_unavailable" };
            }
            const pid = r.payment.id;
            /* В проде клиент редиректится на confirmation_url и ждёт webhook;
               здесь — опрос статуса платежа до success/fail. */
            const confirmed = await api.confirmFeePayment(pid); /* dev-путь: подтверждение владельцем */
            if (!confirmed || !confirmed.ok || confirmed.payment?.status !== "succeeded") {
              set({ rejectionReason: "Оплата взноса не подтверждена" });
              return { ok: false, error: "payment_not_confirmed", paymentId: pid };
            }
            /* Сервер подтвердил успех: активация + синхронизация тарифа/комиссии (§1.2/§1.3) */
            const st = await api.registrationStatus(s.legalType as string).catch(() => null);
            set((x) => ({
              status: st && st.active ? ("active" as const) : ("payment" as const),
              submittedAt: new Date().toISOString(),
              payMethod: method,
              slug: slugify(x.shopName),
              production_city: (x.city || "").trim(), production_region: (x.city || "").trim(),
            }));
            const t = await api.tariff().catch(() => null);
            if (t && t.ok && t.tariff) applyServerTariff(t.tariff);
            const uid3 = activeUserId();
            if (uid3) get().saveProfile(uid3);
            return { ok: true, paymentId: pid, receipt: (confirmed as any).receipt || null };
          })
          .catch((e) => {
            set({ rejectionReason: "Ошибка оплаты взноса" });
            return { ok: false, error: String(e) };
          });
      },
      resetFlow: () =>
        set({
          status: "inactive", legalType: null, shopName: "", contactName: "", email: "", phone: "", city: "",
          inn: "", ogrn: "", legalName: "", legalAddress: "", docs: {}, payMethod: "", commissionRate: 15,
          rejectionCount: 0, rejectionReason: "", moderationPassedAt: null, slug: "", production_region: "", production_city: "",
          masterName: "", yearsExperience: "", categories: [], businessStory: "", achievements: "",
        }),

      /* ---------- реестр профилей ---------- */
      loadProfile: (uid) => {
        const p = get().profilesByAccount[uid];
        if (!p) {
          set({ ...EMPTY_REG });
          return;
        }
        const { accountId, ...rest } = p;
        set({ ...rest, production_city: p.production_city || p.city || "", docs: p.docs || {} });
      },
      saveProfile: (uid) => {
        if (!uid) return;
        const s = get();
        const prev = get().profilesByAccount[uid];
        const prof: SellerProfile = {
          accountId: uid,
          status: s.status, legalType: s.legalType, shopName: s.shopName, contactName: s.contactName,
          email: s.email, phone: s.phone, city: s.city, inn: s.inn, ogrn: s.ogrn, legalName: s.legalName,
          legalAddress: s.legalAddress, shopLogo: s.shopLogo, masterAvatar: s.masterAvatar, slug: s.slug,
          production_region: s.production_region, production_city: s.production_city, commissionRate: s.commissionRate, submittedAt: s.submittedAt,
          isMaster: s.isMaster, acceptsCustomOrders: s.acceptsCustomOrders, masterName: s.masterName,
          yearsExperience: s.yearsExperience, businessStory: s.businessStory, achievements: s.achievements,
          categories: s.categories, productionGallery: s.productionGallery, videoTourUrl: s.videoTourUrl,
          docs: s.docs,
          auditLog: prev?.auditLog,
          verificationStatus: prev?.verificationStatus,
          innValid: prev?.innValid,
          dataSource: prev?.dataSource,
          changeReason: prev?.changeReason,
        };
        set((st) => ({ profilesByAccount: { ...st.profilesByAccount, [uid]: prof } }));
      },
      clearActive: () => set({ ...EMPTY_REG }),
      updateLegalFields: (uid, patch, reason) => {
        if (patch.inn !== undefined) {
          const v = validateINN(patch.inn);
          if (!v.valid) return { ok: false, error: v.error };
        }
        const prof = get().profilesByAccount[uid];
        if (!prof) return { ok: false, error: "Профиль не найден" };
        const now = new Date().toISOString();
        const entries: AuditEntry[] = Object.entries(patch).map(([field, newValue]) => ({
          timestamp: now,
          field,
          oldValue: String((prof as unknown as Record<string, unknown>)[field] ?? ""),
          newValue: String(newValue ?? ""),
          reason,
          status: "pending" as const,
        }));
        const updated: SellerProfile = {
          ...prof,
          ...patch,
          verificationStatus: "pending",
          changeReason: reason,
            ...(patch.production_city !== undefined ? { production_region: patch.production_city } : {}),
          innValid: patch.inn !== undefined ? validateINN(patch.inn).valid : prof.innValid,
          auditLog: [...(prof.auditLog || []), ...entries],
        };
        set((st) => ({ profilesByAccount: { ...st.profilesByAccount, [uid]: updated } }));
        if (uid === activeUserId()) set({ inn: updated.inn, ogrn: updated.ogrn, legalName: updated.legalName, legalAddress: updated.legalAddress, production_region: updated.production_region, production_city: updated.production_city ?? "", legalType: updated.legalType });
        return { ok: true };
      },
      getAuditLog: (uid) => get().profilesByAccount[uid]?.auditLog || [],
      changeLegalType: (uid, newType, oldPlanId) => {
        const prof = get().profilesByAccount[uid];
        if (!prof) return { ok: false, error: "Профиль не найден" };
        if (prof.legalType === newType) return { ok: false, error: "Такая форма уже указана" };
        const preview = previewLegalTypeChange(prof.legalType, oldPlanId, newType);
        const now = new Date().toISOString();
        const entry: AuditEntry = {
          timestamp: now,
          field: "legalType",
          oldValue: prof.legalType || "",
          newValue: newType,
          reason: "Смена правовой формы",
          status: "pending",
        };
        const updated: SellerProfile = {
          ...prof,
          legalType: newType,
          docs: {},
          verificationStatus: "pending",
          changeReason: "Смена правовой формы",
          commissionRate: preview.newCommission,
          auditLog: [...(prof.auditLog || []), entry],
        };
        set((st) => ({ profilesByAccount: { ...st.profilesByAccount, [uid]: updated } }));
        if (uid === activeUserId()) set({ legalType: newType, docs: {} });
        return { ok: true, preview };
      },
    }),
    { name: "uyutart-seller-reg-v3" }
  )
);

const EMPTY_REG = {
  status: "inactive" as SellerRegStatus, legalType: null as SellerLegalType | null,
  shopName: "", shopLogo: undefined as string | undefined, masterAvatar: undefined as string | undefined,
  contactName: "", email: "", phone: "", city: "", inn: "", ogrn: "", legalName: "", legalAddress: "",
  docs: {} as Record<string, { fileName: string; size: number; ok: boolean }>, payMethod: "",
  commissionRate: 15, rejectionCount: 0, rejectionReason: "", moderationPassedAt: null as string | null,
  slug: "", production_region: "", production_city: "", masterName: "", yearsExperience: "", categories: [] as string[],
  businessStory: "", achievements: "", isMaster: false, acceptsCustomOrders: false,
  productionGallery: [] as string[], videoTourUrl: "", submittedAt: "",
};

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
export type DeliveryZone =
  | { mode: "city"; withDistrict?: boolean }
  | { mode: "radius"; km: number }
  | { mode: "region" }
  | { mode: "nationwide" };
export type ServiceMode = "online" | "visit" | "both";
export type SlotTime = string;

export interface SellerProductItem {
id: string;
  name: string;
  category: string;
  price: number;
  createdAt: string;
  /* ВЛАДЕЛЕЦ ТОВАРА — id аккаунта продавца, из которого товар был создан.
     Жёсткая привязка: каждый магазин видит только свои товары (Проблема №1). */
  ownerId?: string;
  isDraft?: boolean;
  draftSavedAt?: string;
  manufacturer?: string;
  sku?: string;
  tags?: string[];
  archived?: boolean;
  views?: number;
  aiGenerated?: boolean;
  ai_status?: "idle" | "pending" | "processing" | "ready" | "error";
  ai_assets?: {
    hero_image?: string;
    info_slides?: string[];
    video_15s?: string;
  };
  media?: ProductMedia[];
  // Новые поля для AI-студии
  description?: string;
  materials?: string[];
  dimensions?: { length?: number; width?: number; height?: number; unit?: "см" | "мм" | "м" };
  weight?: number;
  specs?: { id?: string; key: string; value: string }[];
  deliveryZone?: DeliveryZone;
  serviceMode?: ServiceMode;
  slots?: SlotTime[];
  instant?: boolean;
  minOrder?: number;
  restored?: boolean;
  fileFormat?: string;
  style?: string;
  color?: string;
  size?: string;
  animation?: {
    frames: string[];
    captions: string[];
    frameMs: number;
  };
  shopName?: string;
  sellerCity?: string;
  legalType?: string;
  inn?: string;
  avatar?: string;

}

/* ---------- работы в Студии Quantiform ---------- */
export interface WorkItem {
  id: string;
  type: "card" | "photo" | "seo" | "video" | "agent";
  /* Владелец работы — id аккаунта, создавшего её (Правило владения) */
  ownerId?: string;
  name: string;
  folder: string;
  spec: "qf" | "wb" | "ozon";
  createdAt: string;
  isDraft?: boolean;
  draftSavedAt?: string;
  manufacturer?: string;
  sku?: string;
  tags?: string[];
  updatedAt: string;
  preview: string;
  data: any;
}

export interface TeamMember { id: string; name: string; role: "Менеджер" | "Мастер" | "Кладовщик";
  email?: string; }

interface SellerAccountState {
  works: WorkItem[];
  saveWork: (w: Omit<WorkItem, "id" | "createdAt" | "updatedAt">) => string;
  updateWork: (id: string, patch: Partial<WorkItem>) => void;
  deleteWork: (id: string) => void;
  planIdsByAccount: Record<string, Record<SellerLegalType, string>>; /* key = accountId */
  setPlan: (accountId: string, t: SellerLegalType, id: string) => void;
  getPlan: (accountId: string, t: SellerLegalType) => string;
  transactions: SellerTx[];
  products: SellerProductItem[];
  team: TeamMember[];
  aiCardGens: Record<string, number>; /* месяц -> использовано */
  triggerAIGeneration: (id: string) => void;
  addProduct: (p: Omit<SellerProductItem, "id" | "createdAt"> & Partial<Pick<SellerProductItem, "id" | "createdAt">>) => void;
  removeProduct: (id: string) => void;
  toggleArchive: (id: string) => void;
  bulkSetPrice: (ids: string[], percent: number) => void;
  addMember: (m: Omit<TeamMember, "id">) => void;
  removeMember: (id: string) => void;
  requestWithdrawal: (amount: number) => void;
  incrementViews: (id: string) => void;
  updateProduct: (id: string, patch: Partial<SellerProductItem>) => void;
  migrateOwnerlessProducts: (uid: string) => void;
  recordSale: (t: { orderId: string; productPrice: number; commissionAmount: number }) => void;
  consumeAiCardGen: (month: string) => boolean;
}

/* ============================================================
   РЕЕСТР ПРОФИЛЕЙ ПРОДАВЦОВ (Проблемы №1 и №3)
   Профиль продавца хранится ПО id аккаунта: у каждого магазина —
   свои название, ИНН, город. Товар жёстко привязан к владельцу
   через ownerId; реквизиты продавца НЕ копируются в товар,
   а резолвятся из профиля «на лету» — карточка товара всегда
   зеркало актуального профиля.
   ============================================================ */
import { useAppStore } from "./store";
/* Правило владения: единая проверка «только владелец может мутировать» */
import { canMutate } from "./ownership";

const activeUserId = (): string => {
  try { return useAppStore.getState().session?.userId || ""; } catch { return ""; }
};

/* Профиль из реестра по id аккаунта (без проверки статуса) */
export function sellerProfileOf(uid: string): SellerProfile | null {
  if (!uid) return null;
  return useSellerReg.getState().profilesByAccount[uid] || null;
}

/* Текущий профиль = активная запись реестра для активного аккаунта.
   Если реестр пуст (legacy-данные), падаем обратно на активный стор
   useSellerReg — обратная совместимость без потери данных. */
export function currentSellerProfile(): SellerProfile | null {
  const uid = activeUserId();
  if (!uid) return null;
  const st = useSellerReg.getState();
  const rec = st.profilesByAccount[uid];
  if (rec && rec.status === "active") return rec;
  if (!rec && st.status === "active" && st.shopName) {
    return { ...st, accountId: uid } as SellerProfile;
  }
  return null;
}

/* Реквизиты продавца для подстановки при создании/публикации товара.
   Источник истины — профиль (реестр), а не снимок в товаре. */
export function sellerStampForProduct(): { shopName?: string; sellerCity?: string; legalType?: string; inn?: string; avatar?: string } {
  const uid = activeUserId();
  const p = (uid && useSellerReg.getState().profilesByAccount[uid]) || currentSellerProfile() || (useSellerReg.getState() as unknown as SellerProfile);
  return {
    shopName: p?.shopName || undefined,
    sellerCity: p?.city || undefined,
    legalType: p?.legalType || undefined,
    inn: p?.inn || undefined,
    avatar: p?.shopLogo || p?.masterAvatar || undefined,
  };
}

export const useSellerAccount = create<SellerAccountState>()(
  persist(
    (set, get) => ({
      works: [],
      saveWork: (w) => {
        const id = "w" + Date.now().toString(36);
        const now = new Date().toISOString();
        /* Правило владения: работа создаётся от имени активного аккаунта */
        set((s) => ({ works: [{ ...w, ownerId: activeUserId() || undefined, id, createdAt: now, updatedAt: now }, ...s.works] }));
        return id;
      },
      updateWork: (id, patch) => set((s) => ({ works: s.works.map((w) => (w.id === id && canMutate(w.ownerId) ? { ...w, ...patch, updatedAt: new Date().toISOString() } : w)) })),
      deleteWork: (id) => set((s) => ({ works: s.works.filter((w) => !(w.id === id && canMutate(w.ownerId))) })),
      planIdsByAccount: {},
      setPlan: (accountId, t, id) => set((s) => {
        const current = s.planIdsByAccount[accountId] || { self_employed: "free", ip: "free", ooo: "free" };
        return { 
          planIdsByAccount: { 
            ...s.planIdsByAccount, 
            [accountId]: { ...current, [t]: id } 
          } 
        };
      }),
      getPlan: (accountId, t) => {
        const accPlans = get().planIdsByAccount[accountId];
        return accPlans?.[t] || "free";
      },
      transactions: [],
      products: [],
      team: [],
      aiCardGens: {},
      addProduct: (p) => {
        /* Жёсткая привязка к владельцу: товар создаётся от имени активного аккаунта.
           Legacy-товары с сервера без ownerId мигрируют к текущему продавцу. */
        const uid = activeUserId();
        if (!p.ownerId && p.id && uid) p = { ...p, ownerId: uid };
        set((s) => ({
          products: [{ ...p, ownerId: p.ownerId || uid || undefined, id: p.id || "sp-" + Date.now(), createdAt: p.createdAt || new Date().toISOString() }, ...s.products],
        }));
      },
      removeProduct: (id) => set((s) => ({ products: s.products.filter((p) => !(p.id === id && canMutate(p.ownerId))) })),
      toggleArchive: (id) =>
        set((s) => ({ products: s.products.map((p) => (p.id === id && canMutate(p.ownerId) ? { ...p, archived: !p.archived } : p)) })),
      updateProduct: (id, patch) => {
        /* Защита: ownerId нельзя «перевесить» на другой аккаунт */
        const { ownerId: _ignored, ...safe } = patch as Partial<SellerProductItem>;
        void _ignored;
        /* Правило владения: редактировать товар может только его владелец */
        set((s) => ({ products: s.products.map((p) => (p.id === id && canMutate(p.ownerId) ? { ...p, ...safe } : p)) }));
      },
      migrateOwnerlessProducts: (uid) =>
        set((s) => ({ products: s.products.map((p) => (!p.ownerId && uid ? { ...p, ownerId: uid } : p)) })),
      triggerAIGeneration: (id: string) => {
        // 1. Сразу ставим статус "processing"
        set((s) => ({
          products: s.products.map((p) => (p.id === id ? { ...p, ai_status: "processing" as const, aiGenerated: true } : p))
        }));
        // 2. Имитируем фоновую работу AI (5 секунд)
        setTimeout(() => {
          set((s) => ({
            products: s.products.map((p) => {
              if (p.id === id) {
                return {
                  ...p,
                  ai_status: "ready" as const,
                  ai_assets: {
                    hero_image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='800'%3E%3Crect fill='%231a1a1a' width='800' height='800'/%3E%3Ctext fill='white' font-size='48' x='50%25' y='50%25' text-anchor='middle' dominant-baseline='middle'%3EHERO%3C/text%3E%3C/svg%3E",
                    info_slides: [
                      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='800'%3E%3Crect fill='%232d3748' width='800' height='800'/%3E%3Ctext fill='white' font-size='48' x='50%25' y='50%25' text-anchor='middle' dominant-baseline='middle'%3E1%3C/text%3E%3C/svg%3E",
                      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='800'%3E%3Crect fill='%234a5568' width='800' height='800'/%3E%3Ctext fill='white' font-size='48' x='50%25' y='50%25' text-anchor='middle' dominant-baseline='middle'%3E2%3C/text%3E%3C/svg%3E",
                      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='800'%3E%3Crect fill='%23718096' width='800' height='800'/%3E%3Ctext fill='white' font-size='48' x='50%25' y='50%25' text-anchor='middle' dominant-baseline='middle'%3E3%3C/text%3E%3C/svg%3E",
                      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='800'%3E%3Crect fill='%23a0aec0' width='800' height='800'/%3E%3Ctext fill='white' font-size='48' x='50%25' y='50%25' text-anchor='middle' dominant-baseline='middle'%3E4%3C/text%3E%3C/svg%3E",
                      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='800'%3E%3Crect fill='%23cbd5e0' width='800' height='800'/%3E%3Ctext fill='%23333' font-size='48' x='50%25' y='50%25' text-anchor='middle' dominant-baseline='middle'%3E5%3C/text%3E%3C/svg%3E",
                      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='800'%3E%3Crect fill='%23e2e8f0' width='800' height='800'/%3E%3Ctext fill='%23333' font-size='48' x='50%25' y='50%25' text-anchor='middle' dominant-baseline='middle'%3E6%3C/text%3E%3C/svg%3E",
                      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='800'%3E%3Crect fill='%23ed8936' width='800' height='800'/%3E%3Ctext fill='white' font-size='48' x='50%25' y='50%25' text-anchor='middle' dominant-baseline='middle'%3E7%3C/text%3E%3C/svg%3E",
                      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='800'%3E%3Crect fill='%2338a169' width='800' height='800'/%3E%3Ctext fill='white' font-size='48' x='50%25' y='50%25' text-anchor='middle' dominant-baseline='middle'%3E8%3C/text%3E%3C/svg%3E",
                      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='800'%3E%3Crect fill='%233182ce' width='800' height='800'/%3E%3Ctext fill='white' font-size='48' x='50%25' y='50%25' text-anchor='middle' dominant-baseline='middle'%3E9%3C/text%3E%3C/svg%3E",
                      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='800'%3E%3Crect fill='%23805ad5' width='800' height='800'/%3E%3Ctext fill='white' font-size='48' x='50%25' y='50%25' text-anchor='middle' dominant-baseline='middle'%3E10%3C/text%3E%3C/svg%3E"
                    ],
                    video_15s: "https://www.w3schools.com/html/mov_bbb.mp4"
                  }
                };
              }
              return p;
            })
          }));
        }, 5000);
      },
      incrementViews: (id) => set((s) => ({ products: s.products.map((p) => (p.id === id ? { ...p, views: (p.views || 0) + 1 } : p)) })),
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
      recordSale: (t) =>
        set((s) => ({
          transactions: [
            {
              id: "t-" + Date.now(), date: new Date().toISOString(), kind: "sale", orderId: t.orderId,
              productPrice: t.productPrice, commissionAmount: t.commissionAmount, sellerPayout: t.productPrice - t.commissionAmount,
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
    { name: "uyutart-seller-account-v3" }
  )
);

/* ---------- финансовые селекторы ---------- */
export const selectTurnover = (s: SellerAccountState) =>
  s.transactions.filter((t) => t.kind === "sale").reduce((sum, t) => sum + t.productPrice, 0);
export const selectCommissionSum = (s: SellerAccountState) =>
  s.transactions.filter((t) => t.kind === "sale").reduce((sum, t) => sum + t.commissionAmount, 0);
export const selectBalance = (s: SellerAccountState) =>
  s.transactions.reduce((sum, t) => sum + t.sellerPayout, 0);

/* ---------- экспорты для ProductWizard ---------- */
export const currentMonth = () => new Date().toISOString().slice(0, 7);
export const consumeAiCardGen = (month: string) => useSellerAccount.getState().consumeAiCardGen(month);

/* ============================================================
   СИНХРОНИЗАЦИЯ СОСТОЯНИЯ МЕЖДУ АККАУНТАМИ (Проблемы №1 и №3)
   Подписки на смену активной сессии:
   - при входе продавца загружаем ЕГО профиль из реестра;
   - legacy-товары без ownerId привязываем к текущему аккаунту;
   - при выходе сбрасываем активный профиль, чтобы следующий
     пользователь не увидел чужой кабинет.
   ============================================================ */
let lastSyncedUid = "";
useAppStore.subscribe((st) => {
  const uid = st.session?.userId || "";
  const isSeller = st.session?.role === "seller";
  if (!uid) {
    if (lastSyncedUid) {
      try { useSellerReg.getState().clearActive(); } catch { /* noop */ }
      lastSyncedUid = "";
    }
    return;
  }
  if (uid === lastSyncedUid) return;
  lastSyncedUid = uid;
  try {
    const reg = useSellerReg.getState();
    if (isSeller) {
      if (reg.profilesByAccount[uid]) reg.loadProfile(uid);
      else if (reg.status !== "active") reg.clearActive();
      /* Миграция legacy: товары без владельца -> текущий аккаунт */
      const acc = useSellerAccount.getState();
      if (acc.products.some((p) => !p.ownerId)) {
        acc.migrateOwnerlessProducts(uid);
      }
    } else {
      reg.clearActive();
    }
  } catch { /* noop */ }
});

