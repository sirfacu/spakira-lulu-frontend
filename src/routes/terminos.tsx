import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalLayout, PRIVACY_PDF, TERMS_PDF } from "@/components/legal-layout";

export const Route = createFileRoute("/terminos")({
  head: () => ({
    meta: [
      { title: "Términos y condiciones | Spa Kira" },
      {
        name: "description",
        content:
          "Términos y condiciones de uso de Spa Kira Luxury y de la plataforma web, conforme a la legislación colombiana.",
      },
    ],
  }),
  component: TerminosPage,
});

function TerminosPage() {
  return (
    <LegalLayout title="Términos y condiciones de uso" pdfHref={TERMS_PDF}>
      <h2>1. Aceptación</h2>
      <p>
        Estos términos regulan el uso del sitio{" "}
        <a href="https://spakira.e-mac.co">https://spakira.e-mac.co</a> y de los
        servicios de grooming de <strong>Spa Kira Luxury</strong> en Bogotá, Colombia.
        Al registrarte, iniciar sesión o agendar, aceptás estas condiciones y la{" "}
        <Link to="/privacidad">Política de privacidad</Link>.
      </p>
      <h2>2. El servicio</h2>
      <p>
        Spa Kira ofrece servicios de estética y cuidado para mascotas (baño, corte,
        deslanado y afines). La plataforma permite consultar información, gestionar
        citas y, para el personal, operar el panel administrativo. Los precios
        publicados pueden cambiar; rige el valor confirmado al agendar.
      </p>
      <h2>3. Cuentas y login con Google</h2>
      <p>
        Sos responsable de la confidencialidad de tu cuenta. El botón “Continuar con
        Google” usa OAuth solo para identificar tu correo y nombre (login). La
        conexión de Google Calendar, si existe, es un permiso aparte y voluntario del
        personal. Spa Kira no garantiza la disponibilidad ininterrumpida de Google.
      </p>
      <h2>4. Citas, cancelaciones y mascotas</h2>
      <p>
        El titular declara que la información de la mascota es veraz y que está
        autorizado a solicitar el servicio. Spa Kira puede rechazar o reprogramar una
        cita por razones de seguridad, salud animal o fuerza mayor. Las reglas de
        cancelación o no-show se comunican al agendar o en el local.
      </p>
      <h2>5. Consumidor</h2>
      <p>
        Aplican las normas de protección al consumidor (Ley 1480 de 2011) en lo
        pertinente a la prestación del servicio en Colombia. Reclamos:{" "}
        <a href="mailto:spakiraluxury@e-mac.co">spakiraluxury@e-mac.co</a>.
      </p>
      <h2>6. Propiedad intelectual</h2>
      <p>
        Marca, logo, textos y software de la plataforma son de Spa Kira o de sus
        licenciantes. No está permitido copiar, extraer o usar el sistema con fines
        distintos al servicio contratado.
      </p>
      <h2>7. Limitación</h2>
      <p>
        La plataforma se ofrece “tal cual”. Spa Kira no responde por interrupciones de
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
        Spa Kira Luxury · Bogotá, Colombia ·{" "}
        <a href="mailto:spakiraluxury@e-mac.co">spakiraluxury@e-mac.co</a>
      </p>
      <p>
        PDF: <a href={TERMS_PDF}>términos</a> · <a href={PRIVACY_PDF}>privacidad</a>.
      </p>
    </LegalLayout>
  );
}
