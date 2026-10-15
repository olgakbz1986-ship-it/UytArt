/* ============================================================
   CABINET ADMIN — клиент API (закрытая зона)
   Все запросы идут на /api/admin/*; сервер проверяет сессию, роль,
   разрешение, окружение, лимиты и риск. Клиенту не доверяем ничего.
   ============================================================ */
async function req<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch("/api/admin" + path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (res.status === 401) return { ok: false, error: "no_session" } as unknown as T;
  if (res.status === 403) {
    const j: any = await res.json().catch(() => ({}));
    return { ok: false, error: j.error || "forbidden", need: j.need } as unknown as T;
  }
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("json")) return { ok: false, error: "server" } as unknown as T;
  return res.json() as Promise<T>;
}

const post = (p: string, body?: any) => req(p, { method: "POST", body: JSON.stringify(body || {}) });
const put = (p: string, body?: any) => req(p, { method: "PUT", body: JSON.stringify(body || {}) });
const patch = (p: string, body?: any) => req(p, { method: "PATCH", body: JSON.stringify(body || {}) });

/* идемпотентный ключ операции — защита от двойного нажатия (сервер хранит ответ 10 мин) */
export const opKey = () => "op-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);

export const adminApi = {
  loginStart: (email: string) => post("/login/start", { email }),
  loginVerify: (email: string, code: string) => post("/login/verify", { email, code }),
  me: () => req("/me"),
  logout: () => post("/logout"),
  bootstrap: () => req("/bootstrap"),
  home: () => req("/home"),
  notifications: () => req("/notifications"),
  notifRead: (id: string) => put(`/notifications/${id}/read`),
  notifAck: (id: string, reason?: string) => put(`/notifications/${id}/ack`, { reason }),
  search: (q: string) => req(`/search?q=${encodeURIComponent(q)}`),
  users: (params: Record<string, string> = {}) => req("/users?" + new URLSearchParams(params).toString()),
  user: (id: string) => req(`/users/${id}`),
  userAction: (id: string, body: any) => post(`/users/${id}/action`, body),
  sellers: (params: Record<string, string> = {}) => req("/sellers?" + new URLSearchParams(params).toString()),
  seller: (id: string) => req(`/sellers/${id}`),
  sellerAction: (id: string, body: any) => post(`/sellers/${id}/action`, body),
  moderation: () => req("/moderation"),
  modDecision: (id: string, body: any) => post(`/moderation/${id}/decision`, body),
  categoryUpdate: (id: string, body: any) => put(`/categories/${id}`, body),
  orders: (params: Record<string, string> = {}) => req("/orders?" + new URLSearchParams(params).toString()),
  orderOp: (id: string, body: any) => post(`/orders/${id}/op`, body),
  finance: () => req("/finance"),
  payoutDecision: (id: string, body: any) => post(`/payouts/${id}/decision`, body),
  commissionCreate: (body: any) => post("/commissions", body),
  disputes: () => req("/disputes"),
  disputeResolve: (id: string, body: any) => post(`/disputes/${id}/resolve`, body),
  support: () => req("/support"),
  ticketAssign: (id: string, reason?: string) => post(`/tickets/${id}/assign`, { reason }),
  ticketClose: (id: string, reason: string) => post(`/tickets/${id}/close`, { reason }),
  security: () => req("/security"),
  blockCreate: (body: any) => post("/blocks", body),
  appealDecision: (id: string, body: any) => post(`/appeals/${id}/decision`, body),
  content: () => req("/content"),
  campaignSend: (id: string, body: any) => post(`/campaigns/${id}/send`, body),
  analytics: () => req("/analytics"),
  releases: () => req("/releases"),
  releaseItems: (id: string, body: any) => post(`/releases/${id}/items`, body),
  flagToggle: (id: string, body: any) => post(`/flags/${id}/toggle`, body),
  testStop: (id: string, reason: string) => post(`/tests/${id}/stop`, { reason }),
  settings: () => req("/settings"),
  settingsPatch: (body: any) => patch("/settings", body),
  settingsConfirm: (body: any) => post("/settings/confirm", body),
  integrationRetry: (key: string, reason: string, client_op_id = opKey()) => post(`/integrations/${key}/retry`, { reason, client_op_id }),
  logsActions: (params: Record<string, string> = {}) => req("/logs/actions?" + new URLSearchParams(params).toString()),
  logsSecurity: () => req("/logs/security"),
  /* agent */
  agent: () => req("/agent"),
  agentPatch: (body: any) => patch("/agent", body),
  sourcePatch: (key: string, body: any) => patch(`/sources/${key}`, body),
  obsConvert: (id: string, kind: string) => post(`/observations/${id}/convert`, { kind }),
  hypothesisPatch: (id: string, body: any) => patch(`/hypotheses/${id}`, body),
  agentChat: (message: string) => post("/agent/chat", { message }),
  decisions: () => req("/decisions"),
  decision: (id: string) => req(`/decisions/${id}`),
  decisionResolve: (id: string, body: any) => post(`/decisions/${id}/resolve`, body),
  releasePlan: () => req("/release-plan"),
  releasePlanCommit: (body: any) => post("/release-plan/commit", body),
  policies: () => req("/policies"),
  policyUpdate: (id: string, body: any) => put(`/policies/${id}`, body),
  policyActivate: (id: string, reason: string) => post(`/policies/${id}/activate`, { reason }),
  traces: () => req("/traces"),
  trace: (id: string) => req(`/traces/${id}`),
  eval: () => req("/eval"),
  evalRun: (version: string) => post("/eval/run", { version }),
  roi: () => req("/roi"),
  killSwitch: (reason: string) => post("/kill-switch", { reason }),
  roleAssign: (body: any) => post("/roles/assign", body),
};
