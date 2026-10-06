import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Play, MapPin, ShieldCheck, Copy, Check, Building2, Sparkles } from "lucide-react";
import { useSellerReg } from "../lib/seller";
import { useSellerAccount } from "../lib/seller";

export function SellerAboutModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const reg = useSellerReg();
  const [copied, setCopied] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const displayName = reg.shopName || reg.masterName || "Продавец";
  const typeLabel = reg.isMaster ? "Мастер" : (reg.legalName ? "Бизнес" : "Производство");
  const avatar = reg.shopLogo || reg.masterAvatar;
  const gallery = (reg.productionGallery || []).filter(Boolean);
  const allProducts = useSellerAccount.getState().products;
  const stats = {
    products: allProducts.length,
    views: allProducts.reduce((s, x) => s + (x.views || 0), 0),
    rating: 0,
  };

  const copy = (key: string, val: string) => {
    navigator.clipboard.writeText(val);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Закрытие */}
        <button type="button" onClick={onClose}
          className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/90 backdrop-blur shadow-md flex items-center justify-center hover:scale-110 transition-transform cursor-pointer">
          <X size={20} />
        </button>

        {/* Шапка */}
        <div className="relative p-6 pb-5 bg-gradient-to-br from-cream via-surface to-accent/5 border-b border-line-soft">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-dark text-cream flex items-center justify-center font-bold text-[24px] shadow-lg flex-shrink-0 overflow-hidden">
              {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" /> : displayName.slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h2 className="font-display font-bold text-[22px] text-ink">{displayName}</h2>
                <span className="h-6 px-2.5 rounded-full bg-success/15 text-success text-[11px] font-bold flex items-center gap-1">
                  <ShieldCheck size={12} /> Проверен
                </span>
              </div>
              <div className="flex items-center gap-3 text-[12.5px] text-ink-mute flex-wrap">
                <span className="flex items-center gap-1"><Building2 size={12} /> {typeLabel}</span>
                <span className="flex items-center gap-1"><MapPin size={12} /> {reg.city || "Россия"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Тело (скролл) */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* 🎬 ВИДЕО (ПЕРВЫМ) */}
          {reg.videoTourUrl && (
            <section>
              <h3 className="text-[12px] font-bold text-ink-mute uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Play size={12} className="text-accent-deep" /> Видеоистория
              </h3>
              <div className="relative aspect-video rounded-2xl overflow-hidden bg-black shadow-card">
                <video src={reg.videoTourUrl} className="w-full h-full" controls autoPlay={false} playsInline />
              </div>
            </section>
          )}

          {/* 📸 ФОТО-ГАЛЕРЕЯ */}
          {gallery.length > 0 && (
            <section>
              <h3 className="text-[12px] font-bold text-ink-mute uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Sparkles size={12} className="text-accent-deep" /> Наша мастерская
              </h3>
              <div className={`grid gap-2 ${gallery.length >= 4 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
                {gallery.map((url, i) => (
                  <button key={i} type="button" onClick={() => setLightbox(url)}
                    className="relative aspect-square rounded-xl overflow-hidden bg-line-soft hover:scale-[1.02] transition-transform cursor-pointer group">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* 📖 ИСТОРИЯ */}
          {reg.businessStory && (
            <section>
              <h3 className="text-[12px] font-bold text-ink-mute uppercase tracking-wider mb-2">Наша история</h3>
              <p className="text-[14px] leading-[1.75] text-ink-soft whitespace-pre-wrap">{reg.businessStory}</p>
            </section>
          )}

          {/* 🏆 ДОСТИЖЕНИЯ */}
          {reg.achievements && reg.achievements.trim() && (
            <section>
              <h3 className="text-[12px] font-bold text-ink-mute uppercase tracking-wider mb-2">Особенности</h3>
              <div className="flex flex-wrap gap-1.5">
                {reg.achievements.split(/[\n,;]+/).map((a, i) => a.trim()).filter(Boolean).slice(0, 12).map((a, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-full bg-accent/10 text-accent-deep text-[11.5px] font-bold">{a}</span>
                ))}
              </div>
            </section>
          )}

          {/* 📊 АВТО-СТАТИСТИКА */}
          <section className="grid grid-cols-3 gap-2 p-4 rounded-2xl bg-line-soft/40">
            <div className="text-center">
              <div className="text-[20px] font-bold text-ink">{stats.products}</div>
              <div className="text-[10.5px] text-ink-mute font-bold uppercase tracking-wide">Товаров</div>
            </div>
            <div className="text-center">
              <div className="text-[20px] font-bold text-ink">{stats.views}</div>
              <div className="text-[10.5px] text-ink-mute font-bold uppercase tracking-wide">Просмотров</div>
            </div>
            <div className="text-center">
              <div className="text-[20px] font-bold text-ink">★ —</div>
              <div className="text-[10.5px] text-ink-mute font-bold uppercase tracking-wide">Отзывов</div>
            </div>
          </section>

          {/* 📄 РЕКВИЗИТЫ (внизу, серым) */}
          <section className="pt-3 border-t border-line-soft">
            <h3 className="text-[11px] font-bold text-ink-mute uppercase tracking-wider mb-2">Реквизиты</h3>
            <div className="space-y-1.5 text-[12px]">
              {reg.legalName && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-ink-mute min-w-[100px]">Юр. лицо</span>
                  <span className="text-ink font-semibold text-right">{reg.legalName}</span>
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <span className="text-ink-mute min-w-[100px]">ИНН</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-ink font-semibold">{reg.inn || "—"}</span>
                  {reg.inn && (
                    <button type="button" onClick={() => copy("inn", reg.inn)}
                      className="w-6 h-6 rounded-md hover:bg-line flex items-center justify-center text-ink-mute hover:text-ink cursor-pointer">
                      {copied === "inn" ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-ink-mute min-w-[100px]">ОГРН</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-ink font-semibold">{reg.ogrn || "—"}</span>
                  {reg.ogrn && (
                    <button type="button" onClick={() => copy("ogrn", reg.ogrn)}
                      className="w-6 h-6 rounded-md hover:bg-line flex items-center justify-center text-ink-mute hover:text-ink cursor-pointer">
                      {copied === "ogrn" ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                    </button>
                  )}
                </div>
              </div>
              {reg.legalAddress && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-ink-mute min-w-[100px]">Адрес</span>
                  <span className="text-ink text-right">{reg.legalAddress}</span>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Lightbox для фото */}
      {lightbox && (
        <div className="fixed inset-0 z-[210] bg-black/90 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-w-full max-h-full object-contain rounded-2xl" />
        </div>
      )}
    </div>,
    document.body
  );
}
