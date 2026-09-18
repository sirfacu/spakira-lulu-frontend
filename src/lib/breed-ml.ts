/** Ml de mezcla (listos para usar) que el perfil de raza admite. */
export const MIX_ML_STEPS = [10, 20, 30, 40, 50, 60] as const;

export function snapMixMl(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(Number(value)) || Number(value) <= 0) return null;
  const n = Number(value);
  if (n > 60) return 60;
  let best: number = MIX_ML_STEPS[0];
  let dist = Math.abs(n - best);
  for (const step of MIX_ML_STEPS) {
    const d = Math.abs(n - step);
    if (d < dist) {
      best = step;
      dist = d;
    }
  }
  return best;
}
