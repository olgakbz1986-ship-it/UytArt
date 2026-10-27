/* ============================================================
   ЗАДАЧА 5, п.2: инициализация тестового окружения Vitest.
   · dotenv — DATABASE_URL/секреты из .env (если есть);
   · изолированное файловое хранилище dev-db для интеграционных
     тестов (UYART_DB_FILE во временной каталог);
   · заглушки браузера, недостающие в jsdom.
   ============================================================ */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require("dotenv").config({ silent: true });
} catch {
  /* dotenv опционален в тестовом окружении */
}

/* Гарантированно файловый режим репозитория, если PostgreSQL не задан явно */
if (!process.env.DATABASE_URL) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "uyart-vitest-"));
  process.env.UYART_DB_FILE = path.join(dir, "dev-db.json");
}

/* matchMedia — отсутствует в jsdom, используется некоторыми компонентами */
if (typeof window !== "undefined" && !window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

export {};
