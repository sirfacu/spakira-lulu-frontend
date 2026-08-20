import { describe, expect, it } from "vitest";
import { isShoppable, marginFromPrices, suggestedSale, unitPriceFromPack } from "../inventory-pricing";

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
});
