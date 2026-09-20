import { useMemo, useState } from "react";
import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { SectionCard, StatCard } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  salesQuery,
  appointmentsQuery,
  petsQuery,
  ownersQuery,
  serviceMarginsQuery,
  monthFinanceQuery,
  fixedCostsQuery,
  createFixedCostEntry,
  updateFixedCostEntry,
  deleteFixedCostEntry,
  appointmentCostDetailQuery,
  staffQuery,
  getLocations,
  type FixedCostEntry,
  type ServiceMarginLine,
} from "@/lib/spa-queries";
import { WorkingLocationBar } from "@/components/working-location-bar";
import { cop, dayKey, shortDate } from "@/lib/format";
import {
  DollarSign,
  Dog,
  Users,
  CalendarCheck,
  TrendingUp,
  Wallet,
  PiggyBank,
  Trash2,
  Plus,
  Scissors,
  Package,
} from "lucide-react";
import { requirePathAccess } from "@/lib/route-access";
import { isActiveSale, permissionsFor } from "@/lib/roles";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/panel/reportes")({
  beforeLoad: requirePathAccess("/panel/reportes"),
  head: () => ({
    meta: [
      { title: "Reportes | Spa Kira" },
      {
        name: "description",
        content:
          "Margen por servicios cerrados, gastos fijos del mes y resultado operativo de Spa Kira.",
      },
      { property: "og:title", content: "Reportes | Spa Kira" },
      {
        property: "og:description",
        content: "Finanzas: margen de contribución y costos fijos.",
      },
    ],
  }),
  component: Reportes,
});

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function currentYearMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthStartEnd(ym: string): { from: string; to: string } {
  const [ys, ms] = ym.split("-");
  const y = Number(ys);
  const m = Number(ms);
  const last = new Date(y, m, 0).getDate();
  return {
    from: `${ym}-01`,
    to: `${ym}-${String(last).padStart(2, "0")}`,
  };
}

const ALL_REPORTS = "todas";

function Reportes() {
  const { user } = useRouteContext({ from: "/_authenticated" });
  const canFinance = permissionsFor(user?.role).canViewSalesAnalytics;
  const [tab, setTab] = useState("resumen");
  const [yearMonth, setYearMonth] = useState(currentYearMonth);
  const [reportLocationId, setReportLocationId] = useState(ALL_REPORTS);
  const locationsQ = useQuery({ queryKey: ["locations"], queryFn: getLocations });
  const activeLocations = (locationsQ.data?.items ?? []).filter((x) => x.active);
  const scopedLocationId = reportLocationId === ALL_REPORTS ? null : reportLocationId;
  const selectedLocation =
    activeLocations.find((x) => x.id === reportLocationId) ?? activeLocations[0] ?? null;

  const range = useMemo(() => monthStartEnd(yearMonth), [yearMonth]);

  return (
    <AppShell
      title="Reportes"
      subtitle="Margen de servicios, gastos y resultado del mes — no confundir margen con utilidad neta"
    >
      {activeLocations.length ? (
        <WorkingLocationBar
          noun="Reportes"
          location={selectedLocation}
          locations={activeLocations}
          selectedId={reportLocationId}
          allOption={{ id: ALL_REPORTS, label: "Todas las sedes" }}
          onChange={setReportLocationId}
        />
      ) : null}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Mes</Label>
          <Input
            type="month"
            className="h-10 w-44 rounded-xl"
            value={yearMonth}
            onChange={(e) => setYearMonth(e.target.value || currentYearMonth())}
          />
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="margen" disabled={!canFinance}>
            Margen servicios
          </TabsTrigger>
          <TabsTrigger value="fijos" disabled={!canFinance}>
            Gastos
          </TabsTrigger>
          <TabsTrigger value="mes" disabled={!canFinance}>
            Resultado del mes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="space-y-6">
          <ResumenTab canFinance={canFinance} locationId={scopedLocationId} />
        </TabsContent>
        <TabsContent value="margen" className="space-y-6">
          {canFinance ? (
            <MargenTab
              dateFrom={range.from}
              dateTo={range.to}
              locationId={scopedLocationId}
            />
          ) : null}
        </TabsContent>
        <TabsContent value="fijos" className="space-y-6">
          {canFinance ? <FijosTab yearMonth={yearMonth} scoped={Boolean(scopedLocationId)} /> : null}
        </TabsContent>
        <TabsContent value="mes" className="space-y-6">
          {canFinance ? <MesTab yearMonth={yearMonth} locationId={scopedLocationId} /> : null}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function ResumenTab({
  canFinance,
  locationId,
}: {
  canFinance: boolean;
  locationId: string | null;
}) {
  const sales = useQuery({
    ...salesQuery,
    enabled: canFinance,
  });
  const appts = useQuery(appointmentsQuery);
  const pets = useQuery(petsQuery);
  const owners = useQuery(ownersQuery);

  const all = (sales.data ?? []).filter(
    (s) => isActiveSale(s.status) && (!locationId || s.location_id === locationId),
  );
  const trend = Array.from({ length: 14 }).map((_, idx) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - idx));
    const key = dayKey(d);
    return {
      day: shortDate(d.toISOString()),
      total: all
        .filter((s) => dayKey(new Date(s.sold_at)) === key)
        .reduce((a, s) => a + Number(s.total), 0),
    };
  });

  const scopedAppts = (appts.data ?? []).filter(
    (a) => !locationId || a.location_id === locationId,
  );
  const byService = new Map<string, number>();
  for (const a of scopedAppts) {
    const n = a.services?.name ?? "Otro";
    byService.set(n, (byService.get(n) ?? 0) + Number(a.price));
  }
  const pie = [...byService.entries()].map(([name, value]) => ({ name, value })).slice(0, 5);

  return (
    <>
      <p className="text-xs text-muted-foreground">
        Vista rápida de actividad. El <strong className="font-medium text-foreground">margen</strong>{" "}
        (cobrado − insumos − comisión del groomer) y los{" "}
        <strong className="font-medium text-foreground">gastos fijos del mes</strong> están en las
        otras pestañas.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={DollarSign}
          label="Ingresos ventas"
          value={canFinance ? cop(all.reduce((a, s) => a + Number(s.total), 0)) : "—"}
          tone="accent"
        />
        <StatCard
          icon={CalendarCheck}
          label="Citas registradas"
          value={scopedAppts.length}
          tone="primary"
        />
        <StatCard icon={Dog} label="Mascotas activas" value={(pets.data ?? []).length} tone="mint" />
        <StatCard icon={Users} label="Clientes" value={(owners.data ?? []).length} tone="gold" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <SectionCard title="Tendencia de ingresos (14 días)">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => cop(Number(v))} />
                <Line type="monotone" dataKey="total" stroke="var(--primary)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
        <SectionCard title="Ingresos por servicio (agenda)">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pie} dataKey="value" nameKey="name" outerRadius={80} label>
                  {pie.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => cop(Number(v))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>
    </>
  );
}

function MargenTab({
  dateFrom,
  dateTo,
  locationId,
}: {
  dateFrom: string;
  dateTo: string;
  locationId: string | null;
}) {
  const q = useQuery(serviceMarginsQuery(dateFrom, dateTo, locationId));
  const s = q.data?.summary;
  const [selected, setSelected] = useState<ServiceMarginLine | null>(null);

  return (
    <>
      <p className="text-xs text-muted-foreground">
        Por cada cita finalizada: lo cobrado menos insumos y menos la comisión del groomer (si su
        pago es % o mixto en Personal). Tocá una fila del detalle para ver el desglose. Arriendo y
        luz van en Gastos fijos, no acá.
      </p>
      {q.isLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : null}
      {q.isError ? (
        <p className="text-sm text-destructive">
          {(q.error as Error)?.message || "No se pudo cargar el margen"}
        </p>
      ) : null}
      {s ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={DollarSign} label="Cobrado servicios" value={cop(s.revenue)} tone="accent" />
          <StatCard icon={Wallet} label="Insumos" value={cop(s.materials_cost)} tone="gold" />
          <StatCard
            icon={Scissors}
            label="Costo groomer"
            value={cop(s.labor_cost)}
            tone="primary"
          />
          <StatCard
            icon={TrendingUp}
            label="Margen contribución"
            value={cop(s.contribution_margin)}
            tone="mint"
          />
        </div>
      ) : null}
      {s && s.missing_materials_snapshot > 0 ? (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          {s.missing_materials_snapshot} cita(s) sin snapshot de insumos (costo de productos en $0).
        </p>
      ) : null}
      {s && s.labor_cost === 0 && s.appointments > 0 ? (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Costo groomer en $0: en Personal el staff debe tener pago <strong>porcentaje</strong> o{" "}
          <strong>mixto</strong> con % de comisión. Si es sueldo fijo, cargalo en Gastos fijos como
          nómina.
        </p>
      ) : null}

      <SectionCard title="Por tipo de servicio">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="py-2 pr-3 font-medium">Servicio</th>
                <th className="py-2 pr-3 font-medium">Citas</th>
                <th className="py-2 pr-3 font-medium">Cobrado</th>
                <th className="py-2 pr-3 font-medium">Insumos</th>
                <th className="py-2 pr-3 font-medium">Groomer</th>
                <th className="py-2 font-medium">Margen</th>
              </tr>
            </thead>
            <tbody>
              {(q.data?.by_service ?? []).map((row) => (
                <tr key={row.service_id ?? row.service_name} className="border-t border-border/60">
                  <td className="py-2 pr-3">{row.service_name}</td>
                  <td className="py-2 pr-3 tabular-nums">{row.count}</td>
                  <td className="py-2 pr-3 tabular-nums">{cop(row.revenue)}</td>
                  <td className="py-2 pr-3 tabular-nums">{cop(row.materials_cost)}</td>
                  <td className="py-2 pr-3 tabular-nums">{cop(row.labor_cost)}</td>
                  <td className="py-2 tabular-nums font-medium">{cop(row.contribution_margin)}</td>
                </tr>
              ))}
              {!q.data?.by_service?.length ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-muted-foreground">
                    Sin citas finalizadas en este mes.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Detalle por cita">
        <p className="mb-2 text-xs text-muted-foreground">Clic en una fila para ver el desglose.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="py-2 pr-3 font-medium">Cierre</th>
                <th className="py-2 pr-3 font-medium">Servicio</th>
                <th className="py-2 pr-3 font-medium">Mascota</th>
                <th className="py-2 pr-3 font-medium">Groomer</th>
                <th className="py-2 pr-3 font-medium">Cobrado</th>
                <th className="py-2 pr-3 font-medium">Insumos</th>
                <th className="py-2 pr-3 font-medium">Costo groomer</th>
                <th className="py-2 pr-3 font-medium">Adicionales</th>
                <th className="py-2 pr-3 font-medium">Margen adic.</th>
                <th className="py-2 font-medium">Margen</th>
              </tr>
            </thead>
            <tbody>
              {(q.data?.lines ?? []).map((line) => (
                <tr
                  key={line.appointment_id}
                  className={cn(
                    "cursor-pointer border-t border-border/60 transition-colors hover:bg-muted/50",
                    selected?.appointment_id === line.appointment_id && "bg-muted/40",
                  )}
                  onClick={() => setSelected(line)}
                >
                  <td className="py-2 pr-3 whitespace-nowrap text-xs text-muted-foreground">
                    {line.closed_at ? shortDate(line.closed_at) : "—"}
                  </td>
                  <td className="py-2 pr-3">{line.service_name}</td>
                  <td className="py-2 pr-3">{line.pet_name ?? "—"}</td>
                  <td className="py-2 pr-3">{line.staff_name ?? "—"}</td>
                  <td className="py-2 pr-3 tabular-nums">{cop(line.revenue)}</td>
                  <td className="py-2 pr-3 tabular-nums">
                    {line.has_materials_snapshot ? cop(line.materials_cost) : "—"}
                  </td>
                  <td className="py-2 pr-3 tabular-nums">{cop(line.labor_cost)}</td>
                  <td className="py-2 pr-3 tabular-nums">
                    {line.extras_revenue ? cop(line.extras_revenue) : "—"}
                  </td>
                  <td className="py-2 pr-3 tabular-nums">
                    {line.extras_revenue ? cop(line.extras_margin ?? 0) : "—"}
                  </td>
                  <td className="py-2 tabular-nums font-medium">
                    {cop(line.contribution_margin)}
                    {line.margin_pct != null ? (
                      <span className="ml-1 text-xs text-muted-foreground">({line.margin_pct}%)</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <AppointmentCostDialog
        line={selected}
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </>
  );
}

function AppointmentCostDialog({
  line,
  open,
  onOpenChange,
}: {
  line: ServiceMarginLine | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const detail = useQuery({
    ...appointmentCostDetailQuery(line?.appointment_id ?? null),
    retry: 1,
  });
  const d = detail.data;
  const waiting = detail.isPending || (detail.isFetching && !d && !detail.isError);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>Desglose de la cita</DialogTitle>
        </DialogHeader>
        {!line ? null : waiting ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : detail.isError ? (
          <p className="text-sm text-destructive">
            {(detail.error as Error)?.message || "No se pudo cargar el desglose"}
          </p>
        ) : d ? (
          <div className="space-y-4 text-sm">
            <div className="space-y-1 text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">{d.service_name}</span>
                {d.pet_name ? ` · ${d.pet_name}` : ""}
              </p>
              <p>
                Groomer: {d.staff_name ?? "—"}
                {d.closed_at ? ` · cierre ${shortDate(d.closed_at)}` : ""}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-border/70 px-3 py-2">
                <p className="text-xs text-muted-foreground">Cobrado</p>
                <p className="tabular-nums font-medium">{cop(d.revenue)}</p>
              </div>
              <div className="rounded-xl border border-border/70 px-3 py-2">
                <p className="text-xs text-muted-foreground">Margen</p>
                <p className="tabular-nums font-medium">{cop(d.contribution_margin)}</p>
              </div>
            </div>

            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Insumos
              </h4>
              {d.materials.length ? (
                <ul className="divide-y divide-border/60 rounded-xl border border-border/70">
                  {d.materials.map((m, idx) => (
                    <li
                      key={`${m.material_role}-${m.inventory_item_id ?? idx}`}
                      className="flex items-start justify-between gap-3 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="font-medium leading-snug">{m.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {m.quantity} {m.quantity_unit} · {cop(m.unit_cost)}/{m.quantity_unit}
                        </p>
                      </div>
                      <p className="shrink-0 tabular-nums">{cop(m.line_cost)}</p>
                    </li>
                  ))}
                  <li className="flex justify-between px-3 py-2 text-xs font-medium">
                    <span>Total insumos</span>
                    <span className="tabular-nums">{cop(d.materials_cost)}</span>
                  </li>
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">Sin snapshot de insumos en esta cita.</p>
              )}
            </div>

            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Costo groomer
              </h4>
              <div className="rounded-xl border border-border/70 px-3 py-2">
                <div className="flex justify-between gap-3">
                  <span>Comisión · {d.groomer.staff_name ?? "sin asignar"}</span>
                  <span className="tabular-nums font-medium">{cop(d.groomer.labor_cost)}</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{d.groomer.note}</p>
              </div>
            </div>

            {(d.extras ?? []).length ? (
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Adicionales (mostrador)
                </h4>
                <ul className="divide-y divide-border/60 rounded-xl border border-border/70">
                  {d.extras!.map((ex, idx) => (
                    <li key={`${ex.label}-${idx}`} className="flex justify-between gap-3 px-3 py-2">
                      <div className="min-w-0">
                        <p className="font-medium leading-snug">{ex.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {cop(ex.revenue)} cobrado · costo {cop(ex.cost)}
                        </p>
                      </div>
                      <p className="shrink-0 tabular-nums">{cop(ex.margin)}</p>
                    </li>
                  ))}
                  <li className="flex justify-between px-3 py-2 text-xs font-medium">
                    <span>Margen adicionales</span>
                    <span className="tabular-nums">{cop(d.extras_margin ?? 0)}</span>
                  </li>
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Sin datos para esta cita.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function FijosTab({ yearMonth, scoped }: { yearMonth: string; scoped: boolean }) {
  const qc = useQueryClient();
  const q = useQuery(fixedCostsQuery(yearMonth));
  const staffQ = useQuery(staffQuery);
  const [draft, setDraft] = useState({ label: "", amount: "" });

  const saveMut = useMutation({
    mutationFn: async (entry: FixedCostEntry) =>
      updateFixedCostEntry(entry.id, {
        year_month: entry.year_month,
        category: entry.category || "otro",
        label: entry.label,
        amount: entry.amount,
        notes: entry.notes ?? null,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["finance-fixed-costs", yearMonth] });
      await qc.invalidateQueries({ queryKey: ["finance-month", yearMonth] });
      toast.success("Gasto actualizado");
    },
    onError: (e: Error) => toast.error(e.message || "No se pudo guardar"),
  });

  const createMut = useMutation({
    mutationFn: () =>
      createFixedCostEntry({
        year_month: yearMonth,
        category: "otro",
        label: draft.label.trim(),
        amount: Math.max(0, Number(draft.amount) || 0),
        notes: null,
      }),
    onSuccess: async () => {
      setDraft({ label: "", amount: "" });
      await qc.invalidateQueries({ queryKey: ["finance-fixed-costs", yearMonth] });
      await qc.invalidateQueries({ queryKey: ["finance-month", yearMonth] });
      toast.success("Gasto agregado");
    },
    onError: (e: Error) => toast.error(e.message || "No se pudo crear"),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => deleteFixedCostEntry(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["finance-fixed-costs", yearMonth] });
      await qc.invalidateQueries({ queryKey: ["finance-month", yearMonth] });
      toast.success("Eliminado");
    },
    onError: (e: Error) => toast.error(e.message || "No se pudo eliminar"),
  });

  const total = (q.data ?? []).reduce((a, e) => a + Number(e.amount || 0), 0);
  const hasNomina = (q.data ?? []).some((e) => {
    if (e.category === "nomina") return true;
    return /n[oó]mina|sueldo|payroll/i.test(`${e.category} ${e.label}`);
  });
  const staffOnPayroll = (staffQ.data ?? []).some(
    (s) => s.payment_mode === "fijo" || s.payment_mode === "mixto",
  );

  return (
    <>
      <p className="text-xs text-muted-foreground">
        Nombre y monto de los gastos del mes. El total entra en Resultado del mes
        {scoped ? " solo en la vista Todas las sedes" : ""}.
      </p>
      {scoped ? (
        <p className="rounded-2xl border border-border bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
          Los gastos fijos no se parten por sede: arriendo y servicios son de toda la instalación.
        </p>
      ) : null}
      {hasNomina && staffOnPayroll ? (
        <p className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          Hay una línea <strong>Nómina</strong> y también gente en Personal con pago fijo o mixto.
          El sueldo de esa gente ya se liquida en Personal: Nómina acá es solo quien no tiene ficha.
        </p>
      ) : null}
      <StatCard icon={Wallet} label={`Total gastos ${yearMonth}`} value={cop(total)} tone="gold" />

      <SectionCard title="Gastos del mes">
        <div className="space-y-3">
          {(q.data ?? []).map((entry) => (
            <FixedCostRow
              key={entry.id}
              entry={entry}
              onSave={(next) => saveMut.mutate(next)}
              onDelete={() => delMut.mutate(entry.id)}
              busy={saveMut.isPending || delMut.isPending}
            />
          ))}
          {!q.data?.length && !q.isLoading ? (
            <p className="text-sm text-muted-foreground">Todavía no hay gastos en este mes.</p>
          ) : null}
        </div>

        <div className="mt-4 grid gap-3 border-t border-border/60 pt-4 sm:grid-cols-[1fr_8rem_auto]">
          <Input
            className="h-10 rounded-xl"
            placeholder="Nombre (ej. Arriendo local)"
            value={draft.label}
            onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
          />
          <Input
            className="h-10 rounded-xl"
            type="number"
            min={0}
            placeholder="Monto"
            value={draft.amount}
            onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
          />
          <Button
            type="button"
            className="h-10 rounded-xl"
            disabled={!draft.label.trim() || createMut.isPending}
            onClick={() => createMut.mutate()}
          >
            <Plus className="mr-1 h-4 w-4" />
            Agregar
          </Button>
        </div>
      </SectionCard>
    </>
  );
}

function FixedCostRow({
  entry,
  onSave,
  onDelete,
  busy,
}: {
  entry: FixedCostEntry;
  onSave: (e: FixedCostEntry) => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const [amount, setAmount] = useState(String(entry.amount));
  const [label, setLabel] = useState(entry.label);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 px-3 py-2">
      <Input
        className="h-9 min-w-[10rem] flex-1 rounded-lg"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={() => {
          if (label.trim() && label !== entry.label) {
            onSave({ ...entry, label: label.trim() });
          }
        }}
      />
      <Input
        className="h-9 w-28 rounded-lg tabular-nums"
        type="number"
        min={0}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        onBlur={() => {
          const n = Math.max(0, Number(amount) || 0);
          if (n !== entry.amount) onSave({ ...entry, amount: n });
        }}
      />
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-9 w-9 text-destructive"
        disabled={busy}
        title="Eliminar"
        onClick={onDelete}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

const FIXED_CATEGORY_LABEL: Record<string, string> = {
  arriendo: "Arriendo",
  agua: "Agua",
  luz: "Luz / energía",
  internet: "Internet",
  nomina: "Nómina (quien no está en Staff)",
  otro: "Otros / día a día",
};

function prettyFijoLabel(e: { category: string; label: string }) {
  const cat = FIXED_CATEGORY_LABEL[e.category];
  if (e.category && e.category !== "otro" && cat) {
    const raw = e.label.trim().toLowerCase();
    if (raw === e.category || raw === cat.toLowerCase()) return cat;
    return `${cat} · ${e.label}`;
  }
  const label = e.label.trim();
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : label;
}

function PnlLine({
  label,
  amount,
  kind = "plain",
  indent = false,
}: {
  label: string;
  amount: number;
  kind?: "plain" | "cost" | "total";
  indent?: boolean;
}) {
  const cost = kind === "cost";
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-3 py-1.5 text-sm",
        kind === "total" && "border-t border-border/70 pt-2 font-medium",
        indent && "pl-3 text-xs text-muted-foreground",
      )}
    >
      <span className={kind === "total" ? "text-foreground" : undefined}>{label}</span>
      <span
        className={cn(
          "tabular-nums",
          cost && !indent && "text-destructive",
          kind === "total" && "font-display text-base font-bold text-foreground",
        )}
      >
        {cost ? `− ${cop(Math.abs(amount))}` : cop(amount)}
      </span>
    </div>
  );
}

function MesTab({ yearMonth, locationId }: { yearMonth: string; locationId: string | null }) {
  const q = useQuery(monthFinanceQuery(yearMonth, locationId));
  const d = q.data;
  const sm = d?.service_margins;
  const costs = d?.cost_breakdown;
  const includeFixed = !locationId && d?.fixed_costs.included_in_operating !== false;
  const insumos = costs?.insumos ?? sm?.materials_cost ?? 0;
  const profesionales = costs?.profesionales ?? sm?.labor_cost ?? 0;
  const fijos = includeFixed ? (costs?.fijos ?? d?.fixed_costs.total ?? 0) : 0;
  const extrasCost = costs?.adicionales_cost ?? sm?.extras_cost ?? 0;
  const extrasRev = sm?.extras_revenue ?? 0;
  const extrasMargin = sm?.extras_margin ?? 0;

  const pie = [
    { name: "Insumos", value: insumos, fill: "var(--chart-1)" },
    { name: "Profesionales", value: profesionales, fill: "var(--chart-2)" },
    { name: "Gastos fijos", value: fijos, fill: "var(--chart-3)" },
  ].filter((s) => s.value > 0);
  const pieTotal = pie.reduce((a, s) => a + s.value, 0);

  const fijoLines = [...(d?.fixed_costs.entries ?? [])]
    .map((e) => ({
      id: e.id,
      label: prettyFijoLabel(e),
      amount: Number(e.amount || 0),
    }))
    .sort((a, b) => b.amount - a.amount);

  return (
    <>
      <p className="text-xs text-muted-foreground">
        Cómo cierra el mes: cobrado en servicios − insumos − comisión de groomer = margen de citas.
        Luego extras de vitrina, mostrador y gastos fijos (arriendo, día a día, servicios). El
        prorrateo de fijos por cita es solo un indicador.
      </p>
      {locationId ? (
        <p className="rounded-2xl border border-border bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
          {d?.indicators.note ||
            "Vista de una sede: el resultado no resta arriendo ni servicios (son de toda la instalación)."}
        </p>
      ) : null}
      {q.isLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : null}
      {q.isError ? (
        <p className="text-sm text-destructive">
          {(q.error as Error)?.message || "No se pudo cargar el mes"}
        </p>
      ) : null}
      {d && sm ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={Package}
              label="Insumos"
              value={cop(insumos)}
              hint="Shampoo, acond., accesorios de la cita"
              tone="gold"
            />
            <StatCard
              icon={Scissors}
              label="Profesionales"
              value={cop(profesionales)}
              hint="Comisión groomer / mixto"
              tone="primary"
            />
            <StatCard
              icon={Wallet}
              label="Gastos fijos"
              value={cop(fijos)}
              hint={
                includeFixed
                  ? "Arriendo, servicios, conductor, día a día"
                  : "De toda la instalación; no se restan acá"
              }
              tone="accent"
            />
            <StatCard
              icon={PiggyBank}
              label="Resultado operativo"
              value={cop(d.operating_result)}
              tone="mint"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
            <SectionCard title="Composición de costos">
              {pie.length ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pie}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={52}
                        outerRadius={84}
                        paddingAngle={2}
                      >
                        {pie.map((s) => (
                          <Cell key={s.name} fill={s.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v, name) => {
                          const n = Number(v);
                          const pct = pieTotal > 0 ? Math.round((n / pieTotal) * 100) : 0;
                          return [`${cop(n)} (${pct}%)`, String(name)];
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Todavía no hay costos en este mes.</p>
              )}
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {pie.map((s) => (
                  <li key={s.name} className="flex justify-between gap-2">
                    <span>{s.name}</span>
                    <span className="tabular-nums text-foreground">{cop(s.value)}</span>
                  </li>
                ))}
              </ul>
              {fijoLines.length ? (
                <div className="mt-4 border-t border-border/60 pt-3">
                  <p className="mb-2 text-xs font-medium text-foreground">Desglose de gastos fijos</p>
                  <ul className="space-y-2">
                    {fijoLines.map((ln) => {
                      const pct = fijos > 0 ? Math.round((ln.amount / fijos) * 100) : 0;
                      return (
                        <li key={ln.id}>
                          <div className="flex justify-between gap-2 text-xs">
                            <span className="truncate text-muted-foreground">{ln.label}</span>
                            <span className="shrink-0 tabular-nums text-foreground">
                              {cop(ln.amount)}
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-[var(--chart-3)]"
                              style={{ width: `${Math.min(100, Math.max(pct, pct > 0 ? 4 : 0))}%` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </SectionCard>

            <SectionCard title="Cuenta del mes">
              <PnlLine label="Cobrado en servicios" amount={sm.revenue} />
              <PnlLine label="Insumos" amount={insumos} kind="cost" />
              <PnlLine label="Profesionales (groomer)" amount={profesionales} kind="cost" />
              <PnlLine label="Margen de citas" amount={sm.contribution_margin} kind="total" />
              {extrasRev > 0 ? (
                <>
                  <PnlLine label="Adicionales cobrados" amount={extrasRev} />
                  <PnlLine label="Costo de compra (adicionales)" amount={extrasCost} kind="cost" />
                  <PnlLine label="Margen adicionales" amount={extrasMargin} />
                  {extrasCost === 0 ? (
                    <p className="pl-3 text-[11px] text-muted-foreground">
                      Sin costo de compra: el extra no está ligado a un ítem de inventario, o el
                      precio de compra está en 0.
                    </p>
                  ) : null}
                </>
              ) : null}
              <PnlLine label="Ventas de mostrador" amount={d.sales.mostrador} />
              {(d.sales.mostrador_cost ?? 0) > 0 || d.sales.mostrador > 0 ? (
                <PnlLine
                  label="Costo de compra (mostrador)"
                  amount={d.sales.mostrador_cost ?? 0}
                  kind="cost"
                  indent
                />
              ) : null}
              <PnlLine label="Gastos fijos" amount={fijos} kind="cost" />
              {fijoLines.map((ln) => (
                <PnlLine key={ln.id} label={ln.label} amount={ln.amount} kind="cost" indent />
              ))}
              <PnlLine label="Resultado operativo" amount={d.operating_result} kind="total" />
            </SectionCard>
          </div>

          <SectionCard title="Indicadores (informativos)">
            <ul className="space-y-2 text-sm">
              <li>
                Margen medio por cita:{" "}
                <span className="font-medium tabular-nums">
                  {cop(d.indicators.avg_contribution_margin)}
                </span>
              </li>
              <li>
                Citas para cubrir fijos (break-even):{" "}
                <span className="font-medium tabular-nums">
                  {d.indicators.breakeven_appointments ?? "—"}
                </span>
              </li>
              <li>
                Prorrateo fijos / cita:{" "}
                <span className="tabular-nums font-medium">
                  {d.indicators.proration_fixed_per_appointment != null
                    ? cop(d.indicators.proration_fixed_per_appointment)
                    : "—"}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {d.indicators.note}
                </span>
              </li>
            </ul>
          </SectionCard>
        </>
      ) : null}
    </>
  );
}
