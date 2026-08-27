import { createFileRoute } from "@tanstack/react-router";
import {
  DEFAULT_PRIVACY_PATH,
  LegalLayout,
  resolveLegalHref,
  usePublicBusiness,
} from "@/components/legal-layout";

export const Route = createFileRoute("/terminos")({
  head: () => ({
    meta: [
      { title: "Términos y condiciones | Spa Kira" },
      {
        name: "description",
        content:
          "Términos y condiciones de uso de Spa Kira y de la plataforma web, conforme a la legislación colombiana.",
      },
    ],
  }),
  component: TerminosPage,
});

function TerminosPage() {
  const { data: biz } = usePublicBusiness();
  const trade = biz?.trade_name?.trim() || "Spa Kira";
  const place = biz?.address?.trim() || "Bogotá, Colombia";
  const email = biz?.contact_email?.trim() || "spakiraluxury@e-mac.co";
  const site = (biz?.site_url?.trim() || "https://spakira.e-mac.co").replace(/\/$/, "");
  const privacyHref = resolveLegalHref(biz?.privacy_url, DEFAULT_PRIVACY_PATH);
  const pdfTerms = biz?.terms_pdf_url?.trim() || null;
  const pdfPrivacy = biz?.privacy_pdf_url?.trim() || null;

  return (
    <LegalLayout title="Términos y condiciones de uso" pdfHref={pdfTerms} biz={biz ?? null}>
      <h2>1. Aceptación</h2>
      <p>
        Estos términos regulan el uso del sitio <a href={site}>{site}</a> y de los
        servicios de grooming de <strong>{trade}</strong> en {place}. Al registrarte,
        iniciar sesión o agendar, aceptás estas condiciones y la{" "}
        <a href={privacyHref}>Política de privacidad</a>.
      </p>
      <h2>2. El servicio</h2>
      <p>
        {trade} ofrece servicios de estética y cuidado para mascotas (baño, corte,
        deslanado y afines). La plataforma permite consultar información, gestionar
        citas y, para el personal, operar el panel administrativo. Los precios
        publicados pueden cambiar; rige el valor confirmado al agendar.
      </p>
      <h2>3. Cuentas y login con Google</h2>
      <p>
        Sos responsable de la confidencialidad de tu cuenta. El botón “Continuar con
        Google” usa OAuth solo para identificar tu correo y nombre (login). La
        conexión de Google Calendar, si existe, es un permiso aparte y voluntario del
        personal. {trade} no garantiza la disponibilidad ininterrumpida de Google.
      </p>
      <h2>4. Citas, cancelaciones y mascotas</h2>
      <p>
        El titular declara que la información de la mascota es veraz y que está
        autorizado a solicitar el servicio. {trade} puede rechazar o reprogramar una
        cita por razones de seguridad, salud animal o fuerza mayor. Las reglas de
        cancelación o no-show se comunican al agendar o en el local.
      </p>
      <h2>5. Consumidor</h2>
      <p>
        Aplican las normas de protección al consumidor (Ley 1480 de 2011) en lo
        pertinente a la prestación del servicio en Colombia. Reclamos:{" "}
        <a href={`mailto:${email}`}>{email}</a>.
      </p>
      <h2>6. Propiedad intelectual</h2>
      <p>
        Marca, logo, textos y software de la plataforma son de {trade} o de sus
        licenciantes. No está permitido copiar, extraer o usar el sistema con fines
        distintos al servicio contratado.
      </p>
      <h2>7. Limitación</h2>
      <p>
        La plataforma se ofrece “tal cual”. {trade} no responde por interrupciones de
        internet, de Google o de terceros, ni por daños indirectos, salvo dolo o culpa
        grave según la ley colombiana.
      </p>
      <h2>8. Ley y jurisdicción</h2>
      <p>
        Estos términos se rigen por las leyes de la República de Colombia. Cualquier
        controversia se somete a los jueces de Bogotá, D.C., sin perjuicio de los
        mecanismos de protección al consumidor ante la SIC.
      </p>
      <h2>9. Contacto</h2>
      <p>
        {trade} · {place} · <a href={`mailto:${email}`}>{email}</a>
      </p>
      {pdfTerms || pdfPrivacy ? (
        <p>
          PDF opcional:{" "}
          {pdfTerms ? <a href={pdfTerms}>términos</a> : null}
          {pdfTerms && pdfPrivacy ? " · " : null}
          {pdfPrivacy ? <a href={pdfPrivacy}>privacidad</a> : null}.
        </p>
      ) : null}
    </LegalLayout>
  );
}
