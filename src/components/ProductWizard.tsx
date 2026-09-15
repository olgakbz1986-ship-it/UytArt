import { useState, useRef } from "react";
import { Camera, Image as ImageIcon, Sparkles, Package, Layers, Ruler, Tags, Check, ArrowLeft, ArrowRight, Wand2 } from "lucide-react";
import { useSellerAccount } from "../lib/seller";
import { CATEGORIES } from "../data/seed";
import { Modal, Btn, Field, Badge } from "./ui";

type Media = { type: "image" | "video"; url: string; name: string };
type Draft = {
  name: string; category: string; price: string; description: string;
  materials: string[]; newMaterial: string; manufacturer: string;
  dims: { length: string; width: string; height: string; unit: "см" | "мм" | "м" };
  tags: string[]; newTag: string; media: Media[];
  aiCover?: string; aiBullets?: string[];
};
const empty: Draft = {
  name: "", category: CATEGORIES[0]?.name || "", price: "", description: "",
  materials: [], newMaterial: "", manufacturer: "",
  dims: { length: "", width: "", height: "", unit: "см" },
  tags: [], newTag: "", media: [],
};

export function ProductWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<Draft>(empty);
  const [generating, setGenerating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const acc = useSellerAccount();
  const month = new Date().toISOString().slice(0, 7);
  const aiLeft = Math.max(0, 10 - (acc.aiCardGens[month] || 0));

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const add: Media[] = [];
    for (let i = 0; i < files.length && draft.media.length + add.length < 10; i++) {
      const f = files[i];
      add.push({ type: f.type.startsWith("video/") ? "video" : "image", url: URL.createObjectURL(f), name: f.name });
    }
    setDraft({ ...draft, media: [...draft.media, ...add] });
  };

  const generateAi = () => {
    setGenerating(true);
    acc.consumeAiCardGen(month);
    setTimeout(() => {
      const cover = draft.media[0]?.url;
      const bullets = [
        draft.description ? draft.description.slice(0, 90) : "Уникальная ручная работа",
        draft.materials.length ? `Материалы: ${draft.materials.slice(0, 3).join(", ")}` : "Качественные материалы",
        draft.manufacturer || "Российское производство",
        `${draft.category}${draft.dims.length && draft.dims.width ? ` · ${draft.dims.length}×${draft.dims.width} ${draft.dims.unit}` : ""}`,
      ];
      setDraft({ ...draft, aiCover: cover, aiBullets: bullets });
      setGenerating(false);
    }, 1500);
  };

  const publish = () => {
    acc.addProduct({
      name: draft.name.trim(),
      category: draft.category,
      price: +draft.price,
      description: draft.description.trim() || (draft.aiBullets || []).join(" · "),
      materials: draft.materials,
      manufacturer: draft.manufacturer.trim() || undefined,
      dimensions: +draft.dims.length && +draft.dims.width ? {
        length: +draft.dims.length, width: +draft.dims.width,
        height: +draft.dims.height || undefined, unit: draft.dims.unit,
      } : undefined,
      tags: draft.tags,
      media: draft.media,
      aiGenerated: !!draft.aiCover,
    });
    setDraft(empty);
    setStep(1);
    onClose();
  };

  const canNext =
    step === 1 ? draft.media.length > 0 :
    step === 2 ? draft.name.trim().length >= 3 && +draft.price > 0 :
    step === 3 ? true :
    !!draft.aiCover || !!draft.description;

  return (
    <Modal open={open} onClose={onClose} title="Мастер карточки товара" wide>
      <div className="grid lg:grid-cols-[1fr_300px] gap-6">
        <div>
          <div className="flex items-center gap-2 mb-6">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold ${step === n ? "bg-dark text-cream" : step > n ? "bg-success text-cream" : "bg-line-soft text-ink-mute"}`}>
                  {step > n ? <Check size={14} /> : n}
                </div>
                <span className={`text-[12px] font-semibold hidden sm:block ${step === n ? "text-ink" : "text-ink-mute"}`}>
                  {["Медиа", "Основное", "Детали", "AI-карточка"][n - 1]}
                </span>
                {n < 4 && <div className={`w-8 h-px ${step > n ? "bg-success" : "bg-line"}`} />}
              </div>
            ))}
          </div>

          {step === 1 && (
            <div>
              <h3 className="font-display font-bold text-[18px] text-ink mb-2">Загрузите фото и видео</h3>
              <p className="text-[13px] text-ink-soft mb-4">До 10 файлов. Первое фото станет обложкой. Видео повышает конверсию на 30%.</p>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mb-4">
                {draft.media.map((m, i) => (
                  <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-line-soft group">
                    {m.type === "video" ? (
                      <video src={m.url} className="w-full h-full object-cover" muted />
                    ) : (
                      <img src={m.url} alt={m.name} className="w-full h-full object-cover" />
                    )}
                    {i === 0 && <span className="absolute top-1 left-1 text-[10px] font-bold bg-dark text-cream px-1.5 py-0.5 rounded">Обложка</span>}
                    <button
                      onClick={() => setDraft({ ...draft, media: draft.media.filter((_, x) => x !== i) })}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-error text-white flex items-center justify-center opacity-0 group-hover:opacity-100"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {draft.media.length < 10 && (
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="aspect-square rounded-xl border-2 border-dashed border-line flex flex-col items-center justify-center gap-1 hover:border-ai hover:bg-ai-soft/30"
                  >
                    <Camera size={20} className="text-ink-mute" />
                    <span className="text-[11px] text-ink-mute">Добавить</span>
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={(e) => addFiles(e.target.files)} />
              <p className="text-[11px] text-ink-mute">
                {draft.media.length}/10 · видео: {draft.media.filter((m) => m.type === "video").length}/1
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <Field label="Название товара" required>
                <input className="field" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Глиняная ваза «Утро»" maxLength={120} />
              </Field>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Категория">
                  <select className="field" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                    {CATEGORIES.map((c) => <option key={c.slug}>{c.name}</option>)}
                  </select>
                </Field>
                <Field label="Цена, ₽" required>
                  <input className="field" inputMode="numeric" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value.replace(/\D/g, "") })} placeholder="4900" />
                </Field>
              </div>
              <Field label="Описание">
                <textarea className="field" rows={5} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="История создания, особенности, для чего подойдёт…" />
              </Field>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <Field label="Производитель / мастер">
                <input className="field" value={draft.manufacturer} onChange={(e) => setDraft({ ...draft, manufacturer: e.target.value })} placeholder="Мастерская «Глиняный дом»" />
              </Field>
              <Field label="Материалы">
                <div className="flex gap-2 mb-2 flex-wrap">
                  {draft.materials.map((m, i) => (
                    <Badge key={i} tone="honey">
                      {m}
                      <button onClick={() => setDraft({ ...draft, materials: draft.materials.filter((_, x) => x !== i) })} className="ml-1">×</button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input className="field flex-1" value={draft.newMaterial} onChange={(e) => setDraft({ ...draft, newMaterial: e.target.value })} placeholder="Глина, глазурь" />
                  <Btn size="sm" variant="outline" onClick={() => {
                    if (draft.newMaterial.trim()) setDraft({ ...draft, materials: [...draft.materials, draft.newMaterial.trim()], newMaterial: "" });
                  }}>+</Btn>
                </div>
              </Field>
              <div className="grid grid-cols-4 gap-2">
                <Field label="Длина"><input className="field" inputMode="numeric" value={draft.dims.length} onChange={(e) => setDraft({ ...draft, dims: { ...draft.dims, length: e.target.value } })} /></Field>
                <Field label="Ширина"><input className="field" inputMode="numeric" value={draft.dims.width} onChange={(e) => setDraft({ ...draft, dims: { ...draft.dims, width: e.target.value } })} /></Field>
                <Field label="Высота"><input className="field" inputMode="numeric" value={draft.dims.height} onChange={(e) => setDraft({ ...draft, dims: { ...draft.dims, height: e.target.value } })} /></Field>
                <Field label="Ед.">
                  <select className="field" value={draft.dims.unit} onChange={(e) => setDraft({ ...draft, dims: { ...draft.dims, unit: e.target.value as "см" | "мм" | "м" } })}>
                    <option>см</option><option>мм</option><option>м</option>
                  </select>
                </Field>
              </div>
              <Field label="Теги для поиска">
                <div className="flex gap-2 mb-2 flex-wrap">
                  {draft.tags.map((t, i) => (
                    <Badge key={i}>#{t}<button onClick={() => setDraft({ ...draft, tags: draft.tags.filter((_, x) => x !== i) })} className="ml-1">×</button></Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input className="field flex-1" value={draft.newTag} onChange={(e) => setDraft({ ...draft, newTag: e.target.value })} placeholder="подарок, интерьер" />
                  <Btn size="sm" variant="outline" onClick={() => {
                    if (draft.newTag.trim()) setDraft({ ...draft, tags: [...draft.tags, draft.newTag.trim()], newTag: "" });
                  }}>+</Btn>
                </div>
              </Field>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="bg-ai-soft/40 border border-ai/30 rounded-xl p-4">
                <p className="text-[13px] text-ink mb-3">
                  <Sparkles size={14} className="inline text-ai mr-1" />
                  AI соберёт карточку из ваших данных. Осталось генераций: <b>{aiLeft}/10</b>
                </p>
                <Btn variant="dark" className="w-full" disabled={generating || aiLeft === 0} onClick={generateAi}>
                  <Wand2 size={15} /> {generating ? "Генерирую…" : aiLeft === 0 ? "Лимит исчерпан" : "Сгенерировать карточку"}
                </Btn>
              </div>
              {draft.aiCover && (
                <div className="bg-surface rounded-xl overflow-hidden shadow-card">
                  <img src={draft.aiCover} className="w-full aspect-[16/9] object-cover" />
                  <div className="p-4">
                    <h4 className="font-display font-bold text-[17px] text-ink mb-1">{draft.name}</h4>
                    <p className="text-[12px] text-ink-mute mb-3">
                      {draft.category}{draft.manufacturer ? ` · ${draft.manufacturer}` : ""}
                    </p>
                    <ul className="space-y-1.5 mb-3">
                      {(draft.aiBullets || []).map((b, i) => (
                        <li key={i} className="text-[12.5px] text-ink-soft">• {b}</li>
                      ))}
                    </ul>
                    <div className="flex items-baseline justify-between pt-3 border-t border-line-soft">
                      <span className="font-display font-extrabold text-[22px] text-accent">
                        {(+draft.price || 0).toLocaleString("ru-RU")} ₽
                      </span>
                      <Btn size="sm" variant="ghost" disabled={aiLeft === 0} onClick={generateAi}>
                        <Sparkles size={12} /> Ещё вариант
                      </Btn>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between mt-8 pt-5 border-t border-line-soft">
            <Btn variant="ghost" onClick={() => (step === 1 ? onClose() : setStep(step - 1))}>
              <ArrowLeft size={14} /> {step === 1 ? "Отмена" : "Назад"}
            </Btn>
            {step < 4 ? (
              <Btn disabled={!canNext} onClick={() => setStep(step + 1)}>Далее <ArrowRight size={14} /></Btn>
            ) : (
              <Btn disabled={!canNext} onClick={publish}><Package size={14} /> Опубликовать</Btn>
            )}
          </div>
        </div>

        <div className="bg-cream rounded-xl p-4 sticky top-4 self-start">
          <p className="text-[11px] font-bold uppercase tracking-wide text-ink-mute mb-3">Сводка</p>
          <div className="space-y-2 text-[12px]">
            <div className="flex items-center gap-2">
              <ImageIcon size={13} className={draft.media.length ? "text-success" : "text-ink-mute"} />
              <span>{draft.media.length} файлов</span>
            </div>
            <div className="flex items-center gap-2">
              <Package size={13} className={draft.name ? "text-success" : "text-ink-mute"} />
              <span className={draft.name ? "text-ink" : "text-ink-mute"}>{draft.name || "Без названия"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Layers size={13} className="text-ink-mute" />
              <span>{draft.category}</span>
            </div>
            <div className="flex items-center gap-2">
              <Tags size={13} className={+draft.price ? "text-success" : "text-ink-mute"} />
              <span>{+draft.price ? `${(+draft.price).toLocaleString("ru-RU")} ₽` : "Цена не задана"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Ruler size={13} className={draft.materials.length ? "text-success" : "text-ink-mute"} />
              <span>{draft.materials.length ? `${draft.materials.length} материалов` : "Без материалов"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles size={13} className={draft.aiCover ? "text-ai" : "text-ink-mute"} />
              <span>{draft.aiCover ? "AI-карточка готова" : "AI не запущен"}</span>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
