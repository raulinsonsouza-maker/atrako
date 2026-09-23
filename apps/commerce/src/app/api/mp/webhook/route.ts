import { NextRequest, NextResponse } from "next/server";
import {
  InvalidWebhookSignatureError,
  WebhookSignatureValidator,
} from "mercadopago";
import { prisma } from "@/lib/prisma";
import { approveOrder } from "@/lib/orders";
import { revokeEntitlementsForOrder } from "@/lib/entitlements";
import { getMercadoPagoOrder } from "@/lib/mercadopago/orders";
import { resolveMercadoPagoWebhookSecret } from "@/lib/atrako-platform";

function isPaidStatus(status: string) {
  const s = status.toLowerCase();
  return ["processed", "approved", "paid"].some((x) => s.includes(x));
}

function isCancelledStatus(status: string) {
  const s = status.toLowerCase();
  return ["refunded", "cancelled", "canceled", "chargeback"].some((x) =>
    s.includes(x),
  );
}

async function verifyWebhookSignature(req: NextRequest) {
  // Prefer PlatformApp.webhookSecret via Atrako; MP_WEBHOOK_SECRET is local DX fallback.
  const secret = await resolveMercadoPagoWebhookSecret();
  const isProd = process.env.NODE_ENV === "production";

  if (!secret) {
    if (isProd) {
      throw new Error("MP webhook secret não configurado (Atrako PlatformApp ou MP_WEBHOOK_SECRET)");
    }
    // Dev sem secret: aceita (polling / testes locais)
    return;
  }

  WebhookSignatureValidator.validate({
    xSignature: req.headers.get("x-signature"),
    xRequestId: req.headers.get("x-request-id"),
    dataId: req.nextUrl.searchParams.get("data.id"),
    secret,
    toleranceSeconds: 300,
  });
}

export async function POST(req: NextRequest) {
  try {
    try {
      await verifyWebhookSignature(req);
    } catch (e) {
      if (e instanceof InvalidWebhookSignatureError || e instanceof Error) {
        console.error("webhook signature rejected", e);
        return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
      }
      throw e;
    }

    const body = await req.json().catch(() => ({}));
    const queryDataId = req.nextUrl.searchParams.get("data.id");
    const mpOrderId = String(
      queryDataId || body?.data?.id || body?.id || "",
    ).trim();
    const externalRef = String(
      body?.data?.external_reference || body?.external_reference || "",
    ).trim();

    let order =
      (externalRef
        ? await prisma.order.findUnique({ where: { id: externalRef } })
        : null) ||
      (mpOrderId
        ? await prisma.order.findFirst({ where: { mpOrderId } })
        : null);

    if (!order) return NextResponse.json({ ok: true, ignored: true });

    // Fonte da verdade: status real na API do MP (não confiar só no body)
    let status = "";
    const lookupId = order.mpOrderId || mpOrderId;
    if (lookupId) {
      try {
        const mp = await getMercadoPagoOrder(lookupId);
        status = String(mp?.status || "");
        if (!order.mpOrderId && mp?.id) {
          await prisma.order.update({
            where: { id: order.id },
            data: { mpOrderId: String(mp.id) },
          });
        }
      } catch (e) {
        console.error("webhook MP fetch failed", e);
        // Fallback conservador: só body se já não for aprovação cega sem secret
        status = String(body?.data?.status || body?.status || body?.action || "");
      }
    } else {
      status = String(body?.data?.status || body?.status || body?.action || "");
    }

    if (isPaidStatus(status)) {
      if (order.status !== "APPROVED") {
        await approveOrder(order.id, { fromPix: true });
      }
    } else if (isCancelledStatus(status)) {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: status.toLowerCase().includes("refund") ? "REFUNDED" : "CANCELLED" },
      });
      await revokeEntitlementsForOrder(order.id);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("webhook error", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
