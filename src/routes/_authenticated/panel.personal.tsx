import { useMemo, useState } from "react";
import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Percent, Wallet, Star, Plus, Pencil, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Empty, SectionCard } from "@/components/ui-kit";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  staffQuery,
  appointmentsQuery,
  salesQuery,
  createStaff,
  updateStaff,
  updateMyStaffDisplay,
  deleteStaff,
  listStaffPayTerms,
  getPayrollSettings,
  savePayrollSettings,
  previewPayroll,
  closePayroll,
  listPayrollRuns,
  listCalendarRequests,
  reviewCalendarRequest,
  deleteStaffCalendarDay,
  getStaffWorkHours,
  getStaffWorkHoursHistory,
  saveStaffWorkHours,
  getStaffSkillCatalog,
  getLocations,
  type Staff,
  type PayrollPreview,
} from "@/lib/spa-queries";
import { uploadPhoto } from "@/lib/api";
import { canonicalizeStaffRole, staffRoleLabel, staffRolesLine, STAFF_ROLE_OPTS, isAdminStaffJob } from "@/lib/staff-roles";
import { cop, dayKey, initials, shortDate, time } from "@/lib/format";
import { requirePathAccess } from "@/lib/route-access";
import { isActiveSale, permissionsFor } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/panel/personal")({
  beforeLoad: requirePathAccess("/panel/personal"),
  head: () => ({
    meta: [
      { title: "Staff | Spa Kira" },
      {
        name: "description",
        content:
          "Equipo del spa: CRUD, calendario, comisiones por periodo y liquidaciones de pago.",
      },
      { property: "og:title", content: "Staff | Spa Kira" },
      { property: "og:description", content: "Gestión del equipo y nómina." },
    ],
  }),
  component: Personal,
});

type Tab = "equipo" | "pagos" | "solicitudes";

const emptyForm = {
  full_name: "",
  role_title: "groomer",
  specialty: "",
  shift_rate: "0",
  payment_mode: "fijo",
  commission_pct: "0",
  pay_frequency: "quincenal",
  fixed_pay_basis: "por_turno",
  active: true,
  email: "",
  phone: "",
  address: "",
  birth_date: "",
  hired_at: "",
  photo_url: "",
  skills: ["groomer"] as string[],
  location_ids: [] as string[],
};

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function Personal() {
  const { user } = useRouteContext({ from: "/_authenticated" });
  const isAdmin = permissionsFor(user?.role).isAdmin;
  const qc = useQueryClient();
  const staff = useQuery(staffQuery);
  const locationsQ = useQuery({ queryKey: ["locations"], queryFn: getLocations, enabled: isAdmin });
  const activeLocations = (locationsQ.data?.items ?? []).filter((x) => x.active);
  const catalog = useQuery({
    queryKey: ["staff-skill-catalog"],
    queryFn: getStaffSkillCatalog,
  });
  const appts = useQuery(appointmentsQuery);
  const sales = useQuery({ ...salesQuery, enabled: isAdmin });
  const settings = useQuery({ queryKey: ["payroll-settings"], queryFn: getPayrollSettings });
  const runs = useQuery({ queryKey: ["payroll-runs"], queryFn: () => listPayrollRuns() });
  const requests = useQuery({
    queryKey: ["calendar-requests"],
    queryFn: () => listCalendarRequests("pending"),
  });

  const [tab, setTab] = useState<Tab>("equipo");
  const [selected, setSelected] = useState<Staff | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ name: string; id: string } | null>(null);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [frequency, setFrequency] = useState("quincenal");
  const [payStaffId, setPayStaffId] = useState("");
  const [payFrom, setPayFrom] = useState("");
  const [payTo, setPayTo] = useState("");
  const [preview, setPreview] = useState<PayrollPreview | null>(null);
  const [terms, setTerms] = useState<{ id: string; effective_from: string; effective_to: string | null; payment_mode: string; shift_rate: number; commission_pct: number }[]>([]);
  const [workHours, setWorkHours] = useState<
    {
      weekday: number;
      start_time: string;
      end_time: string;
      valid_from?: string;
      valid_to?: string;
    }[]
  >([]);
  const [hoursFrom, setHoursFrom] = useState("");
  const [hoursTo, setHoursTo] = useState("");
  const [hoursMode, setHoursMode] = useState<"base" | "ranged">("base");
  const adminJob = isAdminStaffJob(form.role_title);

  const servicesOf = (id: string) =>
    (appts.data ?? [])
      .filter((a) => a.staff_id === id && a.status === "finalizada")
      .sort((a, b) => +new Date(b.starts_at) - +new Date(a.starts_at));
  const soldBy = (id: string) =>
    (sales.data ?? [])
      .filter((s) => s.staff_id === id && isActiveSale(s.status))
      .reduce((a, s) => a + Number(s.total), 0);
  const shiftsOf = (id: string) =>
    new Set((appts.data ?? []).filter((a) => a.staff_id === id).map((a) => dayKey(new Date(a.starts_at))));

  const openCreate = () => {
    setEditing(null);
    const primary = activeLocations.find((x) => x.is_primary) ?? activeLocations[0];
    setForm({ ...emptyForm, location_ids: primary ? [primary.id] : [] });
    setFormOpen(true);
  };
  const openEdit = (s: Staff) => {
    setEditing(s);
    const primaryLocation = activeLocations.find((x) => x.is_primary) ?? activeLocations[0];
    setForm({
      full_name: s.full_name,
      role_title: canonicalizeStaffRole(s.role_title) || canonicalizeStaffRole(s.skills?.[0]) || "groomer",
      specialty: s.specialty ?? "",
      shift_rate: String(s.shift_rate ?? 0),
      payment_mode: s.payment_mode || "fijo",
      commission_pct: String(s.commission_pct ?? 0),
      pay_frequency: s.pay_frequency || "quincenal",
      fixed_pay_basis: s.fixed_pay_basis === "mensual" ? "mensual" : "por_turno",
      active: s.active,
      email: s.email ?? "",
      phone: s.phone ?? "",
      address: s.address ?? "",
      birth_date: (s.birth_date ?? "").toString().slice(0, 10),
      hired_at: (s.hired_at ?? "").toString().slice(0, 10),
      photo_url: s.photo_url ?? "",
      skills: (s.skills?.length ? s.skills : [s.role_title])
        .map((x) => canonicalizeStaffRole(x) || x)
        .filter((x, i, arr) => x && arr.indexOf(x) === i),
      location_ids: s.location_ids?.length
        ? s.location_ids
        : primaryLocation
          ? [primaryLocation.id]
          : [],
    });
    setFormOpen(true);
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!form.role_title) throw new Error("Elegí un cargo");
      const adminJob = isAdminStaffJob(form.role_title);
      const shift = Number(form.shift_rate) || 0;
      const pct = adminJob ? 0 : Number(form.commission_pct) || 0;
      const mode = adminJob ? "fijo" : form.payment_mode;
      const basis = form.fixed_pay_basis === "mensual" ? "mensual" : "por_turno";
      const rateLabel = basis === "mensual" ? "sueldo mensual" : "valor de turno";
      if (shift <= 0 && pct <= 0) {
        throw new Error(
          `Definí al menos ${rateLabel} o comisión (%). No pueden quedar los dos en 0.`,
        );
      }
      if (mode === "fijo" && shift <= 0) {
        throw new Error(
          pct > 0
            ? "Tenés comisión configurada pero el modo es Fijo. Usá «Comisión %» o «Mixto» para que cuente en el margen de cada cita."
            : `En pago fijo necesitás un ${rateLabel} mayor a 0.`,
        );
      }
      if (mode === "porcentaje" && pct <= 0) {
        throw new Error("En pago por comisión el % debe ser mayor a 0.");
      }
      if (mode === "mixto" && (shift <= 0 || pct <= 0)) {
        throw new Error(`En pago mixto necesitás ${rateLabel} y comisión mayores a 0.`);
      }
      let confirmHigh = false;
      if (basis === "por_turno" && (mode === "fijo" || mode === "mixto") && shift >= 1_000_000) {
        confirmHigh = window.confirm(
          "Ese monto parece un sueldo mensual, no un valor por turno. ¿Confirmás que es turno?",
        );
        if (!confirmHigh) {
          throw new Error("Cambiá a sueldo mensual o confirmá que el número es valor de turno.");
        }
      }
      const display = form.role_title;
      const payload = {
        full_name: form.full_name.trim(),
        role_title: display,
        specialty: adminJob ? null : form.specialty.trim() || null,
        shift_rate: shift,
        payment_mode: mode,
        commission_pct: pct,
        pay_frequency: form.pay_frequency,
        fixed_pay_basis: basis,
        confirm_high_shift_rate: confirmHigh,
        active: form.active,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        birth_date: form.birth_date || null,
        hired_at: form.hired_at || null,
        photo_url: form.photo_url.trim() || null,
        skills: [display],
        location_ids: form.location_ids,
        open_new_pay_term: true,
      };
      if (editing) return updateStaff(editing.id, payload);
      return createStaff(payload);
    },
    onSuccess: async (res) => {
      const msg =
        res && typeof res === "object" && "pay_term_message" in res
          ? String((res as { pay_term_message?: string }).pay_term_message || "")
          : "";
      toast.success(editing ? "Staff actualizado" : "Staff creado (mismo usuario del panel)");
      if (msg) toast.message(msg, { duration: 8000 });
      setFormOpen(false);
      await qc.invalidateQueries({ queryKey: ["staff"] });
      await qc.invalidateQueries({ queryKey: ["app-users"] });
      if (isAdmin && selected) {
        try {
          setTerms(await listStaffPayTerms(selected.id));
        } catch {
          /* ignore */
        }
        if (editing && selected.id === editing.id && res && typeof res === "object") {
          setSelected({ ...selected, ...(res as Staff) });
        }
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteStaff(id),
    onSuccess: async () => {
      toast.success("Colaborador eliminado. Ya no puede ingresar; el histórico queda anonimizado.");
      setSelected(null);
      await qc.invalidateQueries({ queryKey: ["staff"] });
      await qc.invalidateQueries({ queryKey: ["app-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const displayMut = useMutation({
    mutationFn: (role_title: string) => updateMyStaffDisplay(role_title),
    onSuccess: async (res) => {
      toast.success("Así te van a ver en el panel");
      setSelected(res);
      await qc.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const freqMut = useMutation({
    mutationFn: () => savePayrollSettings(frequency),
    onSuccess: async () => {
      toast.success("Frecuencia de cierre guardada");
      await qc.invalidateQueries({ queryKey: ["payroll-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const previewMut = useMutation({
    mutationFn: () =>
      previewPayroll({
        staff_id: payStaffId,
        frequency: frequency || settings.data?.default_frequency,
        period_start: payFrom,
        period_end: payTo,
      }),
    onSuccess: (res) => setPreview(res),
    onError: (e: Error) => toast.error(e.message),
  });

  const closeMut = useMutation({
    mutationFn: () => {
      if (!preview) throw new Error("Sin preview");
      return closePayroll({
        staff_id: preview.staff_id,
        frequency: preview.frequency,
        period_start: preview.period_start,
        period_end: preview.period_end,
        mark_paid: true,
      });
    },
    onSuccess: async () => {
      toast.success("Liquidación cerrada y marcada como pagada");
      setPreview(null);
      await qc.invalidateQueries({ queryKey: ["payroll-runs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reviewMut = useMutation({
    mutationFn: (input: { id: string; status: "approved" | "rejected" }) =>
      reviewCalendarRequest(input.id, {
        status: input.status,
        unassign_appointments: true,
      }),
    onSuccess: async () => {
      toast.success("Solicitud resuelta");
      await qc.invalidateQueries({ queryKey: ["calendar-requests"] });
      await qc.invalidateQueries({ queryKey: ["appointments"] });
      await qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const releaseDayMut = useMutation({
    mutationFn: async ({ staffId, day }: { staffId: string; day: string }) =>
      deleteStaffCalendarDay(staffId, day, "Liberar día con citas"),
    onSuccess: (res) => {
      if (res.requires_approval) {
        toast.message("Se envió solicitud al admin (hay citas ese día)");
        void qc.invalidateQueries({ queryKey: ["calendar-requests"] });
        void qc.invalidateQueries({ queryKey: ["notifications"] });
      } else {
        toast.success("Día liberado");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const defaultFreq = settings.data?.default_frequency ?? "quincenal";
  const freqValue = useMemo(
    () => frequency || defaultFreq,
    [frequency, defaultFreq],
  );

  return (
    <AppShell
      title="Staff"
      subtitle={`${(staff.data ?? []).length} integrantes · nómina y calendario`}
      actions={
        tab === "equipo" ? (
          <Button className="rounded-xl" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Nuevo
          </Button>
        ) : null
      }
    >
      <div className="mb-6 flex flex-wrap gap-2">
        {(
          [
            ["equipo", "Equipo"],
            ["pagos", "Pagos / cierres"],
            ["solicitudes", "Solicitudes calendario"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              tab === id
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            {label}
            {id === "solicitudes" && (requests.data?.length ?? 0) > 0
              ? ` (${requests.data!.length})`
              : ""}
          </button>
        ))}
      </div>

      {tab === "equipo" ? (
        <>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {(staff.data ?? []).map((s) => {
          const total = soldBy(s.id);
              const commission =
                s.payment_mode === "porcentaje" || s.payment_mode === "mixto"
                  ? (total * Number(s.commission_pct)) / 100
                  : 0;
          return (
            <button
              key={s.id}
                  type="button"
                  onClick={async () => {
                    setSelected(s);
                    setHoursMode("base");
                    setHoursFrom("");
                    setHoursTo("");
                    if (isAdmin) {
                      try {
                        setTerms(await listStaffPayTerms(s.id));
                      } catch {
                        setTerms([]);
                      }
                      try {
                        const hrs = await getStaffWorkHoursHistory(s.id);
                        setWorkHours(
                          hrs.map((h) => ({
                            weekday: h.weekday,
                            start_time: h.start_time,
                            end_time: h.end_time,
                            valid_from: h.valid_from ?? undefined,
                            valid_to: h.valid_to ?? undefined,
                          })),
                        );
                      } catch {
                        setWorkHours([]);
                      }
                    } else {
                      setTerms([]);
                      try {
                        const hrs = await getStaffWorkHours(s.id);
                        setWorkHours(
                          hrs.map((h) => ({
                            weekday: h.weekday,
                            start_time: h.start_time,
                            end_time: h.end_time,
                            valid_from: h.valid_from ?? undefined,
                            valid_to: h.valid_to ?? undefined,
                          })),
                        );
                      } catch {
                        setWorkHours([]);
                      }
                    }
                  }}
              className="card-soft group p-5 text-left transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lift"
            >
              <div className="flex items-start gap-4">
                {s.photo_url ? (
                  <img
                    src={s.photo_url}
                    alt={s.full_name}
                    loading="lazy"
                    className="h-16 w-16 shrink-0 rounded-2xl object-cover"
                  />
                ) : (
                  <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-primary/10 font-display text-lg text-primary">
                    {initials(s.full_name)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                    <h3 className="truncate font-display text-lg font-bold text-primary">
                      {s.full_name}
                    </h3>
                    <span
                      className={[
                        "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium",
                        s.active
                          ? "bg-mint/25 text-mint-foreground"
                          : "bg-muted text-muted-foreground",
                      ].join(" ")}
                    >
                      {s.active ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {staffRolesLine(s.skills, s.role_title)}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-accent">
                        <Star className="h-3.5 w-3.5" /> {s.specialty || "—"}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 text-xs">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-primary" />
                  <div className="min-w-0">
                    <p className="text-muted-foreground">
                      {s.fixed_pay_basis === "mensual" ? "Sueldo mensual" : "Valor turno"}
                    </p>
                        <p className="truncate font-semibold">{cop(s.shift_rate)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Percent className="h-4 w-4 text-accent" />
                  <div className="min-w-0">
                    <p className="capitalize text-muted-foreground">{s.payment_mode}</p>
                        <p className="truncate font-semibold">
                          {s.payment_mode === "fijo"
                            ? "Sin comisión"
                            : `${s.commission_pct}%`}
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-3 rounded-2xl bg-secondary/60 px-4 py-3 text-xs">
                    <p className="text-muted-foreground">Comisión (ventas históricas)</p>
                <p className="font-display text-lg font-bold text-accent">{cop(commission)}</p>
              </div>
            </button>
          );
        })}
      </div>
          {!(staff.data ?? []).length ? <Empty message="Sin personal. Creá el primero." /> : null}
        </>
      ) : null}

      {tab === "pagos" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard title="Liquidar colaborador">
            <p className="mb-3 text-sm text-muted-foreground">
              Elegí a quién pagar y el rango de fechas. El desglose lista citas y extras; la
              comisión se calcula solo sobre el servicio.
            </p>
            <div className="space-y-2">
              <Label>Colaborador</Label>
              <select
                className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                value={payStaffId}
                onChange={(e) => {
                  const id = e.target.value;
                  setPayStaffId(id);
                  setPreview(null);
                  const s = (staff.data ?? []).find((x) => x.id === id);
                  const hired = s?.hired_at ? String(s.hired_at).slice(0, 10) : "";
                  setPayFrom(hired || `${new Date().getFullYear()}-01-01`);
                  setPayTo(todayIso());
                }}
              >
                <option value="">Elegí…</option>
                {(staff.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Desde</Label>
                <Input
                  type="date"
                  className="h-11 rounded-xl"
                  value={payFrom}
                  onChange={(e) => {
                    setPayFrom(e.target.value);
                    setPreview(null);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Hasta</Label>
                <Input
                  type="date"
                  className="h-11 rounded-xl"
                  value={payTo}
                  onChange={(e) => {
                    setPayTo(e.target.value);
                    setPreview(null);
                  }}
                />
              </div>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Por defecto, desde la fecha de ingreso (o 1° de enero si no hay) hasta hoy.
            </p>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div className="space-y-2">
                <Label>Atajo de fechas</Label>
                <select
                  className="flex h-11 rounded-xl border border-input bg-background px-3 text-sm"
                  value={freqValue}
                  onChange={(e) => setFrequency(e.target.value)}
                >
                  <option value="diario">Hoy</option>
                  <option value="semanal">Esta semana</option>
                  <option value="quincenal">Esta quincena</option>
                  <option value="mensual">Este mes</option>
                </select>
              </div>
              <Button
                variant="outline"
                className="rounded-xl"
                disabled={!payStaffId}
                onClick={() => {
                  const now = new Date();
                  let from = todayIso();
                  let to = todayIso();
                  if (frequency === "semanal") {
                    const d = new Date(now);
                    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
                    from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                    const e = new Date(d);
                    e.setDate(e.getDate() + 6);
                    to = `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, "0")}-${String(e.getDate()).padStart(2, "0")}`;
                  } else if (frequency === "quincenal") {
                    const y = now.getFullYear();
                    const m = String(now.getMonth() + 1).padStart(2, "0");
                    if (now.getDate() <= 15) {
                      from = `${y}-${m}-01`;
                      to = `${y}-${m}-15`;
                    } else {
                      from = `${y}-${m}-16`;
                      const last = new Date(y, now.getMonth() + 1, 0).getDate();
                      to = `${y}-${m}-${last}`;
                    }
                  } else if (frequency === "mensual") {
                    const y = now.getFullYear();
                    const m = String(now.getMonth() + 1).padStart(2, "0");
                    const last = new Date(y, now.getMonth() + 1, 0).getDate();
                    from = `${y}-${m}-01`;
                    to = `${y}-${m}-${last}`;
                  }
                  setPayFrom(from);
                  setPayTo(to);
                  setPreview(null);
                }}
              >
                Aplicar atajo
              </Button>
              <Button className="rounded-xl" variant="outline" onClick={() => freqMut.mutate()}>
                Guardar atajo default
              </Button>
            </div>
            <Button
              className="mt-4 rounded-xl"
              disabled={!payStaffId || !payFrom || !payTo || previewMut.isPending}
              onClick={() => previewMut.mutate()}
            >
              Ver desglose
            </Button>
            {preview ? (
              <div className="mt-5 space-y-3 rounded-2xl border border-border p-4">
                <p className="text-sm font-medium">
                  {preview.staff_name} · {preview.period_start} → {preview.period_end}
                </p>
                {preview.already_paid ? (
                  <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                    Ya pagado ({preview.already_paid.status}): {preview.already_paid.period_start} →{" "}
                    {preview.already_paid.period_end} · {cop(preview.already_paid.total)}
                  </p>
                ) : null}
                {(preview.items ?? []).length ? (
                  <ul className="space-y-2 text-xs">
                    {preview.items!.map((it) => (
                      <li key={`${it.kind}-${it.id}`} className="rounded-xl bg-secondary/50 p-3">
                        <p className="font-medium">
                          {it.date} · {it.label}
                          {it.status && it.status !== "finalizada" && it.kind === "cita" ? (
                            <span className="ml-1 text-muted-foreground">({it.status})</span>
                          ) : null}
                        </p>
                        <p className="text-muted-foreground">
                          Servicio {cop(it.service_amount)}
                          {it.extras_amount > 0 ? ` · extras ${cop(it.extras_amount)}` : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No hay citas ni ventas en ese rango.</p>
                )}
                <ul className="space-y-2 text-xs">
                  {preview.segments.map((seg, i) => (
                    <li key={`${seg.from}-${i}`} className="rounded-xl bg-secondary/50 p-3">
                      <p className="font-medium capitalize">
                        {seg.from} → {seg.to} · {seg.payment_mode ?? "sin término"}
                      </p>
                      <p className="text-muted-foreground">
                        Turnos {seg.worked_days} ·{" "}
                        {seg.fixed_pay_basis === "mensual" ? "sueldo" : "fijo"} {cop(seg.shift_pay)}{" "}
                        · comisión {cop(seg.commission)} (base servicio {cop(seg.sales_base)}) ·
                        subtotal {cop(seg.subtotal)}
                      </p>
                    </li>
                  ))}
                </ul>
                <p className="font-display text-xl font-bold text-accent">
                  Total {cop(preview.total)}
                </p>
                <Button
                  className="rounded-xl"
                  disabled={closeMut.isPending || !!preview.already_paid}
                  onClick={() => closeMut.mutate()}
                >
                  {preview.already_paid ? "Ya pagado" : "Cerrar y pagar"}
                </Button>
              </div>
            ) : null}
          </SectionCard>

          <SectionCard title="Liquidaciones recientes">
            <ul className="space-y-2">
              {(runs.data ?? []).map((r) => (
                <li
                  key={r.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-2xl border border-border p-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{r.staff_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.period_start} → {r.period_end} · {r.frequency} · {r.status}
                    </p>
                  </div>
                  <p className="font-semibold text-accent">{cop(r.total)}</p>
                </li>
              ))}
              {!runs.data?.length ? <Empty message="Aún no hay cierres." /> : null}
            </ul>
          </SectionCard>
        </div>
      ) : null}

      {tab === "solicitudes" ? (
        <SectionCard title="Pendientes de autorización">
          <p className="mb-4 text-sm text-muted-foreground">
            Si un colaborador intenta liberar un día con citas, llega acá. Al aprobar se desasigna
            el personal de esas citas.
          </p>
          <ul className="space-y-3">
            {(requests.data ?? []).map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border p-4"
              >
                <div>
                  <p className="font-medium">{r.staff_name || "Un integrante del staff"}</p>
                  <p className="mt-1 text-sm leading-relaxed text-foreground">
                    El usuario{" "}
                    <span className="font-semibold text-primary">{r.staff_name || "del staff"}</span>{" "}
                    está solicitando liberarse de la agenda el día{" "}
                    <span className="font-semibold text-primary">
                      {(() => {
                        const [y, m, d] = String(r.day_date).slice(0, 10).split("-").map(Number);
                        if (!y || !m || !d) return String(r.day_date);
                        return new Date(y, m - 1, d).toLocaleDateString("es-CO", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        });
                      })()}
                    </span>
                    .
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.appointments_count}{" "}
                    {r.appointments_count === 1 ? "cita quedaría sin encargado" : "citas quedarían sin encargado"}
                    {r.reason ? ` · ${r.reason}` : ""}.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="rounded-xl"
                    onClick={() => reviewMut.mutate({ id: r.id, status: "approved" })}
                  >
                    Aprobar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => reviewMut.mutate({ id: r.id, status: "rejected" })}
                  >
                    Rechazar
                  </Button>
                </div>
              </li>
            ))}
            {!requests.data?.length ? <Empty message="Sin solicitudes pendientes." /> : null}
          </ul>
        </SectionCard>
      ) : null}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-3xl p-6">
          <h2 className="font-display text-xl font-bold text-primary">
            {editing ? "Editar Staff" : "Nuevo Staff"}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Es la misma persona que en Usuarios → Cuentas de acceso (rol Staff). El correo es el login.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(
              [
                ["full_name", "Nombre"],
                ["email", "Email"],
                ["phone", "Teléfono"],
                ["address", "Dirección"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-1.5">
                    <Label>{label}{key === "email" && !editing ? " *" : ""}</Label>
                <Input
                  className="h-11 rounded-xl"
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label>Fecha nacimiento</Label>
              <Input
                type="date"
                className="h-11 rounded-xl"
                value={form.birth_date}
                onChange={(e) => setForm((f) => ({ ...f, birth_date: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Fecha de ingreso</Label>
              <Input
                type="date"
                className="h-11 rounded-xl"
                value={form.hired_at}
                onChange={(e) => setForm((f) => ({ ...f, hired_at: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Cargo</Label>
              <p className="text-[11px] text-muted-foreground">
                Groomer y auxiliar se asignan a citas. Recepcionista, conductor y oficios varios
                no: se pagan fijo, sin comisión por servicio.
              </p>
              <select
                className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                value={form.role_title}
                onChange={(e) => {
                  const role_title = e.target.value;
                  const admin = isAdminStaffJob(role_title);
                  setForm((f) => ({
                    ...f,
                    role_title,
                    skills: [role_title],
                    payment_mode: admin ? "fijo" : f.payment_mode,
                    commission_pct: admin ? "0" : f.commission_pct,
                  }));
                }}
              >
                {(catalog.data?.jobs ?? STAFF_ROLE_OPTS.map(([id, label]) => ({ id, label }))).map(
                  (j) => (
                    <option key={j.id} value={j.id}>
                      {j.label}
                    </option>
                  ),
                )}
              </select>
            </div>
            {activeLocations.length > 1 ? (
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Sedes donde trabaja</Label>
                <div className="flex flex-wrap gap-2">
                  {activeLocations.map((loc) => {
                    const on = form.location_ids.includes(loc.id);
                    return (
                      <button
                        key={loc.id}
                        type="button"
                        className={`rounded-full px-3 py-1 text-sm ${
                          on ? "bg-primary text-primary-foreground" : "bg-secondary"
                        }`}
                        onClick={() =>
                          setForm((f) => {
                            const next = on
                              ? f.location_ids.filter((id) => id !== loc.id)
                              : [...f.location_ids, loc.id];
                            return { ...f, location_ids: next.length ? next : [loc.id] };
                          })
                        }
                      >
                        {loc.name}
                        {loc.is_primary ? " · principal" : ""}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Cómo se calcula el fijo</Label>
              <select
                className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                value={form.fixed_pay_basis}
                onChange={(e) => setForm((f) => ({ ...f, fixed_pay_basis: e.target.value }))}
              >
                <option value="por_turno">Por turno (× días con actividad)</option>
                <option value="mensual">Sueldo mensual (no × días)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>
                {form.fixed_pay_basis === "mensual"
                  ? "Sueldo mensual"
                  : adminJob
                    ? "Pago fijo"
                    : "Valor turno"}
              </Label>
              <Input
                className="h-11 rounded-xl"
                value={form.shift_rate}
                onChange={(e) => setForm((f) => ({ ...f, shift_rate: e.target.value }))}
              />
              <p className="text-[11px] text-muted-foreground">
                {form.fixed_pay_basis === "mensual"
                  ? "Se prorratea si liquidás un periodo más corto que el mes. Se paga aunque no haya citas."
                  : adminJob
                    ? "Monto por día con actividad. La frecuencia de abajo dice cada cuánto se liquida."
                    : "Base de turno si el pago es fijo o mixto."}
              </p>
            </div>
            {adminJob ? (
              <div className="space-y-1.5">
                <Label>Modo de pago</Label>
                <p className="flex h-11 items-center rounded-xl border border-input bg-muted/40 px-3 text-sm">
                  Fijo — sin comisión por cita
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label>% comisión</Label>
                  <Input
                    className="h-11 rounded-xl"
                    value={form.commission_pct}
                    onChange={(e) => setForm((f) => ({ ...f, commission_pct: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Modo de pago</Label>
                  <select
                    className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                    value={form.payment_mode}
                    onChange={(e) => setForm((f) => ({ ...f, payment_mode: e.target.value }))}
                  >
                    <option value="fijo">Fijo</option>
                    <option value="porcentaje">Comisión %</option>
                    <option value="mixto">Mixto</option>
                  </select>
                  <p className="text-[11px] text-muted-foreground">
                    Fijo → valor turno (nómina). Comisión % → % sobre el servicio en el margen de
                    la cita. Mixto → ambos.
                  </p>
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label>Frecuencia</Label>
              <select
                className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                value={form.pay_frequency}
                onChange={(e) => setForm((f) => ({ ...f, pay_frequency: e.target.value }))}
              >
                <option value="diario">Diario</option>
                <option value="semanal">Semanal</option>
                <option value="quincenal">Quincenal</option>
                <option value="mensual">Mensual</option>
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Foto</Label>
              <div className="flex items-center gap-3">
                {form.photo_url ? (
                  <img src={form.photo_url} alt="" className="h-14 w-14 rounded-xl object-cover" />
                ) : null}
                <Input
                  type="file"
                  accept="image/*"
                  className="h-11 rounded-xl"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const up = await uploadPhoto(file);
                      setForm((f) => ({ ...f, photo_url: up.url }));
                      toast.success("Foto cargada");
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "No se pudo subir");
                    }
                  }}
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground sm:col-span-2">
              El horario de trabajo arranca igual al del spa (Configuración). Después se edita en la
              ficha, abajo.
            </p>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              />
              Activo en el spa (desmarcá si ya no labura)
            </label>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Al cambiar modo/%/turno, las nuevas condiciones entran el <strong>próximo lunes</strong>{" "}
            (si hoy es lunes, pueden entrar hoy) y duran mínimo <strong>2 semanas</strong>. El histórico
            queda en la ficha (solo admin).
          </p>
          <div className="mt-4 flex gap-2">
            <Button
              className="rounded-xl"
              disabled={saveMut.isPending || !form.full_name.trim() || (!editing && !form.email.trim())}
              onClick={() => saveMut.mutate()}
            >
              Guardar
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto rounded-3xl p-6">
          {selected ? (
            <div>
              <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
                <div>
                  <h2 className="font-display text-2xl font-bold text-primary">
                    {selected.full_name}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {staffRolesLine(selected.skills, selected.role_title)} · {selected.specialty || "—"}
                  </p>
                  {selected.id === user?.id && (selected.skills?.length ?? 0) > 0 ? (
                    <div className="mt-3">
                      <p className="text-xs text-muted-foreground">Mostrarme como</p>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        {(selected.skills ?? []).map((id) => (
                          <button
                            key={id}
                            type="button"
                            className={`rounded-full border px-3 py-1 text-xs ${
                              selected.role_title === id
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border text-muted-foreground"
                            }`}
                            disabled={displayMut.isPending}
                            onClick={() => displayMut.mutate(id)}
                          >
                            {staffRoleLabel(id)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
                {isAdmin ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => openEdit(selected)}
                  >
                    <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl text-destructive"
                    onClick={() => {
                      setPendingDelete({ name: selected.full_name, id: selected.id });
                    }}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Eliminar
                  </Button>
                </div>
                ) : null}
              </div>

              <h3 className="mt-6 font-display text-lg font-bold text-primary">
                Horarios libres
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Horario base (siempre) o un bloque temporal: “esta semana / hasta el día X”.
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  className={`rounded-full px-3 py-1 ${
                    hoursMode === "base" ? "bg-primary text-primary-foreground" : "bg-secondary"
                  }`}
                  onClick={() => {
                    setHoursMode("base");
                    setHoursFrom("");
                    setHoursTo("");
                  }}
                >
                  Horario base
                </button>
                <button
                  type="button"
                  className={`rounded-full px-3 py-1 ${
                    hoursMode === "ranged" ? "bg-primary text-primary-foreground" : "bg-secondary"
                  }`}
                  onClick={() => setHoursMode("ranged")}
                >
                  Temporal (desde / hasta)
                </button>
              </div>
              {hoursMode === "ranged" ? (
                <div className="mt-2 space-y-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Desde</Label>
                      <Input
                        type="date"
                        className="h-9 rounded-xl"
                        value={hoursFrom}
                        onChange={(e) => setHoursFrom(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Hasta (opcional)</Label>
                      <Input
                        type="date"
                        className="h-9 rounded-xl"
                        value={hoursTo}
                        onChange={(e) => setHoursTo(e.target.value)}
                      />
                      </div>
                  </div>
                  {isAdmin ? (
                    <div className="flex flex-wrap gap-1.5">
                      {Array.from(
                        new Map(
                          workHours
                            .filter((h) => h.valid_from)
                            .map((h) => [
                              `${h.valid_from}|${h.valid_to ?? ""}`,
                              { from: h.valid_from!, to: h.valid_to ?? "" },
                            ]),
                        ).values(),
                      ).map((p) => (
                        <button
                          key={`${p.from}|${p.to}`}
                          type="button"
                          className={`rounded-full px-2.5 py-0.5 text-[11px] ${
                            hoursFrom === p.from && hoursTo === p.to
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary text-muted-foreground"
                          }`}
                          onClick={() => {
                            setHoursFrom(p.from);
                            setHoursTo(p.to);
                          }}
                        >
                          {p.from} → {p.to || "∞"}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <ul className="mt-2 space-y-2">
                {workHours
                  .filter((h) => {
                    if (hoursMode === "base") return !h.valid_from && !h.valid_to;
                    if (hoursFrom) {
                      return (
                        h.valid_from === hoursFrom && (h.valid_to ?? "") === (hoursTo || "")
                      );
                    }
                    return !!(h.valid_from || h.valid_to);
                  })
                  .map((h, idx) => (
                  <li key={`${h.weekday}-${idx}-${h.valid_from ?? "b"}`} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="w-10 font-medium">{WEEKDAYS[h.weekday] ?? h.weekday}</span>
                    <Input
                      type="time"
                      className="h-9 w-28 rounded-xl"
                      value={h.start_time}
                      onChange={(e) =>
                        setWorkHours((rows) =>
                          rows.map((r) =>
                            r === h ? { ...r, start_time: e.target.value } : r,
                          ),
                        )
                      }
                    />
                    <span>—</span>
                    <Input
                      type="time"
                      className="h-9 w-28 rounded-xl"
                      value={h.end_time}
                      onChange={(e) =>
                        setWorkHours((rows) =>
                          rows.map((r) => (r === h ? { ...r, end_time: e.target.value } : r)),
                        )
                      }
                    />
                    {h.valid_from || h.valid_to ? (
                      <span className="text-[11px] text-muted-foreground">
                        {h.valid_from ?? "…"} → {h.valid_to ?? "∞"}
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">base</span>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setWorkHours((rows) => rows.filter((r) => r !== h))}
                    >
                      Quitar
                    </Button>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex flex-wrap gap-2">
                <select
                  id="add-weekday"
                  className="h-9 rounded-xl border border-input bg-background px-2 text-sm"
                  defaultValue="0"
                >
                  {WEEKDAYS.map((d, i) => (
                    <option key={d} value={i}>
                      {d}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => {
                    const sel = document.getElementById("add-weekday") as HTMLSelectElement | null;
                    const wd = Number(sel?.value ?? 0);
                    setWorkHours((rows) => [
                      ...rows,
                      {
                        weekday: wd,
                        start_time: "09:00",
                        end_time: "18:00",
                        valid_from: hoursMode === "ranged" ? hoursFrom || undefined : undefined,
                        valid_to: hoursMode === "ranged" ? hoursTo || undefined : undefined,
                      },
                    ]);
                  }}
                >
                  Agregar franja
                </Button>
                <Button
                  size="sm"
                  className="rounded-xl"
                  onClick={async () => {
                    if (!selected) return;
                    if (hoursMode === "ranged" && !hoursFrom) {
                      toast.error("Indicá la fecha desde para el horario temporal");
                      return;
                    }
                    const payload =
                      hoursMode === "base"
                        ? workHours
                            .filter((h) => !h.valid_from && !h.valid_to)
                            .map((h) => ({
                              weekday: h.weekday,
                              start_time: h.start_time,
                              end_time: h.end_time,
                              valid_from: null,
                              valid_to: null,
                            }))
                        : workHours
                            .filter((h) => h.valid_from || hoursFrom)
                            .map((h) => ({
                              weekday: h.weekday,
                              start_time: h.start_time,
                              end_time: h.end_time,
                              valid_from: hoursFrom || h.valid_from || null,
                              valid_to: hoursTo || h.valid_to || null,
                            }));
                    try {
                      await saveStaffWorkHours(selected.id, payload);
                      toast.success(
                        hoursMode === "base"
                          ? "Horario base guardado"
                          : `Horario temporal ${hoursFrom} → ${hoursTo || "sin fin"}`,
                      );
                      if (isAdmin) {
                        const hrs = await getStaffWorkHoursHistory(selected.id);
                        setWorkHours(
                          hrs.map((h) => ({
                            weekday: h.weekday,
                            start_time: h.start_time,
                            end_time: h.end_time,
                            valid_from: h.valid_from ?? undefined,
                            valid_to: h.valid_to ?? undefined,
                          })),
                        );
                      } else {
                        const hrs = await getStaffWorkHours(selected.id);
                        setWorkHours(
                          hrs.map((h) => ({
                            weekday: h.weekday,
                            start_time: h.start_time,
                            end_time: h.end_time,
                            valid_from: h.valid_from ?? undefined,
                            valid_to: h.valid_to ?? undefined,
                          })),
                        );
                      }
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Error");
                    }
                  }}
                >
                  Guardar horarios
                </Button>
              </div>

              {isAdmin ? (
                <>
                  <h3 className="mt-6 font-display text-lg font-bold text-primary">
                    Condiciones por periodo (histórico admin)
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Los cambios de fijo/comisión entran el <strong>próximo lunes</strong> y duran mínimo{" "}
                    <strong>2 semanas</strong>. No se puede cambiar día a día.
                  </p>
                  <ul className="mt-2 space-y-2 text-sm">
                    {terms.map((t) => (
                      <li key={t.id} className="rounded-xl border border-border px-3 py-2">
                        <span className="capitalize">{t.payment_mode}</span> ·{" "}
                        {t.fixed_pay_basis === "mensual" ? "sueldo" : "turno"} {cop(t.shift_rate)} ·{" "}
                        {t.commission_pct}% · {t.effective_from.slice(0, 10)} →{" "}
                        {t.effective_to ? t.effective_to.slice(0, 10) : "vigente"}
                      </li>
                    ))}
                    {!terms.length ? <Empty message="Sin términos históricos." /> : null}
                  </ul>
                </>
              ) : null}

              <h3 className="mt-6 font-display text-lg font-bold text-primary">
                Calendario de turnos
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {[...shiftsOf(selected.id)].sort().map((d) => (
                  <button
                    key={d}
                    type="button"
                    title="Liberar día (si hay citas pide aprobación)"
                    className="rounded-xl bg-blush px-3 py-1.5 text-xs font-medium text-blush-foreground hover:opacity-80"
                    onClick={() => releaseDayMut.mutate({ staffId: selected.id, day: d })}
                  >
                    {shortDate(new Date(`${d}T12:00:00`).toISOString())} ×
                  </button>
                ))}
                {!shiftsOf(selected.id).size ? <Empty message="Sin turnos asignados." /> : null}
              </div>

              <h3 className="mt-6 font-display text-lg font-bold text-primary">
                Servicios realizados
              </h3>
              <ul className="mt-3 space-y-2">
                {servicesOf(selected.id).map((a) => (
                  <li
                    key={a.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-2xl border border-border p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {a.pets?.name} · {a.services?.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {shortDate(a.starts_at)} {time(a.starts_at)}
                      </p>
                    </div>
                    <p className="text-sm font-semibold">{cop(a.price)}</p>
                  </li>
                ))}
                {!servicesOf(selected.id).length ? (
                  <Empty message="Sin servicios finalizados." />
                ) : null}
              </ul>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!pendingDelete}
        title={
          <>
            ¿Eliminar a <span className="text-accent">{pendingDelete?.name}</span>?
          </>
        }
        description="Dejará de poder ingresar. El histórico de citas/nómina se conserva con un nombre anonimizado (no queda como Usuario loginable)."
        onConfirm={() => {
          if (pendingDelete) deleteMut.mutate(pendingDelete.id);
        }}
        onOpenChange={(o) => {
          if (!o) setPendingDelete(null);
        }}
      />
    </AppShell>
  );
}
