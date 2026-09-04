import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  draftsToApiPayload,
  type ServiceMaterialDraft,
} from "@/components/service-materials-editor";
import {
  breedsQuery,
  breedBathProfilesQuery,
  previewServiceCostEstimate,
  type ServiceCostEstimate,
} from "@/lib/spa-queries";
import { cop } from "@/lib/format";
import { formatMaterialQtyParts } from "@/lib/material-qty-label";

type Props = {
  serviceId: string | null;
  /** Borrador actual del editor (sin guardar aún). */
  materialDrafts?: ServiceMaterialDraft[];
};

export function ServiceCostByBreedPanel({ serviceId, materialDrafts = [] }: Props) {
  const breeds = useQuery(breedsQuery);
  const profiles = useQuery({
    ...breedBathProfilesQuery,
    enabled: Boolean(serviceId),
  });
  const [breedId, setBreedId] = useState("");
  const [petSex, setPetSex] = useState<"hembra" | "macho">("hembra");

  const profileBreedIds = useMemo(
    () => new Set((profiles.data ?? []).map((p) => p.breed_id)),
    [profiles.data],
  );

  const dogBreeds = useMemo(() => {
    const list = (breeds.data ?? [])
      .filter((b) => (b.species || "perro").toLowerCase() === "perro")
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
    // Con perfil primero: el estimado de ml/costo solo tiene sentido con perfil.
    return [...list].sort((a, b) => {
      const ap = profileBreedIds.has(a.id) ? 0 : 1;
      const bp = profileBreedIds.has(b.id) ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return a.name.localeCompare(b.name, "es");
    });
  }, [breeds.data, profileBreedIds]);

  const draftPayload = useMemo(
    () => draftsToApiPayload(materialDrafts),
    [materialDrafts],
  );
  const draftKey = useMemo(() => JSON.stringify(draftPayload), [draftPayload]);

  const estimate = useQuery({
    queryKey: ["service-cost-estimate", serviceId, breedId, petSex, draftKey],
    queryFn: () =>
      previewServiceCostEstimate(serviceId!, {
        breed_id: breedId,
        pet_sex: petSex,
        materials: draftPayload,
      }),
    enabled: Boolean(serviceId && breedId),
  });

  const data: ServiceCostEstimate | undefined = estimate.data;

  return (
    <section className="space-y-4 border-t border-border/70 pt-6">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Costo estimado
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Cuánto cuesta el servicio por dentro según la raza (lo que se usa del envase). No es el
          precio que ve el cliente. Elegí una raza con perfil de consumo para ver champús con
          monto.
        </p>
      </div>

      {!serviceId ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
          Guardá el servicio primero para ver el costo por raza.
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Raza</Label>
              <Select value={breedId} onValueChange={setBreedId}>
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue placeholder="Elegí una raza" />
                </SelectTrigger>
                <SelectContent>
                  {dogBreeds.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                      {profileBreedIds.has(b.id) ? "" : " (sin perfil)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Sexo (accesorios)</Label>
              <Select
                value={petSex}
                onValueChange={(v) => setPetSex(v as "hembra" | "macho")}
              >
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hembra">Hembra</SelectItem>
                  <SelectItem value="macho">Macho</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {estimate.isFetching ? (
            <p className="text-xs text-muted-foreground">Calculando…</p>
          ) : null}

          {estimate.isError ? (
            <p className="text-xs text-destructive">
              {(estimate.error as Error)?.message || "No se pudo estimar"}
            </p>
          ) : null}

          {data && breedId ? (
            <div className="space-y-3">
              {!data.has_profile ? (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Esta raza no tiene perfil de consumo: el champú y el acondicionador quedan en
                  0. Cargá el perfil en Configuración → perfiles de baño, o elegí una raza de la
                  parte de arriba del listado.
                </p>
              ) : null}
              {data.lines.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No hay insumos habilitados para este perfil (o el borrador está vacío).
                </p>
              ) : (
                <ul className="space-y-3">
                  {data.lines.map((line) => {
                    const qty = formatMaterialQtyParts({
                      quantity: line.quantity,
                      quantity_unit: line.quantity_unit,
                      mix_quantity: line.mix_quantity,
                      dilution_product: line.dilution_product,
                      dilution_water: line.dilution_water,
                    });
                    return (
                      <li
                        key={`${line.material_role}-${line.display_label}`}
                        className="flex items-start justify-between gap-3 text-sm"
                      >
                        <span className="min-w-0">
                          <span className="font-medium text-foreground">{line.display_label}</span>
                          {qty.primary ? (
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {qty.primary}
                              {qty.secondary ? (
                                <span className="block">{qty.secondary}</span>
                              ) : null}
                              {line.unit_cost ? (
                                <span className="block">
                                  {cop(line.unit_cost)}/{line.quantity_unit}
                                </span>
                              ) : null}
                            </span>
                          ) : null}
                        </span>
                        <span className="shrink-0 tabular-nums text-foreground">
                          {cop(line.line_cost)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="text-sm font-medium text-primary">Total costo</span>
                <span className="text-lg font-semibold tabular-nums text-primary">
                  {cop(data.total_cost)}
                </span>
              </div>
              {data.warnings?.length ? (
                <ul className="space-y-1">
                  {data.warnings.map((w) => (
                    <li key={w} className="text-xs text-muted-foreground">
                      {w}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
