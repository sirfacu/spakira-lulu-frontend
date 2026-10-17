import { describe, expect, it } from "vitest";
import {
  defaultDispenseMode,
  filterCategoryNamesByModule,
  filterInventoryByModule,
  isVetInventoryCategory,
  itemMatchesInventoryModule,
  resolveInventoryModule,
  stockQtyForDispense,
} from "../inventory-module";

describe("inventory module filter", () => {
  it("recognizes clinical categories case-insensitively", () => {
    expect(isVetInventoryCategory("Vacuna")).toBe(true);
    expect(isVetInventoryCategory("DESPARASITANTE")).toBe(true);
    expect(isVetInventoryCategory("medicamento")).toBe(true);
    expect(isVetInventoryCategory("Insumo")).toBe(true);
    expect(isVetInventoryCategory("Shampoo")).toBe(false);
    expect(isVetInventoryCategory("Salud")).toBe(false);
  });

  it("prefers explicit module over category", () => {
    expect(resolveInventoryModule({ module: "spa", category: "Vacuna" })).toBe("spa");
    expect(resolveInventoryModule({ module: "veterinary", category: "Shampoo" })).toBe(
      "veterinary",
    );
    expect(resolveInventoryModule({ category: "Vacuna" })).toBe("veterinary");
  });

  it("splits spa stock from veterinary stock", () => {
    const rows = [
      { name: "Hydra", category: "Shampoo", module: "spa" },
      { name: "Rabia", category: "Vacuna", module: "veterinary" },
      { name: "Pipeta", category: "Desparasitante", module: "veterinary" },
    ];
    expect(filterInventoryByModule(rows, "spa").map((r) => r.name)).toEqual(["Hydra"]);
    expect(filterInventoryByModule(rows, "veterinary").map((r) => r.name)).toEqual([
      "Rabia",
      "Pipeta",
    ]);
  });

  it("filters category pickers the same way", () => {
    const names = ["Shampoo", "Vacuna", "Salud", "Medicamento", "Insumo"];
    expect(filterCategoryNamesByModule(names, "spa")).toEqual(["Shampoo", "Salud"]);
    expect(filterCategoryNamesByModule(names, "veterinary")).toEqual([
      "Vacuna",
      "Medicamento",
      "Insumo",
    ]);
    expect(itemMatchesInventoryModule({ category: null }, "spa")).toBe(true);
    expect(itemMatchesInventoryModule({ category: null }, "veterinary")).toBe(false);
  });

  it("computes kardex qty for content vs whole_pack", () => {
    expect(defaultDispenseMode("Vacuna")).toBe("whole_pack");
    expect(defaultDispenseMode("Insumo")).toBe("whole_pack");
    expect(defaultDispenseMode("Medicamento")).toBe("content");
    expect(
      stockQtyForDispense({
        dispense_mode: "content",
        unit_kind: "ml",
        pack_size: 150,
        qty_applied: 30,
      }),
    ).toBe(30);
    expect(
      stockQtyForDispense({
        dispense_mode: "whole_pack",
        unit_kind: "ml",
        pack_size: 150,
        qty_applied: 30,
      }),
    ).toBe(150);
  });
});
