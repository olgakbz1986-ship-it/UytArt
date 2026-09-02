import { ReactNode } from "react";
import { Star } from "lucide-react";

/* ---------- кнопка ---------- */
export function Btn({ children, onClick, variant = "primary", size = "md", disabled, className = "", title }: {
  children: ReactNode; onClick?: () => void; variant?: "primary" | "outline" | "ghost" | "dark" | "ai";
  size?: "sm" | "md" | "lg"; disabled?: boolean; className?: string; title?: string;
}) {
  const base = "inline-flex items-center justify-center gap-2 font-semibold rounded-[10px] transition-all duration-200 cursor-pointer whitespace-nowrap select-none active:scale-[0.98] disabled:opacity-45 disabled:cursor-not-allowed";
  const sizes = { sm: "text-[13px] px-4 h-[40px]", md: "text-sm px-5 h-[46px]", lg: "text-[15px] px-7 h-[52px]" };
  const variants = {
    primary: "bg-accent text-ink hover:bg-accent-deep hover:text-cream shadow-[0_10px_22px_-10px_rgba(217,142,50,0.65)]",
    dark: "bg-dark text-cream hover:bg-dark-deep",
    outline: "border border-line bg-surface text-ink hover:bg-cream",
    ghost: "text-ink-soft hover:bg-line-soft",
    ai: "bg-ai text-cream hover:bg-ai-soft hover:text-ai border border-ai",
  };
  return (
    <button title={title} onClick={onClick} disabled={disabled} className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
}

/* ---------- бейдж ---------- */
export type BadgeTone = "honey" | "dark" | "premium" | "success" | "error" | "ai" | "neutral";
export function Badge({ children, tone = "neutral", className = "" }: { children: ReactNode; tone?: BadgeTone; className?: string }) {
  const tones: Record<BadgeTone, string> = {
    honey: "bg-accent-soft text-accent-deep",
    dark: "bg-dark text-cream",
    premium: "bg-premium-soft text-[#8a6236]",
    success: "bg-success-soft text-[#4d7327]",
    error: "bg-error-soft text-error",
    ai: "bg-ai-soft text-ai",
    neutral: "bg-line-soft text-ink-soft",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}

/* ---------- рейтинг ---------- */
export function Rating({ value, size = 13, showValue = true }: { value: number; size?: number; showValue?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-flex">
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} size={size} className={i < Math.round(value) ? "text-accent fill-accent" : "text-line fill-line"} />
        ))}
      </span>
      {showValue && <span className="text-[12px] font-bold text-ink">{value.toFixed(1)}</span>}
    </span>
  );
}

/* ---------- поле ---------- */
export function Field({ label, children, required, error, hint, className = "" }: {
  label: string; children: ReactNode; required?: boolean; error?: string; hint?: string; className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-[12.5px] font-semibold text-ink mb-1.5">
        {label} {required && <span className="text-error">*</span>}
        {hint && <span className="ml-1.5 font-medium text-ink-mute">{hint}</span>}
      </p>
      {children}
      {error && <p className="text-[12px] text-error mt-1.5">{error}</p>}
    </div>
  );
}

/* ---------- модальное окно ---------- */
export function Modal({ open, onClose, title, children, wide }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 backdrop-in bg-ink/45" onClick={onClose} />
      <div className={`relative bg-surface rounded-[16px] shadow-lift w-full ${wide ? "max-w-3xl" : "max-w-md"} max-h-[88vh] overflow-y-auto pop-in`}>
        <div className="sticky top-0 bg-surface/95 backdrop-blur flex items-center justify-between px-6 py-4 border-b border-line-soft z-10">
          <h3 className="font-display font-bold text-[17px] text-ink">{title}</h3>
          <button onClick={onClose} aria-label="Закрыть" className="w-9 h-9 rounded-[10px] flex items-center justify-center text-ink-mute hover:bg-line-soft hover:text-ink transition-colors cursor-pointer">✕</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

/* ---------- изображение товара с фолбэком ---------- */
export function ProductImg({ p, variant = 0, className = "" }: { p: { image: string; art: [string, string]; emoji: string }; variant?: number; className?: string }) {
  const positions = ["50% 38%", "50% 62%", "32% 42%", "68% 52%", "50% 80%"];
  const hues = [0, 9, -10, 16, -18];
  const v = variant % positions.length;
  return (
    <img
      src={p.image}
      alt=""
      loading="lazy"
      className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.06] ${className}`}
      style={{ objectPosition: positions[v], filter: hues[v] ? `hue-rotate(${hues[v]}deg) saturate(1.04)` : undefined }}
      onError={(e) => {
        const el = e.currentTarget as HTMLImageElement;
        if (el.dataset.fb) return;
        el.dataset.fb = "1";
        el.style.display = "none";
        if (el.parentElement) {
          el.parentElement.style.background = `linear-gradient(135deg, ${p.art[0]}, ${p.art[1]})`;
          el.parentElement.style.display = "flex";
          el.parentElement.style.alignItems = "center";
          el.parentElement.style.justifyContent = "center";
          el.parentElement.innerHTML += `<span style="font-size:42px">${p.emoji}</span>`;
        }
      }}
    />
  );
}

/* ---------- изображение группы (для плиток) ---------- */
export function GroupImg({ src, emoji, alt, pos = 0, className = "" }: { src?: string; emoji: string; alt: string; pos?: number; className?: string }) {
  const positions = ["50% 40%", "30% 50%", "70% 35%", "50% 65%", "40% 30%", "60% 60%", "50% 50%", "35% 45%"];
  const hues = [0, 8, -8, 14, -14, 20, -20, 10];
  const v = pos % positions.length;
  if (!src) {
    return <div className={`w-full h-full flex items-center justify-center text-[40px] bg-line-soft ${className}`}>{emoji}</div>;
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.06] ${className}`}
      style={{ objectPosition: positions[v], filter: hues[v] ? `hue-rotate(${hues[v]}deg) saturate(1.05)` : undefined }}
      onError={(e) => {
        const el = e.currentTarget as HTMLImageElement;
        if (el.dataset.fb) return;
        el.dataset.fb = "1";
        el.style.display = "none";
        if (el.parentElement) {
          el.parentElement.style.display = "flex";
          el.parentElement.style.alignItems = "center";
          el.parentElement.style.justifyContent = "center";
          el.parentElement.classList.add("bg-line-soft");
          el.parentElement.innerHTML += `<span style="font-size:40px">${emoji}</span>`;
        }
      }}
    />
  );
}

/* ---------- scroll-reveal ---------- */
export function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <div
      className={`reveal in ${className}`}
      style={{ animation: `fadeUp 0.4s ease-out ${delay}ms both` }}
    >
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
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} ${checked ? "bg-ai" : "bg-line"}`}
    >
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-card transition-all duration-200 ${checked ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}
