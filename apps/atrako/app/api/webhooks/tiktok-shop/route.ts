import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveTiktokShopApp } from "@/lib/integrations/tiktok-shop/oauth";
import { getTiktokShopOrderDetails } from "@/lib/integrations/tiktok-shop/orders";
import { ingestTiktokShopOrder } from "@/lib/integrations/tiktok-shop/ingest-order";
import {
  extractTiktokShopOrderId,
  extractTiktokShopShopId,
  isTiktokShopOrderEvent,
  verifyTiktokShopWebhook,
  type TiktokShopWebhookPayload,
} from "@/lib/integrations/tiktok-shop/webhooks";

/**
 * Webhook TikTok Shop (assinado com HMAC no header Authorization).
 * Workspace resolvido por metadata.shopId da WorkspaceConnection.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const app = await resolveTiktokShopApp("");
  if (!app.appKey || !app.appSecret) {
    return NextResponse.json({ error: "tiktok_shop_not_configured" }, { status: 503 });
  }
  const valid = verifyTiktokShopWebhook({
    appKey: app.appKey,
    appSecret: app.appSecret,
    rawBody,
    authorization: request.headers.get("authorization"),
  });
  if (!valid) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let payload: TiktokShopWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as TiktokShopWebhookPayload;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!isTiktokShopOrderEvent(payload)) {
    return NextResponse.json({ ok: true, ignored: true });
  }
  const orderId = extractTiktokShopOrderId(payload)!;
  const shopId = extractTiktokShopShopId(payload);
  if (!shopId) {
    return NextResponse.json({ ok: true, ignored: true, reason: "no_shop_id" });
  }

  const rows = await prisma.workspaceConnection.findMany({
    where: { provider: "TIKTOK_SHOP", status: "ACTIVE" },
    select: { clienteId: true, metadata: true },
  });
  const hit = rows.find((r) => {
    const meta =
      r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata)
        ? (r.metadata as Record<string, unknown>)
        : {};
    return String(meta.shopId ?? "") === shopId;
  });
  if (!hit) {
    return NextResponse.json({ ok: true, deferred: true, reason: "workspace_unknown" });
  }

  try {
    const [order] = await getTiktokShopOrderDetails(hit.clienteId, [orderId]);
    if (!order) {
      return NextResponse.json({ ok: true, ignored: true, reason: "order_not_found" });
    }
    const result = await ingestTiktokShopOrder({
      workspaceId: hit.clienteId,
      order,
      shopId,
      notification: payload as Record<string, unknown>,
    });
    return NextResponse.json({
      ok: true,
      created: result.created,
      orderId: result.order.id,
      externalId: result.order.externalId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "ingest_failed";
    console.error("[tiktok-shop-webhook]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, provider: "TIKTOK_SHOP" });
}
