import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Product, vendorById } from "../data/seed";
import type { OrderStatus } from "./store";

/* ============================================================
   Чат: только структурированный обмен вопросами и шаблонами.
   Никаких AI-автоответов и свободного ввода для покупателя.
   ============================================================ */

export type SenderRole = "buyer" | "seller";
export interface ChatMessage { id: string; role: SenderRole; name: string; text: string; blocked?: boolean; createdAt: string; }
export interface ChatDialog { key: string; kind: "product" | "order"; refId: string; archived: boolean; messages: ChatMessage[]; }
export interface SupportTicket {
  id: string; orderId: string; orderNumber: string; kind: "problem" | "return";
  reason: string; description: string; photoName: string; status: "new" | "in_review" | "resolved";
  createdAt: string;
}

/* ---------- невидимая защита от увода клиентов ---------- */
const FORBIDDEN = /(\+?\d[\d\s\-()]{9,}\d|whats\s*app|вотсап|viber|вайбер|telegram|телеграм|телега|звоните|позвоните|http|www\.)/i;
export function isForbidden(text: string): boolean {
  return FORBIDDEN.test(text);
}

/* ---------- 10 вопросов покупателя ДО заказа (на основе характеристик) ---------- */
export function buyerQuestions(p: Product): string[] {
  const vendor = vendorById(p.vendorId);
  const city = vendor?.city || "ваш город";
  return [
    "Есть ли этот товар в наличии и когда возможна отправка?",
    `Можно ли изменить габариты «${p.name}» под мои размеры?`,
    `Доступен ли этот товар в другом цвете или материале, кроме «${p.color} / ${p.material}»?`,
    "Можно ли нанести гравировку или индивидуальный логотип?",
    `Какие точные сроки изготовления и доставки в мой город?`,
    `Доставляете ли вы этот товар в мой регион (${city})?`,
    "Как правильно ухаживать за этим изделием в быту?",
    "Подходит ли этот товар для использования во влажных помещениях (ванна/кухня)?",
    "Какие условия гарантии предоставляет мастер на это изделие?",
    "Каков порядок возврата, если товар не подойдет по цвету или габаритам?",
  ];
}

/* ---------- 10 шаблонов продавца ---------- */
export function sellerTemplates(p: Product): { label: string; custom?: boolean }[] {
  const days = p.production_time_days || 3;
  return [
    { label: "Да, товар в наличии, готов отправить его завтра." },
    { label: `Товар изготавливается под заказ, срок выполнения: ${days} дней.` },
    { label: "Да, я могу изменить размер/цвет, пожалуйста, уточните ваши пожелания." },
    { label: "К сожалению, этот товар доступен только в том варианте, что на фото." },
    { label: "Да, я доставляю в ваш регион через СДЭК/Почту, стоимость рассчитается в корзине." },
    { label: "Нет, к сожалению, доставка в ваш регион для этого габаритного товара не осуществляется." },
    { label: "Рекомендации по уходу подробно описаны в характеристиках товара, могу продублировать." },
    { label: "Да, на изделие действует гарантия 12 месяцев от производителя." },
    { label: "Возврат возможен в течение 7 дней при сохранении товарного вида, доставка за счет покупателя." },
    { label: "Написать свой вариант ответа...", custom: true },
  ];
}

/* ---------- вопросы покупателя ПОСЛЕ заказа (по статусу) ---------- */
export function orderPrompts(status: OrderStatus): string[] {
  switch (status) {
    case "paid":
      return [
        "Когда вы планируете приступить к изготовлению?",
        "Могу ли я еще внести изменения в детали заказа?",
      ];
    case "shipped":
      return [
        "Можете ли вы прислать фото текущего процесса изготовления?",
        "Ориентировочные сроки готовности не изменились?",
        "Когда именно товар будет передан в службу доставки?",
        "Каким образом будет упакован товар для безопасной перевозки?",
      ];
    case "delivered":
      return [
        "Сообщите, пожалуйста, трек-номер для отслеживания.",
        "Когда курьер свяжется со мной для доставки?",
        "Какой код получения и точный адрес пункта выдачи?",
        "Что мне делать, если при получении я обнаружу повреждения?",
      ];
    default:
      return [];
  }
}

export const TICKET_REASONS = [
  "Товар пришёл с браком",
  "Товар повреждён при доставке",
  "Привезли не тот товар",
  "Товар не соответствует описанию",
  "Не хватает комплектующих",
  "Хочу оформить возврат (7 дней)",
];

interface ChatState {
  dialogs: Record<string, ChatDialog>;
  tickets: SupportTicket[];
  ensure: (key: string, kind: "product" | "order", refId: string) => void;
  send: (key: string, role: SenderRole, name: string, text: string) => { blocked: boolean };
  archive: (key: string) => void;
  addTicket: (t: Omit<SupportTicket, "id" | "status" | "createdAt">) => void;
}

const now = () => new Date().toISOString();

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      dialogs: {},
      tickets: [],

      ensure: (key, kind, refId) => {
        if (get().dialogs[key]) return;
        set((s) => ({
          dialogs: { ...s.dialogs, [key]: { key, kind, refId, archived: false, messages: [] } },
        }));
      },

      send: (key, role, name, text) => {
        const blocked = isForbidden(text);
        set((s) => {
          const d = s.dialogs[key];
          if (!d) return s;
          const msg: ChatMessage = { id: "m-" + Date.now() + Math.random(), role, name, text, blocked, createdAt: now() };
          return { dialogs: { ...s.dialogs, [key]: { ...d, messages: [...d.messages, msg] } } };
        });
        return { blocked };
      },

      archive: (key) =>
        set((s) => {
          const d = s.dialogs[key];
          if (!d) return s;
          return { dialogs: { ...s.dialogs, [key]: { ...d, archived: true } } };
        }),

      addTicket: (t) =>
        set((s) => ({
          tickets: [{ ...t, id: "tk-" + Date.now(), status: "new", createdAt: now() }, ...s.tickets],
        })),
    }),
    { name: "uyutart-chat-v2" }
  )
);
