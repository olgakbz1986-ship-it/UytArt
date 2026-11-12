export type ShipmentStatus = "created" | "label_ready" | "shipped" | "in_transit" | "at_point" | "delivered" | "closed" | "return_requested";
export interface JournalEntry { ts: string; actor: string; actorId: string; action: string; from: string | null; to: string | null; meta: Record<string, unknown> | null; }
export interface Escrow { state: "held" | "frozen" | "released"; heldAt: string; releaseAt: string | null; frozenAt: string | null; releasedAt: string | null; }
export interface Shipment {
  id: string; requestId: string; orderId: string; shopId: string; buyerId: string;
  buyerName: string; buyerPhone: string; buyerAddress: string; carrier: string; trackingNumber: string;
  status: ShipmentStatus; issue: boolean; itemsSummary: string; totalPrice: number;
  storageUntil: string | null; createdAt: string; updatedAt: string; escrow: Escrow; journal: JournalEntry[];
}
export const FLOW: ShipmentStatus[] = ["created","label_ready","shipped","in_transit","at_point","delivered","closed"];
export const STATUS_LABEL: Record<ShipmentStatus, string> = {
  created: "Заявка создана", label_ready: "Этикетка готова", shipped: "Передана в доставку",
  in_transit: "В пути", at_point: "На пункте выдачи", delivered: "Получена", closed: "Сделка закрыта", return_requested: "Возврат запрошен",
};
export async function apiJson<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data && data.error) || "Ошибка сервера (" + res.status + ")");
  return data as T;
}
