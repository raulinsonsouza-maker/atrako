import { fetchLeadGenFormsWithDiag, fetchLeadsFromForm, fetchLeadsFromAd } from "@/lib/meta/metaClient";
import { prisma } from "@/lib/db";
import { resolveMetaCredentials } from "@/lib/config/resolveIntegracao";
import { dddToEstado } from "@/lib/utils/dddToEstado";

function getFieldValue(
  fieldData: Array<{ name: string; values: string[] }>,
  ...names: string[]
): string | null {
  for (const name of names) {
    const field = fieldData.find((f) =>
      f.name.toLowerCase().includes(name.toLowerCase())
    );
    if (field?.values?.[0]) return field.values[0];
  }
  return null;
}

export interface MetaLeadsSyncResult {
  leadsProcessed: number;
  leadsCreated: number;
  leadsFailed: number;
  formsFound: number;
  formsProcessed: number;
  formsSummary: Array<{ formId: string; formName: string; leadsFound: number }>;
  error?: string;
  /**
   * Non-fatal diagnostic: set when the sync technically succeeded but found
   * zero lead-gen forms to read. This is almost always a Meta *Page-access*
   * gap (the token can read ads/insights but is not assigned to the Page that
   * owns the forms, so leadgen_forms/leads return empty/forbidden) rather than
   * a code error. Surfaced so a 0-leads outcome is distinguishable from a
   * healthy "no new leads" run.
   */
  warning?: string;
}

export async function syncMetaLeadsCliente(
  clienteId: string,
  options?: { dateFrom?: string }
): Promise<MetaLeadsSyncResult> {
  const resolved = await resolveMetaCredentials(clienteId);
  if (!resolved) {
    return { leadsProcessed: 0, leadsCreated: 0, leadsFailed: 0, formsFound: 0, formsProcessed: 0, formsSummary: [], error: "META_ACCESS_TOKEN não configurado" };
  }
  const token = resolved.token;

  const conta = await prisma.conta.findFirst({
    where: { clienteId, plataforma: "META" },
  });

  if (!conta?.accountIdPlataforma) {
    return { leadsProcessed: 0, leadsCreated: 0, leadsFailed: 0, formsFound: 0, formsProcessed: 0, formsSummary: [], error: "Cliente sem conta Meta configurada" };
  }

  const accountId = conta.accountIdPlataforma;
  const contaId = conta.id;

  try {
    const { forms: allForms, permissionError } = await fetchLeadGenFormsWithDiag(accountId, token);

    console.log(`[metaLeadsSync] clienteId=${clienteId} accountId=${accountId} formsFound=${allForms.length}`, allForms.map(f => `${f.id}(${f.status ?? 'no-status'})`));

    // If the account itself is not accessible, stop immediately — no fallback helps.
    if (allForms.length === 0 && permissionError?.includes("ACCOUNT_NOT_ACCESSIBLE:")) {
      return {
        leadsProcessed: 0,
        leadsCreated: 0,
        leadsFailed: 0,
        formsFound: 0,
        formsProcessed: 0,
        formsSummary: [],
        error: permissionError.replace("ACCOUNT_NOT_ACCESSIBLE:", "").trim(),
        accountNotAccessible: true,
      } as MetaLeadsSyncResult & { accountNotAccessible?: boolean };
    }

    // When form discovery returns 0 (e.g. token lost Page permissions but leads endpoint still
    // works), fall back to form IDs previously stored in MetaLeadIndividual for this client.
    let forms: Array<{ id: string; name: string; status?: string }> = allForms;
    let usingFallbackForms = false;
    if (forms.length === 0) {
      const knownForms = await prisma.metaLeadIndividual.findMany({
        where: { clienteId },
        distinct: ["formId"],
        select: { formId: true, formName: true },
      });
      if (knownForms.length > 0) {
        forms = knownForms
          .filter((f): f is { formId: string; formName: string | null } => f.formId !== null)
          .map((f) => ({ id: f.formId, name: f.formName ?? f.formId }));
        usingFallbackForms = true;
        console.log(
          `[metaLeadsSync] form discovery returned 0 — using ${forms.length} fallback formIds from MetaLeadIndividual: ${forms.map((f) => f.id).join(", ")}`
        );
      }
    }

    let leadsProcessed = 0;
    let leadsCreated = 0;
    let leadsFailed = 0;
    const formsSummary: Array<{ formId: string; formName: string; leadsFound: number }> = [];

    for (const form of forms) {
      const leads = await fetchLeadsFromForm(form.id, token, {
        dateFrom: options?.dateFrom,
      });

      formsSummary.push({ formId: form.id, formName: form.name, leadsFound: leads.length });
      console.log(`[metaLeadsSync] form=${form.name}(${form.id}) status=${form.status} leadsFound=${leads.length}`);

      for (const lead of leads) {
        leadsProcessed++;
        const fd = lead.field_data ?? [];

        const fullName = getFieldValue(fd, "full_name", "nome completo", "nome", "name");
        const nomeEmpresa = getFieldValue(fd, "empresa", "company", "nome_empresa", "razao_social");
        const telefone = getFieldValue(fd, "phone", "telefone", "celular", "whatsapp");
        const emailLead = getFieldValue(fd, "email");
        const tipoEmpresa = getFieldValue(fd, "tipo_empresa", "tipo", "segmento", "ramo");
        const faixaFaturamento = getFieldValue(fd, "faturamento", "receita", "faixa", "faturamento_anual", "faturamento_mensal");
        const statusCrm = getFieldValue(fd, "status_crm", "status", "crm_status", "etapa", "fase", "pipeline");

        const estado = dddToEstado(telefone);

        const createdTime = new Date(lead.created_time);

        try {
          const existing = await prisma.metaLeadIndividual.findUnique({
            where: { clienteId_metaLeadId: { clienteId, metaLeadId: lead.id } },
            select: { id: true },
          });
          const isNew = !existing;
          await prisma.metaLeadIndividual.upsert({
            where: {
              clienteId_metaLeadId: {
                clienteId,
                metaLeadId: lead.id,
              },
            },
            create: {
              clienteId,
              contaId,
              metaLeadId: lead.id,
              formId: form.id,
              formName: form.name,
              campaignId: lead.campaign_id ?? null,
              campaignName: lead.campaign_name ?? null,
              adId: lead.ad_id ?? null,
              adName: lead.ad_name ?? null,
              adsetId: lead.adset_id ?? null,
              adsetName: lead.adset_name ?? null,
              fullName,
              createdTime,
              nomeEmpresa,
              telefone,
              estado,
              tipoEmpresa,
              faixaFaturamento,
              emailLead,
              statusCrm,
              rawFieldData: fd as object,
            },
            update: {
              campaignId: lead.campaign_id ?? null,
              campaignName: lead.campaign_name ?? null,
              adId: lead.ad_id ?? null,
              adName: lead.ad_name ?? null,
              adsetId: lead.adset_id ?? null,
              adsetName: lead.adset_name ?? null,
              fullName,
              nomeEmpresa,
              telefone,
              estado,
              tipoEmpresa,
              faixaFaturamento,
              emailLead,
              ...(statusCrm !== null ? { statusCrm } : {}),
              rawFieldData: fd as object,
            },
          });
          if (isNew) leadsCreated++;
        } catch (e) {
          leadsFailed++;
          console.error(`[metaLeadsSync] Failed to upsert lead ${lead.id} for client ${clienteId}:`, e instanceof Error ? e.message : e);
        }
      }
    }

    // ── Tier 4: /{ad_id}/leads — fallback when all form endpoints fail ────────
    // When form discovery/fetch returns 0 leads (typically because the token lacks
    // Page access), try fetching leads directly per-ad. This works with only
    // ads_read + leads_retrieval (no Page token required).
    let usingAdFallback = false;
    if (leadsProcessed === 0) {
      // Build ad ID set: try full account list first, fall back to known adIds in DB
      const adIdSet = new Set<string>();

      // Try fetching all ads from account (may be rate-limited — silently skip on failure)
      try {
        const adsParams = new URLSearchParams({
          access_token: token,
          fields: "id",
          effective_status: JSON.stringify(["ACTIVE", "PAUSED", "ARCHIVED"]),
          limit: "500",
        });
        let adsUrl: string | null = `https://graph.facebook.com/v19.0/${accountId}/ads?${adsParams}`;
        while (adsUrl) {
          const r = await fetch(adsUrl);
          const d = (await r.json()) as { data?: Array<{ id: string }>; paging?: { next?: string }; error?: { code: number } };
          if (!r.ok || d.error) break;
          for (const ad of d.data ?? []) adIdSet.add(ad.id);
          adsUrl = d.paging?.next ?? null;
        }
        if (adIdSet.size > 0) console.log(`[metaLeadsSync] T4 fetched ${adIdSet.size} adIds from account`);
      } catch { /* rate limited or network error — fall through to known adIds */ }

      // Supplement with adIds already recorded in MetaLeadIndividual
      const knownAds = await prisma.metaLeadIndividual.findMany({
        where: { clienteId, adId: { not: null } },
        distinct: ["adId"],
        select: { adId: true },
      });
      for (const a of knownAds) if (a.adId) adIdSet.add(a.adId);

      const adIds = [...adIdSet];

      if (adIds.length > 0) {
        usingAdFallback = true;
        console.log(`[metaLeadsSync] T4 per-ad fallback: trying ${adIds.length} adIds (account + known)`);
        for (const adId of adIds) {
          const adLeads = await fetchLeadsFromAd(adId, token);
          if (adLeads.length === 0) continue;
          console.log(`[metaLeadsSync] T4 ad=${adId} leads=${adLeads.length}`);
          for (const lead of adLeads) {
            leadsProcessed++;
            const fd = lead.field_data ?? [];
            const fullName = getFieldValue(fd, "full_name", "nome completo", "nome", "name");
            const nomeEmpresa = getFieldValue(fd, "empresa", "company", "nome_empresa", "razao_social");
            const telefone = getFieldValue(fd, "phone", "telefone", "celular", "whatsapp");
            const emailLead = getFieldValue(fd, "email");
            const tipoEmpresa = getFieldValue(fd, "tipo_empresa", "tipo", "segmento", "ramo");
            const faixaFaturamento = getFieldValue(fd, "faturamento", "receita", "faixa", "faturamento_anual", "faturamento_mensal");
            const statusCrm = getFieldValue(fd, "status_crm", "status", "crm_status", "etapa", "fase", "pipeline");
            const estado = dddToEstado(telefone);
            const createdTime = new Date(lead.created_time);
            try {
              const existing = await prisma.metaLeadIndividual.findUnique({
                where: { clienteId_metaLeadId: { clienteId, metaLeadId: lead.id } },
                select: { id: true },
              });
              const isNew = !existing;
              await prisma.metaLeadIndividual.upsert({
                where: { clienteId_metaLeadId: { clienteId, metaLeadId: lead.id } },
                create: {
                  clienteId,
                  contaId,
                  metaLeadId: lead.id,
                  formId: lead.form_id ?? null,
                  formName: null,
                  campaignId: lead.campaign_id ?? null,
                  campaignName: lead.campaign_name ?? null,
                  adId: lead.ad_id ?? null,
                  adName: lead.ad_name ?? null,
                  adsetId: lead.adset_id ?? null,
                  adsetName: lead.adset_name ?? null,
                  fullName,
                  createdTime,
                  nomeEmpresa,
                  telefone,
                  estado,
                  tipoEmpresa,
                  faixaFaturamento,
                  emailLead,
                  statusCrm,
                  platform: (lead as any).platform ?? null,
                  rawFieldData: fd as object,
                },
                update: {
                  campaignId: lead.campaign_id ?? null,
                  campaignName: lead.campaign_name ?? null,
                  adId: lead.ad_id ?? null,
                  adName: lead.ad_name ?? null,
                  adsetId: lead.adset_id ?? null,
                  adsetName: lead.adset_name ?? null,
                  fullName,
                  nomeEmpresa,
                  telefone,
                  estado,
                  tipoEmpresa,
                  faixaFaturamento,
                  emailLead,
                  ...(statusCrm !== null ? { statusCrm } : {}),
                  rawFieldData: fd as object,
                },
              });
              if (isNew) leadsCreated++;
            } catch (e) {
              leadsFailed++;
              console.error(`[metaLeadsSync] T4 failed lead ${lead.id}:`, e instanceof Error ? e.message : e);
            }
          }
        }
        if (leadsProcessed > 0) {
          console.log(`[metaLeadsSync] T4 completed: ${leadsProcessed} leads via per-ad endpoint`);
        }
      }
    }

    let warning: string | undefined;
    if (allForms.length === 0 && usingAdFallback && leadsProcessed > 0) {
      warning = `Acesso à Página insuficiente para formulários — sincronizado via endpoint por anúncio (T4). ${leadsProcessed} lead(s) obtidos.${permissionError ? ` Erro original: ${permissionError}` : ""}`;
    } else if (allForms.length === 0 && usingFallbackForms && !usingAdFallback) {
      warning = `Descoberta de formulários falhou (acesso à Página insuficiente) — sincronizado via ${forms.length} formulário(s) conhecido(s) de sincronizações anteriores.${permissionError ? ` Erro original: ${permissionError}` : ""}`;
    } else if (allForms.length === 0 && !usingFallbackForms && !usingAdFallback) {
      warning =
        "Nenhum formulário de lead acessível. O token Meta consegue ler anúncios/investimento, mas não tem acesso de Página aos formulários (o system user precisa estar atribuído à Página com pages_manage_ads/pages_read_engagement). Sem isso, os leads de formulário não são sincronizados.";
    }
    return { leadsProcessed, leadsCreated, leadsFailed, formsFound: allForms.length, formsProcessed: forms.length, formsSummary, warning };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { leadsProcessed: 0, leadsCreated: 0, leadsFailed: 0, formsFound: 0, formsProcessed: 0, formsSummary: [], error: message };
  }
}
