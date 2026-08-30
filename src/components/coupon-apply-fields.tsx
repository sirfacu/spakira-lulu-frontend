import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { validatePromotion, type PromoValidate } from "@/lib/spa-queries";
import { cop } from "@/lib/format";

type Props = {
  subtotal: number;
  customerId?: string | null;
  petId?: string | null;
  serviceIds?: string[];
  value: PromoValidate | null;
  onChange: (v: PromoValidate | null) => void;
  rewards?: { id: string; label: string }[];
};

export function CouponApplyFields({
  subtotal,
  customerId,
  petId,
  serviceIds,
  value,
  onChange,
  rewards = [],
}: Props) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const apply = async (extra?: { loyalty_reward_id?: string; code?: string }) => {
    const typed = (extra?.code ?? code).trim();
    if (!extra?.loyalty_reward_id && !typed) {
      toast.error("Ingresá un código");
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
        subtotal,
      });
      if (!res.valid) {
        onChange(null);
        toast.error(res.message || "No se pudo aplicar");
        return;
      }
      onChange(res);
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
          disabled={busy || subtotal <= 0 || !code.trim()}
          onClick={() => void apply({ code })}
        >
          Aplicar
        </Button>
      </div>
      {rewards.length ? (
        <div className="flex flex-wrap gap-2">
          {rewards.map((r) => (
            <Button
              key={r.id}
              type="button"
              variant="secondary"
              className="h-8 rounded-lg text-xs"
              disabled={busy}
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
          {" · "}
          Ahorro: {cop(value.discount_amount ?? 0)}
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
          Las campañas automáticas (sin código) se aplican al registrar la venta.
        </p>
      )}
    </div>
  );
}
