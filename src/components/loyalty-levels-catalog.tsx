import { useQuery } from "@tanstack/react-query";
import { SectionCard, Empty } from "@/components/ui-kit";
import { loyaltyCatalogQuery, type LoyaltyCatalogTier } from "@/lib/spa-queries";

function prizeLines(t: LoyaltyCatalogTier): string[] {
  const lines: string[] = [];
  const qty = t.free_service_qty || 0;
  const store = t.store_discount_percent || 0;
  const uses = Math.max(1, t.store_discount_uses || 1);
  if (qty > 0) {
    const vig =
      t.free_service_valid_days != null && t.free_service_valid_days > 0
        ? `vigencia ${t.free_service_valid_days} días`
        : "sin vencimiento";
    lines.push(`${qty === 1 ? "1 baño/servicio gratis" : `${qty} baños/servicios gratis`} · ${vig}`);
  }
  if (store > 0) {
    const vig =
      t.store_discount_valid_days != null && t.store_discount_valid_days > 0
        ? `vigencia ${t.store_discount_valid_days} días`
        : "sin vencimiento";
    lines.push(
      `${store}% en tienda · ${uses === 1 ? "1 uso" : `${uses} usos`} · ${vig}`,
    );
  }
  if (!lines.length) lines.push("Pronto más sorpresas en este nivel — seguí visitándonos");
  return lines;
}

export function LoyaltyLevelsCatalog() {
  const q = useQuery(loyaltyCatalogQuery);
  const tiers = q.data?.tiers ?? [];

  return (
    <SectionCard title="Premios por visitarnos">
      <p className="mb-3 text-sm text-muted-foreground">
        Cada visita suma. Vení al spa con tu peludo, acumulá y desbloqueá baños gratis y descuentos en la
        vitrina. ¡Te esperamos!
      </p>
      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : q.isError ? (
        <p className="text-sm text-muted-foreground">No se pudo cargar el catálogo.</p>
      ) : !tiers.length ? (
        <Empty message="Pronto vamos a publicar los niveles. Mientras tanto, ¡te esperamos en el spa!" />
      ) : (
        <ol className="space-y-3">
          {tiers.map((t, i) => (
            <li key={`${t.name}-${i}`} className="rounded-2xl border border-border bg-background p-4">
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-medium">{t.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t.min_visits} visita{t.min_visits === 1 ? "" : "s"}
                  {t.min_months ? ` · ${t.min_months} meses` : ""}
                </p>
              </div>
              <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
                {prizeLines(t).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </SectionCard>
  );
}
