import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, MessageCircle, QrCode, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { uploadPhoto, resolveMediaUrl } from "@/lib/api";
import {
  boldWhatsAppPaymentMessage,
  isBoldPaymentMethod,
  type BoldChannel,
} from "@/lib/bold-payment-message";
import { cop } from "@/lib/format";
import {
  TECH_SERVICES_LABEL,
  formatPaymentCommissionTariff,
  paymentChargeBreakdown,
  paymentMethodSelectLabel,
} from "@/lib/payment-fee";
import {
  createBoldPaymentLink,
  fetchBoldPaymentLink,
  type PaymentMethod,
} from "@/lib/spa-queries";
import { buildWhatsAppLink } from "@/lib/whatsapp-link";

function boldLinkIdFromUrl(url: string | null | undefined): string | null {
  const m = String(url || "").match(/LNK_[A-Z0-9]+/i);
  return m ? m[0].toUpperCase() : null;
}

export type BoldCheckoutContext = {
  petName?: string | null;
  serviceName?: string | null;
  ownerName?: string | null;
  ownerPhone?: string | null;
  ownerWhatsapp?: string | null;
  ownerPiiMasked?: boolean | null;
  tradeName?: string | null;
  /** URL de sesión Bold cuando exista la pasarela; opcional hoy. */
  paymentSessionUrl?: string | null;
  appointmentId?: string | null;
  saleId?: string | null;
};

type Props = {
  methods: PaymentMethod[];
  methodCode: string;
  onMethodChange: (code: string) => void;
  evidenceUrl: string;
  onEvidenceUrl: (url: string) => void;
  disabled?: boolean;
  /** Neto del servicio/productos (antes de comisión del medio). */
  baseTotal?: number;
  /** Contexto para canales Bold (aparato / WhatsApp). */
  boldContext?: BoldCheckoutContext | null;
  boldChannel?: BoldChannel;
  onBoldChannelChange?: (channel: BoldChannel) => void;
  /** Cuando poll/webhook confirma PAID — p.ej. marcar checkbox pagado. */
  onBoldPaid?: () => void;
};

export function PaymentMethodFields({
  methods,
  methodCode,
  onMethodChange,
  evidenceUrl,
  onEvidenceUrl,
  disabled,
  baseTotal,
  boldContext,
  boldChannel: boldChannelProp,
  onBoldChannelChange,
  onBoldPaid,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  const [checkBusy, setCheckBusy] = useState(false);
  const [liveSessionUrl, setLiveSessionUrl] = useState<string | null>(null);
  const [linkStatus, setLinkStatus] = useState<string | null>(null);
  const [localChannel, setLocalChannel] = useState<BoldChannel>("device");
  const selected = methods.find((m) => m.code === methodCode);
  const needsEvidence = Boolean(selected?.require_evidence);
  const base = typeof baseTotal === "number" ? baseTotal : null;
  const charge =
    base != null && selected
      ? paymentChargeBreakdown(base, selected)
      : null;
  const showBoldChannels = isBoldPaymentMethod(selected) && Boolean(boldContext);
  const channel = boldChannelProp ?? localChannel;

  const setChannel = (next: BoldChannel) => {
    if (onBoldChannelChange) onBoldChannelChange(next);
    else setLocalChannel(next);
  };

  useEffect(() => {
    if (!showBoldChannels) return;
    setLocalChannel("device");
    setLiveSessionUrl(null);
    setLinkStatus(null);
  }, [showBoldChannels, methodCode, base]);

  const sessionUrl = liveSessionUrl || boldContext?.paymentSessionUrl || null;
  const liveLinkId = boldLinkIdFromUrl(sessionUrl);

  const checkBoldPayment = async () => {
    const lid = liveLinkId;
    if (!lid) {
      toast.error("Primero abrí WhatsApp (o creá el link) para tener un LNK_…");
      return;
    }
    setCheckBusy(true);
    try {
      const st = await fetchBoldPaymentLink(lid);
      setLinkStatus(st.status);
      if (st.paid) {
        toast.success(`Bold: PAID · ${cop(Number(st.total) || 0)}`);
        onBoldPaid?.();
      } else {
        toast.message(
          `Bold: ${st.status || "sin estado"}${st.transaction_id ? ` · tx ${st.transaction_id}` : ""}`,
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo consultar Bold");
    } finally {
      setCheckBusy(false);
    }
  };

  const onPick = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const up = await uploadPhoto(file);
      onEvidenceUrl(up.url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo subir la evidencia");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  };

  const openBoldWhatsApp = async () => {
    if (!selected || !charge || !boldContext) return;
    if (boldContext.ownerPiiMasked) {
      toast.error("El WhatsApp del dueño está oculto para este rol. Pedile a un admin.");
      return;
    }
    setLinkBusy(true);
    let payUrl = sessionUrl;
    try {
      if (!payUrl) {
        const link = await createBoldPaymentLink({
          amount: charge.amountDue,
          description: [
            boldContext.tradeName || "Spa Kira",
            boldContext.petName,
            boldContext.serviceName,
          ]
            .filter(Boolean)
            .join(" · "),
          appointment_id: boldContext.appointmentId || undefined,
          sale_id: boldContext.saleId || undefined,
        });
        payUrl = link.url;
        setLiveSessionUrl(link.url);
      }
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "No se pudo crear el link Bold. Revisá la llave sandbox.",
      );
      setLinkBusy(false);
      return;
    } finally {
      setLinkBusy(false);
    }
    const message = boldWhatsAppPaymentMessage({
      ownerName: boldContext.ownerName,
      petName: boldContext.petName,
      serviceName: boldContext.serviceName,
      tradeName: boldContext.tradeName,
      serviceTotal: charge.serviceTotal,
      fee: charge.passToClient ? charge.fee : 0,
      amountDue: charge.amountDue,
      method: selected,
      paymentSessionUrl: payUrl,
    });
    const href = buildWhatsAppLink(
      boldContext.ownerWhatsapp || boldContext.ownerPhone,
      message,
    );
    if (!href) {
      toast.error("No hay WhatsApp ni teléfono en la ficha del dueño.");
      return;
    }
    window.open(href, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Medio de pago</Label>
        <Select value={methodCode || undefined} onValueChange={onMethodChange} disabled={disabled}>
          <SelectTrigger className="h-11 rounded-xl">
            <SelectValue placeholder="Elegí cómo pagó" />
          </SelectTrigger>
          <SelectContent>
            {methods.map((m) => (
              <SelectItem key={m.code} value={m.code}>
                {paymentMethodSelectLabel(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selected && charge && (charge.passToClient ? charge.clientSurcharge > 0 : charge.mediumTariff > 0) ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          <p className="font-medium">
            {selected.label}
            {formatPaymentCommissionTariff(selected)
              ? ` · tarifa ${formatPaymentCommissionTariff(selected)}`
              : ""}
          </p>
          <p className="mt-0.5 text-amber-900/80">
            {charge.passToClient
              ? `Cargo al cliente «${TECH_SERVICES_LABEL}».`
              : "Sin cargo al cliente: la tarifa entra como costo (baja el margen)."}
          </p>
          <p className="mt-1 tabular-nums">
            {charge.passToClient ? (
              <>
                Servicio {cop(charge.serviceTotal)} + {TECH_SERVICES_LABEL}{" "}
                {cop(charge.clientSurcharge)} ={" "}
                <span className="font-semibold">cobrar {cop(charge.amountDue)}</span>
              </>
            ) : (
              <>
                Cobrar {cop(charge.amountDue)}
                <span className="text-amber-900/70">
                  {" "}
                  · costo {cop(charge.mediumTariff)}
                </span>
              </>
            )}
          </p>
        </div>
      ) : null}

      {showBoldChannels && charge ? (
        <div className="space-y-3 rounded-2xl border border-dashed border-border bg-secondary/20 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Canal Bold
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => setChannel("device")}
              className={`rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                channel === "device"
                  ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                  : "border-border bg-card hover:bg-secondary/50"
              }`}
            >
              <span className="flex items-center gap-2 font-medium">
                <QrCode className="h-4 w-4 text-primary" />
                Aparato Bold (QR / datáfono)
              </span>
              <span className="mt-1 block text-[11px] text-muted-foreground">
                El cliente paga en el dispositivo de la recepción
              </span>
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => setChannel("whatsapp")}
              className={`rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                channel === "whatsapp"
                  ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                  : "border-border bg-card hover:bg-secondary/50"
              }`}
            >
              <span className="flex items-center gap-2 font-medium">
                <MessageCircle className="h-4 w-4 text-primary" />
                Link por WhatsApp
              </span>
              <span className="mt-1 block text-[11px] text-muted-foreground">
                Abre WhatsApp con monto, detalle y texto listo
              </span>
            </button>
          </div>

          {channel === "device" ? (
            <div className="flex gap-3 rounded-xl bg-slate-100 px-3 py-2.5 text-xs text-slate-700">
              <div
                className="h-12 w-12 shrink-0 rounded-lg opacity-70"
                style={{
                  background:
                    "repeating-linear-gradient(90deg,#0f172a 0 4px,#fff 4px 8px), repeating-linear-gradient(#0f172a 0 4px,#fff 4px 8px)",
                  backgroundBlendMode: "multiply",
                }}
                aria-hidden
              />
              <p>
                Cobrás{" "}
                <span className="font-semibold text-foreground">{cop(charge.amountDue)}</span> en
                el Bold de mostrador (servicio + comisión). Cuando el aparato confirme, marcá
                pagado y finalizá.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] text-muted-foreground">Vista previa del mensaje</p>
              <pre className="whitespace-pre-wrap rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 font-sans text-xs leading-relaxed text-emerald-950">
                {boldWhatsAppPaymentMessage({
                  ownerName: boldContext?.ownerName,
                  petName: boldContext?.petName,
                  serviceName: boldContext?.serviceName,
                  tradeName: boldContext?.tradeName,
                  serviceTotal: charge.serviceTotal,
                  fee: charge.passToClient ? charge.fee : 0,
                  amountDue: charge.amountDue,
                  method: selected!,
                  paymentSessionUrl: sessionUrl,
                })}
              </pre>
              <Button
                type="button"
                className="h-10 w-full rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
                disabled={disabled || linkBusy || !charge.amountDue}
                onClick={() => void openBoldWhatsApp()}
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                {linkBusy ? "Creando link Bold…" : "Abrir WhatsApp con link Bold"}
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Al abrir se crea el link Bold por el total a cobrar ({cop(charge.amountDue)}).
              </p>
              <Button
                type="button"
                variant="outline"
                className="h-10 w-full rounded-xl"
                disabled={disabled || checkBusy || !liveLinkId}
                onClick={() => void checkBoldPayment()}
              >
                {checkBusy ? "Consultando Bold…" : "Verificar pago en Bold"}
              </Button>
              {linkStatus ? (
                <p className="text-[11px] tabular-nums text-muted-foreground">
                  Estado link: <span className="font-medium text-foreground">{linkStatus}</span>
                  {linkStatus === "PAID" ? " · listo para marcar pagado" : " · ACTIVE = aún no pagó"}
                </p>
              ) : null}
              <p className="text-[11px] text-muted-foreground">
                En sandbox Bold no manda webhook: hay que consultar el estado. En prod usamos
                webhook SALE_APPROVED.
              </p>
            </div>
          )}
        </div>
      ) : null}

      {needsEvidence ? (
        <div className="rounded-2xl border border-dashed border-border bg-secondary/30 p-3">
          <p className="text-xs text-muted-foreground">
            {selected?.label} requiere foto del comprobante (captura o archivo).
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => void onPick(e.target.files?.[0])}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => void onPick(e.target.files?.[0])}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl"
              disabled={disabled || uploading}
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus className="mr-2 h-4 w-4" />
              Adjuntar archivo
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl"
              disabled={disabled || uploading}
              onClick={() => cameraRef.current?.click()}
            >
              <Camera className="mr-2 h-4 w-4" />
              {uploading ? "Subiendo…" : "Abrir cámara"}
            </Button>
          </div>
          {evidenceUrl ? (
            <div className="relative mt-3 inline-block">
              <img
                src={resolveMediaUrl(evidenceUrl)}
                alt="Evidencia de pago"
                className="h-24 w-24 rounded-xl object-cover ring-1 ring-border"
              />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute -right-2 -top-2 h-7 w-7 rounded-full"
                onClick={() => onEvidenceUrl("")}
                disabled={disabled}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
