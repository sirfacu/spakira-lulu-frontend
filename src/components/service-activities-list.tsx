import type { LucideIcon } from "lucide-react";
import { Check } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { activityIconComponent } from "@/lib/service-activity-icons";
import {
  serviceActivityCatalogQuery,
  type ServiceActivityCatalogItem,
} from "@/lib/spa-queries";

export function activityLabel(
  id: string,
  catalog: ServiceActivityCatalogItem[] | undefined,
): string {
  return catalog?.find((x) => x.id === id)?.label ?? id;
}

type ServiceActivitiesListProps = {
  activities?: string[] | null;
  catalog?: ServiceActivityCatalogItem[];
  className?: string;
  compact?: boolean;
};

export function ServiceActivitiesList({
  activities,
  catalog,
  className,
  compact = false,
}: ServiceActivitiesListProps) {
  const { data: fetchedCatalog = [] } = useQuery({
    ...serviceActivityCatalogQuery,
    enabled: !catalog?.length,
  });
  const items = catalog?.length ? catalog : fetchedCatalog;
  const byId = new Map(items.map((x) => [x.id, x]));
  const ids = (activities ?? []).filter((id) => byId.has(id));
  if (!ids.length) return null;

  return (
    <ul
      className={cn(
        "grid gap-3",
        compact ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2",
        className,
      )}
    >
      {ids.map((id) => {
        const meta = byId.get(id)!;
        const Icon: LucideIcon = activityIconComponent(meta.icon);
        return (
          <li key={id} className="flex items-center gap-3 text-sm text-foreground">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1 font-medium">{meta.label}</span>
            <span
              className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-mint/20 text-mint-foreground"
              aria-label="Incluido"
            >
              <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
            </span>
          </li>
        );
      })}
    </ul>
  );
}
