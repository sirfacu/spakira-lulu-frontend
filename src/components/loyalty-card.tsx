import { useQuery } from "@tanstack/react-query";
import { getLoyaltyCustomer, getLoyaltyMe } from "@/lib/spa-queries";
import { cop, shortDate } from "@/lib/format";

type Props = {
  customerId?: string | null;
  self?: boolean;
};

export function LoyaltyCard({ customerId, self = false }: Props) {
  const q = useQuery({
    queryKey: ["loyalty-customer", self ? "me" : customerId],
    queryFn: () => (self ? getLoyaltyMe() : getLoyaltyCustomer(customerId!)),
    enabled: self || !!customerId,
  });
  const d = q.data;
  if (q.isError) return null;

  return (
    <div className="mt-4 rounded-2xl border border-border p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Fidelización
      </p>
      {q.isLoading || !d ? (
        <p className="mt-2 text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <>
          <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Antigüedad</dt>
              <dd>
                {d.months} {d.months === 1 ? "mes" : "meses"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Visitas</dt>
              <dd>{d.visits}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Nivel</dt>
              <dd>{d.tier?.name || "Sin nivel"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Acumulado</dt>
              <dd>{cop(d.spend)}</dd>
            </div>
          </dl>
          {d.next_tier ? (
            <div className="mt-3">
              <p className="text-xs text-muted-foreground">
                {d.visits_remaining} visitas para {d.next_tier.name}
              </p>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.min(100, d.progress_percent)}%` }}
                />
              </div>
            </div>
          ) : null}
          {d.available?.length ? (
            <ul className="mt-3 space-y-1 text-sm">
              {d.available.map((r) => (
                <li key={r.id} className="rounded-xl bg-secondary/60 px-3 py-2">
                  {r.label}
                  {r.expires_at ? (
                    <span className="ml-2 text-xs text-muted-foreground">
                      vence {shortDate(r.expires_at)}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">Sin beneficios disponibles.</p>
          )}
        </>
      )}
    </div>
  );
}
