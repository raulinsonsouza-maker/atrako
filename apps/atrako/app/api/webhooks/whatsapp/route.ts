import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  matchWebhookVerifyToken,
  verifyWaWebhookSignature,
  findWorkspaceByPhoneNumberId,
} from "@/lib/integrations/whatsapp/webhooks";
import { processWhatsAppWebhookPayload } from "@/lib/whatsapp/process-webhook";

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && challenge) {
    const ok = await matchWebhookVerifyToken(token);
    if (ok) return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifyWaWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const body = payload as {
    entry?: Array<{
      changes?: Array<{ value?: { metadata?: { phone_number_id?: string } } }>;
    }>;
  };
  const phoneNumberId =
    body.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id ?? null;
  const resolved = phoneNumberId
    ? await findWorkspaceByPhoneNumberId(phoneNumberId)
    : null;

  let eventId: string | null = null;
  try {
    const event = await prisma.waWebhookEvent.create({
      data: {
        clienteId: resolved?.workspaceId ?? null,
        phoneNumberId,
        payload: payload as object,
        processed: false,
      },
    });
    eventId = event.id;
  } catch (e) {
    console.error("[webhook/whatsapp] persist failed", e);
    return NextResponse.json({ error: "Persist failed" }, { status: 500 });
  }

  try {
    await processWhatsAppWebhookPayload(payload);
    if (eventId) {
      await prisma.waWebhookEvent.update({
        where: { id: eventId },
        data: { processed: true, processedAt: new Date() },
      });
    }
  } catch (e) {
    console.error("[webhook/whatsapp] process failed", e);
    if (eventId) {
      await prisma.waWebhookEvent.update({
        where: { id: eventId },
        data: {
          processed: false,
          error: e instanceof Error ? e.message : String(e),
        },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
