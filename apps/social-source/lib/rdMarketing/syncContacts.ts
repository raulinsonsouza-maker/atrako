/**
 * Sync invertido: RD Marketing como fonte primária de leads.
 *
 * Fluxo:
 * 1. Busca token + segmentationId do RdMarketingConfig do cliente
 * 2. Lista todos os contatos da segmentação (incremental via last_conversion_date)
 * 3. Para cada contato: busca detalhes completos (cf_data, tags, conversion_events)
 * 4. Tenta casar com LeadCrm existente por email → merge dadosMarketing
 * 5. Se não encontrado: cria stub LeadCrm ("Novo (RD)") vinculado ao CrmConfig
 */

import { Prisma } from "@/lib/generated/prisma";
import { prisma } from "@/lib/db";
import { RdMarketingClient, normalizeEnrichment } from "./client";

export interface SyncRdContactsResult {
  ok: boolean;
  processed: number;
  enriched: number;
  created: number;
  skipped: number;
  error?: string;
}

export async function syncRdMarketingContacts(
  clienteId: string,
  options?: { full?: boolean },
): Promise<SyncRdContactsResult> {
  // 1. Busca config de Marketing
  const mktConfig = await prisma.rdMarketingConfig.findUnique({ where: { clienteId } });
  if (!mktConfig?.ativo) {
    return { ok: true, processed: 0, enriched: 0, created: 0, skipped: 0, error: "RD Marketing não configurado" };
  }

  const creds = mktConfig.credenciais as Record<string, unknown>;
  const accessToken = creds.accessToken as string | undefined;
  if (!accessToken) {
    return { ok: false, processed: 0, enriched: 0, created: 0, skipped: 0, error: "Token não encontrado — faça o OAuth" };
  }

  const segmentationId = creds.segmentationId as string | undefined;
  if (!segmentationId) {
    return { ok: false, processed: 0, enriched: 0, created: 0, skipped: 0, error: "ID da Segmentação não configurado" };
  }

  const client = new RdMarketingClient(accessToken);

  // 2. Define janela incremental: desde o último sync (- 1 dia de overlap para segurança)
  const since =
    options?.full || !mktConfig.ultimoSyncAt
      ? undefined
      : new Date(mktConfig.ultimoSyncAt.getTime() - 24 * 60 * 60 * 1000);

  // 3. Lista contatos da segmentação
  const rdContacts = await client.listAllSegmentationContacts(segmentationId, {
    since,
    maxPages: 100,
  });

  if (rdContacts.length === 0) {
    return { ok: true, processed: 0, enriched: 0, created: 0, skipped: 0 };
  }

  // 4. Busca CrmConfig para o cliente (necessário para criar stubs)
  const crmConfig = await prisma.crmConfig.findUnique({
    where: { clienteId },
    select: { id: true },
  });

  // 5. Constrói mapa de leads existentes por email e rdContactId
  const existingLeads = await prisma.leadCrm.findMany({
    where: {
      clienteId,
      OR: [
        { email: { not: null } },
        { rdContactId: { not: null } },
      ],
    },
    select: { id: true, email: true, rdContactId: true, dadosMarketing: true },
  });

  const byEmail = new Map<string, typeof existingLeads[0]>();
  const byRdContactId = new Map<string, typeof existingLeads[0]>();
  for (const lead of existingLeads) {
    if (lead.email) byEmail.set(lead.email.trim().toLowerCase(), lead);
    if (lead.rdContactId) byRdContactId.set(lead.rdContactId, lead);
  }

  let processed = 0;
  let enriched = 0;
  let created = 0;
  let skipped = 0;

  // 6. Processa cada contato RD em lotes
  const BATCH = 20;
  for (let i = 0; i < rdContacts.length; i += BATCH) {
    const batch = rdContacts.slice(i, i + BATCH);

    await Promise.all(
      batch.map(async (rdContact) => {
        try {
          processed++;

          // Busca detalhe completo do contato (cf_data + tags + conversion_events)
          let fullContact = await client.getContact(rdContact.uuid);
          if (!fullContact && rdContact.email) {
            fullContact = await client.findByEmail(rdContact.email);
          }
          if (!fullContact) {
            skipped++;
            return;
          }

          const enrichment = normalizeEnrichment(fullContact);

          // Complementa UTMs via getContactEvents se não vieram no payload principal
          if (!enrichment.utmSource && !enrichment.utmMedium && !enrichment.trafficSource) {
            const events = await client.getContactEvents(rdContact.uuid, 1);
            // Usa o evento de conversão mais recente que tenha payload com UTMs
            const convEvent = events.find(
              (e) =>
                e.event_type === "CONVERSION" &&
                (e.payload?.utm_source || e.payload?.utm_medium || e.payload?.traffic_source),
            );
            if (convEvent?.payload) {
              if (!enrichment.utmSource && convEvent.payload.utm_source) enrichment.utmSource = String(convEvent.payload.utm_source);
              if (!enrichment.utmMedium && convEvent.payload.utm_medium) enrichment.utmMedium = String(convEvent.payload.utm_medium);
              if (!enrichment.utmCampaign && convEvent.payload.utm_campaign) enrichment.utmCampaign = String(convEvent.payload.utm_campaign);
              if (!enrichment.trafficSource && convEvent.payload.traffic_source) enrichment.trafficSource = String(convEvent.payload.traffic_source);
            }
          }

          // Tenta casar com lead existente
          const email = rdContact.email?.trim().toLowerCase() ?? fullContact.email?.trim().toLowerCase();
          const existingByRd = byRdContactId.get(rdContact.uuid);
          const existingByMail = email ? byEmail.get(email) : undefined;
          const existing = existingByRd ?? existingByMail;

          if (existing) {
            // Merge: preserva campos Meta + adiciona dados RD (RD pode sobrescrever campos RD antigos)
            const prev = (existing.dadosMarketing as Record<string, unknown> | null) ?? {};
            // Meta attribution keys that must be preserved and never overwritten by RD
            const META_KEYS = ["metaAdId", "metaAdName", "metaAdsetId", "metaAdsetName", "metaCampaignId", "metaCampaignName", "metaFormId", "metaFormName"];
            const metaPreserved: Record<string, unknown> = {};
            for (const k of META_KEYS) {
              if (prev[k] != null) metaPreserved[k] = prev[k];
            }
            const merged = { ...prev, ...enrichment, ...metaPreserved };

            await prisma.leadCrm.update({
              where: { id: existing.id },
              data: {
                dadosMarketing: merged as unknown as Prisma.InputJsonValue,
                rdContactId: rdContact.uuid,
              },
            });
            enriched++;
          } else if (crmConfig) {
            // Cria stub LeadCrm: lead está no RD mas não no CRM ainda
            const entradaDate =
              rdContact.last_conversion_date
                ? new Date(rdContact.last_conversion_date)
                : rdContact.created_at
                  ? new Date(rdContact.created_at)
                  : new Date();

            const stubCrmLeadId = `rd_${rdContact.uuid}`;

            await prisma.leadCrm.upsert({
              where: { clienteId_crmLeadId: { clienteId, crmLeadId: stubCrmLeadId } },
              create: {
                clienteId,
                crmConfigId: crmConfig.id,
                crmLeadId: stubCrmLeadId,
                rdContactId: rdContact.uuid,
                etapa: "Novo (RD)",
                nome: rdContact.name ?? fullContact.name ?? null,
                email: email ?? null,
                telefone: fullContact.mobile_phone ?? fullContact.personal_phone ?? null,
                fonte: enrichment.origemMarketing ?? enrichment.trafficSource ?? null,
                dataEntrada: entradaDate,
                dadosMarketing: enrichment as unknown as Prisma.InputJsonValue,
              },
              update: {
                // Se já existia o stub: atualiza o enriquecimento
                dadosMarketing: enrichment as unknown as Prisma.InputJsonValue,
                nome: rdContact.name ?? fullContact.name ?? null,
                email: email ?? null,
                telefone: fullContact.mobile_phone ?? fullContact.personal_phone ?? null,
                fonte: enrichment.origemMarketing ?? enrichment.trafficSource ?? null,
              },
            });
            created++;
          } else {
            // Sem CrmConfig: apenas conta como skipped (sem como criar o stub)
            skipped++;
          }
        } catch {
          skipped++;
        }
      }),
    );
  }

  // 7. Atualiza ultimoSyncAt
  await prisma.rdMarketingConfig.update({
    where: { clienteId },
    data: { ultimoSyncAt: new Date() },
  });

  return { ok: true, processed, enriched, created, skipped };
}
