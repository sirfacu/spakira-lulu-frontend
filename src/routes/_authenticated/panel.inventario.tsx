import { useMemo, useState } from "react";
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
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatCard, Empty, StatusPill } from "@/components/ui-kit";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  createInventoryCategory,
  createInventoryItem,
  createInventoryMove,
  inventoryCategoriesQuery,
  inventoryMovementsQuery,
  inventoryQuery,
  patchInventoryItem,
  type InventoryItem,
} from "@/lib/spa-queries";
import { cop } from "@/lib/format";
import {
  inventoryChannelBadgeClass,
  inventoryChannelHint,
  inventoryChannelLabel,
} from "@/lib/inventory-channel";
import {
  formatKardexWhen,
  KARDEX_HELP,
  kardexActionLabel,
  kardexActor,
  kardexBalanceLabel,
} from "@/lib/inventory-kardex";
import { suggestedSale, unitPriceFromPack } from "@/lib/inventory-pricing";
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

type ItemForm = {
  name: string;
  category: string;
  sku: string;
  barcode: string;
  min_stock: string;
  purchase_price: string;
  sale_price: string;
  margin_pct: string;
  unit_kind: string;
  pack_size: string;
  pack_label: string;
  channel: string;
};

const emptyForm = (): ItemForm => ({
  name: "",
  category: "",
  sku: "",
  barcode: "",
  min_stock: "0",
  purchase_price: "0",
  sale_price: "0",
  margin_pct: "40",
  unit_kind: "unidad",
  pack_size: "1",
  pack_label: "",
  channel: "interno",
});

function toForm(i: InventoryItem): ItemForm {
  return {
    name: i.name,
    category: i.category ?? "",
    sku: i.sku ?? "",
    barcode: i.barcode ?? "",
    min_stock: String(i.min_stock),
    purchase_price: String(i.purchase_price ?? 0),
    sale_price: String(i.sale_price ?? 0),
    margin_pct: String(i.margin_pct ?? 40),
    unit_kind: i.unit_kind ?? "unidad",
    pack_size: String(i.pack_size ?? 1),
    pack_label: i.pack_label ?? "",
    channel: i.channel ?? "interno",
  };
}

function nextExpiry(i: InventoryItem): string | null {
  const raw = i.next_expires_at || i.expires_at;
  return raw ? String(raw).slice(0, 10) : null;
}

function Inventario() {
  const qc = useQueryClient();
  const inv = useQuery(inventoryQuery);
  const cats = useQuery(inventoryCategoriesQuery);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<InventoryItem | "new" | null>(null);
  const [form, setForm] = useState<ItemForm>(emptyForm());
  const [moveDelta, setMoveDelta] = useState("1");
  const [moveKind, setMoveKind] = useState<"compra" | "merma" | "ajuste">("compra");
  const [moveHasExpiry, setMoveHasExpiry] = useState(false);
  const [moveExpires, setMoveExpires] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [costOpen, setCostOpen] = useState<Record<string, boolean>>({});
  const selectedId = editing && editing !== "new" ? editing.id : null;
  const moves = useQuery(inventoryMovementsQuery(selectedId));

  const items = (inv.data ?? []).filter((i) =>
    `${i.name} ${i.category ?? ""} ${i.sku ?? ""}`.toLowerCase().includes(q.toLowerCase()),
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
  const totalValue = (inv.data ?? []).reduce(
    (a, i) => a + Number(i.purchase_price) * i.quantity,
    0,
  );

  const categoryOptions = useMemo(() => {
    const names = new Set((cats.data ?? []).map((c) => c.name));
    if (form.category && !names.has(form.category)) names.add(form.category);
    return [...names].sort((a, b) => a.localeCompare(b, "es"));
  }, [cats.data, form.category]);

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
      const payload = {
        name: form.name.trim(),
        category: form.category.trim() || null,
        sku: form.sku.trim() || null,
        barcode: form.barcode.trim() || null,
        min_stock: Number(form.min_stock) || 0,
        purchase_price: Number(form.purchase_price) || 0,
        margin_pct: Number(form.margin_pct) || 40,
        sale_price: Number(form.sale_price) || 0,
        unit_kind: form.unit_kind,
        pack_size: Number(form.pack_size) || 1,
        pack_label: form.pack_label.trim() || null,
        channel: form.channel,
      };
      if (!payload.name) throw new Error("Poné un nombre");
      if (!payload.category) throw new Error("Elegí una categoría");
      if (editing === "new") {
        return createInventoryItem({ ...payload, quantity: 0 });
      }
      if (editing) return patchInventoryItem(editing.id, payload);
    },
    onSuccess: async (item) => {
      await qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Producto guardado");
      if (item && editing === "new") {
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
      setMoveHasExpiry(false);
      setMoveExpires("");
      toast.success("Existencias actualizadas");
    },
    onError: (err: Error) => toast.error(err.message),
  });

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
          placeholder="Buscar producto, SKU o categoría…"
          className="h-10 rounded-xl border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
        />
      </div>

      <div className="card-soft mt-6 overflow-hidden">
        <div className="max-h-[min(70vh,720px)] overflow-auto">
          <table className="w-full min-w-[980px] border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="border-b border-border bg-secondary px-5 py-3.5 font-semibold">Producto</th>
                <th className="border-b border-border bg-secondary px-5 py-3.5 font-semibold">Categoría</th>
                <th className="border-b border-border bg-secondary px-5 py-3.5 font-semibold">Uso</th>
                <th className="border-b border-border bg-secondary px-5 py-3.5 font-semibold">Existencia</th>
                <th className="border-b border-border bg-secondary px-5 py-3.5 font-semibold">Reservado</th>
                <th className="border-b border-border bg-secondary px-5 py-3.5 font-semibold">Disponible</th>
                <th
                  className="border-b border-border bg-secondary px-5 py-3.5 font-semibold"
                  title="Cantidad mínima en existencia"
                >
                  Mín. existencia
                </th>
                <th className="border-b border-border bg-secondary px-5 py-3.5 font-semibold">Costo</th>
                <th className="border-b border-border bg-secondary px-5 py-3.5 font-semibold">Valor venta</th>
                <th className="border-b border-border bg-secondary px-5 py-3.5 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => {
                const avail = Number(i.available ?? i.quantity);
                const st = state(avail, i.min_stock);
                const exp = nextExpiry(i);
                const showCost = !!costOpen[i.id];
                return (
                  <tr
                    key={i.id}
                    className="cursor-pointer hover:bg-secondary/40"
                    onClick={() => {
                      setForm(toForm(i));
                      setShowNewCategory(false);
                      setEditing(i);
                    }}
                  >
                    <td className="border-b border-border/60 px-5 py-3.5">
                      <div className="flex min-w-0 items-center gap-3">
                        {i.photo_url ? (
                          <img src={i.photo_url} alt={i.name} loading="lazy" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
                        ) : null}
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{i.name}</p>
                          {i.sku ? <p className="text-xs text-muted-foreground">SKU {i.sku}</p> : null}
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
                    <td className="border-b border-border/60 px-5 py-3.5 font-semibold text-foreground">{i.quantity}</td>
                    <td className="border-b border-border/60 px-5 py-3.5 text-muted-foreground">{i.reserved ?? 0}</td>
                    <td className="border-b border-border/60 px-5 py-3.5 font-semibold text-foreground">{avail}</td>
                    <td className="border-b border-border/60 px-5 py-3.5 text-muted-foreground">{i.min_stock}</td>
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
                    <td className="border-b border-border/60 px-5 py-3.5 font-medium text-accent">{cop(i.sale_price)}</td>
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

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-2xl">
          <h2 className="text-lg font-semibold">
            {editing === "new" ? "Nuevo producto" : "Producto"}
          </h2>
          <p className="text-sm text-muted-foreground">
            Las existencias se ven acá pero no se editan a mano: suben con un alta de stock y bajan
            con ventas, bajas o ajustes. Si llega a cero, el producto sigue en la lista.
          </p>
          <div className="mt-4 grid gap-3">
            <div className="space-y-1">
              <Label>Nombre</Label>
              <Input
                className="h-11 rounded-xl"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
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
                  <option value="__new__">＋ Nueva categoría…</option>
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
                <Label>SKU</Label>
                <Input
                  className="h-11 rounded-xl"
                  value={form.sku}
                  onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Código de barras</Label>
              <Input
                className="h-11 rounded-xl"
                value={form.barcode}
                onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))}
                placeholder="Opcional · pistola USB o a mano"
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
                  <option value="unidad">Unidades</option>
                  <option value="pack">Paquete / presentación</option>
                  <option value="ml">Mililitros</option>
                  <option value="g">Gramos / peso</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Contenido por unidad</Label>
                <Input
                  type="number"
                  className="h-11 rounded-xl"
                  value={form.pack_size}
                  onChange={(e) => setForm((f) => ({ ...f, pack_size: e.target.value }))}
                  placeholder="1, 180, 250…"
                />
              </div>
              <div className="space-y-1">
                <Label>Etiqueta</Label>
                <Input
                  className="h-11 rounded-xl"
                  value={form.pack_label}
                  onChange={(e) => setForm((f) => ({ ...f, pack_label: e.target.value }))}
                  placeholder="bolsa, frasco, caja…"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Uso del ítem</Label>
              <p className="text-xs text-muted-foreground">
                Si el mismo producto se usa en el spa y se vende, creá dos registros (ej. shampoo
                consumo interno y shampoo venta) aunque compartan SKU o código de barras.
              </p>
              <select
                className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                value={form.channel}
                onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
              >
                <option value="interno">Consumo interno (insumos del spa)</option>
                <option value="externo">Venta al público (tienda / extras en cita)</option>
                {form.channel === "interno_externo" ? (
                  <option value="interno_externo">Interno + venta (legacy — separar en dos ítems)</option>
                ) : null}
              </select>
              <p className="text-xs text-muted-foreground">{inventoryChannelHint(form.channel)}</p>
            </div>
            {liveItem ? (
              <div className="rounded-xl border border-border bg-secondary/40 px-3 py-2.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Existencias
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                  {liveItem.quantity}
                </p>
                <p className="text-xs text-muted-foreground">
                  Reservado {liveItem.reserved ?? 0} · Disponible {liveItem.available ?? liveItem.quantity}
                  {nextExpiry(liveItem) ? ` · Próximo vencimiento ${nextExpiry(liveItem)}` : ""}
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Al guardar, las existencias quedan en 0. Después agregá unidades desde el historial.
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Costo</Label>
                <Input
                  type="number"
                  className="h-11 rounded-xl"
                  value={form.purchase_price}
                  onChange={(e) => {
                    const purchase_price = e.target.value;
                    const margin = Number(form.margin_pct) || 40;
                    const sale = suggestedSale(Number(purchase_price) || 0, margin);
                    setForm((f) => ({ ...f, purchase_price, sale_price: String(sale) }));
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label>Margen % (publicado)</Label>
                <Input
                  type="number"
                  className="h-11 rounded-xl"
                  value={form.margin_pct}
                  onChange={(e) => {
                    const margin_pct = e.target.value;
                    const sale = suggestedSale(Number(form.purchase_price) || 0, Number(margin_pct) || 0);
                    setForm((f) => ({ ...f, margin_pct, sale_price: String(sale) }));
                  }}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Valor de venta</Label>
                <Input
                  type="number"
                  className="h-11 rounded-xl"
                  value={form.sale_price}
                  onChange={(e) => setForm((f) => ({ ...f, sale_price: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Precio por unidad / ml / g</Label>
                <Input
                  className="h-11 rounded-xl"
                  readOnly
                  value={cop(unitPriceFromPack(Number(form.sale_price) || 0, Number(form.pack_size) || 1))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Cantidad mínima en existencia</Label>
              <Input
                type="number"
                className="h-11 rounded-xl"
                value={form.min_stock}
                onChange={(e) => setForm((f) => ({ ...f, min_stock: e.target.value }))}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setEditing(null)}>
              Cerrar
            </Button>
            <Button className="rounded-xl" disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>
              Guardar
            </Button>
          </div>

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
                  <Label>Cantidad</Label>
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
                {(moves.data ?? []).map((m) => (
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
                {!(moves.data ?? []).length ? (
                  <li className="text-xs text-muted-foreground">Todavía no hay cambios de stock.</li>
                ) : null}
              </ul>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
