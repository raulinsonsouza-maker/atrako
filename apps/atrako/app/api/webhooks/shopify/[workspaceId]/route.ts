import { NextRequest, NextResponse } from "next/server";
import {
  getShopifyWebhookSecret,
  isShopifyCustomerTopic,
  isShopifyOrderTopic,
  isShopifyProductTopic,
  verifyShopifyWebhookHmac,
} from "@/lib/integrations/shopify/webhooks";
import {
  ingestShopifyCustomer,
  ingestShopifyHubOrder,
  upsertShopifyCatalogProduct,
} from "@/lib/integrations/shopify/ingest-order";
import { parseShopifyOrderPayload } from "@/lib/integrations/shopify/orders";

type Ctx = { params: Promise<{ workspaceId: string }> };

/**
 * Webhook Shopify (orders / customers / products).
 * Delivery URL: /api/webhooks/shopify/{workspaceId}
 */
export async function POST(request: NextRequest, ctx: Ctx) {
  const { workspaceId } = await ctx.params;
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }

  const rawBody = await request.text();
  const secret = await getShopifyWebhookSecret();
  const hmac = request.headers.get("x-shopify-hmac-sha256");

  if (secret) {
    if (!verifyShopifyWebhookHmac(rawBody, hmac, secret)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const topic = request.headers.get("x-shopify-topic") || "";

  if (!rawBody.trim()) {
    return NextResponse.json({ ok: true, ping: true });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  try {
    if (isShopifyOrderTopic(topic) || (!topic && parseShopifyOrderPayload(payload))) {
      const order = parseShopifyOrderPayload(payload);
      if (!order) {
        return NextResponse.json({ ok: true, ignored: true, reason: "not_an_order" });
      }
      const result = await ingestShopifyHubOrder({
        workspaceId,
        order,
        webhookPayload: payload as Record<string, unknown>,
      });
      return NextResponse.json({
        ok: true,
        kind: "order",
        created: result.created,
        orderId: result.order.id,
        externalId: result.order.externalId,
      });
    }

    if (isShopifyCustomerTopic(topic)) {
      const c = payload as Record<string, unknown>;
      await ingestShopifyCustomer({
        workspaceId,
        customer: {
          id: c.id as string | number | null,
          email: typeof c.email === "string" ? c.email : null,
          phone: typeof c.phone === "string" ? c.phone : null,
          first_name: typeof c.first_name === "string" ? c.first_name : null,
          last_name: typeof c.last_name === "string" ? c.last_name : null,
        },
      });
      return NextResponse.json({ ok: true, kind: "customer" });
    }

    if (isShopifyProductTopic(topic)) {
      const p = payload as Record<string, unknown>;
      const variants = Array.isArray(p.variants)
        ? (p.variants as Array<{ sku?: string; price?: string }>)
        : [];
      await upsertShopifyCatalogProduct({
        workspaceId,
        product: {
          id: p.id as string | number | null,
          title: typeof p.title === "string" ? p.title : null,
          status: typeof p.status === "string" ? p.status : null,
          variants,
        },
        raw: payload,
      });
      return NextResponse.json({ ok: true, kind: "product" });
    }

    return NextResponse.json({ ok: true, ignored: topic || true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "ingest_failed";
    console.error("[shopify-webhook]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(_request: NextRequest, ctx: Ctx) {
  const { workspaceId } = await ctx.params;
  return NextResponse.json({ ok: true, workspaceId });
}
