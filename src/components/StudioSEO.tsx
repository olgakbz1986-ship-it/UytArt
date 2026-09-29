import { useState } from "react";
import { Sparkles, Wand2, Copy, Check, Save } from "lucide-react";
import { CATEGORIES } from "../data/seed";
import { Btn, Field } from "./ui";
import { useSellerAccount } from "../lib/seller";

interface Props {
  open: boolean;
  onClose: () => void;
  initialName?: string;
  initialCategory?: string;
  onApply?: (data: { name: string; description: string; tags: string[] }) => void;
}

const KEY_SEEDS: Record<string, string[]> = {
  decor_home: ["интерьер", "ручная работа", "декор", "уют", "авторский", "подарок", "керамика"],
  clothing_shoes: ["натуральные ткани", "ручной пошив", "размеры", "сезон", "стиль", "качество"],
  accessories: ["натуральная кожа", "ручная работа", "аксессуар", "подарок", "стиль", "уникальный"],
  tech: ["умный дом", "гаджет", "технологии", "беспроводной", "автоматизация"],
  digital: ["ИИ-агент", "автоматизация", "SaaS", "готовое решение", "подписка", "без кода"],
  services: ["под ключ", "выезд мастера", "онлайн-консультация", "индивидуально", "под задачу"],
  foodcourt: ["домашняя кухня", "крафт", "фермерское", "без консервантов", "свежее", "доставка"],
};

function genSEO(name: string, category: string): { title: string; desc: string; tags: string[] } {
  const cat = CATEGORIES.find((c) => c.name === category);
  const seeds = KEY_SEEDS[cat?.group || ""] || KEY_SEEDS.decor_home;
  const base = (name || "Товар").trim();
  const mat = /глин|керамик/.test(base) ? "керамическая" : /дерев|дуб/.test(base) ? "деревянная" : /льн|хлоп/.test(base) ? "льняная" : "";
  const style = /бохо/.test(base) ? " в стиле бохо" : /лофт/.test(base) ? " в стиле лофт" : /сканд/.test(base) ? " в скандинавском стиле" : "";
  const title = `${base}${mat ? " " + mat : ""}${style}${mat || style ? "" : " ручной работы"}`;
  const keywords = [base.toLowerCase(), category.toLowerCase(), ...seeds.slice(0, 6)];
  const desc = `${title} — авторское изделие ручной работы. ${seeds[0].charAt(0).toUpperCase() + seeds[0].slice(1)}, ${seeds[1]}, ${seeds[2]}. Идеально подходит как ${seeds[5] || "подарок"} или элемент ${seeds[3] || "интерьера"}. Произведено в России с вниманием к деталям. Доставка по всей России СДЭК и Почтой, самовывоз в городе мастера. Качество подтверждено отзывами покупателей (средняя оценка 4.8 из 5). Закажите ${base.toLowerCase()} с гарантией подлинности и быстрой доставкой.`;
  const tags = keywords.map((k) => k.split(" ")[0] + " " + (base.split(" ")[0] || "купить"));
  return { title, desc, tags: tags.slice(0, 12) };
}

export function StudioSEO({ open, onClose, initialName, initialCategory, onApply }: Props) {
  const saveWork = useSellerAccount((s) => s.saveWork);
  const [name, setName] = useState(initialName || "");
  const [category, setCategory] = useState(initialCategory || CATEGORIES[0]?.name || "");
  const [result, setResult] = useState<{ title: string; desc: string; tags: string[] } | null>(null);
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const generate = () => setResult(genSEO(name, category));

  const copyDesc = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.desc);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const applyToCard = () => {
    if (!result || !onApply) return;
    onApply({ name: result.title, description: result.desc, tags: result.tags });
    onClose();
  };

  const saveAsWork = () => {
    if (!result) return;
    saveWork({ type: "seo", name: "SEO: " + (result.title || name), folder: "SEO-тексты", spec: "qf", data: { ...result, category }, preview: "" });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3" onClick={onClose}>
      <div className="bg-surface rounded-2xl shadow-lift max-w-[780px] w-full max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-surface z-10 px-6 py-4 border-b border-line-soft flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-dark text-cream flex items-center justify-center"><Wand2 size={18} /></span>
            <div>
              <h2 className="font-display font-bold text-[20px] text-ink">✍️ SEO-копирайтер</h2>
              <p className="text-[12px] text-ink-soft">Заголовок, описание и ключевые фразы под маркетплейсы</p>
            </div>
          </div>
          <button type="button" className="w-9 h-9 rounded-full bg-line-soft text-ink-mute hover:bg-error hover:text-white cursor-pointer" onClick={onClose}>×</button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Название товара (исходное)"><input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ваза глиняная бохо шалфей" /></Field>
            <Field label="Категория">
              <select className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => <option key={c.slug} value={c.name}>{c.name}</option>)}
              </select>
            </Field>
          </div>
          <button type="button" onClick={generate} className="h-11 w-full rounded-[10px] bg-dark text-cream font-bold hover:bg-accent-deep transition-colors cursor-pointer flex items-center justify-center gap-2">
            <Sparkles size={16} /> Сгенерировать SEO-текст
          </button>

          {result && (
            <div className="space-y-4 fade-up">
              <div>
                <p className="text-[11px] font-bold text-ink-mute mb-1.5">SEO-ЗАГОЛОВОК ({result.title.length} знаков)</p>
                <p className="text-[14px] font-bold text-ink bg-cream p-3 rounded-lg border border-line-soft">{result.title}</p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[11px] font-bold text-ink-mute">ОПИСАНИЕ ({result.desc.length} знаков)</p>
                  <button type="button" onClick={copyDesc} className="text-[11px] font-bold text-ink-soft hover:text-accent-deep cursor-pointer flex items-center gap-1">
                    {copied ? <><Check size={12} /> Скопировано</> : <><Copy size={12} /> Копировать</>}
                  </button>
                </div>
                <p className="text-[13px] text-ink-soft bg-cream p-3 rounded-lg border border-line-soft leading-relaxed whitespace-pre-wrap">{result.desc}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-ink-mute mb-1.5">КЛЮЧЕВЫЕ ФРАЗЫ ({result.tags.length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {result.tags.map((t, i) => <span key={i} className="text-[11px] px-2 py-1 bg-line-soft rounded-full text-ink-soft">{t}</span>)}
                </div>
              </div>
              <div className="flex gap-2 flex-wrap pt-2">
                {onApply && <Btn size="lg" className="flex-1" onClick={applyToCard}><Save size={16} className="mr-2" /> Вставить в карточку</Btn>}
                <Btn size="lg" variant="ghost" onClick={saveAsWork}><Save size={16} className="mr-2" /> Сохранить как работу</Btn>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
