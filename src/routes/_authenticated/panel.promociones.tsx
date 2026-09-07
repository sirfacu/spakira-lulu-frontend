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
  breedsQuery,
  createPromotion,
  fetchPromoNotify,
  getPromotion,
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
  const [showPast, setShowPast] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const summary = useQuery(promotionsSummaryQuery);
  const promos = useQuery(promotionsQuery);
  const usage = useQuery({ ...promotionUsageQuery, enabled: tab === "historial" });
  const loyalty = useQuery({ ...loyaltyProgramQuery, enabled: tab === "fidelizacion" || tab === "beneficios" });
  const notify = useQuery({ queryKey: ["promo-notify"], queryFn: fetchPromoNotify, enabled: tab === "notificaciones" });
  const services = useQuery(panelServicesQuery);
  const breeds = useQuery({ ...breedsQuery, enabled: tab === "promos" });

  const filteredPromos = useMemo(() => {
    const rows = promos.data ?? [];
    const now = Date.now();
    const isPast = (p: Promotion) =>
      p.status === "cancelled" ||
      p.status === "ended" ||
      (p.ends_at ? new Date(p.ends_at).getTime() < now : false);
    let list = rows.filter((p) => (showPast ? true : !isPast(p)));
    if (campaignFilter === "coupon") list = list.filter((p) => p.requires_code);
    if (campaignFilter === "automatic") list = list.filter((p) => !p.requires_code);
    return list;
  }, [promos.data, campaignFilter, showPast]);

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

  const refreshPromos = () => {
    void qc.invalidateQueries({ queryKey: ["promotions"] });
    void qc.invalidateQueries({ queryKey: ["promotions-summary"] });
  };

  const toggleStatus = (id: string, active: boolean) =>
    patchPromotion(id, { status: active ? "active" : "paused" }).then(() => {
      refreshPromos();
      toast.success(active ? "Campaña activada" : "Campaña pausada");
    });

  const cancelPromo = (id: string) =>
    patchPromotion(id, { status: "cancelled" }).then(() => {
      refreshPromos();
      toast.success("Campaña cancelada (queda en historial)");
    });

  const startEdit = (p: Promotion) => {
    void getPromotion(p.id)
      .then((full) => setEditing(full))
      .catch((e) => toast.error(e instanceof Error ? e.message : "No se pudo cargar la campaña"));
  };

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
            <div className="flex flex-wrap items-center gap-2">
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
              <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                <Switch checked={showPast} onCheckedChange={setShowPast} />
                Mostrar vencidas / canceladas
              </label>
            </div>
            <PromoTable
              rows={filteredPromos}
              onToggleStatus={toggleStatus}
              onEdit={startEdit}
              onCancel={cancelPromo}
            />
          </div>
          <NewPromoForm
            key={editing?.id || "new"}
            services={services.data ?? []}
            breeds={(breeds.data ?? []).filter((b) => b.active !== false)}
            editing={editing}
            onCancelEdit={() => setEditing(null)}
            onCreated={() => {
              setEditing(null);
              refreshPromos();
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
                  .then((r) => {
                    const pet = Number((r as { birthday_pet?: number })?.birthday_pet || 0)
                    const own = Number((r as { birthday_owner?: number })?.birthday_owner || 0)
                    toast.success(
                      pet || own
                        ? `Revisión lista · cumpleaños enviados: mascota ${pet}, dueño ${own}`
                        : "Revisión de vencimientos y cumpleaños lista",
                    )
                  })
                  .catch((e) => toast.error(e instanceof Error ? e.message : "Error"))
              }
            >
              Actualizar vencimientos
            </Button>
          </div>
          <EmailTemplatesPanel
            module="promotions"
            allowCreate={false}
            intro="Avisos de cupón, fidelización, cumpleaños (dueño/mascota) y promoción por finalizar."
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
        cobrar (el cupón no se acumula con otras). Si son <strong>automáticas</strong>, se aplican solas y se
        acumulan entre sí (día, raza, cumpleaños, nivel de fidelización, etc.), hasta el tope del subtotal.
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
  onEdit,
  onCancel,
}: {
  rows: Promotion[];
  onToggleStatus: (id: string, active: boolean) => Promise<void>;
  onEdit: (p: Promotion) => void;
  onCancel: (id: string) => Promise<void>;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);

  return (
    <SectionCard title="Listado">
      {!rows.length ? <Empty message="No hay campañas con este filtro." /> : null}
      <ul className="space-y-3">
        {rows.map((p) => {
          const isActive = p.status === "active";
          const canToggle = p.status === "active" || p.status === "paused";
          const canCancel = p.status !== "cancelled" && p.status !== "ended";
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
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button type="button" variant="outline" className="h-8 rounded-lg text-xs" onClick={() => onEdit(p)}>
                      Editar
                    </Button>
                    {canCancel ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 rounded-lg border-destructive/30 text-xs text-destructive"
                        disabled={busyId === p.id}
                        onClick={() => {
                          setBusyId(p.id);
                          onCancel(p.id)
                            .catch((e) => toast.error(e instanceof Error ? e.message : "Error"))
                            .finally(() => setBusyId(null));
                        }}
                      >
                        Cancelar
                      </Button>
                    ) : null}
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
  breeds,
  onCreated,
  editing,
  onCancelEdit,
}: {
  services: { id: string; name: string }[];
  breeds: { id: string; name: string; species?: string }[];
  onCreated: () => void;
  editing?: Promotion | null;
  onCancelEdit?: () => void;
}) {
  const [name, setName] = useState(editing?.name || "");
  const [code, setCode] = useState(editing?.code || "");
  const [asCoupon, setAsCoupon] = useState(editing ? !!editing.requires_code : true);
  const [dtype, setDtype] = useState(editing?.discount_type || "percent");
  const [value, setValue] = useState(String(editing?.discount_value ?? "15"));
  const [minPurchase, setMinPurchase] = useState(
    editing?.min_purchase != null ? String(editing.min_purchase) : "",
  );
  const [maxUses, setMaxUses] = useState(editing?.max_uses != null ? String(editing.max_uses) : "100");
  const [perCustomer, setPerCustomer] = useState(
    editing?.max_uses_per_customer != null ? String(editing.max_uses_per_customer) : "1",
  );
  const [audience, setAudience] = useState(editing?.audience || "all");
  const [start, setStart] = useState(editing?.starts_at ? String(editing.starts_at).slice(0, 10) : "");
  const [end, setEnd] = useState(editing?.ends_at ? String(editing.ends_at).slice(0, 10) : "");
  const [weekdays, setWeekdays] = useState<number[]>(editing?.weekdays ?? []);
  const [svc, setSvc] = useState<string[]>(editing?.service_ids ?? []);
  const [limitBreeds, setLimitBreeds] = useState(Boolean(editing?.breed_ids?.length));
  const [breedIds, setBreedIds] = useState<string[]>(editing?.breed_ids ?? []);

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: name.trim(),
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
        breed_ids: limitBreeds ? breedIds : [],
      };
      if (editing) return patchPromotion(editing.id, payload as never);
      return createPromotion({
        ...payload,
        kind: asCoupon ? "coupon" : "automatic",
        requires_code: asCoupon,
        code: asCoupon ? code : null,
        status: "active",
      } as never);
    },
    onSuccess: () => {
      toast.success(editing ? "Campaña actualizada" : "Campaña creada");
      if (!editing) {
        setName("");
        setCode("");
      }
      onCreated();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  return (
    <SectionCard title={editing ? "Editar campaña" : "Nueva campaña"}>
      <p className="mb-3 text-sm text-muted-foreground">
        {editing
          ? "El código no se cambia acá; si hace falta otro código, creá una campaña nueva."
          : "Activá Requiere código para un cupón (no se acumula). Dejalo apagado para automática acumulable."}
      </p>
      <div className="space-y-3 text-sm">
        <div>
          <Label>Nombre</Label>
          <Input className="mt-1 rounded-xl" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        {!editing ? (
          <label className="flex items-center justify-between rounded-xl bg-secondary/40 px-3 py-2">
            <span>Requiere código (cupón)</span>
            <Switch checked={asCoupon} onCheckedChange={setAsCoupon} />
          </label>
        ) : null}
        {!editing && asCoupon ? (
          <div>
            <Label>Código</Label>
            <Input className="mt-1 rounded-xl uppercase" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
        ) : null}
        {editing?.code ? (
          <p className="rounded-xl bg-muted/50 px-3 py-2 font-mono text-xs">{editing.code}</p>
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
        <div className="space-y-2 rounded-xl border border-border/80 p-3">
          <label className="flex items-center justify-between gap-3">
            <span className="font-medium">Solo ciertas razas</span>
            <Switch
              checked={limitBreeds}
              onCheckedChange={(on) => {
                setLimitBreeds(on);
                if (!on) setBreedIds([]);
              }}
            />
          </label>
          {limitBreeds ? (
            <>
              <p className="text-xs text-muted-foreground">Elegí una o más razas abajo.</p>
              <select
                multiple
                className="h-32 w-full rounded-xl border border-input bg-background p-2 text-xs"
                value={breedIds}
                onChange={(e) => setBreedIds(Array.from(e.target.selectedOptions).map((o) => o.value))}
              >
                {breeds.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                    {b.species ? ` (${b.species})` : ""}
                  </option>
                ))}
              </select>
            </>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            className="rounded-xl"
            disabled={
              !name.trim() ||
              save.isPending ||
              (!editing && asCoupon && !code.trim()) ||
              (limitBreeds && breedIds.length === 0)
            }
            onClick={() => save.mutate()}
          >
            {editing ? "Guardar cambios" : "Guardar"}
          </Button>
          {editing && onCancelEdit ? (
            <Button type="button" variant="outline" className="rounded-xl" onClick={onCancelEdit}>
              Cancelar edición
            </Button>
          ) : null}
        </div>
      </div>
    </SectionCard>
  );
}
