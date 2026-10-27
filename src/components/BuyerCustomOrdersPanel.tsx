/* ============================================================================
   ПАНЕЛЬ «ИНДИВИДУАЛЬНЫЕ ЗАКАЗЫ» — единая для кабинетов покупателя и продавца.

   Вынесена из profile.tsx (хирургическая замена inline-блока) по той же
   архитектуре, что и остальные общие панели src/components/Buyer*Panel:
     · источник данных — useMarketStore (orders с флагом myOwn / ownerId);
     · клик по заказу открывает МОДАЛКУ MarketOrderDetail (чат с мастером,
       отклики, сделка, этапы, оплата, отзывы) — тот же компонент, что на бирже;
     · роль наблюдателя определяется серверным правилом владения через
       orderOwnerIdLike (совпадение sellerId аккаунта с id мастера на бирже).

   Тарификация: раздел доступен с платного покупательского тарифа
   (лимит активных индивидуальных заказов: free 1, start 3, designer 10,
   premium ∞ — см. BUYER_PLANS; серверный контроль — assertLimit("market_order")).
   ========================================================================== */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MessageSquare } from "lucide-react";
import { useAppStore } from "../lib/store";
import { useMarketStore, type MarketOrder } from "../lib/marketStore";
import { orderOwnerIdLike } from "../lib/ownership";
import { Badge } from "./ui";
import MarketOrderDetail from "./MarketOrderDetail";

const STATUS_RU: Record<string, string> = {
  published: "Опубликован", moderation: "На модерации", in_progress: "В работе",
  completed: "Завершён", cancelled: "Отменён", draft: "Черновик",
};

export function BuyerCustomOrdersPanel() {
  const session = useAppStore((s) => s.session);
  /* Только СВОИ заказы покупателя (myOwn) — чужие демо-заказы биржи не показываем. */
  const orders = useMarketStore((s) => s.orders.filter((o) => o.myOwn));
  const [selected, setSelected] = useState<MarketOrder | null>(null);

  /* Актуальный снимок выбранного заказа из стора: статусы меняются
     (принят отклик → in_progress и т.п.) — детали должны отражать это. */
  const liveSelected = selected ? (useMarketStore.getState().orders.find((o) => o.id === selected.id) || selected) : null;

  /* Владелец ли текущий аккаунт у открытого заказа (роль для модалки).
     Синхронное правило владения (orderOwnerIdLike сравнивает ownerId/user_id
     заказа с userId сессии) — изоморфно серверной проверке. */
  const ownerRole: "owner" | "other" = liveSelected && session
    ? (orderOwnerIdLike(liveSelected) === session.userId ? "owner" : "other")
    : "other";

  return (
    <div className="fade-up space-y-3">
      <h3 className="font-display font-bold text-[18px] text-ink">Индивидуальные заказы</h3>
      {orders.length === 0 ? (
        <div className="bg-surface rounded-2xl shadow-card px-8 py-16 text-center">
          <p className="text-[44px] mb-3">🛠️</p>
          <p className="font-display font-bold text-[19px] text-ink mb-2">Индивидуальных заказов нет</p>
          <p className="text-[13.5px] text-ink-soft mb-3">
            Разместите заказ на биржу — мастера пришлют предложения с ценой и сроком.
          </p>
          <Link to="/market" className="text-[14px] font-bold text-accent-deep hover:text-accent underline">
            Создать заказ на бирже →
          </Link>
        </div>
      ) : (
        orders.map((mo) => (
          <div
            key={mo.id}
            onClick={() => setSelected(mo)}
            className="bg-surface rounded-xl shadow-card p-4 sm:p-5 border border-line-soft cursor-pointer hover:border-accent hover:shadow-lg transition-all group"
          >
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[15px] text-ink truncate">{mo.title}</p>
                <p className="text-[12px] text-ink-mute mt-0.5">
                  {mo.type} · {mo.region}
                  {(mo as any).agentDraft ? " · черновик агента" : ""}
                </p>
              </div>
              <Badge tone={mo.status === "published" ? "success" : mo.status === "in_progress" ? "ai" : "honey"}>
                {STATUS_RU[mo.status] || mo.status}
              </Badge>
            </div>
            <p className="text-[13px] text-ink-soft mt-2 line-clamp-2">{mo.desc}</p>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-line-soft">
              <span className="font-display font-bold text-[16px] text-ink">
                {Number(mo.budget).toLocaleString("ru-RU")} ₽
              </span>
              <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-accent-deep">
                <MessageSquare size={13} /> Откликов: {mo.responses || 0} · Подробнее →
              </span>
            </div>
          </div>
        ))
      )}

      {/* Модалка деталей — та же, что на бирже: чат, отклики, сделка, этапы, оплата */}
      {liveSelected && (
        <MarketOrderDetail
          order={liveSelected}
          role={ownerRole}
          onClose={() => setSelected(null)}
          onStatusChange={(id, status) =>
            useMarketStore.setState((s) => ({
              orders: s.orders.map((o) => (o.id === id ? { ...o, status: status as MarketOrder["status"] } : o)),
            }))
          }
        />
      )}
    </div>
  );
}
