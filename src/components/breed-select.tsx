/** Select de raza con miniatura. */

import { cn } from "@/lib/utils";
import type { Breed } from "@/lib/spa-queries";

function breedThumb(b: Pick<Breed, "species" | "image_url" | "name">) {
  if (b.image_url) return b.image_url;
  return b.species === "gato" ? "/breeds/defaults/cat.svg" : "/breeds/defaults/dog.svg";
}

type Props = {
  value: string;
  onChange: (breedId: string) => void;
  options: Breed[];
  className?: string;
  id?: string;
  disabled?: boolean;
};

export function BreedSelect({ value, onChange, options, className, id, disabled }: Props) {
  const selected = options.find((b) => b.id === value);
  return (
    <div className={cn("relative", className)}>
      {selected ? (
        <img
          src={breedThumb(selected)}
          alt=""
          className="pointer-events-none absolute left-3 top-1/2 z-10 h-6 w-6 -translate-y-1/2 rounded-md object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src =
              selected.species === "gato"
                ? "/breeds/defaults/cat.svg"
                : "/breeds/defaults/dog.svg";
          }}
        />
      ) : null}
      <select
        id={id}
        disabled={disabled}
        className={cn(
          "flex h-11 w-full rounded-xl border border-input bg-background text-sm",
          selected ? "pl-11 pr-3" : "px-3",
        )}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Sin raza</option>
        {options.map((b) => (
          <option key={b.id} value={b.id}>
            {b.species === "gato" ? "🐱 " : "🐶 "}
            {b.name}
          </option>
        ))}
      </select>
      {/* Lista visual auxiliar (nativo no muestra imgs en options en todos los browsers) */}
      {value && selected ? null : null}
    </div>
  );
}

/** Lista custom con miniaturas (mejor UX que &lt;option&gt;). */
export function BreedPickerList({
  value,
  onChange,
  options,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "max-h-56 overflow-y-auto rounded-xl border border-input bg-background",
        className,
      )}
      role="listbox"
      aria-label="Razas"
    >
      <button
        type="button"
        role="option"
        aria-selected={!value}
        className={cn(
          "flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-secondary/60",
          !value && "bg-primary/10 text-primary",
        )}
        onClick={() => onChange("")}
      >
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-muted text-xs">—</span>
        Sin raza
      </button>
      {options.map((b) => (
        <button
          key={b.id}
          type="button"
          role="option"
          aria-selected={value === b.id}
          className={cn(
            "flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-secondary/60",
            value === b.id && "bg-primary/10 text-primary",
          )}
          onClick={() => onChange(b.id)}
        >
          <img
            src={breedThumb(b)}
            alt=""
            className="h-8 w-8 rounded-lg object-cover"
            loading="lazy"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src =
                b.species === "gato" ? "/breeds/defaults/cat.svg" : "/breeds/defaults/dog.svg";
            }}
          />
          <span className="min-w-0 flex-1 truncate">
            <span className="block truncate font-medium">{b.name}</span>
            {b.breed_group ? (
              <span className="block truncate text-[11px] text-muted-foreground">
                {b.breed_group}
              </span>
            ) : (
              <span className="block text-[11px] capitalize text-muted-foreground">{b.species}</span>
            )}
          </span>
        </button>
      ))}
    </div>
  );
}
