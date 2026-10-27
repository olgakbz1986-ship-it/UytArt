import "./boot-guard"; // должен быть первым: ловит ошибки загрузки модулей
import { applyTheme } from "./lib/prefs";

/* применяем сохранённую тему до первого рендера — без «вспышки» светлой темы */
try {
  const raw = localStorage.getItem("uyutart-prefs-v1");
  if (raw) applyTheme((JSON.parse(raw)?.state?.theme as "light" | "dark" | "system") || "system");
} catch { /* приватный режим и т.п. — тема применится позже */ }

import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import App from "./App.tsx";
import { queryClient } from "./lib/queryClient";

/* п.1–п.2: TanStack Query — серверный кэш настраивается один раз
   (staleTime 5 мин, retry 1, refetchOnWindowFocus true — см. lib/queryClient.ts) */
ReactDOM.createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
);
