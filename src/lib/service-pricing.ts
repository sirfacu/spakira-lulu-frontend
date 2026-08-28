import { cop, copRange } from "@/lib/format";
import type { Service } from "@/lib/spa-queries";

export const DEFAULT_PRICE_NOTE =
  "El rango es referencial; el valor final se confirma en recepción antes de ingresar al servicio.";

export function servicePriceBounds(s: Pick<Service, "price" | "price_min" | "price_max">) {
  const min = s.price_min != null ? Number(s.price_min) : s.price != null ? Number(s.price) : null;
  const max = s.price_max != null ? Number(s.price_max) : min;
  return { min, max };
}

export function isVariableServicePrice(
  s: Pick<Service, "price" | "price_min" | "price_max">,
): boolean {
  const { min, max } = servicePriceBounds(s);
  if (min == null || max == null) return false;
  return min !== max;
}

export function servicePriceLabel(
  s: Pick<Service, "price" | "price_min" | "price_max">,
): string {
  const { min, max } = servicePriceBounds(s);
  return copRange(min, max, s.price);
}

export function servicePriceHeadline(
  s: Pick<Service, "price" | "price_min" | "price_max">,
): string {
  if (isVariableServicePrice(s)) {
    return `Desde ${servicePriceLabel(s)}`;
  }
  return servicePriceLabel(s);
}

export function servicePriceNote(s: Pick<Service, "price_note" | "price_min" | "price_max">): string {
  if (s.price_note?.trim()) return s.price_note.trim();
  if (isVariableServicePrice(s)) return DEFAULT_PRICE_NOTE;
  return "";
}

export function servicePriceModeFromService(
  s: Pick<Service, "price" | "price_min" | "price_max">,
): "fixed" | "variable" {
  return isVariableServicePrice(s) ? "variable" : "fixed";
}

export function fixedPriceSummary(price: number): string {
  return cop(price);
}
