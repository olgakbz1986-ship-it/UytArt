import { useState } from "react";
import { Image as ImageIcon, Sparkles, Save, Download, X } from "lucide-react";
import { useSellerAccount } from "../lib/seller";
import { Btn, Field } from "./ui";

interface Props { open: boolean; onClose: () => void; initialPhoto?: string; onApply?: (photo: string) => void; }

const SCENES = [
  { id: "kitchen", name: "Кухня", bg: "linear-gradient(135deg, #f5f0e6 0%, #e8dcc8 100%)", filter: "brightness(1.1) contrast(1.05)" },
  { id: "loft", name: "Лофт", bg: "linear-gradient(135deg, #2c2c2c 0%, #4a4a4a 100%)", filter: "brightness(0.9) contrast(1.1) saturate(0.8)" },
  { id: "studio", name: "Студия", bg: "linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%)", filter: "brightness(1.2) contrast(1.1)" },
  { id: "nature", name: "Природа", bg: "linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)", filter: "brightness(1.05) contrast(1.05) saturate(1.2)" },
];

export function StudioPhoto({ open, onClose, initialPhoto, onApply }: Props) {
  const saveWork = useSellerAccount((s) => s.saveWork);
  const [photo, setPhoto] = useState<string>(initialPhoto || "");
  const [scene, setScene] = useState(SCENES[0]);
  const [processing, setProcessing] = useState(false);

  const onFile = (files: FileList | null) => {
    if (!files || !files[0]) return;
    const r = new FileReader();
    r.onload = () => setPhoto(r.result as string);
    r.readAsDataURL(files[0]);
 };

  const processAI = () => {
    setProcessing(true);
    setTimeout(() => setProcessing(false), 1500); // Эмуляция генерации
  };

  const handleSave = () => {
    saveWork({ type: "photo", name: "Фото: " + scene.name, folder: "ИИ-фотосессии", spec: "qf", data: { photo, scene: scene.id }, preview: photo });
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3" onClick={onClose}>
      <div className="bg-surface rounded-2xl shadow-lift max-w-[900px] w-full max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-surface z-10 px-6 py-4 border-b border-line-soft flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-dark text-cream flex items-center justify-center"><ImageIcon size={18} /></span>
            <div>
              <h2 className="font-display font-bold text-[20px] text-ink">📸 ИИ-фотосессия</h2>
              <p className="text-[12px] text-ink-soft">Генерация сцен, удаление фона и апскейл без студии</p>
            </div>
          </div>
          <button type="button" className="w-9 h-9 rounded-full bg-line-soft text-ink-mute hover:bg-error hover:text-white cursor-pointer" onClick={onClose}>×</button>
        </div>

        <div className="grid lg:grid-cols-[300px_1fr] gap-6 p-6">
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-bold text-ink-mute mb-2">1. ЗАГРУЗИТЕ ФОТО ТОВАРА</p>
              <label className="flex items-center justify-center h-24 rounded-xl border-2 border-dashed border-line-soft text-[12px] text-ink-soft hover:border-accent cursor-pointer">
                <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files)} />
                {photo ? "Заменить фото" : "Выбрать файл"}
              </label>
            </div>
            <div>
              <p className="text-[11px] font-bold text-ink-mute mb-2">2. ВЫБЕРИТЕ СЦЕНУ</p>
              <div className="grid grid-cols-2 gap-2">
                {SCENES.map((s) => (
                  <button key={s.id} type="button" onClick={() => setScene(s)}
                    className={`h-16 rounded-lg text-[11px] font-bold transition-all border-2 ${scene.id === s.id ? "border-accent bg-accent/10 text-ink" : "border-line-soft bg-surface-soft text-ink-soft hover:border-line"} cursor-pointer`}>
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
            <button type="button" disabled={!photo || processing} onClick={processAI}
              className="h-11 w-full rounded-[10px] bg-dark text-cream font-bold hover:bg-accent-deep transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2">
              {processing ? "Генерация..." : <><Sparkles size={16} /> Сгенерировать сцену</>}
            </button>
            <div className="flex gap-2 pt-2">
              {onApply && <Btn size="lg" className="flex-1" onClick={() => { onApply(photo); onClose(); }}><Save size={16} className="mr-2" /> Применить к товару</Btn>}
              <Btn size="lg" variant="ghost" onClick={handleSave}><Save size={16} className="mr-2" /> В мои работы</Btn>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold text-ink-mute mb-2">ПРЕДПРОСМОТР</p>
            <div className="aspect-[3/4] rounded-xl overflow-hidden border border-line-soft relative bg-line-soft flex items-center justify-center"
                 style={{ background: scene.bg }}>
              {photo ? (
                <img src={photo} alt="Product" className="max-w-[85%] max-h-[85%] object-contain drop-shadow-2xl transition-all duration-700"
                     style={{ filter: scene.filter }} />
              ) : (
                <div className="text-center text-ink-mute">
                  <ImageIcon size={48} className="mx-auto mb-2 opacity-30" />
                  <p className="text-[13px]">Загрузите фото для предпросмотра</p>
                </div>
              )}
              {processing && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-sm">
                  <div className="w-10 h-10 border-4 border-cream border-t-accent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <p className="text-[11px] text-ink-mute mt-2">* Эмуляция ИИ-генерации фона. Реальный вызов Kandinsky/YandexART будет добавлен при подключении API-ключей.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
