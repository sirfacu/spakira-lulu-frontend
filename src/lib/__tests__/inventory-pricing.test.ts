import { describe, expect, it } from "vitest";
import { isShoppable, marginFromPrices, suggestedSale, unitPriceFromPack, inventoryLineValue, needsSalePrice, purchaseCostNoun } from "../inventory-pricing";

describe("inventory pricing", () => {
  it("names pack cost as envase / pack / unidad", () => {
    expect(purchaseCostNoun("ml")).toBe("envase");
    expect(purchaseCostNoun("pack")).toBe("pack");
    expect(purchaseCostNoun("unidad")).toBe("unidad");
  });

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

  it("requires sale price for shoppable and visit-care items", () => {
    expect(needsSalePrice("externo", "Accesorios")).toBe(true);
    expect(needsSalePrice("interno", "Shampoo")).toBe(false);
    expect(needsSalePrice("interno", "Medicado")).toBe(true);
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
        quantity: 5,
        purchase_price: 5000,
        pack_size: 12,
        unit_kind: "unidad",
      }),
    ).toBe(25000);
    expect(
      inventoryLineValue({
        quantity: 1,
        purchase_price: 34000,
        pack_size: 2000,
        unit_kind: "unidad",
      }),
    ).toBe(34000);
    expect(
      inventoryLineValue({
        quantity: 2000,
        purchase_price: 34000,
        pack_size: 2000,
        unit_kind: "unidad",
      }),
    ).toBe(34000);
  });

  it("values BARF content (g) as envases × costo del envase", () => {
    expect(
      inventoryLineValue({
        quantity: 15,
        purchase_price: 1400,
        pack_size: 100,
        unit_kind: "g",
      }),
    ).toBe(210);
    expect(
      inventoryLineValue({
        quantity: 1500,
        purchase_price: 1400,
        pack_size: 100,
        unit_kind: "g",
      }),
    ).toBe(21000);
  });

  it("values bidón ml as packs of content times pack cost", () => {
    expect(
      inventoryLineValue({
        quantity: 1000,
        purchase_price: 128000,
        pack_size: 1000,
        unit_kind: "ml",
      }),
    ).toBe(128000);
    expect(
      inventoryLineValue({
        quantity: 4000,
        purchase_price: 12000,
        pack_size: 1000,
        unit_kind: "ml",
      }),
    ).toBe(48000);
  });

  it("values packs as pack count × cost of one pack, not × pieces", () => {
    expect(
      inventoryLineValue({
        quantity: 50,
        purchase_price: 5000,
        pack_size: 25,
        unit_kind: "pack",
      }),
    ).toBe(10000);
  });
});
