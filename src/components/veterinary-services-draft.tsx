import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, resolveMediaUrl } from "@/lib/api";
import { IMAGING, SURGERIES, VET_HOME_GROUPS } from "@/lib/veterinary-catalog";

type ServiceRow = {
  id: string;
  name: string;
  image_url?: string | null;
  price?: number | null;
};

type Draft = { on: boolean; price: string; id?: string };

function amount(value: string) {
  const cleaned = value.trim().replace(/\./g, "").replace(",", ".");
  if (!cleaned) return 0;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function GroupWindow({
  title,
  names,
  service,
  rows,
  onSaveImage,
}: {
  title: (typeof VET_HOME_GROUPS)[number];
  names: readonly string[];
  service?: ServiceRow;
  rows?: ServiceRow[];
  onSaveImage: (imageUrl: string) => void;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [image, setImage] = useState(service?.image_url ?? "");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const prices = useRef<Record<string, string>>({});
  const ids = useRef<Record<string, string>>({});
  const hydrated = useRef(false);
  useEffect(() => {
    setImage(service?.image_url ?? "");
  }, [service?.image_url]);
  const persist = useMutation({
    mutationFn: (input: { name: string; price: string; id?: string }) =>
      api<ServiceRow>("/services", {
        method: "PUT",
        body: {
          id: input.id,
          name: input.name,
          category: "veterinary",
          is_public: false,
          price: amount(input.price),
          duration_min: 60,
          activities: [],
          uses_medicated: false,
          uses_colorimetry: false,
        },
      }),
    onSuccess: async (saved, input) => {
      ids.current[input.name] = saved.id;
      const typed = prices.current[input.name];
      if (typed !== undefined && amount(typed) !== amount(input.price)) {
        persist.mutate({ name: input.name, price: typed, id: saved.id });
        return;
      }
      await qc.invalidateQueries({ queryKey: ["services", "veterinary-groups"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/services/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["services", "veterinary-groups"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  useEffect(() => {
    if (!rows) return;
    const saving = persist.isPending || remove.isPending;
    setDrafts((current) => {
      const next: Record<string, Draft> = {};
      for (const name of names) {
        const row = rows.find((item) => item.name === name);
        if (row?.id) ids.current[name] = row.id;
        const savedPrice = row?.price ? String(Math.round(row.price)) : "";
        const typed = prices.current[name];
        const local = current[name];
        const keepPrice = hydrated.current && Boolean(local?.on) && typed !== undefined && typed !== savedPrice;
        const keepOn = hydrated.current && local !== undefined && local.on !== Boolean(row) && saving;
        next[name] = {
          on: keepOn ? local.on : Boolean(row),
          price: keepPrice ? typed : savedPrice,
          id: row?.id ?? local?.id ?? ids.current[name],
        };
      }
      return next;
    });
    hydrated.current = true;
  }, [names, rows, persist.isPending, remove.isPending]);
  return (
    <article className="card-soft overflow-hidden">
      <button type="button" className="block w-full text-left" onClick={() => setOpen((value) => !value)}>
        <div className="relative h-44 bg-secondary">
          {image.trim() ? (
            <img src={resolveMediaUrl(image.trim())} alt={title} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">Sin imagen</div>
          )}
        </div>
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="font-display text-2xl font-bold text-primary">{title}</h2>
          <span className="text-sm text-muted-foreground">{open ? "Cerrar" : "Abrir"}</span>
        </div>
      </button>
      <div className="space-y-4 px-5 pb-5">
        <div>
          <Label htmlFor={`image-${title}`}>Imagen</Label>
          <Input
            id={`image-${title}`}
            className="mt-1.5 h-11 rounded-xl"
            value={image}
            placeholder="URL de la imagen"
            onChange={(event) => setImage(event.target.value)}
            onBlur={() => {
              if (!image.trim() && !service?.id) return;
              onSaveImage(image.trim());
            }}
          />
        </div>
        {open ? (
          <ul className="grid gap-3">
            {names.map((name) => {
              const draft = drafts[name] ?? { on: false, price: "" };
              return (
                <li key={name} className="rounded-2xl bg-secondary/50 p-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={draft.on}
                      aria-label={`Activar ${name}`}
                      onCheckedChange={(checked) => {
                        const on = checked === true;
                        setDrafts((current) => ({
                          ...current,
                          [name]: { ...draft, on },
                        }));
                        if (on) {
                          persist.mutate(
                            { name, price: prices.current[name] ?? draft.price, id: ids.current[name] ?? draft.id },
                            {
                              onError: () =>
                                setDrafts((current) => ({
                                  ...current,
                                  [name]: { ...draft, on: false },
                                })),
                            },
                          );
                          return;
                        }
                        const id = ids.current[name] ?? draft.id;
                        delete ids.current[name];
                        delete prices.current[name];
                        if (!id) return;
                        remove.mutate(id, {
                          onError: () =>
                            setDrafts((current) => ({
                              ...current,
                              [name]: { ...draft, on: true },
                            })),
                        });
                      }}
                    />
                    <p className="font-medium text-foreground">{name}</p>
                  </div>
                  {draft.on ? (
                    <label className="mt-3 block text-xs text-muted-foreground">
                      Precio
                      <Input
                        className="mt-1.5 h-11 rounded-xl"
                        inputMode="numeric"
                        value={draft.price}
                        placeholder="Sin precio"
                        onChange={(event) => {
                          prices.current[name] = event.target.value;
                          setDrafts((current) => ({
                            ...current,
                            [name]: { ...draft, price: event.target.value },
                          }));
                        }}
                        onBlur={(event) => {
                          if (!draft.on) return;
                          prices.current[name] = event.target.value;
                          const id = ids.current[name] ?? draft.id;
                          if (!id) return;
                          persist.mutate({ name, price: event.target.value, id });
                        }}
                      />
                    </label>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </article>
  );
}

export function VeterinaryServicesDraft() {
  const qc = useQueryClient();
  const services = useQuery({
    queryKey: ["services", "veterinary-groups"],
    queryFn: () => api<ServiceRow[]>("/services?category=veterinary"),
  });
  const save = useMutation({
    mutationFn: ({ title, imageUrl, id }: { title: string; imageUrl: string; id?: string }) =>
      api("/services", {
        method: "PUT",
        body: {
          id,
          name: title,
          category: "veterinary",
          is_public: Boolean(imageUrl),
          image_url: imageUrl || null,
          price: 0,
          duration_min: 60,
          activities: [],
          uses_medicated: false,
          uses_colorimetry: false,
        },
      }),
    onSuccess: async () => {
      toast.success("Imagen guardada");
      await qc.invalidateQueries({ queryKey: ["services", "veterinary-groups"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const rows = services.data ?? [];
  return (
    <AppShell title="Servicios" subtitle="Cada ficha se abre al hacer clic. La imagen es la que ve el home.">
      <div className="grid gap-6 lg:grid-cols-2">
        <GroupWindow
          title="Cirugías"
          names={SURGERIES}
          service={rows.find((row) => row.name === "Cirugías")}
          rows={services.data}
          onSaveImage={(imageUrl) =>
            save.mutate({
              title: "Cirugías",
              imageUrl,
              id: rows.find((row) => row.name === "Cirugías")?.id,
            })
          }
        />
        <GroupWindow
          title="Laboratorio e imágenes"
          names={IMAGING}
          service={rows.find((row) => row.name === "Laboratorio e imágenes")}
          rows={services.data}
          onSaveImage={(imageUrl) =>
            save.mutate({
              title: "Laboratorio e imágenes",
              imageUrl,
              id: rows.find((row) => row.name === "Laboratorio e imágenes")?.id,
            })
          }
        />
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <CatalogEditor kind="exam" title="Exámenes de la clínica" />
        <CatalogEditor kind="vaccine" title="Vacunas de la clínica" />
      </div>
    </AppShell>
  );
}

type CatalogItem = { id: string; kind: string; name: string };

function CatalogEditor({ kind, title }: { kind: "exam" | "vaccine"; title: string }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const catalog = useQuery({
    queryKey: ["veterinary", "catalog", kind],
    queryFn: () => api<{ items: CatalogItem[] }>(`/veterinary/catalog?kind=${kind}`),
  });
  const add = useMutation({
    mutationFn: () => api("/veterinary/catalog", { method: "POST", body: { kind, name } }),
    onSuccess: async () => {
      setName("");
      await qc.invalidateQueries({ queryKey: ["veterinary", "catalog", kind] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/veterinary/catalog/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["veterinary", "catalog", kind] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const items = catalog.data?.items ?? [];
  return (
    <section className="card-soft p-5">
      <h2 className="font-display text-xl font-bold text-primary">{title}</h2>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim()) add.mutate();
        }}
      >
        <Input
          className="h-11 rounded-xl"
          value={name}
          placeholder="Nombre"
          onChange={(event) => setName(event.target.value)}
        />
        <Button type="submit" className="rounded-xl" disabled={add.isPending || !name.trim()}>
          Agregar
        </Button>
      </form>
      <ul className="mt-4 grid gap-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between rounded-2xl bg-secondary/60 px-4 py-2 text-sm">
            <span>{item.name}</span>
            <button type="button" className="text-muted-foreground" onClick={() => remove.mutate(item.id)}>
              Quitar
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
