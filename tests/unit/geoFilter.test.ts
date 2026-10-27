/* ============================================================
   ЗАДАЧА 5, п.5: модульные тесты geoFilter (server/geo-filter.cjs)
   — фильтрация товаров и продавцов по городу покупателя.
   ============================================================ */
import { describe, it, expect } from "vitest";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { geoFilter, geoAllowed } = require("../../server/geo-filter.cjs");

describe("geoFilter", () => {
  const products = [
    { id: "p1", name: " nationwide-доставка", deliveryZone: { mode: "nationwide" } },
    { id: "p2", name: "Лавка в Курске", city: "Курск", deliveryZone: { mode: "city" } },
    { id: "p3", name: "Магазин в Москве", city: "Москва", deliveryZone: { mode: "city" } },
    { id: "p4", name: "Цифровой товар", digitalType: "preset" },
    { id: "p5", name: "Радиус 50 км от Воронежа", city: "Воронеж", deliveryZone: { mode: "radius", km: 50 } },
    { id: "p6", name: "Список городов доставки", deliveryZone: { mode: "cities", cities: ["Белгород", "Орёл"] } },
  ];

  it("без города покупателя возвращает весь список без фильтрации", () => {
    expect(geoFilter(products, "")).toHaveLength(6);
    expect(geoFilter(products, "   ")).toHaveLength(6);
    expect(geoFilter(products, null)).toHaveLength(6);
  });

  it("фильтрует товары по городу покупателя", () => {
    const res = geoFilter(products, "Курск");
    const ids = res.map((p) => p.id);
    expect(ids).toContain("p1"); // nationwide — всегда проходит
    expect(ids).toContain("p2"); // базовый город совпадает
    expect(ids).toContain("p4"); // цифровой — без географии
    expect(ids).not.toContain("p3"); // Москва != Курск
    expect(ids).not.toContain("p6"); // города покупателя нет в списке cities
  });

  it("зона radius пропускает только близких продавцов", () => {
    expect(geoAllowed({ id: "x", city: "Воронеж", deliveryZone: { mode: "radius", km: 50 } }, "Курск")).toBe(false); // ~260 км
    expect(geoAllowed({ id: "x", city: "Воронеж", deliveryZone: { mode: "radius", km: 300 } }, "Курск")).toBe(true);
  });

  it("зона region пропускает продавцов того же федерального округа", () => {
    expect(geoAllowed({ id: "x", city: "Белгород", deliveryZone: { mode: "region" } }, "Курск")).toBe(true); // оба ЦФО
    expect(geoAllowed({ id: "x", city: "Казань", deliveryZone: { mode: "region" } }, "Курск")).toBe(false); // ПФО vs ЦФО
  });

  it("явный список cities зоны доставки пропускает только указанные города", () => {
    const seller = { id: "s", city: "Белгород", deliveryZone: { mode: "cities", cities: ["Белгород", "Орёл"] } };
    expect(geoAllowed(seller, "Орёл")).toBe(true);
    expect(geoAllowed(seller, "Москва")).toBe(false);
  });

  it("гео не задан — запись не исключается", () => {
    expect(geoAllowed({ id: "s", name: "без географии" }, "Сочи")).toBe(true);
  });

  it("не массив превращается в пустой список", () => {
    expect(geoFilter(undefined, "Курск")).toEqual([]);
    expect(geoFilter("нет", "Курск")).toEqual([]);
  });

  it("фильтрует и продавцов (сущности того же формата)", () => {
    const sellers = [
      { id: "sh1", city: "Курск" },
      { id: "sh2", city: "Махачкала", deliveryZone: { mode: "city" } },
    ];
    const res = geoFilter(sellers, "Курск");
    expect(res.map((s) => s.id)).toEqual(["sh1"]);
  });
});
