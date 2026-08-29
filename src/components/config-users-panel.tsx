/** Panel Configuración → Usuarios: invitar y cambiar rol con confirmación. */

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Trash2 } from "lucide-react";
import { SectionCard, Empty } from "@/components/ui-kit";
import { KiraLoader } from "@/components/kira-loader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  appUsersQuery,
  inviteAppUser,
  patchAppUser,
  resetAppUserPassword,
  forceActivateAppUser,
  deleteAppUser,
  type AppUser,
} from "@/lib/spa-queries";
import { displayRole, normalizeRole, type AppRole } from "@/lib/roles";

const ROLE_OPTIONS: { value: AppRole; label: string }[] = [
  { value: "cliente", label: "Usuario" },
  { value: "colaborador", label: "Staff" },
  { value: "admin", label: "Admin" },
];

function roleChangeEffects(from: string, to: string): string[] {
  const a = normalizeRole(from);
  const b = normalizeRole(to);
  const lines: string[] = [];
  if (a === b) return lines;

  lines.push(`El menú del panel pasará a perfil «${displayRole(b)}».`);
  lines.push("Los permisos personalizados de módulos se reinician al perfil del rol.");

  if (b === "colaborador") {
    lines.push("Se crea o reactiva la ficha en Personal (Staff).");
    lines.push("Deja de usar el portal «solo mis mascotas»; ve la operación del spa.");
  }
  if (b === "cliente") {
    lines.push("Si tenía ficha Staff, queda inactiva (no se borra el historial).");
    lines.push("Queda con Mis mascotas, Mi agenda y Servicios (lectura).");
  }
  if (b === "admin" || b === "colaborador") {
    lines.push("Admin y Staff requieren cuenta local (no aplica a quien solo entra con Google).");
  }
  if (b === "admin") {
    lines.push("Acceso completo al panel, incluida Configuración y Roles y permisos.");
  }
  if (a === "admin" && b !== "admin") {
    lines.push("Si es el último admin activo, el servidor lo bloqueará.");
  }
  return lines;
}

type RolePending = { user: AppUser; nextRole: AppRole };

export function ConfigUsersPanel({ currentUserId }: { currentUserId?: string }) {
  const qc = useQueryClient();
  const users = useQuery(appUsersQuery);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<AppRole>("colaborador");
  const [q, setQ] = useState("");
  const [rolePending, setRolePending] = useState<RolePending | null>(null);
  const [deletePending, setDeletePending] = useState<AppUser | null>(null);
  const [activateFor, setActivateFor] = useState<AppUser | null>(null);
  const [activatePassword, setActivatePassword] = useState("");
  const [activatePassword2, setActivatePassword2] = useState("");
  const [resetFor, setResetFor] = useState<{ id: string; email: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");

  const filtered = useMemo(() => {
    const list = users.data ?? [];
    const needle = q.trim().toLowerCase();
    const ranked = [...list].sort((a, b) => {
      const ra = normalizeRole(a.role);
      const rb = normalizeRole(b.role);
      const order = { admin: 0, colaborador: 1, cliente: 2 } as const;
      if (order[ra] !== order[rb]) return order[ra] - order[rb];
      return (a.email || "").localeCompare(b.email || "");
    });
    if (!needle) return ranked;
    return ranked.filter(
      (u) =>
        u.email.toLowerCase().includes(needle) ||
        (u.full_name || "").toLowerCase().includes(needle) ||
        displayRole(u.role).toLowerCase().includes(needle),
    );
  }, [users.data, q]);

  const inviteMut = useMutation({
    mutationFn: () =>
      inviteAppUser({
        email: email.trim(),
        full_name: fullName.trim() || "Usuario Spa Kira",
        role,
      }),
    onSuccess: async (res) => {
      toast.success(res.message);
      setEmail("");
      setFullName("");
      setRole("colaborador");
      await qc.invalidateQueries({ queryKey: ["app-users"] });
      await qc.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const roleMut = useMutation({
    mutationFn: ({ id, nextRole }: { id: string; nextRole: string }) =>
      patchAppUser(id, { role: nextRole }),
    onSuccess: async (updated, vars) => {
      const label = displayRole(updated.role ?? vars.nextRole);
      toast.success(`Rol actualizado a «${label}»`);
      setRolePending(null);
      await qc.invalidateQueries({ queryKey: ["app-users"] });
      await qc.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resetMut = useMutation({
    mutationFn: () => {
      if (!resetFor) throw new Error("Sin usuario");
      if (newPassword.length < 8) throw new Error("La clave debe tener al menos 8 caracteres");
      if (newPassword !== newPassword2) throw new Error("Las claves no coinciden");
      return resetAppUserPassword(resetFor.id, newPassword);
    },
    onSuccess: async (res) => {
      toast.success(`Clave restablecida para ${res.email}`);
      setResetFor(null);
      setNewPassword("");
      setNewPassword2("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteAppUser(id),
    onSuccess: async (res) => {
      toast.success(res.message || "Usuario eliminado");
      setDeletePending(null);
      await qc.invalidateQueries({ queryKey: ["app-users"] });
      await qc.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const activateMut = useMutation({
    mutationFn: () => {
      if (!activateFor) throw new Error("Sin usuario");
      if (activatePassword.length < 8) throw new Error("La clave debe tener al menos 8 caracteres");
      if (activatePassword !== activatePassword2) throw new Error("Las claves no coinciden");
      return forceActivateAppUser(activateFor.id, activatePassword);
    },
    onSuccess: async (res) => {
      toast.success(res.message || `Activado: ${res.email}`);
      setActivateFor(null);
      setActivatePassword("");
      setActivatePassword2("");
      await qc.invalidateQueries({ queryKey: ["app-users"] });
      await qc.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const requestRoleChange = (u: AppUser, next: string) => {
    const nextRole = normalizeRole(next);
    if (nextRole === normalizeRole(u.role)) return;
    setRolePending({ user: u, nextRole });
  };

  return (
    <>
      <SectionCard title="Usuarios del panel">
        <p className="mb-4 text-sm text-muted-foreground">
          Acá gestionás quién entra al panel y con qué perfil.{" "}
          <strong>Admin</strong> y <strong>Staff</strong> solo con cuentas locales
          (correo + contraseña / invitación). <strong>Google</strong> solo crea o entra
          como <strong>Usuario</strong> (cliente). Al agregar alguien se envía correo de
          activación.
        </p>

        <div className="rounded-2xl border border-border/80 bg-secondary/30 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Invitar
          </p>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-2 sm:col-span-2">
              <Label>Correo</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 rounded-xl"
                placeholder="nuevo@correo.com"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="h-11 rounded-xl"
                placeholder="Nombre visible"
              />
            </div>
            <div className="space-y-2">
              <Label>Rol inicial</Label>
              <select
                className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                value={role}
                onChange={(e) => setRole(normalizeRole(e.target.value))}
              >
                {ROLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Button
            className="mt-4 rounded-xl"
            disabled={!email.trim() || inviteMut.isPending}
            onClick={() => inviteMut.mutate()}
          >
            {inviteMut.isPending ? "Enviando…" : "Agregar usuario"}
          </Button>
        </div>

        <div className="relative mt-6">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-11 rounded-xl pl-9"
            placeholder="Buscar por nombre, correo o rol…"
          />
        </div>

        {users.isLoading ? <KiraLoader variant="inline" /> : null}
        {users.isError ? (
          <p className="mt-4 text-sm text-destructive">
            {(users.error as Error)?.message || "No se pudieron cargar los usuarios."}
          </p>
        ) : null}

        <ul className="mt-4 divide-y divide-border rounded-2xl border border-border">
          {filtered.map((u) => {
            const isSelf = currentUserId && u.id === currentUserId;
            return (
              <li
                key={u.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {u.full_name || "Sin nombre"}
                    {isSelf ? (
                      <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                        (vos)
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                </div>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <select
                    className="h-9 rounded-xl border border-input bg-background px-2 text-xs"
                    value={normalizeRole(u.role)}
                    disabled={roleMut.isPending}
                    aria-label={`Rol de ${u.email}`}
                    onChange={(e) => requestRoleChange(u, e.target.value)}
                  >
                    {ROLE_OPTIONS.map((o) => {
                      const googleOnly = u.auth_provider === "google";
                      const staffOrAdmin = o.value === "admin" || o.value === "colaborador";
                      return (
                        <option
                          key={o.value}
                          value={o.value}
                          disabled={googleOnly && staffOrAdmin}
                        >
                          {o.label}
                          {googleOnly && staffOrAdmin ? " (solo local)" : ""}
                        </option>
                      );
                    })}
                  </select>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                      u.active
                        ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
                        : "bg-amber-500/15 text-amber-900 dark:text-amber-200"
                    }`}
                  >
                    {u.active ? "Activo" : "Pendiente activación"}
                  </span>
                  {u.auth_provider === "google" || u.auth_provider === "both" ? (
                    <span className="text-xs text-muted-foreground">
                      {u.auth_provider === "both" ? "Google + clave" : "Google"}
                    </span>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-xl text-xs"
                      onClick={() => {
                        setResetFor({ id: u.id, email: u.email });
                        setNewPassword("");
                        setNewPassword2("");
                      }}
                    >
                      Restablecer clave
                    </Button>
                  )}
                  {!u.active && u.auth_provider !== "google" ? (
                    <Button
                      type="button"
                      size="sm"
                      className="h-9 rounded-xl text-xs"
                      onClick={() => {
                        setActivateFor(u);
                        setActivatePassword("");
                        setActivatePassword2("");
                      }}
                    >
                      Activar
                    </Button>
                  ) : null}
                  {!isSelf ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="h-9 rounded-xl text-xs"
                      onClick={() => setDeletePending(u)}
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      Eliminar
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
          {!users.isLoading && !filtered.length ? (
            <li className="p-4">
              <Empty message={q.trim() ? "Ningún usuario coincide con la búsqueda." : "Sin usuarios."} />
            </li>
          ) : null}
        </ul>
      </SectionCard>

      <Dialog
        open={!!rolePending}
        onOpenChange={(open) => {
          if (!open) setRolePending(null);
        }}
      >
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cambiar rol</DialogTitle>
            <DialogDescription>
              {rolePending
                ? `${rolePending.user.full_name || rolePending.user.email}: «${displayRole(rolePending.user.role)}» → «${displayRole(rolePending.nextRole)}»`
                : null}
            </DialogDescription>
          </DialogHeader>
          {rolePending ? (
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
              {roleChangeEffects(rolePending.user.role, rolePending.nextRole).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setRolePending(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="rounded-xl"
              disabled={roleMut.isPending || !rolePending}
              onClick={() => {
                if (!rolePending) return;
                roleMut.mutate({
                  id: rolePending.user.id,
                  nextRole: rolePending.nextRole,
                });
              }}
            >
              {roleMut.isPending ? "Guardando…" : "Confirmar cambio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deletePending}
        onOpenChange={(open) => {
          if (!open) setDeletePending(null);
        }}
      >
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar cuenta</DialogTitle>
            <DialogDescription>
              {deletePending
                ? `${deletePending.full_name || deletePending.email} dejará de poder ingresar.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
            <li>No podrá volver a loguearse.</li>
            <li>
              Nombre y correo se anonimizan (ej. «Ex-colaborador #12») para el histórico de citas y
              ventas.
            </li>
            <li>Los registros operativos se conservan con ese seudónimo.</li>
          </ul>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setDeletePending(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="rounded-xl"
              disabled={deleteMut.isPending || !deletePending}
              onClick={() => {
                if (!deletePending) return;
                deleteMut.mutate(deletePending.id);
              }}
            >
              {deleteMut.isPending ? "Eliminando…" : "Eliminar cuenta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {activateFor ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-lift">
            <h3 className="font-display text-lg font-bold text-primary">Activar cuenta</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {activateFor.email} — definí la clave con la que va a ingresar (sin esperar el correo).
            </p>
            <div className="mt-4 space-y-3">
              <div className="space-y-2">
                <Label>Clave</Label>
                <Input
                  type="password"
                  className="h-11 rounded-xl"
                  value={activatePassword}
                  onChange={(e) => setActivatePassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label>Repetir clave</Label>
                <Input
                  type="password"
                  className="h-11 rounded-xl"
                  value={activatePassword2}
                  onChange={(e) => setActivatePassword2(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => setActivateFor(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="rounded-xl"
                disabled={activateMut.isPending}
                onClick={() => activateMut.mutate()}
              >
                {activateMut.isPending ? "Activando…" : "Activar"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {resetFor ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-lift">
            <h3 className="font-display text-lg font-bold text-primary">Restablecer clave</h3>
            <p className="mt-1 text-sm text-muted-foreground">{resetFor.email}</p>
            <div className="mt-4 space-y-3">
              <div className="space-y-2">
                <Label>Nueva clave</Label>
                <Input
                  type="password"
                  className="h-11 rounded-xl"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label>Repetir clave</Label>
                <Input
                  type="password"
                  className="h-11 rounded-xl"
                  value={newPassword2}
                  onChange={(e) => setNewPassword2(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => setResetFor(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="rounded-xl"
                disabled={resetMut.isPending}
                onClick={() => resetMut.mutate()}
              >
                Guardar clave
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
