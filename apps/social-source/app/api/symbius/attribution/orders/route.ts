import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isSession, requireApiSession } from "@/lib/symbius/apiHelpers";

export async function GET(request: NextRequest) {
  const session = await requireApiSession();
  if (!isSession(session)) return session;

  const sp = request.nextUrl.searchParams;
  const to = sp.get("to") ? new Date(sp.get("to")!) : new Date();
  const from = sp.get("from")
    ? new Date(sp.get("from")!)
    : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

  const rows = await prisma.attributionOrder.findMany({
    where: {
      organizationId: session.organizationId,
      status: { in: ["paid", "completed"] },
      occurredAt: { gte: from, lte: to },
    },
    include: {
      attribution: true,
      identity: { select: { stId: true } },
    },
    orderBy: { occurredAt: "desc" },
    take: 200,
  });

  return NextResponse.json({
    orders: rows.map((o) => ({
      transaction_id: o.externalOrderId,
      value: Number(o.value),
      currency: o.currency,
      occurred_at: o.occurredAt.toISOString(),
      st_id: o.identity?.stId ?? null,
      campaign: o.attribution?.attributedCampaign ?? null,
      source: o.attribution?.attributedSource ?? null,
      medium: o.attribution?.attributedMedium ?? null,
    })),
  });
}
