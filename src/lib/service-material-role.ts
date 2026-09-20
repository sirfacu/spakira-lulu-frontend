/** Roles líquidos usados para dosis / perfil de raza. */
export const LIQUID_MATERIAL_ROLES = ["shampoo", "conditioner"] as const;

export const QTY_REQUIRED_ROLES = [] as const;
export const VISIT_ONLY_ROLES = ["medicated", "dye"] as const;
export const VISIT_ONLY_CATEGORIES = ["medicado", "tinte"] as const;

export const AUTO_CONSUME_CATEGORIES = [
  "perfume",
  "salud",
  "herramienta de trabajo",
] as const;

export type LiquidMaterialRole = (typeof LIQUID_MATERIAL_ROLES)[number];

export function isLiquidMaterialRole(role: string): role is LiquidMaterialRole {
  return (LIQUID_MATERIAL_ROLES as readonly string[]).includes(role);
}

export function isQtyRequiredRole(role: string): boolean {
  return (QTY_REQUIRED_ROLES as readonly string[]).includes(role);
}

export function isVisitOnlyRole(role: string): boolean {
  return (VISIT_ONLY_ROLES as readonly string[]).includes(role);
}

export function isVisitOnlyCategory(category: string | null | undefined): boolean {
  const cat = normalizeCategory(category);
  if ((VISIT_ONLY_CATEGORIES as readonly string[]).includes(cat)) return true;
  return cat.includes("tinte") || cat.includes("colorimetr") || cat.includes("medicad");
}

/** Precio de venta por ml/g/pieza — mismo criterio que el backend. */
export function visitCareSalePrice(item: {
  sale_price_unit?: number | null;
  sale_price?: number | null;
  pack_size?: number | null;
}): number {
  const unit = Number(item.sale_price_unit);
  if (Number.isFinite(unit) && unit > 0) return unit;
  const pack = Number(item.sale_price) || 0;
  const size = Number(item.pack_size) || 1;
  return pack > 0 && size > 0 ? pack / size : 0;
}

export function matchesVisitCareRole(item: InferItem, role: "medicated" | "dye"): boolean {
  const cat = normalizeCategory(item.category);
  if (role === "medicated") {
    return cat === "medicado" || cat.includes("medicad") || inferMaterialRole(item) === "medicated";
  }
  return (
    cat === "tinte" ||
    cat.includes("tinte") ||
    cat.includes("colorimetr") ||
    inferMaterialRole(item) === "dye"
  );
}

export function visitCareItems<T extends InferItem>(items: T[], role: "medicated" | "dye"): T[] {
  return items.filter((i) => matchesVisitCareRole(i, role));
}

export function stripAccents(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

export function normalizeCategory(s: string | null | undefined): string {
  return stripAccents(s ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

export function isAutoConsumeCategory(category: string | null | undefined): boolean {
  return (AUTO_CONSUME_CATEGORIES as readonly string[]).includes(normalizeCategory(category));
}

export function isWearCategory(category: string | null | undefined): boolean {
  return normalizeCategory(category) === "herramienta de trabajo";
}

/** Líneas de herramienta: no se muestran en estimado ni en el cierre. */
export function isWearEstimateLine(line: {
  material_role?: string | null;
  quantity_unit?: string | null;
}): boolean {
  return line.material_role === "tool" || line.quantity_unit === "uso";
}

type InferItem = {
  name?: string | null;
  sku?: string | null;
  category?: string | null;
  staff_description?: string | null;
};

export function isServiceAttachableItem(item: InferItem): boolean {
  const cat = normalizeCategory(item.category);
  if (isAutoConsumeCategory(cat)) return false;
  if (isVisitOnlyCategory(cat)) return false;
  if (cat === "alimentos" || cat === "barf") return false;
  return true;
}

function isMoñaItem(item: InferItem) {
  const name = stripAccents(item.name ?? "");
  const sku = stripAccents(item.sku ?? "");
  if (name.includes("obsoleto")) return false;
  if (/\bmonitas?\b/.test(name) || /\bmonas?\b/.test(name) || /\bmonos?\b/.test(name)) {
    return true;
  }
  if (
    sku === "acc-mon" ||
    sku.includes("mon-") ||
    sku.includes("mona") ||
    sku.includes("mono") ||
    sku.includes("monita")
  ) {
    return true;
  }
  return false;
}

export function isPanoletaItem(item: InferItem): boolean {
  const blob = stripAccents(
    `${item.name ?? ""} ${item.staff_description ?? ""} ${item.sku ?? ""}`,
  );
  return blob.includes("panolet");
}

export function parsePanoletaSize(item: InferItem): "XS" | "S" | "M" | "L" | null {
  const blob = stripAccents(
    `${item.name ?? ""} ${item.staff_description ?? ""} ${item.sku ?? ""}`,
  );
  const matches = [...blob.matchAll(/(?:talla|size)?[\s\-_/]*\b(xs|[sml])\b/g)];
  if (!matches.length) return null;
  return matches[matches.length - 1]![1]!.toUpperCase() as "XS" | "S" | "M" | "L";
}

export function panoletaFamilyKey(item: InferItem): string {
  let blob = stripAccents(
    `${item.name ?? ""} ${item.staff_description ?? ""} ${item.sku ?? ""}`,
  );
  blob = blob.replace(/(?:talla|size)?[\s\-_/]*\b(xs|[sml])\b/g, " ");
  blob = blob.replace(/\bpanoletas\b/g, "panoleta");
  blob = blob.replace(/[^a-z0-9]+/g, " ");
  return blob.split(/\s+/).filter(Boolean).join(" ");
}

/** Infiera material_role desde el producto de inventario. */
export function inferMaterialRole(item: InferItem): string {
  const cat = stripAccents(item.category ?? "");
  const name = stripAccents(item.name ?? "");
  const blob = `${name} ${cat}`;

  if (cat.includes("accesorio") || isMoñaItem(item) || isPanoletaItem(item)) {
    return "accessory";
  }

  if (cat === "perfume" || name.includes("forever vip")) {
    return "perfume";
  }

  if (cat === "salud") {
    return "health";
  }

  if (cat === "herramienta de trabajo") {
    return "tool";
  }

  if (
    cat === "tinte" ||
    cat.includes("tinte") ||
    cat.includes("colorimetr") ||
    name.includes("tinte") ||
    name.includes("colorimetr")
  ) {
    return "dye";
  }

  if (
    name.includes("acondicion") ||
    cat.includes("acondicion") ||
    name.includes("conditioner")
  ) {
    return "conditioner";
  }

  if (
    cat === "medicado" ||
    name.includes("medicad") ||
    name.includes("dermatolog") ||
    name.includes("antipulgas") ||
    name.includes("anti-pulgas") ||
    name.includes("anti pulgas") ||
    /\bpulgas?\b/.test(name) ||
    blob.includes("skin care")
  ) {
    return "medicated";
  }

  if (name.includes("shampoo") || cat === "shampoo" || cat.includes("shampoo")) {
    return "shampoo";
  }

  return "shampoo";
}
