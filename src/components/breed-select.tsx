/** Select / picker de raza con miniatura y búsqueda (desde 3 letras). */

import { useMemo, useState } from "react";
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
    </div>
  );
}

/** Lista custom con miniaturas + filtro por texto (≥3 letras). */
export function BreedPickerList({
  value,
  onChange,
  options,
  className,
}: Props) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtering = q.length >= 3;

  const visible = useMemo(() => {
    if (!filtering) return options;
    return options.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        (b.breed_group || "").toLowerCase().includes(q) ||
        (b.species || "").toLowerCase().includes(q),
    );
  }, [options, filtering, q]);

  const selected = options.find((b) => b.id === value);

  return (
    <div className={cn("space-y-2", className)}>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Escribí al menos 3 letras para filtrar…"
        className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
        aria-label="Buscar raza"
      />
      {selected ? (
        <p className="text-xs text-muted-foreground">
          Seleccionada: <span className="font-medium text-foreground">{selected.name}</span>
        </p>
      ) : null}
      {!filtering ? (
        <p className="text-[11px] text-muted-foreground">
          Podés elegir de la lista o filtrar escribiendo 3 o más letras.
        </p>
      ) : null}
      <div
        className="max-h-56 overflow-y-auto rounded-xl border border-input bg-background"
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
        {visible.map((b) => (
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
        {filtering && !visible.length ? (
          <p className="px-3 py-4 text-center text-sm text-muted-foreground">
            Ninguna raza coincide con “{query.trim()}”.
          </p>
        ) : null}
      </div>
    </div>
  );
}
