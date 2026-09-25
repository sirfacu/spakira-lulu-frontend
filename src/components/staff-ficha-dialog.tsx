import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Mail, MapPin, Pencil, Phone, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Empty } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getStaffWorkHours,
  getStaffWorkHoursHistory,
  listStaffPayTerms,
  saveStaffWorkHours,
  type Appointment,
  type SpaLocation,
  type Staff,
  type StaffPayTerm,
} from "@/lib/spa-queries";
import { staffRoleLabel, staffRolesLine } from "@/lib/staff-roles";
import {
  WEEKDAY_SHORT,
  currentPayTerm,
  defaultHoursLocationId,
  exceptionRanges,
  hoursForLocation,
  pastPayTerms,
  summarizeBaseHours,
  upcomingPayTerms,
  type FichaWorkHour,
} from "@/lib/staff-ficha";
import { calendarDate, cop, initials, shortDate, time } from "@/lib/format";

type FichaTab = "resumen" | "horarios" | "pago" | "historial";

type Props = {
  staff: Staff | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin: boolean;
  currentUserId?: string;
  locations: SpaLocation[];
  services: Appointment[];
  shiftDays: string[];
  onEdit: (staff: Staff) => void;
  onDelete: (staff: Staff) => void;
  onReleaseDay: (staffId: string, day: string) => void;
  onDisplayRole: (role: string) => void;
  displayPending?: boolean;
};

function mapHours(
  rows: {
    weekday: number;
    start_time: string;
    end_time: string;
    valid_from?: string | null;
    valid_to?: string | null;
    location_id?: string | null;
  }[],
): FichaWorkHour[] {
  return rows.map((h) => ({
    weekday: h.weekday,
    start_time: h.start_time,
    end_time: h.end_time,
    valid_from: h.valid_from ?? undefined,
    valid_to: h.valid_to ?? undefined,
    location_id: h.location_id ?? undefined,
  }));
}

export function StaffFichaDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto rounded-3xl p-6">
        {props.staff ? <StaffFichaBody key={props.staff.id} {...props} staff={props.staff} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function StaffFichaBody({
  staff,
  isAdmin,
  currentUserId,
  locations,
  services,
  shiftDays,
  onEdit,
  onDelete,
  onReleaseDay,
  onDisplayRole,
  displayPending,
}: Props & { staff: Staff }) {
  const [tab, setTab] = useState<FichaTab>("resumen");
  const [terms, setTerms] = useState<StaffPayTerm[]>([]);
  const [workHours, setWorkHours] = useState<FichaWorkHour[]>([]);
  const [hoursLocationId, setHoursLocationId] = useState(
    () => defaultHoursLocationId(staff) ?? "",
  );
  const [hoursMode, setHoursMode] = useState<"base" | "ranged">("base");
  const [hoursEditing, setHoursEditing] = useState(false);
  const [hoursFrom, setHoursFrom] = useState("");
  const [hoursTo, setHoursTo] = useState("");
  const [showPayHistory, setShowPayHistory] = useState(false);

  const staffLocationIds = staff.location_ids?.length
    ? staff.location_ids
    : hoursLocationId
      ? [hoursLocationId]
      : [];
  const sedeOptions = staffLocationIds.map((id) => ({
    id,
    name: locations.find((l) => l.id === id)?.name ?? "Sede",
  }));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (isAdmin) {
        try {
          const t = await listStaffPayTerms(staff.id);
          if (!cancelled) setTerms(t);
        } catch {
          if (!cancelled) setTerms([]);
        }
      }
      try {
        const loc = hoursLocationId || undefined;
        const hrs = isAdmin
          ? await getStaffWorkHoursHistory(staff.id, loc)
          : await getStaffWorkHours(staff.id, undefined, loc);
        if (!cancelled) setWorkHours(mapHours(hrs));
      } catch {
        if (!cancelled) setWorkHours([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [staff.id, staff.shift_rate, staff.payment_mode, staff.commission_pct, hoursLocationId, isAdmin]);

  const scopedHours = hoursForLocation(workHours, hoursLocationId || undefined);
  const baseSummary = summarizeBaseHours(scopedHours);
  const exceptions = exceptionRanges(scopedHours);
  const vigente = currentPayTerm(terms);
  const upcoming = upcomingPayTerms(terms);
  const past = pastPayTerms(terms);
  const recentShifts = useMemo(() => [...shiftDays].sort().slice(-8).reverse(), [shiftDays]);
  const recentServices = services.slice(0, 8);

  const tabs: { id: FichaTab; label: string }[] = [
    { id: "resumen", label: "Resumen" },
    { id: "horarios", label: "Horarios" },
    ...(isAdmin ? [{ id: "pago" as const, label: "Pago" }] : []),
    { id: "historial", label: "Historial" },
  ];

  const visibleHours =
    hoursMode === "base"
      ? scopedHours.filter((h) => !h.valid_from && !h.valid_to)
      : hoursFrom
        ? scopedHours.filter(
            (h) => h.valid_from === hoursFrom && (h.valid_to ?? "") === (hoursTo || ""),
          )
        : scopedHours.filter((h) => !!(h.valid_from || h.valid_to));

  async function reloadHours() {
    const loc = hoursLocationId || undefined;
    const hrs = isAdmin
      ? await getStaffWorkHoursHistory(staff.id, loc)
      : await getStaffWorkHours(staff.id, undefined, loc);
    setWorkHours(mapHours(hrs));
  }

  async function saveHours() {
    if (hoursMode === "ranged" && !hoursFrom) {
      toast.error("Indicá la fecha desde para el horario temporal");
      return;
    }
    const payload = visibleHours.map((h) => ({
      weekday: h.weekday,
      start_time: h.start_time,
      end_time: h.end_time,
      valid_from: hoursMode === "base" ? null : hoursFrom || h.valid_from || null,
      valid_to: hoursMode === "base" ? null : hoursTo || h.valid_to || null,
    }));
    try {
      await saveStaffWorkHours(staff.id, payload, hoursLocationId || undefined);
      toast.success(
        hoursMode === "base"
          ? "Horario base guardado"
          : `Cambio temporal ${hoursFrom} → ${hoursTo || "sin fin"}`,
      );
      setHoursEditing(false);
      await reloadHours();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
        <div className="flex min-w-0 items-start gap-3">
          {staff.photo_url ? (
            <img
              src={staff.photo_url}
              alt=""
              className="h-16 w-16 shrink-0 rounded-2xl object-cover"
            />
          ) : (
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-primary/10 font-display text-lg text-primary">
              {initials(staff.full_name)}
            </span>
          )}
          <div className="min-w-0">
            <DialogTitle className="font-display text-2xl font-bold text-primary">
              {staff.full_name}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {staffRolesLine(staff.skills, staff.role_title)}
              {staff.specialty ? ` · ${staff.specialty}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {staff.email ? (
                <span className="inline-flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" /> {staff.email}
                </span>
              ) : null}
              {staff.phone ? (
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" /> {staff.phone}
                </span>
              ) : null}
              {staff.hired_at ? (
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" /> Ingreso {calendarDate(staff.hired_at)}
                </span>
              ) : null}
            </div>
            {sedeOptions.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {sedeOptions.map((s) => (
                  <span
                    key={s.id}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] ${
                      s.id === (staff.home_location_id || sedeOptions[0]?.id)
                        ? "bg-primary/10 text-primary"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    <MapPin className="h-3 w-3" /> {s.name}
                    {s.id === staff.home_location_id ? " · casa" : ""}
                  </span>
                ))}
              </div>
            ) : null}
            {staff.id === currentUserId && (staff.skills?.length ?? 0) > 0 ? (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground">Mostrarme como</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {(staff.skills ?? []).map((id) => (
                    <button
                      key={id}
                      type="button"
                      className={`rounded-full border px-3 py-1 text-xs ${
                        staff.role_title === id
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground"
                      }`}
                      disabled={displayPending}
                      onClick={() => onDisplayRole(id)}
                    >
                      {staffRoleLabel(id)}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
        {isAdmin ? (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => onEdit(staff)}>
              <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl text-destructive"
              onClick={() => onDelete(staff)}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" /> Eliminar
            </Button>
          </div>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              tab === t.id ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "resumen" ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border p-3">
            <p className="text-xs text-muted-foreground">Horario base</p>
            {baseSummary.length ? (
              <ul className="mt-2 space-y-1 text-sm">
                {baseSummary.map((h) => (
                  <li key={`${h.weekday}-${h.start}`}>
                    {h.label} {h.start}–{h.end}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Sin horario cargado.</p>
            )}
            {exceptions.length ? (
              <p className="mt-2 text-[11px] text-muted-foreground">
                {exceptions.length} cambio{exceptions.length === 1 ? "" : "s"} temporal
                {exceptions.length === 1 ? "" : "es"}
              </p>
            ) : null}
          </div>
          {isAdmin ? (
            <div className="rounded-2xl border border-border p-3">
              <p className="text-xs text-muted-foreground">Pago vigente</p>
              {vigente ? (
                <p className="mt-2 text-sm font-medium">
                  <span className="capitalize">{vigente.payment_mode}</span> ·{" "}
                  {vigente.fixed_pay_basis === "mensual" ? "sueldo" : "turno"} {cop(vigente.shift_rate)}
                  {vigente.commission_pct
                    ? ` · ${vigente.commission_pct}%`
                    : vigente.payment_mode === "fijo"
                      ? " · sin comisión"
                      : ""}
                </p>
              ) : (
                <p className="mt-2 text-sm">
                  {staff.fixed_pay_basis === "mensual" ? "Sueldo" : "Turno"} {cop(staff.shift_rate)}
                </p>
              )}
              {upcoming.length ? (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Próximo cambio el {upcoming[0].effective_from.slice(0, 10)}
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-muted-foreground">Sigue igual hasta que lo cambies.</p>
              )}
            </div>
          ) : null}
          <div className="rounded-2xl border border-border p-3 sm:col-span-2">
            <p className="text-xs text-muted-foreground">Contacto</p>
            <p className="mt-2 text-sm">
              {staff.address ? staff.address : "Sin dirección"}
              {staff.birth_date ? ` · Nac. ${calendarDate(staff.birth_date)}` : ""}
            </p>
            {!staff.email && !staff.phone ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Completá mail y teléfono en Editar.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === "horarios" ? (
        <div className="mt-4">
          <p className="text-xs text-muted-foreground">
            El horario es fijo por sede. No hay que recargarlo cada semana: un cambio temporal
            (vacaciones, cobertura) se carga con fechas y, al vencer, vuelve el base.
          </p>
          {sedeOptions.length > 1 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {sedeOptions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`rounded-full px-3 py-1 text-xs ${
                    hoursLocationId === s.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground"
                  }`}
                  onClick={() => {
                    setHoursLocationId(s.id);
                    setHoursEditing(false);
                    setHoursMode("base");
                  }}
                >
                  {s.name}
                </button>
              ))}
            </div>
          ) : sedeOptions.length === 1 ? (
            <p className="mt-2 text-xs text-muted-foreground">Sede: {sedeOptions[0].name}</p>
          ) : null}

          {!hoursEditing ? (
            <>
              <ul className="mt-3 space-y-1.5 text-sm">
                {baseSummary.map((h) => (
                  <li key={`${h.weekday}-${h.start}`} className="flex gap-3">
                    <span className="w-10 font-medium">{h.label}</span>
                    <span>
                      {h.start}–{h.end}
                    </span>
                  </li>
                ))}
              </ul>
              {!baseSummary.length ? <Empty message="Sin horario base en esta sede." /> : null}
              {exceptions.length ? (
                <div className="mt-3">
                  <p className="text-xs font-medium">Cambios temporales</p>
                  <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                    {exceptions.map((p) => (
                      <li key={`${p.from}|${p.to}`}>
                        {p.from} → {p.to || "sin fin"} · {p.count} franja{p.count === 1 ? "" : "s"}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">Sin excepciones: rige el horario de siempre.</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="rounded-xl"
                  onClick={() => {
                    setHoursMode("base");
                    setHoursFrom("");
                    setHoursTo("");
                    setHoursEditing(true);
                  }}
                >
                  Editar horario base
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => {
                    setHoursMode("ranged");
                    setHoursEditing(true);
                  }}
                >
                  Cambio temporal
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
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
                  {isAdmin && exceptions.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {exceptions.map((p) => (
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
                {visibleHours.map((h, idx) => (
                  <li
                    key={`${h.weekday}-${idx}-${h.valid_from ?? "b"}-${h.start_time}`}
                    className="flex flex-wrap items-center gap-2 text-sm"
                  >
                    <span className="w-10 font-medium">{WEEKDAY_SHORT[h.weekday] ?? h.weekday}</span>
                    <Input
                      type="time"
                      className="h-9 w-28 rounded-xl"
                      value={h.start_time}
                      onChange={(e) =>
                        setWorkHours((rows) =>
                          rows.map((r) => (r === h ? { ...r, start_time: e.target.value } : r)),
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
                    <Button size="sm" variant="ghost" onClick={() => setWorkHours((rows) => rows.filter((r) => r !== h))}>
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
                  {WEEKDAY_SHORT.map((d, i) => (
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
                    if (hoursMode === "ranged" && !hoursFrom) {
                      toast.error("Indicá la fecha desde para el horario temporal");
                      return;
                    }
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
                        location_id: hoursLocationId || undefined,
                      },
                    ]);
                  }}
                >
                  Agregar franja
                </Button>
                <Button size="sm" className="rounded-xl" onClick={() => void saveHours()}>
                  Guardar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-xl"
                  onClick={() => {
                    setHoursEditing(false);
                    void reloadHours();
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </>
          )}
        </div>
      ) : null}

      {tab === "pago" && isAdmin ? (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Un cambio de sueldo o comisión entra el <strong>próximo lunes</strong> y dura mínimo{" "}
            <strong>2 semanas</strong>. No se recarga cada quincena: el vigente sigue hasta que lo
            cambies en Editar.
          </p>
          <div className="rounded-2xl border border-border p-3">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Wallet className="h-3.5 w-3.5" /> Vigente
            </p>
            {vigente ? (
              <p className="mt-2 text-sm font-medium">
                <span className="capitalize">{vigente.payment_mode}</span> ·{" "}
                {vigente.fixed_pay_basis === "mensual" ? "sueldo" : "turno"} {cop(vigente.shift_rate)} ·{" "}
                {vigente.commission_pct}% · desde {vigente.effective_from.slice(0, 10)}
                {vigente.effective_to ? ` → ${vigente.effective_to.slice(0, 10)}` : ""}
              </p>
            ) : (
              <p className="mt-2 text-sm">
                {staff.fixed_pay_basis === "mensual" ? "Sueldo" : "Turno"} {cop(staff.shift_rate)} ·{" "}
                <span className="capitalize">{staff.payment_mode}</span>
              </p>
            )}
          </div>
          {upcoming.map((t) => (
            <div key={t.id ?? t.effective_from} className="rounded-2xl border border-dashed border-border p-3">
              <p className="text-xs text-muted-foreground">Programado</p>
              <p className="mt-1 text-sm">
                Desde {t.effective_from.slice(0, 10)} · <span className="capitalize">{t.payment_mode}</span> ·{" "}
                {cop(t.shift_rate)} · {t.commission_pct}%
              </p>
            </div>
          ))}
          {past.length ? (
            <>
              <button
                type="button"
                className="text-xs text-muted-foreground underline"
                onClick={() => setShowPayHistory((v) => !v)}
              >
                {showPayHistory ? "Ocultar histórico" : `Ver histórico (${past.length})`}
              </button>
              {showPayHistory ? (
                <ul className="space-y-2 text-sm">
                  {past.map((t) => (
                    <li key={t.id ?? `${t.effective_from}-${t.shift_rate}`} className="rounded-xl border border-border px-3 py-2">
                      <span className="capitalize">{t.payment_mode}</span> ·{" "}
                      {t.fixed_pay_basis === "mensual" ? "sueldo" : "turno"} {cop(t.shift_rate)} ·{" "}
                      {t.commission_pct}% · {t.effective_from.slice(0, 10)} →{" "}
                      {t.effective_to ? t.effective_to.slice(0, 10) : "—"}
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Sin periodos anteriores distintos.</p>
          )}
        </div>
      ) : null}

      {tab === "historial" ? (
        <div className="mt-4 space-y-4">
          <div>
            <h3 className="font-display text-base font-bold text-primary">Días con cita</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {recentShifts.map((d) => (
                <button
                  key={d}
                  type="button"
                  title="Liberar día (si hay citas pide aprobación)"
                  className="rounded-xl bg-blush px-3 py-1.5 text-xs font-medium text-blush-foreground hover:opacity-80"
                  onClick={() => onReleaseDay(staff.id, d)}
                >
                  {shortDate(new Date(`${d}T12:00:00`).toISOString())} ×
                </button>
              ))}
              {!recentShifts.length ? <Empty message="Sin turnos asignados." /> : null}
            </div>
            {shiftDays.length > recentShifts.length ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Mostrando los {recentShifts.length} más recientes de {shiftDays.length}.
              </p>
            ) : null}
          </div>
          <div>
            <h3 className="font-display text-base font-bold text-primary">Servicios realizados</h3>
            <ul className="mt-2 space-y-2">
              {recentServices.map((a) => (
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
              {!recentServices.length ? <Empty message="Sin servicios finalizados." /> : null}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
