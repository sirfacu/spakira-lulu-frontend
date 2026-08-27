#!/usr/bin/env python3
"""Genera PDFs legales en static/legal/. Requiere fpdf2."""
from pathlib import Path
from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "static" / "legal"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_B = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


class LegalPdf(FPDF):
    def header(self):
        self.set_font("DejaVu", "B", 9)
        self.set_text_color(80, 80, 80)
        self.cell(0, 8, "Spa Kira Luxury  ·  Bogotá, Colombia", align="C")
        self.ln(4)

    def footer(self):
        self.set_y(-15)
        self.set_font("DejaVu", "", 8)
        self.set_text_color(120, 120, 120)
        self.cell(0, 8, f"Página {self.page_no()}  ·  Borrador 2026-08-26  ·  No sustituye asesoría legal", align="C")


def add_title(pdf: LegalPdf, title: str):
    pdf.set_font("DejaVu", "B", 16)
    pdf.set_text_color(30, 30, 30)
    pdf.multi_cell(0, 8, title)
    pdf.ln(2)
    pdf.set_font("DejaVu", "", 10)
    pdf.set_text_color(90, 90, 90)
    pdf.multi_cell(
        0,
        5,
        "Vigente desde el 26 de agosto de 2026. Documento operativo para el sitio y Google OAuth. Revisar con un abogado en Colombia.",
    )
    pdf.ln(4)
    pdf.set_text_color(20, 20, 20)


def h(pdf: LegalPdf, text: str):
    pdf.ln(2)
    pdf.set_font("DejaVu", "B", 12)
    pdf.multi_cell(0, 6, text)
    pdf.ln(1)
    pdf.set_font("DejaVu", "", 10)


def p(pdf: LegalPdf, text: str):
    pdf.multi_cell(0, 5, text)
    pdf.ln(1)


def build(path: Path, title: str, sections: list[tuple[str, str]]):
    pdf = LegalPdf()
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.add_font("DejaVu", "", FONT)
    pdf.add_font("DejaVu", "B", FONT_B)
    pdf.add_page()
    add_title(pdf, title)
    for heading, body in sections:
        h(pdf, heading)
        p(pdf, body)
    path.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(path))
    print("ok", path)


PRIVACY = [
    (
        "1. Responsable del tratamiento",
        "El responsable del tratamiento de los datos personales es Spa Kira Luxury (en adelante, “Spa Kira”), con operación en Bogotá, Colombia. Canal de contacto para habeas data y soporte: spakiraluxury@e-mac.co. Sitio web: https://spakira.e-mac.co.",
    ),
    (
        "2. Marco normativo",
        "Esta política se rige por la Constitución Política de Colombia (artículos 15 y 20), la Ley 1581 de 2012, el Decreto 1377 de 2013 y normas que los modifiquen; y, en lo pertinente, la Ley 1480 de 2011 (Estatuto del Consumidor). La autoridad de vigilancia es la Superintendencia de Industria y Comercio (SIC).",
    ),
    (
        "3. Datos que recolectamos",
        "Identificación y contacto (nombre, correo, teléfono); datos de mascotas y citas; datos de autenticación con Google (nombre, correo y foto de perfil) cuando usás Continuar con Google — no accedemos a Gmail ni a Drive; datos de Google Calendar solo si un miembro del personal autoriza expresamente esa integración; datos técnicos de navegación (IP, dispositivo, registros de error) para seguridad y operación.",
    ),
    (
        "4. Finalidades",
        "Crear y administrar la cuenta; agendar y prestar servicios de grooming; facturación y comunicaciones operativas; cumplimiento legal; seguridad de la plataforma; y, con autorización, comunicaciones comerciales.",
    ),
    (
        "5. Autorización y bases",
        "El tratamiento se fundamenta en tu autorización (al registrarte, iniciar sesión o aceptar estas políticas), en la ejecución del contrato de servicios y en el cumplimiento de deberes legales. Podés retirar la autorización en cualquier momento, sin perjuicio de las obligaciones ya ejecutadas.",
    ),
    (
        "6. Encargados y transferencias",
        "Podemos usar encargados tecnológicos (alojamiento en AWS, autenticación Google) bajo instrucciones y medidas de seguridad. Google LLC trata datos según sus propias políticas cuando usás OAuth. No vendemos bases de datos a terceros.",
    ),
    (
        "7. Derechos de los titulares (ARCO y habeas data)",
        "Podés conocer, actualizar, rectificar y suprimir tus datos, y revocar la autorización, escribiendo a spakiraluxury@e-mac.co con el asunto “Habeas data”. Responderemos en los plazos de la Ley 1581 de 2012. También podés acudir a la SIC.",
    ),
    (
        "8. Conservación y seguridad",
        "Conservamos los datos el tiempo necesario para las finalidades y las obligaciones legales (por ejemplo, fiscales). Aplicamos medidas razonables de acceso restringido, cifrado en tránsito (HTTPS) y control de cuentas.",
    ),
    (
        "9. Menores de edad",
        "El panel y el login no están dirigidos a menores de 18 años. No recolectamos datos de menores de forma intencional.",
    ),
    (
        "10. Cambios",
        "La versión vigente se publica en https://spakira.e-mac.co/privacidad y en este PDF. El uso continuado del sitio tras un cambio sustancial implica conocimiento de la nueva versión.",
    ),
]

TERMS = [
    (
        "1. Aceptación",
        "Estos términos regulan el uso del sitio https://spakira.e-mac.co y de los servicios de grooming de Spa Kira Luxury en Bogotá, Colombia. Al registrarte, iniciar sesión o agendar, aceptás estas condiciones y la Política de privacidad.",
    ),
    (
        "2. El servicio",
        "Spa Kira ofrece servicios de estética y cuidado para mascotas (baño, corte, deslanado y afines). La plataforma permite consultar información, gestionar citas y, para el personal, operar el panel administrativo. Los precios publicados pueden cambiar; rige el valor confirmado al agendar.",
    ),
    (
        "3. Cuentas y login con Google",
        "Sos responsable de la confidencialidad de tu cuenta. El botón Continuar con Google usa OAuth solo para identificar tu correo y nombre (login). La conexión de Google Calendar, si existe, es un permiso aparte y voluntario del personal. Spa Kira no garantiza la disponibilidad ininterrumpida de Google.",
    ),
    (
        "4. Citas, cancelaciones y mascotas",
        "El titular declara que la información de la mascota es veraz y que está autorizado a solicitar el servicio. Spa Kira puede rechazar o reprogramar una cita por razones de seguridad, salud animal o fuerza mayor. Las reglas de cancelación o no-show se comunican al agendar o en el local.",
    ),
    (
        "5. Consumidor",
        "Aplican las normas de protección al consumidor (Ley 1480 de 2011) en lo pertinente a la prestación del servicio en Colombia. Reclamos: spakiraluxury@e-mac.co.",
    ),
    (
        "6. Propiedad intelectual",
        "Marca, logo, textos y software de la plataforma son de Spa Kira o de sus licenciantes. No está permitido copiar, extraer o usar el sistema con fines distintos al servicio contratado.",
    ),
    (
        "7. Limitación",
        "La plataforma se ofrece “tal cual”. Spa Kira no responde por interrupciones de internet, de Google o de terceros, ni por daños indirectos, salvo dolo o culpa grave según la ley colombiana.",
    ),
    (
        "8. Ley y jurisdicción",
        "Estos términos se rigen por las leyes de la República de Colombia. Cualquier controversia se somete a los jueces de Bogotá, D.C., sin perjuicio de los mecanismos de protección al consumidor ante la SIC.",
    ),
    (
        "9. Contacto",
        "Spa Kira Luxury · Bogotá, Colombia · spakiraluxury@e-mac.co",
    ),
]


def main():
    build(OUT / "politica-privacidad.pdf", "Política de privacidad y tratamiento de datos personales", PRIVACY)
    build(OUT / "terminos-condiciones.pdf", "Términos y condiciones de uso", TERMS)


if __name__ == "__main__":
    main()
