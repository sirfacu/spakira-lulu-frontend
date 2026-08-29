/** Textos del historial de existencias (kardex). */

export function kardexActionLabel(kind: string, delta: number): string {
  const n = Math.abs(Number(delta) || 0);
  const units = n === 1 ? "unidad" : "unidades";
  if (kind === "venta_cita" || kind === "venta_mostrador") {
    return `Venta ${n} ${units}`;
  }
  if (kind === "compra") return `Alta de stock ${n} ${units}`;
  if (kind === "merma") return `Baja ${n} ${units}`;
  if (delta > 0) return `Alta de stock ${n} ${units}`;
  return `Ajuste −${n} ${units}`;
}

export function kardexBalanceLabel(quantityAfter: number): string {
  const n = Number(quantityAfter) || 0;
  const word = n === 1 ? "existencia" : "existencias";
  return `Inventario ${n} ${word}`;
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

export const KARDEX_HELP =
  "Cada cambio de stock queda asentado: quién lo hizo, cuántas unidades y el saldo que quedó. Las ventas descuentan primero lo que caduca antes (el lote más viejo).";
