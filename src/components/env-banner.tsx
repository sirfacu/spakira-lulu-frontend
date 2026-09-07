import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

type HealthEnv = {
  app_env?: string;
};

/**
 * Cinta fija solo en local (APP_ENV=local).
 * En AWS (dev/staging/production) no se muestra.
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
      role="status"
      className="sticky top-0 z-[100] w-full bg-[#c9190b] px-3 py-1.5 text-center text-xs font-semibold tracking-wide text-white shadow-sm sm:text-sm"
    >
      Ambiente: DESARROLLO (local)
    </div>
  );
}
