import type { PaymentMethod } from "@/lib/spa-queries";
import { cop } from "@/lib/format";

export const TECH_SERVICES_LABEL = "Servicios tecnológicos";

/** Comisión del medio sobre el neto; amountDue según pass_to_client. */
export function paymentChargeBreakdown(
  baseTotal: number,
  method: PaymentMethod | null | undefined,
) {
  const base = Math.max(0, Number(baseTotal) || 0);
  if (!method?.charges_commission) {
    return {
      serviceTotal: base,
      fee: 0,
      amountDue: base,
      percent: 0,
      fixed: 0,
      passToClient: true,
    };
  }
  const percent = Number(method.commission_percent) || 0;
  const fixed = Number(method.commission_fixed) || 0;
  const fee = Math.round((base * (percent / 100) + fixed) * 100) / 100;
  const passToClient = method.commission_pass_to_client !== false;
  return {
    serviceTotal: Math.round(base * 100) / 100,
    fee,
    amountDue: Math.round((passToClient ? base + fee : base) * 100) / 100,
    percent,
    fixed,
    passToClient,
  };
}

/** Ej. "3% + $300" */
export function formatPaymentCommissionTariff(method: PaymentMethod): string {
  if (!method.charges_commission) return "";
  const bits: string[] = [];
  const pct = Number(method.commission_percent) || 0;
  const fixed = Number(method.commission_fixed) || 0;
  if (pct > 0) bits.push(`${pct}%`);
  if (fixed > 0) bits.push(cop(fixed));
  return bits.join(" + ");
}

export function paymentMethodSelectLabel(method: PaymentMethod): string {
  const tariff = formatPaymentCommissionTariff(method);
  const evidence = method.require_evidence ? " · con evidencia" : "";
  const feeBit = tariff ? ` · ${tariff}` : "";
  return `${method.label}${feeBit}${evidence}`;
}
