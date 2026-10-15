import { createFileRoute, redirect } from "@tanstack/react-router";
import { VeterinaryServicesDraft } from "@/components/veterinary-services-draft";
import { homeForRole, normalizeRole, veterinarySections } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/panel/veterinaria/servicios")({
  beforeLoad: ({ context }) => {
    const allowed = veterinarySections(context.user);
    if (
      context.user?.veterinary_enabled &&
      normalizeRole(context.user.role) === "admin" &&
      allowed.some((section) => section.id === "servicios")
    ) {
      return;
    }
    throw redirect({ to: homeForRole(context.user?.role, context.user?.modules) });
  },
  component: function VeterinaryServicios() {
    return <VeterinaryServicesDraft />;
  },
});
