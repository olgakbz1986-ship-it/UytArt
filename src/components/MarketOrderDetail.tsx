import { useState, useEffect, useRef } from "react";
import { X, CheckCircle2, Clock, MessageSquare, Send, Paperclip } from "lucide-react";
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

  // Загрузка данных при открытии
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [msgRes, mileRes] = await Promise.all([
          fetch(`http://localhost:8787/api/orders/${order.id}/messages`),
          fetch(`http://localhost:8787/api/orders/${order.id}/milestones`)
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
      const res = await fetch(`http://localhost:8787/api/orders/${order.id}/milestones`, {
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
      const res = await fetch(`http://localhost:8787/api/orders/${order.id}/messages`, {
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

  const completedCount = milestones.filter(m => m.status === 'completed').length;
  const progress = milestones.length > 0 ? (completedCount / milestones.length) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-surface w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Шапка */}
        <div className="flex items-center justify-between p-5 border-b border-line-soft shrink-0">
          <div>
            <h2 className="font-display font-bold text-[20px] text-ink">{order.title}</h2>
            <p className="text-[13px] text-ink-mute mt-1">{order.type} · {order.region} · {order.budget.toLocaleString('ru-RU')} ₽</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-line-soft transition-colors cursor-pointer">
            <X size={20} className="text-ink-soft" />
          </button>
        </div>

        {/* Тело: 2 колонки (Этапы слева, Чат справа) */}
        <div className="flex-1 flex overflow-hidden">
          {/* Левая колонка: Этапы */}
          <div className="w-1/3 border-r border-line-soft p-5 overflow-y-auto bg-cream/30">
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
          <div className="flex-1 flex flex-col bg-surface">
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
      </div>
    </div>
  );
}
