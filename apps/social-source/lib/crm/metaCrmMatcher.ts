/**
 * Cross-references MetaLeadIndividual records with LeadCrm records
 * by email and phone number. Updates LeadCrm.metaLeadId and
 * LeadCrm.dadosMarketing with the ad-level attribution data.
 */
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma";

export interface MetaCrmMatchResult {
  matched: number;
  alreadyMatched: number;
  notFound: number;
}

/** Normalize a phone number to digits only for comparison */
function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return null;
  // Use last 9 digits to handle different DDD/country code formats
  return digits.slice(-9);
}

export async function matchMetaCrmLeads(
  clienteId: string
): Promise<MetaCrmMatchResult> {
  // Load all MetaLeadIndividual for this client that have attribution data
  const metaLeads = await prisma.metaLeadIndividual.findMany({
    where: { clienteId },
    select: {
      metaLeadId: true,
      emailLead: true,
      telefone: true,
      adId: true,
      adName: true,
      adsetId: true,
      adsetName: true,
      campaignId: true,
      campaignName: true,
      formId: true,
      formName: true,
    },
  });

  if (metaLeads.length === 0) return { matched: 0, alreadyMatched: 0, notFound: 0 };

  // Build lookup maps: normalized email → first match, normalized phone → first match, metaLeadId → record
  const byEmail = new Map<string, typeof metaLeads[0]>();
  const byPhone = new Map<string, typeof metaLeads[0]>();
  const byMetaLeadId = new Map<string, typeof metaLeads[0]>();

  for (const ml of metaLeads) {
    byMetaLeadId.set(ml.metaLeadId, ml);
    if (ml.emailLead) {
      const e = ml.emailLead.trim().toLowerCase();
      if (e && !byEmail.has(e)) byEmail.set(e, ml);
    }
    const phone = normalizePhone(ml.telefone);
    if (phone && !byPhone.has(phone)) byPhone.set(phone, ml);
  }

  // Load all CRM leads for this client (only select the fields we need for matching)
  const crmLeads = await prisma.leadCrm.findMany({
    where: { clienteId },
    select: {
      id: true,
      email: true,
      telefone: true,
      metaLeadId: true,
      dadosMarketing: true,
    },
  });

  let matched = 0;
  let alreadyMatched = 0;
  let notFound = 0;

  // Process in batches of 100 to avoid overwhelming the DB
  const BATCH_SIZE = 100;
  const updates: Array<{ id: string; metaLeadId: string; dadosMarketing: object }> = [];

  for (const crm of crmLeads) {
    // Already matched — skip only if dadosMarketing already has campaign info
    if (crm.metaLeadId) {
      const mkt = crm.dadosMarketing as Record<string, unknown> | null;
      const hasCampInfo = !!(mkt?.metaCampaignId || mkt?.metaCampaignName);
      if (hasCampInfo) {
        alreadyMatched++;
        continue;
      }
      // metaLeadId set but dadosMarketing missing campaign info — re-enrich
      const metaLead = byMetaLeadId.get(crm.metaLeadId);
      if (!metaLead || (!metaLead.campaignId && !metaLead.campaignName)) {
        alreadyMatched++;
        continue;
      }
      const dadosMarketing: Record<string, string | null> = {};
      if (metaLead.adId) dadosMarketing.metaAdId = metaLead.adId;
      if (metaLead.adName) dadosMarketing.metaAdName = metaLead.adName;
      if (metaLead.adsetId) dadosMarketing.metaAdsetId = metaLead.adsetId;
      if (metaLead.adsetName) dadosMarketing.metaAdsetName = metaLead.adsetName;
      if (metaLead.campaignId) dadosMarketing.metaCampaignId = metaLead.campaignId;
      if (metaLead.campaignName) dadosMarketing.metaCampaignName = metaLead.campaignName;
      if (metaLead.formId) dadosMarketing.metaFormId = metaLead.formId;
      if (metaLead.formName) dadosMarketing.metaFormName = metaLead.formName;
      updates.push({ id: crm.id, metaLeadId: crm.metaLeadId, dadosMarketing });
      matched++;
      if (updates.length >= BATCH_SIZE) await flushUpdates(updates.splice(0));
      continue;
    }

    // Try email match first (more reliable)
    let metaLead: typeof metaLeads[0] | undefined;
    if (crm.email) {
      metaLead = byEmail.get(crm.email.trim().toLowerCase());
    }

    // Fallback: phone match
    if (!metaLead) {
      const phone = normalizePhone(crm.telefone);
      if (phone) metaLead = byPhone.get(phone);
    }

    if (!metaLead) {
      notFound++;
      continue;
    }

    const dadosMarketing: Record<string, string | null> = {};
    if (metaLead.adId) dadosMarketing.metaAdId = metaLead.adId;
    if (metaLead.adName) dadosMarketing.metaAdName = metaLead.adName;
    if (metaLead.adsetId) dadosMarketing.metaAdsetId = metaLead.adsetId;
    if (metaLead.adsetName) dadosMarketing.metaAdsetName = metaLead.adsetName;
    if (metaLead.campaignId) dadosMarketing.metaCampaignId = metaLead.campaignId;
    if (metaLead.campaignName) dadosMarketing.metaCampaignName = metaLead.campaignName;
    if (metaLead.formId) dadosMarketing.metaFormId = metaLead.formId;
    if (metaLead.formName) dadosMarketing.metaFormName = metaLead.formName;

    updates.push({
      id: crm.id,
      metaLeadId: metaLead.metaLeadId,
      dadosMarketing,
    });
    matched++;

    // Flush batch
    if (updates.length >= BATCH_SIZE) {
      await flushUpdates(updates.splice(0));
    }
  }

  // Flush remaining
  if (updates.length > 0) await flushUpdates(updates);

  return { matched, alreadyMatched, notFound };
}

async function flushUpdates(
  updates: Array<{ id: string; metaLeadId: string; dadosMarketing: object }>
) {
  await Promise.all(
    updates.map(({ id, metaLeadId, dadosMarketing }) =>
      prisma.leadCrm.update({
        where: { id },
        data: {
          metaLeadId,
          dadosMarketing: dadosMarketing as Prisma.InputJsonValue,
        },
      })
    )
  );
}
