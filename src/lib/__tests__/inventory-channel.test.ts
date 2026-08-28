import { describe, expect, it } from "vitest";
import {
  inventoryChannelLabel,
  isShoppable,
} from "../inventory-channel";

describe("inventory channel", () => {
  it("labels usage types", () => {
    expect(inventoryChannelLabel("interno")).toBe("Consumo interno");
    expect(inventoryChannelLabel("externo")).toBe("Venta al público");
    expect(inventoryChannelLabel("interno_externo")).toContain("legacy");
  });

  it("marks only sale channels as shoppable", () => {
    expect(isShoppable("interno")).toBe(false);
    expect(isShoppable("externo")).toBe(true);
    expect(isShoppable("interno_externo")).toBe(true);
    expect(isShoppable(undefined)).toBe(false);
  });
});
