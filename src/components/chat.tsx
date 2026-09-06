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
  const user = useAppStore((s) => s.session);
  const ensure = useChatStore((s) => s.ensure);
  const send = useChatStore((s) => s.send);
  const archive = useChatStore((s) => s.archive);
  const dialogs = useChatStore((s) => s.dialogs);

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

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs.length]);

  /* архивация чата заказа при получении */
  useEffect(() => {
    if (kind === "order" && order?.status === "received" && dialog && !dialog.archived) {
      archive(key);
    }
  }, [kind, order, dialog, key, archive]);

  const doSend = (text: string, role: "buyer" | "seller") => {
    if (!text.trim()) return;
    const name = role === "buyer" ? (user?.name || "Покупатель") : (product ? "Мастер" : "Продавец");
    const res = send(key, role, name, text.trim());
    if (res.blocked) setWarn("Общение и оплата происходят только внутри УютАрт для гарантии безопасной сделки и защиты от мошенников.");
    else setWarn(null);
    setCustomText("");
    setCustomOpen(false);
  };

  const prompts: { label: string; custom?: boolean }[] =
    side === "buyer"
      ? (kind === "product" ? buyerQs.map((q) => ({ label: q })) : orderQs.map((q) => ({ label: q })))
      : sellerTs;

  const title = kind === "product"
    ? `Чат с мастером · ${product?.name || ""}`
    : `Чат по заказу ${order?.number || ""}`;

  return (
    <Modal open={open} onClose={onClose} title={title} wide>
      {/* переключатель стороны (демо) */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-[12px] text-ink-mute font-semibold">Демо-сторона:</span>
        {(["buyer", "seller"] as const).map((s) => (
          <button key={s} onClick={() => { setSide(s); setCustomOpen(false); }}
            className={`px-3.5 h-9 rounded-full text-[12.5px] font-bold transition-all cursor-pointer ${side === s ? "bg-dark text-cream" : "bg-line-soft text-ink-soft hover:bg-line"}`}>
            {s === "buyer" ? "Покупатель" : "Продавец"}
          </button>
        ))}
        {kind === "order" && order && (
          <span className="ml-auto text-[12px] font-bold text-accent-deep">
            Статус: {order.status === "paid" ? "Оплачен" : order.status === "shipped" ? "В пути" : order.status === "delivered" ? "Готов к выдаче" : "Получен"}
          </span>
        )}
      </div>

      {/* лента сообщений */}
      <div ref={listRef} className="h-[320px] overflow-y-auto rounded-[14px] bg-cream border border-line-soft p-4 space-y-3">
        {msgs.length === 0 && (
          <p className="text-[13px] text-ink-mute text-center pt-12">
            {kind === "product" ? "Задайте вопрос мастеру — выберите готовый вопрос ниже." : "Обсудите детали заказа. Вопросы зависят от статуса."}
          </p>
        )}
        {msgs.map((m) =>
          m.role === "seller" && m.name === "УютАрт" ? (
            <div key={m.id} className="flex items-center gap-2 text-[12.5px] text-ink-soft bg-ai-soft rounded-[10px] px-3.5 py-2.5">
              <Archive size={14} className="shrink-0 text-ai" /> {m.text}
            </div>
          ) : (
            <div key={m.id} className={`flex ${m.role === "buyer" ? "justify-end" : "justify-start"} fade-up`}>
              <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 ${m.role === "buyer" ? "bg-dark text-cream rounded-br-[6px]" : "bg-surface text-ink shadow-card rounded-bl-[6px]"}`}>
                <p className={`text-[11px] font-bold mb-0.5 ${m.role === "buyer" ? "text-accent" : "text-accent-deep"}`}>{m.name}</p>
                {m.blocked ? (
                  <p className="text-[13px] blur-[5px] select-none" aria-hidden="true">{m.text}</p>
                ) : (
                  <p className="text-[13px] leading-relaxed">{m.text}</p>
                )}
                {m.blocked && (
                  <p className="text-[11px] text-error font-semibold mt-1 flex items-center gap-1"><ShieldAlert size={11} /> Скрыто защитой платформы</p>
                )}
                <p className={`text-[10px] mt-1 ${m.role === "buyer" ? "text-cream/50" : "text-ink-mute"}`}>{fmtDate(m.createdAt)}</p>
              </div>
            </div>
          )
        )}
      </div>

      {warn && (
        <div className="mt-3 flex items-start gap-2 bg-error-soft border border-error/30 rounded-[10px] px-4 py-3 fade-up">
          <ShieldAlert size={16} className="text-error shrink-0 mt-0.5" />
          <p className="text-[12.5px] text-ink font-semibold">{warn}</p>
        </div>
      )}

      {/* кнопки-подсказки или архив */}
      {archived ? (
        <div className="mt-4 text-center">
          <p className="text-[13px] text-ink-soft">Чат архивирован — общение по заказу завершено.</p>
        </div>
      ) : (
        <div className="mt-4">
          {!customOpen ? (
            <div className="flex flex-wrap gap-2 max-h-[130px] overflow-y-auto">
              {prompts.map((pr) =>
                pr.custom ? (
                  <button key="custom" onClick={() => setCustomOpen(true)}
                    className="px-3.5 min-h-[40px] rounded-full bg-accent text-ink text-[12.5px] font-bold hover:bg-accent-deep hover:text-cream transition-colors cursor-pointer">
                    ✍ {pr.label}
                  </button>
                ) : (
                  <button key={pr.label} onClick={() => doSend(pr.label, side)}
                    className="px-3.5 min-h-[40px] rounded-full border border-line bg-surface text-ink-soft text-[12.5px] font-semibold hover:border-dark hover:text-ink transition-colors cursor-pointer">
                    {pr.label}
                  </button>
                )
              )}
            </div>
          ) : (
            <div className="fade-up">
              <textarea
                className="field"
                rows={2}
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend(customText, side); } }}
                placeholder="Свой ответ… (Enter — отправить)"
                autoFocus
              />
              <div className="flex gap-2 mt-2">
                <Btn size="sm" onClick={() => doSend(customText, side)}><Send size={14} /> Отправить</Btn>
                <Btn size="sm" variant="ghost" onClick={() => { setCustomOpen(false); setCustomText(""); }}><X size={14} /> Отмена</Btn>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
