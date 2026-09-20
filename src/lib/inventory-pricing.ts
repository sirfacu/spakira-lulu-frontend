/** Precio publicado = costo × (1 + margen%). Alineado con backend/app/stock.py */

import { isShoppable } from "@/lib/inventory-channel";
import { isVisitOnlyCategory } from "@/lib/service-material-role";

export { isShoppable } from "@/lib/inventory-channel";

export function suggestedSale(cost: number, marginPct: number): number {
  return Math.round((Number(cost) || 0) * (1 + (Number(marginPct) || 0) / 100));
}

export function marginFromPrices(cost: number, sale: number): number {
  const c = Number(cost) || 0;
  if (c <= 0) return 0;
  return Math.round((((Number(sale) || 0) - c) / c) * 10000) / 100;
}

export function unitPriceFromPack(salePack: number, packSize: number): number {
  const size = Number(packSize) || 1;
  return Math.round((Number(salePack) || 0) / (size > 0 ? size : 1));
}

export type InventoryValueLine = {
  quantity: number;
  purchase_price: number;
  pack_size?: number | null;
  unit_kind?: string | null;
};

/** Sustantivo del costo cargado en la ficha (un envase / pack / unidad). */
export function purchaseCostNoun(unitKind?: string | null): string {
  const k = (unitKind || "unidad").toLowerCase();
  if (k === "ml" || k === "g" || k === "l") return "envase";
  if (k === "pack") return "pack";
  return "unidad";
}

/** Valor en costo de una línea (para totales del panel). Alineado con backend. */
export function inventoryLineValue(item: InventoryValueLine): number {
  const cost = Number(item.purchase_price) || 0;
  const qty = Number(item.quantity) || 0;
  const pack = Number(item.pack_size) || 1;
  const kind = (item.unit_kind || "unidad").toLowerCase();

  // g/ml/l/pack: quantity = contenido total; purchase_price = costo de UN envase/pack
  if (kind === "g" || kind === "ml" || kind === "l" || kind === "pack") {
    return Math.round(cost * (qty / (pack || 1)));
  }
  // Gemas/bandas: qty >= pack → unidades sueltas; qty < pack → cantidad de presentaciones
  if (pack > 1 && kind === "unidad") {
    if (qty >= pack) {
      return Math.round(cost * (qty / pack));
    }
    return Math.round(cost * qty);
  }
  return Math.round(cost * qty);
}

export function needsSalePrice(
  channel: string | null | undefined,
  category: string | null | undefined,
): boolean {
  return isShoppable(channel) || isVisitOnlyCategory(category);
}
