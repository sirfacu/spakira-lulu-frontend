import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy: Razas vive como pestaña dentro de Mascotas. */
export const Route = createFileRoute("/_authenticated/panel/razas")({
  beforeLoad: () => {
    throw redirect({ to: "/panel/mascotas", search: { tab: "razas" } });
  },
});
