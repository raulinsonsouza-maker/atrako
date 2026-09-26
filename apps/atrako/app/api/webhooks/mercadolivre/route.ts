import { NextRequest, NextResponse } from "next/server";
import {
  findWorkspaceByMeliUserId,
  parseMlOrderIdFromResource,
  parseMlShipmentIdFromResource,
  type MlNotification,
} from "@/lib/integrations/mercadolivre/webhooks";
import { ingestMercadoLivreOrder } from "@/lib/integrations/mercadolivre/ingest-order";
import { ingestMercadoLivreShipment } from "@/lib/integrations/mercadolivre/ingest-shipment";
import { prisma } from "@/lib/db";

async function markWebhookReceived(connectionId: string) {
  const row = await prisma.workspaceConnection.findUnique({ where: { id: connectionId } });
  if (!row) return;
  const metadata = row.metadata && typeof row.metadata === "object"
    ? row.metadata as Record<string, unknown>
    : {};
  await prisma.workspaceConnection.update({
    where: { id: connectionId },
    data: { metadata: { ...metadata, lastWebhookAt: new Date().toISOString() } },
  });
}

/**
 * Webhook ML — topics: orders_v2 / orders / shipments.
 */
export async function POST(request: NextRequest) {
  let payload: MlNotification;
  try {
    payload = (await request.json()) as MlNotification;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const topic = payload.topic ?? "";

  if (payload.user_id == null) {
    return NextResponse.json({ error: "missing user_id" }, { status: 400 });
  }

  const match = await findWorkspaceByMeliUserId(payload.user_id);
  if (!match) {
    return NextResponse.json({ ok: true, ignored: true, reason: "workspace_not_found" });
  }

  try {
    if (topic === "shipments") {
      const shipmentId = parseMlShipmentIdFromResource(payload.resource);
      if (!shipmentId) {
        return NextResponse.json({ ok: true, ignored: true, reason: "no_shipment_id" });
      }
      const result = await ingestMercadoLivreShipment({
        workspaceId: match.workspaceId,
        shipmentId,
      });
      await markWebhookReceived(match.connectionId);
      return NextResponse.json({ ok: true, topic, ...result });
    }

    if (topic && topic !== "orders_v2" && topic !== "orders") {
      return NextResponse.json({ ok: true, ignored: true, topic });
    }

    const orderId = parseMlOrderIdFromResource(payload.resource);
    if (!orderId) {
      return NextResponse.json({ ok: true, ignored: true, reason: "no_order_id" });
    }

    const result = await ingestMercadoLivreOrder({
      workspaceId: match.workspaceId,
      orderId,
      notification: payload as Record<string, unknown>,
    });
    await markWebhookReceived(match.connectionId);
    return NextResponse.json({
      ok: true,
      created: result.created,
      orderId: result.order.id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "ingest_failed";
    console.error("[ml-webhook]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
