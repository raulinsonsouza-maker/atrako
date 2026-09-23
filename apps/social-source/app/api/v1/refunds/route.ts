import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  isAuthError,
  requirePublicApiOrg,
} from "@/lib/symbius/attribution/auth";
import { fireOutboundWebhook } from "@/lib/symbius/integrations";

const schema = z.object({
  transaction_id: z.string().min(1),
  value: z.number().optional(),
  reason: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const auth = await requirePublicApiOrg(request);
  if (isAuthError(auth)) return auth;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const order = await prisma.attributionOrder.findUnique({
    where: {
      organizationId_externalOrderId: {
        organizationId: auth.organizationId,
        externalOrderId: parsed.data.transaction_id,
      },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  }

  const updated = await prisma.attributionOrder.update({
    where: { id: order.id },
    data: {
      status: "refunded",
      ...(parsed.data.value != null ? { value: parsed.data.value } : {}),
    },
  });

  void fireOutboundWebhook(auth.organizationId, "order.refunded", {
    transactionId: updated.externalOrderId,
    value: Number(updated.value),
    reason: parsed.data.reason,
  });

  return NextResponse.json({
    ok: true,
    transaction_id: updated.externalOrderId,
    status: updated.status,
  });
}
