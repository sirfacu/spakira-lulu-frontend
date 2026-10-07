import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_PRICE_NOTE,
  breedChargeQuoteLabel,
  breedChargeValueLabel,
} from "@/lib/service-pricing";
import { breedPriceQuotesQuery } from "@/lib/spa-queries";

export function BreedChargeQuote() {
  const quotes = useQuery(breedPriceQuotesQuery);
  const [breedId, setBreedId] = useState("");

  const options = useMemo(() => {
    return [...(quotes.data ?? [])].sort((a, b) => {
      const species = a.species.localeCompare(b.species, "es");
      if (species !== 0) return species;
      return a.breed_name.localeCompare(b.breed_name, "es");
    });
  }, [quotes.data]);

  const selected = options.find((row) => row.breed_id === breedId) ?? null;
  const value = breedChargeValueLabel(selected);
  const range = breedChargeQuoteLabel(selected);

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Cobro estimado por raza
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          El valor es el que se envía en el correo al agendar. El rango es solo una referencia
          para estimar el cobro.
        </p>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Raza</Label>
        <Select value={breedId} onValueChange={setBreedId}>
          <SelectTrigger className="h-10 rounded-xl">
            <SelectValue placeholder={quotes.isLoading ? "Cargando razas…" : "Elegí una raza"} />
          </SelectTrigger>
          <SelectContent>
            {options.map((row) => (
              <SelectItem key={row.breed_id} value={row.breed_id}>
                {row.breed_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {quotes.isError ? (
        <p className="text-xs text-destructive">No se pudo cargar la tarifa por raza.</p>
      ) : null}
      {selected && value ? (
        <div className="rounded-2xl border border-border/70 bg-secondary/35 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Valor de la raza
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-accent">{value}</p>
          {range && range !== value ? (
            <p className="mt-2 text-sm text-foreground">
              Rango de referencia: <span className="tabular-nums">{range}</span>
            </p>
          ) : null}
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{DEFAULT_PRICE_NOTE}</p>
        </div>
      ) : null}
    </section>
  );
}
