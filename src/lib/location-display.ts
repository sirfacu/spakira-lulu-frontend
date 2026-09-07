/** Helpers de ubicación / mapa para Configuración y home público. */

export function publicLocationLabel(input: {
  address?: string | null;
  city?: string | null;
  region?: string | null;
}): string {
  const city = (input.city || "").trim();
  const region = (input.region || "").trim();
  const address = (input.address || "").trim();
  if (city && region) return `${city}, ${region}`;
  if (city) return city;
  if (region) return region;
  return address;
}

/** Embed de Google Maps a partir de URL o texto de búsqueda. */
export function mapsEmbedSrc(mapsUrl: string, fallbackQuery: string): string | null {
  const url = (mapsUrl || "").trim();
  const q = (fallbackQuery || "").trim();
  if (!url && !q) return null;
  if (url.includes("/maps/embed")) return url;
  const query = url || q;
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=15&output=embed`;
}
