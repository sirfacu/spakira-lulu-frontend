import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Empty } from "@/components/ui-kit";
import { api } from "@/lib/api";

const COPY = {
  agenda: {
    title: "Agenda",
    path: "/veterinary/agenda",
    empty: "Todavía no hay citas veterinarias.",
  },
  consultas: {
    title: "Consultas",
    path: "/veterinary/consults",
    empty: "Todavía no hay consultas.",
  },
  ordenes: {
    title: "Órdenes",
    path: "/veterinary/orders",
    empty: "Todavía no hay órdenes de examen.",
  },
} as const;

export function VeterinarySection({ seccion }: { seccion: keyof typeof COPY }) {
  const copy = COPY[seccion];
  const query = useQuery({
    queryKey: ["veterinary", seccion],
    queryFn: () => api<{ items: unknown[] }>(copy.path),
  });
  return (
    <AppShell title={copy.title}>
      {query.isError ? (
        <Empty message="No tenés acceso a esta sección." />
      ) : (
        <Empty message={query.isPending ? "Cargando." : copy.empty} />
      )}
    </AppShell>
  );
}
