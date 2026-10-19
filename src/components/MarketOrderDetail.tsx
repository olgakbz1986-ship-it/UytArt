import { useState, useEffect, useRef } from "react";
import { X, CheckCircle2, Clock, MessageSquare, Send, Paperclip, Star, Users, ShieldCheck } from "lucide-react";
import { MarketOrder } from "../pages/extras";
import { useCurrentUserId } from "../lib/ownership";

interface MarketOrderDetailProps {
  order: MarketOrder;
  onClose: () => void;
  /** Роль наблюдателя относительно этого заказа (правило владения). */
  role?: "guest" | "owner" | "other";
  /** Колбэк изменения статуса заказа владельцем (активен/в работе/завершён/отменён). */
  onStatusChange?: (id: string, status: string) => void;
}

const fmtRub = (n: number) => (Number(n) || 0).toLocaleString("ru-RU");
const RESP_STATUS_RU: Record<string, string> = {
  pending: "Отправлен", accepted: "Принят", rejected: "Отклонён", withdrawn: "Отозван",
};

export default function MarketOrderDetail({ order, onClose, role = "other", onStatusChange }: MarketOrderDetailProps) {
  const myUid = useCurrentUserId(); /* реальный userId вместо заглушки dev-user-1 */
  const isOwner = role === "owner";
  const isGuest = role === "guest";
  const [messages, setMessages] = useState<any[]>([]);
  const [responses, setResponses] = useState<any[]>([]);
  const [deal, setDeal] = useState<any>(null);
  const [dealContacts, setDealContacts] = useState<any>(null);
  const [paying, setPaying] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Состояния для отклика мастера (ЭТАП 3 §2: структурированный отклик —
  // обязательны цена, срок и способ доставки; сервер валидирует все три поля)
  const DELIVERY_METHOD_OPTIONS: Array<[string, string]> = [
    ["cdek", "СДЭК"],
    ["russian_post", "Почта России"],
    ["courier", "Курьер"],
    ["self_pickup", "Самовывоз"],
  ];
  const [showResponseForm, setShowResponseForm] = useState(false);
  const [responsePrice, setResponsePrice] = useState("");
  const [responseDeadline, setResponseDeadline] = useState("");
  const [responseDelivery, setResponseDelivery] = useState("cdek");
  const [responseComment, setResponseComment] = useState("");
  const [submittingResponse, setSubmittingResponse] = useState(false);
  
  // Состояния для отзыва
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [masterRatings, setMasterRatings] = useState<Record<string, any>>({});

  // Загрузка данных при открытии
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [msgRes, mileRes] = await Promise.all([
          fetch(`/api/orders/${order.id}/messages`),
          fetch(`/api/orders/${order.id}/milestones`)
        ]);
        const msgData = await msgRes.json();
        const mileData = await mileRes.json();
        
        if (msgData.ok) setMessages(msgData.messages || []);
        if (mileData.ok) {
          // Если этапов нет, создаем дефолтные для заказа в работе
          if (mileData.milestones.length === 0 && order.status === 'in_progress') {
            await createDefaultMilestones();
          } else {
            setMilestones(mileData.milestones || []);
          }
        }
        /* Отклики: сервер сам решает, что видеть (владелец — все, остальные — свой). */
        try {
          const rRes = await fetch(`/api/orders/${order.id}/responses`, { credentials: "include" });
          if (rRes.ok) {
            const rData = await rRes.json();
            if (rData.ok) setResponses(rData.responses || []);
          }
        } catch {}
        /* Сделка и контакты — только участникам (сервер вернёт 403 гостю/чужому). */
        if (!isGuest) {
          try {
            const dRes = await fetch(`/api/orders/${order.id}/deal`, { credentials: "include" });
            if (dRes.ok) {
              const dData = await dRes.json();
              if (dData.ok) { setDeal(dData.deal); setDealContacts(dData.contacts); }
            }
          } catch {}
        }
      } catch (e) {
        console.error("Ошибка загрузки данных заказа", e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [order.id, order.status, role]);

  /* ===== Действия владельца: принять / отклонить отклик ===== */
  const setResponseStatus = async (rid: string, status: "accepted" | "rejected") => {
    try {
      const res = await fetch(`/api/orders/${order.id}/responses/${rid}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (res.status === 403) { alert("Управлять откликами может только владелец заказа"); return; }
      if (!res.ok) { alert("Не удалось обновить статус отклика"); return; }
      /* Принятие одного отклика автоматически отклоняет остальные (правило на сервере) —
         перечитываем список, чтобы отразить актуальные статусы. */
      const rRes = await fetch(`/api/orders/${order.id}/responses`, { credentials: "include" });
      const rData = await rRes.json();
      if (rData.ok) setResponses(rData.responses || []);
      if (status === "accepted") {
        setOrderStatusLocal("in_progress");
        onStatusChange?.(order.id, "in_progress");
        try {
          const dRes = await fetch(`/api/orders/${order.id}/deal`, { credentials: "include" });
          const dData = await dRes.json();
          if (dData.ok) setDeal(dData.deal);
        } catch {}
      }
    } catch (e) {
      console.error("Ошибка обновления отклика", e);
      alert("Не удалось обновить статус отклика");
    }
  };

  /* ===== Отзыв мастером своего отклика (только пока статус «отправлен») ===== */
  const withdrawResponse = async (rid: string) => {
    setWithdrawing(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/responses/${rid}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "withdrawn" }),
      });
      if (res.status === 409) { alert("Отозвать отклик можно только до решения заказчика"); return; }
      if (!res.ok) { alert("Не удалось отозвать отклик"); return; }
      setResponses((prev) => prev.map((r) => (r.id === rid ? { ...r, status: "withdrawn" } : r)));
    } catch (e) {
      console.error("Ошибка отзыва", e);
      alert("Не удалось отозвать отклик");
    } finally {
      setWithdrawing(false);
    }
  };

  /* ===== Предоплата по безопасной сделке (раскрывает контакты) ===== */
  const payPrepay = async () => {
    setPaying(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/deal/prepay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setDeal(data.deal);
        const cRes = await fetch(`/api/orders/${order.id}/deal`, { credentials: "include" });
        const cData = await cRes.json();
        if (cData.ok) { setDeal(cData.deal); setDealContacts(cData.contacts); }
      } else if (data.error === "no_accepted_response") {
        alert("Сначала примите отклик мастера");
      } else if (res.status === 403) {
        alert("Внести предоплату может только заказчик — владелец заказа");
      } else {
        alert("Платёж не прошёл. Попробуйте ещё раз.");
      }
    } catch (e) {
      console.error("Ошибка предоплаты", e);
      alert("Платёж не прошёл. Попробуйте ещё раз.");
    } finally {
      setPaying(false);
    }
  };

  /* ===== Смена статуса заказа владельцем ===== */
  const setOrderStatusLocal = (status: string) => {
    import("../pages/extras").then(({ useMarketStore }) => {
      useMarketStore.setState((st: any) => ({ orders: st.orders.map((o: any) => (o.id === order.id ? { ...o, status } : o)) }));
    });
  };
  const changeOrderStatus = async (status: string) => {
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (res.status === 403) { alert("Менять статус может только владелец заказа"); return; }
      if (!res.ok) { alert("Не удалось изменить статус"); return; }
      setOrderStatusLocal(status);
      onStatusChange?.(order.id, status);
    } catch (e) {
      console.error("Ошибка смены статуса", e);
      alert("Не удалось изменить статус");
    }
  };

  const createDefaultMilestones = async () => {
    const defaults = [
      { title: "Согласование деталей", description: "Обсуждение ТЗ и материалов", status: "completed" },
      { title: "Изготовление", description: "Основной этап работы", status: "in_progress" },
      { title: "Финальная проверка", description: "Контроль качества и упаковка", status: "pending" }
    ];
    const created = [];
    for (const m of defaults) {
      const res = await fetch(`/api/orders/${order.id}/milestones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(m)
      });
      const data = await res.json();
      if (data.ok) created.push(data.milestone);
    }
    setMilestones(created);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    
    const msgData = { message: newMessage.trim() }; /* sender_id сервер берёт из JWT-токена */
    try {
      const res = await fetch(`/api/orders/${order.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msgData)
      });
      const data = await res.json();
      if (data.ok) {
        setMessages(prev => [...prev, data.message]);
        setNewMessage("");
      }
    } catch (e) {
      console.error("Ошибка отправки сообщения", e);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const submitResponse = async () => {
    if (!responsePrice || !responseDeadline || !responseComment.trim() || !responseDelivery) {
      alert("Пожалуйста, заполните все поля: цену, сроки, способ доставки и комментарий");
      return;
    }
    setSubmittingResponse(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          price: Number(responsePrice),
          deadline_days: Number(responseDeadline),
          delivery_method: responseDelivery,
          comment: responseComment.trim()
        })
      });
      const data = await res.json();
      if (data.ok) {
        alert("Ваш отклик успешно отправлен заказчику!");
        setShowResponseForm(false);
        setResponsePrice("");
        setResponseDeadline("");
        setResponseComment("");
        setResponseDelivery("cdek");
      } else if (res.status === 400) {
        alert(data.message || "Отклик должен содержать корректные цену, срок и способ доставки");
      } else if (res.status === 409 || data.error === "already_responded") {
        alert("Вы уже откликнулись на этот заказ");
      } else if (res.status === 403 || data.error === "own_order") {
        alert("Нельзя откликнуться на собственный заказ");
      } else if (res.status === 401) {
        alert("Войдите в аккаунт, чтобы откликнуться");
      }
    } catch (e) {
      console.error("Ошибка отправки отклика", e);
      alert("Не удалось отправить отклик");
    } finally {
      setSubmittingResponse(false);
    }
  };

  const submitReview = async () => {
    if (!reviewText.trim()) {
      alert("Пожалуйста, напишите текст отзыва");
      return;
    }
    setSubmittingReview(true);
    try {
      const res = await fetch(`/api/market/orders/${order.id}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          /* ЭТАП 4: стороны сделки сервер определяет сам (сессия + принятый
             отклик); клиентские reviewer_id/reviewee_id игнорируются. */
          rating: reviewRating,
          text: reviewText.trim()
        })
      });
      const data = await res.json();
      if (data.ok) {
        alert("Спасибо за ваш отзыв!");
        // Обновляем локальный статус заказа, чтобы скрыть форму
        (order as any).reviewed = true;
        setReviewText("");
        setReviewRating(5);
      }
    } catch (e) {
      console.error("Ошибка отправки отзыва", e);
      alert("Не удалось отправить отзыв");
    } finally {
      setSubmittingReview(false);
    }
  };

  // Загрузка рейтинга мастера: берём master_id из принятого отклика (без заглушки)
  const acceptedMasterId = responses.find((r) => r.status === "accepted")?.master_id || deal?.master_id || "";
  useEffect(() => {
    const fetchRatings = async () => {
      if (!acceptedMasterId) return;
      const ratingsMap: Record<string, any> = {};
      try {
        const res = await fetch(`/api/market/users/${acceptedMasterId}/reviews`);
        const data = await res.json();
        if (data.ok) ratingsMap[acceptedMasterId] = data;
      } catch (e) {
        console.error("Ошибка загрузки рейтинга", e);
      }
      setMasterRatings(ratingsMap);
    };
    if (milestones.length > 0 || acceptedMasterId) fetchRatings();
  }, [milestones, acceptedMasterId]);

  const completedCount = milestones.filter(m => m.status === 'completed').length;
  const progress = milestones.length > 0 ? (completedCount / milestones.length) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-surface w-full max-w-4xl max-h-[90vh] md:max-h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Шапка */}
        <div className="flex items-center justify-between p-5 border-b border-line-soft shrink-0">
          <div>
            <h2 className="font-display font-bold text-[20px] text-ink">{order.title}</h2>
            <p className="text-[13px] text-ink-mute mt-1">{order.type} · {order.region} · {order.budget.toLocaleString('ru-RU')} ₽</p>
            {acceptedMasterId && masterRatings[acceptedMasterId] && (
              <div className="flex items-center gap-1.5 mt-2">
                <Star size={14} className="text-accent-deep" fill="#d98e32" color="#d98e32" />
                <span className="text-[13px] font-bold text-ink">{masterRatings[acceptedMasterId].avgRating.toFixed(1)}</span>
                <span className="text-[12px] text-ink-soft">({masterRatings[acceptedMasterId].count} отзывов)</span>
              </div>
            )}
          </div>
          
          {/* Правило владения: гость — только публичная информация; владелец — управление;
              чужой авторизованный мастер — только кнопка отклика. */}
          {isOwner ? (
            <div className="flex gap-2 shrink-0 flex-wrap justify-end">
              {/* ЭТАП 3 (п.1): кнопки соответствуют ЖЁСТКОМУ конвейеру статусов.
                  Подтверждение доставки/получения инициирует ТОЛЬКО покупатель;
                  продавец не может отметить доставку или завершить сделку сам. */}
              {order.status === "shipped" && (
                <button onClick={() => changeOrderStatus("delivered")} className="h-[44px] px-4 rounded-xl bg-premium text-white font-bold text-[13px] hover:opacity-90 transition-opacity cursor-pointer">Подтвердить доставку</button>
              )}
              {order.status === "delivered" && (
                <button onClick={() => changeOrderStatus("confirmed")} className="h-[44px] px-4 rounded-xl bg-success text-white font-bold text-[13px] hover:opacity-90 transition-opacity cursor-pointer">Подтвердить получение</button>
              )}
              {order.status === "confirmed" && (
                <button onClick={() => changeOrderStatus("completed")} className="h-[44px] px-4 rounded-xl bg-success text-white font-bold text-[13px] hover:opacity-90 transition-opacity cursor-pointer">Заказ завершён</button>
              )}
              {(order.status === "published" || order.status === "in_progress") && (
                <button onClick={() => changeOrderStatus("cancelled")} className="h-[44px] px-4 rounded-xl border border-error/40 text-error font-bold text-[13px] hover:bg-error/10 transition-colors cursor-pointer">Отменить заказ</button>
              )}
            </div>
          ) : !isGuest && order.status === 'published' && !showResponseForm ? (
            <button
              onClick={() => setShowResponseForm(true)}
              className="h-[44px] px-6 rounded-xl bg-accent text-ink font-bold text-[14px] hover:bg-accent-deep hover:text-cream transition-colors cursor-pointer flex items-center gap-2 shrink-0"
            >
              <Send size={16} /> Откликнуться на заказ
            </button>
          ) : null}
          <button onClick={onClose} className="p-2 rounded-full hover:bg-line-soft transition-colors cursor-pointer">
            <X size={20} className="text-ink-soft" />
          </button>
        </div>

        {/* Форма отклика мастера (только чужому авторизованному мастеру) */}
        {showResponseForm && !isOwner && !isGuest && order.status === 'published' && (
          <div className="p-6 bg-cream/30 border-b border-line-soft">
            <h3 className="font-bold text-[16px] text-ink mb-4">Ваше предложение</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-[12px] font-bold text-ink-mute mb-1.5 block">Итоговая цена, ₽ *</label>
                <input
                  type="number"
                  min={1}
                  value={responsePrice}
                  onChange={(e) => setResponsePrice(e.target.value)}
                  placeholder="Например, 50000"
                  className="w-full h-[44px] px-4 rounded-xl border border-line-soft bg-surface text-[14px] focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
                />
              </div>
              <div>
                <label className="text-[12px] font-bold text-ink-mute mb-1.5 block">Срок выполнения, дней *</label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={responseDeadline}
                  onChange={(e) => setResponseDeadline(e.target.value)}
                  placeholder="Например, 14"
                  className="w-full h-[44px] px-4 rounded-xl border border-line-soft bg-surface text-[14px] focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
                />
              </div>
              {/* ЭТАП 3 §2: способ доставки — обязательное структурированное поле отклика */}
              <div className="md:col-span-2">
                <label className="text-[12px] font-bold text-ink-mute mb-1.5 block">Способ доставки *</label>
                <select
                  value={responseDelivery}
                  onChange={(e) => setResponseDelivery(e.target.value)}
                  className="w-full h-[44px] px-4 rounded-xl border border-line-soft bg-surface text-[14px] focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
                >
                  {DELIVERY_METHOD_OPTIONS.map(([v, label]) => (
                    <option key={v} value={v}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mb-4">
              <label className="text-[12px] font-bold text-ink-mute mb-1.5 block">Комментарий (почему вы подходите)</label>
              <textarea
                value={responseComment}
                onChange={(e) => setResponseComment(e.target.value)}
                placeholder="Расскажите о своем опыте, материалах и подходе к работе..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-line-soft bg-surface text-[14px] focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={submitResponse}
                disabled={submittingResponse || !responsePrice || !responseDeadline || !responseComment.trim()}
                className="h-[44px] px-6 rounded-xl bg-accent text-ink font-bold text-[14px] hover:bg-accent-deep hover:text-cream disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-2"
              >
                {submittingResponse ? "Отправка..." : "Отправить отклик"}
              </button>
              <button
                onClick={() => setShowResponseForm(false)}
                className="h-[44px] px-6 rounded-xl border border-line-soft text-ink-soft font-bold text-[14px] hover:bg-line-soft transition-colors cursor-pointer"
              >
                Отмена
              </button>
            </div>
          </div>
        )}

        {/* ===== Отклики (правило владения) =====
           Владелец заказа — полный список откликов с принятием/отклонением.
           Мастер — только собственный отклик с возможностью отозвать (пока pending).
           Гость — блок скрыт полностью. */}
        {isOwner && responses.length > 0 && (
          <div className="border-t border-line-soft p-5 bg-surface shrink-0 max-h-[34vh] overflow-y-auto">
            <h3 className="font-bold text-[15px] text-ink mb-3 flex items-center gap-2">
              <Users size={16} className="text-accent-deep" /> Отклики на заказ ({responses.length})
            </h3>
            <div className="space-y-3">
              {responses.map((r) => (
                <div key={r.id} className="rounded-xl border border-line-soft p-4 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[180px]">
                    <p className="text-[13px] font-bold text-ink">{r.master_name || "Мастер " + String(r.master_id).slice(-4)}</p>
                    <p className="text-[12px] text-ink-soft mt-0.5 line-clamp-2">{r.comment}</p>
                    <p className="text-[11px] text-ink-mute mt-1">{new Date(r.created_at).toLocaleDateString("ru-RU")}</p>
                  </div>
                  <div className="text-right mr-2">
                    <p className="text-[14px] font-bold text-ink">{fmtRub(r.price)} ₽</p>
                    <p className="text-[11px] text-ink-mute">{r.deadline_days} дн.</p>
                    {r.delivery_method && (
                      <p className="text-[11px] text-ink-mute">🚚 {Object.fromEntries(DELIVERY_METHOD_OPTIONS)[r.delivery_method] || r.delivery_method}</p>
                    )}
                  </div>
                  {r.status === "pending" ? (
                    <div className="flex gap-2">
                      <button onClick={() => setResponseStatus(r.id, "accepted")} disabled={withdrawing} className="h-[44px] px-4 rounded-xl bg-success text-white text-[12px] font-bold hover:opacity-90 transition-opacity cursor-pointer">Принять</button>
                      <button onClick={() => setResponseStatus(r.id, "rejected")} disabled={withdrawing} className="h-[44px] px-4 rounded-xl border border-line text-ink-soft text-[12px] font-bold hover:bg-line-soft transition-colors cursor-pointer">Отклонить</button>
                    </div>
                  ) : (
                    <span className={`px-3 py-1.5 rounded-lg text-[11px] font-bold ${r.status === "accepted" ? "bg-success/10 text-success" : r.status === "withdrawn" ? "bg-line-soft text-ink-mute" : "bg-error/10 text-error"}`}>{RESP_STATUS_RU[r.status] || r.status}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {!isOwner && !isGuest && responses.some((r) => r.master_id === myUid) && (() => {
          const mine = responses.find((r) => r.master_id === myUid);
          return (
            <div className="border-t border-line-soft p-4 bg-cream/30 shrink-0 flex flex-wrap items-center gap-3">
              <span className={`px-3 py-1.5 rounded-lg text-[11px] font-bold ${mine.status === "accepted" ? "bg-success/10 text-success" : mine.status === "pending" ? "bg-accent-soft text-accent-deep" : "bg-error/10 text-error"}`}>Ваш отклик: {RESP_STATUS_RU[mine.status] || mine.status}</span>
              <span className="text-[12px] text-ink-soft">{fmtRub(mine.price)} ₽ · {mine.deadline_days} дн.</span>
              {mine.status === "pending" && (
                <button onClick={() => withdrawResponse(mine.id)} disabled={withdrawing} className="h-[44px] ml-auto px-4 rounded-xl border border-line text-ink-soft text-[12px] font-bold hover:bg-line-soft transition-colors cursor-pointer">
                  {withdrawing ? "Отозвать..." : "Отозвать отклик"}
                </button>
              )}
            </div>
          );
        })()}

        {/* ===== Безопасная сделка (ЭТАП 3 §3): эскроу-конвейер =====
           awaiting_prepay → prepaid (escrow=held: средства заблокированы на
           защищённом счёте платформы, НЕ переведены мастеру) → settled
           (escrow=released: автоматический окончательный расчёт после
           подтверждения получения покупателем). Отмена — возврат (refunded). */}
        {!isGuest && deal && deal.status !== "none" && (
          <div className="border-t border-line-soft p-4 bg-surface shrink-0">
            <h3 className="font-bold text-[13px] text-ink mb-2 flex items-center gap-2"><ShieldCheck size={15} className="text-accent-deep" /> Безопасная сделка · средства под защитой платформы</h3>
            {deal.status === "awaiting_prepay" && (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-[12px] text-ink-soft flex-1 min-w-[200px]">Отклик принят — безопасная сделка инициирована. Внесите предоплату: средства будут заблокированы на защищённом счёте платформы и переведены мастеру только после подтверждения вами получения. Без предоплаты в течение 7 дней сделка автоматически отменяется.</p>
                {isOwner && (
                  <button onClick={payPrepay} disabled={paying} className="h-[44px] px-5 rounded-xl bg-accent text-ink font-bold text-[13px] hover:bg-accent-deep hover:text-cream disabled:opacity-50 transition-colors cursor-pointer">
                    {paying ? "Обработка платежа..." : "Внести предоплату"}
                  </button>
                )}
              </div>
            )}
            {deal.status === "prepaid" && (
              <div className="space-y-2">
                <p className="text-[12px] text-success font-bold">✓ Предоплата {fmtRub(deal.prepay_amount)} ₽ внесена — средства заблокированы на счёте платформы (эскроу), контакты раскрыты обеим сторонам</p>
                <p className="text-[11px] text-ink-mute">Окончательный расчёт с мастером произойдёт автоматически после подтверждения получения заказа. До этого момента деньги недоступны ни одной из сторон.</p>
                {dealContacts && (dealContacts.phone || dealContacts.telegram) ? (
                  <div className="flex flex-wrap gap-4 text-[13px] text-ink">
                    {dealContacts.phone && <span>📞 <a href={"tel:" + dealContacts.phone} className="underline">{dealContacts.phone}</a></span>}
                    {dealContacts.telegram && <span>✈️ <a href={dealContacts.telegram} target="_blank" rel="noreferrer" className="underline">{dealContacts.telegram}</a></span>}
                  </div>
                ) : (
                  <p className="text-[12px] text-ink-mute">У второй стороны не заполнены контакты.</p>
                )}
              </div>
            )}
            {(deal.status === "settled" || deal.escrow === "released") && (
              <p className="text-[12px] text-success font-bold">✓ Окончательный расчёт произведён: средства разблокированы и переведены мастеру. Сделка закрыта.</p>
            )}
            {(deal.status === "cancelled_auto" || deal.escrow === "refunded") && (
              <p className="text-[12px] text-error font-bold">{deal.escrow === "refunded" ? "Сделка отменена: заблокированная предоплата возвращена покупателю." : "Сделка отменена: предоплата не была внесена в течение 7 дней. Заказ снова открыт для откликов."}</p>
            )}
          </div>
        )}

        {/* Тело: 2 колонки (Этапы слева, Чат справа) */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Левая колонка: Этапы */}
          <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-line-soft p-5 overflow-y-auto bg-cream/30 max-h-[40vh] md:max-h-none">
            <h3 className="font-bold text-[15px] text-ink mb-4 flex items-center gap-2">
              <Clock size={16} className="text-accent-deep" /> Этапы выполнения
            </h3>
            
            {/* Прогресс-бар */}
            <div className="mb-6">
              <div className="flex justify-between text-[12px] text-ink-mute mb-1.5">
                <span>Прогресс</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="h-2 bg-line-soft rounded-full overflow-hidden">
                <div className="h-full bg-accent transition-all duration-500" style={{ width: `${progress}%` }}></div>
              </div>
            </div>

            {/* Список этапов */}
            <div className="space-y-4">
              {loading ? (
                <p className="text-[12px] text-ink-mute">Загрузка этапов...</p>
              ) : milestones.length === 0 ? (
                <p className="text-[12px] text-ink-mute">Этапы будут добавлены после принятия исполнителя.</p>
              ) : (
                milestones.map((m, idx) => (
                  <div key={m.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                        m.status === 'completed' ? 'bg-success text-white' : 
                        m.status === 'in_progress' ? 'bg-accent text-ink' : 'bg-line-soft text-ink-mute'
                      }`}>
                        {m.status === 'completed' ? <CheckCircle2 size={14} /> : <span className="text-[10px] font-bold">{idx + 1}</span>}
                      </div>
                      {idx < milestones.length - 1 && <div className="w-0.5 flex-1 bg-line-soft mt-1"></div>}
                    </div>
                    <div className="pb-4">
                      <p className={`text-[13px] font-bold ${m.status === 'pending' ? 'text-ink-mute' : 'text-ink'}`}>{m.title}</p>
                      <p className="text-[11px] text-ink-soft mt-0.5">{m.description}</p>
                      {m.status === 'in_progress' && (
                        <span className="inline-block mt-1.5 px-2 py-0.5 rounded bg-accent-soft text-accent-deep text-[10px] font-bold">В работе</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Правая колонка: Чат */}
          <div className="flex-1 flex flex-col bg-surface min-h-[50vh] md:min-h-0">
            <div className="p-4 border-b border-line-soft shrink-0">
              <h3 className="font-bold text-[15px] text-ink flex items-center gap-2">
                <MessageSquare size={16} className="text-accent-deep" /> Чат по заказу
              </h3>
            </div>
            
            {/* Сообщения */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loading ? (
                <p className="text-center text-[12px] text-ink-mute mt-10">Загрузка истории чата...</p>
              ) : messages.length === 0 ? (
                <div className="text-center py-10">
                  <MessageSquare size={32} className="mx-auto text-line-soft mb-2" />
                  <p className="text-[13px] text-ink-mute">Начните обсуждение деталей заказа</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = !!myUid && msg.sender_id === myUid; /* свои сообщения — по реальному userId */
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                        isMe ? 'bg-accent text-ink rounded-br-sm' : 'bg-cream text-ink rounded-bl-sm border border-line-soft'
                      }`}>
                        <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                        <p className={`text-[10px] mt-1.5 ${isMe ? 'text-ink/70' : 'text-ink-mute'}`}>
                          {new Date(msg.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Ввод сообщения */}
            <form onSubmit={sendMessage} className="p-4 border-t border-line-soft shrink-0 bg-surface">
              <div className="flex gap-2">
                <button type="button" className="p-2.5 rounded-xl border border-line-soft text-ink-mute hover:text-ink hover:border-dark transition-colors cursor-pointer">
                  <Paperclip size={18} />
                </button>
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Напишите сообщение..."
                  className="flex-1 px-4 py-2.5 rounded-xl border border-line-soft bg-cream/50 text-[13px] focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
                />
                <button 
                  type="submit" 
                  disabled={!newMessage.trim()}
                  className="p-2.5 rounded-xl bg-accent text-ink hover:bg-accent-deep hover:text-cream disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <Send size={18} />
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* ЭТАП 4 (клиент): форма отзыва — только владельцу завершённой сделки.
            Идентификаторы сторон сервер вычисляет сам по сессии и принятому
            отклику; передать чужой reviewer_id/reviewee_id невозможно. */}
        {isOwner && order.status === 'completed' && (
          <div className="border-t border-line-soft p-6 bg-cream/30">
            <h3 className="font-bold text-[16px] text-ink mb-4 flex items-center gap-2">
              <Star size={18} className="text-accent-deep" /> 
              {(order as any).reviewed ? "Ваш отзыв" : "Оставить отзыв о работе мастера"}
            </h3>
            
            {(order as any).reviewed ? (
              <div className="bg-success-soft/50 border border-success/30 rounded-xl p-4 text-center">
                <p className="text-[14px] font-bold text-success">✓ Спасибо! Вы уже оставили отзыв на этот заказ.</p>
                <p className="text-[12px] text-ink-soft mt-1">Он поможет другим пользователям сделать правильный выбор.</p>
              </div>
            ) : (
              <div className="max-w-2xl">
                <div className="mb-4">
                  <label className="text-[13px] font-bold text-ink mb-2 block">Ваша оценка</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setReviewRating(star)}
                        className="transition-transform hover:scale-110 cursor-pointer"
                      >
                        <Star 
                          size={32} 
                          fill={star <= reviewRating ? "#d98e32" : "none"} 
                          color={star <= reviewRating ? "#d98e32" : "#d9d4c7"} 
                        />
                      </button>
                    ))}
                    <span className="ml-3 text-[14px] font-bold text-ink-soft self-center">
                      {reviewRating === 5 ? "Отлично!" : reviewRating === 4 ? "Хорошо" : reviewRating === 3 ? "Нормально" : "Плохо"}
                    </span>
                  </div>
                </div>
                
                <div className="mb-4">
                  <label className="text-[13px] font-bold text-ink mb-2 block">Комментарий</label>
                  <textarea
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    placeholder="Расскажите, что вам понравилось или что можно улучшить..."
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl border border-line-soft bg-surface text-[13px] focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all resize-none"
                  />
                </div>

                <button
                  onClick={submitReview}
                  disabled={submittingReview || !reviewText.trim()}
                  className="h-[44px] px-6 rounded-xl bg-accent text-ink font-bold text-[14px] hover:bg-accent-deep hover:text-cream disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-2"
                >
                  {submittingReview ? "Отправка..." : "Отправить отзыв"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
