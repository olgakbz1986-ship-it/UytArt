import { ReactNode, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

/* ---------- кнопки ---------- */
export function Btn({ children, onClick, variant = "primary", size = "md", disabled, className = "", title }: {
  children: ReactNode; onClick?: () => void; variant?: "primary" | "outline" | "dark" | "ghost" | "danger";
  size?: "sm" | "md" | "lg"; disabled?: boolean; className?: string; title?: string;
}) {
  const sizes = { sm: "h-10 px-4 text-[13px]", md: "h-[46px] px-5 text-sm", lg: "h-[52px] px-7 text-[15px]" };
  const variants = {
    primary: "bg-accent text-ink hover:bg-accent-deep hover:text-cream",
    outline: "border border-line bg-surface text-ink hover:bg-cream",
    dark: "bg-dark text-cream hover:bg-dark-deep",
    ghost: "text-ink-soft hover:text-ink hover:bg-line-soft",
    danger: "bg-error text-white hover:bg-[#c62f2b]",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center justify-center gap-2 font-semibold rounded-[10px] transition-all duration-200 ease-out cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

/* ---------- бейджи ---------- */
export type BadgeTone = "honey" | "dark" | "premium" | "success" | "error" | "ai" | "neutral";
export function Badge({ children, tone = "neutral", className = "" }: { children: ReactNode; tone?: BadgeTone; className?: string }) {
  const tones: Record<BadgeTone, string> = {
    honey: "bg-accent-soft text-accent-deep",
    dark: "bg-dark text-cream",
    premium: "bg-premium-soft text-[#a07c50]",
    success: "bg-success-soft text-[#4d7327]",
    error: "bg-error-soft text-error",
    ai: "bg-ai-soft text-ai",
    neutral: "bg-line-soft text-ink-soft",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold leading-none ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}

/* ---------- рейтинг ---------- */
export function Rating({ value, size = 13, showValue = true }: { value: number; size?: number; showValue?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-flex">
        {[1, 2, 3, 4, 5].map((i) => (
          <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill={i <= Math.round(value) ? "#d98e32" : "#e5e0d2"}>
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" />
          </svg>
        ))}
      </span>
      {showValue && <span className="text-[12px] font-bold text-ink">{value.toFixed(1)}</span>}
    </span>
  );
}

/* ---------- поле формы ---------- */
export function Field({ label, children, required, error, hint, className = "" }: {
  label: string; children: ReactNode; required?: boolean; error?: string; hint?: string; className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-[13px] font-semibold text-ink mb-1.5">
        {label} {required && <span className="text-error">*</span>}
      </span>
      {children}
      {hint && !error && <span className="block text-[11.5px] text-ink-mute mt-1">{hint}</span>}
      {error && <span className="block text-[12px] font-semibold text-error mt-1">{error}</span>}
    </label>
  );
}

/* ---------- модалка ---------- */
export function Modal({ open, onClose, title, children, wide }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", h); document.body.style.overflow = ""; };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 backdrop-in" style={{ background: "rgba(44,44,44,0.4)" }} onClick={onClose} />
      <div className={`relative bg-cream rounded-2xl shadow-lift w-full max-h-[88vh] overflow-y-auto pop-in ${wide ? "max-w-3xl" : "max-w-md"}`}>
        <div className="sticky top-0 bg-cream/95 backdrop-blur flex items-center justify-between px-6 py-3.5 border-b border-line-soft z-10">
          <h3 className="font-display font-bold text-[17px] text-ink">{title}</h3>
          <button onClick={onClose} aria-label="Закрыть" className="w-11 h-11 -mr-2 rounded-[10px] flex items-center justify-center hover:bg-line-soft text-ink-soft cursor-pointer transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

/* ---------- изображение товара: фото с градиентным фолбэком ---------- */
const POSITIONS = ["50% 38%", "50% 62%", "32% 42%", "68% 52%", "50% 80%"];
const HUES = [0, 9, -10, 16, -18];
export function ProductImg({ p, variant = 0, className = "" }: { p: { image?: string; art: [string, string]; emoji: string }; variant?: number; className?: string }) {
  const v = variant % POSITIONS.length;
  const [err, setErr] = useState(false);
  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: `linear-gradient(135deg, ${p.art[0]}, ${p.art[1]})` }}>
      {!err && p.image && (
        <img
          src={p.image}
          alt={p.emoji}
          loading="lazy"
          onError={() => setErr(true)}
          className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.06] ${className}`}
          style={{ objectPosition: POSITIONS[v], filter: HUES[v] ? `hue-rotate(${HUES[v]}deg) saturate(1.04)` : undefined }}
        />
      )}
      {(!p.image || err) && (
        <div className="absolute inset-0 flex items-center justify-center text-[42px] opacity-90">
          <span className="drop-shadow-lg">{p.emoji}</span>
        </div>
      )}
    </div>
  );
}

/* ---------- изображение группы ---------- */
export function GroupImg({ src, emoji, alt, pos = 0, className = "" }: { src?: string; emoji: string; alt: string; pos?: number; className?: string }) {
  const [err, setErr] = useState(false);
  const v = pos % POSITIONS.length;
  return (
    <div className="relative w-full h-full overflow-hidden bg-dark">
      {!err && src && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setErr(true)}
          className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.06] ${className}`}
          style={{ objectPosition: POSITIONS[v], filter: HUES[v] ? `hue-rotate(${HUES[v] * 2}deg) saturate(1.03)` : undefined }}
        />
      )}
      {(!src || err) && (
        <div className="absolute inset-0 flex items-center justify-center text-[46px]" style={{ background: "linear-gradient(135deg, #1e3a2f, #2d5f4c)" }}>
          <span className="drop-shadow-lg">{emoji}</span>
        </div>
      )}
    </div>
  );
}

/* ---------- появление при скролле ---------- */
export function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setInView(true), { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${inView ? "in" : ""} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/* ---------- переключатель ---------- */
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"} ${checked ? "bg-ai" : "bg-line"}`}
    >
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-200 ${checked ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

/* ---------- прогресс-бар ---------- */
export function ProgressBar({ value, max, tone = "accent" }: { value: number; max: number; tone?: "accent" | "ai" | "success" }) {
  const pct = Number.isFinite(max) && max > 0 ? Math.min(100, (value / max) * 100) : 100;
  const colors = { accent: "bg-accent", ai: "bg-ai", success: "bg-success" };
  return (
    <div className="h-2 rounded-full bg-line-soft overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${colors[tone]}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
