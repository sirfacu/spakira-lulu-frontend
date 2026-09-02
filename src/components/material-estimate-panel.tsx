import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import {
  fetchAppointmentMaterialEstimate,
  fetchMaterialEstimatePreview,
  patchAppointmentMaterialSelections,
  type MaterialEstimate,
} from "@/lib/spa-queries";
import { cop } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  serviceId: string;
  petId?: string;
  appointmentId?: string;
  compact?: boolean;
  /** full = agenda/admin; checkout = cierre de servicio (sin costos internos). */
  mode?: "full" | "checkout";
  /**
   * En checkout, el diálogo puede ubicar adicionales y insumos en distintos
   * lugares del layout.
   */
  checkoutPart?: "addons" | "supplies" | "all";
  /** Solo agendamiento (sin cita aún): selección local de adicionales. */
  draftSelections?: Record<string, boolean>;
  onDraftSelectionsChange?: (next: Record<string, boolean>) => void;
  /** Tras guardar selección en cita (sync extras cobrables). */
  onBillableChange?: () => void;
  /** Rango de precio sugerido (para mostrar junto al cobro del servicio). */
  onPriceHint?: (hint: { price_min?: number; price_max?: number } | null) => void;
};

function lineKey(l: { material_role: string; inventory_item_id?: string | null }) {
  return `${l.material_role}:${l.inventory_item_id ?? ""}`;
}

function qtyLabel(l: {
  quantity: number;
  quantity_unit: string;
  has_profile?: boolean;
}): string | null {
  if (l.quantity > 0) {
    if (l.quantity_unit === "ml" || l.quantity_unit === "g") {
      return `${l.quantity} ${l.quantity_unit}`;
    }
    return `${l.quantity} u`;
  }
  return null;
}

export function MaterialEstimatePanel({
  serviceId,
  petId,
  appointmentId,
  compact,
  mode = "full",
  checkoutPart = "all",
  draftSelections,
  onDraftSelectionsChange,
  onBillableChange,
  onPriceHint,
}: Props) {
  const [est, setEst] = useState<MaterialEstimate | null>(null);
  const [saving, setSaving] = useState(false);
  const [suppliesOpen, setSuppliesOpen] = useState(false);
  const isCheckout = mode === "checkout";

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

  useEffect(() => {
    if (!onPriceHint) return;
    if (!data?.price_hint) {
      onPriceHint(null);
      return;
    }
    onPriceHint({
      price_min: data.price_hint.price_min,
      price_max: data.price_hint.price_max,
    });
  }, [data?.price_hint, onPriceHint]);

  const addonOffers = useMemo(
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

  const selectedAddonTotal = useMemo(() => {
    return addonOffers.reduce((sum, l) => {
      if (!selections[l.material_role]) return sum;
      const charge =
        l.line_charge ??
        l.shoot_preview_charge ??
        (l.enabled ? l.line_cost * (l.shoot_markup ?? 1) : 0);
      return sum + Number(charge || 0);
    }, 0);
  }, [addonOffers, selections]);

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

  const showAddons =
    !isCheckout || checkoutPart === "all" || checkoutPart === "addons";
  const showSupplies =
    !isCheckout || checkoutPart === "all" || checkoutPart === "supplies";

  const addonsBlock =
    showAddons && addonOffers.length > 0 ? (
      <div className={cn("space-y-2", !isCheckout && "border-b border-border/60 pb-3")}>
        {!isCheckout ? (
          <p className="text-xs font-medium text-foreground">
            Adicionales — se suman al cobro de la cita
          </p>
        ) : (
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Adicionales
          </p>
        )}
        {addonOffers.map((l) => {
          const on = Boolean(selections[l.material_role]);
          const charge = l.shoot_preview_charge ?? l.line_charge;
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
                <span className="font-medium">
                  {l.display_label || l.staff_description || l.material_label}
                </span>
              </span>
              <span className="shrink-0 tabular-nums font-medium text-accent">
                {charge != null && charge > 0 ? cop(charge) : "—"}
              </span>
            </label>
          );
        })}
        {selectedAddonTotal > 0 ? (
          <div className="flex justify-between text-sm font-semibold text-accent">
            <span>Subtotal adicionales</span>
            <span>{cop(selectedAddonTotal)}</span>
          </div>
        ) : null}
      </div>
    ) : null;

  const suppliesCheckout =
    showSupplies && isCheckout && includedLines.length > 0 ? (
      <div className="rounded-xl border border-border/80">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm"
          onClick={() => setSuppliesOpen((o) => !o)}
        >
          <span className="font-medium text-foreground">Insumos usados</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              suppliesOpen && "rotate-180",
            )}
          />
        </button>
        {suppliesOpen ? (
          <ul className="space-y-1 border-t border-border/60 px-3 py-2.5 text-sm text-muted-foreground">
            {[...liquidLines, ...accessoryLines].map((l) => {
              const qty = qtyLabel(l);
              return (
                <li key={lineKey(l)}>
                  {l.display_label || l.staff_description || l.material_label}
                  {qty ? ` · ${qty}` : ""}
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    ) : null;

  if (isCheckout) {
    if (checkoutPart === "addons") {
      if (!addonsBlock) return null;
      return <div className="space-y-2">{addonsBlock}</div>;
    }
    if (checkoutPart === "supplies") {
      if (!suppliesCheckout) return null;
      return suppliesCheckout;
    }
    return (
      <div className="space-y-3">
        {addonsBlock}
        {suppliesCheckout}
      </div>
    );
  }

  return (
    <div
      className={
        compact
          ? "space-y-2 rounded-xl border border-border/80 bg-secondary/30 p-3"
          : "space-y-3 rounded-xl border border-border bg-secondary/20 p-4"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-primary">
          {addonOffers.length ? "Insumos y adicionales" : "Insumos estimados"}
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

      {!data.has_profile ? (
        <p className="text-xs text-amber-700">
          Sin perfil de consumo para la raza de esta mascota (ml y rango sugerido).
        </p>
      ) : null}

      {addonsBlock}

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
                    {qtyLabel(l) ? ` · ${qtyLabel(l)}` : ""}
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
