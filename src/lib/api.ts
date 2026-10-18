// Клиент API Quantiform (StartTechPro): dev — vite-proxy на :8787, prod — тот же origin
export interface ApiProfile {
  id: string; email: string; name: string; phone: string;
  role: string; legal_type: string; tier: string; avatar_url: string | null;
}

/* Серверный тариф (§1.3). Infinity сериализуется как строка "Infinity". */
export interface ApiTariff {
  accountId: string;
  legalType: string;
  sellerPlanId: string;
  buyerPlanId: string;
  commissionRate: number | null;
  limits: {
    seller: { maxProducts: number | string; aiCardGens: number | string };
    buyer: { aiGens: number | string; marketOrders: number | string; priceWatches: number | string };
  };
  updatedAt?: string;
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
  register: (p: { name: string; email: string; password: string; role?: string; legalType?: string }) =>
    req<{ ok: boolean; needConfirm?: boolean; devConfirmUrl?: string; error?: string }>("/auth/register", { method: "POST", body: JSON.stringify(p) }),
  login: (email: string, password: string) =>
    req<{ ok: boolean; profile?: ApiProfile; tariff?: ApiTariff; error?: string }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => req("/auth/logout", { method: "POST" }),
  me: () => req<{ ok: boolean; profile?: ApiProfile; tariff?: ApiTariff; error?: string }>("/auth/me"),
  resend: (email: string) => req("/auth/resend", { method: "POST", body: JSON.stringify({ email }) }),
  updateProfile: (p: { name?: string; phone?: string }) =>
    req<{ ok: boolean; profile?: ApiProfile }>("/profile", { method: "PATCH", body: JSON.stringify(p) }),

  /* ---------- ТАРИФЫ (ЭТАП 1) ---------- */
  tariff: () => req<{ ok: boolean; tariff?: ApiTariff }>("/tariff"),
  setTariff: (p: { kind: "seller" | "buyer"; planId: string; legalType?: string }) =>
    req<{ ok: boolean; tariff?: ApiTariff; error?: string }>("/tariff/set", { method: "POST", body: JSON.stringify(p) }),
  tariffFees: () => req<{ ok: boolean; fees: Record<string, number>; commissions: Record<string, Record<string, number>> }>("/tariffs/fees"),

  /* ---------- ЛИМИТЫ: серверная проверка/потребление (§1.5) ---------- */
  limitCheck: (action: string) =>
    req<{ ok: boolean; allowed?: boolean; limit?: number; used?: number; reason?: string | null }>("/limits/check?action=" + encodeURIComponent(action)),
  limitConsume: (action: string) =>
    req<{ ok: boolean; consumed?: boolean; limit?: number; used?: number; error?: string; reason?: string }>("/limits/consume", { method: "POST", body: JSON.stringify({ action }) }),

  /* ---------- РАЗОВЫЙ ВЗНОС 5/10/15 тыс. ₽ (§1.4) ---------- */
  createFeePayment: (legalType: string, method: string, planId?: string) =>
    req<{ ok: boolean; payment?: { id: string; amount: number; status: string; confirmation_url?: string | null; provider?: string }; error?: string }>(
      "/payments/registration-fee", { method: "POST", body: JSON.stringify({ legalType, method, planId }) }),
  confirmFeePayment: (id: string) =>
    req<{ ok: boolean; payment?: { id: string; status: string }; receipt?: any; error?: string }>("/payments/" + id + "/confirm", { method: "POST" }),
  failFeePayment: (id: string) =>
    req<{ ok: boolean; payment?: { id: string; status: string }; error?: string }>("/payments/" + id + "/fail", { method: "POST" }),
  feePaymentStatus: (id: string) =>
    req<{ ok: boolean; payment?: { id: string; status: string }; receipt?: any }>("/payments/" + id),
  registrationStatus: (legalType: string) =>
    req<{ ok: boolean; active?: boolean }>("/seller/registration-status", { method: "POST", body: JSON.stringify({ legalType }) }),
  financeLedger: () => req<{ ok: boolean; ledger: any[]; receipts: any[] }>("/finance/ledger"),
};
