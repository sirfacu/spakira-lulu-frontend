import { describe, expect, it } from "vitest";
import {
  formatPaymentCommissionTariff,
  paymentChargeBreakdown,
  paymentMethodSelectLabel,
} from "@/lib/payment-fee";
import type { PaymentMethod } from "@/lib/spa-queries";

const bold: PaymentMethod = {
  id: "1",
  code: "bold",
  label: "Bold",
  require_evidence: false,
  charges_commission: true,
  commission_percent: 3,
  commission_fixed: 300,
  commission_pass_to_client: true,
  active: true,
  sort_order: 1,
};

const cash: PaymentMethod = {
  ...bold,
  code: "efectivo",
  label: "Efectivo",
  charges_commission: false,
  commission_percent: 0,
  commission_fixed: 0,
};

describe("paymentChargeBreakdown", () => {
  it("OFF/pass: suma fee al cliente", () => {
    const c = paymentChargeBreakdown(50_000, bold);
    expect(c.serviceTotal).toBe(50_000);
    expect(c.fee).toBe(1_800);
    expect(c.amountDue).toBe(51_800);
    expect(c.passToClient).toBe(true);
  });

  it("ON/absorb: cliente paga solo el neto", () => {
    const c = paymentChargeBreakdown(50_000, {
      ...bold,
      commission_pass_to_client: false,
    });
    expect(c.fee).toBe(1_800);
    expect(c.amountDue).toBe(50_000);
    expect(c.passToClient).toBe(false);
  });

  it("sin comisión el total a cobrar es el neto", () => {
    expect(paymentChargeBreakdown(97_000, cash).amountDue).toBe(97_000);
  });
});

describe("labels", () => {
  it("muestra tarifa Bold en el selector", () => {
    expect(formatPaymentCommissionTariff(bold)).toMatch(/3%/);
    expect(paymentMethodSelectLabel(bold)).toContain("Bold");
    expect(paymentMethodSelectLabel(bold)).toMatch(/3%/);
  });
});
