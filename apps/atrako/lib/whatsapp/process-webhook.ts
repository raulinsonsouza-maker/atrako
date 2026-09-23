/**
 * Processa payload webhook WhatsApp (object: whatsapp_business_account).
 * Sempre resolve Person hub (NativeContact) antes de gravar conversa.
 */

import { prisma } from "@/lib/db";
import { createEvent, publishEventBatch } from "@atrako/events";
import { findWorkspaceByPhoneNumberId } from "@/lib/integrations/whatsapp/webhooks";
import {
  normalizeWaPhone,
  persistInboundMessage,
  upsertWaConversation,
} from "@/lib/whatsapp/domain";
import { upsertPersonAndLead } from "@/lib/atrako/person";

type WaChangeValue = {
  messaging_product?: string;
  metadata?: { phone_number_id?: string; display_phone_number?: string };
  contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
  messages?: Array<{
    from?: string;
    id?: string;
    timestamp?: string;
    type?: string;
    text?: { body?: string };
    button?: { text?: string };
    interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
  }>;
  statuses?: Array<{
    id?: string;
    status?: string;
    recipient_id?: string;
  }>;
};

export async function processWhatsAppWebhookPayload(payload: unknown) {
  const body = payload as {
    object?: string;
    entry?: Array<{
      id?: string;
      changes?: Array<{ field?: string; value?: WaChangeValue }>;
    }>;
  };

  if (body.object && body.object !== "whatsapp_business_account") {
    return { ignored: true as const };
  }

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value) continue;
      const phoneNumberId = value.metadata?.phone_number_id ?? "";
      const resolved = phoneNumberId
        ? await findWorkspaceByPhoneNumberId(phoneNumberId)
        : null;
      if (!resolved) {
        console.warn("[whatsapp/webhook] workspace not found for phone_number_id", phoneNumberId);
        continue;
      }
      const workspaceId = resolved.workspaceId;

      for (const status of value.statuses ?? []) {
        if (!status.id) continue;
        await prisma.waMessage.updateMany({
          where: { clienteId: workspaceId, wamid: status.id },
          data: { status: status.status || undefined },
        });
      }

      const contactName = value.contacts?.[0]?.profile?.name ?? null;

      for (const msg of value.messages ?? []) {
        if (!msg.from) continue;
        const phone = normalizeWaPhone(msg.from);
        const bodyText =
          msg.text?.body ||
          msg.button?.text ||
          msg.interactive?.button_reply?.title ||
          msg.interactive?.list_reply?.title ||
          (msg.type ? `[${msg.type}]` : null);

        const { contact, lead } = await upsertPersonAndLead({
          workspaceId,
          name: contactName,
          phone,
          source: "whatsapp",
          metadata: { channel: "whatsapp", lastInboundAt: new Date().toISOString() },
        });

        const conversation = await upsertWaConversation({
          workspaceId,
          phone,
          contactName: contact.name,
          contactId: contact.id,
          openWindow: true,
        });

        await persistInboundMessage({
          workspaceId,
          conversationId: conversation.id,
          body: bodyText,
          wamid: msg.id ?? null,
          type: msg.type || "text",
        });

        const event = createEvent({
          name: "conversation.started",
          source: "whatsapp",
          idempotencyKey: `wa-in-${workspaceId}-${msg.id || `${phone}-${msg.timestamp}`}`,
          context: {
            workspaceId,
            contactId: contact.id,
            leadId: lead.id,
          },
          payload: {
            channel: "whatsapp",
            phone,
            conversationId: conversation.id,
            message: bodyText,
            contactName: contact.name,
            kind: "inbound",
          },
        });
        await publishEventBatch([event]).catch((e) =>
          console.warn("[whatsapp/webhook] publish event failed", e),
        );
      }
    }
  }

  return { ok: true as const };
}
