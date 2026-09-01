/** Precio publicado = costo × (1 + margen%). Alineado con backend/app/stock.py */

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

/** Valor en costo de una línea (para totales del panel). */
export function inventoryLineValue(item: InventoryValueLine): number {
  const cost = Number(item.purchase_price) || 0;
  const qty = Number(item.quantity) || 0;
  const pack = Number(item.pack_size) || 1;
  const kind = (item.unit_kind || "unidad").toLowerCase();

  // BARF, bidones ml, etc.: quantity = envases; purchase_price = costo del envase
  if (kind === "g" || kind === "ml") {
    return cost * qty;
  }
  // Gemas/bandas: qty >= pack → unidades sueltas; qty < pack → cantidad de presentaciones
  if (pack > 1 && kind === "unidad") {
    if (qty >= pack) {
      return cost * (qty / pack);
    }
    return cost * qty;
  }
  return cost * qty;
}

export { isShoppable } from "@/lib/inventory-channel";
