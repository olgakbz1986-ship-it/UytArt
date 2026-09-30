import { useState } from "react";
import { Bot, Sparkles, Save, Send, Check } from "lucide-react";
import { useSellerAccount, useSellerReg } from "../lib/seller";
import { CATEGORIES } from "../data/seed";
import { Btn, Field } from "./ui";

interface Props { open: boolean; onClose: () => void; }

const DIGITAL_CATS = CATEGORIES.filter((c) => c.group === "digital");

export function StudioAgent({ open, onClose }: Props) {
  const addProduct = useSellerAccount((s) => s.addProduct);
  const sellerReg = useSellerReg();
  
  const [name, setName] = useState("");
  const [category, setCategory] = useState(DIGITAL_CATS[0]?.slug || "");
  const [price, setPrice] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [testMsg, setTestMsg] = useState("");
  const [testReply, setTestReply] = useState("");
  const [publishing, setPublishing] = useState(false);

  if (!open) return null;

  const handleTest = () => {
    if (!testMsg) return;
    setTestReply("⏳ ИИ думает... (Эмуляция: здесь будет ответ от подключенной модели YandexGPT/GigaChat на основе вашего системного промта)");
    setTimeout(() => {
      setTestReply(`✅ Готово! (Эмуляция ответа агента "${name}" на запрос: "${testMsg}")`);
    }, 1000);
7  };

  const handlePublish = () => {
    if (!name || !price || !systemPrompt) return;
    setPublishing(true);
    setTimeout(() => {
      const newItem = {
        id: "p" + Date.now().toString(36),
        name,
        category: DIGITAL_CATS.find((c) => c.slug === category)?.name || "Цифровые товары",
        price: +price,
        createdAt: new Date().toISOString(),
        description: `ИИ-агент / Промт-набор.\n\nСистемный промт:\n${systemPrompt}`,
        sellerCity: sellerReg.city || "Не указан",
        deliveryZone: { mode: "nationwide" } as any,
        instant: true,
        fileFormat: "txt",
        type: "digital" as any,
      };
      addProduct(newItem);
      setPublishing(false);
      onClose();
      alert("🎉 Товар успешно опубликован в каталоге «Цифровые товары и ИИ»!");
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-[100] top-16 bg-black/60 flex items-center justify-center p-3" onClick={onClose}>
      <div className="bg-surface rounded-2xl shadow-lift max-w-[850px] w-full max-h-[calc(100vh-8rem)] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-surface z-10 px-6 py-4 border-b border-line-soft flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-dark text-cream flex items-center justify-center"><Bot size={18} /></span>
            <div>
              <h2 className="font-display font-bold text-[20px] text-ink">🤖 Конструктор агентов и промтов</h2>
              <p className="text-[12px] text-ink-soft">Создайте ИИ-скилл и опубликуйте его как цифровой товар</p>
            </div>
          </div>
          <button type="button" className="w-9 h-9 rounded-full bg-line-soft text-ink-mute hover:bg-error hover:text-white cursor-pointer" onClick={onClose}>×</button>
        </div>

        <div className="grid lg:grid-cols-[1fr_1fr] gap-6 p-6">
          {/* Левая колонка: Настройка */}
          <div className="space-y-4">
            <Field label="Название агента / промт-набора">
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Например: Агент для ответов на отзывы WB" />
            </Field>
            <Field label="Категория в каталоге">
              <select className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
                {DIGITAL_CATS.map((c) => <option key={c.slug} value={c.slug}>{c.emoji} {c.name}</option>)}
              </select>
            </Field>
            <Field label="Цена, ₽">
              <input className="field" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} placeholder="990" />
            </Field>
            <Field label="Системный промт (инструкция для ИИ)">
              <textarea className="field" rows={6} value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} placeholder="Ты — профессиональный копирайтер. Твоя задача: отвечать на отзывы покупателей вежливо, с использованием эмодзи, не более 300 знаков..." />
            </Field>
            <button type="button" disabled={!name || !price || !systemPrompt || publishing} onClick={handlePublish}
              className="h-11 w-full rounded-[10px] bg-success text-cream font-bold hover:bg-success/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2">
              {publishing ? "Публикация..." : <><Sparkles size={16} /> Опубликовать как цифровой товар</>}
            </button>
          </div>

          {/* Правая колонка: Тест-прогон */}
          <div className="bg-surface-soft rounded-xl border border-line-soft flex flex-col h-[500px]">
            <div className="p-3 border-b border-line-soft flex items-center gap-2">
              <Bot size={16} className="text-accent" />
              <span className="font-bold text-[13px] text-ink">Тест-прогон агента</span>
            </div>
            <div className="flex-1 p-4 space-y-3 overflow-y-auto">
              {testReply && (
                <div className="flex gap-2">
                  <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center shrink-0"><Bot size={14} className="text-accent" /></div>
                  <div className="bg-cream p-3 rounded-2xl rounded-tl-none text-[13px] text-ink-soft max-w-[85%]">{testReply}</div>
                </div>
              )}
            </div>
            <div className="p-3 border-t border-line-soft flex gap-2">
              <input className="field flex-1" placeholder="Введите тестовый запрос..." value={testMsg} onChange={(e) => setTestMsg(e.target.value)} 
                onKeyDown={(e) => e.key === "Enter" && handleTest()} />
              <button onClick={handleTest} className="w-10 h-10 rounded-lg bg-dark text-cream flex items-center justify-center hover:bg-accent-deep cursor-pointer">
                <Send size={16} />
              </button>
            </div>
            <p className="text-[10px] text-ink-mute px-3 pb-3">* Эмуляция чата. Реальный прогон будет доступен после подключения API-ключа модели в «Настройках».</p>
          </div>
        </div>
      </div>
    </div>
  );
}
