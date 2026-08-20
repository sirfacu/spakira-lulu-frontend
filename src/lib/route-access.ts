import { redirect } from "@tanstack/react-router";
import { canAccessPath, homeForRole } from "@/lib/roles";

type AuthContext = {
  user?: {
    id: string;
    email: string;
    role: string;
    profile_complete?: boolean;
    modules?: string[];
  };
};

/** Guard de ruta: redirige si el rol no puede ver este path. */
export function requirePathAccess(pathname: string) {
  return ({ context }: { context: AuthContext }) => {
    const role = context.user?.role;
    if (!canAccessPath(role, pathname, context.user?.modules)) {
      throw redirect({ to: homeForRole(role, context.user?.modules) });
    }
  };
}
