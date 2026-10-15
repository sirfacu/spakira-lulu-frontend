/** Destino del alta al tocar "Nueva cita" según el chip de módulo. */
export type AgendaCreateKind = "spa" | "veterinary";

export function agendaCreateKind(
  modulo: "veterinary" | "todos" | undefined,
): AgendaCreateKind {
  return modulo === "veterinary" ? "veterinary" : "spa";
}

/** Search de agenda al limpiar deep-links, sin perder el chip activo. */
export function agendaSearchPreserveModulo(search: {
  google?: string;
  service?: string;
  pet?: string;
  modulo?: "veterinary" | "todos";
}): {
  google?: string;
  service?: string;
  pet?: string;
  modulo?: "veterinary" | "todos";
} {
  return {
    google: search.google,
    service: search.service,
    pet: search.pet,
    modulo: search.modulo,
  };
}
