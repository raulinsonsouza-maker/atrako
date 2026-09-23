import type { Organization, PaymentProvider } from "@prisma/client";
import { ASAAS_ENABLED, CAKTO_ENABLED } from "@/lib/feature-flags";

export type ResolvedPaymentProvider = PaymentProvider | "DEMO";

type OrgPaymentConfig = Pick<
  Organization,
  | "paymentProvider"
  | "caktoClientId"
  | "caktoClientSecret"
  | "caktoOfferId"
  | "mercadoPagoAccessToken"
  | "mercadoPagoPublicKey"
  | "asaasApiKey"
>;

export function isCaktoReady(org: Pick<Organization, "caktoClientId" | "caktoClientSecret" | "caktoOfferId">) {
  return Boolean(org.caktoClientId && org.caktoClientSecret && org.caktoOfferId);
}

export function isMercadoPagoReady(
  org: Pick<Organization, "mercadoPagoAccessToken" | "mercadoPagoPublicKey">,
) {
  return Boolean(org.mercadoPagoAccessToken && org.mercadoPagoPublicKey);
}

export function isAsaasReady(org: Pick<Organization, "asaasApiKey">) {
  return ASAAS_ENABLED && Boolean(org.asaasApiKey?.trim());
}

export function resolvePaymentProvider(org: OrgPaymentConfig): ResolvedPaymentProvider {
  if (org.paymentProvider === "ASAAS") {
    return isAsaasReady(org) ? "ASAAS" : "DEMO";
  }
  if (org.paymentProvider === "MERCADO_PAGO") {
    return isMercadoPagoReady(org) ? "MERCADO_PAGO" : "DEMO";
  }
  if (org.paymentProvider === "CAKTO") {
    if (CAKTO_ENABLED && isCaktoReady(org)) return "CAKTO";
    if (isAsaasReady(org)) return "ASAAS";
    if (isMercadoPagoReady(org)) return "MERCADO_PAGO";
    return "DEMO";
  }
  return "DEMO";
}

export function requiresOnlinePayment(org: OrgPaymentConfig): boolean {
  return resolvePaymentProvider(org) !== "DEMO";
}

export function paymentProviderLabel(provider: ResolvedPaymentProvider) {
  if (provider === "MERCADO_PAGO") return "Mercado Pago";
  if (provider === "ASAAS") return "Asaas";
  if (provider === "CAKTO") return "Cakto";
  return "Demo";
}

export function webhookUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path}`;
}
