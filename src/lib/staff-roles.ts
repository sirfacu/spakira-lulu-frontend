export const STAFF_ROLE_OPTS = [
  ["groomer", "Groomer"],
  ["auxiliar", "Auxiliar"],
  ["recepcionista", "Recepcionista"],
  ["conductor", "Conductor"],
  ["oficios_varios", "Oficios varios"],
] as const;

/** Labores que se pueden asignar a una cita de grooming. */
export const STAFF_SKILL_OPTS = STAFF_ROLE_OPTS.filter(([id]) =>
  ["groomer", "auxiliar"].includes(id),
);

export const ADMIN_STAFF_JOBS = ["recepcionista", "conductor", "oficios_varios"] as const;

const ALIASES: Record<string, string> = {
  lavador: "auxiliar",
  banista: "auxiliar",
  bañista: "auxiliar",
  secador: "auxiliar",
  colorista: "groomer",
  estilista: "groomer",
  chofer: "conductor",
  recepcion: "recepcionista",
};

export function canonicalizeStaffRole(value: string | null | undefined): string | undefined {
  const raw = (value || "").trim().toLowerCase();
  if (!raw) return undefined;
  const folded = raw.normalize("NFD").replace(/\p{M}/gu, "");
  const ids = STAFF_ROLE_OPTS.map(([id]) => id);
  if ((ids as string[]).includes(raw)) return raw;
  if ((ids as string[]).includes(folded)) return folded;
  if (folded === "banista" || folded === "secador") return "auxiliar";
  return ALIASES[folded] ?? ALIASES[raw];
}

export function isAdminStaffJob(value: string | null | undefined): boolean {
  const id = canonicalizeStaffRole(value);
  return !!id && (ADMIN_STAFF_JOBS as readonly string[]).includes(id);
}

export function staffRoleLabel(value: string | null | undefined): string {
  const id = canonicalizeStaffRole(value) || value || "";
  const hit = STAFF_ROLE_OPTS.find(([k]) => k === id);
  return hit ? hit[1] : id || "Staff";
}

export function staffRolesLine(skills: string[] | undefined, roleTitle?: string | null): string {
  const visible = staffRoleLabel(roleTitle);
  const extra = (skills ?? [])
    .map((s) => canonicalizeStaffRole(s) || s)
    .filter((s) => s && s !== (canonicalizeStaffRole(roleTitle) || roleTitle))
    .map((s) => staffRoleLabel(s));
  if (!extra.length) return visible;
  return `${visible} · ${extra.join(", ")}`;
}
