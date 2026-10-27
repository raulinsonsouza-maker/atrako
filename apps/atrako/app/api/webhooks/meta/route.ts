import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db-social";
import { getSymbiusMetaConfig } from "@/lib/instagram/metaOAuth";
import {
  getMetaWebhookVerifyToken,
  loadMetaPlatformAppCredentials,
} from "@/lib/integrations/meta/graph";
import {
  findConnectedIgAccount,
  processWebhookPayload,
  verifyWebhookSignature,
} from "@/lib/instagram/automationEngine";
import { ingestMetaLeadgenWebhook, payloadHasLeadgen } from "@/lib/crm/meta-leadgen";

export async function GET(request: NextRequest) {
  await loadMetaPlatformAppCredentials();
  const verifyToken =
    getMetaWebhookVerifyToken() || getSymbiusMetaConfig().verifyToken;
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === verifyToken && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!(await verifyWebhookSignature(rawBody, signature))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (payloadHasLeadgen(payload)) {
    try {
      const result = await ingestMetaLeadgenWebhook(payload);
      return NextResponse.json({ ok: true, leadgen: result.ingested });
    } catch (e) {
      console.error("[webhook/meta] leadgen", e);
      return NextResponse.json({ error: "Leadgen failed" }, { status: 500 });
    }
  }

  // Persistir raw antes do processar — se falhar, Meta deve retentar (5xx)
  let eventId: string | null = null;
  try {
    const body = payload as { entry?: Array<{ id?: string }> };
    const igUserId = body.entry?.[0]?.id;
    const igAccount = igUserId ? await findConnectedIgAccount(igUserId) : null;

    const event = await prisma.igWebhookEvent.create({
      data: {
        organizationId: igAccount?.organizationId,
        igUserId: igUserId ?? undefined,
        payload: payload as object,
        processed: false,
      },
    });
    eventId = event.id;
  } catch (e) {
    console.error("[webhook/meta] persist failed", e);
    return NextResponse.json({ error: "Persist failed" }, { status: 500 });
  }

  try {
    await processWebhookPayload(payload);
    if (eventId) {
      await prisma.igWebhookEvent.update({
        where: { id: eventId },
        data: { processed: true },
      });
    }
  } catch (e) {
    console.error("[webhook/meta] process failed", e);
    if (eventId) {
      await prisma.igWebhookEvent.update({
        where: { id: eventId },
        data: {
          processed: false,
          error: e instanceof Error ? e.message : String(e),
        },
      });
    }
    // Raw já persistido — 200 evita loop infinito; reprocessar via worker/cron depois
  }

  return NextResponse.json({ ok: true });
}
