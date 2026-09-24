import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTrayOrderComplete } from "@/lib/integrations/tray/orders";
import { ingestTrayHubOrder } from "@/lib/integrations/tray/ingest-order";
import {
  isTrayOrderNotification,
  parseTrayNotification,
  shouldProcessTrayNotification,
} from "@/lib/integrations/tray/webhooks";
import { decryptCredentials } from "@/lib/atrako/credentials-crypto";

/**
 * Sistema de notificação Tray (URL cadastrada no app via suporte).
 * Sempre responde 200 quando possível para evitar retries agressivos.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const payload = parseTrayNotification(
    rawBody,
    request.headers.get("content-type"),
  );

  if (!isTrayOrderNotification(payload)) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  if (!shouldProcessTrayNotification(payload)) {
    return NextResponse.json({ ok: true, deduped: true });
  }

  const orderId = payload.scope_id != null ? String(payload.scope_id) : "";
  const sellerId = payload.seller_id != null ? String(payload.seller_id) : "";
  if (!orderId || !sellerId) {
    return NextResponse.json({ ok: true, ignored: true, reason: "missing_ids" });
  }

  const rows = await prisma.workspaceConnection.findMany({
    where: { provider: "TRAY", status: "ACTIVE" },
    select: {
      clienteId: true,
      metadata: true,
      credentialsEnc: true,
    },
    take: 200,
  });

  const hit = rows.find((r) => {
    const meta =
      r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata)
        ? (r.metadata as Record<string, unknown>)
        : {};
    if (String(meta.storeId ?? "") === sellerId) return true;
    try {
      const creds = decryptCredentials(r.credentialsEnc) as {
        storeId?: string | number;
      };
      return String(creds.storeId ?? "") === sellerId;
    } catch {
      return false;
    }
  });

  if (!hit) {
    // Loja desconectada / residual pós-uninstall — ack 200
    return NextResponse.json({ ok: true, deferred: true, reason: "workspace_unknown" });
  }

  try {
    const order = await getTrayOrderComplete(hit.clienteId, orderId);
    const result = await ingestTrayHubOrder({
      workspaceId: hit.clienteId,
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
    console.error("[tray-webhook]", message);
    // Ainda assim 200 para não martelar a fila; sync manual reconcilia
    return NextResponse.json({ ok: true, error: message });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    provider: "TRAY",
    hint: "Cadastre esta URL no chamado Tray Desenvolvedores (notificação do app)",
  });
}
