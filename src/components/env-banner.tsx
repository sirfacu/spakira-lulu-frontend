import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

type HealthEnv = {
  app_env?: string;
  env_banner?: boolean;
};

const LABELS: Record<string, string> = {
  local: "DESARROLLO (local)",
  dev: "DESARROLLO",
  development: "DESARROLLO",
  staging: "PRUEBAS",
  stage: "PRUEBAS",
  production: "PRODUCCIÓN",
  prod: "PRODUCCIÓN",
};

function labelFor(appEnv: string): string {
  const key = appEnv.trim().toLowerCase();
  return LABELS[key] || appEnv.toUpperCase();
}

/**
 * Cinta fija fuera de producción (estilo consolas ops).
 * Fuente de verdad: APP_ENV (+ SHOW_ENV_BANNER) vía GET /health.
 */
export function EnvBanner() {
  const q = useQuery({
    queryKey: ["health-env-banner"],
    queryFn: () => api<HealthEnv>("/health", { auth: false }),
    staleTime: 60_000,
    retry: 1,
  });

  const appEnv = (q.data?.app_env || "").trim();
  const show = Boolean(q.data?.env_banner) && Boolean(appEnv);
  if (!show) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-[100] w-full bg-[#c9190b] px-3 py-1.5 text-center text-xs font-semibold tracking-wide text-white shadow-sm sm:text-sm"
    >
      Ambiente: {labelFor(appEnv)}
    </div>
  );
}
