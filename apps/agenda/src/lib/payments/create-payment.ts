import type { Organization, PaymentProvider } from "@prisma/client";
import {
  createPixPayment,
  createCardPayment,
} from "@/lib/cakto/client";
import {
  createMercadoPagoPixPayment,
  createMercadoPagoCardPayment,
  isMercadoPagoPaidStatus,
} from "@/lib/mercadopago/client";
import { ensureMercadoPagoAccessToken } from "@/lib/mercadopago/oauth";
import {
  createAsaasCardPayment,
  createAsaasPixPayment,
  isAsaasPaidStatus,
  parseAsaasCardToken,
} from "@/lib/asaas/client";
import {
  createDemoPixPayment,
  createDemoCardPayment,
} from "@/lib/payments/demo";
import type { ResolvedPaymentProvider } from "@/lib/payments/resolve-provider";

export type PaymentCustomer = {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerCpf: string | null;
};

export type PaymentItem = {
  title: string;
  priceCents: number;
  caktoOfferId: string | null;
};

function buildCustomer(
  customer: PaymentCustomer,
  fingerprint: string,
) {
  const cpf = customer.customerCpf || "00000000000";
  return {
    name: customer.customerName,
    email: customer.customerEmail,
    phone: customer.customerPhone.startsWith("55")
      ? customer.customerPhone
      : `55${customer.customerPhone}`,
    fingerprint,
    docType: "cpf" as const,
    docNumber: cpf,
  };
}

export function dbProvider(provider: ResolvedPaymentProvider): PaymentProvider {
  if (provider === "MERCADO_PAGO") return "MERCADO_PAGO";
  if (provider === "ASAAS") return "ASAAS";
  return "CAKTO";
}

export async function createPixForProvider(params: {
  provider: ResolvedPaymentProvider;
  org: Organization;
  customer: PaymentCustomer;
  item: PaymentItem;
  idempotencyKey: string;
  fingerprint: string;
  metadata?: Record<string, string>;
}) {
  const { provider, org, customer, item, idempotencyKey, fingerprint, metadata } = params;

  if (provider === "ASAAS" && org.asaasApiKey) {
    const result = await createAsaasPixPayment({
      apiKey: org.asaasApiKey,
      amountCents: item.priceCents,
      description: item.title,
      externalReference: customer.id,
      payer: {
        email: customer.customerEmail,
        name: customer.customerName,
        phone: customer.customerPhone,
        cpf: customer.customerCpf || undefined,
      },
    });
    return { ...result, demo: false as const };
  }

  if (provider === "MERCADO_PAGO" && org.mercadoPagoAccessToken) {
    const accessToken =
      (await ensureMercadoPagoAccessToken(org.id)) || org.mercadoPagoAccessToken;
    const result = await createMercadoPagoPixPayment({
      accessToken,
      amountCents: item.priceCents,
      description: item.title,
      bookingId: customer.id,
      idempotencyKey,
      payer: {
        email: customer.customerEmail,
        name: customer.customerName,
        cpf: customer.customerCpf || undefined,
      },
    });
    return { ...result, demo: false as const };
  }

  const offerId = item.caktoOfferId || org.caktoOfferId;
  if (provider === "CAKTO" && org.caktoClientId && org.caktoClientSecret && offerId) {
    const result = await createPixPayment({
      creds: {
        clientId: org.caktoClientId,
        clientSecret: org.caktoClientSecret,
      },
      offerId,
      customer: buildCustomer(customer, fingerprint),
      idempotencyKey,
      metadata: metadata || { bookingId: customer.id },
    });
    return { ...result, demo: false as const };
  }

  return createDemoPixPayment(idempotencyKey);
}

export async function createCardForProvider(params: {
  provider: ResolvedPaymentProvider;
  org: Organization;
  customer: PaymentCustomer;
  item: PaymentItem;
  idempotencyKey: string;
  fingerprint: string;
  cardToken: string;
  installments?: number;
  metadata?: Record<string, string>;
  remoteIp?: string;
}) {
  const {
    provider,
    org,
    customer,
    item,
    idempotencyKey,
    fingerprint,
    cardToken,
    installments,
    metadata,
    remoteIp,
  } = params;

  if (cardToken.startsWith("demo_")) {
    return createDemoCardPayment(idempotencyKey);
  }

  if (provider === "ASAAS" && org.asaasApiKey) {
    const creditCard = parseAsaasCardToken(cardToken);
    if (!creditCard) {
      throw new Error("Dados do cartão inválidos para Asaas");
    }
    const result = await createAsaasCardPayment({
      apiKey: org.asaasApiKey,
      amountCents: item.priceCents,
      description: item.title,
      externalReference: customer.id,
      creditCard,
      remoteIp,
      installments: installments || 1,
      payer: {
        email: customer.customerEmail,
        name: customer.customerName,
        phone: customer.customerPhone,
        cpf: customer.customerCpf || undefined,
      },
    });
    return { ...result, demo: false as const };
  }

  if (provider === "MERCADO_PAGO" && org.mercadoPagoAccessToken) {
    const accessToken =
      (await ensureMercadoPagoAccessToken(org.id)) || org.mercadoPagoAccessToken;
    const result = await createMercadoPagoCardPayment({
      accessToken,
      amountCents: item.priceCents,
      description: item.title,
      bookingId: customer.id,
      idempotencyKey,
      cardToken,
      installments: installments || 1,
      payer: {
        email: customer.customerEmail,
        name: customer.customerName,
        cpf: customer.customerCpf || undefined,
      },
    });
    return { ...result, demo: false as const };
  }

  const offerId = item.caktoOfferId || org.caktoOfferId;
  if (provider === "CAKTO" && org.caktoClientId && org.caktoClientSecret && offerId) {
    const result = await createCardPayment({
      creds: {
        clientId: org.caktoClientId,
        clientSecret: org.caktoClientSecret,
      },
      offerId,
      customer: buildCustomer(customer, fingerprint),
      cardToken,
      idempotencyKey,
      metadata: metadata || { bookingId: customer.id },
    });
    return { ...result, demo: false as const };
  }

  return createDemoCardPayment(idempotencyKey);
}

export function isPaidResult(
  provider: ResolvedPaymentProvider,
  result: { status: string; demo?: boolean },
) {
  if (result.demo) return true;
  if (provider === "MERCADO_PAGO") {
    return isMercadoPagoPaidStatus(result.status);
  }
  if (provider === "ASAAS") {
    return isAsaasPaidStatus(result.status);
  }
  return ["paid", "approved", "captured", "success"].includes(
    String(result.status).toLowerCase(),
  );
}

export class HoldExpiredError extends Error {
  constructor() {
    super("Hold expirado");
    this.name = "HoldExpiredError";
  }
}

export function assertHoldValid(entity: { holdExpiresAt: Date | null }) {
  if (entity.holdExpiresAt && entity.holdExpiresAt.getTime() < Date.now()) {
    throw new HoldExpiredError();
  }
}
