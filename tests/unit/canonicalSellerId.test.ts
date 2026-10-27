/* ============================================================
   ЗАДАЧА 5, п.4: модульные тесты canonicalSellerId
   (src/lib/userFeed.ts) — извлечение ownerId / sellerId / vendorId.
   ============================================================ */
import { describe, it, expect } from "vitest";
import { canonicalSellerId } from "../../src/lib/userFeed";

describe("canonicalSellerId", () => {
  it("извлекает ownerId как приоритетный канон", () => {
    expect(canonicalSellerId({ ownerId: "owner-1", sellerId: "s-2", vendorId: "v-3" })).toBe("owner-1");
  });

  it("при отсутствии ownerId извлекает sellerId", () => {
    expect(canonicalSellerId({ sellerId: "s-2", vendorId: "v-3" })).toBe("s-2");
  });

  it("при отсутствии ownerId и sellerId извлекает vendorId", () => {
    expect(canonicalSellerId({ vendorId: "vendor-77" })).toBe("vendor-77");
  });

  it("приводит числовые id к строке", () => {
    expect(canonicalSellerId({ ownerId: 42 })).toBe("42");
  });

  it("пропускает пустые значения и переходит к следующему ключу", () => {
    expect(canonicalSellerId({ ownerId: "", sellerId: "s-9" })).toBe("s-9");
    expect(canonicalSellerId({ ownerId: null, sellerId: undefined, vendorId: "v-1" })).toBe("v-1");
  });

  it("возвращает пустую строку, когда ни один ключ не задан", () => {
    expect(canonicalSellerId({})).toBe("");
    expect(canonicalSellerId({ name: "товар без продавца" })).toBe("");
  });
});
