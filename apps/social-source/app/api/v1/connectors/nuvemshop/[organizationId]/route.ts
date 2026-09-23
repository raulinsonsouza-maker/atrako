import { NextRequest, NextResponse } from "next/server";
import {
  getConnectorSecrets,
  ingestNuvemshopOrder,
  verifySharedSecret,
} from "@/lib/symbius/attribution/connectors";

type Ctx = { params: Promise<{ organizationId: string }> };

export async function POST(request: NextRequest, ctx: Ctx) {
  const { organizationId } = await ctx.params;
  const secrets = await getConnectorSecrets(organizationId);
  const rawBody = await request.text();
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const provided =
    request.headers.get("x-linkedstore-hmac-sha256") ||
    request.headers.get("x-webhook-secret") ||
    request.nextUrl.searchParams.get("secret") ||
    (typeof payload.token === "string" ? payload.token : null);

  if (!verifySharedSecret(provided, secrets.nuvemshop?.webhookSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const order = await ingestNuvemshopOrder(organizationId, payload);
    return NextResponse.json({
      ok: true,
      transaction_id: order.externalOrderId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
