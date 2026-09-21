import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock, MapPin, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import {
  getPublicBusinessHours,
  type PublicBusinessHours,
  type PublicLocation,
} from "@/lib/spa-queries";
import { usePublicBusiness } from "@/components/legal-layout";
import { buildWhatsAppLink } from "@/lib/whatsapp-link";
import { cn } from "@/lib/utils";
import { mapsEmbedSrc, publicLocationLabel } from "@/lib/location-display";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const HOME_LOC_KEY = "spakira_home_location_id";

function formatRange(open: string, close: string) {
  return `${open} – ${close}`;
}

function hoursSummary(hours?: PublicBusinessHours | null) {
  const openDays = hours?.days.filter((d) => d.is_open) ?? [];
  if (!openDays.length) return null;
  const same = openDays.every(
    (d) => d.open_time === openDays[0].open_time && d.close_time === openDays[0].close_time,
  );
  if (!same) return "Horario distinto por día";
  return `${openDays.map((d) => d.label.slice(0, 3)).join(", ")} ${formatRange(openDays[0].open_time, openDays[0].close_time)}`;
}

function HoursDropdown({
  hours,
  title = "Horario de atención",
}: {
  hours: PublicBusinessHours;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const today = hours.today;
  const statusLabel = !today.is_open
    ? "Cerrado hoy"
    : hours.open_now
      ? "Abierto ahora"
      : "Cerrado ahora";
  const range =
    today.is_open && today.open_time && today.close_time
      ? formatRange(today.open_time, today.close_time)
      : null;

  return (
    <div className="relative">
      <button
        type="button"
        className="inline-flex max-w-full shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-2 py-1 text-left text-xs text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Clock className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
        <span
          className={cn(
            "font-medium",
            hours.open_now ? "text-emerald-700" : "text-muted-foreground",
          )}
        >
          {statusLabel}
        </span>
        {range ? <span className="hidden sm:inline">{range}</span> : null}
        <ChevronDown className={cn("h-3.5 w-3.5 transition", open && "rotate-180")} />
      </button>
      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Cerrar horario"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-border bg-card p-3 shadow-lift">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {title}
            </p>
            <ul className="space-y-1.5 text-sm">
              {hours.days.map((d) => (
                <li key={d.weekday} className="flex justify-between gap-3">
                  <span className="text-muted-foreground">{d.label}</span>
                  <span className="font-medium text-foreground">
                    {d.is_open ? formatRange(d.open_time, d.close_time) : "Cerrado"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}
    </div>
  );
}

type HomeLocCtx = {
  biz: ReturnType<typeof usePublicBusiness>["data"];
  locations: PublicLocation[];
  selected: PublicLocation | null;
  pick: (id: string) => void;
  cycle: (dir: -1 | 1) => void;
};

const HomeLocationContext = createContext<HomeLocCtx | null>(null);

export function HomeLocationProvider({ children }: { children: ReactNode }) {
  const { data: biz } = usePublicBusiness();
  const locations = useMemo(() => {
    const listed = (biz?.locations ?? []).filter(Boolean);
    if (listed.length) return listed;
    if (!biz) return [] as PublicLocation[];
    return [
      {
        id: "primary",
        name: (biz.location_name || "Sede principal").trim() || "Sede principal",
        is_primary: true,
        phone: biz.phone || "",
        whatsapp: biz.whatsapp || "",
        show_address_public: biz.show_address_public !== false,
        address: biz.address || "",
        city: biz.city || "",
        region: biz.region || "",
        address_reference: biz.address_reference || "",
        maps_url: biz.maps_url || "",
      },
    ] as PublicLocation[];
  }, [biz]);

  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    if (!locations.length) return;
    const stored =
      typeof window !== "undefined" ? window.localStorage.getItem(HOME_LOC_KEY) : null;
    const match =
      locations.find((l) => l.id === stored) ??
      locations.find((l) => l.is_primary) ??
      locations[0];
    setSelectedId((prev) => (locations.some((l) => l.id === prev) ? prev : match.id));
  }, [locations]);

  const selected = locations.find((l) => l.id === selectedId) ?? locations[0] ?? null;

  const pick = (id: string) => {
    setSelectedId(id);
    if (typeof window !== "undefined") window.localStorage.setItem(HOME_LOC_KEY, id);
  };

  const cycle = (dir: -1 | 1) => {
    if (locations.length < 2 || !selected) return;
    const i = locations.findIndex((l) => l.id === selected.id);
    const next = locations[(i + dir + locations.length) % locations.length];
    if (next) pick(next.id);
  };

  return (
    <HomeLocationContext.Provider value={{ biz, locations, selected, pick, cycle }}>
      {children}
    </HomeLocationContext.Provider>
  );
}

function useHomeLocations() {
  const ctx = useContext(HomeLocationContext);
  if (!ctx) {
    throw new Error("HomeLocationProvider missing");
  }
  return ctx;
}

function LocationListSelect({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { locations, selected, pick } = useHomeLocations();
  if (locations.length < 2 || !selected) return null;
  return (
    <Select value={selected.id} onValueChange={pick}>
      <SelectTrigger
        aria-label="Elegir sede"
        className={cn(
          "min-w-0 rounded-full border-border bg-secondary/80 font-medium shadow-none",
          compact
            ? "h-8 w-[min(9.5rem,28vw)] px-2.5 text-[11px]"
            : "h-10 w-full max-w-xs rounded-xl px-3 text-sm",
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {locations.map((loc) => (
          <SelectItem key={loc.id} value={loc.id}>
            {loc.name}
            {loc.city && loc.city.trim().toLowerCase() !== loc.name.trim().toLowerCase()
              ? ` · ${loc.city}`
              : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Dirección + “abierto ahora” desde Configuración (público). */
export function HomeBizStatusBar() {
  const { locations, selected } = useHomeLocations();
  const hoursQ = useQuery({
    queryKey: ["business-hours-public", selected?.id ?? ""],
    queryFn: () =>
      selected?.hours
        ? Promise.resolve(selected.hours)
        : getPublicBusinessHours(selected && selected.id !== "primary" ? selected.id : undefined),
    enabled: !!selected,
    staleTime: 60_000,
    retry: false,
  });

  const addressLabel = selected
    ? publicLocationLabel({
        address: selected.address,
        city: selected.city,
        region: selected.region,
      })
    : "";
  const hours = selected?.hours ?? hoursQ.data;
  if (!addressLabel && !hours && locations.length < 2) return null;

  return (
    <div className="flex min-w-0 items-center justify-end gap-x-2 overflow-hidden sm:gap-x-3">
      <LocationListSelect compact />
      {addressLabel ? (
        <span className="inline-flex min-w-0 max-w-[11rem] items-center gap-1.5 text-xs text-muted-foreground sm:max-w-[14rem]">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
          <span className="truncate" title={addressLabel}>
            {addressLabel}
          </span>
        </span>
      ) : null}
      {hours ? (
        <HoursDropdown
          hours={hours}
          title={locations.length > 1 && selected ? selected.name : "Horario de atención"}
        />
      ) : null}
    </div>
  );
}

function LocationMapStage({ loc }: { loc: PublicLocation }) {
  const { locations, selected, pick, cycle } = useHomeLocations();
  const addressLabel = publicLocationLabel({
    address: loc.address,
    city: loc.city,
    region: loc.region,
  });
  const embed = mapsEmbedSrc(
    loc.maps_url,
    [loc.address, loc.city, loc.region].filter(Boolean).join(", "),
  );
  const many = locations.length > 1;

  return (
    <div>
      <p className="text-sm font-medium text-foreground">{loc.name}</p>
      {addressLabel ? (
        <p className="mt-1 text-sm text-muted-foreground">{addressLabel}</p>
      ) : null}
      {loc.address_reference ? (
        <p className="mt-1 text-xs text-muted-foreground">{loc.address_reference}</p>
      ) : null}
      {embed ? (
        <div className="relative mt-3 overflow-hidden rounded-2xl border border-border">
          <iframe
            title={`Mapa ${loc.name}`}
            src={embed}
            className="h-40 w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          {many ? (
            <div className="pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center justify-between px-1.5">
              <button
                type="button"
                aria-label="Sede anterior"
                className="pointer-events-auto grid h-9 w-9 place-items-center rounded-full border border-border bg-card/95 shadow-soft"
                onClick={() => cycle(-1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Sede siguiente"
                className="pointer-events-auto grid h-9 w-9 place-items-center rounded-full border border-border bg-card/95 shadow-soft"
                onClick={() => cycle(1)}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      {many ? (
        <div className="mt-2 flex justify-center gap-1.5">
          {locations.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-label={item.name}
              aria-current={selected?.id === item.id ? "true" : undefined}
              onClick={() => pick(item.id)}
              className={cn(
                "h-1.5 rounded-full transition",
                selected?.id === item.id ? "w-4 bg-primary" : "w-1.5 bg-border hover:bg-muted-foreground/40",
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Franja inferior del home: ubicación / horario / contacto desde config. */
export function HomeContactStrip() {
  const { biz, locations, selected } = useHomeLocations();
  const email = (biz?.contact_email || "").trim();
  const identityWa = (biz?.whatsapp || "").trim();
  const loc = selected ?? locations[0];

  const hasAnything = locations.some((item) => {
    const label = publicLocationLabel({
      address: item.address,
      city: item.city,
      region: item.region,
    });
    return label || item.phone || item.whatsapp || item.hours || email || identityWa;
  });
  if (!hasAnything || !loc) return null;

  const hours = loc.hours;
  const summary = hoursSummary(hours);

  return (
    <section className="border-t border-border/60 bg-secondary/40 py-10">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 sm:grid-cols-3">
        <div>
          <p className="text-sm font-semibold text-primary">¿Dónde estamos?</p>
          <div className="mt-2">
            <LocationMapStage loc={loc} />
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-primary">Horario de atención</p>
          {locations.length > 1 ? (
            <p className="mt-2 text-sm font-medium text-foreground">{loc.name}</p>
          ) : null}
          {summary ? (
            <p className={cn("text-sm text-muted-foreground", locations.length > 1 ? "mt-1" : "mt-2")}>
              {summary}
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Horario pendiente</p>
          )}
          {hours ? (
            <p
              className={cn(
                "mt-1 text-xs font-medium",
                hours.open_now ? "text-emerald-700" : "text-muted-foreground",
              )}
            >
              {hours.open_now
                ? "Abierto ahora"
                : hours.today.is_open
                  ? "Cerrado ahora"
                  : "Cerrado hoy"}
            </p>
          ) : null}
        </div>
        <div>
          <p className="text-sm font-semibold text-primary">Escríbenos</p>
          <div className="mt-2 space-y-3 text-sm text-muted-foreground">
            {email ? (
              <a className="block hover:text-primary" href={`mailto:${email}`}>
                {email}
              </a>
            ) : null}
            {locations.map((item) => {
              const phone = (item.phone || "").trim();
              const whatsapp = (item.whatsapp || (item.is_primary ? identityWa : "") || "").trim();
              const wa = whatsapp
                ? buildWhatsAppLink(whatsapp, `Hola Spa Kira (${item.name}), quiero agendar una cita`)
                : null;
              return (
                <div key={item.id}>
                  <p className="font-medium text-foreground">{item.name}</p>
                  {phone ? <p className="mt-0.5">{phone}</p> : null}
                  {wa ? (
                    <a
                      className="mt-0.5 block font-medium text-primary hover:underline"
                      href={wa}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      WhatsApp
                    </a>
                  ) : whatsapp ? (
                    <p className="mt-0.5">{whatsapp}</p>
                  ) : !phone ? (
                    <p className="mt-0.5 text-xs">Teléfono pendiente en Configuración</p>
                  ) : null}
                </div>
              );
            })}
            {!email &&
            !locations.some(
              (item) => item.phone || item.whatsapp || (item.is_primary && identityWa),
            ) ? (
              <p>Contacto pendiente en Configuración</p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
