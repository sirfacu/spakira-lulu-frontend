import { createFileRoute, redirect } from "@tanstack/react-router";
import { VeterinarySection } from "@/components/veterinary-section";
import { homeForRole, veterinarySections } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/panel/veterinaria/ordenes")({
  beforeLoad: ({ context }) => {
    const allowed = veterinarySections(context.user);
    if (allowed.some((section) => section.id === "ordenes")) return;
    const next = allowed[0];
    if (next) throw redirect({ to: next.path });
    throw redirect({ to: homeForRole(context.user?.role, context.user?.modules) });
  },
  component: function VeterinaryOrdenes() {
    return <VeterinarySection seccion="ordenes" />;
  },
});
