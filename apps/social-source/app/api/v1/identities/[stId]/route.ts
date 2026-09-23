import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  isAuthError,
  requirePublicApiOrg,
} from "@/lib/symbius/attribution/auth";

type Ctx = { params: Promise<{ stId: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const auth = await requirePublicApiOrg(request);
  if (isAuthError(auth)) return auth;

  const { stId } = await ctx.params;
  const identity = await prisma.trackingIdentity.findFirst({
    where: {
      organizationId: auth.organizationId,
      stId,
      mergedIntoId: null,
    },
    include: {
      aliases: true,
      orders: {
        take: 20,
        orderBy: { occurredAt: "desc" },
        include: { attribution: true },
      },
    },
  });

  if (!identity) {
    return NextResponse.json({ error: "Identity não encontrada" }, { status: 404 });
  }

  return NextResponse.json({
    st_id: identity.stId,
    email: identity.email,
    phone: identity.phone,
    name: identity.name,
    lead_source: identity.leadSource,
    aliases: identity.aliases.map((a) => ({ type: a.type, value: a.value })),
    orders: identity.orders.map((o) => ({
      transaction_id: o.externalOrderId,
      value: Number(o.value),
      currency: o.currency,
      status: o.status,
      occurred_at: o.occurredAt,
      attribution: o.attribution,
    })),
  });
}
