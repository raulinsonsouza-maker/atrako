"use server";

import { redirect } from "next/navigation";
import type Stripe from "stripe";
import { getSession } from "@/lib/auth-server";
import { db } from "@/lib/db";
import { stripe, priceToPlan } from "@/lib/stripe";

const BASE = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function getTenantBillingInfo(tenantId: string) {
  const session = await getSession();
  if (!session?.user) return null;
  const tid = (session.user as { tenantId?: string | null }).tenantId;
  if (tid !== tenantId) return null;

  const t = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, plan: true, stripeCustomerId: true, stripeSubscriptionId: true },
  });
  return t;
}

export async function createCheckoutSession(tenantId: string, email: string, plan: "STARTER" | "PRO" | "ENTERPRISE") {
  const session = await getSession();
  if (!session?.user) throw new Error("Não autorizado");
  const tid = (session.user as { tenantId?: string | null }).tenantId;
  if (tid !== tenantId) throw new Error("Tenant inválido");

  if (!stripe) throw new Error("Stripe não configurado.");
  const priceId =
    plan === "PRO" ? process.env.STRIPE_PRICE_PRO
    : plan === "ENTERPRISE" ? process.env.STRIPE_PRICE_ENTERPRISE
    : process.env.STRIPE_PRICE_STARTER;
  if (!priceId) throw new Error("Preço não configurado para este plano.");

  const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new Error("Tenant não encontrado.");

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${BASE}/dashboard/billing?success=1`,
    cancel_url: `${BASE}/dashboard/billing?cancel=1`,
    client_reference_id: tenantId,
  };
  if (tenant.stripeCustomerId) {
    params.customer = tenant.stripeCustomerId;
  } else {
    params.customer_email = email || undefined;
  }

  const s = await stripe.checkout.sessions.create(params);
  if (s.url) redirect(s.url);
  throw new Error("Não foi possível criar a sessão.");
}

export async function createPortalLink(tenantId: string): Promise<string> {
  const session = await getSession();
  if (!session?.user) throw new Error("Não autorizado");
  const tid = (session.user as { tenantId?: string | null }).tenantId;
  if (tid !== tenantId) throw new Error("Tenant inválido");

  if (!stripe) throw new Error("Stripe não configurado.");
  const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant?.stripeCustomerId) throw new Error("Ative uma assinatura antes.");

  const s = await stripe.billingPortal.sessions.create({
    customer: tenant.stripeCustomerId,
    return_url: `${BASE}/dashboard/billing`,
  });
  return s.url;
}

export { priceToPlan };
