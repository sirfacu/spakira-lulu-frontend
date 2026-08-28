import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, AlertTriangle, CalendarX, Coins, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatCard, Empty, StatusPill } from "@/components/ui-kit";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  createInventoryItem,
  createInventoryMove,
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
  quantity: string;
  min_stock: string;
  purchase_price: string;
  sale_price: string;
  margin_pct: string;
  unit_kind: string;
  pack_size: string;
  pack_label: string;
  channel: string;
  expires_at: string;
};

const emptyForm = (): ItemForm => ({
  name: "",
  category: "",
  sku: "",
  barcode: "",
  quantity: "0",
  min_stock: "0",
  purchase_price: "0",
  sale_price: "0",
  margin_pct: "40",
  unit_kind: "pack",
  pack_size: "1",
  pack_label: "",
  channel: "interno",
  expires_at: "",
});

function toForm(i: InventoryItem): ItemForm {
  return {
    name: i.name,
    category: i.category ?? "",
    sku: i.sku ?? "",
    barcode: i.barcode ?? "",
    quantity: String(i.quantity),
    min_stock: String(i.min_stock),
    purchase_price: String(i.purchase_price ?? 0),
    sale_price: String(i.sale_price ?? 0),
    margin_pct: String(i.margin_pct ?? 40),
    unit_kind: i.unit_kind ?? "unidad",
    pack_size: String(i.pack_size ?? 1),
    pack_label: i.pack_label ?? "",
    channel: i.channel ?? "interno",
    expires_at: i.expires_at ? String(i.expires_at).slice(0, 10) : "",
  };
}

function Inventario() {
  const qc = useQueryClient();
  const inv = useQuery(inventoryQuery);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<InventoryItem | "new" | null>(null);
  const [form, setForm] = useState<ItemForm>(emptyForm());
  const [moveDelta, setMoveDelta] = useState("1");
  const [moveKind, setMoveKind] = useState<"compra" | "merma" | "ajuste">("compra");
  const selectedId = editing && editing !== "new" ? editing.id : null;
  const moves = useQuery(inventoryMovementsQuery(selectedId));

  const items = (inv.data ?? []).filter((i) =>
    `${i.name} ${i.category ?? ""} ${i.sku ?? ""}`.toLowerCase().includes(q.toLowerCase()),
  );

  const soon = new Date();
  soon.setMonth(soon.getMonth() + 3);
  const outOfStock = (inv.data ?? []).filter((i) => i.quantity === 0);
  const expiring = (inv.data ?? []).filter(
    (i) => i.expires_at && new Date(i.expires_at) <= soon,
  );
  const totalValue = (inv.data ?? []).reduce(
    (a, i) => a + Number(i.purchase_price) * i.quantity,
    0,
  );

  const state = (q0: number, min: number) =>
    q0 === 0
      ? { label: "Agotado", className: "bg-destructive/12 text-destructive border-destructive/30" }
      : q0 <= min
        ? { label: "Stock bajo", className: "bg-gold/25 text-gold-foreground border-gold/50" }
        : { label: "Disponible", className: "bg-mint/25 text-mint-foreground border-mint/50" };

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
        expires_at: form.expires_at || null,
      };
      if (!payload.name) throw new Error("Poné un nombre");
      if (editing === "new") {
        return createInventoryItem({ ...payload, quantity: Number(form.quantity) || 0 });
      }
      if (editing) return patchInventoryItem(editing.id, payload);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Producto guardado");
      if (editing === "new") setEditing(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const moveMut = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error("Elegí un producto");
      const n = Number(moveDelta);
      if (!n) throw new Error("Cantidad inválida");
      const signed =
        moveKind === "compra" ? Math.abs(n) : moveKind === "merma" ? -Math.abs(n) : n;
      return createInventoryMove(selectedId, { delta: signed, kind: moveKind });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Movimiento registrado");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <AppShell title="Inventario" subtitle={`${items.length} productos · kardex por movimiento`}>
      <div className="mb-4 flex justify-end">
        <Button
          className="rounded-xl"
          onClick={() => {
            setForm(emptyForm());
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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3.5 font-semibold">Producto</th>
                <th className="px-5 py-3.5 font-semibold">Categoría</th>
                <th className="px-5 py-3.5 font-semibold">Uso</th>
                <th className="px-5 py-3.5 font-semibold">Cantidad</th>
                <th className="px-5 py-3.5 font-semibold">Mínimo</th>
                <th className="px-5 py-3.5 font-semibold">Compra</th>
                <th className="px-5 py-3.5 font-semibold">Sugerido</th>
                <th className="px-5 py-3.5 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => {
                const st = state(i.quantity, i.min_stock);
                return (
                  <tr
                    key={i.id}
                    className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-secondary/40"
                    onClick={() => {
                      setForm(toForm(i));
                      setEditing(i);
                    }}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex min-w-0 items-center gap-3">
                        {i.photo_url ? (
                          <img src={i.photo_url} alt={i.name} loading="lazy" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
                        ) : null}
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{i.name}</p>
                          {i.sku ? <p className="text-xs text-muted-foreground">SKU {i.sku}</p> : null}
                          {i.expires_at ? (
                            <p className="text-xs text-muted-foreground">Vence {i.expires_at}</p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">{i.category}</td>
                    <td className="px-5 py-3.5">
                      <StatusPill
                        label={inventoryChannelLabel(i.channel)}
                        className={inventoryChannelBadgeClass(i.channel)}
                      />
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-foreground">{i.quantity}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">{i.min_stock}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">{cop(i.purchase_price)}</td>
                    <td className="px-5 py-3.5 font-medium text-accent">{cop(i.sale_price)}</td>
                    <td className="px-5 py-3.5">
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
            El saldo solo cambia con movimientos (compra, merma, ajuste). Si el extra de una cita
            tiene el mismo nombre, descuenta stock.
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
                <Input
                  className="h-11 rounded-xl"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                />
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
                  <option value="pack">Tarro / envase</option>
                  <option value="unidad">Unidades sueltas</option>
                  <option value="ml">Mililitros</option>
                  <option value="g">Gramos / peso</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Contenido del envase</Label>
                <Input
                  type="number"
                  className="h-11 rounded-xl"
                  value={form.pack_size}
                  onChange={(e) => setForm((f) => ({ ...f, pack_size: e.target.value }))}
                  placeholder="180 galletas, 250 ml…"
                />
              </div>
              <div className="space-y-1">
                <Label>Etiqueta envase</Label>
                <Input
                  className="h-11 rounded-xl"
                  value={form.pack_label}
                  onChange={(e) => setForm((f) => ({ ...f, pack_label: e.target.value }))}
                  placeholder="tarro, frasco…"
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
            {editing === "new" ? (
              <div className="space-y-1">
                <Label>Stock inicial (envases)</Label>
                <Input
                  type="number"
                  className="h-11 rounded-xl"
                  value={form.quantity}
                  onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                />
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Costo (envase)</Label>
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
                <Label>Venta tarro / envase</Label>
                <Input
                  type="number"
                  className="h-11 rounded-xl"
                  value={form.sale_price}
                  onChange={(e) => setForm((f) => ({ ...f, sale_price: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Venta unidad / ml / g</Label>
                <Input
                  className="h-11 rounded-xl"
                  readOnly
                  value={cop(unitPriceFromPack(Number(form.sale_price) || 0, Number(form.pack_size) || 1))}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Mínimo de envases</Label>
                <Input
                  type="number"
                  className="h-11 rounded-xl"
                  value={form.min_stock}
                  onChange={(e) => setForm((f) => ({ ...f, min_stock: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Vence</Label>
                <Input
                  type="date"
                  className="h-11 rounded-xl"
                  value={form.expires_at}
                  onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))}
                />
              </div>
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
              <p className="text-sm font-medium">Movimiento</p>
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <Label>Tipo</Label>
                  <select
                    className="h-11 rounded-xl border border-input bg-background px-3 text-sm"
                    value={moveKind}
                    onChange={(e) => setMoveKind(e.target.value as typeof moveKind)}
                  >
                    <option value="compra">Compra (+)</option>
                    <option value="merma">Merma (−)</option>
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
              <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                {(moves.data ?? []).map((m) => (
                  <li key={m.id}>
                    {m.created_at?.slice(0, 16).replace("T", " ")} · {m.kind} · {m.delta > 0 ? "+" : ""}
                    {m.delta} → {m.quantity_after}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
