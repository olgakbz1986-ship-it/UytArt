import "./boot-guard"; // должен быть первым: ловит ошибки загрузки модулей
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
