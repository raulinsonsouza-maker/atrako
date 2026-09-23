import type { Organization, PaymentProvider } from "@prisma/client";
import {
  getAsaasPayment,
  isAsaasPaidStatus,
} from "@/lib/asaas/client";
import {
  getMercadoPagoPayment,
  isMercadoPagoPaidStatus,
} from "@/lib/mercadopago/client";
import { ensureMercadoPagoAccessToken } from "@/lib/mercadopago/oauth";

/**
 * Consulta o provedor se o pagamento remoto já está pago (webhook atrasado).
 * Usado por agendamento e checkout, para Pix e cartão.
 */
export async function isRemotePaymentPaid(params: {
  provider: PaymentProvider;
  providerPaymentId: string;
  org: Pick<
    Organization,
    | "id"
    | "mercadoPagoAccessToken"
    | "asaasApiKey"
  >;
}): Promise<boolean> {
  const { provider, providerPaymentId, org } = params;
  if (!providerPaymentId || providerPaymentId.startsWith("demo_")) {
    return false;
  }

  if (provider === "MERCADO_PAGO") {
    const token =
      (await ensureMercadoPagoAccessToken(org.id)) ||
      org.mercadoPagoAccessToken;
    if (!token) return false;
    const mp = await getMercadoPagoPayment(token, providerPaymentId);
    return isMercadoPagoPaidStatus(mp.status);
  }

  if (provider === "ASAAS") {
    if (!org.asaasApiKey) return false;
    const asaas = await getAsaasPayment(org.asaasApiKey, providerPaymentId);
    return isAsaasPaidStatus(asaas.status);
  }

  // Cakto / outros: sem consulta ativa — dependem do webhook.
  return false;
}
