/** Autocomplete de raza: digitar → opciones → elegir y se cierra. */

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { Breed } from "@/lib/spa-queries";

function breedThumb(b: Pick<Breed, "species" | "image_url" | "name">) {
  if (b.image_url) return b.image_url;
  return b.species === "gato" ? "/breeds/defaults/cat.svg" : "/breeds/defaults/dog.svg";
}

/** Preferí la ficha con foto / grupo si hay duplicados por nombre. */
function dedupeBreeds(options: Breed[]): Breed[] {
  const byName = new Map<string, Breed>();
  for (const b of options) {
    const key = b.name.trim().toLowerCase();
    const prev = byName.get(key);
    if (!prev) {
      byName.set(key, b);
      continue;
    }
    const score = (x: Breed) => (x.image_url ? 2 : 0) + (x.breed_group ? 1 : 0);
    if (score(b) > score(prev)) byName.set(key, b);
  }
  return [...byName.values()];
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

/** Digitar (≥3 letras) → lista corta → al elegir queda solo el nombre. */
export function BreedPickerList({
  value,
  onChange,
  options,
  className,
  disabled,
}: Props) {
  const unique = useMemo(() => dedupeBreeds(options), [options]);
  const selected = unique.find((b) => b.id === value) ?? options.find((b) => b.id === value);

  const [query, setQuery] = useState(selected?.name ?? "");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) setQuery(selected?.name ?? "");
  }, [selected?.name, selected?.id, open]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const q = query.trim().toLowerCase();
  const filtering = open && q.length >= 3;

  const visible = useMemo(() => {
    if (!filtering) return [];
    return unique
      .filter((b) => b.name.toLowerCase().includes(q))
      .slice(0, 12);
  }, [unique, filtering, q]);

  const pick = (id: string, name: string) => {
    onChange(id);
    setQuery(name);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <input
        type="text"
        disabled={disabled}
        value={query}
        autoComplete="off"
        placeholder="Escribí al menos 3 letras…"
        className="flex h-11 w-full rounded-xl border border-input bg-background px-3 pr-16 text-sm"
        aria-label="Buscar raza"
        aria-expanded={filtering}
        aria-autocomplete="list"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          setOpen(true);
          if (selected && next.trim().toLowerCase() !== selected.name.toLowerCase()) {
            onChange("");
          }
        }}
      />
      {value || query ? (
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
          onClick={() => {
            onChange("");
            setQuery("");
            setOpen(true);
          }}
        >
          Limpiar
        </button>
      ) : null}

      {filtering ? (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-input bg-card py-1 shadow-md"
        >
          <li>
            <button
              type="button"
              role="option"
              className="flex w-full px-3 py-2 text-left text-sm text-muted-foreground hover:bg-secondary/60"
              onClick={() => pick("", "")}
            >
              Sin raza
            </button>
          </li>
          {visible.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                role="option"
                aria-selected={value === b.id}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary/60",
                  value === b.id && "bg-primary/10 text-primary",
                )}
                onClick={() => pick(b.id, b.name)}
              >
                <img
                  src={breedThumb(b)}
                  alt=""
                  className="h-6 w-6 shrink-0 rounded-md object-cover"
                  loading="lazy"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src =
                      b.species === "gato"
                        ? "/breeds/defaults/cat.svg"
                        : "/breeds/defaults/dog.svg";
                  }}
                />
                <span className="truncate font-medium">{b.name}</span>
              </button>
            </li>
          ))}
          {!visible.length ? (
            <li className="px-3 py-3 text-center text-sm text-muted-foreground">
              Sin coincidencias
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
