import { useEffect, useState } from "react";
import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { DollarSign, TrendingUp, Receipt, Sparkles, Plus, Minus, Trash2, FileText } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { AppShell } from "@/components/app-shell";
import { StatCard, SectionCard, Empty } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PaymentMethodFields } from "@/components/payment-method-fields";
import { CouponApplyFields } from "@/components/coupon-apply-fields";
import {
  salesQuery,
  ownersQuery,
  staffQuery,
  panelServicesQuery,
  inventoryShopQuery,
  inventoryShopAtLocationQuery,
  paymentMethodsQuery,
  createSale,
  getSale,
  openSaleInvoice,
  getMyStaff,
  getLoyaltyCustomer,
  getLocations,
  type InventoryItem,
  type PromoValidate,
} from "@/lib/spa-queries";
import { cop, dayKey, shortDate } from "@/lib/format";
import { requirePathAccess } from "@/lib/route-access";
import { isActiveSale, permissionsFor } from "@/lib/roles";
import { WorkingLocationBar } from "@/components/working-location-bar";
import {
  pickWorkingLocation,
  readWorkingLocationId,
  writeWorkingLocationId,
} from "@/lib/working-location";

export const Route = createFileRoute("/_authenticated/panel/ventas")({
  beforeLoad: requirePathAccess("/panel/ventas"),
  head: () => ({
    meta: [
      { title: "Ventas | Spa Kira" },
      {
        name: "description",
        content: "Venta rápida de mostrador, historial y facturación.",
      },
      { property: "og:title", content: "Ventas | Spa Kira" },
      { property: "og:description", content: "Módulo de ventas y facturación del spa." },
    ],
  }),
  component: Ventas,
});

type CartLine = {
  id: string;
  name: string;
  unit_price: number;
  quantity: number;
  available: number;
};

function shopPrice(i: InventoryItem) {
  return Number(i.sale_price_unit || i.sale_price) || 0;
}

function Ventas() {
  const { user } = useRouteContext({ from: "/_authenticated" });
  const perms = permissionsFor(user?.role);
  const canSeeAnalytics = perms.canViewSalesAnalytics;
  const qc = useQueryClient();
  const locationsQ = useQuery({ queryKey: ["locations"], queryFn: getLocations });
  const activeLocations = (locationsQ.data?.items ?? []).filter((x) => x.active);
  const [workingLocationId, setWorkingLocationId] = useState("");
  useEffect(() => {
    const active = (locationsQ.data?.items ?? []).filter((x) => x.active);
    const picked = pickWorkingLocation(active, readWorkingLocationId());
    if (!picked) return;
    setWorkingLocationId((prev) => {
      const next = active.some((x) => x.id === prev) ? prev : picked.id;
      writeWorkingLocationId(next);
      return next;
    });
  }, [locationsQ.data]);
  const workingLocation = pickWorkingLocation(activeLocations, workingLocationId);
  const locationId = workingLocation?.id || "";
  const sales = useQuery({ ...salesQuery, enabled: canSeeAnalytics });
  const owners = useQuery(ownersQuery);
  const staff = useQuery({ ...staffQuery, enabled: perms.isAdmin });
  const services = useQuery(panelServicesQuery);
  const shop = useQuery(
    locationId ? inventoryShopAtLocationQuery(locationId) : inventoryShopQuery,
  );
  const payMethods = useQuery(paymentMethodsQuery);
  const myStaff = useQuery({
    queryKey: ["staff-me"],
    queryFn: getMyStaff,
    enabled: perms.isColaborador,
  });

  const [ownerId, setOwnerId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [method, setMethod] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [productId, setProductId] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [promo, setPromo] = useState<PromoValidate | null>(null);
  const [detailSaleId, setDetailSaleId] = useState<string | null>(null);
  const saleDetailQ = useQuery({
    queryKey: ["sale", detailSaleId],
    queryFn: () => getSale(detailSaleId!),
    enabled: Boolean(detailSaleId),
  });
  const saleDetail = saleDetailQ.data;

  const loyalty = useQuery({
    queryKey: ["loyalty-customer", ownerId],
    queryFn: () => getLoyaltyCustomer(ownerId),
    enabled: !!ownerId,
  });

  const mostrador = (owners.data ?? []).find((o) => o.system_key === "mostrador");
  const service = (services.data ?? []).find((s) => s.id === serviceId);
  const serviceTotal = Number(service?.price ?? 0);
  const productsTotal = cart.reduce((a, l) => a + l.unit_price * l.quantity, 0);
  const grandTotal = serviceTotal + productsTotal;
  const discount = promo?.valid ? Number(promo.discount_amount || 0) : 0;
  const netTotal = Math.max(0, grandTotal - discount);

  useEffect(() => {
    if (!ownerId && mostrador?.id) setOwnerId(mostrador.id);
  }, [mostrador, ownerId]);

  useEffect(() => {
    if (perms.isColaborador && myStaff.data?.id) setStaffId(myStaff.data.id);
  }, [perms.isColaborador, myStaff.data?.id]);

  const addProduct = (id: string) => {
    const item = (shop.data ?? []).find((i) => i.id === id);
    if (!item) return;
    const avail = Number(item.available ?? item.quantity) || 0;
    if (avail < 1) {
      toast.error("No hay unidades disponibles");
      return;
    }
    setCart((prev) => {
      const hit = prev.find((l) => l.id === id);
      if (hit) {
        if (hit.quantity + 1 > avail) {
          toast.error(`Quedan ${avail}`);
          return prev;
        }
        return prev.map((l) => (l.id === id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [
        ...prev,
        {
          id: item.id,
          name: item.name,
          unit_price: shopPrice(item),
          quantity: 1,
          available: avail,
        },
      ];
    });
    setProductId("");
  };

  const create = useMutation({
    mutationFn: () =>
      createSale({
        owner_id: ownerId || null,
        staff_id: staffId || null,
        location_id: locationId || null,
        payment_method: method,
        ...(evidenceUrl ? { payment_evidence_url: evidenceUrl } : {}),
        service_id: serviceId || null,
        lines: cart.map((l) => ({ inventory_item_id: l.id, quantity: l.quantity })),
        ...(promo?.valid && promo.code ? { coupon_code: promo.code } : {}),
        ...(promo?.valid && promo.loyalty_reward_id ? { loyalty_reward_id: promo.loyalty_reward_id } : {}),
        ...(promo?.valid && promo.promotion_id && !promo.code ? { promotion_id: promo.promotion_id } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Venta registrada");
      setServiceId("");
      setCart([]);
      setEvidenceUrl("");
      setPromo(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const all = (sales.data ?? []).filter((s) => isActiveSale(s.status));
  const today = dayKey(new Date());
  const todayTotal = all
    .filter((s) => dayKey(new Date(s.sold_at)) === today)
    .reduce((a, s) => a + Number(s.total), 0);
  const monthTotal = all
    .filter((s) => new Date(s.sold_at).getMonth() === new Date().getMonth())
    .reduce((a, s) => a + Number(s.total), 0);
  const avg = all.length ? all.reduce((a, s) => a + Number(s.total), 0) / all.length : 0;

  const chart = Array.from({ length: 7 }).map((_, idx) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - idx));
    const key = dayKey(d);
    return {
      day: shortDate(d.toISOString()),
      total: all.filter((s) => dayKey(new Date(s.sold_at)) === key).reduce((a, s) => a + Number(s.total), 0),
    };
  });

  const selectedPay = (payMethods.data ?? []).find((m) => m.code === method);
  const canSubmit =
    (!!serviceId || cart.length > 0) &&
    !!method &&
    (!selectedPay?.require_evidence || !!evidenceUrl) &&
    !create.isPending;

  return (
    <AppShell
      title="Ventas"
      subtitle={
        canSeeAnalytics
          ? "Venta rápida, historial y facturación"
          : "Registrar venta de mostrador (vitrina o servicio suelto)"
      }
    >
      <WorkingLocationBar
        location={workingLocation}
        locations={activeLocations}
        noun="Ventas"
        onChange={(id) => {
          writeWorkingLocationId(id);
          setWorkingLocationId(id);
          setCart([]);
        }}
      />
      {canSeeAnalytics ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={DollarSign} label="Ventas del día" value={cop(todayTotal)} tone="accent" />
          <StatCard icon={TrendingUp} label="Ventas del mes" value={cop(monthTotal)} tone="primary" />
          <StatCard icon={Receipt} label="Ticket promedio" value={cop(avg)} tone="gold" />
          <StatCard
            icon={Sparkles}
            label="Servicios más vendidos"
            value={(services.data ?? [])[0]?.name ?? "—"}
            tone="mint"
          />
        </div>
      ) : null}

      <Tabs defaultValue="rapida" className="mt-6">
        {canSeeAnalytics ? (
          <TabsList className="rounded-xl">
            <TabsTrigger value="rapida" className="rounded-lg">
              Venta rápida
            </TabsTrigger>
            <TabsTrigger value="historial" className="rounded-lg">
              Historial
            </TabsTrigger>
            <TabsTrigger value="facturacion" className="rounded-lg">
              Facturación
            </TabsTrigger>
          </TabsList>
        ) : null}

        <TabsContent value="rapida" className="mt-5">
          <SectionCard title="Nueva venta">
            <p className="mb-4 text-sm text-muted-foreground">
              Mostrador es un humano del sistema, sin login. Sirve para galletas, collares u
              otro ítem de vitrina que alguien compra sin cita. También podés cargarlo a un
              cliente de la agenda.
            </p>
            <div className="grid gap-4 md:grid-cols-4">
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue placeholder="Cliente" />
                </SelectTrigger>
                <SelectContent>
                  {(owners.data ?? []).map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.system_key === "mostrador" ? "Ventas Mostrador" : o.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={serviceId || "__none"} onValueChange={(v) => setServiceId(v === "__none" ? "" : v)}>
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue placeholder="Servicio (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Sin servicio</SelectItem>
                  {(services.data ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} · {cop(s.price)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={staffId}
                onValueChange={setStaffId}
                disabled={perms.isColaborador}
              >
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue placeholder="Encargado" />
                </SelectTrigger>
                <SelectContent>
                  {(staff.data ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="mt-4">
              <PaymentMethodFields
                methods={payMethods.data ?? []}
                methodCode={method}
                onMethodChange={setMethod}
                evidenceUrl={evidenceUrl}
                onEvidenceUrl={setEvidenceUrl}
              />
            </div>

            <div className="mt-4">
              <CouponApplyFields
                subtotal={grandTotal}
                customerId={ownerId || null}
                serviceIds={serviceId ? [serviceId] : []}
                value={promo}
                onChange={setPromo}
                rewards={(loyalty.data?.available ?? []).map((r) => ({ id: r.id, label: r.label }))}
              />
            </div>

            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Vitrina
              </p>
              <Select value={productId || "__none"} onValueChange={(v) => v !== "__none" && addProduct(v)}>
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue placeholder="Agregar producto (galletas, collares, BARF…)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Elegir producto…</SelectItem>
                  {(shop.data ?? []).map((i) => {
                    const avail = Number(i.available ?? i.quantity) || 0;
                    return (
                      <SelectItem key={i.id} value={i.id} disabled={avail < 1}>
                        {i.name} · {cop(shopPrice(i))} · quedan {avail}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {cart.length ? (
                <ul className="mt-3 space-y-2">
                  {cart.map((l) => (
                    <li
                      key={l.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-secondary/40 px-3 py-2 text-sm"
                    >
                      <span className="min-w-0 flex-1 font-medium">{l.name}</span>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-lg"
                          disabled={l.quantity <= 1}
                          onClick={() =>
                            setCart((prev) =>
                              prev.map((x) =>
                                x.id === l.id ? { ...x, quantity: x.quantity - 1 } : x,
                              ),
                            )
                          }
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                        <span className="w-8 text-center font-semibold">{l.quantity}</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-lg"
                          disabled={l.quantity >= l.available}
                          onClick={() =>
                            setCart((prev) =>
                              prev.map((x) =>
                                x.id === l.id ? { ...x, quantity: x.quantity + 1 } : x,
                              ),
                            )
                          }
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => setCart((prev) => prev.filter((x) => x.id !== l.id))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <span className="w-24 text-right font-semibold text-accent">
                        {cop(l.unit_price * l.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  Sin productos. Podés registrar solo un servicio, o solo vitrina.
                </p>
              )}
            </div>

            <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-2xl bg-secondary/60 p-5">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Total</p>
                <p className="font-display text-3xl font-bold text-accent">{cop(netTotal)}</p>
                {discount > 0 ? (
                  <p className="text-xs text-muted-foreground">Antes {cop(grandTotal)}</p>
                ) : null}
              </div>
              <Button
                disabled={!canSubmit}
                onClick={() => create.mutate()}
                className="h-12 rounded-xl px-6"
              >
                <Plus className="mr-2 h-4 w-4" /> Registrar venta
              </Button>
            </div>
          </SectionCard>
        </TabsContent>

        {canSeeAnalytics ? (
          <>
            <TabsContent value="historial" className="mt-5">
              <SectionCard title="Historial de ventas">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                        <th className="py-3 font-semibold">Fecha</th>
                        <th className="py-3 font-semibold">Origen</th>
                        <th className="py-3 font-semibold">Cliente</th>
                        <th className="py-3 font-semibold">Vendedor</th>
                        <th className="py-3 font-semibold">Método</th>
                        <th className="py-3 text-right font-semibold">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {all.map((s) => (
                        <tr
                          key={s.id}
                          className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-secondary/40"
                          onClick={() => setDetailSaleId(s.id)}
                        >
                          <td className="py-3 text-muted-foreground">{shortDate(s.sold_at)}</td>
                          <td className="py-3 text-muted-foreground">
                            {s.source === "cita"
                              ? s.service_name
                                ? `Servicio${s.pet_name ? ` · ${s.pet_name}` : ""}`
                                : "Servicio"
                              : "Mostrador"}
                          </td>
                          <td className="py-3 font-medium text-foreground">
                            {s.owners?.full_name ?? "—"}
                          </td>
                          <td className="py-3 text-muted-foreground">{s.staff?.full_name ?? "—"}</td>
                          <td className="py-3 text-muted-foreground">
                            {s.payment_method_label || s.payment_method}
                          </td>
                          <td className="py-3 text-right font-semibold text-accent">{cop(s.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!all.length ? <Empty message="Sin ventas registradas." /> : null}
              </SectionCard>
            </TabsContent>

            <TabsContent value="facturacion" className="mt-5">
              <SectionCard title="Ventas de la semana">
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chart} margin={{ left: -12, right: 8, top: 8 }}>
                      <CartesianGrid strokeDasharray="4 6" stroke="var(--border)" vertical={false} />
                      <XAxis
                        dataKey="day"
                        tickLine={false}
                        axisLine={false}
                        fontSize={12}
                        stroke="var(--muted-foreground)"
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        fontSize={11}
                        stroke="var(--muted-foreground)"
                        tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
                      />
                      <Tooltip
                        cursor={{ fill: "var(--muted)" }}
                        formatter={(v) => cop(Number(v))}
                        contentStyle={{
                          borderRadius: 14,
                          border: "1px solid var(--border)",
                          background: "var(--card)",
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="total" fill="var(--chart-1)" radius={[10, 10, 0, 0]} barSize={34} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>
            </TabsContent>
          </>
        ) : null}
      </Tabs>

      <Dialog open={Boolean(detailSaleId)} onOpenChange={(o) => !o && setDetailSaleId(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-3xl">
          <h2 className="font-display text-xl font-bold text-primary">Detalle de venta</h2>
          {saleDetailQ.isLoading ? (
            <p className="mt-3 text-sm text-muted-foreground">Cargando líneas…</p>
          ) : saleDetailQ.isError ? (
            <p className="mt-3 text-sm text-destructive">
              {saleDetailQ.error instanceof Error
                ? saleDetailQ.error.message
                : "No se pudo cargar esta venta."}
            </p>
          ) : saleDetail ? (
            <div className="mt-4 space-y-4">
              <div className="grid gap-1 text-sm">
                <p>
                  <span className="text-muted-foreground">Fecha · </span>
                  {shortDate(saleDetail.sold_at)}
                </p>
                <p>
                  <span className="text-muted-foreground">Origen · </span>
                  {saleDetail.source === "cita"
                    ? `Servicio${saleDetail.pet_name ? ` · ${saleDetail.pet_name}` : ""}`
                    : "Mostrador"}
                </p>
                <p>
                  <span className="text-muted-foreground">Cliente · </span>
                  {saleDetail.owners?.full_name ?? "—"}
                </p>
                {saleDetail.service_name ? (
                  <p>
                    <span className="text-muted-foreground">Servicio · </span>
                    {saleDetail.service_name}
                  </p>
                ) : null}
                <p>
                  <span className="text-muted-foreground">Pago · </span>
                  {saleDetail.payment_method_label || saleDetail.payment_method}
                </p>
                {saleDetail.invoice_number ? (
                  <p>
                    <span className="text-muted-foreground">Factura · </span>
                    {saleDetail.invoice_number}
                  </p>
                ) : null}
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="py-2 font-semibold">Ítem</th>
                    <th className="py-2 text-right font-semibold">Cant.</th>
                    <th className="py-2 text-right font-semibold">Unitario</th>
                    <th className="py-2 text-right font-semibold">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {(saleDetail.items ?? []).map((it) => (
                    <tr key={it.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2">{it.description}</td>
                      <td className="py-2 text-right tabular-nums">{it.quantity}</td>
                      <td className="py-2 text-right">{cop(it.unit_price)}</td>
                      <td className="py-2 text-right font-medium">
                        {cop(Number(it.quantity) * Number(it.unit_price))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-right text-base font-semibold text-accent">
                Total {cop(saleDetail.total)}
              </p>
              {saleDetail.has_invoice ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => {
                      void openSaleInvoice(saleDetail.id, "view").catch((e) =>
                        toast.error(e instanceof Error ? e.message : "No se pudo abrir el PDF"),
                      );
                    }}
                  >
                    <FileText className="mr-2 h-4 w-4" /> Ver PDF
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => {
                      void openSaleInvoice(saleDetail.id, "download").catch((e) =>
                        toast.error(e instanceof Error ? e.message : "No se pudo descargar el PDF"),
                      );
                    }}
                  >
                    Descargar
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {saleDetail.source === "cita"
                    ? "Esta venta de cita no tiene factura PDF."
                    : "La venta de mostrador no genera factura PDF; el detalle de ítems está arriba."}
                </p>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
