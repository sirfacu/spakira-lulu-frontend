import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

type HealthEnv = {
  app_env?: string;
};

/**
 * Cinta solo en local (APP_ENV=local). En AWS no se muestra.
 * Altura fija h-9 + [data-env-banner] → --env-banner-height para que
 * sidebar/headers empiecen debajo y no tapen el logo.
 */
export function EnvBanner() {
  const q = useQuery({
    queryKey: ["health-env-banner"],
    queryFn: () => api<HealthEnv>("/health", { auth: false }),
    staleTime: 60_000,
    retry: 1,
  });

  const appEnv = (q.data?.app_env || "").trim().toLowerCase();
  if (appEnv !== "local") return null;

  return (
    <div
      data-env-banner=""
      role="status"
      className="sticky top-0 z-[100] flex h-9 w-full items-center justify-center bg-[#c9190b] px-3 text-center text-xs font-semibold tracking-wide text-white shadow-sm sm:text-sm"
    >
      Ambiente: DESARROLLO (local)
    </div>
  );
}
