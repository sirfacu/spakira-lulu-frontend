import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  fetchCommercialAddons,
  requestCommercialAddon,
  type CommercialAddon,
} from "@/lib/spa-queries";

/** Adicional comercial (domicilio, pañoleta a la venta). No es el consumo interno. */
export function CommercialAddonRequest({
  appointmentId,
  canRequest,
  onChanged,
}: {
  appointmentId: string;
  canRequest: boolean;
  onChanged: () => void;
}) {
  const [addons, setAddons] = useState<CommercialAddon[]>([]);
  const [addonId, setAddonId] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void fetchCommercialAddons()
      .then((rows) => {
        if (!alive) return;
        setAddons(rows);
        setAddonId(rows[0]?.id ?? "");
      })
      .catch(() => {
        if (alive) setAddons([]);
      });
    return () => {
      alive = false;
    };
  }, [appointmentId]);

  if (!canRequest || addons.length === 0) return null;
  const selected = addons.find((a) => a.id === addonId) ?? addons[0];
  const manual = selected?.price_mode === "manual";

  return (
    <div className="mt-3 rounded-xl border border-border/80 p-3">
      <p className="text-xs font-medium text-foreground">Adicional comercial</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Se suma al cobro. El consumo interno del servicio queda aparte.
      </p>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={selected?.id ?? ""}
          onChange={(e) => setAddonId(e.target.value)}
        >
          {addons.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
              {a.price_mode === "fixed" && a.price != null ? ` · $${Math.round(a.price)}` : " · precio a confirmar"}
            </option>
          ))}
        </select>
        {manual ? (
          <>
            <Input
              className="h-9 w-40"
              placeholder="Dirección"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            <Input
              className="h-9 w-40"
              placeholder="Nota"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </>
        ) : null}
        <Button
          type="button"
          size="sm"
          disabled={busy || !selected}
          onClick={() => {
            if (!selected) return;
            setBusy(true);
            void requestCommercialAddon(appointmentId, {
              addon_id: selected.id,
              address: address.trim() || undefined,
              note: note.trim() || undefined,
            })
              .then(() => {
                toast.success(
                  manual ? "Pedido. El precio queda por confirmar." : "Adicional agregado.",
                );
                setAddress("");
                setNote("");
                onChanged();
              })
              .catch((e: unknown) => {
                toast.error(e instanceof Error ? e.message : "No se pudo agregar");
              })
              .finally(() => setBusy(false));
          }}
        >
          Agregar
        </Button>
      </div>
    </div>
  );
}
