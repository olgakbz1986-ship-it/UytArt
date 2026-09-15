import { useRef } from "react";
import { Camera, X } from "lucide-react";
import { useAppStore } from "../lib/store";

export function SellerAvatar() {
  const session = useAppStore((s) => s.session);
  const updateUser = useAppStore((s) => s.updateUser);
  const ref = useRef<HTMLInputElement>(null);

  const pick = (f?: File) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => updateUser({ avatar: r.result as string });
    r.readAsDataURL(f);
  };

  if (!session) return null;

  return (
    <div className="flex items-center gap-4 mb-5">
      <button
        onClick={() => ref.current?.click()}
        className="relative w-20 h-20 rounded-full bg-cream border-2 border-line-soft overflow-hidden hover:border-dark group"
      >
        {session.avatar ? (
          <img src={session.avatar} className="w-full h-full object-cover" />
        ) : (
          <span className="w-full h-full flex items-center justify-center font-display font-bold text-[28px] text-ink-mute">
            {(session.name || "?")[0].toUpperCase()}
          </span>
        )}
        <span className="absolute inset-0 bg-dark/50 text-cream opacity-0 group-hover:opacity-100 flex items-center justify-center">
          <Camera size={20} />
        </span>
      </button>
      <div>
        <p className="font-display font-bold text-[14px] text-ink">Аватар магазина и мастера</p>
        <p className="text-[12px] text-ink-soft">Одно фото для шапки кабинета, карточек товаров и отзывов</p>
        <div className="flex gap-3 mt-1.5">
          <button onClick={() => ref.current?.click()} className="text-[12px] font-bold text-accent-deep underline">
            Загрузить фото
          </button>
          {session.avatar && (
            <button onClick={() => updateUser({ avatar: undefined })} className="text-[12px] text-error flex items-center gap-1">
              <X size={11} /> Удалить
            </button>
          )}
        </div>
        <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0] || undefined)} />
      </div>
    </div>
  );
}
