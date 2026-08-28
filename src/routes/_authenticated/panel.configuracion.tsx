import { useEffect, useState } from "react";
import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { SectionCard, Empty } from "@/components/ui-kit";
import { BrandMark } from "@/components/brand";
import { EmailTemplatesPanel, MailConfigPanel } from "@/components/config-email-panels";
import { ConfigUsersPanel } from "@/components/config-users-panel";
import { ConfigBusinessHoursPanel } from "@/components/config-business-hours-panel";
import { ConfigHomePanel } from "@/components/config-home-panel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  auditQuery,
  getBusinessSettings,
  patchBusinessSettings,
  seedMonthAgenda,
  type AuditEntry,
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

type ConfigTab = "general" | "inicio" | "correos" | "usuarios" | "escaner";
type CorreosSub = "plantillas" | "smtp";

const AUDIT_PAGE_SIZE = 10;

function Configuracion() {
  const { user } = useRouteContext({ from: "/_authenticated" });
  const isAdmin = permissionsFor(user?.role).isAdmin;
  const qc = useQueryClient();
  const [tab, setTab] = useState<ConfigTab>("general");
  const [correosSub, setCorreosSub] = useState<CorreosSub>("plantillas");
  const [auditPage, setAuditPage] = useState(0);
  const [auditDetail, setAuditDetail] = useState<AuditEntry | null>(null);
  const audit = useQuery({
    ...auditQuery(AUDIT_PAGE_SIZE, auditPage * AUDIT_PAGE_SIZE),
    enabled: isAdmin && tab === "usuarios",
  });
  const business = useQuery({ queryKey: ["business-settings"], queryFn: getBusinessSettings });
  const [tradeName, setTradeName] = useState("Spa Kira");
  const [slogan, setSlogan] = useState("Luxury pet grooming · Canina y felina");
  const [address, setAddress] = useState("Bogotá, Colombia");
  const [whatsapp, setWhatsapp] = useState("+57 310 555 1234");
  const [contactEmail, setContactEmail] = useState("spakiraluxury@e-mac.co");
  const [siteUrl, setSiteUrl] = useState("https://spakira.e-mac.co");
  const [legalFrom, setLegalFrom] = useState("2026-08-26");
  const [privacyUrl, setPrivacyUrl] = useState("https://spakira.e-mac.co/privacidad");
  const [termsUrl, setTermsUrl] = useState("https://spakira.e-mac.co/terminos");
  const [privacyPdf, setPrivacyPdf] = useState("/legal/politica-privacidad.pdf");
  const [termsPdf, setTermsPdf] = useState("/legal/terminos-condiciones.pdf");
  const [scannerOn, setScannerOn] = useState(false);
  const [scannerMode, setScannerMode] = useState("keyboard");
  const [scannerSuffix, setScannerSuffix] = useState("");

  useEffect(() => {
    if (!business.data) return;
    setTradeName(business.data.trade_name || "");
    setSlogan(business.data.slogan || "");
    setAddress(business.data.address || "");
    setWhatsapp(business.data.whatsapp || "");
    setContactEmail(business.data.contact_email || "");
    setSiteUrl(business.data.site_url || "");
    setLegalFrom((business.data.legal_effective_from || "").slice(0, 10));
    setPrivacyUrl(business.data.privacy_url || "");
    setTermsUrl(business.data.terms_url || "");
    setPrivacyPdf(business.data.privacy_pdf_url || "");
    setTermsPdf(business.data.terms_pdf_url || "");
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
      await qc.invalidateQueries({ queryKey: ["business-settings-public"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const legalMut = useMutation({
    mutationFn: () =>
      patchBusinessSettings({
        contact_email: contactEmail.trim(),
        site_url: siteUrl.trim(),
        legal_effective_from: legalFrom.trim() || null,
        privacy_url: privacyUrl.trim(),
        terms_url: termsUrl.trim(),
        privacy_pdf_url: privacyPdf.trim(),
        terms_pdf_url: termsPdf.trim(),
      }),
    onSuccess: async () => {
      toast.success("Enlaces legales actualizados");
      await qc.invalidateQueries({ queryKey: ["business-settings"] });
      await qc.invalidateQueries({ queryKey: ["business-settings-public"] });
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

  const tabs: { id: ConfigTab; label: string; adminOnly?: boolean }[] = [
    { id: "general", label: "General" },
    { id: "inicio", label: "Inicio", adminOnly: true },
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
        <div className="grid gap-6">
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
            <SectionCard title="Legal y enlaces públicos">
              <p className="mb-4 text-sm text-muted-foreground">
                Las páginas HTML viven en <code className="text-xs">/privacidad</code> y{" "}
                <code className="text-xs">/terminos</code> (no cambies esas rutas en Google OAuth).
                Acá editás el contacto y los links que se muestran en el sitio; los textos legales
                toman nombre, dirección y correo de esta config en vivo.
              </p>
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label>Correo de contacto / habeas data</Label>
                  <Input
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="h-11 rounded-xl"
                    type="email"
                    placeholder="spakiraluxury@e-mac.co"
                  />
                </div>
                <div className="space-y-2">
                  <Label>URL del sitio</Label>
                  <Input
                    value={siteUrl}
                    onChange={(e) => setSiteUrl(e.target.value)}
                    className="h-11 rounded-xl"
                    placeholder="https://spakira.e-mac.co"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Vigencia legal (desde)</Label>
                  <Input
                    value={legalFrom}
                    onChange={(e) => setLegalFrom(e.target.value)}
                    className="h-11 rounded-xl"
                    type="date"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Link política de privacidad</Label>
                  <Input
                    value={privacyUrl}
                    onChange={(e) => setPrivacyUrl(e.target.value)}
                    className="h-11 rounded-xl"
                    placeholder="https://spakira.e-mac.co/privacidad"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Link términos y condiciones</Label>
                  <Input
                    value={termsUrl}
                    onChange={(e) => setTermsUrl(e.target.value)}
                    className="h-11 rounded-xl"
                    placeholder="https://spakira.e-mac.co/terminos"
                  />
                </div>
                <div className="space-y-2">
                  <Label>PDF privacidad (opcional)</Label>
                  <Input
                    value={privacyPdf}
                    onChange={(e) => setPrivacyPdf(e.target.value)}
                    className="h-11 rounded-xl"
                    placeholder="/legal/politica-privacidad.pdf — vacío = ocultar"
                  />
                </div>
                <div className="space-y-2">
                  <Label>PDF términos (opcional)</Label>
                  <Input
                    value={termsPdf}
                    onChange={(e) => setTermsPdf(e.target.value)}
                    className="h-11 rounded-xl"
                    placeholder="/legal/terminos-condiciones.pdf — vacío = ocultar"
                  />
                </div>
                <Button
                  className="rounded-xl"
                  disabled={legalMut.isPending}
                  onClick={() => legalMut.mutate()}
                >
                  Guardar legal y enlaces
                </Button>
              </div>
            </SectionCard>
          ) : null}

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

          {isAdmin ? <ConfigBusinessHoursPanel /> : null}
        </div>
      ) : null}

      {tab === "inicio" && isAdmin ? <ConfigHomePanel /> : null}

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
                    await qc.invalidateQueries({ queryKey: ["business-settings-public"] });
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
          <ConfigUsersPanel currentUserId={user?.id} />

          <SectionCard title="Auditoría de acciones">
            <p className="mb-4 text-sm text-muted-foreground">
              Registro en base de datos de altas, cambios y bajas del panel (servicios, citas,
              usuarios, permisos, configuración, etc.). Se muestran de a {AUDIT_PAGE_SIZE} acciones.
            </p>
            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full min-w-[920px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3 font-semibold">Cuándo</th>
                    <th className="px-4 py-3 font-semibold">Quién</th>
                    <th className="px-4 py-3 font-semibold">Acción</th>
                    <th className="px-4 py-3 font-semibold">Entidad</th>
                    <th className="px-4 py-3 font-semibold">Detalle</th>
                    <th className="px-4 py-3 font-semibold" />
                  </tr>
                </thead>
                <tbody>
                  {(audit.data?.items ?? []).map((a) => (
                    <tr key={a.id} className="border-b border-border/60 last:border-0 align-top">
                      <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                        {a.created_at ? `${shortDate(a.created_at)} ${time(a.created_at)}` : "—"}
                      </td>
                      <td className="px-4 py-2.5">{a.actor_email ?? "—"}</td>
                      <td className="px-4 py-2.5 capitalize">{a.action_label ?? a.action}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {a.entity_label ?? a.entity_type}
                        {a.entity_id ? (
                          <span className="ml-1 font-mono text-[11px]">
                            {String(a.entity_id).slice(0, 8)}…
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {a.summary ?? "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="rounded-lg"
                          onClick={() => setAuditDetail(a)}
                        >
                          Ver
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!audit.isLoading && !(audit.data?.items?.length) ? (
                <div className="p-4">
                  <Empty message="Aún no hay eventos de auditoría." />
                </div>
              ) : null}
            </div>
            {(() => {
              const total = audit.data?.total ?? 0;
              const pages = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));
              if (total <= AUDIT_PAGE_SIZE) return null;
              return (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <p className="text-muted-foreground">
                    {total} eventos · página {auditPage + 1} de {pages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      disabled={auditPage <= 0 || audit.isFetching}
                      onClick={() => setAuditPage((p) => Math.max(0, p - 1))}
                    >
                      Anterior
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      disabled={auditPage + 1 >= pages || audit.isFetching}
                      onClick={() => setAuditPage((p) => p + 1)}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              );
            })()}
          </SectionCard>

          <Dialog open={!!auditDetail} onOpenChange={(open) => !open && setAuditDetail(null)}>
            <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto rounded-2xl">
              <DialogHeader>
                <DialogTitle className="font-display text-xl text-primary">
                  Detalle de auditoría
                </DialogTitle>
              </DialogHeader>
              {auditDetail ? (
                <div className="space-y-4 text-sm">
                  <p className="text-muted-foreground">{auditDetail.summary}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <p>
                      <span className="text-muted-foreground">Quién:</span>{" "}
                      {auditDetail.actor_email ?? "—"}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Cuándo:</span>{" "}
                      {auditDetail.created_at
                        ? `${shortDate(auditDetail.created_at)} ${time(auditDetail.created_at)}`
                        : "—"}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Acción:</span>{" "}
                      {auditDetail.action_label ?? auditDetail.action}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Entidad:</span>{" "}
                      {auditDetail.entity_label ?? auditDetail.entity_type}
                    </p>
                  </div>
                  {auditDetail.before_data ? (
                    <div>
                      <p className="mb-1 font-medium text-primary">Antes</p>
                      <pre className="max-h-48 overflow-auto rounded-xl bg-secondary/60 p-3 text-xs">
                        {JSON.stringify(auditDetail.before_data, null, 2)}
                      </pre>
                    </div>
                  ) : null}
                  {auditDetail.after_data ? (
                    <div>
                      <p className="mb-1 font-medium text-primary">Después</p>
                      <pre className="max-h-48 overflow-auto rounded-xl bg-secondary/60 p-3 text-xs">
                        {JSON.stringify(auditDetail.after_data, null, 2)}
                      </pre>
                    </div>
                  ) : null}
                  {auditDetail.meta ? (
                    <div>
                      <p className="mb-1 font-medium text-primary">Meta</p>
                      <pre className="max-h-32 overflow-auto rounded-xl bg-secondary/60 p-3 text-xs">
                        {JSON.stringify(auditDetail.meta, null, 2)}
                      </pre>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </DialogContent>
          </Dialog>
        </div>
      ) : null}
    </AppShell>
  );
}
