import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeCategory } from "@/lib/service-material-role";
import { cop } from "@/lib/format";
import type { InventoryItem } from "@/lib/spa-queries";

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

type DraftLine = {
  inventory_item_id: string;
  name: string;
  quantity: string;
  unit_kind: string;
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

function itemsForRole(items: InventoryItem[], role: "medicated" | "dye") {
  const want = role === "medicated" ? "medicado" : "tinte";
  return items.filter((i) => normalizeCategory(i.category) === want);
}

function RoleBlock({
  title,
  hint,
  value,
  onChange,
  items,
  lines,
  onLines,
}: {
  title: string;
  hint?: string;
  value: boolean | null;
  onChange: (next: boolean) => void;
  items: InventoryItem[];
  lines: DraftLine[];
  onLines: (next: DraftLine[]) => void;
}) {
  const [pick, setPick] = useState("");
  return (
    <div className="space-y-2 rounded-xl border border-border p-3">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
      <div className="flex gap-2">
        <Button
          type="button"
          variant={value === false ? "default" : "outline"}
          className="h-9 rounded-xl"
          onClick={() => {
            onChange(false);
            onLines([]);
          }}
        >
          No
        </Button>
        <Button
          type="button"
          variant={value === true ? "default" : "outline"}
          className="h-9 rounded-xl"
          onClick={() => onChange(true)}
        >
          Sí
        </Button>
      </div>
      {value === true ? (
        <div className="space-y-2">
          <select
            className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
            value={pick}
            onChange={(e) => {
              const id = e.target.value;
              setPick("");
              const item = items.find((i) => i.id === id);
              if (!item) return;
              if (lines.some((l) => l.inventory_item_id === item.id)) return;
              onLines([
                ...lines,
                {
                  inventory_item_id: item.id,
                  name: item.name,
                  quantity: "",
                  unit_kind: item.unit_kind || "ml",
                },
              ]);
            }}
          >
            <option value="">Agregar producto</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          {lines.map((line) => (
            <div key={line.inventory_item_id} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-sm">{line.name}</span>
              <Input
                className="h-9 w-24 rounded-xl"
                inputMode="decimal"
                placeholder="qty"
                value={line.quantity}
                onChange={(e) =>
                  onLines(
                    lines.map((l) =>
                      l.inventory_item_id === line.inventory_item_id
                        ? { ...l, quantity: e.target.value.replace(/[^\d.]/g, "") }
                        : l,
                    ),
                  )
                }
              />
              <span className="w-8 text-xs text-muted-foreground">{line.unit_kind}</span>
              <Button
                type="button"
                variant="ghost"
                className="h-8 px-2"
                onClick={() =>
                  onLines(lines.filter((l) => l.inventory_item_id !== line.inventory_item_id))
                }
              >
                Quitar
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
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
  const [medLines, setMedLines] = useState<DraftLine[]>([]);
  const [dyeLines, setDyeLines] = useState<DraftLine[]>([]);

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

  const medItems = useMemo(() => itemsForRole(inventory, "medicated"), [inventory]);
  const dyeItems = useMemo(() => itemsForRole(inventory, "dye"), [inventory]);

  const parsedLines = (): VisitCareLinePayload[] | null => {
    const out: VisitCareLinePayload[] = [];
    if (medicated === true) {
      if (!medLines.length) return null;
      for (const line of medLines) {
        const qty = Number(line.quantity);
        if (!Number.isFinite(qty) || qty <= 0) return null;
        out.push({
          inventory_item_id: line.inventory_item_id,
          quantity: qty,
          material_role: "medicated",
        });
      }
    }
    if (colorimetry === true) {
      if (!dyeLines.length) return null;
      for (const line of dyeLines) {
        const qty = Number(line.quantity);
        if (!Number.isFinite(qty) || qty <= 0) return null;
        out.push({
          inventory_item_id: line.inventory_item_id,
          quantity: qty,
          material_role: "dye",
        });
      }
    }
    return out;
  };

  const lines = parsedLines();
  const priceOk = Number.isFinite(Number(value)) && Number(value) >= 0 && value.trim() !== "";
  const answered = medicated !== null && colorimetry !== null && lines != null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onOpenChange(false);
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto rounded-3xl p-6">
        <h2 className="font-display text-xl font-bold text-primary">Confirmá el valor</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Al pasar a En proceso, el cliente va a ver este monto
          {petName ? ` para ${petName}` : ""}. Medicado y tinte se cobran aparte al precio de
          venta.
        </p>
        {usesMedicated || usesColorimetry ? (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Alistamiento de este servicio:
            {usesMedicated ? " medicado" : ""}
            {usesMedicated && usesColorimetry ? " y" : ""}
            {usesColorimetry ? " colorimetría" : ""}. Igual hay que confirmarlo ahora.
          </p>
        ) : null}
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
        <div className="mt-4 space-y-3">
          <RoleBlock
            title="¿Usó medicado?"
            value={medicated}
            onChange={setMedicated}
            items={medItems}
            lines={medLines}
            onLines={setMedLines}
          />
          <RoleBlock
            title="¿Usó colorimetría?"
            value={colorimetry}
            onChange={setColorimetry}
            items={dyeItems}
            lines={dyeLines}
            onLines={setDyeLines}
          />
        </div>
        <div className="mt-5 flex justify-end gap-2">
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
