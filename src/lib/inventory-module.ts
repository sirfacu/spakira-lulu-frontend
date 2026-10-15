/** Categorías clínicas: no mezclar con el stock de baño en la misma lista. */
export const VET_INVENTORY_CATEGORIES = [
  "vacuna",
  "desparasitante",
  "medicamento",
] as const;

export type InventoryModuleFilter = "spa" | "veterinary";

export function isVetInventoryCategory(category: string | null | undefined): boolean {
  const normalized = (category ?? "").trim().toLowerCase();
  return (VET_INVENTORY_CATEGORIES as readonly string[]).includes(normalized);
}

export function itemMatchesInventoryModule(
  category: string | null | undefined,
  module: InventoryModuleFilter,
): boolean {
  const isVet = isVetInventoryCategory(category);
  return module === "veterinary" ? isVet : !isVet;
}

export function filterInventoryByModule<T extends { category?: string | null }>(
  items: T[],
  module: InventoryModuleFilter,
): T[] {
  return items.filter((item) => itemMatchesInventoryModule(item.category, module));
}

export function filterCategoryNamesByModule(
  names: string[],
  module: InventoryModuleFilter,
): string[] {
  return names.filter((name) => itemMatchesInventoryModule(name, module));
}
