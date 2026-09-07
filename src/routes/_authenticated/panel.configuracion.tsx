import { useEffect, useState } from "react";
import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MapPin } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/ui-kit";
import { BrandMark } from "@/components/brand";
import { EmailTemplatesPanel, MailConfigPanel } from "@/components/config-email-panels";
import { ConfigBusinessHoursPanel } from "@/components/config-business-hours-panel";
import { ConfigHomePanel } from "@/components/config-home-panel";
import { ConfigPaymentMethodsPanel } from "@/components/config-payment-methods-panel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  getBusinessSettings,
  patchBusinessSettings,
} from "@/lib/spa-queries";
import { requirePathAccess } from "@/lib/route-access";
import { permissionsFor } from "@/lib/roles";
import { mapsEmbedSrc, publicLocationLabel } from "@/lib/location-display";

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

type ConfigTab = "general" | "inicio" | "correos" | "pagos" | "escaner";
type CorreosSub = "plantillas" | "smtp";

function Configuracion() {
  const { user } = useRouteContext({ from: "/_authenticated" });
  const isAdmin = permissionsFor(user?.role).isAdmin;
  const qc = useQueryClient();
  const [tab, setTab] = useState<ConfigTab>("general");
  const [correosSub, setCorreosSub] = useState<CorreosSub>("plantillas");
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
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [addressReference, setAddressReference] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");
  const [showAddressPublic, setShowAddressPublic] = useState(true);

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
    setCity(business.data.city || "");
    setRegion(business.data.region || "");
    setAddressReference(business.data.address_reference || "");
    setMapsUrl(business.data.maps_url || "");
    setShowAddressPublic(business.data.show_address_public !== false);
  }, [business.data]);

  const businessMut = useMutation({
    mutationFn: () =>
      patchBusinessSettings({
        trade_name: tradeName.trim(),
        slogan: slogan.trim(),
        address: address.trim(),
        whatsapp: whatsapp.trim(),
        city: city.trim(),
        region: region.trim(),
        address_reference: addressReference.trim(),
        maps_url: mapsUrl.trim(),
        show_address_public: showAddressPublic,
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

  const tabs: { id: ConfigTab; label: string; adminOnly?: boolean }[] = [
    { id: "general", label: "General" },
    { id: "inicio", label: "Inicio", adminOnly: true },
    { id: "correos", label: "Correos", adminOnly: true },
    { id: "pagos", label: "Medios de pago", adminOnly: true },
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
                  <Label>WhatsApp de contacto</Label>
                  <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className="h-11 rounded-xl" />
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Ubicación">
              <p className="mb-4 text-sm text-muted-foreground">
                Sede actual. Multi-sede vendrá después; estos campos quedan listos para migrar.
              </p>
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label>Dirección</Label>
                  <Input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="h-11 rounded-xl"
                    placeholder="Calle 80 # 12-34"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Ciudad</Label>
                    <Input value={city} onChange={(e) => setCity(e.target.value)} className="h-11 rounded-xl" placeholder="Cota" />
                  </div>
                  <div className="space-y-2">
                    <Label>Departamento</Label>
                    <Input
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      className="h-11 rounded-xl"
                      placeholder="Cundinamarca"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Referencia (opcional)</Label>
                  <Input
                    value={addressReference}
                    onChange={(e) => setAddressReference(e.target.value)}
                    className="h-11 rounded-xl"
                    placeholder="Cerca del parque principal"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Enlace de Google Maps</Label>
                  <Input
                    value={mapsUrl}
                    onChange={(e) => setMapsUrl(e.target.value)}
                    className="h-11 rounded-xl"
                    placeholder="https://maps.google.com/…"
                  />
                </div>
                <div className="flex items-center justify-between gap-4 rounded-2xl bg-secondary/50 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">Mostrar dirección públicamente</p>
                    <p className="text-xs text-muted-foreground">En el home y franja de contacto.</p>
                  </div>
                  <Switch checked={showAddressPublic} onCheckedChange={setShowAddressPublic} />
                </div>
                {isAdmin ? (
                  <Button
                    className="rounded-xl"
                    disabled={businessMut.isPending || !tradeName.trim()}
                    onClick={() => businessMut.mutate()}
                  >
                    Guardar identidad y ubicación
                  </Button>
                ) : null}
              </div>
            </SectionCard>

            <SectionCard title="Vista previa en el sitio">
              <LocationPublicPreview
                address={address}
                city={city}
                region={region}
                mapsUrl={mapsUrl}
                showPublic={showAddressPublic}
              />
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

      {tab === "pagos" && isAdmin ? <ConfigPaymentMethodsPanel /> : null}

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

    </AppShell>
  );
}

function LocationPublicPreview({
  address,
  city,
  region,
  mapsUrl,
  showPublic,
}: {
  address: string;
  city: string;
  region: string;
  mapsUrl: string;
  showPublic: boolean;
}) {
  const label = publicLocationLabel({ address, city, region });
  const embed = mapsEmbedSrc(mapsUrl, [address, city, region].filter(Boolean).join(", "));

  if (!showPublic) {
    return (
      <p className="text-sm text-muted-foreground">
        La dirección está oculta en el sitio público. El mapa solo se ve acá en Configuración.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-start gap-2 text-sm">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span className="font-medium text-foreground">{label || "Sin ubicación cargada"}</span>
        </div>
      </div>
      {embed ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-muted/40">
          <iframe
            title="Mapa de la sede"
            src={embed}
            className="h-48 w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Agregá dirección o un link de Maps para ver el mapa.</p>
      )}
    </div>
  );
}
