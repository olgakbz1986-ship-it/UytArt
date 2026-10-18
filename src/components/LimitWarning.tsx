import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useTariffStore, type LimitAction } from "../lib/tariff";
import { useSubStore, buyerLimits } from "../lib/subscriptions";
import { useAppStore } from "../lib/store";

/**
 * §2.8: предупреждение при 80% лимита + специальное предупреждение
 * для тарифа Дизайнер за 3 дня до исчерпания пакета.
 *
 * Данные берутся из серверного тарифа (кэш сторa) и серверной проверки
 * лимитов (GET /api/limits/check), поэтому отображение всегда
 * соответствует серверному источнику истины (§1.3).
 */

const WARN_PCT = 0.8;

export const DEFAULT_WATCHED: LimitAction[] = [
  "ai_gen", "market_order", "price_watch", "agent_task",
];

export const SELLER_WATCHED: LimitAction[] = [
  "product_create", "ai_card_gen",
];

const LABELS: Partial<Record<LimitAction, string>> = {
  ai_gen: "AI-генерации покупателя",
  interior_project: "Проекты интерьера",
  ai_card_gen: "AI-генерации карточек",
  product_create: "Товары",
  price_watch: "Отслеживание цен",
  market_order: "Индивидуальные заказы",
  agent_task: "Задачи агента",
};

export interface LimitStat {
  action: LimitAction;
  label: string;
  used: number;
  limit: number; /* Infinity — безлимит */
  pct: number;   /* 0..100, для безлимита — 0 */
}

/** Прогоняет список действий через серверную проверку и возвращает usage/limit. */
export async function fetchLimitStats(actions: LimitAction[], meta?: Record<string, unknown>): Promise<LimitStat[]> {
  const out: LimitStat[] = [];
  for (const a of actions) {
    const r = await useTariffStore.getState().checkLimit(a, meta);
    if (!r) continue;
    const limit = Number.isFinite(r.limit) ? r.limit : Infinity;
    const pct = Number.isFinite(limit) && limit > 0 ? Math.min(100, Math.round((r.used / limit) * 100)) : 0;
    out.push({ action: a, label: LABELS[a] ?? a, used: r.used, limit, pct });
  }
  return out;
}

function daysLeftInMonth(): number {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return Math.max(0, end.getDate() - now.getDate());
}

/* ---------- прогрессивный счётчик лимита (реальное время, §2.8) ---------- */
export function LimitBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  if (!Number.isFinite(limit)) {
    return (
      <div className="flex items-center justify-between text-[13px] py-1.5">
        <span className="text-ink-soft">{label}</span>
        <span className="font-semibold text-ink">{used} / ∞</span>
      </div>
    );
  }
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 100;
  const color = pct >= 100 ? "bg-error" : pct >= WARN_PCT * 100 ? "bg-accent" : "bg-success";
  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between text-[13px] mb-1">
        <span className="text-ink-soft">{label}</span>
        <span className={`font-semibold ${pct >= WARN_PCT * 100 ? "text-accent-deep" : "text-ink"}`}>
          {used} / {limit}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-line-soft overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-300 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Панель счётчиков потребления: обновляется при каждом действии (передавайте refreshKey). */
export function LimitCounters({ actions, refreshKey = 0, meta }: { actions: LimitAction[]; refreshKey?: string | number; meta?: Record<string, unknown> }) {
  const [stats, setStats] = useState<LimitStat[]>([]);
  const key = actions.join(",");
  const metaStr = JSON.stringify(meta ?? {});
  useEffect(() => {
    let alive = true;
    void fetchLimitStats(key.split(",") as LimitAction[], metaStr !== "{}" ? JSON.parse(metaStr) : undefined)
      .then((s) => { if (alive) setStats(s); });
    return () => { alive = false; };
  }, [refreshKey, key, metaStr]);
  if (stats.length === 0) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-2 mb-4">
      {stats.map((st) => <LimitBar key={st.action} label={st.label} used={st.used} limit={st.limit} />)}
    </div>
  );
}

/* ---------- баннер предупреждения при 80% (§2.8) ---------- */
export default function LimitWarning({ actions, refreshKey = 0, meta }: { actions?: LimitAction[]; refreshKey?: string | number; meta?: Record<string, unknown> }) {
  const watched = actions ?? DEFAULT_WATCHED;
  const [stats, setStats] = useState<LimitStat[]>([]);
  const accountId = useAppStore((s) => s.session?.userId) || "";
  const subPlanId = useSubStore((s) => (accountId ? s.getBuyerPlan(accountId) : "free"));
  const key = watched.join(",");
  const metaStr = JSON.stringify(meta ?? {});

  useEffect(() => {
    let alive = true;
    void fetchLimitStats(key.split(",") as LimitAction[], metaStr !== "{}" ? JSON.parse(metaStr) : undefined)
      .then((s) => { if (alive) setStats(s); });
    return () => { alive = false; };
  }, [refreshKey, key, metaStr]);

  const near = stats.filter((s) => Number.isFinite(s.limit) && s.limit > 0 && s.pct >= WARN_PCT * 100);

  /* §2.8: Дизайнер — дополнительное предупреждение за 3 дня до сброса пакета */
  const designerWarn = (() => {
    if (subPlanId !== "designer") return false;
    const lim = buyerLimits(subPlanId).aiGens;
    const used = stats.find((s) => s.action === "ai_gen")?.used ?? 0;
    return Number.isFinite(lim) && used < lim && daysLeftInMonth() <= 3;
  })();

  if (near.length === 0 && !designerWarn) return null;

  return (
    <div className="rounded-xl border border-accent/40 bg-accent-soft px-4 py-3 mb-4 fade-up">
      <div className="flex items-start gap-2.5">
        <AlertTriangle size={16} className="text-accent-deep shrink-0 mt-0.5" />
        <div className="text-[13px] text-ink">
          {near.length > 0 && <p className="font-semibold mb-0.5">Вы использовали более 80% месячного лимита</p>}
          {near.map((s) => (
            <p key={s.action} className="text-ink-soft">«{s.label}»: {s.used} из {Number.isFinite(s.limit) ? s.limit : "∞"}.</p>
          ))}
          {designerWarn && (
            <p className="mt-1 font-semibold text-accent-deep">
              До конца месяца осталось ≤3 дней — неиспользованные генерации тарифа «Дизайнер» сгорят.
            </p>
          )}
          <a href="/plans" className="inline-block mt-1.5 font-bold text-accent-deep underline">Улучшить тариф или докупить пакет</a>
        </div>
      </div>
    </div>
  );
}
