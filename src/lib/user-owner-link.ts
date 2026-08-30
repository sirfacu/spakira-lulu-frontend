/** Cruce por correo entre ficha (owners) y cuenta de acceso (app_users). No fusiona tablas. */

export function emailKey(email: string | null | undefined): string {
  return (email || "").trim().toLowerCase();
}

export function indexByEmail<T extends { email?: string | null }>(rows: T[]): Map<string, T> {
  const m = new Map<string, T>();
  for (const r of rows) {
    const k = emailKey(r.email);
    if (k) m.set(k, r);
  }
  return m;
}
