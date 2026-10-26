/* Панель «Мои заказы (покупателя)» — единый переиспользуемый компонент для
   кабинетов покупателя (/profile) и продавца (/seller/dashboard):
   продавец — тоже покупатель и видит те же покупки, что и в кабинете покупателя. */
import { useState } from "react";
import { Link } from "react-router-dom";
import { MessageSquare, CheckCircle2, Sparkles } from "lucide-react";
import { fmt, fmtDate, productById } from "../data/seed";
import { useAppStore, NEXT_STATUS, type Order } from "../lib/store";
import { useMarketProducts } from "../lib/market";
import { Badge, Btn, ProductImg } from "./ui";
import { ChatModal } from "./chat";
import { ReviewModal } from "./review";

const ORDER_LABEL: Record<string, { label: string; tone: "honey" | "ai" | "success" | "premium" }> = {
  paid: { label: "Принят", tone: "honey" },
  assembling: { label: "Собирается", tone: "ai" },
  shipped: { label: "В пути", tone: "ai" },
  delivered: { label: "Доставлен", tone: "success" },
  received: { label: "Получен", tone: "success" },
};

export function BuyerOrdersPanel({ orders }: { orders: Order[] }) {
  const market = useMarketProducts();
  const advanceStatus = useAppStore((s) => s.advanceStatus);
  const confirmReceipt = useAppStore((s) => s.confirmReceipt);
  const [chatOrder, setChatOrder] = useState<Order | null>(null);
  const [reviewFor, setReviewFor] = useState<Order | null>(null);

  const buyerOrders = orders.filter((o) => !o.items.every((i) => i.productId.startsWith("sp-")));

  return (
    <div className="space-y-4 fade-up">
      <h2 className="font-display font-bold text-xl text-ink">Мои заказы</h2>
      <p className="text-sm text-ink-soft">Покупки этого аккаунта в других магазинах и мастерских. Продавец — тоже покупатель: здесь видны те же заказы, что и в кабинете покупателя.</p>
      {buyerOrders.length === 0 && (
        <div className="bg-surface rounded-2xl shadow-card px-8 py-16 text-center">
          <p className="text-[44px] mb-3">📦</p>
          <p className="font-display font-bold text-[19px] text-ink mb-2">Покупок пока нет</p>
          <p className="text-[13px] text-ink-soft mb-4">Здесь появятся ваши заказы в других магазинах — с отслеживанием, чатом с мастером и отзывами.</p>
          <Link to="/catalog" className="inline-flex h-[44px] px-6 items-center rounded-[10px] bg-accent text-ink font-semibold hover:bg-accent-deep hover:text-cream transition-colors">В каталог</Link>
        </div>
      )}
      {buyerOrders.map((o) => (
        <div key={o.id} className="bg-surface rounded-2xl shadow-card p-5">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <div>
              <p className="font-bold text-[15px] text-ink">Заказ {o.number}</p>
              <p className="text-[12px] text-ink-mute mt-0.5">{fmtDate(o.date)} · {o.deliveryMethod}</p>
            </div>
            <Badge tone={ORDER_LABEL[o.status]?.tone || "honey"}>{ORDER_LABEL[o.status]?.label || o.status}</Badge>
          </div>
          <div className="flex gap-2.5 mb-3 overflow-x-auto no-scrollbar">
            {o.items.map((it) => {
              const p = (market as any[]).find((x) => x.id === it.productId) || productById(it.productId);
              return p ? (
                <Link key={it.productId} to={`/product/${(p as any).slug || it.productId}`} className="w-[64px] h-[64px] rounded-[10px] overflow-hidden shrink-0 group"><ProductImg p={p as any} /></Link>
              ) : (
                <span key={it.productId} className="w-[64px] h-[64px] rounded-[10px] bg-line-soft shrink-0 grid place-items-center text-[10px] text-ink-mute px-1 text-center">{String(it.productId).slice(0, 10)}</span>
              );
            })}
          </div>
          <div className="flex items-center justify-between flex-wrap gap-3 sm:gap-4">
            <span className="font-display font-bold text-[19px] text-ink">{fmt(o.total)}</span>
            <div className="flex gap-2 sm:gap-3 flex-wrap">
              <Btn size="sm" variant="outline" onClick={() => setChatOrder(o)}><MessageSquare size={14} /> Чат</Btn>
              {o.status !== "received" && (
                <Btn size="sm" variant="ghost" onClick={() => advanceStatus(o.id)} title="Демо-продвижение статуса">
                  → {ORDER_LABEL[NEXT_STATUS[o.status]]?.label}
                </Btn>
              )}
              {o.status === "delivered" && (
                <Btn size="sm" onClick={() => { confirmReceipt(o.id); }}>
                  <CheckCircle2 size={14} /> Подтвердить получение
                </Btn>
              )}
              {o.status === "received" && (
                <Btn size="sm" onClick={() => setReviewFor(o)}>
                  <Sparkles size={14} /> Оставить отзыв
                </Btn>
              )}
            </div>
          </div>
        </div>
      ))}
      {chatOrder && <ChatModal open onClose={() => setChatOrder(null)} kind="order" order={chatOrder} />}
      {reviewFor && reviewFor.items[0] && (() => {
        const p = (market as any[]).find((x) => x.id === reviewFor.items[0].productId) || productById(reviewFor.items[0].productId);
        return p ? <ReviewModal open onClose={() => setReviewFor(null)} product={p as any} orderId={reviewFor.id} orderNumber={reviewFor.number} /> : null;
      })()}
    </div>
  );
}
