import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  appointmentsQuery,
  createAppointment,
  panelServicesQuery,
  petsQuery,
  weekSlotsQuery,
  getPublicLocations,
  updateAppointment,
  petAlreadyBooked,
  type Pet,
  type PetBookedConflict,
} from "@/lib/spa-queries";
import { WeekSlotGrid } from "@/components/week-slot-grid";
import {
  addDays,
  sexMark,
  speciesEmoji,
  speciesLabel,
  startOfWeekMonday,
  weekRangeLabel,
  ymd,
  slotWhenLabel,
} from "@/lib/client-agenda";
import { resolveMediaUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

const PET_PLACEHOLDER = "/images/kira-face-grey.png";
const DAY_SHORT = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"] as const;

function petPhoto(p: Pet | null | undefined) {
  const url = p?.photo_url ? resolveMediaUrl(p.photo_url) : PET_PLACEHOLDER;
  return url || PET_PLACEHOLDER;
}

function PetAvatar({ pet, size = "md" }: { pet: Pet | null; size?: "sm" | "md" | "lg" }) {
  const dim = size === "lg" ? "h-16 w-16" : size === "sm" ? "h-10 w-10" : "h-12 w-12";
  return (
    <img
      src={petPhoto(pet)}
      alt={pet?.name ?? "Mascota"}
      className={cn("rounded-full object-cover ring-2 ring-white shadow-soft", dim)}
    />
  );
}

function petBreed(pet: Pet) {
  return (pet.breed_name || pet.breed || "").trim();
}

function PetMeta({ pet, compact = false }: { pet: Pet; compact?: boolean }) {
  const mark = sexMark(pet.sex);
  const breed = petBreed(pet);
  return (
    <div className="min-w-0">
      <p className={cn("truncate font-semibold text-foreground", compact ? "text-sm" : "text-base")}>
        {pet.name}
        {mark ? ` ${mark}` : ""}
      </p>
      <p className="truncate text-xs text-muted-foreground">
        {speciesEmoji(pet.species)} {speciesLabel(pet.species)}
        {breed ? ` · ${breed}` : ""}
      </p>
    </div>
  );
}

export function ClientAgenda() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const search = useSearch({ from: "/_authenticated/panel/agenda" });
  const pets = useQuery(petsQuery);
  const services = useQuery(panelServicesQuery);
  const mine = useQuery(appointmentsQuery);
  const [anchor, setAnchor] = useState(() => startOfWeekMonday(new Date()));
  const [petId, setPetId] = useState("");
  const [mobileDay, setMobileDay] = useState(() => ymd(new Date()));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [book, setBook] = useState<{ date: string; hour: number } | null>(null);
  const [petConflict, setPetConflict] = useState<{
    conflict: PetBookedConflict;
    wantedStarts: string;
  } | null>(null);
  const [serviceId, setServiceId] = useState("");
  const [locationId, setLocationId] = useState("");
  const locationsQ = useQuery({
    queryKey: ["locations-public"],
    queryFn: getPublicLocations,
  });
  const activeLocations = locationsQ.data?.items ?? [];

  const list = pets.data ?? [];
  useEffect(() => {
    if (!petId && list[0]?.id) setPetId(list[0].id);
  }, [list, petId]);

  useEffect(() => {
    const sid = search.service;
    if (!sid) return;
    setServiceId(sid);
    void navigate({
      to: "/panel/agenda",
      search: { google: search.google, service: undefined, pet: search.pet },
      replace: true,
    });
  }, [search.service, search.google, search.pet, navigate]);

  useEffect(() => {
    const pid = search.pet;
    if (!pid) return;
    setPetId(pid);
    void navigate({
      to: "/panel/agenda",
      search: { google: search.google, service: search.service, pet: undefined },
      replace: true,
    });
  }, [search.pet, search.google, search.service, navigate]);

  useEffect(() => {
    if (!serviceId && services.data?.[0]?.id) setServiceId(services.data[0].id);
  }, [services.data, serviceId]);

  useEffect(() => {
    if (!activeLocations.length) return;
    const primary = activeLocations.find((x) => x.is_primary) ?? activeLocations[0];
    setLocationId((prev) => (activeLocations.some((x) => x.id === prev) ? prev : primary.id));
  }, [activeLocations]);

  const selected = list.find((p) => p.id === petId) ?? list[0] ?? null;
  const selectedService = (services.data ?? []).find((s) => s.id === serviceId) ?? null;
  const weekKey = ymd(anchor);
  const slotsQ = useQuery(weekSlotsQuery(weekKey, locationId || undefined));

  const nextAdventure = useMemo(() => {
    if (!selected) return null;
    const now = Date.now();
    const upcoming = (mine.data ?? [])
      .filter((a) => (a.pets?.id ?? a.pet_id) === selected.id && a.status !== "cancelada")
      .filter((a) => new Date(a.starts_at).getTime() >= now)
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    return upcoming[0] ?? null;
  }, [mine.data, selected]);

  const mineByBand = useMemo(() => {
    const map = new Map<string, { service: string }>();
    if (!selected) return map;
    for (const a of mine.data ?? []) {
      if ((a.pets?.id ?? a.pet_id) !== selected.id || a.status === "cancelada") continue;
      const d = new Date(a.starts_at);
      map.set(`${ymd(d)}-${d.getHours()}`, { service: a.services?.name || "Cita" });
    }
    return map;
  }, [mine.data, selected]);

  const createMut = useMutation({
    mutationFn: async () => {
      if (!selected || !book || !serviceId) throw new Error("Elegí mascota y servicio");
      const starts = new Date(`${book.date}T${String(book.hour).padStart(2, "0")}:00:00`);
      return createAppointment({
        pet_id: selected.id,
        service_id: serviceId,
        location_id: locationId || null,
        starts_at: starts.toISOString(),
        sync_google: false,
      });
    },
    onSuccess: () => {
      toast.success(`¡Listo! Reservamos el momento para ${selected?.name}.`);
      setBook(null);
      void qc.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (e: Error) => {
      const booked = petAlreadyBooked(e);
      if (booked && book) {
        const starts = new Date(`${book.date}T${String(book.hour).padStart(2, "0")}:00:00`);
        setPetConflict({ conflict: booked, wantedStarts: starts.toISOString() });
        setBook(null);
        return;
      }
      toast.error(e.message || "No se pudo agendar");
    },
  });

  const openBook = (date: string, hour: number) => {
    if (!selected) {
      toast.message("Primero elegí a tu peludito 🐾");
      return;
    }
    if (!serviceId) {
      toast.message("Elegí el servicio para consentirlo.");
      return;
    }
    setBook({ date, hour });
  };

  const hours = slotsQ.data?.hours ?? [];
  const days =
    (slotsQ.data?.days?.length ? slotsQ.data.days : null) ??
    Array.from({ length: 7 }, (_, i) => ({
      date: ymd(addDays(anchor, i)),
      weekday: i,
      label: DAY_SHORT[i],
      is_open: false,
      slots: hours.map((label) => ({
        hour: Number.parseInt(label.slice(0, 2), 10) || 0,
        label,
        status: "closed" as const,
        capacity: 0,
        used: 0,
        remaining: 0,
        occupied_kind: null,
      })),
    }));

  const goWeek = (n: number) => {
    const next = addDays(anchor, n * 7);
    setAnchor(next);
    setMobileDay(ymd(next));
  };

  const goToday = () => {
    setAnchor(startOfWeekMonday(new Date()));
    setMobileDay(ymd(new Date()));
  };

  return (
    <AppShell
      title="Agenda"
      subtitle={`${weekRangeLabel(anchor)} · Encuentra el momento perfecto para su próxima aventura.`}
    >
      {slotsQ.isError ? (
        <p className="mb-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          No se pudo cargar el horario del spa. Reintentá; no inventamos franjas 08–19.
        </p>
      ) : null}
      <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
        <aside className="space-y-4">
          <section className="rounded-3xl border border-border/60 bg-card p-4 shadow-soft">
            {selected ? (
              <>
                <div className="flex items-center gap-3">
                  <PetAvatar pet={selected} size="lg" />
                  <div className="min-w-0">
                    <PetMeta pet={selected} />
                    <Link
                      to="/panel/mascotas"
                      className="mt-1 inline-flex text-xs font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Ver perfil
                    </Link>
                  </div>
                </div>
                <div className="mt-4">
                  <PetPicker
                    pets={list}
                    selectedId={selected.id}
                    open={pickerOpen}
                    onOpenChange={setPickerOpen}
                    onSelect={(id) => {
                      setPetId(id);
                      setPickerOpen(false);
                    }}
                    onCreate={() => {
                      setPickerOpen(false);
                      void navigate({
                        to: "/panel/mascotas",
                        search: { alta: true, from: "agenda" },
                      });
                    }}
                  />
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Primero registrá una mascota para ver la agenda.{" "}
                <Link
                  to="/panel/mascotas"
                  search={{ alta: true, from: "agenda" }}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Crear mascota
                </Link>
              </p>
            )}

            <div className="mt-5 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Servicio</Label>
              <Select value={serviceId} onValueChange={setServiceId}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Elegí el consentimiento" />
                </SelectTrigger>
                <SelectContent>
                  {(services.data ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="mt-5 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Sede</Label>
              {activeLocations.length ? (
                <Select value={locationId} onValueChange={setLocationId}>
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue placeholder="Elegí la sede" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeLocations.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name}
                        {loc.city ? ` · ${loc.city}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm font-medium">Sede principal</p>
              )}
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Duración estimada</dt>
                <dd className="font-medium">{selectedService?.duration_min ?? 60} min</dd>
              </div>
              {nextAdventure ? (
                <div className="rounded-2xl bg-secondary/80 px-3 py-2">
                  <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Próxima aventura
                  </dt>
                  <dd className="text-sm font-semibold text-primary">
                    {nextAdventure.services?.name ?? "Cita"} 🛁
                  </dd>
                  <dd className="mt-0.5 text-xs text-muted-foreground">
                    {slotWhenLabel(
                      ymd(new Date(nextAdventure.starts_at)),
                      new Date(nextAdventure.starts_at).getHours(),
                    )}
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section className="rounded-3xl border border-border/60 bg-card p-4 shadow-soft">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Leyenda
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-mint" /> Disponible
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#f3b6c4]" /> Ocupado
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/25" /> Fuera de horario
              </li>
            </ul>
          </section>
        </aside>

        <div className="min-w-0 space-y-3">
          {slotsQ.isError ? (
            <p className="rounded-2xl bg-blush/80 px-4 py-3 text-sm text-blush-foreground">
              No pudimos cargar los horarios. Recargá en un momento.
            </p>
          ) : null}
          <WeekSlotGrid
            anchor={anchor}
            days={days}
            hours={hours}
            mobileDay={mobileDay}
            onMobileDay={setMobileDay}
            onWeek={goWeek}
            onToday={goToday}
            mineByBand={mineByBand}
            petName={selected?.name}
            onPick={openBook}
          />
          <p className="px-1 text-center text-xs text-muted-foreground">
            Cada turno representa una cita disponible
            {selected ? (
              <>
                {" "}
                para <span className="font-medium text-foreground">{selected.name}</span>
              </>
            ) : null}
            . Los horarios ocupados son de otros peluditos, sin datos de sus dueños.
          </p>
        </div>
      </div>

      <Dialog open={!!book} onOpenChange={(o) => !o && setBook(null)}>
        <DialogContent className="max-w-md rounded-3xl border-border/70 p-6">
          <DialogTitle className="font-display text-xl font-bold text-primary">
            {selected ? `¡Este horario está disponible para ${selected.name}!` : "Reservar"}
          </DialogTitle>
          <DialogDescription>
            {book ? slotWhenLabel(book.date, book.hour) : "Confirmá el servicio para completar la reserva."}
          </DialogDescription>
          <div className="space-y-2">
            <Label>Servicio</Label>
            <Select value={serviceId} onValueChange={setServiceId}>
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue placeholder="Elegí el consentimiento" />
              </SelectTrigger>
              <SelectContent>
                {(services.data ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} · {s.duration_min} min
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedService?.client_inclusion_note ? (
              <p className="text-xs leading-relaxed text-muted-foreground">
                {selectedService.client_inclusion_note}
              </p>
            ) : null}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" className="rounded-xl" onClick={() => setBook(null)}>
              Cancelar
            </Button>
            <Button
              className="rounded-xl"
              disabled={!serviceId || createMut.isPending}
              onClick={() => createMut.mutate()}
            >
              Confirmar aventura
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!petConflict} onOpenChange={(o) => !o && setPetConflict(null)}>
        <DialogContent className="max-w-md rounded-3xl border-border/70 p-6">
          <DialogTitle className="font-display text-xl font-bold text-primary">
            Ya tenés una cita
          </DialogTitle>
          <DialogDescription>{petConflict?.conflict.message}</DialogDescription>
          {petConflict ? (
            <div className="space-y-3 text-sm">
              <div className="rounded-2xl bg-secondary/60 p-3">
                <p className="font-medium">
                  {petConflict.conflict.appointment.pet_name || selected?.name} ·{" "}
                  {petConflict.conflict.appointment.service_name || "Servicio"}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {new Date(petConflict.conflict.appointment.starts_at).toLocaleString("es-CO", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {petConflict.conflict.appointment.location_name
                    ? ` · ${petConflict.conflict.appointment.location_name}`
                    : ""}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  className="rounded-xl"
                  onClick={() => {
                    const payload = petConflict;
                    setPetConflict(null);
                    void updateAppointment(payload.conflict.appointment.id, {
                      starts_at: payload.wantedStarts,
                      location_id: locationId || undefined,
                      service_id: serviceId || undefined,
                    })
                      .then(() => {
                        toast.success("Actualizamos tu cita.");
                        void qc.invalidateQueries({ queryKey: ["appointments"] });
                        void qc.invalidateQueries({ queryKey: ["appointments", "week-slots"] });
                      })
                      .catch((err: Error) => toast.error(err.message || "No se pudo actualizar"));
                  }}
                >
                  Sí, actualizarla
                </Button>
                <Button variant="outline" className="rounded-xl" onClick={() => setPetConflict(null)}>
                  Dejarla como está
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function PetPicker({
  pets,
  selectedId,
  open,
  onOpenChange,
  onSelect,
  onCreate,
}: {
  pets: Pet[];
  selectedId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (id: string) => void;
  onCreate?: () => void;
}) {
  const selected = pets.find((p) => p.id === selectedId) ?? pets[0];
  if (!selected) return null;
  const trigger = (
    <button
      type="button"
      className="flex w-full items-center gap-3 rounded-2xl border border-border/80 bg-background px-3 py-2.5 text-left hover:border-primary/40"
    >
      <PetAvatar pet={selected} size="sm" />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {speciesEmoji(selected.species)} {selected.name}
      </span>
      <ChevronDown className="h-4 w-4 text-muted-foreground" />
    </button>
  );
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(100vw-2rem,22rem)] rounded-2xl border-border/70 p-2 shadow-lift"
      >
        <ul className="space-y-1">
          {pets.map((p) => {
            const active = p.id === selected.id;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onSelect(p.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left",
                    active ? "bg-secondary" : "hover:bg-muted/70",
                  )}
                >
                  <PetAvatar pet={p} size="sm" />
                  <PetMeta pet={p} compact />
                  {active ? (
                    <span className="ml-auto flex items-center gap-1 text-[11px] font-medium text-primary">
                      <Check className="h-4 w-4" /> Seleccionada
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
        {onCreate ? (
          <button
            type="button"
            onClick={onCreate}
            className="mt-1 flex w-full items-center gap-2 rounded-2xl px-2 py-2 text-left text-sm font-medium text-primary hover:bg-muted/70"
          >
            + Crear mascota
          </button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
