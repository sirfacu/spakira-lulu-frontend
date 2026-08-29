import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ConfirmServicePriceDialogProps = {
  open: boolean;
  petName?: string;
  defaultPrice?: number | null;
  saving?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (price: number) => void;
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

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onOpenChange(false);
      }}
    >
      <DialogContent className="max-w-md rounded-3xl p-6">
        <h2 className="font-display text-xl font-bold text-primary">Confirmá el valor</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Al pasar a En proceso, el cliente va a ver este monto
          {petName ? ` para ${petName}` : ""}. Validalo según la mascota.
        </p>
        <div className="mt-4 space-y-2">
          <Label>Valor del servicio (COP)</Label>
          <Input
            className="h-11 rounded-xl"
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/[^\d]/g, ""))}
            placeholder="Ej. 65000"
          />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
            Volver
          </Button>
          <Button
            type="button"
            className="rounded-xl"
            disabled={saving}
            onClick={() => {
              const n = Number(value);
              if (!Number.isFinite(n) || n < 0 || value.trim() === "") return;
              onConfirm(n);
            }}
          >
            {saving ? "Guardando…" : "Confirmar valor"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
