import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BarChart3, FileSpreadsheet, Globe2, Send, Sparkles, Trophy, Upload, Users, Vip, FlaskConical, Briefcase, Headphones, Megaphone, CheckCircle2, Lock } from "lucide-react";
import { Badge, Btn, Modal } from "./ui";
import { CATEGORIES } from "../data/seed";
import { useAppStore } from "../lib/store";
import { useSellerAccount, SELLER_PLANS, sellerPlanById, type SellerLegalType } from "../lib/seller";
import { useSubStore } from "../lib/subscriptions";
import {
  useSellerFeatures, useBuyerFeatures, useWeeklyReport, useAbTests, useCurator, usePremiumSales,
  useCuratorPicks, thisWeekPicks, useManagerLine, useTopSlots, usePromoBookings, useSellerSite,
  runImport, fetchSegments, sendNewsletter, buildCustomTable, tableToCsv, downloadText,
  REPORT_DIMENSIONS, MEDIA_KIT, PROMO_MONTHLY_LIMIT, COHORT_LABEL, dropProducts,
  type CohortName, type ReportDim, type ImportResult,
} from "../lib/premium";

/* ============================================================
   ЭТАП 5 (§5.1–§5.6): ПРЕМИУМ-БЛОКИ В UI
   Каждый блок гейтится серверной сеткой возможностей
   (sellerFeaturesOf / buyerFeaturesOf — порт 1:1 server/tariffs.cjs).
   Для пользователей ниже тарифа — заглушка «Доступно на тарифе X».
   ============================================================ */

/** Минимальный тариф линейки, открывающий фичу (для заглушки). */
const FEATURE_MIN_PLAN: Record<string, [SellerLegalType, string][]> = {
  weeklyReport: [["self_employed", "profi"], ["ip", "business-premium"], ["ooo", "corp-pro"]],
  curatorPicks: [["self_employed", "top"]],
  masterSite: [["self_employed", "top"]],
  abTest: [["ip", "business-premium"], ["self_employed", "top"], ["ooo", "corp-premium"]],
  b2bClosed: [["self_employed", "profi"], ["ip", "business-premium"], ["ooo", "corp-pro"]],
  managerLine: [["ip", "business-premium"]],
  roundTheClock: [["ooo", "corp-premium"]],
  importFile: [["ooo", "corp"], ["self_employed", "profi"]],
  brandStore: [["ooo", "corp"]],
  segmentation: [["self_employed", "profi"], ["ooo", "corp-pro"]],
  customReports: [["ooo", "corp-premium"]],
  whiteLabel: [["ip", "business-premium"], ["ooo", "corp-premium"]],
  topPositions: [["ooo", "corp-premium"]],
  promoMailout: [["ooo", "corp-premium"]],
};
function minPlanLabel(feature: keyof typeof FEATURE_MIN_PLAN): string {
  const list = FEATURE_MIN_PLAN[feature] || [];
  return list.map(([t, p]) => {
    const plan = sellerPlanById(t, p);
    const typeName = t === "self_employed" ? "Самозанятый" : t === "ip" ? "ИП" : "ООО";
    return `${typeName} «${plan?.name || p}»`;
  }).join(" · ") || "более высокого тарифа";
}

function LockedStub({ feature }: { feature: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-surface p-6 flex items-center gap-4">
      <span className="w-10 h-10 rounded-[10px] bg-line-soft flex items-center justify-center shrink-0"><Lock size={17} className="text-ink-mute" /></span>
      <div className="flex-1">
        <p className="text-[14px] font-bold text-ink">Доступно на тарифе {minPlanLabel(feature as any)}</p>
        <p className="text-[12.5px] text-ink-soft mt-0.5">Улучшите тариф, чтобы разблокировать функцию.</p>
      </div>
      <Link to="/plans"><Btn variant="dark" className="h-10 px-5">Смотреть тарифы</Btn></Link>
    </div>
  );
}

function Card({ icon, title, children, tag }: { icon: React.ReactNode; title: string; children: React.ReactNode; tag?: string }) {
  return (
    <section className="bg-surface rounded-2xl shadow-card border border-line-soft p-6">
      <header className="flex items-center gap-3 mb-4">
        <span className="w-9 h-9 rounded-[10px] bg-dark text-cream flex items-center justify-center">{icon}</span>
        <h3 className="font-display font-bold text-[16px] text-ink flex-1">{title}</h3>
        {tag && <Badge tone="accent">{tag}</Badge>}
      </header>
      {children}
    </section>
  );
}

/* ---------- §5.2 Еженедельный отчёт агента ---------- */
export function WeeklyReportBlock() {
  const f = useSellerFeatures();
  if (!f.weeklyReport) return <LockedStub feature="weeklyReport" />;
  return <WeeklyReportInner />;
}
function WeeklyReportInner() {
  const uid = useAppStore((s) => s.session?.userId || "guest");
  const generate = useWeeklyReport((s) => s.generate);
  const stored = useWeeklyReport((s) => s.reports[uid]);
  const [rep, setRep] = useState<any>(stored || null);
  const [loading, setLoading] = useState(false);
  const view = async () => { setLoading(true); const r = await generate(uid); setRep(r); setLoading(false); };
  return (
    <Card icon={<BarChart3 size={17} />} title="Еженедельный отчёт агента" tag={rep?.week}>
      {!rep && <p className="text-[13px] text-ink-soft mb-3">Авто-отчёт: рекомендации по ценам, топ товаров и прогноз продаж за неделю.</p>}
      <Btn variant="dark" className="h-10 px-5" disabled={loading} onClick={view}>{loading ? "Генерация…" : rep ? "Обновить отчёт" : "Смотреть отчёт"}</Btn>
      {rep && (
        <div className="mt-4 space-y-3">
          <div>
            <p className="text-[12px] font-bold text-ink-mute uppercase mb-1.5">Топ товаров</p>
            {rep.topProducts.map((p: any) => (
              <div key={p.id} className="flex justify-between text-[13px] py-1 border-b border-line-soft last:border-0">
                <span className="text-ink">{p.name}</span><span className="text-ink-mute">{p.views} просмотров · {p.price.toLocaleString("ru-RU")} ₽</span>
              </div>
            ))}
          </div>
          <div>
            <p className="text-[12px] font-bold text-ink-mute uppercase mb-1.5">Рекомендации по ценам</p>
            {rep.priceRecommendations.map((r: any, i: number) => (
              <p key={i} className="text-[13px] text-ink-soft py-0.5">• {r.action === "recommend_price_up" ? `Поднять цену на ${r.delta_pct}%` : "Обновить обложку"} — {r.reason}</p>
            ))}
          </div>
          <p className="text-[13px] text-ink"><strong>Прогноз продаж:</strong> ~{rep.salesForecast.nextWeekUnits} шт. на след. неделю ({rep.salesForecast.basis})</p>
        </div>
      )}
    </Card>
  );
}

/* ---------- §5.2 Персональные подборки кураторов ---------- */
export function CuratorPicksBlock() {
  const f = useSellerFeatures();
  if (!f.curatorPicks) return <LockedStub feature="curatorPicks" />;
  return <CuratorPicksInner />;
}
function CuratorPicksInner() {
  const products = useSellerAccount((s) => s.products).filter((p) => !p.archived && !p.isDraft);
  const publishPick = useCuratorPicks((s) => s.publishPick);
  const myPicks = useCuratorPicks((s) => s.sets);
  const uid = useAppStore((s) => s.session?.userId || "guest");
  const [sel, setSel] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);
  return (
    <Card icon={<Sparkles size={17} />} title="Персональные подборки кураторов" tag="витрина премиум-покупателям">
      <p className="text-[13px] text-ink-soft mb-3">Отберите до 6 товаров — еженедельная подборка уйдёт в закрытую витрину премиум-покупателей.</p>
      <div className="flex flex-wrap gap-2 mb-3 max-h-32 overflow-auto">
        {products.slice(0, 24).map((p) => (
          <button key={p.id} onClick={() => setSel((s) => (s.includes(p.id) ? s.filter((x) => x !== p.id) : s.length < 6 ? [...s, p.id] : s))}
            className={`px-3 py-1.5 rounded-[8px] text-[12px] font-semibold cursor-pointer ${sel.includes(p.id) ? "bg-dark text-cream" : "bg-line-soft text-ink-soft hover:bg-line"}`}>{p.name}</button>
        ))}
      </div>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Комментарий куратора (необязательно)" className="w-full h-10 px-3 rounded-[10px] border border-line text-[13px] mb-3" />
      <Btn variant="primary" className="h-10 px-5" disabled={!sel.length} onClick={() => { if (publishPick(sel, note)) setDone(true); }}>Опубликовать подборку</Btn>
      {done && <p className="text-[12.5px] text-success mt-2 flex items-center gap-1"><CheckCircle2 size={13} /> Подборка недели опубликована.</p>}
      <div className="mt-3 text-[12.5px] text-ink-mute">Активных подборок этой недели: {thisWeekPicks().length} · ваших: {myPicks.filter((x) => x.sellerUid === uid).length}</div>
    </Card>
  );
}

/* ---------- §5.3 A/B-тестирование карточек ---------- */
export function AbTestBlock() {
  const f = useSellerFeatures();
  if (!f.abTest) return <LockedStub feature="abTest" />;
  return <AbTestInner />;
}
function AbTestInner() {
  const products = useSellerAccount((s) => s.products).filter((p) => !p.archived && !p.isDraft);
  const tests = useAbTests((s) => s.tests);
  const start = useAbTests((s) => s.start);
  const finalizeDue = useAbTests((s) => s.finalizeDue);
  useEffect(() => { finalizeDue(); const id = setInterval(finalizeDue, 60000); return () => clearInterval(id); }, []);
  const [pid, setPid] = useState(products[0]?.id || "");
  const [a, setA] = useState(""); const [b, setB] = useState("");
  const conv = (m: { views: number; conversions: number }) => (m.views ? ((m.conversions / m.views) * 100).toFixed(1) + "%" : "—");
  return (
    <Card icon={<FlaskConical size={17} />} title="A/B-тестирование карточек" tag="замер 14 дней">
      <div className="grid sm:grid-cols-3 gap-2 mb-3">
        <select value={pid} onChange={(e) => setPid(e.target.value)} className="h-10 px-3 rounded-[10px] border border-line text-[13px] bg-surface">
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input value={a} onChange={(e) => setA(e.target.value)} placeholder="Вариант A (описание/обложка)" className="h-10 px-3 rounded-[10px] border border-line text-[13px]" />
        <input value={b} onChange={(e) => setB(e.target.value)} placeholder="Вариант B" className="h-10 px-3 rounded-[10px] border border-line text-[13px]" />
      </div>
      <Btn variant="dark" className="h-10 px-5" disabled={!pid || !a || !b} onClick={() => { start(pid, a, b); setA(""); setB(""); }}>Запустить тест</Btn>
      {tests.length > 0 && (
        <div className="mt-4 space-y-2">
          {tests.map((t) => (
            <div key={t.id} className="border border-line-soft rounded-xl p-3 text-[12.5px]">
              <div className="flex justify-between font-semibold text-ink"><span>{products.find((p) => p.id === t.productId)?.name || t.productId}</span>
                <Badge tone={t.status === "running" ? "accent" : "success"}>{t.status === "running" ? "идёт" : `победил ${t.winner?.toUpperCase()} (+${t.liftPct}%)`}</Badge></div>
              <div className="text-ink-soft mt-1 grid grid-cols-2 gap-2">
                <span>A: {conv(t.metrics.a)} ({t.metrics.a.views} просм.)</span><span>B: {conv(t.metrics.b)} ({t.metrics.b.views} просм.)</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ---------- §5.3/§5.5 Закрытые B2B-заказы и тендеры ---------- */
export function B2bOrdersBlock() {
  const f = useSellerFeatures();
  if (!f.b2bClosed) return <LockedStub feature="b2bClosed" />;
  return <B2bInner />;
}
function B2bInner() {
  const [orders, setOrders] = useState<any[] | null>(null);
  useEffect(() => {
    fetch("/api/b2b/closed-orders", { credentials: "include" })
      .then((r) => r.ok ? r.json() : { ok: false, orders: [] })
      .then((d) => setOrders(d.orders || d.closed_orders || []))
      .catch(() => setOrders([]));
  }, []);
  return (
    <Card icon={<Briefcase size={17} />} title="Закрытые заказы от бизнеса" tag="только для вашего тарифа">
      {orders === null && <p className="text-[13px] text-ink-mute">Загрузка…</p>}
      {orders && orders.length === 0 && <p className="text-[13px] text-ink-soft">Новых закрытых заказов пока нет — как только бизнес разместит корпоративный тендер, он появится здесь раньше публичной биржи.</p>}
      {orders?.map((o: any) => (
        <div key={o.id} className="border-b border-line-soft py-2 last:border-0 text-[13px] flex justify-between">
          <span className="text-ink">{o.title}</span><span className="text-ink-mute">{Number(o.budget || 0).toLocaleString("ru-RU")} ₽ · {o.company || "бизнес"}</span>
        </div>
      ))}
    </Card>
  );
}

/* ---------- §5.3/§5.6 Менеджерская линия / 24/7 ---------- */
export function ManagerLineBlock() {
  const f = useSellerFeatures();
  if (!(f.managerLine || f.roundTheClock)) return <LockedStub feature={f.customReports ? "roundTheClock" : "managerLine"} />;
  return <ManagerInner roundTheClock={f.roundTheClock} />;
}
function ManagerInner({ roundTheClock }: { roundTheClock: boolean }) {
  const tickets = useManagerLine((s) => s.tickets);
  const request = useManagerLine((s) => s.request);
  const [msg, setMsg] = useState("");
  return (
    <Card icon={<Headphones size={17} />} title={roundTheClock ? "Менеджер 24/7" : "Персональный менеджер"} tag={roundTheClock ? "реакция ≤ 15 мин" : "ответ ≤ 2 ч"}>
      <div className="flex gap-2">
        <input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={roundTheClock ? "Круглосучная линия — напишите вопрос" : "Вопрос менеджеру (рабочее время 10:00–19:00 МСК)"} className="flex-1 h-10 px-3 rounded-[10px] border border-line text-[13px]" />
        <Btn variant="dark" className="h-10 px-4" disabled={!msg.trim()} onClick={() => { void request(msg.trim()); setMsg(""); }}>Отправить</Btn>
      </div>
      {tickets.map((t) => (
        <div key={t.id} className="mt-2 border border-line-soft rounded-xl p-3 text-[12.5px]">
          <div className="flex justify-between"><span className="text-ink font-semibold">{t.message.slice(0, 60)}</span><Badge tone={t.status === "open" ? "accent" : "success"}>{t.status === "open" ? "SLA " + t.slaText : "отвечено"}</Badge></div>
          {t.answer && <p className="text-ink-soft mt-1">{t.answer}</p>}
        </div>
      ))}
    </Card>
  );
}

/* ---------- §5.4 Импорт товаров из CSV ---------- */
export function ImportBlock() {
  const f = useSellerFeatures();
  if (!f.importFile) return <LockedStub feature="importFile" />;
  return <ImportInner />;
}
function ImportInner() {
  const [res, setRes] = useState<ImportResult | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const onFile = async (file?: File) => {
    if (!file) return;
    setBusy(true); setErr(""); setRes(null);
    const text = await file.text();
    const r = await runImport(text);
    setBusy(false);
    if (r.ok && r.result) setRes(r.result); else setErr(r.error || "Ошибка импорта");
  };
  return (
    <Card icon={<Upload size={17} />} title="Импорт товаров из файла" tag="CSV с валидацией">
      <p className="text-[12.5px] text-ink-mute mb-2">Шаблон: name, category, price, stock, material, description. Построчный отчёт об ошибках; лимит товаров тарифа учитывается на сервере.</p>
      <label className="inline-flex items-center gap-2 h-10 px-5 rounded-[10px] bg-dark text-cream text-[13px] font-bold cursor-pointer hover:bg-dark-deep">
        <Upload size={15} /> {busy ? "Импорт…" : "Выбрать CSV"}
        <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
      </label>
      {err && <p className="text-[12.5px] text-danger mt-2">{err}</p>}
      {res && (
        <div className="mt-3 text-[12.5px]">
          <p className="text-ink font-semibold">Строк: {res.totalLines} · импортировано: <span className="text-success">{res.imported}</span> · с ошибками: <span className="text-danger">{res.rejected}</span>{res.overLimit ? <> · сверх лимита: <span className="text-warning">{res.overLimit}</span></> : null}</p>
          <div className="max-h-40 overflow-auto mt-2 border border-line-soft rounded-xl">
            {res.rows.filter((r) => !r.ok).map((r) => (
              <div key={r.line} className="px-3 py-1.5 border-b border-line-soft last:border-0 text-danger">Строка {r.line}: {r.errors?.join(", ")}</div>
            ))}
            {res.rows.every((r) => r.ok) && <div className="px-3 py-2 text-success">Все строки прошли валидацию ✓</div>}
          </div>
        </div>
      )}
    </Card>
  );
}

/* ---------- §5.4 Бренд-витрина ---------- */
export function BrandStoreBlock() {
  const f = useSellerFeatures();
  if (!f.brandStore) return <LockedStub feature="brandStore" />;
  return <BrandStoreInner />;
}
function BrandStoreInner() {
  const uid = useAppStore((s) => s.session?.userId || "guest");
  const site = useSellerSite((s) => s.sites[uid]);
  const activate = useSellerSite((s) => s.activate);
  const [slug, setSlug] = useState(site?.url ? site.url.split(".")[0].replace("https://", "") : "");
  const [saved, setSaved] = useState(false);
  return (
    <Card icon={<Globe2 size={17} />} title="Бренд-витрина" tag="логотип, обложка, адрес">
      <p className="text-[13px] text-ink-soft mb-3">Собственный адрес магазина на платформе с логотипом и обложкой бренда.</p>
      <div className="flex gap-2">
        <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="адрес: shop-brand.quantiform.ru" className="flex-1 h-10 px-3 rounded-[10px] border border-line text-[13px]" />
        <Btn variant="dark" className="h-10 px-4" disabled={!slug.trim()} onClick={() => { void activate({ subdomain: slug }); setSaved(true); }}>Сохранить</Btn>
      </div>
      {site && <p className="text-[12.5px] text-success mt-2 flex items-center gap-1"><CheckCircle2 size={13} /> Витрина активна: <strong>{site.url}</strong></p>}
      {saved && !site && <p className="text-[12.5px] text-ink-mute mt-2">Сохранено локально (демо-режим без сервера).</p>}
    </Card>
  );
}

/* ---------- §5.5 Сегментация клиентов ---------- */
export function SegmentsBlock() {
  const f = useSellerFeatures();
  if (!f.segmentation) return <LockedStub feature="segmentation" />;
  return <SegmentsInner />;
}
function SegmentsInner() {
  const [seg, setSeg] = useState<any>(null);
  const [cohort, setCohort] = useState<CohortName>("repeat");
  const [subject, setSubject] = useState("");
  const [sent, setSent] = useState(false);
  useEffect(() => { void fetchSegments().then(setSeg); }, []);
  return (
    <Card icon={<Users size={17} />} title="Сегментация клиентов" tag="когорты + рассылки">
      {seg ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {(Object.keys(COHORT_LABEL) as CohortName[]).map((c) => (
            <button key={c} onClick={() => setCohort(c)} className={`rounded-xl p-3 text-left cursor-pointer border ${cohort === c ? "border-accent bg-accent/10" : "border-line-soft bg-surface hover:bg-line-soft"}`}>
              <p className="text-[18px] font-extrabold text-ink">{seg.cohorts[c]}</p>
              <p className="text-[11.5px] text-ink-mute">{COHORT_LABEL[c]}</p>
            </button>
          ))}
        </div>
      ) : <p className="text-[13px] text-ink-mute mb-3">Расчёт когорт…</p>}
      <div className="flex gap-2">
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Тема рассылки внутри платформы" className="flex-1 h-10 px-3 rounded-[10px] border border-line text-[13px]" />
        <Btn variant="primary" className="h-10 px-4" disabled={!subject.trim() || !seg} onClick={() => { void sendNewsletter(cohort, subject.trim()); setSent(true); }}><Send size={14} className="mr-1" />Разослать</Btn>
      </div>
      {sent && <p className="text-[12.5px] text-success mt-2">Кампания запланирована для когорты «{COHORT_LABEL[cohort]}».</p>}
    </Card>
  );
}

/* ---------- §5.6 Кастомные отчёты ---------- */
export function CustomReportsBlock() {
  const f = useSellerFeatures();
  if (!f.customReports) return <LockedStub feature="customReports" />;
  const [dims, setDims] = useState<ReportDim[]>(["date", "product", "revenue"]);
  const table = useMemo(() => buildCustomTable(dims), [dims]);
  return (
    <Card icon={<FileSpreadsheet size={17} />} title="Конструктор кастомных отчётов" tag="выгрузка CSV/XLSX">
      <div className="flex flex-wrap gap-2 mb-3">
        {REPORT_DIMENSIONS.map((d) => (
          <button key={d.key} onClick={() => setDims((s) => (s.includes(d.key) ? s.filter((x) => x !== d.key) : [...s, d.key]))}
            className={`px-3 py-1.5 rounded-[8px] text-[12px] font-semibold cursor-pointer ${dims.includes(d.key) ? "bg-dark text-cream" : "bg-line-soft text-ink-soft hover:bg-line"}`}>{d.label}</button>
        ))}
      </div>
      <div className="overflow-auto max-h-48 border border-line-soft rounded-xl mb-3">
        <table className="w-full text-[12.5px]"><thead className="bg-line-soft text-ink"><tr>{table.headers.map((h) => <th key={h} className="text-left px-3 py-1.5">{h}</th>)}</tr></thead>
          <tbody>{table.rows.slice(0, 20).map((r, i) => <tr key={i} className="border-t border-line-soft">{table.headers.map((h) => <td key={h} className="px-3 py-1.5 text-ink-soft">{typeof r[h] === "number" ? (r[h] as number).toLocaleString("ru-RU") : r[h]}</td>)}</tr>)}</tbody></table>
      </div>
      <Btn variant="dark" className="h-10 px-5" disabled={!dims.length} onClick={() => downloadText("report.csv", tableToCsv(table.headers, table.rows))}>Выгрузить таблицу</Btn>
    </Card>
  );
}

/* ---------- §5.6 Белый ярлык ---------- */
export function WhiteLabelBlock() {
  const f = useSellerFeatures();
  if (!f.whiteLabel) return <LockedStub feature="whiteLabel" />;
  return <WhiteLabelInner />;
}
function WhiteLabelInner() {
  const uid = useAppStore((s) => s.session?.userId || "guest");
  const site = useSellerSite((s) => s.sites[uid]);
  const activate = useSellerSite((s) => s.activate);
  const [domain, setDomain] = useState(site?.customDomain || "");
  return (
    <Card icon={<Globe2 size={17} />} title="Белый ярлык" tag="домен клиента · без брендинга платформы">
      <p className="text-[13px] text-ink-soft mb-3">Свой домен или поддомен с TLS-сертификатом, логотипом и полным отключением брендинга платформы.</p>
      <div className="flex gap-2">
        <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="client-brand.ru" className="flex-1 h-10 px-3 rounded-[10px] border border-line text-[13px]" />
        <Btn variant="dark" className="h-10 px-4" disabled={!domain.trim()} onClick={() => void activate({ domain })}>Подключить</Btn>
      </div>
      {site && (
        <ul className="mt-3 space-y-1 text-[12.5px] text-ink-soft">
          <li className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-success" /> Домен: {site.customDomain || site.url}</li>
          <li className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-success" /> Сертификат: {site.sslCertificate}</li>
          <li className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-success" /> Брендинг платформы отключён: {site.platformBrandingHidden ? "да" : "нет"}</li>
        </ul>
      )}
    </Card>
  );
}

/* ---------- §5.6 Топ-позиции категорий ---------- */
export function TopPositionsBlock() {
  const f = useSellerFeatures();
  if (!f.topPositions) return <LockedStub feature="topPositions" />;
  const uid = useAppStore((s) => s.session?.userId || "guest");
  const slots = useTopSlots((s) => s.slots[uid] || []);
  const reserve = useTopSlots((s) => s.reserve);
  const release = useTopSlots((s) => s.release);
  const [cat, setCat] = useState(CATEGORIES[0].name);
  return (
    <Card icon={<Trophy size={17} />} title="Гарантированные топ-позиции" tag="пометка «Реклама»">
      <div className="flex gap-2">
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="flex-1 h-10 px-3 rounded-[10px] border border-line text-[13px] bg-surface">
          {CATEGORIES.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
        </select>
        <Btn variant="dark" className="h-10 px-4" onClick={() => reserve(cat)}>Занять 3 позиции</Btn>
      </div>
      {slots.map((s) => (
        <div key={s.id} className="mt-2 flex justify-between items-center border border-line-soft rounded-xl px-3 py-2 text-[13px]">
          <span className="text-ink">{s.category} — топ-{s.positions} <Badge tone="warning" className="ml-1">Реклама</Badge></span>
          <button onClick={() => release(s.id)} className="text-[12px] text-danger font-semibold cursor-pointer">Освободить</button>
        </div>
      ))}
    </Card>
  );
}

/* ---------- §5.6 Промо в рассылках ---------- */
export function PromoBlock() {
  const f = useSellerFeatures();
  if (!f.promoMailout) return <LockedStub feature="promoMailout" />;
  const bookings = usePromoBookings((s) => s.bookings);
  const book = usePromoBookings((s) => s.book);
  const month = new Date().toISOString().slice(0, 7);
  const used = bookings.filter((b) => b.month === month).length;
  const [placement, setPlacement] = useState(MEDIA_KIT.placements[0]);
  const [creative, setCreative] = useState("");
  const [err, setErr] = useState("");
  return (
    <Card icon={<Megaphone size={17} />} title="Промо в рассылках платформы" tag={`${used}/${PROMO_MONTHLY_LIMIT} выхода в месяц`}>
      <p className="text-[12.5px] text-ink-mute mb-2">Медиа-кит: {MEDIA_KIT.audience}; баннер {MEDIA_KIT.specs.banner}, текст {MEDIA_KIT.specs.text}.</p>
      <div className="flex gap-2 mb-2">
        <select value={placement} onChange={(e) => setPlacement(e.target.value)} className="h-10 px-3 rounded-[10px] border border-line text-[13px] bg-surface">
          {MEDIA_KIT.placements.map((p) => <option key={p} value={p}>{p === "email-digest" ? "Email-дайджест" : "Push-рассылка"}</option>)}
        </select>
        <input value={creative} onChange={(e) => setCreative(e.target.value)} placeholder="Текст креатива (до 120 символов)" maxLength={120} className="flex-1 h-10 px-3 rounded-[10px] border border-line text-[13px]" />
        <Btn variant="primary" className="h-10 px-4" disabled={!creative.trim()} onClick={() => { const r = book(placement, creative.trim()); setErr(r.error || ""); }}>Забронировать</Btn>
      </div>
      {err && <p className="text-[12.5px] text-danger">{err}</p>}
      {bookings.map((b) => <div key={b.id} className="text-[12.5px] text-ink-soft py-1 border-b border-line-soft last:border-0">{b.month} · {b.placement} · «{b.creative.slice(0, 40)}…» · {b.status}</div>)}
    </Card>
  );
}

/* ---------- раздел премиум-функций в кабинете продавца ---------- */
export function SellerPremiumSection() {
  const f = useSellerFeatures();
  const anyOn = Object.values(f).some((v) => v === true);
  if (!anyOn) return null; /* бесплатные тарифы: раздел скрыт полностью */
  return (
    <div className="space-y-4 mt-6">
      <h2 className="font-display font-bold text-[20px] text-ink flex items-center gap-2"><Vip size={19} className="text-accent" /> Премиум-функции тарифа</h2>
      <div className="grid lg:grid-cols-2 gap-4">
        {f.weeklyReport !== undefined && <WeeklyReportBlock />}
        {f.curatorPicks !== undefined && <CuratorPicksBlock />}
        <AbTestBlock />
        <B2bOrdersBlock />
        <ImportBlock />
        <BrandStoreBlock />
        <SegmentsBlock />
        <ManagerLineBlock />
        <CustomReportsBlock />
        <WhiteLabelBlock />
        <TopPositionsBlock />
        <PromoBlock />
      </div>
    </div>
  );
}

/* ============================================================
   §5.1 ПРЕМИУМ-БЛОКИ ПОКУПАТЕЛЯ (личный кабинет /profile)
   ============================================================ */
export function PremiumSalesBlock() {
  const f = useBuyerFeatures();
  if (!f.premiumSales) return <LockedFeatureStub label="Закрытые распродажи" need="Покупатель «Премиум»" />;
  const drops = usePremiumSales((s) => s.drops);
  const ensure = usePremiumSales((s) => s.ensureThisWeek);
  useEffect(() => { ensure(); }, []);
  const live = drops.find((d) => d.status === "live");
  const items = dropProducts(live);
  return (
    <Card icon={<Sparkles size={17} />} title="Закрытые распродажи" tag="еженедельные дропы · −20%">
      {live ? (
        <>
          <p className="text-[13px] text-ink-soft mb-2">{live.title} · скидка {live.discountPct}% · {items.length} позиций</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {items.slice(0, 4).map((p) => (
              <div key={p.id} className="border border-line-soft rounded-xl p-2.5 text-[12px]">
                <p className="text-ink font-semibold truncate">{p.name}</p>
                <p className="text-accent font-bold">{Math.round(p.price).toLocaleString("ru-RU")} ₽ <span className="text-ink-mute line-through font-normal">{Math.round((p as any).oldPrice || 0).toLocaleString("ru-RU")} ₽</span></p>
              </div>
            ))}
          </div>
          <Link to="/catalog?drop=1" className="inline-block mt-3 text-[13px] font-bold text-ink underline decoration-accent">Открыть все →</Link>
        </>
      ) : <p className="text-[13px] text-ink-mute">Дроп этой недели готовится — загляните в понедельник.</p>}
    </Card>
  );
}

export function CuratorBlock() {
  const f = useBuyerFeatures();
  if (!f.curator) return <LockedFeatureStub label="Цифровой куратор" need="Покупатель «Премиум»" />;
  const tickets = useCurator((s) => s.tickets);
  const escalate = useCurator((s) => s.escalate);
  const [q, setQ] = useState("");
  return (
    <Card icon={<Headphones size={17} />} title="Цифровой куратор" tag="приоритет · SLA 30 мин">
      <p className="text-[13px] text-ink-soft mb-2">Приоритетная ветка агента; нерешённый вопрос эскалируется живому оператору.</p>
      <div className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Вопрос куратору" className="flex-1 h-10 px-3 rounded-[10px] border border-line text-[13px]" />
        <Btn variant="primary" className="h-10 px-4" disabled={!q.trim()} onClick={() => { escalate(q.trim()); setQ(""); }}>Эскалировать</Btn>
      </div>
      {tickets.slice(0, 3).map((t) => (
        <div key={t.id} className="mt-2 text-[12.5px] border border-line-soft rounded-xl px-3 py-2 flex justify-between">
          <span className="text-ink">{t.question.slice(0, 50)}</span><Badge tone={t.status === "resolved" ? "success" : "accent"}>{t.status === "resolved" ? "решено" : `SLA ${t.slaMinutes} мин`}</Badge>
        </div>
      ))}
    </Card>
  );
}

export function VipBadgeChip() {
  const f = useBuyerFeatures();
  if (!f.vipBadge) return null;
  return <Badge tone="premium" className="shrink-0"><Vip size={11} /> VIP</Badge>;
}

function LockedFeatureStub({ label, need }: { label: string; need: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-surface p-5 flex items-center gap-3">
      <Lock size={16} className="text-ink-mute" />
      <p className="text-[13px] text-ink-soft flex-1">{label} — доступно на тарифе <strong className="text-ink">{need}</strong>.</p>
      <Link to="/plans" className="text-[13px] font-bold text-ink underline decoration-accent">Апгрейд</Link>
    </div>
  );
}

/* секция премиума в кабинете покупателя */
export function BuyerPremiumSection() {
  const f = useBuyerFeatures();
  if (!(f.premiumSales || f.curator)) return null;
  return (
    <div className="space-y-4 mt-6">
      <h2 className="font-display font-bold text-[20px] text-ink flex items-center gap-2"><Vip size={19} className="text-accent" /> Премиум для вас</h2>
      <PremiumSalesBlock />
      <CuratorBlock />
      {f.curator && thisWeekPicksForBuyer(f).length > 0 && (
        <Card icon={<Sparkles size={17} />} title="Подборки кураторов недели" tag="закрытая витрина">
          {thisWeekPicksForBuyer(f).slice(0, 5).map((p: any) => (
            <div key={p.id} className="text-[13px] py-1.5 border-b border-line-soft last:border-0 flex justify-between">
              <span className="text-ink font-semibold">{p.shopName}</span><span className="text-ink-mute">{p.productIds.length} позиций · {p.note.slice(0, 40)}</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
function thisWeekPicksForBuyer(f: { premiumSales: boolean }) {
  return f.premiumSales ? thisWeekPicks() : [];
}
