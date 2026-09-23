import { NextRequest, NextResponse } from "next/server";
import {
  getConnectorSecrets,
  ingestShopifyOrder,
  verifyShopifyHmac,
} from "@/lib/symbius/attribution/connectors";

type Ctx = { params: Promise<{ organizationId: string }> };

export async function POST(request: NextRequest, ctx: Ctx) {
  const { organizationId } = await ctx.params;
  const rawBody = await request.text();
  const secrets = await getConnectorSecrets(organizationId);
  const secret = secrets.shopify?.webhookSecret;
  const hmac = request.headers.get("x-shopify-hmac-sha256");

  if (!secret || !verifyShopifyHmac(rawBody, hmac, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const topic = request.headers.get("x-shopify-topic") ?? "";
  if (
    topic &&
    !topic.includes("orders/paid") &&
    !topic.includes("orders/create") &&
    !topic.includes("orders/updated")
  ) {
    return NextResponse.json({ ok: true, ignored: topic });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (payload.financial_status && payload.financial_status !== "paid") {
    return NextResponse.json({ ok: true, ignored: "not_paid" });
  }

  try {
    const order = await ingestShopifyOrder(organizationId, payload);
    return NextResponse.json({
      ok: true,
      transaction_id: order.externalOrderId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
