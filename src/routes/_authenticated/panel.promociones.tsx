import { useState } from "react";
import { Tag, Ticket, Percent, Gift } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Empty, SectionCard, StatCard } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { requirePathAccess } from "@/lib/route-access";
import { cop, shortDate } from "@/lib/format";
import {
  couponsQuery,
  createPromotion,
  fetchPromoNotify,
  loyaltyProgramQuery,
  patchPromotion,
  promotionsQuery,
  promotionsSummaryQuery,
  promotionUsageQuery,
  runPromoNotifyDue,
  type Promotion,
  panelServicesQuery,
} from "@/lib/spa-queries";
import { EmailTemplatesPanel } from "@/components/config-email-panels";
import { LoyaltyRewardsPanel, LoyaltyRulesPanel, LoyaltyTiersPanel } from "@/components/loyalty-admin";

export const Route = createFileRoute("/_authenticated/panel/promociones")({
  beforeLoad: requirePathAccess("/panel/promociones"),
  head: () => ({ meta: [{ title: "Promociones | Spa Kira" }] }),
  component: PromocionesPage,
});

type Tab =
  | "resumen"
  | "cupones"
  | "promos"
  | "fidelizacion"
  | "beneficios"
  | "notificaciones"
  | "historial";

const DAYS = [
  { n: 1, l: "Lun" },
  { n: 2, l: "Mar" },
  { n: 3, l: "Mié" },
  { n: 4, l: "Jue" },
  { n: 5, l: "Vie" },
  { n: 6, l: "Sáb" },
  { n: 7, l: "Dom" },
];

function statusLabel(s: string) {
  return (
    { draft: "Borrador", active: "Activa", paused: "Pausada", ended: "Finalizada", cancelled: "Cancelada" }[s] || s
  );
}

function PromocionesPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("resumen");
  const summary = useQuery(promotionsSummaryQuery);
  const promos = useQuery(promotionsQuery);
  const coupons = useQuery(couponsQuery);
  const usage = useQuery({ ...promotionUsageQuery, enabled: tab === "historial" });
  const loyalty = useQuery({ ...loyaltyProgramQuery, enabled: tab === "fidelizacion" || tab === "beneficios" });
  const notify = useQuery({ queryKey: ["promo-notify"], queryFn: fetchPromoNotify, enabled: tab === "notificaciones" });
  const services = useQuery(panelServicesQuery);

  const tabs: { id: Tab; label: string }[] = [
    { id: "resumen", label: "Resumen" },
    { id: "cupones", label: "Cupones" },
    { id: "promos", label: "Promociones" },
    { id: "fidelizacion", label: "Fidelización" },
    { id: "beneficios", label: "Beneficios" },
    { id: "notificaciones", label: "Notificaciones" },
    { id: "historial", label: "Historial" },
  ];

  return (
    <AppShell title="Promociones" subtitle="Cupones, campañas y fidelización">
      <div className="mb-5 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-xl px-3 py-2 text-sm font-medium ${tab === t.id ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "resumen" ? (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={Tag}
              label="Promociones activas"
              value={String(summary.data?.active ?? "—")}
              hint="Ver campañas"
              onClick={() => setTab("promos")}
            />
            <StatCard
              icon={Ticket}
              label="Cupones"
              value={String(summary.data?.coupons ?? "—")}
              hint="Ver cupones"
              onClick={() => setTab("cupones")}
            />
            <StatCard
              icon={Percent}
              label="Usos"
              value={String(summary.data?.coupon_uses ?? "—")}
              hint="Ver historial"
              onClick={() => setTab("historial")}
            />
            <StatCard
              icon={Gift}
              label="Descuentos otorgados"
              value={cop(summary.data?.discount_total ?? 0)}
              hint="Ver historial"
              onClick={() => setTab("historial")}
            />
            <StatCard
              icon={Tag}
              label="Próximas"
              value={String(summary.data?.upcoming ?? "—")}
              hint="Ver campañas"
              onClick={() => setTab("promos")}
            />
            <StatCard
              icon={Ticket}
              label="Vencidas"
              value={String(summary.data?.expired ?? "—")}
              hint="Ver campañas"
              onClick={() => setTab("promos")}
            />
            <StatCard
              icon={Percent}
              label="Más usada"
              value={summary.data?.top_promotion?.name || "—"}
              hint="Ver campañas"
              onClick={() => setTab("promos")}
            />
            <StatCard
              icon={Gift}
              label="Beneficios disponibles"
              value={String(summary.data?.loyalty?.rewards_available ?? "—")}
              hint="Ver beneficios"
              onClick={() => setTab("beneficios")}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button className="rounded-xl" onClick={() => setTab("promos")}>
              Nueva promoción
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={() => setTab("fidelizacion")}>
              Niveles y reglas
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={() => setTab("beneficios")}>
              Emitir beneficio
            </Button>
          </div>
        </div>
      ) : null}

      {tab === "cupones" ? (
        <PromoTable
          rows={(coupons.data ?? []).filter((p) => p.requires_code)}
          onPause={(id, status) =>
            patchPromotion(id, { status }).then(() => {
              void qc.invalidateQueries({ queryKey: ["promotions"] });
              toast.success("Actualizado");
            })
          }
        />
      ) : null}

      {tab === "promos" ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <PromoTable
            rows={promos.data ?? []}
            onPause={(id, status) =>
              patchPromotion(id, { status }).then(() => {
                void qc.invalidateQueries({ queryKey: ["promotions"] });
                toast.success("Actualizado");
              })
            }
          />
          <NewPromoForm
            services={services.data ?? []}
            onCreated={() => {
              void qc.invalidateQueries({ queryKey: ["promotions"] });
              void qc.invalidateQueries({ queryKey: ["promotions-summary"] });
            }}
          />
        </div>
      ) : null}

      {tab === "fidelizacion" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <LoyaltyTiersPanel tiers={loyalty.data?.tiers ?? []} />
          <LoyaltyRulesPanel rules={loyalty.data?.rules ?? []} services={services.data ?? []} />
        </div>
      ) : null}

      {tab === "beneficios" ? <LoyaltyRewardsPanel rewards={loyalty.data?.rewards ?? []} /> : null}

      {tab === "notificaciones" ? (
        <SectionCard title="Correos de promociones">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Mismo editor que Configuración → Correos. El SMTP no se cambia acá.
            </p>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() =>
                runPromoNotifyDue()
                  .then(() => toast.success("Revisión de vencimientos lista"))
                  .catch((e) => toast.error(e instanceof Error ? e.message : "Error"))
              }
            >
              Actualizar vencimientos
            </Button>
          </div>
          <EmailTemplatesPanel
            module="promotions"
            allowCreate={false}
            intro="Avisos de cupón usado, aniversario, premio por vencer y promoción por finalizar."
          />
          <h3 className="mt-8 font-display text-lg font-bold text-primary">Envíos recientes</h3>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {(notify.data?.log ?? []).slice(0, 15).map((l) => (
              <li key={String(l.id)}>
                {String(l.event_key)} · {String(l.to_email)} · {String(l.status)}
              </li>
            ))}
            {!notify.data?.log?.length ? <li>Todavía no hay envíos.</li> : null}
          </ul>
        </SectionCard>
      ) : null}

      {tab === "historial" ? (
        <SectionCard title="Usos">
          {(usage.data ?? []).length ? (
            <ul className="space-y-2 text-sm">
              {(usage.data ?? []).map((u) => (
                <li key={String(u.id)} className="flex justify-between gap-2 rounded-xl border border-border p-3">
                  <span>
                    {String(u.promotion_name || u.kind)} · {String(u.customer_name || "—")}
                  </span>
                  <span>{cop(Number(u.discount_amount || 0))}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty message="Todavía no hay usos registrados." />
          )}
        </SectionCard>
      ) : null}
    </AppShell>
  );
}

function PromoTable({
  rows,
  onPause,
}: {
  rows: Promotion[];
  onPause: (id: string, status: string) => void;
}) {
  return (
    <SectionCard title="Listado">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr>
              <th className="py-2">Código</th>
              <th>Promoción</th>
              <th>Descuento</th>
              <th>Vigencia</th>
              <th>Usos</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="py-2 font-mono text-xs">{p.code || "—"}</td>
                <td>{p.name}</td>
                <td>
                  {p.discount_type === "percent" ? `${p.discount_value}%` : cop(p.discount_value)}
                </td>
                <td className="text-xs text-muted-foreground">
                  {p.starts_at ? shortDate(p.starts_at) : "—"} → {p.ends_at ? shortDate(p.ends_at) : "—"}
                </td>
                <td>
                  {p.usage_count ?? 0}
                  {p.max_uses != null ? ` / ${p.max_uses}` : ""}
                </td>
                <td>{statusLabel(p.status)}</td>
                <td>
                  {p.status === "active" ? (
                    <Button variant="ghost" size="sm" onClick={() => onPause(p.id, "paused")}>
                      Pausar
                    </Button>
                  ) : p.status === "paused" ? (
                    <Button variant="ghost" size="sm" onClick={() => onPause(p.id, "active")}>
                      Activar
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length ? <Empty message="No hay promociones." /> : null}
      </div>
    </SectionCard>
  );
}

function NewPromoForm({
  services,
  onCreated,
}: {
  services: { id: string; name: string }[];
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [asCoupon, setAsCoupon] = useState(true);
  const [dtype, setDtype] = useState("percent");
  const [value, setValue] = useState("15");
  const [minPurchase, setMinPurchase] = useState("");
  const [maxUses, setMaxUses] = useState("100");
  const [perCustomer, setPerCustomer] = useState("1");
  const [audience, setAudience] = useState("all");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [svc, setSvc] = useState<string[]>([]);

  const save = useMutation({
    mutationFn: () =>
      createPromotion({
        name: name.trim(),
        kind: asCoupon ? "coupon" : "automatic",
        requires_code: asCoupon,
        code: asCoupon ? code : null,
        status: "active",
        discount_type: dtype,
        discount_value: Number(value),
        min_purchase: minPurchase ? Number(minPurchase) : 0,
        max_uses: maxUses ? Number(maxUses) : null,
        max_uses_per_customer: perCustomer ? Number(perCustomer) : null,
        audience,
        starts_at: start ? `${start}T00:00:00` : null,
        ends_at: end ? `${end}T23:59:59` : null,
        weekdays,
        service_ids: svc,
      } as never),
    onSuccess: () => {
      toast.success("Promoción creada");
      setName("");
      setCode("");
      onCreated();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  return (
    <SectionCard title="Nueva promoción">
      <div className="space-y-3 text-sm">
        <div>
          <Label>Nombre</Label>
          <Input className="mt-1 rounded-xl" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <label className="flex items-center justify-between">
          <span>Requiere código</span>
          <Switch checked={asCoupon} onCheckedChange={setAsCoupon} />
        </label>
        {asCoupon ? (
          <div>
            <Label>Código</Label>
            <Input className="mt-1 rounded-xl uppercase" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Tipo</Label>
            <select
              className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-2"
              value={dtype}
              onChange={(e) => setDtype(e.target.value)}
            >
              <option value="percent">Porcentaje</option>
              <option value="fixed">Valor fijo</option>
            </select>
          </div>
          <div>
            <Label>Valor</Label>
            <Input className="mt-1 rounded-xl" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Audiencia</Label>
          <select
            className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-2"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
          >
            <option value="all">Todos</option>
            <option value="new">Solo nuevos</option>
            <option value="existing">Solo existentes</option>
            <option value="frequent">Frecuentes</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Inicio</Label>
            <Input type="date" className="mt-1 rounded-xl" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <Label>Fin</Label>
            <Input type="date" className="mt-1 rounded-xl" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Compra mínima</Label>
            <Input className="mt-1 rounded-xl" value={minPurchase} onChange={(e) => setMinPurchase(e.target.value)} />
          </div>
          <div>
            <Label>Usos / por cliente</Label>
            <div className="mt-1 grid grid-cols-2 gap-1">
              <Input value={maxUses} onChange={(e) => setMaxUses(e.target.value)} />
              <Input value={perCustomer} onChange={(e) => setPerCustomer(e.target.value)} />
            </div>
          </div>
        </div>
        <div>
          <Label>Días</Label>
          <div className="mt-1 flex flex-wrap gap-1">
            {DAYS.map((d) => (
              <button
                key={d.n}
                type="button"
                className={`rounded-lg px-2 py-1 text-xs ${weekdays.includes(d.n) ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
                onClick={() =>
                  setWeekdays((w) => (w.includes(d.n) ? w.filter((x) => x !== d.n) : [...w, d.n]))
                }
              >
                {d.l}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label>Servicios (vacío = todos)</Label>
          <select
            multiple
            className="mt-1 h-24 w-full rounded-xl border border-input bg-background p-2 text-xs"
            value={svc}
            onChange={(e) => setSvc(Array.from(e.target.selectedOptions).map((o) => o.value))}
          >
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <Button className="w-full rounded-xl" disabled={!name.trim() || save.isPending} onClick={() => save.mutate()}>
          Guardar
        </Button>
      </div>
    </SectionCard>
  );
}
