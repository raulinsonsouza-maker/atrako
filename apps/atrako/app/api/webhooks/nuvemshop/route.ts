import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getNuvemshopOrder } from "@/lib/integrations/nuvemshop/orders";
import { ingestNuvemshopHubOrder } from "@/lib/integrations/nuvemshop/ingest-order";
import {
  isNuvemshopOrderEvent,
  type NuvemshopPushPayload,
} from "@/lib/integrations/nuvemshop/webhooks";
import { decryptCredentials } from "@/lib/atrako/credentials-crypto";

/**
 * Push Nuvemshop: { store_id, event, id } → GET order → ingest.
 * Prefer ?workspaceId=; senão resolve por store_id no WC.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  let payload: NuvemshopPushPayload;
  try {
    payload = JSON.parse(rawBody) as NuvemshopPushPayload;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!isNuvemshopOrderEvent(payload.event)) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const orderId = payload.id != null ? String(payload.id) : "";
  if (!orderId) {
    return NextResponse.json({ ok: true, ignored: true, reason: "no_id" });
  }

  let workspaceId =
    request.nextUrl.searchParams.get("workspaceId")?.trim() || "";
  const storeId = payload.store_id != null ? String(payload.store_id) : "";

  if (!workspaceId && storeId) {
    const rows = await prisma.workspaceConnection.findMany({
      where: { provider: "NUVEMSHOP", status: "ACTIVE" },
      select: { clienteId: true, metadata: true, credentialsEnc: true },
      take: 100,
    });
    const hit = rows.find((r) => {
      const meta =
        r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata)
          ? (r.metadata as Record<string, unknown>)
          : {};
      if (String(meta.storeId ?? "") === storeId) return true;
      try {
        const creds = decryptCredentials(r.credentialsEnc) as {
          storeId?: string | number;
        };
        return String(creds.storeId ?? "") === storeId;
      } catch {
        return false;
      }
    });
    workspaceId = hit?.clienteId ?? "";
  }

  if (!workspaceId) {
    return NextResponse.json({ ok: true, deferred: true, reason: "workspace_unknown" });
  }

  try {
    const order = await getNuvemshopOrder(workspaceId, orderId);
    const result = await ingestNuvemshopHubOrder({
      workspaceId,
      order,
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
    console.error("[nuvemshop-webhook]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, provider: "NUVEMSHOP" });
}
