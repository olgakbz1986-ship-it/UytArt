// Клиент API Quantiform (StartTechPro): dev — vite-proxy на :8787, prod — тот же origin
export interface ApiProfile {
  id: string; email: string; name: string; phone: string;
  role: string; legal_type: string; tier: string; avatar_url: string | null;
}
async function req<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch("/api" + path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("json")) return { ok: false, error: "server" } as T;
  return res.json() as Promise<T>;
}
export const api = {
  health: () => req("/health"),
  register: (p: { name: string; email: string; password: string }) =>
    req<{ ok: boolean; needConfirm?: boolean; devConfirmUrl?: string; error?: string }>("/auth/register", { method: "POST", body: JSON.stringify(p) }),
  login: (email: string, password: string) =>
    req<{ ok: boolean; profile?: ApiProfile; error?: string }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => req("/auth/logout", { method: "POST" }),
  me: () => req<{ ok: boolean; profile?: ApiProfile; error?: string }>("/auth/me"),
  resend: (email: string) => req("/auth/resend", { method: "POST", body: JSON.stringify({ email }) }),
  updateProfile: (p: { name?: string; phone?: string }) =>
    req<{ ok: boolean; profile?: ApiProfile }>("/profile", { method: "PATCH", body: JSON.stringify(p) }),
};
