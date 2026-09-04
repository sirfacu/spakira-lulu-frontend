/** Etiquetas de uso de ítems de inventario (columna `channel` en BD). */

export type InventoryChannel = "interno" | "externo" | "interno_externo";

export function inventoryChannelLabel(channel: string | null | undefined): string {
  if (channel === "externo") return "Solo venta";
  if (channel === "interno_externo") return "Interno y venta";
  return "Uso interno";
}

export function inventoryChannelHint(channel: string | null | undefined): string {
  if (channel === "externo") {
    return "🛒 Solo venta — está destinado exclusivamente a la venta.";
  }
  if (channel === "interno_externo") {
    return "🔄 Uso interno y venta — puede utilizarse internamente y también venderse.";
  }
  return "🔧 Uso interno — solo puede utilizarse dentro del negocio.";
}

export function inventoryChannelFormLabel(channel: InventoryChannel): string {
  return inventoryChannelHint(channel);
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
