import { useMemo, useState } from "react";
import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Empty } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { requirePathAccess } from "@/lib/route-access";
import { PANEL_MODULES, displayRole, permissionsFor } from "@/lib/roles";
import { clearMeCache } from "@/lib/api";
import {
  appUsersQuery,
  fetchRoleModules,
  saveRoleModules,
  saveUserModules,
  type AppUser,
} from "@/lib/spa-queries";

export const Route = createFileRoute("/_authenticated/panel/permisos")({
  beforeLoad: requirePathAccess("/panel/permisos"),
  head: () => ({
    meta: [{ title: "Roles y permisos | Spa Kira" }],
  }),
  component: PermisosPage,
});

function PermisosPage() {
  const { user } = useRouteContext({ from: "/_authenticated" });
  const isAdmin = permissionsFor(user?.role).isAdmin;
  const qc = useQueryClient();
  const profiles = useQuery({ queryKey: ["role-modules"], queryFn: fetchRoleModules });
  const users = useQuery(appUsersQuery);
  const [tab, setTab] = useState<"perfiles" | "usuarios">("perfiles");
  const [draft, setDraft] = useState<Record<string, string[]>>({});

  const merged = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const p of profiles.data?.profiles ?? []) {
      out[p.role] = draft[p.role] ?? p.modules;
    }
    return out;
  }, [profiles.data, draft]);

  const saveProfile = useMutation({
    mutationFn: ({ role, modules }: { role: string; modules: string[] }) =>
      saveRoleModules(role, modules),
    onSuccess: async (_, vars) => {
      toast.success(`Perfil ${displayRole(vars.role)} guardado`);
      clearMeCache();
      setDraft((d) => {
        const next = { ...d };
        delete next[vars.role];
        return next;
      });
      await qc.invalidateQueries({ queryKey: ["role-modules"] });
      await qc.invalidateQueries({ queryKey: ["app-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveUser = useMutation({
    mutationFn: (input: { id: string; inherit?: boolean; modules?: string[] }) =>
      input.inherit
        ? saveUserModules(input.id, { inherit: true })
        : saveUserModules(input.id, { modules: input.modules ?? [] }),
    onSuccess: async () => {
      toast.success("Permisos del usuario actualizados");
      clearMeCache();
      await qc.invalidateQueries({ queryKey: ["app-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isAdmin) {
    return (
      <AppShell title="Roles y permisos">
        <Empty message="Solo Admin puede editar perfiles." />
      </AppShell>
    );
  }

  const toggle = (role: string, moduleId: string, on: boolean) => {
    const current = merged[role] ?? [];
    const next = on ? [...current, moduleId] : current.filter((m) => m !== moduleId);
    setDraft((d) => ({ ...d, [role]: next }));
  };

  return (
    <AppShell
      title="Roles y permisos"
      subtitle="Definí qué módulos ve cada perfil, o ajustá un usuario puntual"
    >
      <div className="flex gap-2">
        <Button
          variant={tab === "perfiles" ? "default" : "outline"}
          className="rounded-xl"
          onClick={() => setTab("perfiles")}
        >
          Perfiles
        </Button>
        <Button
          variant={tab === "usuarios" ? "default" : "outline"}
          className="rounded-xl"
          onClick={() => setTab("usuarios")}
        >
          Por usuario
        </Button>
      </div>

      {tab === "perfiles" ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {(profiles.data?.profiles ?? []).map((p) => (
            <article key={p.role} className="card-soft p-5">
              <h2 className="font-display text-xl font-bold text-primary">{p.label}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {p.role === "admin"
                  ? "Ve todo. Roles y permisos no se puede quitar."
                  : p.role === "colaborador"
                    ? "Staff del spa. Ventas, si lo activás, es solo registrar mostrador (sin historial ni totales)."
                    : "Dueño de mascotas. No puede ver operación interna."}
              </p>
              <ul className="mt-4 space-y-2">
                {PANEL_MODULES.map((m) => {
                  const locked =
                    (p.role === "admin" && m.id === "permisos") ||
                    (p.role === "cliente" &&
                      [
                        "dashboard",
                        "ventas",
                        "inventario",
                        "personal",
                        "reportes",
                        "configuracion",
                        "permisos",
                        "promociones",
                      ].includes(m.id));
                  const on = (merged[p.role] ?? []).includes(m.id);
                  return (
                    <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className={locked && !on ? "text-muted-foreground" : ""}>
                        {m.label}
                        {m.id === "ventas" && p.role === "colaborador" ? (
                          <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
                            Solo registrar mostrador (sin historial ni totales)
                          </span>
                        ) : null}
                      </span>
                      <Switch
                        checked={on}
                        disabled={locked}
                        onCheckedChange={(v) => toggle(p.role, m.id, v)}
                      />
                    </li>
                  );
                })}
              </ul>
              <Button
                className="mt-4 w-full rounded-xl"
                disabled={saveProfile.isPending}
                onClick={() =>
                  saveProfile.mutate({ role: p.role, modules: merged[p.role] ?? p.modules })
                }
              >
                Guardar {p.label}
              </Button>
            </article>
          ))}
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-3xl border border-border bg-card">
          {(users.data ?? []).map((u) => (
            <UserModulesRow
              key={`${u.id}-${u.modules_custom ? "c" : "i"}-${(u.modules ?? []).join(",")}`}
              user={u}
              pending={saveUser.isPending}
              onSave={(payload) => saveUser.mutate({ id: u.id, ...payload })}
            />
          ))}
          {!(users.data ?? []).length ? (
            <li className="p-6">
              <Empty message="Sin usuarios." />
            </li>
          ) : null}
        </ul>
      )}
    </AppShell>
  );
}

function UserModulesRow({
  user,
  pending,
  onSave,
}: {
  user: AppUser;
  pending: boolean;
  onSave: (p: { inherit?: boolean; modules?: string[] }) => void;
}) {
  const inherited = user.modules_inherited ?? user.modules ?? [];
  const [custom, setCustom] = useState(!!user.modules_custom);
  const [mods, setMods] = useState<string[]>(user.modules ?? inherited);

  const forbidden =
    user.role === "cliente"
      ? new Set([
          "dashboard",
          "ventas",
          "inventario",
          "personal",
          "reportes",
          "configuracion",
          "permisos",
        ])
      : user.role === "admin"
        ? new Set<string>()
        : new Set(["permisos"]);

  return (
    <li className="px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">{user.full_name}</p>
          <p className="text-xs text-muted-foreground">
            {user.email} · {displayRole(user.role)}
            {user.modules_custom ? " · permisos propios" : " · usa el perfil"}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={custom}
            onCheckedChange={(v) => {
              setCustom(v);
              if (!v) setMods(inherited);
            }}
          />
          Personalizar
        </label>
      </div>
      {custom ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {PANEL_MODULES.map((m) => {
            const locked = forbidden.has(m.id);
            const on = mods.includes(m.id);
            return (
              <label
                key={m.id}
                className={`rounded-full border px-3 py-1 text-xs ${
                  on ? "border-accent bg-accent/15" : "border-border text-muted-foreground"
                } ${locked ? "opacity-40" : "cursor-pointer"}`}
              >
                <input
                  type="checkbox"
                  className="mr-1.5"
                  disabled={locked}
                  checked={on}
                  onChange={() =>
                    setMods((cur) =>
                      on ? cur.filter((x) => x !== m.id) : [...cur, m.id],
                    )
                  }
                />
                {m.label}
              </label>
            );
          })}
        </div>
      ) : null}
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          className="rounded-xl"
          disabled={pending}
          onClick={() =>
            custom ? onSave({ modules: mods }) : onSave({ inherit: true })
          }
        >
          Guardar
        </Button>
      </div>
    </li>
  );
}
