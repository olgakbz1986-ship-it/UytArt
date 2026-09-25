import { useNotifyStore } from "../lib/notify";
import { useRef } from "react";
import { Camera, X } from "lucide-react";
import { useSellerReg } from "../lib/seller";

export function SellerAvatar() {
  const reg = useSellerReg();
  const logoRef = useRef<HTMLInputElement>(null);
  const masterRef = useRef<HTMLInputElement>(null);

  const pick = (f: File | undefined, field: "shopLogo" | "masterAvatar") => {
    if (!f) return;
    if (f.size > 1500000) { useNotifyStore.getState().push({ kind: "alert", title: "Файл слишком большой", text: "Максимум 1.5 МБ" }); return; }
    const v = new FileReader();
    v.onload = () => {
      const data = v.result as string;
      if (field === "shopLogo") reg.setInfo({ shopLogo: data });
      else reg.setInfo({ masterAvatar: data });
    };
    v.readAsDataURL(f);
  };

  return (
    <div className="grid sm:grid-cols-2 gap-4 mb-5">
      <div className="flex items-center gap-4 bg-cream rounded-2xl border border-line p-4">
        <button onClick={() => logoRef.current?.click()} className="relative w-16 h-16 rounded-[14px] bg-surface border-2 border-line-soft overflow-hidden hover:border-dark group shrink-0 cursor-pointer" aria-label="Загрузить логотип магазина">
          {reg.shopLogo ? <img src={reg.shopLogo} className="w-full h-full object-cover" alt="Логотип магазина" /> : <span className="w-full h-full flex items-center justify-center font-display font-bold text-[22px] text-ink-mute">{(reg.shopName || "?")[0].toUpperCase()}</span>}
          <span className="absolute inset-0 bg-dark/50 text-cream opacity-0 group-hover:opacity-100 flex items-center justify-center"><Camera size={16} /></span>
        </button>
        <div className="min-w-0">
          <p className="font-display font-bold text-[13.5px] text-ink">Логотип магазина</p>
          <p className="text-[11.5px] text-ink-soft">Шапка кабинета, карточки товаров, /masters, мини-сайт</p>
          <div className="flex gap-3 mt-1">
            <button onClick={() => logoRef.current?.click()} className="text-[11.5px] font-bold text-accent-deep underline cursor-pointer">Загрузить</button>
            {reg.shopLogo && <button onClick={() => reg.setInfo({ shopLogo: "" })} className="text-[11.5px] text-error flex items-center gap-1 cursor-pointer"><X size={11} /> Удалить</button>}
          </div>
        </div>
        <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0], "shopLogo")} />
      </div>
      <div className="flex items-center gap-4 bg-cream rounded-2xl border border-line p-4">
        <button onClick={() => masterRef.current?.click()} className="relative w-16 h-16 rounded-full bg-surface border-2 border-line-soft overflow-hidden hover:border-dark group shrink-0 cursor-pointer" aria-label="Загрузить аватар мастера">
          {reg.masterAvatar ? <img src={reg.masterAvatar} className="w-full h-full object-cover" alt="Аватар мастера" /> : <span className="w-full h-full flex items-center justify-center font-display font-bold text-[22px] text-ink-mute">{(reg.masterName || reg.shopName || "?")[0].toUpperCase()}</span>}
          <span className="absolute inset-0 bg-dark/50 text-cream opacity-0 group-hover:opacity-100 flex items-center justify-center"><Camera size={16} /></span>
        </button>
        <div className="min-w-0">
          <p className="font-display font-bold text-[13.5px] text-ink">Аватар мастера</p>
          <p className="text-[11.5px] text-ink-soft">Мини-сайт мастерской, подписи отзывов, карточка на /masters</p>
          <div className="flex gap-3 mt-1">
            <button onClick={() => masterRef.current?.click()} className="text-[11.5px] font-bold text-accent-deep underline cursor-pointer">Загрузить</button>
            {reg.masterAvatar && <button onClick={() => reg.setInfo({ masterAvatar: "" })} className="text-[11.5px] text-error flex items-center gap-1 cursor-pointer"><X size={11} /> Удалить</button>}
          </div>
        </div>
        <input ref={masterRef} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0], "masterAvatar")} />
      </div>
    </div>
  );
}
