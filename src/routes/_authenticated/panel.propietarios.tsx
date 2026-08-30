import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Phone, Mail, MapPin, MessageCircle, Pencil, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Empty, StatusPill } from "@/components/ui-kit";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  ownersQuery,
  petsQuery,
  appointmentsQuery,
  salesQuery,
  createOwner,
  updateOwner,
  setOwnerPets,
  deleteOwner,
  type Owner,
  type AppUser,
} from "@/lib/spa-queries";
import { cop, initials, shortDate, statusMeta, time } from "@/lib/format";
import { requirePathAccess } from "@/lib/route-access";
import { displayRole, isActiveSale, normalizeRole, permissionsFor } from "@/lib/roles";
import { ApiError } from "@/lib/api";
import { ownerToFormFields } from "@/lib/entity-forms";
import { ConfigUsersPanel } from "@/components/config-users-panel";
import { ConfigAuditPanel } from "@/components/config-audit-panel";
import { UserSelfProfile } from "@/components/user-self-profile";

export const Route = createFileRoute("/_authenticated/panel/propietarios")({
  beforeLoad: requirePathAccess("/panel/propietarios"),
  head: () => ({
    meta: [
      { title: "Usuarios | Spa Kira" },
      {
        name: "description",
        content:
          "Cuentas de acceso, ficha de cada persona y (admin) auditoría.",
      },
      { property: "og:title", content: "Usuarios | Spa Kira" },
      { property: "og:description", content: "Directorio de usuarios del spa canino y felino." },
    ],
  }),
  component: Propietarios,
});

type OwnerForm = {
  full_name: string;
  document_type: string;
  document_id: string;
  legal_name: string;
  dv: string;
  tax_regime: string;
  fiscal_responsibilities: string;
  city: string;
  department: string;
  invoice_email: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  photo_url: string;
};

const emptyForm = (): OwnerForm => ({
  full_name: "",
  document_type: "CC",
  document_id: "",
  legal_name: "",
  dv: "",
  tax_regime: "",
  fiscal_responsibilities: "",
  city: "",
  department: "",
  invoice_email: "",
  phone: "",
  whatsapp: "",
  email: "",
  address: "",
  photo_url: "",
});

function ownerToForm(o: Owner): OwnerForm {
  return ownerToFormFields(o);
}

function Propietarios() {
  const { user } = useRouteContext({ from: "/_authenticated" });
  const perms = permissionsFor(user?.role);
  const owners = useQuery(ownersQuery);
  const pets = useQuery(petsQuery);
  const appts = useQuery(appointmentsQuery);
  const sales = useQuery({ ...salesQuery, enabled: perms.isAdmin });
  const qc = useQueryClient();
  const maskPii = perms.maskOwnerPii;
  const [selected, setSelected] = useState<Owner | null>(null);
  const [editing, setEditing] = useState<Owner | null | "new">(null);
  const [form, setForm] = useState<OwnerForm>(emptyForm());
  const [linkedPetIds, setLinkedPetIds] = useState<string[]>([]);
  const [orphanConfirm, setOrphanConfirm] = useState<{
    ownerId: string;
    ownerName: string;
    pets: { id: string; name: string }[];
    message?: string;
  } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ name: string; id: string } | null>(null);
  const isAdmin = perms.isAdmin;
  const [pageTab, setPageTab] = useState<"cuentas" | "auditoria">("cuentas");

  // Mantener el detalle alineado con la lista tras PATCH/refetch
  useEffect(() => {
    if (!selected?.id || !owners.data) return;
    const fresh = owners.data.find((o) => o?.id === selected.id);
    if (fresh) setSelected(fresh);
    else setSelected(null);
  }, [owners.data, selected?.id]);

  const allOwners = useMemo(
    () =>
      [...(owners.data ?? [])]
        .filter((o): o is Owner => !!o?.id)
        .sort((a, b) => {
          const sys = Number(Boolean(b.system_key)) - Number(Boolean(a.system_key));
          if (sys) return sys;
          return (
            (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
            (a.full_name ?? "").localeCompare(b.full_name ?? "")
          );
        }),
    [owners.data],
  );

  const petsOf = (id: string) =>
    (pets.data ?? []).filter((p) => {
      if (!p?.id) return false;
      const links = (Array.isArray(p.owners_list) ? p.owners_list : []).filter(
        (o): o is NonNullable<typeof o> => !!o?.id,
      );
      return (
        p.owner_id === id ||
        links.some((o) => o.id === id) ||
        p.owners?.id === id
      );
    });
  const visitsOf = (id: string) =>
    (appts.data ?? [])
      .filter((a) => a?.id && a.pets?.owner_id === id)
      .sort((a, b) => +new Date(b.starts_at) - +new Date(a.starts_at));
  const paymentsOf = (id: string) =>
    (sales.data ?? []).filter((s) => s?.id && s.owner_id === id && isActiveSale(s.status));

  const editingOwner = editing && editing !== "new" ? editing : null;

  const openAccount = (u: AppUser) => {
    const email = (u.email || "").toLowerCase();
    const match = allOwners.find(
      (o) => o.id === u.id || (o.email || "").toLowerCase() === email,
    );
    if (match) {
      setSelected(match);
      return;
    }
    setForm({ ...emptyForm(), full_name: u.full_name || "", email: u.email });
    setLinkedPetIds([]);
    setEditing("new");
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!form.full_name.trim()) throw new Error("Nombre requerido");
      const payload = {
        full_name: form.full_name.trim(),
        document_type: form.document_type,
        document_id: form.document_id || null,
        legal_name: form.legal_name || null,
        dv: form.dv || null,
        tax_regime: form.tax_regime || null,
        fiscal_responsibilities: form.fiscal_responsibilities || null,
        city: form.city || null,
        department: form.department || null,
        invoice_email: form.invoice_email || null,
        phone: form.phone || null,
        whatsapp: form.whatsapp || null,
        email: form.email || null,
        address: form.address || null,
        photo_url: form.photo_url || null,
      };
      if (editing === "new") {
        const created = await createOwner(payload);
        if (linkedPetIds.length) {
          return setOwnerPets(created.id, linkedPetIds);
        }
        return created;
      }
      if (editingOwner) {
        await updateOwner(editingOwner.id, payload);
        return setOwnerPets(editingOwner.id, linkedPetIds);
      }
      throw new Error("Sin formulario");
    },
    onSuccess: async (saved) => {
      toast.success(editing === "new" ? "Usuario creado" : "Usuario actualizado");
      setEditing(null);
      if (saved?.id) setSelected(saved);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["owners"] }),
        qc.invalidateQueries({ queryKey: ["pets"] }),
        qc.invalidateQueries({ queryKey: ["appointments"] }),
      ]);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      try {
        await deleteOwner(id);
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          const detail = err.detail as {
            message?: string;
            orphan_pets?: { id: string; name: string }[];
          };
          const owner = allOwners.find((o) => o.id === id) ?? selected;
          setOrphanConfirm({
            ownerId: id,
            ownerName: owner?.full_name ?? "este humano",
            pets: detail.orphan_pets ?? [],
            message: detail.message,
          });
          throw new Error("ORPHAN_CONFIRM");
        }
        throw err;
      }
    },
    onSuccess: async () => {
      toast.success("Usuario eliminado");
      setSelected(null);
      setOrphanConfirm(null);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["owners"] }),
        qc.invalidateQueries({ queryKey: ["pets"] }),
        qc.invalidateQueries({ queryKey: ["appointments"] }),
      ]);
    },
    onError: (err: Error) => {
      if (err.message === "ORPHAN_CONFIRM" || err.message === "Eliminación cancelada") return;
      toast.error(err.message);
    },
  });

  const confirmOrphanMut = useMutation({
    mutationFn: (ownerId: string) => deleteOwner(ownerId, { confirmOrphan: true }),
    onSuccess: async () => {
      toast.success("Usuario eliminado");
      setSelected(null);
      setOrphanConfirm(null);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["owners"] }),
        qc.invalidateQueries({ queryKey: ["pets"] }),
        qc.invalidateQueries({ queryKey: ["appointments"] }),
      ]);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (perms.isCliente) {
    return (
      <AppShell title="Usuarios" subtitle="Tu información y notificaciones">
        <UserSelfProfile />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Usuarios"
      subtitle={
        pageTab === "auditoria"
          ? "Registro de acciones del panel"
          : isAdmin
            ? "Invitar, roles, activación y claves"
            : "Cuentas de Usuario · clic para ver la ficha"
      }
    >
      {isAdmin ? (
        <div className="mb-6 flex flex-wrap gap-2">
          {(
            [
              { id: "cuentas", label: "Cuentas de acceso" },
              { id: "auditoria", label: "Auditoría" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setPageTab(t.id)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                pageTab === t.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      ) : null}
      {(!isAdmin || pageTab === "cuentas") ? (
        <ConfigUsersPanel
          currentUserId={user?.id}
          canManageRoles={isAdmin}
          clientsOnly={!isAdmin}
          onOpenUser={openAccount}
        />
      ) : null}
      {isAdmin && pageTab === "auditoria" ? <ConfigAuditPanel /> : null}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto rounded-3xl p-6">
          {selected ? (
            <div>
              <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 pr-10">
                {selected.photo_url ? (
                  <img
                    src={selected.photo_url}
                    alt={selected.full_name}
                    className="h-16 w-16 shrink-0 rounded-2xl object-cover"
                  />
                ) : (
                  <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-primary/10 font-display text-xl text-primary">
                    {initials(selected.full_name)}
                  </span>
                )}
                <div className="min-w-0">
                  <h2 className="truncate font-display text-2xl font-bold text-primary">
                    {selected.full_name}
                  </h2>
                  <p className="truncate text-sm text-muted-foreground">
                    {selected.document_type ?? "CC"} {selected.document_id}
                    {selected.role ? ` · ${displayRole(selected.role)}` : ""}
                    {selected.active === false ? " · sin acceso al panel" : ""}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {selected.system_key ? (
                  <p className="text-sm text-muted-foreground">
                    Humano del sistema para venta de mostrador. No se edita ni se elimina.
                  </p>
                ) : (
                  <>
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => {
                    setForm(ownerToForm(selected));
                    setLinkedPetIds(petsOf(selected.id).map((p) => p.id));
                    setEditing(selected);
                  }}
                >
                  <Pencil className="mr-2 h-4 w-4" /> Editar
                </Button>
                {["admin", "colaborador"].includes(normalizeRole(selected.role)) ? null : (
                <Button
                  variant="destructive"
                  className="rounded-xl"
                  title="Eliminar usuario"
                  aria-label={`Eliminar ${selected.full_name}`}
                  onClick={() => {
                    setPendingDelete({ name: selected.full_name, id: selected.id });
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                </Button>
                )}
                  </>
                )}
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  { icon: Phone, v: selected.phone },
                  { icon: MessageCircle, v: selected.whatsapp },
                  { icon: Mail, v: selected.email },
                  { icon: MapPin, v: selected.address },
                ].map((row, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-2xl bg-secondary/60 px-4 py-3 text-sm"
                  >
                    <row.icon className="h-4 w-4 shrink-0 text-primary" />
                    <span className="truncate text-foreground">{row.v || "—"}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-2xl border border-border p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Facturación electrónica (prep DIAN)
                </p>
                <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">Razón social</dt>
                    <dd>{selected.legal_name || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">DV</dt>
                    <dd>{selected.dv || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Régimen</dt>
                    <dd>{selected.tax_regime || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Responsabilidades</dt>
                    <dd>{selected.fiscal_responsibilities || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Ciudad / Dpto</dt>
                    <dd>
                      {[selected.city, selected.department].filter(Boolean).join(", ") || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Email factura</dt>
                    <dd>{selected.invoice_email || "—"}</dd>
                  </div>
                </dl>
              </div>

              <h3 className="mt-6 font-display text-lg font-bold text-primary">Mascotas</h3>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {petsOf(selected.id).map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 rounded-2xl border border-border p-3"
                  >
                    {p.photo_url ? (
                      <img
                        src={p.photo_url}
                        alt={p.name}
                        className="h-12 w-12 rounded-xl object-cover"
                      />
                    ) : (
                      <span className="grid h-12 w-12 place-items-center rounded-xl bg-secondary text-sm">
                        {initials(p.name)}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-medium">{p.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{p.breed}</p>
                    </div>
                  </li>
                ))}
                {!petsOf(selected.id).length ? <Empty message="Sin mascotas vinculadas." /> : null}
              </ul>

              <h3 className="mt-6 font-display text-lg font-bold text-primary">Visitas recientes</h3>
              <ul className="mt-3 space-y-2">
                {visitsOf(selected.id)
                  .slice(0, 5)
                  .map((a) => {
                    const meta = statusMeta(a.status);
                    return (
                      <li
                        key={a.id}
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border p-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{a.services?.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {shortDate(a.starts_at)} {time(a.starts_at)} · {a.pets?.name}
                          </p>
                        </div>
                        <StatusPill label={meta.label} className={meta.className} hint={meta.hint} />
                      </li>
                    );
                  })}
              </ul>

              <h3 className="mt-6 font-display text-lg font-bold text-primary">Pagos</h3>
              <ul className="mt-3 space-y-2">
                {paymentsOf(selected.id).length ? (
                  paymentsOf(selected.id).map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-border p-3 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">{cop(s.total)}</p>
                        <p className="truncate text-xs text-muted-foreground capitalize">
                          {shortDate(s.sold_at)} · {s.payment_method}
                          {s.staff?.full_name ? ` · ${s.staff.full_name}` : ""}
                        </p>
                      </div>
                    </li>
                  ))
                ) : (
                  <Empty message="Sin pagos registrados." />
                )}
              </ul>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-3xl">
          <h2 className="font-display text-xl font-bold text-primary">
            {editing === "new" ? "Nuevo usuario" : "Editar usuario"}
          </h2>
          {maskPii && editing !== "new" ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Como colaborador no podés modificar PII ofuscada; sí campos fiscales no sensibles.
            </p>
          ) : null}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Nombre completo</Label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo documento</Label>
              <select
                className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                value={form.document_type}
                onChange={(e) => setForm((f) => ({ ...f, document_type: e.target.value }))}
              >
                {["CC", "NIT", "CE", "PAS", "TI"].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Documento</Label>
              <Input
                value={form.document_id}
                onChange={(e) => setForm((f) => ({ ...f, document_id: e.target.value }))}
                className="h-11 rounded-xl"
                disabled={maskPii && editing !== "new"}
              />
            </div>
            <div className="space-y-2">
              <Label>Razón social (NIT)</Label>
              <Input
                value={form.legal_name}
                onChange={(e) => setForm((f) => ({ ...f, legal_name: e.target.value }))}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>DV</Label>
              <Input
                value={form.dv}
                onChange={(e) => setForm((f) => ({ ...f, dv: e.target.value }))}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Régimen tributario</Label>
              <Input
                value={form.tax_regime}
                onChange={(e) => setForm((f) => ({ ...f, tax_regime: e.target.value }))}
                className="h-11 rounded-xl"
                placeholder="Ej. Responsable de IVA"
              />
            </div>
            <div className="space-y-2">
              <Label>Responsabilidades fiscales</Label>
              <Input
                value={form.fiscal_responsibilities}
                onChange={(e) =>
                  setForm((f) => ({ ...f, fiscal_responsibilities: e.target.value }))
                }
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Ciudad</Label>
              <Input
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Departamento</Label>
              <Input
                value={form.department}
                onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Email facturación</Label>
              <Input
                value={form.invoice_email}
                onChange={(e) => setForm((f) => ({ ...f, invoice_email: e.target.value }))}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="h-11 rounded-xl"
                disabled={maskPii && editing !== "new"}
              />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp</Label>
              <Input
                value={form.whatsapp}
                onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
                className="h-11 rounded-xl"
                disabled={maskPii && editing !== "new"}
              />
            </div>
            <div className="space-y-2">
              <Label>Correo</Label>
              <Input
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="h-11 rounded-xl"
                disabled={maskPii && editing !== "new"}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Dirección</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                className="h-11 rounded-xl"
                disabled={maskPii && editing !== "new"}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Mascotas asociadas</Label>
              <p className="text-xs text-muted-foreground">
                Marcá o desmarcá para vincular. Una mascota puede tener hasta 2 humanos; no se puede
                dejar una mascota sin humano.
              </p>
              <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto rounded-2xl border border-border p-3">
                {(pets.data ?? []).filter((p) => !!p?.id).map((p) => {
                  const links = (Array.isArray(p.owners_list) ? p.owners_list : []).filter(
                    (o): o is NonNullable<typeof o> => !!o?.id,
                  );
                  const checked = linkedPetIds.includes(p.id);
                  const editingId = editingOwner?.id ?? null;
                  const otherOwners = links
                    .filter((o) => (editingId ? o.id !== editingId : true))
                    .map((o) => o.full_name);
                  const alreadyLinked = editingId
                    ? links.some((o) => o.id === editingId)
                    : false;
                  const full = !checked && links.length >= 2 && !alreadyLinked;
                  return (
                    <li key={p.id}>
                      <label
                        className={`flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 text-sm hover:bg-secondary/50 ${
                          full ? "opacity-50" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-primary"
                          checked={checked}
                          disabled={full}
                          onChange={(e) => {
                            setLinkedPetIds((ids) =>
                              e.target.checked
                                ? [...ids, p.id]
                                : ids.filter((id) => id !== p.id),
                            );
                          }}
                        />
                        <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {p.breed}
                          {otherOwners.length ? ` · ${otherOwners.join(", ")}` : ""}
                          {full ? " · (2 humanos)" : ""}
                        </span>
                      </label>
                    </li>
                  );
                })}
                {!(pets.data ?? []).length ? (
                  <li className="text-sm text-muted-foreground">No hay mascotas cargadas.</li>
                ) : null}
              </ul>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button
              className="rounded-xl"
              disabled={saveMut.isPending}
              onClick={() => saveMut.mutate()}
            >
              Guardar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!pendingDelete}
        title={
          <>
            ¿Eliminar a <span className="text-accent">{pendingDelete?.name}</span>?
          </>
        }
        description="Se quitará esta ficha. Si tenía acceso de Usuario (cliente) también se elimina la cuenta."
        onConfirm={() => {
          if (pendingDelete) deleteMut.mutate(pendingDelete.id);
        }}
        onOpenChange={(o) => {
          if (!o) setPendingDelete(null);
        }}
      />

      <Dialog
        open={!!orphanConfirm}
        onOpenChange={(o) => {
          if (!o) setOrphanConfirm(null);
        }}
      >
        <DialogContent className="max-w-md rounded-3xl p-8">
          {orphanConfirm ? (
            <div className="flex flex-col items-center text-center">
              <div className="mb-5 grid h-28 w-28 place-items-center rounded-full bg-destructive/10 ring-4 ring-destructive/10">
                <Trash2 className="h-12 w-12 text-destructive" />
              </div>
              <h2 className="font-display text-2xl font-bold leading-snug text-primary">
                ¿Eliminar a{" "}
                <span className="text-accent">{orphanConfirm.ownerName}</span>?
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {orphanConfirm.message ??
                  `${orphanConfirm.pets.length} mascota${orphanConfirm.pets.length === 1 ? "" : "s"} quedará${orphanConfirm.pets.length === 1 ? "" : "n"} sin humano responsable.`}
              </p>
              {orphanConfirm.pets.length ? (
                <ul className="mt-4 w-full space-y-2 text-left">
                  {orphanConfirm.pets.map((p) => (
                    <li
                      key={p.id}
                      className="rounded-2xl border border-border bg-secondary/40 px-4 py-2.5 text-sm font-medium text-foreground"
                    >
                      {p.name}
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-7 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
                <Button
                  variant="destructive"
                  className="rounded-xl"
                  disabled={confirmOrphanMut.isPending}
                  onClick={() => confirmOrphanMut.mutate(orphanConfirm.ownerId)}
                >
                  Sí, eliminar
                </Button>
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => setOrphanConfirm(null)}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
