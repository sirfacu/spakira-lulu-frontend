import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { fetchMe, logout, mayHaveSession } from "@/lib/api";
import { homeForRole, permissionsFor } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // Local: JWT en localStorage. Prod: cookie HttpOnly — getToken() es siempre null.
    if (!mayHaveSession()) {
      throw redirect({ to: "/auth" });
    }
    try {
      const user = await fetchMe();
      const path = location.pathname;
      if (
        permissionsFor(user.role).isCliente &&
        user.profile_complete === false &&
        path !== "/panel/completar"
      ) {
        throw redirect({ to: "/panel/completar" });
      }
      if (
        permissionsFor(user.role).isCliente &&
        user.profile_complete !== false &&
        user.needs_pet &&
        !path.startsWith("/panel/mascotas")
      ) {
        throw redirect({ to: "/panel/mascotas", search: { alta: true } });
      }
      if (
        (path === "/panel" || path === "/panel/") &&
        homeForRole(user.role, user.modules) !== "/panel"
      ) {
        throw redirect({ href: homeForRole(user.role, user.modules) });
      }
      return { user };
    } catch (err) {
      if (err && typeof err === "object" && "to" in err) throw err;
      if (err && typeof err === "object" && "href" in err) throw err;
      logout();
      throw redirect({
        to: "/auth",
        search: { auth_error: "Sesión inválida. Volvé a ingresar." },
      });
    }
  },
  component: () => <Outlet />,
});
