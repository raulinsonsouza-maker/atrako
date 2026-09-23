import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setOrgSubscriptionStatus } from "@/lib/billing/platform";

type MpWebhookBody = {
  type?: string;
  action?: string;
  data?: { id?: string };
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as MpWebhookBody;
    const preapprovalId = body.data?.id;
    if (!preapprovalId) {
      return NextResponse.json({ ok: true });
    }

    const sub = await prisma.subscription.findFirst({
      where: { mpPreapprovalId: String(preapprovalId) },
    });
    if (!sub) {
      return NextResponse.json({ ok: true });
    }

    const type = body.type || "";
    const action = body.action || "";

    if (
      type.includes("subscription") ||
      type.includes("preapproval") ||
      action.includes("subscription")
    ) {
      if (action.includes("cancel") || action.includes("paused")) {
        await setOrgSubscriptionStatus(sub.organizationId, "CANCELED");
      } else if (action.includes("payment") && action.includes("failed")) {
        await setOrgSubscriptionStatus(sub.organizationId, "PAST_DUE");
      } else if (
        action.includes("authorized") ||
        action.includes("payment") ||
        action.includes("created")
      ) {
        const periodEnd = new Date();
        periodEnd.setMonth(periodEnd.getMonth() + 1);
        await prisma.subscription.update({
          where: { id: sub.id },
          data: {
            status: "ACTIVE",
            currentPeriodEnd: periodEnd,
            trialEndsAt: null,
          },
        });
        await setOrgSubscriptionStatus(sub.organizationId, "ACTIVE");

        const plan = sub.planId
          ? await prisma.plan.findUnique({ where: { id: sub.planId } })
          : null;
        if (plan) {
          await prisma.platformPayment.create({
            data: {
              organizationId: sub.organizationId,
              amountCents: plan.priceCents,
              status: "paid",
              mpPaymentId: String(preapprovalId),
              description: `Assinatura ${plan.name}`,
            },
          });
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[mp-platform-webhook]", e);
    return NextResponse.json({ error: "webhook error" }, { status: 500 });
  }
}
