/**
 * Sync completo Meta leads para Incorporadora via /{ad_id}/leads
 */
import { prisma } from "../lib/db";
import { getIntegrationsConfig } from "../lib/config/integrations";
import { matchMetaCrmLeads } from "../lib/crm/metaCrmMatcher";
import { dddToEstado } from "../lib/utils/dddToEstado";

const clienteId = "cmp4fsgfm0001o33ngp93d5l1";
const GRAPH_BASE = "https://graph.facebook.com/v19.0";

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

async function fetchAllAds(accountId: string, token: string) {
  const allAds: Array<{ id: string; name: string }> = [];
  let url: string | null =
    `${GRAPH_BASE}/act_${accountId}/ads?access_token=${encodeURIComponent(token)}&fields=id,name&effective_status=${encodeURIComponent(JSON.stringify(["ACTIVE", "PAUSED", "ARCHIVED"]))}&limit=200`;
  while (url) {
    const res = await fetch(url);
    const d: any = await res.json();
    if (!res.ok || d.error) { console.error(`[fetchAllAds] error: ${d.error?.message}`); break; }
    allAds.push(...(d.data ?? []));
    url = d.paging?.next ?? null;
  }
  return allAds;
}

async function fetchLeadsForAd(adId: string, token: string): Promise<any[]> {
  const fields = "id,created_time,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,field_data,is_organic,platform";
  const leads: any[] = [];
  let url: string | null =
    `${GRAPH_BASE}/${adId}/leads?access_token=${encodeURIComponent(token)}&fields=${encodeURIComponent(fields)}&limit=100`;
  while (url) {
    const res = await fetch(url);
    const d: any = await res.json();
    if (!res.ok || d.error) { break; }
    leads.push(...(d.data ?? []));
    url = d.paging?.next ?? null;
  }
  return leads;
}

async function main() {
  const config = await getIntegrationsConfig();
  const token = config.metaAccessToken ?? process.env.META_ACCESS_TOKEN;
  if (!token) throw new Error("META_ACCESS_TOKEN não configurado");

  const conta = await prisma.conta.findFirst({ where: { clienteId, plataforma: "META" } });
  if (!conta?.accountIdPlataforma) throw new Error("Conta Meta não encontrada");
  const { accountIdPlataforma: accountId, id: contaId } = conta;

  console.log(`=== Buscando todos os anúncios da conta ${accountId} ===`);
  const ads = await fetchAllAds(accountId, token);
  console.log(`Total de anúncios: ${ads.length}`);

  let totalLeads = 0;
  let adsWithLeads = 0;
  let upserted = 0;
  let failed = 0;

  for (const ad of ads) {
    const leads = await fetchLeadsForAd(ad.id, token);
    if (leads.length === 0) continue;
    adsWithLeads++;
    totalLeads += leads.length;
    const sample = leads[0];
    console.log(`  Ad ${ad.id} (${(ad.name ?? "").slice(0, 35)}): ${leads.length} leads, camp: ${sample?.campaign_name?.slice(0, 35) ?? "?"}`);

    for (const lead of leads) {
      try {
        const fieldData: Array<{ name: string; values: string[] }> = lead.field_data ?? [];
        const fullName = getFieldValue(fieldData, "nome_completo", "full_name", "nome", "name") ?? "";
        const emailLead = getFieldValue(fieldData, "email", "e-mail") ?? "";
        const telefone = getFieldValue(fieldData, "telefone", "phone", "celular", "whatsapp") ?? "";
        const nomeEmpresa = getFieldValue(fieldData, "empresa", "company", "nome_empresa") ?? null;
        const tipoEmpresa = getFieldValue(fieldData, "tipo_empresa", "tipo", "segmento") ?? null;
        const faixaFaturamento = getFieldValue(fieldData, "faturamento", "receita", "faixa") ?? null;
        const estado = getFieldValue(fieldData, "estado", "state") ?? (telefone ? dddToEstado(telefone) : null) ?? "";

        await prisma.metaLeadIndividual.upsert({
          where: { clienteId_metaLeadId: { clienteId, metaLeadId: lead.id } },
          create: {
            metaLeadId: lead.id,
            contaId,
            clienteId,
            formId: lead.form_id ?? null,
            formName: null,
            createdTime: new Date(lead.created_time),
            fullName,
            emailLead,
            telefone,
            estado,
            nomeEmpresa,
            tipoEmpresa,
            faixaFaturamento,
            adId: lead.ad_id ?? null,
            adName: lead.ad_name ?? null,
            adsetId: lead.adset_id ?? null,
            adsetName: lead.adset_name ?? null,
            campaignId: lead.campaign_id ?? null,
            campaignName: lead.campaign_name ?? null,
            rawFieldData: lead,
            platform: lead.platform ?? null,
          },
          update: {
            adId: lead.ad_id ?? null,
            adName: lead.ad_name ?? null,
            adsetId: lead.adset_id ?? null,
            adsetName: lead.adset_name ?? null,
            campaignId: lead.campaign_id ?? null,
            campaignName: lead.campaign_name ?? null,
            rawFieldData: lead,
          },
        });
        upserted++;
      } catch (e) {
        console.error(`Falha lead ${lead.id}:`, (e as Error).message?.slice(0, 100));
        failed++;
      }
    }
  }

  console.log(`\nTotal leads: ${totalLeads} (${adsWithLeads} anúncios com leads)`);
  console.log(`BD: ${upserted} upserted, ${failed} failed`);

  const juneLeads = await prisma.metaLeadIndividual.findMany({
    where: { clienteId, createdTime: { gte: new Date("2026-06-01") } },
    select: { metaLeadId: true, fullName: true, createdTime: true, campaignName: true },
    orderBy: { createdTime: "desc" },
  });
  console.log(`\nLeads de junho no BD: ${juneLeads.length}`);
  juneLeads.forEach(l => console.log(`  ${l.fullName?.padEnd(25)} ${l.createdTime.toISOString().slice(0,10)} | ${l.campaignName?.slice(0,40)}`));

  console.log("\n=== Match CRM × Meta ===");
  const r = await matchMetaCrmLeads(clienteId);
  console.log("Match:", JSON.stringify(r, null, 2));
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
