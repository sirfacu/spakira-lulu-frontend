import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { doseUnitLabel } from "@/lib/inventory-qty";

function qtyLabel(count: number, unitKind: string) {
  const kind = unitKind.toLowerCase();
  if (kind === "uso") return count === 1 ? "uso" : "usos";
  return doseUnitLabel(kind);
}
import {
  fetchAntipulgasConfig,
  saveAntipulgasConfig,
  type AntipulgasBand,
  type AntipulgasCoat,
  type InventoryItem,
} from "@/lib/spa-queries";

function bandLabel(band: AntipulgasBand) {
  const from = Number(band.weight_from_kg);
  const to = band.weight_to_kg == null ? null : Number(band.weight_to_kg);
  if (to == null) return `Desde ${from} kg`;
  if (from <= 0) return `Hasta ${to} kg`;
  return `De ${from} a ${to} kg`;
}

function parseMoney(raw: string) {
  const n = Number(raw.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

function parseFactor(raw: string) {
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

/** Regla de antipulgas en Inventario. La agenda solo muestra el nombre del manto. */
export function AntipulgasSettings({ items }: { items: InventoryItem[] }) {
  const [ready, setReady] = useState(false);
  const [itemId, setItemId] = useState("");
  const [bands, setBands] = useState<AntipulgasBand[]>([]);
  const [coats, setCoats] = useState<AntipulgasCoat[]>([]);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [factors, setFactors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void fetchAntipulgasConfig()
      .then((row) => {
        if (!alive) return;
        setItemId(row.inventory_item_id ?? "");
        setBands(row.bands);
        setCoats(row.coats);
        setPrices(
          Object.fromEntries(row.bands.map((band) => [String(band.weight_from_kg), String(band.base_price)])),
        );
        setFactors(
          Object.fromEntries(
            row.coats.map((coat) => [coat.code, String(coat.multiplier).replace(".", ",")]),
          ),
        );
        setReady(true);
      })
      .catch(() => {
        if (alive) setReady(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!ready) return null;

  const selected = items.find((item) => item.id === itemId);
  const unitKind = selected?.unit_kind || "uso";
  const options = [...items].sort((a, b) => a.name.localeCompare(b.name, "es"));

  async function save() {
    const nextBands = bands.map((band) => {
      const price = parseMoney(prices[String(band.weight_from_kg)] ?? "");
      return { ...band, base_price: price };
    });
    const nextCoats = coats.map((coat) => ({
      ...coat,
      multiplier: parseFactor(factors[coat.code] ?? ""),
    }));
    if (nextBands.some((band) => !Number.isFinite(band.base_price) || band.base_price < 0)) {
      toast.error("Revisá el precio base");
      return;
    }
    if (nextCoats.some((coat) => !Number.isFinite(coat.multiplier) || coat.multiplier <= 0)) {
      toast.error("Revisá el factor de cada manto");
      return;
    }
    if (!itemId) {
      toast.error("Elegí el producto que se descuenta");
      return;
    }
    setBusy(true);
    try {
      const saved = await saveAntipulgasConfig({
        inventory_item_id: itemId,
        bands: nextBands.map((band) => ({
          weight_from_kg: band.weight_from_kg,
          base_price: band.base_price,
          uses: band.uses,
        })),
        coats: nextCoats.map((coat) => ({ code: coat.code, multiplier: coat.multiplier })),
      });
      setBands(saved.bands);
      setCoats(saved.coats);
      toast.success("Antipulgas guardado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card-soft mt-6 p-4">
      <h2 className="text-sm font-semibold text-foreground">Antipulgas</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        No es un servicio del listado. En la agenda se cobra aparte y el producto se descuenta del inventario.
      </p>
      <div className="mt-3 max-w-md space-y-1">
        <Label>Producto que se descuenta</Label>
        <select
          className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
          value={itemId}
          onChange={(e) => setItemId(e.target.value)}
        >
          <option value="">Elegí un producto</option>
          {options.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
              {item.category ? ` · ${item.category}` : ""}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-4 space-y-2">
        {bands.map((band) => (
          <div key={band.weight_from_kg} className="flex flex-wrap items-center gap-3">
            <p className="w-36 text-sm text-foreground">{bandLabel(band)}</p>
            <p className="w-16 text-sm text-muted-foreground">
              {band.uses} {qtyLabel(band.uses, unitKind)}
            </p>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              Base
              <Input
                className="h-9 w-28"
                inputMode="decimal"
                value={prices[String(band.weight_from_kg)] ?? ""}
                onChange={(e) =>
                  setPrices((prev) => ({ ...prev, [String(band.weight_from_kg)]: e.target.value }))
                }
              />
            </label>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        {coats.map((coat) => (
          <label key={coat.code} className="space-y-1">
            <span className="block text-sm text-foreground">{coat.name}</span>
            <Input
              className="h-9 w-24"
              inputMode="decimal"
              aria-label={`Factor ${coat.name}`}
              value={factors[coat.code] ?? ""}
              onChange={(e) => setFactors((prev) => ({ ...prev, [coat.code]: e.target.value }))}
            />
          </label>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        El factor multiplica el precio base. En la agenda solo se ve el nombre del manto.
      </p>
      <Button type="button" className="mt-3 rounded-xl" disabled={busy} onClick={() => void save()}>
        Guardar antipulgas
      </Button>
    </section>
  );
}
