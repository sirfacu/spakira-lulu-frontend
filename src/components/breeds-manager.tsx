import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Upload } from "lucide-react";
import { Empty } from "@/components/ui-kit";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  breedsQuery,
  createBreed,
  updateBreed,
  deleteBreed,
  importBreedsCsv,
  type Breed,
} from "@/lib/spa-queries";

/** Catálogo de razas (admin): alta manual + import CSV. */
export function BreedsManager() {
  const breeds = useQuery(breedsQuery);
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<{ name: string; id: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const createMut = useMutation({
    mutationFn: () => createBreed({ name: name.trim(), species: "perro" }),
    onSuccess: async () => {
      toast.success("Raza agregada");
      setName("");
      await qc.invalidateQueries({ queryKey: ["breeds"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleMut = useMutation({
    mutationFn: (b: Breed) => updateBreed(b.id, { active: !b.active }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["breeds"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteBreed(id),
    onSuccess: async () => {
      toast.success("Raza eliminada");
      await qc.invalidateQueries({ queryKey: ["breeds"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const importMut = useMutation({
    mutationFn: (file: File) => importBreedsCsv(file),
    onSuccess: async (res) => {
      toast.success(
        `CSV: ${res.created} creadas, ${res.updated} actualizadas` +
          (res.skipped ? `, ${res.skipped} omitidas` : ""),
      );
      if (res.errors?.length) {
        toast.message(res.errors.slice(0, 3).join(" · "), { duration: 8000 });
      }
      await qc.invalidateQueries({ queryKey: ["breeds"] });
      if (fileRef.current) fileRef.current.value = "";
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const list = breeds.data ?? [];

  return (
    <div className="space-y-6">
      <div className="card-soft grid gap-3 p-4 sm:grid-cols-[1fr_auto]">
        <div className="space-y-2">
          <Label>Nueva raza</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Cocker Spaniel"
            className="h-11 rounded-xl"
          />
        </div>
        <div className="flex items-end">
          <Button
            className="h-11 rounded-xl"
            disabled={!name.trim() || createMut.isPending}
            onClick={() => createMut.mutate()}
          >
            <Plus className="mr-2 h-4 w-4" /> Agregar
          </Button>
        </div>
      </div>

      <div className="card-soft space-y-3 p-4">
        <div>
          <h3 className="font-medium text-foreground">Cargar CSV</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Columnas: <code>name</code> (obligatoria), <code>species</code> (perro/gato, default
            perro), <code>active</code> (true/false, default true). Separador coma o punto y coma.
            Si la raza ya existe (mismo nombre + especie), se actualiza.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
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
            {importMut.isPending ? "Importando…" : "Elegir archivo CSV"}
          </Button>
          <a
            className="text-xs text-primary underline-offset-2 hover:underline"
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(
              "name,species,active\nBeagle,perro,true\nPersa,gato,true\n",
            )}`}
            download="razas-ejemplo.csv"
          >
            Descargar ejemplo
          </a>
        </div>
      </div>

      <div className="card-soft overflow-hidden">
        <ul className="divide-y divide-border">
          {list.map((b) => (
            <li
              key={b.id}
              className="flex items-center justify-between gap-4 px-5 py-3.5 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{b.name}</p>
                <p className="text-xs capitalize text-muted-foreground">{b.species}</p>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  Pañoleta
                  <select
                    className="h-8 rounded-lg border border-border bg-background px-2 text-xs text-foreground"
                    value={b.panoleta_size ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      updateBreed(b.id, {
                        panoleta_size: v ? v : null,
                      } as Partial<Breed>)
                        .then(async () => {
                          toast.success("Talla de pañoleta guardada");
                          await qc.invalidateQueries({ queryKey: ["breeds"] });
                        })
                        .catch((err: Error) => toast.error(err.message));
                    }}
                  >
                    <option value="">—</option>
                    <option value="S">S</option>
                    <option value="M">M</option>
                    <option value="L">L</option>
                  </select>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Activa</span>
                  <Switch checked={b.active} onCheckedChange={() => toggleMut.mutate(b)} />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-xl text-destructive"
                  onClick={() => setPendingDelete({ name: b.name, id: b.id })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
        {!list.length ? <Empty message="Sin razas. Agregá la primera o cargá un CSV." /> : null}
      </div>
      <ConfirmDialog
        open={!!pendingDelete}
        title={
          <>
            ¿Eliminar <span className="text-accent">{pendingDelete?.name}</span>?
          </>
        }
        description="Saldrá del catálogo de razas."
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
