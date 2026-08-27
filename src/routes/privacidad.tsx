import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalLayout, PRIVACY_PDF, TERMS_PDF } from "@/components/legal-layout";

export const Route = createFileRoute("/privacidad")({
  head: () => ({
    meta: [
      { title: "Política de privacidad | Spa Kira" },
      {
        name: "description",
        content:
          "Política de tratamiento de datos personales de Spa Kira Luxury, conforme a la Ley 1581 de 2012 (Colombia).",
      },
    ],
  }),
  component: PrivacidadPage,
});

function PrivacidadPage() {
  return (
    <LegalLayout title="Política de privacidad y tratamiento de datos personales" pdfHref={PRIVACY_PDF}>
      <h2>1. Responsable del tratamiento</h2>
      <p>
        El responsable del tratamiento de los datos personales es{" "}
        <strong>Spa Kira Luxury</strong> (en adelante, “Spa Kira”), con operación en
        Bogotá, Colombia. Canal de contacto para habeas data y soporte:{" "}
        <a href="mailto:spakiraluxury@e-mac.co">spakiraluxury@e-mac.co</a>. Sitio web:{" "}
        <a href="https://spakira.e-mac.co">https://spakira.e-mac.co</a>.
      </p>
      <h2>2. Marco normativo</h2>
      <p>
        Esta política se rige por la Constitución Política de Colombia (arts. 15 y 20),
        la Ley 1581 de 2012, el Decreto 1377 de 2013 y normas que los modifiquen; y, en
        lo pertinente, la Ley 1480 de 2011 (Estatuto del Consumidor). La autoridad de
        vigilancia es la Superintendencia de Industria y Comercio (SIC).
      </p>
      <h2>3. Datos que recolectamos</h2>
      <ul>
        <li>Identificación y contacto: nombre, correo electrónico, teléfono.</li>
        <li>Datos de mascotas y citas necesarios para prestar el servicio de grooming.</li>
        <li>
          Datos de autenticación con Google (nombre, correo y foto de perfil) cuando
          usás “Continuar con Google”. No accedemos a tu Gmail ni a tu Drive.
        </li>
        <li>
          Datos de agenda de Google Calendar solo si un miembro del personal autoriza
          expresamente la integración de calendario (flujo distinto al login).
        </li>
        <li>Datos técnicos de navegación (IP, dispositivo, registros de error) para seguridad y operación del sitio.</li>
      </ul>
      <h2>4. Finalidades</h2>
      <p>Tratamos los datos para: crear y administrar tu cuenta; agendar y prestar servicios;
        facturación y comunicaciones operativas; cumplimiento legal; seguridad de la plataforma;
        y, con tu autorización, comunicaciones comerciales.</p>
      <h2>5. Autorización y bases</h2>
      <p>
        El tratamiento se fundamenta en tu autorización (al registrarte, iniciar sesión o
        aceptar estas políticas), en la ejecución del contrato de servicios y en el
        cumplimiento de deberes legales. Podés retirar la autorización en cualquier
        momento, sin perjuicio de las obligaciones que ya se hayan ejecutado.
      </p>
      <h2>6. Encargados y transferencias</h2>
      <p>
        Podemos usar encargados tecnológicos (alojamiento en AWS, autenticación Google)
        bajo instrucciones y medidas de seguridad. Google LLC trata datos según sus
        propias políticas cuando usás OAuth. No vendemos bases de datos a terceros.
      </p>
      <h2>7. Derechos de los titulares (ARCO y habeas data)</h2>
      <p>
        Podés conocer, actualizar, rectificar y suprimir tus datos, y revocar la
        autorización, escribiendo a{" "}
        <a href="mailto:spakiraluxury@e-mac.co">spakiraluxury@e-mac.co</a> con el asunto
        “Habeas data”. Responderemos en los plazos de la Ley 1581 de 2012. También
        podés acudir a la SIC.
      </p>
      <h2>8. Conservación y seguridad</h2>
      <p>
        Conservamos los datos el tiempo necesario para las finalidades y las obligaciones
        legales (por ejemplo, fiscales). Aplicamos medidas razonables de acceso
        restringido, cifrado en tránsito (HTTPS) y control de cuentas.
      </p>
      <h2>9. Menores de edad</h2>
      <p>
        El panel y el login no están dirigidos a menores de 18 años. No recolectamos
        datos de menores de forma intencional.
      </p>
      <h2>10. Cambios</h2>
      <p>
        Publicaremos la versión vigente en esta URL y en el{" "}
        <a href={PRIVACY_PDF}>PDF</a>. El uso continuado del sitio tras un cambio
        sustancial implica conocimiento de la nueva versión.
      </p>
      <p>
        Ver también:{" "}
        <Link to="/terminos">Términos y condiciones</Link>.
      </p>
    </LegalLayout>
  );
}
