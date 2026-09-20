import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AppointmentWhatsAppItem = {
  owner_id?: string;
  full_name?: string | null;
  link: string;
};

type Props = {
  items: AppointmentWhatsAppItem[];
  missingNames?: string[];
  petName?: string | null;
  className?: string;
  loading?: boolean;
};

export function AppointmentWhatsAppBar({
  items,
  missingNames = [],
  petName,
  className,
  loading,
}: Props) {
  const petBit = petName ? ` de ${petName}` : "";
  return (
    <div className={cn("rounded-2xl border border-border bg-card p-4", className)}>
      <div className="flex items-start gap-3">
        <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          {loading && !items.length ? (
            <p className="text-sm text-muted-foreground">Buscando WhatsApp{petBit}…</p>
          ) : items.length ? (
            <>
              <p className="text-sm text-muted-foreground">
                WhatsApp al humano{petBit}. Abre el chat con un mensaje de la cita.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {items.map((wa) => (
                  <Button key={wa.link} asChild className="h-10 rounded-xl">
                    <a href={wa.link} target="_blank" rel="noopener noreferrer">
                      WhatsApp{wa.full_name ? ` · ${wa.full_name}` : ""}
                    </a>
                  </Button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No hay WhatsApp ni teléfono en la ficha{petBit}. Cargalo en Usuarios para poder
              chatear desde acá.
              {missingNames.length ? ` (${missingNames.join(", ")})` : ""}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
