import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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
import { AppShell } from "@/components/app-shell";
import { SectionCard, StatCard } from "@/components/ui-kit";
import { salesQuery, appointmentsQuery, petsQuery, ownersQuery } from "@/lib/spa-queries";
import { cop, dayKey, shortDate } from "@/lib/format";
import { DollarSign, Dog, Users, CalendarCheck } from "lucide-react";
import { requirePathAccess } from "@/lib/route-access";

export const Route = createFileRoute("/_authenticated/panel/reportes")({
  beforeLoad: requirePathAccess("/panel/reportes"),
  head: () => ({
    meta: [
      { title: "Reportes | Spa Kira" },
      {
        name: "description",
        content: "Reportes de ingresos, servicios y clientes del spa canino y felino Spa Kira.",
      },
      { property: "og:title", content: "Reportes | Spa Kira" },
      { property: "og:description", content: "Analítica de ingresos y servicios del spa." },
    ],
  }),
  component: Reportes,
});

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function Reportes() {
  const sales = useQuery(salesQuery);
  const appts = useQuery(appointmentsQuery);
  const pets = useQuery(petsQuery);
  const owners = useQuery(ownersQuery);

  const all = sales.data ?? [];
  const trend = Array.from({ length: 14 }).map((_, idx) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - idx));
    const key = dayKey(d);
    return {
      day: shortDate(d.toISOString()),
      total: all.filter((s) => dayKey(new Date(s.sold_at)) === key).reduce((a, s) => a + Number(s.total), 0),
    };
  });

  const byService = new Map<string, number>();
  for (const a of appts.data ?? []) {
    const n = a.services?.name ?? "Otro";
    byService.set(n, (byService.get(n) ?? 0) + Number(a.price));
  }
  const pie = [...byService.entries()].map(([name, value]) => ({ name, value })).slice(0, 5);

  return (
    <AppShell title="Reportes" subtitle="Analítica del negocio">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={DollarSign} label="Ingresos totales" value={cop(all.reduce((a, s) => a + Number(s.total), 0))} tone="accent" />
        <StatCard icon={CalendarCheck} label="Citas registradas" value={(appts.data ?? []).length} tone="primary" />
        <StatCard icon={Dog} label="Mascotas activas" value={(pets.data ?? []).length} tone="mint" />
        <StatCard icon={Users} label="Clientes" value={(owners.data ?? []).length} tone="gold" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <SectionCard title="Tendencia de ingresos (14 días)">
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ left: -12, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="4 6" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11} stroke="var(--muted-foreground)" />
                <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="var(--muted-foreground)" tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                <Tooltip formatter={(v) => cop(Number(v))} contentStyle={{ borderRadius: 14, border: "1px solid var(--border)", background: "var(--card)", fontSize: 12 }} />
                <Line type="monotone" dataKey="total" stroke="var(--chart-2)" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Ingresos por servicio">
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={3}>
                  {pie.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => cop(Number(v))} contentStyle={{ borderRadius: 14, border: "1px solid var(--border)", background: "var(--card)", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
