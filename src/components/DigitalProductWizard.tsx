/* ============================================================
   DigitalProductWizard — пятишаговый мастер создания/редактирования
   цифрового продукта (ТЗ §5). Стиль: Gumroad / PromptBase, тёмная
   тема, акцентный цвет по типу продукта (§14).

   Шаги: 1 тип → 2 базовые поля → 3 файлы (приватный + превью) →
         4 специфичные поля типа → 5 сводка и публикация.

   Файл продукта уходит на POST /api/digital/upload в приватное
   хранилище server/uploads/digital (путь клиенту НЕ возвращается
   как публичный URL — только приватный ключ fileUrl для записи).
   Превью — на POST /api/digital/preview (публично, с водяным
   знаком, нанесённым на сервере).

   На мобильных открывается полноэкранно; между шагами работает
   свайп (touch-жесты), кнопки Назад/Далее, индикатор «Шаг N из 5».
   ============================================================ */
import { useEffect, useMemo, useRef, useState } from "react";
import { useDigitalStore } from "../lib/digital";
import { useAppStore } from "../lib/store";
import type {
  DigitalProduct, DigitalProductType, LicenseType, TargetAIModel, SkillFormat,
  ModelProvider, BillingCycle, SubscriptionTier,
} from "../types/digital";
import { DIGITAL_TYPE_META, ALLOWED_FILE_FORMATS, LICENSE_LABELS } from "../types/digital";
import { Btn, Field } from "./ui";

const TYPE_CARDS: Array<{ t: DigitalProductType; title: string; desc: string }> = [
  { t: "site", title: "Сайт и шаблон", desc: "Готовый сайт, лендинг или шаблон с исходниками и демо." },
  { t: "prompt", title: "Промт / набор промтов", desc: "Системные промты для GPT-4, Claude, Midjourney и др." },
  { t: "skill", title: "Скилл для ИИ-агента", desc: "Модуль расширения агента: JSON, YAML или Python." },
  { t: "agent", title: "Готовый ИИ-агент", desc: "Автономный агент с конфигурацией и лимитами токенов." },
  { t: "subscription", title: "Подписка на каталог", desc: "Право доступа к подборке продуктов на период." },
];

const emptyDraft = () => ({
  type: "" as DigitalProductType | "",
  title: "", description: "", price: "", licenseType: "personal" as LicenseType, version: "1.0",
  fileUrl: "", fileName: "", previewUrl: "", previewName: "", testDriveLimit: 2,
  /* site */ techStack: "", demoUrl: "", includesSourceCode: false,
  /* prompt */ systemPrompt: "", exampleInputs: [""], exampleOutputs: [""], targetAI: "gpt4" as TargetAIModel,
  /* skill */ skillFormat: "json" as SkillFormat, compatibleAgents: "", documentation: "",
  /* agent */ agentConfig: "{}", modelProvider: "openai" as ModelProvider, requiresHosting: false, monthlyTokenLimit: 1000000,
  /* subscription */ billingCycle: "monthly" as BillingCycle, includedProducts: "", tier: "basic" as SubscriptionTier, features: "",
});
type Draft = ReturnType<typeof emptyDraft>;

interface Props {
  open: boolean;
  editId: string | null;          /* id продукта в режиме редактирования */
  onClose: (createdId?: string) => void;
}

export function DigitalProductWizard({ open, editId, onClose }: Props) {
  const createProduct = useDigitalStore((s) => s.createProduct);
  const updateProduct = useDigitalStore((s) => s.updateProduct);
  const allProducts = useDigitalStore((s) => s.products);
  const editing = useMemo(() => (editId ? allProducts.find((p) => p.id === editId) || null : null), [editId, allProducts]);

  const [step, setStep] = useState(1);
  const [d, setD] = useState<Draft>(emptyDraft());
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const touchX = useRef<number | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));

  /* предзаполнение при редактировании */
  useEffect(() => {
    if (!open) { setStep(1); setErrors([]); }
    if (open && editing) {
      const e = editing as unknown as Record<string, any>;
      setD({
        ...emptyDraft(),
        type: editing.type, title: editing.title, description: editing.description,
        price: String(editing.price), licenseType: editing.licenseType, version: editing.version,
        fileUrl: editing.fileUrl, fileName: editing.fileUrl.split("/").pop() || "", previewUrl: editing.previewUrl,
        previewName: editing.previewUrl.split("/").pop() || "", testDriveLimit: editing.testDriveLimit,
        techStack: (e.techStack || []).join(", "), demoUrl: e.demoUrl || "", includesSourceCode: !!e.includesSourceCode,
        systemPrompt: e.systemPrompt || "", exampleInputs: e.exampleInputs?.length ? e.exampleInputs : [""],
        exampleOutputs: e.exampleOutputs?.length ? e.exampleOutputs : [""], targetAI: e.targetAI || "gpt4",
        skillFormat: e.skillFormat || "json", compatibleAgents: (e.compatibleAgents || []).join(", "), documentation: e.documentation || "",
        agentConfig: e.agentConfig ? JSON.stringify(e.agentConfig, null, 2) : "{}", modelProvider: e.modelProvider || "openai",
        requiresHosting: !!e.requiresHosting, monthlyTokenLimit: e.monthlyTokenLimit ?? 1000000,
        billingCycle: e.billingCycle || "monthly", includedProducts: (e.includedProducts || []).join(", "),
        tier: e.tier || "basic", features: (e.features || []).join("\n"),
      });
    }
    if (open && !editing) setD(emptyDraft());
  }, [open, editId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const validateStep = (): string[] => {
    const e: string[] = [];
    if (step === 1 && !d.type) e.push("Выберите тип продукта.");
    if (step === 2) {
      if (d.title.trim().length < 5 || d.title.trim().length > 100) e.push("Заголовок: от 5 до 100 символов.");
      if (d.description.trim().length < 20 || d.description.trim().length > 2000) e.push("Описание: от 20 до 2000 символов.");
      const price = Number(d.price);
      if (!(price >= 0 && price <= 1_000_000)) e.push("Цена: от 0 до 1 000 000 ₽.");
    }
    if (step === 3) {
      if (!d.fileUrl && !editing) e.push("Загрузите файл продукта.");
      if (!d.previewUrl) e.push("Загрузите изображение превью (png/jpg).");
    }
    if (step === 4 && d.type === "prompt") {
      if (!d.systemPrompt.trim()) e.push("Заполните системный промт (он скрыт до покупки).");
    }
    if (step === 4 && d.type === "agent") {
      try { JSON.parse(d.agentConfig); } catch { e.push("Конфигурация агента должна быть валидным JSON."); }
    }
    return e;
  };

  const next = () => {
    const errs = validateStep();
    setErrors(errs);
    if (errs.length) return;
    setStep((s) => Math.min(5, s + 1));
  };
  const prev = () => { setErrors([]); setStep((s) => Math.max(1, s - 1)); };

  /* ---------- загрузка файлов ---------- */
  const uploadProductFile = async (f: File) => {
    const ext = (f.name.split(".").pop() || "").toLowerCase();
    const allowed = d.type ? ALLOWED_FILE_FORMATS[d.type as DigitalProductType] : [];
    if (allowed.length && !allowed.includes(ext)) { alert(`Формат .${ext} недопустим для типа «${d.type}». Разрешены: ${allowed.join(", ")}`); return; }
    setBusy(true);
    try {
      const buf = await f.arrayBuffer();
      const r = await fetch(`/api/digital/upload?name=${encodeURIComponent(f.name)}&type=${d.type}`, {
        method: "POST", headers: { "Content-Type": "application/octet-stream" }, credentials: "include", body: buf,
      });
      const j = await r.json();
      if (j.ok) set("fileUrl", j.fileUrl); else alert(j.error === "not_auth" ? "Нужна авторизация" : "Не удалось загрузить файл");
    } catch { alert("Сервер недоступен. Файл будет привязан локально (демо-режим)."); set("fileUrl", "local://" + f.name); }
    set("fileName", f.name);
    setBusy(false);
  };

  const uploadPreview = async (f: File) => {
    if (!/image\/(png|jpeg)/.test(f.type)) { alert("Превью: только png или jpg"); return; }
    setBusy(true);
    try {
      const buf = await f.arrayBuffer();
      const r = await fetch(`/api/digital/preview?name=${encodeURIComponent(f.name)}`, {
        method: "POST", headers: { "Content-Type": "application/octet-stream" }, credentials: "include", body: buf,
      });
      const j = await r.json();
      if (j.ok) set("previewUrl", j.previewUrl); else alert("Не удалось загрузить превью");
    } catch {
      /* офлайн: генерируем data-URL с водяным знаком на canvas */
      const url = await makeWatermarkedDataUrl(f);
      set("previewUrl", url);
    }
    set("previewName", f.name);
    setBusy(false);
  };

  const publish = async () => {
    setBusy(true);
    const base: Partial<DigitalProduct> & Record<string, unknown> = {
      type: d.type as DigitalProductType, title: d.title.trim(), description: d.description.trim(),
      price: Number(d.price), licenseType: d.licenseType, version: d.version || "1.0",
      fileUrl: d.fileUrl, previewUrl: d.previewUrl, testDriveLimit: Number(d.testDriveLimit) || 2,
    };
    if (d.type === "site") Object.assign(base, { techStack: splitList(d.techStack), demoUrl: d.demoUrl.trim() || undefined, includesSourceCode: d.includesSourceCode });
    if (d.type === "prompt") Object.assign(base, { systemPrompt: d.systemPrompt, exampleInputs: d.exampleInputs.filter(Boolean), exampleOutputs: d.exampleOutputs.filter(Boolean), targetAI: d.targetAI });
    if (d.type === "skill") Object.assign(base, { skillFormat: d.skillFormat, compatibleAgents: splitList(d.compatibleAgents), documentation: d.documentation });
    if (d.type === "agent") Object.assign(base, { agentConfig: safeJson(d.agentConfig), modelProvider: d.modelProvider, requiresHosting: d.requiresHosting, monthlyTokenLimit: Number(d.monthlyTokenLimit) || 0 });
    if (d.type === "subscription") Object.assign(base, { billingCycle: d.billingCycle, includedProducts: splitList(d.includedProducts), tier: d.tier, features: d.features.split("\n").map((x) => x.trim()).filter(Boolean) });

    let resultId: string | undefined;
    if (editing) {
      const ok = updateProduct(editing.id, base as Partial<DigitalProduct>);
      if (!ok) { alert("Редактирование запрещено: вы не владелец продукта."); setBusy(false); return; }
      resultId = editing.id;
    } else {
      const p = createProduct(base as Parameters<typeof createProduct>[0]);
      if (!p) { alert("Создание доступно только верифицированному продавцу."); setBusy(false); return; }
      resultId = p.id;
    }
    setBusy(false);
    onClose(resultId);
  };

  const swipe = (dir: number) => { if (dir < 0 && step > 1) prev(); else if (dir > 0 && step < 5) next(); };

  const accent = d.type ? DIGITAL_TYPE_META[d.type as DigitalProductType] : null;
  const myPurchasesForSubs = useDigitalStore.getState().products.filter((p) => p.ownerId === useAppStore.getState().session?.userId && p.type !== "subscription");

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center sm:p-4"
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => { if (touchX.current == null) return; const dx = e.changedTouches[0].clientX - touchX.current; touchX.current = null; if (Math.abs(dx) > 60) swipe(dx < 0 ? 1 : -1); }}>
      <div className="bg-surface w-full h-[100dvh] sm:h-auto sm:max-h-[88vh] sm:rounded-2xl shadow-lift flex flex-col overflow-hidden">
        {/* шапка с прогрессом */}
        <div className="px-4 sm:px-7 pt-4 pb-3 border-b border-line-soft shrink-0">
          <div className="flex items-center justify-between gap-3 mb-2">
            <h3 className="font-display font-bold text-[18px] text-ink truncate">
              {editing ? "Редактирование цифрового товара" : "Новый цифровой товар"}
            </h3>
            <button type="button" aria-label="Закрыть мастер" onClick={() => onClose()}
              className="w-11 h-11 sm:w-8 sm:h-8 -mr-2 shrink-0 rounded-full bg-line-soft text-ink-mute hover:bg-error hover:text-white cursor-pointer text-[16px]">✕</button>
          </div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-ink-mute">Шаг {step} из 5{accent ? ` · ${accent.icon} ${accent.label}` : ""}</p>
          <div className="mt-2 h-1.5 rounded-full bg-line-soft overflow-hidden">
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${step * 20}%`, background: "var(--color-accent)" }} />
          </div>
        </div>

        {/* тело шага */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-7 py-5" style={{ WebkitOverflowScrolling: "touch" }}>
          {errors.length > 0 && (
            <div className="mb-4 rounded-xl border border-error/40 bg-error/5 p-3 space-y-1">
              {errors.map((e) => <p key={e} className="text-[12.5px] text-error">• {e}</p>)}
            </div>
          )}

          {step === 1 && (
            <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 gap-3">
              {TYPE_CARDS.map((c) => {
                const meta = DIGITAL_TYPE_META[c.t];
                const sel = d.type === c.t;
                return (
                  <button type="button" key={c.t} onClick={() => set("type", c.t)}
                    className={`text-left rounded-2xl border p-4 min-h-[44px] transition-all cursor-pointer ${sel ? "border-transparent ring-2 shadow-lift" : "border-line-soft bg-surface hover:-translate-y-0.5"}`}
                    style={sel ? { ["--tw-ring-color" as string]: "var(--color-accent)", background: "var(--color-dark)", color: "var(--color-cream)" } : undefined}>
                    <span className={`inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-full mb-2 ${meta.accentClass}`}>{meta.icon} {meta.label}</span>
                    <p className="font-display font-bold text-[15px] mb-1">{c.title}</p>
                    <p className={`text-[12px] ${sel ? "opacity-80" : "text-ink-soft"}`}>{c.desc}</p>
                  </button>
                );
              })}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 max-w-[560px]">
              <Field label="Заголовок (5–100 символов)" required>
                <input className="field" value={d.title} onChange={(e) => set("title", e.target.value)} maxLength={100} placeholder="Напр.: GPT-промт «Юридический анализ договоров»" />
              </Field>
              <Field label="Описание (20–2000 символов)" required>
                <textarea className="field min-h-[120px]" value={d.description} onChange={(e) => set("description", e.target.value)} maxLength={2000} placeholder="Что входит, для кого, как использовать…" />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Цена, ₽ (0–1 000 000)" required>
                  <input className="field" type="number" inputMode="numeric" min={0} max={1000000} value={d.price} onChange={(e) => set("price", e.target.value)} placeholder="990" />
                </Field>
                <Field label="Тип лицензии" required>
                  <select className="field" value={d.licenseType} onChange={(e) => set("licenseType", e.target.value as LicenseType)}>
                    {(Object.keys(LICENSE_LABELS) as LicenseType[]).map((l) => <option key={l} value={l}>{LICENSE_LABELS[l]}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Версия (major.minor)">
                <input className="field" value={d.version} onChange={(e) => set("version", e.target.value)} placeholder="1.0" pattern="\d+\.\d+" />
              </Field>
              {(d.type === "prompt" || d.type === "agent") && (
                <Field label="Лимит бесплатных тест-драйвов">
                  <input className="field" type="number" inputMode="numeric" min={0} max={10} value={d.testDriveLimit} onChange={(e) => set("testDriveLimit", Number(e.target.value))} />
                </Field>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5 max-w-[560px]">
              <div className="rounded-2xl border border-line-soft p-4">
                <p className="font-bold text-[13.5px] text-ink mb-1">Файл продукта (приватный)</p>
                <p className="text-[12px] text-ink-mute mb-3">Хранится в защищённой зоне сервера вне публичного доступа. Покупатель получит его только через проверенную временную ссылку после оплаты.
                  {d.type ? ` Допустимые форматы: ${ALLOWED_FILE_FORMATS[d.type as DigitalProductType].join(", ")}.` : ""}</p>
                <label className="flex items-center gap-3 h-14 px-4 rounded-xl border border-dashed border-line cursor-pointer hover:border-accent transition-colors">
                  <span className="text-[22px]">🔒</span>
                  <span className="flex-1 min-w-0 text-[13px] text-ink-soft truncate">{busy ? "Загрузка…" : d.fileName || (editing ? "Оставить текущий файл" : "Выбрать файл…")}</span>
                  <input type="file" className="hidden" accept={d.type ? "." + ALLOWED_FILE_FORMATS[d.type as DigitalProductType].join(",.") : undefined}
                    onChange={(e) => e.target.files?.[0] && uploadProductFile(e.target.files[0])} />
                </label>
              </div>
              <div className="rounded-2xl border border-line-soft p-4">
                <p className="font-bold text-[13.5px] text-ink mb-1">Превью (публичное, png/jpg)</p>
                <p className="text-[12px] text-ink-mute mb-3">Видно всем в каталоге. Водяной знак Quantiform наносится автоматически.</p>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-3 h-14 px-4 rounded-xl border border-dashed border-line cursor-pointer hover:border-accent transition-colors flex-1">
                    <span className="text-[22px]">🖼️</span>
                    <span className="flex-1 min-w-0 text-[13px] text-ink-soft truncate">{busy ? "Обработка…" : d.previewName || "Выбрать изображение…"}</span>
                    <input type="file" accept="image/png,image/jpeg" className="hidden"
                      onChange={(e) => e.target.files?.[0] && uploadPreview(e.target.files[0])} />
                  </label>
                  {d.previewUrl && <img src={d.previewUrl} alt="Превью" className="w-16 h-16 rounded-xl object-cover border border-line-soft" />}
                </div>
              </div>
            </div>
          )}

          {step === 4 && d.type === "prompt" && (
            <div className="space-y-4 max-w-[560px]">
              <Field label="Системный промт (скрыт до покупки)" required>
                <textarea className="field min-h-[140px] font-mono text-[12px]" value={d.systemPrompt} onChange={(e) => set("systemPrompt", e.target.value)} placeholder="Ты — опытный юрист…" />
              </Field>
              <ListEditor label="Примеры входных запросов" items={d.exampleInputs} onChange={(v) => set("exampleInputs", v)} placeholder="Вопрос клиента…" />
              <ListEditor label="Примеры результатов" items={d.exampleOutputs} onChange={(v) => set("exampleOutputs", v)} placeholder="Ответ модели…" />
              <Field label="Целевая модель ИИ">
                <select className="field" value={d.targetAI} onChange={(e) => set("targetAI", e.target.value as TargetAIModel)}>
                  {["gpt4", "claude", "midjourney", "stable-diffusion", "other"].map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </Field>
            </div>
          )}
          {step === 4 && d.type === "site" && (
            <div className="space-y-4 max-w-[560px]">
              <Field label="Технологии (через запятую)"><input className="field" value={d.techStack} onChange={(e) => set("techStack", e.target.value)} placeholder="React, Tailwind, Vite" /></Field>
              <Field label="Ссылка на живое демо"><input className="field" type="url" inputMode="url" value={d.demoUrl} onChange={(e) => set("demoUrl", e.target.value)} placeholder="https://demo.example.ru" /></Field>
              <label className="flex items-center gap-2 text-[13px] text-ink cursor-pointer min-h-[44px]">
                <input type="checkbox" checked={d.includesSourceCode} onChange={(e) => set("includesSourceCode", e.target.checked)} className="w-4 h-4" />
                Включить исходный код в архив
              </label>
            </div>
          )}
          {step === 4 && d.type === "skill" && (
            <div className="space-y-4 max-w-[560px]">
              <Field label="Формат скилла">
                <select className="field" value={d.skillFormat} onChange={(e) => set("skillFormat", e.target.value as SkillFormat)}>
                  {["json", "yaml", "python"].map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </Field>
              <Field label="Совместимые фреймворки (через запятую)"><input className="field" value={d.compatibleAgents} onChange={(e) => set("compatibleAgents", e.target.value)} placeholder="LangChain, CrewAI, AutoGen" /></Field>
              <Field label="Документация по интеграции"><textarea className="field min-h-[120px]" value={d.documentation} onChange={(e) => set("documentation", e.target.value)} /></Field>
            </div>
          )}
          {step === 4 && d.type === "agent" && (
            <div className="space-y-4 max-w-[560px]">
              <Field label="Конфигурация агента (JSON)" required>
                <textarea className="field min-h-[160px] font-mono text-[12px]" value={d.agentConfig} onChange={(e) => set("agentConfig", e.target.value)} />
              </Field>
              <Field label="Провайдер модели">
                <select className="field" value={d.modelProvider} onChange={(e) => set("modelProvider", e.target.value as ModelProvider)}>
                  {["openai", "local", "anthropic", "other"].map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </Field>
              <label className="flex items-center gap-2 text-[13px] text-ink cursor-pointer min-h-[44px]">
                <input type="checkbox" checked={d.requiresHosting} onChange={(e) => set("requiresHosting", e.target.checked)} className="w-4 h-4" />
                Требуется облачный хостинг
              </label>
              <Field label="Лимит токенов в месяц"><input className="field" type="number" inputMode="numeric" value={d.monthlyTokenLimit} onChange={(e) => set("monthlyTokenLimit", Number(e.target.value))} /></Field>
            </div>
          )}
          {step === 4 && d.type === "subscription" && (
            <div className="space-y-4 max-w-[560px]">
              <Field label="Цикл оплаты">
                <select className="field" value={d.billingCycle} onChange={(e) => set("billingCycle", e.target.value as BillingCycle)}>
                  <option value="monthly">Ежемесячно</option><option value="yearly">Ежегодно</option>
                </select>
              </Field>
              <Field label={`Продукты в подписке (id через запятую)${myPurchasesForSubs.length ? ` · ваши: ${myPurchasesForSubs.map((p) => p.id).join(", ")}` : ""}`}>
                <input className="field" value={d.includedProducts} onChange={(e) => set("includedProducts", e.target.value)} placeholder="dp-xxx, dp-yyy" />
              </Field>
              <Field label="Уровень тарифа">
                <select className="field" value={d.tier} onChange={(e) => set("tier", e.target.value as SubscriptionTier)}>
                  {["basic", "pro", "enterprise"].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Возможности (по одной на строку)"><textarea className="field min-h-[100px]" value={d.features} onChange={(e) => set("features", e.target.value)} /></Field>
            </div>
          )}
          {step === 4 && !d.type && <p className="text-[13px] text-ink-mute">Сначала выберите тип продукта (шаг 1).</p>}

          {step === 5 && (
            <div className="max-w-[560px] space-y-3">
              <SummaryRow l="Тип" v={d.type ? `${DIGITAL_TYPE_META[d.type as DigitalProductType].icon} ${DIGITAL_TYPE_META[d.type as DigitalProductType].label}` : "—"} />
              <SummaryRow l="Заголовок" v={d.title} />
              <SummaryRow l="Описание" v={d.description.slice(0, 160) + (d.description.length > 160 ? "…" : "")} />
              <SummaryRow l="Цена" v={`${Number(d.price || 0).toLocaleString("ru-RU")} ₽`} />
              <SummaryRow l="Лицензия" v={LICENSE_LABELS[d.licenseType]} />
              <SummaryRow l="Версия" v={d.version} />
              <SummaryRow l="Файл продукта" v={d.fileName || (editing ? "текущий" : "не загружен")} />
              <SummaryRow l="Превью" v={d.previewName || (editing ? "текущее" : "не загружено")} />
              {(d.type === "prompt" || d.type === "agent") && <SummaryRow l="Тест-драйвов бесплатно" v={String(d.testDriveLimit)} />}
              <p className="text-[12px] text-ink-mute pt-2">После публикации файл продукта хранится в приватной зоне и выдаётся покупателям только через временную ссылку (15 минут) после подтверждения оплаты.</p>
            </div>
          )}
        </div>

        {/* футер навигации */}
        <div className="shrink-0 border-t border-line-soft px-4 sm:px-7 py-3 flex gap-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          {step > 1 && <Btn variant="outline" onClick={prev} className="min-h-[44px]">Назад</Btn>}
          <div className="flex-1" />
          {step < 5 && <Btn variant="primary" onClick={next} disabled={busy} className="min-h-[44px]">Далее</Btn>}
          {step === 5 && <Btn variant="primary" onClick={publish} disabled={busy}>{busy ? "Публикация…" : editing ? "Сохранить изменения" : "Опубликовать"}</Btn>}
        </div>
      </div>
    </div>
  );
}

/* ---------- вспомогательные компоненты ---------- */
function SummaryRow({ l, v }: { l: string; v: string }) {
  return (
    <div className="flex gap-3 text-[13px] border-b border-line-soft pb-2">
      <span className="w-40 shrink-0 text-ink-mute">{l}</span>
      <span className="flex-1 min-w-0 text-ink break-words whitespace-pre-wrap">{v || "—"}</span>
    </div>
  );
}

function ListEditor({ label, items, onChange, placeholder }: { label: string; items: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-[11px] font-bold uppercase tracking-wide text-ink-mute">{label}</p>
        <button type="button" onClick={() => onChange([...items, ""])} className="h-11 px-2 text-[12px] font-bold text-accent cursor-pointer">+ добавить</button>
      </div>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="flex gap-2">
            <input className="field" value={it} placeholder={placeholder} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} />
            <button type="button" aria-label="Удалить" onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="w-11 shrink-0 rounded-lg text-ink-mute hover:text-error cursor-pointer">✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function splitList(s: string): string[] { return s.split(",").map((x) => x.trim()).filter(Boolean); }
function safeJson(s: string): Record<string, unknown> { try { return JSON.parse(s); } catch { return {}; } }

/** офлайн-водяной знак: canvas поверх изображения превью */
async function makeWatermarkedDataUrl(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(f);
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext("2d");
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error("no ctx")); return; }
      ctx.drawImage(img, 0, 0);
      ctx.font = `bold ${Math.max(16, Math.floor(c.width / 22))}px sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,.55)";
      ctx.shadowColor = "rgba(0,0,0,.45)"; ctx.shadowBlur = 6;
      ctx.fillText("Quantiform", c.width * 0.05, c.height * 0.93);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("load")); };
    img.src = url;
  });
}

/* ============================================================
   Упрощённая форма загрузки новой версии (§11)
   ============================================================ */
export function DigitalVersionForm({ product, onDone }: { product: DigitalProduct; onDone: () => void }) {
  const addVersion = useDigitalStore((s) => s.addVersion);
  const bumpDownload = useDigitalStore((s) => s.bumpDownload);
  void bumpDownload;
  const [version, setVersion] = useState(bumpMinor(product.version));
  const [fileUrl, setFileUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);

  const upload = async (f: File) => {
    setBusy(true);
    try {
      const buf = await f.arrayBuffer();
      const r = await fetch(`/api/digital/upload?name=${encodeURIComponent(f.name)}&type=${product.type}`, {
        method: "POST", headers: { "Content-Type": "application/octet-stream" }, credentials: "include", body: buf,
      });
      const j = await r.json();
      setFileUrl(j.ok ? j.fileUrl : "local://" + f.name);
    } catch { setFileUrl("local://" + f.name); }
    setFileName(f.name);
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <Field label="Номер новой версии (major.minor)">
        <input className="field" value={version} onChange={(e) => setVersion(e.target.value)} pattern="\d+\.\d+" />
      </Field>
      <label className="flex items-center gap-3 h-14 px-4 rounded-xl border border-dashed border-line cursor-pointer hover:border-accent transition-colors">
        <span className="text-[22px]">📦</span>
        <span className="flex-1 min-w-0 text-[13px] text-ink-soft truncate">{busy ? "Загрузка…" : fileName || "Выбрать новый файл…"}</span>
        <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      </label>
      <Btn variant="primary" className="w-full min-h-[44px]" disabled={busy || !fileUrl || !/^\d+\.\d+$/.test(version)}
        onClick={() => {
          if (!addVersion(product.id, version, fileUrl)) { alert("Только владелец может выпускать новые версии."); return; }
          onDone();
        }}>
        Выпустить версию {version}
      </Btn>
      <p className="text-[11.5px] text-ink-mute">Старая версия останется в истории — покупатели смогут скачать любую из них.</p>
    </div>
  );
}

function bumpMinor(v: string): string {
  const m = /^(\d+)\.(\d+)$/.exec(v);
  return m ? `${m[1]}.${Number(m[2]) + 1}` : "1.1";
}

/* ============================================================
   Аналитика продукта: график продаж по дням + CSV (§9)
   ============================================================ */
export function DigitalAnalyticsModal({ productId, onClose }: { productId: string; onClose: () => void }) {
  const product = useDigitalStore((s) => s.products.find((p) => p.id === productId));
  const allPurchases = useDigitalStore((s) => s.purchases);
  const purchases = useMemo(() => allPurchases.filter((p) => p.productId === productId), [allPurchases, productId]);
  if (!product) return null;

  /* продажи по дням за 14 дней */
  const days: { day: string; count: number; sum: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const dt = new Date(Date.now() - i * 864e5);
    const key = dt.toISOString().slice(0, 10);
    const dayPur = purchases.filter((p) => p.purchasedAt.slice(0, 10) === key);
    days.push({ day: key.slice(5), count: dayPur.length, sum: dayPur.reduce((a, p) => a + product.price, 0) });
  }
  const maxCount = Math.max(1, ...days.map((x) => x.count));

  const exportCsv = () => {
    const rows = [["date", "amount_rub", "version"], ...purchases.map((p) => [p.purchasedAt.slice(0, 10), String(product.price), p.purchasedVersion])];
    const blob = new Blob(["\uFEFF" + rows.map((r) => r.join(";")).join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `digital-sales-${product.id}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-surface rounded-t-2xl sm:rounded-2xl shadow-lift w-full sm:max-w-[600px] max-h-[90dvh] overflow-y-auto p-5 sm:p-7" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <h3 className="font-display font-bold text-[18px] text-ink break-words">Аналитика: {product.title}</h3>
          <button type="button" aria-label="Закрыть" onClick={onClose} className="w-11 h-11 sm:w-8 sm:h-8 shrink-0 rounded-full bg-line-soft text-ink-mute hover:bg-error hover:text-white cursor-pointer">✕</button>
        </div>
        <p className="text-[12px] text-ink-mute mb-4">Продажи за 14 дней · всего: {product.stats.salesCount} шт · доход: {product.stats.revenue.toLocaleString("ru-RU")} ₽ · скачиваний: {product.stats.downloads}</p>
        {/* простой CSS-график без тяжёлых библиотек */}
        <div className="flex items-end gap-1 h-32 mb-2" role="img" aria-label="График продаж по дням">
          {days.map((x) => (
            <div key={x.day} className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0">
              <div className="w-full rounded-t bg-accent/70" style={{ height: `${(x.count / maxCount) * 100}%`, minHeight: x.count ? 4 : 0 }} title={`${x.day}: ${x.count} шт`} />
              <span className="text-[8.5px] text-ink-mute rotate-0 hidden sm:block">{x.day}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-line-soft pt-3 mb-4 max-h-40 overflow-y-auto">
          {purchases.length === 0 && <p className="text-[12.5px] text-ink-mute">Пока нет покупок.</p>}
          {purchases.map((p) => (
            <div key={p.id} className="flex justify-between gap-2 text-[12px] py-1 border-b border-line-soft last:border-0">
              <span className="text-ink-soft">{new Date(p.purchasedAt).toLocaleString("ru-RU")}</span>
              <span className="text-ink-mute">v{p.purchasedVersion} · {product.price.toLocaleString("ru-RU")} ₽</span>
            </div>
          ))}
        </div>
        <Btn variant="outline" className="w-full min-h-[44px]" onClick={exportCsv}>Выгрузить отчёт CSV</Btn>
      </div>
    </div>
  );
}
