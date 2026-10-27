/* ============================================================
   Шапка профиля покупателя (ЗАДАЧА 4, п.17: вынесено из profile.tsx)
   Аватар + приветствие + тариф + выход. Доступность: alt/aria-label,
   тач-цели ≥44px.
   ============================================================ */
import { Link } from "react-router-dom";
import { Camera, LogOut, Sparkles } from "lucide-react";

const PLAN_NAME: Record<string, string> = { free: "Базовый", start: "Старт", designer: "Дизайнер", premium: "Премиум" };

export function ProfileHeader({ session, buyerPlan, tier, openAvatarPicker, onLogout }: {
  session: { name: string; email: string; region?: string; avatar?: string };
  buyerPlan: string;
  tier: { level: number; accent: string };
  openAvatarPicker: (instant: boolean) => void;
  onLogout: () => void;
}) {
  return (
    <div className={`flex items-center gap-4 mb-4 flex-wrap ${tier.level === 3 ? "bg-[#1a3d2e] p-6 rounded-2xl shadow-lift" : tier.level === 2 ? "border-b-2 border-[#c77e28] pb-3" : tier.level === 1 ? "border-b-2 border-[#2d5f4c] pb-3" : ""}`}>
      {/* кликабельный аватар: мгновенная загрузка — фото сразу появляется в хедере и кабинете */}
      <button type="button" onClick={() => openAvatarPicker(true)} className="relative group shrink-0 cursor-pointer rounded-full min-h-[44px] min-w-[44px]" title="Загрузить фото профиля" aria-label="Загрузить фото профиля">
        {session.avatar ? (
          <img src={session.avatar} alt={`Аватар пользователя ${session.name}`} className="w-16 h-16 rounded-full object-cover ring-2 ring-offset-2 ring-offset-cream" style={{ ["--tw-ring-color" as string]: tier.accent }} />
        ) : (
          <span aria-hidden="true" className="w-16 h-16 rounded-full flex items-center justify-center font-display font-bold text-[24px] ring-2 ring-offset-2 ring-offset-cream" style={{ background: "var(--color-dark)", color: "var(--color-accent)", ["--tw-ring-color" as string]: tier.accent }}>{session.name[0]?.toUpperCase()}</span>
        )}
        <span className="absolute inset-0 rounded-full bg-dark/0 group-hover:bg-dark/45 flex items-center justify-center transition-colors">
          <Camera size={20} className="text-cream opacity-0 group-hover:opacity-100 transition-opacity" />
        </span>
      </button>
      <div className="flex-1 min-w-[200px]">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className={`font-display font-bold text-[clamp(24px,3vw,32px)] ${tier.level === 3 ? "text-[#d4af37] font-serif" : "text-ink"}`}>Здравствуйте, {session.name.split(" ")[0]}!</h1>
          <span className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[12px] font-bold text-white" style={{ background: tier.accent, border: tier.level === 3 ? "2px solid #d4af37" : "none" }}>
            {tier.level === 3 && <Sparkles size={11} />}{PLAN_NAME[buyerPlan]}
          </span>
        </div>
        <p className="text-[13.5px] text-ink-soft mt-1">{session.email}{session.region ? ` · ${session.region}` : ""}</p>
      </div>
      <div className="flex items-center gap-2">
        <Link to="/plans" className="text-[13px] font-bold text-accent-deep hover:text-accent underline inline-flex items-center min-h-[44px]">Улучшить тариф</Link>
        <button onClick={onLogout} aria-label="Выйти из аккаунта" className="w-11 h-11 rounded-[10px] flex items-center justify-center text-ink-mute hover:text-error hover:bg-error-soft transition-colors cursor-pointer">
          <LogOut size={18} />
        </button>
      </div>
    </div>
  );
}
