/** Textos del historial de existencias (kardex). */

import {
  formatContentQty,
  formatPackagesLabel,
  isPackUnit,
  isVolumeUnit,
  storedToPresentation,
} from "./inventory-qty";

export type KardexUnit = {
  unit_kind?: string | null;
  pack_size?: number | null;
};

export function kardexQtyPhrase(stored: number, unit?: KardexUnit): string {
  const n = Math.abs(Number(stored) || 0);
  const kind = (unit?.unit_kind || "unidad").toLowerCase();
  const pack = Number(unit?.pack_size) || 1;
  if (isVolumeUnit(kind)) {
    const packs = storedToPresentation(kind, pack, n);
    return `${formatPackagesLabel(packs, kind)} (${formatContentQty(n, kind)})`;
  }
  if (isPackUnit(kind)) {
    return formatPackagesLabel(storedToPresentation(kind, pack, n), kind);
  }
  return n === 1 ? "1 unidad" : `${n} unidades`;
}

export function kardexActionLabel(kind: string, delta: number, unit?: KardexUnit): string {
  const qty = kardexQtyPhrase(delta, unit);
  if (kind === "venta_cita" || kind === "venta_mostrador") {
    return `Venta ${qty}`;
  }
  if (kind === "compra") return `Alta de stock ${qty}`;
  if (kind === "merma") return `Baja ${qty}`;
  if (kind === "consumo_servicio") return `Consumo servicio ${qty}`;
  if (delta > 0) return `Alta de stock ${qty}`;
  return `Ajuste −${qty}`;
}

export function kardexBalanceLabel(quantityAfter: number, unit?: KardexUnit): string {
  return `Saldo ${kardexQtyPhrase(quantityAfter, unit)}`;
}

export function formatKardexWhen(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return String(iso).slice(0, 16).replace("T", " ");
  }
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function kardexActor(name?: string | null, email?: string | null): string {
  const n = (name || "").trim();
  if (n) return n;
  const e = (email || "").trim();
  if (e) return e;
  return "Sistema";
}

export const KARDEX_TITLE = "Kardex";
export const KARDEX_HELP = "Altas, bajas y ajustes de esta sede. Lo que caduca primero se vende primero.";
