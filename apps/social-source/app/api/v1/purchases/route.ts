import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  isAuthError,
  requirePublicApiOrg,
} from "@/lib/symbius/attribution/auth";
import { ingestPurchase } from "@/lib/symbius/attribution/engine";

const itemSchema = z.object({
  id: z.string().optional(),
  product_id: z.string().optional(),
  name: z.string().optional(),
  quantity: z.number().optional(),
  price: z.number().optional(),
});

const schema = z.object({
  event: z.string().optional(),
  event_id: z.string().optional().nullable(),
  transaction_id: z.string().min(1),
  st_id: z.string().optional().nullable(),
  lead_id: z.string().optional().nullable(),
  customer_id: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  value: z.number(),
  currency: z.string().optional(),
  items: z.array(itemSchema).optional(),
  timestamp: z.string().optional().nullable(),
  model: z.enum([
    "first_touch",
    "last_touch",
    "linear",
    "position_based",
    "time_decay",
  ]).optional(),
});

export async function POST(request: NextRequest) {
  const auth = await requirePublicApiOrg(request);
  if (isAuthError(auth)) return auth;

  const raw = await request.json();
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const body = parsed.data;
  try {
    const order = await ingestPurchase({
      organizationId: auth.organizationId,
      transactionId: body.transaction_id,
      stId: body.st_id,
      leadId: body.lead_id,
      customerId: body.customer_id,
      email: body.email,
      phone: body.phone,
      value: body.value,
      currency: body.currency,
      items: body.items,
      timestamp: body.timestamp,
      eventId: body.event_id,
      model: body.model,
      rawPayload: raw as Record<string, unknown>,
    });

    return NextResponse.json({
      ok: true,
      transaction_id: order.externalOrderId,
      st_id: order.identity?.stId ?? null,
      value: Number(order.value),
      attribution: order.attribution,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao registrar compra";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
