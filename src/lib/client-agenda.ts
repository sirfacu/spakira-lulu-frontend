/** Helpers de copy y especie para la agenda del cliente. */

export type OccupiedKind = "dog" | "cat" | "mixed";

export function speciesKind(raw: string | null | undefined): "dog" | "cat" | "other" {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s) return "other";
  if (s === "gato" || s === "cat" || s.includes("gat") || s.includes("felin")) return "cat";
  if (s === "perro" || s === "dog" || s.includes("perr") || s.includes("canin") || s.includes("dog"))
    return "dog";
  return "other";
}

export function speciesLabel(raw: string | null | undefined): string {
  const k = speciesKind(raw);
  if (k === "cat") return "Felino";
  if (k === "dog") return "Canino";
  return "Mascota";
}

export function speciesEmoji(raw: string | null | undefined): string {
  return speciesKind(raw) === "cat" ? "🐱" : "🐶";
}

export function sexMark(sex: string | null | undefined): string {
  const s = (sex ?? "").toLowerCase();
  if (s.includes("hembra") || s === "f" || s === "female") return "♀";
  if (s.includes("macho") || s === "m" || s === "male") return "♂";
  return "";
}

export function remainingCopy(remaining: number): string {
  const n = Math.max(0, remaining);
  return n === 1 ? "1 disponible" : `${n} disponibles`;
}

/** Etiqueta compacta de la grilla (mockup). */
export function slotCountLabel(remaining: number): string {
  const n = Math.max(0, remaining);
  return n === 1 ? "1 slot" : `${n} slots`;
}

export function occupiedCopy(kind: OccupiedKind | null | undefined): string {
  if (kind === "cat") return "Cuidando a otro michi";
  if (kind === "dog") return "Dando amor a otro peludito";
  return "Dando amor a otro peludito";
}

export function occupiedEmoji(kind: OccupiedKind | null | undefined): string {
  if (kind === "cat") return "🐱";
  if (kind === "dog") return "🐶";
  return "🐾";
}

export function startOfWeekMonday(d: Date): Date {
  const copy = new Date(d);
  const diff = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

export function ymd(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function weekRangeLabel(monday: Date): string {
  const end = addDays(monday, 6);
  const fmt = (x: Date) => {
    const day = x.getDate();
    const month = x.toLocaleDateString("es-CO", { month: "short" }).replace(/\.$/, "");
    return `${day} de ${month}`;
  };
  return `${fmt(monday)} - ${fmt(end)} de ${end.getFullYear()}`;
}

export function isPastHour(dateYmd: string, hour: number, now = new Date()): boolean {
  const [y, m, d] = dateYmd.split("-").map(Number);
  const slot = new Date(y, (m || 1) - 1, d || 1, hour, 0, 0, 0);
  return slot.getTime() < now.getTime();
}

export function slotWhenLabel(dateYmd: string, hour: number): string {
  const [y, m, d] = dateYmd.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  const day = dt.toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return `${day} · ${String(hour).padStart(2, "0")}:00`;
}
