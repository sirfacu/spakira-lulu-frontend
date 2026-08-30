import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Empty, SectionCard } from "@/components/ui-kit";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  paymentMethodsAdminQuery,
  createPaymentMethod,
  patchPaymentMethod,
  deletePaymentMethod,
  type PaymentMethod,
} from "@/lib/spa-queries";

export function ConfigPaymentMethodsPanel() {
  const qc = useQueryClient();
  const methods = useQuery(paymentMethodsAdminQuery);
  const [label, setLabel] = useState("");
  const [requireEvidence, setRequireEvidence] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PaymentMethod | null>(null);

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ["payment-methods"] });
  };

  const createMut = useMutation({
    mutationFn: () =>
      createPaymentMethod({
        label: label.trim(),
        require_evidence: requireEvidence,
      }),
    onSuccess: async () => {
      toast.success("Medio de pago agregado");
      setLabel("");
      setRequireEvidence(false);
      await invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const patchMut = useMutation({
    mutationFn: (input: { id: string; patch: Parameters<typeof patchPaymentMethod>[1] }) =>
      patchPaymentMethod(input.id, input.patch),
    onSuccess: async () => {
      await invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deletePaymentMethod(id),
    onSuccess: async () => {
      toast.success("Medio de pago eliminado");
      setPendingDelete(null);
      await invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const list = methods.data ?? [];

  return (
    <SectionCard title="Medios de pago">
      <p className="mb-4 text-sm text-muted-foreground">
        Al finalizar un servicio se elige el medio. Si requiere evidencia, hay que adjuntar o
        fotografiar el comprobante.
      </p>

      <div className="mb-6 grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <div className="space-y-2">
          <Label>Nuevo medio</Label>
          <Input
            className="h-11 rounded-xl"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ej. Daviplata"
          />
        </div>
        <label className="flex h-11 items-center gap-2 text-sm">
          <Switch checked={requireEvidence} onCheckedChange={setRequireEvidence} />
          Requiere evidencia
        </label>
        <Button
          className="h-11 rounded-xl"
          disabled={!label.trim() || createMut.isPending}
          onClick={() => createMut.mutate()}
        >
          <Plus className="mr-2 h-4 w-4" />
          Agregar
        </Button>
      </div>

      {list.length === 0 ? (
        <Empty message="Todavía no hay medios de pago." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-3 font-semibold">Medio</th>
                <th className="py-3 font-semibold">Código</th>
                <th className="py-3 font-semibold">Evidencia</th>
                <th className="py-3 font-semibold">Activo</th>
                <th className="py-3 text-right font-semibold"> </th>
              </tr>
            </thead>
            <tbody>
              {list.map((m) => (
                <tr key={m.id} className="border-b border-border/60 last:border-0">
                  <td className="py-3 font-medium">{m.label}</td>
                  <td className="py-3 font-mono text-xs text-muted-foreground">{m.code}</td>
                  <td className="py-3">
                    <Switch
                      checked={m.require_evidence}
                      onCheckedChange={(v) =>
                        patchMut.mutate({ id: m.id, patch: { require_evidence: v } })
                      }
                    />
                  </td>
                  <td className="py-3">
                    <Switch
                      checked={m.active}
                      onCheckedChange={(v) => patchMut.mutate({ id: m.id, patch: { active: v } })}
                    />
                  </td>
                  <td className="py-3 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10"
                      onClick={() => setPendingDelete(m)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
