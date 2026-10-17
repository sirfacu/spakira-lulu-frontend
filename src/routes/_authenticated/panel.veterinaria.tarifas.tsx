import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { VeterinaryHospTariffsPanel } from "@/components/veterinary-hospitalization";
import { getLocations } from "@/lib/spa-queries";
import { homeForRole, normalizeRole, veterinarySections } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/panel/veterinaria/tarifas")({
  beforeLoad: ({ context }) => {
    const role = normalizeRole(context.user?.role);
    if (role !== "admin") {
      const allowed = veterinarySections(context.user);
      const next = allowed[0];
      if (next) throw redirect({ to: next.path });
      throw redirect({ to: homeForRole(context.user?.role, context.user?.modules) });
    }
  },
  component: function VeterinaryTarifasPage() {
    const locationsQ = useQuery({ queryKey: ["locations"], queryFn: getLocations });
    const locations = (locationsQ.data?.items ?? []).filter((x) => x.active);
    const [locationId, setLocationId] = useState("");
    useEffect(() => {
      if (locationId) return;
      const primary =
        locations.find((x) => x.is_primary && x.active) ?? locations.find((x) => x.active) ?? null;
      if (primary) setLocationId(primary.id);
    }, [locations, locationId]);

    return (
      <AppShell
        title="Tarifas de internación"
        subtitle="Día/cama, check-in–out y cargos pendientes al egreso."
      >
        <div className="mb-4">
          <label className="text-sm text-muted-foreground">
            Sede{" "}
            <select
              className="ml-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
            >
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {locationId ? <VeterinaryHospTariffsPanel locationId={locationId} /> : null}
      </AppShell>
    );
  },
});
