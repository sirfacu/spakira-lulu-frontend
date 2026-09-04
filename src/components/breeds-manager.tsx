import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { Empty } from "@/components/ui-kit";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  breedBathProfilesQuery,
  breedsTemplateDownloadUrl,
  createBreedWithProfile,
  deleteBreed,
  importBreedBathProfiles,
  upsertBreedBathProfile,
  type BreedBathProfile,
} from "@/lib/spa-queries";
import { cop } from "@/lib/format";

const PANOL_SIZES = ["XS", "S", "M", "L"] as const;

function emptyDraft(): BreedBathProfile {
  return {
    breed_id: "",
    breed_name: "",
    species: "perro",
    active: true,
    panoleta_size: "M",
    price_min: null,
    price_max: null,
    ml_shampoo: null,
    ml_conditioner: null,
    ml_medicated: null,
  };
}

/** Catálogo de razas + perfiles de baño / talla pañoleta. */
export function BreedsManager() {
  const qc = useQueryClient();
  const profiles = useQuery(breedBathProfilesQuery);
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<BreedBathProfile | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{
    name: string;
    id: string;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return (profiles.data ?? []).filter(
      (r) =>
        !q ||
        r.breed_name.toLowerCase().includes(q) ||
        r.species.toLowerCase().includes(q) ||
        (r.panoleta_size ?? "").toLowerCase().includes(q),
    );
  }, [profiles.data, filter]);

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ["breed-bath-profiles"] });
    await qc.invalidateQueries({ queryKey: ["breeds"] });
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!editing) throw new Error("Sin datos");
      if (creating || !editing.breed_id) {
        return createBreedWithProfile({
          ...editing,
          breed_name: editing.breed_name.trim(),
        });
      }
      return upsertBreedBathProfile(editing.breed_id, editing);
    },
    onSuccess: async () => {
      toast.success(creating ? "Raza creada" : "Raza actualizada");
      setEditing(null);
      setCreating(false);
      await invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteBreed(id),
    onSuccess: async () => {
      toast.success("Raza eliminada");
      setPendingDelete(null);
      await invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const importMut = useMutation({
    mutationFn: (file: File) => importBreedBathProfiles(file),
    onSuccess: async (res) => {
      toast.success(
        `Importadas ${res.imported}` +
          (res.created ? ` (${res.created} nuevas)` : ""),
      );
      if (res.skipped?.length) {
        toast.warning(`${res.skipped.length} filas omitidas`);
      }
      if (res.warnings?.length) {
        console.warn(res.warnings);
        toast.message(`${res.warnings.length} advertencias — ver consola`);
      }
      await invalidate();
      if (fileRef.current) fileRef.current.value = "";
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const downloadTemplate = () => {
    // Navegación directa: local FileResponse o 302 a S3 (sin CORS de fetch).
    window.location.assign(breedsTemplateDownloadUrl());
  };

  return (
    <div className="space-y-6">
      <div className="card-soft space-y-3 p-4">
        <div>
          <h3 className="font-medium text-foreground">Plantilla e importación</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Columnas: <code>RAZA</code>, <code>ESPECIE</code>, <code>PRECIO MIN</code>,{" "}
            <code>PRECIO MAX</code>, <code>Shampoo en Ml</code>,{" "}
            <code>Acondicionador en Ml</code>, <code>Medicado en Ml</code>,{" "}
            <code>Talla Panoleta</code> (XS/S/M/L). CSV o Excel. Si la raza ya existe se
            actualiza; si no, se crea.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-xl"
            onClick={() => downloadTemplate()}
          >
            <Download className="mr-2 h-4 w-4" />
            Descargar template
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importMut.mutate(f);
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-xl"
            disabled={importMut.isPending}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" />
            {importMut.isPending ? "Importando…" : "Importar archivo"}
          </Button>
          <Button
            type="button"
            className="h-10 rounded-xl"
            onClick={() => {
              setCreating(true);
              setEditing(emptyDraft());
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nueva raza
          </Button>
        </div>
      </div>

      <Input
        className="max-w-md h-10 rounded-xl"
        placeholder="Filtrar raza, especie o talla…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="bg-secondary/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Raza</th>
              <th className="px-3 py-2">Especie</th>
              <th className="px-3 py-2">Precio min</th>
              <th className="px-3 py-2">Precio max</th>
              <th className="px-3 py-2">Shampoo ml</th>
              <th className="px-3 py-2">Acond. ml</th>
              <th className="px-3 py-2">Medicado ml</th>
              <th className="px-3 py-2">Pañoleta</th>
              <th className="px-3 py-2">Activa</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.breed_id} className="hover:bg-secondary/30">
                <td className="px-3 py-2 font-medium text-foreground">{r.breed_name}</td>
                <td className="px-3 py-2 capitalize text-muted-foreground">{r.species}</td>
                <td className="px-3 py-2 tabular-nums">
                  {r.price_min != null ? cop(r.price_min) : "—"}
                </td>
                <td className="px-3 py-2 tabular-nums">
                  {r.price_max != null ? cop(r.price_max) : "—"}
                </td>
                <td className="px-3 py-2 tabular-nums">{r.ml_shampoo ?? "—"}</td>
                <td className="px-3 py-2 tabular-nums">{r.ml_conditioner ?? "—"}</td>
                <td className="px-3 py-2 tabular-nums">{r.ml_medicated ?? "—"}</td>
                <td className="px-3 py-2 font-medium">{r.panoleta_size ?? "—"}</td>
                <td className="px-3 py-2">
                  <Switch
                    checked={r.active !== false}
                    onCheckedChange={() => {
                      void upsertBreedBathProfile(r.breed_id, {
                        ...r,
                        active: !(r.active !== false),
                      })
                        .then(invalidate)
                        .catch((e: Error) => toast.error(e.message));
                    }}
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-lg"
                      onClick={() => {
                        setCreating(false);
                        setEditing({ ...r });
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-lg text-destructive"
                      onClick={() =>
                        setPendingDelete({ name: r.breed_name, id: r.breed_id })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length ? (
          <Empty message="Sin razas. Descargá el template, importá o creá la primera." />
        ) : null}
      </div>

      <Dialog
        open={!!editing}
        onOpenChange={(o) => {
          if (!o) {
            setEditing(null);
            setCreating(false);
          }
        }}
      >
        <DialogContent className="max-w-lg rounded-2xl p-5">
          {editing ? (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!editing.breed_name.trim()) {
                  toast.error("Nombre obligatorio");
                  return;
                }
                saveMut.mutate();
              }}
            >
              <h3 className="font-display text-lg font-bold text-primary">
                {creating ? "Nueva raza" : "Editar raza"}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2 space-y-1">
                  <Label>Raza</Label>
                  <Input
                    className="h-10 rounded-xl"
                    value={editing.breed_name}
                    onChange={(e) =>
                      setEditing({ ...editing, breed_name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Especie</Label>
                  <select
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                    value={editing.species}
                    onChange={(e) =>
                      setEditing({ ...editing, species: e.target.value })
                    }
                  >
                    <option value="perro">Perro</option>
                    <option value="gato">Gato</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Talla pañoleta</Label>
                  <select
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                    value={editing.panoleta_size ?? ""}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        panoleta_size: e.target.value || null,
                      })
                    }
                  >
                    <option value="">—</option>
                    {PANOL_SIZES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                {(
                  [
                    ["price_min", "Precio min"],
                    ["price_max", "Precio max"],
                    ["ml_shampoo", "Shampoo ml"],
                    ["ml_conditioner", "Acondicionador ml"],
                    ["ml_medicated", "Medicado ml"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="space-y-1">
                    <Label>{label}</Label>
                    <Input
                      type="number"
                      className="h-10 rounded-xl"
                      value={editing[key] ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        setEditing({
                          ...editing,
                          [key]: v === "" ? null : Number(v),
                        });
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Switch
                  checked={editing.active !== false}
                  onCheckedChange={(v) => setEditing({ ...editing, active: v })}
                />
                <span className="text-sm text-muted-foreground">Activa</span>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => {
                    setEditing(null);
                    setCreating(false);
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="rounded-xl"
                  disabled={saveMut.isPending}
                >
                  Guardar
                </Button>
              </div>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!pendingDelete}
        title={
          <>
            ¿Eliminar <span className="text-accent">{pendingDelete?.name}</span>?
          </>
        }
        description="Saldrá del catálogo de razas y su perfil de baño."
        onConfirm={() => {
          if (pendingDelete) deleteMut.mutate(pendingDelete.id);
        }}
        onOpenChange={(o) => {
          if (!o) setPendingDelete(null);
        }}
      />
    </div>
  );
}
