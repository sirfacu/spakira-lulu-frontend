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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  type FixedCostEntry,
} from "@/lib/spa-queries";
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
} from "lucide-react";
import { requirePathAccess } from "@/lib/route-access";
import { isActiveSale, permissionsFor } from "@/lib/roles";

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

const FIXED_CATEGORIES = [
  { id: "arriendo", label: "Arriendo" },
  { id: "agua", label: "Agua" },
  { id: "luz", label: "Luz" },
  { id: "internet", label: "Internet" },
  { id: "nomina", label: "Nómina" },
  { id: "otro", label: "Otro" },
] as const;

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

function Reportes() {
  const { user } = useRouteContext({ from: "/_authenticated" });
  const canFinance = permissionsFor(user?.role).canViewSalesAnalytics;
  const [tab, setTab] = useState("resumen");
  const [yearMonth, setYearMonth] = useState(currentYearMonth);

  const range = useMemo(() => monthStartEnd(yearMonth), [yearMonth]);

  return (
    <AppShell
      title="Reportes"
      subtitle="Margen de servicios, gastos fijos y resultado del mes — no confundir margen con utilidad neta"
    >
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
            Gastos fijos
          </TabsTrigger>
          <TabsTrigger value="mes" disabled={!canFinance}>
            Resultado del mes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="space-y-6">
          <ResumenTab canFinance={canFinance} />
        </TabsContent>
        <TabsContent value="margen" className="space-y-6">
          {canFinance ? <MargenTab dateFrom={range.from} dateTo={range.to} /> : null}
        </TabsContent>
        <TabsContent value="fijos" className="space-y-6">
          {canFinance ? <FijosTab yearMonth={yearMonth} /> : null}
        </TabsContent>
        <TabsContent value="mes" className="space-y-6">
          {canFinance ? <MesTab yearMonth={yearMonth} /> : null}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function ResumenTab({ canFinance }: { canFinance: boolean }) {
  const sales = useQuery({
    ...salesQuery,
    enabled: canFinance,
  });
  const appts = useQuery(appointmentsQuery);
  const pets = useQuery(petsQuery);
  const owners = useQuery(ownersQuery);

  const all = (sales.data ?? []).filter((s) => isActiveSale(s.status));
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

  const byService = new Map<string, number>();
  for (const a of appts.data ?? []) {
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
          value={(appts.data ?? []).length}
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

function MargenTab({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const q = useQuery(serviceMarginsQuery(dateFrom, dateTo));
  const s = q.data?.summary;

  return (
    <>
      <p className="text-xs text-muted-foreground">
        Margen de contribución por cita <strong className="font-medium text-foreground">finalizada</strong>
        : cobrado del servicio − costo de insumos (snapshot) − comisión del groomer (si el pago es % o
        mixto). No incluye arriendo ni luz.
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
          <StatCard
            icon={Wallet}
            label="Costo variable"
            value={cop(s.variable_cost)}
            tone="gold"
          />
          <StatCard
            icon={TrendingUp}
            label="Margen contribución"
            value={cop(s.contribution_margin)}
            tone="mint"
          />
          <StatCard
            icon={PiggyBank}
            label="% margen"
            value={s.margin_pct != null ? `${s.margin_pct}%` : "—"}
            tone="primary"
          />
        </div>
      ) : null}
      {s && s.missing_materials_snapshot > 0 ? (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          {s.missing_materials_snapshot} cita(s) sin snapshot de insumos (costo de productos en $0).
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
                <th className="py-2 pr-3 font-medium">Labor</th>
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
                <th className="py-2 pr-3 font-medium">Labor</th>
                <th className="py-2 font-medium">Margen</th>
              </tr>
            </thead>
            <tbody>
              {(q.data?.lines ?? []).map((line) => (
                <tr key={line.appointment_id} className="border-t border-border/60">
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
    </>
  );
}

function FijosTab({ yearMonth }: { yearMonth: string }) {
  const qc = useQueryClient();
  const q = useQuery(fixedCostsQuery(yearMonth));
  const [draft, setDraft] = useState({
    category: "otro",
    label: "",
    amount: "",
  });

  const saveMut = useMutation({
    mutationFn: async (entry: FixedCostEntry) =>
      updateFixedCostEntry(entry.id, {
        year_month: entry.year_month,
        category: entry.category,
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
        category: draft.category,
        label: draft.label.trim(),
        amount: Math.max(0, Number(draft.amount) || 0),
        notes: null,
      }),
    onSuccess: async () => {
      setDraft({ category: "otro", label: "", amount: "" });
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

  return (
    <>
      <p className="text-xs text-muted-foreground">
        Ledger del mes (agua, luz, arriendo…). Al abrir el mes se copian las plantillas; ajustá con
        el valor real de la factura. Estos montos <strong className="font-medium text-foreground">no</strong>{" "}
        se restan cita por cita: van al resultado del mes.
      </p>
      <StatCard icon={Wallet} label={`Gastos fijos ${yearMonth}`} value={cop(total)} tone="gold" />

      <SectionCard title="Entradas del mes">
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
            <p className="text-sm text-muted-foreground">Sin gastos en este mes.</p>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard title="Agregar gasto">
        <div className="grid gap-3 sm:grid-cols-[8rem_1fr_8rem_auto]">
          <Select
            value={draft.category}
            onValueChange={(v) => setDraft((d) => ({ ...d, category: v }))}
          >
            <SelectTrigger className="h-10 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FIXED_CATEGORIES.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            className="h-10 rounded-xl"
            placeholder="Descripción"
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
      <span className="w-20 shrink-0 text-xs uppercase text-muted-foreground">{entry.category}</span>
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

function MesTab({ yearMonth }: { yearMonth: string }) {
  const q = useQuery(monthFinanceQuery(yearMonth));
  const d = q.data;

  return (
    <>
      <p className="text-xs text-muted-foreground">
        Resultado operativo del mes = margen de citas + ventas de mostrador − gastos fijos. El
        prorrateo de fijos por cita es solo un indicador; no redefine el margen del servicio.
      </p>
      {q.isLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : null}
      {q.isError ? (
        <p className="text-sm text-destructive">
          {(q.error as Error)?.message || "No se pudo cargar el mes"}
        </p>
      ) : null}
      {d ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={TrendingUp}
              label="Margen citas"
              value={cop(d.service_margins.contribution_margin)}
              tone="mint"
            />
            <StatCard
              icon={DollarSign}
              label="Ventas mostrador"
              value={cop(d.sales.mostrador)}
              tone="accent"
            />
            <StatCard icon={Wallet} label="Gastos fijos" value={cop(d.fixed_costs.total)} tone="gold" />
            <StatCard
              icon={PiggyBank}
              label="Resultado operativo"
              value={cop(d.operating_result)}
              tone="primary"
            />
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
                <span className="font-medium tabular-nums">
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
