/** Dominios de correo personal / gratuito: no permiten “From” alias de marca. */
const CONSUMER_MAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "hotmail.es",
  "hotmail.co.uk",
  "outlook.com",
  "outlook.es",
  "live.com",
  "live.com.mx",
  "msn.com",
  "yahoo.com",
  "yahoo.es",
  "yahoo.com.mx",
  "ymail.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "gmx.com",
  "gmx.es",
  "mail.com",
  "zoho.com",
  "yandex.com",
  "yandex.ru",
]);

const MICROSOFT_PERSONAL_DOMAINS = new Set([
  "hotmail.com",
  "hotmail.es",
  "hotmail.co.uk",
  "outlook.com",
  "outlook.es",
  "live.com",
  "live.com.mx",
  "msn.com",
]);

const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

/** Extrae la dirección de "Nombre <correo@dom>" o un correo suelto. */
export function extractEmailAddress(value: string): string {
  const raw = (value || "").trim();
  if (!raw) return "";
  const angle = raw.match(/<([^>]+)>/);
  const candidate = (angle?.[1] || raw).trim().toLowerCase();
  return candidate.includes("@") ? candidate : "";
}

export function emailDomain(value: string): string {
  const email = extractEmailAddress(value);
  const at = email.lastIndexOf("@");
  return at >= 0 ? email.slice(at + 1) : "";
}

export function isConsumerMailDomain(domainOrEmail: string): boolean {
  const domain = domainOrEmail.includes("@")
    ? emailDomain(domainOrEmail)
    : (domainOrEmail || "").trim().toLowerCase();
  return !!domain && CONSUMER_MAIL_DOMAINS.has(domain);
}

/** Alias / remitente distinto solo tiene sentido en dominio propio (ej. e-mac.co). */
export function allowsFromAlias(accountEmail: string): boolean {
  const email = extractEmailAddress(accountEmail);
  if (!email) return true; // sin cuenta aún: no bloqueamos el campo
  return !isConsumerMailDomain(email);
}

/** Texto de ayuda según el proveedor (Hotmail vs Gmail vs otros). */
export function consumerMailHint(accountEmail: string): string | null {
  const domain = emailDomain(accountEmail);
  if (!domain) return null;
  if (MICROSOFT_PERSONAL_DOMAINS.has(domain)) {
    return (
      "Hotmail/Outlook personal ya no permiten enviar con usuario y contraseña desde apps. " +
      "No es un fallo del spa: Microsoft lo bloqueó. Usá un correo de tu dominio " +
      "(por ejemplo @e-mac.co) o Gmail con contraseña de aplicación."
    );
  }
  if (GMAIL_DOMAINS.has(domain)) {
    return (
      "Con Gmail funciona si activás la verificación en 2 pasos y usás una " +
      "«contraseña de aplicación» (no la contraseña normal de Google). " +
      "Servidor: smtp.gmail.com · puerto 587 · conexión segura activada."
    );
  }
  if (CONSUMER_MAIL_DOMAINS.has(domain)) {
    return (
      "Con cuentas personales el remitente tiene que ser la misma cuenta. " +
      "El alias solo se puede usar con un correo de tu dominio (por ejemplo @e-mac.co)."
    );
  }
  return null;
}
