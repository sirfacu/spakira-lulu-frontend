import { describe, expect, it } from "vitest";
import { appointmentChargeTotal } from "../spa-queries";

describe("appointmentChargeTotal", () => {
  it("sums service price and extras", () => {
    expect(appointmentChargeTotal({ price: 120000, extras_total: 25500 })).toBe(145500);
  });

  it("treats missing extras as zero", () => {
    expect(appointmentChargeTotal({ price: 55000 })).toBe(55000);
    expect(appointmentChargeTotal({ price: null, extras_total: 1000 })).toBe(1000);
  });
});
