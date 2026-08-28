import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  deactivateServiceActivity,
  serviceActivityCatalogAdminQuery,
  skillCatalog,
  upsertServiceActivity,
  type ServiceActivityCatalogItem,
} from "@/lib/spa-queries";

const ICON_HINT = "droplets, wind, scissors, brush, flower-2, sparkles, palette";

type ActivityForm = {
  id: string;
  label: string;
  icon: string;
  sort_order: number;
  required_skills: string[];
  active: boolean;
};

function emptyForm(): ActivityForm {
  return {
    id: "",
    label: "",
    icon: "",
    sort_order: 80,
    required_skills: ["groomer"],
    active: true,
  };
}

function toForm(item: ServiceActivityCatalogItem): ActivityForm {
  return {
    id: item.id,
    label: item.label,
    icon: item.icon ?? "",
    sort_order: item.sort_order ?? 50,
    required_skills: [...(item.required_skills ?? [])],
    active: item.active !== false,
  };
}

export function ServiceActivityAdmin() {
  const qc = useQueryClient();
  const catalog = useQuery(serviceActivityCatalogAdminQuery);
  const skills = useQuery({ queryKey: ["skill-catalog"], queryFn: skillCatalog });
  const skillOptions = skills.data?.skills ?? [];
  const [editing, setEditing] = useState<ServiceActivityCatalogItem | null | "new">(null);
  const [form, setForm] = useState<ActivityForm>(emptyForm());

  const sorted = useMemo(
    () => [...(catalog.data ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [catalog.data],
  );

  const saveMut = useMutation({
    mutationFn: async () => {
      const id = form.id.trim().toLowerCase().replace(/\s+/g, "_");
      if (!id || !form.label.trim()) throw new Error("ID y nombre son obligatorios");
      return upsertServiceActivity({
        id,
        label: form.label.trim(),
        icon: form.icon.trim() || null,
        sort_order: Number(form.sort_order) || 0,
        required_skills: form.required_skills,
        active: form.active,
      });
    },
    onSuccess: async () => {
      toast.success(editing === "new" ? "Actividad creada" : "Actividad actualizada");
      setEditing(null);
      await qc.invalidateQueries({ queryKey: ["service-activity-catalog"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo guardar"),
  });

  const deactivateMut = useMutation({
    mutationFn: (id: string) => deactivateServiceActivity(id),
    onSuccess: async () => {
      toast.success("Actividad desactivada");
      await qc.invalidateQueries({ queryKey: ["service-activity-catalog"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo desactivar"),
  });

  return (
    <section className="mt-12 border-t border-border/70 pt-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-display text-xl font-bold text-primary">Actividades de servicio</h3>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Catálogo maestro (Baño, Cepillado de dientes, …). Al editar un servicio solo elegís cuáles
            incluye; acá creás o desactivás actividades del listado.
          </p>
        </div>
        <Button
          className="rounded-xl"
          onClick={() => {
            setForm(emptyForm());
            setEditing("new");
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> Nueva actividad
        </Button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-semibold">Orden</th>
              <th className="px-4 py-3 font-semibold">ID</th>
              <th className="px-4 py-3 font-semibold">Nombre</th>
              <th className="px-4 py-3 font-semibold">Icono</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 font-semibold" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((item) => (
              <tr key={item.id} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-2.5 text-muted-foreground">{item.sort_order}</td>
                <td className="px-4 py-2.5 font-mono text-xs">{item.id}</td>
                <td className="px-4 py-2.5 font-medium">{item.label}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{item.icon ?? "—"}</td>
                <td className="px-4 py-2.5">
                  {item.active === false ? (
                    <span className="text-muted-foreground">Inactiva</span>
                  ) : (
                    <span className="text-mint-foreground">Activa</span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="rounded-lg"
                      onClick={() => {
                        setForm(toForm(item));
                        setEditing(item);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {item.active !== false ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="rounded-lg text-destructive"
                        onClick={() => {
                          if (window.confirm(`¿Desactivar «${item.label}»?`)) {
                            deactivateMut.mutate(item.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-3xl">
          <h3 className="font-display text-xl font-bold text-primary">
            {editing === "new" ? "Nueva actividad" : "Editar actividad"}
          </h3>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label>ID (slug)</Label>
              <Input
                className="h-11 rounded-xl font-mono text-sm"
                value={form.id}
                disabled={editing !== "new"}
                placeholder="cepillado_dental"
                onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Nombre visible</Label>
              <Input
                className="h-11 rounded-xl"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Icono (Lucide)</Label>
                <Input
                  className="h-11 rounded-xl"
                  value={form.icon}
                  placeholder={ICON_HINT}
                  onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Orden</Label>
                <Input
                  type="number"
                  className="h-11 rounded-xl"
                  value={form.sort_order}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, sort_order: Number(e.target.value) || 0 }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Perfiles que pueden cubrirla</Label>
              <div className="flex flex-col gap-2">
                {skillOptions.map((sk) => {
                  const on = form.required_skills.includes(sk.id);
                  return (
                    <label
                      key={sk.id}
                      className="flex cursor-pointer items-center gap-3 rounded-xl border border-border px-3 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() =>
                          setForm((f) => ({
                            ...f,
                            required_skills: on
                              ? f.required_skills.filter((x) => x !== sk.id)
                              : [...f.required_skills, sk.id],
                          }))
                        }
                      />
                      {sk.label}
                    </label>
                  );
                })}
              </div>
            </div>
            {editing !== "new" ? (
              <label className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                <span className="text-sm">Activa en catálogo</span>
                <Switch
                  checked={form.active}
                  onCheckedChange={(checked) => setForm((f) => ({ ...f, active: checked }))}
                />
              </label>
            ) : null}
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button
              className="rounded-xl"
              disabled={saveMut.isPending}
              onClick={() => saveMut.mutate()}
            >
              Guardar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
