import { useEffect, useMemo, useState, type DragEvent } from "react";
import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Phone, Mail, MapPin, MessageCircle, Plus, Pencil, Trash2, GripVertical } from "lucide-react";
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
  reorderOwners,
  type Owner,
} from "@/lib/spa-queries";
import { cop, initials, shortDate, statusMeta, time } from "@/lib/format";
import { requirePathAccess } from "@/lib/route-access";
import { isActiveSale, permissionsFor } from "@/lib/roles";
import { ApiError } from "@/lib/api";
import { ownerToFormFields } from "@/lib/entity-forms";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/panel/propietarios")({
  beforeLoad: requirePathAccess("/panel/propietarios"),
  head: () => ({
    meta: [
      { title: "Humanos de compañía | Spa Kira" },
      {
        name: "description",
        content:
          "Directorio de humanos de compañía con contacto, mascotas registradas, historial de visitas y pagos.",
      },
      { property: "og:title", content: "Humanos de compañía | Spa Kira" },
      { property: "og:description", content: "Directorio de humanos de compañía del spa canino y felino." },
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
  const [q, setQ] = useState("");
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

  const filtered = useMemo(() => {
    const needle = q.toLowerCase();
    return allOwners.filter((o) =>
      `${o.full_name ?? ""} ${o.document_id ?? ""} ${o.phone ?? ""} ${o.email ?? ""}`
        .toLowerCase()
        .includes(needle),
    );
  }, [allOwners, q]);

  const [list, setList] = useState<Owner[]>([]);
  useEffect(() => {
    setList(filtered);
  }, [filtered]);

  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

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

  const reorderMut = useMutation({
    mutationFn: (ids: string[]) => reorderOwners(ids),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["owners"] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setList(filtered);
    },
  });

  const moveRow = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const from = list.findIndex((o) => o.id === fromId);
    const to = list.findIndex((o) => o.id === toId);
    if (from < 0 || to < 0) return;
    const nextVisible = list.slice();
    const [row] = nextVisible.splice(from, 1);
    if (!row) return;
    nextVisible.splice(to, 0, row);
    setList(nextVisible);

    const visibleIds = new Set(list.map((o) => o.id));
    let vi = 0;
    const fullOrder = allOwners.map((o) => {
      if (!visibleIds.has(o.id)) return o;
      return nextVisible[vi++]!;
    });
    reorderMut.mutate(fullOrder.map((o) => o.id));
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
      toast.success(editing === "new" ? "Humano de compañía creado" : "Humano de compañía actualizado");
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
      toast.success("Humano de compañía eliminado");
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
      toast.success("Humano de compañía eliminado");
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

  return (
    <AppShell
      title="Humanos de compañía"
      subtitle={
        maskPii
          ? `${list.length} clientes · arrastrá filas para ordenar · datos parcialmente ocultos`
          : `Arrastrá las filas para ordenar · ${list.length} clientes`
      }
      actions={
        <Button
          className="rounded-xl"
          onClick={() => {
            setForm(emptyForm());
            setLinkedPetIds([]);
            setEditing("new");
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> Nuevo humano
        </Button>
      }
    >
      {maskPii ? (
        <p className="mb-4 rounded-2xl border border-border bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
          Como colaborador ves solo el final de teléfonos y documentos. Al crear un humano nuevo
          sí podés cargar todos los campos. La edición de PII ofuscada está restringida.
        </p>
      ) : null}
      <div className="card-soft flex items-center gap-3 p-4">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, documento, teléfono o correo…"
          className="h-10 rounded-xl border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
        />
      </div>

      <div className="card-soft mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="w-10 px-2 py-3.5" aria-label="Reordenar" />
                <th className="px-5 py-3.5 font-semibold">Humano de compañía</th>
                <th className="px-5 py-3.5 font-semibold">Tipo / Doc</th>
                <th className="px-5 py-3.5 font-semibold">Teléfono</th>
                <th className="px-5 py-3.5 font-semibold">Correo</th>
                <th className="px-5 py-3.5 font-semibold">Ciudad</th>
                <th className="px-5 py-3.5 font-semibold">Mascotas</th>
                <th className="px-5 py-3.5 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {list.map((o) => {
                const isSystem = Boolean(o.system_key);
                return (
                <tr
                  key={o.id}
                  onClick={() => setSelected(o)}
                  onDragOver={(e) => {
                    if (!dragId || isSystem) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (overId !== o.id) setOverId(o.id);
                  }}
                  onDrop={(e) => {
                    if (!dragId || isSystem) return;
                    e.preventDefault();
                    moveRow(dragId, o.id);
                    setDragId(null);
                    setOverId(null);
                  }}
                  className={cn(
                    "cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-secondary/40",
                    dragId === o.id && "opacity-60",
                    overId === o.id && dragId && dragId !== o.id && "bg-primary/10",
                  )}
                >
                  <td className="px-2 py-3.5">
                    {isSystem ? (
                      <span className="block h-8 w-8" />
                    ) : (
                    <div
                      className="grid h-8 w-8 cursor-grab place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-primary active:cursor-grabbing"
                      aria-label={`Reordenar ${o.full_name}`}
                      title="Arrastrar para reordenar"
                      draggable
                      onClick={(e) => e.stopPropagation()}
                      onDragStart={(e: DragEvent) => {
                        setDragId(o.id);
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", o.id);
                        e.stopPropagation();
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverId(null);
                      }}
                    >
                      <GripVertical className="h-4 w-4" />
                    </div>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex min-w-0 items-center gap-3">
                      {o.photo_url ? (
                        <img
                          src={o.photo_url}
                          alt={o.full_name}
                          className="h-10 w-10 shrink-0 rounded-xl object-cover"
                        />
                      ) : (
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-xs font-semibold text-primary">
                          {initials(o.full_name)}
                        </span>
                      )}
                      <span className="truncate font-medium text-foreground">{o.full_name}</span>
                      {isSystem ? (
                        <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Sistema
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">
                    {o.document_type ?? "CC"} {o.document_id}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      {o.phone}
                      {o.whatsapp ? (
                        <MessageCircle className="h-3.5 w-3.5 text-success" />
                      ) : null}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">{o.email}</td>
                  <td className="max-w-[180px] truncate px-5 py-3.5 text-muted-foreground">
                    {o.city || o.address}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="rounded-full bg-blush px-2.5 py-1 text-xs font-semibold text-blush-foreground">
                      {petsOf(o.id).length}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {isSystem ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="rounded-xl border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      title="Eliminar humano de compañía"
                      aria-label={`Eliminar ${o.full_name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingDelete({ name: o.full_name, id: o.id });
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    )}
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
        {!list.length ? <Empty message="Sin humanos de compañía que coincidan." /> : null}
      </div>

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
                <Button
                  variant="destructive"
                  className="rounded-xl"
                  title="Eliminar humano de compañía"
                  aria-label={`Eliminar ${selected.full_name}`}
                  onClick={() => {
                    setPendingDelete({ name: selected.full_name, id: selected.id });
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                </Button>
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
            {editing === "new" ? "Nuevo humano de compañía" : "Editar humano de compañía"}
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
        description="Se quitará este humano de compañía."
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
