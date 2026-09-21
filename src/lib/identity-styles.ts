export const IDENTITY_FONTS = [
  { id: "script", label: "Script", sample: "Great Vibes", className: "font-script" },
  { id: "display", label: "Titular", sample: "Playfair", className: "font-display" },
  { id: "sans", label: "Texto", sample: "Poppins", className: "font-sans" },
] as const;

export type IdentityFontId = (typeof IDENTITY_FONTS)[number]["id"];

export const IDENTITY_COLOR_TOKENS = [
  { id: "accent", label: "Acento", swatch: "var(--accent)" },
  { id: "primary", label: "Primario", swatch: "var(--primary)" },
  { id: "foreground", label: "Texto", swatch: "var(--foreground)" },
  { id: "muted", label: "Suave", swatch: "var(--muted-foreground)" },
  { id: "gold", label: "Dorado", swatch: "var(--gold)" },
  { id: "blush", label: "Blush", swatch: "var(--blush-foreground)" },
] as const;

export type IdentityColorTokenId = (typeof IDENTITY_COLOR_TOKENS)[number]["id"];

export type IdentityLineId = "short_name" | "brand_name" | "descriptor";

export type IdentityLineStyle = {
  font: IdentityFontId;
  color: IdentityColorTokenId | string;
  bold: boolean;
  italic: boolean;
  uppercase: boolean;
};

export type IdentityStyles = Record<IdentityLineId, IdentityLineStyle>;

export const DEFAULT_IDENTITY_STYLES: IdentityStyles = {
  short_name: { font: "script", color: "accent", bold: false, italic: false, uppercase: false },
  brand_name: { font: "display", color: "primary", bold: true, italic: false, uppercase: true },
  descriptor: { font: "sans", color: "muted", bold: false, italic: false, uppercase: true },
};

const FONT_IDS = new Set<string>(IDENTITY_FONTS.map((f) => f.id));
const COLOR_TOKEN_IDS = new Set<string>(IDENTITY_COLOR_TOKENS.map((c) => c.id));
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function asBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const raw = value.trim().toLowerCase();
    if (raw === "true" || raw === "1" || raw === "yes" || raw === "on") return true;
    if (raw === "false" || raw === "0" || raw === "no" || raw === "off") return false;
  }
  return fallback;
}

function normalizeColor(value: unknown, fallback: string): string {
  const raw = String(value || "").trim();
  const token = raw.toLowerCase();
  if (COLOR_TOKEN_IDS.has(token)) return token;
  if (HEX_RE.test(raw)) return raw.toLowerCase();
  return fallback;
}

export function isIdentityColorToken(value: string): value is IdentityColorTokenId {
  return COLOR_TOKEN_IDS.has(value);
}

export function normalizeLineStyle(
  value: unknown,
  lineIdOrFallback: IdentityLineId | IdentityLineStyle,
): IdentityLineStyle {
  const base =
    typeof lineIdOrFallback === "string"
      ? { ...DEFAULT_IDENTITY_STYLES[lineIdOrFallback] }
      : { ...lineIdOrFallback };
  if (!value || typeof value !== "object") return base;
  const blob = value as Record<string, unknown>;
  const font = String(blob.font || "").trim().toLowerCase();
  if (FONT_IDS.has(font)) base.font = font as IdentityFontId;
  base.color = normalizeColor(blob.color, base.color);
  base.bold = asBool(blob.bold, base.bold);
  base.italic = asBool(blob.italic, base.italic);
  base.uppercase = asBool(blob.uppercase, base.uppercase);
  return base;
}

export function normalizeIdentityStyles(value: unknown): IdentityStyles {
  const blob = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    short_name: normalizeLineStyle(blob.short_name, "short_name"),
    brand_name: normalizeLineStyle(blob.brand_name, "brand_name"),
    descriptor: normalizeLineStyle(blob.descriptor, "descriptor"),
  };
}

const TOKEN_TEXT_CLASS: Record<IdentityColorTokenId, string> = {
  accent: "text-accent",
  primary: "text-primary",
  foreground: "text-foreground",
  muted: "text-muted-foreground",
  gold: "text-gold",
  blush: "text-blush-foreground",
};

const FONT_CLASS: Record<IdentityFontId, string> = {
  script: "font-script",
  display: "font-display",
  sans: "font-sans",
};

export function identityToneClassName(style: IdentityLineStyle): string {
  const colorClass = isIdentityColorToken(style.color) ? TOKEN_TEXT_CLASS[style.color] : "";
  return [
    FONT_CLASS[style.font],
    style.bold ? "font-bold" : "font-normal",
    style.italic ? "italic" : "",
    style.uppercase ? "uppercase" : "",
    colorClass,
  ]
    .filter(Boolean)
    .join(" ");
}

export function identityLineClassName(style: IdentityLineStyle, role: IdentityLineId): string {
  const size =
    role === "short_name"
      ? "text-lg"
      : role === "brand_name"
        ? "text-xl tracking-wide"
        : "mt-1 text-[10px] tracking-[0.14em]";
  return ["block truncate", identityToneClassName(style), size].filter(Boolean).join(" ");
}

export function identityLineColorStyle(style: IdentityLineStyle): { color: string } | undefined {
  if (isIdentityColorToken(style.color)) return undefined;
  return { color: style.color };
}

export function identityInputClassName(style: IdentityLineStyle): string {
  const colorClass = isIdentityColorToken(style.color) ? TOKEN_TEXT_CLASS[style.color] : "";
  return [
    FONT_CLASS[style.font],
    style.bold ? "font-bold" : "font-normal",
    style.italic ? "italic" : "",
    colorClass,
  ]
    .filter(Boolean)
    .join(" ");
}
