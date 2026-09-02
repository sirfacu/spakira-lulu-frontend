import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Minus, Plus, Search, Trash2, FileText, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { completeAppointment, listAppointmentExtras, inventoryShopQuery, paymentMethodsQuery, getLoyaltyCustomer, type Appointment, type PromoValidate } from "@/lib/spa-queries";
import { CouponApplyFields } from "@/components/coupon-apply-fields";
import { MaterialEstimatePanel } from "@/components/material-estimate-panel";
import { ApiError } from "@/lib/api";
import { cop, time } from "@/lib/format";
import { PaymentMethodFields } from "@/components/payment-method-fields";

type CatalogItem = {
  id: string;
  name: string;
  category: string;
  unit_price: number;
};

type Line = {
  key: string;
  name: string;
  unit_price: number;
  quantity: number;
  fromCatalog: boolean;
};

type Props = {
  appointment: Appointment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
};

function newKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function FinishAppointmentDialog({ appointment, open, onOpenChange, onDone }: Props) {
  const [includeService, setIncludeService] = useState(true);
  const [servicePrice, setServicePrice] = useState("");
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [customPrice, setCustomPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [markPaid, setMarkPaid] = useState(true);
  const [promo, setPromo] = useState<PromoValidate | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const shop = useQuery({ ...inventoryShopQuery, enabled: open });
  const payMethods = useQuery({ ...paymentMethodsQuery, enabled: open });
  const ownerId = appointment?.pets?.owners?.id ?? appointment?.pets?.owner_id ?? null;
  const loyalty = useQuery({
    queryKey: ["loyalty-customer", ownerId],
    queryFn: () => getLoyaltyCustomer(ownerId!),
    enabled: open && !!ownerId,
  });
  const catalog = useMemo(() => {
    return (shop.data ?? []).map((i) => ({
      id: i.id,
      name: i.name,
      category: i.category || "Vitrina",
      unit_price: Number(i.sale_price_unit || i.sale_price) || 0,
    }));
  }, [shop.data]);

  useEffect(() => {
    if (!open || !appointment?.id) return;
    setIncludeService(true);
    setServicePrice(
      appointment.price != null && Number(appointment.price) > 0
        ? String(Math.round(Number(appointment.price)))
        : "",
    );
    setQuery("");
    setConfirmOpen(false);
    setCustomPrice("");
    setPaymentMethod("");
    setEvidenceUrl("");
    setMarkPaid(true);
    setPromo(null);
    let cancelled = false;
    const reloadExtras = async () => {
      try {
        const extras = await listAppointmentExtras(appointment.id);
        if (cancelled) return;
        setLines(
          extras.map((ex) => ({
            key: ex.id,
            name: ex.item_name,
            unit_price: Number(ex.unit_price) || 0,
            quantity: Math.max(1, Number(ex.quantity) || 1),
            fromCatalog: true,
          })),
        );
      } catch {
        if (!cancelled) setLines([]);
      }
    };
    void reloadExtras();
    setTimeout(() => inputRef.current?.focus(), 50);
    return () => {
      cancelled = true;
    };
  }, [open, appointment?.id]);

  const reloadBillableExtras = async () => {
    if (!appointment?.id) return;
    const extras = await listAppointmentExtras(appointment.id);
    setLines(
      extras.map((ex) => ({
        key: ex.id,
        name: ex.item_name,
        unit_price: Number(ex.unit_price) || 0,
        quantity: Math.max(1, Number(ex.quantity) || 1),
        fromCatalog: true,
      })),
    );
  };

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 1) return [] as CatalogItem[];
    const selected = new Set(lines.map((l) => l.name.toLowerCase()));
    return catalog.filter(
      (item) =>
        !selected.has(item.name.toLowerCase()) &&
        (item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q)),
    ).slice(0, 8);
  }, [query, lines, catalog]);

  const showCustomHint =
    query.trim().length >= 2 &&
    !suggestions.some((s) => s.name.toLowerCase() === query.trim().toLowerCase());

  const miscTotal = lines.reduce((sum, l) => sum + l.unit_price * l.quantity, 0);
  const parsedService = Number(servicePrice);
  const serviceTotal =
    includeService && Number.isFinite(parsedService) && parsedService >= 0 ? parsedService : 0;
  const grandTotal = serviceTotal + miscTotal;
  const discount = promo?.valid ? Number(promo.discount_amount || 0) : 0;
  const netTotal = Math.max(0, grandTotal - discount);

  const addCatalogItem = (item: CatalogItem) => {
    setLines((prev) => [
      ...prev,
      {
        key: newKey(),
        name: item.name,
        unit_price: item.unit_price,
        quantity: 1,
        fromCatalog: true,
      },
    ]);
    setQuery("");
    setCustomPrice("");
  };

  const addCustomItem = () => {
    const name = query.trim();
    if (!name) return;
    const price = Number(customPrice);
    if (!Number.isFinite(price) || price < 0) {
      toast.error("Indicá un precio válido para el artículo");
      return;
    }
    setLines((prev) => [
      ...prev,
      { key: newKey(), name, unit_price: price, quantity: 1, fromCatalog: false },
    ]);
    setQuery("");
    setCustomPrice("");
  };

  const setQty = (key: string, quantity: number) => {
    setLines((prev) =>
      prev
        .map((l) => (l.key === key ? { ...l, quantity: Math.max(1, quantity) } : l))
        .filter((l) => l.quantity > 0),
    );
  };

  const removeLine = (key: string) => setLines((prev) => prev.filter((l) => l.key !== key));

  const requestFinalize = () => {
    if (!includeService && lines.length === 0) {
      toast.error("Confirmá el servicio o agregá al menos un artículo");
      return;
    }
    if (includeService) {
      const n = Number(servicePrice);
      if (!Number.isFinite(n) || n < 0 || servicePrice.trim() === "") {
        toast.error("Indicá el valor cobrado del servicio (según apreciación)");
        return;
      }
    }
    if (!paymentMethod) {
      toast.error("Indicá el medio de pago");
      return;
    }
    const selected = (payMethods.data ?? []).find((m) => m.code === paymentMethod);
    if (selected?.require_evidence && !evidenceUrl) {
      toast.error(`${selected.label} requiere foto de evidencia del pago`);
      return;
    }
    setConfirmOpen(true);
  };

  const doFinalize = async () => {
    if (!appointment) return;
    setSaving(true);
    try {
      const res = await completeAppointment(appointment.id, {
        include_service: includeService,
        ...(includeService ? { service_price: Number(servicePrice) } : {}),
        lines: lines.map((l) => ({
          name: l.name,
          quantity: l.quantity,
          unit_price: l.unit_price,
        })),
        payment_method: paymentMethod,
        payment_status: markPaid ? "pagado" : "pendiente",
        ...(evidenceUrl ? { payment_evidence_url: evidenceUrl } : {}),
        ...(promo?.valid && promo.code ? { coupon_code: promo.code } : {}),
        ...(promo?.valid && promo.loyalty_reward_id ? { loyalty_reward_id: promo.loyalty_reward_id } : {}),
        ...(promo?.valid && promo.promotion_id && !promo.code ? { promotion_id: promo.promotion_id } : {}),
      });
      const emailed = (res.email_notifications ?? []).filter((n) => n.sent).length;
      const targets = (res.email_notifications ?? []).filter((n) => n.email).length;
      if (res.email_queued) {
        toast.success(
          `Servicio cerrado · factura ${res.invoice_number}. Quedó registrada en Ventas. El correo se envía en segundo plano.`,
        );
      } else if (emailed > 0) {
        toast.success(`Servicio cerrado · factura ${res.invoice_number} enviada a ${emailed} dueño(s) · registrada en Ventas`);
      } else if (!res.smtp_configured && targets > 0) {
        toast.warning(
          `Servicio cerrado · factura ${res.invoice_number} generada, pero SMTP no está configurado: el correo NO se envió. PDF en logs/invoices/`,
        );
      } else if (targets > 0) {
        toast.warning(
          `Servicio cerrado · factura ${res.invoice_number} generada, pero Google rechazó el SMTP (App Password). PDF en logs/invoices/`,
        );
      } else {
        toast.success(`Servicio cerrado · factura ${res.invoice_number} (dueños sin email) · registrada en Ventas`);
      }
      setConfirmOpen(false);
      onOpenChange(false);
      onDone();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        toast.success("El servicio ya estaba cerrado. Recargá la agenda.");
        setConfirmOpen(false);
        onOpenChange(false);
        onDone();
      } else {
        const msg =
          e instanceof Error && e.message.trim()
            ? e.message
            : "No se pudo finalizar el servicio. Revisá la agenda o reintentá.";
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  if (!appointment) return null;

  return (
    <>
      <Dialog open={open && !confirmOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-3xl border-border/80 p-0 shadow-lift">
          <div className="bg-gradient-to-br from-primary/12 via-blush/40 to-background px-6 pb-4 pt-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/80">
              Cierre de servicio
            </p>
            <h3 className="mt-1 font-display text-2xl font-bold text-primary">
              {appointment.pets?.name ?? "Mascota"}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {appointment.services?.name ?? "Servicio"} · {time(appointment.starts_at)}
              {appointment.pets?.owners?.full_name
                ? ` · ${appointment.pets.owners.full_name}`
                : ""}
            </p>
          </div>

          <div className="space-y-5 px-6 py-5">
            {appointment.service_id && appointment.pet_id ? (
              <MaterialEstimatePanel
                appointmentId={appointment.id}
                serviceId={appointment.service_id}
                petId={appointment.pet_id}
                compact
                onBillableChange={() => void reloadBillableExtras()}
              />
            ) : null}

            <label className="flex cursor-pointer flex-col gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-sm shadow-soft sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={includeService}
                  onChange={(e) => setIncludeService(e.target.checked)}
                />
                <span className="min-w-0 flex-1">
                  Incluir servicio en la factura
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {appointment.services?.name ?? "Servicio prestado"} · valor según apreciación
                  </span>
                </span>
              </div>
              <Input
                type="number"
                min={0}
                step={1000}
                disabled={!includeService}
                className="h-10 w-full rounded-xl sm:w-36"
                placeholder="Cobrado $"
                value={servicePrice}
                onChange={(e) => setServicePrice(e.target.value)}
              />
            </label>

            <PaymentMethodFields
              methods={payMethods.data ?? []}
              methodCode={paymentMethod}
              onMethodChange={setPaymentMethod}
              evidenceUrl={evidenceUrl}
              onEvidenceUrl={setEvidenceUrl}
            />

            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border px-4 py-3 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={markPaid}
                onChange={(e) => setMarkPaid(e.target.checked)}
              />
              <span>
                Pagado en mostrador (listo y pagado)
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  La mascota puede retirarse; la factura queda como pagada.
                </span>
              </span>
            </label>

            <CouponApplyFields
              subtotal={grandTotal}
              customerId={ownerId}
              petId={appointment.pet_id}
              serviceIds={appointment.service_id ? [appointment.service_id] : []}
              value={promo}
              onChange={setPromo}
              rewards={loyalty.data?.available ?? []}
            />

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Extras (shoots + vitrina)
              </p>
              <p className="mb-2 text-xs text-muted-foreground">
                Incluye adicionales por dosis y productos de vitrina ya agregados a la cita.
              </p>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && suggestions[0]) {
                      e.preventDefault();
                      addCatalogItem(suggestions[0]);
                    }
                  }}
                  placeholder="Escribí: galletas, collar, BARF…"
                  className="h-12 rounded-2xl border-border/80 bg-card pl-10 shadow-soft"
                />
              </div>

              {suggestions.length > 0 ? (
                <ul className="mt-2 overflow-hidden rounded-2xl border border-border bg-card shadow-lift">
                  {suggestions.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-secondary/60"
                        onClick={() => addCatalogItem(item)}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{item.name}</span>
                          <span className="text-[11px] text-muted-foreground">{item.category}</span>
                        </span>
                        <span className="shrink-0 text-xs font-medium text-accent">
                          {cop(item.unit_price)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}

              {showCustomHint ? (
                <div className="mt-2 flex flex-wrap items-end gap-2 rounded-2xl border border-dashed border-border bg-secondary/30 p-3">
                  <div className="min-w-[140px] flex-1">
                    <p className="mb-1 text-[11px] text-muted-foreground">Artículo libre</p>
                    <p className="truncate text-sm font-medium">{query.trim()}</p>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    placeholder="Precio"
                    className="h-10 w-28 rounded-xl"
                    value={customPrice}
                    onChange={(e) => setCustomPrice(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCustomItem();
                      }
                    }}
                  />
                  <Button type="button" className="h-10 rounded-xl" onClick={addCustomItem}>
                    Agregar
                  </Button>
                </div>
              ) : null}
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                En la factura
              </p>
              {lines.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                  Los artículos que elijas aparecerán acá para ajustar unidades.
                </p>
              ) : (
                <ul className="space-y-2">
                  {lines.map((line) => (
                    <li
                      key={line.key}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2.5 shadow-soft"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{line.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {cop(line.unit_price)} c/u · {cop(line.unit_price * line.quantity)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-lg"
                          onClick={() => setQty(line.key, line.quantity - 1)}
                          disabled={line.quantity <= 1}
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                        <span className="w-8 text-center text-sm font-semibold">{line.quantity}</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-lg"
                          onClick={() => setQty(line.key, line.quantity + 1)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10"
                          onClick={() => removeLine(line.key)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <div>
                <p className="text-xs text-muted-foreground">Total estimado</p>
                <p className="font-display text-xl font-bold text-primary">{cop(netTotal)}</p>
                {discount > 0 ? (
                  <p className="text-xs text-muted-foreground">Antes {cop(grandTotal)}</p>
                ) : null}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button className="rounded-xl" onClick={requestFinalize}>
                  Finalizar servicio
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
            <FileText className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-center font-display text-xl font-bold text-primary">
            ¿Confirmás el cierre?
          </h3>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Se marcará el servicio como finalizado, se registrará la factura{" "}
            <span className="font-medium text-foreground">{cop(netTotal)}</span> y se enviará un
            PDF por correo a los dueños de {appointment.pets?.name ?? "la mascota"}.
          </p>
          <ul className="mt-4 space-y-1.5 rounded-2xl bg-secondary/50 px-4 py-3 text-sm">
            {includeService ? (
              <li className="flex justify-between gap-2">
                <span className="truncate text-muted-foreground">
                  {appointment.services?.name ?? "Servicio"}
                </span>
                <span>{cop(serviceTotal)}</span>
              </li>
            ) : null}
            {lines.map((l) => (
              <li key={l.key} className="flex justify-between gap-2">
                <span className="truncate text-muted-foreground">
                  {l.quantity}× {l.name}
                </span>
                <span>{cop(l.unit_price * l.quantity)}</span>
              </li>
            ))}
            <li className="flex justify-between gap-2 pt-1 text-muted-foreground">
              <span>Medio de pago</span>
              <span className="font-medium text-foreground">
                {(payMethods.data ?? []).find((m) => m.code === paymentMethod)?.label ?? paymentMethod}
              </span>
            </li>
          </ul>
          <div className="mt-5 flex gap-2">
            <Button
              variant="outline"
              className="h-11 flex-1 rounded-xl"
              disabled={saving}
              onClick={() => setConfirmOpen(false)}
            >
              Volver
            </Button>
            <Button
              className="h-11 flex-1 rounded-xl"
              disabled={saving}
              onClick={() => void doFinalize()}
            >
              <Check className="mr-2 h-4 w-4" />
              {saving ? "Enviando…" : "Confirmar y enviar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
