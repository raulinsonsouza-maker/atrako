import { NextRequest, NextResponse } from "next/server";
import { stripe, priceToPlan } from "@/lib/stripe";
import { db } from "@/lib/db";
import Stripe from "stripe";

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
  if (!stripe || !WEBHOOK_SECRET) {
    return NextResponse.json({ message: "Stripe não configurado" }, { status: 500 });
  }

  let payload: string;
  try {
    payload = await req.text();
  } catch {
    return NextResponse.json({ message: "Body inválido" }, { status: 400 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ message: "Assinatura ausente" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, sig, WEBHOOK_SECRET);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao verificar assinatura";
    return NextResponse.json({ message: msg }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;

        const tenantId = session.client_reference_id;
        if (!tenantId) break;

        const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
        const subId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
        if (!customerId || !subId) break;

        let plan: "STARTER" | "PRO" | "ENTERPRISE" = "STARTER";
        try {
          const sub = await stripe.subscriptions.retrieve(subId);
          const priceId = sub.items.data[0]?.price?.id;
          if (priceId) plan = priceToPlan(priceId);
        } catch {
          // mantém STARTER se falhar ao obter preço
        }

        await db.tenant.update({
          where: { id: tenantId },
          data: {
            stripeCustomerId: customerId,
            stripeSubscriptionId: subId,
            plan,
            status: "ACTIVE",
          },
        });
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
        if (!customerId) break;

        const tenant = await db.tenant.findFirst({
          where: { stripeCustomerId: customerId },
        });
        if (!tenant) break;

        const priceId = sub.items.data[0]?.price?.id;
        const plan = priceId ? priceToPlan(priceId) : tenant.plan;

        await db.tenant.update({
          where: { id: tenant.id },
          data: {
            stripeSubscriptionId: sub.id,
            plan,
          },
        });
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
        if (!customerId) break;

        await db.tenant.updateMany({
          where: { stripeCustomerId: customerId },
          data: {
            stripeSubscriptionId: null,
            status: "CANCELLED",
          },
        });
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (!customerId) break;
        // Log; opcional: após N falhas, marcar status SUSPENDED (ex. via metadata ou contagem)
        console.warn("[Stripe] invoice.payment_failed", { customerId, invoiceId: invoice.id });
        break;
      }

      default:
        break;
    }
  } catch (e) {
    console.error("[Stripe webhook]", event.type, e);
    return NextResponse.json({ message: "Erro ao processar" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
