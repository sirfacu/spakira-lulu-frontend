import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Empty, SectionCard } from "@/components/ui-kit";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { cop } from "@/lib/format";
import {
  clientSurchargeAmount,
  mediumTariffAmount,
  TECH_SERVICES_LABEL,
} from "@/lib/payment-fee";
import {
  paymentMethodsAdminQuery,
  createPaymentMethod,
  patchPaymentMethod,
  deletePaymentMethod,
  type ClientChargeKind,
  type PaymentMethod,
} from "@/lib/spa-queries";
import { cn } from "@/lib/utils";

function clientEnabled(m: PaymentMethod) {
  return Boolean(m.client_charge_enabled ?? m.commission_pass_to_client);
}

export function ConfigPaymentMethodsPanel() {
  const qc = useQueryClient();
  const methods = useQuery(paymentMethodsAdminQuery);
  const list = methods.data ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => list.find((m) => m.id === selectedId) ?? list[0] ?? null,
    [list, selectedId],
  );

  const [label, setLabel] = useState("");
  const [requireEvidence, setRequireEvidence] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PaymentMethod | null>(null);
  const [estimateBase, setEstimateBase] = useState("50000");

  const [editPct, setEditPct] = useState("");
  const [editFixed, setEditFixed] = useState("");
  const [editClientOn, setEditClientOn] = useState(false);
  const [editKind, setEditKind] = useState<ClientChargeKind>("percent");
  const [editClientVal, setEditClientVal] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [editEvidence, setEditEvidence] = useState(false);

  useEffect(() => {
    if (!selected) return;
    setEditPct(String(selected.commission_percent ?? 0));
    setEditFixed(String(selected.commission_fixed ?? 0));
    setEditClientOn(clientEnabled(selected));
    setEditKind(selected.client_charge_kind === "fixed" ? "fixed" : "percent");
    setEditClientVal(String(selected.client_charge_value ?? 0));
    setEditActive(Boolean(selected.active));
    setEditEvidence(Boolean(selected.require_evidence));
  }, [selected?.id]);

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ["payment-methods"] });
  };

  const createMut = useMutation({
    mutationFn: () =>
      createPaymentMethod({
        label: label.trim(),
        require_evidence: requireEvidence,
        charges_commission: false,
        commission_percent: 0,
        commission_fixed: 0,
        client_charge_enabled: false,
        client_charge_kind: "percent",
        client_charge_value: 0,
      }),
    onSuccess: async (created) => {
      toast.success("Medio de pago agregado");
      setLabel("");
      setRequireEvidence(false);
      await invalidate();
      setSelectedId(created.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Sin medio seleccionado");
      const pct = Number(editPct || 0);
      const fixed = Number(editFixed || 0);
      const clientVal = Number(editClientVal || 0);
      if (editKind === "percent" && clientVal > 100) {
        throw new Error("El cargo al cliente en porcentaje no puede superar 100.");
      }
      const hasTariff = pct > 0 || fixed > 0;
      return patchPaymentMethod(selected.id, {
        require_evidence: editEvidence,
        active: editActive,
        charges_commission: hasTariff,
        commission_percent: pct,
        commission_fixed: fixed,
        client_charge_enabled: editClientOn,
        client_charge_kind: editKind,
        client_charge_value: editClientOn ? clientVal : 0,
      });
    },
    onSuccess: async () => {
      toast.success("Medio actualizado");
      await invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deletePaymentMethod(id),
    onSuccess: async () => {
      toast.success("Medio de pago eliminado");
      setPendingDelete(null);
      setSelectedId(null);
      await invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const estimateMethod: PaymentMethod | null = selected
    ? {
        ...selected,
        charges_commission: Number(editPct || 0) > 0 || Number(editFixed || 0) > 0,
        commission_percent: Number(editPct || 0),
        commission_fixed: Number(editFixed || 0),
        client_charge_enabled: editClientOn,
        client_charge_kind: editKind,
        client_charge_value: Number(editClientVal || 0),
      }
    : null;

  const baseNum = Math.max(0, Number(estimateBase) || 0);
  const tariffOn = mediumTariffAmount(baseNum, estimateMethod);
  const surchargeOn = clientSurchargeAmount(baseNum, estimateMethod);
  const absorbMethod = estimateMethod
    ? { ...estimateMethod, client_charge_enabled: false, commission_pass_to_client: false }
    : null;
  const tariffOff = mediumTariffAmount(baseNum, absorbMethod);

  return (
    <SectionCard title="Medios de pago">
      <p className="mb-4 text-sm text-muted-foreground">
        Cada medio tiene tarifa (% y fijo). El cargo al cliente es opcional: si está activo se suma
        al cobro; si no, la tarifa entra como costo del servicio.
      </p>

      <div className="mb-4 grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-[1fr_auto_auto]">
        <div className="space-y-2">
          <Label>Nuevo medio</Label>
          <Input
            className="h-11 rounded-xl"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ej. Daviplata"
          />
        </div>
        <label className="flex h-11 items-center gap-2 self-end text-sm">
          <Switch checked={requireEvidence} onCheckedChange={setRequireEvidence} />
          Evidencia
        </label>
        <div className="self-end">
          <Button
            className="h-11 w-full rounded-xl"
            disabled={!label.trim() || createMut.isPending}
            onClick={() => createMut.mutate()}
          >
            <Plus className="mr-2 h-4 w-4" />
            Agregar
          </Button>
        </div>
      </div>

      {list.length === 0 ? (
        <Empty message="Todavía no hay medios de pago." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.15fr]">
          <div className="space-y-2">
            {list.map((m) => {
              const on = selected?.id === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedId(m.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition-colors",
                    on
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card hover:bg-secondary/40",
                  )}
                >
                  <div>
                    <div className="font-medium">{m.label}</div>
                    <div className="font-mono text-xs text-muted-foreground">{m.code}</div>
                  </div>
                  <Switch
                    checked={m.active}
                    onCheckedChange={(v) => {
                      patchPaymentMethod(m.id, { active: v })
                        .then(() => invalidate())
                        .catch((e: Error) => toast.error(e.message));
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                </button>
              );
            })}
          </div>

          {selected ? (
            <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold">Editar · {selected.label}</h3>
                  <p className="font-mono text-xs text-muted-foreground">{selected.code}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10"
                  onClick={() => setPendingDelete(selected)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Porcentaje (%)</Label>
                  <Input
                    className="h-11 rounded-xl"
                    inputMode="decimal"
                    value={editPct}
                    onChange={(e) => setEditPct(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fijo (COP)</Label>
                  <Input
                    className="h-11 rounded-xl"
                    inputMode="decimal"
                    value={editFixed}
                    onChange={(e) => setEditFixed(e.target.value)}
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm font-medium">
                <Switch checked={editEvidence} onCheckedChange={setEditEvidence} />
                Requiere evidencia
              </label>
              <label className="flex items-center gap-2 text-sm font-medium">
                <Switch checked={editActive} onCheckedChange={setEditActive} />
                Activo
              </label>

              <div className="space-y-3 rounded-xl border border-border bg-secondary/30 p-3">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Switch checked={editClientOn} onCheckedChange={setEditClientOn} />
                  Cargo al cliente
                </label>
                {editClientOn ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={editKind === "percent" ? "default" : "outline"}
                        className="rounded-full"
                        onClick={() => setEditKind("percent")}
                      >
                        Porcentaje
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={editKind === "fixed" ? "default" : "outline"}
                        className="rounded-full"
                        onClick={() => setEditKind("fixed")}
                      >
                        Fijo
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <Label>{editKind === "percent" ? "Valor (%)" : "Valor (COP)"}</Label>
                      <Input
                        className="h-11 rounded-xl"
                        inputMode="decimal"
                        value={editClientVal}
                        onChange={(e) => setEditClientVal(e.target.value)}
                      />
                    </div>
                  </>
                ) : null}
              </div>

              <Button
                className="h-11 w-full rounded-xl"
                disabled={saveMut.isPending}
                onClick={() => saveMut.mutate()}
              >
                Guardar
              </Button>
            </div>
          ) : null}
        </div>
      )}

      {estimateMethod ? (
        <div className="mt-6 space-y-3 rounded-2xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold">Estimador</h3>
          <p className="text-xs text-muted-foreground">
            Probá con un monto de servicio. Usa los valores del editor (aunque aún no guardes).
          </p>
          <div className="max-w-[180px] space-y-2">
            <Label>Monto del servicio (COP)</Label>
            <Input
              className="h-11 rounded-xl"
              inputMode="decimal"
              value={estimateBase}
              onChange={(e) => setEstimateBase(e.target.value)}
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800/80">
                Con cargo al cliente
              </p>
              <dl className="mt-2 space-y-1">
                <div className="flex justify-between gap-2">
                  <dt>Adicional ({TECH_SERVICES_LABEL})</dt>
                  <dd className="font-semibold tabular-nums">
                    {cop(
                      clientSurchargeAmount(baseNum, {
                        ...estimateMethod,
                        client_charge_enabled: true,
                      }),
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Total cliente</dt>
                  <dd className="font-semibold tabular-nums">
                    {cop(
                      baseNum +
                        clientSurchargeAmount(baseNum, {
                          ...estimateMethod,
                          client_charge_enabled: true,
                        }),
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 text-emerald-900/70">
                  <dt>Costo del medio (tarifa)</dt>
                  <dd className="tabular-nums">{cop(tariffOn)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Margen del cargo</dt>
                  <dd className="font-semibold tabular-nums">
                    {cop(
                      clientSurchargeAmount(baseNum, {
                        ...estimateMethod,
                        client_charge_enabled: true,
                      }) - tariffOn,
                    )}
                  </dd>
                </div>
              </dl>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-800/80">
                Sin cargo al cliente
              </p>
              <dl className="mt-2 space-y-1">
                <div className="flex justify-between gap-2">
                  <dt>Adicional al cliente</dt>
                  <dd className="font-semibold tabular-nums">{cop(0)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Total cliente</dt>
                  <dd className="font-semibold tabular-nums">{cop(baseNum)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Costo del medio (tarifa)</dt>
                  <dd className="font-semibold tabular-nums">{cop(tariffOff)}</dd>
                </div>
                <div className="flex justify-between gap-2 text-amber-900/70">
                  <dt>Margen del cargo</dt>
                  <dd className="tabular-nums">{cop(-tariffOff)}</dd>
                </div>
              </dl>
            </div>
          </div>
          {editClientOn && tariffOn > 0 ? (
            <p className="text-xs text-muted-foreground">
              Tarifa del medio con este monto: {cop(tariffOn)}. Cargo al cliente actual:{" "}
              {cop(surchargeOn)}.
            </p>
          ) : null}
        </div>
      ) : null}

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="¿Eliminar medio de pago?"
        description={
          pendingDelete
            ? `Se quitará “${pendingDelete.label}”. Si ya hay ventas con este medio, desactivalo en vez de borrarlo.`
            : ""
        }
        confirmLabel="Eliminar"
        onConfirm={() => pendingDelete && deleteMut.mutate(pendingDelete.id)}
      />
    </SectionCard>
  );
}
