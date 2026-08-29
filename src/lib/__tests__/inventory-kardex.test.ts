import { describe, expect, it } from "vitest";
import {
  formatKardexWhen,
  kardexActionLabel,
  kardexActor,
  kardexBalanceLabel,
} from "../inventory-kardex";

describe("inventory kardex copy", () => {
  it("labels sales, stock in and balance", () => {
    expect(kardexActionLabel("venta_mostrador", -2)).toBe("Venta 2 unidades");
    expect(kardexActionLabel("compra", 12)).toBe("Alta de stock 12 unidades");
    expect(kardexActionLabel("merma", -1)).toBe("Baja 1 unidad");
    expect(kardexBalanceLabel(21)).toBe("Inventario 21 existencias");
    expect(kardexBalanceLabel(1)).toBe("Inventario 1 existencia");
  });

  it("formats local timestamp and actor fallback", () => {
    const local = new Date(2026, 7, 29, 18, 0, 0);
    expect(formatKardexWhen(local.toISOString())).toBe("2026-08-29 18:00");
    expect(kardexActor("Ana Pérez", "ana@x")).toBe("Ana Pérez");
    expect(kardexActor(null, "ana@x")).toBe("ana@x");
    expect(kardexActor(null, null)).toBe("Sistema");
  });
});
