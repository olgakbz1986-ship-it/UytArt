import { useState, useRef, useEffect } from "react";
import { Video, Play, Save, Download, X } from "lucide-react";
import { useSellerAccount } from "../lib/seller";
import { Btn, Field } from "./ui";

interface Props { open: boolean; onClose: () => void; initialPhotos?: string[]; }

export function StudioVideo({ open, onClose, initialPhotos = [] }: Props) {
  const saveWork = useSellerAccount((s) => s.saveWork);
  const [photos, setPhotos] = useState<string[]>(initialPhotos.slice(0, 4));
  const [title, setTitle] = useState("Видеообзор товара");
  const [playing, setPlaying] = useState(false);
  const [frame, setFrame] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (playing && photos.length > 1) {
      timerRef.current = window.setInterval(() => {
        setFrame((f) => (f + 1) % photos.length);
      }, 1500); // 1.5 сек на кадр = 6 сек на 4 фото
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [playing, photos.length]);

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    const newPhotos = Array.from(files).slice(0, 4 - photos.length);
    newPhotos.forEach((f) => {
      const r = new FileReader();
      r.onload = () => setPhotos((prev) => [...prev, r.result as string]);
      r.readAsDataURL(f);
    });
  };

  const handleSave = () => {
    saveWork({ type: "video", name: "Видео: " + title, folder: "Видеообзоры", spec: "qf", data: { photos, title }, preview: photos[0] || "" });
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3" onClick={onClose}>
      <div className="bg-surface rounded-2xl shadow-lift max-w-[800px] w-full max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-surface z-10 px-6 py-4 border-b border-line-soft flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-dark text-cream flex items-center justify-center"><Video size={18} /></span>
            <div>
              <h2 className="font-display font-bold text-[20px] text-ink">🎬 Видеостудия</h2>
              <p className="text-[12px] text-ink-soft">Видеообложка из фото, субтитры и крупные планы</p>
            </div>
          </div>
          <button type="button" className="w-9 h-9 rounded-full bg-line-soft text-ink-mute hover:bg-error hover:text-white cursor-pointer" onClick={onClose}>×</button>
        </div>

        <div className="grid lg:grid-cols-[300px_1fr] gap-6 p-6">
          <div className="space-y-4">
            <Field label="Название видео">
              <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Видеообзор товара" />
            </Field>
            <div>
              <p className="text-[11px] font-bold text-ink-mute mb-2">КАДРЫ (до 4 шт.)</p>
              <div className="grid grid-cols-2 gap-2 mb-2">
                {photos.map((p, i) => (
                  <div key={i} className="aspect-square rounded-lg overflow-hidden border border-line-soft relative group">
                    <img src={p} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-error text-white flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer">×</button>
                  </div>
                ))}
                {photos.length < 4 && (
                  <label className="aspect-square rounded-lg border-2 border-dashed border-line-soft flex items-center justify-center text-ink-mute hover:border-accent cursor-pointer">
                    <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
                    <span className="text-[24px]">+</span>
                  </label>
                )}
              </div>
            </div>
            <button type="button" disabled={photos.length < 2} onClick={() => setPlaying(!playing)}
              className="h-11 w-full rounded-[10px] bg-dark text-cream font-bold hover:bg-accent-deep transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2">
              <Play size={16} /> {playing ? "Стоп" : "Предпросмотр"}
            </button>
            <Btn size="lg" className="w-full" onClick={handleSave}><Save size={16} className="mr-2" /> Сохранить в мои работы</Btn>
          </div>

          <div>
            <p className="text-[11px] font-bold text-ink-mute mb-2">ПЛЕЕР (Эмуляция MP4)</p>
            <div className="aspect-[9/16] max-h-[500px] mx-auto rounded-xl overflow-hidden border border-line-soft relative bg-black flex items-center justify-center">
              {photos.length > 0 ? (
                <>
                  <img src={photos[frame]} alt="Frame" className="w-full h-full object-cover transition-opacity duration-500" />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                    <p className="text-white font-bold text-[16px] drop-shadow-md">{title}</p>
                    <p className="text-white/80 text-[12px] drop-shadow-md">Качество подтверждено · Доставка по РФ</p>
                  </div>
                  {playing && <div className="absolute top-3 right-3 w-3 h-3 bg-red-500 rounded-full animate-pulse" />}
                </>
              ) : (
                <p className="text-ink-mute text-[13px]">Добавьте минимум 2 фото</p>
              )}
            </div>
            <p className="text-[11px] text-ink-mute mt-2 text-center">* Эмуляция видеообложки. Реальный рендеринг MP4 будет добавлен на этапе интеграции с видео-API.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
