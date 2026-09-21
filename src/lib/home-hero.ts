import type { IdentityLineStyle } from "@/lib/identity-styles";
import { normalizeLineStyle } from "@/lib/identity-styles";

export const HERO_KICKER_MAX = 28;
export const HERO_TITLE_MAX = 40;
export const HERO_ACCENT_MAX = 22;
export const HERO_BODY_MAX = 220;

export type HomeHeroStyles = {
  kicker: IdentityLineStyle;
  title: IdentityLineStyle;
  title_accent: IdentityLineStyle;
  body: IdentityLineStyle;
};

export type HomeHero = {
  kicker: string;
  title: string;
  title_accent: string;
  body: string;
  image_url: string | null;
  styles: HomeHeroStyles;
};

export const DEFAULT_HERO_STYLES: HomeHeroStyles = {
  kicker: { font: "sans", color: "blush", bold: true, italic: false, uppercase: true },
  title: { font: "display", color: "primary", bold: true, italic: false, uppercase: false },
  title_accent: { font: "script", color: "accent", bold: false, italic: false, uppercase: false },
  body: { font: "sans", color: "muted", bold: false, italic: false, uppercase: false },
};

export const DEFAULT_HOME_HERO: HomeHero = {
  kicker: "Grooming canino y felino",
  title: "El spa donde tu mascota",
  title_accent: "se siente amada",
  body:
    "Grooming de lujo con productos hipoalergénicos, estilistas certificados y un trato paciente. Cada visita termina con moño, perfume y una foto de antes y después.",
  image_url: null,
  styles: DEFAULT_HERO_STYLES,
};

export function normalizeHomeHero(value: unknown): HomeHero {
  const blob = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const image = String(blob.image_url || "").trim() || null;
  const stylesBlob =
    blob.styles && typeof blob.styles === "object" ? (blob.styles as Record<string, unknown>) : {};
  const kicker = String(blob.kicker ?? DEFAULT_HOME_HERO.kicker).trim().slice(0, HERO_KICKER_MAX);
  const title = String(blob.title ?? DEFAULT_HOME_HERO.title).trim().slice(0, HERO_TITLE_MAX);
  const titleAccent = String(blob.title_accent ?? DEFAULT_HOME_HERO.title_accent)
    .trim()
    .slice(0, HERO_ACCENT_MAX);
  const body = String(blob.body ?? DEFAULT_HOME_HERO.body).trim().slice(0, HERO_BODY_MAX);
  return {
    kicker: kicker || DEFAULT_HOME_HERO.kicker,
    title: title || DEFAULT_HOME_HERO.title,
    title_accent: titleAccent,
    body: body || DEFAULT_HOME_HERO.body,
    image_url: image,
    styles: {
      kicker: normalizeLineStyle(stylesBlob.kicker, DEFAULT_HERO_STYLES.kicker),
      title: normalizeLineStyle(stylesBlob.title, DEFAULT_HERO_STYLES.title),
      title_accent: normalizeLineStyle(stylesBlob.title_accent, DEFAULT_HERO_STYLES.title_accent),
      body: normalizeLineStyle(stylesBlob.body, DEFAULT_HERO_STYLES.body),
    },
  };
}
