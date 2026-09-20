import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cop } from "@/lib/format";
import type { InventoryItem } from "@/lib/spa-queries";
import {
  VisitCareDeclareFields,
  type VisitCareDraftLine,
} from "@/components/visit-care-fields";

export type VisitCareLinePayload = {
  inventory_item_id: string;
  quantity: number;
  material_role: "medicated" | "dye";
};

export type VisitStartPayload = {
  price: number;
  medicated_declared: boolean;
  colorimetry_declared: boolean;
  visit_care_lines: VisitCareLinePayload[];
};

type ConfirmServicePriceDialogProps = {
  open: boolean;
  petName?: string;
  defaultPrice?: number | null;
  saving?: boolean;
  usesMedicated?: boolean;
  usesColorimetry?: boolean;
  inventory?: InventoryItem[];
  onOpenChange: (open: boolean) => void;
  onConfirm: (payload: VisitStartPayload) => void;
};

function parseRoleLines(
  declared: boolean | null,
  lines: VisitCareDraftLine[],
  role: "medicated" | "dye",
): VisitCareLinePayload[] | null {
  if (declared !== true) return [];
  if (!lines.length) return null;
  const out: VisitCareLinePayload[] = [];
  for (const line of lines) {
    const qty = Number(line.quantity);
    if (!Number.isFinite(qty) || qty <= 0) return null;
    out.push({
      inventory_item_id: line.inventory_item_id,
      quantity: qty,
      material_role: role,
    });
  }
  return out;
}

export function ConfirmServicePriceDialog({
  open,
  petName,
  defaultPrice,
  saving,
  usesMedicated,
  usesColorimetry,
  inventory = [],
  onOpenChange,
  onConfirm,
}: ConfirmServicePriceDialogProps) {
  const [value, setValue] = useState("");
  const [medicated, setMedicated] = useState<boolean | null>(null);
  const [colorimetry, setColorimetry] = useState<boolean | null>(null);
  const [medLines, setMedLines] = useState<VisitCareDraftLine[]>([]);
  const [dyeLines, setDyeLines] = useState<VisitCareDraftLine[]>([]);

  useEffect(() => {
    if (!open) return;
    setValue(
      defaultPrice != null && Number(defaultPrice) > 0
        ? String(Math.round(Number(defaultPrice)))
        : "",
    );
    setMedicated(null);
    setColorimetry(null);
    setMedLines([]);
    setDyeLines([]);
  }, [open, defaultPrice]);

  const medParsed = parseRoleLines(medicated, medLines, "medicated");
  const dyeParsed = parseRoleLines(colorimetry, dyeLines, "dye");
  const lines =
    medParsed == null || dyeParsed == null ? null : [...medParsed, ...dyeParsed];
  const priceOk = Number.isFinite(Number(value)) && Number(value) >= 0 && value.trim() !== "";
  const answered = medicated !== null && colorimetry !== null && lines != null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onOpenChange(false);
      }}
    >
      <DialogContent className="flex max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-2xl flex-col gap-0 overflow-hidden rounded-3xl p-0">
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4 pt-6">
          <h2 className="font-display text-xl font-bold text-primary">Confirmá el valor</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Al pasar a En proceso, el cliente va a ver este monto
            {petName ? ` para ${petName}` : ""}. Medicado y tinte se cobran aparte al precio de
            venta, en cualquier servicio.
          </p>
          {usesMedicated || usesColorimetry ? (
            <p className="mt-2 text-[12px] text-muted-foreground">
              Alistamiento de este servicio:
              {usesMedicated ? " medicado" : ""}
              {usesMedicated && usesColorimetry ? " y" : ""}
              {usesColorimetry ? " colorimetría" : ""}. Igual hay que confirmarlo ahora.
            </p>
          ) : (
            <p className="mt-2 text-[12px] text-muted-foreground">
              Aunque el servicio no traiga medicado ni tinte en la receta, podés cargarlos ahora
              si se usaron.
            </p>
          )}
          <div className="mt-4 space-y-2">
            <Label>Valor del servicio (COP)</Label>
            <Input
              className="h-11 rounded-xl"
              inputMode="numeric"
              value={value}
              onChange={(e) => setValue(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="Ej. 65000"
            />
            {priceOk ? (
              <p className="text-xs text-muted-foreground">{cop(Number(value))}</p>
            ) : null}
          </div>
          <div className="mt-4">
            <VisitCareDeclareFields
              inventory={inventory}
              medicated={medicated}
              colorimetry={colorimetry}
              medLines={medLines}
              dyeLines={dyeLines}
              onMedicated={setMedicated}
              onColorimetry={setColorimetry}
              onMedLines={setMedLines}
              onDyeLines={setDyeLines}
            />
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-border px-6 py-4">
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
            Volver
          </Button>
          <Button
            type="button"
            className="rounded-xl"
            disabled={saving || !priceOk || !answered}
            onClick={() => {
              if (!priceOk || medicated === null || colorimetry === null || lines == null) return;
              onConfirm({
                price: Number(value),
                medicated_declared: medicated,
                colorimetry_declared: colorimetry,
                visit_care_lines: lines,
              });
            }}
          >
            {saving ? "Guardando…" : "Confirmar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
