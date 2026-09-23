/**
 * Webhook para o serviço WhatsApp Web externo (whatsapp-web.js em processo separado).
 * Recebe: { tenantId, phone, content, type?, externalId?, fromNumber? }
 * O modo integrado (QR nas configurações do CRM) usa wweb-manager e não chama este webhook.
 */

import { NextRequest, NextResponse } from "next/server";
import { processInboundWwebMessage } from "@/lib/wweb-inbound";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { tenantId, phone, content, type, externalId } = body;

    if (!tenantId || !phone) return NextResponse.json({ ok: false, error: "tenantId e phone obrigatórios" }, { status: 400 });

    await processInboundWwebMessage(tenantId, {
      phone,
      content: content != null ? String(content) : "",
      type,
      externalId,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[webhook whatsapp-wweb]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
