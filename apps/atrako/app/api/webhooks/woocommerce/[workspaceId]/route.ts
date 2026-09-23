import { NextRequest, NextResponse } from "next/server";
import { ingestWooCommerceOrder } from "@/lib/integrations/woocommerce/ingest-order";
import {
  getWooWebhookSecret,
  isWooOrderTopic,
  parseWooOrderPayload,
  verifyWooWebhookSignature,
} from "@/lib/integrations/woocommerce/webhooks";

type Ctx = { params: Promise<{ workspaceId: string }> };

/**
 * Webhook WooCommerce (order.created / order.updated).
 * Delivery URL: /api/webhooks/woocommerce/{workspaceId}
 */
export async function POST(request: NextRequest, ctx: Ctx) {
  const { workspaceId } = await ctx.params;
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }

  const rawBody = await request.text();
  const secret = await getWooWebhookSecret(workspaceId);
  const signature = request.headers.get("x-wc-webhook-signature");

  if (secret) {
    if (!verifyWooWebhookSignature(rawBody, signature, secret)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const topic =
    request.headers.get("x-wc-webhook-topic") ||
    request.headers.get("x-wc-webhook-event") ||
    "";
  if (topic && !isWooOrderTopic(topic)) {
    return NextResponse.json({ ok: true, ignored: topic });
  }

  // Woo envia ping de teste com body vazio / resource=webhook_id
  if (!rawBody.trim()) {
    return NextResponse.json({ ok: true, ping: true });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const order = parseWooOrderPayload(payload);
  if (!order) {
    return NextResponse.json({ ok: true, ignored: true, reason: "not_an_order" });
  }

  try {
    const result = await ingestWooCommerceOrder({
      workspaceId,
      order,
      webhookPayload: payload as Record<string, unknown>,
    });
    return NextResponse.json({
      ok: true,
      created: result.created,
      orderId: result.order.id,
      externalId: result.order.externalId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "ingest_failed";
    console.error("[woo-webhook]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** WooCommerce envia GET no cadastro do webhook (challenge). */
export async function GET(
  _request: NextRequest,
  ctx: Ctx,
) {
  const { workspaceId } = await ctx.params;
  return NextResponse.json({ ok: true, workspaceId });
}
