export const cop = (value: number | null | undefined) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));

/** Rango de referencia (apreciación); si min=max muestra un solo valor. */
export const copRange = (
  min: number | null | undefined,
  max: number | null | undefined,
  fallback?: number | null,
) => {
  const a = min != null ? Number(min) : fallback != null ? Number(fallback) : null;
  const b = max != null ? Number(max) : a;
  if (a == null) return "Según apreciación";
  if (b == null || a === b) return cop(a);
  return `${cop(a)} – ${cop(b)}`;
};

export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short" });

/** Fecha calendario YYYY-MM-DD (sin timezone) a etiqueta corta. */
export const calendarDate = (ymd: string | null | undefined) => {
  if (!ymd) return "—";
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "—";
  return new Date(y, m - 1, d).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

/** Edad legible desde fecha de nacimiento o llegada a casa. */
export const ageLabelFromLifeDate = (ymd: string | null | undefined) => {
  if (!ymd) return "Edad ?";
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "Edad ?";
  const birth = new Date(y, m - 1, d);
  const now = new Date();
  let months =
    (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 0) months = 0;
  if (months < 12) return `${months} mes${months === 1 ? "" : "es"}`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (rem === 0) return `${years} año${years === 1 ? "" : "s"}`;
  return `${years} año${years === 1 ? "" : "s"} ${rem} mes${rem === 1 ? "" : "es"}`;
};

export const lifeDateKindLabel = (kind: string | null | undefined) =>
  kind === "home" ? "Llegada a casa" : "Nacimiento";

export const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

export const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

export const dayKey = (d: Date) => {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  const y = copy.getFullYear();
  const m = String(copy.getMonth() + 1).padStart(2, "0");
  const day = String(copy.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");

export const STATUS = {
  pendiente: {
    label: "Agendado",
    hint: "Turno reservado. El spa todavía no empezó el servicio.",
    className: "bg-sky/25 text-sky-foreground border-sky/40",
  },
  enproceso: {
    label: "En proceso",
    hint: "Tu peludito ya está en el spa. El servicio está en curso.",
    className: "bg-gold/25 text-gold-foreground border-gold/50",
  },
  finalizada: {
    label: "Listo y pagado",
    hint: "Servicio cerrado, cobro registrado. La mascota ya fue entregada o puede retirarse.",
    className: "bg-mint/25 text-mint-foreground border-mint/50",
  },
  cancelada: {
    label: "Cancelada",
    hint: "Este turno ya no se realiza.",
    className: "bg-destructive/12 text-destructive border-destructive/30",
  },
} as const;

export type StatusKey = keyof typeof STATUS;

/** Normaliza variantes legacy ("en proceso", "en_proceso") al key canónico. */
export const normalizeStatus = (s: string | null | undefined): StatusKey => {
  const raw = (s ?? "pendiente").toLowerCase().replace(/[\s_]+/g, "");
  if (raw === "enproceso") return "enproceso";
  if (raw === "finalizada") return "finalizada";
  if (raw === "cancelada") return "cancelada";
  if (raw === "pendiente") return "pendiente";
  return "pendiente";
};

export const statusMeta = (s: string | null | undefined) => STATUS[normalizeStatus(s)];

/** Progreso 0–1 de una cita en proceso según starts_at + duration_min. */
export function appointmentProgress(
  startsAt: string | Date,
  durationMin: number,
  now: Date = new Date(),
): { ratio: number; elapsedMin: number; remainingMin: number; overtime: boolean } {
  const start = new Date(startsAt).getTime();
  const dur = Math.max(1, durationMin || 60) * 60_000;
  const elapsed = now.getTime() - start;
  const ratio = Math.min(1, Math.max(0, elapsed / dur));
  const elapsedMin = Math.max(0, Math.floor(elapsed / 60_000));
  const remainingMin = Math.max(0, Math.ceil((dur - elapsed) / 60_000));
  return {
    ratio,
    elapsedMin,
    remainingMin,
    overtime: elapsed > dur,
  };
}
