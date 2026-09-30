import { useState, useRef, useEffect } from "react";
import { Camera, Image as ImageIcon, Sparkles, Package, Layers, Ruler, Tags, Check, ArrowLeft, ArrowRight, Wand2, Upload, Trash2 } from "lucide-react";
import { useSellerAccount, useSellerReg, type DeliveryZone } from "../lib/seller";
import { CITIES, zoneLabel } from "../lib/geo";
import { CATEGORIES } from "../data/seed";
import { Modal, Btn, Field, Badge } from "./ui";
import { StudioCanvas } from "./StudioCanvas";
import { StudioPhoto } from "./StudioPhoto";
import { StudioSEO } from "./StudioSEO";

type Media = { type: "image" | "video"; url: string; name: string };

type Draft = {
  media: Media[];
  name: string;
  category: string;
  price: string;
  materials: string[];
  style: string;
  color: string;
  size: string;
  weight: string;
  specs: { key: string; value: string }[];
  description: string;
  aiBullets: string[];
  sellerCity: string;
  deliveryZone: DeliveryZone;
  serviceMode?: "online" | "visit" | "both";
  slots?: string[];
  instant?: boolean;
  minOrder?: string;
  restored?: boolean;
  fileFormat?: string;
  processingDays?: string;
  deliveryPickup?: boolean;
  deliveryCourier?: boolean;
  deliveryRussia?: boolean;
  deliveryZoneText?: string;
};

const empty: Draft = {
  media: [],
  name: "",
  category: CATEGORIES[0]?.name || "",
  price: "",
  materials: [],
  style: "",
  color: "",
  size: "",
  weight: "",
  specs: [],
  description: "",
  aiBullets: [],
  sellerCity: "",
  deliveryZone: { mode: "nationwide" },
  serviceMode: "both",
  slots: [],
  instant: false,
  minOrder: "",
  restored: false,
  fileFormat: "zip",
  processingDays: "1",
  deliveryPickup: false,
  deliveryCourier: false,
  deliveryRussia: true,
  deliveryZoneText: "",
};

interface Props {
  open: boolean;
  onClose: () => void;
  editId?: string | null;
  initialData?: { name?: string; description?: string; category?: string; photo?: string; tags?: string[] };
}

export function ProductWizard_v2({ open, onClose, editId, initialData }: Props) {
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<Draft>(empty);
  const [studioOpen, setStudioOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [seoOpen, setSeoOpen] = useState(false);
  
  const acc = useSellerAccount();
  const sellerReg = useSellerReg();
  const fileRef = useRef<HTMLInputElement>(null);

  const editItem = editId ? acc.products.find((pp) => pp.id === editId) : undefined;
  
  useEffect(() => {
    if (!open) return;
    if (editItem) {
      setDraft({
        ...empty,
        media: editItem.media || [],
        name: editItem.name,
        category: editItem.category,
        price: String(editItem.price),
        materials: editItem.materials || [],
        style: editItem.style || "",
        color: editItem.color || "",
        size: editItem.size || "",
        weight: editItem.weight ? String(editItem.weight) : "",
        specs: editItem.specs || [],
        description: editItem.description || "",
        aiBullets: (editItem as any).aiBullets || [],
        sellerCity: editItem.sellerCity || sellerReg.city || "",
        deliveryZone: editItem.deliveryZone || { mode: "nationwide" },
      });
    } else if (initialData) {
      setDraft({
        ...empty,
        name: initialData.name || "",
        description: initialData.description || "",
        category: initialData.category || CATEGORIES[0]?.name || "",
        media: initialData.photo ? [{ type: "image" as const, url: initialData.photo, name: "from-studio.jpg" }] : [],
        sellerCity: sellerReg.city || "",
      });
    } else {
      setDraft({ ...empty, sellerCity: sellerReg.city || "" });
    }
    setStep(1);
  }, [open, editId, initialData, editItem, sellerReg.city]);

  const totalSteps = 5;

  const canNext = () => {
    switch (step) {
      case 1: return draft.media.length > 0;
      case 2: return draft.name.trim().length >= 3 && +draft.price > 0;
      case 3: return true;
      case 4: return draft.description.trim().length >= 50;
      case 5: return true;
      default: return false;
    }
  };

  const handleNext = () => {
    if (step < totalSteps) setStep(step + 1);
    else handleSave();
  };

  const handleSave = () => {
    const data = {
      id: editId || "p" + Date.now().toString(36),
      name: draft.name.trim(),
      category: draft.category,
      price: +draft.price,
      description: draft.description.trim(),
      materials: draft.materials,
      style: draft.style || undefined,
      color: draft.color || undefined,
      size: draft.size || undefined,
      weight: draft.weight ? +draft.weight : undefined,
      specs: draft.specs.filter((s) => s.key.trim() && s.value.trim()),
      media: draft.media,
      sellerCity: draft.sellerCity,
      deliveryZone: draft.deliveryZone,
      instant: draft.instant,
      createdAt: new Date().toISOString(),
    };
    
    if (editId) {
      acc.updateProduct(editId, data);
    } else {
      acc.addProduct(data);
    }
    
    onClose();
    alert("✅ Товар успешно сохранён!");
  };

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const list = Array.from(files).slice(0, Math.max(0, 10 - draft.media.length));
    list.forEach((f) => {
      const r = new FileReader();
      r.onload = () => {
        setDraft({
          ...draft,
          media: [...draft.media, { type: f.type.startsWith("video") ? "video" : "image", url: r.result as string, name: f.name }],
        });
      };
      r.readAsDataURL(f);
    });
  };

  const removeMedia = (idx: number) => {
    setDraft({ ...draft, media: draft.media.filter((_, i) => i !== idx) });
  };

  const autoFillCharacteristics = () => {
    const src = (draft.name + " " + draft.category).toLowerCase();
    const mat = /глин|керамик|фарфор/.test(src) ? "Керамика" : /дерев|дуб|ясень|сосн/.test(src) ? "Дерево" : /латун|стал|метал/.test(src) ? "Металл" : /кож/.test(src) ? "Кожа" : /льн|хлоп|шерст|ткан/.test(src) ? "Текстиль" : /стекл/.test(src) ? "Стекло" : "";
    const st = /бохо/.test(src) ? "Бохо" : /лофт/.test(src) ? "Лофт" : /сканд/.test(src) ? "Сканди" : /минимал/.test(src) ? "Минимализм" : /неоклас/.test(src) ? "Неоклассика" : /прованс/.test(src) ? "Прованс" : /эко/.test(src) ? "Эко" : "";
    const col = /графит/.test(src) ? "Графит" : /слонов|бел/.test(src) ? "Слоновая кость" : /шалфей|зелён|зелен/.test(src) ? "Шалфей" : /терракот|корич/.test(src) ? "Терракота" : /медов|беж/.test(src) ? "Медовый" : "";
    
    setDraft({ ...draft,
      materials: mat ? [mat] : draft.materials,
      style: st || draft.style,
      color: col || draft.color,
    });
    alert("✨ Характеристики автозаполнены ИИ! Проверьте и при необходимости отредактируйте.");
  };

  const generateAIDescription = () => {
    const name = draft.name || "Этот товар";
    const mat = draft.materials[0] || "качественных материалов";
    const style = draft.style || "современном";
    
    const desc = `${name} — это идеальное сочетание стиля и функциональности. Изделие выполнено из ${mat} в ${style} стиле, что делает его отличным выбором для вашего интерьера или повседневного использования.

✅ Преимущества:
• Высокое качество исполнения и внимание к деталям.
• Экологичные и безопасные материалы.
• Эргономичный дизайн, проверенный временем.
• Подходит как для личного использования, так и в качестве стильного подарка.

📦 Комплектация: товар в фирменной упаковке, инструкция по уходу.

🚚 Доставка: отправляем в день заказа или на следующий день. Надежная упаковка гарантирует сохранность при транспортировке по всей России.`;
    
    setDraft({ ...draft, description: desc });
  };

  return (
    <Modal open={open} onClose={onClose} title={editId ? "Редактирование карточки" : "Создание карточки товара"} wide>
      <div className="max-w-5xl w-full overflow-x-hidden mx-auto">
      <div className="space-y-6">
        {/* Прогресс-бар */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="flex items-center gap-2 shrink-0">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold ${step === n ? "bg-dark text-cream" : step > n ? "bg-success text-cream" : "bg-line-soft text-ink-mute"}`}>
                {step > n ? <Check size={14} /> : n}
              </div>
              <span className={`text-[11px] font-semibold ${step === n ? "text-ink" : "text-ink-mute"}`}>
                {["Медиа", "Основное", "Характеристики", "SEO", "Доставка"][n - 1]}
              </span>
              {n < 5 && <div className={`w-10 h-px ${step > n ? "bg-success" : "bg-line"}`} />}
            </div>
          ))}
        </div>

        {/* ШАГ 1: Медиа */}
        {step === 1 && (
          <div>
            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
              <h3 className="font-display font-bold text-[18px] text-ink">📸 Фото и видео товара</h3>
              <div className="flex gap-2">
                <button type="button" onClick={() => setPhotoOpen(true)} className="h-9 px-3 rounded-[8px] bg-accent text-ink text-[11px] font-bold hover:bg-accent-deep hover:text-cream transition-colors cursor-pointer flex items-center gap-1.5"> ИИ-фотосессия</button>
                <button type="button" onClick={() => setStudioOpen(true)} className="h-9 px-3 rounded-[8px] bg-dark text-cream text-[11px] font-bold hover:bg-accent-deep transition-colors cursor-pointer flex items-center gap-1.5">🎨 Конструктор карточек</button>
              </div>
            </div>
            <p className="text-[13px] text-ink-soft mb-4">Загрузите до 10 файлов. Первое фото станет обложкой. Видео повышает конверсию на 30%.</p>
            
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mb-4">
              {draft.media.map((m, i) => (
                <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-line-soft group">
                  {m.type === "video" ? (
                    <video src={m.url} className="w-full h-full object-cover" muted />
                  ) : (
                    <img src={m.url} alt={m.name} className="w-full h-full object-cover" />
                  )}
                  {i === 0 && <span className="absolute top-1 left-1 text-[10px] font-bold bg-dark text-cream px-1.5 py-0.5 rounded">Обложка</span>}
                  <button onClick={() => removeMedia(i)} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-error text-white flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer">×</button>
                </div>
              ))}
              {draft.media.length < 10 && (
                <label className="aspect-square rounded-xl border-2 border-dashed border-line-soft flex flex-col items-center justify-center gap-1 text-ink-mute hover:border-accent cursor-pointer transition-colors">
                  <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} ref={fileRef} />
                  <Upload size={20} />
                  <span className="text-[10px] text-center">Загрузить</span>
                </label>
              )}
            </div>
            <p className="text-[11px] text-ink-mute bg-cream p-3 rounded-lg">💡 Совет: используйте качественные фото с разных ракурсов. ИИ-фотосессия поможет создать профессиональные сцены без студии.</p>
          </div>
        )}

        {/* ШАГ 2: Основное */}
        {step === 2 && (
          <div className="space-y-4">
            <h3 className="font-display font-bold text-[18px] text-ink mb-3"> Основная информация</h3>
            
            <Field label="Название товара *" hint="Минимум 3 символа. Используйте ключевые слова">
              <input className="field" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Например: Ваза керамическая «Утро» в стиле бохо, 25 см" maxLength={120} />
            </Field>

            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Категория *">
                <select className="field" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                  {CATEGORIES.map((c) => (
                    <option key={c.slug} value={c.name}>{c.emoji} {c.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Цена, ₽ *">
                <input className="field" inputMode="numeric" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value.replace(/\D/g, "") })} placeholder="4900" />
              </Field>
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
              <label className="text-[11.5px] font-bold text-ink-mute">Краткое описание</label>
              <button type="button" onClick={generateAIDescription} className="h-8 px-3 rounded-[8px] bg-accent text-ink text-[11px] font-bold hover:bg-accent-deep hover:text-cream transition-colors cursor-pointer flex items-center gap-1.5">✨ Сгенерировать описание с AI</button>
            </div>
            <p className="text-[11px] text-ink-mute mb-1">2-3 предложения о товаре (будет использовано для SEO)</p>
            <textarea className="field" rows={6} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Уникальная ручная работа. Идеально подойдёт для интерьера в стиле бохо..." />
          </div>
        )}

        {/* ШАГ 3: Характеристики */}
        {step === 3 && (
          <div>
            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
              <h3 className="font-display font-bold text-[18px] text-ink">📊 Характеристики товара</h3>
              <button type="button" onClick={autoFillCharacteristics} className="h-9 px-3 rounded-[8px] bg-accent text-ink text-[11px] font-bold hover:bg-accent-deep hover:text-cream transition-colors cursor-pointer flex items-center gap-1.5">✨ Автозаполнить ИИ</button>
            </div>
            <p className="text-[13px] text-ink-soft mb-4">Заполните характеристики для лучшей видимости в поиске.</p>

            <div className="grid sm:grid-cols-2 gap-3 mb-4">
              <Field label="Материал">
                <input className="field" value={draft.materials[0] || ""} onChange={(e) => setDraft({ ...draft, materials: [e.target.value] })} placeholder="Керамика, дерево, металл..." />
              </Field>
              <Field label="Стиль">
                <input className="field" value={draft.style} onChange={(e) => setDraft({ ...draft, style: e.target.value })} placeholder="Бохо, лофт, сканди, минимализм..." />
              </Field>
              <Field label="Цвет">
                <input className="field" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} placeholder="Шалфей, терракота, графит..." />
              </Field>
              <Field label="Размер / Габариты">
                <input className="field" value={draft.size} onChange={(e) => setDraft({ ...draft, size: e.target.value })} placeholder="Ø 20 см, 40×60×15 см..." />
              </Field>
              <Field label="Вес, кг">
                <input className="field" inputMode="decimal" value={draft.weight} onChange={(e) => setDraft({ ...draft, weight: e.target.value.replace(/[^\d.]/g, "") })} placeholder="1.2" />
              </Field>
            </div>

            <p className="text-[11px] font-bold text-ink-mute mb-2">Дополнительные параметры (ключ — значение)</p>
            {draft.specs.map((sp, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input className="field flex-1" value={sp.key} onChange={(e) => setDraft({ ...draft, specs: draft.specs.map((x, xi) => xi === i ? { ...x, key: e.target.value } : x) })} placeholder="Параметр (например, Комплектация)" />
                <input className="field flex-1" value={sp.value} onChange={(e) => setDraft({ ...draft, specs: draft.specs.map((x, xi) => xi === i ? { ...x, value: e.target.value } : x) })} placeholder="Значение" />
                <button type="button" onClick={() => setDraft({ ...draft, specs: draft.specs.filter((_, xi) => xi !== i) })} className="w-9 h-9 shrink-0 rounded-[8px] bg-line-soft text-ink-mute hover:bg-error hover:text-white cursor-pointer">×</button>
              </div>
            ))}
            <button type="button" onClick={() => setDraft({ ...draft, specs: [...draft.specs, { key: "", value: "" }] })} className="h-8 px-3 rounded-[8px] bg-line-soft text-[11.5px] font-bold text-ink-soft hover:bg-line cursor-pointer mb-4">+ Добавить параметр</button>

            <p className="text-[11px] text-ink-mute bg-cream p-3 rounded-lg">💡 ИИ автоматически распознает материал, стиль и цвет из названия и фото. Нажмите "Автозаполнить ИИ" для экономии времени.</p>
          </div>
        )}

        {/* ШАГ 4: SEO */}
        {step === 4 && (
          <div>
            <h3 className="font-display font-bold text-[18px] text-ink mb-3">✍️ SEO-оптимизация</h3>
            <p className="text-[13px] text-ink-soft mb-4">ИИ сгенерирует продающее описание с ключевыми словами для Wildberries и Ozon.</p>
            <button type="button" onClick={generateAIDescription} className="h-11 w-full rounded-[10px] bg-dark text-cream font-bold hover:bg-accent-deep transition-colors cursor-pointer flex items-center justify-center gap-2 mb-4">
              <Sparkles size={16} /> Сгенерировать SEO-описание
            </button>
            <Field label="Полное описание товара">
              <textarea className="field" rows={10} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Описание будет сгенерировано ИИ..." />
            </Field>
          </div>
        )}

        {/* ШАГ 5: Доставка (Production) */}
        {step === 5 && (
          <div className="space-y-6">
            <h3 className="font-display font-bold text-[18px] text-ink mb-2">🚚 Логистика и условия продажи</h3>
            
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Город отправления">
                <input className="field" value={draft.sellerCity} onChange={(e) => setDraft({...draft, sellerCity: e.target.value})} placeholder="Москва" />
              </Field>
              <Field label="Срок обработки заказа (дней)">
                <input className="field" type="number" min="0" max="30" value={draft.processingDays || "1"} onChange={(e) => setDraft({...draft, processingDays: e.target.value})} />
              </Field>
            </div>

            <div>
              <p className="text-[12px] font-bold text-ink-mute mb-2">СПОСОБЫ ДОСТАВКИ</p>
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 rounded-lg border border-line-soft hover:bg-surface-soft cursor-pointer">
                  <input type="checkbox" checked={draft.deliveryPickup} onChange={(e) => setDraft({...draft, deliveryPickup: e.target.checked})} className="w-4 h-4 accent-dark" />
                  <div>
                    <span className="text-[13px] font-bold text-ink">Самовывоз</span>
                    <p className="text-[11px] text-ink-soft">Покупатель забирает товар лично по адресу</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-3 rounded-lg border border-line-soft hover:bg-surface-soft cursor-pointer">
                  <input type="checkbox" checked={draft.deliveryCourier} onChange={(e) => setDraft({...draft, deliveryCourier: e.target.checked})} className="w-4 h-4 accent-dark" />
                  <div>
                    <span className="text-[13px] font-bold text-ink">Курьер по городу</span>
                    <p className="text-[11px] text-ink-soft">Доставка силами продавца или Яндекс.Доставки</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-3 rounded-lg border border-line-soft hover:bg-surface-soft cursor-pointer">
                  <input type="checkbox" checked={draft.deliveryRussia} onChange={(e) => setDraft({...draft, deliveryRussia: e.target.checked})} className="w-4 h-4 accent-dark" />
                  <div>
                    <span className="text-[13px] font-bold text-ink">Доставка по РФ (СДЭК / Почта)</span>
                    <p className="text-[11px] text-ink-soft">Отправка транспортными компаниями в любой регион</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-3 rounded-lg border border-line-soft hover:bg-surface-soft cursor-pointer">
                  <input type="checkbox" checked={draft.instant} onChange={(e) => setDraft({...draft, instant: e.target.checked})} className="w-4 h-4 accent-dark" />
                  <div>
                    <span className="text-[13px] font-bold text-ink"> Мгновенная цифровая доставка</span>
                    <p className="text-[11px] text-ink-soft">Для цифровых товаров: файл приходит сразу после оплаты</p>
                  </div>
                </label>
              </div>
            </div>

            {(draft.serviceMode === "visit" || draft.serviceMode === "both") && (
              <div className="bg-cream p-4 rounded-lg border border-line-soft">
                <p className="text-[12px] font-bold text-ink mb-2">📍 ЗОНА ВЫЕЗДА (для услуг)</p>
                <textarea className="field" rows={2} value={draft.deliveryZoneText || ""} onChange={(e) => setDraft({...draft, deliveryZoneText: e.target.value})} placeholder="Например: Москва и Московская область до 20 км от МКАД" />
              </div>
            )}
          </div>
        )}

        {/* Навигация */}
        <div className="flex gap-3 mt-6 pt-6 border-t border-line">
          <Btn variant="ghost" onClick={() => step > 1 ? setStep(step - 1) : onClose()} disabled={step === 1}>
            <ArrowLeft size={16} className="mr-2" /> {step === 1 ? "Отмена" : "Назад"}
          </Btn>
          <Btn className="flex-1" onClick={handleNext} disabled={!canNext()}>
            {step < totalSteps ? <><ArrowRight size={16} className="mr-2" /> Далее</> : <><Check size={16} className="mr-2" /> {editId ? "Сохранить" : "Опубликовать"}</>}
          </Btn>
        </div>
      </div>

      </div>

      {/* Модальные окна Студии */}
      <StudioCanvas open={studioOpen} onClose={() => setStudioOpen(false)} />
      <StudioPhoto open={photoOpen} onClose={() => setPhotoOpen(false)} onApply={(photo) => { setDraft({ ...draft, media: [...draft.media, { type: "image", url: photo, name: "from-photo-studio.jpg" }] }); setPhotoOpen(false); }} />
      <StudioSEO open={seoOpen} onClose={() => setSeoOpen(false)} initialName={draft.name} initialCategory={draft.category} onApply={(data) => { setDraft({ ...draft, name: data.name, description: data.description }); setSeoOpen(false); }} />
    </Modal>
  );
}
