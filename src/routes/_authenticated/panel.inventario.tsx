import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Search,
  AlertTriangle,
  CalendarX,
  Coins,
  Plus,
  Eye,
  EyeOff,
  Trash2,
  X,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatCard, Empty, StatusPill } from "@/components/ui-kit";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  createInventoryCategory,
  createInventoryItem,
  createInventoryMove,
  deleteInventoryItem,
  inventoryCategoriesQuery,
  inventoryMovementsQuery,
  inventoryQuery,
  inventorySummaryQuery,
  patchInventoryItem,
  type InventoryItem,
} from "@/lib/spa-queries";
import { cop } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  inventoryChannelBadgeClass,
  inventoryChannelFormLabel,
  inventoryChannelLabel,
  isShoppable,
} from "@/lib/inventory-channel";
import {
  formatKardexWhen,
  KARDEX_HELP,
  kardexActionLabel,
  kardexActor,
  kardexBalanceLabel,
} from "@/lib/inventory-kardex";
import { requirePathAccess } from "@/lib/route-access";

export const Route = createFileRoute("/_authenticated/panel/inventario")({
  beforeLoad: requirePathAccess("/panel/inventario"),
  head: () => ({
    meta: [
      { title: "Inventario | Spa Kira" },
      {
        name: "description",
        content: "Control de productos del spa: stock, mínimos, costos, precios y vencimientos.",
      },
      { property: "og:title", content: "Inventario | Spa Kira" },
      { property: "og:description", content: "Control de stock y valor del inventario." },
    ],
  }),
  component: Inventario,
});

const PREFERRED_CATEGORY_ORDER = ["Baño", "Alimentos", "Equipamientos", "Salud", "Accesorios"];

const CHANNEL_OPTIONS = ["interno", "interno_externo", "externo"] as const;

type ItemForm = {
  name: string;
  category: string;
  barcode: string;
  staff_description: string;
  sell_by_shoot: boolean;
  /** Mínimo en unidades/envases (UI); al guardar se convierte a contenido si aplica. */
  units_qty: string;
  min_stock: string;
  purchase_price: string;
  sale_price: string;
  unit_kind: string;
  pack_size: string;
  channel: string;
  dilution_enabled: boolean;
  dilution_product: string;
  dilution_water: string;
  wear_every_n_uses: string;
};

const emptyForm = (): ItemForm => ({
  name: "",
  category: "",
  barcode: "",
  staff_description: "",
  sell_by_shoot: false,
  units_qty: "0",
  min_stock: "0",
  purchase_price: "0",
  sale_price: "0",
  unit_kind: "unidad",
  pack_size: "1",
  channel: "interno",
  dilution_enabled: false,
  dilution_product: "1",
  dilution_water: "10",
  wear_every_n_uses: "",
});

function isVolumeUnit(unitKind: string): boolean {
  const k = unitKind.toLowerCase();
  return k === "ml" || k === "g" || k === "l";
}

function isPackUnit(unitKind: string): boolean {
  return unitKind.toLowerCase() === "pack";
}

/** Cantidad de presentación (envases / packs / piezas) según unit_kind. */
function packagesOf(i: InventoryItem): number {
  if (i.packages_on_hand != null && Number.isFinite(Number(i.packages_on_hand))) {
    return Number(i.packages_on_hand);
  }
  const qty = Number(i.quantity) || 0;
  const kind = i.unit_kind ?? "unidad";
  // ml/g/l y pack: quantity en BD = contenido/piezas totales
  if (isVolumeUnit(kind) || isPackUnit(kind)) {
    const pack = Number(i.pack_size) || 1;
    return pack > 0 ? qty / pack : qty;
  }
  return qty;
}

function minStockAsUnits(i: InventoryItem): number {
  const min = Number(i.min_stock) || 0;
  const kind = i.unit_kind ?? "unidad";
  if (isVolumeUnit(kind) || isPackUnit(kind)) {
    const pack = Number(i.pack_size) || 1;
    return pack > 0 ? min / pack : min;
  }
  return min;
}

function storesTotalContent(unitKind: string): boolean {
  return isVolumeUnit(unitKind) || isPackUnit(unitKind);
}

function presentationWord(unitKind: string, n: number): string {
  const k = unitKind.toLowerCase();
  if (k === "pack") return n === 1 ? "pack" : "packs";
  if (isVolumeUnit(k)) return n === 1 ? "envase" : "envases";
  return n === 1 ? "pieza" : "piezas";
}

/** Evita basura float (0.99975) y deja 0–1 decimal útil. */
function niceQty(n: number, maxDecimals = 1): number {
  if (!Number.isFinite(n)) return 0;
  const f = 10 ** maxDecimals;
  const rounded = Math.round(n * f) / f;
  if (Math.abs(rounded - Math.round(rounded)) < 0.05 / f) return Math.round(rounded);
  return rounded;
}

function formatContentQty(qty: number, unitKind: string): string {
  const k = unitKind.toLowerCase();
  const n = niceQty(qty, k === "l" ? 3 : 1);
  if (k === "ml") return `${n} ml`;
  if (k === "g") return `${n} g`;
  if (k === "l") return `${n} L`;
  return String(n);
}

function formatPackagesLabel(packs: number, unitKind: string): string {
  const n = niceQty(packs, 2);
  return `${n} ${presentationWord(unitKind, n)}`;
}

/** Texto claro de stock para listado / editor (cubre unidad, pack y líquidos). */
function stockSummary(i: InventoryItem): { primary: string; detail?: string } {
  const kind = (i.unit_kind ?? "unidad").toLowerCase();
  const packs = packagesOf(i);
  const packSize = Number(i.pack_size) || 1;
  const content = Number(i.quantity) || 0;

  if (isVolumeUnit(kind)) {
    return {
      primary: `${formatContentQty(content, kind)} disponibles`,
      detail:
        packSize > 0
          ? `${formatPackagesLabel(packs, kind)} · ${formatContentQty(packSize, kind)} c/u`
          : formatPackagesLabel(packs, kind),
    };
  }
  if (isPackUnit(kind) && packSize > 1) {
    const pieces = niceQty(content, 0);
    return {
      primary: formatPackagesLabel(packs, kind),
      detail: `${pieces} piezas en total (${niceQty(packSize, 0)} por pack)`,
    };
  }
  return { primary: formatPackagesLabel(packs, kind) };
}

function formatAvailableCell(i: InventoryItem): string {
  const kind = (i.unit_kind ?? "unidad").toLowerCase();
  const availContent = Number(i.available ?? i.quantity) || 0;
  if (isVolumeUnit(kind)) {
    return formatContentQty(availContent, kind);
  }
  const availPacks = storesTotalContent(kind)
    ? packagesOf({
        ...i,
        quantity: availContent,
        packages_on_hand: undefined,
      })
    : availContent;
  return formatPackagesLabel(availPacks, kind);
}

function formatReservedCell(i: InventoryItem): string {
  const kind = (i.unit_kind ?? "unidad").toLowerCase();
  const reserved = Number(i.reserved) || 0;
  if (isVolumeUnit(kind)) {
    return reserved > 0 ? formatContentQty(reserved, kind) : "0 ml";
  }
  return String(niceQty(reserved, 0));
}

function formatMinCell(i: InventoryItem): string {
  const kind = (i.unit_kind ?? "unidad").toLowerCase();
  const min = Number(i.min_stock) || 0;
  if (isVolumeUnit(kind)) {
    return formatContentQty(min, kind);
  }
  return formatPackagesLabel(minStockAsUnits(i), kind);
}

function measureFieldCopy(unitKind: string): {
  packLabel: string;
  packHelp: string;
  qtyLabel: string;
  qtyHelp: string;
} {
  if (isVolumeUnit(unitKind)) {
    const u = doseUnitLabel(unitKind);
    return {
      packLabel: "Contenido por envase",
      packHelp: `Cuánto trae cada envase (${u})`,
      qtyLabel: "Cantidad de envases",
      qtyHelp: "Cuántos envases tenés en stock",
    };
  }
  if (isPackUnit(unitKind)) {
    return {
      packLabel: "Piezas por pack",
      packHelp: "Cuántas piezas vienen en cada pack o caja",
      qtyLabel: "Cantidad de packs",
      qtyHelp: "Cuántos packs o cajas tenés",
    };
  }
  return {
    packLabel: "Piezas por unidad",
    packHelp: "Normalmente 1 (una unidad = una pieza)",
    qtyLabel: "Cantidad (piezas)",
    qtyHelp: "Cuántas piezas sueltas tenés",
  };
}

function doseUnitLabel(unitKind: string): string {
  const k = unitKind.toLowerCase();
  if (k === "ml") return "ml";
  if (k === "g") return "g";
  if (k === "l") return "l";
  if (k === "pack") return "piezas";
  return "unidades";
}

function toForm(i: InventoryItem): ItemForm {
  return {
    name: i.name,
    category: i.category ?? "",
    barcode: i.barcode ?? "",
    staff_description: i.staff_description ?? "",
    sell_by_shoot: Boolean(i.sell_by_shoot),
    units_qty: String(packagesOf(i)),
    min_stock: String(minStockAsUnits(i)),
    purchase_price: String(i.purchase_price ?? 0),
    sale_price: String(i.sale_price ?? 0),
    unit_kind: i.unit_kind ?? "unidad",
    pack_size: String(i.pack_size ?? 1),
    channel: i.channel ?? "interno",
    dilution_enabled: Boolean(i.dilution_enabled),
    dilution_product: i.dilution_product != null ? String(i.dilution_product) : "1",
    dilution_water: i.dilution_water != null ? String(i.dilution_water) : "10",
    wear_every_n_uses:
      i.wear_every_n_uses != null && Number(i.wear_every_n_uses) > 0
        ? String(i.wear_every_n_uses)
        : "",
  };
}

function nextExpiry(i: InventoryItem): string | null {
  const raw = i.next_expires_at || i.expires_at;
  return raw ? String(raw).slice(0, 10) : null;
}

function orderCategories(names: string[]): string[] {
  const used = new Set<string>();
  const result: string[] = [];
  for (const pref of PREFERRED_CATEGORY_ORDER) {
    const match = names.find((n) => n.toLowerCase() === pref.toLowerCase());
    if (match) {
      result.push(match);
      used.add(match.toLowerCase());
    }
  }
  const rest = names
    .filter((n) => !used.has(n.toLowerCase()))
    .sort((a, b) => a.localeCompare(b, "es"));
  return [...result, ...rest];
}

function isBanioCategory(category: string): boolean {
  const c = category.trim().toLowerCase();
  return c.includes("banio") || c.includes("baño");
}

function Inventario() {
  const qc = useQueryClient();
  const inv = useQuery(inventoryQuery);
  const invSummary = useQuery(inventorySummaryQuery);
  const cats = useQuery(inventoryCategoriesQuery);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<InventoryItem | "new" | null>(null);
  const [form, setForm] = useState<ItemForm>(emptyForm());
  const [moveDelta, setMoveDelta] = useState("1");
  const [moveKind, setMoveKind] = useState<"compra" | "merma" | "ajuste">("compra");
  const [moveHasExpiry, setMoveHasExpiry] = useState(false);
  const [moveExpires, setMoveExpires] = useState("");
  const [movePage, setMovePage] = useState(0);
  const [newCategory, setNewCategory] = useState("");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [costOpen, setCostOpen] = useState<Record<string, boolean>>({});
  const [pendingDelete, setPendingDelete] = useState<InventoryItem | null>(null);
  const selectedId = editing && editing !== "new" ? editing.id : null;
  const moves = useQuery(inventoryMovementsQuery(selectedId, movePage));

  useEffect(() => {
    setMovePage(0);
  }, [selectedId]);

  const items = (inv.data ?? []).filter((i) =>
    `${i.name} ${i.category ?? ""}`.toLowerCase().includes(q.toLowerCase()),
  );

  const liveItem = useMemo(() => {
    if (!selectedId) return null;
    return (inv.data ?? []).find((i) => i.id === selectedId) ?? (editing !== "new" ? editing : null);
  }, [inv.data, selectedId, editing]);

  const soon = new Date();
  soon.setMonth(soon.getMonth() + 3);
  const outOfStock = (inv.data ?? []).filter((i) => Number(i.available ?? i.quantity) === 0);
  const expiring = (inv.data ?? []).filter((i) => {
    const exp = nextExpiry(i);
    return exp && Number(i.quantity) > 0 && new Date(exp) <= soon;
  });
  const totalValue = invSummary.data?.total_cost_value ?? 0;

  const categoryOptions = useMemo(() => {
    const names = new Set((cats.data ?? []).map((c) => c.name));
    if (form.category && !names.has(form.category)) names.add(form.category);
    return orderCategories([...names]);
  }, [cats.data, form.category]);

  const showDosificacion = isBanioCategory(form.category) || form.sell_by_shoot;
  const shoppable = isShoppable(form.channel);
  const measureCopy = measureFieldCopy(form.unit_kind);
  const moveQtyLabel = isVolumeUnit(form.unit_kind)
    ? "Envases"
    : isPackUnit(form.unit_kind)
      ? "Packs"
      : "Piezas";

  const state = (q0: number, min: number) =>
    q0 === 0
      ? { label: "Agotado", className: "bg-destructive/12 text-destructive border-destructive/30" }
      : q0 <= min
        ? { label: "Stock bajo", className: "bg-gold/25 text-gold-foreground border-gold/50" }
        : { label: "Disponible", className: "bg-mint/25 text-mint-foreground border-mint/50" };

  const isStockIn =
    moveKind === "compra" || (moveKind === "ajuste" && Number(moveDelta) > 0);

  const saveMut = useMutation({
    mutationFn: async () => {
      const packSize = Number(form.pack_size) || 1;
      const unitsWanted = Math.max(0, Number(form.units_qty) || 0);
      const minUnits = Math.max(0, Number(form.min_stock) || 0);
      // BD: para ml/g/l y pack, quantity/min_stock = total (ml o piezas)
      const minStockStored = storesTotalContent(form.unit_kind)
        ? Math.round(minUnits * packSize)
        : minUnits;

      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        category: form.category.trim() || null,
        barcode: form.barcode.trim() || null,
        staff_description: form.staff_description.trim() || null,
        sell_by_shoot: form.sell_by_shoot,
        // La dosis (ml) sale del perfil de raza en agenda/mostrador, no del producto.
        portion_size: null,
        min_stock: minStockStored,
        purchase_price: Number(form.purchase_price) || 0,
        unit_kind: form.unit_kind,
        pack_size: packSize,
        pack_label: null,
        channel: form.channel,
        dilution_enabled: form.dilution_enabled,
        dilution_product:
          form.dilution_enabled && Number(form.dilution_product) > 0
            ? Number(form.dilution_product)
            : null,
        dilution_water:
          form.dilution_enabled && Number(form.dilution_water) > 0
            ? Number(form.dilution_water)
            : null,
        accessory_type: null,
        wear_every_n_uses:
          Number(form.wear_every_n_uses) > 0 ? Number(form.wear_every_n_uses) : null,
        wear_action: "alert",
      };

      if (shoppable) {
        payload.sale_price = Number(form.sale_price) || 0;
      }

      if (!payload.name) throw new Error("Poné un nombre");
      if (!payload.category) throw new Error("Elegí una categoría");

      if (editing === "new") {
        const initialQty = storesTotalContent(form.unit_kind)
          ? Math.round(unitsWanted * packSize)
          : unitsWanted;
        return createInventoryItem({
          ...payload,
          sku: null,
          shoot_markup: 1,
          quantity: initialQty,
        } as Parameters<typeof createInventoryItem>[0]);
      }
      if (editing && typeof editing === "object") {
        const patch = { ...payload } as Parameters<typeof patchInventoryItem>[1];
        if (editing.sku) patch.sku = editing.sku;
        patch.shoot_markup = 1;
        const saved = await patchInventoryItem(editing.id, patch);
        const currentUnits = packagesOf(saved);
        const deltaUnits = Math.round(unitsWanted - currentUnits);
        if (deltaUnits !== 0) {
          await createInventoryMove(editing.id, {
            delta: deltaUnits,
            kind: "ajuste",
            note: storesTotalContent(saved.unit_kind ?? form.unit_kind)
              ? "Ajuste de envases / packs"
              : "Ajuste de piezas",
          });
        }
        const pack = Number(saved.pack_size) || packSize;
        const qty = storesTotalContent(saved.unit_kind ?? form.unit_kind)
          ? unitsWanted * pack
          : unitsWanted;
        return {
          ...saved,
          quantity: qty,
          available: qty,
          packages_on_hand: unitsWanted,
          min_stock: minStockStored,
        };
      }
      throw new Error("Nada para guardar");
    },
    onSuccess: async (item) => {
      await qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Producto guardado");
      if (item) {
        setForm(toForm(item));
        setEditing(item);
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const catMut = useMutation({
    mutationFn: async () => {
      const name = newCategory.trim();
      if (!name) throw new Error("Escribí el nombre de la categoría");
      return createInventoryCategory(name);
    },
    onSuccess: async (row) => {
      await qc.invalidateQueries({ queryKey: ["inventory", "categories"] });
      setForm((f) => ({ ...f, category: row.name }));
      setNewCategory("");
      setShowNewCategory(false);
      toast.success("Categoría agregada");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const moveMut = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error("Guardá el producto primero");
      const n = Number(moveDelta);
      if (!n) throw new Error("Cantidad inválida");
      const signed =
        moveKind === "compra" ? Math.abs(n) : moveKind === "merma" ? -Math.abs(n) : n;
      if (signed > 0 && moveHasExpiry && !moveExpires) {
        throw new Error("Indicá la fecha de caducidad de este ingreso");
      }
      return createInventoryMove(selectedId, {
        delta: signed,
        kind: moveKind,
        expires_at: signed > 0 && moveHasExpiry ? moveExpires : null,
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["inventory"] });
      await qc.invalidateQueries({ queryKey: ["inventory", selectedId, "movements"] });
      setMoveHasExpiry(false);
      setMoveExpires("");
      toast.success("Existencias actualizadas");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteInventoryItem(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["inventory"] });
      setPendingDelete(null);
      setEditing(null);
      toast.success("Producto eliminado");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const moveItems = moves.data?.items ?? [];
  const moveTotal = moves.data?.total ?? 0;
  const moveLimit = moves.data?.limit ?? 20;
  const moveOffset = moves.data?.offset ?? movePage * 20;
  const moveHasPrev = moveOffset > 0;
  const moveHasNext = moveOffset + moveItems.length < moveTotal;

  const closeEditor = () => {
    setEditing(null);
    setShowNewCategory(false);
  };

  return (
    <AppShell title="Inventario" subtitle={`${items.length} productos · historial de existencias`}>
      <div className="mb-4 flex justify-end">
        <Button
          className="rounded-xl"
          onClick={() => {
            setForm(emptyForm());
            setShowNewCategory(false);
            setEditing("new");
          }}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Producto
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={AlertTriangle} label="Productos agotados" value={outOfStock.length} tone="accent" />
        <StatCard icon={CalendarX} label="Productos por vencer" value={expiring.length} tone="gold" />
        <StatCard icon={Coins} label="Valor total del inventario" value={cop(totalValue)} tone="primary" />
      </div>

      <div className="card-soft mt-6 flex items-center gap-3 p-4">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar producto o categoría…"
          className="h-10 rounded-xl border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
        />
      </div>

      <div className={cn("mt-6 grid gap-6", editing && "lg:grid-cols-2")}>
        <div className="card-soft overflow-hidden">
          <div className="max-h-[min(70vh,720px)] overflow-auto">
            <table className="w-full min-w-[980px] border-separate border-spacing-0 text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="border-b border-border bg-secondary px-5 py-3.5 font-semibold">Producto</th>
                  <th className="border-b border-border bg-secondary px-5 py-3.5 font-semibold">Categoría</th>
                  <th className="border-b border-border bg-secondary px-5 py-3.5 font-semibold">Uso</th>
                  <th className="border-b border-border bg-secondary px-5 py-3.5 font-semibold">Stock</th>
                  <th className="border-b border-border bg-secondary px-5 py-3.5 font-semibold">Reservado</th>
                  <th className="border-b border-border bg-secondary px-5 py-3.5 font-semibold">Disponible</th>
                  <th
                    className="border-b border-border bg-secondary px-5 py-3.5 font-semibold"
                    title="Mínimo en presentación (packs / envases / piezas)"
                  >
                    Mínimo
                  </th>
                  <th className="border-b border-border bg-secondary px-5 py-3.5 font-semibold">Costo</th>
                  <th className="border-b border-border bg-secondary px-5 py-3.5 font-semibold">Precio venta</th>
                  <th className="border-b border-border bg-secondary px-5 py-3.5 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => {
                  const units = packagesOf(i);
                  const minUnits = minStockAsUnits(i);
                  const st = state(units, minUnits);
                  const exp = nextExpiry(i);
                  const showCost = !!costOpen[i.id];
                  const selected = selectedId === i.id;
                  const stock = stockSummary(i);
                  return (
                    <tr
                      key={i.id}
                      className={cn(
                        "cursor-pointer hover:bg-secondary/40",
                        selected && "bg-primary/10 ring-1 ring-inset ring-primary/25",
                      )}
                      onClick={() => {
                        setForm(toForm(i));
                        setShowNewCategory(false);
                        setEditing(i);
                      }}
                    >
                      <td className="border-b border-border/60 px-5 py-3.5">
                        <div className="flex min-w-0 items-center gap-3">
                          {i.photo_url ? (
                            <img
                              src={i.photo_url}
                              alt={i.name}
                              loading="lazy"
                              className="h-11 w-11 shrink-0 rounded-xl object-cover"
                            />
                          ) : null}
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">{i.name}</p>
                            {i.wear_alert_pending ? (
                              <p className="text-xs font-medium text-destructive">Merma / aviso pendiente</p>
                            ) : null}
                            {exp ? (
                              <p className="text-xs text-muted-foreground">Próximo vencimiento {exp}</p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="border-b border-border/60 px-5 py-3.5 text-muted-foreground">{i.category}</td>
                      <td className="border-b border-border/60 px-5 py-3.5">
                        <StatusPill
                          label={inventoryChannelLabel(i.channel)}
                          className={inventoryChannelBadgeClass(i.channel)}
                        />
                      </td>
                      <td className="border-b border-border/60 px-5 py-3.5 font-semibold text-foreground">
                        <span className="tabular-nums">{stock.primary}</span>
                        {stock.detail ? (
                          <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                            {stock.detail}
                          </span>
                        ) : null}
                      </td>
                      <td className="border-b border-border/60 px-5 py-3.5 text-muted-foreground tabular-nums">
                        {formatReservedCell(i)}
                      </td>
                      <td className="border-b border-border/60 px-5 py-3.5 font-semibold text-foreground">
                        <span className="tabular-nums">{formatAvailableCell(i)}</span>
                      </td>
                      <td className="border-b border-border/60 px-5 py-3.5 text-muted-foreground tabular-nums">
                        {formatMinCell(i)}
                      </td>
                      <td className="border-b border-border/60 px-5 py-3.5 text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <span className="tabular-nums">{showCost ? cop(i.purchase_price) : "******"}</span>
                          <button
                            type="button"
                            className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                            aria-label={showCost ? "Ocultar costo" : "Ver costo"}
                            onClick={(e) => {
                              e.stopPropagation();
                              setCostOpen((prev) => ({ ...prev, [i.id]: !prev[i.id] }));
                            }}
                          >
                            {showCost ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </td>
                      <td className="border-b border-border/60 px-5 py-3.5 font-medium text-accent">
                        {isShoppable(i.channel) ? cop(i.sale_price) : "—"}
                      </td>
                      <td className="border-b border-border/60 px-5 py-3.5">
                        <StatusPill label={st.label} className={st.className} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!items.length ? <Empty message="Sin productos que coincidan." /> : null}
        </div>

        {editing ? (
          <div className="card-soft max-h-[min(90vh,900px)] overflow-y-auto p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold">
                {editing === "new" ? "Nuevo producto" : "Editar producto"}
              </h2>
              <Button variant="ghost" size="icon" className="shrink-0 rounded-xl" onClick={closeEditor}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-4 grid gap-3">
              <div className="space-y-1">
                <Label>Nombre</Label>
                <Input
                  className="h-11 rounded-xl"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <Label>Descripción</Label>
                <Textarea
                  className="min-h-[4.5rem] rounded-xl"
                  value={form.staff_description}
                  onChange={(e) => setForm((f) => ({ ...f, staff_description: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <Label>Categoría</Label>
                <select
                  className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                  value={showNewCategory ? "__new__" : form.category}
                  onChange={(e) => {
                    if (e.target.value === "__new__") {
                      setShowNewCategory(true);
                      return;
                    }
                    setShowNewCategory(false);
                    setForm((f) => ({ ...f, category: e.target.value }));
                  }}
                >
                  <option value="">Elegí una categoría</option>
                  {categoryOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                  <option value="__new__">+ Nueva categoría</option>
                </select>
                {showNewCategory ? (
                  <div className="flex gap-2 pt-1">
                    <Input
                      className="h-11 rounded-xl"
                      placeholder="Nombre de la categoría"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 shrink-0 rounded-xl"
                      disabled={catMut.isPending}
                      onClick={() => catMut.mutate()}
                    >
                      Agregar
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className="space-y-1">
                <Label>Código de barras</Label>
                <Input
                  className="h-11 rounded-xl"
                  value={form.barcode}
                  onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label>Medida</Label>
                  <select
                    className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                    value={form.unit_kind}
                    onChange={(e) => setForm((f) => ({ ...f, unit_kind: e.target.value }))}
                  >
                    <option value="unidad">Pieza suelta</option>
                    <option value="pack">Pack / caja</option>
                    <option value="ml">Mililitros (ml)</option>
                    <option value="g">Gramos (g)</option>
                    <option value="l">Litros (l)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>{measureCopy.packLabel}</Label>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    className="h-11 rounded-xl"
                    value={form.pack_size}
                    onChange={(e) => setForm((f) => ({ ...f, pack_size: e.target.value }))}
                  />
                  <p className="text-[11px] text-muted-foreground">{measureCopy.packHelp}</p>
                </div>
                <div className="space-y-1">
                  <Label>{measureCopy.qtyLabel}</Label>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    className="h-11 rounded-xl"
                    value={form.units_qty}
                    onChange={(e) => setForm((f) => ({ ...f, units_qty: e.target.value }))}
                  />
                  <p className="text-[11px] text-muted-foreground">{measureCopy.qtyHelp}</p>
                </div>
              </div>
              {Number(form.units_qty) > 0 && Number(form.pack_size) > 0 && isVolumeUnit(form.unit_kind) ? (
                <p className="text-xs text-muted-foreground">
                  Total: {Number(form.units_qty)} envases × {form.pack_size}{" "}
                  {doseUnitLabel(form.unit_kind)} ={" "}
                  {formatContentQty(
                    Number(form.units_qty) * Number(form.pack_size),
                    form.unit_kind,
                  )}
                </p>
              ) : null}
              {Number(form.units_qty) > 0 &&
              Number(form.pack_size) > 0 &&
              isPackUnit(form.unit_kind) ? (
                <p className="text-xs text-muted-foreground">
                  Total: {Number(form.units_qty)} packs × {form.pack_size} piezas ={" "}
                  {Number(form.units_qty) * Number(form.pack_size)} piezas
                </p>
              ) : null}

              {showDosificacion ? (
                <div className="space-y-2 rounded-xl border border-border/80 bg-secondary/20 p-4">
                  <label className="flex cursor-pointer items-center gap-3">
                    <Checkbox
                      checked={form.sell_by_shoot}
                      onCheckedChange={(v) =>
                        setForm((f) => ({ ...f, sell_by_shoot: v === true }))
                      }
                    />
                    <span className="text-sm font-medium text-foreground">Aplica Dosificación</span>
                  </label>
                  <p className="pl-7 text-xs text-muted-foreground">
                    Los ml de mezcla salen del perfil de la raza en agenda o mostrador; con
                    dilución se descuenta solo el concentrado del envase.
                  </p>
                </div>
              ) : null}

              <div className="space-y-2 rounded-xl border border-border/80 bg-secondary/20 p-4">
                <label className="flex cursor-pointer items-center gap-3">
                  <Checkbox
                    checked={form.dilution_enabled}
                    onCheckedChange={(v) =>
                      setForm((f) => ({ ...f, dilution_enabled: v === true }))
                    }
                  />
                  <span className="text-sm font-medium text-foreground">Usa dilución</span>
                </label>
                {form.dilution_enabled ? (
                  <div className="space-y-1 pl-0 sm:pl-0">
                    <p className="text-xs text-muted-foreground">
                      Proporción producto / agua. El perfil de raza indica ml de{" "}
                      <span className="font-medium text-foreground">mezcla lista</span>; del
                      envase se descuenta mezcla × (producto ÷ agua). Ej. 100 ml mezcla y 1/10
                      → 10 ml de concentrado.
                    </p>
                    <div className="flex max-w-xs items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        aria-label="Concentración (producto)"
                        className="h-11 rounded-xl text-center"
                        value={form.dilution_product}
                        onChange={(e) => setForm((f) => ({ ...f, dilution_product: e.target.value }))}
                      />
                      <span className="text-lg font-medium text-muted-foreground">/</span>
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        aria-label="Agua (dilución)"
                        className="h-11 rounded-xl text-center"
                        value={form.dilution_water}
                        onChange={(e) => setForm((f) => ({ ...f, dilution_water: e.target.value }))}
                      />
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="space-y-2 rounded-xl border border-border/80 bg-secondary/20 p-4">
                <div className="space-y-1">
                  <Label>Vida útil (usos)</Label>
                  <Input
                    type="number"
                    min={0}
                    className="h-11 rounded-xl"
                    value={form.wear_every_n_uses}
                    onChange={(e) => setForm((f) => ({ ...f, wear_every_n_uses: e.target.value }))}
                  />
                </div>
                {liveItem && Number(liveItem.wear_every_n_uses) > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Usos actuales: {liveItem.wear_use_count ?? 0} / {liveItem.wear_every_n_uses}
                    {liveItem.wear_alert_pending ? (
                      <span className="ml-2 font-medium text-destructive">· Aviso pendiente</span>
                    ) : null}
                  </p>
                ) : null}
                {liveItem?.wear_alert_pending ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 rounded-xl text-xs"
                    onClick={() => {
                      if (!liveItem) return;
                      patchInventoryItem(liveItem.id, { wear_alert_pending: false }).then(() => {
                        qc.invalidateQueries({ queryKey: ["inventory"] });
                        toast.success("Aviso reconocido");
                      });
                    }}
                  >
                    Marcar aviso como visto
                  </Button>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label>Destino del artículo</Label>
                <select
                  className="min-h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                  value={form.channel}
                  onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
                >
                  {CHANNEL_OPTIONS.map((ch) => (
                    <option key={ch} value={ch}>
                      {inventoryChannelFormLabel(ch)}
                    </option>
                  ))}
                </select>
              </div>

              {liveItem ? (
                <div className="rounded-xl border border-border bg-secondary/40 px-3 py-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Existencias
                  </p>
                  {(() => {
                    const stock = stockSummary(liveItem);
                    return (
                      <>
                        <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                          {stock.primary}
                          {stock.detail ? (
                            <span className="ml-2 text-base font-normal text-muted-foreground">
                              · {stock.detail}
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Reservado {formatReservedCell(liveItem)} · Disponible{" "}
                          {formatAvailableCell(liveItem)}
                          {nextExpiry(liveItem)
                            ? ` · Próximo vencimiento ${nextExpiry(liveItem)}`
                            : ""}
                        </p>
                      </>
                    );
                  })()}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Indicá la cantidad arriba; al guardar se registra el stock inicial.
                </p>
              )}

              <div className="space-y-1">
                <Label>Costo</Label>
                <Input
                  type="number"
                  className="h-11 rounded-xl"
                  value={form.purchase_price}
                  onChange={(e) => setForm((f) => ({ ...f, purchase_price: e.target.value }))}
                />
              </div>

              {shoppable ? (
                <div className="space-y-1">
                  <Label>Precio venta</Label>
                  <Input
                    type="number"
                    className="h-11 rounded-xl"
                    value={form.sale_price}
                    onChange={(e) => setForm((f) => ({ ...f, sale_price: e.target.value }))}
                  />
                </div>
              ) : null}

              <div className="space-y-1">
                <Label>
                  Cantidad mínima (
                  {isPackUnit(form.unit_kind)
                    ? "packs"
                    : isVolumeUnit(form.unit_kind)
                      ? "envases"
                      : "piezas"}
                  )
                </Label>
                <Input
                  type="number"
                  className="h-11 rounded-xl"
                  value={form.min_stock}
                  onChange={(e) => setForm((f) => ({ ...f, min_stock: e.target.value }))}
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              {selectedId && liveItem ? (
                <Button
                  variant="outline"
                  className="rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10"
                  disabled={
                    deleteMut.isPending ||
                    Number(liveItem.quantity) !== 0 ||
                    Number(liveItem.reserved ?? 0) > 0
                  }
                  onClick={() => setPendingDelete(liveItem)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                </Button>
              ) : null}
              <Button variant="outline" className="rounded-xl" onClick={closeEditor}>
                Cerrar
              </Button>
              <Button className="rounded-xl" disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>
                Guardar
              </Button>
            </div>
            {selectedId && liveItem && Number(liveItem.quantity) !== 0 ? (
              <p className="mt-2 text-right text-xs text-muted-foreground">
                Para eliminar, dejá las existencias en 0 desde el historial (merma o ajuste).
              </p>
            ) : null}
            {selectedId && liveItem && Number(liveItem.reserved ?? 0) > 0 ? (
              <p className="mt-1 text-right text-xs text-destructive">
                Hay unidades reservadas en ventas; liberá reservas antes de eliminar.
              </p>
            ) : null}

            {selectedId ? (
              <div className="mt-6 border-t border-border pt-4">
                <p className="text-sm font-medium">Historial de existencias</p>
                <p className="mt-1 text-xs text-muted-foreground">{KARDEX_HELP}</p>
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <div className="space-y-1">
                    <Label>Tipo</Label>
                    <select
                      className="h-11 rounded-xl border border-input bg-background px-3 text-sm"
                      value={moveKind}
                      onChange={(e) => setMoveKind(e.target.value as typeof moveKind)}
                    >
                      <option value="compra">Alta de stock</option>
                      <option value="merma">Baja / merma</option>
                      <option value="ajuste">Ajuste (+/−)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label>{moveQtyLabel}</Label>
                    <Input
                      type="number"
                      className="h-11 w-28 rounded-xl"
                      value={moveDelta}
                      onChange={(e) => setMoveDelta(e.target.value)}
                    />
                  </div>
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    disabled={moveMut.isPending}
                    onClick={() => moveMut.mutate()}
                  >
                    Registrar
                  </Button>
                </div>
                {isStockIn ? (
                  <div className="mt-3 space-y-2 rounded-xl border border-border bg-secondary/30 p-3">
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={moveHasExpiry}
                        onCheckedChange={(v) => setMoveHasExpiry(v === true)}
                      />
                      Este ingreso tiene fecha de caducidad
                    </label>
                    {moveHasExpiry ? (
                      <div className="space-y-1">
                        <Label>Caduca</Label>
                        <Input
                          type="date"
                          className="h-11 rounded-xl"
                          value={moveExpires}
                          onChange={(e) => setMoveExpires(e.target.value)}
                        />
                      </div>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      Si tiene caducidad, ese lote se vende antes que lo más nuevo (FIFO).
                    </p>
                  </div>
                ) : null}
                <ul className="mt-3 max-h-56 space-y-3 overflow-y-auto text-sm">
                  {moveItems.map((m) => (
                    <li key={m.id} className="rounded-xl bg-secondary/40 px-3 py-2">
                      <p className="font-medium text-foreground">
                        {formatKardexWhen(m.created_at)}{" "}
                        <span className="font-normal text-muted-foreground">
                          {kardexActor(m.actor_name, m.actor_email)}
                        </span>
                      </p>
                      <p className="text-foreground">{kardexActionLabel(m.kind, m.delta)}</p>
                      <p className="text-muted-foreground">{kardexBalanceLabel(m.quantity_after)}</p>
                    </li>
                  ))}
                  {!moveItems.length ? (
                    <li className="text-xs text-muted-foreground">Todavía no hay cambios de stock.</li>
                  ) : null}
                </ul>
                {moveTotal > moveLimit ? (
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      {moveOffset + 1}–{moveOffset + moveItems.length} de {moveTotal}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        disabled={!moveHasPrev}
                        onClick={() => setMovePage((p) => Math.max(0, p - 1))}
                      >
                        Anterior
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        disabled={!moveHasNext}
                        onClick={() => setMovePage((p) => p + 1)}
                      >
                        Siguiente
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Eliminar producto"
        description={
          pendingDelete
            ? pendingDelete.sku
              ? `¿Eliminar «${pendingDelete.name}» (${pendingDelete.sku})? Se borra del inventario y queda registrado en auditoría. Esta acción no se puede deshacer.`
              : `¿Eliminar «${pendingDelete.name}»? Se borra del inventario y queda registrado en auditoría. Esta acción no se puede deshacer.`
            : ""
        }
        confirmLabel="Eliminar"
        pending={deleteMut.isPending}
        onConfirm={() => pendingDelete && deleteMut.mutate(pendingDelete.id)}
      />
    </AppShell>
  );
}
