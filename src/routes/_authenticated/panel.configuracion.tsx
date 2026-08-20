import { useEffect, useState } from "react";
import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { SectionCard, Empty } from "@/components/ui-kit";
import { BrandMark } from "@/components/brand";
import { EmailTemplatesPanel, MailConfigPanel } from "@/components/config-email-panels";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  appUsersQuery,
  inviteAppUser,
  patchAppUser,
  resetAppUserPassword,
  auditQuery,
  getBusinessSettings,
  patchBusinessSettings,
  seedMonthAgenda,
} from "@/lib/spa-queries";
import { shortDate, time } from "@/lib/format";
import { requirePathAccess } from "@/lib/route-access";
import { permissionsFor } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/panel/configuracion")({
  beforeLoad: requirePathAccess("/panel/configuracion"),
  head: () => ({
    meta: [
      { title: "Configuración | Spa Kira" },
      {
        name: "description",
        content: "Datos del negocio, horarios y preferencias del panel administrativo de Spa Kira.",
      },
      { property: "og:title", content: "Configuración | Spa Kira" },
      { property: "og:description", content: "Preferencias del panel administrativo." },
    ],
  }),
  component: Configuracion,
});

type ConfigTab = "general" | "correos" | "usuarios" | "escaner";
type CorreosSub = "plantillas" | "smtp";

function Configuracion() {
  const { user } = useRouteContext({ from: "/_authenticated" });
  const isAdmin = permissionsFor(user?.role).isAdmin;
  const users = useQuery({ ...appUsersQuery, enabled: isAdmin });
  const audit = useQuery({ ...auditQuery, enabled: isAdmin });
  const qc = useQueryClient();
  const [tab, setTab] = useState<ConfigTab>("general");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("colaborador");
  const [correosSub, setCorreosSub] = useState<CorreosSub>("plantillas");
  const [resetFor, setResetFor] = useState<{ id: string; email: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const business = useQuery({ queryKey: ["business-settings"], queryFn: getBusinessSettings });
  const [tradeName, setTradeName] = useState("Spa Kira");
  const [slogan, setSlogan] = useState("Luxury pet grooming · Canina y felina");
  const [address, setAddress] = useState("Bogotá, Colombia");
  const [whatsapp, setWhatsapp] = useState("+57 310 555 1234");
  const [scannerOn, setScannerOn] = useState(false);
  const [scannerMode, setScannerMode] = useState("keyboard");
  const [scannerSuffix, setScannerSuffix] = useState("");

  useEffect(() => {
    if (!business.data) return;
    setTradeName(business.data.trade_name || "");
    setSlogan(business.data.slogan || "");
    setAddress(business.data.address || "");
    setWhatsapp(business.data.whatsapp || "");
    setScannerOn(!!business.data.barcode_scanner_enabled);
    setScannerMode(business.data.barcode_scanner_mode || "keyboard");
    setScannerSuffix(business.data.barcode_suffix || "");
  }, [business.data]);

  const businessMut = useMutation({
    mutationFn: () =>
      patchBusinessSettings({
        trade_name: tradeName.trim(),
        slogan: slogan.trim(),
        address: address.trim(),
        whatsapp: whatsapp.trim(),
      }),
    onSuccess: async () => {
      toast.success("Identidad del negocio guardada");
      await qc.invalidateQueries({ queryKey: ["business-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const seedMut = useMutation({
    mutationFn: seedMonthAgenda,
    onSuccess: (res) => {
      toast.success(
        res.ok
          ? `Agenda demo: ${res.appointments ?? 0} citas (${res.from} — ${res.to})`
          : "No se pudo generar el mes de prueba",
      );
      void qc.invalidateQueries({ queryKey: ["appointments"] });
      void qc.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

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
      await qc.invalidateQueries({ queryKey: ["app-users"] });
      await qc.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const roleMut = useMutation({
    mutationFn: ({ id, nextRole }: { id: string; nextRole: string }) =>
      patchAppUser(id, { role: nextRole }),
    onSuccess: async () => {
      toast.success("Rol actualizado");
      await qc.invalidateQueries({ queryKey: ["app-users"] });
      await qc.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resetMut = useMutation({
    mutationFn: () => {
      if (!resetFor) throw new Error("Sin usuario");
      if (newPassword.length < 6) throw new Error("La clave debe tener al menos 6 caracteres");
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

  const tabs: { id: ConfigTab; label: string; adminOnly?: boolean }[] = [
    { id: "general", label: "General" },
    { id: "correos", label: "Correos", adminOnly: true },
    { id: "usuarios", label: "Usuarios", adminOnly: true },
    { id: "escaner", label: "Escáner", adminOnly: true },
  ];

  return (
    <AppShell title="Configuración" subtitle="Datos del negocio y preferencias">
      <div className="mb-6 flex flex-wrap gap-2">
        {tabs
          .filter((t) => !t.adminOnly || isAdmin)
          .map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                tab === t.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
      </div>

      
      {tab === "general" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard title="Identidad del negocio">
            <BrandMark compact tagline tradeName={tradeName} slogan={slogan} />
            <div className="mt-5 grid gap-4">
              <div className="space-y-2">
                <Label>Nombre comercial</Label>
                <Input value={tradeName} onChange={(e) => setTradeName(e.target.value)} className="h-11 rounded-xl" />
                <p className="text-[11px] text-muted-foreground">
                  Se refleja en el menú izquierdo (primera palabra en script, el resto en mayúsculas).
                </p>
              </div>
              <div className="space-y-2">
                <Label>Eslogan</Label>
                <Input value={slogan} onChange={(e) => setSlogan(e.target.value)} className="h-11 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Dirección</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} className="h-11 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>WhatsApp de contacto</Label>
                <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className="h-11 rounded-xl" />
              </div>
              {isAdmin ? (
                <Button className="rounded-xl" disabled={businessMut.isPending || !tradeName.trim()} onClick={() => businessMut.mutate()}>
                  Guardar identidad
                </Button>
              ) : null}
            </div>
          </SectionCard>

          {isAdmin ? (
            <SectionCard title="Datos de prueba (agenda)">
              <p className="mb-3 text-sm text-muted-foreground">
                Genera un mes de horarios variables, días libres y citas auto-asignadas (notas
                [demo-mes]). Solo en entorno local. Los correos no se envían si MAIL_LOG_ONLY=1.
              </p>
              <Button
                className="rounded-xl"
                disabled={seedMut.isPending}
                onClick={() => seedMut.mutate()}
              >
                Cargar mes de prueba
              </Button>
            </SectionCard>
          ) : null}

          <SectionCard title="Preferencias del panel">
            <div className="space-y-4">
              {[
                { t: "Recordatorios por WhatsApp", d: "Avisar a los dueños un día antes de la cita." },
                { t: "Alertas de stock bajo", d: "Notificar cuando un producto llegue al mínimo." },
                { t: "Fotos antes y después", d: "Solicitar fotos al finalizar cada servicio." },
                { t: "Comisiones automáticas", d: "Calcular la comisión del estilista en cada venta." },
              ].map((row) => (
                <div key={row.t} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-2xl bg-secondary/50 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{row.t}</p>
                    <p className="text-xs text-muted-foreground">{row.d}</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              ))}
              <p className="text-[11px] text-muted-foreground">
                Estos interruptores son preferencias visuales por ahora (aún no activan automatizaciones).
              </p>
            </div>
          </SectionCard>
        </div>
      ) : null}

      {tab === "escaner" && isAdmin ? (
        <SectionCard title="Lector de código de barras">
          <p className="mb-4 text-sm text-muted-foreground">
            Las pistolas USB se comportan como teclado: al escanear escriben el código en el campo
            activo (Inventario → código de barras) y suelen mandar Enter. La cámara del celular
            queda para más adelante.
          </p>
          <div className="space-y-4">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-2xl bg-secondary/50 p-4">
              <div>
                <p className="text-sm font-medium">Habilitar pistola / teclado</p>
                <p className="text-xs text-muted-foreground">No hace falta driver extra en Chrome.</p>
              </div>
              <Switch checked={scannerOn} onCheckedChange={setScannerOn} />
            </div>
            <div className="space-y-2">
              <Label>Modo</Label>
              <select
                className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                value={scannerMode}
                onChange={(e) => setScannerMode(e.target.value)}
              >
                <option value="keyboard">Pistola USB (teclado)</option>
                <option value="camera">Cámara (próximamente)</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Sufijo al escanear</Label>
              <Input
                className="h-11 rounded-xl"
                value={scannerSuffix}
                onChange={(e) => setScannerSuffix(e.target.value)}
                placeholder="vacío = Enter de la pistola"
              />
            </div>
            <Button
              className="rounded-xl"
              disabled={businessMut.isPending}
              onClick={() =>
                patchBusinessSettings({
                  barcode_scanner_enabled: scannerOn,
                  barcode_scanner_mode: scannerMode,
                  barcode_suffix: scannerSuffix,
                })
                  .then(async () => {
                    toast.success("Escáner guardado");
                    await qc.invalidateQueries({ queryKey: ["business-settings"] });
                  })
                  .catch((e: Error) => toast.error(e.message))
              }
            >
              Guardar escáner
            </Button>
          </div>
        </SectionCard>
      ) : null}

      {tab === "correos" && isAdmin ? (
        <SectionCard title="Correos">
          <div className="mb-4 flex flex-wrap gap-2">
            {([["plantillas", "Plantillas"], ["smtp", "Configuración de correo"]] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setCorreosSub(id)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  correosSub === id ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {correosSub === "plantillas" ? (
            <>
              <p className="mb-4 text-sm text-muted-foreground">
                Editá el HTML de los avisos (agenda y facturas). Usá las variables para insertar datos reales al enviar.
              </p>
              <EmailTemplatesPanel />
            </>
          ) : (
            <MailConfigPanel />
          )}
        </SectionCard>
      ) : null}

      {tab === "usuarios" && isAdmin ? (
        <div className="grid gap-6">
          <SectionCard title="Usuarios del panel">
            <p className="mb-4 text-sm text-muted-foreground">
              Al agregar un usuario se envía un correo de activación. El rol{" "}
              <strong>Usuario</strong> ve Mis mascotas y Mi agenda. El rol{" "}
              <strong>Staff</strong> (antes Colaborador) también crea ficha en el menú Staff.{" "}
              <strong>Admin</strong> lo asignás acá. Podés restablecer la clave si no entra solo
              con Google.
            </p>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="space-y-2 sm:col-span-2">
                <Label>Correo</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 rounded-xl"
                  placeholder="nuevo@spakira.local"
                />
              </div>
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>Rol</Label>
                <select
                  className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value="cliente">Usuario</option>
                  <option value="colaborador">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <Button
              className="mt-4 rounded-xl"
              disabled={!email.trim() || inviteMut.isPending}
              onClick={() => inviteMut.mutate()}
            >
              Agregar usuario
            </Button>

            <ul className="mt-6 divide-y divide-border rounded-2xl border border-border">
              {(users.data ?? []).map((u) => (
                <li
                  key={u.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{u.full_name}</p>
                    <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <select
                      className="h-9 rounded-xl border border-input bg-background px-2 text-xs"
                      value={u.role}
                      disabled={roleMut.isPending}
                      onChange={(e) => {
                        const next = e.target.value;
                        if (next === u.role) return;
                        roleMut.mutate({ id: u.id, nextRole: next });
                      }}
                    >
                      <option value="cliente">Usuario</option>
                      <option value="colaborador">Staff</option>
                      <option value="admin">Admin</option>
                    </select>
                    {u.auth_provider === "google" ? (
                      <span className="text-xs text-muted-foreground">Google</span>
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
                    <span className="text-xs text-muted-foreground">
                      {u.active ? "Activo" : "Pendiente activación"}
                    </span>
                  </div>
                </li>
              ))}
              {!users.data?.length ? <Empty message="Sin usuarios." /> : null}
            </ul>
          </SectionCard>

          <SectionCard title="Auditoría de acciones">
            <p className="mb-4 text-sm text-muted-foreground">
              Registro de altas, cambios y bajas en el panel (mascotas, humanos, servicios, citas,
              etc.). Google Calendar no define el rol: el rol vive en el usuario del panel.
            </p>
            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3 font-semibold">Cuándo</th>
                    <th className="px-4 py-3 font-semibold">Quién</th>
                    <th className="px-4 py-3 font-semibold">Acción</th>
                    <th className="px-4 py-3 font-semibold">Entidad</th>
                  </tr>
                </thead>
                <tbody>
                  {(audit.data ?? []).map((a) => (
                    <tr key={a.id} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {a.created_at ? `${shortDate(a.created_at)} ${time(a.created_at)}` : "—"}
                      </td>
                      <td className="px-4 py-2.5">{a.actor_email ?? "—"}</td>
                      <td className="px-4 py-2.5 capitalize">{a.action}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {a.entity_type}
                        {a.entity_id ? (
                          <span className="ml-1 font-mono text-[11px]">
                            {String(a.entity_id).slice(0, 8)}…
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!audit.data?.length ? (
                <div className="p-4">
                  <Empty message="Aún no hay eventos de auditoría." />
                </div>
              ) : null}
            </div>
          </SectionCard>
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
    </AppShell>
  );
}
