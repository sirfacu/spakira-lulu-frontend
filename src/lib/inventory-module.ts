/** Inventario por módulo: un motor, cada SKU tiene dueño. */

export const INVENTORY_MODULES = ["spa", "veterinary", "hotel"] as const;
export type InventoryModule = (typeof INVENTORY_MODULES)[number];

/** Filtro de UI (hotel sin chip todavía). */
export type InventoryModuleFilter = "spa" | "veterinary";

export const VET_INVENTORY_CATEGORIES = [
  "vacuna",
  "desparasitante",
  "medicamento",
  "insumo",
] as const;

export type DispenseMode = "content" | "whole_pack";

export function isVetInventoryCategory(category: string | null | undefined): boolean {
  const normalized = (category ?? "").trim().toLowerCase();
  return (VET_INVENTORY_CATEGORIES as readonly string[]).includes(normalized);
}

/** Preferir `module` del API; si falta, inferir por categoría (backfill viejo). */
export function resolveInventoryModule(item: {
  module?: string | null;
  category?: string | null;
}): InventoryModule {
  const explicit = (item.module ?? "").trim().toLowerCase();
  if (explicit === "spa" || explicit === "veterinary" || explicit === "hotel") {
    return explicit;
  }
  return isVetInventoryCategory(item.category) ? "veterinary" : "spa";
}

export function itemMatchesInventoryModule(
  item: { module?: string | null; category?: string | null },
  filter: InventoryModuleFilter,
): boolean {
  const module = resolveInventoryModule(item);
  if (filter === "veterinary") return module === "veterinary";
  return module === "spa";
}

export function filterInventoryByModule<
  T extends { module?: string | null; category?: string | null },
>(items: T[], module: InventoryModuleFilter): T[] {
  return items.filter((item) => itemMatchesInventoryModule(item, module));
}

export function filterCategoryNamesByModule(
  names: string[],
  module: InventoryModuleFilter,
): string[] {
  return names.filter((name) =>
    itemMatchesInventoryModule({ category: name }, module),
  );
}

export function defaultDispenseMode(category: string | null | undefined): DispenseMode {
  const cat = (category ?? "").trim().toLowerCase();
  if (cat === "vacuna" || cat === "desparasitante" || cat === "insumo") return "whole_pack";
  return "content";
}

/** Unidades de kardex que se descontarán al aplicar. */
export function stockQtyForDispense(input: {
  dispense_mode?: string | null;
  unit_kind?: string | null;
  pack_size?: number | null;
  qty_applied: number;
}): number {
  const applied = Number(input.qty_applied);
  if (!(applied > 0)) return 0;
  const mode = (input.dispense_mode || "content").toLowerCase();
  const unit = (input.unit_kind || "unidad").toLowerCase();
  const pack = Number(input.pack_size) || 1;
  if (mode === "whole_pack") {
    if (unit === "ml" || unit === "g" || unit === "l" || unit === "pack" || unit === "uso") {
      return Math.max(1, Math.round(pack));
    }
    return 1;
  }
  return Math.max(1, Math.round(applied));
}
