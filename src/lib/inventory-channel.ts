/** Etiquetas de uso de ítems de inventario (columna `channel` en BD). */

export type InventoryChannel = "interno" | "externo" | "interno_externo";

export function inventoryChannelLabel(channel: string | null | undefined): string {
  if (channel === "externo") return "Venta al público";
  if (channel === "interno_externo") return "Interno + venta (legacy)";
  return "Consumo interno";
}

export function inventoryChannelHint(channel: string | null | undefined): string {
  if (channel === "externo") {
    return "Aparece en tienda / extras de cita para clientes.";
  }
  if (channel === "interno_externo") {
    return "Registro antiguo mixto. Conviene separar en dos ítems (consumo y venta).";
  }
  return "Insumos del spa (shampoo, tijeras, etc.) — no se vende al público.";
}

export function inventoryChannelBadgeClass(channel: string | null | undefined): string {
  if (channel === "externo") {
    return "bg-accent/15 text-accent border-accent/30";
  }
  if (channel === "interno_externo") {
    return "bg-gold/20 text-gold-foreground border-gold/40";
  }
  return "bg-secondary text-muted-foreground border-border";
}

export function isShoppable(channel: string | null | undefined): boolean {
  return channel === "externo" || channel === "interno_externo";
}
