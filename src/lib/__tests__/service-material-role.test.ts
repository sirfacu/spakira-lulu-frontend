import { describe, expect, it } from "vitest";
import { inferMaterialRole, isLiquidMaterialRole } from "../service-material-role";

describe("service-material-role", () => {
  it("infers accessory and conditioner", () => {
    expect(
      inferMaterialRole({ name: "Moñas negras", category: "Accesorios", sku: "acc-mon" }),
    ).toBe("accessory");
    expect(
      inferMaterialRole({ name: "Hydra Conditioner", category: "Acondicionador" }),
    ).toBe("conditioner");
  });

  it("maps antipulgas / dermatológico to medicated", () => {
    expect(inferMaterialRole({ name: "Shampoo Antipulgas", category: "Baño" })).toBe(
      "medicated",
    );
    expect(
      inferMaterialRole({ name: "Shampoo dermatológico", category: "Tratamiento" }),
    ).toBe("medicated");
  });

  it("defaults generic bath shampoo to shampoo", () => {
    expect(inferMaterialRole({ name: "Shampoo Premium", category: "Shampoo" })).toBe(
      "shampoo",
    );
    expect(inferMaterialRole({ name: "Producto X", category: "Baño" })).toBe("shampoo");
  });

  it("detects liquid roles", () => {
    expect(isLiquidMaterialRole("shampoo")).toBe(true);
    expect(isLiquidMaterialRole("accessory")).toBe(false);
  });
});
