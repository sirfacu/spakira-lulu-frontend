import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
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
  type Pet,
  type WeekSlot,
} from "@/lib/spa-queries";
import {
  addDays,
  isPastHour,
  occupiedCopy,
  occupiedEmoji,
  sexMark,
  speciesEmoji,
  speciesLabel,
  startOfWeekMonday,
  weekRangeLabel,
  ymd,
  slotWhenLabel,
  slotCountLabel,
} from "@/lib/client-agenda";
import { resolveMediaUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

const PET_PLACEHOLDER = "/images/kira-face-grey.png";
const FALLBACK_HOURS = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
];
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

function daySlotTotal(date: string, slots: WeekSlot[]) {
  return slots.reduce((acc, s) => {
    if (s.status !== "available") return acc;
    if (isPastHour(date, s.hour)) return acc;
    return acc + s.remaining;
  }, 0);
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
  const [serviceId, setServiceId] = useState("");

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
      search: { google: search.google, service: undefined },
      replace: true,
    });
  }, [search.service, search.google, navigate]);

  useEffect(() => {
    if (!serviceId && services.data?.[0]?.id) setServiceId(services.data[0].id);
  }, [services.data, serviceId]);

  const selected = list.find((p) => p.id === petId) ?? list[0] ?? null;
  const selectedService = (services.data ?? []).find((s) => s.id === serviceId) ?? null;
  const weekKey = ymd(anchor);
  const slotsQ = useQuery(weekSlotsQuery(weekKey));

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
        starts_at: starts.toISOString(),
        sync_google: false,
      });
    },
    onSuccess: () => {
      toast.success(`¡Listo! Reservamos el momento para ${selected?.name}.`);
      setBook(null);
      void qc.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (e: Error) => toast.error(e.message || "No se pudo agendar"),
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

  const hours = slotsQ.data?.hours ?? FALLBACK_HOURS;
  const days =
    (slotsQ.data?.days?.length ? slotsQ.data.days : null) ??
    Array.from({ length: 7 }, (_, i) => ({
      date: ymd(addDays(anchor, i)),
      weekday: i,
      label: DAY_SHORT[i],
      is_open: false,
      slots: hours.map((label, hi) => ({
        hour: 8 + hi,
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
                {list.length > 1 ? (
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
                    />
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Primero registrá una mascota para ver la agenda.
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
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Duración estimada</dt>
                <dd className="font-medium">{selectedService?.duration_min ?? 60} min</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Sucursal</dt>
                <dd className="text-right font-medium">Spa Kira — Principal</dd>
              </div>
              {nextAdventure?.services?.name ? (
                <div className="rounded-2xl bg-secondary/80 px-3 py-2">
                  <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Próxima aventura
                  </dt>
                  <dd className="text-sm font-semibold text-primary">
                    {nextAdventure.services.name} 🛁
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
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-2xl border border-border/70 bg-card p-1 shadow-soft">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-xl"
                onClick={() => goWeek(-1)}
                aria-label="Semana anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" className="h-9 rounded-xl px-3 text-sm font-medium" onClick={goToday}>
                Hoy
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-xl"
                onClick={() => goWeek(1)}
                aria-label="Semana siguiente"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">{weekRangeLabel(anchor)}</p>
          </div>

          {slotsQ.isError ? (
            <p className="rounded-2xl bg-blush/80 px-4 py-3 text-sm text-blush-foreground">
              No pudimos cargar los horarios. Recargá en un momento.
            </p>
          ) : null}

          <div className="md:hidden">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {days.map((d) => (
                <button
                  key={d.date}
                  type="button"
                  onClick={() => setMobileDay(d.date)}
                  className={cn(
                    "min-w-[4.25rem] rounded-2xl border px-3 py-2 text-center text-xs shadow-soft",
                    mobileDay === d.date
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground",
                  )}
                >
                  <span className="block font-semibold">{d.label}</span>
                  <span className="text-[11px] opacity-80">{d.date.slice(8)}</span>
                </button>
              ))}
            </div>
          </div>

          <section className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">
            <div className="hidden md:block">
              <div
                className="grid border-b border-border/50 bg-secondary/40"
                style={{ gridTemplateColumns: "3.5rem repeat(7, minmax(0, 1fr))" }}
              >
                <div />
                {days.map((d) => {
                  const total = daySlotTotal(d.date, d.slots);
                  return (
                    <div key={d.date} className="px-1 py-3 text-center">
                      <p className="text-[11px] font-bold tracking-wide text-muted-foreground">
                        {d.label} {d.date.slice(8)}
                      </p>
                      <p className="text-[10px] font-medium text-mint-foreground">
                        {slotCountLabel(total)}
                      </p>
                    </div>
                  );
                })}
              </div>
              {hours.map((label, hi) => (
                <div
                  key={label}
                  className="grid items-stretch"
                  style={{ gridTemplateColumns: "3.5rem repeat(7, minmax(0, 1fr))" }}
                >
                  <div className="flex items-center justify-center py-1 text-[11px] text-muted-foreground">
                    {label}
                  </div>
                  {days.map((d) => (
                    <div key={`${d.date}-${label}`} className="p-1">
                      <SlotCell
                        slot={d.slots[hi]}
                        date={d.date}
                        mine={mineByBand.get(`${d.date}-${d.slots[hi]?.hour}`)}
                        petName={selected?.name}
                        onPick={() => openBook(d.date, d.slots[hi].hour)}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="space-y-1.5 p-3 md:hidden">
              {(days.find((d) => d.date === mobileDay) ?? days[0])?.slots.map((slot) => (
                <div key={slot.hour} className="flex items-stretch gap-3">
                  <div className="w-12 shrink-0 pt-2.5 text-xs text-muted-foreground">{slot.label}</div>
                  <div className="min-w-0 flex-1">
                    <SlotCell
                      slot={slot}
                      date={mobileDay}
                      mine={mineByBand.get(`${mobileDay}-${slot.hour}`)}
                      petName={selected?.name}
                      tall
                      onPick={() => openBook(mobileDay, slot.hour)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <p className="px-1 text-center text-xs text-muted-foreground">
            Cada slot representa una cita disponible
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
    </AppShell>
  );
}

function PetPicker({
  pets,
  selectedId,
  open,
  onOpenChange,
  onSelect,
}: {
  pets: Pet[];
  selectedId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (id: string) => void;
}) {
  const selected = pets.find((p) => p.id === selectedId) ?? pets[0];
  if (!selected) return null;
  const many = pets.length > 1;
  const trigger = (
    <button
      type="button"
      disabled={!many}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border border-border/80 bg-background px-3 py-2.5 text-left",
        many && "hover:border-primary/40",
      )}
    >
      <PetAvatar pet={selected} size="sm" />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {speciesEmoji(selected.species)} {selected.name}
      </span>
      {many ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : null}
    </button>
  );
  if (!many) return trigger;
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
      </PopoverContent>
    </Popover>
  );
}

function SlotCell({
  slot,
  date,
  mine,
  petName,
  tall,
  onPick,
}: {
  slot: WeekSlot | undefined;
  date: string;
  mine?: { service: string };
  petName?: string;
  tall?: boolean;
  onPick: () => void;
}) {
  const box = cn("flex w-full items-center justify-center rounded-2xl px-1.5 text-center", tall ? "min-h-12 py-2" : "h-11");
  if (!slot) return <div className={cn(box, "bg-muted/30")} />;
  const past = isPastHour(date, slot.hour);
  const status = past && slot.status === "available" ? "closed" : slot.status;

  if (mine) {
    return (
      <div className={cn(box, "flex-col bg-secondary")}>
        <span className="text-[10px] font-semibold text-primary">Tu cita</span>
        <span className="truncate text-[10px] text-muted-foreground">{mine.service}</span>
      </div>
    );
  }

  if (status === "closed") {
    return (
      <div className={cn(box, "border border-dashed border-border/80 bg-muted/20 text-muted-foreground")}>
        —
      </div>
    );
  }

  if (status === "full") {
    return (
      <button
        type="button"
        title="No hay espacios disponibles en este horario."
        onClick={() => toast.message("No hay espacios disponibles en este horario.")}
        className={cn(box, "flex-col gap-0.5 bg-[#f8d5de] hover:bg-[#f3c5d0]")}
      >
        <span className="text-[11px] leading-none">{occupiedEmoji(slot.occupied_kind)}</span>
        <span className="text-[9px] font-medium leading-tight text-blush-foreground">
          {occupiedCopy(slot.occupied_kind)}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(box, "bg-[#cfe9c4] font-semibold text-[#3d6b3a] transition hover:bg-[#bddfb0]")}
    >
      <span className="text-[11px]">{slotCountLabel(slot.remaining)}</span>
      {petName ? <span className="sr-only">Disponible para {petName}</span> : null}
    </button>
  );
}
