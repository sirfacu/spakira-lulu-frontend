import type { LucideIcon } from "lucide-react";
import {
  Brush,
  Droplets,
  Ear,
  Flower2,
  Gift,
  Palette,
  PawPrint,
  Ribbon,
  Scissors,
  Sparkles,
  SprayCan,
  Wind,
} from "lucide-react";

/** Catálogo fijo de íconos para actividades de servicio (Lucide). No agregar sin revisión. */
export const SERVICE_ACTIVITY_ICON_OPTIONS = [
  { id: "droplets", label: "Baño / lavado" },
  { id: "wind", label: "Secado" },
  { id: "scissors", label: "Corte" },
  { id: "brush", label: "Cepillado / higiene" },
  { id: "sparkles", label: "Uñas / acabado" },
  { id: "ear", label: "Oídos" },
  { id: "flower-2", label: "Spa / ritual" },
  { id: "gift", label: "Accesorios incluidos" },
  { id: "palette", label: "Color" },
  { id: "paw-print", label: "Patitas / paw care" },
  { id: "spray-can", label: "Perfume / spray" },
  { id: "ribbon", label: "Moño / detalle" },
] as const;

export type ServiceActivityIconId = (typeof SERVICE_ACTIVITY_ICON_OPTIONS)[number]["id"];

const ICON_MAP: Record<ServiceActivityIconId, LucideIcon> = {
  droplets: Droplets,
  wind: Wind,
  scissors: Scissors,
  brush: Brush,
  sparkles: Sparkles,
  ear: Ear,
  "flower-2": Flower2,
  gift: Gift,
  palette: Palette,
  "paw-print": PawPrint,
  "spray-can": SprayCan,
  ribbon: Ribbon,
};

const ALLOWED = new Set<string>(SERVICE_ACTIVITY_ICON_OPTIONS.map((o) => o.id));

export function isAllowedActivityIcon(raw: string | null | undefined): raw is ServiceActivityIconId {
  const key = (raw ?? "").trim().toLowerCase();
  return ALLOWED.has(key);
}

export function normalizeActivityIcon(raw: string | null | undefined): ServiceActivityIconId | null {
  const key = (raw ?? "").trim().toLowerCase();
  if (!key) return null;
  if (ALLOWED.has(key)) return key as ServiceActivityIconId;
  const aliases: Record<string, ServiceActivityIconId> = {
    oidos: "ear",
    oídos: "ear",
    unas: "sparkles",
    uñas: "sparkles",
    bano: "droplets",
    baño: "droplets",
    accesorios: "gift",
    cepillado_dientes: "brush",
  };
  return aliases[key] ?? null;
}

export function activityIconComponent(raw: string | null | undefined): LucideIcon {
  const normalized = normalizeActivityIcon(raw) ?? (isAllowedActivityIcon(raw) ? raw : null);
  if (normalized) return ICON_MAP[normalized];
  return Sparkles;
}

export const SERVICE_ACTIVITY_ICON_HINT = SERVICE_ACTIVITY_ICON_OPTIONS.map((o) => o.id).join(", ");
