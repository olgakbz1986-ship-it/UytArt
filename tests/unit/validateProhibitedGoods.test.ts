/* ============================================================
   ЗАДАЧА 5, п.6: модульные тесты validateProhibitedGoods
   (server/validators.cjs) — блокировка запрещённых товаров.
   ============================================================ */
import { describe, it, expect } from "vitest";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { validateProhibitedGoods } = require("../../server/validators.cjs");

describe("validateProhibitedGoods", () => {
  it("блокирует товары со стоп-словами в названии", () => {
    const r = validateProhibitedGoods({ name: "Настойка алкогольная домашняя" });
    expect(r.blocked).toBe(true);
    expect(r.reason).toBe("stop_word");
    expect(r.word).toBe("алкогол");
  });

  it("блокирует по описанию, а не только по названию", () => {
    const r = validateProhibitedGoods({ name: "Смесь сухая", description: "Содержит никотин" });
    expect(r.blocked).toBe(true);
    expect(r.word).toBe("никотин");
  });

  it("регистр не влияет на блокировку", () => {
    expect(validateProhibitedGoods({ name: "ТАБАК курильный" }).blocked).toBe(true);
    expect(validateProhibitedGoods({ name: "Патроны охотничьи" }).blocked).toBe(true);
  });

  it("лекарственные средства в группе medicine блокируются с отдельной причиной", () => {
    const r = validateProhibitedGoods({ name: "Лекарственное средство от кашля", group: "medicine" });
    expect(r.blocked).toBe(true);
    expect(r.reason).toBe("medicine_restricted");
    expect(r.word).toBe("лекарствен");
  });

  it("пропускает обычные товары", () => {
    const ok = validateProhibitedGoods({ name: "Разделочная доска из дуба", description: "Ручная работа", category: "dom" });
    expect(ok).toEqual({ blocked: false });
    expect(validateProhibitedGoods({})).toEqual({ blocked: false });
    expect(validateProhibitedGoods(null)).toEqual({ blocked: false });
  });
});
