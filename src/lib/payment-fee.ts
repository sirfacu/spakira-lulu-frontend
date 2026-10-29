import type { PaymentMethod } from "@/lib/spa-queries";
import { cop } from "@/lib/format";

export const TECH_SERVICES_LABEL = "Canales electrónicos";

function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}

/** Tarifa del medio (% + fijo) sobre el servicio. */
export function mediumTariffAmount(
  baseTotal: number,
  method: PaymentMethod | null | undefined,
) {
  const base = Math.max(0, Number(baseTotal) || 0);
  if (!method?.charges_commission) return 0;
  const percent = Number(method.commission_percent) || 0;
  const fixed = Number(method.commission_fixed) || 0;
  return roundMoney(base * (percent / 100) + fixed);
}

/** Adicional al cliente si el cargo está activo. */
export function clientSurchargeAmount(
  baseTotal: number,
  method: PaymentMethod | null | undefined,
) {
  const base = Math.max(0, Number(baseTotal) || 0);
  const enabled =
    method?.client_charge_enabled ?? method?.commission_pass_to_client ?? false;
  if (!method || !enabled) return 0;
  const value = Number(method.client_charge_value) || 0;
  if (value <= 0) return 0;
  const kind = method.client_charge_kind === "fixed" ? "fixed" : "percent";
  if (kind === "fixed") return roundMoney(value);
  return roundMoney(base * (value / 100));
}

/** Comisión / cargo: amountDue y costo absorbido. */
export function paymentChargeBreakdown(
  baseTotal: number,
  method: PaymentMethod | null | undefined,
) {
  const base = Math.max(0, Number(baseTotal) || 0);
  const tariff = mediumTariffAmount(base, method);
  const passToClient =
    method?.client_charge_enabled ?? method?.commission_pass_to_client ?? false;
  const fee = passToClient ? clientSurchargeAmount(base, method) : tariff;
  return {
    serviceTotal: roundMoney(base),
    fee: roundMoney(fee),
    amountDue: roundMoney(passToClient ? base + clientSurchargeAmount(base, method) : base),
    percent: Number(method?.commission_percent) || 0,
    fixed: Number(method?.commission_fixed) || 0,
    passToClient: Boolean(passToClient),
    mediumTariff: tariff,
    clientSurcharge: clientSurchargeAmount(base, method),
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
