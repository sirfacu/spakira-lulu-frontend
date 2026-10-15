import { isRedirect } from "@tanstack/react-router";

/**
 * beforeLoad de /_authenticated: un redirect de TanStack es un Response con
 * `.options`, no un objeto con `.to` en la raíz. Si el catch lo trata como
 * error de /auth/me, hace logout y muestra "Sesión inválida".
 */
export function shouldRethrowAuthGuardError(err: unknown): boolean {
  if (isRedirect(err)) return true;
  if (err && typeof err === "object" && "href" in err) return true;
  return false;
}
