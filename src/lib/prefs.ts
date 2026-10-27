import { create } from "zustand";
import { persist } from "zustand/middleware";

/* ============================================================
   Глобальные настройки сервиса: тема, уведомления, приватность.
   Тема применяется к <html data-theme> и реально перекрашивает
   весь интерфейс через CSS-переменные.
   ============================================================ */

export type ThemeId = "light" | "dark" | "system";

interface PrefsState {
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;

  buyerNotif: { email: boolean; push: boolean; telegram: boolean };
  setBuyerNotif: (p: Partial<PrefsState["buyerNotif"]>) => void;

  buyerPrivacy: { aiProfiling: boolean; digest: boolean };
  setBuyerPrivacy: (p: Partial<PrefsState["buyerPrivacy"]>) => void;

  sellerNotif: { orders: boolean; payouts: boolean; promo: boolean };
  setSellerNotif: (p: Partial<PrefsState["sellerNotif"]>) => void;
}

export const usePrefsStore = create<PrefsState>()(
  persist(
    (set) => ({
      theme: "system",
      setTheme: (t) => set({ theme: t }),

      buyerNotif: { email: true, push: true, telegram: false },
      setBuyerNotif: (p) => set((s) => ({ buyerNotif: { ...s.buyerNotif, ...p } })),

      buyerPrivacy: { aiProfiling: false, digest: true },
      setBuyerPrivacy: (p) => set((s) => ({ buyerPrivacy: { ...s.buyerPrivacy, ...p } })),

      sellerNotif: { orders: true, payouts: true, promo: false },
      setSellerNotif: (p) => set((s) => ({ sellerNotif: { ...s.sellerNotif, ...p } })),
    }),
    { name: "uyutart-prefs-v1" }
  )
);

/* применить тему к документу (data-theme управляет CSS-переменными) */
export function applyTheme(theme: ThemeId) {
  const dark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  // синхронизируем цвет статус-бара/панели браузера на мобильных (iOS Safari, Android Chrome)
  try {
    if ("colorScheme" in document.documentElement.style) {
      document.documentElement.style.colorScheme = dark ? "dark" : "light";
    }
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.content = dark ? "#141a16" : "#F6F3EB";
  } catch {
    /* не критично для старых WebView */
  }
}
