/** Catálogo de misceláneos / tienda para el cierre de cita. */

export type MiscCatalogItem = {
  id: string;
  name: string;
  category: string;
  unit_price: number;
};

function barfLine(flavor: "Pollo" | "Carne", grams: number, pricePer100g: number): MiscCatalogItem {
  return {
    id: `barf-${flavor.toLowerCase()}-${grams}`,
    name: `Comida BARF Kirajiro ${flavor} ${grams}g`,
    category: "BARF Kirajiro",
    unit_price: Math.round((grams / 100) * pricePer100g),
  };
}

const BARF_POLLO = [100, 200, 300, 400, 500].map((g) => barfLine("Pollo", g, 8500));
const BARF_CARNE = [100, 200, 300, 400, 500].map((g) => barfLine("Carne", g, 9200));

const OTROS: MiscCatalogItem[] = [
  { id: "shampoo-hipo", name: "Shampoo hipoalergénico 250ml", category: "Baño", unit_price: 28000 },
  { id: "shampoo-premium", name: "Shampoo premium Spa Kira 250ml", category: "Baño", unit_price: 35000 },
  { id: "acondicionador", name: "Acondicionador sedoso 250ml", category: "Baño", unit_price: 30000 },
  { id: "perfume-lavanda", name: "Perfume canino lavanda", category: "Spa", unit_price: 28000 },
  { id: "spray-desenredante", name: "Spray desenredante", category: "Spa", unit_price: 26000 },
  { id: "bufanda-s", name: "Bufanda talla S", category: "Accesorios", unit_price: 22000 },
  { id: "bufanda-m", name: "Bufanda talla M", category: "Accesorios", unit_price: 25000 },
  { id: "bufanda-l", name: "Bufanda talla L", category: "Accesorios", unit_price: 28000 },
  { id: "camiseta-s", name: "Camiseta Spa Kira talla S", category: "Accesorios", unit_price: 32000 },
  { id: "camiseta-m", name: "Camiseta Spa Kira talla M", category: "Accesorios", unit_price: 35000 },
  { id: "camiseta-l", name: "Camiseta Spa Kira talla L", category: "Accesorios", unit_price: 38000 },
  { id: "monios", name: "Moños decorativos x10", category: "Accesorios", unit_price: 12000 },
  { id: "bandana", name: "Bandana estampada", category: "Accesorios", unit_price: 18000 },
  { id: "toalla-micro", name: "Toalla microfibra", category: "Baño", unit_price: 22000 },
];

export const MISC_CATALOG: MiscCatalogItem[] = [...BARF_POLLO, ...BARF_CARNE, ...OTROS];

export function miscCatalogByCategory(): { category: string; items: MiscCatalogItem[] }[] {
  const map = new Map<string, MiscCatalogItem[]>();
  for (const item of MISC_CATALOG) {
    const list = map.get(item.category) ?? [];
    list.push(item);
    map.set(item.category, list);
  }
  return [...map.entries()].map(([category, items]) => ({ category, items }));
}
