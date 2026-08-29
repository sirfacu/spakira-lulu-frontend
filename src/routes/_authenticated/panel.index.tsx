import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  DollarSign,
  Dog,
  CalendarCheck,
  PackageX,
  Clock3,
  UserCheck,
  ArrowUpRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { AppShell } from "@/components/app-shell";
import { StatCard, SectionCard, StatusPill, Empty } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import {
  appointmentsQuery,
  inventoryQuery,
  salesQuery,
  staffQuery,
} from "@/lib/spa-queries";
import { resolveMediaUrl } from "@/lib/api";
import { cop, dayKey, shortDate, statusMeta, time, initials } from "@/lib/format";
import { requirePathAccess } from "@/lib/route-access";
import { isActiveSale } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/panel/")({
  beforeLoad: requirePathAccess("/panel"),
  head: () => ({
    meta: [
      { title: "Dashboard | Spa Kira" },
      {
        name: "description",
        content:
          "Indicadores del día en Spa Kira: ventas, mascotas atendidas, citas agendadas e inventario bajo.",
      },
      { property: "og:title", content: "Dashboard | Spa Kira" },
      { property: "og:description", content: "Resumen operativo diario del spa canino y felino." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const appts = useQuery(appointmentsQuery);
  const sales = useQuery(salesQuery);
  const inv = useQuery(inventoryQuery);
  const staff = useQuery(staffQuery);

  const today = dayKey(new Date());
  const todayAppts = (appts.data ?? []).filter((a) => dayKey(new Date(a.starts_at)) === today);
  const todaySales = (sales.data ?? []).filter(
    (s) => isActiveSale(s.status) && dayKey(new Date(s.sold_at)) === today,
  );
  const lowStock = (inv.data ?? []).filter((i) => i.quantity <= i.min_stock);
  const activeStaff = (staff.data ?? []).filter((s) => s.active);
  const upcoming = (appts.data ?? [])
    .filter((a) => new Date(a.starts_at) >= new Date() && a.status !== "cancelada")
    .slice(0, 6);

  const salesByDay = Array.from({ length: 7 }).map((_, idx) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - idx));
    const key = dayKey(d);
    const total = (sales.data ?? [])
      .filter((s) => isActiveSale(s.status) && dayKey(new Date(s.sold_at)) === key)
      .reduce((acc, s) => acc + Number(s.total), 0);
    return { day: shortDate(d.toISOString()), total };
  });

  const serviceCounts = new Map<string, number>();
  for (const a of appts.data ?? []) {
    const name = a.services?.name ?? "Otro";
    serviceCounts.set(name, (serviceCounts.get(name) ?? 0) + 1);
  }
  const topServices = [...serviceCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const chartColors = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
  ];

  const monthDays = (() => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const pad = (first.getDay() + 6) % 7;
    return { pad, days, now };
  })();

  const busyDays = new Set(
    (appts.data ?? []).map((a) => new Date(a.starts_at).getDate().toString()),
  );

  return (
    <AppShell
      title="Dashboard"
      subtitle="Resumen del día en Spa Kira"
      actions={
        <Button asChild className="hidden rounded-xl sm:inline-flex">
          <Link to="/panel/agenda">Ver agenda</Link>
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          icon={DollarSign}
          label="Ventas del día"
          value={cop(todaySales.reduce((a, s) => a + Number(s.total), 0))}
          hint={`${todaySales.length} transacciones`}
          tone="accent"
        />
        <StatCard
          icon={Dog}
          label="Mascotas atendidas"
          value={todayAppts.filter((a) => a.status === "finalizada").length}
          hint="Servicios finalizados hoy"
          tone="primary"
        />
        <StatCard
          icon={CalendarCheck}
          label="Servicios agendados hoy"
          value={todayAppts.length}
          hint={`${todayAppts.filter((a) => a.status === "pendiente").length} agendados`}
          tone="sky"
        />
        <StatCard
          icon={PackageX}
          label="Inventario con stock bajo"
          value={lowStock.length}
          hint={lowStock.slice(0, 2).map((i) => i.name).join(", ") || "Todo en orden"}
          tone="gold"
        />
        <StatCard
          icon={Clock3}
          label="Próximas citas"
          value={upcoming.length}
          hint="Confirmadas y pendientes"
          tone="mint"
        />
        <StatCard
          icon={UserCheck}
          label="Staff disponible"
          value={`${activeStaff.length} / ${(staff.data ?? []).length}`}
          hint={activeStaff.slice(0, 2).map((s) => s.full_name.split(" ")[0]).join(", ")}
          tone="primary"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <SectionCard title="Ventas por día (últimos 7 días)">
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesByDay} margin={{ left: -12, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 6" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                  stroke="var(--muted-foreground)"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  stroke="var(--muted-foreground)"
                  tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
                />
                <Tooltip
                  formatter={(v) => cop(Number(v))}
                  contentStyle={{
                    borderRadius: 14,
                    border: "1px solid var(--border)",
                    background: "var(--card)",
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="var(--chart-2)"
                  strokeWidth={2.5}
                  fill="url(#salesGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Servicios más vendidos">
          <div className="h-[260px] w-full">
            {topServices.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topServices} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={110}
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    stroke="var(--muted-foreground)"
                  />
                  <Tooltip
                    cursor={{ fill: "var(--muted)" }}
                    contentStyle={{
                      borderRadius: 14,
                      border: "1px solid var(--border)",
                      background: "var(--card)",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 10, 10, 0]} barSize={18}>
                    {topServices.map((_, i) => (
                      <Cell key={i} fill={chartColors[i % chartColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Empty message="Aún no hay servicios registrados." />
            )}
          </div>
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.5fr]">
        <SectionCard
          title={new Date().toLocaleDateString("es-CO", { month: "long", year: "numeric" })}
        >
          <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-medium text-muted-foreground">
            {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
              <span key={i} className="py-1">
                {d}
              </span>
            ))}
            {Array.from({ length: monthDays.pad }).map((_, i) => (
              <span key={`p${i}`} />
            ))}
            {Array.from({ length: monthDays.days }).map((_, i) => {
              const day = i + 1;
              const isToday = day === monthDays.now.getDate();
              const busy = busyDays.has(String(day));
              return (
                <span
                  key={day}
                  className={[
                    "grid aspect-square place-items-center rounded-xl text-sm transition-colors",
                    isToday
                      ? "bg-primary font-semibold text-primary-foreground"
                      : busy
                        ? "bg-blush font-medium text-blush-foreground"
                        : "text-foreground hover:bg-secondary",
                  ].join(" ")}
                >
                  {day}
                </span>
              );
            })}
          </div>
          <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <i className="h-2.5 w-2.5 rounded-full bg-primary" /> Hoy
            </span>
            <span className="flex items-center gap-1.5">
              <i className="h-2.5 w-2.5 rounded-full bg-blush" /> Con citas
            </span>
          </div>
        </SectionCard>

        <SectionCard
          title="Próximas citas"
          action={
            <Link
              to="/panel/agenda"
              className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
            >
              Ver todas <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          {upcoming.length ? (
            <ul className="space-y-3">
              {upcoming.map((a) => {
                const meta = statusMeta(a.status);
                return (
                  <li
                    key={a.id}
                    className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border/70 bg-secondary/40 p-3 transition-colors hover:bg-secondary"
                  >
                    {a.pets?.photo_url ? (
                      <img
                        src={resolveMediaUrl(a.pets.photo_url)}
                        alt={a.pets?.name ?? "Mascota"}
                        className="h-12 w-12 shrink-0 rounded-2xl object-cover"
                      />
                    ) : (
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 font-semibold text-primary">
                        {initials(a.pets?.name ?? "?")}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">
                        {a.pets?.name} · {a.services?.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {a.pets?.owners?.full_name} · {shortDate(a.starts_at)} {time(a.starts_at)} ·{" "}
                        {a.staff?.full_name ?? "Sin asignar"}
                      </p>
                    </div>
                    <StatusPill label={meta.label} className={meta.className} hint={meta.hint} />
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty message="No hay citas próximas registradas." />
          )}
        </SectionCard>
      </div>
    </AppShell>
  );
}
