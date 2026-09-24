import { NextRequest, NextResponse } from "next/server";
import { getShopeeOrderDetails } from "@/lib/integrations/shopee/orders";
import { ingestShopeeOrder } from "@/lib/integrations/shopee/ingest-order";
import {
  extractShopeePushOrderSn,
  extractShopeePushShopId,
  isShopeeOrderPush,
  type ShopeePushPayload,
} from "@/lib/integrations/shopee/webhooks";
import { prisma } from "@/lib/db";

/**
 * Push Shopee.
 * Preferência: configurar URL com workspaceId query, ou resolver por shop_id.
 * Delivery sugerido: /api/webhooks/shopee?workspaceId=...
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  let payload: ShopeePushPayload;
  try {
    payload = JSON.parse(rawBody) as ShopeePushPayload;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  // Responde rápido; processa order push de forma síncrona leve (padrão ML)
  if (!isShopeeOrderPush(payload)) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const orderSn = extractShopeePushOrderSn(payload);
  if (!orderSn) {
    return NextResponse.json({ ok: true, ignored: true, reason: "no_ordersn" });
  }

  let workspaceId =
    request.nextUrl.searchParams.get("workspaceId")?.trim() || "";
  const shopId = extractShopeePushShopId(payload);

  if (!workspaceId && shopId) {
    const rows = await prisma.workspaceConnection.findMany({
      where: { provider: "SHOPEE", status: "ACTIVE" },
      select: { clienteId: true, metadata: true, credentialsEnc: true },
      take: 50,
    });
    // Match por metadata.shopId (sem decrypt em massa — metadata é ok)
    const hit = rows.find((r) => {
      const meta =
        r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata)
          ? (r.metadata as Record<string, unknown>)
          : {};
      return String(meta.shopId ?? "") === shopId;
    });
    workspaceId = hit?.clienteId ?? "";
  }

  if (!workspaceId) {
    return NextResponse.json({ ok: true, deferred: true, reason: "workspace_unknown" });
  }

  try {
    const details = await getShopeeOrderDetails(workspaceId, [orderSn]);
    const order = details[0];
    if (!order) {
      return NextResponse.json({ ok: true, ignored: true, reason: "order_not_found" });
    }
    const result = await ingestShopeeOrder({
      workspaceId,
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
    console.error("[shopee-webhook]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, provider: "SHOPEE" });
}
