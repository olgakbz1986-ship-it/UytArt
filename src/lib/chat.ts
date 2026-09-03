import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Product } from "../data/seed";
import type { OrderStatus } from "./store";

/* ============================================================
   Чат: только структурированный обмен. Покупатель — кнопки,
   продавец — 9 шаблонов + «Свой ответ…». Защита от увода клиентов.
   ============================================================ */

export type SenderRole = "buyer" | "seller";
export interface ChatMessage { id: string; role: SenderRole; name: string; text: string; blocked?: boolean; createdAt: string; }
export interface ChatDialog { key: string; kind: "product" | "order"; refId: string; archived: boolean; messages: ChatMessage[]; }
export interface SupportTicket {
  id: string; orderId: string; orderNumber: string; kind: "problem" | "return";
  reason: string; description: string; photoName?: string; status: "new" | "in_review"; createdAt: string;
}

/* невидимая защита от увода клиентов */
export function isForbidden(text: string): boolean {
  return (
    /(\+?\d[\s\-()]?\d[\s\-()]?\d[\s\-()]?\d[\s\-()]?\d[\s\-()]?\d[\s\-()]?\d)/.test(text) ||
    /whats\s*app|вотсап|ватсап/i.test(text) ||
    /telegram|телеграм|телега|t\.me/i.test(text) ||
    /viber|вайбер|вибер/i.test(text) ||
    /звоните|позвони|набери|мой номер/i.test(text) ||
    /https?:\/\/|www\./i.test(text) ||
    /@[a-zа-я][\w.]{2,}/i.test(text)
  );
}

/* 10 ключевых вопросов покупателя до заказа */
export function buyerQuestions(p: Product): string[] {
  return [
    "Есть ли этот товар в наличии и когда возможна отправка?",
    "Можно ли изменить габариты под мои размеры?",
    "Доступен ли этот товар в другом цвете или материале?",
    "Можно ли нанести гравировку или индивидуальный логотип?",
    "Какие точные сроки изготовления и доставки в мой город?",
    "Доставляете ли вы этот товар в мой регион?",
    "Как правильно ухаживать за этим изделием в быту?",
    "Подходит ли этот товар для использования во влажных помещениях (ванна/кухня)?",
    "Какие условия гарантии предоставляет мастер на это изделие?",
    "Каков порядок возврата, если товар не подойдёт по цвету или габаритам?",
  ];
}

/* 10 универсальных шаблонов продавца (10-й — свой ответ) */
export function sellerTemplates(p: Product): { label: string; custom?: boolean }[] {
  return [
    { label: "Да, товар в наличии, готов отправить его завтра." },
    { label: `Товар изготавливается под заказ, срок выполнения: ${p.production_time_days || 14} дней.` },
    { label: "Да, я могу изменить размер/цвет, пожалуйста, уточните ваши пожелания." },
    { label: "К сожалению, этот товар доступен только в том варианте, что на фото." },
    { label: "Да, я доставляю в ваш регион через СДЭК/Почту, стоимость рассчитается в корзине." },
    { label: "Нет, к сожалению, доставка в ваш регион для этого габаритного товара не осуществляется." },
    { label: "Рекомендации по уходу подробно описаны в характеристиках товара, могу продублировать." },
    { label: "Да, на изделие действует гарантия 12 месяцев от производителя." },
    { label: "Возврат возможен в течение 7 дней при сохранении товарного вида, доставка за счёт покупателя." },
    { label: "Написать свой вариант ответа…", custom: true },
  ];
}

/* вопросы покупателя после заказа — по статусу */
export function orderPrompts(status: OrderStatus): string[] {
  switch (status) {
    case "paid":
      return [
        "Когда вы планируете приступить к изготовлению?",
        "Могу ли я ещё внести изменения в детали заказа?",
      ];
    case "shipped":
      return [
        "Можете ли вы прислать фото текущего процесса изготовления?",
        "Ориентировочные сроки готовности не изменились?",
        "Когда именно товар будет передан в службу доставки?",
        "Каким образом будет упакован товар для безопасной перевозки?",
        "Сообщите, пожалуйста, трек-номер для отслеживания.",
        "Когда курьер свяжется со мной для доставки?",
      ];
    case "delivered":
      return [
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

      ensure: (key, kind, refId) =>
        set((s) =>
          s.dialogs[key]
            ? s
            : { dialogs: { ...s.dialogs, [key]: { key, kind, refId, archived: false, messages: [] } } }
        ),

      send: (key, role, name, text) => {
        const blocked = isForbidden(text);
        const msg: ChatMessage = {
          id: "m-" + Date.now() + Math.floor(Math.random() * 1000),
          role, name, text, blocked, createdAt: now(),
        };
        set((s) => {
          const d = s.dialogs[key];
          if (!d) return s;
          return { dialogs: { ...s.dialogs, [key]: { ...d, messages: [...d.messages, msg] } } };
        });
        return { blocked };
      },

      archive: (key) =>
        set((s) => {
          const d = s.dialogs[key];
          if (!d) return s;
          const sys: ChatMessage = {
            id: "m-" + Date.now(), role: "seller", name: "УютАрт",
            text: "Чат по этому заказу завершён. Спасибо за покупку! Если с товаром есть проблемы, используйте кнопку «Сообщить о проблеме».",
            createdAt: now(),
          };
          return { dialogs: { ...s.dialogs, [key]: { ...d, archived: true, messages: [...d.messages, sys] } } };
        }),

      addTicket: (t) =>
        set((s) => ({
          tickets: [{ ...t, id: "tk-" + Date.now(), status: "new", createdAt: now() }, ...s.tickets],
        })),
    }),
    { name: "uyutart-chat-v2" }
  )
);
