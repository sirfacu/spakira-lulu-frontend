import type { SpaLocation } from "@/lib/spa-queries";

export const WORKING_LOCATION_KEY = "spakira_working_location_id";

const PALETTE = [
  {
    accent: "hsl(262 42% 48%)",
    glow: "hsla(262, 42%, 48%, 0.14)",
    ring: "hsla(262, 42%, 48%, 0.28)",
    wash: "hsla(262, 42%, 48%, 0.06)",
  },
  {
    accent: "hsl(168 38% 32%)",
    glow: "hsla(168, 38%, 32%, 0.14)",
    ring: "hsla(168, 38%, 32%, 0.26)",
    wash: "hsla(168, 38%, 32%, 0.07)",
  },
  {
    accent: "hsl(28 72% 42%)",
    glow: "hsla(28, 72%, 42%, 0.14)",
    ring: "hsla(28, 72%, 42%, 0.26)",
    wash: "hsla(28, 72%, 42%, 0.07)",
  },
  {
    accent: "hsl(340 46% 42%)",
    glow: "hsla(340, 46%, 42%, 0.12)",
    ring: "hsla(340, 46%, 42%, 0.24)",
    wash: "hsla(340, 46%, 42%, 0.06)",
  },
] as const;

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

export function locationChrome(id: string) {
  return PALETTE[hashId(id) % PALETTE.length];
}

export function readWorkingLocationId(): string {
  try {
    return localStorage.getItem(WORKING_LOCATION_KEY) || "";
  } catch {
    return "";
  }
}

export function writeWorkingLocationId(id: string) {
  try {
    localStorage.setItem(WORKING_LOCATION_KEY, id);
  } catch {
    /* ignore quota / private mode */
  }
}

export function pickWorkingLocation(
  locations: SpaLocation[],
  currentId?: string,
): SpaLocation | null {
  const active = locations.filter((x) => x.active);
  if (!active.length) return null;
  const wanted = (currentId || "").trim();
  return active.find((x) => x.id === wanted) ?? active.find((x) => x.is_primary) ?? active[0];
}
