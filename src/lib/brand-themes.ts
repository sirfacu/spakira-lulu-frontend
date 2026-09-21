export const SHORT_NAME_MAX = 12;
export const BRAND_NAME_MAX = 16;
export const DESCRIPTOR_MAX = 48;

export const BRAND_THEME_IDS = [
  "kira-default",
  "pink-pastel",
  "rose",
  "sky",
  "navy",
  "green-pastel",
  "warm-yellow",
] as const;

export type BrandThemeId = (typeof BRAND_THEME_IDS)[number];

export const DEFAULT_THEME_ID: BrandThemeId = "kira-default";

export const THEME_SAVED_KEY = "kira-theme-saved";
export const THEME_PREVIEW_KEY = "kira-theme-preview";
export const THEME_PREVIEW_EVENT = "kira-theme-preview-change";

export type BrandTheme = {
  id: BrandThemeId;
  label: string;
  swatches: {
    primary: string;
    accent: string;
    background: string;
    surface: string;
  };
};

export const BRAND_THEMES: BrandTheme[] = [
  {
    id: "kira-default",
    label: "Morado KIRA",
    swatches: {
      primary: "oklch(0.44 0.145 302)",
      accent: "oklch(0.63 0.2 349)",
      background: "oklch(0.985 0.008 320)",
      surface: "oklch(1 0 0)",
    },
  },
  {
    id: "pink-pastel",
    label: "Rosa pastel",
    swatches: {
      primary: "oklch(0.55 0.16 350)",
      accent: "oklch(0.68 0.12 20)",
      background: "oklch(0.99 0.012 350)",
      surface: "oklch(1 0 0)",
    },
  },
  {
    id: "rose",
    label: "Rojo pastel",
    swatches: {
      primary: "oklch(0.48 0.16 25)",
      accent: "oklch(0.62 0.18 15)",
      background: "oklch(0.99 0.012 20)",
      surface: "oklch(1 0 0)",
    },
  },
  {
    id: "sky",
    label: "Azul cielo",
    swatches: {
      primary: "oklch(0.48 0.12 240)",
      accent: "oklch(0.62 0.12 200)",
      background: "oklch(0.985 0.012 230)",
      surface: "oklch(1 0 0)",
    },
  },
  {
    id: "navy",
    label: "Azul marino",
    swatches: {
      primary: "oklch(0.38 0.12 260)",
      accent: "oklch(0.55 0.11 230)",
      background: "oklch(0.97 0.015 255)",
      surface: "oklch(1 0 0)",
    },
  },
  {
    id: "green-pastel",
    label: "Verde pastel",
    swatches: {
      primary: "oklch(0.45 0.1 160)",
      accent: "oklch(0.58 0.12 145)",
      background: "oklch(0.985 0.012 155)",
      surface: "oklch(1 0 0)",
    },
  },
  {
    id: "warm-yellow",
    label: "Amarillo cálido",
    swatches: {
      primary: "oklch(0.52 0.12 75)",
      accent: "oklch(0.58 0.14 45)",
      background: "oklch(0.99 0.018 90)",
      surface: "oklch(1 0 0)",
    },
  },
];

export function isBrandThemeId(value: string): value is BrandThemeId {
  return (BRAND_THEME_IDS as readonly string[]).includes(value);
}

export function normalizeThemeId(value?: string | null): BrandThemeId {
  const raw = (value || "").trim().toLowerCase();
  return isBrandThemeId(raw) ? raw : DEFAULT_THEME_ID;
}

export function themeLabel(themeId?: string | null): string {
  const id = normalizeThemeId(themeId);
  return BRAND_THEMES.find((t) => t.id === id)?.label ?? "Morado KIRA";
}

function notifyThemePreview() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(THEME_PREVIEW_EVENT));
}

export function getThemePreview(): BrandThemeId | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(THEME_PREVIEW_KEY);
    return raw && isBrandThemeId(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function getSavedThemeHint(): BrandThemeId | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(THEME_SAVED_KEY);
    return raw && isBrandThemeId(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function persistSavedTheme(themeId: BrandThemeId) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(THEME_SAVED_KEY, themeId);
  } catch {
    /* private mode */
  }
}

export function applyThemeToDocument(themeId?: string | null, persistSaved = false) {
  if (typeof document === "undefined") return;
  const id = normalizeThemeId(themeId);
  document.documentElement.dataset.theme = id;
  if (persistSaved) persistSavedTheme(id);
}

export function setThemePreview(themeId: BrandThemeId) {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(THEME_PREVIEW_KEY, themeId);
  } catch {
    /* private mode */
  }
  applyThemeToDocument(themeId, false);
  notifyThemePreview();
}

export function clearThemePreview(savedThemeId?: string | null) {
  if (typeof sessionStorage !== "undefined") {
    try {
      sessionStorage.removeItem(THEME_PREVIEW_KEY);
    } catch {
      /* private mode */
    }
  }
  applyThemeToDocument(savedThemeId ?? getSavedThemeHint(), false);
  notifyThemePreview();
}

/** Preview (sesión) gana; si no, API; si no, último guardado en este navegador. */
export function resolveAppliedThemeId(savedFromApi?: string | null): BrandThemeId {
  return getThemePreview() ?? normalizeThemeId(savedFromApi ?? getSavedThemeHint());
}

/** Corre en <head> antes de React para que el loader ya vea data-theme. */
export const THEME_BOOT_SCRIPT = `try{var ok=${JSON.stringify([...BRAND_THEME_IDS])};var p=sessionStorage.getItem(${JSON.stringify(THEME_PREVIEW_KEY)});var s=localStorage.getItem(${JSON.stringify(THEME_SAVED_KEY)});var t=p||s;if(ok.indexOf(t)>=0)document.documentElement.setAttribute("data-theme",t);}catch(e){}`;
