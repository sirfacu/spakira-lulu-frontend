import { CalendarPlus, Clock } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ServiceActivitiesList } from "@/components/service-activities-list";
import {
  isPendingCatalogPrice,
  isVariableServicePrice,
  servicePriceHeadline,
  servicePriceLabel,
  servicePriceNote,
} from "@/lib/service-pricing";
import type { Service } from "@/lib/spa-queries";

type ServiceDetailDialogProps = {
  service: Service | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showAgendar?: boolean;
};

export function ServiceDetailDialog({
  service,
  open,
  onOpenChange,
  showAgendar = false,
}: ServiceDetailDialogProps) {
  const navigate = useNavigate();
  if (!service) return null;

  const variable = isVariableServicePrice(service);
  const note = servicePriceNote(service);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-3xl p-0">
        <div className="relative h-48 overflow-hidden bg-secondary">
          {service.image_url ? (
            <img
              src={service.image_url}
              alt={`Servicio ${service.name}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">
              Sin imagen
            </div>
          )}
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-card/90 px-2.5 py-1 text-[11px] font-medium text-primary backdrop-blur">
            <Clock className="h-3 w-3" /> {service.duration_min} min
          </span>
        </div>

        <div className="p-6">
          <h2 className="font-display text-2xl font-bold text-primary">{service.name}</h2>

          {service.description ? (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
              {service.description}
            </p>
          ) : null}

          <div className="mt-5 rounded-2xl border border-border/70 bg-secondary/35 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {isPendingCatalogPrice(service)
                ? "Valor"
                : variable
                  ? "Rango referencial"
                  : "Precio"}
            </p>
            <p className="mt-1 font-display text-2xl font-bold text-accent">
              {variable ? servicePriceLabel(service) : servicePriceHeadline(service)}
            </p>
            {note ? (
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{note}</p>
            ) : null}
          </div>

          {service.activities?.length ? (
            <div className="mt-6">
              <h3 className="font-display text-base font-bold text-primary">
                Lo que incluye este servicio
              </h3>
              <ServiceActivitiesList activities={service.activities} className="mt-4" />
            </div>
          ) : null}

          {showAgendar ? (
            <Button
              className="mt-6 h-11 w-full rounded-xl"
              onClick={() => {
                onOpenChange(false);
                void navigate({
                  to: "/panel/agenda",
                  search: { service: service.id, google: undefined },
                });
              }}
            >
              <CalendarPlus className="mr-2 h-4 w-4" /> Agendar
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
