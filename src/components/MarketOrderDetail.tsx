import { useState, useEffect, useRef } from "react";
import { X, CheckCircle2, Clock, MessageSquare, Send, Paperclip, Star } from "lucide-react";
import { MarketOrder } from "../pages/extras";

interface MarketOrderDetailProps {
  order: MarketOrder;
  onClose: () => void;
}

export default function MarketOrderDetail({ order, onClose }: MarketOrderDetailProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Состояния для отклика мастера
  const [showResponseForm, setShowResponseForm] = useState(false);
  const [responsePrice, setResponsePrice] = useState("");
  const [responseDeadline, setResponseDeadline] = useState("");
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
      } catch (e) {
        console.error("Ошибка загрузки данных заказа", e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [order.id, order.status]);

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
    
    const msgData = { sender_id: "dev-user-1", message: newMessage.trim() };
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
    if (!responsePrice || !responseDeadline || !responseComment.trim()) {
      alert("Пожалуйста, заполните все поля: цену, сроки и комментарий");
      return;
    }
    setSubmittingResponse(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          master_id: "dev-master-1", // В реальности ID текущего пользователя-мастера
          price: Number(responsePrice),
          deadline_days: Number(responseDeadline),
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
        body: JSON.stringify({
          reviewer_id: "dev-user-1",
          reviewee_id: "dev-master-1", // В реальности берем из принятого отклика
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

  // Загрузка рейтинга мастера при загрузке откликов
  useEffect(() => {
    const fetchRatings = async () => {
      const ratingsMap: Record<string, any> = {};
      for (const m of milestones) {
        // Заглушка: в реальности берем master_id из принятого отклика
        const masterId = "dev-master-1"; 
        if (!ratingsMap[masterId]) {
          try {
            const res = await fetch(`/api/market/users/${masterId}/reviews`);
            const data = await res.json();
            if (data.ok) ratingsMap[masterId] = data;
          } catch (e) {
            console.error("Ошибка загрузки рейтинга", e);
          }
        }
      }
      setMasterRatings(ratingsMap);
    };
    if (milestones.length > 0) fetchRatings();
  }, [milestones]);

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
            {masterRatings["dev-master-1"] && (
              <div className="flex items-center gap-1.5 mt-2">
                <Star size={14} className="text-accent-deep" fill="#d98e32" color="#d98e32" />
                <span className="text-[13px] font-bold text-ink">{masterRatings["dev-master-1"].avgRating.toFixed(1)}</span>
                <span className="text-[12px] text-ink-soft">({masterRatings["dev-master-1"].count} отзывов)</span>
              </div>
            )}
          </div>
          
          {/* Кнопка отклика для опубликованных заказов */}
          {order.status === 'published' && !showResponseForm && (
            <button
              onClick={() => setShowResponseForm(true)}
              className="h-[44px] px-6 rounded-xl bg-accent text-ink font-bold text-[14px] hover:bg-accent-deep hover:text-cream transition-colors cursor-pointer flex items-center gap-2 shrink-0"
            >
              <Send size={16} /> Откликнуться на заказ
            </button>
          )}
          <button onClick={onClose} className="p-2 rounded-full hover:bg-line-soft transition-colors cursor-pointer">
            <X size={20} className="text-ink-soft" />
          </button>
        </div>

        {/* Форма отклика мастера */}
        {showResponseForm && order.status === 'published' && (
          <div className="p-6 bg-cream/30 border-b border-line-soft">
            <h3 className="font-bold text-[16px] text-ink mb-4">Ваше предложение</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-[12px] font-bold text-ink-mute mb-1.5 block">Ваша цена, ₽</label>
                <input
                  type="number"
                  value={responsePrice}
                  onChange={(e) => setResponsePrice(e.target.value)}
                  placeholder="Например, 50000"
                  className="w-full h-[44px] px-4 rounded-xl border border-line-soft bg-surface text-[14px] focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
                />
              </div>
              <div>
                <label className="text-[12px] font-bold text-ink-mute mb-1.5 block">Срок выполнения, дней</label>
                <input
                  type="number"
                  value={responseDeadline}
                  onChange={(e) => setResponseDeadline(e.target.value)}
                  placeholder="Например, 14"
                  className="w-full h-[44px] px-4 rounded-xl border border-line-soft bg-surface text-[14px] focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
                />
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
                  const isMe = msg.sender_id === "dev-user-1"; // Заглушка для текущего пользователя
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

        {/* Секция отзыва (только для завершенных заказов) */}
        {order.status === 'completed' && (
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
