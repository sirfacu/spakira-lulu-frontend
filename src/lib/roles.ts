/** Roles de aplicación Spa Kira (panel). */

export type AppRole = "admin" | "colaborador" | "cliente";

export type AppUser = {
  id: string;
  email: string;
  role: AppRole | string;
  modules?: string[];
  modules_custom?: boolean;
  profile_complete?: boolean;
  needs_pet?: boolean;
};

export const PANEL_MODULES = [
  { id: "dashboard", path: "/panel", label: "Dashboard" },
  { id: "agenda", path: "/panel/agenda", label: "Agenda" },
  { id: "ventas", path: "/panel/ventas", label: "Ventas" },
  { id: "inventario", path: "/panel/inventario", label: "Inventario" },
  { id: "mascotas", path: "/panel/mascotas", label: "Mascotas" },
  { id: "propietarios", path: "/panel/propietarios", label: "Humanos" },
  { id: "personal", path: "/panel/personal", label: "Staff" },
  { id: "precios", path: "/panel/precios", label: "Servicios" },
  { id: "reportes", path: "/panel/reportes", label: "Reportes" },
  { id: "configuracion", path: "/panel/configuracion", label: "Configuración" },
  { id: "permisos", path: "/panel/permisos", label: "Roles y permisos" },
] as const;

const PATH_TO_MODULE: Record<string, string> = Object.fromEntries(
  PANEL_MODULES.map((m) => [m.path, m.id]),
);

/** Fallback si /auth/me aún no trae modules. */
export const ROLE_TABS: Record<AppRole, readonly string[]> = {
  admin: PANEL_MODULES.map((m) => m.path),
  colaborador: [
    "/panel/agenda",
    "/panel/mascotas",
    "/panel/propietarios",
    "/panel/precios",
    "/panel/inventario",
  ],
  cliente: ["/panel/agenda", "/panel/mascotas", "/panel/precios"],
} as const;

export function normalizeRole(role: string | undefined | null): AppRole {
  if (role === "colaborador") return "colaborador";
  if (role === "cliente") return "cliente";
  if (role === "admin") return "admin";
  return "cliente";
}

export function displayRole(role: string | undefined | null): string {
  const r = normalizeRole(role);
  if (r === "admin") return "Admin";
  if (r === "colaborador") return "Staff";
  return "Usuario";
}

export function pathsForModules(modules: string[] | undefined, role?: string | null): string[] {
  if (modules && modules.length) {
    const allow = new Set(modules);
    return PANEL_MODULES.filter((m) => allow.has(m.id)).map((m) => m.path);
  }
  return [...ROLE_TABS[normalizeRole(role)]];
}

export function homeForRole(role: string | undefined | null, modules?: string[]): string {
  const r = normalizeRole(role);
  const paths = pathsForModules(modules, role);
  const preferred =
    r === "cliente"
      ? ["/panel/precios", "/panel/agenda", "/panel/mascotas"]
      : r === "colaborador"
        ? ["/panel/agenda", "/panel/mascotas", "/panel/precios", "/panel/propietarios"]
        : ["/panel", "/panel/agenda", "/panel/mascotas", "/panel/precios"];
  for (const p of preferred) {
    if (paths.includes(p)) return p;
  }
  return paths[0] || "/panel/agenda";
}

export function canAccessPath(
  role: string | undefined | null,
  pathname: string,
  modules?: string[],
): boolean {
  const r = normalizeRole(role);
  if (pathname === "/panel/completar" || pathname.startsWith("/panel/completar/")) {
    return r === "cliente";
  }
  const tabs = pathsForModules(modules, role);
  if (pathname === "/panel" || pathname === "/panel/") {
    return tabs.includes("/panel");
  }
  return tabs.some((tab) => tab !== "/panel" && (pathname === tab || pathname.startsWith(`${tab}/`)));
}

export function moduleIdForPath(pathname: string): string | undefined {
  if (pathname === "/panel" || pathname === "/panel/") return "dashboard";
  const hit = PANEL_MODULES.find(
    (m) => m.path !== "/panel" && (pathname === m.path || pathname.startsWith(`${m.path}/`)),
  );
  return hit?.id ?? PATH_TO_MODULE[pathname];
}

/** Permisos de acción (UI + contrato con backend). */
export function permissionsFor(role: string | undefined | null) {
  const r = normalizeRole(role);
  const isAdmin = r === "admin";
  const isCliente = r === "cliente";
  const isStaff = r === "admin" || r === "colaborador";
  return {
    role: r,
    isAdmin,
    isColaborador: r === "colaborador",
    isCliente,
    isStaff,
    canManageAgenda: true,
    canManagePets: true,
    canReorderPets: isStaff,
    canPickOwners: isStaff,
    canFinishAppointments: isStaff,
    canChangeAppointmentStatus: isStaff,
    canEditFinalizedAppointment: isAdmin,
    canSeeWhatsAppLinks: isStaff,
    canConnectGoogle: isAdmin,
    canManagePrices: isAdmin,
    canViewPrices: true,
    canViewSalesAnalytics: isAdmin,
    canRegisterSales: isAdmin || r === "colaborador",
    maskOwnerPii: r === "colaborador",
    canAssociatePets: isStaff,
    canDeleteOwners: isStaff,
    canSeeServiceProgress: isStaff,
    canEditAppointmentNotes: isCliente,
  };
}

export const APPOINTMENT_STATUSES = ["pendiente", "enproceso", "finalizada", "cancelada"] as const;

export function editableAppointmentStatuses(
  role: string | undefined | null,
  currentStatus: string | undefined | null,
): string[] {
  const p = permissionsFor(role);
  if (!p.canChangeAppointmentStatus) return [];
  const current = (currentStatus || "").replace(/\s|_/g, "").toLowerCase();
  if (current === "finalizada" && !p.canEditFinalizedAppointment) {
    return ["finalizada"];
  }
  return [...APPOINTMENT_STATUSES];
}

export function isActiveSale(status: string | undefined | null): boolean {
  return (status || "activa") !== "anulada";
}

export function maskEndingDigits(value: string | null | undefined, visible = 4): string {
  if (!value) return "—";
  const digits = value.replace(/\D/g, "");
  if (!digits) return "••••";
  const tail = digits.slice(-Math.min(visible, digits.length));
  return `•••• ${tail}`;
}

export function maskEmail(value: string | null | undefined): string {
  if (!value) return "—";
  const [user, domain] = value.split("@");
  if (!domain) return "••••";
  const head = user.slice(0, 1) || "•";
  return `${head}••••@${domain}`;
}

export function maskAddress(value: string | null | undefined): string {
  if (!value) return "—";
  if (value.length <= 8) return "••••";
  return `${value.slice(0, 4)}••••${value.slice(-3)}`;
}
