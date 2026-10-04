import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cop } from "@/lib/format";
import {
  applyAntipulgas,
  clearAntipulgas,
  fetchAntipulgas,
  type AntipulgasBand,
  type AntipulgasCoat,
  type AntipulgasOffer,
} from "@/lib/spa-queries";

function previewCharge(
  weight: number,
  coat: AntipulgasCoat | undefined,
  bands: AntipulgasBand[],
) {
  const band = bands.find(
    (row) =>
      weight >= row.weight_from_kg &&
      (row.weight_to_kg == null || weight < row.weight_to_kg),
  );
  if (!band || !coat) return null;
  return {
    base: band.base_price,
    multiplier: coat.multiplier,
    charge: Math.round(band.base_price * coat.multiplier),
    uses: band.uses,
  };
}

/** Casilla de agenda. El manto cambia el cobro; el peso define cuántos usos salen. */
export function AntipulgasBox({
  appointmentId,
  canEdit,
  revision,
  onChanged,
  onInventoryItem,
}: {
  appointmentId: string;
  canEdit: boolean;
  revision: string;
  onChanged: () => void;
  onInventoryItem: (itemId: string | null, itemName: string | null) => void;
}) {
  const [offer, setOffer] = useState<AntipulgasOffer | null>(null);
  const [on, setOn] = useState(false);
  const [weight, setWeight] = useState("");
  const [coat, setCoat] = useState("corto");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void fetchAntipulgas(appointmentId)
      .then((row) => {
        if (!alive) return;
        setOffer(row);
        setOn(row.applied);
        setWeight(row.weight_kg != null ? String(row.weight_kg) : "");
        setCoat(row.coat_code || "corto");
        onInventoryItem(row.inventory_item_id, row.inventory_item_name);
      })
      .catch(() => {
        if (!alive) return;
        setOffer(null);
        onInventoryItem(null, null);
      });
    return () => {
      alive = false;
    };
  }, [appointmentId, revision, onInventoryItem]);

  const selectedCoat = offer?.coats.find((row) => row.code === coat) ?? offer?.coats[0];
  const preview = useMemo(() => {
    const kilos = Number(weight);
    if (!offer || !Number.isFinite(kilos) || kilos <= 0) return null;
    return previewCharge(kilos, selectedCoat, offer.bands);
  }, [offer, weight, selectedCoat]);

  if (!canEdit || !offer) return null;

  async function toggle(next: boolean) {
    setOn(next);
    if (next) return;
    setBusy(true);
    try {
      await clearAntipulgas(appointmentId);
      onChanged();
    } catch (err) {
      setOn(true);
      toast.error(err instanceof Error ? err.message : "No se pudo quitar");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    const kilos = Number(weight);
    if (!Number.isFinite(kilos) || kilos <= 0) {
      toast.error("Indicá el peso en kilos");
      return;
    }
    setBusy(true);
    try {
      const saved = await applyAntipulgas(appointmentId, {
        weight_kg: kilos,
        coat_code: coat,
      });
      toast.success(`${saved.label}: ${cop(saved.charge)}`);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo aplicar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-border/80 p-3">
      <label className="flex items-center gap-2 text-sm font-medium text-foreground">
        <input
          type="checkbox"
          className="h-4 w-4"
          checked={on}
          disabled={busy}
          onChange={(e) => void toggle(e.target.checked)}
        />
        Antipulgas
      </label>
      <p className="mt-1 text-xs text-muted-foreground">Se suma al cobro de la cita.</p>
      {on ? (
        <div className="mt-3 space-y-3">
          <div>
            <p className="text-xs text-muted-foreground">Peso (kg)</p>
            <Input
              className="mt-1 h-9 w-28"
              inputMode="decimal"
              value={weight}
              onChange={(e) => setWeight(e.target.value.replace(",", "."))}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {offer.coats.map((row) => (
              <Button
                key={row.code}
                type="button"
                size="sm"
                variant={coat === row.code ? "default" : "outline"}
                onClick={() => setCoat(row.code)}
              >
                {row.name}
              </Button>
            ))}
          </div>
          {preview ? (
            <p className="text-sm text-foreground">
              Cobro <span className="font-semibold">{cop(preview.charge)}</span>
              {" · "}
              {preview.uses}{" "}
              {(offer.unit_kind || "uso").toLowerCase() === "uso"
                ? preview.uses === 1
                  ? "uso"
                  : "usos"
                : offer.unit_kind || "uso"}
              {offer.unit_cost > 0
                ? ` · costo interno ${cop(Math.round(offer.unit_cost * preview.uses))}`
                : ""}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Indicá el peso para ver el cobro.</p>
          )}
          <Button type="button" size="sm" disabled={busy} onClick={() => void save()}>
            Aplicar
          </Button>
        </div>
      ) : null}
    </div>
  );
}
