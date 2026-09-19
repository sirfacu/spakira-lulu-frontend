/** Conversión envases/packs/piezas (UI) ↔ contenido guardado en BD. */

export function isVolumeUnit(unitKind: string): boolean {
  const k = unitKind.toLowerCase();
  return k === "ml" || k === "g" || k === "l";
}

export function isPackUnit(unitKind: string): boolean {
  return unitKind.toLowerCase() === "pack";
}

export function storesTotalContent(unitKind: string): boolean {
  return isVolumeUnit(unitKind) || isPackUnit(unitKind);
}

export function presentationToStored(
  unitKind: string,
  packSize: number,
  presentation: number,
): number {
  const pres = Number(presentation) || 0;
  if (storesTotalContent(unitKind)) {
    const pack = Number(packSize) || 1;
    return Math.round(pres * pack);
  }
  return Math.round(pres);
}

export function storedToPresentation(
  unitKind: string,
  packSize: number,
  stored: number,
): number {
  const qty = Number(stored) || 0;
  if (storesTotalContent(unitKind)) {
    const pack = Number(packSize) || 1;
    return pack > 0 ? qty / pack : qty;
  }
  return qty;
}

/** Delta en unidades de BD para dejar el stock en N envases/packs/piezas. */
export function storedDeltaToMatch(args: {
  unitKind: string;
  packSize: number;
  currentStored: number;
  wantedPresentation: number;
}): number {
  const wanted = presentationToStored(args.unitKind, args.packSize, args.wantedPresentation);
  const current = Math.round(Number(args.currentStored) || 0);
  return wanted - current;
}

export function doseUnitLabel(unitKind: string): string {
  const k = unitKind.toLowerCase();
  if (k === "ml") return "ml";
  if (k === "g") return "g";
  if (k === "l") return "l";
  if (k === "pack") return "piezas";
  return "unidades";
}

export function presentationWord(unitKind: string, n: number): string {
  const k = unitKind.toLowerCase();
  if (k === "pack") return n === 1 ? "pack" : "packs";
  if (isVolumeUnit(k)) return n === 1 ? "envase" : "envases";
  return n === 1 ? "pieza" : "piezas";
}

/** Redondeo visible: no esconder 1 ml extra llamándolo “1 envase”. */
export function niceQty(n: number, maxDecimals = 1): number {
  if (!Number.isFinite(n)) return 0;
  const nearestInt = Math.round(n);
  const snap = 10 ** -(maxDecimals + 1);
  if (Math.abs(n - nearestInt) < snap) return nearestInt;
  const f = 10 ** maxDecimals;
  return Math.round(n * f) / f;
}

export function formatContentQty(qty: number, unitKind: string): string {
  const k = unitKind.toLowerCase();
  const n = niceQty(qty, k === "l" ? 3 : 1);
  if (k === "ml") return `${n} ml`;
  if (k === "g") return `${n} g`;
  if (k === "l") return `${n} L`;
  return String(n);
}

export function formatPackagesLabel(packs: number, unitKind: string): string {
  const n = niceQty(packs, 3);
  return `${n} ${presentationWord(unitKind, n)}`;
}
