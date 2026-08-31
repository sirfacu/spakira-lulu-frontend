import { useMemo, useState } from "react";
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
  | "promos"
  | "fidelizacion"
  | "beneficios"
  | "notificaciones"
  | "historial";

type CampaignFilter = "all" | "coupon" | "automatic";

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

function campaignTypeLabel(p: Promotion) {
  return p.requires_code || p.kind === "coupon" ? "Cupón" : "Automática";
}

function PromocionesPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("resumen");
  const [campaignFilter, setCampaignFilter] = useState<CampaignFilter>("all");
  const summary = useQuery(promotionsSummaryQuery);
  const promos = useQuery(promotionsQuery);
  const usage = useQuery({ ...promotionUsageQuery, enabled: tab === "historial" });
  const loyalty = useQuery({ ...loyaltyProgramQuery, enabled: tab === "fidelizacion" || tab === "beneficios" });
  const notify = useQuery({ queryKey: ["promo-notify"], queryFn: fetchPromoNotify, enabled: tab === "notificaciones" });
  const services = useQuery(panelServicesQuery);

  const filteredPromos = useMemo(() => {
    const rows = promos.data ?? [];
    if (campaignFilter === "coupon") return rows.filter((p) => p.requires_code);
    if (campaignFilter === "automatic") return rows.filter((p) => !p.requires_code);
    return rows;
  }, [promos.data, campaignFilter]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "resumen", label: "Resumen" },
    { id: "promos", label: "Campañas" },
    { id: "fidelizacion", label: "Fidelización" },
    { id: "beneficios", label: "Beneficios" },
    { id: "notificaciones", label: "Notificaciones" },
    { id: "historial", label: "Historial" },
  ];

  const goCampaigns = (filter: CampaignFilter = "all") => {
    setCampaignFilter(filter);
    setTab("promos");
  };

  const toggleStatus = (id: string, active: boolean) =>
    patchPromotion(id, { status: active ? "active" : "paused" }).then(() => {
      void qc.invalidateQueries({ queryKey: ["promotions"] });
      void qc.invalidateQueries({ queryKey: ["promotions-summary"] });
      toast.success(active ? "Campaña activada" : "Campaña pausada");
    });

  return (
    <AppShell title="Promociones" subtitle="Campañas, fidelización y beneficios">
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
              label="Campañas activas"
              value={String(summary.data?.active ?? "—")}
              hint="Ver campañas"
              onClick={() => goCampaigns("all")}
            />
            <StatCard
              icon={Ticket}
              label="Cupones con código"
              value={String(summary.data?.coupons ?? "—")}
              hint="Filtrar cupones"
              onClick={() => goCampaigns("coupon")}
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
              onClick={() => goCampaigns("all")}
            />
            <StatCard
              icon={Ticket}
              label="Vencidas"
              value={String(summary.data?.expired ?? "—")}
              hint="Ver campañas"
              onClick={() => goCampaigns("all")}
            />
            <StatCard
              icon={Percent}
              label="Más usada"
              value={summary.data?.top_promotion?.name || "—"}
              hint="Ver campañas"
              onClick={() => goCampaigns("all")}
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
            <Button className="rounded-xl" onClick={() => goCampaigns("all")}>
              Nueva campaña
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

      {tab === "promos" ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <CampaignIntro />
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: "all", label: "Todas" },
                  { id: "coupon", label: "Con código" },
                  { id: "automatic", label: "Automáticas" },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setCampaignFilter(f.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide ${
                    campaignFilter === f.id
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-secondary/80 text-muted-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <PromoTable rows={filteredPromos} onToggleStatus={toggleStatus} />
          </div>
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

function CampaignIntro() {
  return (
    <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/5 via-background to-secondary/30 p-4 sm:p-5">
      <h2 className="font-display text-lg font-bold text-primary">¿Cupón o automática?</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Todas las campañas viven acá. Si llevan <strong>código</strong>, el cliente o el mostrador lo escriben al
        cobrar. Si son <strong>automáticas</strong>, el sistema las aplica solas cuando se cumplen las reglas (día,
        servicio, mascotas, etc.).
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border/80 bg-background/80 p-3 text-sm">
          <p className="font-semibold text-primary">Ejemplo cupón</p>
          <p className="mt-1 text-muted-foreground">
            Código <span className="font-mono text-xs">BIENVENIDA</span> → $10.000 de descuento en la primera compra
            (mínimo $40.000).
          </p>
        </div>
        <div className="rounded-xl border border-border/80 bg-background/80 p-3 text-sm">
          <p className="font-semibold text-primary">Ejemplo automática</p>
          <p className="mt-1 text-muted-foreground">
            <strong>Martes de Baño</strong> → 20% en baños los martes, sin escribir nada.
          </p>
        </div>
      </div>
    </div>
  );
}

function PromoTable({
  rows,
  onToggleStatus,
}: {
  rows: Promotion[];
  onToggleStatus: (id: string, active: boolean) => Promise<void>;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);

  return (
    <SectionCard title="Listado">
      {!rows.length ? <Empty message="No hay campañas con este filtro." /> : null}
      <ul className="space-y-3">
        {rows.map((p) => {
          const isActive = p.status === "active";
          const canToggle = p.status === "active" || p.status === "paused";
          return (
            <li
              key={p.id}
              className="rounded-2xl border border-border/90 bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        p.requires_code
                          ? "bg-primary/15 text-primary"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {campaignTypeLabel(p)}
                    </span>
                    {p.code ? (
                      <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs">{p.code}</span>
                    ) : null}
                    <span className="text-xs text-muted-foreground">{statusLabel(p.status)}</span>
                  </div>
                  <p className="font-medium text-foreground">{p.name}</p>
                  {p.description ? (
                    <p className="text-sm text-muted-foreground">{p.description}</p>
                  ) : null}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      Descuento:{" "}
                      {p.discount_type === "percent" ? `${p.discount_value}%` : cop(p.discount_value)}
                    </span>
                    <span>
                      Vigencia: {p.starts_at ? shortDate(p.starts_at) : "—"} →{" "}
                      {p.ends_at ? shortDate(p.ends_at) : "—"}
                    </span>
                    <span>
                      Usos: {p.usage_count ?? 0}
                      {p.max_uses != null ? ` / ${p.max_uses}` : ""}
                    </span>
                  </div>
                </div>
                {canToggle ? (
                  <label className="flex shrink-0 items-center gap-2 rounded-xl bg-secondary/50 px-3 py-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      {isActive ? "Activa" : "Pausada"}
                    </span>
                    <Switch
                      checked={isActive}
                      disabled={busyId === p.id}
                      onCheckedChange={(checked) => {
                        setBusyId(p.id);
                        onToggleStatus(p.id, checked)
                          .catch((e) => toast.error(e instanceof Error ? e.message : "Error"))
                          .finally(() => setBusyId(null));
                      }}
                      aria-label={`Activar ${p.name}`}
                    />
                  </label>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
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
      toast.success("Campaña creada");
      setName("");
      setCode("");
      onCreated();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  return (
    <SectionCard title="Nueva campaña">
      <p className="mb-3 text-sm text-muted-foreground">
        Activá <strong>Requiere código</strong> para un cupón. Dejalo apagado para una promoción automática.
      </p>
      <div className="space-y-3 text-sm">
        <div>
          <Label>Nombre</Label>
          <Input className="mt-1 rounded-xl" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <label className="flex items-center justify-between rounded-xl bg-secondary/40 px-3 py-2">
          <span>Requiere código (cupón)</span>
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
