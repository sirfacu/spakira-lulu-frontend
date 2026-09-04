import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2, Minus } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  getServiceMaterials,
  inventoryQuery,
  type InventoryItem,
  type ServiceMaterial,
} from "@/lib/spa-queries";
import {
  duplicateLiquidRoleMessage,
  inferMaterialRole,
  isLiquidMaterialRole,
} from "@/lib/service-material-role";

export type ServiceMaterialDraft = {
  key: string;
  material_role: string;
  inventory_item_id: string;
  reference_qty: string;
};

type Props = {
  serviceId: string | null;
  onChange: (materials: ServiceMaterialDraft[]) => void;
};

function newKey() {
  return `mat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function savedToDrafts(saved: ServiceMaterial[]): ServiceMaterialDraft[] {
  return saved.map((s) => ({
    key: newKey(),
    material_role: s.material_role === "towel" ? "accessory" : s.material_role,
    inventory_item_id: s.inventory_item_id ?? "",
    reference_qty:
      s.reference_qty != null && s.reference_qty > 0 ? String(s.reference_qty) : "",
  }));
}

function itemLabel(i: InventoryItem) {
  const desc = i.staff_description?.trim();
  return desc || i.name;
}

function isPieceAccessory(role: string) {
  return role === "accessory";
}

function QtyStepper({
  value,
  onChange,
  min = 1,
  max = 99,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) {
  const set = (n: number) => onChange(Math.min(max, Math.max(min, n)));
  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="h-8 w-8 shrink-0 rounded-lg"
        aria-label="Menos"
        disabled={value <= min}
        onClick={() => set(value - 1)}
      >
        <Minus className="h-3.5 w-3.5" />
      </Button>
      <Input
        type="number"
        min={min}
        max={max}
        className="h-8 w-14 rounded-lg px-1 text-center text-sm tabular-nums"
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) set(n);
        }}
      />
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="h-8 w-8 shrink-0 rounded-lg"
        aria-label="Más"
        disabled={value >= max}
        onClick={() => set(value + 1)}
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
      <span className="ml-1 text-xs text-muted-foreground">piezas / cita</span>
    </div>
  );
}

function ProductSearch({
  items,
  onPick,
  autoFocus,
}: {
  items: InventoryItem[];
  onPick: (item: InventoryItem) => void;
  autoFocus?: boolean;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const hits = useMemo(() => {
    const needle = stripAccents(q.trim());
    const sorted = [...items].sort((a, b) =>
      itemLabel(a).localeCompare(itemLabel(b), "es", { sensitivity: "base" }),
    );
    if (!needle) return sorted;
    return sorted.filter((i) => {
      const sku = stripAccents(i.sku ?? "");
      const name = stripAccents(i.name);
      const desc = stripAccents(i.staff_description ?? "");
      const cat = stripAccents(i.category ?? "");
      return (
        sku.includes(needle) ||
        name.includes(needle) ||
        desc.includes(needle) ||
        cat.includes(needle)
      );
    });
  }, [items, q]);

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
      setOpen(true);
    }
  }, [autoFocus]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative space-y-1">
      <Input
        ref={inputRef}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Buscar producto…"
        className="h-9 rounded-lg text-sm"
        autoComplete="off"
      />
      {open ? (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-border bg-background shadow-md">
          {hits.length === 0 ? (
            <li className="px-3 py-2 text-xs text-muted-foreground">Sin coincidencias</li>
          ) : (
            hits.map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-secondary/80"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onPick(i);
                    setQ("");
                    setOpen(false);
                  }}
                >
                  <span className="font-medium">{itemLabel(i)}</span>
                  {i.category ? (
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      {i.category}
                    </span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

export function ServiceMaterialsEditor({ serviceId, onChange }: Props) {
  const inventory = useQuery(inventoryQuery);
  const [rows, setRows] = useState<ServiceMaterialDraft[]>([]);
  const [adding, setAdding] = useState(false);

  // Catálogo completo del inventario (sin tope ni filtro de canal).
  const catalogItems = useMemo(() => inventory.data ?? [], [inventory.data]);

  const itemsById = useMemo(
    () => new Map(catalogItems.map((i) => [i.id, i])),
    [catalogItems],
  );

  const pushRows = (next: ServiceMaterialDraft[]) => {
    setRows(next);
    onChange(next.filter((r) => r.inventory_item_id && r.material_role));
  };

  useEffect(() => {
    if (!serviceId) {
      setRows([]);
      onChange([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const saved = await getServiceMaterials(serviceId);
        if (cancelled) return;
        const next = savedToDrafts(saved);
        setRows(next);
        onChange(next.filter((r) => r.inventory_item_id && r.material_role));
      } catch {
        if (!cancelled) {
          setRows([]);
          onChange([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [serviceId]);

  return (
    <section className="space-y-4 border-t border-border/70 pt-6">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Insumos de trabajo
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Incluye aqui los productos que requieres para generar una experiencia
          </p>
        </div>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-8 w-8 shrink-0 rounded-full"
          title="Agregar insumo"
          onClick={() => {
            setAdding(true);
            pushRows([
              ...rows,
              {
                key: newKey(),
                material_role: "shampoo",
                inventory_item_id: "",
                reference_qty: "",
              },
            ]);
          }}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
          Todavía no hay insumos. Usá + para agregar.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => {
            const item = row.inventory_item_id
              ? itemsById.get(row.inventory_item_id)
              : undefined;
            const isNew = !row.inventory_item_id;
            return (
              <div
                key={row.key}
                className="flex items-start gap-2 rounded-xl border border-border px-3 py-3"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  {isNew ? (
                    <ProductSearch
                      items={catalogItems}
                      autoFocus={adding}
                      onPick={(picked) => {
                        const role = inferMaterialRole(picked);
                        if (isLiquidMaterialRole(role)) {
                          const clash = rows.some(
                            (r) =>
                              r.key !== row.key &&
                              r.inventory_item_id &&
                              r.material_role === role,
                          );
                          if (clash) {
                            toast.error(duplicateLiquidRoleMessage(role));
                            return;
                          }
                        }
                        setAdding(false);
                        pushRows(
                          rows.map((r) =>
                            r.key === row.key
                              ? {
                                  ...r,
                                  inventory_item_id: picked.id,
                                  material_role: role,
                                  reference_qty: isPieceAccessory(role)
                                    ? r.reference_qty || "1"
                                    : "",
                                }
                              : r,
                          ),
                        );
                      }}
                    />
                  ) : (
                    <>
                      <p className="text-sm font-medium text-primary">
                        {item ? itemLabel(item) : "Producto no encontrado"}
                      </p>
                      {item?.dilution_enabled ? (
                        <p className="text-xs text-muted-foreground">
                          Dilución {item.dilution_product ?? 1}/{item.dilution_water ?? 1}
                        </p>
                      ) : null}
                      {isPieceAccessory(row.material_role) ? (
                        <div className="pt-1">
                          <QtyStepper
                            value={Math.max(1, Number(row.reference_qty) || 1)}
                            onChange={(n) =>
                              pushRows(
                                rows.map((r) =>
                                  r.key === row.key
                                    ? { ...r, reference_qty: String(n) }
                                    : r,
                                ),
                              )
                            }
                          />
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 shrink-0 text-destructive hover:text-destructive"
                  title="Quitar"
                  onClick={() => {
                    setAdding(false);
                    pushRows(rows.filter((r) => r.key !== row.key));
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function draftsToApiPayload(drafts: ServiceMaterialDraft[]): Partial<ServiceMaterial>[] {
  return drafts
    .filter((d) => d.inventory_item_id && d.material_role)
    .map((d, idx) => {
      const isAccessory = d.material_role === "accessory";
      const qty = Math.max(1, Number(d.reference_qty) || 1);
      return {
        material_role: isAccessory ? "accessory" : d.material_role,
        inventory_item_id: d.inventory_item_id,
        is_required: true,
        is_optional: false,
        // Accesorios: piezas fijas por cita. Líquidos: null → perfil de raza / dilución.
        reference_qty: isAccessory ? qty : null,
        sort_order: (idx + 1) * 10,
      };
    });
}
