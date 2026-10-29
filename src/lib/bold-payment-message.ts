import { cop } from "@/lib/format";
import { formatPaymentCommissionTariff } from "@/lib/payment-fee";
import type { PaymentMethod } from "@/lib/spa-queries";

export type BoldChannel = "device" | "whatsapp";

export function isBoldPaymentMethod(method: PaymentMethod | null | undefined): boolean {
  return (method?.code || "").toLowerCase() === "bold";
}

/** Texto listo para wa.me (opción A). Sin sesión Bold aún: monto + instrucción. */
export function boldWhatsAppPaymentMessage(opts: {
  ownerName?: string | null;
  petName?: string | null;
  serviceName?: string | null;
  tradeName?: string | null;
  serviceTotal: number;
  fee: number;
  amountDue: number;
  method: PaymentMethod;
  paymentSessionUrl?: string | null;
}): string {
  const owner = (opts.ownerName || "").trim() || "hola";
  const pet = (opts.petName || "tu mascota").trim();
  const service = (opts.serviceName || "servicio").trim();
  const trade = (opts.tradeName || "Spa Kira").trim();
  const tariff = formatPaymentCommissionTariff(opts.method);
  const feeLine =
    opts.fee > 0
      ? `Comisión pasarela Bold${tariff ? ` (${tariff})` : ""}: ${cop(opts.fee)}`
      : null;
  const link = (opts.paymentSessionUrl || "").trim();
  const payBlock = link
    ? `Para realizar tu pago hacé clic aquí:\n${link}`
    : "Para pagar: respondé este mensaje y te enviamos el link Bold, o pagá en el aparato del spa con el monto de arriba.";

  return [
    `Hola ${owner} 👋`,
    `Te escribimos de *${trade}* por el servicio de *${pet}* (${service}).`,
    "",
    `Servicio: ${cop(opts.serviceTotal)}`,
    ...(feeLine ? [feeLine] : []),
    `Total a pagar: *${cop(opts.amountDue)}*`,
    "",
    payBlock,
    "",
    "¡Gracias!",
  ].join("\n");
}
