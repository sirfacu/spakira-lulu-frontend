import { describe, expect, it } from "vitest";
import {
  appointmentProductCatalog,
  extraSearchAllowsCustom,
  extraSearchHits,
} from "../appointment-extras-catalog";

const medicado = {
  id: "m1",
  name: "Champú Medicado Clorhexidina 4L",
  category: "Medicado",
  sale_price: 80000,
  sale_price_unit: 20,
  available: 3860,
};
const tinte = {
  id: "t1",
  name: "tinte colorimetria",
  category: "Tinte",
  sale_price_unit: 80,
  available: 600,
};
const galleta = {
  id: "g1",
  name: "Galletas de hígado",
  category: "Vitrina",
  sale_price: 8500,
  available: 12,
};
const shampoo = {
  id: "s1",
  name: "Hydra Shampoo",
  category: "Shampoo",
  sale_price: 45000,
  available: 900,
};

describe("appointment product catalog", () => {
  it("lets staff add any item of the sede, not only medicado/tinte", () => {
    const catalog = appointmentProductCatalog(
      [medicado, tinte, shampoo],
      [galleta],
    );
    const names = catalog.map((i) => i.name);
    expect(names).toEqual(
      expect.arrayContaining([
        medicado.name,
        tinte.name,
        shampoo.name,
        galleta.name,
      ]),
    );
    expect(catalog.find((i) => i.id === "m1")?.unit_price).toBe(20);
    expect(catalog.find((i) => i.id === "g1")?.unit_price).toBe(8500);
  });

  it("keeps cliente on shop / vitrina only", () => {
    const catalog = appointmentProductCatalog([medicado, shampoo], [galleta], {
      shopOnly: true,
    });
    expect(catalog.map((i) => i.id)).toEqual(["g1"]);
  });

  it("search matches galletas and allows a custom name", () => {
    const catalog = appointmentProductCatalog([shampoo], [galleta]);
    expect(extraSearchHits(catalog, "gall").map((i) => i.id)).toEqual(["g1"]);
    expect(extraSearchAllowsCustom("Snack de prueba", catalog)).toBe(true);
    expect(extraSearchAllowsCustom("Galletas de hígado", catalog)).toBe(false);
    expect(extraSearchAllowsCustom("x", catalog)).toBe(false);
  });
});
