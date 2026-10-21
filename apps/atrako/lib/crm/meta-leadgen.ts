/**
 * Webhook Meta `leadgen`: o anúncio vira card no funil nativo.
 * A página do evento precisa estar na conexão META_ADS do workspace.
 */

import { prisma } from "@/lib/db";
import { decryptCredentials } from "@/lib/atrako/credentials-crypto";
import { captureExternalLead } from "@/lib/crm/capture-external";
import type { MetaAdsConnectionMetadata } from "@/lib/integrations/meta/types";

type LeadgenValue = {
  leadgen_id?: string;
  page_id?: string;
  form_id?: string;
  ad_id?: string;
  adgroup_id?: string;
  created_time?: number;
};

type GraphLead = {
  id?: string;
  created_time?: string;
  form_id?: string;
  campaign_id?: string;
  campaign_name?: string;
  ad_id?: string;
  ad_name?: string;
  adset_id?: string;
  adset_name?: string;
  field_data?: Array<{ name: string; values: string[] }>;
};

function fieldValue(fields: GraphLead["field_data"], ...names: string[]) {
  for (const name of names) {
    const field = fields?.find((f) => f.name.toLowerCase().includes(name.toLowerCase()));
    if (field?.values?.[0]) return field.values[0];
  }
  return null;
}

export function payloadHasLeadgen(payload: unknown) {
  const body = payload as {
    object?: string;
    entry?: Array<{ changes?: Array<{ field?: string }> }>;
  };
  if (body?.object !== "page") return false;
  return (body.entry ?? []).some((entry) => (entry.changes ?? []).some((change) => change.field === "leadgen"));
}

async function workspaceForPage(pageId: string) {
  const rows = await prisma.workspaceConnection.findMany({
    where: { provider: "META_ADS", status: { in: ["ACTIVE", "SYNCING"] } },
    select: { clienteId: true, metadata: true, credentialsEnc: true },
  });
  for (const row of rows) {
    const meta = (row.metadata ?? {}) as MetaAdsConnectionMetadata;
    const pages = Array.isArray(meta.pages) ? meta.pages : [];
    if (!pages.some((page) => page.id === pageId)) continue;
    const creds = decryptCredentials(row.credentialsEnc);
    const token = typeof creds.accessToken === "string" ? creds.accessToken : "";
    if (!token) continue;
    return { clienteId: row.clienteId, token };
  }
  return null;
}

export async function ingestMetaLeadgenWebhook(payload: unknown) {
  const body = payload as {
    entry?: Array<{ id?: string; changes?: Array<{ field?: string; value?: LeadgenValue }> }>;
  };
  let ingested = 0;
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "leadgen") continue;
      const value = change.value ?? {};
      const pageId = value.page_id || entry.id;
      const leadgenId = value.leadgen_id;
      if (!pageId || !leadgenId) continue;
      const workspace = await workspaceForPage(pageId);
      if (!workspace) {
        console.warn("[leadgen] página sem workspace", pageId);
        continue;
      }
      const url = new URL(`https://graph.facebook.com/v22.0/${leadgenId}`);
      url.searchParams.set(
        "fields",
        "created_time,field_data,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id",
      );
      url.searchParams.set("access_token", workspace.token);
      const res = await fetch(url);
      const lead = (await res.json()) as GraphLead & { error?: { message?: string } };
      if (!res.ok || lead.error) {
        console.warn("[leadgen] graph", lead.error?.message ?? res.status);
        continue;
      }
      const fullName = fieldValue(lead.field_data, "full_name", "nome", "name");
      const email = fieldValue(lead.field_data, "email");
      const phone = fieldValue(lead.field_data, "phone", "telefone", "whatsapp");
      const createdTime = lead.created_time
        ? new Date(lead.created_time)
        : value.created_time
          ? new Date(value.created_time * 1000)
          : new Date();
      await prisma.metaLeadIndividual.upsert({
        where: { clienteId_metaLeadId: { clienteId: workspace.clienteId, metaLeadId: leadgenId } },
        create: {
          clienteId: workspace.clienteId,
          metaLeadId: leadgenId,
          formId: lead.form_id ?? value.form_id ?? null,
          campaignId: lead.campaign_id ?? null,
          campaignName: lead.campaign_name ?? null,
          adId: lead.ad_id ?? value.ad_id ?? null,
          adName: lead.ad_name ?? null,
          adsetId: lead.adset_id ?? value.adgroup_id ?? null,
          adsetName: lead.adset_name ?? null,
          fullName,
          emailLead: email,
          telefone: phone,
          createdTime,
          rawFieldData: (lead.field_data ?? []) as object,
        },
        update: {
          campaignName: lead.campaign_name ?? undefined,
          adName: lead.ad_name ?? undefined,
          fullName: fullName ?? undefined,
          emailLead: email ?? undefined,
          telefone: phone ?? undefined,
        },
      });
      await captureExternalLead({
        workspaceId: workspace.clienteId,
        name: fullName,
        email,
        phone,
        source: "meta_lead",
        welcome: true,
        notifyTeam: true,
        metadata: {
          channel: "meta",
          campaignId: lead.campaign_id ?? null,
          campaignName: lead.campaign_name ?? null,
          adId: lead.ad_id ?? value.ad_id ?? null,
          adName: lead.ad_name ?? null,
          formId: lead.form_id ?? value.form_id ?? null,
          metaLeadId: leadgenId,
        },
        payload: { email, phone, nome: fullName },
      });
      ingested++;
    }
  }
  return { ingested };
}
