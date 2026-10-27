/* ============================================================
   Конфигурация Vitest (ЗАДАЧА 5, п.2)
   · environment jsdom — модульные тесты клиентского кода (TS);
   · setupFiles — инициализация тестового окружения;
   · coverage — генерация отчётов о покрытии (v8).
   Тесты: unit (tests/unit/**), интеграционные API (tests/integration/**).
   ============================================================ */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/unit/**/*.test.{ts,tsx}", "tests/integration/**/*.test.{ts,js,cjs,mjs}"],
    exclude: ["node_modules/**", "dist/**", "tests/e2e/**"],
    testTimeout: 30000,
    hookTimeout: 30000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}", "server/**/*.cjs"],
      exclude: ["src/pages/legacy/**", "**/*.d.ts", "tests/**"],
    },
  },
});
