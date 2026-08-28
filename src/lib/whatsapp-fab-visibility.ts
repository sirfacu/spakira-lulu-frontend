import { canAccessPath, permissionsFor } from "@/lib/roles";

/** Rutas públicas donde cualquier visitante ve el botón de contacto. */
export function isPublicVisitorPath(pathname: string): boolean {
  if (pathname.startsWith("/panel")) return false;
  if (pathname.startsWith("/_authenticated")) return false;
  return (
    pathname === "/home" ||
    pathname === "/auth" ||
    pathname === "/privacidad" ||
    pathname === "/terminos" ||
    pathname === "/"
  );
}

/** FAB visible en marketing/legal o en pantallas del panel habilitadas para clientes. */
export function shouldShowWhatsAppFab(
  pathname: string,
  role: string | undefined | null,
  modules?: string[],
): boolean {
  if (isPublicVisitorPath(pathname)) return true;
  if (!role || !permissionsFor(role).isCliente) return false;
  if (!pathname.startsWith("/panel")) return false;
  return canAccessPath(role, pathname, modules);
}
