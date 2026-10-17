import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useRouteContext } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { getLocations, type SpaLocation } from "@/lib/spa-queries";
import { permissionsFor } from "@/lib/roles";
import { AppShell } from "@/components/app-shell";
import { Empty } from "@/components/ui-kit";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronDown } from "lucide-react";
import { filterInventoryByModule } from "@/lib/inventory-module";

const PET_PLACEHOLDER = "/images/kira-face-grey.png";

type BedPattern = "sequential" | "hundreds" | "custom";
type CareLevel = "observacion" | "delicado" | "intensivos";
type OrderKind = "medication" | "food" | "vital" | "procedure" | "other";

type CareOrder = {
  id?: string;
  kind: OrderKind;
  name: string;
  interval_hours: number | null;
  fasting: boolean;
  dose_text?: string | null;
  notes?: string | null;
};

type Hospitalization = {
  id: string;
  pet_id: string;
  pet_name: string | null;
  pet_photo_url: string | null;
  pet_breed: string | null;
  pet_species: string | null;
  owner_name: string | null;
  care_level: CareLevel;
  orders_count?: number;
  admitted_at: string | null;
  plan_anchor_at: string | null;
  notes: string | null;
};

type Bed = {
  id: string;
  location_id: string;
  sort_index: number;
  code: string;
  label: string | null;
  active: boolean;
  status: "free" | "occupied";
  hospitalization: Hospitalization | null;
};

type StayDetail = {
  id: string;
  bed_code: string;
  bed_label: string | null;
  pet_id?: string;
  pet_name: string | null;
  pet_photo_url: string | null;
  pet_breed: string | null;
  pet_species: string | null;
  care_level: CareLevel;
  notes: string | null;
  admitted_at: string | null;
  orders: CareOrder[];
};

type PetOption = { id: string; name: string; breed?: string | null; photo_url?: string | null };

const PATTERN_OPTIONS: { id: BedPattern; title: string; hint: string }[] = [
  { id: "sequential", title: "1, 2, 3…", hint: "Numeración correlativa desde 1." },
  { id: "hundreds", title: "100, 101, 102…", hint: "Empieza en 100." },
  { id: "custom", title: "Personalizado", hint: "Definís el identificador de cada habitación." },
];

const CARE_LEVELS: { id: CareLevel; label: string; className: string }[] = [
  { id: "observacion", label: "Observación", className: "bg-sky-600 text-white" },
  { id: "delicado", label: "Delicado", className: "bg-amber-500 text-white" },
  { id: "intensivos", label: "Cuidados intensivos", className: "bg-rose-600 text-white" },
];

function careMeta(level: CareLevel | string | undefined) {
  return CARE_LEVELS.find((x) => x.id === level) ?? CARE_LEVELS[0];
}

function formatInterval(hours: number | null | undefined) {
  if (hours == null || Number.isNaN(hours)) return "sin frecuencia";
  if (hours === 1) return "cada 1 h";
  return `cada ${hours} h`;
}

function emptyOrder(): CareOrder {
  return { kind: "medication", name: "", interval_hours: 8, fasting: false, dose_text: "", notes: "" };
}

function pickPrimary(locations: SpaLocation[]) {
  return locations.find((x) => x.is_primary && x.active) ?? locations.find((x) => x.active) ?? null;
}

export function VeterinaryHospitalization() {
  const { user } = useRouteContext({ from: "/_authenticated" });
  const isAdmin = permissionsFor(user?.role).isAdmin;
  const canAdmit = isAdmin || (user?.veterinary_capabilities ?? []).includes("vet.write");
  const qc = useQueryClient();
  const locationsQ = useQuery({ queryKey: ["locations"], queryFn: getLocations });
  const locations = (locationsQ.data?.items ?? []).filter((x) => x.active);
  const [locationId, setLocationId] = useState("");
  useEffect(() => {
    if (locationId) return;
    const primary = pickPrimary(locations);
    if (primary) setLocationId(primary.id);
  }, [locations, locationId]);

  const bedsQ = useQuery({
    queryKey: ["vet-beds", locationId],
    enabled: Boolean(locationId),
    queryFn: () => api<{ items: Bed[]; location_id: string }>(`/veterinary/beds?location_id=${locationId}`),
  });
  const beds = bedsQ.data?.items ?? [];

  type CareAlert = {
    id: string;
    due_at: string | null;
    overdue: boolean;
    order_name: string;
    interval_hours: number | null;
    fasting: boolean;
    dose_text: string | null;
    bed_code: string;
    pet_name: string | null;
    care_level: CareLevel;
    hospitalization_id: string;
  };

  const tickMut = useMutation({
    mutationFn: () => api<{ overdue: number }>("/veterinary/care-tick", { method: "POST", body: {} }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["vet-care-alerts", locationId] });
    },
  });

  const alertsQ = useQuery({
    queryKey: ["vet-care-alerts", locationId],
    enabled: Boolean(locationId),
    refetchInterval: 60_000,
    queryFn: async () => {
      // Genera horizonte (mismo endpoint que EventBridge usará vía /internal/...).
      try {
        await api("/veterinary/care-tick", { method: "POST", body: {} });
      } catch {
        /* panel sigue aunque el tick falle */
      }
      return api<{ items: CareAlert[]; overdue_count: number; upcoming_count: number }>(
        `/veterinary/care-alerts?location_id=${locationId}&hours_ahead=4`,
      );
    },
  });
  const alerts = alertsQ.data?.items ?? [];
  const overdueCount = alertsQ.data?.overdue_count ?? 0;

  const completeMut = useMutation({
    mutationFn: (taskId: string) =>
      api(`/veterinary/care-tasks/${taskId}/complete`, { method: "POST", body: {} }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["vet-care-alerts", locationId] });
      await qc.invalidateQueries({ queryKey: ["vet-beds", locationId] });
    },
  });

  const [quantity, setQuantity] = useState("4");
  const [pattern, setPattern] = useState<BedPattern>("sequential");
  const [customCodes, setCustomCodes] = useState<string[]>(["", "", "", ""]);
  const [configOpen, setConfigOpen] = useState(false);
  const [hospTab, setHospTab] = useState<"mapa" | "ronda">("mapa");
  const [mapFilter, setMapFilter] = useState<"all" | "occupied" | "icu" | "free">("all");
  const [admitBed, setAdmitBed] = useState<Bed | null>(null);
  const [detailStayId, setDetailStayId] = useState<string | null>(null);
  const [editBed, setEditBed] = useState<Bed | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editLabel, setEditLabel] = useState("");

  useEffect(() => {
    const n = Math.max(1, Math.min(200, Number(quantity) || 1));
    setCustomCodes((prev) => {
      const next = [...prev];
      while (next.length < n) next.push("");
      return next.slice(0, n);
    });
  }, [quantity]);

  const configureMut = useMutation({
    mutationFn: () =>
      api("/veterinary/beds/configure", {
        method: "POST",
        body: {
          location_id: locationId,
          quantity: Math.max(1, Math.min(200, Number(quantity) || 1)),
          pattern,
          custom_codes: pattern === "custom" ? customCodes.map((c) => c.trim()) : undefined,
        },
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["vet-beds", locationId] });
      setConfigOpen(false);
    },
  });

  const patchMut = useMutation({
    mutationFn: () =>
      api(`/veterinary/beds/${editBed!.id}`, {
        method: "PATCH",
        body: { code: editCode.trim(), label: editLabel.trim() || null },
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["vet-beds", locationId] });
      setEditBed(null);
    },
  });

  const [lastDischargeBill, setLastDischargeBill] = useState<{
    total: number;
    charges: { description: string; amount: number }[];
  } | null>(null);

  const dischargeMut = useMutation({
    mutationFn: (stayId: string) =>
      api<{
        charges_total?: number;
        charges?: { description: string; amount: number }[];
      }>(`/veterinary/hospitalizations/${stayId}/discharge`, { method: "POST", body: {} }),
    onSuccess: async (data) => {
      setLastDischargeBill({
        total: data.charges_total ?? 0,
        charges: data.charges ?? [],
      });
      await qc.invalidateQueries({ queryKey: ["vet-beds", locationId] });
      await qc.invalidateQueries({ queryKey: ["vet-charges-pendiente", locationId] });
      setDetailStayId(null);
    },
  });

  const locationName = locations.find((x) => x.id === locationId)?.name ?? "Sede";
  const freeCount = beds.filter((b) => b.status === "free").length;
  const occupiedCount = beds.filter((b) => b.status === "occupied").length;
  const icuCount = beds.filter((b) => b.hospitalization?.care_level === "intensivos").length;

  return (
    <AppShell
      title="Hospitalización"
      subtitle={`Ala / pasillo · ${locationName}. Habitaciones por zona de cuidado; clic para plan o ingreso.`}
    >
    <div className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-wrap items-center gap-2 md:ml-auto">
          <label className="text-sm text-slate-600">
            Sede{" "}
            <select
              className="ml-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm"
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
          {isAdmin ? (
            <button
              type="button"
              className="rounded-md bg-[var(--kira-primary,#7c3aed)] px-3 py-1.5 text-sm font-medium text-white"
              onClick={() => {
                setQuantity(String(Math.max(beds.length, 1)));
                setConfigOpen(true);
              }}
            >
              Configurar habitaciones
            </button>
          ) : null}
        </div>
      </header>

      <Tabs
        value={hospTab}
        onValueChange={(v) => setHospTab(v as typeof hospTab)}
        className="space-y-4"
      >
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="mapa">Mapa</TabsTrigger>
          <TabsTrigger value="ronda">Ronda</TabsTrigger>
        </TabsList>

        <TabsContent value="mapa" className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["all", "Todas"],
                ["occupied", "Ocupadas"],
                ["icu", "Intensivos"],
                ["free", "Libres"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  mapFilter === id
                    ? "border-violet-300 bg-violet-50 text-[var(--kira-primary,#7c3aed)]"
                    : "border-slate-200 bg-white text-slate-600"
                }`}
                onClick={() => setMapFilter(id)}
              >
                {label}
                {id === "all" ? ` · ${beds.length}` : null}
                {id === "occupied" ? ` · ${occupiedCount}` : null}
                {id === "icu" ? ` · ${icuCount}` : null}
                {id === "free" ? ` · ${freeCount}` : null}
              </button>
            ))}
          </div>

          {bedsQ.isLoading ? (
            <p className="text-sm text-slate-500">Cargando mapa…</p>
          ) : beds.length === 0 ? (
            <Empty
              message={
                isAdmin
                  ? "Sin habitaciones. Configurá la cantidad y el patrón de numeración."
                  : "Sin habitaciones. Pedile a un administrador que las configure."
              }
            />
          ) : (
            <HallMap
              beds={beds}
              filter={mapFilter}
              canAdmit={canAdmit}
              isAdmin={isAdmin}
              busy={dischargeMut.isPending}
              onAdmit={(bed) => setAdmitBed(bed)}
              onOpen={(bed) => {
                if (bed.hospitalization) setDetailStayId(bed.hospitalization.id);
              }}
              onDischarge={(bed) => {
                if (bed.hospitalization && window.confirm("¿Dar de alta / egresar a este paciente?")) {
                  dischargeMut.mutate(bed.hospitalization.id);
                }
              }}
              onEdit={(bed) => {
                setEditBed(bed);
                setEditCode(bed.code);
                setEditLabel(bed.label ?? "");
              }}
            />
          )}

          <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
            <section className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Cola de cuidados</h2>
                  <p className="text-xs text-slate-500">Vencidas y próximas 4 h · scroll si hay más de 5</p>
                </div>
                <div className="flex items-center gap-2">
                  {overdueCount > 0 ? (
                    <span className="rounded-full bg-rose-600 px-2 py-0.5 text-xs font-medium text-white">
                      {overdueCount} vencida{overdueCount === 1 ? "" : "s"}
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                      Sin vencidas
                    </span>
                  )}
                  <button
                    type="button"
                    className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700"
                    disabled={tickMut.isPending || alertsQ.isFetching}
                    onClick={() => tickMut.mutate()}
                  >
                    Actualizar
                  </button>
                </div>
              </div>
              {alerts.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No hay indicaciones pendientes en la ventana.</p>
              ) : (
                <div className="relative mt-3">
                  <ul className="max-h-[17.5rem] divide-y divide-slate-100 overflow-y-auto pr-1">
                    {alerts.map((a) => (
                      <li
                        key={a.id}
                        className="flex min-h-[3.5rem] flex-wrap items-center justify-between gap-2 py-2 text-sm"
                      >
                        <div>
                          <p className="font-medium text-slate-900">
                            {a.bed_code} · {a.pet_name}{" "}
                            {a.overdue ? (
                              <span className="text-rose-600">· vencida</span>
                            ) : (
                              <span className="text-amber-600">· próxima</span>
                            )}
                          </p>
                          <p className="text-slate-600">
                            {a.order_name}
                            {a.dose_text ? ` · ${a.dose_text}` : ""}
                            {a.due_at
                              ? ` · ${new Date(a.due_at).toLocaleString("es-CO", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}`
                              : ""}
                          </p>
                        </div>
                        {canAdmit ? (
                          <button
                            type="button"
                            className="rounded-md bg-[var(--kira-primary,#7c3aed)] px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                            disabled={completeMut.isPending}
                            onClick={() => completeMut.mutate(a.id)}
                          >
                            Hecho
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  {alerts.length > 5 ? (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-white via-white/90 to-transparent pb-0.5 pt-6">
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                        Más alertas
                      </span>
                    </div>
                  ) : null}
                </div>
              )}
            </section>
            <button
              type="button"
              className="flex w-full flex-col items-center justify-center gap-1 rounded-xl bg-[var(--kira-primary,#7c3aed)] px-4 py-6 text-center text-white lg:w-44"
              onClick={() => setHospTab("ronda")}
            >
              <span className="text-base font-semibold">Iniciar ronda</span>
              <span className="text-xs font-normal text-violet-100">Recorrido con chulitos</span>
            </button>
          </div>
        </TabsContent>

        <TabsContent value="ronda" className="space-y-4">
          <HospRoundPanel locationId={locationId} canAct={canAdmit} />
        </TabsContent>
      </Tabs>

      {lastDischargeBill ? (
        <Modal title="Egreso · cargos a facturar" onClose={() => setLastDischargeBill(null)}>
          <p className="text-sm text-slate-600">
            Se generaron cargos pendientes. Cobrálos en Veterinaria → Tarifas internación.
          </p>
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {lastDischargeBill.charges.map((c, i) => (
              <li key={i} className="flex justify-between py-1.5">
                <span>{c.description}</span>
                <span>${Number(c.amount).toLocaleString("es-CO")}</span>
              </li>
            ))}
          </ul>
          {lastDischargeBill.charges.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">
              Sin tarifas configuradas ni insumos con precio: no hay cargos.
            </p>
          ) : (
            <p className="mt-3 text-sm font-semibold text-slate-900">
              Total ${lastDischargeBill.total.toLocaleString("es-CO")}
            </p>
          )}
        </Modal>
      ) : null}

      {configOpen && isAdmin ? (
        <Modal title="Configurar habitaciones" onClose={() => setConfigOpen(false)}>
          <p className="text-sm text-slate-600">
            Indicá cuántas habitaciones tiene la sede y cómo se numeran. Después podés editar cada
            identificador o nomenclatura.
          </p>
          <label className="mt-4 block text-sm font-medium text-slate-800">
            Cantidad
            <input
              type="number"
              min={1}
              max={200}
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </label>
          <fieldset className="mt-4 space-y-2">
            <legend className="text-sm font-medium text-slate-800">Patrón de numeración</legend>
            {PATTERN_OPTIONS.map((opt) => (
              <label
                key={opt.id}
                className={`flex cursor-pointer gap-3 rounded-lg border px-3 py-2 text-sm ${
                  pattern === opt.id ? "border-fuchsia-300 bg-fuchsia-50" : "border-slate-200"
                }`}
              >
                <input
                  type="radio"
                  name="pattern"
                  checked={pattern === opt.id}
                  onChange={() => setPattern(opt.id)}
                />
                <span>
                  <span className="font-medium text-slate-900">{opt.title}</span>
                  <span className="block text-slate-600">{opt.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
          {pattern === "custom" ? (
            <div className="mt-4 max-h-56 space-y-2 overflow-y-auto">
              {customCodes.map((code, idx) => (
                <label key={idx} className="block text-xs text-slate-600">
                  Habitación {idx + 1}
                  <input
                    className="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                    value={code}
                    placeholder="Ej. UCI, Jaula A, 12…"
                    onChange={(e) => {
                      const next = [...customCodes];
                      next[idx] = e.target.value;
                      setCustomCodes(next);
                    }}
                  />
                </label>
              ))}
            </div>
          ) : null}
          {configureMut.isError ? (
            <p className="mt-3 text-sm text-rose-600">
              {(configureMut.error as Error)?.message || "No se pudo configurar."}
            </p>
          ) : null}
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="rounded-md px-3 py-1.5 text-sm text-slate-600" onClick={() => setConfigOpen(false)}>
              Cancelar
            </button>
            <button
              type="button"
              className="rounded-md bg-[var(--kira-primary,#7c3aed)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              disabled={configureMut.isPending}
              onClick={() => configureMut.mutate()}
            >
              {configureMut.isPending ? "Guardando…" : "Aplicar"}
            </button>
          </div>
        </Modal>
      ) : null}

      {editBed && isAdmin ? (
        <Modal title={`Editar ${editBed.code}`} onClose={() => setEditBed(null)}>
          <label className="block text-sm font-medium text-slate-800">
            Identificador
            <input
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2"
              value={editCode}
              onChange={(e) => setEditCode(e.target.value)}
            />
          </label>
          <label className="mt-3 block text-sm font-medium text-slate-800">
            Nomenclatura / nombre
            <input
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2"
              value={editLabel}
              placeholder="Opcional — ej. Habitación UCI"
              onChange={(e) => setEditLabel(e.target.value)}
            />
          </label>
          {patchMut.isError ? (
            <p className="mt-3 text-sm text-rose-600">{(patchMut.error as Error)?.message || "Error"}</p>
          ) : null}
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="rounded-md px-3 py-1.5 text-sm text-slate-600" onClick={() => setEditBed(null)}>
              Cancelar
            </button>
            <button
              type="button"
              className="rounded-md bg-[var(--kira-primary,#7c3aed)] px-3 py-1.5 text-sm font-medium text-white"
              disabled={patchMut.isPending || !editCode.trim()}
              onClick={() => patchMut.mutate()}
            >
              Guardar
            </button>
          </div>
        </Modal>
      ) : null}

      {admitBed ? (
        <AdmitModal
          bed={admitBed}
          locationId={locationId}
          onClose={() => setAdmitBed(null)}
          onDone={async (stayId) => {
            await qc.invalidateQueries({ queryKey: ["vet-beds", locationId] });
            setAdmitBed(null);
            setDetailStayId(stayId);
          }}
        />
      ) : null}

      {detailStayId ? (
        <StayDetailModal
          stayId={detailStayId}
          canWrite={canAdmit}
          onClose={() => setDetailStayId(null)}
          onChanged={() => void qc.invalidateQueries({ queryKey: ["vet-beds", locationId] })}
          onDischarge={() => {
            if (window.confirm("¿Dar de alta / egresar a este paciente?")) {
              dischargeMut.mutate(detailStayId);
            }
          }}
        />
      ) : null}
    </div>
    </AppShell>
  );
}

function filterBeds(beds: Bed[], filter: "all" | "occupied" | "icu" | "free") {
  if (filter === "occupied") return beds.filter((b) => b.status === "occupied");
  if (filter === "free") return beds.filter((b) => b.status === "free");
  if (filter === "icu") {
    return beds.filter((b) => b.hospitalization?.care_level === "intensivos");
  }
  return beds;
}

function HallMap({
  beds,
  filter,
  canAdmit,
  isAdmin,
  busy,
  onAdmit,
  onOpen,
  onDischarge,
  onEdit,
}: {
  beds: Bed[];
  filter: "all" | "occupied" | "icu" | "free";
  canAdmit: boolean;
  isAdmin: boolean;
  busy: boolean;
  onAdmit: (bed: Bed) => void;
  onOpen: (bed: Bed) => void;
  onDischarge: (bed: Bed) => void;
  onEdit: (bed: Bed) => void;
}) {
  const visible = filterBeds(beds, filter);
  const icu = visible.filter((b) => b.hospitalization?.care_level === "intensivos");
  const wing = visible.filter((b) => b.hospitalization?.care_level !== "intensivos");

  const doorProps = {
    canAdmit,
    isAdmin,
    busy,
    onAdmit,
    onOpen,
    onDischarge,
    onEdit,
  };

  if (filter === "icu") {
    return (
      <HallWing
        title="Pasillo intensivos"
        tone="icu"
        beds={visible}
        {...doorProps}
      />
    );
  }

  return (
    <div className="space-y-4">
      {wing.length > 0 || filter === "all" ? (
        <HallWing title="Pasillo observación / delicado" tone="obs" beds={wing} {...doorProps} />
      ) : null}
      {(icu.length > 0 || filter === "all") && filter !== "free" ? (
        <HallWing title="Pasillo intensivos" tone="icu" beds={icu} {...doorProps} />
      ) : null}
      {visible.length === 0 ? (
        <p className="text-sm text-slate-500">Ninguna habitación con ese filtro.</p>
      ) : null}
    </div>
  );
}

function HallWing({
  title,
  tone,
  beds,
  canAdmit,
  isAdmin,
  busy,
  onAdmit,
  onOpen,
  onDischarge,
  onEdit,
}: {
  title: string;
  tone: "obs" | "icu";
  beds: Bed[];
  canAdmit: boolean;
  isAdmin: boolean;
  busy: boolean;
  onAdmit: (bed: Bed) => void;
  onOpen: (bed: Bed) => void;
  onDischarge: (bed: Bed) => void;
  onEdit: (bed: Bed) => void;
}) {
  if (beds.length === 0) return null;
  const shell =
    tone === "icu"
      ? "border-rose-200 bg-gradient-to-b from-rose-50 to-slate-50"
      : "border-violet-200 bg-gradient-to-b from-violet-50 to-slate-50";
  return (
    <section className={`rounded-2xl border p-4 ${shell}`}>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--kira-primary,#7c3aed)]">
        {title}
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {beds.map((bed) => (
          <HallDoor
            key={bed.id}
            bed={bed}
            canAdmit={canAdmit}
            isAdmin={isAdmin}
            busy={busy}
            onAdmit={() => onAdmit(bed)}
            onOpen={() => onOpen(bed)}
            onDischarge={() => onDischarge(bed)}
            onEdit={() => onEdit(bed)}
          />
        ))}
      </div>
    </section>
  );
}

function HallDoor({
  bed,
  canAdmit,
  isAdmin,
  busy,
  onAdmit,
  onOpen,
  onDischarge,
  onEdit,
}: {
  bed: Bed;
  canAdmit: boolean;
  isAdmin: boolean;
  busy: boolean;
  onAdmit: () => void;
  onOpen: () => void;
  onDischarge: () => void;
  onEdit: () => void;
}) {
  const occupied = bed.status === "occupied" && bed.hospitalization;
  const photo = occupied?.pet_photo_url || PET_PLACEHOLDER;
  const level = occupied ? careMeta(occupied.care_level) : null;
  const numBg =
    occupied?.care_level === "intensivos"
      ? "bg-rose-600"
      : occupied
        ? "bg-[var(--kira-primary,#7c3aed)]"
        : "bg-slate-400";

  return (
    <article
      className={`flex w-[9.5rem] shrink-0 flex-col overflow-hidden rounded-xl border-2 bg-white shadow-sm ${
        occupied
          ? occupied.care_level === "intensivos"
            ? "border-rose-300"
            : "border-violet-300"
          : "border-slate-200"
      }`}
    >
      <button
        type="button"
        className={`w-full py-1.5 text-center text-sm font-bold text-white ${numBg}`}
        onClick={() => (occupied ? onOpen() : canAdmit ? onAdmit() : undefined)}
      >
        {bed.code}
      </button>
      <button
        type="button"
        className="relative h-20 bg-violet-50 text-left"
        onClick={() => (occupied ? onOpen() : canAdmit ? onAdmit() : undefined)}
      >
        {occupied ? (
          <img src={photo} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="grid h-full place-items-center text-xs font-semibold text-slate-400">Libre</span>
        )}
      </button>
      <div className="flex flex-1 flex-col gap-1 p-2">
        {occupied ? (
          <>
            <p className="truncate text-sm font-semibold text-slate-900">{occupied.pet_name}</p>
            <span className={`inline-flex w-fit rounded-full px-1.5 py-0.5 text-[10px] font-medium ${level!.className}`}>
              {level!.label}
            </span>
          </>
        ) : (
          <span className="inline-flex w-fit rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">
            Libre
          </span>
        )}
        <div className="mt-auto flex flex-wrap gap-1 pt-1">
          {occupied ? (
            <button type="button" className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px]" onClick={onOpen}>
              Plan
            </button>
          ) : null}
          {occupied && canAdmit ? (
            <button
              type="button"
              disabled={busy}
              className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px]"
              onClick={onDischarge}
            >
              Egreso
            </button>
          ) : null}
          {!occupied && canAdmit ? (
            <button
              type="button"
              className="rounded bg-[var(--kira-primary,#7c3aed)] px-1.5 py-0.5 text-[10px] font-medium text-white"
              onClick={onAdmit}
            >
              Ingresar
            </button>
          ) : null}
          {isAdmin ? (
            <button type="button" className="rounded px-1.5 py-0.5 text-[10px] text-slate-500" onClick={onEdit}>
              Editar
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function OrdersEditor({
  orders,
  onChange,
  allowAdd = true,
}: {
  orders: CareOrder[];
  onChange: (next: CareOrder[]) => void;
  allowAdd?: boolean;
}) {
  return (
    <div className="space-y-3">
      {orders.map((order, idx) => (
        <div key={idx} className="rounded-lg border border-slate-200 p-3">
          <div className="flex items-start justify-between gap-2">
            <label className="block flex-1 text-xs font-medium text-slate-700">
              Medicamento / indicación
              <input
                className="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                value={order.name}
                placeholder="Ej. Acetaminofén"
                onChange={(e) => {
                  const next = [...orders];
                  next[idx] = { ...order, name: e.target.value };
                  onChange(next);
                }}
              />
            </label>
            {allowAdd && orders.length > 1 ? (
              <button
                type="button"
                className="mt-5 text-xs text-rose-600"
                onClick={() => onChange(orders.filter((_, i) => i !== idx))}
              >
                Quitar
              </button>
            ) : null}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="block text-xs text-slate-600">
              Cada (horas)
              <input
                type="number"
                min={0.5}
                step={0.5}
                className="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                value={order.interval_hours ?? ""}
                onChange={(e) => {
                  const next = [...orders];
                  const v = e.target.value === "" ? null : Number(e.target.value);
                  next[idx] = { ...order, interval_hours: v };
                  onChange(next);
                }}
              />
            </label>
            <label className="block text-xs text-slate-600">
              Dosis / vía
              <input
                className="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                value={order.dose_text ?? ""}
                placeholder="Ej. 10 mg/kg VO"
                onChange={(e) => {
                  const next = [...orders];
                  next[idx] = { ...order, dose_text: e.target.value };
                  onChange(next);
                }}
              />
            </label>
          </div>
          <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={order.fasting}
              onChange={(e) => {
                const next = [...orders];
                next[idx] = { ...order, fasting: e.target.checked };
                onChange(next);
              }}
            />
            Aplicar en ayunas
          </label>
        </div>
      ))}
      {allowAdd ? (
        <button
          type="button"
          className="text-sm font-medium text-fuchsia-700"
          onClick={() => onChange([...orders, emptyOrder()])}
        >
          + Agregar indicación
        </button>
      ) : null}
    </div>
  );
}

function AdmitModal({
  bed,
  locationId,
  onClose,
  onDone,
}: {
  bed: Bed;
  locationId: string;
  onClose: () => void;
  onDone: (stayId: string) => Promise<void>;
}) {
  const [q, setQ] = useState("");
  const [petId, setPetId] = useState("");
  const [notes, setNotes] = useState("");
  const [careLevel, setCareLevel] = useState<CareLevel>("observacion");
  const [orders, setOrders] = useState<CareOrder[]>([emptyOrder()]);
  const petsQ = useQuery({
    queryKey: ["pets-pick", q],
    queryFn: () => api<{ items: PetOption[] }>(`/pets?q=${encodeURIComponent(q)}&limit=30`),
  });
  const pets = petsQ.data?.items ?? [];
  const admitMut = useMutation({
    mutationFn: () =>
      api<{ id: string }>("/veterinary/hospitalizations", {
        method: "POST",
        body: {
          pet_id: petId,
          bed_id: bed.id,
          location_id: locationId,
          care_level: careLevel,
          notes: notes.trim() || null,
          orders: orders
            .filter((o) => o.name.trim())
            .map((o) => ({
              kind: o.kind,
              name: o.name.trim(),
              interval_hours: o.interval_hours,
              fasting: o.fasting,
              dose_text: o.dose_text?.trim() || null,
              notes: o.notes?.trim() || null,
            })),
        },
      }),
    onSuccess: (data) => void onDone(data.id),
  });

  return (
    <Modal title={`Ingreso · ${bed.code}`} onClose={onClose} wide>
      <p className="text-sm text-slate-600">
        Ingreso directo desde el mapa (también se podrá iniciar desde consulta). Si no existe la mascota,{" "}
        <Link to="/panel/mascotas" search={{ alta: true, from: "agenda" }} className="text-fuchsia-700 underline">
          creá dueño y mascota
        </Link>
        .
      </p>
      <label className="mt-3 block text-sm font-medium text-slate-800">
        Buscar mascota
        <input
          className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nombre…"
        />
      </label>
      <select
        className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
        value={petId}
        onChange={(e) => setPetId(e.target.value)}
      >
        <option value="">Seleccioná…</option>
        {pets.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {p.breed ? ` · ${p.breed}` : ""}
          </option>
        ))}
      </select>

      <fieldset className="mt-4 space-y-2">
        <legend className="text-sm font-medium text-slate-800">Nivel de cuidado</legend>
        {CARE_LEVELS.map((opt) => (
          <label
            key={opt.id}
            className={`flex cursor-pointer gap-3 rounded-lg border px-3 py-2 text-sm ${
              careLevel === opt.id ? "border-fuchsia-300 bg-fuchsia-50" : "border-slate-200"
            }`}
          >
            <input
              type="radio"
              name="care_level"
              checked={careLevel === opt.id}
              onChange={() => setCareLevel(opt.id)}
            />
            <span className="font-medium text-slate-900">{opt.label}</span>
          </label>
        ))}
      </fieldset>

      <div className="mt-4">
        <p className="mb-2 text-sm font-medium text-slate-800">Indicaciones médicas</p>
        <OrdersEditor orders={orders} onChange={setOrders} />
      </div>

      <label className="mt-3 block text-sm font-medium text-slate-800">
        Notas de ingreso
        <textarea
          className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      {admitMut.isError ? (
        <p className="mt-3 text-sm text-rose-600">{(admitMut.error as Error)?.message || "No se pudo ingresar."}</p>
      ) : null}
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className="rounded-md px-3 py-1.5 text-sm text-slate-600" onClick={onClose}>
          Cancelar
        </button>
        <button
          type="button"
          className="rounded-md bg-[var(--kira-primary,#7c3aed)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          disabled={!petId || admitMut.isPending}
          onClick={() => admitMut.mutate()}
        >
          Confirmar ingreso
        </button>
      </div>
    </Modal>
  );
}

function StayDetailModal({
  stayId,
  canWrite,
  onClose,
  onChanged,
  onDischarge,
}: {
  stayId: string;
  canWrite: boolean;
  onClose: () => void;
  onChanged: () => void;
  onDischarge: () => void;
}) {
  const qc = useQueryClient();
  const stayQ = useQuery({
    queryKey: ["vet-stay", stayId],
    queryFn: () => api<StayDetail>(`/veterinary/hospitalizations/${stayId}`),
  });
  const stay = stayQ.data;
  const [newOrder, setNewOrder] = useState<CareOrder>(emptyOrder());
  const levelMut = useMutation({
    mutationFn: (care_level: CareLevel) =>
      api(`/veterinary/hospitalizations/${stayId}/care-level`, {
        method: "PATCH",
        body: { care_level },
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["vet-stay", stayId] });
      onChanged();
    },
  });
  const addOrderMut = useMutation({
    mutationFn: () =>
      api(`/veterinary/hospitalizations/${stayId}/orders`, {
        method: "POST",
        body: {
          kind: newOrder.kind,
          name: newOrder.name.trim(),
          interval_hours: newOrder.interval_hours,
          fasting: newOrder.fasting,
          dose_text: newOrder.dose_text?.trim() || null,
        },
      }),
    onSuccess: async () => {
      setNewOrder(emptyOrder());
      await qc.invalidateQueries({ queryKey: ["vet-stay", stayId] });
      onChanged();
    },
  });

  return (
    <Modal
      title={stay ? `${stay.bed_code} · ${stay.pet_name ?? "Paciente"}` : "Plan de cuidados"}
      onClose={onClose}
      wide
    >
      {stayQ.isLoading || !stay ? (
        <p className="text-sm text-slate-500">Cargando…</p>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <img
              src={stay.pet_photo_url || PET_PLACEHOLDER}
              alt=""
              className="h-14 w-14 rounded-full object-cover"
            />
            <div>
              <p className="font-medium text-slate-900">{stay.pet_name}</p>
              <p className="text-xs text-slate-500">
                {[stay.pet_breed, stay.pet_species].filter(Boolean).join(" · ") || "—"}
              </p>
              <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${careMeta(stay.care_level).className}`}>
                {careMeta(stay.care_level).label}
              </span>
            </div>
          </div>

          {canWrite ? (
            <label className="mt-4 block text-sm font-medium text-slate-800">
              Cambiar nivel
              <select
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                value={stay.care_level}
                disabled={levelMut.isPending}
                onChange={(e) => levelMut.mutate(e.target.value as CareLevel)}
              >
                {CARE_LEVELS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="mt-4">
            <h3 className="text-sm font-semibold text-slate-900">Indicaciones</h3>
            {stay.orders.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Sin indicaciones cargadas aún.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {stay.orders.map((order) => (
                  <li key={order.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    <p className="font-medium text-slate-900">{order.name}</p>
                    <p className="text-slate-600">
                      {formatInterval(order.interval_hours)}
                      {order.dose_text ? ` · ${order.dose_text}` : ""}
                      {order.fasting ? " · en ayunas" : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {canWrite ? (
            <div className="mt-4 rounded-lg border border-dashed border-slate-300 p-3">
              <p className="mb-2 text-sm font-medium text-slate-800">Agregar indicación</p>
              <OrdersEditor
                orders={[newOrder]}
                allowAdd={false}
                onChange={(next) => setNewOrder(next[0] ?? emptyOrder())}
              />
              <button
                type="button"
                className="mt-2 rounded-md bg-[var(--kira-primary,#7c3aed)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                disabled={!newOrder.name.trim() || addOrderMut.isPending}
                onClick={() => addOrderMut.mutate()}
              >
                Guardar indicación
              </button>
              {addOrderMut.isError ? (
                <p className="mt-2 text-sm text-rose-600">{(addOrderMut.error as Error).message}</p>
              ) : null}
            </div>
          ) : null}

          {stay.notes ? <p className="mt-3 text-sm text-slate-600">Notas: {stay.notes}</p> : null}

          {stay.pet_id ? <StayEvents petId={stay.pet_id} /> : null}

          <div className="mt-5 flex justify-end gap-2">
            {canWrite ? (
              <button type="button" className="rounded-md border border-slate-200 px-3 py-1.5 text-sm" onClick={onDischarge}>
                Egreso
              </button>
            ) : null}
            <button type="button" className="rounded-md px-3 py-1.5 text-sm text-slate-600" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal
        className={`max-h-[90vh] w-full overflow-y-auto rounded-xl bg-white p-5 shadow-xl ${
          wide ? "max-w-xl" : "max-w-lg"
        }`}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button type="button" className="text-slate-500" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function StayEvents({ petId }: { petId: string }) {
  const eventsQ = useQuery({
    queryKey: ["vet-clinical-events", petId],
    queryFn: () =>
      api<{ items: { id: string; event_type: string; summary: string; occurred_at: string | null }[] }>(
        `/veterinary/pets/${petId}/clinical-events?limit=20`,
      ),
  });
  const items = eventsQ.data?.items ?? [];
  return (
    <div className="mt-4 rounded-lg border border-slate-100 p-3">
      <p className="text-sm font-medium text-slate-800">Eventos clínicos</p>
      {items.length === 0 ? (
        <p className="mt-1 text-xs text-slate-500">Sin eventos registrados aún.</p>
      ) : (
        <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-slate-600">
          {items.map((e) => (
            <li key={e.id}>
              <span className="font-medium text-slate-800">{e.event_type}</span> · {e.summary}
              {e.occurred_at
                ? ` · ${new Date(e.occurred_at).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })}`
                : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type RoundExtraRow = {
  key: string;
  inventory_item_id: string;
  name: string;
  qty_applied: string;
};

function HospRoundPanel({ locationId, canAct }: { locationId: string; canAct: boolean }) {
  const qc = useQueryClient();
  const boardQ = useQuery({
    queryKey: ["vet-hosp-board", locationId],
    enabled: Boolean(locationId),
    queryFn: () =>
      api<{
        items: {
          id: string;
          bed_code: string;
          pet_name: string | null;
          care_level: CareLevel;
          pending_tasks: number;
        }[];
      }>(`/veterinary/hosp-board?location_id=${locationId}`),
  });
  const inventoryQ = useQuery({
    queryKey: ["inventory", locationId, "veterinary-round"],
    enabled: Boolean(locationId) && canAct,
    queryFn: () =>
      api<
        {
          id: string;
          name: string;
          module?: string | null;
          category?: string | null;
          quantity: number;
        }[]
      >(`/inventory?location_id=${encodeURIComponent(locationId)}`),
  });
  const vetSkus = filterInventoryByModule(inventoryQ.data ?? [], "veterinary").filter(
    (x) => Number(x.quantity) > 0,
  );

  const [stayId, setStayId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [temperature, setTemperature] = useState("");
  const [mood, setMood] = useState("");
  const [note, setNote] = useState("");
  const [extras, setExtras] = useState<RoundExtraRow[]>([]);
  const [pickSkuId, setPickSkuId] = useState("");
  const [pickQty, setPickQty] = useState("1");
  const [freeName, setFreeName] = useState("");

  const sheetQ = useQuery({
    queryKey: ["vet-round", stayId],
    enabled: Boolean(stayId),
    queryFn: () =>
      api<{
        stay: {
          pet_name: string | null;
          bed_code: string;
          visit_allowed_now: boolean;
        };
        tasks: { id: string; order_name: string; overdue: boolean; due_at: string | null }[];
      }>(`/veterinary/hospitalizations/${stayId}/round`),
  });

  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const t of sheetQ.data?.tasks ?? []) next[t.id] = true;
    setSelected(next);
  }, [sheetQ.data?.tasks]);

  useEffect(() => {
    setExtras([]);
    setPickSkuId("");
    setPickQty("1");
    setFreeName("");
  }, [stayId]);

  const closeMut = useMutation({
    mutationFn: () =>
      api(`/veterinary/hospitalizations/${stayId}/round/close`, {
        method: "POST",
        body: {
          task_ids: Object.entries(selected)
            .filter(([, v]) => v)
            .map(([k]) => k),
          temperature_c: temperature.trim() === "" ? null : Number(temperature),
          mood: mood.trim() || null,
          note: note.trim() || null,
          extra_items: extras.map((e) => ({
            name: e.name,
            inventory_item_id: e.inventory_item_id || null,
            qty_applied: Number(e.qty_applied) || 1,
          })),
        },
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["vet-hosp-board", locationId] });
      await qc.invalidateQueries({ queryKey: ["vet-care-alerts", locationId] });
      await qc.invalidateQueries({ queryKey: ["vet-round", stayId] });
      await qc.invalidateQueries({ queryKey: ["inventory", locationId, "veterinary-round"] });
      setTemperature("");
      setMood("");
      setNote("");
      setExtras([]);
    },
  });

  const items = boardQ.data?.items ?? [];

  function addSkuExtra() {
    const sku = vetSkus.find((x) => x.id === pickSkuId);
    if (!sku) return;
    const qty = String(Math.max(0.01, Number(pickQty) || 1));
    setExtras((prev) => [
      ...prev,
      {
        key: `${sku.id}-${Date.now()}`,
        inventory_item_id: sku.id,
        name: sku.name,
        qty_applied: qty,
      },
    ]);
    setPickSkuId("");
    setPickQty("1");
  }

  function addFreeExtra() {
    const name = freeName.trim();
    if (!name) return;
    setExtras((prev) => [
      ...prev,
      {
        key: `free-${Date.now()}`,
        inventory_item_id: "",
        name,
        qty_applied: "1",
      },
    ]);
    setFreeName("");
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Pacientes activos</h2>
        <p className="text-xs text-slate-500">Elegí uno para marcar cuidados de la ronda.</p>
        {items.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No hay internados en esta sede.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {items.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className={`flex w-full items-center justify-between px-1 py-2 text-left text-sm ${
                    stayId === s.id ? "bg-violet-50" : ""
                  }`}
                  onClick={() => setStayId(s.id)}
                >
                  <span className="font-medium text-slate-900">
                    {s.bed_code} · {s.pet_name}
                  </span>
                  <span className="text-xs text-slate-500">{s.pending_tasks} pend.</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        {!stayId ? (
          <p className="text-sm text-slate-500">Seleccioná un paciente.</p>
        ) : sheetQ.isLoading ? (
          <p className="text-sm text-slate-500">Cargando ronda…</p>
        ) : (
          <>
            <h2 className="text-sm font-semibold text-slate-900">
              Ronda · {sheetQ.data?.stay.bed_code} · {sheetQ.data?.stay.pet_name}
            </h2>
            <p className="text-xs text-slate-500">
              Visita dueño ahora:{" "}
              {sheetQ.data?.stay.visit_allowed_now ? "permitida" : "fuera de horario"}
            </p>
            <ul className="mt-3 space-y-2">
              {(sheetQ.data?.tasks ?? []).map((t) => (
                <li key={t.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(selected[t.id])}
                    disabled={!canAct}
                    onChange={(e) => setSelected((prev) => ({ ...prev, [t.id]: e.target.checked }))}
                  />
                  <span>
                    {t.order_name}
                    {t.overdue ? <span className="text-rose-600"> · vencida</span> : null}
                  </span>
                </li>
              ))}
            </ul>
            {(sheetQ.data?.tasks ?? []).length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Sin tareas pendientes en la ventana.</p>
            ) : null}

            {canAct ? (
              <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50/80 p-3">
                <p className="text-xs font-semibold text-slate-800">Ítems / insumos de la ronda</p>
                <p className="text-[11px] text-slate-500">
                  Sumá SKUs clínicos (descuenta stock) o un ítem libre sin inventario.
                </p>
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <label className="min-w-[10rem] flex-1 text-xs text-slate-600">
                    Inventario clínico
                    <select
                      className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm"
                      value={pickSkuId}
                      onChange={(e) => setPickSkuId(e.target.value)}
                    >
                      <option value="">Elegir…</option>
                      {vetSkus.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} (disp. {s.quantity})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="w-20 text-xs text-slate-600">
                    Cant.
                    <input
                      className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm"
                      value={pickQty}
                      onChange={(e) => setPickQty(e.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-800 disabled:opacity-50"
                    disabled={!pickSkuId}
                    onClick={addSkuExtra}
                  >
                    Agregar
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <label className="min-w-[10rem] flex-1 text-xs text-slate-600">
                    Ítem libre (sin stock)
                    <input
                      className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm"
                      value={freeName}
                      onChange={(e) => setFreeName(e.target.value)}
                      placeholder="p. ej. cambio de vendaje"
                    />
                  </label>
                  <button
                    type="button"
                    className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-800 disabled:opacity-50"
                    disabled={!freeName.trim()}
                    onClick={addFreeExtra}
                  >
                    Agregar
                  </button>
                </div>
                {extras.length > 0 ? (
                  <ul className="mt-2 divide-y divide-slate-200 text-sm">
                    {extras.map((e) => (
                      <li key={e.key} className="flex items-center justify-between gap-2 py-1.5">
                        <span>
                          {e.name}
                          {e.inventory_item_id ? (
                            <span className="text-xs text-slate-500"> · stock × {e.qty_applied}</span>
                          ) : (
                            <span className="text-xs text-slate-500"> · libre</span>
                          )}
                        </span>
                        <button
                          type="button"
                          className="text-xs text-rose-600"
                          onClick={() => setExtras((prev) => prev.filter((x) => x.key !== e.key))}
                        >
                          Quitar
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {vetSkus.length === 0 && !inventoryQ.isLoading ? (
                  <p className="mt-2 text-[11px] text-amber-700">
                    No hay SKUs clínicos con stock. Cargá inventario módulo veterinaria.
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <label className="text-xs text-slate-600">
                Temperatura (°C)
                <input
                  className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                  disabled={!canAct}
                />
              </label>
              <label className="text-xs text-slate-600">
                Ánimo
                <input
                  className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                  value={mood}
                  onChange={(e) => setMood(e.target.value)}
                  placeholder="tranquilo, decaído…"
                  disabled={!canAct}
                />
              </label>
            </div>
            <label className="mt-2 block text-xs text-slate-600">
              Nota
              <textarea
                className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={!canAct}
              />
            </label>
            {canAct ? (
              <button
                type="button"
                className="mt-3 rounded-md bg-[var(--kira-primary,#7c3aed)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                disabled={closeMut.isPending}
                onClick={() => closeMut.mutate()}
              >
                Cerrar ronda y avisar al dueño
              </button>
            ) : null}
            {closeMut.isSuccess ? (
              <p className="mt-2 text-sm text-emerald-700">Ronda registrada.</p>
            ) : null}
            {closeMut.isError ? (
              <p className="mt-2 text-sm text-rose-600">{(closeMut.error as Error).message}</p>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}

export function VeterinaryHospTariffsPanel({ locationId }: { locationId: string }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("80000");
  const [mode, setMode] = useState<"per_day" | "checkinout" | "hourly_range">("per_day");
  const [careLevel, setCareLevel] = useState("any");
  const [paymentMethod, setPaymentMethod] = useState("efectivo");

  const tariffsQ = useQuery({
    queryKey: ["vet-tariffs", locationId],
    enabled: Boolean(locationId),
    queryFn: () =>
      api<{ items: { id: string; care_level: string; mode: string; amount: number; active: boolean }[] }>(
        `/veterinary/stay-tariffs?location_id=${locationId}`,
      ),
  });
  const chargesQ = useQuery({
    queryKey: ["vet-charges-pendiente", locationId],
    enabled: Boolean(locationId),
    queryFn: () =>
      api<{ items: { id: string; description: string; amount: number; pet_name: string }[] }>(
        `/veterinary/charges?status=pendiente&location_id=${locationId}`,
      ),
  });
  const visitQ = useQuery({
    queryKey: ["vet-visit-hours", locationId],
    enabled: Boolean(locationId),
    queryFn: () =>
      api<{ items: { id: string; weekday: number; start_time: string; end_time: string }[] }>(
        `/veterinary/visit-hours?location_id=${locationId}`,
      ),
  });

  const addTariff = useMutation({
    mutationFn: () =>
      api("/veterinary/stay-tariffs", {
        method: "POST",
        body: {
          location_id: locationId,
          care_level: careLevel,
          mode,
          amount: Number(amount) || 0,
          checkout_grace_hours: mode === "checkinout" ? 2 : null,
        },
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["vet-tariffs", locationId] });
    },
  });
  const delTariff = useMutation({
    mutationFn: (id: string) => api(`/veterinary/stay-tariffs/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["vet-tariffs", locationId] });
    },
  });
  const addVisit = useMutation({
    mutationFn: () =>
      api("/veterinary/visit-hours", {
        method: "POST",
        body: {
          location_id: locationId,
          weekday: new Date().getDay() === 0 ? 6 : new Date().getDay() - 1,
          start_time: "10:00",
          end_time: "12:00",
          active: true,
        },
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["vet-visit-hours", locationId] });
    },
  });
  const [selectedCharges, setSelectedCharges] = useState<Record<string, boolean>>({});
  const checkoutMut = useMutation({
    mutationFn: () =>
      api("/veterinary/checkout", {
        method: "POST",
        body: {
          location_id: locationId,
          payment_method: paymentMethod,
          charge_ids: Object.entries(selectedCharges)
            .filter(([, v]) => v)
            .map(([k]) => k),
        },
      }),
    onSuccess: async () => {
      setSelectedCharges({});
      await qc.invalidateQueries({ queryKey: ["vet-charges-pendiente", locationId] });
    },
  });

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Tarifas de estadía</h2>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="text-xs text-slate-600">
            Monto
            <input
              className="mt-1 block w-32 rounded-md border border-slate-200 px-2 py-1.5 text-sm"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <label className="text-xs text-slate-600">
            Modo
            <select
              className="mt-1 block rounded-md border border-slate-200 px-2 py-1.5 text-sm"
              value={mode}
              onChange={(e) => setMode(e.target.value as typeof mode)}
            >
              <option value="per_day">Por día</option>
              <option value="checkinout">Check-in / out</option>
              <option value="hourly_range">Rango horario</option>
            </select>
          </label>
          <label className="text-xs text-slate-600">
            Nivel
            <select
              className="mt-1 block rounded-md border border-slate-200 px-2 py-1.5 text-sm"
              value={careLevel}
              onChange={(e) => setCareLevel(e.target.value)}
            >
              <option value="any">Cualquiera</option>
              <option value="observacion">Observación</option>
              <option value="delicado">Delicado</option>
              <option value="intensivos">Intensivos</option>
            </select>
          </label>
          <button
            type="button"
            className="rounded-md bg-[var(--kira-primary,#7c3aed)] px-3 py-1.5 text-sm text-white"
            onClick={() => addTariff.mutate()}
          >
            Agregar
          </button>
        </div>
        <ul className="mt-3 divide-y divide-slate-100 text-sm">
          {(tariffsQ.data?.items ?? []).map((t) => (
            <li key={t.id} className="flex items-center justify-between py-2">
              <span>
                {t.mode} · {t.care_level} · ${t.amount.toLocaleString("es-CO")}
                {!t.active ? " (inactiva)" : ""}
              </span>
              {t.active ? (
                <button
                  type="button"
                  className="text-xs text-rose-600"
                  onClick={() => delTariff.mutate(t.id)}
                >
                  Desactivar
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Cargos pendientes / cobrar</h2>
        <p className="text-xs text-slate-500">
          Se generan al egreso. Cobro mixto con medio de pago del catálogo.
        </p>
        <label className="mt-2 block text-xs text-slate-600">
          Medio
          <input
            className="mt-1 w-40 rounded-md border border-slate-200 px-2 py-1.5 text-sm"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
          />
        </label>
        <ul className="mt-3 divide-y divide-slate-100 text-sm">
          {(chargesQ.data?.items ?? []).map((c) => (
            <li key={c.id} className="flex items-center gap-2 py-2">
              <input
                type="checkbox"
                checked={Boolean(selectedCharges[c.id])}
                onChange={(e) =>
                  setSelectedCharges((prev) => ({ ...prev, [c.id]: e.target.checked }))
                }
              />
              <span>
                {c.pet_name} · {c.description} · ${c.amount.toLocaleString("es-CO")}
              </span>
            </li>
          ))}
        </ul>
        {(chargesQ.data?.items ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Sin cargos pendientes.</p>
        ) : (
          <button
            type="button"
            className="mt-2 rounded-md bg-[var(--kira-primary,#7c3aed)] px-3 py-1.5 text-sm text-white disabled:opacity-50"
            disabled={checkoutMut.isPending}
            onClick={() => checkoutMut.mutate()}
          >
            Cobrar seleccionados
          </button>
        )}
        {checkoutMut.isError ? (
          <p className="mt-2 text-sm text-rose-600">{(checkoutMut.error as Error).message}</p>
        ) : null}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Horarios de visita</h2>
          <button
            type="button"
            className="text-xs text-[var(--kira-primary,#7c3aed)]"
            onClick={() => addVisit.mutate()}
          >
            + franja hoy 10–12
          </button>
        </div>
        <ul className="mt-2 text-sm text-slate-700">
          {(visitQ.data?.items ?? []).map((v) => (
            <li key={v.id}>
              día {v.weekday} · {v.start_time?.slice(0, 5)}–{v.end_time?.slice(0, 5)}
            </li>
          ))}
        </ul>
        {(visitQ.data?.items ?? []).length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">Sin franjas: las visitas no se restringen.</p>
        ) : null}
      </section>
    </div>
  );
}
