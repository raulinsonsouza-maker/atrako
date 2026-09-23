/**
 * API interna para o worker processar job SDR.
 * POST body: { tenantId, conversationId, leadId }.
 * Opcional: header X-Internal-Key ou Authorization com INTERNAL_API_KEY para proteger.
 */

import { NextRequest, NextResponse } from "next/server";
import { processSdrReply } from "@/server/sdrReply";

export async function POST(req: NextRequest) {
  try {
    const internalKey = process.env.INTERNAL_API_KEY || process.env.CRON_SECRET;
    if (internalKey) {
      const auth = req.headers.get("authorization") || req.headers.get("x-internal-key") || "";
      const token = auth.replace(/^Bearer\s+/i, "").trim();
      if (token !== internalKey) {
        return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
      }
    }

    const body = await req.json().catch(() => ({}));
    const tenantId = body.tenantId as string;
    const conversationId = body.conversationId as string;
    const leadId = body.leadId as string;
    if (!tenantId || !conversationId || !leadId) {
      return NextResponse.json(
        { ok: false, error: "tenantId, conversationId e leadId são obrigatórios." },
        { status: 400 }
      );
    }

    const result = await processSdrReply(tenantId, conversationId, leadId);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[sdr-reply]", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Erro ao processar SDR." },
      { status: 500 }
    );
  }
}
