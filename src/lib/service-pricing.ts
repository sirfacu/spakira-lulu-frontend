import { cop, copRange, normalizeStatus } from "@/lib/format";
import type { Service } from "@/lib/spa-queries";

export const PENDING_SERVICE_PRICE_LABEL = "A confirmar en la cita";
export const PENDING_SERVICE_PRICE_NOTE = "Se valida al llegar, según la mascota.";
export const COUNTER_VALIDATION_LABEL = "Validar en mostrador";
export const COUNTER_VALIDATION_NOTE =
  "Esta raza no está en la lista tarifada; confirmamos el valor en recepción.";

export type BreedPriceHint = {
  has_profile?: boolean;
  breed_id?: string | null;
  breed_name?: string | null;
  price_min?: number | null;
  price_max?: number | null;
};

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

export function isPendingCatalogPrice(
  s: Pick<Service, "price" | "price_min" | "price_max" | "price_pending">,
): boolean {
  if (s.price_pending) return true;
  return s.price == null && s.price_min == null && s.price_max == null;
}

export function servicePriceLabel(
  s: Pick<Service, "price" | "price_min" | "price_max" | "price_pending">,
): string {
  if (isPendingCatalogPrice(s)) return PENDING_SERVICE_PRICE_LABEL;
  const { min, max } = servicePriceBounds(s);
  return copRange(min, max, s.price);
}

export function servicePriceHeadline(
  s: Pick<Service, "price" | "price_min" | "price_max" | "price_pending">,
): string {
  if (isPendingCatalogPrice(s)) return PENDING_SERVICE_PRICE_LABEL;
  if (isVariableServicePrice(s)) {
    return `Desde ${servicePriceLabel(s)}`;
  }
  return servicePriceLabel(s);
}

export function servicePriceNote(
  s: Pick<Service, "price_note" | "price_min" | "price_max" | "price_pending">,
): string {
  if (isPendingCatalogPrice(s)) return PENDING_SERVICE_PRICE_NOTE;
  if (s.price_note?.trim()) return s.price_note.trim();
  if (isVariableServicePrice(s)) return DEFAULT_PRICE_NOTE;
  return PENDING_SERVICE_PRICE_NOTE;
}

export function breedPriceHeadline(hint: BreedPriceHint | null | undefined): string | null {
  if (hint?.price_min == null) return null;
  return `Desde ${cop(hint.price_min)}`;
}

export function breedPriceDetailLabel(hint: BreedPriceHint | null | undefined): string | null {
  if (hint?.price_min == null) return null;
  const { price_min: min, price_max: max } = hint;
  if (max != null && max !== min) return copRange(min, max);
  return cop(min);
}

export function breedPriceNote(hint: BreedPriceHint | null | undefined): string {
  const breed = hint?.breed_name?.trim();
  if (breed) {
    return `Referencial para ${breed}; se confirma al llegar según la mascota.`;
  }
  return DEFAULT_PRICE_NOTE;
}

export function servicePriceHeadlineForClient(
  s: Pick<Service, "price" | "price_min" | "price_max" | "price_pending">,
  breedHint?: BreedPriceHint | null,
  petSelected = false,
): string {
  const breed = breedPriceHeadline(breedHint);
  if (breed) return breed;
  if (petSelected && breedHint && !breedHint.has_profile) return COUNTER_VALIDATION_LABEL;
  return servicePriceHeadline(s);
}

export function servicePriceNoteForClient(
  s: Pick<Service, "price_note" | "price_min" | "price_max" | "price_pending">,
  breedHint?: BreedPriceHint | null,
  petSelected = false,
): string {
  if (breedHint?.price_min != null) return breedPriceNote(breedHint);
  if (petSelected && breedHint && !breedHint.has_profile) return COUNTER_VALIDATION_NOTE;
  return servicePriceNote(s);
}

export function servicePriceModeFromService(
  s: Pick<Service, "price" | "price_min" | "price_max">,
): "fixed" | "variable" {
  return isVariableServicePrice(s) ? "variable" : "fixed";
}

export function fixedPriceSummary(price: number): string {
  return cop(price);
}

export function appointmentShowsChargedPrice(
  a: { status?: string; price_pending?: boolean },
  isCliente: boolean,
): boolean {
  if (!isCliente) return true;
  if (a.price_pending) return false;
  const st = normalizeStatus(a.status);
  return st === "enproceso" || st === "finalizada";
}
