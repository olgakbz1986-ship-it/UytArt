import { useEffect, useRef, useState } from "react";
import { Check, Image as ImageIcon, Palette, Type, Sparkles, Download, Save, X } from "lucide-react";
import { Btn, Field } from "./ui";
import { useSellerAccount } from "../lib/seller";

type Spec = "qf" | "wb" | "ozon";
const SPECS: Record<Spec, { name: string; w: number; h: number; hint: string }> = {
  qf:  { name: "Quantiform", w: 600, h: 800, hint: "3:4, фирменная спека" },
  wb:  { name: "Wildberries", w: 900, h: 1200, hint: "900×1200" },
  ozon:{ name: "Ozon",        w: 600, h: 800, hint: "3:4" },
};

interface Props {
  open: boolean;
  onClose: () => void;
  initialWorkId?: string;
  onSaved?: (id: string) => void;
}

export function StudioCanvas({ open, onClose, initialWorkId, onSaved }: Props) {
  const works = useSellerAccount((s) => s.works);
  const saveWork = useSellerAccount((s) => s.saveWork);
  const updateWork = useSellerAccount((s) => s.updateWork);
  const existing = initialWorkId ? works.find((w) => w.id === initialWorkId) : null;

  const [spec, setSpec] = useState<Spec>(existing?.spec || "qf");
  const [photo, setPhoto] = useState<string>(existing?.data?.photo || "");
  const [title, setTitle] = useState<string>(existing?.data?.title || "");
  const [bullets, setBullets] = useState<string[]>(existing?.data?.bullets || ["", "", ""]);
  const [brandColor, setBrandColor] = useState<string>(existing?.data?.brandColor || "#2d5f4c");
  const [accentColor, setAccentColor] = useState<string>(existing?.data?.accentColor || "#d98e32");
  const [workName, setWorkName] = useState<string>(existing?.name || "");
  const [folder, setFolder] = useState<string>(existing?.folder || "По умолчанию");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const onFile = (f: FileList | null) => {
    if (!f || !f[0]) return;
    const r = new FileReader();
    r.onload = () => setPhoto(r.result as string);
    r.readAsDataURL(f[0]);
  };

  const specData = SPECS[spec];

  // Рендер превью через DOM (слои), а экспорт — через canvas
  useEffect(() => {
    if (!open || !canvasRef.current) return;
    const cv = canvasRef.current;
    cv.width = specData.w; cv.height = specData.h;
    const ctx = cv.getContext("2d"); if (!ctx) return;

    // фон
    ctx.fillStyle = brandColor;
    ctx.fillRect(0, 0, cv.width, cv.height);

    const draw = () => {
      // затемнение сверху для заголовка
      const grad = ctx.createLinearGradient(0, 0, 0, cv.height * 0.35);
      grad.addColorStop(0, "rgba(0,0,0,0.55)"); grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad; ctx.fillRect(0, 0, cv.width, cv.height * 0.45);

      // заголовок
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${Math.round(cv.width * 0.055)}px system-ui, sans-serif`;
      ctx.fillText(title || "Название товара", cv.width * 0.05, cv.height * 0.1);

      // полоска акцента
      ctx.fillStyle = accentColor;
      ctx.fillRect(cv.width * 0.05, cv.height * 0.12, cv.width * 0.25, 4);

      // буллеты снизу
      ctx.font = `600 ${Math.round(cv.width * 0.032)}px system-ui, sans-serif`;
      const bulletY = cv.height * 0.78;
      bullets.forEach((b, i) => {
        if (!b) return;
        ctx.fillStyle = accentColor;
        ctx.beginPath(); ctx.arc(cv.width * 0.07, bulletY + i * cv.height * 0.055, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.fillText(b, cv.width * 0.1, bulletY + i * cv.height * 0.055 + 6);
      });

      // подпись спеки
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = `500 ${Math.round(cv.width * 0.022)}px system-ui, sans-serif`;
      ctx.fillText(specData.name + " · " + specData.w + "×" + specData.h, cv.width * 0.05, cv.height - cv.height * 0.04);
    };

    if (photo) {
      const img = new Image();
      img.onload = () => {
        // cover-fit
        const ratio = Math.max(cv.width / img.width, cv.height / img.height);
        const w = img.width * ratio, h = img.height * ratio;
        ctx.drawImage(img, (cv.width - w) / 2, (cv.height - h) / 2, w, h);
        draw();
      };
      img.src = photo;
    } else {
      draw();
    }
  }, [open, spec, photo, title, bullets, brandColor, accentColor]);

  if (!open) return null;

  const handleSave = () => {
    const data = { photo, title, bullets, brandColor, accentColor };
    const name = workName.trim() || title.trim() || "Без названия";
    if (existing) {
      updateWork(existing.id, { name, folder, spec, data, preview: photo || "" });
      onSaved?.(existing.id);
    } else {
      const id = saveWork({ type: "card", name, folder, spec, data, preview: photo || "" });
      onSaved?.(id);
    }
    onClose();
  };

  const handleExport = () => {
    const cv = canvasRef.current; if (!cv) return;
    cv.toBlob((b) => {
      if (!b) return;
      const url = URL.createObjectURL(b);
      const a = document.createElement("a");
      a.href = url; a.download = (workName || title || "card") + "-" + spec + ".png";
      a.click(); URL.revokeObjectURL(url);
    });
  };

  return (
    <div className="fixed inset-0 z-[100] top-16 bg-black/60 flex items-center justify-center p-3" onClick={onClose}>
      <div className="bg-surface rounded-2xl shadow-lift max-w-[1000px] w-full max-h-[calc(100vh-8rem)] overflow-y-auto mt-16" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-surface z-10 px-6 py-4 border-b border-line-soft flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-dark text-cream flex items-center justify-center"><Sparkles size={18} /></span>
            <div>
              <h2 className="font-display font-bold text-[20px] text-ink">🎨 Конструктор карточек</h2>
              <p className="text-[12px] text-ink-soft">Слои, спеки площадок, брендовые цвета, экспорт PNG</p>
            </div>
          </div>
          <button type="button" className="w-9 h-9 rounded-full bg-line-soft text-ink-mute hover:bg-error hover:text-white cursor-pointer" onClick={onClose}>×</button>
        </div>

        <div className="grid lg:grid-cols-[320px_1fr] gap-6 p-6">
          {/* Панель настроек */}
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-bold text-ink-mute mb-2">СПЕКА ПЛОЩАДКИ</p>
              <div className="grid grid-cols-3 gap-1.5">
                {(Object.keys(SPECS) as Spec[]).map((k) => (
                  <button key={k} type="button" onClick={() => setSpec(k)}
                    className={`h-14 rounded-lg text-[11px] font-bold transition-all ${spec === k ? "bg-dark text-cream" : "bg-line-soft text-ink-soft hover:bg-line"} cursor-pointer`}>
                    <div>{SPECS[k].name}</div>
                    <div className="text-[10px] opacity-70">{SPECS[k].hint}</div>
                  </button>
                ))}
              </div>
            </div>

            <Field label="Название работы (для библиотеки)">
              <input className="field" value={workName} onChange={(e) => setWorkName(e.target.value)} placeholder="Например, Карточка «Ваза бохо» — вариант А" />
            </Field>
            <Field label="Папка">
              <input className="field" value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="По умолчанию" />
            </Field>

            <div>
              <p className="text-[11px] font-bold text-ink-mute mb-2 flex items-center gap-1"><ImageIcon size={12} /> ФОТО ТОВАРА</p>
              <label className="flex items-center justify-center h-24 rounded-xl border-2 border-dashed border-line-soft text-[12px] text-ink-soft hover:border-accent cursor-pointer">
                <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files)} />
                {photo ? "Заменить фото" : "Загрузить фото товара"}
              </label>
            </div>

            <Field label="Заголовок на карточке">
              <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ваза «Утро», шафран" />
            </Field>

            <div>
              <p className="text-[11px] font-bold text-ink-mute mb-2">ВЫГОДЫ (3 буллита)</p>
              {bullets.map((b, i) => (
                <input key={i} className="field mb-2" value={b} onChange={(e) => setBullets(bullets.map((x, xi) => xi === i ? e.target.value : x))} placeholder={`Выгода ${i + 1}`} />
              ))}
            </div>

            <div>
              <p className="text-[11px] font-bold text-ink-mute mb-2 flex items-center gap-1"><Palette size={12} /> ЦВЕТА БРЕНДА</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 bg-surface-soft rounded-lg p-2 cursor-pointer">
                  <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
                  <span className="text-[11px] text-ink-soft">Фон</span>
                </label>
                <label className="flex items-center gap-2 bg-surface-soft rounded-lg p-2 cursor-pointer">
                  <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
                  <span className="text-[11px] text-ink-soft">Акцент</span>
                </label>
              </div>
            </div>
          </div>

          {/* Холст */}
          <div>
            <p className="text-[11px] font-bold text-ink-mute mb-2">ПРЕДПРОСМОТР ({specData.w}×{specData.h})</p>
            <div className="bg-line-soft p-4 rounded-xl flex items-center justify-center min-h-[500px]">
              <canvas ref={canvasRef} style={{ maxWidth: "100%", height: "auto", boxShadow: "0 10px 40px rgba(0,0,0,0.3)", borderRadius: 12 }} />
            </div>
            <div className="flex gap-2 mt-4">
              <Btn size="lg" className="flex-1" onClick={handleSave}>
                <Save size={16} className="mr-2" /> {existing ? "Обновить работу" : "💾 Сохранить в мои работы"}
              </Btn>
              <Btn size="lg" variant="ghost" onClick={handleExport}>
                <Download size={16} className="mr-2" /> Экспорт PNG
              </Btn>
            </div>
            <p className="text-[11px] text-ink-mute mt-2">Сохранённая работа попадёт в «Мои работы» и сможет быть опубликована как товар.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
