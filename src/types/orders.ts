// Типы для Биржи индивидуальных заказов
export type OrderStatus = 'draft' | 'published' | 'in_progress' | 'completed' | 'cancelled' | 'disputed';
export type BudgetType = 'fixed' | 'range' | 'negotiable';

export interface CustomOrder {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: string;
  budget_min?: number;
  budget_max?: number;
  budget_type: BudgetType;
  deadline?: string;
  region?: string;
  status: OrderStatus;
  attachments: string[];
  created_at: string;
  updated_at: string;
}

export interface OrderResponse {
  id: string;
  order_id: string;
  master_id: string;
  price: number;
  deadline_days: number;
  comment: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

export interface OrderMessage {
  id: string;
  order_id: string;
  sender_id: string;
  message: string;
  attachment_url?: string;
  created_at: string;
}
