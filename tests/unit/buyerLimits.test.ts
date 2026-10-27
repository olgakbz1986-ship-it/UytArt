/* ============================================================
   ЗАДАЧА 5, п.7: модульные тесты buyerLimitsOf (server/tariffs.cjs)
   — лимиты тарифных планов покупателя. Значения берутся из
   единого тарифного ядра shared/tariffs/core.js.
   ============================================================ */
import { describe, it, expect } from "vitest";
/* ЗАДАЧА 5: тарифное ядро shared/tariffs/core.js — CommonJS-исходник без
   расширения .cjs (историческое решение проекта); серверный модуль
   server/tariffs.cjs требует его через нативный require. В ESM-тесте
   (package.json "type":"module") такой граг загружаем изолированным
   Function-скоупом: читаем исходники и исполняем их как CJS, не меняя
   production-код. */
import fsNode from "node:fs";
import pathNode from "node:path";
const __dir = pathNode.resolve(import.meta.dirname ?? new URL(".", import.meta.url).pathname);
const loadCjs = (file, deps = {}) => {
  const src = fsNode.readFileSync(file, "utf8");
  const moduleObj = { exports: {} };
  const req = (id) => {
    if (deps[id]) return deps[id];
    const p = pathNode.resolve(pathNode.dirname(file), id);
    return loadCjs(p.endsWith(".js") ? p : p + ".js", deps);
  };
  Function("module", "exports", "require", "__dirname", src)(moduleObj, moduleObj.exports, req, pathNode.dirname(file));
  return moduleObj.exports;
};
const CORE = loadCjs(pathNode.resolve(__dir, "../../shared/tariffs/core.js"));
const TARIFFS = loadCjs(pathNode.resolve(__dir, "../../server/tariffs.cjs"), { "../shared/tariffs/core.js": CORE });
const { buyerLimitsOf, BUYER_PLANS } = TARIFFS;

describe("buyerLimitsOf", () => {
  it("free возвращает базовые лимиты ядра", () => {
    expect(buyerLimitsOf("free")).toEqual(BUYER_PLANS.free);
    expect(buyerLimitsOf("free").aiGens).toBe(CORE.BUYER_PLANS_RAW.free.aiGens);
    expect(buyerLimitsOf("free").marketOrders).toBe(1);
    expect(buyerLimitsOf("free").priceWatches).toBe(0);
  });

  it("start возвращает увеличенные лимиты", () => {
    const l = buyerLimitsOf("start");
    expect(l.aiGens).toBe(15);
    expect(l.marketOrders).toBe(3);
    expect(l.priceWatches).toBe(10);
  });

  it("designer: безлимит отслеживания цен резолвится в Infinity", () => {
    const l = buyerLimitsOf("designer");
    expect(l.aiGens).toBe(50);
    expect(l.priceWatches).toBe(Infinity);
  });

  it("premium — безлимиты по всем параметрам", () => {
    const l = buyerLimitsOf("premium");
    expect(l.aiGens).toBe(Infinity);
    expect(l.marketOrders).toBe(Infinity);
    expect(l.priceWatches).toBe(Infinity);
  });

  it("неизвестный тариф отдаёт лимиты free (fail-safe)", () => {
    expect(buyerLimitsOf("no-such-plan")).toEqual(BUYER_PLANS.free);
    expect(buyerLimitsOf(undefined)).toEqual(BUYER_PLANS.free);
  });
});
