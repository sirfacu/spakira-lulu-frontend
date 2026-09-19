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
    expect(inferMaterialRole({ name: "Shampoo Antipulgas", category: "Medicado" })).toBe(
      "medicated",
    );
    expect(inferMaterialRole({ name: "ASUNTOL antipulgas", category: "Medicado" })).toBe(
      "medicated",
    );
  });

  it("maps perfume, salud, tinte and tools", () => {
    expect(inferMaterialRole({ name: "Hydra Forever Vip 450ml", category: "Perfume" })).toBe(
      "perfume",
    );
    expect(inferMaterialRole({ name: "Orenda Otico 100 ml", category: "Salud" })).toBe("health");
    expect(inferMaterialRole({ name: "tinte colorimetria", category: "Tinte" })).toBe("dye");
    expect(
      inferMaterialRole({ name: "Maquina Andis", category: "Herramienta de trabajo" }),
    ).toBe("tool");
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
    expect(isLiquidMaterialRole("medicated")).toBe(false);
    expect(isLiquidMaterialRole("accessory")).toBe(false);
  });
});
