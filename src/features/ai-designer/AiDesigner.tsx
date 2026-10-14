/* ============================================================
   AI-дизайнер — UI-компоненты модуля (изолированно).
   Используют существующую дизайн-систему проекта:
   Btn / Badge / Rating / ProgressBar из components/ui,
   токены tailwind (ink/accent/surface/line/cream...).
   ============================================================ */

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Upload, X, Sparkles, Check, ArrowRight, RefreshCw, Wand2, GitCompareArrows,
  ShoppingBag, Trash2, Replace, ChevronLeft, Eye, Save, Info, ScanLine, Shirt, Home as HomeIcon, Camera,
} from "lucide-react";
import { fmt } from "../../data/seed";
import { Badge, Btn, Rating } from "../../components/ui";
import { useDesignerStore, listSavedProjects } from "../../lib/ai-designer/store";
import { AI_DESIGNER_CONFIG } from "../../lib/ai-designer/config";
import type {
  DesignObject, DesignProject, DesignVariant, FashionAnalysisResult,
  InteriorAnalysisResult, PhotoQualityIssue, ProductMatch, DesignerMode, ClarifyingQuestion,
} from "../../lib/ai-designer/types";
import {
  CATEGORY_LABELS_RU, INTENSITY_LABEL_RU, INTERIOR_GROUPS, FASHION_GROUPS,
} from "../../lib/ai-designer/types";

/* ---------- утилиты ---------- */
const cx = (...a: (string | false | undefined)[]) => a.filter(Boolean).join(" ");

const QUICK_INTERIOR = [
  "Гостиная в стиле quiet luxury",
  "Спальня в тёплом минимализме",
  "Кухня в современной классике",
  "Кабинет в тёмных тонах",
  "Детская в скандинавском стиле",
  "Прихожая с местом для хранения",
];
const QUICK_FASHION = [
  "Образ на встречу с друзьями",
  "Повседневный образ на осень",
  "Деловой образ",
  "Образ для свидания",
  "Вечерний образ",
  "Образ для путешествия",
  "Капсульный гардероб на неделю",
];

/* ---------- валидация фото (§5) ---------- */
async function validatePhoto(file: File): Promise<{ dataUrl: string; issues: PhotoQualityIssue[] }> {
  const issues: PhotoQualityIssue[] = [];
  const extOk = AI_DESIGNER_CONFIG.upload.extensions.some((e) => file.name.toLowerCase().endsWith(e));
  if (!AI_DESIGNER_CONFIG.upload.formats.includes(file.type as (typeof AI_DESIGNER_CONFIG.upload.formats)[number]) || !extOk) {
    issues.push({ code: "bad_format", message: "Поддерживаются JPG, PNG и WebP." });
    return { dataUrl: "", issues };
  }
  if (file.size > AI_DESIGNER_CONFIG.upload.maxBytes) {
    issues.push({ code: "too_large", message: "Файл слишком большой. Загрузите изображение до 15 МБ." });
    return { dataUrl: "", issues };
  }
  const dataUrl = await new Promise<string>((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result));
    fr.onerror = () => rej(new Error("read"));
    fr.readAsDataURL(file);
  }).catch(() => "");
  if (!dataUrl) { issues.push({ code: "bad_format", message: "Не удалось прочитать файл. Попробуйте другое изображение." }); return { dataUrl: "", issues }; }

  /* анализ качества по canvas: яркость + «размытость» через контраст соседних пикселей */
  const q = await new Promise<{ w: number; h: number; dark: boolean; blurred: boolean; over: boolean }>((res) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      const scale = Math.min(1, 160 / Math.max(img.width, img.height));
      c.width = Math.max(8, Math.round(img.width * scale));
      c.height = Math.max(8, Math.round(img.height * scale));
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0, c.width, c.height);
      let sum = 0, bright = 0, edges = 0, n = 0;
      try {
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        const lum: number[] = [];
        for (let i = 0; i < d.length; i += 4) {
          const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
          lum.push(l); sum += l; if (l > 235) bright++;
        }
        const W = c.width;
        for (let y = 1; y < c.height - 1; y++)
          for (let x = 1; x < W - 1; x++) {
            const i = y * W + x;
            edges += Math.abs(lum[i] - lum[i - 1]) + Math.abs(lum[i] - lum[i - W]);
            n++;
          }
      } catch { /* tainted canvas не бывает для data-url */ }
      const avg = sum / (lumLength(c)) || 128;
      res({
        w: img.width, h: img.height,
        dark: avg < 48,
        over: bright / (c.width * c.height) > 0.35,
        blurred: n > 0 && edges / n < 6,
      });
    };
    img.onerror = () => res({ w: 0, h: 0, dark: false, blurred: false, over: false });
    img.src = dataUrl;
  });

  const longSide = Math.max(q.w, q.h);
  if (longSide < AI_DESIGNER_CONFIG.upload.minLongSide)
    issues.push({ code: "low_resolution", message: "Фото слишком маленькое. Загрузите изображение от 1024 px по длинной стороне." });
  if (q.dark) issues.push({ code: "dark", message: "Фото слишком тёмное. Попробуйте снять при дневном свете." });
  if (q.over) issues.push({ code: "overexposed", message: "Фото пересвечено. Снизьте яркость съёмки и повторите." });
  if (q.blurred) issues.push({ code: "blurred", message: "Фото размытое. Попробуйте снять ещё раз без движения." });
  return { dataUrl, issues };
}
function lumLength(c: HTMLCanvasElement) { return c.width * c.height; }

/* ============================================================
   Стартовый экран (idle)
   ============================================================ */
function IdleScreen() {
  const start = useDesignerStore((s) => s.start);
  const userId = "local";
  const saved = listSavedProjects(userId);
  const [quickMode, setQuickMode] = useState<DesignerMode | null>(null);
  const [quickText, setQuickText] = useState("");

  const quickStart = (mode: DesignerMode, preset: string) => {
    setQuickMode(mode); setQuickText(preset);
    start(mode);
    /* быстрый сценарий предзаполняет свободный запрос после загрузки */
    setTimeout(() => {
      const st = useDesignerStore.getState();
      if (st.project) {
        const prefs = { ...st.project.preferences, freeText: preset };
        useDesignerStore.setState({ project: { ...st.project, preferences: prefs } });
      }
    }, 0);
  };

  return (
    <div className="max-w-[1080px] mx-auto px-4 pt-10 pb-16">
      <p className="text-[12px] font-semibold tracking-[0.16em] uppercase text-ink-mute mb-2 flex items-center gap-2">
        <Sparkles size={14} className="text-accent-deep" /> Quantiform · AI-дизайнер
      </p>
      <h1 className="font-display font-bold text-[34px] md:text-[44px] text-ink leading-[1.1] mb-3">AI-дизайнер</h1>
      <p className="text-[15px] text-ink-soft max-w-[560px] mb-8">
        Загрузите фото — получите три варианта дизайна или образа и сразу подберите товары.
      </p>

      <div className="grid md:grid-cols-2 gap-4 mb-10">
        <button onClick={() => start("interior")}
          className="text-left bg-surface border border-line rounded-[16px] p-6 hover:border-accent transition-colors cursor-pointer group">
          <div className="w-11 h-11 rounded-xl bg-honey flex items-center justify-center mb-4"><HomeIcon size={20} className="text-ink" /></div>
          <h2 className="font-display font-bold text-[20px] text-ink mb-1.5">Обнови интерьер</h2>
          <p className="text-[13.5px] text-ink-soft leading-relaxed">
            Загрузите фото комнаты и получите варианты нового интерьера с товарами для покупки.
          </p>
          <span className="inline-flex items-center gap-1.5 mt-4 text-[13px] font-semibold text-accent-deep group-hover:gap-2.5 transition-all">
            Выбрать сценарий <ArrowRight size={15} />
          </span>
        </button>
        <button onClick={() => start("fashion")}
          className="text-left bg-surface border border-line rounded-[16px] p-6 hover:border-accent transition-colors cursor-pointer group">
          <div className="w-11 h-11 rounded-xl bg-pale flex items-center justify-center mb-4"><Shirt size={20} className="text-ink" /></div>
          <h2 className="font-display font-bold text-[20px] text-ink mb-1.5">Собери образ</h2>
          <p className="text-[13.5px] text-ink-soft leading-relaxed">
            Загрузите своё фото и получите три образа для любого повода — с одеждой и аксессуарами из каталога.
          </p>
          <span className="inline-flex items-center gap-1.5 mt-4 text-[13px] font-semibold text-accent-deep group-hover:gap-2.5 transition-all">
            Выбрать сценарий <ArrowRight size={15} />
          </span>
        </button>
      </div>

      {/* быстрые сценарии */}
      <div className="grid md:grid-cols-2 gap-6 mb-10">
        {[{ m: "interior" as const, title: "Быстрые сценарии: интерьер", list: QUICK_INTERIOR },
          { m: "fashion" as const, title: "Быстрые сценарии: образ", list: QUICK_FASHION }].map(({ m, title, list }) => (
          <div key={m}>
            <h3 className="text-[13px] font-semibold text-ink mb-3">{title}</h3>
            <div className="flex flex-wrap gap-2">
              {list.map((q) => (
                <button key={q} onClick={() => quickStart(m, q)}
                  className={cx(
                    "px-3 py-1.5 rounded-full border text-[12.5px] transition-colors cursor-pointer",
                    quickMode === m && quickText === q
                      ? "border-accent bg-honey text-ink"
                      : "border-line bg-transparent text-ink-soft hover:border-ink-mute hover:text-ink",
                  )}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {saved.length > 0 && (
        <div>
          <h3 className="text-[13px] font-semibold text-ink mb-3">Сохранённые проекты</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {saved.map((p) => (
              <div key={p.id} className="bg-surface border border-line rounded-[14px] p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Badge tone={p.mode === "interior" ? "honey" : "neutral"}>
                    {p.mode === "interior" ? "Интерьер" : "Образ"}
                  </Badge>
                  <span className="text-[11px] text-ink-mute">{new Date(p.updatedAt).toLocaleDateString("ru-RU")}</span>
                </div>
                <p className="text-[13.5px] text-ink font-medium line-clamp-2 min-h-[38px]">
                  {p.preferences.freeText || (p.selectedVariantId
                    ? p.variants.find((v) => v.id === p.selectedVariantId)?.title
                    : p.variants[0]?.title) || "Проект без названия"}
                </p>
                <div className="flex gap-2 mt-auto">
                  <Btn size="sm" variant="outline" onClick={() => useDesignerStore.getState().openProject(p.id)}>
                    <Eye size={14} /> Открыть
                  </Btn>
                  <Btn size="sm" variant="ghost" onClick={() => useDesignerStore.getState().deleteProject(p.id)}>
                    <Trash2 size={14} />
                  </Btn>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Загрузка фото (uploading)
   ============================================================ */
function UploadStep({ onDone }: { onDone?: () => void }) {
  const project = useDesignerStore((s) => s.project);
  const setPhoto = useDesignerStore((s) => s.setPhoto);
  const qualityIssues = useDesignerStore((s) => s.qualityIssues);
  const status = useDesignerStore((s) => s.status);
  const setModelMode = useDesignerStore((s) => s.setModelMode);
  const modelMode = project?.modelMode ?? false;
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  void onDone;

  const handleFile = async (file?: File | null) => {
    if (!file) return;
    const { dataUrl, issues } = await validatePhoto(file);
    if (!dataUrl && issues.length) { setPhoto("", issues); return; }
    setPhoto(dataUrl, issues);
  };

  return (
    <div className="max-w-[720px] mx-auto px-4 py-10">
      <button onClick={useDesignerStore.getState().backToStart} className="inline-flex items-center gap-1.5 text-[13px] text-ink-soft hover:text-ink mb-6 cursor-pointer">
        <ChevronLeft size={15} /> Назад к выбору сценария
      </button>
      <h2 className="font-display font-bold text-[26px] text-ink mb-2">
        {project?.mode === "interior" ? "Загрузите фото комнаты" : "Загрузите своё фото"}
      </h2>
      <p className="text-[13.5px] text-ink-soft mb-6">
        {project?.mode === "interior"
          ? "Снимите комнату целиком при дневном свете — планировка, окна и двери будут сохранены."
          : "Фото в полный рост даёт наиболее точную примерку. Не хотите загружать своё фото — выберите режим «на модели»."}
      </p>

      {project?.mode === "fashion" && (
        <label className="flex items-start gap-3 bg-surface border border-line rounded-[14px] p-4 mb-4 cursor-pointer">
          <input type="checkbox" checked={modelMode} onChange={(e) => setModelMode(e.target.checked)} className="mt-0.5 accent-[#b98a2f]" />
          <span>
            <span className="block text-[13.5px] font-semibold text-ink">Режим «на модели»</span>
            <span className="block text-[12.5px] text-ink-soft mt-0.5">Образ будет предложен на нейтральной модели — ваше фото не используется.</span>
          </span>
        </label>
      )}

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); }}
        className={cx(
          "border-2 border-dashed rounded-[18px] p-10 text-center transition-colors",
          dragOver ? "border-accent bg-honey/40" : "border-line bg-surface",
        )}
      >
        <Upload size={30} className="mx-auto text-accent-deep mb-3" />
        <p className="text-[14px] text-ink font-medium mb-1">Перетащите фото сюда или выберите файл</p>
        <p className="text-[12px] text-ink-mute mb-4">JPG, JPEG, PNG, WebP · до 15 МБ · от 1024 px по длинной стороне</p>
        <Btn variant="outline" onClick={() => inputRef.current?.click()}>Выбрать фото</Btn>
        <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])} />
        {/* быстрый доступ к камере на мобильных (iOS Safari / Android Chrome) */}
        {/Android|iPhone|iPad|iPod/i.test(navigator.userAgent ?? "") && (
          <div className="mt-3">
            <Btn variant="ghost" onClick={() => {
              const cam = document.createElement("input");
              cam.type = "file";
              cam.accept = "image/*";
              (cam as HTMLInputElement & { capture?: string }).capture = "environment";
              cam.onchange = () => handleFile(cam.files?.[0]);
              cam.click();
            }}><Camera size={15} /> Снять на камеру</Btn>
          </div>
        )}
      </div>

      {(status === "analyzing" || status === "clarifying") && project?.sourceImageId && !modelMode && (
        <div className="mt-6 flex items-center gap-4 bg-surface border border-line rounded-[14px] p-4">
          <img src={project.sourceImageId} alt="Загруженное фото" className="w-20 h-20 object-cover rounded-xl border border-line" />
          <div className="flex-1">
            <p className="text-[13.5px] font-semibold text-ink mb-1">
              {status === "analyzing" ? "Анализируем фото…" : "Фото принято"}
            </p>
            {status === "analyzing" && <div className="h-1.5 bg-line rounded-full overflow-hidden"><div className="h-full bg-accent animate-pulse w-2/3 rounded-full" /></div>}
          </div>
        </div>
      )}

      {/* предупреждения качества */}
      {qualityIssues.length > 0 && status !== "error" && (
        <div className="mt-4 space-y-2">
          {qualityIssues.map((i, k) => (
            <p key={k} className="flex items-start gap-2 text-[12.5px] text-warning bg-surface border border-line rounded-xl px-3.5 py-2.5">
              <Info size={14} className="mt-0.5 shrink-0" /> {i.message}
            </p>
          ))}
        </div>
      )}

      <p className="text-[11.5px] text-ink-mute mt-6 leading-relaxed">
        Фото используется только для создания дизайна и подбора товаров. Вы можете удалить проект в любой момент.{" "}
        <Link to="/legal/privacy" className="underline hover:text-ink">Подробнее о обработке данных</Link>
      </p>
    </div>
  );
}

/* ============================================================
   Экран ошибки
   ============================================================ */
function ErrorStep() {
  const error = useDesignerStore((s) => s.error);
  const dismiss = useDesignerStore((s) => s.dismissError);
  const back = useDesignerStore((s) => s.backToStart);
  return (
    <div className="max-w-[560px] mx-auto px-4 py-20 text-center">
      <p className="text-[44px] mb-3">📷</p>
      <h2 className="font-display font-bold text-[22px] text-ink mb-2">Что-то не так с фото</h2>
      <p className="text-[13.5px] text-ink-soft mb-6">{error || "Попробуйте загрузить изображение ещё раз."}</p>
      <div className="flex gap-3 justify-center">
        <Btn onClick={dismiss}>Загрузить другое фото</Btn>
        <Btn variant="ghost" onClick={back}>В начало</Btn>
      </div>
    </div>
  );
}

/* ============================================================
   Уточнения (clarifying) — не более трёх вопросов
   ============================================================ */
function ClarifyStep() {
  const questions = useDesignerStore((s) => s.questions);
  const answers = useDesignerStore((s) => s.answers);
  const setAnswers = useDesignerStore((s) => s.setAnswers);
  const generate = useDesignerStore((s) => s.generate);
  const analysis = useDesignerStore((s) => s.analysis);
  const project = useDesignerStore((s) => s.project);
  const lastNotion = useDesignerStore((s) => s.lastNotion);
  const freeText = project?.preferences.freeText || "";
  const isInterior = project?.mode === "interior";

  const toggle = (qid: string, opt: string, multi: boolean) => {
    const cur = answers[qid] || [];
    const next = multi
      ? (cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt])
      : [opt];
    setAnswers({ ...answers, [qid]: next });
  };

  return (
    <div className="max-w-[720px] mx-auto px-4 py-10">
      {analysis && (
        <div className="bg-surface border border-line rounded-[16px] p-5 mb-6">
          <h3 className="text-[13px] font-semibold text-ink mb-2 flex items-center gap-2"><ScanLine size={15} className="text-accent-deep" /> Что увидели на фото</h3>
          {isInterior ? (
            <p className="text-[13px] text-ink-soft leading-relaxed">
              Помещение: {(analysis as InteriorAnalysisResult).roomType === "living_room" ? "гостиная" : (analysis as InteriorAnalysisResult).roomType}.
              {" "}Освещённость: {{ low: "низкая", medium: "средняя", high: "высокая" }[(analysis as InteriorAnalysisResult).lighting]}.
              {" "}Сейчас — {(analysis as InteriorAnalysisResult).currentStyle}.
              {" "}Замене подлежат: {(analysis as InteriorAnalysisResult).replaceable.join(", ")}.
            </p>
          ) : (
            <p className="text-[13px] text-ink-soft leading-relaxed">
              Поза: {(analysis as FashionAnalysisResult).pose}, ракурс: {(analysis as FashionAnalysisResult).cameraAngle}.
              {" "}Текущий стиль: {(analysis as FashionAnalysisResult).currentStyle}.
              {(analysis as FashionAnalysisResult).tryOnLimitations.length > 0 && (" Ограничения: " + (analysis as FashionAnalysisResult).tryOnLimitations.join("; "))}
            </p>
          )}
        </div>
      )}

      {lastNotion && (
        <p className="flex items-start gap-2 text-[12.5px] text-warning bg-surface border border-line rounded-xl px-3.5 py-2.5 mb-5">
          <Info size={14} className="mt-0.5 shrink-0" /> {lastNotion}
        </p>
      )}

      <h2 className="font-display font-bold text-[24px] text-ink mb-1">Пара уточнений</h2>
      <p className="text-[13px] text-ink-soft mb-6">Три вопроса — и мы сформируем концепции именно под вас.</p>

      <div className="space-y-6">
        {questions.map((q: ClarifyingQuestion) => (
          <div key={q.id}>
            <p className="text-[13.5px] font-semibold text-ink mb-2.5">{q.title}</p>
            <div className="flex flex-wrap gap-2">
              {(q.options || []).map((o) => {
                const sel = (answers[q.id] || []).includes(o);
                return (
                  <button key={o} onClick={() => toggle(q.id, o, q.type === "multi_select")}
                    className={cx(
                      "px-3.5 py-2 rounded-full border text-[12.5px] transition-colors cursor-pointer inline-flex items-center gap-1.5",
                      sel ? "border-accent bg-honey text-ink font-medium" : "border-line text-ink-soft hover:border-ink-mute",
                    )}>
                    {sel && <Check size={13} />} {o}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div>
          <p className="text-[13.5px] font-semibold text-ink mb-2.5">Опишите пожелания своими словами</p>
          <textarea
            value={freeText}
            onChange={(e) => {
              const p = useDesignerStore.getState().project;
              if (!p) return;
              useDesignerStore.setState({ project: { ...p, preferences: { ...p.preferences, freeText: e.target.value } } });
            }}
            rows={3}
            placeholder={isInterior
              ? "Например: хочу больше света, тёплые оттенки и удобное место для чтения"
              : "Например: люблю спокойные тона, не ношу короткую длину, нужна удобная обувь"}
            className="w-full bg-surface border border-line rounded-[12px] px-4 py-3 text-[16px] md:text-[13.5px] text-ink placeholder:text-ink-mute focus:outline-none focus:border-accent resize-none"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mt-8">
        <Btn onClick={() => void generate()} disabled={!project?.sourceImageId && !project?.modelMode}>
          <Wand2 size={16} /> Показать три варианта
        </Btn>
        <Btn variant="ghost" onClick={() => void generate()}>Пропустить уточнения</Btn>
      </div>
    </div>
  );
}

/* ============================================================
   Генерация / статусы загрузки
   ============================================================ */
function BusyScreen({ label }: { label: string }) {
  return (
    <div className="max-w-[560px] mx-auto px-4 py-24 text-center">
      <div className="relative w-16 h-16 mx-auto mb-6">
        <div className="absolute inset-0 rounded-full border-2 border-line" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent animate-spin" />
        <Sparkles size={22} className="absolute inset-0 m-auto text-accent-deep" />
      </div>
      <p className="text-[15px] font-medium text-ink mb-1">{label}</p>
      <p className="text-[12.5px] text-ink-mute">Это займёт несколько секунд</p>
    </div>
  );
}

/* ============================================================
   Варианты (variants) + сравнение
   ============================================================ */
function VariantCard({ v, selected }: { v: DesignVariant; selected?: boolean }) {
  const select = useDesignerStore((s) => s.selectVariant);
  const generate = useDesignerStore((s) => s.generate);
  const compareIds = useDesignerStore((s) => s.compareIds);
  const toggleCompare = useDesignerStore((s) => s.toggleCompare);
  const inCompare = compareIds.includes(v.id);

  return (
    <div className={cx(
      "bg-surface border rounded-[18px] overflow-hidden flex flex-col transition-shadow",
      inCompare ? "border-accent shadow-lg" : "border-line",
    )}>
      <div className="relative aspect-[4/3] bg-pale">
        <img src={v.imageUrl} alt={v.title} className="w-full h-full object-cover" />
        <span className="absolute top-3 left-3"><Badge tone={v.intensity === "soft" ? "success" : v.intensity === "balanced" ? "honey" : "premium"}>
          {INTENSITY_LABEL_RU[v.intensity]}
        </Badge></span>
        <button title="Сравнить" onClick={() => toggleCompare(v.id)}
          className={cx("absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center border transition-colors cursor-pointer",
            inCompare ? "bg-accent text-cream border-accent" : "bg-cream/90 text-ink border-line hover:border-ink-mute")}>
          <GitCompareArrows size={15} />
        </button>
      </div>
      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-display font-bold text-[18px] text-ink mb-1.5">{v.title}</h3>
        <p className="text-[13px] text-ink-soft leading-relaxed mb-3">{v.description}</p>
        <ul className="space-y-1 mb-4">
          {v.changes.slice(0, 5).map((c) => (
            <li key={c} className="text-[12.5px] text-ink-soft flex items-start gap-1.5"><Check size={13} className="text-success mt-0.5 shrink-0" /> {c}</li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {v.conceptTags.map((t) => <span key={t} className="px-2 py-0.5 rounded-full bg-pale text-[11px] text-ink-soft">{t}</span>)}
        </div>
        <p className="text-[13px] font-semibold text-ink mt-auto mb-3">Бюджет: от {fmt(v.estimatedBudget.amount)}</p>
        <div className="flex gap-2">
          <Btn size="sm" onClick={() => void select(v.id)} className="flex-1">
            <ShoppingBag size={14} /> Выбрать и подобрать товары
          </Btn>
          <Btn size="sm" variant="ghost" title="Сделать похожий вариант" onClick={() => void generate({ similarTo: v.id })}>
            <RefreshCw size={14} />
          </Btn>
        </div>
        {selected && <p className="text-[11.5px] text-success mt-2">✓ Выбранный вариант</p>}
      </div>
    </div>
  );
}

function ComparePanel() {
  const project = useDesignerStore((s) => s.project);
  const compareIds = useDesignerStore((s) => s.compareIds);
  if (!project || compareIds.length !== 2) return null;
  const [a, b] = compareIds.map((id) => project.variants.find((v) => v.id === id)).filter(Boolean) as DesignVariant[];
  if (!a || !b) return null;
  const diff = a.estimatedBudget.amount - b.estimatedBudget.amount;
  const lines: string[] = [];
  if (diff !== 0) lines.push(diff < 0 ? `«${a.title}» дешевле на ${fmt(Math.abs(diff))}` : `«${b.title}» дешевле на ${fmt(Math.abs(diff))}`);
  const ca = a.changes.filter((x) => !b.changes.includes(x))[0];
  const cb = b.changes.filter((x) => !a.changes.includes(x))[0];
  if (ca) lines.push(`«${a.title}» добавляет: ${ca.toLowerCase()}`);
  if (cb) lines.push(`«${b.title}» использует: ${cb.toLowerCase()}`);
  return (
    <div className="mt-8 bg-surface border border-line rounded-[16px] p-5">
      <h3 className="text-[13.5px] font-semibold text-ink mb-3 flex items-center gap-2"><GitCompareArrows size={15} className="text-accent-deep" /> Сравнение вариантов</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        {[a, b].map((v) => (
          <div key={v.id}>
            <img src={v.imageUrl} alt={v.title} className="w-full aspect-video object-cover rounded-xl border border-line mb-2" />
            <p className="text-[13px] font-semibold text-ink">{v.title} · {fmt(v.estimatedBudget.amount)}</p>
          </div>
        ))}
      </div>
      <ul className="space-y-1">{lines.map((l) => <li key={l} className="text-[12.5px] text-ink-soft">• {l}</li>)}</ul>
    </div>
  );
}

function VariantsStep() {
  const project = useDesignerStore((s) => s.project);
  const generate = useDesignerStore((s) => s.generate);
  if (!project) return null;
  return (
    <div className="max-w-[1180px] mx-auto px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h2 className="font-display font-bold text-[26px] text-ink mb-1">
            {project.mode === "interior" ? "Три варианта вашего интерьера" : "Три ваших образа"}
          </h2>
          <p className="text-[13px] text-ink-soft">
            {project.mode === "interior"
              ? "Планировка, окна и двери сохранены во всех вариантах."
              : "Идентичность, лицо и пропорции сохранены во всех вариантах."}
          </p>
        </div>
        <div className="flex gap-2">
          <Btn size="sm" variant="outline" onClick={() => void generate({ resetSeed: true })}><RefreshCw size={14} /> Сгенерировать заново</Btn>
          <Btn size="sm" variant="ghost" onClick={() => useDesignerStore.setState({ status: "clarifying" })}>Изменить параметры</Btn>
          <Btn size="sm" variant="ghost" onClick={() => useDesignerStore.getState().saveProject()}><Save size={14} /> Сохранить проект</Btn>
        </div>
      </div>
      {/* ТЗ 8.5/8.6: мобильные — 1 колонка, планшет — 2, десктоп — 3, 3xl+ — 4 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 3xl:grid-cols-4 gap-5">
        {project.variants.map((v) => <VariantCard key={v.id} v={v} selected={project.selectedVariantId === v.id} />)}
      </div>
      <ComparePanel />
    </div>
  );
}

/* ============================================================
   Shoppable-результат (shopping)
   ============================================================ */
function ObjectMarker({ obj, active, onClick }: { obj: DesignObject; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={obj.label}
      style={{ left: `${obj.bbox.x + obj.bbox.w / 2}%`, top: `${obj.bbox.y + obj.bbox.h / 2}%` }}
      className={cx(
        "ai-marker absolute -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all z-10",
        active ? "bg-accent border-accent scale-110" : "bg-cream/90 border-accent hover:scale-110",
      )}
    >
      <span className={cx("w-2 h-2 rounded-full", active ? "bg-cream" : "bg-accent-deep")} />
      {active && <span className="absolute inset-0 rounded-full animate-ping bg-accent/40 -z-10" />}
    </button>
  );
}

function MiniProductCard({ m, obj }: { m: ProductMatch; obj: DesignObject }) {
  const addOne = useDesignerStore((s) => s.addOneToCart);
  const replaceProduct = useDesignerStore((s) => s.replaceProduct);
  const [showAlts, setShowAlts] = useState(false);
  const availRu = { in_stock: "В наличии", low_stock: "Мало", out_of_stock: "Нет в наличии" }[m.availability];
  return (
    <div className="bg-surface border border-line rounded-[14px] p-4">
      <div className="flex gap-3">
        <div className="w-16 h-16 rounded-xl bg-pale overflow-hidden shrink-0 border border-line">
          {m.imageUrl ? <img src={m.imageUrl} alt={m.title} className="w-full h-full object-cover" />
            : <span className="flex items-center justify-center h-full text-[20px]">🛍️</span>}
        </div>
        <div className="flex-1 min-w-0">
          <Link to={`/product/${m.productId}`} className="text-[13.5px] font-semibold text-ink hover:text-accent-deep line-clamp-1">{m.title}</Link>
          <p className="text-[12px] text-ink-mute mb-1">{m.brand || "Авторский товар"}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14px] font-bold text-ink">{fmt(m.price.amount)}</span>
            {m.rating ? <Rating value={m.rating} size={11} /> : null}
            <span className={cx("text-[11px]", m.availability === "out_of_stock" ? "text-error" : "text-success")}>{availRu}</span>
          </div>
        </div>
      </div>
      <ul className="mt-3 space-y-1">
        {m.matchReasons.slice(0, 2).map((r) => (
          <li key={r} className="text-[11.5px] text-ink-soft flex items-start gap-1.5"><Info size={12} className="mt-0.5 shrink-0 text-accent-deep" /> {r}</li>
        ))}
      </ul>
      <div className="flex gap-2 mt-3">
        <Btn size="sm" disabled={m.availability === "out_of_stock"} onClick={() => addOne(m.productId)}>
          <ShoppingBag size={13} /> В корзину
        </Btn>
        <Btn size="sm" variant="outline" onClick={() => setShowAlts((v) => !v)}>
          <Replace size={13} /> {showAlts ? "Скрыть альтернативы" : "Заменить"}
        </Btn>
      </div>
      {showAlts && (
        <div className="mt-3 border-t border-line pt-3 space-y-2 max-h-[260px] overflow-auto pr-1">
          <p className="text-[11.5px] font-semibold text-ink-mute uppercase tracking-wide">Альтернативы · «Примерить в дизайне»</p>
          {obj.productMatches.filter((x) => x.productId !== m.productId).slice(0, 6).map((alt) => (
            <div key={alt.productId} className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-lg bg-pale overflow-hidden shrink-0 border border-line">
                {alt.imageUrl ? <img src={alt.imageUrl} alt="" className="w-full h-full object-cover" /> : <span className="flex items-center justify-center h-full text-[14px]">🛍️</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-ink line-clamp-1">{alt.title}</p>
                <p className="text-[11px] text-ink-mute">{fmt(alt.price.amount)} · совпадение {alt.matchScore}%</p>
              </div>
              <Btn size="sm" variant="ghost" onClick={() => { replaceProduct(obj.id, alt.productId); setShowAlts(false); }}>
                Примерить
              </Btn>
            </div>
          ))}
          {obj.productMatches.filter((x) => x.productId !== m.productId).length === 0 && (
            <p className="text-[12px] text-ink-mute">В каталоге нет подходящих альтернатив. Попробуйте изменить бюджет или стиль в параметрах.</p>
          )}
        </div>
      )}
    </div>
  );
}

const EDIT_PRESETS: Record<"interior" | "fashion", string[]> = {
  interior: ["Сделай комнату светлее", "Замени диван на более компактный", "Добавь больше хранения", "Сделай палитру теплее", "Убери ковёр", "Добавь настольную лампу"],
  fashion: ["Сделай образ более вечерним", "Замени кроссовки на лоферы", "Добавь верхнюю одежду", "Сделай образ более сдержанным", "Подбери сумку в тон обуви"],
};

function ShoppingStep() {
  const project = useDesignerStore((s) => s.project);
  const editNote = useDesignerStore((s) => s.editNote);
  const editObject = useDesignerStore((s) => s.editObject);
  const removeProduct = useDesignerStore((s) => s.removeProduct);
  const saveProject = useDesignerStore((s) => s.saveProject);
  const addAllToCart = useDesignerStore((s) => s.addAllToCart);
  const [activeObj, setActiveObj] = useState<string | null>(null);
  const [menuObj, setMenuObj] = useState<string | null>(null);
  const [cmd, setCmd] = useState("");
  const [unavailPrompt, setUnavailPrompt] = useState<number | null>(null);

  if (!project?.selectedVariantId) return null;
  const variant = project.variants.find((v) => v.id === project.selectedVariantId);
  if (!variant) return null;
  const groups = project.mode === "interior" ? INTERIOR_GROUPS : FASHION_GROUPS;
  const activeObject = variant.objects.find((o) => o.id === activeObj) || null;
  const selectedMatch = (o: DesignObject) => o.productMatches.find((m) => m.productId === o.selectedProductId) || o.productMatches[0];
  const total = project.shoppingSet?.totalPrice.amount || 0;

  const tryAddAll = () => {
    const unavailable = (project.shoppingSet?.totalItemsCount || 0) - (project.shoppingSet?.availableItemsCount || 0);
    if (unavailable > 0 && unavailPrompt === null) { setUnavailPrompt(unavailable); return; }
    addAllToCart();
    setUnavailPrompt(null);
  };

  return (
    <div className="max-w-[1180px] mx-auto px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <button onClick={() => useDesignerStore.setState({ status: "variants" })} className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-soft hover:text-ink mb-2 cursor-pointer">
            <ChevronLeft size={14} /> К списку вариантов
          </button>
          <h2 className="font-display font-bold text-[24px] text-ink">{variant.title}</h2>
          <p className="text-[13px] text-ink-soft">{variant.description}</p>
        </div>
        <Badge tone="ai">{project.mode === "interior" ? "Shoppable-интерьер" : "Shoppable-образ"}</Badge>
      </div>

      {editNote && (
        <p className="mb-4 flex items-start gap-2 text-[12.5px] text-success bg-surface border border-line rounded-xl px-3.5 py-2.5">
          <Check size={14} className="mt-0.5 shrink-0" /> {editNote}
        </p>
      )}

      <div className="grid lg:grid-cols-[1fr_400px] gap-6 items-start">
        {/* изображение с маркерами */}
        <div>
          <div className="relative rounded-[18px] overflow-hidden border border-line bg-pale aspect-[4/3]">
            <img src={variant.imageUrl || project.sourceImageId} alt="Результат дизайна" className="w-full h-full object-cover" />
            {variant.objects.map((o) => (
              <ObjectMarker key={o.id} obj={o} active={activeObj === o.id}
                onClick={() => { setActiveObj(o.id); setMenuObj(o.id); }} />
            ))}
          </div>

          {/* мини-карточка выбранного объекта */}
          {activeObject && (
            <div className="mt-4">
              <MiniProductCard m={selectedMatch(activeObject)} obj={activeObject} />
            </div>
          )}

          {/* точечное редактирование */}
          <div className="mt-5 bg-surface border border-line rounded-[16px] p-4">
            <p className="text-[13px] font-semibold text-ink mb-2.5">Точечное редактирование</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {EDIT_PRESETS[project.mode].map((c) => (
                <button key={c} onClick={() => setCmd(c)}
                  className={cx("px-3 py-1.5 rounded-full border text-[12px] cursor-pointer transition-colors",
                    cmd === c ? "border-accent bg-honey text-ink" : "border-line text-ink-soft hover:border-ink-mute")}>
                  {c}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={cmd} onChange={(e) => setCmd(e.target.value)} placeholder="Например: сделай палитру теплее" enterKeyHint="send"
                className="flex-1 min-w-0 bg-cream border border-line rounded-[10px] px-3.5 py-2.5 text-[16px] md:text-[13px] text-ink placeholder:text-ink-mute focus:outline-none focus:border-accent" />
              <Btn size="md" disabled={!cmd.trim()} onClick={() => { void editObject(activeObj || menuObj || undefined, cmd.trim()); setCmd(""); }}>
                <Wand2 size={14} /> Применить
              </Btn>
            </div>
            <p className="text-[11px] text-ink-mute mt-2">Локальное изменение: остальной дизайн остаётся без изменений.</p>
          </div>
        </div>

        {/* панель состава */}
        <aside className="bg-surface border border-line rounded-[18px] p-5 lg:sticky lg:top-24">
          <h3 className="font-display font-bold text-[17px] text-ink mb-4">
            {project.mode === "interior" ? "Состав интерьера" : "Состав образа"}
          </h3>
          <div className="space-y-5 max-h-[52vh] overflow-auto pr-1 mb-5">
            {groups.map((g) => {
              const objs = variant.objects.filter((o) => g.cats.includes(o.category));
              if (!objs.length) return null;
              return (
                <div key={g.title}>
                  <p className="text-[11.5px] font-semibold text-ink-mute uppercase tracking-[0.1em] mb-2">{g.title}</p>
                  <div className="space-y-2.5">
                    {objs.map((o) => {
                      const m = selectedMatch(o);
                      if (!m) return null;
                      return (
                        <div key={o.id} className={cx("flex items-center gap-2.5 rounded-xl border p-2 cursor-pointer transition-colors",
                          activeObj === o.id ? "border-accent bg-honey/40" : "border-line hover:border-ink-mute")}
                          onClick={() => setActiveObj(o.id)}>
                          <div className="w-11 h-11 rounded-lg bg-pale overflow-hidden shrink-0 border border-line">
                            {m.imageUrl ? <img src={m.imageUrl} alt="" className="w-full h-full object-cover" /> : <span className="flex items-center justify-center h-full text-[15px]">🛍️</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12.5px] font-medium text-ink line-clamp-1">{m.title}</p>
                            <p className="text-[11px] text-ink-mute">{CATEGORY_LABELS_RU[o.category]} · {fmt(m.price.amount)}</p>
                          </div>
                          <button title="Убрать объект" onClick={(e) => { e.stopPropagation(); removeProduct(o.id); }}
                            className="w-7 h-7 rounded-full flex items-center justify-center text-ink-mute hover:text-error hover:bg-pale cursor-pointer">
                            <X size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="border-t border-line pt-4">
            <div className="flex items-baseline justify-between mb-3">
              <span className="text-[13px] text-ink-soft">Итого:</span>
              <span className="font-display font-bold text-[20px] text-ink">{fmt(total)}</span>
            </div>
            {unavailPrompt !== null && (
              <p className="text-[12px] text-warning mb-3">
                {unavailPrompt} из {project.shoppingSet?.totalItemsCount} товаров недоступны. Добавить доступные?
              </p>
            )}
            <div className="grid gap-2">
              <Btn onClick={tryAddAll}><ShoppingBag size={15} /> {unavailPrompt !== null ? "Добавить доступные" : "Добавить всё в корзину"}</Btn>
              <Link to="/cart" className="text-center text-[12.5px] text-accent-deep hover:underline mt-1">Перейти в корзину</Link>
              <button onClick={saveProject} className="text-[12.5px] text-ink-soft hover:text-ink text-center cursor-pointer">Сохранить комплект как проект</button>
            </div>
          </div>
        </aside>
      </div>

      {/* контекстное меню объекта (моб./клик по маркеру) */}
      {menuObj && (() => {
        const o = variant.objects.find((x) => x.id === menuObj);
        if (!o) return null;
        return (
          <div className="floating-bottom fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-cream border border-line rounded-[16px] shadow-xl px-4 py-3 flex items-center gap-3 max-w-[92vw]">
            <span className="text-[12.5px] font-semibold text-ink">{o.label}</span>
            <button onClick={() => { setActiveObj(o.id); setMenuObj(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              className="text-[12px] text-accent-deep hover:underline cursor-pointer">Товар и замена ↑</button>
            {o.isRemovable && (
              <button onClick={() => { removeProduct(o.id); setMenuObj(null); }}
                className="text-[12px] text-error hover:underline cursor-pointer">Убрать объект</button>
            )}
            <button onClick={() => setMenuObj(null)} className="text-ink-mute hover:text-ink cursor-pointer"><X size={14} /></button>
          </div>
        );
      })()}
    </div>
  );
}

/* ============================================================
   Страница /ai-designer
   ============================================================ */
export default function AiDesignerPage() {
  const status = useDesignerStore((s) => s.status);
  const busyLabel = useDesignerStore((s) => s.busyLabel);
  const project = useDesignerStore((s) => s.project);

  /* фиксируем пользователя для приватности проектов */
  useEffect(() => {
    import("../../lib/store").then(({ useAppStore }) => {
      const uid = useAppStore.getState().session?.userId || "guest";
      const p = useDesignerStore.getState().project;
      if (p && p.userId !== uid) useDesignerStore.setState({ project: { ...p, userId: uid } });
    });
  }, []);

  return (
    <div className="pb-16">
      {(!project || status === "idle") && <IdleScreen />}
      {(status === "uploading" || status === "error" && !useDesignerStore.getState().error) && <UploadStep />}
      {status === "error" && <ErrorStep />}
      {status === "analyzing" && <BusyScreen label={busyLabel || "Анализируем фото…"} />}
      {status === "clarifying" && <ClarifyStep />}
      {(status === "generating" || status === "grounding" || status === "editing") &&
        <BusyScreen label={busyLabel || (status === "grounding" ? "Подбираем товары из каталога…" : status === "editing" ? "Применяем изменение…" : "Формируем концепции…")} />}
      {(status === "variants" || status === "saved") && <VariantsStep />}
      {status === "shopping" && <ShoppingStep />}
    </div>
  );
}
