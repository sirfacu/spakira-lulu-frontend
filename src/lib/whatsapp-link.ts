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
