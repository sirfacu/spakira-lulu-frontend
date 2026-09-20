import { useEffect, useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Sí, eliminar",
  cancelLabel = "Cancelar",
  pending,
  reasonRequired,
  reasonLabel = "Por qué se hace este cambio (auditoría)",
  reasonMinLength = 8,
  onConfirm,
  onOpenChange,
}: {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
  reasonRequired?: boolean;
  reasonLabel?: string;
  reasonMinLength?: number;
  onConfirm: (reason?: string) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (open) setReason("");
  }, [open]);
  const reasonOk = !reasonRequired || reason.trim().length >= reasonMinLength;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="z-[60] max-w-md rounded-3xl p-8">
        <div className="flex flex-col items-center text-center">
          <div className="mb-5 grid h-28 w-28 place-items-center rounded-full bg-destructive/10 ring-4 ring-destructive/10">
            <Trash2 className="h-12 w-12 text-destructive" />
          </div>
          <h2 className="font-display text-2xl font-bold leading-snug text-primary">{title}</h2>
          {description ? (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
          {reasonRequired ? (
            <div className="mt-4 w-full text-left">
              <p className="mb-1.5 text-xs font-medium text-foreground">{reasonLabel}</p>
              <Textarea
                className="min-h-[88px] rounded-xl"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ej. el humano pidió no continuar; se cortó el servicio a las 16:10."
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Mínimo {reasonMinLength} caracteres. Queda en auditoría y el inventario vuelve con
                traza.
              </p>
            </div>
          ) : null}
          <div className="mt-7 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
            <Button
              variant="destructive"
              className="rounded-xl"
              disabled={pending || !reasonOk}
              onClick={() => {
                if (!reasonOk) return;
                onConfirm(reasonRequired ? reason.trim() : undefined);
                onOpenChange(false);
              }}
            >
              {confirmLabel}
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
              {cancelLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
