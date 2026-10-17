import { createFileRoute, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { EmailTemplatesPanel } from "@/components/config-email-panels";
import { homeForRole, normalizeRole, veterinarySections } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/panel/veterinaria/plantillas")({
  beforeLoad: ({ context }) => {
    const role = normalizeRole(context.user?.role);
    if (role !== "admin") {
      const allowed = veterinarySections(context.user);
      const next = allowed[0];
      if (next) throw redirect({ to: next.path });
      throw redirect({ to: homeForRole(context.user?.role, context.user?.modules) });
    }
  },
  component: function VeterinaryPlantillasPage() {
    return (
      <AppShell
        title="Plantillas correo"
        subtitle="Ingreso, egreso, cuidados y resumen de ronda (módulo veterinaria)."
      >
        <div className="rounded-xl border border-border bg-card p-4">
          <EmailTemplatesPanel
            module="veterinary"
            allowCreate={false}
            intro="Mismo editor que Configuración → Correos. El menú lateral permanece visible."
          />
        </div>
      </AppShell>
    );
  },
});
