import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Empty } from "@/components/ui-kit";
import { api, resolveMediaUrl } from "@/lib/api";
import { time } from "@/lib/format";
import {
  defaultDispenseMode,
  stockQtyForDispense,
} from "@/lib/inventory-module";
import { canWriteClinicalNotes } from "@/lib/roles";
import {
  pickWorkingLocation,
  readWorkingLocationId,
} from "@/lib/working-location";
import { getLocations } from "@/lib/spa-queries";

type Consult = {
  id: string;
  pet_id: string;
  pet_name: string;
  pet_photo_url: string | null;
  species: string | null;
  sex: string | null;
  breed: string | null;
  age_years: number | null;
  weight_kg: number | null;
  weight_updated_at: string | null;
  allergies: string | null;
  vaccines: string | null;
  medical_notes: string | null;
  owner_name: string | null;
  service_name: string;
  service_price: number | null;
  vet_name: string;
  starts_at: string;
  status: string;
  clinical_temperature?: string | null;
  clinical_heart_rate?: string | null;
  clinical_resp_rate?: string | null;
  clinical_mucous?: string | null;
  clinical_body_condition?: string | null;
  clinical_reason?: string | null;
  clinical_diagnosis?: string | null;
  clinical_treatment?: string | null;
};

const TABS = ["Consulta", "Exámenes", "Vacunas", "Historial"] as const;

const VITAL_FIELDS = [
  { key: "clinical_temperature", label: "Temperatura" },
  { key: "clinical_heart_rate", label: "Frec. cardíaca" },
  { key: "clinical_resp_rate", label: "Frec. respiratoria" },
  { key: "clinical_mucous", label: "Mucosas" },
  { key: "clinical_body_condition", label: "Condición corporal" },
] as const;

const NOTE_FIELDS = [
  { key: "clinical_reason", label: "Motivo de la consulta" },
  { key: "clinical_diagnosis", label: "Diagnóstico" },
  { key: "clinical_treatment", label: "Tratamiento y fórmula" },
] as const;

type ClinicalKey = (typeof VITAL_FIELDS)[number]["key"] | (typeof NOTE_FIELDS)[number]["key"];

export function VeterinaryConsults() {
  const query = useQuery({
    queryKey: ["veterinary", "consults"],
    queryFn: () => api<{ items: Consult[] }>("/veterinary/consults"),
  });
  const [openId, setOpenId] = useState<string | null>(null);
  const items = query.data?.items ?? [];
  const detail = useQuery({
    queryKey: ["veterinary", "consult", openId],
    enabled: Boolean(openId),
    queryFn: () => api<Consult>(`/veterinary/consults/${openId}`),
  });

  return (
    <AppShell title="Consultas">
      {query.isError ? (
        <Empty message="No tenés acceso a esta sección." />
      ) : query.isPending ? (
        <Empty message="Cargando." />
      ) : openId ? (
        detail.isError ? (
          <Empty message="No se pudo abrir esta consulta." />
        ) : detail.isPending || !detail.data ? (
          <Empty message="Cargando consulta." />
        ) : (
          <ConsultSheet
            item={detail.data}
            siblings={items}
            onBack={() => setOpenId(null)}
          />
        )
      ) : items.length === 0 ? (
        <Empty message="Todavía no hay consultas." />
      ) : (
        <ul className="grid gap-3">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="card-soft flex w-full items-center justify-between gap-3 p-4 text-left"
                onClick={() => setOpenId(item.id)}
              >
                <span>
                  <span className="block font-semibold text-foreground">{item.pet_name}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {item.service_name} · {time(item.starts_at)} · {item.vet_name}
                  </span>
                </span>
                <span className="text-sm text-muted-foreground">{item.owner_name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}

function ConsultSheet({
  item,
  siblings,
  onBack,
}: {
  item: Consult;
  siblings: Consult[];
  onBack: () => void;
}) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Consulta");
  const [weight, setWeight] = useState(item.weight_kg == null ? "" : String(item.weight_kg));
  const when = new Date(item.starts_at);
  const history = siblings.filter((row) => row.pet_id === item.pet_id && row.id !== item.id);
  const saveWeight = useMutation({
    mutationFn: () =>
      api(`/pets/${item.pet_id}`, {
        method: "PATCH",
        body: { weight_kg: weight.trim() === "" ? null : Number(weight) },
      }),
    onSuccess: async () => {
      toast.success("Peso guardado en la ficha");
      await qc.invalidateQueries({ queryKey: ["veterinary", "consults"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-4">
      <button type="button" className="text-sm text-muted-foreground" onClick={onBack}>
        Veterinaria / Consultas
      </button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl font-bold text-primary">Consulta</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {when.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "short" })} · {time(item.starts_at)} · Atiende {item.vet_name}
          </p>
        </div>
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
          {item.status}
        </span>
      </div>

      <section className="card-soft p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex gap-3">
            {item.pet_photo_url ? (
              <img src={resolveMediaUrl(item.pet_photo_url)} alt={item.pet_name} className="h-16 w-16 rounded-full object-cover" />
            ) : (
              <span className="grid h-16 w-16 place-items-center rounded-full bg-primary/10 font-semibold text-primary">
                {item.pet_name.slice(0, 1)}
              </span>
            )}
            <div>
              <p className="font-display text-2xl font-bold text-primary">{item.pet_name}</p>
              <p className="text-sm text-muted-foreground">
                {[item.species, item.sex, item.breed, item.age_years != null ? `${item.age_years} años` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <p className="text-sm text-muted-foreground">Dueño: {item.owner_name || "sin dueño"}</p>
            </div>
          </div>
          <div className="w-44">
            <Label htmlFor="consult-weight">Peso (kg)</Label>
            <Input
              id="consult-weight"
              inputMode="decimal"
              value={weight}
              onChange={(event) => setWeight(event.target.value)}
              onBlur={() => saveWeight.mutate()}
              className="mt-1 h-11 rounded-xl text-lg"
            />
            {item.weight_updated_at ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Última actualización: {new Date(item.weight_updated_at).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}
              </p>
            ) : null}
          </div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <Info title="Alergias" value={item.allergies} />
          <Info title="Tratamiento activo" value={item.medical_notes} />
          <Info title="Vacunas y desparasitación" value={item.vaccines} />
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            className={`rounded-full border px-3 py-1 text-xs ${
              tab === name ? "border-accent bg-accent/15" : "border-border text-muted-foreground"
            }`}
            onClick={() => setTab(name)}
          >
            {name}
          </button>
        ))}
      </div>

      {tab === "Consulta" ? <ConsultTab item={item} /> : null}
      {tab === "Exámenes" ? <ExamTab appointmentId={item.id} /> : null}
      {tab === "Vacunas" ? (
        <VaccineTab appointmentId={item.id} weightKg={weight} />
      ) : null}
      {tab === "Historial" ? (
        history.length === 0 ? (
          <Empty message="No hay otras citas veterinarias de esta mascota." />
        ) : (
          <ul className="grid gap-2">
            {history.map((row) => (
              <li key={row.id} className="card-soft p-4 text-sm">
                {row.service_name} · {time(row.starts_at)} · {row.vet_name}
              </li>
            ))}
          </ul>
        )
      ) : null}

      <Button type="button" variant="outline" className="rounded-xl" onClick={onBack}>
        Volver al listado
      </Button>
    </div>
  );
}

function ConsultTab({ item }: { item: Consult }) {
  const { user } = useRouteContext({ from: "/_authenticated" });
  const canWrite = canWriteClinicalNotes(user);
  const qc = useQueryClient();
  const [fields, setFields] = useState<Record<ClinicalKey, string>>(() => clinicalState(item));

  useEffect(() => {
    setFields(clinicalState(item));
  }, [item.id, item.clinical_reason, item.clinical_diagnosis, item.clinical_treatment,
    item.clinical_temperature, item.clinical_heart_rate, item.clinical_resp_rate,
    item.clinical_mucous, item.clinical_body_condition]);

  const save = useMutation({
    mutationFn: (patch: Partial<Record<ClinicalKey, string>>) =>
      api(`/veterinary/consults/${item.id}/clinical`, {
        method: "PATCH",
        body: patch,
      }),
    onSuccess: async () => {
      toast.success("Consulta guardada");
      await qc.invalidateQueries({ queryKey: ["veterinary", "consult", item.id] });
      await qc.invalidateQueries({ queryKey: ["veterinary", "consults"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const persist = (key: ClinicalKey) => {
    if (!canWrite) return;
    const next = fields[key].trim();
    const previous = (item[key] ?? "").trim();
    if (next === previous) return;
    save.mutate({ [key]: next });
  };

  return (
    <section className="card-soft space-y-4 p-5">
      <h3 className="text-sm font-semibold text-foreground">Consulta de hoy</h3>
      {!canWrite ? (
        <p className="text-xs text-muted-foreground">Solo lectura. El veterinario completa esta ficha.</p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-5">
        {VITAL_FIELDS.map(({ key, label }) => (
          <div key={key}>
            <Label htmlFor={key}>{label}</Label>
            <Input
              id={key}
              className="mt-1 h-11 rounded-xl"
              value={fields[key]}
              disabled={!canWrite}
              onChange={(event) => setFields((current) => ({ ...current, [key]: event.target.value }))}
              onBlur={() => persist(key)}
            />
          </div>
        ))}
      </div>
      {NOTE_FIELDS.map(({ key, label }) => (
        <div key={key}>
          <Label htmlFor={key}>{label}</Label>
          <textarea
            id={key}
            className="mt-1 min-h-[72px] w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm disabled:opacity-60"
            value={fields[key]}
            disabled={!canWrite}
            onChange={(event) => setFields((current) => ({ ...current, [key]: event.target.value }))}
            onBlur={() => persist(key)}
          />
        </div>
      ))}
    </section>
  );
}

function clinicalState(item: Consult): Record<ClinicalKey, string> {
  return {
    clinical_temperature: item.clinical_temperature ?? "",
    clinical_heart_rate: item.clinical_heart_rate ?? "",
    clinical_resp_rate: item.clinical_resp_rate ?? "",
    clinical_mucous: item.clinical_mucous ?? "",
    clinical_body_condition: item.clinical_body_condition ?? "",
    clinical_reason: item.clinical_reason ?? "",
    clinical_diagnosis: item.clinical_diagnosis ?? "",
    clinical_treatment: item.clinical_treatment ?? "",
  };
}

type ExamOrder = { id: string; exam_name: string; scheduled_at: string | null; status: string };
type Supply = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  module?: string | null;
  dispense_mode?: string | null;
  unit_kind?: string | null;
  pack_size?: number | null;
};

type CatalogItem = { id: string; name: string };
type ConsultSupply = {
  id: string;
  name: string;
  inventory_item_id: string | null;
  qty_applied?: number | null;
  qty_stock?: number | null;
  dispense_mode?: string | null;
  location_id?: string | null;
};

const OTHER_EXAM = "__other__";

function ExamTab({ appointmentId }: { appointmentId: string }) {
  const qc = useQueryClient();
  const [examName, setExamName] = useState("");
  const [extra, setExtra] = useState("");
  const [schedule, setSchedule] = useState(false);
  const [when, setWhen] = useState("");
  const catalog = useQuery({
    queryKey: ["veterinary", "catalog", "exam"],
    queryFn: () => api<{ items: CatalogItem[] }>("/veterinary/catalog?kind=exam"),
  });
  const orders = useQuery({
    queryKey: ["veterinary", "exams", appointmentId],
    queryFn: () => api<{ items: ExamOrder[] }>(`/veterinary/consults/${appointmentId}/exams`),
  });
  const options = catalog.data?.items ?? [];
  const selected = examName || options[0]?.name || OTHER_EXAM;
  const custom = selected === OTHER_EXAM;
  const chosen = custom ? extra.trim() : selected;
  const scheduling = !custom && schedule;
  const add = useMutation({
    mutationFn: () =>
      api(`/veterinary/consults/${appointmentId}/exams`, {
        method: "POST",
        body: {
          exam_name: chosen,
          scheduled_at: scheduling && when ? new Date(when).toISOString() : null,
        },
      }),
    onSuccess: async () => {
      setExtra("");
      setExamName("");
      setSchedule(false);
      setWhen("");
      await qc.invalidateQueries({ queryKey: ["veterinary", "exams", appointmentId] });
      await qc.invalidateQueries({ queryKey: ["veterinary", "agenda"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const items = orders.data?.items ?? [];
  return (
    <section className="card-soft space-y-4 p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="exam-name">Examen</Label>
          <select
            id="exam-name"
            className="mt-1 h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
            value={selected}
            onChange={(event) => {
              setExamName(event.target.value);
              setExtra("");
              setSchedule(false);
              setWhen("");
            }}
          >
            {options.map((item) => (
              <option key={item.id} value={item.name}>
                {item.name}
              </option>
            ))}
            <option value={OTHER_EXAM}>Indique el examen…</option>
          </select>
          {custom ? (
            <Input
              id="exam-extra"
              className="mt-2 h-11 rounded-xl"
              value={extra}
              autoFocus
              onChange={(event) => setExtra(event.target.value)}
            />
          ) : (
            <label className="mt-3 flex items-center gap-2 text-sm text-foreground">
              <Checkbox
                checked={schedule}
                onCheckedChange={(checked) => {
                  setSchedule(checked === true);
                  if (checked !== true) setWhen("");
                }}
              />
              Agendar
            </label>
          )}
        </div>
        {scheduling ? (
          <div>
            <Label htmlFor="exam-when">Fecha</Label>
            <Input
              id="exam-when"
              type="datetime-local"
              className="mt-1 h-11 rounded-xl"
              value={when}
              onChange={(event) => setWhen(event.target.value)}
            />
          </div>
        ) : null}
        <div className="flex items-end">
          <Button
            type="button"
            className="rounded-xl"
            disabled={add.isPending || !chosen || (scheduling && !when)}
            onClick={() => add.mutate()}
          >
            {scheduling ? "Agendar" : "Guardar"}
          </Button>
        </div>
      </div>
      {items.length ? (
        <ul className="grid gap-2">
          {items.map((row) => (
            <li key={row.id} className="rounded-2xl bg-secondary/60 p-4 text-sm">
              {row.exam_name}
              {row.scheduled_at ? ` · ${time(row.scheduled_at)}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function VaccineTab({ appointmentId, weightKg }: { appointmentId: string; weightKg: string }) {
  const { user } = useRouteContext({ from: "/_authenticated" });
  const canApply = canWriteClinicalNotes(user);
  const qc = useQueryClient();
  const [extra, setExtra] = useState("");
  const [custom, setCustom] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [qtyApplied, setQtyApplied] = useState("1");
  const locationsQ = useQuery({ queryKey: ["locations"], queryFn: getLocations });
  const workingLocation = pickWorkingLocation(
    (locationsQ.data?.items ?? []).filter((x) => x.active),
    readWorkingLocationId(),
  );
  const locationId = workingLocation?.id || "";
  const supplies = useQuery({
    queryKey: ["veterinary", "supplies", locationId],
    queryFn: () =>
      api<{ items: Supply[] }>(
        locationId
          ? `/veterinary/supplies?location_id=${encodeURIComponent(locationId)}`
          : "/veterinary/supplies",
      ),
  });
  const catalog = useQuery({
    queryKey: ["veterinary", "catalog", "vaccine"],
    queryFn: () => api<{ items: CatalogItem[] }>("/veterinary/catalog?kind=vaccine"),
  });
  const saved = useQuery({
    queryKey: ["veterinary", "consult-supplies", appointmentId],
    queryFn: () => api<{ items: ConsultSupply[] }>(`/veterinary/consults/${appointmentId}/supplies`),
  });
  const add = useMutation({
    mutationFn: (body: {
      name: string;
      inventory_item_id?: string;
      qty_applied?: number;
      location_id?: string;
    }) => api(`/veterinary/consults/${appointmentId}/supplies`, { method: "POST", body }),
    onSuccess: async () => {
      setExtra("");
      setCustom(false);
      setSelectedId(null);
      setQtyApplied("1");
      toast.success("Insumo aplicado");
      await qc.invalidateQueries({ queryKey: ["veterinary", "consult-supplies", appointmentId] });
      await qc.invalidateQueries({ queryKey: ["veterinary", "supplies"] });
      await qc.invalidateQueries({ queryKey: ["inventory"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const stock = supplies.data?.items ?? [];
  const selected = stock.find((item) => item.id === selectedId) ?? null;
  const mode = selected
    ? (selected.dispense_mode || defaultDispenseMode(selected.category)).toLowerCase()
    : "content";
  const appliedNum = Number(qtyApplied) || 0;
  const stockPreview = selected
    ? stockQtyForDispense({
        dispense_mode: mode,
        unit_kind: selected.unit_kind,
        pack_size: selected.pack_size,
        qty_applied: appliedNum > 0 ? appliedNum : 1,
      })
    : 0;
  const applied = saved.data?.items ?? [];

  return (
    <section className="card-soft space-y-4 p-5">
      <p className="text-sm text-foreground">Peso {weightKg.trim() || "sin registro"} kg</p>
      {workingLocation ? (
        <p className="text-xs text-muted-foreground">Stock de {workingLocation.name}</p>
      ) : null}
      {!canApply ? (
        <p className="text-xs text-muted-foreground">Solo el veterinario aplica insumos con descuento de stock.</p>
      ) : null}

      {applied.length ? (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Aplicados</h4>
          <ul className="mt-2 grid gap-2">
            {applied.map((row) => (
              <li key={row.id} className="rounded-2xl bg-secondary/60 px-4 py-3 text-sm">
                <span className="font-medium text-foreground">{row.name}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {row.qty_applied != null ? `Aplicado ${row.qty_applied}` : "Sin stock"}
                  {row.qty_stock != null ? ` · Kardex −${row.qty_stock}` : ""}
                  {row.dispense_mode === "whole_pack" ? " · frasco completo" : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ul className="grid gap-2">
        {stock.map((item) => {
          const itemMode = (item.dispense_mode || defaultDispenseMode(item.category)).toLowerCase();
          return (
            <li key={item.id}>
              <button
                type="button"
                className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm ${
                  selectedId === item.id ? "bg-accent/20 ring-1 ring-accent/40" : "bg-secondary/60"
                }`}
                disabled={!canApply || add.isPending || item.quantity <= 0}
                onClick={() => {
                  setSelectedId(item.id);
                  setQtyApplied(itemMode === "whole_pack" ? String(item.pack_size || 1) : "1");
                }}
              >
                <span>
                  <span className="block font-medium">{item.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {item.category}
                    {itemMode === "whole_pack" ? " · frasco completo" : ""}
                  </span>
                </span>
                <span className="text-muted-foreground">Stock {item.quantity}</span>
              </button>
            </li>
          );
        })}
        {(catalog.data?.items ?? [])
          .filter((item) => !stock.some((row) => row.name === item.name))
          .map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-2xl bg-secondary/60 px-4 py-3 text-left text-sm"
                disabled={!canApply || add.isPending}
                onClick={() => add.mutate({ name: item.name })}
              >
                <span>{item.name}</span>
                <span className="text-muted-foreground">Solo anotar</span>
              </button>
            </li>
          ))}
      </ul>

      {selected && canApply ? (
        <div className="rounded-2xl border border-border/70 p-4 space-y-3">
          <p className="text-sm font-medium text-foreground">Aplicar {selected.name}</p>
          {mode === "whole_pack" ? (
            <p className="text-xs text-muted-foreground">
              Este producto descuenta el frasco completo ({stockPreview} en kardex), aunque indiques menos.
            </p>
          ) : null}
          <div>
            <Label htmlFor="supply-qty">Cantidad aplicada</Label>
            <Input
              id="supply-qty"
              className="mt-1 h-11 rounded-xl"
              inputMode="decimal"
              value={qtyApplied}
              onChange={(event) => setQtyApplied(event.target.value)}
            />
          </div>
          <Button
            type="button"
            className="rounded-xl"
            disabled={add.isPending || !(appliedNum > 0)}
            onClick={() =>
              add.mutate({
                name: selected.name,
                inventory_item_id: selected.id,
                qty_applied: appliedNum,
                location_id: locationId || undefined,
              })
            }
          >
            Aplicar y descontar stock
          </Button>
        </div>
      ) : null}

      {custom ? (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (extra.trim()) add.mutate({ name: extra.trim() });
          }}
        >
          <Input
            className="h-11 rounded-xl"
            value={extra}
            autoFocus
            onChange={(event) => setExtra(event.target.value)}
          />
          <Button type="submit" className="rounded-xl" disabled={add.isPending || !extra.trim() || !canApply}>
            Anotar
          </Button>
        </form>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="rounded-xl"
          disabled={!canApply}
          onClick={() => setCustom(true)}
        >
          Indique la vacuna…
        </Button>
      )}
    </section>
  );
}

function Info({ title, value }: { title: string; value: string | null | undefined }) {
  return (
    <div className="rounded-2xl bg-secondary/60 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      <p className="mt-1.5 text-sm text-foreground">{value?.trim() || "Sin registros"}</p>
    </div>
  );
}
