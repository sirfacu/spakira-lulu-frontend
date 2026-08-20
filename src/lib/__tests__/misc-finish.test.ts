import { describe, expect, it } from "vitest";
import { normalizeStatus, statusMeta } from "../format";
import { MISC_CATALOG, miscCatalogByCategory } from "../misc-catalog";

describe("statusMeta", () => {
  it("does not map enproceso to Pendiente", () => {
    expect(statusMeta("enproceso").label).toBe("En proceso");
    expect(statusMeta("en proceso").label).toBe("En proceso");
    expect(statusMeta("pendiente").label).toBe("Agendado");
    expect(statusMeta("pendiente").hint.length).toBeGreaterThan(10);
  });

  it("normalizeStatus canonicalizes aliases", () => {
    expect(normalizeStatus("en proceso")).toBe("enproceso");
    expect(normalizeStatus("en_proceso")).toBe("enproceso");
    expect(normalizeStatus("finalizada")).toBe("finalizada");
  });
});

describe("misc catalog", () => {
  it("includes BARF pollo and carne 100–500g", () => {
    const barf = MISC_CATALOG.filter((i) => i.category === "BARF Kirajiro");
    expect(barf).toHaveLength(10);
    expect(barf.some((i) => i.name.includes("Pollo 100g"))).toBe(true);
    expect(barf.some((i) => i.name.includes("Carne 500g"))).toBe(true);
  });

  it("groups by category", () => {
    const groups = miscCatalogByCategory();
    expect(groups.map((g) => g.category)).toContain("BARF Kirajiro");
    expect(groups.map((g) => g.category)).toContain("Accesorios");
  });
});
