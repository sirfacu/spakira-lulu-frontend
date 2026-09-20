/** Catálogo de la ficha / cierre: cualquier ítem de la sede, no solo medicado/tinte. */

import { isVisitOnlyCategory, visitCareSalePrice } from "./service-material-role";

export type ExtraCatalogSource = {
  id: string;
  name: string;
  category?: string | null;
  sale_price?: number | null;
  sale_price_unit?: number | null;
  pack_size?: number | null;
  quantity?: number | null;
  available?: number | null;
};

export type ExtraCatalogItem = {
  id: string;
  name: string;
  category: string;
  unit_price: number;
  available: number;
};

function catalogPrice(item: ExtraCatalogSource): number {
  if (isVisitOnlyCategory(item.category)) return visitCareSalePrice(item);
  return Number(item.sale_price_unit || item.sale_price) || 0;
}

function toCatalogItem(item: ExtraCatalogSource, fallbackCategory: string): ExtraCatalogItem {
  return {
    id: item.id,
    name: item.name,
    category: item.category || fallbackCategory,
    unit_price: catalogPrice(item),
    available: Number(item.available ?? item.quantity) || 0,
  };
}

/** Staff: todo el inventario de la sede + vitrina. Cliente: solo vitrina. */
export function appointmentProductCatalog(
  inventory: ExtraCatalogSource[],
  shop: ExtraCatalogSource[],
  opts?: { shopOnly?: boolean },
): ExtraCatalogItem[] {
  if (opts?.shopOnly) {
    return shop.map((i) => toCatalogItem(i, "Vitrina"));
  }
  const byId = new Map<string, ExtraCatalogItem>();
  for (const item of inventory) {
    byId.set(item.id, toCatalogItem(item, "Insumo"));
  }
  for (const item of shop) {
    if (!byId.has(item.id)) byId.set(item.id, toCatalogItem(item, "Vitrina"));
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export function extraSearchHits(
  catalog: ExtraCatalogItem[],
  query: string,
  limit = 8,
): ExtraCatalogItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return catalog.filter((item) => item.name.toLowerCase().includes(q)).slice(0, limit);
}

/** Nombre libre + precio, si no hay un ítem con ese nombre exacto. */
export function extraSearchAllowsCustom(query: string, catalog: ExtraCatalogItem[]): boolean {
  const q = query.trim();
  if (q.length < 2) return false;
  return !catalog.some((item) => item.name.toLowerCase() === q.toLowerCase());
}
