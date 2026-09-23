import { NextRequest, NextResponse } from "next/server";
import {
  getConnectorSecrets,
  ingestTrayOrder,
  verifySharedSecret,
} from "@/lib/symbius/attribution/connectors";

type Ctx = { params: Promise<{ organizationId: string }> };

export async function POST(request: NextRequest, ctx: Ctx) {
  const { organizationId } = await ctx.params;
  const secrets = await getConnectorSecrets(organizationId);
  const provided =
    request.headers.get("x-tray-secret") ||
    request.headers.get("x-webhook-secret") ||
    request.nextUrl.searchParams.get("secret");

  if (!verifySharedSecret(provided, secrets.tray?.webhookSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json()) as Record<string, unknown>;
  try {
    const order = await ingestTrayOrder(organizationId, payload);
    return NextResponse.json({
      ok: true,
      transaction_id: order.externalOrderId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
