import { describe, expect, it } from "vitest";
import {
  filterCategoryNamesByModule,
  filterInventoryByModule,
  isVetInventoryCategory,
  itemMatchesInventoryModule,
} from "../inventory-module";

describe("inventory module filter", () => {
  it("recognizes clinical categories case-insensitively", () => {
    expect(isVetInventoryCategory("Vacuna")).toBe(true);
    expect(isVetInventoryCategory("DESPARASITANTE")).toBe(true);
    expect(isVetInventoryCategory("medicamento")).toBe(true);
    expect(isVetInventoryCategory("Shampoo")).toBe(false);
    expect(isVetInventoryCategory("Salud")).toBe(false);
  });

  it("splits spa stock from veterinary stock", () => {
    const rows = [
      { name: "Hydra", category: "Shampoo" },
      { name: "Rabia", category: "Vacuna" },
      { name: "Pipeta", category: "Desparasitante" },
    ];
    expect(filterInventoryByModule(rows, "spa").map((r) => r.name)).toEqual(["Hydra"]);
    expect(filterInventoryByModule(rows, "veterinary").map((r) => r.name)).toEqual([
      "Rabia",
      "Pipeta",
    ]);
  });

  it("filters category pickers the same way", () => {
    const names = ["Shampoo", "Vacuna", "Salud", "Medicamento"];
    expect(filterCategoryNamesByModule(names, "spa")).toEqual(["Shampoo", "Salud"]);
    expect(filterCategoryNamesByModule(names, "veterinary")).toEqual([
      "Vacuna",
      "Medicamento",
    ]);
    expect(itemMatchesInventoryModule(null, "spa")).toBe(true);
    expect(itemMatchesInventoryModule(null, "veterinary")).toBe(false);
  });
});
