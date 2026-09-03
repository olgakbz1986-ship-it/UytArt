import { useState } from "react";
import { Camera, BadgeCheck, Star, MessageSquare, Upload, ShieldAlert, Flag } from "lucide-react";
import { Product, fmtDate, vendorById } from "../data/seed";
import { useAppStore } from "../lib/store";
import { useReviewStore, approvedReviews, type UserReview } from "../lib/review";
import { useChatStore, TICKET_REASONS } from "../lib/chat";
import { useComplaintStore, COMPLAINT_CATEGORIES } from "../lib/complaint";
import { useSellerReg } from "../lib/seller";
import { Modal, Btn, Field, Rating } from "./ui";

/* ============================================================
   Модалка отзыва: только для полученного заказа, +300 бонусов
   за фото. Уходит на премодерацию.
   ============================================================ */
export function ReviewModal({ open, onClose, product, orderId, orderNumber }: {
  open: boolean; onClose: () => void; product: Product; orderId: string; orderNumber: string;
}) {
  const user = useAppStore((s) => s.user);
  const addBonus = useAppStore((s) => s.addBonus);
  const submitReview = useReviewStore((s) => s.submitReview);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const submit = () => {
    if (text.trim().length < 10) { setErr("Расскажите подробнее — минимум 10 символов."); return; }
    submitReview({
      productId: product.id,
      orderId, orderNumber,
      userId: user?.id || "anon",
      userName: user?.name || "Покупатель",
      rating,
      text: text.trim(),
      hasPhoto: !!photo,
      photoName: photo || undefined,
      receivedDate: new Date().toISOString(),
    });
    addBonus(photo ? 300 : 100, photo ? "Отзыв с фото в интерьере" : "Отзыв о заказе");
    setRating(5); setText(""); setPhoto(null); setErr("");
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={`Отзыв · ${product.name}`}>
      <p className="text-[12.5px] text-ink-soft mb-4">Заказ {orderNumber}. Отзыв появится после премодерации. {photo ? "+300 бонусов за фото" : "+100 бонусов (и +300 с фото в интерьере)"}.</p>
      <div className="mb-4">
        <p className="text-[13px] font-semibold text-ink mb-1.5">Оценка</p>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <button key={i} onClick={() => setRating(i)} aria-label={`Оценка ${i}`} className="cursor-pointer">
              <Star size={26} fill={i <= rating ? "#d98e32" : "none"} color={i <= rating ? "#d98e32" : "#d9d4c7"} />
            </button>
          ))}
        </div>
      </div>
      <Field label="Ваш отзыв" required error={err}>
        <textarea className="field" rows={4} value={text} onChange={(e) => { setText(e.target.value); setErr(""); }} placeholder="Что понравилось, как качество…" />
      </Field>
      <div className="mt-4">
        <label className="flex items-center gap-3 border-2 border-dashed border-line rounded-[10px] px-4 py-3 cursor-pointer hover:border-ai hover:bg-ai-soft/40 transition-colors">
          <Upload size={16} className="text-ink-mute" />
          <span className="text-[13px] font-semibold text-ink-soft">{photo || "Прикрепить фото в интерьере (+300 бонусов)"}</span>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setPhoto(f.name); }} />
        </label>
      </div>
      <Btn className="w-full mt-5" onClick={submit}>Отправить на премодерацию</Btn>
    </Modal>
  );
}

/* ============================================================
   Секция отзывов в карточке товара + один ответ продавца
   ============================================================ */
export function ReviewsSection({ product }: { product: Product }) {
  const reviews = useReviewStore((s) => s.reviews);
  const replyToReview = useReviewStore((s) => s.replyToReview);
  const sellerReg = useSellerReg();
  const list = approvedReviews(reviews, product.id);
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const isSeller = sellerReg.status === "active";

  return (
    <div className="space-y-3">
      {list.length === 0 && (
        <p className="text-[13.5px] text-ink-soft bg-cream rounded-[14px] px-5 py-6 text-center">
          Отзывов пока нет — оставьте первый после получения заказа.
        </p>
      )}
      {list.map((r) => (
        <div key={r.id} className="bg-surface rounded-[14px] shadow-card p-5">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-full bg-dark text-cream flex items-center justify-center font-display font-bold text-[14px]">{r.userName[0]?.toUpperCase()}</span>
              <div>
                <p className="text-[13.5px] font-bold text-ink">{r.userName}</p>
                <p className="text-[11px] text-ink-mute">получил(а) {fmtDate(r.receivedDate)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Rating value={r.rating} size={12} showValue={false} />
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success-soft text-[#4d7327] text-[10.5px] font-bold"><BadgeCheck size={11} /> Проверенная покупка</span>
            </div>
          </div>
          <p className="text-[13.5px] text-ink-soft leading-relaxed">{r.text}</p>
          {r.hasPhoto && (
            <p className="flex items-center gap-1.5 text-[11.5px] text-ink-mute mt-2"><Camera size={12} /> Фото в интерьере: {r.photoName}</p>
          )}
          {r.sellerReply && (
            <div className="mt-3 ml-4 pl-4 border-l-[3px] border-accent">
              <p className="text-[11px] font-bold text-accent-deep mb-1">Ответ мастера</p>
              <p className="text-[13px] text-ink-soft">{r.sellerReply.text}</p>
            </div>
          )}
          {isSeller && !r.sellerReply && (
            replyFor === r.id ? (
              <div className="mt-3 fade-up">
                <textarea className="field" rows={2} value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Вежливый ответ покупателю…" />
                <div className="flex gap-2 mt-2">
                  <Btn size="sm" onClick={() => { if (replyText.trim()) { replyToReview(r.id, replyText.trim()); setReplyFor(null); setReplyText(""); } }}><MessageSquare size={13} /> Ответить</Btn>
                  <Btn size="sm" variant="ghost" onClick={() => setReplyFor(null)}>Отмена</Btn>
                </div>
              </div>
            ) : (
              <button onClick={() => setReplyFor(r.id)} className="mt-3 text-[12.5px] font-bold text-accent-deep hover:text-accent cursor-pointer inline-flex items-center gap-1.5">
                <MessageSquare size={13} /> Ответить на отзыв
              </button>
            )
          )}
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   Тикет «Сообщить о проблеме» / «Оформить возврат»
   ============================================================ */
export function TicketModal({ open, onClose, orderId, orderNumber, kind }: {
  open: boolean; onClose: () => void; orderId: string; orderNumber: string; kind: "problem" | "return";
}) {
  const addTicket = useChatStore((s) => s.addTicket);
  const [reason, setReason] = useState(TICKET_REASONS[0]);
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const submit = () => {
    if (!photo) { setErr("Прикрепите фото — это обязательное условие для арбитража."); return; }
    if (description.trim().length < 10) { setErr("Опишите проблему подробнее — минимум 10 символов."); return; }
    addTicket({ orderId, orderNumber, kind, reason, description: description.trim(), photoName: photo });
    setReason(TICKET_REASONS[0]); setDescription(""); setPhoto(null); setErr("");
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={kind === "return" ? `Возврат · заказ ${orderNumber}` : `Проблема · заказ ${orderNumber}`}>
      <p className="text-[12.5px] text-ink-soft mb-4">
        Тикет уходит в арбитраж платформы (рассмотрение 5 дней). Продавец получит его без возможности давления в переписке.
        {kind === "return" && " Возврат — в течение 7 дней, за исключением товаров на заказ. Ответственность за товар несёт продавец."}
      </p>
      <Field label="Причина" required>
        <select className="field" value={reason} onChange={(e) => setReason(e.target.value)}>
          {TICKET_REASONS.map((r) => <option key={r}>{r}</option>)}
        </select>
      </Field>
      <div className="mt-4">
        <Field label="Описание" required>
          <textarea className="field" rows={4} value={description} onChange={(e) => { setDescription(e.target.value); setErr(""); }} placeholder="Что случилось…" />
        </Field>
      </div>
      <div className="mt-4">
        <label className="flex items-center gap-3 border-2 border-dashed border-line rounded-[10px] px-4 py-3 cursor-pointer hover:border-ai hover:bg-ai-soft/40 transition-colors">
          <Upload size={16} className="text-ink-mute" />
          <span className="text-[13px] font-semibold text-ink-soft">{photo || "Прикрепить фото (обязательно)"}</span>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setPhoto(f.name); setErr(""); } }} />
        </label>
      </div>
      {err && <p className="text-[12px] font-semibold text-error mt-3">{err}</p>}
      <Btn className="w-full mt-5" onClick={submit}><ShieldAlert size={16} /> Отправить в арбитраж</Btn>
    </Modal>
  );
}

/* ============================================================
   Жалоба на конкретного продавца / магазин / мастера
   ============================================================ */
export function ComplaintModal({ open, onClose, vendorId }: {
  open: boolean; onClose: () => void; vendorId: string;
}) {
  const user = useAppStore((s) => s.user);
  const addComplaint = useComplaintStore((s) => s.addComplaint);
  const vendor = vendorById(vendorId);
  const [category, setCategory] = useState(COMPLAINT_CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const submit = () => {
    if (description.trim().length < 10) { setErr("Опишите ситуацию подробнее — минимум 10 символов."); return; }
    addComplaint({
      vendorId,
      vendorName: vendor?.name || "Продавец",
      userId: user?.id || "anon",
      userName: user?.name || "Покупатель",
      category,
      description: description.trim(),
      photoName: photo || undefined,
    });
    setCategory(COMPLAINT_CATEGORIES[0]); setDescription(""); setPhoto(null); setErr("");
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={`Жалоба на «${vendor?.name || "продавца"}»`}>
      <p className="text-[12.5px] text-ink-soft mb-4">
        Жалоба уходит в арбитраж платформы. Рассмотрение — 5 рабочих дней. Ваши личные данные продавцу не раскрываются.
      </p>
      <Field label="Категория жалобы" required>
        <select className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
          {COMPLAINT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </Field>
      <div className="mt-4">
        <Field label="Описание" required>
          <textarea className="field" rows={4} value={description} onChange={(e) => { setDescription(e.target.value); setErr(""); }} placeholder="Что произошло…" />
        </Field>
      </div>
      <div className="mt-4">
        <label className="flex items-center gap-3 border-2 border-dashed border-line rounded-[10px] px-4 py-3 cursor-pointer hover:border-ai hover:bg-ai-soft/40 transition-colors">
          <Upload size={16} className="text-ink-mute" />
          <span className="text-[13px] font-semibold text-ink-soft">{photo || "Прикрепить фото (необязательно)"}</span>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setPhoto(f.name); }} />
        </label>
      </div>
      {err && <p className="text-[12px] font-semibold text-error mt-3">{err}</p>}
      <Btn className="w-full mt-5" onClick={submit}><Flag size={16} /> Отправить жалобу</Btn>
    </Modal>
  );
}
