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
import { handleFlowInbound, handleFlowStatuses, handleWabaLevelChange } from "@/lib/flows/wa-webhook";

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
    button?: { text?: string; payload?: string };
    interactive?: {
      button_reply?: { id?: string; title?: string };
      list_reply?: { id?: string; title?: string };
    };
    referral?: { source_type?: string; source_id?: string; body?: string };
    location?: { latitude?: number; longitude?: number };
  }>;
  statuses?: Array<{
    id?: string;
    status?: string;
    timestamp?: string;
    recipient_id?: string;
    pricing?: { billable?: boolean; category?: string; pricing_model?: string };
    errors?: Array<{ code?: number; title?: string; message?: string; error_data?: { details?: string } }>;
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
      if (change.field && change.field !== "messages") {
        await handleWabaLevelChange(entry.id ?? "", change.field, value).catch((e) =>
          console.warn("[whatsapp/webhook] waba change failed", change.field, e instanceof Error ? e.message : e),
        );
        continue;
      }
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
      if (value.statuses?.length) {
        await handleFlowStatuses(workspaceId, value.statuses).catch((e) =>
          console.warn("[whatsapp/webhook] flow statuses failed", e instanceof Error ? e.message : e),
        );
      }

      const contactName = value.contacts?.[0]?.profile?.name ?? null;

      for (const msg of value.messages ?? []) {
        if (!msg.from) continue;
        const phone = normalizeWaPhone(msg.from);
        const location =
          msg.type === "location" && msg.location && Number.isFinite(Number(msg.location.latitude))
            ? { lat: Number(msg.location.latitude), lng: Number(msg.location.longitude) }
            : null;
        const replyId =
          msg.interactive?.button_reply?.id ||
          msg.interactive?.list_reply?.id ||
          msg.button?.payload ||
          null;
        const bodyText =
          msg.text?.body ||
          msg.button?.text ||
          msg.interactive?.button_reply?.title ||
          msg.interactive?.list_reply?.title ||
          (location ? "Localização recebida" : msg.type ? `[${msg.type}]` : null);

        const referralType = (msg.referral?.source_type || "").toLowerCase();
        const entrySource =
          referralType === "ad" || referralType === "advertisement"
            ? "ctwa"
            : referralType === "post" || referralType === "page"
              ? "page_cta"
              : null;

        const { contact, lead } = await upsertPersonAndLead({
          workspaceId,
          name: contactName,
          phone,
          source: entrySource === "ctwa" ? "whatsapp_ctwa" : "whatsapp",
          metadata: { channel: "whatsapp", lastInboundAt: new Date().toISOString(), entrySource },
        });

        const conversation = await upsertWaConversation({
          workspaceId,
          phone,
          contactName: contact.name,
          contactId: contact.id,
          openWindow: true,
          entrySource: entrySource ?? undefined,
        });

        const saved = await persistInboundMessage({
          workspaceId,
          conversationId: conversation.id,
          body: bodyText,
          wamid: msg.id ?? null,
          type: msg.type || "text",
        });
        if (saved.duplicate) continue;

        if (replyId && saved.id) {
          await prisma.waMessage.update({
            where: { id: saved.id },
            data: { metadata: { replyId } },
          }).catch(() => null);
        }

        const flow = await handleFlowInbound(workspaceId, contact.id, msg).catch((e) => {
          console.warn("[whatsapp/webhook] flow inbound failed", e instanceof Error ? e.message : e);
          return null;
        });
        if (flow?.action === "optout_all" || flow?.action === "optout_marketing" || flow?.action === "handoff") {
          continue;
        }

        const { handleFoodWhatsAppMessage } = await import("@/lib/food/whatsapp-order");
        const foodHandled = await handleFoodWhatsAppMessage({
          workspaceId,
          conversationId: conversation.id,
          phone,
          contactName: contact.name,
          body: bodyText,
          location,
        }).catch((e) => {
          console.warn("[whatsapp/webhook] food order failed", e instanceof Error ? e.message : e);
          return false;
        });
        if (foodHandled) continue;

        const { handleQualificationInbound } = await import("@/lib/qualification/engine");
        const qualifyHandled = await handleQualificationInbound({
          workspaceId,
          conversationId: conversation.id,
          contactId: contact.id,
          leadId: lead.id,
          phone,
          body: bodyText,
          replyId,
        }).catch((e) => {
          console.warn("[whatsapp/webhook] qualification failed", e instanceof Error ? e.message : e);
          return false;
        });
        if (qualifyHandled) continue;

        const { handleAttendanceInbound } = await import("@/lib/attendance/run");
        await handleAttendanceInbound({
          workspaceId,
          conversationId: conversation.id,
          contactId: contact.id,
          leadId: lead.id,
          phone,
          body: bodyText,
        }).catch((e) => console.warn("[whatsapp/webhook] attendance failed", e instanceof Error ? e.message : e));

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
