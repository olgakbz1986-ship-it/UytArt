import { useCallback, useEffect, useState } from "react";
import { useAppStore } from "../lib/store";
import { apiJson, FLOW, STATUS_LABEL, type Shipment, type ShipmentStatus } from "../lib/logistics";

const ESCROW_LABEL: Record<string, string> = { held: "Эскроу: удержано", frozen: "Эскроу: заморожено (жалоба)", released: "Эскроу: переведено продавцу" };
const ESCROW_TONE: Record<string, string> = { held: "bg-info-soft text-info", frozen: "bg-danger-soft text-danger", released: "bg-success-soft text-success" };

function statusTone(s: ShipmentStatus): string {
  if (s === "closed" || s === "delivered") return "bg-success-soft text-success";
  if (s === "at_point") return "bg-accent/15 text-accent-deep";
  if (s === "return_requested") return "bg-warning-soft text-warning";
  return "bg-surface-soft text-ink-soft";
}

function Progress({ status }: { status: ShipmentStatus }) {
  const idx = FLOW.indexOf(status === "return_requested" ? "closed" : status);
  return (
    <div className="flex items-center gap-1.5">
      {FLOW.map((s, i) => (
        <div key={s} className="flex items-center gap-1.5">
          <span title={STATUS_LABEL[s]} className={"w-3 h-3 rounded-full border " + (i <= idx ? "bg-dark border-dark" : "bg-surface border-line")} />
          {i < FLOW.length - 1 && <span className={"w-5 h-[2px] " + (i < idx ? "bg-dark" : "bg-line")} />}
        </div>
      ))}
    </div>
  );
}

export function ShipmentsPanel() {
  const session = useAppStore((s) => s.session);
  const role = session?.role === "seller" ? "seller" : "buyer";
  const userId = session?.userId || "";
  const [list, setList] = useState<Shipment[]>([]);
  const [requests, setRequests] = useState<Array<{ id: string; itemsSummary: string; buyerName: string; shipmentId?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState<"all" | ShipmentStatus>("all");
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiJson<{ ok: boolean; shipments: Shipment[] }>("/api/shipments?role=" + role);
      setList(data.shipments);
      if (role === "seller") {
        const rq = await apiJson<{ ok: boolean; requests: Array<{ id: string; itemsSummary: string; buyerName: string; shipmentId?: string }> }>("/api/delivery-requests?shopId=" + userId);
        setRequests(rq.requests.filter((r) => !r.shipmentId));
      }
      setErr("");
    } catch (e) { setErr(e instanceof Error ? e.message : "Ошибка загрузки"); }
    finally { setLoading(false); }
  }, [role, userId]);

  useEffect(() => {
    let alive = true;
    apiJson<{ ok: boolean; shipments: Shipment[] }>("/api/shipments?role=" + role)
      .then(async (data) => {
        if (!alive) return;
        setList(data.shipments);
        if (role === "seller") {
          const rq = await apiJson<{ ok: boolean; requests: Array<{ id: string; itemsSummary: string; buyerName: string; shipmentId?: string }> }>("/api/delivery-requests?shopId=" + userId);
          if (!alive) return;
          setRequests(rq.requests.filter((r) => !r.shipmentId));
        }
        setErr("");
      })
      .catch((e) => { if (alive) setErr(e instanceof Error ? e.message : "Ошибка загрузки"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [role, userId]);

  const act = async (id: string, path: string, body?: Record<string, unknown>) => {
    setBusy(id);
    try {
      await apiJson("/api/shipments/" + id + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
      await load();
    } catch (e) { setErr(e instanceof Error ? e.message : "Ошибка действия"); }
    finally { setBusy(null); }
  };

  const create = async (requestId: string) => {
    setBusy(requestId);
    try { await apiJson("/api/shipments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId }) }); await load(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Ошибка создания"); }
    finally { setBusy(null); }
  };

  const shown = list.filter((s) => filter === "all" || s.status === filter);

  return (
    <div className="space-y-4">
      <style>{".qf-scroll::-webkit-scrollbar{width:8px}.qf-scroll::-webkit-scrollbar-track{background:var(--color-surface-soft)}.qf-scroll::-webkit-scrollbar-thumb{background:var(--color-dark);border-radius:4px}.qf-scroll::-webkit-scrollbar-thumb:hover{background:var(--color-accent-deep)}"}</style>
      <div className="rounded-xl p-5 text-cream" style={{ background: "linear-gradient(120deg, var(--color-dark), var(--color-accent-deep))" }}>
        <h2 className="font-display font-bold text-[20px]">Quantiform Доставка</h2>
        <p className="text-[12px] opacity-80 mt-1">Единый слой логистики: комфорт + фиксация данных. Перевозчик — сменный модуль.</p>
      </div>

      {err && <div className="p-3 rounded-lg bg-danger-soft text-danger text-[13px]">{err}</div>}

      {role === "seller" && requests.length > 0 && (
        <div className="rounded-xl border border-line bg-surface p-4">
          <h3 className="font-bold text-[14px] text-ink mb-2">Новые заявки — создать отправление</h3>
          <div className="space-y-2">
            {requests.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-surface-soft">
                <span className="text-[13px] text-ink truncate">{r.itemsSummary} · {r.buyerName}</span>
                <button disabled={busy === r.id} onClick={() => create(r.id)} className="px-3 py-1.5 rounded-lg bg-dark text-cream text-[12px] font-bold hover:bg-accent-deep disabled:opacity-50">Создать отправление</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(["all", ...FLOW] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={"px-3 py-1 rounded-full text-[12px] font-bold border " + (filter === f ? "bg-dark text-cream border-dark" : "bg-surface text-ink-soft border-line hover:border-dark")}>
            {f === "all" ? "Все" : STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      {loading ? <div className="p-8 text-center text-ink-mute">Загрузка отправлений...</div> : shown.length === 0 ? (
        <div className="p-8 text-center text-ink-mute">Пока нет отправлений.</div>
      ) : (
        <div className="space-y-3 qf-scroll max-h-[70vh] overflow-y-auto pr-1">
          {shown.map((sh) => (
            <div key={sh.id} className="rounded-xl border border-line bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-[14px] text-ink truncate">{sh.itemsSummary}</p>
                  <p className="text-[12px] text-ink-mute">Трек: {sh.trackingNumber} · {sh.buyerName} · {sh.buyerPhone}</p>
                </div>
                <span className={"px-2.5 py-1 rounded-full text-[11px] font-bold " + statusTone(sh.status)}>{STATUS_LABEL[sh.status]}</span>
              </div>
              <div className="mt-3"><Progress status={sh.status} /></div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={"px-2 py-0.5 rounded text-[11px] font-bold " + (ESCROW_TONE[sh.escrow.state] || "bg-surface-soft text-ink-soft")}>{ESCROW_LABEL[sh.escrow.state]}</span>
                {sh.issue && <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-danger-soft text-danger">Жалоба зафиксирована</span>}
                {sh.storageUntil && <span className="text-[11px] text-ink-mute">Хранение до {new Date(sh.storageUntil).toLocaleDateString("ru-RU")}</span>}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {role === "seller" && (
                  <>
                    <a href={"/api/shipments/" + sh.id + "/label"} className="px-3 py-1.5 rounded-lg bg-dark text-cream text-[12px] font-bold hover:bg-accent-deep">Этикетка PDF</a>
                    {!["at_point","delivered","closed","return_requested"].includes(sh.status) && (
                      <button disabled={busy === sh.id} onClick={() => act(sh.id, "/advance")} className="px-3 py-1.5 rounded-lg border border-line text-[12px] font-bold text-ink hover:border-dark disabled:opacity-50">Перевозчик: далее</button>
                    )}
                  </>
                )}
                {role === "buyer" && sh.status === "at_point" && (
                  <button disabled={busy === sh.id} onClick={() => act(sh.id, "/confirm")} className="px-3 py-1.5 rounded-lg bg-success text-white text-[12px] font-bold disabled:opacity-50">Подтвердить получение</button>
                )}
                {role === "buyer" && ["delivered","closed"].includes(sh.status) && (
                  <button disabled={busy === sh.id} onClick={() => act(sh.id, "/return")} className="px-3 py-1.5 rounded-lg border border-line text-[12px] font-bold text-ink hover:border-dark disabled:opacity-50">Оформить возврат</button>
                )}
                <button onClick={() => { const t = window.prompt("Суть жалобы (фиксируется в журнале):"); if (t) act(sh.id, "/complaint", { text: t }); }} className="px-3 py-1.5 rounded-lg bg-danger-soft text-danger text-[12px] font-bold">Пожаловаться</button>
                <button onClick={() => setOpen(open === sh.id ? null : sh.id)} className="px-3 py-1.5 rounded-lg border border-line text-[12px] font-bold text-ink-soft hover:border-dark">Журнал</button>
              </div>
              {open === sh.id && (
                <div className="mt-3 rounded-lg bg-surface-soft p-3 qf-scroll max-h-48 overflow-y-auto">
                  {sh.journal.map((j, i) => (
                    <p key={i} className="text-[11px] text-ink-soft py-0.5">
                      {new Date(j.ts).toLocaleString("ru-RU")} · {j.actor} · {j.action}{j.to ? " → " + j.to : ""}{j.meta && j.meta.text ? " · " + String(j.meta.text) : ""}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
