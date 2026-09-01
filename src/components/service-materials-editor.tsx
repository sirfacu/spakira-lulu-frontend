import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getServiceMaterials,
  inventoryQuery,
  materialRolesQuery,
  type InventoryItem,
  type ServiceMaterial,
} from "@/lib/spa-queries";

export type ServiceMaterialDraft = {
  key: string;
  material_role: string;
  inventory_item_id: string;
  reference_qty: string;
  is_optional: boolean;
};

type Props = {
  serviceId: string | null;
  onChange: (materials: ServiceMaterialDraft[]) => void;
};

const LIQUID_ROLES = new Set(["shampoo", "conditioner", "medicated"]);
const ACCESSORY_ROLES = new Set(["accessory"]);

function normalizeMaterialRole(role: string) {
  return role === "towel" ? "accessory" : role;
}

function newKey() {
  return `mat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function savedToDrafts(saved: ServiceMaterial[]): ServiceMaterialDraft[] {
  return saved.map((s) => ({
    key: newKey(),
    material_role: normalizeMaterialRole(s.material_role),
    inventory_item_id: s.inventory_item_id ?? "",
    reference_qty:
      s.reference_qty != null && s.reference_qty > 0 ? String(s.reference_qty) : "",
    is_optional: Boolean(s.is_optional),
  }));
}

function filterInventory(items: InventoryItem[], q: string, role: string) {
  const needle = q.trim().toLowerCase();
  const byRole = items.filter((i) => inventoryMatchesRole(i, role));
  if (!needle) return byRole.slice(0, 12);
  return byRole
    .filter((i) => {
      const sku = (i.sku ?? "").toLowerCase();
      const name = i.name.toLowerCase();
      return sku.includes(needle) || name.includes(needle);
    })
    .slice(0, 12);
}

function inventoryMatchesRole(item: InventoryItem, role: string) {
  const cat = (item.category ?? "").toLowerCase();
  if (ACCESSORY_ROLES.has(role)) return cat.includes("accesorio");
  if (role === "shampoo") return cat.includes("shampoo") || cat === "baño";
  if (role === "conditioner") return cat.includes("acondicionador") || cat === "baño";
  if (role === "medicated") {
    return cat.includes("tratamiento") || cat.includes("medicado") || cat === "baño";
  }
  if (LIQUID_ROLES.has(role)) {
    return (
      cat.includes("shampoo") ||
      cat.includes("acondicionador") ||
      cat.includes("tratamiento") ||
      cat.includes("medicado") ||
      cat === "baño"
    );
  }
  return true;
}

function itemLabel(i: InventoryItem) {
  const sku = i.sku?.trim();
  return sku ? `${sku} · ${i.name}` : i.name;
}

function ProductSearch({
  items,
  role,
  onPick,
  autoFocus,
}: {
  items: InventoryItem[];
  role: string;
  onPick: (item: InventoryItem) => void;
  autoFocus?: boolean;
}) {
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const hits = useMemo(() => filterInventory(items, q, role), [items, q, role]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  return (
    <div className="relative space-y-1">
      <Input
        ref={inputRef}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por SKU o nombre…"
        className="h-9 rounded-lg text-sm"
      />
      {q.trim() ? (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-border bg-background shadow-md">
          {hits.length === 0 ? (
            <li className="px-3 py-2 text-xs text-muted-foreground">Sin coincidencias</li>
          ) : (
            hits.map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-secondary/80"
                  onClick={() => {
                    onPick(i);
                    setQ("");
                  }}
                >
                  <span className="font-mono text-xs text-muted-foreground">
                    {i.sku?.trim() || "—"}
                  </span>
                  <span className="ml-2">{i.name}</span>
                  {i.staff_description?.trim() ? (
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {i.staff_description.trim()}
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

function MaterialRow({
  row,
  idx,
  rows,
  roles,
  internalItems,
  itemsById,
  adding,
  pushRows,
  setAdding,
}: {
  row: ServiceMaterialDraft;
  idx: number;
  rows: ServiceMaterialDraft[];
  roles: { id: string; label: string; allows_optional?: boolean }[];
  internalItems: InventoryItem[];
  itemsById: Map<string, InventoryItem>;
  adding: boolean;
  pushRows: (next: ServiceMaterialDraft[]) => void;
  setAdding: (v: boolean) => void;
}) {
  const item = row.inventory_item_id ? itemsById.get(row.inventory_item_id) : undefined;
  const roleMeta = roles.find((r) => r.id === row.material_role);
  const isNewPick = !row.inventory_item_id;
  const isAccessory = ACCESSORY_ROLES.has(row.material_role);

  return (
    <div className="grid gap-2 rounded-xl border border-border px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div className="space-y-2">
        {isNewPick ? (
          <ProductSearch
            items={internalItems}
            role={row.material_role}
            autoFocus={idx === rows.length - 1 && adding}
            onPick={(picked) => {
              setAdding(false);
              pushRows(
                rows.map((r) =>
                  r.key === row.key ? { ...r, inventory_item_id: picked.id } : r,
                ),
              );
            }}
          />
        ) : (
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
            <span className="font-mono text-xs text-muted-foreground">
              {item?.sku?.trim() || "—"}
            </span>
            <span className="font-medium text-primary">{item?.name ?? "Producto"}</span>
            {item?.accessory_type ? (
              <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                {item.accessory_type}
              </span>
            ) : null}
          </div>
        )}

        {item?.staff_description?.trim() ? (
          <p className="text-xs text-muted-foreground">{item.staff_description.trim()}</p>
        ) : null}

        <div className="space-y-2">
          {!isAccessory ? (
            <div className="space-y-1">
              <Label className="text-xs">Tipo</Label>
              <Select
                value={row.material_role}
                onValueChange={(v) =>
                  pushRows(rows.map((r) => (r.key === row.key ? { ...r, material_role: v } : r)))
                }
              >
                <SelectTrigger className="h-9 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Los ml se calculan solos según la raza en agenda (sin cantidad manual).
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Accesorio incluido · 1 unidad</p>
          )}
        </div>

        {roleMeta?.allows_optional && !isAccessory ? (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={row.is_optional}
              onChange={(e) =>
                pushRows(
                  rows.map((r) =>
                    r.key === row.key ? { ...r, is_optional: e.target.checked } : r,
                  ),
                )
              }
            />
            Opcional al agendar (ej. medicado adicional)
          </label>
        ) : null}
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
}

export function ServiceMaterialsEditor({ serviceId, onChange }: Props) {
  const roles = useQuery(materialRolesQuery);
  const inventory = useQuery(inventoryQuery);
  const [rows, setRows] = useState<ServiceMaterialDraft[]>([]);
  const [adding, setAdding] = useState(false);

  const internalItems = useMemo(
    () =>
      (inventory.data ?? []).filter(
        (i) => i.channel === "interno" || i.channel === "interno_externo" || !i.channel,
      ),
    [inventory.data],
  );

  const itemsById = useMemo(
    () => new Map(internalItems.map((i) => [i.id, i])),
    [internalItems],
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

  const roleList = roles.data ?? [];
  const usedLiquidRoles = new Set(
    rows.map((r) => r.material_role).filter((role) => LIQUID_ROLES.has(role)),
  );

  const defaultRole = (preferAccessory = false) => {
    if (preferAccessory) return "accessory";
    for (const r of roleList) {
      if (LIQUID_ROLES.has(r.id) && !usedLiquidRoles.has(r.id)) return r.id;
    }
    return "accessory";
  };

  const liquidRows = rows.filter((r) => LIQUID_ROLES.has(r.material_role));
  const accessoryRows = rows.filter(
    (r) => normalizeMaterialRole(r.material_role) === "accessory",
  );

  const addRow = (preferAccessory: boolean) => {
    setAdding(true);
    pushRows([
      ...rows,
      {
        key: newKey(),
        material_role: defaultRole(preferAccessory),
        inventory_item_id: "",
        reference_qty: "",
        is_optional: false,
      },
    ]);
  };

  return (
    <section className="space-y-4 border-t border-border/70 pt-6">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Insumos del servicio
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
            Líquidos: ml automáticos por raza en agenda. Accesorios: 1 unidad incluida, filtrados por sexo.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-medium text-primary">Líquidos (baño)</h4>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-8 w-8 shrink-0 rounded-full"
            title="Agregar líquido"
            onClick={() => addRow(false)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {liquidRows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
            Shampoo, acondicionador o medicado opcional.
          </p>
        ) : (
          liquidRows.map((row) => {
            const idx = rows.findIndex((r) => r.key === row.key);
            return (
              <MaterialRow
                key={row.key}
                row={row}
                idx={idx}
                rows={rows}
                roles={roleList.filter((r) => LIQUID_ROLES.has(r.id))}
                internalItems={internalItems}
                itemsById={itemsById}
                adding={adding}
                pushRows={pushRows}
                setAdding={setAdding}
              />
            );
          })
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-medium text-primary">Accesorios incluidos</h4>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-8 w-8 shrink-0 rounded-full"
            title="Agregar accesorio"
            onClick={() => addRow(true)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {accessoryRows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
            Pañoletas, moños, gemas… categoría Accesorios en inventario.
          </p>
        ) : (
          accessoryRows.map((row) => {
            const idx = rows.findIndex((r) => r.key === row.key);
            return (
              <MaterialRow
                key={row.key}
                row={row}
                idx={idx}
                rows={rows}
                roles={roleList.filter((r) => r.id === "accessory")}
                internalItems={internalItems}
                itemsById={itemsById}
                adding={adding}
                pushRows={pushRows}
                setAdding={setAdding}
              />
            );
          })
        )}
      </div>
    </section>
  );
}

export function draftsToApiPayload(drafts: ServiceMaterialDraft[]): Partial<ServiceMaterial>[] {
  return drafts
    .filter((d) => d.inventory_item_id && d.material_role)
    .map((d, idx) => {
      const isAccessory = normalizeMaterialRole(d.material_role) === "accessory";
      return {
        material_role: isAccessory ? "accessory" : d.material_role,
        inventory_item_id: d.inventory_item_id,
        is_required: !d.is_optional,
        is_optional: d.is_optional,
        reference_qty: isAccessory ? 1 : null,
        sort_order: (idx + 1) * 10,
      };
    });
}
