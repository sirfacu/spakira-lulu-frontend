import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  isPastHour,
  occupiedCopy,
  occupiedEmoji,
  slotCountLabel,
  weekRangeLabel,
  type OccupiedKind,
} from "@/lib/client-agenda";
import type { WeekDaySlots, WeekSlot } from "@/lib/spa-queries";
import { cn } from "@/lib/utils";

export function daySlotTotal(date: string, slots: WeekSlot[]) {
  return slots.reduce((acc, s) => {
    if (s.status !== "available") return acc;
    if (isPastHour(date, s.hour)) return acc;
    return acc + s.remaining;
  }, 0);
}

export function WeekSlotGrid({
  anchor,
  days,
  hours,
  mobileDay,
  onMobileDay,
  onWeek,
  onToday,
  mineByBand,
  petName,
  onPick,
  onOccupied,
  occupiedLabel,
}: {
  anchor: Date;
  days: WeekDaySlots[];
  hours: string[];
  mobileDay: string;
  onMobileDay: (date: string) => void;
  onWeek: (delta: number) => void;
  onToday: () => void;
  mineByBand?: Map<string, { service: string }>;
  petName?: string;
  onPick: (date: string, hour: number) => void;
  onOccupied?: (date: string, hour: number) => void;
  occupiedLabel?: (date: string, hour: number) => string | null;
}) {
  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-2xl border border-border/70 bg-card p-1 shadow-soft">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl"
            onClick={() => onWeek(-1)}
            aria-label="Semana anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" className="h-9 rounded-xl px-3 text-sm font-medium" onClick={onToday}>
            Hoy
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl"
            onClick={() => onWeek(1)}
            aria-label="Semana siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">{weekRangeLabel(anchor)}</p>
      </div>

      <div className="md:hidden">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {days.map((d) => (
            <button
              key={d.date}
              type="button"
              onClick={() => onMobileDay(d.date)}
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
                    mine={mineByBand?.get(`${d.date}-${d.slots[hi]?.hour}`)}
                    petName={petName}
                    staffLabel={
                      d.slots[hi]
                        ? occupiedLabel?.(d.date, d.slots[hi].hour) ?? null
                        : null
                    }
                    onPick={() => onPick(d.date, d.slots[hi].hour)}
                    onOccupied={
                      onOccupied && d.slots[hi]
                        ? () => onOccupied(d.date, d.slots[hi].hour)
                        : undefined
                    }
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
                  mine={mineByBand?.get(`${mobileDay}-${slot.hour}`)}
                  petName={petName}
                  tall
                  staffLabel={occupiedLabel?.(mobileDay, slot.hour) ?? null}
                  onPick={() => onPick(mobileDay, slot.hour)}
                  onOccupied={onOccupied ? () => onOccupied(mobileDay, slot.hour) : undefined}
                />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SlotCell({
  slot,
  date,
  mine,
  petName,
  tall,
  staffLabel,
  onPick,
  onOccupied,
}: {
  slot: WeekSlot | undefined;
  date: string;
  mine?: { service: string };
  petName?: string;
  tall?: boolean;
  staffLabel?: string | null;
  onPick: () => void;
  onOccupied?: () => void;
}) {
  const box = cn(
    "flex w-full items-center justify-center rounded-2xl px-1.5 text-center",
    tall ? "min-h-12 py-2" : "h-11",
  );
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
      <div
        className={cn(
          box,
          "border border-dashed border-border/80 bg-muted/20 text-muted-foreground",
        )}
      >
        —
      </div>
    );
  }

  if (status === "full") {
    const label = staffLabel || occupiedCopy(slot.occupied_kind as OccupiedKind | null);
    return (
      <button
        type="button"
        title={label}
        onClick={() => {
          if (onOccupied) {
            onOccupied();
            return;
          }
          toast.message("No hay espacios disponibles en este horario.");
        }}
        className={cn(box, "flex-col gap-0.5 bg-[#f8d5de] hover:bg-[#f3c5d0]")}
      >
        <span className="text-[11px] leading-none">{occupiedEmoji(slot.occupied_kind)}</span>
        <span className="truncate text-[9px] font-medium leading-tight text-blush-foreground">
          {label}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(box, "flex-col bg-[#cfe9c4] font-semibold text-[#3d6b3a] transition hover:bg-[#bddfb0]")}
    >
      <span className="text-[11px]">{slotCountLabel(slot.remaining)}</span>
      {staffLabel ? (
        <span className="max-w-full truncate text-[9px] font-normal text-[#3d6b3a]/80">
          {staffLabel}
        </span>
      ) : petName ? (
        <span className="sr-only">Disponible para {petName}</span>
      ) : null}
    </button>
  );
}
