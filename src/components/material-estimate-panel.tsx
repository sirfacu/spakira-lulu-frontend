import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchAppointmentMaterialEstimate,
  fetchMaterialEstimatePreview,
  patchAppointmentMaterialSelections,
  type MaterialEstimate,
} from "@/lib/spa-queries";
import { cop } from "@/lib/format";
import { Button } from "@/components/ui/button";

type Props = {
  serviceId: string;
  petId?: string;
  appointmentId?: string;
  compact?: boolean;
  /** Solo agendamiento (sin cita aún): selección local de shoots. */
  draftSelections?: Record<string, boolean>;
  onDraftSelectionsChange?: (next: Record<string, boolean>) => void;
  /** Tras guardar selección en cita (sync extras cobrables). */
  onBillableChange?: () => void;
};

function lineKey(l: { material_role: string; inventory_item_id?: string | null }) {
  return `${l.material_role}:${l.inventory_item_id ?? ""}`;
}

export function MaterialEstimatePanel({
  serviceId,
  petId,
  appointmentId,
  compact,
  draftSelections,
  onDraftSelectionsChange,
  onBillableChange,
}: Props) {
  const [est, setEst] = useState<MaterialEstimate | null>(null);
  const [saving, setSaving] = useState(false);

  const estimateQ = useQuery({
    queryKey: ["material-estimate", appointmentId ?? "preview", serviceId, petId],
    queryFn: async () => {
      if (appointmentId) return fetchAppointmentMaterialEstimate(appointmentId);
      if (petId) return fetchMaterialEstimatePreview(serviceId, petId);
      return null;
    },
    enabled: Boolean(serviceId && (appointmentId || petId)),
  });

  useEffect(() => {
    if (estimateQ.data) setEst(estimateQ.data);
  }, [estimateQ.data]);

  const data = est ?? estimateQ.data;

  const shootOffers = useMemo(
    () => (data?.lines ?? []).filter((l) => l.offers_shoot),
    [data?.lines],
  );

  const includedLines = useMemo(
    () => (data?.lines ?? []).filter((l) => l.enabled && l.included_in_service),
    [data?.lines],
  );

  const liquidLines = useMemo(
    () => includedLines.filter((l) => !l.is_accessory),
    [includedLines],
  );

  const accessoryLines = useMemo(
    () => includedLines.filter((l) => l.is_accessory),
    [includedLines],
  );

  const selections = appointmentId ? (data?.selections ?? {}) : (draftSelections ?? {});

  const selectedShootTotal = useMemo(() => {
    return shootOffers.reduce((sum, l) => {
      if (!selections[l.material_role]) return sum;
      const charge =
        l.line_charge ??
        l.shoot_preview_charge ??
        (l.enabled ? l.line_cost * (l.shoot_markup ?? 1) : 0);
      return sum + Number(charge || 0);
    }, 0);
  }, [shootOffers, selections]);

  const includedTotal =
    data?.total_included_cost ?? data?.total_material_cost ?? 0;

  if (!serviceId || (!petId && !appointmentId)) return null;

  if (estimateQ.isLoading && !data) {
    return <p className="text-xs text-muted-foreground">Calculando insumos…</p>;
  }

  if (!data) return null;

  const setSelection = async (role: string, checked: boolean) => {
    if (!appointmentId) {
      const next = { ...selections, [role]: checked };
      onDraftSelectionsChange?.(next);
      return;
    }
    const next = { ...selections, [role]: checked };
    setSaving(true);
    try {
      const updated = await patchAppointmentMaterialSelections(appointmentId, next);
      setEst(updated);
      onBillableChange?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={
        compact
          ? "rounded-xl border border-border/80 bg-secondary/30 p-3 space-y-2"
          : "rounded-xl border border-border bg-secondary/20 p-4 space-y-3"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-primary">
          {shootOffers.length ? "Insumos y adicionales" : "Insumos estimados"}
        </h4>
        {data.price_hint?.price_min != null ? (
          <span className="text-xs text-muted-foreground">
            Servicio sugerido: {cop(data.price_hint.price_min)}
            {data.price_hint.price_max != null &&
            data.price_hint.price_max !== data.price_hint.price_min
              ? ` – ${cop(data.price_hint.price_max)}`
              : ""}
          </span>
        ) : null}
      </div>

      {data.pet_sex ? (
        <p className="text-xs text-muted-foreground">
          Sexo mascota: <span className="capitalize">{data.pet_sex}</span>
          {accessoryLines.length ? " · accesorios filtrados" : null}
        </p>
      ) : null}

      {!data.has_profile ? (
        <p className="text-xs text-amber-700">
          Sin perfil de consumo para la raza de esta mascota (ml y rango sugerido).
        </p>
      ) : null}

      {(data.warnings ?? []).map((w) => (
        <p key={w} className="text-xs text-amber-700">
          {w}
        </p>
      ))}

      {shootOffers.length > 0 ? (
        <div className="space-y-2 border-b border-border/60 pb-3">
          <p className="text-xs font-medium text-foreground">
            Adicionales por dosis (shoot) — se suman al cobro de la cita
          </p>
          {shootOffers.map((l) => {
            const on = Boolean(selections[l.material_role]);
            const charge = l.shoot_preview_charge ?? l.line_charge;
            const ml =
              l.quantity > 0
                ? l.quantity
                : data.has_profile
                  ? "según raza"
                  : "—";
            return (
              <label
                key={lineKey(l)}
                className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-border/80 px-3 py-2 text-sm"
              >
                <span className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={on}
                    disabled={saving}
                    onChange={(e) => void setSelection(l.material_role, e.target.checked)}
                  />
                  <span>
                    <span className="font-medium">
                      {l.display_label || l.staff_description || l.material_label}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {typeof ml === "number" ? `${ml} ml` : ml}
                      {l.shoot_markup ? ` · markup ×${l.shoot_markup}` : ""}
                    </span>
                  </span>
                </span>
                <span className="shrink-0 tabular-nums font-medium text-accent">
                  {charge != null && charge > 0 ? cop(charge) : "—"}
                </span>
              </label>
            );
          })}
          {selectedShootTotal > 0 ? (
            <div className="flex justify-between text-sm font-semibold text-accent">
              <span>Subtotal adicionales</span>
              <span>{cop(selectedShootTotal)}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {includedLines.length > 0 ? (
        <>
          <p className="text-xs text-muted-foreground">
            Costo interno informativo (no modifica precio al cliente)
          </p>
          {liquidLines.length > 0 ? (
            <ul className="space-y-1 text-sm">
              {liquidLines.map((l) => (
                <li key={lineKey(l)} className="flex justify-between gap-2">
                  <span>
                    {l.display_label || l.material_label}
                    {l.quantity_unit === "ml" || l.quantity_unit === "g"
                      ? ` · ${l.quantity} ${l.quantity_unit}`
                      : ""}
                  </span>
                  <span className="tabular-nums text-muted-foreground">{cop(l.line_cost)}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {accessoryLines.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs font-medium text-foreground">Accesorios incluidos</p>
              <ul className="space-y-1 text-sm">
                {accessoryLines.map((l) => (
                  <li key={lineKey(l)} className="flex justify-between gap-2">
                    <span>{l.display_label || l.material_label}</span>
                    <span className="tabular-nums text-muted-foreground">{cop(l.line_cost)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {includedTotal > 0 ? (
            <div className="flex justify-between border-t border-border/60 pt-2 text-sm font-medium text-muted-foreground">
              <span>Total costo interno</span>
              <span className="tabular-nums">{cop(includedTotal)}</span>
            </div>
          ) : null}
        </>
      ) : null}

      {appointmentId ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 px-2 text-xs"
          onClick={() => estimateQ.refetch()}
        >
          Recalcular
        </Button>
      ) : null}
    </div>
  );
}
