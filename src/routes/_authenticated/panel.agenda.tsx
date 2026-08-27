import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate, useRouteContext, useSearch } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Minus,
  Plus,
  CalendarCheck,
  MessageCircle,
  Pencil,
  Trash2,
  Search,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatusPill, Empty } from "@/components/ui-kit";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  appointmentsQuery,
  staffQuery,
  petsQuery,
  panelServicesQuery,
  updateAppointmentStatus,
  updateAppointment,
  deleteAppointment,
  createAppointment,
  listAppointmentExtras,
  addAppointmentExtra,
  updateAppointmentExtra,
  deleteAppointmentExtra,
  notifyAppointmentUpdate,
  googleIntegrationStatus,
  googleConnectUrl,
  getMyStaff,
  listAppointmentReschedules,
  reviewAppointmentReschedule,
  inventoryShopQuery,
  fetchNextAppointmentSlot,
  type Pet,
  type Appointment,
  type AppointmentExtra,
  appointmentChargeTotal,
} from "@/lib/spa-queries";
import {
  dayKey,
  statusMeta,
  normalizeStatus,
  time,
  cop,
  copRange,
  initials,
  appointmentProgress,
} from "@/lib/format";
import { requirePathAccess } from "@/lib/route-access";
import { permissionsFor } from "@/lib/roles";
import { FinishAppointmentDialog } from "@/components/finish-appointment-dialog";
import { MISC_CATALOG } from "@/lib/misc-catalog";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api";

const ACTIVITY_SKILLS: Record<string, string[]> = {
  bano: ["bañista", "lavador", "groomer"],
  secado: ["secador", "groomer"],
  color: ["colorista"],
  corte: ["groomer"],
  unas: ["groomer"],
  spa: ["groomer", "bañista", "lavador"],
  cepillado: ["groomer", "secador"],
};

function staffCoversService(skills: string[] | undefined, activities: string[] | undefined) {
  const acts = activities ?? [];
  if (!acts.length) return true;
  const have = new Set((skills ?? []).map((s) => s.toLowerCase()));
  return acts.every((a) => (ACTIVITY_SKILLS[a] ?? ["groomer"]).some((sk) => have.has(sk)));
}

export const Route = createFileRoute("/_authenticated/panel/agenda")({
  beforeLoad: requirePathAccess("/panel/agenda"),
  validateSearch: (s: Record<string, unknown>) => ({
    google: typeof s.google === "string" ? s.google : undefined,
    service: typeof s.service === "string" ? s.service : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Agenda | Spa Kira" },
      {
        name: "description",
        content: "Calendario semanal de citas de grooming con filtros por mascota, dueño y estado.",
      },
      { property: "og:title", content: "Agenda | Spa Kira" },
      { property: "og:description", content: "Calendario semanal de citas del spa canino." },
    ],
  }),
  component: Agenda,
});

const STATUSES = ["pendiente", "enproceso", "finalizada", "cancelada"];

function startOfWeek(d: Date) {
  const copy = new Date(d);
  const diff = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Fecha/hora sugerida al abrir el formulario para un día concreto. */
function defaultStartsAtForDay(day: Date) {
  const d = new Date(day);
  const today = new Date();
  if (dayKey(d) === dayKey(today)) {
    d.setHours(today.getHours() + 1, 0, 0, 0);
  } else {
    d.setHours(10, 0, 0, 0);
  }
  return toLocalInputValue(d);
}

function addDays(base: Date, n: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

function petOwnerLabel(p: Pet) {
  const names = (p.owners_list ?? [])
    .filter((o): o is NonNullable<typeof o> => !!o?.full_name)
    .map((o) => o.full_name);
  if (names.length) return names.join(" · ");
  return p.owners?.full_name ?? "";
}

function Agenda() {
  const { user } = useRouteContext({ from: "/_authenticated" });
  const perms = permissionsFor(user?.role);
  const qc = useQueryClient();
  const search = useSearch({ from: "/_authenticated/panel/agenda" });
  const navigate = useNavigate();
  const appts = useQuery(appointmentsQuery);
  const staff = useQuery({ ...staffQuery, enabled: perms.isStaff });
  const pets = useQuery(petsQuery);
  const services = useQuery(panelServicesQuery);
  const shop = useQuery(inventoryShopQuery);
  const miscCatalog = useMemo(() => {
    const fromInv = (shop.data ?? []).map((i) => ({
      id: i.id,
      name: i.name,
      category: i.category || "Tienda",
      unit_price: Number(i.sale_price_unit || i.sale_price) || 0,
    }));
    const names = new Set(fromInv.map((i) => i.name.toLowerCase()));
    const fallback = MISC_CATALOG.filter((m) => !names.has(m.name.toLowerCase()));
    return [...fromInv, ...fallback];
  }, [shop.data]);
  const myStaff = useQuery({
    queryKey: ["staff-me"],
    queryFn: getMyStaff,
    enabled: perms.isColaborador,
  });
  const google = useQuery({
    queryKey: ["google-status"],
    queryFn: googleIntegrationStatus,
    enabled: perms.canConnectGoogle,
  });

  const [anchor, setAnchor] = useState(() => startOfWeek(new Date()));
  const [q, setQ] = useState("");
  const [breed, setBreed] = useState("todas");
  const [staffId, setStaffId] = useState("todos");
  const [status, setStatus] = useState("todos");
  const [openForm, setOpenForm] = useState(false);
  const [petId, setPetId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [formStaffId, setFormStaffId] = useState("");
  const [startsAt, setStartsAt] = useState(() => defaultStartsAtForDay(new Date()));
  const staffForForm = perms.isCliente ? [] : (staff.data ?? []);
  const pendingReschedules = useQuery({
    queryKey: ["appointment-reschedules", "pending"],
    queryFn: () => listAppointmentReschedules("pending"),
    enabled: perms.isAdmin,
  });
  const [notes, setNotes] = useState("");
  const [lastWa, setLastWa] = useState<
    { owner_id?: string; full_name?: string; link: string }[] | null
  >(null);
  const [finishAppt, setFinishAppt] = useState<Appointment | null>(null);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    description: string;
    actionLabel: string;
    onConfirm: () => void;
  } | null>(null);
  const [extras, setExtras] = useState<AppointmentExtra[]>([]);
  const [extrasBaseline, setExtrasBaseline] = useState("");
  const [extraQuery, setExtraQuery] = useState("");
  const [extraPrice, setExtraPrice] = useState("");
  const [editForm, setEditForm] = useState({
    pet_id: "",
    service_id: "",
    staff_id: "",
    starts_at: "",
    notes: "",
    status: "pendiente",
  });
  const [editBaseline, setEditBaseline] = useState({
    pet_id: "",
    service_id: "",
    staff_id: "",
    starts_at: "",
    notes: "",
    status: "pendiente",
  });
  const [nowTick, setNowTick] = useState(() => Date.now());

  const lockedStaffId = perms.isColaborador ? myStaff.data?.id ?? null : null;
  useEffect(() => {
    if (!lockedStaffId) return;
    setStaffId(lockedStaffId);
    setFormStaffId(lockedStaffId);
  }, [lockedStaffId]);

  const extrasFingerprint = (rows: AppointmentExtra[]) =>
    JSON.stringify(
      [...rows]
        .map((ex) => ({
          id: ex.id,
          q: Number(ex.quantity),
          p: Number(ex.unit_price),
          n: ex.item_name,
        }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    );

  const extrasDirty = extrasFingerprint(extras) !== extrasBaseline;
  const formDirty =
    editForm.pet_id !== editBaseline.pet_id ||
    editForm.service_id !== editBaseline.service_id ||
    editForm.staff_id !== editBaseline.staff_id ||
    editForm.starts_at !== editBaseline.starts_at ||
    editForm.status !== editBaseline.status ||
    editForm.notes !== editBaseline.notes;
  const canSaveNotify = formDirty || extrasDirty;

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  const refreshList = (...keys: string[][]) => {
    void Promise.all(keys.map((queryKey) => qc.invalidateQueries({ queryKey })));
  };

  const loadExtras = async (appointmentId: string, opts?: { syncBaseline?: boolean }) => {
    try {
      const rows = await listAppointmentExtras(appointmentId);
      setExtras(rows);
      if (opts?.syncBaseline) {
        setExtrasBaseline(extrasFingerprint(rows));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudieron cargar extras");
      setExtras([]);
      if (opts?.syncBaseline) setExtrasBaseline("");
    }
  };

  const openManage = (a: Appointment) => {
    setSelected(a);
    const form = {
      pet_id: a.pet_id ?? "",
      service_id: a.service_id ?? "",
      staff_id: a.staff_id ?? "",
      starts_at: toLocalInputValue(new Date(a.starts_at)),
      notes: a.notes ?? "",
      status: normalizeStatus(a.status),
    };
    setEditForm(form);
    setEditBaseline(form);
    setExtraQuery("");
    setExtraPrice("");
    if (perms.isStaff) {
      void loadExtras(a.id, { syncBaseline: true });
    } else {
      setExtras([]);
      setExtrasBaseline("");
    }
    refreshList(["pets"], ["staff"], ["services"], ["appointments"]);
  };

  const openNewAppointment = (day?: Date) => {
    const target = day ?? new Date();
    setStartsAt(defaultStartsAtForDay(target));
    setOpenForm(true);
    // Siempre traer listados frescos al abrir el alta
    refreshList(["pets"], ["staff"], ["services"]);
  };

  useEffect(() => {
    if (search.google === "connected") {
      toast.success("Google Calendar conectado");
      qc.invalidateQueries({ queryKey: ["google-status"] });
    }
  }, [search.google, qc]);

  useEffect(() => {
    const sid = search.service;
    if (!sid) return;
    let cancelled = false;
    setServiceId(sid);
    setOpenForm(true);
    void (async () => {
      try {
        const slot = await fetchNextAppointmentSlot({ service_id: sid });
        if (cancelled) return;
        setStartsAt(toLocalInputValue(new Date(slot.starts_at)));
        toast.message(`Primer turno libre: ${slot.label}`, {
          description: new Date(slot.starts_at).toLocaleString("es-CO", {
            weekday: "short",
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          }),
        });
      } catch (e) {
        if (cancelled) return;
        setStartsAt(defaultStartsAtForDay(new Date()));
        toast.error(e instanceof Error ? e.message : "No se encontró un turno libre");
      } finally {
        if (!cancelled) {
          // Usar fullPath /panel/agenda (nunca el id /_authenticated/...), o la URL queda rota.
          void navigate({
            to: "/panel/agenda",
            search: { google: search.google, service: undefined },
            replace: true,
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [search.service, search.google, navigate]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Sin cita");
      if (!formDirty && !extrasDirty) {
        throw new Error("No hay cambios para guardar");
      }
      const nextStatus = editForm.status;
      if (nextStatus === "finalizada" && normalizeStatus(selected.status) !== "finalizada") {
        setFinishAppt(selected);
        setSelected(null);
        return null;
      }
      // PATCH ya notifica por correo (actualización o cancelación) con snapshot + notas.
      if (formDirty) {
        const patched = await updateAppointment(selected.id, {
          pet_id: editForm.pet_id || undefined,
          service_id: editForm.service_id || undefined,
          ...(perms.isCliente
            ? {
                starts_at: new Date(editForm.starts_at).toISOString(),
                notes: editForm.notes,
              }
            : {
                staff_id: editForm.staff_id || null,
                starts_at: new Date(editForm.starts_at).toISOString(),
              }),
          ...(perms.canChangeAppointmentStatus ? { status: nextStatus } : {}),
        });
        return {
          ok: true,
          template_key:
            nextStatus === "cancelada" ? "appointment_cancelled" : "appointment_updated",
          email_notifications: patched.email_notifications ?? [],
          reschedule_pending: Boolean(
            (patched as { reschedule_pending?: boolean }).reschedule_pending,
          ),
          eligible_staff: (patched as { eligible_staff?: { id: string; full_name: string }[] })
            .eligible_staff,
        };
      }
      // Solo extras: avisá con el snapshot actual
      return notifyAppointmentUpdate(selected.id);
    },
    onSuccess: (row) => {
      if (!row) return;
      if ("reschedule_pending" in row && row.reschedule_pending) {
        toast.message("Usaste los 3 reagendamientos. El 4.º quedó pendiente de aprobación del spa.");
      } else {
        const mailed = (row.email_notifications ?? []).filter((n) => n.sent).length;
        toast.success(
          mailed > 0
            ? `Cambios guardados · aviso enviado a ${mailed} humano${mailed > 1 ? "s" : ""}`
            : "Cambios guardados (correo en log si SMTP no está configurado)",
        );
      }
      setExtrasBaseline(extrasFingerprint(extras));
      setEditBaseline(editForm);
      setSelected(null);
      void qc.invalidateQueries({ queryKey: ["appointments"] });
      void qc.invalidateQueries({ queryKey: ["notifications"] });
      void qc.invalidateQueries({ queryKey: ["appointment-reschedules"] });
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 409 && e.detail && typeof e.detail === "object") {
        const d = e.detail as { message?: string; suggestions?: { full_name: string }[] };
        const names = (d.suggestions ?? []).map((s) => s.full_name).join(", ");
        toast.error(
          `${d.message ?? e.message}${names ? ` · Sugeridos: ${names}` : ""}`,
        );
        return;
      }
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    },
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateAppointmentStatus(id, status),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["appointments"] });
      toast.success("Estado actualizado");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const addExtraMut = useMutation({
    mutationFn: (input: { item_name: string; unit_price: number }) => {
      if (!selected) throw new Error("Sin cita");
      return addAppointmentExtra(selected.id, { ...input, quantity: 1 });
    },
    onSuccess: () => {
      toast.success("Extra agregado · el correo se envía al Guardar cambios");
      setExtraQuery("");
      setExtraPrice("");
      if (selected) void loadExtras(selected.id);
      void qc.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo agregar"),
  });

  const deleteExtraMut = useMutation({
    mutationFn: (extraId: string) => {
      if (!selected) throw new Error("Sin cita");
      return deleteAppointmentExtra(selected.id, extraId);
    },
    onSuccess: () => {
      toast.success("Extra eliminado · el correo se envía al Guardar cambios");
      if (selected) void loadExtras(selected.id);
      void qc.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo eliminar"),
  });

  const patchExtraMut = useMutation({
    mutationFn: ({ extraId, quantity }: { extraId: string; quantity: number }) => {
      if (!selected) throw new Error("Sin cita");
      return updateAppointmentExtra(selected.id, extraId, { quantity });
    },
    onSuccess: (row) => {
      setExtras((prev) => {
        const next = prev.map((ex) => (ex.id === row.id ? { ...ex, ...row } : ex));
        return next;
      });
      void qc.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo actualizar"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteAppointment(id),
    onSuccess: () => {
      toast.success(
        perms.isCliente
          ? "Turno cancelado. Avisamos por correo a los dueños."
          : "Cita eliminada. Avisamos por correo a los dueños.",
      );
      setSelected(null);
      void qc.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo eliminar"),
  });

  const create = useMutation({
    mutationFn: () =>
      createAppointment({
        pet_id: petId,
        service_id: serviceId,
        staff_id: perms.isCliente ? null : lockedStaffId || formStaffId || null,
        starts_at: new Date(startsAt).toISOString(),
        notes: notes || undefined,
        sync_google: perms.canConnectGoogle,
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      setOpenForm(false);
      setNotes("");
      setPetId("");
      setServiceId("");
      setFormStaffId("");
      const links =
        perms.canSeeWhatsAppLinks && data.whatsapp_links?.length
          ? data.whatsapp_links
          : perms.canSeeWhatsAppLinks && data.whatsapp_link
            ? [{ link: data.whatsapp_link }]
            : [];
      setLastWa(links.length ? links : null);
      // Asegurar que la semana visible incluye la cita nueva
      const createdDay = new Date(startsAt);
      setAnchor(startOfWeek(createdDay));

      const emailed = (data.email_notifications ?? []).filter((n) => n.sent).length;
      const emailTargets = (data.owner_emails ?? []).length;
      if (emailed > 0) {
        toast.success(
          `Cita creada. Correo de confirmación a ${emailed} dueño${emailed > 1 ? "s" : ""}.`,
        );
      } else if (emailTargets > 0) {
        toast.success(
          "Cita creada. Correo registrado en log (SMTP no configurado) para los dueños con email.",
        );
      } else if (data.google?.synced) {
        toast.success("Cita creada y enviada a Google Calendar");
      } else if (data.google?.error) {
        toast.warning(`Cita guardada en Spa Kira. Google: ${data.google.error}`);
      } else {
        toast.success("Cita creada en Spa Kira");
      }
      if (data.google?.synced && (data.google.attendees?.length ?? 0) > 1) {
        toast.message(`Invitación Google a ${data.google.attendees!.length} dueños`);
      }
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 409 && e.detail && typeof e.detail === "object") {
        const d = e.detail as { message?: string; suggestions?: { full_name: string }[] };
        const names = (d.suggestions ?? []).map((s) => s.full_name).join(", ");
        toast.error(`${d.message ?? e.message}${names ? ` · Sugeridos: ${names}` : ""}`);
        return;
      }
      toast.error(e instanceof Error ? e.message : "No se pudo crear");
    },
  });

  const reviewMut = useMutation({
    mutationFn: (input: {
      id: string;
      status: "approved" | "rejected";
      lock_further?: boolean;
    }) => reviewAppointmentReschedule(input.id, input),
    onSuccess: (row) => {
      toast.success(row.status === "approved" ? "Reagendamiento aprobado" : "Pedido rechazado");
      void qc.invalidateQueries({ queryKey: ["appointment-reschedules"] });
      void qc.invalidateQueries({ queryKey: ["appointments"] });
      void qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo revisar"),
  });

  const breeds = useMemo(
    () =>
      [...new Set((appts.data ?? []).map((a) => a.pets?.breed).filter(Boolean) as string[])].sort(),
    [appts.data],
  );

  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(anchor);
    d.setDate(d.getDate() + i);
    return d;
  });

  const filtered = (appts.data ?? []).filter((a) => {
    const text = `${a.pets?.name ?? ""} ${a.pets?.owners?.full_name ?? ""}`.toLowerCase();
    if (q && !text.includes(q.toLowerCase())) return false;
    if (breed !== "todas" && a.pets?.breed !== breed) return false;
    const effectiveStaff = lockedStaffId || staffId;
    if (effectiveStaff !== "todos" && a.staff_id !== effectiveStaff) return false;
    if (status !== "todos" && a.status !== status) return false;
    return true;
  });

  const rangeLabel = `${days[0]!.toLocaleDateString("es-CO", { day: "numeric", month: "short" })} — ${days[6]!.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}`;

  const startsAtDayKey = startsAt ? dayKey(new Date(startsAt)) : "";
  const isStartsToday = startsAtDayKey === dayKey(new Date());
  const isStartsTomorrow = startsAtDayKey === dayKey(addDays(new Date(), 1));

  return (
    <AppShell
      title={perms.isStaff && !perms.isColaborador ? "Agenda" : "Mi agenda"}
      subtitle={
        perms.isCliente
          ? `${rangeLabel} · pedí, cambiá o cancelá tus turnos`
          : perms.isColaborador && myStaff.data
          ? `${rangeLabel} · ${myStaff.data.full_name}`
          : `${rangeLabel} · tocá una ficha para gestionar`
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {perms.canConnectGoogle && google.data && !google.data.authorized ? (
            <Button asChild variant="outline" className="h-10 rounded-xl">
              <a href={googleConnectUrl()}>
                <CalendarCheck className="mr-2 h-4 w-4" /> Conectar Google
              </a>
            </Button>
          ) : perms.canConnectGoogle ? (
            <span className="hidden text-xs text-muted-foreground sm:inline">
              Google Calendar {google.data?.authorized ? "OK" : "…"}
            </span>
          ) : null}
          <Button className="h-10 rounded-xl" onClick={() => openNewAppointment()}>
            <Plus className="mr-2 h-4 w-4" /> Nueva cita
          </Button>
        </div>
      }
    >
      {perms.isAdmin && (pendingReschedules.data?.length ?? 0) > 0 ? (
        <div className="card-soft mb-6 p-5">
          <h3 className="font-display text-lg font-bold text-primary">
            4.º reagendamiento (revisión)
          </h3>
          <ul className="mt-3 space-y-3">
            {(pendingReschedules.data ?? []).map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-secondary/50 p-3 text-sm"
              >
                <div>
                  <p className="font-medium">{r.pet_name ?? "Mascota"} · {r.requested_email}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.previous_starts_at).toLocaleString("es-CO")} →{" "}
                    {new Date(r.requested_starts_at).toLocaleString("es-CO")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className="rounded-xl"
                    disabled={reviewMut.isPending}
                    onClick={() => reviewMut.mutate({ id: r.id, status: "approved" })}
                  >
                    Aprobar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl"
                    disabled={reviewMut.isPending}
                    onClick={() => reviewMut.mutate({ id: r.id, status: "rejected" })}
                  >
                    Rechazar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-xl text-destructive"
                    disabled={reviewMut.isPending}
                    onClick={() =>
                      reviewMut.mutate({ id: r.id, status: "rejected", lock_further: true })
                    }
                  >
                    No más cambios
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {openForm ? (
        <div className="card-soft mb-6 p-5">
          <h3 className="font-display text-lg font-bold text-primary">Nueva cita</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {perms.isCliente
              ? "Elegí mascota, servicio y horario. El spa asigna quién te atiende."
              : "Se guarda en Spa Kira, se envía correo a cada dueño con email y, si Google está conectado, se invita a todos los dueños."}
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Mascota</Label>
              <Select
                value={petId}
                onValueChange={setPetId}
                onOpenChange={(open) => {
                  if (open) refreshList(["pets"]);
                }}
              >
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Elegir mascota" />
                </SelectTrigger>
                <SelectContent>
                  {(pets.data ?? [])
                    .filter((p) => !!p?.id)
                    .map((p) => {
                      const owners = petOwnerLabel(p);
                      return (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                          {owners ? ` · ${owners}` : ""}
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Servicio</Label>
              <Select
                value={serviceId}
                onValueChange={setServiceId}
                onOpenChange={(open) => {
                  if (open) refreshList(["services"]);
                }}
              >
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Elegir servicio" />
                </SelectTrigger>
                <SelectContent>
                  {(services.data ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {perms.isCliente
                        ? `${s.name} · ${s.duration_min} min`
                        : `${s.name} · ${copRange(s.price_min, s.price_max, s.price)}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!perms.isCliente ? (
            <div className="space-y-2">
              <Label>Encargado</Label>
              <Select
                value={formStaffId || "none"}
                onValueChange={(v) => setFormStaffId(v === "none" ? "" : v)}
                onOpenChange={(open) => {
                  if (open) refreshList(["staff"]);
                }}
              >
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {staffForForm
                    .filter((s) => s.active !== false)
                    .filter((s) => {
                      if (perms.isCliente) return true;
                      const svc = (services.data ?? []).find((x) => x.id === serviceId);
                      return staffCoversService(s.skills, svc?.activities);
                    })
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.full_name}
                        {s.skills?.length ? ` · ${s.skills.join(", ")}` : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {serviceId ? (
                <p className="text-[11px] text-muted-foreground">
                  Solo se listan colaboradores que cubren las actividades del servicio. El admin
                  puede forzar otro desde Gestión si hace falta.
                </p>
              ) : null}
            </div>
            ) : (
              <p className="sm:col-span-2 text-xs text-muted-foreground">
                El encargado lo asigna el spa según horarios y disponibilidad. No se elige ni se
                modifica desde acá.
              </p>
            )}
            <div className="space-y-2">
              <Label>Fecha y hora</Label>
              <div className="mb-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={isStartsToday ? "default" : "outline"}
                  className="h-8 rounded-lg"
                  onClick={() => setStartsAt(defaultStartsAtForDay(new Date()))}
                >
                  Hoy
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={isStartsTomorrow ? "default" : "outline"}
                  className="h-8 rounded-lg"
                  onClick={() => setStartsAt(defaultStartsAtForDay(addDays(new Date(), 1)))}
                >
                  Mañana
                </Button>
              </div>
              <Input
                type="datetime-local"
                className="h-11 rounded-xl"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Notas</Label>
              <Input
                className="h-11 rounded-xl"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Indicaciones para el groomer…"
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              className="h-11 rounded-xl"
              disabled={!petId || !serviceId || !startsAt || create.isPending}
              onClick={() => create.mutate()}
            >
              {create.isPending ? "Guardando…" : "Crear cita"}
            </Button>
            <Button variant="outline" className="h-11 rounded-xl" onClick={() => setOpenForm(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}

      {perms.canSeeWhatsAppLinks && lastWa?.length ? (
        <div className="mb-6 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted-foreground">
                Cita lista. Avisá por WhatsApp a cada dueño (abre el chat con el mensaje).
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {lastWa.map((wa) => (
                  <Button key={wa.link} asChild className="h-10 rounded-xl">
                    <a href={wa.link} target="_blank" rel="noopener noreferrer">
                      WhatsApp{wa.full_name ? ` · ${wa.full_name}` : ""}
                    </a>
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="card-soft p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-lg"
              onClick={() => {
                const d = new Date(anchor);
                d.setDate(d.getDate() - 7);
                setAnchor(d);
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              className="h-9 rounded-lg px-3 text-sm"
              onClick={() => setAnchor(startOfWeek(new Date()))}
            >
              Hoy
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-lg"
              onClick={() => {
                const d = new Date(anchor);
                d.setDate(d.getDate() + 7);
                setAnchor(d);
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex min-w-[200px] flex-1 items-center gap-2">
            <Filter className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar mascota o propietario…"
              className="h-10 rounded-xl"
            />
          </div>

          <Select
            value={breed}
            onValueChange={setBreed}
            onOpenChange={(open) => {
              if (open) refreshList(["appointments"]);
            }}
          >
            <SelectTrigger className="h-10 w-[160px] rounded-xl">
              <SelectValue placeholder="Raza" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las razas</SelectItem>
              {breeds.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {lockedStaffId ? (
            <div className="flex h-10 items-center rounded-xl border border-border px-3 text-sm text-muted-foreground">
              {myStaff.data?.full_name ?? "Mis turnos"}
            </div>
          ) : perms.isStaff ? (
            <Select
              value={staffId}
              onValueChange={setStaffId}
              onOpenChange={(open) => {
                if (open) refreshList(["staff"], ["appointments"]);
              }}
            >
              <SelectTrigger className="h-10 w-[170px] rounded-xl">
                <SelectValue placeholder="Encargado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todo el personal</SelectItem>
                {(staff.data ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}

          <Select
            value={status}
            onValueChange={setStatus}
            onOpenChange={(open) => {
              if (open) refreshList(["appointments"]);
            }}
          >
            <SelectTrigger className="h-10 w-[150px] rounded-xl">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {statusMeta(s).label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
        {days.map((d) => {
          const key = dayKey(d);
          const list = filtered.filter((a) => dayKey(new Date(a.starts_at)) === key);
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
                    {d.toLocaleDateString("es-CO", { weekday: "short" })}
                  </p>
                  <p className="font-display text-lg font-bold text-primary">{d.getDate()}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                    {list.length}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 rounded-lg"
                    title={`Nueva cita el ${d.toLocaleDateString("es-CO")}`}
                    onClick={() => openNewAppointment(d)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {list.map((a) => {
                  const meta = statusMeta(a.status);
                  const st = normalizeStatus(a.status);
                  const prog =
                    perms.canSeeServiceProgress && st === "enproceso"
                      ? appointmentProgress(a.starts_at, a.duration_min, new Date(nowTick))
                      : null;
                  return (
                    <article
                      key={a.id}
                      className="rounded-xl border border-border/70 bg-background/70 p-2.5 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lift"
                    >
                      <button
                        type="button"
                        onClick={() => openManage(a)}
                        className="w-full text-left"
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="flex w-11 shrink-0 flex-col items-center gap-1">
                            {a.pets?.photo_url ? (
                              <img
                                src={a.pets.photo_url}
                                alt={a.pets.name}
                                className="h-10 w-10 rounded-xl object-cover"
                              />
                            ) : (
                              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-xs font-semibold text-primary">
                                {initials(a.pets?.name ?? "?")}
                              </span>
                            )}
                            {a.staff?.photo_url ? (
                              <img
                                src={a.staff.photo_url}
                                alt={a.staff.full_name}
                                title={a.staff.full_name}
                                className="h-6 w-6 rounded-full object-cover ring-2 ring-background"
                              />
                            ) : (
                              <span
                                title={a.staff?.full_name ?? "Sin asignar"}
                                className="grid h-6 w-6 place-items-center rounded-full bg-secondary text-[9px] font-semibold text-secondary-foreground ring-2 ring-background"
                              >
                                {a.staff ? initials(a.staff.full_name) : "—"}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {a.pets?.name}
                            </p>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {time(a.starts_at)} · {a.services?.name}
                            </p>
                            <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">
                              <span className="font-medium text-foreground/80">Tu colaborador es:</span>
                              <br />
                              <span className="text-primary">{a.staff?.full_name ?? "Sin asignar"}</span>
                            </p>
                            <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
                              <span className="font-medium text-foreground/80">Humano de compañía:</span>
                              <br />
                              <span>{a.pets?.owners?.full_name ?? "—"}</span>
                            </p>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <StatusPill label={meta.label} className={meta.className} hint={meta.hint} />
                          <span className="text-right text-[11px] font-medium text-accent">
                            {cop(appointmentChargeTotal(a))}
                            {Number(a.extras_count ?? 0) > 0 ? (
                              <span className="mt-0.5 block text-[9px] font-normal text-muted-foreground">
                                incl. {a.extras_count} extra
                                {Number(a.extras_count) === 1 ? "" : "s"}
                              </span>
                            ) : null}
                          </span>
                        </div>
                        {prog ? (
                          <div className="mt-2">
                            <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
                              <span>
                                {prog.overtime
                                  ? `+${prog.elapsedMin - (a.duration_min || 60)} min`
                                  : `${prog.remainingMin} min rest.`}
                              </span>
                              <span>{Math.round(prog.ratio * 100)}%</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all duration-500",
                                  prog.overtime ? "bg-destructive" : "bg-accent",
                                )}
                                style={{ width: `${Math.round(prog.ratio * 100)}%` }}
                              />
                            </div>
                          </div>
                        ) : null}
                      </button>
                      {perms.canChangeAppointmentStatus ? (
                      <div
                        className="mt-2"
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        <Select
                          value={normalizeStatus(a.status)}
                          onValueChange={(v) => {
                            if (v === "finalizada") {
                              setFinishAppt(a);
                              return;
                            }
                            statusMut.mutate({ id: a.id, status: v });
                          }}
                        >
                          <SelectTrigger className="h-8 rounded-lg text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUSES.map((s) => (
                              <SelectItem key={s} value={s} className="text-xs" title={statusMeta(s).hint}>
                                {statusMeta(s).label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      ) : null}
                    </article>
                  );
                })}
                {!list.length ? (
                  <button
                    type="button"
                    onClick={() => openNewAppointment(d)}
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

      {!filtered.length ? (
        <div className="mt-6">
          <Empty message="Ningún resultado con los filtros seleccionados." />
        </div>
      ) : null}

      <FinishAppointmentDialog
        appointment={finishAppt}
        open={!!finishAppt}
        onOpenChange={(o) => {
          if (!o) setFinishAppt(null);
        }}
        onDone={() => {
          setFinishAppt(null);
          void qc.invalidateQueries({ queryKey: ["appointments"] });
          void qc.invalidateQueries({ queryKey: ["pets"] });
          void qc.invalidateQueries({ queryKey: ["sales"] });
        }}
      />

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="flex max-h-[90vh] max-w-lg flex-col overflow-hidden rounded-3xl p-0">
          {selected ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="shrink-0 border-b border-border px-6 pb-4 pt-6 pr-12">
                <div className="flex items-start gap-4">
                  {selected.pets?.photo_url ? (
                    <img
                      src={selected.pets.photo_url}
                      alt={selected.pets.name}
                      className="h-16 w-16 shrink-0 rounded-2xl object-cover"
                    />
                  ) : (
                    <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-primary/10 text-lg font-semibold text-primary">
                      {initials(selected.pets?.name ?? "?")}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      Gestionar cita
                    </p>
                    <h2 className="font-display text-xl font-bold text-primary">
                      {selected.pets?.name ?? "Cita"}
                    </h2>
                    <p className="mt-2 text-sm leading-snug text-muted-foreground">
                      <span className="font-medium text-foreground">Tu colaborador es:</span>
                      <br />
                      {selected.staff?.full_name ?? "Sin asignar"}
                    </p>
                    <p className="mt-1.5 text-sm leading-snug text-muted-foreground">
                      <span className="font-medium text-foreground">Humano de compañía:</span>
                      <br />
                      {selected.pets?.owners?.full_name ?? "—"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Mascota</Label>
                    <Select
                      value={editForm.pet_id}
                      onValueChange={(v) => setEditForm((f) => ({ ...f, pet_id: v }))}
                    >
                      <SelectTrigger className="h-11 rounded-xl">
                        <SelectValue placeholder="Mascota" />
                      </SelectTrigger>
                      <SelectContent>
                        {(pets.data ?? [])
                          .filter((p) => !!p?.id)
                          .map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                              {petOwnerLabel(p) ? ` · ${petOwnerLabel(p)}` : ""}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Servicio</Label>
                    <Select
                      value={editForm.service_id}
                      onValueChange={(v) => setEditForm((f) => ({ ...f, service_id: v }))}
                    >
                      <SelectTrigger className="h-11 rounded-xl">
                        <SelectValue placeholder="Servicio" />
                      </SelectTrigger>
                      <SelectContent>
                        {(services.data ?? []).map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {perms.isCliente
                              ? `${s.name} · ${s.duration_min} min`
                              : `${s.name} · ${copRange(s.price_min, s.price_max, s.price)}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {!perms.isCliente ? (
                  <div className="space-y-2">
                    <Label>Colaborador asignado</Label>
                    <Select
                      value={editForm.staff_id || "none"}
                      onValueChange={(v) =>
                        setEditForm((f) => ({ ...f, staff_id: v === "none" ? "" : v }))
                      }
                    >
                      <SelectTrigger className="h-11 rounded-xl">
                        <SelectValue placeholder="Asignar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin asignar</SelectItem>
                        {(staff.data ?? [])
                          .filter((s) => s.active)
                          .map((s) => {
                            const svc = (services.data ?? []).find(
                              (x) => x.id === editForm.service_id,
                            );
                            const ok = staffCoversService(s.skills, svc?.activities);
                            return (
                              <SelectItem key={s.id} value={s.id}>
                                {s.full_name}
                                {!ok ? " · (no cubre actividades)" : ""}
                              </SelectItem>
                            );
                          })}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">
                      Si el colaborador no cubre el servicio, al guardar el sistema rechaza y
                      sugiere quién sí puede. Podés tomar o intercambiar turnos si no hay solape.
                    </p>
                  </div>
                  ) : (
                    <div className="space-y-2">
                      <Label>Encargado</Label>
                      <p className="rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-sm">
                        {selected.staff?.full_name ?? "El spa lo asigna"}
                      </p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Fecha y hora</Label>
                    <Input
                      type="datetime-local"
                      className="h-11 rounded-xl"
                      value={editForm.starts_at}
                      disabled={perms.isCliente && Boolean(selected.reschedule_locked)}
                      onChange={(e) => setEditForm((f) => ({ ...f, starts_at: e.target.value }))}
                    />
                    {perms.isCliente ? (
                      <p className="text-[11px] text-muted-foreground">
                        Podés cambiar fecha y hora con Guardar (máx. 3). El 4.º lo revisa el spa.
                        Usados: {selected.reschedule_count ?? 0}/3
                        {selected.reschedule_locked ? " · el spa bloqueó más cambios" : ""}
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label>Estado</Label>
                    {perms.canChangeAppointmentStatus ? (
                    <Select
                      value={editForm.status}
                      onValueChange={(v) => setEditForm((f) => ({ ...f, status: v }))}
                    >
                      <SelectTrigger className="h-11 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {statusMeta(s).label}
                            </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    ) : (
                      <p
                        className="cursor-help rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-sm"
                        title={statusMeta(normalizeStatus(selected.status)).hint}
                      >
                        {statusMeta(normalizeStatus(selected.status)).label}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Notas</Label>
                    <Input
                      className="h-11 rounded-xl"
                      value={editForm.notes}
                      disabled={!perms.isCliente}
                      readOnly={!perms.isCliente}
                      onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                      title={
                        perms.isCliente
                          ? "Indicaciones para el spa"
                          : "Solo el humano de compañía puede editar notas, y solo antes de En proceso"
                      }
                    />
                    <p className="text-[11px] text-muted-foreground">
                      {perms.isCliente
                        ? "Estas notas las ve el spa al preparar el servicio."
                        : "Solo el humano de compañía puede editar las notas, y únicamente antes de En proceso. Admin y colaborador no pueden modificarlas."}
                    </p>
                  </div>
                </div>

                {perms.canSeeServiceProgress &&
                normalizeStatus(selected.status) === "enproceso" ? (
                  <div className="mt-4 rounded-2xl border border-border bg-secondary/30 p-3">
                    {(() => {
                      const prog = appointmentProgress(
                        selected.starts_at,
                        selected.duration_min,
                        new Date(nowTick),
                      );
                      return (
                        <>
                          <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
                            <span>
                              Servicio · {selected.duration_min} min
                              {prog.overtime ? " · tiempo extra" : ""}
                            </span>
                            <span>{Math.round(prog.ratio * 100)}%</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-secondary">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                prog.overtime ? "bg-destructive" : "bg-accent",
                              )}
                              style={{ width: `${Math.round(prog.ratio * 100)}%` }}
                            />
                          </div>
                        </>
                      );
                    })()}
                  </div>
                ) : null}

                {perms.isStaff ? (
                <div className="mt-6 rounded-2xl border border-border p-4">
                  <h3 className="font-display text-base font-bold text-primary">
                    Servicios adicionales
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {perms.isCliente
                      ? "Podés pedir extras para esta visita."
                      : "Los extras se guardan al instante; el correo al humano (con totales) se envía al Guardar cambios."}
                  </p>
                  <div className="relative mt-3">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="h-11 rounded-xl pl-9"
                      placeholder="Buscar en catálogo o escribir un ítem…"
                      value={extraQuery}
                      onChange={(e) => setExtraQuery(e.target.value)}
                    />
                  </div>
                  {extraQuery.trim().length >= 1 ? (
                    <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto rounded-xl border border-border bg-card p-1">
                      {miscCatalog.filter((item) =>
                        item.name.toLowerCase().includes(extraQuery.trim().toLowerCase()),
                      )
                        .slice(0, 8)
                        .map((item) => (
                          <li key={item.name}>
                            <button
                              type="button"
                              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-secondary/60"
                              onClick={() =>
                                addExtraMut.mutate({
                                  item_name: item.name,
                                  unit_price: item.unit_price,
                                })
                              }
                            >
                              <span>{item.name}</span>
                              <span className="text-accent">{cop(item.unit_price)}</span>
                            </button>
                          </li>
                        ))}
                      {!miscCatalog.some(
                        (i) => i.name.toLowerCase() === extraQuery.trim().toLowerCase(),
                      ) && extraQuery.trim().length >= 2 ? (
                        <li className="border-t border-border p-2">
                          <div className="flex gap-2">
                            <Input
                              className="h-9 rounded-lg"
                              placeholder="Precio"
                              value={extraPrice}
                              onChange={(e) => setExtraPrice(e.target.value)}
                            />
                            <Button
                              type="button"
                              size="sm"
                              className="rounded-lg"
                              disabled={addExtraMut.isPending}
                              onClick={() => {
                                const price = Number(extraPrice);
                                if (!Number.isFinite(price) || price < 0) {
                                  toast.error("Indicá un precio válido");
                                  return;
                                }
                                addExtraMut.mutate({
                                  item_name: extraQuery.trim(),
                                  unit_price: price,
                                });
                              }}
                            >
                              Agregar
                            </Button>
                          </div>
                        </li>
                      ) : null}
                    </ul>
                  ) : null}

                  <ul className="mt-3 space-y-2">
                    {extras.map((ex) => {
                      const qty = Math.max(1, Number(ex.quantity) || 1);
                      const unit = Number(ex.unit_price) || 0;
                      const total = Number(ex.total) || qty * unit;
                      return (
                        <li
                          key={ex.id}
                          className="rounded-xl bg-secondary/40 px-3 py-2.5 text-sm"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="min-w-0 flex-1 font-medium leading-snug text-foreground">
                              {ex.item_name}
                            </p>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0 text-destructive"
                              aria-label={`Eliminar ${ex.item_name}`}
                              disabled={deleteExtraMut.isPending}
                              onClick={() => {
                                setConfirmAction({
                                  title: "Quitar extra",
                                  description: `¿Quitar “${ex.item_name}” de esta cita?`,
                                  actionLabel: "Quitar",
                                  onConfirm: () => deleteExtraMut.mutate(ex.id),
                                });
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 rounded-lg"
                                disabled={patchExtraMut.isPending || qty <= 1}
                                aria-label="Restar"
                                onClick={() =>
                                  patchExtraMut.mutate({ extraId: ex.id, quantity: qty - 1 })
                                }
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </Button>
                              <Input
                                type="number"
                                min={1}
                                step={1}
                                className="h-8 w-14 rounded-lg px-1 text-center text-sm"
                                value={qty}
                                onChange={(e) => {
                                  const next = Math.max(1, Math.floor(Number(e.target.value) || 1));
                                  setExtras((prev) =>
                                    prev.map((row) =>
                                      row.id === ex.id
                                        ? {
                                            ...row,
                                            quantity: next,
                                            total: next * unit,
                                          }
                                        : row,
                                    ),
                                  );
                                }}
                                onBlur={(e) => {
                                  const next = Math.max(1, Math.floor(Number(e.target.value) || 1));
                                  if (next !== Number(ex.quantity)) {
                                    patchExtraMut.mutate({ extraId: ex.id, quantity: next });
                                  }
                                }}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 rounded-lg"
                                disabled={patchExtraMut.isPending}
                                aria-label="Sumar"
                                onClick={() =>
                                  patchExtraMut.mutate({ extraId: ex.id, quantity: qty + 1 })
                                }
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            <div className="text-right text-xs leading-snug">
                              <p className="text-muted-foreground">
                                Unitario {cop(unit)}
                              </p>
                              <p className="font-semibold text-accent">Total {cop(total)}</p>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                    {!extras.length ? (
                      <li className="text-xs text-muted-foreground">Sin extras en esta cita.</li>
                    ) : null}
                  </ul>
                  <div className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Servicio</span>
                      <span>{cop(selected.price)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Extras</span>
                      <span>
                        {cop(extras.reduce((s, ex) => s + Number(ex.total || 0), 0))}
                      </span>
                    </div>
                    <div className="flex justify-between font-semibold text-accent">
                      <span>Total</span>
                      <span>
                        {cop(
                          Number(selected.price || 0) +
                            extras.reduce((s, ex) => s + Number(ex.total || 0), 0),
                        )}
                      </span>
                    </div>
                  </div>
                </div>
                ) : null}
              </div>

              <div className="shrink-0 border-t border-border px-6 py-4">
                <div className="flex flex-wrap gap-2">
                  {perms.isStaff || perms.isCliente ? (
                    <>
                      <Button
                        className="rounded-xl"
                        disabled={saveMut.isPending || !canSaveNotify}
                        onClick={() => saveMut.mutate()}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        {saveMut.isPending ? "Guardando…" : "Guardar cambios"}
                      </Button>
                      {perms.canFinishAppointments ? (
                      <Button
                        variant="outline"
                        className="rounded-xl"
                        onClick={() => {
                          setFinishAppt(selected);
                          setSelected(null);
                        }}
                      >
                        Finalizar servicio
                      </Button>
                      ) : null}
                      <Button
                        variant="outline"
                        className="rounded-xl border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        disabled={deleteMut.isPending}
                        onClick={() => {
                          const petName = selected.pets?.name ?? (perms.isCliente ? "tu mascota" : "esta mascota");
                          setConfirmAction({
                            title: perms.isCliente ? "Cancelar turno" : "Eliminar cita",
                            description: perms.isCliente
                              ? `¿Cancelar y quitar el turno de ${petName}? Avisaremos por correo.`
                              : `¿Eliminar la cita de ${petName}? Avisaremos por correo a los dueños.`,
                            actionLabel: perms.isCliente ? "Sí, cancelar" : "Sí, eliminar",
                            onConfirm: () => deleteMut.mutate(selected.id),
                          });
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />{" "}
                        {perms.isCliente ? "Cancelar turno" : "Eliminar"}
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.title}
        description={confirmAction?.description}
        confirmLabel={confirmAction?.actionLabel ?? "Confirmar"}
        cancelLabel="Volver"
        onConfirm={() => confirmAction?.onConfirm()}
        onOpenChange={(o) => {
          if (!o) setConfirmAction(null);
        }}
      />
    </AppShell>
  );
}
