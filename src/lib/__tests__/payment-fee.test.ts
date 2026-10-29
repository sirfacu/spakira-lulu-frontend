import { describe, expect, it } from "vitest";
import {
  clientSurchargeAmount,
  mediumTariffAmount,
  paymentChargeBreakdown,
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
  client_charge_enabled: true,
  client_charge_kind: "percent",
  client_charge_value: 3,
  active: true,
  sort_order: 1,
};

const cash: PaymentMethod = {
  id: "2",
  code: "efectivo",
  label: "Efectivo",
  require_evidence: false,
  charges_commission: false,
  commission_percent: 0,
  commission_fixed: 0,
  client_charge_enabled: false,
  client_charge_kind: "percent",
  client_charge_value: 0,
  active: true,
  sort_order: 2,
};

describe("paymentChargeBreakdown", () => {
  it("suma cargo al cliente cuando está ON", () => {
    const c = paymentChargeBreakdown(50_000, bold);
    expect(c.clientSurcharge).toBe(1500);
    expect(c.mediumTariff).toBe(1800);
    expect(c.amountDue).toBe(51_500);
    expect(c.passToClient).toBe(true);
  });

  it("absorbe la tarifa como costo cuando cargo OFF", () => {
    const c = paymentChargeBreakdown(50_000, {
      ...bold,
      client_charge_enabled: false,
      commission_pass_to_client: false,
    });
    expect(c.amountDue).toBe(50_000);
    expect(c.passToClient).toBe(false);
    expect(c.mediumTariff).toBe(1800);
    expect(c.fee).toBe(1800);
  });

  it("sin tarifa no suma nada", () => {
    expect(paymentChargeBreakdown(97_000, cash).amountDue).toBe(97_000);
    expect(mediumTariffAmount(97_000, cash)).toBe(0);
    expect(clientSurchargeAmount(97_000, cash)).toBe(0);
  });

  it("cargo fijo al cliente", () => {
    const c = paymentChargeBreakdown(50_000, {
      ...bold,
      client_charge_kind: "fixed",
      client_charge_value: 2000,
    });
    expect(c.clientSurcharge).toBe(2000);
    expect(c.amountDue).toBe(52_000);
  });
});
