import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cop } from "@/lib/format";

export type VisitStartPayload = {
  price: number;
  medicated_declared?: boolean;
  colorimetry_declared?: boolean;
  visit_care_lines?: {
    inventory_item_id: string;
    quantity: number;
    material_role: "medicated" | "dye";
  }[];
};

type ConfirmServicePriceDialogProps = {
  open: boolean;
  petName?: string;
  defaultPrice?: number | null;
  saving?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (payload: VisitStartPayload) => void;
};

export function ConfirmServicePriceDialog({
  open,
  petName,
  defaultPrice,
  saving,
  onOpenChange,
  onConfirm,
}: ConfirmServicePriceDialogProps) {
  const [value, setValue] = useState("");

  useEffect(() => {
    if (!open) return;
    setValue(
      defaultPrice != null && Number(defaultPrice) > 0
        ? String(Math.round(Number(defaultPrice)))
        : "",
    );
  }, [open, defaultPrice]);

  const priceOk = Number.isFinite(Number(value)) && Number(value) >= 0 && value.trim() !== "";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onOpenChange(false);
      }}
    >
      <DialogContent className="flex max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-lg flex-col gap-0 overflow-hidden rounded-3xl p-0">
        <div className="bg-gradient-to-br from-primary/12 via-blush/40 to-background px-6 pb-4 pt-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/80">
            En proceso
          </p>
          <h2 className="mt-1 font-display text-xl font-bold text-primary">Confirmá el valor</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Al pasar a En proceso, el cliente va a ver este monto
            {petName ? ` para ${petName}` : ""}. Medicado, tinte y vitrina se cobran con lo que
            ya cargaste en insumos — no hace falta declarar sí/no.
          </p>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-6 py-5">
          <Label>Valor del servicio (COP)</Label>
          <Input
            className="h-11 rounded-xl"
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/[^\d]/g, ""))}
            placeholder="Ej. 65000"
          />
          {priceOk ? <p className="text-xs text-muted-foreground">{cop(Number(value))}</p> : null}
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-border px-6 py-4">
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
            Volver
          </Button>
          <Button
            type="button"
            className="rounded-xl"
            disabled={saving || !priceOk}
            onClick={() => {
              if (!priceOk) return;
              onConfirm({ price: Number(value) });
            }}
          >
            {saving ? "Guardando…" : "Confirmar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
