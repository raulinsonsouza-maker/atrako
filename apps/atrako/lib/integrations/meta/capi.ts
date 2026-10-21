/**
 * Meta Conversions API (server-side) a partir de WorkspaceSettings.tracking (pixelId + capiToken).
 * - Lead do formulário: mesmo event_id do pixel do navegador (deduplicação).
 * - Etapas do CRM: formato "Conversion Leads" (event_name = etapa, action_source system_generated).
 * Doc: https://developers.facebook.com/docs/marketing-api/conversions-api/parameters
 */

import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { getWorkspaceConfig, resolveTracking } from "@/lib/config/getWorkspaceConfig";

const GRAPH_VERSION = "v21.0";

type SinkResult = { sent: boolean; reason?: string };

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

function normalizeToken(raw: string) {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

function str(raw: unknown) {
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

/** Cidade/UF respondidas no form ficam em metadata.qualification.answers. */
function answerValue(meta: Record<string, unknown>, key: string) {
  const answers = asRecord(asRecord(meta.qualification).answers);
  return str(asRecord(answers[key]).value);
}

type Identity = {
  contactId: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  fbp: string | null;
  fbc: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
};

function buildUserData(id: Identity) {
  const out: Record<string, unknown> = {};
  if (id.email) out.em = [sha256(id.email.trim().toLowerCase())];
  const phone = (id.phone ?? "").replace(/\D/g, "");
  if (phone) out.ph = [sha256(phone.length <= 11 ? `55${phone}` : phone)];
  const parts = (id.name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length) out.fn = [sha256(normalizeToken(parts[0]))];
  if (parts.length > 1) out.ln = [sha256(normalizeToken(parts[parts.length - 1]))];
  if (id.city) out.ct = [sha256(normalizeToken(id.city))];
  if (id.state && /^[a-z]{2}$/i.test(id.state)) out.st = [sha256(id.state.toLowerCase())];
  out.country = [sha256("br")];
  if (id.contactId) out.external_id = [sha256(id.contactId)];
  if (id.fbp) out.fbp = id.fbp;
  if (id.fbc) out.fbc = id.fbc;
  if (id.clientIp) out.client_ip_address = id.clientIp;
  if (id.userAgent) out.client_user_agent = id.userAgent;
  return out;
}

async function loadLeadIdentity(workspaceId: string, leadId: string) {
  const lead = await prisma.nativeLead.findFirst({
    where: { id: leadId, clienteId: workspaceId },
    select: {
      metadata: true,
      contactId: true,
      contact: { select: { name: true, email: true, phone: true, phoneE164: true } },
    },
  });
  if (!lead) return null;
  const meta = asRecord(lead.metadata);
  const identity: Identity = {
    contactId: lead.contactId,
    name: lead.contact?.name ?? null,
    email: lead.contact?.email ?? null,
    phone: lead.contact?.phoneE164 || lead.contact?.phone || null,
    city: answerValue(meta, "city"),
    state: answerValue(meta, "state"),
    fbp: str(meta.fbp),
    fbc: str(meta.fbc),
  };
  return { identity, meta };
}

async function postEvents(workspaceId: string, events: Array<Record<string, unknown>>): Promise<SinkResult> {
  const config = await getWorkspaceConfig(workspaceId);
  if (!config) return { sent: false, reason: "no_config" };
  const { pixelId, capiToken } = resolveTracking(config);
  if (!pixelId || !capiToken) return { sent: false, reason: "no_capi" };
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(pixelId)}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${capiToken}` },
    body: JSON.stringify({
      data: events,
      ...(process.env.META_CAPI_TEST_EVENT_CODE ? { test_event_code: process.env.META_CAPI_TEST_EVENT_CODE } : {}),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.warn("[meta/capi]", res.status, text.slice(0, 300));
    return { sent: false, reason: `capi_${res.status}` };
  }
  return { sent: true };
}

/** Lead de formulário — par do `fbq('track','Lead', …, { eventID })` do navegador. */
export async function sendFormLeadConversion(input: {
  workspaceId: string;
  leadId: string;
  eventId: string;
  eventSourceUrl?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
}): Promise<SinkResult> {
  const loaded = await loadLeadIdentity(input.workspaceId, input.leadId);
  if (!loaded) return { sent: false, reason: "no_lead" };
  const formName = str(loaded.meta.formName);
  return postEvents(input.workspaceId, [
    {
      event_name: "Lead",
      event_time: Math.floor(Date.now() / 1000),
      event_id: input.eventId.slice(0, 100),
      action_source: "website",
      event_source_url: input.eventSourceUrl || undefined,
      user_data: buildUserData({ ...loaded.identity, clientIp: input.clientIp, userAgent: input.userAgent }),
      custom_data: {
        ...(formName ? { content_name: formName } : {}),
        lead_event_source: "Atrako",
      },
    },
  ]);
}

/** Mudança de etapa no CRM → evento com o nome da etapa (Conversion Leads / custom conversion). */
export async function sendCrmStageConversion(input: {
  workspaceId: string;
  leadId: string;
  stageId: string;
  stageName: string;
  dealValue?: number | null;
}): Promise<SinkResult> {
  const eventName = input.stageName.trim().slice(0, 40);
  if (!eventName) return { sent: false, reason: "no_stage" };
  const loaded = await loadLeadIdentity(input.workspaceId, input.leadId);
  if (!loaded) return { sent: false, reason: "no_lead" };
  const config = await getWorkspaceConfig(input.workspaceId);
  const currency = config?.settings.currency ?? "BRL";
  const value = typeof input.dealValue === "number" && input.dealValue > 0 ? input.dealValue : null;
  return postEvents(input.workspaceId, [
    {
      event_name: eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: `crm-${input.leadId}-${input.stageId}`.slice(0, 100),
      action_source: "system_generated",
      user_data: buildUserData(loaded.identity),
      custom_data: {
        event_source: "crm",
        lead_event_source: "Atrako",
        ...(value != null ? { value, currency } : {}),
      },
    },
  ]);
}

/** Dispara sem bloquear a resposta; falha de envio só gera log. */
export function fireAndForget(task: Promise<SinkResult>, label: string) {
  void task
    .then((r) => {
      if (!r.sent && r.reason !== "no_capi") console.warn(`[meta/capi] ${label}: ${r.reason}`);
    })
    .catch((err) => console.warn(`[meta/capi] ${label}`, err instanceof Error ? err.message : err));
}
