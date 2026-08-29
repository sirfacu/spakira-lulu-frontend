/** Secciones reordenables del home (header y footer quedan fijos). */

export const HOME_SECTION_IDS = ["hero", "news", "services", "videos"] as const;

export type HomeSectionId = (typeof HOME_SECTION_IDS)[number];

export const HOME_SECTION_LABELS: Record<HomeSectionId, string> = {
  hero: "Portada",
  news: "Novedades",
  services: "Servicios y precios",
  videos: "Testimonios",
};

export function isHomeSectionId(value: string): value is HomeSectionId {
  return (HOME_SECTION_IDS as readonly string[]).includes(value);
}

export function normalizeSectionOrder(raw?: string[] | null): HomeSectionId[] {
  const seen: HomeSectionId[] = [];
  for (const item of raw ?? []) {
    const sid = String(item || "").trim().toLowerCase();
    if (isHomeSectionId(sid) && !seen.includes(sid)) seen.push(sid);
  }
  for (const sid of HOME_SECTION_IDS) {
    if (!seen.includes(sid)) seen.push(sid);
  }
  return seen;
}
