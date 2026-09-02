import { create } from "zustand";
import { persist } from "zustand/middleware";

/* ============================================================
   Отзывы: только для полученного заказа, премодерация,
   один ответ продавца без правок.
   ============================================================ */

export interface UserReview {
  id: string;
  productId: string;
  orderId: string;
  orderNumber: string;
  userId: string;
  userName: string;
  rating: number;
  text: string;
  hasPhoto: boolean;
  photoName?: string;
  receivedDate: string;
  status: "pending" | "approved" | "rejected";
  sellerReply?: { text: string; createdAt: string };
  createdAt: string;
}

interface ReviewState {
  reviews: UserReview[];
  submitReview: (r: Omit<UserReview, "id" | "status" | "createdAt">) => void;
  approveReview: (id: string) => void;
  replyToReview: (id: string, text: string) => void;
  hasReviewed: (productId: string, orderId: string) => boolean;
}

export const useReviewStore = create<ReviewState>()(
  persist(
    (set, get) => ({
      reviews: [],

      submitReview: (r) =>
        set((s) => ({
          reviews: [{ ...r, id: "rv-" + Date.now(), status: "pending", createdAt: new Date().toISOString() }, ...s.reviews],
        })),

      /* демо-премодерация: в реальности — администратором */
      approveReview: (id) =>
        set((s) => ({
          reviews: s.reviews.map((r) => (r.id === id ? { ...r, status: "approved" } : r)),
        })),

      replyToReview: (id, text) =>
        set((s) => ({
          reviews: s.reviews.map((r) =>
            r.id === id && !r.sellerReply
              ? { ...r, sellerReply: { text, createdAt: new Date().toISOString() } }
              : r
          ),
        })),

      hasReviewed: (productId, orderId) =>
        get().reviews.some((r) => r.productId === productId && r.orderId === orderId),
    }),
    { name: "uyutart-review-v2" }
  )
);

/* одобренные отзывы для отображения */
export const approvedReviews = (reviews: UserReview[], productId: string) =>
  reviews.filter((r) => r.productId === productId && r.status === "approved");
