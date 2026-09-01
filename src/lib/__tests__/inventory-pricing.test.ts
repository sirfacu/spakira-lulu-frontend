import { describe, expect, it } from "vitest";
import { isShoppable, marginFromPrices, suggestedSale, unitPriceFromPack, inventoryLineValue } from "../inventory-pricing";

describe("inventory pricing", () => {
  it("suggests pack sale from cost and margin", () => {
    expect(suggestedSale(10000, 40)).toBe(14000);
  });

  it("derives margin from published pack price", () => {
    expect(marginFromPrices(10000, 14000)).toBe(40);
  });

  it("splits tarro into unit price", () => {
    expect(unitPriceFromPack(18000, 180)).toBe(100);
  });

  it("marks externo as shoppable", () => {
    expect(isShoppable("interno")).toBe(false);
    expect(isShoppable("externo")).toBe(true);
    expect(isShoppable("interno_externo")).toBe(true);
  });

  it("values loose units vs pack price (gemas, kit bandas)", () => {
    expect(
      inventoryLineValue({
        quantity: 60,
        purchase_price: 5000,
        pack_size: 12,
        unit_kind: "unidad",
      }),
    ).toBe(25000);
    expect(
      inventoryLineValue({
        quantity: 2000,
        purchase_price: 34000,
        pack_size: 2000,
        unit_kind: "unidad",
      }),
    ).toBe(34000);
  });

  it("values BARF by envase count not grams in pack_size", () => {
    expect(
      inventoryLineValue({
        quantity: 15,
        purchase_price: 1400,
        pack_size: 100,
        unit_kind: "g",
      }),
    ).toBe(21000);
  });

  it("values bidón ml as single unit", () => {
    expect(
      inventoryLineValue({
        quantity: 1,
        purchase_price: 128000,
        pack_size: 1000,
        unit_kind: "ml",
      }),
    ).toBe(128000);
  });
});
