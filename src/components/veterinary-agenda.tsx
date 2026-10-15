import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, resolveMediaUrl } from "@/lib/api";
import { initials, time } from "@/lib/format";
import { petsQuery, type Pet } from "@/lib/spa-queries";

type VetAppointment = {
  id: string;
  pet_name: string;
  pet_photo_url: string | null;
  owner_name: string | null;
  service_name: string;
  vet_name: string;
  starts_at: string;
  status: "pendiente" | "confirmada" | "cancelada";
};

type VetExamSlot = {
  id: string;
  pet_name: string;
  pet_photo_url: string | null;
  owner_name: string | null;
  exam_name: string;
  starts_at: string;
};

const STATUS_LABEL = {
  pendiente: "Pendiente",
  confirmada: "Confirmada",
  cancelada: "Cancelada",
} as const;

function dayKey(value: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function toLocalInputValue(value: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

export function VeterinaryWeek({
  anchor,
  query,
  createRequest,
}: {
  anchor: Date;
  query: string;
  createRequest: number;
}) {
  const qc = useQueryClient();
  const [petId, setPetId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [vetId, setVetId] = useState("");
  const [when, setWhen] = useState("");
  const [openForm, setOpenForm] = useState(false);
  const days = Array.from({ length: 7 }).map((_, index) => {
    const day = new Date(anchor);
    day.setDate(day.getDate() + index);
    return day;
  });
  const start = dayKey(days[0]);
  const end = dayKey(days[6]);

  const appointments = useQuery({
    queryKey: ["veterinary", "agenda", start, end],
    queryFn: () =>
      api<{ items: VetAppointment[]; exams: VetExamSlot[] }>(`/veterinary/agenda?start=${start}&end=${end}`),
  });
  const pets = useQuery(petsQuery);
  const services = useQuery({
    queryKey: ["services", "veterinary"],
    queryFn: () => api<{ id: string; name: string }[]>("/services?category=veterinary"),
  });
  const vets = useQuery({
    queryKey: ["veterinary", "vets"],
    queryFn: () => api<{ items: { id: string; full_name: string }[] }>("/veterinary/agenda/vets"),
  });

  const create = useMutation({
    mutationFn: () =>
      api("/veterinary/agenda", {
        method: "POST",
        body: {
          pet_id: petId,
          service_id: serviceId,
          vet_user_id: vetId,
          starts_at: new Date(when).toISOString(),
        },
      }),
    onSuccess: async () => {
      toast.success("Cita veterinaria creada");
      setPetId("");
      setServiceId("");
      setVetId("");
      setWhen("");
      setOpenForm(false);
      await qc.invalidateQueries({ queryKey: ["veterinary", "agenda"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const patch = useMutation({
    mutationFn: (input: { id: string; status: string }) =>
      api(`/veterinary/agenda/${input.id}`, { method: "PATCH", body: { status: input.status } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["veterinary", "agenda"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  useEffect(() => {
    if (!createRequest) return;
    const today = new Date();
    today.setHours(today.getHours() + 1, 0, 0, 0);
    setWhen(toLocalInputValue(today));
    setOpenForm(true);
  }, [createRequest]);

  const needle = query.trim().toLowerCase();
  const exams = (appointments.data?.exams ?? []).filter((item) => {
    if (!needle) return true;
    return `${item.pet_name} ${item.owner_name ?? ""} ${item.exam_name}`.toLowerCase().includes(needle);
  });
  const items = (appointments.data?.items ?? []).filter((item) => {
    if (item.status === "cancelada") return false;
    if (!needle) return true;
    return `${item.pet_name} ${item.owner_name ?? ""}`.toLowerCase().includes(needle);
  });
  const selectedPet = (pets.data ?? []).find((pet) => pet.id === petId);

  return (
    <>
      <div className="mt-6 overflow-x-auto pb-1">
        <div className="grid min-w-[84rem] grid-cols-7 gap-3">
          {days.map((day) => {
            const key = dayKey(day);
            const list = items.filter((item) => dayKey(new Date(item.starts_at)) === key);
            const examList = exams.filter((item) => dayKey(new Date(item.starts_at)) === key);
            const isToday = key === dayKey(new Date());
            return (
              <div
                key={key}
                className={[
                  "flex min-h-[220px] flex-col rounded-2xl border p-3",
                  isToday ? "border-accent/40 bg-blush/30" : "border-border bg-card",
                ].join(" ")}
              >
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-1">
                  <div className="min-w-0">
                    <p className="truncate text-xs uppercase tracking-wider text-muted-foreground">
                      {day.toLocaleDateString("es-CO", { weekday: "short" })}
                    </p>
                    <p className="font-display text-lg font-bold text-primary">{day.getDate()}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                      {list.length + examList.length}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 rounded-lg"
                      title={`Nueva cita el ${day.toLocaleDateString("es-CO")}`}
                      onClick={() => {
                        const next = new Date(day);
                        next.setHours(9, 0, 0, 0);
                        setWhen(toLocalInputValue(next));
                        setOpenForm(true);
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {list.map((item) => (
                    <article
                      key={item.id}
                      className="overflow-hidden rounded-2xl border border-border/70 bg-background p-3 shadow-soft"
                    >
                      <div className="flex items-start gap-2.5">
                        {item.pet_photo_url ? (
                          <img
                            src={resolveMediaUrl(item.pet_photo_url)}
                            alt={item.pet_name}
                            className="h-12 w-12 shrink-0 rounded-xl object-cover"
                          />
                        ) : (
                          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">
                            {initials(item.pet_name)}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold leading-snug text-foreground [overflow-wrap:anywhere]">
                            {item.pet_name}
                          </p>
                          <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">{time(item.starts_at)}</p>
                          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground [overflow-wrap:anywhere]">
                            {item.service_name}
                          </p>
                          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground [overflow-wrap:anywhere]">
                            Atiende · {item.vet_name}
                          </p>
                          {item.owner_name ? (
                            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground [overflow-wrap:anywhere]">
                              {item.owner_name}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <Select
                        value={item.status}
                        onValueChange={(status) => patch.mutate({ id: item.id, status })}
                      >
                        <SelectTrigger className="mt-2.5 h-8 rounded-xl text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(STATUS_LABEL) as Array<keyof typeof STATUS_LABEL>).map((status) => (
                            <SelectItem key={status} value={status}>
                              {STATUS_LABEL[status]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </article>
                  ))}
                  {examList.map((item) => (
                    <article
                      key={item.id}
                      className="overflow-hidden rounded-2xl border border-border/70 bg-background p-3 shadow-soft"
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Examen</p>
                      <p className="mt-1 text-sm font-semibold leading-snug text-foreground [overflow-wrap:anywhere]">
                        {item.pet_name}
                      </p>
                      <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">{time(item.starts_at)}</p>
                      <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground [overflow-wrap:anywhere]">
                        {item.exam_name}
                      </p>
                    </article>
                  ))}
                  {!list.length && !examList.length ? (
                    <button
                      type="button"
                      onClick={() => {
                        const next = new Date(day);
                        next.setHours(9, 0, 0, 0);
                        setWhen(toLocalInputValue(next));
                        setOpenForm(true);
                      }}
                      className="w-full rounded-xl border border-dashed border-border py-6 text-center text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-secondary/40 hover:text-foreground"
                    >
                      Sin citas · tocar para agendar
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {openForm ? (
        <form
          className="card-soft mt-6 grid gap-4 p-5 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!petId || !serviceId || !vetId || !when) {
              toast.error("Completá mascota, servicio, veterinario y fecha.");
              return;
            }
            create.mutate();
          }}
        >
          <h3 className="font-display text-lg font-bold text-primary sm:col-span-2">Nueva cita</h3>
          <div>
            <Label htmlFor="vet-pet">Mascota</Label>
            <select
              id="vet-pet"
              className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={petId}
              onChange={(event) => setPetId(event.target.value)}
            >
              <option value="">Elegir</option>
              {(pets.data ?? []).map((pet) => (
                <option key={pet.id} value={pet.id}>
                  {pet.name}
                </option>
              ))}
            </select>
            {selectedPet ? <p className="mt-1 text-xs text-muted-foreground">Dueño: {ownerOf(selectedPet)}</p> : null}
          </div>
          <div>
            <Label htmlFor="vet-service">Servicio</Label>
            <select
              id="vet-service"
              className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={serviceId}
              onChange={(event) => setServiceId(event.target.value)}
            >
              <option value="">Elegir</option>
              {(services.data ?? []).map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="vet-doctor">Veterinario</Label>
            <select
              id="vet-doctor"
              className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={vetId}
              onChange={(event) => setVetId(event.target.value)}
            >
              <option value="">Elegir</option>
              {(vets.data?.items ?? []).map((vet) => (
                <option key={vet.id} value={vet.id}>
                  {vet.full_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="vet-when">Fecha</Label>
            <Input
              id="vet-when"
              type="datetime-local"
              className="mt-1"
              value={when}
              onChange={(event) => setWhen(event.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" className="rounded-xl" disabled={create.isPending}>
              Agendar
            </Button>
          </div>
        </form>
      ) : null}
    </>
  );
}

function ownerOf(pet: Pet | undefined) {
  if (!pet) return "sin dueño";
  return pet.owners_list?.[0]?.full_name || pet.owners?.full_name || "sin dueño";
}
