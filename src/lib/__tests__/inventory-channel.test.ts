import { describe, expect, it } from "vitest";
import {
  inventoryChannelLabel,
  isShoppable,
} from "../inventory-channel";

describe("inventory channel", () => {
  it("labels usage types", () => {
    expect(inventoryChannelLabel("interno")).toBe("Uso interno");
    expect(inventoryChannelLabel("externo")).toBe("Solo venta");
    expect(inventoryChannelLabel("interno_externo")).toBe("Interno y venta");
  });

  it("marks only sale channels as shoppable", () => {
    expect(isShoppable("interno")).toBe(false);
    expect(isShoppable("externo")).toBe(true);
    expect(isShoppable("interno_externo")).toBe(true);
    expect(isShoppable(undefined)).toBe(false);
  });
});
