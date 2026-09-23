import { Prisma } from "@/lib/generated/prisma";
import { prisma } from "@/lib/db";
import { getCrmAdapter } from "@/lib/crm/factory";
import { matchMetaCrmLeads } from "@/lib/crm/metaCrmMatcher";
import { syncRdMarketingContacts } from "@/lib/rdMarketing/syncContacts";
import { enrichCrmLeads } from "@/lib/rdMarketing/enrich";
import { isSyntheticDemoCliente } from "@/lib/demo/syntheticDemo";
import { createLeadEvent, publishAtrakoEvents } from "@/lib/atrako/events";

export interface CrmSyncResult {
  ok: boolean;
  leadsProcessed: number;
  leadsUpserted: number;
  error?: string;
}

export async function syncCrmCliente(
  clienteId: string,
  options?: { full?: boolean },
): Promise<CrmSyncResult> {
  if (await isSyntheticDemoCliente(clienteId)) {
    return { ok: true, leadsProcessed: 0, leadsUpserted: 0 };
  }
  const config = await prisma.crmConfig.findUnique({ where: { clienteId } });

  if (!config || !config.ativo) {
    return { ok: true, leadsProcessed: 0, leadsUpserted: 0 };
  }

  try {
    const adapter = await getCrmAdapter(config);

    // Incremental sync (default) only fetches leads whose CV "data de referência"
    // changed recently. Problem: CV/RD Station attributes origem/mídia/conversão
    // *asynchronously* after a lead is created, and once a lead falls outside the
    // incremental window it is never re-fetched — so any lead first synced before
    // its attribution was filled in stays permanently "sparse" (empty dadosCv) and
    // silently fails the attribution filters. A full sync (no `since`) re-fetches
    // every lead and repairs them; it is used by the manual "Atualizar agora".
    const since =
      options?.full || !config.ultimoSyncAt
        ? undefined
        : new Date(config.ultimoSyncAt.getTime() - 3 * 24 * 60 * 60 * 1000);

    const leads = await adapter.fetchLeads(since ? { since } : undefined);

    let upserted = 0;
    const atrakoEvents = [];
    for (const lead of leads) {
      const existingLead = await prisma.leadCrm.findUnique({
        where: { clienteId_crmLeadId: { clienteId, crmLeadId: lead.crmLeadId } },
        select: { id: true, etapa: true },
      });

      const savedLead = await prisma.leadCrm.upsert({
        where: { clienteId_crmLeadId: { clienteId, crmLeadId: lead.crmLeadId } },
        create: {
          clienteId,
          crmConfigId: config.id,
          crmLeadId: lead.crmLeadId,
          etapa: lead.etapa,
          ordemEtapa: lead.ordemEtapa ?? null,
          nome: lead.nome ?? null,
          dataEntrada: lead.dataEntrada,
          dataFechamento: lead.dataFechamento ?? null,
          valor: lead.valor ?? null,
          email: lead.email ?? null,
          telefone: lead.telefone ?? null,
          fonte: lead.fonte ?? null,
          rating: lead.rating ?? null,
          status: lead.status ?? null,
          rdContactId: lead.rdContactId ?? null,
          momentoLead: lead.momentoLead ?? null,
          dadosCv: (lead.dadosCv as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        },
        update: {
          etapa: lead.etapa,
          ordemEtapa: lead.ordemEtapa ?? null,
          nome: lead.nome ?? null,
          dataFechamento: lead.dataFechamento ?? null,
          valor: lead.valor ?? null,
          email: lead.email ?? null,
          telefone: lead.telefone ?? null,
          fonte: lead.fonte ?? null,
          rating: lead.rating ?? null,
          status: lead.status ?? null,
          rdContactId: lead.rdContactId ?? null,
          momentoLead: lead.momentoLead ?? null,
          dadosCv: (lead.dadosCv as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        },
      });

      if (!existingLead) {
        atrakoEvents.push(createLeadEvent({
          name: "lead.created",
          workspaceId: clienteId,
          leadId: savedLead.id,
          idempotencyKey: `central:lead.created:${clienteId}:${lead.crmLeadId}`,
          occurredAt: lead.dataEntrada,
          payload: {
            crmLeadId: lead.crmLeadId,
            name: lead.nome,
            email: lead.email,
            phone: lead.telefone,
            source: lead.fonte,
            stage: lead.etapa,
            value: lead.valor,
          },
        }));
      } else if (existingLead.etapa !== lead.etapa) {
        atrakoEvents.push(createLeadEvent({
          name: "lead.stage_changed",
          workspaceId: clienteId,
          leadId: savedLead.id,
          idempotencyKey: `central:lead.stage_changed:${savedLead.id}:${lead.etapa}:${lead.dataEntrada.toISOString()}`,
          payload: {
            crmLeadId: lead.crmLeadId,
            previousStage: existingLead.etapa,
            stage: lead.etapa,
          },
        }));
      }
      upserted++;
    }

    try {
      await publishAtrakoEvents(atrakoEvents);
    } catch (error) {
      console.warn(
        `[crmSync] Atrako event bridge failed for ${clienteId}:`,
        error instanceof Error ? error.message : error,
      );
    }

    await prisma.crmConfig.update({
      where: { id: config.id },
      data: { ultimoSyncAt: new Date() },
    });

    // Cross-reference with Meta Lead forms to populate creative attribution
    try {
      const matchResult = await matchMetaCrmLeads(clienteId);
      console.log(`[crmSync] metaCrmMatch clienteId=${clienteId} matched=${matchResult.matched} alreadyMatched=${matchResult.alreadyMatched} notFound=${matchResult.notFound}`);
    } catch (e) {
      // Non-fatal — log and continue
      console.warn(`[crmSync] metaCrmMatch failed for ${clienteId}:`, e instanceof Error ? e.message : e);
    }

    // RD Marketing: sync invertido (segmentação configurada) ou enrichment legado (fallback)
    try {
      const mktConfig = await prisma.rdMarketingConfig.findUnique({ where: { clienteId } });
      const mktCreds = mktConfig?.credenciais as Record<string, unknown> | null;
      const hasSegmentation = !!(mktCreds?.segmentationId && mktCreds?.accessToken);

      if (mktConfig?.ativo && hasSegmentation) {
        // Modo primário: RD como fonte de leads — lista contatos da segmentação
        const rdResult = await syncRdMarketingContacts(clienteId, { full: options?.full });
        if (rdResult.processed > 0 || rdResult.error) {
          console.log(`[crmSync] rdContactsSync clienteId=${clienteId} processed=${rdResult.processed} enriched=${rdResult.enriched} created=${rdResult.created} skipped=${rdResult.skipped}${rdResult.error ? ` error=${rdResult.error}` : ""}`);
        }
      } else {
        // Fallback legado: enriquece leads CRM existentes com dados do RD via email
        const enrichResult = await enrichCrmLeads(clienteId);
        if (enrichResult.enriched > 0 || !enrichResult.ok) {
          console.log(`[crmSync] rdEnrich(fallback) clienteId=${clienteId} enriched=${enrichResult.enriched} skipped=${enrichResult.skipped}${enrichResult.ok ? "" : ` error=${enrichResult.error}`}`);
        }
      }
    } catch (e) {
      // Non-fatal — log and continue
      console.warn(`[crmSync] rdMarketingStep failed for ${clienteId}:`, e instanceof Error ? e.message : e);
    }

    return { ok: true, leadsProcessed: leads.length, leadsUpserted: upserted };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return { ok: false, leadsProcessed: 0, leadsUpserted: 0, error };
  }
}

export async function syncCrmTodosClientes(): Promise<Array<{ clienteId: string; error?: string }>> {
  const configs = await prisma.crmConfig.findMany({
    where: { ativo: true },
    select: { clienteId: true },
  });

  const results: Array<{ clienteId: string; error?: string }> = [];

  for (const { clienteId } of configs) {
    const r = await syncCrmCliente(clienteId);
    results.push({ clienteId, error: r.error });
  }

  return results;
}
