/** Deep link wa.me a partir del teléfono configurado en el negocio. */
export function buildWhatsAppLink(
  phone: string | null | undefined,
  message: string,
  defaultCountryCode = "57",
): string | null {
  const raw = (phone ?? "").trim();
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length <= 10) {
    digits = `${defaultCountryCode}${digits}`;
  }
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export type OwnerChatTarget = {
  id?: string | null;
  full_name?: string | null;
  whatsapp?: string | null;
  phone?: string | null;
  pii_masked?: boolean | null;
};

export type OwnerChatLink = {
  owner_id?: string;
  full_name?: string | null;
  link: string;
};

/** No arma wa.me si el número viene ofuscado (staff colaborador). */
export function ownerChatLinks(
  owners: OwnerChatTarget[],
  messageFor: (ownerName: string) => string,
): { items: OwnerChatLink[]; missing: { owner_id?: string; full_name?: string | null }[] } {
  const items: OwnerChatLink[] = [];
  const missing: { owner_id?: string; full_name?: string | null }[] = [];
  for (const owner of owners) {
    const name = owner.full_name || "";
    const row = { owner_id: owner.id ?? undefined, full_name: owner.full_name ?? null };
    if (owner.pii_masked) {
      missing.push(row);
      continue;
    }
    const link = buildWhatsAppLink(owner.whatsapp || owner.phone, messageFor(name));
    if (link) items.push({ ...row, link });
    else missing.push(row);
  }
  return { items, missing };
}

export function appointmentOwnerChatMessage(opts: {
  ownerName?: string | null;
  petName?: string | null;
  serviceName?: string | null;
  whenLabel?: string | null;
}): string {
  const owner = (opts.ownerName || "").trim();
  const pet = (opts.petName || "tu mascota").trim();
  const service = (opts.serviceName || "servicio").trim();
  const when = (opts.whenLabel || "").trim();
  const whenBit = when ? ` el ${when}` : "";
  return (
    `Hola ${owner}! Confirmamos la cita de ${pet} ` +
    `en Spa Kira: ${service}${whenBit}. Cualquier cambio avísanos. — Spa Kira`
  );
}
