import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SectionCard, Empty } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  createLoyaltyRule,
  createLoyaltyTier,
  issueLoyaltyReward,
  ownersQuery,
  panelServicesQuery,
  patchLoyaltyReward,
  patchLoyaltyRule,
  patchLoyaltyTier,
} from "@/lib/spa-queries";

type Tier = {
  id: string;
  name: string;
  min_visits: number;
  min_months: number;
  discount_type: string | null;
  discount_value: number;
};

type Rule = {
  id: string;
  name: string;
  active: boolean;
  min_months: number;
  min_visits: number;
  cycle_months: number;
  reward_kind: string;
  reward_value: number;
  reward_service_id: string | null;
  reward_valid_days: number;
  uses_per_cycle: number;
};

type Reward = {
  id: string;
  status: string;
  label: string;
  customer_name: string;
  expires_at?: string | null;
  applies_to?: string;
  discount_type?: string;
  discount_value?: number;
};

const APPLIES_TO_LABEL: Record<string, string> = {
  services: "Solo servicios",
  store: "Solo vitrina",
  both: "Servicios y vitrina",
};

function asTier(t: Record<string, unknown>): Tier {
  return {
    id: String(t.id),
    name: String(t.name),
    min_visits: Number(t.min_visits || 0),
    min_months: Number(t.min_months || 0),
    discount_type: (t.discount_type as string) || "percent",
    discount_value: Number(t.discount_value || 0),
  };
}

function asRule(r: Record<string, unknown>): Rule {
  return {
    id: String(r.id),
    name: String(r.name),
    active: Boolean(r.active),
    min_months: Number(r.min_months || 0),
    min_visits: Number(r.min_visits || 0),
    cycle_months: Number(r.cycle_months || 12),
    reward_kind: String(r.reward_kind || "percent"),
    reward_value: Number(r.reward_value || 0),
    reward_service_id: r.reward_service_id ? String(r.reward_service_id) : null,
    reward_valid_days: Number(r.reward_valid_days || 30),
    uses_per_cycle: Number(r.uses_per_cycle || 1),
  };
}

export function LoyaltyTiersPanel({
  tiers,
}: {
  tiers: Record<string, unknown>[];
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [visits, setVisits] = useState("3");
  const [months, setMonths] = useState("0");
  const [percent, setPercent] = useState("5");
  const [newName, setNewName] = useState("");
  const [newVisits, setNewVisits] = useState("3");
  const [newPercent, setNewPercent] = useState("5");

  const startEdit = (t: Tier) => {
    setEditing(t.id);
    setName(t.name);
    setVisits(String(t.min_visits));
    setMonths(String(t.min_months));
    setPercent(String(t.discount_value));
  };

  const save = useMutation({
    mutationFn: () =>
      patchLoyaltyTier(editing!, {
        name: name.trim(),
        min_visits: Number(visits) || 0,
        min_months: Number(months) || 0,
        discount_type: "percent",
        discount_value: Number(percent) || 0,
      }),
    onSuccess: async () => {
      toast.success("Nivel actualizado");
      setEditing(null);
      await qc.invalidateQueries({ queryKey: ["loyalty-program"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const create = useMutation({
    mutationFn: () =>
      createLoyaltyTier({
        name: newName.trim(),
        min_visits: Number(newVisits) || 0,
        discount_type: "percent",
        discount_value: Number(newPercent) || 0,
        sort_order: (tiers.length + 1) * 10,
      }),
    onSuccess: async () => {
      toast.success("Nivel creado");
      setNewName("");
      await qc.invalidateQueries({ queryKey: ["loyalty-program"] });
      await qc.invalidateQueries({ queryKey: ["promotions-summary"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <SectionCard title="Niveles">
      <p className="mb-3 text-sm text-muted-foreground">
        El nivel se calcula por visitas (y meses). El descuento de nivel es informativo; el premio
        concreto se emite con las reglas o a mano en Beneficios.
      </p>
      <ul className="space-y-2 text-sm">
        {tiers.map((raw) => {
          const t = asTier(raw);
          return (
            <li key={t.id} className="rounded-xl border border-border p-3">
              {editing === t.id ? (
                <div className="grid gap-2 sm:grid-cols-3">
                  <div>
                    <Label>Nombre</Label>
                    <Input className="mt-1 rounded-xl" value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div>
                    <Label>Visitas mín.</Label>
                    <Input className="mt-1 rounded-xl" value={visits} onChange={(e) => setVisits(e.target.value)} />
                  </div>
                  <div>
                    <Label>% descuento</Label>
                    <Input className="mt-1 rounded-xl" value={percent} onChange={(e) => setPercent(e.target.value)} />
                  </div>
                  <div>
                    <Label>Meses mín.</Label>
                    <Input className="mt-1 rounded-xl" value={months} onChange={(e) => setMonths(e.target.value)} />
                  </div>
                  <div className="flex items-end gap-2 sm:col-span-2">
                    <Button className="rounded-xl" disabled={save.isPending} onClick={() => save.mutate()}>
                      Guardar
                    </Button>
                    <Button variant="outline" className="rounded-xl" onClick={() => setEditing(null)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{t.name}</p>
                    <p className="text-muted-foreground">
                      Desde {t.min_visits} visitas
                      {t.min_months ? ` · ${t.min_months} meses` : ""}
                      {t.discount_type === "percent" ? ` · ${t.discount_value}%` : ""}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" className="rounded-lg" onClick={() => startEdit(t)}>
                    Editar
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-4 rounded-2xl bg-secondary/40 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nuevo nivel</p>
        <div className="grid gap-2 sm:grid-cols-[1fr_90px_90px_auto]">
          <Input className="rounded-xl" placeholder="Nombre" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Input className="rounded-xl" placeholder="Visitas" value={newVisits} onChange={(e) => setNewVisits(e.target.value)} />
          <Input className="rounded-xl" placeholder="%" value={newPercent} onChange={(e) => setNewPercent(e.target.value)} />
          <Button
            className="rounded-xl"
            disabled={!newName.trim() || create.isPending}
            onClick={() => create.mutate()}
          >
            Agregar
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}

export function LoyaltyRulesPanel({
  rules,
  services,
}: {
  rules: Record<string, unknown>[];
  services: { id: string; name: string }[];
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    min_months: "12",
    min_visits: "8",
    cycle_months: "12",
    reward_kind: "percent",
    reward_value: "10",
    reward_service_id: "",
    reward_valid_days: "30",
  });
  const [newName, setNewName] = useState("");
  const [newMonths, setNewMonths] = useState("12");
  const [newVisits, setNewVisits] = useState("8");
  const [newKind, setNewKind] = useState("percent");
  const [newVal, setNewVal] = useState("10");

  const startEdit = (r: Rule) => {
    setEditing(r.id);
    setForm({
      name: r.name,
      min_months: String(r.min_months),
      min_visits: String(r.min_visits),
      cycle_months: String(r.cycle_months),
      reward_kind: r.reward_kind,
      reward_value: String(r.reward_value),
      reward_service_id: r.reward_service_id || "",
      reward_valid_days: String(r.reward_valid_days),
    });
  };

  const save = useMutation({
    mutationFn: () =>
      patchLoyaltyRule(editing!, {
        name: form.name.trim(),
        min_months: Number(form.min_months) || 0,
        min_visits: Number(form.min_visits) || 0,
        cycle_months: Number(form.cycle_months) || 12,
        reward_kind: form.reward_kind,
        reward_value: Number(form.reward_value) || 0,
        reward_service_id: form.reward_service_id || "",
        reward_valid_days: Number(form.reward_valid_days) || 30,
      }),
    onSuccess: async () => {
      toast.success("Regla actualizada");
      setEditing(null);
      await qc.invalidateQueries({ queryKey: ["loyalty-program"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const create = useMutation({
    mutationFn: () =>
      createLoyaltyRule({
        name: newName.trim(),
        min_months: Number(newMonths) || 0,
        min_visits: Number(newVisits) || 0,
        reward_kind: newKind,
        reward_value: Number(newVal) || 0,
      }),
    onSuccess: async () => {
      toast.success("Regla creada");
      setNewName("");
      await qc.invalidateQueries({ queryKey: ["loyalty-program"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => patchLoyaltyRule(id, { active }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["loyalty-program"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <SectionCard title="Reglas">
      <p className="mb-3 text-sm text-muted-foreground">
        Una regla emite un beneficio cuando el cliente cumple meses y visitas (p. ej. Aniversario).
      </p>
      <ul className="space-y-2 text-sm">
        {rules.map((raw) => {
          const r = asRule(raw);
          return (
            <li key={r.id} className="rounded-xl border border-border p-3">
              {editing === r.id ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Label>Nombre</Label>
                    <Input className="mt-1 rounded-xl" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Meses</Label>
                    <Input className="mt-1 rounded-xl" value={form.min_months} onChange={(e) => setForm((f) => ({ ...f, min_months: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Visitas</Label>
                    <Input className="mt-1 rounded-xl" value={form.min_visits} onChange={(e) => setForm((f) => ({ ...f, min_visits: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Ciclo (meses)</Label>
                    <Input className="mt-1 rounded-xl" value={form.cycle_months} onChange={(e) => setForm((f) => ({ ...f, cycle_months: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Vigencia del premio (días)</Label>
                    <Input className="mt-1 rounded-xl" value={form.reward_valid_days} onChange={(e) => setForm((f) => ({ ...f, reward_valid_days: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Tipo de premio</Label>
                    <select
                      className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-2"
                      value={form.reward_kind}
                      onChange={(e) => setForm((f) => ({ ...f, reward_kind: e.target.value }))}
                    >
                      <option value="percent">Porcentaje</option>
                      <option value="fixed">Valor fijo</option>
                      <option value="free_service">Servicio gratis</option>
                    </select>
                  </div>
                  <div>
                    <Label>Valor / %</Label>
                    <Input className="mt-1 rounded-xl" value={form.reward_value} onChange={(e) => setForm((f) => ({ ...f, reward_value: e.target.value }))} />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Servicio (si es gratis)</Label>
                    <select
                      className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-2"
                      value={form.reward_service_id}
                      onChange={(e) => setForm((f) => ({ ...f, reward_service_id: e.target.value }))}
                    >
                      <option value="">Ninguno</option>
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2 sm:col-span-2">
                    <Button className="rounded-xl" disabled={save.isPending} onClick={() => save.mutate()}>
                      Guardar
                    </Button>
                    <Button variant="outline" className="rounded-xl" onClick={() => setEditing(null)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{r.name}</p>
                    <p className="text-muted-foreground">
                      {r.min_months} meses · {r.min_visits} visitas · ciclo {r.cycle_months}m
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={r.active}
                      onCheckedChange={(v) => toggle.mutate({ id: r.id, active: v })}
                      aria-label="Regla activa"
                    />
                    <Button variant="outline" size="sm" className="rounded-lg" onClick={() => startEdit(r)}>
                      Editar
                    </Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-4 rounded-2xl bg-secondary/40 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nueva regla</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input className="rounded-xl sm:col-span-2" placeholder="Nombre" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Input className="rounded-xl" placeholder="Meses" value={newMonths} onChange={(e) => setNewMonths(e.target.value)} />
          <Input className="rounded-xl" placeholder="Visitas" value={newVisits} onChange={(e) => setNewVisits(e.target.value)} />
          <select
            className="h-10 rounded-xl border border-input bg-background px-2"
            value={newKind}
            onChange={(e) => setNewKind(e.target.value)}
          >
            <option value="percent">Porcentaje</option>
            <option value="fixed">Valor fijo</option>
            <option value="free_service">Servicio gratis</option>
          </select>
          <Input className="rounded-xl" placeholder="Valor" value={newVal} onChange={(e) => setNewVal(e.target.value)} />
          <Button
            className="rounded-xl sm:col-span-2"
            disabled={!newName.trim() || create.isPending}
            onClick={() => create.mutate()}
          >
            Agregar regla
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}

export function LoyaltyRewardsPanel({ rewards }: { rewards: Record<string, unknown>[] }) {
  const qc = useQueryClient();
  const owners = useQuery(ownersQuery);
  const services = useQuery(panelServicesQuery);
  const [customerId, setCustomerId] = useState("");
  const [label, setLabel] = useState("");
  const [dtype, setDtype] = useState("percent");
  const [dval, setDval] = useState("10");
  const [days, setDays] = useState("30");
  const [svc, setSvc] = useState("");
  const [appliesTo, setAppliesTo] = useState("both");

  const issue = useMutation({
    mutationFn: () =>
      issueLoyaltyReward({
        customer_id: customerId,
        label: label.trim(),
        discount_type: dtype,
        discount_value: Number(dval) || 0,
        free_service_id: svc || null,
        valid_days: Number(days) || 30,
        applies_to: appliesTo,
      }),
    onSuccess: async () => {
      toast.success("Beneficio emitido");
      setLabel("");
      await qc.invalidateQueries({ queryKey: ["loyalty-program"] });
      await qc.invalidateQueries({ queryKey: ["promotions-summary"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => patchLoyaltyReward(id, "cancelled"),
    onSuccess: async () => {
      toast.success("Beneficio cancelado");
      await qc.invalidateQueries({ queryKey: ["loyalty-program"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusLabel = (s: string) =>
    ({ available: "Disponible", used: "Usado", expired: "Vencido", cancelled: "Cancelado", pending: "Pendiente" }[s] || s);

  const list = rewards.map((r) => ({
    id: String(r.id),
    status: String(r.status),
    label: String(r.label),
    customer_name: String(r.customer_name || "—"),
    expires_at: r.expires_at ? String(r.expires_at) : null,
    applies_to: r.applies_to ? String(r.applies_to) : "both",
    discount_type: r.discount_type ? String(r.discount_type) : undefined,
    discount_value: r.discount_value != null ? Number(r.discount_value) : undefined,
  })) as Reward[];

  const clientes = (owners.data ?? []).filter((o) => o.system_key !== "mostrador");

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/5 via-background to-secondary/30 p-4 sm:p-5">
          <h2 className="font-display text-lg font-bold text-primary">Beneficios personales</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Un beneficio es un premio <strong>para un cliente concreto</strong> (compensación, regalo manual o premio por
            fidelización). No es un código público: el cliente lo elige al pagar en mostrador o al cerrar una cita.
          </p>
          <div className="mt-3 rounded-xl border border-border/80 bg-background/80 p-3 text-sm">
            <p className="font-semibold text-primary">Ejemplo</p>
            <p className="mt-1 text-muted-foreground">
              Ana cumple 12 meses y 8 visitas → emitís &quot;Baño premium de regalo&quot; válido 30 días,{" "}
              <strong>solo servicios</strong>. Si compra un collar en vitrina, ese ítem no recibe el descuento.
            </p>
          </div>
        </div>
        <SectionCard title="Beneficios emitidos">
          {list.length ? (
            <ul className="space-y-2 text-sm">
              {list.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border p-3 shadow-sm"
                >
                  <span>
                    {r.customer_name} · {r.label}
                    <span className="ml-2 text-xs text-muted-foreground">{statusLabel(r.status)}</span>
                    <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase">
                      {APPLIES_TO_LABEL[r.applies_to || "both"] || r.applies_to}
                    </span>
                  </span>
                  {r.status === "available" ? (
                    <Button variant="ghost" size="sm" onClick={() => cancel.mutate(r.id)}>
                      Cancelar
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <Empty message="Todavía no hay beneficios emitidos." />
          )}
        </SectionCard>
      </div>
      <SectionCard title="Emitir beneficio">
        <p className="mb-3 text-sm text-muted-foreground">
          El alcance define sobre qué parte de la venta se calcula el descuento.
        </p>
        <div className="space-y-3 text-sm">
          <div>
            <Label>Cliente</Label>
            <select
              className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-2"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">Elegir…</option>
              {clientes.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.full_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Nombre del beneficio</Label>
            <Input className="mt-1 rounded-xl" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Baño premium de regalo" />
          </div>
          <div>
            <Label>Tipo</Label>
            <select
              className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-2"
              value={dtype}
              onChange={(e) => setDtype(e.target.value)}
            >
              <option value="percent">Porcentaje</option>
              <option value="fixed">Valor fijo</option>
              <option value="free_service">Servicio gratis</option>
            </select>
          </div>
          <div>
            <Label>Valor</Label>
            <Input className="mt-1 rounded-xl" value={dval} onChange={(e) => setDval(e.target.value)} />
          </div>
          {dtype === "free_service" ? (
            <div>
              <Label>Servicio</Label>
              <select
                className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-2"
                value={svc}
                onChange={(e) => setSvc(e.target.value)}
              >
                <option value="">Elegir…</option>
                {(services.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div>
            <Label>Aplica a</Label>
            <select
              className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-2"
              value={appliesTo}
              onChange={(e) => setAppliesTo(e.target.value)}
            >
              <option value="both">Servicios y vitrina</option>
              <option value="services">Solo servicios del spa</option>
              <option value="store">Solo productos de vitrina</option>
            </select>
          </div>
          <div>
            <Label>Vigencia (días)</Label>
            <Input className="mt-1 rounded-xl" value={days} onChange={(e) => setDays(e.target.value)} />
          </div>
          <Button
            className="w-full rounded-xl"
            disabled={!customerId || !label.trim() || issue.isPending}
            onClick={() => issue.mutate()}
          >
            Emitir
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
