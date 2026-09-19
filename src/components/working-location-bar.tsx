import { MapPin } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { locationChrome } from "@/lib/working-location";
import type { SpaLocation } from "@/lib/spa-queries";

export function WorkingLocationBar({
  location,
  locations,
  onChange,
  noun = "Inventario",
  selectedId,
  allOption,
}: {
  location: SpaLocation | null;
  locations: SpaLocation[];
  onChange: (id: string) => void;
  noun?: string;
  selectedId?: string;
  allOption?: { id: string; label: string };
}) {
  if (!location && !allOption) return null;
  const selected = selectedId || location?.id || allOption?.id || "";
  const current = locations.find((x) => x.id === selected) ?? location;
  const viewingAll = Boolean(allOption && selected === allOption.id);
  const chrome = current && !viewingAll
    ? locationChrome(current.id)
    : {
        accent: "hsl(262 12% 46%)",
        glow: "hsla(262, 12%, 46%, 0.1)",
        ring: "hsla(262, 12%, 46%, 0.22)",
        wash: "hsla(262, 12%, 46%, 0.05)",
      };
  const many = locations.length > 1;
  const title = viewingAll ? allOption?.label : current?.name;
  return (
    <div
      className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3"
      style={{
        borderColor: chrome.ring,
        background: chrome.wash,
        boxShadow: `inset 3px 0 0 ${chrome.accent}, 0 0 0 1px ${chrome.glow}, 0 8px 24px -16px ${chrome.accent}`,
      }}
    >
      <span
        className="flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-sm"
        style={{ background: chrome.accent }}
        aria-hidden
      >
        <MapPin className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {noun} de
        </p>
        {many ? (
          <Select value={selected} onValueChange={onChange}>
            <SelectTrigger
              className="mt-0.5 h-auto w-full max-w-sm border-0 bg-transparent p-0 shadow-none focus:ring-0"
              aria-label="Elegir sede de trabajo"
            >
              <SelectValue placeholder={title} />
            </SelectTrigger>
            <SelectContent>
              {allOption ? (
                <SelectItem value={allOption.id}>{allOption.label}</SelectItem>
              ) : null}
              {locations.map((loc) => (
                <SelectItem key={loc.id} value={loc.id}>
                  {loc.name}
                  {loc.city && loc.city !== loc.name ? ` · ${loc.city}` : ""}
                  {loc.is_primary ? " · principal" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="truncate text-base font-semibold text-foreground">{title}</p>
        )}
      </div>
      {!viewingAll && current?.city ? (
        <span className="hidden text-xs text-muted-foreground sm:inline">{current.city}</span>
      ) : null}
    </div>
  );
}
