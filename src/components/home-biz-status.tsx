import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock, MapPin, ChevronDown } from "lucide-react";
import {
  getPublicBusinessHours,
  type PublicBusinessHours,
} from "@/lib/spa-queries";
import { usePublicBusiness } from "@/components/legal-layout";
import { buildWhatsAppLink } from "@/lib/whatsapp-link";
import { cn } from "@/lib/utils";

function formatRange(open: string, close: string) {
  return `${open} – ${close}`;
}

function HoursDropdown({ hours }: { hours: PublicBusinessHours }) {
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
        className="inline-flex max-w-full items-center gap-1.5 rounded-xl px-2 py-1 text-left text-xs text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
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
              Horario de atención
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

/** Dirección + “abierto ahora” desde Configuración (público). */
export function HomeBizStatusBar() {
  const { data: biz } = usePublicBusiness();
  const hoursQ = useQuery({
    queryKey: ["business-hours-public"],
    queryFn: getPublicBusinessHours,
    staleTime: 60_000,
    retry: false,
  });

  const address = (biz?.address || "").trim();
  const hours = hoursQ.data;
  if (!address && !hours) return null;

  return (
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
      {address ? (
        <span className="inline-flex max-w-[14rem] items-center gap-1.5 truncate text-xs text-muted-foreground sm:max-w-xs">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
          <span className="truncate" title={address}>
            {address}
          </span>
        </span>
      ) : null}
      {hours ? <HoursDropdown hours={hours} /> : null}
    </div>
  );
}

/** Franja inferior del home: ubicación / horario / contacto desde config. */
export function HomeContactStrip() {
  const { data: biz } = usePublicBusiness();
  const hoursQ = useQuery({
    queryKey: ["business-hours-public"],
    queryFn: getPublicBusinessHours,
    staleTime: 60_000,
    retry: false,
  });

  const address = (biz?.address || "").trim();
  const whatsapp = (biz?.whatsapp || "").trim();
  const email = (biz?.contact_email || "").trim();
  const hours = hoursQ.data;
  const wa = whatsapp ? buildWhatsAppLink(whatsapp, "Hola Spa Kira, quiero agendar una cita") : null;

  if (!address && !hours && !whatsapp && !email) return null;

  const openDays = hours?.days.filter((d) => d.is_open) ?? [];
  const hoursSummary =
    openDays.length === 0
      ? null
      : openDays.every(
            (d) =>
              d.open_time === openDays[0].open_time &&
              d.close_time === openDays[0].close_time,
          )
        ? `${openDays.map((d) => d.label.slice(0, 3)).join(", ")} ${formatRange(openDays[0].open_time, openDays[0].close_time)}`
        : "Ver detalle en el horario de arriba";

  return (
    <section className="border-t border-border/60 bg-secondary/40 py-10">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 sm:grid-cols-3">
        <div>
          <p className="text-sm font-semibold text-primary">¿Dónde estamos?</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {address || "Dirección pendiente en Configuración"}
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold text-primary">Horario de atención</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {hoursSummary || "Horario pendiente en Configuración"}
          </p>
          {hours ? (
            <p
              className={cn(
                "mt-1 text-xs font-medium",
                hours.open_now ? "text-emerald-700" : "text-muted-foreground",
              )}
            >
              {hours.open_now ? "Abierto ahora" : hours.today.is_open ? "Cerrado ahora" : "Cerrado hoy"}
            </p>
          ) : null}
        </div>
        <div>
          <p className="text-sm font-semibold text-primary">Escríbenos</p>
          <div className="mt-2 space-y-1 text-sm text-muted-foreground">
            {email ? (
              <a className="block hover:text-primary" href={`mailto:${email}`}>
                {email}
              </a>
            ) : null}
            {wa ? (
              <a
                className="block font-medium text-primary hover:underline"
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp
              </a>
            ) : whatsapp ? (
              <p>{whatsapp}</p>
            ) : (
              <p>Contacto pendiente en Configuración</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
