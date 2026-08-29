import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate, useRouteContext } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock, Pencil, Plus, Trash2, CalendarClock, CalendarPlus, GripVertical } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Empty } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ReorderList } from "@/components/reorder-list";
import { ServiceDetailDialog } from "@/components/service-detail-dialog";
import { ServiceActivityAdmin } from "@/components/service-activity-admin";
import {
  panelServicesQuery,
  serviceActivityCatalogQuery,
  upsertService,
  deleteService,
  reorderServices,
  type Service,
} from "@/lib/spa-queries";
import { copRange } from "@/lib/format";
import {
  DEFAULT_PRICE_NOTE,
  servicePriceHeadline,
  servicePriceModeFromService,
  servicePriceNote,
} from "@/lib/service-pricing";
import { requirePathAccess } from "@/lib/route-access";
import { permissionsFor } from "@/lib/roles";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/panel/precios")({
  beforeLoad: requirePathAccess("/panel/precios"),
  head: () => ({
    meta: [
      { title: "Servicios | Spa Kira" },
      {
        name: "description",
        content: "Catálogo de servicios de grooming publicables en Spa Kira.",
      },
      { property: "og:title", content: "Servicios | Spa Kira" },
    ],
  }),
  component: Servicios,
});

type ServiceForm = {
  name: string;
  description: string;
  price_mode: "fixed" | "variable";
  price: string;
  price_min: string;
  price_max: string;
  price_note: string;
  duration_min: string;
  image_url: string;
  is_public: boolean;
  publish_mode: "now" | "scheduled" | "draft";
  publish_at_local: string;
  activities: string[];
};

const emptyForm = (): ServiceForm => ({
  name: "",
  description: "",
  price_mode: "fixed",
  price: "",
  price_min: "",
  price_max: "",
  price_note: DEFAULT_PRICE_NOTE,
  duration_min: "60",
  image_url: "",
  is_public: true,
  publish_mode: "now",
  publish_at_local: "",
  activities: [],
});

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function serviceToForm(s: Service): ServiceForm {
  const pub = s.publish_at ? new Date(s.publish_at) : null;
  const scheduled = !!(pub && pub.getTime() > Date.now() && s.is_public);
  const mode = servicePriceModeFromService(s);
  const min = s.price_min ?? s.price;
  const max = s.price_max ?? min;
  return {
    name: s.name ?? "",
    description: s.description ?? "",
    price_mode: mode,
    price: s.price != null ? String(s.price) : min != null ? String(min) : "",
    price_min: min != null ? String(min) : "",
    price_max: max != null ? String(max) : "",
    price_note: s.price_note?.trim() || DEFAULT_PRICE_NOTE,
    duration_min: String(s.duration_min ?? 60),
    image_url: s.image_url ?? "",
    is_public: s.is_public,
    publish_mode: !s.is_public ? "draft" : scheduled ? "scheduled" : "now",
    publish_at_local: toLocalInput(s.publish_at),
    activities: [...(s.activities ?? [])],
  };
}

function publishBadge(s: Service): { label: string; className: string } {
  if (!s.is_public) {
    return { label: "Borrador", className: "bg-muted text-muted-foreground" };
  }
  if (s.publish_at && new Date(s.publish_at).getTime() > Date.now()) {
    return { label: "Programado", className: "bg-gold/25 text-gold-foreground" };
  }
  return { label: "En página", className: "bg-mint/25 text-mint-foreground" };
}

function Servicios() {
  const navigate = useNavigate();
  const services = useQuery(panelServicesQuery);
  const activityCatalog = useQuery(serviceActivityCatalogQuery);
  const serverList = useMemo(
    () =>
      [...(services.data ?? [])].sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name),
      ),
    [services.data],
  );
  const [list, setList] = useState<Service[]>([]);
  useEffect(() => {
    setList(serverList);
  }, [serverList]);

  const { user } = useRouteContext({ from: "/_authenticated" });
  const perms = permissionsFor(user?.role);
  const canManage = perms.canManagePrices;
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Service | null | "new">(null);
  const [form, setForm] = useState<ServiceForm>(emptyForm());
  const [detailService, setDetailService] = useState<Service | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ name: string; id: string } | null>(null);

  const openNew = () => {
    setForm(emptyForm());
    setEditing("new");
  };

  const openEdit = (s: Service) => {
    setForm(serviceToForm(s));
    setEditing(s);
  };

  const reorderMut = useMutation({
    mutationFn: (ids: string[]) => reorderServices(ids),
    onError: (err: Error) => {
      toast.error(err.message);
      setList(serverList);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["services"] });
    },
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Nombre requerido");
      const is_public = form.publish_mode !== "draft";
      let publish_at: string | null = null;
      if (form.publish_mode === "now") {
        publish_at = new Date().toISOString();
      } else       if (form.publish_mode === "scheduled") {
        if (!form.publish_at_local) throw new Error("Indicá la fecha de publicación");
        publish_at = new Date(form.publish_at_local).toISOString();
        if (Number.isNaN(Date.parse(publish_at))) throw new Error("Fecha inválida");
      }

      const variable = form.price_mode === "variable";
      const priceMin = variable ? Number(form.price_min || 0) : Number(form.price || 0);
      const priceMax = variable ? Number(form.price_max || priceMin) : priceMin;
      if (variable && priceMax < priceMin) {
        throw new Error("El precio máximo no puede ser menor al mínimo");
      }
      const priceNote = variable
        ? form.price_note.trim() || DEFAULT_PRICE_NOTE
        : null;

      return upsertService({
        id: editing && typeof editing === "object" ? editing.id : undefined,
        name: form.name.trim(),
        description: form.description.trim() || null,
        price: priceMin,
        price_min: priceMin,
        price_max: priceMax,
        price_note: priceNote,
        duration_min: Number(form.duration_min || 60),
        image_url: form.image_url.trim() || null,
        sort_order:
          editing && typeof editing === "object"
            ? editing.sort_order ?? list.length
            : list.length,
        is_public,
        publish_at,
        activities: form.activities,
      });
    },
    onSuccess: async () => {
      toast.success(editing === "new" ? "Servicio creado" : "Servicio actualizado");
      setEditing(null);
      await qc.invalidateQueries({ queryKey: ["services"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteService(id),
    onSuccess: async () => {
      toast.success("Servicio eliminado");
      setEditing(null);
      await qc.invalidateQueries({ queryKey: ["services"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <AppShell
      title="Servicios"
      subtitle={
        canManage
          ? "Arrastrá las fichas para ordenar · programá la publicación en la página"
          : "Listado oficial (solo lectura)"
      }
      actions={
        canManage ? (
          <Button className="rounded-xl" onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" /> Nuevo servicio
          </Button>
        ) : null
      }
    >
      <div className="text-center">
        <span className="font-script text-3xl text-accent">Nuestros</span>
        <h2 className="font-display text-3xl font-bold text-primary">Servicios</h2>
        <div className="gold-rule mx-auto mt-4 max-w-xs" />
        {!canManage ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {perms.isCliente
              ? "Elegí un servicio y agendá. El valor se confirma al llegar."
              : "Como Staff solo podés consultar. Crear, editar o programar es solo admin."}
          </p>
        ) : null}
      </div>

      <ReorderList
        items={list}
        disabled={!canManage}
        className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
        onReorder={(next) => {
          setList(next);
          reorderMut.mutate(next.map((s) => s.id));
        }}
        renderItem={(s, { isDragging, dragHandleProps }) => {
          const badge = publishBadge(s);
          return (
            <article
              className={cn(
                "card-soft group flex h-full flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lift",
                isDragging && "opacity-60",
              )}
            >
              <div className="relative h-44 overflow-hidden bg-secondary">
                {s.image_url ? (
                  <img
                    src={s.image_url}
                    alt={`Servicio ${s.name}`}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-sm text-muted-foreground">
                    Sin imagen
                  </div>
                )}
                {canManage ? (
                  <div
                    className="absolute left-3 top-3 grid h-9 w-9 cursor-grab place-items-center rounded-xl bg-card/95 text-primary shadow-sm active:cursor-grabbing"
                    aria-label="Arrastrar para reordenar"
                    {...dragHandleProps}
                  >
                    <GripVertical className="h-4 w-4" />
                  </div>
                ) : null}
                <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-card/90 px-2.5 py-1 text-[11px] font-medium text-primary backdrop-blur">
                  <Clock className="h-3 w-3" /> {s.duration_min} min
                </span>
                {perms.isCliente ? null : (
                <span
                  className={`absolute ${canManage ? "left-14" : "left-3"} top-3 rounded-full px-2.5 py-1 text-[11px] font-medium backdrop-blur ${badge.className}`}
                >
                  {badge.label}
                </span>
                )}
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h3 className="font-display text-lg font-bold text-primary">{s.name}</h3>
                <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {s.description || "Sin descripción"}
                </p>
                {s.publish_at && s.is_public && new Date(s.publish_at).getTime() > Date.now() ? (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarClock className="h-3.5 w-3.5" />
                    Visible desde{" "}
                    {new Date(s.publish_at).toLocaleString("es-CO", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                ) : null}
                <div className="mt-4">
                  <p className="font-display text-xl font-bold text-accent">
                    {servicePriceHeadline(s)}
                  </p>
                  {servicePriceNote(s) ? (
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                      {servicePriceNote(s)}
                    </p>
                  ) : null}
                </div>
                {perms.isCliente ? (
                  <div className="mt-4 grid gap-2">
                    <Button
                      variant="outline"
                      className="h-11 w-full rounded-xl"
                      onClick={() => setDetailService(s)}
                    >
                      Leer más
                    </Button>
                    <Button
                      className="h-11 w-full rounded-xl"
                      onClick={() =>
                        void navigate({
                          to: "/panel/agenda",
                          search: { service: s.id, google: undefined },
                        })
                      }
                    >
                      <CalendarPlus className="mr-2 h-4 w-4" /> Agendar
                    </Button>
                  </div>
                ) : null}
                {!perms.isCliente && !canManage ? (
                  <Button
                    variant="outline"
                    className="mt-4 h-11 w-full rounded-xl"
                    onClick={() => setDetailService(s)}
                  >
                    Leer más
                  </Button>
                ) : null}
                {canManage ? (
                  <div className="mt-4 flex gap-2">
                    <Button
                      variant="outline"
                      className="h-11 flex-1 rounded-xl"
                      onClick={() => openEdit(s)}
                    >
                      <Pencil className="mr-2 h-4 w-4" /> Editar
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      className="h-11 w-11 rounded-xl"
                      aria-label={`Eliminar ${s.name}`}
                      onClick={() => {
                        setPendingDelete({ name: s.name, id: s.id });
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : null}
              </div>
            </article>
          );
        }}
      />

      {canManage ? (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          <button
            type="button"
            onClick={openNew}
            className="card-soft group flex min-h-[22rem] flex-col items-center justify-center gap-3 border-dashed border-primary/25 bg-primary/[0.03] text-primary transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/45 hover:bg-primary/[0.06] hover:shadow-lift"
            aria-label="Agregar servicio"
          >
            <span className="grid h-16 w-16 place-items-center rounded-full bg-primary/10 transition-transform duration-300 group-hover:scale-105">
              <Plus className="h-8 w-8" strokeWidth={2.25} />
            </span>
            <span className="font-display text-lg font-bold">Agregar servicio</span>
          </button>
        </div>
      ) : null}

      {!list.length && !canManage ? <Empty message="Sin servicios." /> : null}

      {canManage ? <ServiceActivityAdmin /> : null}

      <ServiceDetailDialog
        service={detailService}
        open={!!detailService}
        onOpenChange={(open) => {
          if (!open) setDetailService(null);
        }}
        showAgendar={!!detailService && (perms.isCliente || perms.isColaborador)}
      />

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto rounded-3xl">
          <h2 className="font-display text-xl font-bold text-primary">
            {editing === "new" ? "Nuevo servicio" : "Editar servicio"}
          </h2>
          <div className="mt-5 flex flex-col gap-6">
            <section className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Datos del servicio
              </h3>
              <div className="space-y-2">
                <Label>Nombre *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>Descripción</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="min-h-[160px] rounded-xl text-sm leading-relaxed"
                  rows={7}
                />
              </div>
              <div className="space-y-2">
                <Label>URL imagen</Label>
                <Textarea
                  value={form.image_url}
                  onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
                  className="min-h-[88px] rounded-xl font-mono text-xs leading-relaxed"
                  rows={4}
                  placeholder="https://…"
                />
              </div>
            </section>

            <section className="space-y-4 border-t border-border/70 pt-6">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Precio y duración
              </h3>
              <div className="space-y-2">
                <Label>Tipo de precio</Label>
                <div className="flex flex-col gap-2">
                  {(
                    [
                      ["fixed", "Precio fijo"],
                      ["variable", "Precio variable (rango)"],
                    ] as const
                  ).map(([value, label]) => (
                    <label
                      key={value}
                      className="flex cursor-pointer items-center gap-3 rounded-xl border border-border px-4 py-3 text-sm"
                    >
                      <input
                        type="radio"
                        name="price_mode"
                        checked={form.price_mode === value}
                        onChange={() => setForm((f) => ({ ...f, price_mode: value }))}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              {form.price_mode === "fixed" ? (
                <>
                  <div className="space-y-2">
                    <Label>Precio (COP)</Label>
                    <Input
                      type="number"
                      value={form.price}
                      onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Duración (min)</Label>
                    <Input
                      type="number"
                      value={form.duration_min}
                      onChange={(e) => setForm((f) => ({ ...f, duration_min: e.target.value }))}
                      className="h-11 rounded-xl"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Precio mínimo (COP)</Label>
                    <Input
                      type="number"
                      value={form.price_min}
                      onChange={(e) => setForm((f) => ({ ...f, price_min: e.target.value }))}
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Precio máximo (COP)</Label>
                    <Input
                      type="number"
                      value={form.price_max}
                      onChange={(e) => setForm((f) => ({ ...f, price_max: e.target.value }))}
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Duración (min)</Label>
                    <Input
                      type="number"
                      value={form.duration_min}
                      onChange={(e) => setForm((f) => ({ ...f, duration_min: e.target.value }))}
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Nota para el cliente</Label>
                    <Textarea
                      value={form.price_note}
                      onChange={(e) => setForm((f) => ({ ...f, price_note: e.target.value }))}
                      className="min-h-[88px] rounded-xl text-sm leading-relaxed"
                      rows={4}
                    />
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Aparece en la ficha del servicio y en los correos de cita. El valor final se
                      confirma en recepción antes de ingresar al servicio.
                    </p>
                  </div>
                </>
              )}
            </section>

            <section className="space-y-4 border-t border-border/70 pt-6">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Publicación
              </h3>
              <div className="flex flex-col gap-2">
                {(
                  [
                    ["now", "Publicar ahora"],
                    ["scheduled", "Programar fecha"],
                    ["draft", "Borrador (no visible)"],
                  ] as const
                ).map(([value, label]) => (
                  <label
                    key={value}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-border px-4 py-3 text-sm"
                  >
                    <input
                      type="radio"
                      name="publish_mode"
                      checked={form.publish_mode === value}
                      onChange={() => setForm((f) => ({ ...f, publish_mode: value }))}
                    />
                    {label}
                  </label>
                ))}
              </div>
              {form.publish_mode === "scheduled" ? (
                <div className="space-y-2">
                  <Label>Fecha y hora de aparición</Label>
                  <Input
                    type="datetime-local"
                    value={form.publish_at_local}
                    onChange={(e) => setForm((f) => ({ ...f, publish_at_local: e.target.value }))}
                    className="h-11 rounded-xl"
                  />
                </div>
              ) : null}
            </section>

            <section className="space-y-3 border-t border-border/70 pt-6">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Actividades incluidas
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Matching de personal · visible en “Leer más”
                </p>
              </div>
              <div className="flex flex-col gap-2">
                {(activityCatalog.data ?? []).map((item) => {
                  const on = form.activities.includes(item.id);
                  return (
                    <label
                      key={item.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
                        on
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() =>
                          setForm((f) => ({
                            ...f,
                            activities: on
                              ? f.activities.filter((a) => a !== item.id)
                              : [...f.activities, item.id],
                          }))
                        }
                      />
                      {item.label}
                    </label>
                  );
                })}
              </div>
            </section>
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
      <ConfirmDialog
        open={!!pendingDelete}
        title={
          <>
            ¿Eliminar el servicio <span className="text-accent">{pendingDelete?.name}</span>?
          </>
        }
        description="Dejará de aparecer en el catálogo y en la agenda."
        onConfirm={() => {
          if (pendingDelete) deleteMut.mutate(pendingDelete.id);
        }}
        onOpenChange={(o) => {
          if (!o) setPendingDelete(null);
        }}
      />
    </AppShell>
  );
}
