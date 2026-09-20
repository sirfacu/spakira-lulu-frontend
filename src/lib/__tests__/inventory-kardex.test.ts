import { describe, expect, it } from "vitest";
import {
  formatKardexWhen,
  kardexActionLabel,
  kardexActor,
  kardexBalanceLabel,
  kardexQtyPhrase,
} from "../inventory-kardex";

describe("inventory kardex copy", () => {
  it("labels sales, stock in and balance in stored units when no pack info", () => {
    expect(kardexActionLabel("venta_mostrador", -2)).toBe("Venta 2 unidades");
    expect(kardexActionLabel("compra", 12)).toBe("Alta de stock 12 unidades");
    expect(kardexActionLabel("merma", -1)).toBe("Baja 1 unidad");
    expect(kardexBalanceLabel(21)).toBe("Saldo 21 unidades");
    expect(kardexBalanceLabel(1)).toBe("Saldo 1 unidad");
  });

  it("shows envases and content for ml movements", () => {
    const unit = { unit_kind: "ml", pack_size: 1000 };
    expect(kardexQtyPhrase(4000, unit)).toBe("4 envases (4000 ml)");
    expect(kardexActionLabel("compra", 4000, unit)).toBe("Alta de stock 4 envases (4000 ml)");
    expect(kardexBalanceLabel(4000, unit)).toBe("Saldo 4 envases (4000 ml)");
  });

  it("formats local timestamp and actor fallback", () => {
    const local = new Date(2026, 7, 29, 18, 0, 0);
    expect(formatKardexWhen(local.toISOString())).toBe("2026-08-29 18:00");
    expect(kardexActor("Ana Pérez", "ana@x")).toBe("Ana Pérez");
    expect(kardexActor(null, "ana@x")).toBe("ana@x");
    expect(kardexActor(null, null)).toBe("Sistema");
  });
});
