import { createFileRoute, redirect } from "@tanstack/react-router";
import { VeterinaryHospitalization } from "@/components/veterinary-hospitalization";
import { homeForRole, veterinarySections } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/panel/veterinaria/hospitalizacion")({
  beforeLoad: ({ context }) => {
    const allowed = veterinarySections(context.user);
    if (allowed.some((section) => section.id === "hospitalizacion")) return;
    const next = allowed[0];
    if (next) throw redirect({ to: next.path });
    throw redirect({ to: homeForRole(context.user?.role, context.user?.modules) });
  },
  component: function VeterinaryHospitalizacionPage() {
    return <VeterinaryHospitalization />;
  },
});
