export type HomeModule = "spa" | "veterinary";

export function homeModuleChips(veterinaryOn: boolean): HomeModule[] {
  return veterinaryOn ? ["spa", "veterinary"] : ["spa"];
}

export function servicesForHomeModule<T extends { category?: string | null }>(
  services: T[],
  module: HomeModule,
): T[] {
  if (module === "veterinary") return services.filter((service) => service.category === "veterinary");
  return services.filter((service) => service.category !== "veterinary");
}
