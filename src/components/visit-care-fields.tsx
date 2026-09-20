import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cop } from "@/lib/format";
import {
  visitCareItems,
  visitCareSalePrice,
} from "@/lib/service-material-role";
import type { InventoryItem } from "@/lib/spa-queries";

export type VisitCareDraftLine = {
  inventory_item_id: string;
  name: string;
  quantity: string;
  unit_kind: string;
  unit_price: number;
};

export function visitCareCatalog(inventory: InventoryItem[], role: "medicated" | "dye") {
  return visitCareItems(inventory, role);
}

function RolePicker({
  title,
  hint,
  emptyHint,
  items,
  lines,
  onLines,
  declare,
}: {
  title: string;
  hint?: string;
  emptyHint: string;
  items: InventoryItem[];
  lines: VisitCareDraftLine[];
  onLines: (next: VisitCareDraftLine[]) => void;
  declare?: {
    value: boolean | null;
    onChange: (next: boolean) => void;
  };
}) {
  const [pick, setPick] = useState("");
  const shown = declare ? declare.value === true : true;

  const addItem = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    if (lines.some((l) => l.inventory_item_id === item.id)) return;
    onLines([
      ...lines,
      {
        inventory_item_id: item.id,
        name: item.name,
        quantity: "",
        unit_kind: item.unit_kind || "ml",
        unit_price: visitCareSalePrice(item),
      },
    ]);
  };

  return (
    <div className="space-y-2 rounded-2xl border border-border p-4">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {hint ? <p className="text-[12px] leading-snug text-muted-foreground">{hint}</p> : null}
      {declare ? (
        <div className="flex gap-2">
          <Button
            type="button"
            variant={declare.value === false ? "default" : "outline"}
            className="h-10 rounded-xl px-5"
            onClick={() => {
              declare.onChange(false);
              onLines([]);
            }}
          >
            No
          </Button>
          <Button
            type="button"
            variant={declare.value === true ? "default" : "outline"}
            className="h-10 rounded-xl px-5"
            onClick={() => declare.onChange(true)}
          >
            Sí
          </Button>
        </div>
      ) : null}
      {shown ? (
        items.length === 0 ? (
          <p className="rounded-xl bg-secondary/50 px-3 py-2 text-xs leading-snug text-muted-foreground">
            {emptyHint}
          </p>
        ) : (
          <div className="space-y-2">
            <select
              className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
              value={pick}
              onChange={(e) => {
                const id = e.target.value;
                setPick("");
                if (id) addItem(id);
              }}
            >
              <option value="">Agregar producto</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            {lines.map((line) => {
              const qty = Number(line.quantity);
              const preview = Number.isFinite(qty) && qty > 0 ? qty * line.unit_price : 0;
              return (
                <div
                  key={line.inventory_item_id}
                  className="grid grid-cols-1 gap-2 rounded-xl bg-secondary/40 p-3 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{line.name}</p>
                    {preview > 0 ? (
                      <p className="text-[11px] text-muted-foreground">
                        {cop(line.unit_price)} / {line.unit_kind} · {cop(preview)}
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">
                        {cop(line.unit_price)} / {line.unit_kind}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      className="h-10 min-w-0 flex-1 rounded-xl"
                      inputMode="decimal"
                      placeholder="Cantidad"
                      value={line.quantity}
                      onChange={(e) =>
                        onLines(
                          lines.map((l) =>
                            l.inventory_item_id === line.inventory_item_id
                              ? { ...l, quantity: e.target.value.replace(/[^\d.]/g, "") }
                              : l,
                          ),
                        )
                      }
                    />
                    <span className="w-8 shrink-0 text-xs text-muted-foreground">{line.unit_kind}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-10 justify-self-start px-3 sm:justify-self-end"
                    onClick={() =>
                      onLines(lines.filter((l) => l.inventory_item_id !== line.inventory_item_id))
                    }
                  >
                    Quitar
                  </Button>
                </div>
              );
            })}
          </div>
        )
      ) : null}
    </div>
  );
}

type DeclareProps = {
  inventory: InventoryItem[];
  medicated: boolean | null;
  colorimetry: boolean | null;
  medLines: VisitCareDraftLine[];
  dyeLines: VisitCareDraftLine[];
  onMedicated: (next: boolean) => void;
  onColorimetry: (next: boolean) => void;
  onMedLines: (next: VisitCareDraftLine[]) => void;
  onDyeLines: (next: VisitCareDraftLine[]) => void;
};

export function VisitCareDeclareFields({
  inventory,
  medicated,
  colorimetry,
  medLines,
  dyeLines,
  onMedicated,
  onColorimetry,
  onMedLines,
  onDyeLines,
}: DeclareProps) {
  const medItems = useMemo(() => visitCareCatalog(inventory, "medicated"), [inventory]);
  const dyeItems = useMemo(() => visitCareCatalog(inventory, "dye"), [inventory]);
  return (
    <div className="space-y-3">
      <RolePicker
        title="¿Usó medicado?"
        hint="Se puede agregar en cualquier servicio, no solo en los que lo tienen en la receta."
        emptyHint="No hay productos de categoría Medicado en inventario. Cargalos ahí para poder cobrarlos acá."
        items={medItems}
        lines={medLines}
        onLines={onMedLines}
        declare={{ value: medicated, onChange: onMedicated }}
      />
      <RolePicker
        title="¿Usó colorimetría?"
        hint="También va en baño normal u otro servicio si la mascota llega con tinte."
        emptyHint="No hay productos de categoría Tinte / colorimetría en inventario. Cargalos ahí para poder cobrarlos acá."
        items={dyeItems}
        lines={dyeLines}
        onLines={onDyeLines}
        declare={{ value: colorimetry, onChange: onColorimetry }}
      />
    </div>
  );
}

type AddProps = {
  inventory: InventoryItem[];
  disabled?: boolean;
  onAdd: (item: InventoryItem, quantity: number) => void;
};

export function VisitCareAddFields({ inventory, disabled, onAdd }: AddProps) {
  const medItems = useMemo(() => visitCareCatalog(inventory, "medicated"), [inventory]);
  const dyeItems = useMemo(() => visitCareCatalog(inventory, "dye"), [inventory]);
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground">Medicado y colorimetría</p>
      <p className="text-xs leading-snug text-muted-foreground">
        Se pueden cargar en cualquier servicio (baño normal incluido). Se cobran aparte, al
        precio de venta × cantidad.
      </p>
      <VisitCareQuickAdd
        label="Medicado"
        items={medItems}
        emptyHint="Sin productos Medicado en inventario."
        disabled={disabled}
        onAdd={onAdd}
      />
      <VisitCareQuickAdd
        label="Colorimetría"
        items={dyeItems}
        emptyHint="Sin productos Tinte / colorimetría en inventario."
        disabled={disabled}
        onAdd={onAdd}
      />
    </div>
  );
}

function VisitCareQuickAdd({
  label,
  items,
  emptyHint,
  disabled,
  onAdd,
}: {
  label: string;
  items: InventoryItem[];
  emptyHint: string;
  disabled?: boolean;
  onAdd: (item: InventoryItem, quantity: number) => void;
}) {
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("");
  const item = items.find((i) => i.id === itemId);
  const parsed = Number(qty);
  const ok = Boolean(item) && Number.isFinite(parsed) && parsed > 0;
  return (
    <div className="space-y-2 rounded-2xl border border-border p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyHint}</p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_auto] sm:items-end">
          <select
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
            value={itemId}
            disabled={disabled}
            onChange={(e) => setItemId(e.target.value)}
          >
            <option value="">Elegir producto</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
          <Input
            className="h-11 rounded-xl"
            inputMode="decimal"
            placeholder={item?.unit_kind || "ml"}
            value={qty}
            disabled={disabled || !itemId}
            onChange={(e) => setQty(e.target.value.replace(/[^\d.]/g, ""))}
          />
          <Button
            type="button"
            className="h-11 rounded-xl"
            disabled={disabled || !ok}
            onClick={() => {
              if (!item || !ok) return;
              onAdd(item, parsed);
              setItemId("");
              setQty("");
            }}
          >
            Agregar
          </Button>
        </div>
      )}
      {item && ok ? (
        <p className="text-[11px] text-muted-foreground">
          {cop(visitCareSalePrice(item))} / {item.unit_kind || "ml"} · {cop(visitCareSalePrice(item) * parsed)}
        </p>
      ) : null}
    </div>
  );
}
