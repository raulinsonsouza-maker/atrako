import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveResend, patchResendMetadata } from "@/lib/integrations/resend/connection";
import {
  readResendTags,
  verifySvixSignature,
  type ResendWebhookEvent,
} from "@/lib/integrations/resend/webhooks";
import {
  applyDeliveryEvent,
  mapResendEventType,
  suppressContactEmail,
} from "@/lib/flows/delivery-status";
import { exitEnrollments } from "@/lib/flows/engine";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;
  const body = await request.text();
  const conn = await resolveResend(workspaceId);
  if (!conn?.webhookSecret) {
    return NextResponse.json({ error: "not configured" }, { status: 404 });
  }

  const ok = verifySvixSignature({
    secret: conn.webhookSecret,
    id: request.headers.get("svix-id"),
    timestamp: request.headers.get("svix-timestamp"),
    signature: request.headers.get("svix-signature"),
    body,
  });
  if (!ok) return NextResponse.json({ error: "invalid signature" }, { status: 401 });

  let evt: ResendWebhookEvent;
  try {
    evt = JSON.parse(body) as ResendWebhookEvent;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const lastAt = conn.lastWebhookAt ? new Date(conn.lastWebhookAt).getTime() : 0;
  if (Date.now() - lastAt > 5 * 60_000) {
    await patchResendMetadata(workspaceId, { lastWebhookAt: new Date().toISOString() });
  }

  const event = mapResendEventType(evt.type);
  const emailId = evt.data?.email_id;
  if (!event || !emailId) return NextResponse.json({ ok: true, ignored: true });

  const tags = readResendTags(evt.data?.tags);
  const delivery = await prisma.messageDelivery.findFirst({
    where: {
      clienteId: workspaceId,
      OR: [
        { providerMessageId: emailId },
        ...(tags.delivery ? [{ id: tags.delivery }] : []),
      ],
    },
    select: { id: true, contactId: true, providerMessageId: true },
  });
  if (!delivery) return NextResponse.json({ ok: true, unknown: true });

  if (!delivery.providerMessageId) {
    await prisma.messageDelivery.update({
      where: { id: delivery.id },
      data: { providerMessageId: emailId },
    });
  }

  const meta: Record<string, unknown> = {};
  if (evt.data?.click?.link) meta.link = evt.data.click.link;
  if (evt.data?.bounce) meta.bounce = evt.data.bounce;
  if (evt.data?.failed?.reason) meta.reason = evt.data.failed.reason;

  const fresh = await applyDeliveryEvent({
    deliveryId: delivery.id,
    clienteId: workspaceId,
    contactId: delivery.contactId,
    event,
    at: evt.created_at ? new Date(evt.created_at) : new Date(),
    meta,
    providerEventId: request.headers.get("svix-id"),
    extra:
      event === "bounced"
        ? { error: String(evt.data?.bounce?.message ?? "bounce").slice(0, 500) }
        : event === "failed"
          ? { error: String(evt.data?.failed?.reason ?? "failed").slice(0, 500) }
          : undefined,
  });
  if (!fresh) return NextResponse.json({ ok: true, duplicate: true });

  if (delivery.contactId) {
    const permanentBounce =
      event === "bounced" &&
      !/transient|temporary/i.test(String(evt.data?.bounce?.type ?? ""));
    if (permanentBounce || event === "complained") {
      await suppressContactEmail(delivery.contactId, event === "complained" ? "complaint" : "bounce");
      await exitEnrollments({
        clienteId: workspaceId,
        contactId: delivery.contactId,
        reason: event === "complained" ? "complaint" : "bounce",
        channel: "EMAIL",
      });
    }
  }

  return NextResponse.json({ ok: true });
}
