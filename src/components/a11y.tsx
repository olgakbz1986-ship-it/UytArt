/* ============================================================
   Доступные модальные окна и тосты (ЗАДАЧА 4, п.19–п.20):
   - ConfirmModal: role="dialog", aria-modal, ловушка фокуса,
     закрытие по Escape, возврат фокуса на триггер, min-tap 44px;
   - Toast + useToastContext: доступные уведомления (aria-live),
     замена нативных alert/confirm в сценариях подписок.
   Стилистика — общая с ui.tsx (surface/line/accent-deep).
   ============================================================ */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/* ---------- ловушка фокуса + Escape (переиспользуется модалками) ---------- */
export function useFocusTrap(open: boolean, onClose: () => void, ref: React.RefObject<HTMLElement | null>) {
  const prevActive = useRef<Element | null>(null);
  useEffect(() => {
    if (!open) return;
    prevActive.current = document.activeElement;
    const node = ref.current;
    const focusables = () =>
      Array.from(
        node?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input:not([type="hidden"]), select, [tabindex]:not([tabindex="-1"])'
        ) || []
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
    /* первый фокусируемый элемент — сразу после открытия */
    const t = setTimeout(() => focusables()[0]?.focus(), 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
      if (e.key !== "Tab") return;
      const f = focusables();
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey, true);
      (prevActive.current as HTMLElement | null)?.focus?.();
    };
  }, [open, onClose, ref]);
}

/* ---------- ConfirmModal ---------- */
export interface ConfirmOptions {
  title: string;
  text?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export function ConfirmModal({ open, options, onResult }: {
  open: boolean;
  options: ConfirmOptions;
  onResult: (ok: boolean) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const close = useCallback((ok: boolean) => onResult(ok), [onResult]);
  useFocusTrap(open, () => close(false), boxRef);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] grid place-items-center p-4" role="presentation">
      <div className="absolute inset-0 bg-dark/50" onClick={() => close(false)} aria-hidden="true" />
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        className="relative bg-surface border border-line rounded-2xl shadow-xl w-full max-w-md p-6 fade-up"
      >
        <h3 id="confirm-modal-title" className="font-display font-bold text-lg text-ink mb-2">{options.title}</h3>
        {options.text && <p className="text-sm text-ink-soft mb-5">{options.text}</p>}
        <div className="flex flex-col-reverse sm:flex-row gap-3 justify-end mt-5">
          <button
            onClick={() => close(false)}
            className="min-h-[44px] min-w-[44px] px-5 py-2.5 rounded-xl border border-line text-ink font-semibold hover:border-ink transition-colors cursor-pointer"
          >
            {options.cancelLabel || "Отмена"}
          </button>
          <button
            onClick={() => close(true)}
            className={`min-h-[44px] px-5 py-2.5 rounded-xl text-white font-semibold transition-colors cursor-pointer ${
              options.danger ? "bg-error hover:bg-error/90" : "bg-accent-deep hover:bg-accent-deep/90"
            }`}
          >
            {options.confirmLabel || "Подтвердить"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Хук-замена нативного confirm(): askConfirm(options) → Promise<boolean>. */
export function useConfirm() {
  const [state, setState] = useState<{ options: ConfirmOptions; resolve: (v: boolean) => void } | null>(null);
  const ask = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => setState({ options, resolve })),
    []
  );
  const modal = state ? (
    <ConfirmModal
      open
      options={state.options}
      onResult={(ok) => { state.resolve(ok); setState(null); }}
    />
  ) : null;
  return { ask, modal };
}

/* ---------- Toast ---------- */
export interface ToastMessage { id: number; kind: "success" | "error" | "info"; text: string; }

const ToastCtx = createContext<{ toast: (kind: ToastMessage["kind"], text: string) => void } | null>(null);

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast вне ToastProvider");
  return ctx;
}

let toastSeq = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastMessage[]>([]);
  const toast = useCallback((kind: ToastMessage["kind"], text: string) => {
    const id = toastSeq++;
    setItems((xs) => [...xs, { id, kind, text }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 4500);
  }, []);
  const tone: Record<ToastMessage["kind"], string> = {
    success: "border-success/40 bg-success/10 text-ink",
    error: "border-error/40 bg-error/10 text-ink",
    info: "border-line bg-surface text-ink",
  };
  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      {/* aria-live polite — скринридер озвучивает тосты без прерывания */}
      <div aria-live="polite" role="status" className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[110] flex flex-col gap-2 items-center pointer-events-none px-4 w-full max-w-md">
        {items.map((t) => (
          <div key={t.id} className={`pointer-events-auto w-full rounded-xl border px-4 py-3 text-sm font-medium shadow-lg fade-up ${tone[t.kind]}`}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
