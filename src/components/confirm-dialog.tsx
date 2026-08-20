import type { ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Sí, eliminar",
  cancelLabel = "Cancelar",
  pending,
  onConfirm,
  onOpenChange,
}: {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) {
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
          <div className="mt-7 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
            <Button
              variant="destructive"
              className="rounded-xl"
              disabled={pending}
              onClick={() => {
                onConfirm();
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
