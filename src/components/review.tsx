import { useState } from "react";
import { Star, Camera, BadgeCheck, MessageSquare, Upload, ShieldAlert, CheckCircle2, Flag } from "lucide-react";
import { Modal, Field, Rating, Btn } from "./ui";
import { fmtDate, type Product, vendorById } from "../data/seed";
import { useAppStore } from "../lib/store";
import { useReviewStore, approvedReviews, type UserReview } from "../lib/review";
import { useChatStore, TICKET_REASONS } from "../lib/chat";
import { useComplaintStore, COMPLAINT_CATEGORIES } from "../lib/complaint";
import { useSellerReg } from "../lib/seller";

/* ============================================================
   Написание отзыва (только для полученного заказа)
   ============================================================ */
export function ReviewModal({ open, onClose, product, orderId, orderNumber }: {
  open: boolean; onClose: () => void; product: Product; orderId: string; orderNumber: string;
}) {
  const user = useAppStore((s) => s.user);
  const submitReview = useReviewStore((s) => s.submitReview);
  const hasReviewed = useReviewStore((s) => s.hasReviewed);

  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  const already = hasReviewed(product.id, orderId);

  const submit = () => {
    if (text.trim().length < 10) { setErr("Опишите впечатление подробнее — минимум 10 символов."); return; }
    if (!photo) { setErr("Прикрепите фото товара — это подтверждает реальную покупку и даёт 300 бонусов."); return; }
    setErr("");
    submitReview({
      productId: product.id,
      orderId,
      orderNumber,
      userId: user?.id || "guest",
      userName: user?.name || "Покупатель",
      rating,
      text: text.trim(),
      hasPhoto: true,
      photoName: photo,
      receivedDate: new Date().toISOString(),
    });
    setDone(true);
    setTimeout(() => {
      setDone(false); setRating(5); setText(""); setPhoto(null);
      onClose();
    }, 2200);
  };

  return (
    <Modal open={open} onClose={onClose} title="Отзыв о товаре">
      {done ? (
        <div className="py-8 text-center fade-up">
          <span className="inline-flex w-16 h-16 rounded-full bg-success-soft text-[#4d7327] items-center justify-center mb-4"><CheckCircle2 size={32} /></span>
          <p className="font-display font-bold text-[18px] text-ink mb-1">Отзыв отправлен на премодерацию</p>
          <p className="text-[13px] text-ink-soft">После одобрения он появится в карточке товара,<br />а 300 бонусов зачислим на ваш счёт.</p>
        </div>
      ) : already ? (
        <div className="py-8 text-center">
          <p className="font-display font-bold text-[18px] text-ink mb-1">Вы уже оставили отзыв</p>
          <p className="text-[13px] text-ink-soft">Спасибо! Один отзыв на товар с одного заказа.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-[12.5px] text-ink-soft leading-relaxed">
            Отзыв могут оставить только покупатели, получившие товар по заказу <strong className="text-ink">{orderNumber}</strong>. Рядом с ним появится метка «Проверенная покупка».
          </p>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setRating(n)} aria-label={`Оценка ${n}`} className="cursor-pointer">
                <Star size={26} className={n <= rating ? "text-accent fill-accent" : "text-line fill-line"} />
              </button>
            ))}
          </div>
          <Field label="Впечатление" required hint="минимум 10 символов">
            <textarea className="field" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Что понравилось, как изделие вписалось в интерьер…" />
          </Field>
          <div>
            <p className="text-[13px] font-semibold text-ink mb-1.5">Фото в интерьере <span className="text-error">*</span> <span className="text-[11px] font-medium text-ink-mute">+300 бонусов</span></p>
            <label className={`flex items-center gap-3 border border-dashed rounded-[10px] px-4 cursor-pointer transition-colors min-h-[52px] ${photo ? "border-success/50 bg-success-soft/40" : "border-line hover:border-dark"}`}>
              <Camera size={18} className={photo ? "text-success" : "text-ink-mute"} />
              <span className="text-[13px] font-semibold text-ink-soft truncate flex-1">{photo || "Прикрепить фото (обязательно)"}</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0]?.name ?? null)} />
            </label>
          </div>
          {err && <p className="flex items-start gap-2 text-[12px] text-error bg-error-soft rounded-[10px] px-3 py-2"><ShieldAlert size={14} className="shrink-0 mt-0.5" /> {err}</p>}
          <Btn className="w-full" onClick={submit}>Отправить отзыв</Btn>
        </div>
      )}
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
  const [reason, setReason] = useState("");
  const [desc, setDesc] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  const submit = () => {
    if (!reason) { setErr("Выберите причину из списка."); return; }
    if (!photo) { setErr("Прикрепите фото — без него тикет не принимается в арбитраж."); return; }
    setErr("");
    addTicket({ orderId, orderNumber, kind, reason, description: desc.trim(), photoName: photo });
    setDone(true);
    setTimeout(() => { setDone(false); setReason(""); setDesc(""); setPhoto(null); onClose(); }, 2000);
  };

  return (
    <Modal open={open} onClose={onClose} title={kind === "return" ? "Оформить возврат" : "Сообщить о проблеме"}>
      {done ? (
        <div className="py-8 text-center fade-up">
          <span className="inline-flex w-16 h-16 rounded-full bg-ai-soft text-ai items-center justify-center mb-4"><CheckCircle2 size={32} /></span>
          <p className="font-display font-bold text-[18px] text-ink mb-1">Тикет создан и передан в арбитраж</p>
          <p className="text-[13px] text-ink-soft">Решение по заказу {orderNumber} — до 5 рабочих дней.<br />Продавец получит структурированные данные, а не переписку.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-[12.5px] text-ink-soft leading-relaxed">
            Споры решаются <strong className="text-ink">вне чата</strong> — через структурированный тикет. Это защищает продавца от давления
            и даёт арбитражу чёткие данные.
          </p>
          {kind === "return" && (
            <p className="flex items-start gap-2 text-[12px] text-ink-soft bg-accent-soft/60 border border-accent/30 rounded-[10px] px-3.5 py-2.5">
              <ShieldAlert size={14} className="text-accent-deep shrink-0 mt-0.5" />
              Возврат — обязанность продавца. УютАрт — агрегатор (ст. 12 ЗоЗПП) и организует процедуру, но не возмещает стоимость товара.
            </p>
          )}
          <Field label="Причина" required>
            <select className="field" value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="">— выберите причину —</option>
              {TICKET_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Описание" hint="Что именно не так, при каких обстоятельствах обнаружено">
            <textarea className="field" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Например: на кружке скол глазури у ручки, заметил при распаковке…" />
          </Field>
          <div>
            <p className="text-[13px] font-semibold text-ink mb-1.5">Фото проблемы <span className="text-error">*</span></p>
            <label className={`flex items-center gap-3 border border-dashed rounded-[10px] px-4 cursor-pointer transition-colors min-h-[52px] ${photo ? "border-success/50 bg-success-soft/40" : "border-line hover:border-dark"}`}>
              <Upload size={18} className={photo ? "text-success" : "text-ink-mute"} />
              <span className="text-[13px] font-semibold text-ink-soft truncate flex-1">{photo || "Прикрепить фото (обязательно)"}</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0]?.name ?? null)} />
            </label>
          </div>
          {err && <p className="flex items-start gap-2 text-[12px] text-error bg-error-soft rounded-[10px] px-3 py-2"><ShieldAlert size={14} className="shrink-0 mt-0.5" /> {err}</p>}
          <button onClick={submit} className="w-full h-12 rounded-[10px] bg-dark text-cream font-bold hover:bg-dark-deep transition-colors cursor-pointer">
            Отправить в арбитраж
          </button>
        </div>
      )}
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
  const [category, setCategory] = useState("");
  const [desc, setDesc] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  const submit = () => {
    if (!category) { setErr("Выберите категорию жалобы."); return; }
    if (desc.trim().length < 20) { setErr("Опишите ситуацию подробнее — минимум 20 символов."); return; }
    setErr("");
    addComplaint({
      vendorId,
      vendorName: vendor?.name || "Продавец",
      userId: user?.id || "guest",
      userName: user?.name || "Покупатель",
      category,
      description: desc.trim(),
      photoName: photo || undefined,
    });
    setDone(true);
    setTimeout(() => { setDone(false); setCategory(""); setDesc(""); setPhoto(null); onClose(); }, 2200);
  };

  return (
    <Modal open={open} onClose={onClose} title={`Жалоба на «${vendor?.name || "продавца"}»`}>
      {done ? (
        <div className="py-8 text-center fade-up">
          <span className="inline-flex w-16 h-16 rounded-full bg-ai-soft text-ai items-center justify-center mb-4"><CheckCircle2 size={32} /></span>
          <p className="font-display font-bold text-[18px] text-ink mb-1">Жалоба принята</p>
          <p className="text-[13px] text-ink-soft">Модерация рассмотрит её в течение 1–2 рабочих дней.<br />При повторных нарушениях магазин может быть заблокирован.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-[12.5px] text-ink-soft leading-relaxed">
            Жалоба уходит в арбитраж платформы. Продавец получит её в структурированном виде — без личной переписки и давления.
          </p>
          <Field label="Категория жалобы" required>
            <select className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">— выберите категорию —</option>
              {COMPLAINT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Описание ситуации" required hint="минимум 20 символов">
            <textarea className="field" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Что произошло, когда, какой заказ…" />
          </Field>
          <div>
            <p className="text-[13px] font-semibold text-ink mb-1.5">Подтверждающее фото <span className="text-[11px] font-medium text-ink-mute">(необязательно)</span></p>
            <label className={`flex items-center gap-3 border border-dashed rounded-[10px] px-4 cursor-pointer transition-colors min-h-[52px] ${photo ? "border-success/50 bg-success-soft/40" : "border-line hover:border-dark"}`}>
              <Upload size={18} className={photo ? "text-success" : "text-ink-mute"} />
              <span className="text-[13px] font-semibold text-ink-soft truncate flex-1">{photo || "Прикрепить фото"}</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0]?.name ?? null)} />
            </label>
          </div>
          {err && <p className="flex items-start gap-2 text-[12px] text-error bg-error-soft rounded-[10px] px-3 py-2"><Flag size={14} className="shrink-0 mt-0.5" /> {err}</p>}
          <button onClick={submit} className="w-full h-12 rounded-[10px] bg-dark text-cream font-bold hover:bg-dark-deep transition-colors cursor-pointer">
            Отправить жалобу
          </button>
        </div>
      )}
    </Modal>
  );
}
