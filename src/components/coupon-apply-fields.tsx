import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  couponsQuery,
  validatePromotion,
  type PromoValidate,
  type Promotion,
} from "@/lib/spa-queries";
import { cop } from "@/lib/format";

type Props = {
  subtotal: number;
  customerId?: string | null;
  petId?: string | null;
  serviceIds?: string[];
  value: PromoValidate | null;
  onChange: (v: PromoValidate | null) => void;
  rewards?: { id: string; label: string }[];
  /** Si true, muestra listado/buscador aunque el subtotal sea 0 (p. ej. en Gestionar cita). */
  browseOnly?: boolean;
  initialCode?: string | null;
};

function discountLabel(p: Promotion) {
  if (p.discount_type === "percent") return `${p.discount_value}%`;
  return cop(p.discount_value);
}

export function CouponApplyFields({
  subtotal,
  customerId,
  petId,
  serviceIds,
  value,
  onChange,
  rewards = [],
  browseOnly = false,
  initialCode = null,
}: Props) {
  const [code, setCode] = useState(initialCode || "");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const coupons = useQuery({ ...couponsQuery, staleTime: 30_000 });

  useEffect(() => {
    if (initialCode) setCode(initialCode);
  }, [initialCode]);

  const filtered = useMemo(() => {
    const rows = (coupons.data ?? []).filter((p) => p.status === "active" && p.requires_code && p.code);
    const q = search.trim().toLowerCase();
    if (q.length < 3) return rows.slice(0, 8);
    return rows
      .filter((p) => {
        const hay = `${p.code || ""} ${p.name} ${p.description || ""}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 20);
  }, [coupons.data, search]);

  const apply = async (extra?: { loyalty_reward_id?: string; code?: string }) => {
    const typed = (extra?.code ?? code).trim();
    if (!extra?.loyalty_reward_id && !typed) {
      toast.error("Ingresá un código");
      return;
    }
    if (browseOnly && subtotal <= 0 && !extra?.loyalty_reward_id) {
      onChange({
        valid: true,
        code: typed.toUpperCase(),
        name: typed.toUpperCase(),
        discount_type: "percent",
        discount_value: 0,
        discount_amount: 0,
        message: "Cupón seleccionado; se valida al cobrar.",
      } as PromoValidate);
      setCode(typed.toUpperCase());
      toast.success(`Cupón ${typed.toUpperCase()} listo para cobrar`);
      return;
    }
    setBusy(true);
    try {
      const res = await validatePromotion({
        code: extra?.loyalty_reward_id ? undefined : typed,
        loyalty_reward_id: extra?.loyalty_reward_id,
        customer_id: customerId,
        pet_id: petId,
        service_ids: serviceIds,
        subtotal: Math.max(subtotal, 0.01),
      });
      if (!res.valid) {
        onChange(null);
        toast.error(res.message || "No se pudo aplicar");
        return;
      }
      onChange(res);
      if (res.code) setCode(res.code);
    } catch (e) {
      onChange(null);
      toast.error(e instanceof Error ? e.message : "No se pudo validar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 rounded-2xl border border-border bg-card p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Cupón o beneficio
      </p>
      <div className="flex gap-2">
        <Input
          className="h-10 rounded-xl uppercase"
          placeholder="Código"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <Button
          type="button"
          variant="outline"
          className="h-10 rounded-xl"
          disabled={busy || (!browseOnly && subtotal <= 0) || !code.trim()}
          onClick={() => void apply({ code })}
        >
          Aplicar
        </Button>
      </div>
      <Input
        className="h-9 rounded-xl"
        placeholder="Buscar cupón (mín. 3 letras)…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {search.trim().length > 0 && search.trim().length < 3 ? (
        <p className="text-[11px] text-muted-foreground">Escribí al menos 3 letras para filtrar.</p>
      ) : null}
      <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
        {filtered.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-left hover:bg-secondary/70"
              disabled={busy}
              onClick={() => void apply({ code: p.code || "" })}
            >
              <span className="min-w-0 truncate">
                <span className="font-mono text-xs font-semibold text-primary">{p.code}</span>
                <span className="ml-2 text-muted-foreground">{p.name}</span>
              </span>
              <span className="shrink-0 text-xs font-medium">{discountLabel(p)}</span>
            </button>
          </li>
        ))}
        {!filtered.length && (search.trim().length >= 3 || (coupons.data?.length ?? 0) === 0) ? (
          <li className="px-2 py-1 text-xs text-muted-foreground">Sin cupones activos.</li>
        ) : null}
      </ul>
      {rewards.length ? (
        <div className="flex flex-wrap gap-2">
          {rewards.map((r) => (
            <Button
              key={r.id}
              type="button"
              variant="secondary"
              className="h-8 rounded-lg text-xs"
              disabled={busy || (browseOnly && subtotal <= 0)}
              onClick={() => void apply({ loyalty_reward_id: r.id })}
            >
              {r.label}
            </Button>
          ))}
        </div>
      ) : null}
      {value?.valid ? (
        <p className="text-sm text-primary">
          {value.code || value.name} ·{" "}
          {value.discount_type === "percent" ? `${value.discount_value}%` : cop(value.discount_value ?? 0)}
          {value.discount_amount ? (
            <>
              {" · "}
              Ahorro: {cop(value.discount_amount ?? 0)}
            </>
          ) : null}
          <button
            type="button"
            className="ml-2 text-xs text-muted-foreground underline"
            onClick={() => onChange(null)}
          >
            Quitar
          </button>
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Las campañas automáticas (sin código) y el nivel de fidelización se aplican al registrar la venta.
        </p>
      )}
    </div>
  );
}
