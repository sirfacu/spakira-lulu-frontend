import { describe, expect, it } from "vitest";
import {
  inferMaterialRole,
  isLiquidMaterialRole,
  isPanoletaItem,
  isServiceAttachableItem,
  isVisitOnlyCategory,
  isWearEstimateLine,
  panoletaFamilyKey,
  parsePanoletaSize,
  visitCareItems,
  visitCarePickerLabel,
  visitCareSalePrice,
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
    expect(inferMaterialRole({ name: "Pigmento rojo", category: "Colorimetría" })).toBe("dye");
    expect(
      inferMaterialRole({ name: "Maquina Andis", category: "Herramienta de trabajo" }),
    ).toBe("tool");
  });

  it("hides tool estimate lines", () => {
    expect(isWearEstimateLine({ material_role: "tool", quantity_unit: "uso" })).toBe(true);
    expect(isWearEstimateLine({ material_role: "perfume", quantity_unit: "ml" })).toBe(false);
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

  it("keeps medicado and tinte off the service recipe", () => {
    expect(isServiceAttachableItem({ name: "Asuntol", category: "Medicado" })).toBe(false);
    expect(isServiceAttachableItem({ name: "Tinte rojo", category: "Tinte" })).toBe(false);
    expect(isServiceAttachableItem({ name: "Pigmento", category: "Colorimetría" })).toBe(false);
    expect(isServiceAttachableItem({ name: "Hydra", category: "Shampoo" })).toBe(true);
    expect(isVisitOnlyCategory("Colorimetría")).toBe(true);
  });

  it("lists medicado/tinte for any visit, including colorimetría category", () => {
    const items = [
      { name: "Asuntol", category: "Medicado", sale_price_unit: 80 },
      { name: "Pigmento rojo", category: "Colorimetría", sale_price: 40000, pack_size: 100 },
      { name: "Galleta", category: "Alimentos", sale_price_unit: 5000 },
    ];
    expect(visitCareItems(items, "medicated").map((i) => i.name)).toEqual(["Asuntol"]);
    expect(visitCareItems(items, "dye").map((i) => i.name)).toEqual(["Pigmento rojo"]);
    expect(visitCareSalePrice(items[1])).toBe(400);
  });

  it("labels visit-care picker with stock of this sede", () => {
    expect(
      visitCarePickerLabel({ name: "Asuntol", unit_kind: "ml", available: 4000 }),
    ).toBe("Asuntol · 4000 ml libres");
    expect(
      visitCarePickerLabel({ name: "Asuntol", unit_kind: "ml", available: 0, quantity: 0 }),
    ).toBe("Asuntol · sin stock en esta sede");
  });
});
