/** Texto de cantidad amigable: cuánto sacar del envase + cómo preparar si hay dilución. */

export type MaterialQtyOpts = {
  quantity: number;
  quantity_unit?: string | null;
  mix_quantity?: number | null;
  dilution_product?: number | null;
  dilution_water?: number | null;
};

export type MaterialQtyParts = {
  primary: string;
  secondary?: string;
};

function hasDilutionBreakdown(opts: MaterialQtyOpts): {
  mix: number;
  qty: number;
  num: number;
  den: number;
  unit: string;
} | null {
  const unit = opts.quantity_unit || "ml";
  const qty = Number(opts.quantity) || 0;
  const mix = opts.mix_quantity != null ? Number(opts.mix_quantity) : null;
  const num = opts.dilution_product != null ? Number(opts.dilution_product) : null;
  const den = opts.dilution_water != null ? Number(opts.dilution_water) : null;

  const ok =
    mix != null &&
    mix > 0 &&
    num != null &&
    den != null &&
    den > 0 &&
    !(num === 1 && den === 1) &&
    Math.abs(mix - qty) > 0.0001;

  if (!ok) return null;
  return { mix, qty, num, den, unit };
}

function formatAmount(n: number, unit: string): string {
  const rounded = Math.abs(n - Math.round(n)) < 0.05 ? Math.round(n) : Math.round(n * 10) / 10;
  return `${rounded} ${unit}`;
}

/** Partes para UI en dos líneas (nombre + subtítulo). */
export function formatMaterialQtyParts(opts: MaterialQtyOpts): MaterialQtyParts {
  const unit = opts.quantity_unit || "ml";
  const qty = Number(opts.quantity) || 0;
  const dil = hasDilutionBreakdown(opts);

  if (dil && dil.qty > 0) {
    return {
      primary: `${formatAmount(dil.qty, dil.unit)} de producto`,
      secondary: `Prepará ${formatAmount(dil.mix, dil.unit)} (${dil.num} ${
        dil.num === 1 ? "parte" : "partes"
      } de producto + ${dil.den} de agua)`,
    };
  }

  if (qty > 0) {
    return { primary: formatAmount(qty, unit) };
  }
  return { primary: "" };
}

/** Una sola línea: primary · secondary (para listas compactas). */
export function formatMaterialQtyLabel(opts: MaterialQtyOpts): string {
  const { primary, secondary } = formatMaterialQtyParts(opts);
  if (!primary) return "";
  return secondary ? `${primary} · ${secondary}` : primary;
}

/** @deprecated Usar formatMaterialQtyLabel / formatMaterialQtyParts */
export function formatMixToConcentrate(opts: MaterialQtyOpts): string {
  return formatMaterialQtyLabel(opts);
}
