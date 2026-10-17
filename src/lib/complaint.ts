import { create } from "zustand";
import { persist } from "zustand/middleware";

/* ============================================================
   Жалобы покупателей на конкретного продавца / магазин / мастера.
   Уходят в арбитраж платформы, защищая обе стороны.
   ============================================================ */

export interface Complaint {
  id: string;
  vendorId: string;
  vendorName: string;
  userId: string;
  userName: string;
  category: string;
  description: string;
  photoName?: string;
  status: "new" | "in_review" | "resolved";
  createdAt: string;
}

export const COMPLAINT_CATEGORIES = [
  "Товар не соответствует описанию",
  "Продавец не выходит на связь",
  "Нарушение сроков отправки",
  "Попытка увести сделку мимо платформы",
  "Некорректное поведение продавца",
  "Подозрение на подделку / масс-маркет",
  "Другое",
];

interface ComplaintState {
  complaints: Complaint[];
  addComplaint: (c: Omit<Complaint, "id" | "status" | "createdAt">) => void;
}

export const useComplaintStore = create<ComplaintState>()(
  persist(
    (set) => ({
      complaints: [],
      addComplaint: (c) =>
        set((s) => ({
          complaints: [{ ...c, id: "cp-" + Date.now(), status: "new", createdAt: new Date().toISOString() }, ...s.complaints],
        })),
    }),
    { name: "uyutart-complaint-v2" }
  )
);
