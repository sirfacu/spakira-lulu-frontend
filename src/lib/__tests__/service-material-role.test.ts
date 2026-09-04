import { describe, expect, it } from "vitest";
import {
  inferMaterialRole,
  isLiquidMaterialRole,
  isPanoletaItem,
  panoletaFamilyKey,
  parsePanoletaSize,
} from "../service-material-role";

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
  });

  it("groups pañoleta sizes under same family key", () => {
    const a = {
      name: "Pañoletas con logo spa kira - Talla L",
      category: "Accesorios",
    };
    const b = {
      name: "pañoleta con logo spa kira - Talla M",
      category: "Accesorios",
    };
    expect(isPanoletaItem(a)).toBe(true);
    expect(parsePanoletaSize(a)).toBe("L");
    expect(parsePanoletaSize(b)).toBe("M");
    expect(panoletaFamilyKey(a)).toBe(panoletaFamilyKey(b));
  });

  it("detects liquid roles", () => {
    expect(isLiquidMaterialRole("shampoo")).toBe(true);
    expect(isLiquidMaterialRole("accessory")).toBe(false);
  });
});
