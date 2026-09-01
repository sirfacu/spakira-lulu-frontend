import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  breedBathProfilesQuery,
  importBreedBathProfiles,
  upsertBreedBathProfile,
  type BreedBathProfile,
} from "@/lib/spa-queries";
import { cop } from "@/lib/format";

export function BreedBathProfilesAdmin() {
  const qc = useQueryClient();
  const profiles = useQuery(breedBathProfilesQuery);
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<BreedBathProfile | null>(null);

  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return (profiles.data ?? []).filter(
      (r) =>
        !q ||
        r.breed_name.toLowerCase().includes(q) ||
        r.species.toLowerCase().includes(q),
    );
  }, [profiles.data, filter]);

  const saveMut = useMutation({
    mutationFn: () => {
      if (!editing?.breed_id) throw new Error("Sin raza");
      return upsertBreedBathProfile(editing.breed_id, editing);
    },
    onSuccess: async () => {
      toast.success("Perfil guardado");
      setEditing(null);
      await qc.invalidateQueries({ queryKey: ["breed-bath-profiles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const importMut = useMutation({
    mutationFn: (file: File) => importBreedBathProfiles(file),
    onSuccess: async (res) => {
      toast.success(`Importadas ${res.imported} razas`);
      if (res.skipped?.length) {
        toast.warning(`${res.skipped.length} filas omitidas (raza no encontrada)`);
      }
      if (res.warnings?.length) {
        toast.message(`${res.warnings.length} advertencias — revisá consola`);
        console.warn("Import warnings", res.warnings);
      }
      await qc.invalidateQueries({ queryKey: ["breed-bath-profiles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="mt-12 space-y-4 border-t border-border pt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-primary">Perfiles por raza</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Consumo ml y rango de precio sugerido (Excel: RAZA, ESPECIE, PRECIO MIN, PRECIO
            MAXIMO, ml SHAMPOO, ml ACONDICIONADOR, ml MEDICADO)
          </p>
        </div>
        <label className="cursor-pointer">
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importMut.mutate(f);
              e.target.value = "";
            }}
          />
          <Button type="button" variant="outline" className="rounded-xl" asChild>
            <span>
              <Upload className="mr-2 h-4 w-4" />
              Importar Excel
            </span>
          </Button>
        </label>
      </div>

      <Input
        className="max-w-md h-10 rounded-xl"
        placeholder="Filtrar raza…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-secondary/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Raza</th>
              <th className="px-3 py-2">Especie</th>
              <th className="px-3 py-2">Precio min–max</th>
              <th className="px-3 py-2">Shampoo ml</th>
              <th className="px-3 py-2">Acond. ml</th>
              <th className="px-3 py-2">Medicado ml</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.breed_id} className="border-t border-border/60">
                <td className="px-3 py-2 font-medium">{r.breed_name}</td>
                <td className="px-3 py-2 capitalize">{r.species}</td>
                <td className="px-3 py-2 tabular-nums">
                  {r.price_min != null ? cop(r.price_min) : "—"}
                  {r.price_max != null && r.price_max !== r.price_min
                    ? ` – ${cop(r.price_max)}`
                    : ""}
                </td>
                <td className="px-3 py-2 tabular-nums">{r.ml_shampoo ?? "—"}</td>
                <td className="px-3 py-2 tabular-nums">{r.ml_conditioner ?? "—"}</td>
                <td className="px-3 py-2 tabular-nums">{r.ml_medicated ?? "—"}</td>
                <td className="px-3 py-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8"
                    onClick={() => setEditing({ ...r })}
                  >
                    Editar
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing ? (
        <div className="card-soft max-w-lg space-y-3 p-4">
          <h3 className="font-semibold">{editing.breed_name}</h3>
          {(
            [
              ["price_min", "Precio mínimo"],
              ["price_max", "Precio máximo"],
              ["ml_shampoo", "ml shampoo"],
              ["ml_conditioner", "ml acondicionador"],
              ["ml_medicated", "ml medicado"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block space-y-1 text-sm">
              <span className="text-muted-foreground">{label}</span>
              <Input
                type="number"
                className="h-10 rounded-lg"
                value={editing[key] ?? ""}
                onChange={(e) =>
                  setEditing((prev) =>
                    prev
                      ? {
                          ...prev,
                          [key]: e.target.value === "" ? null : Number(e.target.value),
                        }
                      : prev,
                  )
                }
              />
            </label>
          ))}
          <div className="flex gap-2">
            <Button className="rounded-lg" disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>
              Guardar
            </Button>
            <Button variant="outline" className="rounded-lg" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
