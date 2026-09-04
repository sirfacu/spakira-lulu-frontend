/** Roles líquidos usados para dosis / perfil de raza. */
export const LIQUID_MATERIAL_ROLES = ["shampoo", "conditioner", "medicated"] as const;

export type LiquidMaterialRole = (typeof LIQUID_MATERIAL_ROLES)[number];

export function isLiquidMaterialRole(role: string): role is LiquidMaterialRole {
  return (LIQUID_MATERIAL_ROLES as readonly string[]).includes(role);
}

export function stripAccents(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

type InferItem = {
  name?: string | null;
  sku?: string | null;
  category?: string | null;
};

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

/** Infiera material_role desde el producto de inventario. */
export function inferMaterialRole(item: InferItem): string {
  const cat = stripAccents(item.category ?? "");
  const name = stripAccents(item.name ?? "");
  const blob = `${name} ${cat}`;

  if (cat.includes("accesorio") || isMoñaItem(item)) return "accessory";

  if (
    name.includes("acondicion") ||
    cat.includes("acondicion") ||
    name.includes("conditioner")
  ) {
    return "conditioner";
  }

  if (
    name.includes("medicad") ||
    cat.includes("medicad") ||
    cat.includes("tratamiento") ||
    name.includes("dermatolog") ||
    name.includes("antipulgas") ||
    name.includes("anti-pulgas") ||
    name.includes("anti pulgas") ||
    /\bpulgas?\b/.test(name) ||
    blob.includes("skin care")
  ) {
    return "medicated";
  }

  if (
    name.includes("shampoo") ||
    cat.includes("shampoo") ||
    cat.includes("banio") ||
    cat.includes("bano")
  ) {
    return "shampoo";
  }

  return "shampoo";
}
