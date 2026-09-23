/**
 * Módulo Social — contrato de eventos.
 * UI operacional: apps/atrako/app/social (tokens via Config).
 * Fonte legada: archive/apps + apps/social-source (DEPRECATED).
 */

import { createEvent, publishEventBatch } from "@atrako/events";

export const SOCIAL_SOURCE_PATH = "../social-source";

export const SOCIAL_ROUTES = {
  flows: "/app/flows",
  inbox: "/app/inbox",
  contacts: "/app/contacts",
  connect: "/app/connect",
  webhookMeta: "/api/webhooks/meta",
} as const;

export const SOCIAL_CAPABILITIES = [
  "comment_keyword -> DM",
  "story_reply / story_mention",
  "welcome DM",
  "inbox unificada + handoff",
  "links rastreados (reward)",
] as const;

export async function publishSocialComment(input: {
  workspaceId: string;
  contactId?: string;
  campaignId?: string;
  payload: Record<string, unknown>;
}) {
  const event = createEvent({
    name: "social.comment_received",
    source: "social",
    idempotencyKey: `social-comment-${input.workspaceId}-${String(input.payload.commentId ?? Date.now())}`,
    context: {
      workspaceId: input.workspaceId,
      contactId: input.contactId,
      campaignId: input.campaignId,
    },
    payload: input.payload,
  });
  return publishEventBatch([event]);
}

export async function publishSocialDmSent(input: {
  workspaceId: string;
  contactId?: string;
  payload: Record<string, unknown>;
}) {
  const event = createEvent({
    name: "social.dm_sent",
    source: "instagram",
    idempotencyKey: `social-dm-${input.workspaceId}-${String(input.payload.messageId ?? Date.now())}`,
    context: {
      workspaceId: input.workspaceId,
      contactId: input.contactId,
    },
    payload: input.payload,
  });
  return publishEventBatch([event]);
}

export function describeSocialJourney(): string {
  return "Comentário → DM → Landing Page → Cadastro → CRM (eventos na mesma jornada Atrako)";
}
