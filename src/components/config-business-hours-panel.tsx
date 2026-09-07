/** Configuración → horarios de atención + turnos (capacidad) por franja. */

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SectionCard } from "@/components/ui-kit";
import { KiraLoader } from "@/components/kira-loader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  getBusinessHours,
  putBusinessHours,
  type BusinessHourDay,
} from "@/lib/spa-queries";

type DayDraft = {
  weekday: number;
  label: string;
  is_open: boolean;
  open_time: string;
  close_time: string;
  slots_per_hour: string;
};

type ScheduleMode = "general" | "per_day";

function toDraft(d: BusinessHourDay): DayDraft {
  return {
    weekday: d.weekday,
    label: d.label,
    is_open: d.is_open,
    open_time: (d.open_time || "09:00").slice(0, 5),
    close_time: (d.close_time || "18:00").slice(0, 5),
    slots_per_hour: String(d.slots_per_hour ?? 4),
  };
}

/** Si todos los días abiertos comparten el mismo horario/turnos → modo general. */
function inferMode(days: DayDraft[]): ScheduleMode {
  const open = days.filter((d) => d.is_open);
  if (open.length <= 1) return "general";
  const key = (d: DayDraft) => `${d.open_time}|${d.close_time}|${d.slots_per_hour}`;
  const first = key(open[0]);
  return open.every((d) => key(d) === first) ? "general" : "per_day";
}

export function ConfigBusinessHoursPanel() {
  const qc = useQueryClient();
  const hours = useQuery({
    queryKey: ["business-hours"],
    queryFn: getBusinessHours,
  });
  const [days, setDays] = useState<DayDraft[]>([]);
  const [mode, setMode] = useState<ScheduleMode>("general");
  const [general, setGeneral] = useState({
    open_time: "09:00",
    close_time: "18:00",
    slots_per_hour: "4",
  });

  useEffect(() => {
    if (!hours.data?.days) return;
    const drafted = hours.data.days.map(toDraft);
    setDays(drafted);
    const inferred = inferMode(drafted);
    setMode(inferred);
    const sample = drafted.find((d) => d.is_open) ?? drafted[0];
    if (sample) {
      setGeneral({
        open_time: sample.open_time,
        close_time: sample.close_time,
        slots_per_hour: sample.slots_per_hour,
      });
    }
  }, [hours.data]);

  const payloadDays = useMemo(() => {
    if (mode === "per_day") return days;
    return days.map((d) =>
      d.is_open
        ? {
            ...d,
            open_time: general.open_time,
            close_time: general.close_time,
            slots_per_hour: general.slots_per_hour,
          }
        : d,
    );
  }, [mode, days, general]);

  const saveMut = useMutation({
    mutationFn: () =>
      putBusinessHours(
        payloadDays.map((d) => ({
          weekday: d.weekday,
          is_open: d.is_open,
          open_time: d.open_time,
          close_time: d.close_time,
          slots_per_hour: Math.max(1, Math.min(50, Number(d.slots_per_hour) || 4)),
        })),
      ),
    onSuccess: async () => {
      toast.success("Horarios de atención guardados");
      await qc.invalidateQueries({ queryKey: ["business-hours"] });
      await qc.invalidateQueries({ queryKey: ["business-hours-public"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const patchDay = (weekday: number, patch: Partial<DayDraft>) => {
    setDays((prev) => prev.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d)));
  };

  return (
    <SectionCard title="Horarios de atención">
      <p className="mb-4 text-sm text-muted-foreground">
        Definí apertura y cierre. <strong>Turnos/h</strong> es cuántas mascotas pueden
        agendar en la misma franja de 1 hora (ej. 8–9 AM → 4 turnos).
      </p>

      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-border/80 bg-secondary/25 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Personalizar por día</p>
          <p className="text-xs text-muted-foreground">
            Apagado: un horario general para todos los días abiertos. Encendido: horario
            distinto por cada día.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Switch
            checked={mode === "per_day"}
            onCheckedChange={(v) => {
              if (!v) {
                const sample = days.find((d) => d.is_open) ?? days[0];
                if (sample) {
                  setGeneral({
                    open_time: sample.open_time,
                    close_time: sample.close_time,
                    slots_per_hour: sample.slots_per_hour,
                  });
                }
                setMode("general");
              } else {
                setDays((prev) =>
                  prev.map((d) =>
                    d.is_open
                      ? {
                          ...d,
                          open_time: general.open_time,
                          close_time: general.close_time,
                          slots_per_hour: general.slots_per_hour,
                        }
                      : d,
                  ),
                );
                setMode("per_day");
              }
            }}
            aria-label="Personalizar horario por día"
          />
          <span className="text-xs text-muted-foreground">
            {mode === "per_day" ? "Por día" : "General"}
          </span>
        </div>
      </div>

      {hours.isLoading ? <KiraLoader variant="inline" /> : null}

      {mode === "general" ? (
        <div className="mb-4 grid gap-3 rounded-2xl border border-border/80 bg-card p-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Apertura</Label>
            <Input
              type="time"
              className="h-10 rounded-xl"
              value={general.open_time}
              onChange={(e) => setGeneral((g) => ({ ...g, open_time: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Cierre</Label>
            <Input
              type="time"
              className="h-10 rounded-xl"
              value={general.close_time}
              onChange={(e) => setGeneral((g) => ({ ...g, close_time: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Turnos/h</Label>
            <Input
              type="number"
              min={1}
              max={50}
              className="h-10 rounded-xl"
              value={general.slots_per_hour}
              onChange={(e) =>
                setGeneral((g) => ({ ...g, slots_per_hour: e.target.value }))
              }
            />
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        {days.map((d) => (
          <div
            key={d.weekday}
            className={
              mode === "general"
                ? "flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-secondary/30 p-3"
                : "grid gap-3 rounded-2xl border border-border/80 bg-secondary/30 p-3 sm:grid-cols-[7rem_auto_1fr_1fr_5.5rem] sm:items-end"
            }
          >
            <div className="flex items-center justify-between gap-2 sm:block">
              <p className="text-sm font-medium">{d.label}</p>
              <div className="flex items-center gap-2">
                <Switch
                  checked={d.is_open}
                  onCheckedChange={(v) => patchDay(d.weekday, { is_open: v })}
                  aria-label={`${d.label} abierto`}
                />
                <span className="text-xs text-muted-foreground">
                  {d.is_open ? "Abierto" : "Cerrado"}
                </span>
              </div>
            </div>
            {mode === "per_day" ? (
              <>
                <div className="hidden sm:block" />
                <div className="space-y-1.5">
                  <Label className="text-xs">Apertura</Label>
                  <Input
                    type="time"
                    className="h-10 rounded-xl"
                    disabled={!d.is_open}
                    value={d.open_time}
                    onChange={(e) => patchDay(d.weekday, { open_time: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Cierre</Label>
                  <Input
                    type="time"
                    className="h-10 rounded-xl"
                    disabled={!d.is_open}
                    value={d.close_time}
                    onChange={(e) => patchDay(d.weekday, { close_time: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Turnos/h</Label>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    className="h-10 rounded-xl"
                    disabled={!d.is_open}
                    value={d.slots_per_hour}
                    onChange={(e) =>
                      patchDay(d.weekday, { slots_per_hour: e.target.value })
                    }
                  />
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                {d.is_open
                  ? `${general.open_time} – ${general.close_time} · ${general.slots_per_hour} turnos/h`
                  : "Cerrado"}
              </p>
            )}
          </div>
        ))}
      </div>
      <Button
        className="mt-4 rounded-xl"
        disabled={!days.length || saveMut.isPending}
        onClick={() => saveMut.mutate()}
      >
        {saveMut.isPending ? "Guardando…" : "Guardar horarios"}
      </Button>
    </SectionCard>
  );
}
