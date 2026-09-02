import { useEffect, useMemo, useRef, useState } from "react";
import { Send, Archive, ShieldAlert, X } from "lucide-react";
import { Product, fmtDate } from "../data/seed";
import { useChatStore, buyerQuestions, sellerTemplates, orderPrompts } from "../lib/chat";
import { useAppStore, type Order, NEXT_STATUS } from "../lib/store";
import { Modal, Btn } from "./ui";

/* ============================================================
   Чат: только структурированный обмен. Покупатель — кнопки,
   продавец — 9 шаблонов + «Свой ответ…».
   ============================================================ */

export function ChatModal({ open, onClose, kind, product, order }: {
  open: boolean;
  onClose: () => void;
  kind: "product" | "order";
  product?: Product;
  order?: Order;
}) {
  const user = useAppStore((s) => s.user);
  const ensure = useChatStore((s) => s.ensure);
  const send = useChatStore((s) => s.send);
  const archive = useChatStore((s) => s.archive);
  const dialogs = useChatStore((s) => s.dialogs);

  /* сторона диалога: демо-переключатель покупатель/продавец */
  const [side, setSide] = useState<"buyer" | "seller">("buyer");
  const [customOpen, setCustomOpen] = useState(false);
  const [customText, setCustomText] = useState("");
  const [warn, setWarn] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const key = kind === "product" ? `prod-${product?.id}` : `order-${order?.id}`;
  useEffect(() => {
    if (open && kind === "product" && product) ensure(key, "product", product.id);
    if (open && kind === "order" && order) ensure(key, "order", order.id);
  }, [open, kind, product, order, key, ensure]);

  const dialog = dialogs[key];
  const msgs = dialog?.messages || [];
  const archived = dialog?.archived || false;

  const buyerQs = useMemo(() => (product ? buyerQuestions(product) : []), [product]);
  const sellerTs = useMemo(() => (product ? sellerTemplates(product) : []), [product]);
  const orderQs = useMemo(() => (order ? orderPrompts(order.status) : []), [order]);

  const asked = useMemo(() => new Set(msgs.filter((m) => m.role === "buyer").map((m) => m.text)), [msgs]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs.length, warn]);

  /* авто-архивация чата заказа при статусе «Получен» */
  useEffect(() => {
    if (kind === "order" && order?.status === "received" && dialog && !dialog.archived) {
      archive(key);
      send(key, "buyer", "Платформа", "Чат по этому заказу завершен. Спасибо за покупку! Если с товаром есть проблемы, используйте кнопку «Сообщить о проблеме».");
    }
  }, [kind, order, dialog, key, archive, send]);

  const senderName = side === "buyer" ? (user?.name || "Покупатель") : "Мастер";

  const doSend = (text: string) => {
    const { blocked } = send(key, side, senderName, text);
    if (blocked) {
      setWarn("Общение и оплата происходят только внутри УютАрт для гарантии безопасной сделки и защиты от мошенников.");
    } else {
      setWarn(null);
    }
    setCustomText("");
    setCustomOpen(false);
  };

  const title = kind === "product"
    ? `Чат с мастером · ${product?.name}`
    : `Чат по заказу ${order?.number}`;

  return (
    <Modal open={open} onClose={onClose} title={title} wide>
      {/* переключатель стороны (демо) */}
      <div className="flex items-center justify-between mb-4">
        <div className="inline-flex bg-line-soft rounded-[10px] p-1">
          {(["buyer", "seller"] as const).map((s) => (
            <button key={s} onClick={() => setSide(s)}
              className={`px-4 h-9 rounded-[8px] text-[13px] font-bold transition-all duration-200 cursor-pointer ${side === s ? "bg-dark text-cream shadow-card" : "text-ink-soft hover:text-ink"}`}>
              {s === "buyer" ? "Покупатель" : "Продавец"}
            </button>
          ))}
        </div>
        {kind === "order" && order && (
          <span className="text-[12px] font-semibold text-ink-mute">Статус: <span className="text-ink font-bold">{order.status === "paid" ? "Оплачено" : order.status === "shipped" ? "В пути" : order.status === "delivered" ? "Готов к выдаче" : "Получен"}</span></span>
        )}
      </div>

      {archived && (
        <div className="flex items-start gap-2.5 bg-line-soft rounded-[10px] px-4 py-3 mb-4">
          <Archive size={16} className="text-ink-soft shrink-0 mt-0.5" />
          <p className="text-[12.5px] text-ink-soft leading-relaxed">
            Чат по этому заказу <strong className="text-ink">завершён</strong>. Спасибо за покупку! Если с товаром есть проблемы, используйте кнопку «Сообщить о проблеме» в личном кабинете.
          </p>
        </div>
      )}

      {/* лента сообщений */}
      <div ref={listRef} className="h-[300px] overflow-y-auto rounded-[14px] border border-line-soft bg-cream/50 p-4 space-y-3 mb-4">
        {msgs.length === 0 && (
          <p className="text-[13px] text-ink-mute text-center py-10">
            {kind === "product" ? "Задайте вопрос мастеру — выберите готовый ниже." : "Чат заказа открыт после оплаты. Здесь можно согласовать детали."}
          </p>
        )}
        {msgs.map((m) => {
          if (m.blocked) {
            return (
              <div key={m.id} className="flex justify-center fade-up">
                <div className="bg-line-soft rounded-[10px] px-4 py-2.5 max-w-[85%] text-center">
                  <p className="text-[13px] text-ink-soft blur-[4px] select-none">{m.text}</p>
                  <p className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-ink-mute mt-1">
                    <ShieldAlert size={12} className="text-error" /> Сообщение скрыто: общение только внутри УютАрт
                  </p>
                </div>
              </div>
            );
          }
          const mine = m.role === side;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"} fade-up`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${mine ? "bg-dark text-cream rounded-br-[6px]" : "bg-surface text-ink rounded-bl-[6px] shadow-card"}`}>
                <p className="text-[13.5px] leading-relaxed">{m.text}</p>
                <p className={`text-[10.5px] mt-1 ${mine ? "text-cream/50" : "text-ink-mute"}`}>{m.name} · {new Date(m.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            </div>
          );
        })}
        {warn && (
          <div className="flex items-start gap-2 bg-error-soft border border-error/30 rounded-[10px] px-3.5 py-2.5 fade-up">
            <ShieldAlert size={15} className="text-error shrink-0 mt-0.5" />
            <p className="text-[12px] text-error leading-relaxed">{warn}</p>
          </div>
        )}
      </div>

      {/* зона ввода: только структурированная */}
      {!archived && (
        <div>
          {side === "buyer" ? (
            <div>
              <p className="text-[12px] font-bold uppercase tracking-wide text-ink-mute mb-2">
                {kind === "product" ? "Готовые вопросы мастеру" : "Вопросы по заказу"}
              </p>
              <div className="flex flex-wrap gap-2">
                {(kind === "product" ? buyerQs : orderQs).map((q) => {
                  const done = asked.has(q);
                  return (
                    <button key={q} onClick={() => !done && doSend(q)} disabled={done}
                      className={`px-3.5 py-2 rounded-full text-[12.5px] font-semibold border transition-all duration-200 cursor-pointer ${done ? "border-line-soft text-ink-mute bg-line-soft/50 cursor-not-allowed line-through" : "border-line bg-surface text-ink hover:border-dark hover:bg-cream"}`}>
                      {q}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div>
              <p className="text-[12px] font-bold uppercase tracking-wide text-ink-mute mb-2">Быстрые ответы</p>
              {!customOpen ? (
                <div className="flex flex-wrap gap-2">
                  {sellerTs.map((t) => (
                    <button key={t.label} onClick={() => (t.custom ? setCustomOpen(true) : doSend(t.label))}
                      className={`px-3.5 py-2 rounded-full text-[12.5px] font-semibold border transition-all duration-200 cursor-pointer ${t.custom ? "border-ai bg-ai-soft text-ai hover:bg-ai hover:text-cream" : "border-line bg-surface text-ink hover:border-dark hover:bg-cream"}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="fade-up">
                  <textarea
                    className="field"
                    rows={3}
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    placeholder="Ваш вариант ответа… (Enter — отправить, Shift+Enter — перенос)"
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (customText.trim()) doSend(customText.trim()); } }}
                    autoFocus
                  />
                  <div className="flex gap-2 mt-2">
                    <Btn size="sm" onClick={() => customText.trim() && doSend(customText.trim())}><Send size={14} /> Отправить</Btn>
                    <Btn size="sm" variant="ghost" onClick={() => { setCustomOpen(false); setCustomText(""); }}><X size={14} /> Отмена</Btn>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
