import "./boot-guard"; // должен быть первым: ловит ошибки загрузки модулей
import { applyTheme } from "./lib/prefs";

/* применяем сохранённую тему до первого рендера — без «вспышки» светлой темы */
try {
  const raw = localStorage.getItem("uyutart-prefs-v1");
  if (raw) applyTheme((JSON.parse(raw)?.state?.theme as "light" | "dark" | "system") || "system");
} catch { /* приватный режим и т.п. — тема применится позже */ }

import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
