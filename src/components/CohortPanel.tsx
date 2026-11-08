import { useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";

type Cohort = { week: string; size: number; retention: number[] };

export function CohortPanel() {
  const [cohorts, setCohorts] = useState<Cohort[] | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let live = true;
    fetch("/api/seller/cohorts", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => { if (live) setCohorts(j.cohorts || []); })
      .catch(() => { if (live) setErr(true); });
    return () => { live = false; };
  }, []);
  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-5 mb-5">
      <p className="font-display font-bold text-[16px] text-ink mb-4 flex items-center gap-2"><BarChart3 size={17} className="text-accent-deep" /> Возвращаемость покупателей</p>
      {err && <p className="text-[13px] text-ink-mute">Не удалось загрузить когорты.</p>}
      {!err && (!cohorts || cohorts.length === 0) && (
        <p className="text-[13px] text-ink-mute">Пока мало данных: когорты появятся, когда у вас будут повторные покупки. Расчёт ведётся по фактическим заказам.</p>
      )}
      {!err && cohorts && cohorts.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead><tr className="text-left text-ink-mute">
              <th className="py-1.5 pr-3 font-semibold">Когорта</th>
              <th className="py-1.5 pr-3 font-semibold">Покупателей</th>
              <th className="py-1.5 pr-3 font-semibold">Нед. 1</th>
              <th className="py-1.5 pr-3 font-semibold">Нед. 2</th>
              <th className="py-1.5 pr-3 font-semibold">Нед. 3</th>
            </tr></thead>
            <tbody>
              {cohorts.map((c) => (
                <tr key={c.week} className="border-t border-ink/5">
                  <td className="py-1.5 pr-3 font-semibold text-ink">{c.week}</td>
                  <td className="py-1.5 pr-3 text-ink-soft">{c.size}</td>
                  {c.retention.map((p, i) => (
                    <td key={i} className="py-1.5 pr-3 font-bold" style={{ color: p >= 50 ? "#4d7327" : p > 0 ? "#c77e28" : "#9a938a" }}>{p > 0 ? p + "%" : "—"}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11.5px] text-ink-mute mt-3">Доля покупателей когорты, купивших снова через 1–3 недели после первой покупки. Данные обезличены.</p>
    </div>
  );
}
