import { describe, expect, it } from "vitest";
import {
  boldWhatsAppPaymentMessage,
  isBoldPaymentMethod,
} from "@/lib/bold-payment-message";
import type { PaymentMethod } from "@/lib/spa-queries";

const bold: PaymentMethod = {
  id: "1",
  code: "bold",
  label: "Bold",
  require_evidence: false,
  charges_commission: true,
  commission_percent: 3,
  commission_fixed: 300,
  active: true,
  sort_order: 1,
};

describe("isBoldPaymentMethod", () => {
  it("detecta code bold", () => {
    expect(isBoldPaymentMethod(bold)).toBe(true);
    expect(isBoldPaymentMethod({ ...bold, code: "efectivo" })).toBe(false);
  });
});

describe("boldWhatsAppPaymentMessage", () => {
  it("arma plantilla con servicio, comisión y total", () => {
    const text = boldWhatsAppPaymentMessage({
      ownerName: "Ana",
      petName: "Queen",
      serviceName: "Baño",
      tradeName: "Spa Kira",
      serviceTotal: 60_000,
      fee: 2_100,
      amountDue: 62_100,
      method: bold,
    });
    expect(text).toContain("Ana");
    expect(text).toContain("Queen");
    expect(text).toContain("Baño");
    expect(text).toMatch(/60\.000/);
    expect(text).toMatch(/2\.100/);
    expect(text).toMatch(/62\.100/);
    expect(text).toMatch(/Bold/);
  });

  it("incluye link de sesión cuando existe", () => {
    const text = boldWhatsAppPaymentMessage({
      ownerName: "Ana",
      petName: "Luna",
      serviceName: "Corte",
      serviceTotal: 97_000,
      fee: 3_210,
      amountDue: 100_210,
      method: bold,
      paymentSessionUrl: "https://pay.example/b/1",
    });
    expect(text).toContain("https://pay.example/b/1");
    expect(text).toMatch(/clic aquí/i);
  });
});
