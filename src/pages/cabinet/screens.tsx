/* ============================================================
   CABINET ADMIN — экраны разделов (операционные очереди и карточки)
   Порядок на каждом экране: требует решения → произошло → почему.
   ============================================================ */
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { Activity, ArrowDownRight, ArrowUpRight, HeartPulse, Send, ShieldAlert, Sparkles, Zap, CircleSlash, ClipboardList, Play } from "lucide-react";
import { Btn, Badge, Field, Switch } from "../../components/ui";
import { adminApi, opKey } from "../../lib/admin-api";
import {
  cn, Panel, DataTable, Drawer, RiskTag, DangerConfirm, EmptyState, ErrorState, LoadingBlock,
  useCabinetData, useCabinet, useToast, fmtRub, fmtNum, timeAgo, dueIn, type Risk, type ConfirmSpec,
} from "./layout";

const STATUS_TONE: Record<string, any> = { active: "success", open: "warning", pending: "warning", blocked: "error", rejected: "error", resolved: "success", closed: "neutral", degraded: "error", ok: "success", paused: "neutral", frozen: "error", approved: "success", sent: "success", scheduled: "neutral", running: "ai" };
const St = ({ s }: { s: string }) => <Badge tone={STATUS_TONE[s] || "neutral"}>{s}</Badge>;

/* ════════════════ COMMAND CENTER (Главная) ════════════════ */
export function HomeScreen() {
  const { data, loading, error, reload } = useCabinetData<any>(() => adminApi.home());
  const nav = useNavigate();
  if (loading) return <LoadingBlock rows={6} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const d = data!;
  const h = d.health;
  const hsColor = h.score >= 80 ? "text-success" : h.score >= 60 ? "text-warning" : "text-error";
  const METRICS: [string, keyof typeof d.metrics, number | undefined, string][] = [
    ["GMV", "gmv", d.metrics.deltas?.gmv, "₽"], ["Выручка сервиса", "revenue", d.metrics.deltas?.revenue, "₽"], ["Чистая маржа", "margin", d.metrics.deltas?.margin, "₽"],
    ["Активные покупатели", "buyers", d.metrics.deltas?.buyers, ""], ["Активные продавцы", "sellers", d.metrics.deltas?.sellers, ""], ["Средний чек", "avg_check", d.metrics.deltas?.avg_check, "₽"],
    ["Конверсия, %", "conv", d.metrics.deltas?.conv, ""], ["Повторные, %", "repeat", d.metrics.deltas?.repeat, ""], ["Retention, %", "retention", d.metrics.deltas?.retention, ""],
    ["Отмены", "cancels", d.metrics.deltas?.cancels, ""], ["Возвраты", "refunds", d.metrics.deltas?.refunds, ""], ["Споры", "disputes", d.metrics.deltas?.disputes, ""], ["NPS", "nps", d.metrics.deltas?.nps, ""],
  ];
  return (
    <div className="space-y-5">
      {/* индекс здоровья платформы */}
      <Panel title="Индекс здоровья платформы" sub="Доступность · скорость · конверсия · жалобы · споры · возвраты · мошенничество · интеграции · удовлетворённость">
        <div className="flex flex-wrap items-center gap-6">
          <div className={cn("font-display font-bold text-[54px] leading-none", hsColor)}>{h.score}<span className="text-[20px] text-ink-mute">/100</span></div>
          <div className="flex-1 min-w-[240px]">
            <div className="h-3 rounded-full bg-line-soft overflow-hidden mb-2"><div className={cn("h-full rounded-full", h.score >= 80 ? "bg-success" : h.score >= 60 ? "bg-warning" : "bg-error")} style={{ width: h.score + "%" }} /></div>
            {h.reasons.length > 0 && (
              <p className="text-[12.5px] text-ink-soft">Причины снижения: {h.reasons.map((r: any) => <button key={r.label} onClick={() => nav("/admin/analytics")} className="font-semibold text-error underline cursor-pointer mr-2">{r.label} {r.value}%</button>)}</p>
            )}
          </div>
        </div>
      </Panel>

      {/* требуют решения */}
      <Panel title="Требуют решения" sub={`${d.decisions.length} действий ожидают администратора`} right={<Link to="/admin/queue"><Btn size="sm" variant="outline">Вся очередь</Btn></Link>}>
        {!d.decisions.length ? <EmptyState title="Очередь пуста" why="Агенту не нужны ваши подтверждения — все действия в рамках политик выполнены автоматически." action={<Link to="/admin/traces"><Btn size="sm" variant="outline">Посмотреть работу агента</Btn></Link>} /> : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {d.decisions.map((x: any) => (
              <button key={x.id} onClick={() => nav("/admin/queue?focus=" + x.id)} className="text-left bg-surface border border-line rounded-xl p-4 hover:border-dark transition-colors cursor-pointer">
                <div className="flex items-center justify-between gap-2 mb-2"><RiskTag r={x.risk} /><span className="text-[11px] font-bold text-ink-mute">срок: {dueIn(x.due_ts)}</span></div>
                <p className="text-[13.5px] font-bold text-ink leading-snug mb-1">{x.title}</p>
                <p className="text-[12px] text-ink-soft line-clamp-2 mb-2">{x.summary}</p>
                <p className="text-[11px] text-ink-mute">Источник: {x.source}</p>
              </button>
            ))}
          </div>
        )}
      </Panel>

      {/* критические алерты */}
      <Panel title="Критические алерты" sub="Уровень · время · ответственный · статус обработки">
        {!d.alerts.length ? <EmptyState title="Активных алертов нет" why="Мониторинг шлюзов, доставки, поиска и активности агента работает штатно." /> : (
          <div className="space-y-2">
            {d.alerts.map((a: any) => (
              <div key={a.id} className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 border rounded-xl px-4 py-3", a.level === "critical" ? "border-error/40 bg-error/5" : a.level === "important" ? "border-warning/40 bg-warning/5" : "border-line")}>
                <Badge tone={a.level === "critical" ? "error" : a.level === "important" ? "warning" : "neutral"}>{a.level}</Badge>
                <span className="text-[13px] font-semibold text-ink flex-1 min-w-[200px]">{a.title}</span>
                <span className="text-[12px] text-ink-soft">{a.metric}</span>
                <span className="text-[11.5px] text-ink-mute">{timeAgo(a.ts)}</span>
                <St s={a.status} />
                <Link to="/admin/security" className="text-[12px] font-bold text-accent-deep">разобрать</Link>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* ключевые метрики — каждая кликабельна к разбору */}
      <Panel title="Ключевые бизнес-метрики" sub="Изменение за выбранный период (7 дней). Нажмите метрику для детального разбора." right={<Link to="/admin/analytics"><Btn size="sm" variant="outline">Аналитика</Btn></Link>}>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2.5">
          {METRICS.map(([label, key, delta, unit]) => (
            <Link key={String(key)} to="/admin/analytics" className="block rounded-xl border border-line bg-surface p-3 hover:border-dark transition-colors no-underline">
              <p className="text-[11px] uppercase tracking-wide text-ink-mute font-bold mb-1">{label}</p>
              <p className="text-[17px] font-display font-bold text-ink">{unit === "₽" ? fmtRub(d.metrics[key as any]) : fmtNum(d.metrics[key as any])}</p>
              {delta !== undefined && (
                <p className={cn("text-[11.5px] font-bold flex items-center gap-0.5", delta >= 0 ? "text-success" : "text-error")}>
                  {delta >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{delta}{unit === "₽" ? "" : unit === "" && (key === "conv" || key === "repeat" || key === "retention") ? " п.п." : "%"}
                </p>
              )}
            </Link>
          ))}
        </div>
      </Panel>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* блок AI-агента */}
        <Panel title="AI-агент" sub="Статус · задачи · гипотезы · стоимость · качество" right={<Link to="/admin/agent"><Btn size="sm" variant="outline">Модуль агента</Btn></Link>}>
          <div className="grid grid-cols-2 gap-2 text-[13px]">
            <Info label="Статус" v={<St s={d.agent.status} />} />
            <Info label="Режим автономности" v={MODE_RU[d.agent.mode] || d.agent.mode} />
            <Info label="Выполняет задач" v={d.agent.running_tasks} />
            <Info label="Гипотез сформировано" v={<Link className="text-accent-deep font-bold" to="/admin/observations">{d.agent.hypotheses}</Link>} />
            <Info label="Ждут подтверждения" v={<Link className="text-accent-deep font-bold" to="/admin/queue">{d.agent.waiting_confirm}</Link>} />
            <Info label="Мониторит источников" v={d.agent.monitoring} />
            <Info label="Ошибки инструментов" v={d.agent.errors ? <span className="text-error font-bold">{d.agent.errors}</span> : "нет"} />
            <Info label="Стоимость сегодня" v={fmtRub(d.agent.cost_today_rub)} />
            <Info label="Качество ответов" v={(d.agent.quality * 100).toFixed(0) + "%"} />
          </div>
        </Panel>
        {/* лента последних изменений */}
        <Panel title="Лента последних изменений" sub="Релизы · флаги · правила · массовые действия · финансы · блокировки · инциденты · решения агента">
          <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
            {d.feed.map((f: any, i: number) => (
              <div key={i} className="flex items-start gap-2.5 text-[12.5px] py-1 border-b border-line/50 last:border-0">
                <span className="mt-1 w-2 h-2 rounded-full shrink-0" style={{ background: FEED_COLOR[f.kind] || "#9a9a94" }} />
                <span className="flex-1 text-ink">{f.text}</span>
                <span className="text-ink-mute whitespace-nowrap">{timeAgo(f.ts)}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
const MODE_RU: Record<string, string> = { observer: "Наблюдатель", advisor: "Советник (руки с разрешения)" };
const FEED_COLOR: Record<string, string> = { release: "#2d5f4c", flag: "#d98e32", rule: "#b98a2f", mass: "#e53935", finance: "#7cb342", block: "#e53935", incident: "#e53935", agent: "#2d5f4c", action: "#6b6b66" };
const Info = ({ label, v }: { label: string; v: any }) => (
  <div className="rounded-lg bg-line-soft/50 px-3 py-2"><p className="text-[10.5px] uppercase font-bold text-ink-mute">{label}</p><p className="text-[13px] font-semibold text-ink mt-0.5">{v}</p></div>
);

/* ════════════════ АГЕНТ: обзор / режим / health / дрейф ════════════════ */
export function AgentScreen() {
  const { data, loading, error, reload } = useCabinetData<any>(() => adminApi.agent());
  const { can, profile } = useCabinet();
  const { push } = useToast();
  const [chat, setChat] = useState<{ role: "me" | "agent"; text: string; conf?: number; sources?: string[]; evidence?: any[] }[]>([]);
  const [msg, setMsg] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [confirm, setConfirm] = useState<null | { spec: ConfirmSpec; run: (reason: string) => Promise<any> }>(null);
  const [busy, setBusy] = useState(false);
  if (loading) return <LoadingBlock rows={5} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const d = data!; const a = d.agent; const rt = d.realtime;

  const send = async () => {
    if (!msg.trim()) return;
    setChat((c) => [...c, { role: "me", text: msg }]); setMsg(""); setChatBusy(true);
    const r = await adminApi.agentChat(msg.trim());
    setChatBusy(false);
    if (r?.ok) setChat((c) => [...c, { role: "agent", text: r.reply, conf: r.confidence, sources: r.sources, evidence: r.evidence_pack }]);
    else setChat((c) => [...c, { role: "agent", text: mapErrLocal(r) }]);
  };

  const setMode = (mode: string) => setConfirm({
    spec: { title: "Сменить режим автономности агента", risk: mode === "observer" ? "medium" : "low", affected: "все будущие действия агента", changes: [`Режим: ${MODE_RU[a.autonomy_mode] || a.autonomy_mode} → ${MODE_RU[mode]}`, "Конституция А1 v2: автономная запись запрещена в обоих режимах"], reversible: true, reasonLabel: "почему меняем границы" },
    run: (reason) => adminApi.agentPatch({ autonomy_mode: mode, reason }),
  });
  const kill = () => setConfirm({
    spec: { title: "KILL SWITCH — полная остановка агента", risk: "critical", affected: "все процессы агента во всех окружениях", changes: ["Статус → blocked", "Все инструменты отключены", "Текущие запуски будут прерваны"], reversible: true, requireConfirmText: true, reasonLabel: "обязательное обоснование экстренной остановки" },
    run: (reason) => adminApi.killSwitch(reason),
  });

  return (
    <div className="space-y-5">
      <Panel title={"Агент · " + a.model_version} sub={`Промпт ${a.prompt_version} · Правила ${a.rules_version} · Инструменты ${a.tools_version} · Обновлено ${timeAgo(a.last_updated)} · Владелец: ${a.owner}`}
        right={<span className="flex items-center gap-2"><Badge tone={a.autonomy_mode === "advisor" ? "success" : "neutral"}>РЕЖИМ: {(MODE_RU[a.autonomy_mode] || a.autonomy_mode).toUpperCase()}</Badge><St s={a.status} /></span>}>
        <p className="text-[12.5px] text-ink-soft bg-line-soft/60 border border-line rounded-xl px-3.5 py-2.5 mb-4">Конституция А1 v2 «руки с разрешения»: агент не выполняет ни одной записывающей операции автономно. Единственный канал влияния — очередь решений по протоколу двухшагового согласия (разрешить → переспрос → исполнение по одноразовому токену).</p>
        <div className="grid md:grid-cols-2 gap-5">
          <div>
            <p className="text-[12px] font-bold uppercase text-ink-mute mb-2">Режим автономности</p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(MODE_RU).map(([k, v]) => (
                <button key={k} disabled={!can("agent_manage") || busy} onClick={() => { setBusy(true); if (k !== a.autonomy_mode) setMode(k); setBusy(false); }}
                  className={cn("rounded-xl border px-3 py-2.5 text-left text-[12.5px] font-semibold cursor-pointer transition-colors", k === a.autonomy_mode ? "border-dark bg-dark text-cream" : "border-line text-ink hover:border-dark")}>
                  {v}
                  <p className="text-[10.5px] font-normal opacity-75 mt-0.5">{MODE_DESC[k]}</p>
                </button>
              ))}
            </div>
            {a.kill_switch && <div className="mt-3 flex items-center gap-2 text-[13px] font-bold text-error bg-error/10 border border-error/30 rounded-xl px-3 py-2"><CircleSlash size={16} /> Kill switch активен — агент остановлен</div>}
            {can("double_confirm") && !a.kill_switch && (
              <Btn variant="outline" size="sm" className="mt-3 !text-error !border-error/40" onClick={kill}><ShieldAlert size={14} className="mr-1" /> Экстренная остановка</Btn>
            )}
          </div>
          <div>
            <p className="text-[12px] font-bold uppercase text-ink-mute mb-2">Health score агента</p>
            <div className="grid grid-cols-2 gap-2 text-[13px]">
              <Info label="Качество ответов" v={pct(a.health.answer_quality)} />
              <Info label="Точность классификации" v={pct(a.health.classification_accuracy)} />
              <Info label="Ложные срабатывания" v={pct(a.health.false_positive_rate)} />
              <Info label="Ошибки инструментов /сут" v={a.health.tool_errors} />
              <Info label="Среднее выполнение" v={a.health.avg_exec_ms + " мс"} />
              <Info label="Стоимость операций /сут" v={fmtRub(a.health.cost_rub_day)} />
              <Info label="Решений с человеком" v={pct(a.health.human_share)} />
              <Info label="Отменено админом" v={a.health.cancelled_by_admin} />
            </div>
            <p className="text-[12px] font-bold uppercase text-ink-mute mt-4 mb-1">Показатель дрейфа</p>
            <div className="flex items-center gap-3">
              <div className="h-2 flex-1 rounded-full bg-line-soft overflow-hidden"><div className={cn("h-full", a.drift.score > 0.2 ? "bg-error" : "bg-success")} style={{ width: Math.min(100, a.drift.score * 100 * 2) + "%" }} /></div>
              <span className={cn("text-[12.5px] font-bold", a.drift.score > 0.2 ? "text-error" : "text-success")}>{pct(a.drift.score)}</span>
            </div>
            {a.drift.score > 0.2 && <p className="text-[12px] text-error mt-1">Дрейф выше нормы: проверьте модель, промпт, правила или источники данных.</p>}
            <p className="text-[12px] font-bold uppercase text-ink-mute mt-4 mb-1">Мониторинг в реальном времени</p>
            <div className="flex flex-wrap gap-2 text-[11.5px]">
              <Chip t={`${rt.runs_24h} запусков/24ч`} /><Chip t={`${rt.ok} ок / ${rt.fail} ошибок`} bad={rt.fail > 40} /><Chip t={`${rt.cost_rub} ₽/сут`} /><Chip t={`${Math.round(rt.human_share * 100)}% с человеком`} /><Chip t={`${rt.policy_blocks} блок политикой`} /><Chip t={`${rt.anomalies} аномалий`} bad={rt.anomalies > 0} />
            </div>
          </div>
        </div>
      </Panel>

      {/* диалог с агентом */}
      <Panel title="Диалог с агентом" sub="Ответы всегда с уровнем уверенности, источниками и evidence pack — без слепых фактов">
        <div className="max-h-[300px] overflow-y-auto space-y-3 mb-4">
          {!chat.length && <p className="text-[13px] text-ink-soft">Спросите: «почему эта проблема приоритетна», «какие данные использованы», «что будет при отказе от решения», «смоделируй сценарий».</p>}
          {chat.map((m, i) => m.role === "me" ? (
            <p key={i} className="text-[13px] text-ink bg-line-soft rounded-xl rounded-tr-sm px-3.5 py-2.5 ml-auto max-w-[80%] w-fit">{m.text}</p>
          ) : (
            <div key={i} className="text-[13px] text-ink bg-ai-soft border border-ai/20 rounded-xl rounded-tl-sm px-3.5 py-2.5 max-w-[85%]">
              {m.text}
              {m.conf !== undefined && <p className="text-[11px] text-ai font-bold mt-2">Уверенность: {pct(m.conf)} · Источники: {(m.sources || []).join(", ")}</p>}
              {!!m.evidence?.length && (
                <div className="mt-2 space-y-1">
                  {m.evidence.map((e: any) => <Link key={e.id} to="/admin/observations" className="block text-[11.5px] bg-surface border border-line rounded-lg px-2 py-1 no-underline text-ink hover:border-dark">📎 {e.id} · {e.title} ({e.volume})</Link>)}
                </div>
              )}
            </div>
          ))}
          {chatBusy && <p className="text-[12px] text-ink-mute animate-pulse">Агент готовит ответ с доказательствами…</p>}
        </div>
        <div className="flex gap-2">
          <input className="field flex-1" placeholder="Вопрос агенту…" value={msg} onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
          <Btn onClick={send} disabled={chatBusy}><Send size={15} className="mr-1" />Спросить</Btn>
        </div>
      </Panel>

      {confirm && <DangerConfirm spec={confirm.spec} busy={busy} onCancel={() => setConfirm(null)} onConfirm={async (reason) => { setBusy(true); const r = await confirm.run(reason); setBusy(false); setConfirm(null); if (r?.ok) { push("Изменения применены и записаны в журнал"); reload(); } else push(mapErrLocal(r), "err"); }} />}
    </div>
  );
}
const MODE_DESC: Record<string, string> = { observer: "только анализ и предложения", advisor: "читает всё; любая запись — только по двухшаговому согласию (А1 v2)" };
const pct = (n: number) => Math.round(n * 100) + "%";
const Chip = ({ t, bad }: { t: string; bad?: boolean }) => <span className={cn("px-2 py-1 rounded-lg border text-[11.5px] font-semibold", bad ? "border-error/40 text-error bg-error/5" : "border-line text-ink-soft bg-surface")}>{t}</span>;
const mapErrLocal = (r: any) => r?.hint || (r?.error === "double_confirmation_required" ? "Нужно подтверждение второго администратора" : r?.error === "forbidden" ? `Нет права: ${r.need || "требуемое"}` : "Не удалось выполнить. Подробности в журнале.");

/* ════════════════ ИСТОЧНИКИ ДАННЫХ ════════════════ */
export function SourcesScreen() {
  const { data, loading, error, reload } = useCabinetData<any>(() => adminApi.agent());
  const { can } = useCabinet(); const { push } = useToast();
  if (loading) return <LoadingBlock rows={6} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const toggle = async (s: any, connected: boolean) => {
    const r = await adminApi.sourcePatch(s.key, { connected, reason: connected ? "возобновление источника" : "временное отключение оператором" });
    if (r?.ok) { push(`Источник «${s.title}» ${connected ? "подключён" : "отключён"}`); reload(); } else push(mapErrLocal(r), "err");
  };
  return (
    <Panel title="Источники данных агента" sub="Карта подключений: статус, синхронизация, объём, ошибки, маскирование, ограничения">
      <DataTable rows={data!.sources} rowKey={(s) => s.key} cols={[
        { key: "title", title: "Источник", render: (s) => <span className="font-semibold">{s.title} {s.excluded && <Badge tone="error">исключён</Badge>}</span> },
        { key: "connected", title: "Подключён", render: (s) => <span className={s.connected ? "text-success font-bold" : "text-ink-mute font-bold"}>{s.connected ? "да" : "нет"}</span> },
        { key: "last_sync", title: "Обновлён", render: (s) => timeAgo(s.last_sync) },
        { key: "records", title: "Данных", render: (s) => fmtNum(s.records) },
        { key: "errors", title: "Ошибки", render: (s) => s.errors ? <span className="text-error font-bold">{s.errors}</span> : "0" },
        { key: "masked_fields", title: "Маскируется", render: (s) => s.masked_fields.join(", ") || "—" },
        { key: "restrictions", title: "Ограничения", render: (s) => s.restrictions || "—" },
        { key: "_t", title: "Доступ", render: (s) => <div onClick={(e) => e.stopPropagation()}><Switch checked={s.connected} disabled={!can("agent_manage")} onChange={(v) => toggle(s, v)} /></div> },
      ]} />
    </Panel>
  );
}

/* ════════════════ ЖУРНАЛ НАБЛЮДЕНИЙ ════════════════ */
export function ObservationsScreen() {
  const { data, loading, error, reload } = useCabinetData<any>(() => adminApi.agent());
  const [f, setF] = useState({ source: "", severity: "" });
  const { can } = useCabinet(); const { push } = useToast();
  if (loading) return <LoadingBlock rows={5} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  let obs = data!.observations;
  if (f.source) obs = obs.filter((o: any) => o.source === f.source);
  if (f.severity) obs = obs.filter((o: any) => o.severity === f.severity);
  const convert = async (id: string, kind: string) => { const r = await adminApi.obsConvert(id, kind); if (r?.ok) { push("Наблюдение превращено в " + kind); reload(); } else push(mapErrLocal(r), "err"); };
  return (
    <Panel title="Журнал наблюдений агента" sub="Аномалии с доказательствами; каждое наблюдение можно превратить в гипотезу, задачу, инцидент или правило"
      right={<div className="flex gap-2">
        <select className="field !h-9 !w-auto text-[12.5px]" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })}><option value="">Все источники</option>{[...new Set(data!.observations.map((o: any) => o.source))].map((s) => <option key={String(s)}>{String(s)}</option>)}</select>
        <select className="field !h-9 !w-auto text-[12.5px]" value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value })}><option value="">Любая серьёзность</option><option>high</option><option>medium</option><option>low</option></select>
      </div>}>
      <div className="space-y-3">
        {!obs.length && <EmptyState title="Наблюдений нет" why="В выбранных фильтрах записей нет. Сбросьте фильтры — агент пишет журнал непрерывно." />}
        {obs.map((o: any) => (
          <article key={o.id} className="border border-line rounded-xl p-4">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <Badge tone={o.severity === "high" ? "error" : o.severity === "medium" ? "warning" : "neutral"}>{o.severity}</Badge>
              <span className="text-[11.5px] text-ink-mute">{o.id} · источник {o.source} · {timeAgo(o.ts)}</span>
              {o.status !== "open" && <Badge tone="ai">{o.status.replace("converted_", "→ ")}</Badge>}
            </div>
            <p className="text-[14px] font-bold text-ink">{o.anomaly}</p>
            <p className="text-[12.5px] text-ink-soft mt-0.5">{o.segment} · объём: {o.volume}</p>
            <details className="mt-2"><summary className="text-[12px] font-bold text-accent-deep cursor-pointer">Доказательства</summary>
              <pre className="mt-1 text-[11px] bg-line-soft rounded-lg p-2.5 overflow-x-auto text-ink-soft">{JSON.stringify(o.evidence, null, 1)}</pre></details>
            {can("agent_manage") && o.status === "open" && (
              <div className="flex flex-wrap gap-2 mt-3">
                <Btn size="sm" variant="outline" onClick={() => convert(o.id, "hypothesis")}>→ Гипотеза</Btn>
                <Btn size="sm" variant="outline" onClick={() => convert(o.id, "task")}>→ Задача</Btn>
                <Btn size="sm" variant="outline" onClick={() => convert(o.id, "incident")}>→ Инцидент</Btn>
                <Btn size="sm" variant="outline" onClick={() => convert(o.id, "rule")}>→ Правило</Btn>
              </div>
            )}
          </article>
        ))}
      </div>
    </Panel>
  );
}

/* ════════════════ ОЧЕРЕДЬ РЕШЕНИЙ ════════════════ */
export function QueueScreen() {
  const { data, loading, error, reload } = useCabinetData<any>(() => adminApi.decisions());
  const loc = useLocation();
  const focus = new URLSearchParams(loc.search).get("focus");
  const [openId, setOpenId] = useState<string | null>(focus);
  const [detail, setDetail] = useState<any>(null);
  const [confirm, setConfirm] = useState<null | { spec: ConfirmSpec; run: (reason: string, extra: any) => Promise<any> }>(null);
  const [busy, setBusy] = useState(false);
  const [secondAdmin, setSecondAdmin] = useState("");
  const [admins, setAdmins] = useState<any[]>([]);
  const { can, profile } = useCabinet(); const { push } = useToast();
  useEffect(() => { if (focus) setOpenId(focus); }, [focus]);
  useEffect(() => { adminApi.settings().then((r: any) => r?.ok && setAdmins(r.admins || [])); }, []);
  useEffect(() => { if (openId) adminApi.decision(openId).then((r: any) => r?.ok && setDetail(r)); }, [openId]);

  const act = (d: any, verdict: string, reason: string, extra: any = {}) => {
    if (verdict === "approve" && d.risk === "critical") {
      setConfirm({
        spec: {
          title: "Одобрить: " + d.title, risk: "critical",
          affected: JSON.stringify(d.affected), changes: [d.consequences, "Предлагаемое действие: " + d.proposed_action], reversible: false,
          requireConfirmText: true, reasonLabel: "на основании каких данных принято решение",
          extra: (
            <Field label="Второй подтверждающий администратор" required>
              <select className="field" value={secondAdmin} onChange={(e) => setSecondAdmin(e.target.value)}>
                <option value="">— выберите —</option>
                {admins.filter((a) => a.id !== profile?.id).map((a) => <option key={a.id} value={a.id}>{a.name} ({a.role})</option>)}
              </select>
            </Field>
          ),
        },
        run: (r) => adminApi.decisionResolve(d.id, { verdict: "approve", reason: r, double_confirm: true, double_confirm_admin_id: secondAdmin, confirm_text: "ПОДТВЕРЖДАЮ" }),
      });
      return;
    }
    runResolve(d.id, { verdict, reason, ...extra });
  };
  const runResolve = async (id: string, body: any) => {
    setBusy(true); const r = await adminApi.decisionResolve(id, body); setBusy(false);
    if (r?.ok) { push("Решение зафиксировано: кто, когда, причина и результат — в журнале"); reload(); } else push(mapErrLocal(r), "err");
  };

  if (loading) return <LoadingBlock rows={5} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const pending = data!.decisions.filter((x: any) => x.status === "pending");
  return (
    <div className="space-y-5">
      <Panel title="Очередь решений агента" sub="Каждая карточка: риск, срок, затронутые объекты, доказательства, альтернативы, прогноз, последствия">
        {!pending.length ? <EmptyState icon={<ClipboardList size={22} />} title="Очередь пуста" why="Нет действий, требующих подтверждения человека. Все автоматические действия ограничены Policy Engine." action={<Link to="/admin/policies"><Btn size="sm" variant="outline">Границы агента</Btn></Link>} /> : (
          <div className="grid md:grid-cols-2 gap-3">
            {pending.map((x: any) => (
              <button key={x.id} onClick={() => setOpenId(x.id)} className="text-left border border-line rounded-xl p-4 hover:border-dark transition-colors cursor-pointer bg-surface">
                <div className="flex items-center justify-between gap-2 mb-2"><RiskTag r={x.risk} /><span className={cn("text-[11px] font-bold", x.due_ts < Date.now() ? "text-error" : "text-ink-mute")}>реакция: {dueIn(x.due_ts)}</span></div>
                <p className="text-[14px] font-bold text-ink mb-1">{x.title}</p>
                <p className="text-[12px] text-ink-soft line-clamp-2">{x.description}</p>
                <p className="text-[11px] text-ink-mute mt-2">Источник: {x.source} · Уверенность агента: {pct(x.confidence)}</p>
              </button>
            ))}
          </div>
        )}
      </Panel>
      <Panel title="Закрытые решения" sub="Фиксируются: кто принял, когда, на основании каких данных, причина и результат">
        <DataTable rows={data!.decisions.filter((x: any) => x.status !== "pending")} rowKey={(x: any) => x.id} onRow={(x: any) => setOpenId(x.id)} cols={[
          { key: "title", title: "Решение" }, { key: "risk", title: "Риск", render: (x: any) => <RiskTag r={x.risk} /> },
          { key: "status", title: "Статус", render: (x: any) => <St s={x.status} /> },
          { key: "resolution", title: "Принял", render: (x: any) => x.resolution ? `${x.resolution.by} · ${timeAgo(x.resolution.at)}` : "—" },
          { key: "result", title: "Результат", render: (x: any) => x.resolution?.result || x.resolution?.reason || "—" },
        ]} />
      </Panel>

      <Drawer open={!!openId} onClose={() => setOpenId(null)} title={detail?.decision?.title || "Решение"} wide>
        {detail?.decision && (() => { const d = detail.decision; return (
          <>
            <div className="flex flex-wrap items-center gap-2"><RiskTag r={d.risk} /><St s={d.status} /><span className="text-[12px] text-ink-mute">срок реакции: {dueIn(d.due_ts)} · источник: {d.source}</span></div>
            <p className="text-[13.5px] text-ink">{d.description}</p>
            <div className="grid grid-cols-2 gap-2"><Info label="Затронутые объекты" v={JSON.stringify(d.affected)} /><Info label="Уверенность агента" v={pct(d.confidence)} /></div>
            <section>
              <p className="text-[12px] font-bold uppercase text-ink-mute mb-2">Evidence pack</p>
              {d.evidence?.cancel_series && (
                <div className="h-24 mb-2 rounded-lg bg-line-soft/50 p-1"><ResponsiveContainer width="100%" height="100%"><LineChart data={d.evidence.cancel_series.map((v: number, i: number) => ({ d: "день " + (i + 1), v }))}><XAxis dataKey="d" hide /><YAxis hide /><Tooltip /><Line dataKey="v" stroke="#e53935" strokeWidth={2} /></LineChart></ResponsiveContainer></div>
              )}
              <pre className="text-[11px] bg-line-soft rounded-lg p-3 overflow-x-auto max-h-48">{JSON.stringify(d.evidence, null, 1)}</pre>
            </section>
            <section>
              <p className="text-[12px] font-bold uppercase text-ink-mute mb-1">Предлагаемое действие</p>
              <p className="text-[13px] font-semibold text-ink">{d.proposed_action}</p>
              <p className="text-[12px] font-bold uppercase text-ink-mute mt-3 mb-1">Альтернативы</p>
              <div className="flex gap-2 flex-wrap">{(d.alternatives || []).map((x: string) => <Badge key={x} tone="neutral">{x}</Badge>)}</div>
              {d.forecast && Object.keys(d.forecast).length > 0 && (<><p className="text-[12px] font-bold uppercase text-ink-mute mt-3 mb-1">Прогноз эффекта</p><pre className="text-[11px] bg-line-soft rounded-lg p-3">{JSON.stringify(d.forecast)}</pre></>)}
              <p className="text-[12px] font-bold uppercase text-ink-mute mt-3 mb-1">Последствия</p>
              <p className="text-[13px] text-ink bg-warning/5 border border-warning/30 rounded-lg px-3 py-2">{d.consequences}</p>
            </section>
            {d.status === "pending" && can("approve") && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-line">
                <Btn size="sm" disabled={busy} onClick={() => act(d, "approve", "")}>Одобрить</Btn>
                <Btn size="sm" variant="outline" disabled={busy} onClick={() => setConfirm({ spec: { title: "Отклонить: " + d.title, risk: "medium", affected: "это решение агента", changes: ["Решение отклонено, агент получит обратную связь для обучения"], reversible: true, reasonLabel: "почему отклоняем" }, run: (r) => adminApi.decisionResolve(d.id, { verdict: "reject", reason: r }) })}>Отклонить</Btn>
                <Btn size="sm" variant="outline" disabled={busy} onClick={() => setConfirm({ spec: { title: "Запросить дополнительные данные", risk: "low", affected: "карточка " + d.id, changes: ["Карточка вернётся агенту с вашим запросом"], reversible: true, reasonLabel: "какие данные нужны" }, run: (r) => adminApi.decisionResolve(d.id, { verdict: "more_data", reason: r }) })}>Запросить данные</Btn>
                <Btn size="sm" variant="outline" disabled={busy} onClick={() => setConfirm({ spec: { title: "Изменить условие действия", risk: "medium", affected: "параметры исполнения", changes: ["Агент пересчитает прогноз с новым условием"], reversible: true, reasonLabel: "новое условие" }, run: (r) => adminApi.decisionResolve(d.id, { verdict: "edit_condition", reason: r, condition: r }) })}>Изменить условие</Btn>
                <Btn size="sm" variant="ghost" disabled={busy} onClick={() => setConfirm({ spec: { title: "Передать другому сотруднику", risk: "low", affected: "ответственный по карточке", changes: ["Карточка переназначится"], reversible: true, reasonLabel: "кому и почему" }, run: (r) => adminApi.decisionResolve(d.id, { verdict: "reassign", reason: r, assignee: admins.find((a) => a.name === r.split(":")[0])?.id || "operations" }) })}>Передать</Btn>
              </div>
            )}
            {d.resolution && (
              <section className="bg-success/5 border border-success/30 rounded-xl p-4 text-[13px]">
                <p className="font-bold text-ink mb-1">Решение принято</p>
                <p className="text-ink-soft">{d.resolution.by} · {new Date(d.resolution.at).toLocaleString("ru-RU")} · вердикт: {d.resolution.verdict}</p>
                <p className="text-ink-soft">Причина: {d.resolution.reason}</p>
                {d.resolution.result && <p className="text-ink-soft">Результат: {d.resolution.result}</p>}
                {d.resolution.double_confirm_admin_id && <p className="text-ink-soft">Второе подтверждение: {d.resolution.double_confirm_admin_id}</p>}
              </section>
            )}
            {!!detail.related_traces?.length && (
              <section><p className="text-[12px] font-bold uppercase text-ink-mute mb-2">Связанные запуски агента</p>
                {detail.related_traces.map((t: any) => <Link key={t.id} to="/admin/traces" className="block text-[12.5px] border border-line rounded-lg px-3 py-2 mb-1.5 no-underline text-ink hover:border-dark">trace {t.id} · {t.trigger} · {t.outcome}</Link>)}
              </section>
            )}
          </>
        ); })()}
      </Drawer>
      {confirm && <DangerConfirm spec={confirm.spec} busy={busy} onCancel={() => setConfirm(null)} onConfirm={async (reason, ct) => { setBusy(true); const r = await confirm.run(reason, { confirm_text: ct }); setBusy(false); setConfirm(null); if (r?.ok) { push("Готово — запись в неизменяемом журнале"); reload(); setOpenId(null); } else push(mapErrLocal(r), "err"); }} />}
    </div>
  );
}

/* ════════════════ POLICY ENGINE ════════════════ */
export function PoliciesScreen() {
  const { data, loading, error, reload } = useCabinetData<any>(() => adminApi.policies());
  const { can } = useCabinet(); const { push } = useToast();
  const [edit, setEdit] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  if (loading) return <LoadingBlock rows={6} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const d = data!;
  const save = async () => {
    setBusy(true);
    const r = await adminApi.policyUpdate(edit.id, { mode: edit.mode, risk: edit.risk, max_per_hour: edit.max_per_hour, max_money_rub: edit.max_money_rub, max_affected: edit.max_affected, enabled: edit.enabled, note: edit.note, reason: edit._reason });
    setBusy(false);
    if (r?.ok) { push("Политика обновлена. Кто/когда/до/после/почему — в журнале." + (edit.risk === "critical" ? " Критическое правило вступит в силу после периода проверки." : "")); setEdit(null); reload(); } else push(mapErrLocal(r), "err");
  };
  return (
    <div className="space-y-5">
      <Panel title="Policy Engine — границы автономности агента" sub="Что агент может сам · что только после подтверждения · что запрещено · лимиты · уровни риска">
        <DataTable rows={d.policies} rowKey={(p: any) => p.id} onRow={(p: any) => can("agent_manage") && setEdit({ ...p, _reason: "" })} cols={[
          { key: "action_type", title: "Тип действия", render: (p: any) => <span className="font-mono text-[12px]">{p.action_type}</span> },
          { key: "mode", title: "Режим", render: (p: any) => <Badge tone={p.mode === "auto" ? "success" : p.mode === "forbidden_auto" ? "error" : "warning"}>{MODE_POL[p.mode] || p.mode}</Badge> },
          { key: "risk", title: "Риск", render: (p: any) => <RiskTag r={p.risk} /> },
          { key: "max_per_hour", title: "/час", right: true },
          { key: "max_money_rub", title: "Деньги, ₽", right: true, render: (p: any) => fmtNum(p.max_money_rub) },
          { key: "max_affected", title: "Затронутых", right: true },
          { key: "effective_at", title: "В силе с", render: (p: any) => p.effective_at > Date.now() ? <span className="text-warning font-bold">{new Date(p.effective_at).toLocaleTimeString("ru-RU")} (проверка)</span> : <span className="text-success">активна</span> },
          { key: "version", title: "Версия", render: (p: any) => "v" + p.version },
        ]} />
        <p className="text-[12px] text-ink-mute mt-3">Уровни: низкий — агент действует сам и логирует; средний — предлагает, оператор подтверждает; высокий — профильный администратор; критический — двойное подтверждение + обязательная причина. Изменения критических правил не вступают мгновенно.</p>
      </Panel>
      <Panel title="Глобальные лимиты агента">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <Info label="Действий в час" v={d.limits.max_actions_per_hour} />
          <Info label="Макс. фин. влияние /сут" v={fmtRub(d.limits.max_money_impact_rub_day)} />
          <Info label="API-вызовов на запуск" v={d.limits.max_api_calls_per_run} />
          <Info label="Токенов /сут" v={fmtNum(d.limits.token_budget_per_day)} />
          <Info label="Стоимость /сут" v={fmtRub(d.limits.cost_budget_per_day_rub)} />
          <Info label="Запрещённые данные" v={d.limits.forbidden_data.join(", ")} />
        </div>
      </Panel>
      {edit && (
        <Drawer open onClose={() => setEdit(null)} title={"Политика: " + edit.action_type}>
          <Field label="Режим"><select className="field" value={edit.mode} onChange={(e) => setEdit({ ...edit, mode: e.target.value })}>{Object.entries(MODE_POL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Уровень риска"><select className="field" value={edit.risk} onChange={(e) => setEdit({ ...edit, risk: e.target.value })}>{["low", "medium", "high", "critical"].map((r) => <option key={r} value={r}>{r}</option>)}</select></Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Макс./час"><input className="field" type="number" value={edit.max_per_hour} onChange={(e) => setEdit({ ...edit, max_per_hour: +e.target.value })} /></Field>
            <Field label="Макс. ₽"><input className="field" type="number" value={edit.max_money_rub} onChange={(e) => setEdit({ ...edit, max_money_rub: +e.target.value })} /></Field>
            <Field label="Макс. объектов"><input className="field" type="number" value={edit.max_affected} onChange={(e) => setEdit({ ...edit, max_affected: +e.target.value })} /></Field>
          </div>
          <Field label="Комментарий"><textarea className="field" value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} /></Field>
          <Field label="Причина изменения" required hint="обязательна; попадёт в неизменяемый журнал вместе с до/после"><textarea className="field" value={edit._reason} onChange={(e) => setEdit({ ...edit, _reason: e.target.value })} /></Field>
          {edit.prev && <details className="text-[12px]"><summary className="cursor-pointer font-bold text-ink-soft">Что было до (v{edit.prev.version})</summary><pre className="bg-line-soft rounded-lg p-2 mt-1 overflow-x-auto">{JSON.stringify({ mode: edit.prev.mode, risk: edit.prev.risk, max_per_hour: edit.prev.max_per_hour, max_money_rub: edit.prev.max_money_rub }, null, 1)}</pre></details>}
          <Btn onClick={save} disabled={busy || edit._reason.trim().length < 5}>{busy ? "Сохранение…" : "Сохранить политику"}</Btn>
        </Drawer>
      )}
    </div>
  );
}
const MODE_POL: Record<string, string> = { auto: "сам (логирует)", confirm_operator: "подтверждает оператор", confirm_specialist: "профильный админ", forbidden_auto: "запрещено автоматически" };

/* ════════════════ TRACE EXPLORER / EVAL / ROI ════════════════ */
export function TracesScreen() {
  const { data, loading, error, reload } = useCabinetData<any>(() => adminApi.traces());
  const [sel, setSel] = useState<any>(null);
  if (loading) return <LoadingBlock rows={4} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  return (
    <div className="space-y-5">
      <Panel title="Agent Trace Explorer" sub="Полная цепочка каждого запуска: триггер → контекст → инструменты → рассуждения → ответ → решение человека">
        <DataTable rows={data!.traces} rowKey={(t: any) => t.id} onRow={(t: any) => setSel(t)} cols={[
          { key: "id", title: "Trace", mono: true }, { key: "trigger", title: "Триггер" },
          { key: "outcome", title: "Итог", render: (t: any) => <Badge tone={t.outcome === "blocked_by_policy" || t.error ? "error" : "success"}>{t.outcome}</Badge> },
          { key: "latency_ms", title: "мс", right: true }, { key: "cost_rub", title: "₽", right: true },
          { key: "ts", title: "Когда", render: (t: any) => timeAgo(t.ts) },
        ]} />
      </Panel>
      <Drawer open={!!sel} onClose={() => setSel(null)} title={"Запуск " + sel?.id} wide>
        {sel && (<>
          <div className="grid grid-cols-3 gap-2"><Info label="Триггер" v={sel.trigger} /><Info label="Стоимость" v={sel.cost_rub + " ₽ · " + fmtNum(sel.tokens_in) + "/" + fmtNum(sel.tokens_out) + " ток."} /><Info label="Задержка" v={sel.latency_ms + " мс"} /></div>
          <ol className="relative border-l-2 border-line ml-2 space-y-3 pl-5">
            {sel.steps.map((s: any) => (
              <li key={s.n} className="relative">
                <span className={cn("absolute -left-[27px] top-1 w-3.5 h-3.5 rounded-full border-2 border-surface", s.kind === "error" ? "bg-error" : s.kind === "policy" ? "bg-warning" : s.kind === "answer" ? "bg-success" : "bg-ai")} />
                <p className="text-[11px] uppercase font-bold text-ink-mute">{s.kind} · {s.ms} мс</p>
                <p className="text-[13px] text-ink">{s.text}</p>
              </li>
            ))}
          </ol>
          {sel.error && <p className="text-[13px] text-error font-semibold bg-error/5 border border-error/30 rounded-lg px-3 py-2">Ошибка: {sel.error}. Проверьте этап выше — данные / инструмент / промпт / контекст / интеграция.</p>}
          {sel.human_decision && <p className="text-[13px] text-ink bg-ai-soft rounded-lg px-3 py-2">Решение человека: {sel.human_decision}</p>}
        </>)}
      </Drawer>
    </div>
  );
}

export function EvalScreen() {
  const { data, loading, error, reload } = useCabinetData<any>(() => adminApi.eval());
  const { can } = useCabinet(); const { push } = useToast();
  const [busy, setBusy] = useState(false);
  if (loading) return <LoadingBlock rows={4} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const g = data!.gates;
  return (
    <div className="space-y-5">
      <Panel title="Evaluation Hub" sub="Golden datasets, регрессия перед обновлением, adversarial-тесты, quality gates"
        right={can("agent_manage") && <Btn size="sm" disabled={busy} onClick={async () => { setBusy(true); const r = await adminApi.evalRun("qf-agent-next"); setBusy(false); if (r?.ok) { push(r.gate.result === "blocked" ? "Quality gate БЛОКИРУЕТ релиз: найдена регрессия" : "Регрессия не найдена — gate пройден", r.gate.result === "blocked" ? "err" : "ok"); reload(); } }}>Прогнать регрессию</Btn>}>
        <DataTable rows={data!.suites} rowKey={(s: any) => s.suite} cols={[
          { key: "suite", title: "Сьют" }, { key: "total", title: "Кейсов", right: true }, { key: "passed", title: "Пройдено", right: true },
          { key: "acc", title: "Точность", render: (s: any) => <span className={s.acc > 0.9 ? "text-success font-bold" : "text-warning font-bold"}>{pct(s.acc)}</span> },
        ]} />
        <div className="mt-4 flex flex-wrap items-center gap-3 text-[13px]">
          <Badge tone={g.last_gate?.result === "passed" ? "success" : "error"}>Последний gate: {g.last_gate?.result} ({g.last_gate?.version})</Badge>
          <span className="text-ink-soft">Порог регрессии: −{pct(g.min_acc_vs_prev)} к предыдущей версии. Новая версия хуже по ключевым метрикам → релиз агента блокируется.</span>
        </div>
      </Panel>
    </div>
  );
}

export function RoiScreen() {
  const { data, loading, error, reload } = useCabinetData<any>(() => adminApi.roi());
  if (loading) return <LoadingBlock rows={4} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const { roi: r, pnl } = data!;
  return (
    <Panel title="AI ROI Center" sub="Бизнес-результат агента, а не «сделал 500 действий»: AI P&L по period/task/solution">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
        <Info label="Задач закрыто без человека" v={fmtNum(r.tasks_closed_no_human)} />
        <Info label="Часов команды сэкономлено" v={r.hours_saved_week + "/нед"} />
        <Info label="Предотвращено потерь" v={fmtRub(r.fraud_prevented_rub)} />
        <Info label="Предотвращено выплат" v={r.prevented_payouts + " подозрительных"} />
        <Info label="Споров меньше" v={"−" + r.disputes_reduced_pct + "%"} />
        <Info label="Поддержка быстрее" v={"+" + r.support_speedup_pct + "% (жалобы −30%)"} />
        <Info label="Конверсия" v={"+" + r.conversions_uplift_pct + "%"} />
        <Info label="Стоимость работы" v={fmtRub(r.cost_tokens_rub + r.cost_infra_rub + r.cost_control_rub + r.cost_errors_rub)} />
      </div>
      <p className="text-[12px] font-bold uppercase text-ink-mute mb-2">AI P&L</p>
      <div className="overflow-x-auto"><table className="w-full text-[13px]">
        <tbody>
          {[["Доход / предотвращённые потери", pnl.income_or_prevented_rub, true], ["Инфраструктура", -pnl.infra_rub], ["Токены и API", -pnl.tokens_api_rub], ["Человеческий контроль", -pnl.control_rub], ["Стоимость ошибок", -pnl.errors_rub], ["ИТОГО net", pnl.net_rub, true]].map(([k, v, bold]: any) => (
            <tr key={String(k)} className={cn("border-b border-line/50", bold && "font-bold")}><td className="py-2">{k}</td><td className={cn("py-2 text-right font-mono", Number(v) >= 0 ? "text-success" : "text-error")}>{fmtRub(Number(v))}</td></tr>
          ))}
        </tbody>
      </table></div>
    </Panel>
  );
}

/* ════════════════ РЕЛИЗ-ПЛАН ════════════════ */
const HYP_STATUSES: [string, string][] = [["review", "на рассмотрении"], ["approved", "одобрена"], ["backlog", "в бэклоге"], ["in_progress", "в работе"], ["validating", "валидация"], ["released", "в релизе"], ["rejected", "отклонена"]];

export function ReleasePlanScreen() {
  const { data, loading, error, reload } = useCabinetData<any>(() => adminApi.releasePlan());
  const { can, profile } = useCabinet(); const { push } = useToast();
  const [confirm, setConfirm] = useState<null | { spec: ConfirmSpec; run: (reason: string) => Promise<any> }>(null);
  const [busy, setBusy] = useState(false);
  /* редактор состава релиза: draft — редактируемый список пунктов */
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<{ hyp: string; prio: string; effort: string }[]>([]);
  const startEdit = () => { setDraft((data!.release?.items || []).map((it: any) => ({ ...it }))); setEditing(true); };
  const saveItems = () => setConfirm({
    spec: {
      title: "Обновить состав релиза " + (data!.release?.name || ""), risk: "medium",
      affected: `${draft.length} пунктов релиза`,
      changes: ["Состав релиза заменён на отредактированный", "Все изменения пишутся в журнал (до/после)"], reversible: true, reasonLabel: "почему меняем состав",
    },
    run: (r) => adminApi.releaseItems(data!.release.id, { items: draft, reason: r }),
  });
  if (loading) return <LoadingBlock rows={5} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const THEMES_RU: Record<string, string> = { critical_fixes: "Критические исправления", conversion: "Улучшения конверсии", complaints: "Снижение жалоб", search: "Улучшение поиска", delivery: "Оптимизация доставки", security: "Безопасность", sellers: "Удобство продавцов", support: "Улучшение поддержки", new_features: "Новые функции" };
  const PRIO_RU: Record<string, string> = { must: "must", should: "should", could: "could" };
  return (
    <div className="space-y-5">
      <Panel title={"План следующего релиза · " + (data!.release?.name || "")} sub="Агент группирует доработки по темам; администратор принимает состав, приоритеты и отправляет в разработку"
        right={<div className="flex gap-2">
          {can("releases_manage") && data!.release && !editing && <Btn size="sm" variant="outline" onClick={startEdit}>Редактировать состав</Btn>}
          {editing && <><Btn size="sm" disabled={!draft.length} onClick={saveItems}>Сохранить состав</Btn><Btn size="sm" variant="ghost" onClick={() => setEditing(false)}>Отмена</Btn></>}
          {!editing && can("releases_manage") && data!.release && <Btn size="sm" onClick={() => setConfirm({ spec: { title: "Отправить план в разработку", risk: "medium", affected: `${data!.release.items?.length ?? 0} пунктов релиза`, changes: ["Статус релиза → committed", "Задачи уходят в бэклог разработки"], reversible: true, reasonLabel: "цель релиза" }, run: (r) => adminApi.releasePlanCommit({ release_id: data!.release.id, reason: r }) })}>Отправить в разработку</Btn>}
        </div>}>
        {editing && (
          <div className="mb-4 border border-ai/30 bg-ai-soft rounded-xl p-4">
            <p className="text-[12px] font-bold uppercase text-ink-mute mb-2">Состав релиза (только гипотезы агента; при сохранении причина обязательна)</p>
            {draft.map((it, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 mb-2">
                <select className="field !h-9 !w-auto flex-1 min-w-40 text-[12.5px]" value={it.hyp} onChange={(e) => setDraft(draft.map((x, j) => j === i ? { ...x, hyp: e.target.value } : x))}>
                  {(data!.all_hypotheses || []).map((h: any) => <option key={h.id} value={h.id}>{h.id} · {String(h.title).slice(0, 60)}</option>)}
                </select>
                <select className="field !h-9 !w-auto text-[12.5px]" value={it.prio} onChange={(e) => setDraft(draft.map((x, j) => j === i ? { ...x, prio: e.target.value } : x))}>{Object.keys(PRIO_RU).map((p) => <option key={p}>{p}</option>)}</select>
                <select className="field !h-9 !w-16 text-[12.5px]" value={it.effort} onChange={(e) => setDraft(draft.map((x, j) => j === i ? { ...x, effort: e.target.value } : x))}>{["S", "M", "L"].map((p) => <option key={p}>{p}</option>)}</select>
                <Btn size="sm" variant="ghost" className="!text-error" onClick={() => setDraft(draft.filter((_, j) => j !== i))}>Удалить</Btn>
              </div>
            ))}
            <Btn size="sm" variant="outline" onClick={() => setDraft([...draft, { hyp: (data!.all_hypotheses || [])[0]?.id || "", prio: "should", effort: "M" }])}>+ Добавить пункт</Btn>
          </div>
        )}
        <div className="grid md:grid-cols-2 gap-3">
          {Object.entries(data!.themes).filter(([, items]: any) => (items as any[]).length).map(([theme, items]: any) => (
            <div key={theme} className="border border-line rounded-xl p-4">
              <p className="text-[12.5px] font-bold uppercase text-ai mb-2">{THEMES_RU[theme] || theme}</p>
              {(items as any[]).map((it) => (
                <article key={it.hyp_id} className="mb-3 last:mb-0 pb-3 last:pb-0 border-b border-line/50 last:border-0">
                  <p className="text-[13.5px] font-bold text-ink">{it.title}<span className="text-[11px] text-ink-mute font-normal ml-1.5 font-mono">{it.hyp_id}</span></p>
                  <dl className="text-[12px] text-ink-soft mt-1 space-y-0.5">
                    <p><b>Сейчас:</b> {it.current || it.broken}</p>
                    <p><b>Почему важно:</b> {it.why}</p>
                    <p><b>Кто затронут:</b> {it.who}</p>
                    <p><b>Решение:</b> {it.solution || "—"}</p>
                    <p><b>Ожидаемый результат:</b> {it.effect || "—"} · <b>Усилие:</b> {it.effort} · <b>Риски:</b> {it.risks || "—"}</p>
                    <p><b>Как измерить успех:</b> {it.measure || "—"}</p>
                  </dl>
                  <div className="flex flex-wrap gap-2 mt-2 items-center">
                    {can("view") && <>
                      <select className="field !h-8 !w-auto text-[11.5px]" defaultValue="" onChange={async (e) => { if (!e.target.value) return; const r = await adminApi.hypothesisPatch(it.hyp_id, { status: e.target.value, assignee: e.target.value === "backlog" || e.target.value === "approved" ? profile?.id || null : undefined, reason: "статус изменён из плана релиза: " + e.target.value }); if (r?.ok) { push("Статус гипотезы обновлён (кто/когда/до/после — в журнале)"); reload(); } else push(mapErrLocal(r), "err"); }}>
                        <option value="" disabled>Статус гипотезы…</option>
                        {HYP_STATUSES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                      <Btn size="sm" variant="ghost" onClick={async () => { const r = await adminApi.hypothesisPatch(it.hyp_id, { status: "backlog", reason: "перенесено в бэклог из плана релиза" }); if (r?.ok) { push("Перенесено в бэклог"); reload(); } else push(mapErrLocal(r), "err"); }}>В бэклог</Btn>
                      <Btn size="sm" variant="ghost" className="!text-error" onClick={async () => { const r = await adminApi.hypothesisPatch(it.hyp_id, { status: "rejected", reason: "отклонено при сборке релиза" }); if (r?.ok) { push("Предложение отклонено"); reload(); } else push(mapErrLocal(r), "err"); }}>Отклонить</Btn>
                    </>}
                  </div>
                </article>
              ))}
            </div>
          ))}
        </div>
      </Panel>
      {confirm && <DangerConfirm spec={confirm.spec} busy={busy} onCancel={() => setConfirm(null)} onConfirm={async (reason) => { setBusy(true); const r = await confirm.run(reason); setBusy(false); setConfirm(null); if (r?.ok) { push("План обновлён и зафиксирован в журнале"); setEditing(false); reload(); } else push(mapErrLocal(r), "err"); }} />}
    </div>
  );
}

/* ════════════════ ПОЛЬЗОВАТЕЛИ ════════════════ */
export function UsersScreen() {
  const [f, setF] = useState({ q: "", status: "", segment: "" });
  const { data, loading, error, reload } = useCabinetData<any>(() => adminApi.users(Object.fromEntries(Object.entries(f).filter(([, v]) => v)) as any), [f.q, f.status, f.segment]);
  const [sel, setSel] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [confirm, setConfirm] = useState<null | { spec: ConfirmSpec; run: (reason: string, ct: string) => Promise<any> }>(null);
  const [busy, setBusy] = useState(false);
  const { can } = useCabinet(); const { push } = useToast();
  const ACTIONS: [string, string, Risk, boolean][] = [["verify", "Верифицировать", "low", false], ["request_docs", "Запросить документы", "low", false], ["limit_functions", "Ограничить функции", "medium", false], ["block_temp", "Блокировать временно", "high", false], ["block_forever", "Блокировать навсегда", "critical", true], ["unblock", "Разблокировать", "medium", false], ["warn", "Отправить предупреждение", "low", false], ["compensate", "Начислить компенсацию", "high", false], ["delete_data", "Удалить персональные данные (GDPR)", "critical", true], ["export_data", "Экспортировать данные", "medium", false]];
  const open = async (u: any) => { setSel(u); const r = await adminApi.user(u.id); r?.ok && setDetail(r); };
  return (
    <div className="space-y-5">
      <Panel title="Пользователи" sub="Покупатели и их жизненный цикл" right={
        <div className="flex flex-wrap gap-2">
          <input className="field !h-9 !w-44 text-[12.5px]" placeholder="email, ID, имя, регион…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
          <select className="field !h-9 !w-auto text-[12.5px]" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="">Статус: все</option><option value="active">active</option><option value="blocked">blocked</option></select>
          <select className="field !h-9 !w-auto text-[12.5px]" value={f.segment} onChange={(e) => setF({ ...f, segment: e.target.value })}><option value="">Сегмент: все</option>{["new", "active", "vip", "sleeping", "risk", "seller_staff"].map((s) => <option key={s}>{s}</option>)}</select>
        </div>}>
        {loading ? <LoadingBlock rows={6} /> : error ? <ErrorState message={error} onRetry={reload} /> : (
          <DataTable rows={data!.users} rowKey={(u: any) => u.id} onRow={open} cols={[
            { key: "name", title: "Имя", render: (u: any) => <span className="font-semibold">{u.name}<br /><span className="text-ink-mute text-[11.5px] font-normal">{u.email} · {u.id}</span></span> },
            { key: "region", title: "Регион" }, { key: "segment", title: "Сегмент", render: (u: any) => <Badge tone={u.segment === "risk" ? "error" : u.segment === "vip" ? "premium" : "neutral"}>{u.segment}</Badge> },
            { key: "verified", title: "Вериф.", render: (u: any) => u.verified ? "✓" : "—" }, { key: "orders", title: "Заказов", right: true },
            { key: "spent_rub", title: "Сумма", right: true, render: (u: any) => fmtRub(u.spent_rub) }, { key: "complaints", title: "Жалоб", right: true },
            { key: "risk", title: "Риск", render: (u: any) => <span className={u.risk > 0.6 ? "text-error font-bold" : ""}>{u.risk.toFixed(2)}</span> },
            { key: "status", title: "Статус", render: (u: any) => <St s={u.status} /> },
          ]} />
        )}
      </Panel>
      <Drawer open={!!sel} onClose={() => { setSel(null); setDetail(null); }} title={sel?.name} wide>
        {sel && (<>
          <div className="grid grid-cols-2 gap-2">
            <Info label="Email (маска)" v={sel.email} /><Info label="Телефон (маска)" v={sel.phone || "—"} />
            <Info label="LTV" v={sel.lifetime} /><Info label="Бонусы" v={fmtRub(sel.bonuses)} />
            <Info label="Устройств" v={sel.devices} /><Info label="Последний вход" v={timeAgo(sel.last_login)} />
          </div>
          <section><p className="text-[12px] font-bold uppercase text-ink-mute mb-1.5">Действия администратора (каждое требует причины и пишется в журнал)</p>
            <div className="flex flex-wrap gap-2">
              {ACTIONS.filter(([id, , , ], i) => can(id.includes("export") ? "export" : "manage_users")).map(([id, label, risk, irre]) => (
                <Btn key={id} size="sm" variant={irre ? "outline" : "ghost"} className={irre ? "!text-error !border-error/40" : ""} onClick={() => setConfirm({
                  spec: { title: label + " · " + sel.name, risk: risk as Risk, affected: `аккаунт ${sel.id}`, changes: [label], reversible: !irre, requireConfirmText: irre, reasonLabel: "почему" },
                  run: (reason, ct) => adminApi.userAction(sel.id, { action: id, reason, confirm_text: ct }),
                })}>{label}</Btn>
              ))}
            </div>
          </section>
          {detail && (<>
            <section><p className="text-[12px] font-bold uppercase text-ink-mute mb-1.5">Заказы · споры · тикеты</p>
              <div className="flex flex-wrap gap-2 text-[12px]">
                {(detail.orders || []).slice(0, 4).map((o: any) => <Link key={o.id} to="/admin/orders" className="border border-line rounded-lg px-2.5 py-1 no-underline text-ink hover:border-dark">{o.number}</Link>)}
                {(detail.disputes || []).map((x: any) => <Link key={x.id} to="/admin/disputes" className="border border-error/40 text-error rounded-lg px-2.5 py-1 no-underline">{x.id} спор</Link>)}
                {(detail.tickets || []).map((x: any) => <Link key={x.id} to="/admin/support" className="border border-line rounded-lg px-2.5 py-1 no-underline text-ink">{x.id}</Link>)}
              </div>
            </section>
            <section><p className="text-[12px] font-bold uppercase text-ink-mute mb-1.5">Действия администраторов по пользователю</p>
              {!detail.actions?.length ? <p className="text-[12.5px] text-ink-mute">Действий не выполнялось.</p> : detail.actions.map((a: any, i: number) => <p key={i} className="text-[12px] text-ink-soft py-1 border-b border-line/40">{new Date(a.ts).toLocaleString("ru-RU")} · <b>{a.type}</b> · {a.admin_id} · {a.reason}</p>)}
            </section>
          </>)}
        </>)}
      </Drawer>
      {confirm && <DangerConfirm spec={confirm.spec} busy={busy} onCancel={() => setConfirm(null)} onConfirm={async (reason, ct) => { setBusy(true); const r = await confirm.run(reason, ct); setBusy(false); setConfirm(null); if (r?.ok) { push("Действие выполнено и записано в журнал"); reload(); } else push(mapErrLocal(r), "err"); }} />}
    </div>
  );
}

/* ════════════════ ПРОДАВЦЫ ════════════════ */
export function SellersScreen() {
  const { data, loading, error, reload } = useCabinetData<any>(() => adminApi.sellers());
  const [sel, setSel] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [confirm, setConfirm] = useState<null | { spec: ConfirmSpec; run: (reason: string, ct: string) => Promise<any> }>(null);
  const [busy, setBusy] = useState(false);
  const { can } = useCabinet(); const { push } = useToast();
  const ACTS: [string, string, Risk, boolean][] = [["approve", "Одобрить продавца", "low", false], ["reject", "Отклонить", "medium", false], ["request_docs", "Запросить документы", "low", false], ["limit_categories", "Ограничить категории", "medium", false], ["visibility_down", "Понизить видимость", "medium", false], ["freeze_payouts", "Заморозить выплаты", "high", false], ["block", "Заблокировать", "critical", false], ["unblock", "Разблокировать", "medium", false], ["audit", "Назначить проверку", "medium", false], ["warn", "Предупреждение", "low", false], ["fine", "Начислить штраф", "high", false], ["close_account", "Закрыть аккаунт", "critical", true]];
  return (
    <div className="space-y-5">
      <Panel title="Продавцы" sub="Поставщики, магазины и партнёры · онбординг, качество, репутация, финансы">
        {loading ? <LoadingBlock rows={5} /> : error ? <ErrorState message={error} onRetry={reload} /> : (
          <DataTable rows={data!.sellers} rowKey={(s: any) => s.id} onRow={async (s: any) => { setSel(s); const r = await adminApi.seller(s.id); r?.ok && setDetail(r); }} cols={[
            { key: "name", title: "Продавец", render: (s: any) => <span className="font-semibold">{s.name}<br /><span className="text-ink-mute text-[11.5px] font-normal">ИНН {s.inn} · {s.region} · {s.cat}</span></span> },
            { key: "verified", title: "Вериф.", render: (s: any) => s.verified ? "✓" : "—" }, { key: "rating", title: "Рейтинг", render: (s: any) => s.rating || "—" },
            { key: "products", title: "Товаров", right: true }, { key: "orders30", title: "Заказов 30д", right: true },
            { key: "cancels14", title: "Отмен 14д", right: true, render: (s: any) => s.cancels14 > 5 ? <span className="text-error font-bold">{s.cancels14}</span> : s.cancels14 },
            { key: "disputes", title: "Споров", right: true }, { key: "balance_rub", title: "Баланс", right: true, render: (s: any) => fmtRub(s.balance_rub) },
            { key: "risk_score", title: "Риск", render: (s: any) => <span className={s.risk_score > 0.6 ? "text-error font-bold" : ""}>{s.risk_score.toFixed(2)}</span> },
            { key: "status", title: "Статус", render: (s: any) => <St s={s.status} /> },
          ]} />
        )}
      </Panel>
      <Drawer open={!!sel} onClose={() => { setSel(null); setDetail(null); }} title={sel?.name} wide>
        {sel && (<>
          <div className="grid grid-cols-2 gap-2">
            <Info label="Статус" v={<St s={sel.status} />} /><Info label="Документы" v={sel.docs_status} />
            <Info label="Баланс" v={fmtRub(sel.balance_rub)} /><Info label="Ожидает выплаты" v={fmtRub(sel.pending_payout_rub)} />
            <Info label="Жалобы" v={sel.complaints} /><Info label="Нарушения" v={sel.violations.length ? sel.violations.map((v: any) => v.text).join("; ") : "нет"} />
          </div>
          <section><p className="text-[12px] font-bold uppercase text-ink-mute mb-1.5">Онбординг и контроль качества</p>
            <div className="flex flex-wrap gap-1.5">{["регистрация", "верификация", "документы", "реквизиты", "категории", "лицензии", "правила", "активация"].map((st, i) => <Badge key={st} tone={i <= (sel.verified ? 7 : 2) ? "success" : "neutral"}>{st}</Badge>)}</div>
          </section>
          {can("manage_sellers") && (
            <section><p className="text-[12px] font-bold uppercase text-ink-mute mb-1.5">Действия (причина обязательна)</p>
              <div className="flex flex-wrap gap-2">{ACTS.map(([id, label, risk, irre]) => (
                <Btn key={id} size="sm" variant={irre ? "outline" : "ghost"} className={irre ? "!text-error !border-error/40" : ""} onClick={() => setConfirm({
                  spec: { title: label + " · " + sel.name, risk, affected: `${sel.name}: ${sel.products} товаров, ${sel.orders30} заказов, баланс ${fmtRub(sel.balance_rub)}`, changes: [label], reversible: !irre, requireConfirmText: irre },
                  run: (reason, ct) => adminApi.sellerAction(sel.id, { action: id, reason, confirm_text: ct }),
                })}>{label}</Btn>
              ))}</div>
            </section>
          )}
          {detail && (<>
            <section><p className="text-[12px] font-bold uppercase text-ink-mute mb-1.5">Финансы и модерация</p>
              <div className="flex flex-wrap gap-2 text-[12px]">{(detail.payouts || []).map((p: any) => <Link key={p.id} to="/admin/finance" className="border border-line rounded-lg px-2.5 py-1 no-underline text-ink">{p.id} {fmtRub(p.amount_rub)} <St s={p.status} /></Link>)}
                {(detail.moderation || []).map((m: any) => <Link key={m.id} to="/admin/catalog" className="border border-warning/40 rounded-lg px-2.5 py-1 no-underline text-ink">{m.title} — {m.reason}</Link>)}
              </div></section>
            <section><p className="text-[12px] font-bold uppercase text-ink-mute mb-1.5">История действий администраторов</p>
              {!detail.actions?.length ? <p className="text-[12.5px] text-ink-mute">Действий не выполнялось.</p> : detail.actions.map((a: any, i: number) => <p key={i} className="text-[12px] text-ink-soft py-1 border-b border-line/40">{new Date(a.ts).toLocaleString("ru-RU")} · <b>{a.type}</b> · {a.reason}</p>)}
            </section>
          </>)}
        </>)}
      </Drawer>
      {confirm && <DangerConfirm spec={confirm.spec} busy={busy} onCancel={() => setConfirm(null)} onConfirm={async (reason, ct) => { setBusy(true); const r = await confirm.run(reason, ct); setBusy(false); setConfirm(null); if (r?.ok) { push("Действие выполнено, запись в журнале"); reload(); } else push(mapErrLocal(r), "err"); }} />}
    </div>
  );
}

/* ════════════════ КАТАЛОГ / МОДЕРАЦИЯ ════════════════ */
export function CatalogScreen() {
  const { data, loading, error, reload } = useCabinetData<any>(() => adminApi.moderation());
  const [sel, setSel] = useState<any>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const { can } = useCabinet(); const { push } = useToast();
  if (loading) return <LoadingBlock rows={5} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const decide = async (verdict: string) => {
    setBusy(true);
    const r = await adminApi.modDecision(sel.id, { verdict, reason: verdict === "approve" ? "ок" : reason });
    setBusy(false);
    if (r?.ok) { push("Решение по товару сохранено, продавцу уйдёт понятное уведомление"); setSel(null); setReason(""); reload(); } else push(mapErrLocal(r), "err");
  };
  return (
    <div className="space-y-5">
      <Panel title="Очередь модерации товаров" sub="Новые, изменённые, с жалобами, подозрительной ценой, дубли, без сертификатов, отмеченные агентом">
        <DataTable rows={data!.queue} rowKey={(m: any) => m.id} onRow={setSel} cols={[
          { key: "title", title: "Товар", render: (m: any) => <span className="font-semibold">{m.photos.join("")} {m.title}<br /><span className="text-ink-mute text-[11.5px] font-normal">{m.product} · продавец {m.seller} · {fmtRub(m.price)}</span></span> },
          { key: "category", title: "Категория" },
          { key: "reason", title: "Почему в очереди", render: (m: any) => <span className="text-warning font-semibold">{m.reason}</span> },
          { key: "auto_check", title: "Автопроверка", render: (m: any) => <span className="text-[11.5px]">{Object.entries(m.auto_check).map(([k, v]: any) => <span key={k} className={cn("mr-1.5", v === true || v === "warn" || v === "suspect" ? "text-error" : "text-success")}>{k}:{String(v === true ? "!" : v)}</span>)}</span> },
          { key: "changed_at", title: "Изменён", render: (m: any) => timeAgo(m.changed_at) },
          { key: "status", title: "Статус", render: (m: any) => <St s={m.status} /> },
        ]} />
      </Panel>
      <Panel title="Менеджер категорий и брендов" sub="Вложенность, атрибуты, фильтры, SEO, правила модерации · бренды, производители, сертификаты">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">{data!.categories.map((c: any) => (
            <div key={c.id} className="border border-line rounded-xl px-3.5 py-2.5 text-[12.5px]">
              <p className="font-bold text-ink">{c.title} {c.parent && <span className="text-ink-mute font-normal">← внутри {c.parent}</span>} <Badge tone={c.moderation === "strict_docs" ? "error" : c.moderation === "manual_kids" ? "warning" : "neutral"}>модерация: {c.moderation}</Badge></p>
              <p className="text-ink-soft mt-0.5">Атрибуты: {c.attrs.join(", ")} · Фильтры: {c.filters.join(", ")} · SEO: {c.seo}</p>
            </div>
          ))}</div>
          <div className="space-y-2">{data!.brands.map((b: any) => (
            <div key={b.id} className="border border-line rounded-xl px-3.5 py-2.5 text-[12.5px]">
              <p className="font-bold text-ink">{b.title} <span className="font-normal text-ink-mute">· {b.producer}</span></p>
              <p className="text-ink-soft">Сертификаты: {b.certs.join(", ") || "нет"} · Категории: {b.allowed_cats.join(", ")}</p>
            </div>
          ))}</div>
        </div>
      </Panel>
      <Drawer open={!!sel} onClose={() => setSel(null)} title={sel?.title}>
        {sel && (<>
          <div className="grid grid-cols-2 gap-2"><Info label="Артикул" v={sel.product} /><Info label="Цена" v={fmtRub(sel.price)} /><Info label="Продавец" v={sel.seller} /><Info label="Категория" v={sel.category} /></div>
          <p className="text-[13px] bg-warning/5 border border-warning/30 rounded-lg px-3 py-2"><b>Причина в очереди:</b> {sel.reason}</p>
          <pre className="text-[11px] bg-line-soft rounded-lg p-3">{JSON.stringify(sel.auto_check)}</pre>
          {can("moderate") && (<>
            <Field label="Причина отклонения / снятия (продавцу уйдёт понятное уведомление)"><textarea className="field" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Например: отсутствует сертификат ЕАЭС" /></Field>
            <div className="flex flex-wrap gap-2">
              <Btn size="sm" disabled={busy} onClick={() => decide("approve")}>Одобрить</Btn>
              <Btn size="sm" variant="outline" disabled={busy || reason.trim().length < 5} onClick={() => decide("reject")}>Отклонить</Btn>
              <Btn size="sm" variant="outline" disabled={busy || !reason.trim()} onClick={() => decide("request_fix")}>Запросить исправление</Btn>
              <Btn size="sm" variant="outline" disabled={busy || !reason.trim()} onClick={() => decide("hide")}>Скрыть</Btn>
              <Btn size="sm" variant="outline" className="!text-error !border-error/40" disabled={busy || !reason.trim()} onClick={() => decide("unpublish")}>Снять с публикации</Btn>
            </div>
          </>)}
        </>)}
      </Drawer>
    </div>
  );
}

/* ════════════════ ЗАКАЗЫ ════════════════ */
export function OrdersScreen() {
  const [f, setF] = useState({ q: "", status: "" });
  const { data, loading, error, reload } = useCabinetData<any>(() => adminApi.orders(Object.fromEntries(Object.entries(f).filter(([, v]) => v)) as any), [f.q, f.status]);
  const [sel, setSel] = useState<any>(null);
  const [confirm, setConfirm] = useState<null | { spec: ConfirmSpec; run: (reason: string) => Promise<any> }>(null);
  const [busy, setBusy] = useState(false);
  const { can } = useCabinet(); const { push } = useToast();
  const OPS: [string, string, Risk][] = [["cancel", "Отмена заказа", "medium"], ["partial_refund", "Частичный возврат", "high"], ["full_refund", "Полный возврат", "high"], ["replace_item", "Замена товара", "medium"], ["extend_delivery", "Продлить срок доставки", "low"], ["change_address", "Изменить адрес", "medium"], ["confirm_payment", "Ручное подтверждение оплаты", "high"], ["close_manual", "Ручное закрытие", "medium"], ["compensate", "Компенсация", "high"]];
  return (
    <div className="space-y-5">
      <Panel title="Журнал заказов" sub="Единый журнал жизненного цикла сделок · поиск по номеру, покупателю, продавцу, статусу"
        right={<div className="flex gap-2">
          <input className="field !h-9 !w-44 text-[12.5px]" placeholder="номер, покупатель…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
          <select className="field !h-9 !w-auto text-[12.5px]" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="">Все статусы</option>{["paid", "shipped", "delivered", "cancelled", "received"].map((s) => <option key={s}>{s}</option>)}</select>
        </div>}>
        {loading ? <LoadingBlock rows={6} /> : error ? <ErrorState message={error} onRetry={reload} /> : (
          <DataTable rows={data!.orders} rowKey={(o: any) => o.id} onRow={setSel} cols={[
            { key: "number", title: "Номер", mono: true, render: (o: any) => <span className="font-bold">{o.number}</span> },
            { key: "buyer", title: "Покупатель", mono: true }, { key: "seller", title: "Продавец", mono: true },
            { key: "total_rub", title: "Сумма", right: true, render: (o: any) => fmtRub(o.total_rub) },
            { key: "pay_method", title: "Оплата" }, { key: "delivery_method", title: "Доставка" }, { key: "region", title: "Регион" },
            { key: "status", title: "Статус", render: (o: any) => <St s={o.status} /> },
            { key: "created_at", title: "Создан", render: (o: any) => new Date(o.created_at).toLocaleDateString("ru-RU") },
          ]} />
        )}
      </Panel>
      <Drawer open={!!sel} onClose={() => setSel(null)} title={"Заказ " + sel?.number}>
        {sel && (<>
          <div className="grid grid-cols-2 gap-2"><Info label="Статус" v={<St s={sel.status} />} /><Info label="Сумма" v={fmtRub(sel.total_rub)} /><Info label="Покупатель" v={sel.buyer} /><Info label="Продавец" v={sel.seller} /><Info label="Оплата" v={sel.pay_method} /><Info label="Доставка" v={sel.delivery_method + " · " + sel.region} /></div>
          <section><p className="text-[12px] font-bold uppercase text-ink-mute mb-1.5">Состав</p>{(sel.items || []).map((it: any, i: number) => <p key={i} className="text-[13px] text-ink py-1 border-b border-line/40">{it.title || "товар"} × {it.qty} — {fmtRub(it.price * (it.qty || 1))}</p>)}</section>
          <section><p className="text-[12px] font-bold uppercase text-ink-mute mb-1.5">Автоматические правила</p>
            <ul className="text-[12px] text-ink-soft list-disc pl-5 space-y-0.5"><li>Продавец долго не подтверждает → предупреждение</li><li>Нарушен срок доставки → риск-флаг</li><li>Открыт спор → заказ связывается со спором</li><li>Платёж не прошёл → перевод статуса</li></ul></section>
          {can("orders_write") && (
            <section><p className="text-[12px] font-bold uppercase text-ink-mute mb-1.5">Ручные операции (причина + подтверждение + журнал)</p>
              <div className="flex flex-wrap gap-2">{OPS.map(([id, label, risk]) => (
                <Btn key={id} size="sm" variant="ghost" onClick={() => setConfirm({
                  spec: { title: label + " · " + sel.number, risk, affected: `заказ ${sel.number}, ${fmtRub(sel.total_rub)}`, changes: [label], reversible: !id.includes("refund"), reasonLabel: "почему" },
                  run: (reason) => adminApi.orderOp(sel.id, { op: id, reason, amount: sel.total_rub }),
                })}>{label}</Btn>
              ))}</div></section>
          )}
        </>)}
      </Drawer>
      {confirm && <DangerConfirm spec={confirm.spec} busy={busy} onCancel={() => setConfirm(null)} onConfirm={async (reason) => { setBusy(true); const r = await confirm.run(reason); setBusy(false); setConfirm(null); if (r?.ok) { push("Операция выполнена и записана"); reload(); } else push(mapErrLocal(r), "err"); }} />}
    </div>
  );
}

/* ════════════════ ФИНАНСЫ ════════════════ */
export function FinanceScreen() {
  const { data, loading, error, reload } = useCabinetData<any>(() => adminApi.finance());
  const [confirm, setConfirm] = useState<null | { spec: ConfirmSpec; run: (reason: string) => Promise<any> }>(null);
  const [busy, setBusy] = useState(false);
  const { can, profile } = useCabinet(); const { push } = useToast();
  const [second, setSecond] = useState("");
  const [admins, setAdmins] = useState<any[]>([]);
  useEffect(() => { adminApi.settings().then((r: any) => r?.ok && setAdmins(r.admins || [])); }, []);
  if (loading) return <LoadingBlock rows={6} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const d = data!;
  const decidePayout = (p: any, verdict: string) => {
    const overLimit = p.amount_rub > d.thresholds.payout_confirm_threshold_rub;
    setConfirm({
      spec: {
        title: `${verdict.toUpperCase()} выплату ${p.id}`, risk: "critical",
        affected: `${p.seller}: ${fmtRub(p.amount_rub)} (${overLimit ? "выше лимита " + fmtRub(d.thresholds.payout_confirm_threshold_rub) : "в пределах лимита"})`,
        changes: [`Статус выплаты → ${verdict}`], reversible: false, requireConfirmText: true, reasonLabel: "финансовое обоснование",
        extra: overLimit ? <Field label="Второй подтверждающий (разделение полномочий)" required><select className="field" value={second} onChange={(e) => setSecond(e.target.value)}><option value="">— выберите —</option>{admins.filter((a) => a.id !== profile?.id).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field> : null,
      },
      run: (reason) => adminApi.payoutDecision(p.id, { verdict, reason, ...(overLimit ? { second_approver_token: "double:" + second, double_confirm_admin_id: second } : {}) }),
    });
  };
  return (
    <div className="space-y-5">
      <Panel title="Обзор финансов" sub="GMV · выручка сервиса · комиссии · возвраты · выплаты · холды · маржа · аномалии">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Info label="GMV" v={fmtRub(d.overview?.gmv || 0)} /><Info label="Выручка сервиса" v={fmtRub(d.overview?.revenue || 0)} />
          <Info label="Чистая маржа" v={fmtRub(d.overview?.margin || 0)} /><Info label="Отмены / возвраты" v={`${d.overview?.cancels ?? "—"} / ${d.overview?.refunds ?? "—"}`} />
        </div>
      </Panel>
      <Panel title="Платёжные транзакции" sub="Шлюзы · ошибки · повторные списания · chargeback · связь с заказом/спором">
        <DataTable rows={d.transactions} rowKey={(t: any) => t.id} cols={[
          { key: "id", title: "ID", mono: true }, { key: "type", title: "Тип" }, { key: "order", title: "Заказ", mono: true, render: (t: any) => t.order || "—" },
          { key: "amount_rub", title: "Сумма", right: true, render: (t: any) => fmtRub(t.amount_rub) }, { key: "gateway", title: "Шлюз" }, { key: "status", title: "Статус", render: (t: any) => <St s={t.status} /> },
          { key: "ts", title: "Когда", render: (t: any) => timeAgo(t.ts) },
        ]} />
      </Panel>
      <div className="grid lg:grid-cols-2 gap-5">
        <Panel title="Правила комиссий" sub="Категории · продавцы · акции · регионы · периоды">
          <DataTable rows={d.commission_rules} rowKey={(c: any) => c.id} cols={[
            { key: "scope", title: "Область" }, { key: "pct", title: "%", right: true }, { key: "period", title: "Период" },
            { key: "active", title: "", render: (c: any) => <Badge tone={c.active ? "success" : "neutral"}>{c.active ? "вкл" : "выкл"}</Badge> },
            { key: "reason", title: "Причина" },
          ]} />
          {can("finance_write") && <Btn size="sm" variant="outline" className="mt-3" onClick={() => setConfirm({ spec: { title: "Создать правило комиссии", risk: "high", affected: "все подходящие сделки", changes: ["Новое активное правило"], reversible: true, reasonLabel: "основание" }, run: (r) => adminApi.commissionCreate({ scope: "promo:winter", pct: 6, period: "2026-12", reason: r }) })}>+ Новое правило</Btn>}
        </Panel>
        <Panel title="Очередь выплат" sub={`Порог подтверждения: ${fmtRub(d.thresholds.payout_confirm_threshold_rub)} · подозрительные выплаты автоматически в проверке`}>
          <div className="space-y-2">{d.payouts.map((p: any) => (
            <div key={p.id} className="border border-line rounded-xl px-3.5 py-2.5 flex flex-wrap items-center gap-2 text-[13px]">
              <span className="font-mono text-[12px]">{p.id}</span><span className="font-semibold">{p.seller}</span><span>{fmtRub(p.amount_rub)}</span><St s={p.status} />
              {p.hold && <Badge tone="warning">холд</Badge>}
              {p.status === "needs_approval" && can("finance_write") && <>
                <Btn size="sm" onClick={() => decidePayout(p, "approve")}>Одобрить</Btn>
                <Btn size="sm" variant="outline" onClick={() => decidePayout(p, "hold")}>Холд 24ч</Btn>
                <Btn size="sm" variant="outline" className="!text-error" onClick={() => decidePayout(p, "reject")}>Отклонить</Btn>
              </>}
            </div>
          ))}</div>
        </Panel>
      </div>
      <Panel title="Сверка" sub="Заказы ↔ платежи ↔ комиссии ↔ выплаты ↔ бухгалтерия; расхождения → задачи">
        <DataTable rows={d.reconciliation} rowKey={(r: any) => r.id} cols={[
          { key: "diff", title: "Расхождение" }, { key: "delta_rub", title: "Δ ₽", right: true, render: (r: any) => <span className={r.delta_rub < 0 ? "text-error" : "text-success"}>{fmtRub(r.delta_rub)}</span> },
          { key: "status", title: "Статус", render: (r: any) => <St s={r.status} /> }, { key: "found_at", title: "Найдено", render: (r: any) => timeAgo(r.found_at) },
        ]} />
      </Panel>
      {confirm && <DangerConfirm spec={confirm.spec} busy={busy} onCancel={() => setConfirm(null)} onConfirm={async (reason) => { setBusy(true); const r = await confirm.run(reason); setBusy(false); setConfirm(null); if (r?.ok) { push("Финансовая операция выполнена и записана"); reload(); } else push(mapErrLocal(r), "err"); }} />}
    </div>
  );
}

/* ════════════════ СПОРЫ ════════════════ */
export function DisputesScreen() {
  const { data, loading, error, reload } = useCabinetData<any>(() => adminApi.disputes());
  const [sel, setSel] = useState<any>(null);
  const [confirm, setConfirm] = useState<null | { spec: ConfirmSpec; run: (reason: string) => Promise<any> }>(null);
  const [busy, setBusy] = useState(false);
  const { can } = useCabinet(); const { push } = useToast();
  if (loading) return <LoadingBlock rows={4} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const VERDICTS = [["full_refund", "Полный возврат"], ["partial_refund", "Частичный возврат"], ["replace", "Замена товара"], ["deny", "Отказ в возврате"], ["compensate_buyer", "Компенсация покупателю"], ["fine_seller", "Штраф продавцу"], ["warn_seller", "Предупреждение продавцу"], ["block_seller", "Блокировка продавца"], ["legal", "Юридический процесс"]];
  return (
    <div className="space-y-5">
      <Panel title="Спор-центр" sub="SLA и эскалации: просроченные споры автоматически поднимаются в приоритет старшему оператору">
        <DataTable rows={data!.disputes} rowKey={(x: any) => x.id} onRow={setSel} cols={[
          { key: "id", title: "№", mono: true }, { key: "order", title: "Заказ", mono: true, render: (x: any) => <Link to="/admin/orders" className="text-accent-deep">{x.order}</Link> },
          { key: "reason", title: "Причина" }, { key: "amount_rub", title: "Сумма", right: true, render: (x: any) => fmtRub(x.amount_rub) },
          { key: "status", title: "Статус", render: (x: any) => <St s={x.status} /> },
          { key: "deadline", title: "Дедлайн", render: (x: any) => x.overdue ? <span className="text-error font-bold">просрочен</span> : dueIn(x.deadline) },
          { key: "rec", title: "Рекомендация агента", render: (x: any) => x.agent_summary?.recommendation || "—" },
        ]} />
      </Panel>
      <Drawer open={!!sel} onClose={() => setSel(null)} title={"Спор " + sel?.id} wide>
        {sel && (<>
          <div className="grid grid-cols-2 gap-2"><Info label="Заказ" v={sel.order} /><Info label="Покупатель" v={sel.buyer} /><Info label="Продавец" v={sel.seller} /><Info label="Сумма" v={fmtRub(sel.amount_rub)} /><Info label="SLA" v={sel.sla_hours + " ч"} /><Info label="Дедлайн" v={sel.overdue ? "просрочен" : dueIn(sel.deadline)} /></div>
          <section><p className="text-[12px] font-bold uppercase text-ink-mute mb-1.5">Предварительное резюме агента (финальное решение — человек)</p>
            <div className="bg-ai-soft border border-ai/20 rounded-xl p-4 text-[13px] space-y-1.5">
              <p><b>Суть:</b> {sel.agent_summary?.essence}</p>
              <p><b>Версия покупателя:</b> {sel.agent_summary?.versions?.buyer}</p>
              <p><b>Версия продавца:</b> {sel.agent_summary?.versions?.seller}</p>
              <p><b>Похожие кейсы:</b> {sel.agent_summary?.similar_cases} · <b>Рекомендация:</b> {sel.agent_summary?.recommendation} (уверенность {pct(sel.agent_summary?.confidence || 0)})</p>
              <p className="text-[11.5px] text-ai">Источники: {sel.evidence.join("; ")}</p>
            </div></section>
          {sel.resolution && <p className="text-[13px] bg-success/5 border border-success/30 rounded-lg px-3 py-2">Решено: <b>{sel.resolution.verdict}</b> · {sel.resolution.by} · {sel.resolution.reason}</p>}
          {sel.status !== "resolved" && can("disputes_resolve") && (
            <section><p className="text-[12px] font-bold uppercase text-ink-mute mb-1.5">Решение по спору</p>
              <div className="flex flex-wrap gap-2">{VERDICTS.map(([id, label]) => (
                <Btn key={id} size="sm" variant="ghost" className={id === "block_seller" ? "!text-error" : ""} onClick={() => setConfirm({
                  spec: { title: label + " · спор " + sel.id, risk: id === "block_seller" ? "critical" : id.includes("refund") || id === "legal" ? "high" : "medium", affected: `покупатель ${sel.buyer}, продавец ${sel.seller}, ${fmtRub(sel.amount_rub)}`, changes: [label], reversible: id !== "legal", reasonLabel: "обоснование решения" },
                  run: (reason) => adminApi.disputeResolve(sel.id, { verdict: id, reason }),
                })}>{label}</Btn>
              ))}</div>
              <p className="text-[11.5px] text-ink-mute mt-2">После закрытия агент проанализирует причины и предложит превентивную гипотезу.</p>
            </section>
          )}
        </>)}
      </Drawer>
      {confirm && <DangerConfirm spec={confirm.spec} busy={busy} onCancel={() => setConfirm(null)} onConfirm={async (reason) => { setBusy(true); const r = await confirm.run(reason); setBusy(false); setConfirm(null); if (r?.ok) { push("Спор закрыт, агент построил превенцию"); reload(); } else push(mapErrLocal(r), "err"); }} />}
    </div>
  );
}

/* ════════════════ ПОДДЕРЖКА ════════════════ */
export function SupportScreen() {
  const { data, loading, error, reload } = useCabinetData<any>(() => adminApi.support());
  const [sel, setSel] = useState<any>(null);
  const { can } = useCabinet(); const { push } = useToast();
  if (loading) return <LoadingBlock rows={5} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const d = data!;
  return (
    <div className="space-y-5">
      <Panel title="Метрики поддержки" sub="Время первого ответа · решение · CSAT · повторные обращения · закрыто агентом · причины эскалаций">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <Info label="Первый ответ" v={d.metrics.first_resp_min + " мин"} /><Info label="Решение" v={d.metrics.solve_h + " ч"} /><Info label="CSAT" v={d.metrics.csat} />
          <Info label="Повторных" v={d.metrics.reopen_pct + "%"} /><Info label="Закрыто агентом" v={d.metrics.ai_closed_pct + "%"} />
        </div>
      </Panel>
      <Panel title="Омниканальный inbox" sub="Чат · email · соцсети · формы · внутренние обращения — единая очередь с SLA">
        <DataTable rows={d.tickets} rowKey={(t: any) => t.id} onRow={setSel} cols={[
          { key: "id", title: "№", mono: true }, { key: "channel", title: "Канал" },
          { key: "subject", title: "Тема", render: (t: any) => <span className="font-semibold">{t.subject}<br /><span className="text-ink-mute text-[11px] font-normal">{t.tags?.join(", ")} · {t.order || t.user}</span></span> },
          { key: "priority", title: "Приоритет", render: (t: any) => <Badge tone={t.priority === "high" ? "error" : "neutral"}>{t.priority}</Badge> },
          { key: "status", title: "Статус", render: (t: any) => <St s={t.status} /> },
          { key: "sla_due", title: "SLA", render: (t: any) => t.sla_due < Date.now() ? <span className="text-error font-bold">просрочен</span> : dueIn(t.sla_due) },
        ]} />
      </Panel>
      <Drawer open={!!sel} onClose={() => setSel(null)} title={"Тикет " + sel?.id}>
        {sel && (<>
          <p className="text-[14px] font-bold text-ink">{sel.subject}</p>
          <div className="grid grid-cols-2 gap-2"><Info label="Канал" v={sel.channel} /><Info label="Статус" v={<St s={sel.status} />} /><Info label="SLA" v={dueIn(sel.sla_due)} /><Info label="Связи" v={[sel.user, sel.order].filter(Boolean).join(" · ") || "—"} /></div>
          <section><p className="text-[12px] font-bold uppercase text-ink-mute mb-1.5">AI-ассистент первого уровня</p><p className="text-[13px] bg-ai-soft border border-ai/20 rounded-xl p-3.5">{sel.ai_summary}</p></section>
          {can("support_write") && (
            <div className="flex flex-wrap gap-2">
              <Btn size="sm" onClick={async () => { await adminApi.ticketAssign(sel.id, "взял в работу"); push("Назначен ответственный"); reload(); setSel(null); }}>Взять в работу</Btn>
              <Btn size="sm" variant="outline" onClick={async () => { const r = await adminApi.ticketClose(sel.id, "решено по макросу: " + d.macros[0]); if (r?.ok) { push("Тикет закрыт"); reload(); setSel(null); } else push(mapErrLocal(r), "err"); }}>Закрыть по шаблону</Btn>
            </div>
          )}
          <section><p className="text-[12px] font-bold uppercase text-ink-mute mb-1.5">Макросы</p><div className="flex flex-wrap gap-1.5">{d.macros.map((m: string) => <Badge key={m} tone="neutral">{m}</Badge>)}</div></section>
        </>)}
      </Drawer>
    </div>
  );
}

/* ════════════════ БЕЗОПАСНОСТЬ ════════════════ */
export function SecurityScreen() {
  const { data, loading, error, reload } = useCabinetData<any>(() => adminApi.security());
  const [confirm, setConfirm] = useState<null | { spec: ConfirmSpec; run: (reason: string, ct: string) => Promise<any> }>(null);
  const [busy, setBusy] = useState(false);
  const [subj, setSubj] = useState({ type: "user", id: "", days: "30" });
  const { can } = useCabinet(); const { push } = useToast();
  if (loading) return <LoadingBlock rows={6} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const d = data!;
  return (
    <div className="space-y-5">
      <Panel title="Fraud Operations Center" sub="Подозрительные пользователи, продавцы, заказы, платежи, устройства, IP — риск-скоринг, флаги, рекомендация агента">
        <DataTable rows={d.fraud} rowKey={(f: any) => f.type + f.id} cols={[
          { key: "type", title: "Тип" }, { key: "id", title: "Объект", mono: true },
          { key: "risk", title: "Риск", render: (f: any) => <span className={f.risk > 0.7 ? "text-error font-bold" : ""}>{f.risk.toFixed(2)}</span> },
          { key: "flags", title: "Флаги", render: (f: any) => f.flags.map((x: string) => <Badge key={x} tone="warning">{x}</Badge>) },
          { key: "linked", title: "Связанные", render: (f: any) => f.linked.join(", ") },
          { key: "recommendation", title: "Рекомендация агента" },
        ]} />
      </Panel>
      <Panel title="Граф связей" sub="Мультиаккаунты, общие устройства/IP/реквизиты, накрутка отзывов, фиктивные заказы">
        <div className="flex flex-wrap gap-2 text-[12px]">
          {d.graph.nodes.map((n: any) => <span key={n.id} className="px-2.5 py-1 rounded-full border border-line bg-surface font-mono">{n.t}:{n.id}</span>)}
        </div>
        <ul className="mt-3 space-y-1 text-[12.5px] text-ink-soft">{d.graph.edges.map((e: any, i: number) => <li key={i}>• {e[0]} —<b>{e[2]}</b>→ {e[1]}</li>)}</ul>
      </Panel>
      <div className="grid lg:grid-cols-2 gap-5">
        <Panel title="Правила антифрода">
          <div className="space-y-2">{d.rules.map((r: any) => (
            <div key={r.id} className="flex items-center justify-between border border-line rounded-xl px-3.5 py-2.5 text-[13px]">
              <span>{r.title}</span><span className="flex items-center gap-2"><span className="text-ink-mute text-[11.5px]">{r.hits_7d} срабатываний/7д</span><Badge tone={r.enabled ? "success" : "neutral"}>{r.enabled ? "вкл" : "выкл"}</Badge></span>
            </div>
          ))}</div>
        </Panel>
        <Panel title="Блокировки и апелляции" sub="Каждая блокировка: причина, срок, доказательства, право на апелляцию">
          {can("security_manage") && (
            <div className="flex flex-wrap gap-2 mb-3 items-end">
              <Field label="Объект"><select className="field !h-9" value={subj.type} onChange={(e) => setSubj({ ...subj, type: e.target.value })}>{["user", "seller", "device", "ip", "payment_method", "product", "category"].map((x) => <option key={x}>{x}</option>)}</select></Field>
              <Field label="ID"><input className="field !h-9 !w-28" value={subj.id} onChange={(e) => setSubj({ ...subj, id: e.target.value })} placeholder="u-123" /></Field>
              <Field label="Дней (0=навсегда)"><input className="field !h-9 !w-20" type="number" value={subj.days} onChange={(e) => setSubj({ ...subj, days: e.target.value })} /></Field>
              <Btn size="sm" disabled={!subj.id} onClick={() => setConfirm({ spec: { title: "Создать блокировку", risk: subj.days === "0" ? "critical" : "high", affected: `${subj.type}:${subj.id}`, changes: [subj.days === "0" ? "Пожизненная блокировка" : `Блокировка на ${subj.days} дней`, "Пользователь получит уведомление и право апелляции"], reversible: subj.days !== "0", requireConfirmText: subj.days === "0" }, run: (reason, ct) => adminApi.blockCreate({ subject_type: subj.type, subject: subj.id, days: +subj.days || 0, reason, confirm_text: ct }) })}>Заблокировать</Btn>
            </div>
          )}
          <div className="space-y-2">{d.blocks.map((b: any) => (
            <div key={b.id} className="border border-line rounded-xl px-3.5 py-2.5 text-[12.5px]">
              <p className="font-semibold text-ink">{b.subject_type}:{b.subject} <Badge tone={b.permanent ? "error" : "warning"}>{b.permanent ? "навсегда" : "до " + new Date(b.until).toLocaleDateString("ru-RU")}</Badge></p>
              <p className="text-ink-soft">{b.reason} · доказательства: {b.evidence.join(", ")}</p>
            </div>
          ))}</div>
          <p className="text-[12px] font-bold uppercase text-ink-mute mt-4 mb-2">Апелляции (агент готовит материалы, решение — администратор)</p>
          {d.appeals.map((ap: any) => (
            <div key={ap.id} className="border border-warning/40 bg-warning/5 rounded-xl px-3.5 py-2.5 text-[12.5px]">
              <p className="font-semibold">{ap.id} · {ap.who} против {ap.block} · <St s={ap.status} /></p>
              <p className="text-ink-soft my-1">{ap.materials}</p>
              {can("security_manage") && ap.status === "awaiting_admin" && (
                <div className="flex gap-2">
                  <Btn size="sm" onClick={() => setConfirm({ spec: { title: "Апелляция: снять блокировку", risk: "high", affected: ap.block, changes: ["Блокировка снята"], reversible: false, reasonLabel: "почему" }, run: (r) => adminApi.appealDecision(ap.id, { verdict: "lift", reason: r }) })}>Снять блокировку</Btn>
                  <Btn size="sm" variant="outline" onClick={() => setConfirm({ spec: { title: "Апелляция: отказать", risk: "medium", affected: ap.who, changes: ["Блокировка сохранена"], reversible: true, reasonLabel: "почему" }, run: (r) => adminApi.appealDecision(ap.id, { verdict: "decline", reason: r }) })}>Отказать</Btn>
                </div>
              )}
            </div>
          ))}
        </Panel>
      </div>
      <Panel title="Журнал безопасности (входы, коды, устройства, IP, регион, попытки)" sub="Append-only: записи только добавляются">
        <DataTable rows={d.sec_log.slice(0, 30)} rowKey={(l: any) => l.id} cols={[
          { key: "ts", title: "Время", render: (l: any) => new Date(l.ts).toLocaleString("ru-RU") },
          { key: "type", title: "Событие" }, { key: "result", title: "Результат", render: (l: any) => <Badge tone={l.result === "success" ? "success" : l.result === "fail" || l.result === "blocked" ? "error" : "warning"}>{l.result}</Badge> },
          { key: "ip", title: "IP", mono: true }, { key: "device_id", title: "Устройство" }, { key: "region", title: "Регион" }, { key: "detail", title: "Детали" },
        ]} />
      </Panel>
      {confirm && <DangerConfirm spec={confirm.spec} busy={busy} onCancel={() => setConfirm(null)} onConfirm={async (reason, ct) => { setBusy(true); const r = await confirm.run(reason, ct); setBusy(false); setConfirm(null); if (r?.ok) { push("Запись в неизменяемом журнале безопасности"); reload(); } else push(mapErrLocal(r), "err"); }} />}
    </div>
  );
}

/* ════════════════ КОНТЕНТ ════════════════ */
export function ContentScreen() {
  const { data, loading, error, reload } = useCabinetData<any>(() => adminApi.content());
  const [confirm, setConfirm] = useState<null | { spec: ConfirmSpec; run: (reason: string) => Promise<any> }>(null);
  const [busy, setBusy] = useState(false);
  const { can } = useCabinet(); const { push } = useToast();
  if (loading) return <LoadingBlock rows={4} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  return (
    <div className="space-y-5">
      <Panel title="Кампании коммуникаций" sub="Email · push · SMS · внутренние сообщения · объявления. Массовые рассылки — только после предпросмотра размера аудитории, примера и тестовой отправки">
        <div className="space-y-3">{data!.campaigns.map((c: any) => (
          <div key={c.id} className="border border-line rounded-xl p-4">
            <div className="flex flex-wrap items-center gap-2 text-[13px]"><Badge tone="dark">{c.channel}</Badge><b>{c.subject}</b><St s={c.status} /><span className="text-ink-mute">аудитория: {fmtNum(c.size)}</span><span className="text-ink-mute">{c.audience}</span></div>
            <p className="text-[12px] text-ink-soft mt-1">Доставлено {fmtNum(c.stats.delivered)} · открыто {fmtNum(c.stats.opened)} · клики {fmtNum(c.stats.clicked)} · отписки {fmtNum(c.stats.unsub)}</p>
            {can("content_publish") && c.status === "scheduled" && (
              <div className="flex gap-2 mt-2">
                <Btn size="sm" variant="ghost" onClick={async () => { const r = await adminApi.campaignSend(c.id, { test_only: true, reason: "тест" }); push("Тестовое письмо отправлено на служебный ящик"); }}>Тестовая отправка</Btn>
                <Btn size="sm" onClick={() => setConfirm({ spec: { title: "Массовая рассылка: " + c.subject, risk: "high", affected: `${fmtNum(c.size)} получателей (${c.audience})`, changes: ["Отправка email/push кампании", "Отменить можно до начала доставки"], reversible: false, reasonLabel: "цель кампании" }, run: (r) => adminApi.campaignSend(c.id, { reason: r }) })}>Отправить всем</Btn>
              </div>
            )}
          </div>
        ))}</div>
      </Panel>
      <Panel title="Шаблоны уведомлений" sub="События платформы → канонические тексты (черновик/предпросмотр/публикация/версии/откат — в редакторе)">
        <DataTable rows={data!.templates} rowKey={(t: any) => t.key} cols={[
          { key: "key", title: "Событие", mono: true }, { key: "title", title: "Шаблон" }, { key: "channel", title: "Канал" }, { key: "updated_at", title: "Обновлён", render: (t: any) => timeAgo(t.updated_at) },
        ]} />
      </Panel>
      {confirm && <DangerConfirm spec={confirm.spec} busy={busy} onCancel={() => setConfirm(null)} onConfirm={async (reason) => { setBusy(true); const r = await confirm.run(reason); setBusy(false); setConfirm(null); if (r?.ok) { push(`Кампания в очереди (затронет ${fmtNum(r.affected)})`); reload(); } else push(mapErrLocal(r), "err"); }} />}
    </div>
  );
}

/* ════════════════ АНАЛИТИКА ════════════════ */
export function AnalyticsScreen() {
  const { data, loading, error, reload } = useCabinetData<any>(() => adminApi.analytics());
  if (loading) return <LoadingBlock rows={6} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const d = data!;
  const chart = (d.metrics || []).map((m: any) => ({ ts: new Date(m.ts).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }), GMV: m.gmv / 1000, Выручка: m.revenue / 1000 }));
  return (
    <div className="space-y-5">
      <Panel title="Динамика GMV / выручки сервиса" sub="тыс. ₽ за 30 дней — нажмите любую точку для перехода к разборам сегментов">
        <div className="h-56"><ResponsiveContainer width="100%" height="100%"><LineChart data={chart}><XAxis dataKey="ts" tick={{ fontSize: 10 }} interval={4} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Line type="monotone" dataKey="GMV" stroke="#d98e32" strokeWidth={2} /><Line type="monotone" dataKey="Выручка" stroke="#2d5f4c" strokeWidth={2} /></LineChart></ResponsiveContainer></div>
      </Panel>
      <div className="grid lg:grid-cols-2 gap-5">
        <Panel title="Воронка покупателей"><Funnel steps={d.buyer_funnel} /></Panel>
        <Panel title="Воронка продавцов"><Funnel steps={d.seller_funnel} /></Panel>
      </div>
      <div className="grid lg:grid-cols-2 gap-5">
        <Panel title="Когорты (retention, %)"><DataTable rows={d.cohorts} rowKey={(c: any) => c.c} cols={[{ key: "c", title: "Когорта" }, { key: "d7", title: "D7" }, { key: "d30", title: "D30", render: (c: any) => c.d30 ?? "—" }, { key: "d90", title: "D90", render: (c: any) => c.d90 ?? "—" }]} /></Panel>
        <Panel title="Поисковая аналитика" sub="Популярные запросы · без результатов · низкая конверсия — clicкабельно ведёт в модуль улучшения поиска">
          <p className="text-[11.5px] font-bold uppercase text-ink-mute mb-1">Топ запросов</p>{d.search.top.map((s: any) => <Link key={s[0]} to="/admin/search-analytics" className="inline-block text-[12px] bg-line-soft rounded-full px-2.5 py-1 mr-1.5 mb-1.5 no-underline text-ink">{s[0]} · {fmtNum(s[1])}</Link>)}
          <p className="text-[11.5px] font-bold uppercase text-ink-mute mt-2 mb-1">Без результатов</p>{d.search.noresult.map((s: any) => <span key={s[0]} className="inline-block text-[12px] bg-error/10 text-error rounded-full px-2.5 py-1 mr-1.5 mb-1.5">{s[0]} · {fmtNum(s[1])}</span>)}
        </Panel>
      </div>
      <Panel title="Анализ проблем" sub="Где бросают процесс, какие шаги дают жалобы, категории споров, нарушители сроков">
        <DataTable rows={d.problems} rowKey={(p: any) => p.area} cols={[{ key: "area", title: "Область" }, { key: "drop_pct", title: "Отвал, %", right: true }, { key: "complaints", title: "Жалоб", right: true, render: (p: any) => p.complaints ? <span className="text-error font-bold">{p.complaints}</span> : "0" }]} />
      </Panel>
      <Panel title="Объяснение от агента" sub="Не только графики: что произошло, какие сегменты затронуты, какие гипотезы, что рекомендуется">
        {d.agent_insights.map((x: any, i: number) => (
          <div key={i} className="flex items-start gap-2.5 bg-ai-soft border border-ai/20 rounded-xl px-4 py-3 mb-2 text-[13px]">
            <Zap size={15} className="text-ai mt-0.5 shrink-0" /><span className="flex-1">{x.text}</span>
            <span className="flex gap-1">{x.links.map((l: string) => <Link key={l} to={l.startsWith("hyp") ? "/admin/agent" : "/admin/security"} className="text-[11px] font-bold text-ai underline">{l}</Link>)}</span>
          </div>
        ))}
      </Panel>
    </div>
  );
}
const Funnel = ({ steps }: { steps: any[] }) => {
  const max = steps[0]?.v || 1;
  return <div className="space-y-1.5">{steps.map((s) => (
    <div key={s.step} className="flex items-center gap-2 text-[12px]"><span className="w-36 shrink-0 text-ink-soft">{s.step}</span><div className="h-5 rounded-r-md bg-accent/80" style={{ width: Math.max(4, (s.v / max) * 100) + "%" }} /><span className="font-bold text-ink">{s.v}%</span></div>
  ))}</div>;
};

/* ════════════════ РЕЛИЗЫ / ФЛАГИ / AB ════════════════ */
export function ReleasesScreen() {
  const { data, loading, error, reload } = useCabinetData<any>(() => adminApi.releases());
  const [confirm, setConfirm] = useState<null | { spec: ConfirmSpec; run: (reason: string) => Promise<any> }>(null);
  const [busy, setBusy] = useState(false);
  const { can } = useCabinet(); const { push } = useToast();
  if (loading) return <LoadingBlock rows={5} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const d = data!;
  return (
    <div className="space-y-5">
      <Panel title="Roadmap и релизы" sub="Release control tower: статус, состав, цель, эффект, риски, критерии успеха, пост-анализ">
        {d.releases.map((r: any) => (
          <div key={r.id} className="border border-line rounded-xl p-4 mb-3 last:mb-0">
            <div className="flex flex-wrap items-center gap-2 text-[13px]"><b>{r.name}</b><St s={r.status} /><span className="text-ink-mute">дата: {new Date(r.target).toLocaleDateString("ru-RU")}</span><span className="text-ink-mute">владелец: {r.owner}</span></div>
            <p className="text-[12.5px] text-ink-soft mt-1">Цель: {r.goal} · Успех: {r.success} {r.risks && <>· Риски: {r.risks}</>}</p>
            <div className="flex flex-wrap gap-1.5 mt-2">{r.items.map((it: any) => <Badge key={it.hyp} tone={it.prio === "must" ? "warning" : "neutral"}>{it.hyp} · {it.prio} · {it.effort}</Badge>)}</div>
            {r.log.map((l: any, i: number) => <p key={i} className="text-[11.5px] text-ink-mute mt-1">▸ {new Date(l.ts).toLocaleDateString("ru-RU")} {l.text}</p>)}
          </div>
        ))}
      </Panel>
      <Panel title="Feature flags" sub="Процент пользователей, регион, роль, сегмент; каждое изменение: кто/когда/зачем/до/после">
        <DataTable rows={d.flags} rowKey={(f: any) => f.id} cols={[
          { key: "name", title: "Флаг", mono: true }, { key: "rollout_pct", title: "Раскатка", render: (f: any) => f.rollout_pct + "%" },
          { key: "segment", title: "Сегмент" }, { key: "note", title: "Комментарий" },
          { key: "history", title: "История", render: (f: any) => f.history.length ? f.history.slice(-1)[0].from + "%→" + f.history.slice(-1)[0].to + "% (" + f.history.slice(-1)[0].reason + ")" : "—" },
          { key: "_t", title: "Управление", render: (f: any) => can("releases_manage") ? <div onClick={(e) => e.stopPropagation()} className="flex gap-1.5">
            <Btn size="sm" variant="ghost" onClick={() => setConfirm({ spec: { title: "Флаг " + f.name + " → 100%", risk: "high", affected: "вся аудитория", changes: ["Функция включается всем"], reversible: true, reasonLabel: "почему раскатываем" }, run: (r) => adminApi.flagToggle(f.id, { rollout_pct: 100, reason: r }) })}>100%</Btn>
            <Btn size="sm" variant="ghost" onClick={() => setConfirm({ spec: { title: "Флаг " + f.name + " → выкл", risk: "medium", affected: "текущий сегмент " + f.rollout_pct + "%", changes: ["Функция отключается (rollback)"], reversible: true, reasonLabel: "почему откат" }, run: (r) => adminApi.flagToggle(f.id, { rollout_pct: 0, reason: r }) })}>Выкл</Btn>
          </div> : <span className="text-ink-mute text-[11px]">нет права</span> },
        ]} />
      </Panel>
      <Panel title="A/B-тесты" sub="Гипотеза · метрика успеха · выборка · стоп-правила · результат; ухудшение ключевых метрик → предложение остановки и отката">
        {d.tests.map((t: any) => (
          <div key={t.id} className="border border-line rounded-xl p-4 text-[13px]">
            <p className="font-bold">{t.hypothesis} {t.stopped && <Badge tone="error">остановлен: {t.stop_reason}</Badge>}</p>
            <p className="text-ink-soft text-[12.5px] mt-1">Метрика: {t.metric} · {t.sample} · {t.duration_days} дней · стоп-правило: {t.stop_rule}</p>
            {t.result && <p className="text-[12.5px] mt-1">A {t.result.variant_a} vs B {t.result.variant_b} → <b className="text-success">лифт {t.result.lift_pct}%</b> · {t.result.verdict}</p>}
            {can("releases_manage") && !t.stopped && <Btn size="sm" variant="outline" className="mt-2 !text-error" onClick={() => setConfirm({ spec: { title: "Остановить тест " + t.id, risk: "medium", affected: "выборка теста вернётся к контролю", changes: ["Тест остановлен", "Рекомендация: откат варианта B"], reversible: false, reasonLabel: "почему" }, run: (r) => adminApi.testStop(t.id, r) })}>Остановить тест</Btn>}
          </div>
        ))}
      </Panel>
      <Panel title="Бэклог доработок (RICE/MoSCoW, источник: жалоба/гипотеза агента/инцидент/аналитика)">
        <DataTable rows={d.backlog} rowKey={(h: any) => h.id} cols={[
          { key: "title", title: "Задача", render: (h: any) => <span className="font-semibold">{h.title}<br /><span className="text-ink-mute text-[11px] font-normal">источник: {h.obs_id || "идея"} · сегмент: {h.segment}</span></span> },
          { key: "priority", title: "Приоритет", render: (h: any) => <Badge tone={h.priority === "P1" ? "error" : h.priority === "P2" ? "warning" : "neutral"}>{h.priority}</Badge> },
          { key: "impact_volume", title: "Reach" }, { key: "confidence", title: "Confidence", render: (h: any) => pct(h.confidence) },
          { key: "expected_effect", title: "Impact" }, { key: "validation", title: "Критерий успеха" }, { key: "status", title: "Статус", render: (h: any) => <St s={h.status} /> },
        ]} />
      </Panel>
      {confirm && <DangerConfirm spec={confirm.spec} busy={busy} onCancel={() => setConfirm(null)} onConfirm={async (reason) => { setBusy(true); const r = await confirm.run(reason); setBusy(false); setConfirm(null); if (r?.ok) { push("Изменение зафиксировано (кто/когда/зачем/до/после)"); reload(); } else push(mapErrLocal(r), "err"); }} />}
    </div>
  );
}

/* ════════════════ НАСТРОЙКИ ════════════════ */
export function SettingsScreen() {
  const { data, loading, error, reload } = useCabinetData<any>(() => adminApi.settings());
  const [confirm, setConfirm] = useState<null | { spec: ConfirmSpec; run: (reason: string) => Promise<any> }>(null);
  const [busy, setBusy] = useState(false);
  const { can } = useCabinet(); const { push } = useToast();
  if (loading) return <LoadingBlock rows={6} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const d = data!;
  const MODES_RU: Record<string, string> = { normal: "Обычный режим", maintenance: "Технические работы", readonly: "Read-only", degraded: "Деградация функций", emergency: "Аварийный режим" };
  return (
    <div className="space-y-5">
      <Panel title="Режим платформы и окружение" sub="Пользователи при спец-режиме получают понятное уведомление; опасные действия в production визуально выделены">
        <div className="flex flex-wrap gap-2 mb-3">{Object.entries(MODES_RU).map(([k, v]) => (
          <button key={k} disabled={!can("settings_write")} onClick={() => setConfirm({ spec: { title: "Режим платформы → " + v, risk: k === "emergency" ? "critical" : "high", affected: "все пользователи и продавцы", changes: [v + (k !== "normal" ? "; верхний баннер-уведомление на сайте" : "; обычный режим")], reversible: true, reasonLabel: "почему переключаем" }, run: (r) => adminApi.settingsPatch({ platform_mode: k, reason: r }) })}
            className={cn("px-3.5 py-2 rounded-xl border text-[12.5px] font-bold cursor-pointer transition-colors", d.settings.platform_mode === k ? "bg-dark text-cream border-dark" : "border-line text-ink hover:border-dark")}>{v}</button>
        ))}</div>
        <div className="grid grid-cols-2 gap-2"><Info label="Окружение" v={<Badge tone={d.settings.env === "production" ? "error" : "success"}>{d.settings.env}</Badge>} /><Info label="Порог подтверждения выплат" v={fmtRub(d.settings.limits_cfg.payout_confirm_threshold_rub)} /><Info label="Авто-возврат до" v={fmtRub(d.settings.limits_cfg.refund_auto_limit_rub)} /><Info label="Макс. холд" v={d.settings.limits_cfg.hold_max_days + " дн"} /></div>
      </Panel>
      <Panel title="Правила платформы" sub="Версионируются; каждое изменение — с причиной и записью до/после">
        <div className="grid md:grid-cols-2 gap-2">{Object.entries(d.settings.rules).map(([k, v]: any) => (
          <div key={k} className="border border-line rounded-xl px-3.5 py-2.5 text-[12.5px]"><p className="font-bold uppercase text-[10.5px] text-ink-mute">{k}</p><p className="text-ink">{v}</p></div>
        ))}</div>
      </Panel>
      <Panel title="Интеграции" sub="Статус · версия · ошибки · лимиты · ключи · история сбоев">
        <DataTable rows={d.integrations} rowKey={(i: any) => i.key} cols={[
          { key: "title", title: "Сервис" }, { key: "status", title: "Статус", render: (i: any) => <St s={i.status} /> }, { key: "version", title: "Версия" },
          { key: "errors_24h", title: "Ошибок/24ч", right: true, render: (i: any) => i.errors_24h ? <span className="text-error font-bold">{i.errors_24h}</span> : "0" },
          { key: "limits", title: "Лимиты" }, { key: "keys_ok", title: "Ключи", render: (i: any) => i.keys_ok ? "✓" : "✗" },
          { key: "incidents", title: "Сбои", render: (i: any) => i.incidents.length ? i.incidents[i.incidents.length - 1].text : "—" },
          { key: "_r", title: "", render: (i: any) => can("settings_write") ? <div onClick={(e) => e.stopPropagation()}><Btn size="sm" variant="ghost" onClick={async () => { const r = await adminApi.integrationRetry(i.key, "ручной health-check интеграции из кабинета"); if (r?.ok) { push("Health-check выполнен", "ok"); } else push(mapErrLocal(r), "err"); reload(); }}>Проверить</Btn></div> : null },
        ]} />
      </Panel>
      <Panel title="Роли и доступы (RBAC на сервере)" sub="Минимальные привилегии; granular permissions; разделение полномочий; 2FA email-код сейчас, passkey/FIDO2 — следующая версия для Super Admin / Finance / AI Ops">
        <DataTable rows={Object.entries(d.roles).map(([k, v]: any) => ({ key: k, ...v }))} rowKey={(r: any) => r.key} cols={[
          { key: "title", title: "Роль", render: (r: any) => <b>{r.title}</b> },
          { key: "sections", title: "Разделы", render: (r: any) => r.sections.includes("*") ? "все" : r.sections.length + " шт" },
          { key: "perms", title: "Права", render: (r: any) => <span className="text-[11px]">{r.perms.slice(0, 8).join(", ")}{r.perms.length > 8 ? "…" : ""}</span> },
        ]} />
        <p className="text-[12px] text-ink-mute mt-3">Администраторы: {d.admins.map((a: any) => a.email + " (" + a.role + ")").join(" · ")}</p>
      </Panel>
      {confirm && <DangerConfirm spec={confirm.spec} busy={busy} onCancel={() => setConfirm(null)} onConfirm={async (reason) => { setBusy(true); const r = await confirm.run(reason); setBusy(false); setConfirm(null); if (r?.ok) { push("Настройка применена и записана"); reload(); } else push(mapErrLocal(r), "err"); }} />}
    </div>
  );
}

/* ════════════════ ЖУРНАЛЫ ════════════════ */
export function LogsScreen() {
  const [tab, setTab] = useState<"actions" | "security">("actions");
  const [f, setF] = useState({ type: "", risk: "" });
  const { data, loading, error, reload } = useCabinetData<any>(() => tab === "actions" ? adminApi.logsActions(Object.fromEntries(Object.entries(f).filter(([, v]) => v)) as any) : adminApi.logsSecurity(), [tab, f.type, f.risk]);
  if (loading) return <LoadingBlock rows={8} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const rows = tab === "actions" ? data!.logs : data!.logs;
  return (
    <Panel title="Журналы и аудит" sub="Append-only: кто · когда · устройство/IP · объект · тип действия · значения до и после · причина · результат. Экспорт для аудита, юристов, бухгалтерии и регуляторов."
      right={<div className="flex gap-2 flex-wrap">
        <button onClick={() => setTab("actions")} className={cn("px-3 py-1.5 rounded-lg text-[12px] font-bold cursor-pointer", tab === "actions" ? "bg-dark text-cream" : "bg-line-soft text-ink-soft")}>Действия</button>
        <button onClick={() => setTab("security")} className={cn("px-3 py-1.5 rounded-lg text-[12px] font-bold cursor-pointer", tab === "security" ? "bg-dark text-cream" : "bg-line-soft text-ink-soft")}>Безопасность</button>
        <a href={"/api/admin/logs/export?kind=" + tab} className="px-3 py-1.5 rounded-lg text-[12px] font-bold bg-accent text-ink no-underline">Экспорт CSV</a>
      </div>}>
      {tab === "actions" && <div className="flex gap-2 mb-3">
        <input className="field !h-9 !w-48 text-[12.5px]" placeholder="фильтр по типу (user.block…)" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} />
        <select className="field !h-9 !w-auto text-[12.5px]" value={f.risk} onChange={(e) => setF({ ...f, risk: e.target.value })}><option value="">Любой риск</option>{["low", "medium", "high", "critical"].map((r) => <option key={r}>{r}</option>)}</select>
      </div>}
      <DataTable rows={rows} rowKey={(l: any) => l.id} cols={tab === "actions" ? [
        { key: "ts", title: "Время", render: (l: any) => new Date(l.ts).toLocaleString("ru-RU") },
        { key: "admin_id", title: "Кто", mono: true }, { key: "type", title: "Действие", mono: true }, { key: "object", title: "Объект", mono: true },
        { key: "prev_state", title: "До", render: (l: any) => l.prev_state ? JSON.stringify(l.prev_state).slice(0, 40) : "—" },
        { key: "state", title: "После", render: (l: any) => l.state ? JSON.stringify(l.state).slice(0, 40) : "—" },
        { key: "reason", title: "Причина" }, { key: "risk", title: "Риск", render: (l: any) => l.risk ? <RiskTag r={l.risk} /> : "—" },
      ] : [
        { key: "ts", title: "Время", render: (l: any) => new Date(l.ts).toLocaleString("ru-RU") },
        { key: "type", title: "Событие" }, { key: "result", title: "Результат", render: (l: any) => <Badge tone={l.result === "success" ? "success" : "error"}>{l.result}</Badge> },
        { key: "ip", title: "IP", mono: true }, { key: "device_id", title: "Устройство" }, { key: "region", title: "Регион" }, { key: "detail", title: "Детали" },
      ]} />
    </Panel>
  );
}

/* ════════════════ ПОИСК-МОДУЛЬ (подраздел каталога) ════════════════ */
export function SearchAnalyticsScreen() {
  const { data, loading, error, reload } = useCabinetData<any>(() => adminApi.analytics());
  if (loading) return <LoadingBlock rows={4} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const d = data!;
  return (
    <div className="space-y-5">
      <Panel title="Модуль поиска" sub="Популярные запросы · пустые выдачи · синонимы · стоп-слова · веса · рекомендации агента">
        <div className="grid md:grid-cols-3 gap-4">
          <div><p className="text-[11.5px] font-bold uppercase text-ink-mute mb-1.5">Популярные</p>{d.search.top.map((s: any) => <p key={s[0]} className="text-[13px] py-1 border-b border-line/40">{s[0]} <span className="text-ink-mute float-right">{fmtNum(s[1])}</span></p>)}</div>
          <div><p className="text-[11.5px] font-bold uppercase text-ink-mute mb-1.5">Без результатов</p>{d.search.noresult.map((s: any) => <p key={s[0]} className="text-[13px] py-1 border-b border-line/40 text-error">{s[0]} <span className="text-ink-mute float-right">{fmtNum(s[1])}</span></p>)}</div>
          <div><p className="text-[11.5px] font-bold uppercase text-ink-mute mb-1.5">Низкая конверсия</p>{d.search.lowconv.map((s: any) => <p key={s[0]} className="text-[13px] py-1 border-b border-line/40">{s[0]} <span className="text-ink-mute float-right">{(s[1] * 100).toFixed(1)}%</span></p>)}</div>
        </div>
        <p className="text-[12.5px] text-ink-soft mt-3 bg-ai-soft border border-ai/20 rounded-lg px-3 py-2"><Sparkles size={13} className="inline mr-1 text-ai" />Рекомендация агента: добавить словарь синонимов «фурнитура↔латунь/петля» и подсказку продавцам по отсутствующим позициям — см. гипотезу hyp-3.</p>
      </Panel>
    </div>
  );
}

/* ════════════════ ОБУЧЕНИЕ: конвейер навыков, ежедневный отчёт (А5) ════════════════
   Три потока → навыки-кандидаты → экзамен против базы → ежедневный отчёт →
   одобрение администратором по двухшаговому согласию → регрессионный фильтр →
   раскатка под наблюдением дрейфа. Скрытое самоизменение исключено конструктивно. */
const SKILL_STATUS_META: Record<string, { label: string; tone: any }> = {
  candidate: { label: "кандидат", tone: "warning" },
  deferred: { label: "отложен", tone: "neutral" },
  exam_failed: { label: "экзамен не сдан — в песочнице", tone: "error" },
  active: { label: "в работе", tone: "success" },
  rejected: { label: "отклонён", tone: "error" },
  rolled_back: { label: "снят с работы", tone: "neutral" },
};
export function LearningScreen() {
  const { data, loading, error, reload } = useCabinetData<any>(() => adminApi.skills());
  const { can } = useCabinet(); const { push } = useToast();
  const [report, setReport] = useState<any>(null);
  const [repBusy, setRepBusy] = useState(false);
  const [openSkill, setOpenSkill] = useState<any>(null);
  const [permit, setPermit] = useState<any>(null); // { skill, token, reask, statement_hash }
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  if (loading) return <LoadingBlock rows={6} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const d = data!;
  const loadReport = async (id?: string) => {
    setRepBusy(true);
    const r: any = await adminApi.skillReport(id);
    setRepBusy(false);
    if (r?.ok) setReport(r.report); else push(mapErrLocal(r), "err");
  };
  useEffect(() => { if (!report && d.reports?.length) loadReport(); /* первый отчёт — один раз */ }, [d.reports?.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const requestApprove = async () => {
    if (reason.trim().length < 5) { push("Причина обязательна", "err"); return; }
    setBusy(true);
    const r: any = await adminApi.skillApproveRequest(openSkill.id, reason.trim());
    setBusy(false);
    if (r?.ok) { setPermit({ skill: openSkill, ...r }); setOpenSkill(null); }
    else { push(mapErrLocal(r) || "Одобрение невозможно: " + (r?.error || ""), "err"); if (r?.error === "exam_not_passed") reload(); }
  };
  const confirmApprove = async () => {
    setBusy(true);
    const r: any = await adminApi.skillApproveConfirm(permit.skill.id, permit.token);
    setBusy(false);
    if (r?.ok) { push(`Навык выпущен в работу (правила ${r.rules_version}). Регрессионный фильтр пройден, включено наблюдение дрейфа.`); setPermit(null); reload(); }
    else push(mapErrLocal(r) || "Исполнение запрещено: " + (r?.error || ""), "err");
  };
  const decide = async (fn: (id: string, reason: string) => Promise<any>, text: string, okMsg: string) => {
    if (text.trim().length < 5) { push("Причина обязательна — она попадёт в журнал и учебный датасет", "err"); return; }
    setBusy(true);
    const r: any = await fn(openSkill.id, text.trim());
    setBusy(false);
    if (r?.ok) { push(okMsg); setOpenSkill(null); reload(); } else push(mapErrLocal(r), "err");
  };

  const groups: [string, any[]][] = [
    ["Кандидаты на подпись", d.skills.filter((s: any) => ["candidate", "deferred", "exam_failed"].includes(s.status))],
    ["В работе", d.skills.filter((s: any) => s.status === "active")],
    ["Отклонённые и снятые (границы допустимого)", d.skills.filter((s: any) => ["rejected", "rolled_back"].includes(s.status))],
  ];
  return (
    <div className="space-y-5">
      <Panel title="Конвейер самообучения" sub="Живые примеры людей + внутренняя статистика + внешняя разведка → навыки-кандидаты → экзамен → ежедневный отчёт → подпись администратора → регрессионный фильтр → раскатка под наблюдением дрейфа"
        right={<Badge tone="ai">A5 · конституция</Badge>}>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2.5 mb-4">
          <Info label="Версия правил" v={d.rules_version} />
          <Info label="Версия агента" v={d.agent_version} />
          <Info label="Кандидатов" v={String(d.skills.filter((s: any) => s.status === "candidate").length)} />
          <Info label="Активных навыков" v={String(d.skills.filter((s: any) => s.status === "active").length)} />
          <Info label="Примеров в датасете" v={fmtNum(d.dataset.length)} />
          <Info label="Лимит уведомлений/час" v={`${d.limits.notify_requests_per_hour_per_user}${d.limits.digest_after_excess ? " → дайджест" : ""}`} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(d.dataset_stats || {}).map(([k, n]: [string, any]) => <Chip key={k} t={`${k}: ${n}`} />)}
        </div>
      </Panel>

      <Panel title="Ежедневный отчёт об обучении" sub="Составляется всегда, включая дни без новых навыков (нулевая сводка с метриками в норме). Аудируемый документ: версия, блоки, подпись."
        right={<Btn size="sm" variant="outline" disabled={repBusy} onClick={() => loadReport()}>{repBusy ? "Загрузка…" : "Обновить"}</Btn>}>
        {!!d.reports?.length && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {d.reports.map((r: any) => (
              <button key={r.id} onClick={() => loadReport(r.id)} className={cn("px-2.5 py-1 rounded-lg border text-[12px] font-semibold cursor-pointer transition-colors", report?.id === r.id ? "border-dark bg-dark text-cream" : "border-line text-ink hover:border-dark")}>
                {r.date}{r.zero_summary ? " · пусто" : ""}{r.signed_by ? " ✓" : ""}
              </button>
            ))}
          </div>
        )}
        {!report ? <p className="text-[13px] text-ink-soft">Отчёты появятся после первой сборки воркером (ежедневно в 08:00) или по кнопке «Обновить».</p> : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap"><Badge tone="neutral">{report.version}</Badge><b className="text-[14px]">{report.date}</b>{report.zero_summary && <Badge tone="success">нулевая сводка — метрики в норме</Badge>}</div>
            {(["learned", "material", "usefulness", "apply"] as const).map((bk, i) => (
              <div key={bk} className="rounded-xl border border-line bg-surface p-3.5">
                <p className="text-[11px] uppercase font-bold text-ink-mute mb-1.5">{["① Что выучено (простым языком)", "② На каком материале (происхождение каждого примера)", "③ Насколько полезно (эффект, покрытие, балл экзамена против базы)", "④ Можно ли применять (поле, поведение, риск)"][i]}</p>
                {bk === "learned" && (report.blocks.learned.length ? <ul className="space-y-1 text-[13px]">{report.blocks.learned.map((l: any) => <li key={l.skill_id}>• {l.plain} <Badge tone={l.verdict === "deferred" ? "neutral" : "warning"}>{l.verdict}</Badge>{l.external_tag && <Badge tone="ai" className="ml-1">{l.external_tag}</Badge>}</li>)}</ul> : <p className="text-[13px] text-ink-soft">Новых навыков за сутки нет.</p>)}
                {bk === "material" && <ul className="space-y-1 text-[13px]">{report.blocks.material.map((m: any, j: number) => <li key={j}>• {m.example} <span className="text-ink-mute">— {m.origin}</span>{m.external_tag && <Badge tone="ai" className="ml-1">{m.external_tag}</Badge>}</li>)}</ul>}
                {(bk === "usefulness" || bk === "apply") && <p className="text-[13px] whitespace-pre-line">{String(report.blocks[bk]).split(" | ").join("\n")}</p>}
              </div>
            ))}
            <div className="rounded-xl border border-ai/30 bg-ai-soft p-3.5">
              <p className="text-[11px] uppercase font-bold text-ai mb-1.5">Рынок и перспектива — карта отставания от лучших практик</p>
              <ul className="space-y-1 text-[13px] mb-2">{(report.blocks.market?.lag_map || []).map((l: any, j: number) => <li key={j}>• {l.practice} — <b>{l.state}</b></li>)}</ul>
              <p className="text-[12.5px] text-ink-soft">Шаги преодоления: {report.blocks.market?.steps}</p>
            </div>
            <p className="text-[12px] text-ink-mute">Подпись одобрившего: {report.signed_by || "не подписан (ожидает решений администратора)"}</p>
          </div>
        )}
      </Panel>

      {groups.map(([title, list]) => (
        <Panel key={title} title={title}>
          {!list.length ? <EmptyState title="Пусто" why="В этой группе пока нет навыков — конвейер наполняется тремя потоками обучения." /> : (
            <DataTable cols={[
              { key: "name", title: "Навык", render: (s: any) => <div><b>{s.name}</b><p className="text-[11.5px] text-ink-mute mt-0.5">{s.behavior_change}</p></div> },
              { key: "origin", title: "Происхождение", render: (s: any) => <div className="text-[12px]">{s.origin}{s.external_tag && <Badge tone="ai" className="ml-1">{s.external_tag}</Badge>}</div> },
              { key: "field", title: "Поле" },
              { key: "exam", title: "Экзамен vs база", mono: true, render: (s: any) => <span className={s.exam.cand_acc > s.exam.base_acc ? "text-success font-bold" : "text-error font-bold"}>{(s.exam.cand_acc * 100).toFixed(1)}% / {(s.exam.base_acc * 100).toFixed(1)}%</span> },
              { key: "risk", title: "Риск", render: (s: any) => <RiskTag r={s.risk} /> },
              { key: "status", title: "Статус", render: (s: any) => <Badge tone={(SKILL_STATUS_META[s.status]?.tone) || "neutral"}>{SKILL_STATUS_META[s.status]?.label || s.status}</Badge> },
            ]} rows={list} rowKey={(s: any) => s.id} onRow={(s: any) => { setOpenSkill(s); setReason(""); }} />
          )}
        </Panel>
      ))}

      {/* карточка навыка: решения человека — одобрить / отклонить с причиной / отложить / снять */}
      <Drawer open={!!openSkill && !permit} onClose={() => setOpenSkill(null)} title={openSkill?.name || ""} wide>
        {openSkill && (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap"><RiskTag r={openSkill.risk} /><Badge tone={(SKILL_STATUS_META[openSkill.status]?.tone) || "neutral"}>{SKILL_STATUS_META[openSkill.status]?.label || openSkill.status}</Badge>{openSkill.external_tag && <Badge tone="ai">{openSkill.external_tag}</Badge>}</div>
            <div className="bg-line-soft/60 rounded-xl p-4 text-[13px] space-y-1.5">
              <p><b>Что изменится в поведении:</b> {openSkill.behavior_change}</p>
              <p><b>Поле действия:</b> {openSkill.field} · <b>Покрытие:</b> {openSkill.coverage}</p>
              <p><b>Ожидаемый эффект:</b> {openSkill.expected_effect}</p>
              <p><b>Экзамен против базовой версии:</b> кандидат {(openSkill.exam.cand_acc * 100).toFixed(1)}% vs база {(openSkill.exam.base_acc * 100).toFixed(1)}% ({openSkill.exam.suite})</p>
              <p><b>Материал:</b> {openSkill.origin}</p>
              {openSkill.reason && <p><b>Причина прошлого решения:</b> {openSkill.reason}</p>}
              {openSkill.rollout && <p><b>Раскатка:</b> с {timeAgo(openSkill.rollout.at)}, наблюдение дрейфа {openSkill.rollout.drift_watch ? "включено" : "—"}, гейт {openSkill.rollout.regression_gate}</p>}
            </div>
            <Field label="Причина / обоснование решения (обязательно, попадёт в журнал и учебный датасет)" required>
              <textarea className="field min-h-[70px]" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="почему одобряю / отклоняю / откладываю…" />
            </Field>
            <div className="flex flex-wrap gap-2">
              {openSkill.status !== "active" && (
                <Btn disabled={!can("agent_manage") || busy} onClick={requestApprove}><ClipboardList size={14} className="mr-1" /> Одобрить (шаг 1: токен + переспрос)</Btn>
              )}
              {openSkill.status !== "active" && (
                <Btn variant="outline" disabled={!can("agent_manage") || busy} onClick={() => decide(adminApi.skillReject, reason, "Навык отклонён: причина зафиксирована в журнале и добавлена в следующий экзаменационный набор")}>Отклонить с причиной</Btn>
              )}
              {openSkill.status !== "active" && (
                <Btn variant="outline" disabled={!can("agent_manage") || busy} onClick={() => decide(adminApi.skillDefer, reason, "Навык отложен: вернётся в следующий отчёт с накопленной статистикой")}>Отложить</Btn>
              )}
              {openSkill.status === "active" && can("agent_manage") && (
                <Btn variant="outline" className="!text-error !border-error/40" disabled={busy} onClick={() => decide(adminApi.skillRevoke, reason, "Навык снят с работы")}>Снять с работы</Btn>
              )}
            </div>
            <p className="text-[12px] text-ink-mute">Одобрение проходит двухшаговое согласие (А4/А5): сервер выдаёт одноразовый токен на точную формулировку поведения, показывает переспрос, затем применяет регрессионный фильтр и выпускает навык только после второго подтверждения человеком.</p>
          </div>
        )}
      </Drawer>

      {/* шаг 2: переспрос — что именно изменится, сроки токена, куда ляжет запись */}
      <Modal open={!!permit} onClose={() => setPermit(null)} title="Переспрос перед выпуском навыка (шаг 2 согласия)">
        {permit && (
          <div className="space-y-4">
            <div className="bg-line-soft/60 rounded-xl p-4 text-[13px] space-y-2">
              <p className="font-bold">{permit.skill.name}</p>
              <p><b>Что произойдёт:</b> {permit.reask.what_changes}</p>
              <p><b>Поле действия:</b> {permit.reask.field} · <b>Риск:</b> {permit.reask.risk}</p>
              <p><b>Экзамен уже пройден:</b> {(permit.reask.exam.cand_acc * 100).toFixed(1)}% против базы {(permit.reask.exam.base_acc * 100).toFixed(1)}%</p>
              <p><b>Дальше:</b> регрессионный фильтр Evaluation Hub → раскатка → наблюдение дрейфа (порог 0.2, автоуведомление).</p>
              <p><b>Куда будет внесена запись:</b> {permit.reask.journal}</p>
              <p><b>До какого момента можно отменить:</b> {permit.reask.cancel_until} (токен одноразовый, привязан к хэшу формулировки {String(permit.statement_hash).slice(0, 8)}…)</p>
            </div>
            <div className="flex gap-3">
              <Btn variant="outline" className="flex-1" disabled={busy} onClick={() => setPermit(null)}>Отменить (токен сгорит)</Btn>
              <Btn className="flex-1" disabled={busy} onClick={confirmApprove}>{busy ? "Проверяю токен и фильтр…" : "Подтвердить — выпустить в работу"}</Btn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ════════════════ РАЗВЕДКА: внешний контур обучения каждые 12 часов (А6) ════════════════ */
export function IntelScreen() {
  const { data, loading, error, reload } = useCabinetData<any>(() => adminApi.intel());
  const { can } = useCabinet(); const { push } = useToast();
  const [busy, setBusy] = useState(false);
  if (loading) return <LoadingBlock rows={5} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const d = data!;
  const runCycle = async () => {
    setBusy(true);
    const r: any = await adminApi.intelRun();
    setBusy(false);
    if (r?.ok) { push(`Цикл завершён: находок ${r.findings?.length || 0}, кандидатов ${r.candidate_skills?.length || 0}, отсеяно враждебных ${r.hostile_filtered}`); reload(); }
    else push(mapErrLocal(r), "err");
  };
  return (
    <div className="space-y-5">
      <Panel title="Внешняя разведка" sub="Каждые 12 часов по трём направлениям интересов: лучшие практики маркетплейсов, паттерны покупки, цены и промо, антифрод, поддержка, категории, сертификация, AI-тренды"
        right={<div className="flex items-center gap-2"><Badge tone={d.due_for_run ? "warning" : "success"}>{d.due_for_run ? "цикл созрел" : "цикл идёт по расписанию"}</Badge><Btn size="sm" disabled={!can("agent_manage") || busy} onClick={runCycle}><Play size={13} className="mr-1" />{busy ? "Цикл…" : "Запустить цикл"}</Btn></div>}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-3">
          <Info label="Периодичность" v={d.cadence_h + " ч"} />
          <Info label="Следующий цикл" v={new Date(d.next_run_at).toLocaleString("ru-RU")} />
          <Info label="Циклов в журнале" v={String(d.runs.length)} />
          <Info label="Белый список" v={d.whitelist.length + " источников"} />
        </div>
        <div className="flex flex-wrap gap-1.5 mb-3">{d.whitelist.map((w: string) => <Chip key={w} t={"✓ " + w} />)}</div>
        <p className="text-[12.5px] text-ink-soft bg-line-soft/60 border border-line rounded-xl px-3.5 py-2.5">Защита контура: любой внешний текст трактуется как данные, а не команды; попытка внедрения инструкций отсекается и помечается; факт подтверждается минимум двумя независимыми источниками из белого списка; находка становится только навыком-кандидатом с меткой «внешний источник» — применение решает человек.</p>
      </Panel>

      <Panel title="Журнал циклов разведки">
        {!d.runs.length ? <EmptyState title="Циклов ещё не было" why="Воркер запускает цикл каждые 12 часов; вручную — кнопкой выше." /> : (
          <div className="space-y-3">
            {d.runs.map((r: any) => (
              <div key={r.id} className="border border-line rounded-xl p-4">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <b className="text-[13px]">{new Date(r.ts).toLocaleString("ru-RU")}</b>
                  <Badge tone="neutral">{r.directions.join(" · ")}</Badge>
                  <Badge tone="success">находок: {r.findings.length}</Badge>
                  <Badge tone={r.hostile_filtered ? "error" : "neutral"}>отсеяно враждебного: {r.hostile_filtered}</Badge>
                  {r.injected_instructions_detected > 0 && <Badge tone="error">инъекций инструкций: {r.injected_instructions_detected}</Badge>}
                  {r.triggered_by && <span className="text-[11.5px] text-ink-mute ml-auto">запуск: {r.triggered_by}</span>}
                </div>
                <ul className="space-y-1 text-[12.5px]">
                  {r.findings.map((f: any, i: number) => (
                    <li key={i}>• <b>{f.topic}</b> <Badge tone="ai" className="mx-1">внешний источник</Badge><span className="text-ink-mute">подтверждено: {f.confirmed_by.join(" + ")} · поле: {f.field}</span></li>
                  ))}
                  {!r.findings.length && <li className="text-ink-mute">Подтверждённых находок в этом цикле нет.</li>}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
