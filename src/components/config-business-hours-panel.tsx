/** Configuración → horarios de atención + capacidad por franja. */

import { useEffect, useState } from "react";
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

export function ConfigBusinessHoursPanel() {
  const qc = useQueryClient();
  const hours = useQuery({
    queryKey: ["business-hours"],
    queryFn: getBusinessHours,
  });
  const [days, setDays] = useState<DayDraft[]>([]);

  useEffect(() => {
    if (!hours.data?.days) return;
    setDays(hours.data.days.map(toDraft));
  }, [hours.data]);

  const saveMut = useMutation({
    mutationFn: () =>
      putBusinessHours(
        days.map((d) => ({
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
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const patchDay = (weekday: number, patch: Partial<DayDraft>) => {
    setDays((prev) => prev.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d)));
  };

  return (
    <SectionCard title="Horarios de atención">
      <p className="mb-4 text-sm text-muted-foreground">
        Definí apertura y cierre por día. <strong>Slots</strong> es cuántas mascotas pueden
        agendar en la misma franja de 1 hora (ej. 8–9 AM → 4 turnos).
      </p>
      {hours.isLoading ? <KiraLoader variant="inline" /> : null}
      <div className="space-y-3">
        {days.map((d) => (
          <div
            key={d.weekday}
            className="grid gap-3 rounded-2xl border border-border/80 bg-secondary/30 p-3 sm:grid-cols-[7rem_auto_1fr_1fr_5.5rem] sm:items-end"
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
              <Label className="text-xs">Slots/h</Label>
              <Input
                type="number"
                min={1}
                max={50}
                className="h-10 rounded-xl"
                disabled={!d.is_open}
                value={d.slots_per_hour}
                onChange={(e) => patchDay(d.weekday, { slots_per_hour: e.target.value })}
              />
            </div>
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
