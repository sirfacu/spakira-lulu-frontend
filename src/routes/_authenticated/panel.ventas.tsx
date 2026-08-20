import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { DollarSign, TrendingUp, Receipt, Sparkles, Plus } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { AppShell } from "@/components/app-shell";
import { StatCard, SectionCard, Empty } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  salesQuery,
  ownersQuery,
  staffQuery,
  panelServicesQuery,
  createSale,
} from "@/lib/spa-queries";
import { cop, dayKey, shortDate } from "@/lib/format";
import { requirePathAccess } from "@/lib/route-access";

export const Route = createFileRoute("/_authenticated/panel/ventas")({
  beforeLoad: requirePathAccess("/panel/ventas"),
  head: () => ({
    meta: [
      { title: "Ventas | Spa Kira" },
      {
        name: "description",
        content: "Venta rápida, historial y facturación con indicadores diarios y mensuales.",
      },
      { property: "og:title", content: "Ventas | Spa Kira" },
      { property: "og:description", content: "Módulo de ventas y facturación del spa." },
    ],
  }),
  component: Ventas,
});

function Ventas() {
  const qc = useQueryClient();
  const sales = useQuery(salesQuery);
  const owners = useQuery(ownersQuery);
  const staff = useQuery(staffQuery);
  const services = useQuery(panelServicesQuery);

  const [ownerId, setOwnerId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [method, setMethod] = useState("efectivo");

  const service = (services.data ?? []).find((s) => s.id === serviceId);

  const create = useMutation({
    mutationFn: () =>
      createSale({
        owner_id: ownerId || null,
        staff_id: staffId || null,
        total: Number(service?.price ?? 0),
        payment_method: method,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      toast.success("Venta registrada");
      setServiceId("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const all = sales.data ?? [];
  const today = dayKey(new Date());
  const todayTotal = all
    .filter((s) => dayKey(new Date(s.sold_at)) === today)
    .reduce((a, s) => a + Number(s.total), 0);
  const monthTotal = all
    .filter((s) => new Date(s.sold_at).getMonth() === new Date().getMonth())
    .reduce((a, s) => a + Number(s.total), 0);
  const avg = all.length ? all.reduce((a, s) => a + Number(s.total), 0) / all.length : 0;

  const chart = Array.from({ length: 7 }).map((_, idx) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - idx));
    const key = dayKey(d);
    return {
      day: shortDate(d.toISOString()),
      total: all.filter((s) => dayKey(new Date(s.sold_at)) === key).reduce((a, s) => a + Number(s.total), 0),
    };
  });

  return (
    <AppShell title="Ventas" subtitle="Venta rápida, historial y facturación">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={DollarSign} label="Ventas del día" value={cop(todayTotal)} tone="accent" />
        <StatCard icon={TrendingUp} label="Ventas del mes" value={cop(monthTotal)} tone="primary" />
        <StatCard icon={Receipt} label="Ticket promedio" value={cop(avg)} tone="gold" />
        <StatCard
          icon={Sparkles}
          label="Servicios más vendidos"
          value={(services.data ?? [])[0]?.name ?? "—"}
          tone="mint"
        />
      </div>

      <Tabs defaultValue="rapida" className="mt-6">
        <TabsList className="rounded-xl">
          <TabsTrigger value="rapida" className="rounded-lg">Venta rápida</TabsTrigger>
          <TabsTrigger value="historial" className="rounded-lg">Historial</TabsTrigger>
          <TabsTrigger value="facturacion" className="rounded-lg">Facturación</TabsTrigger>
        </TabsList>

        <TabsContent value="rapida" className="mt-5">
          <SectionCard title="Nueva venta">
            <div className="grid gap-4 md:grid-cols-4">
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Cliente" /></SelectTrigger>
                <SelectContent>
                  {(owners.data ?? []).map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={serviceId} onValueChange={setServiceId}>
                <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Servicio" /></SelectTrigger>
                <SelectContent>
                  {(services.data ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name} · {cop(s.price)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={staffId} onValueChange={setStaffId}>
                <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Encargado" /></SelectTrigger>
                <SelectContent>
                  {(staff.data ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["efectivo", "tarjeta", "transferencia"].map((m) => (
                    <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-2xl bg-secondary/60 p-5">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Total</p>
                <p className="font-display text-3xl font-bold text-accent">{cop(service?.price ?? 0)}</p>
              </div>
              <Button
                disabled={!serviceId || create.isPending}
                onClick={() => create.mutate()}
                className="h-12 rounded-xl px-6"
              >
                <Plus className="mr-2 h-4 w-4" /> Registrar venta
              </Button>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="historial" className="mt-5">
          <SectionCard title="Historial de ventas">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="py-3 font-semibold">Fecha</th>
                    <th className="py-3 font-semibold">Cliente</th>
                    <th className="py-3 font-semibold">Vendedor</th>
                    <th className="py-3 font-semibold">Método</th>
                    <th className="py-3 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {all.map((s) => (
                    <tr key={s.id} className="border-b border-border/60 last:border-0">
                      <td className="py-3 text-muted-foreground">{shortDate(s.sold_at)}</td>
                      <td className="py-3 font-medium text-foreground">{s.owners?.full_name ?? "—"}</td>
                      <td className="py-3 text-muted-foreground">{s.staff?.full_name ?? "—"}</td>
                      <td className="py-3 capitalize text-muted-foreground">{s.payment_method}</td>
                      <td className="py-3 text-right font-semibold text-accent">{cop(s.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!all.length ? <Empty message="Sin ventas registradas." /> : null}
          </SectionCard>
        </TabsContent>

        <TabsContent value="facturacion" className="mt-5">
          <SectionCard title="Ventas de la semana">
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart} margin={{ left: -12, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="4 6" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="var(--muted-foreground)" tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                  <Tooltip
                    cursor={{ fill: "var(--muted)" }}
                    formatter={(v) => cop(Number(v))}
                    contentStyle={{ borderRadius: 14, border: "1px solid var(--border)", background: "var(--card)", fontSize: 12 }}
                  />
                  <Bar dataKey="total" fill="var(--chart-1)" radius={[10, 10, 0, 0]} barSize={34} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
