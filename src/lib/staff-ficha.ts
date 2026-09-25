/** Resumen de ficha staff: horario base vs excepción, pago vigente vs histórico. */

export const WEEKDAY_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export type FichaWorkHour = {
  weekday: number;
  start_time: string;
  end_time: string;
  valid_from?: string | null;
  valid_to?: string | null;
  location_id?: string | null;
};

export type FichaPayTerm = {
  id?: string;
  effective_from: string;
  effective_to: string | null;
  payment_mode: string;
  shift_rate: number;
  commission_pct: number;
  fixed_pay_basis?: string;
};

export function ymd(value: string | null | undefined) {
  return (value ?? "").slice(0, 10);
}

export function isBaseHour(h: FichaWorkHour) {
  return !h.valid_from && !h.valid_to;
}

export function hoursForLocation(hours: FichaWorkHour[], locationId?: string) {
  if (!locationId) return uniqueWorkHours(hours);
  const hasScoped = hours.some((h) => h.location_id);
  const filtered = hasScoped
    ? hours.filter((h) => h.location_id === locationId)
    : hours;
  return uniqueWorkHours(filtered.length ? filtered : hours.filter((h) => !h.location_id));
}

export function hourSlotKey(h: FichaWorkHour) {
  return [
    h.weekday,
    (h.start_time ?? "").slice(0, 5),
    (h.end_time ?? "").slice(0, 5),
    ymd(h.valid_from),
    ymd(h.valid_to),
  ].join("|");
}

/** Misma franja copiada a otra sede (o sin location_id) no se lista dos veces. */
export function uniqueWorkHours(hours: FichaWorkHour[]): FichaWorkHour[] {
  const seen = new Set<string>();
  const out: FichaWorkHour[] = [];
  for (const h of hours) {
    const key = hourSlotKey(h);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
  }
  return out;
}

export function baseHours(hours: FichaWorkHour[]) {
  return hours.filter(isBaseHour).sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time));
}

export function summarizeBaseHours(hours: FichaWorkHour[]) {
  return baseHours(hours).map((h) => ({
    weekday: h.weekday,
    label: WEEKDAY_SHORT[h.weekday] ?? String(h.weekday),
    start: (h.start_time ?? "").slice(0, 5),
    end: (h.end_time ?? "").slice(0, 5),
  }));
}

export function exceptionRanges(hours: FichaWorkHour[]) {
  const map = new Map<string, { from: string; to: string; count: number }>();
  for (const h of hours) {
    if (!h.valid_from) continue;
    const from = ymd(h.valid_from);
    const to = ymd(h.valid_to);
    const key = `${from}|${to}`;
    const prev = map.get(key);
    if (prev) prev.count += 1;
    else map.set(key, { from, to, count: 1 });
  }
  return [...map.values()];
}

export function defaultHoursLocationId(staff: {
  home_location_id?: string | null;
  location_ids?: string[];
}) {
  return staff.home_location_id || staff.location_ids?.[0] || undefined;
}

export function payTermKey(t: FichaPayTerm) {
  return [
    ymd(t.effective_from),
    t.effective_to ? ymd(t.effective_to) : "",
    t.payment_mode,
    Number(t.shift_rate),
    Number(t.commission_pct),
    t.fixed_pay_basis || "por_turno",
  ].join("|");
}

export function uniquePayTerms<T extends FichaPayTerm>(terms: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const t of terms) {
    const key = payTermKey(t);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

export function currentPayTerm<T extends FichaPayTerm>(terms: T[], today = todayIso()): T | null {
  const day = ymd(today);
  const unique = uniquePayTerms(terms);
  const covering = unique.filter((t) => {
    const from = ymd(t.effective_from);
    const to = t.effective_to ? ymd(t.effective_to) : "";
    return from <= day && (!to || to >= day);
  });
  if (covering.length) {
    return covering.sort((a, b) => ymd(b.effective_from).localeCompare(ymd(a.effective_from)))[0];
  }
  return unique.find((t) => !t.effective_to) ?? unique[0] ?? null;
}

export function upcomingPayTerms<T extends FichaPayTerm>(terms: T[], today = todayIso()): T[] {
  const day = ymd(today);
  const current = currentPayTerm(terms, day);
  const currentKey = current ? payTermKey(current) : "";
  return uniquePayTerms(terms).filter(
    (t) => ymd(t.effective_from) > day && payTermKey(t) !== currentKey,
  );
}

export function pastPayTerms<T extends FichaPayTerm>(terms: T[], today = todayIso()): T[] {
  const day = ymd(today);
  const current = currentPayTerm(terms, day);
  const currentKey = current ? payTermKey(current) : "";
  return uniquePayTerms(terms).filter((t) => {
    if (payTermKey(t) === currentKey) return false;
    if (ymd(t.effective_from) > day) return false;
    const to = t.effective_to ? ymd(t.effective_to) : "";
    return !!to && to < day;
  });
}

export function payFieldsChanged(
  before: {
    shift_rate?: number;
    payment_mode?: string;
    commission_pct?: number;
    fixed_pay_basis?: string;
  },
  next: {
    shift_rate: number;
    payment_mode: string;
    commission_pct: number;
    fixed_pay_basis: string;
  },
) {
  return (
    Number(before.shift_rate ?? 0) !== next.shift_rate ||
    (before.payment_mode || "fijo") !== next.payment_mode ||
    Number(before.commission_pct ?? 0) !== next.commission_pct ||
    (before.fixed_pay_basis === "mensual" ? "mensual" : "por_turno") !== next.fixed_pay_basis
  );
}

export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
