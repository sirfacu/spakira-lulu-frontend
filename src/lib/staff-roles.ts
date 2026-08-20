export const STAFF_ROLE_OPTS = [
  ["groomer", "Groomer"],
  ["colorista", "Colorista"],
  ["secador", "Secador"],
  ["bañista", "Bañista"],
] as const;

const ALIASES: Record<string, string> = {
  lavador: "bañista",
  banista: "bañista",
  estilista: "groomer",
};

export function canonicalizeStaffRole(value: string | null | undefined): string | undefined {
  const raw = (value || "").trim().toLowerCase();
  if (!raw) return undefined;
  const folded = raw.normalize("NFD").replace(/\p{M}/gu, "");
  const ids = STAFF_ROLE_OPTS.map(([id]) => id);
  if ((ids as string[]).includes(raw)) return raw;
  if (folded === "banista") return "bañista";
  return ALIASES[folded] ?? ALIASES[raw];
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
