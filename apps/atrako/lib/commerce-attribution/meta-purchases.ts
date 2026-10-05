/**
 * Compras do Pixel por anúncio e dia — base da conciliação com os pedidos da loja.
 * `action_report_time=conversion` põe a compra no dia em que aconteceu (o padrão do Meta é o dia da impressão).
 */

import { prisma } from "@/lib/db";
import { resolveMetaCredentials } from "@/lib/config/resolveIntegracao";
import { META_GRAPH_VERSION } from "@/lib/integrations/meta/graph";

const GRAPH = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
const PURCHASE_ACTIONS = ["offsite_conversion.fb_pixel_purchase", "purchase", "omni_purchase"];

type ActionStat = { action_type: string; value?: string; "7d_click"?: string; "1d_view"?: string };
type InsightRow = {
  ad_id?: string;
  ad_name?: string;
  adset_id?: string;
  adset_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  date_start?: string;
  actions?: ActionStat[];
  action_values?: ActionStat[];
};

function pickPurchase(stats: ActionStat[] | undefined): ActionStat | null {
  if (!stats?.length) return null;
  for (const type of PURCHASE_ACTIONS) {
    const hit = stats.find((s) => s.action_type === type);
    if (hit) return hit;
  }
  return null;
}

const num = (v: string | undefined) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

function chunks(from: string, to: string, maxDays = 30): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  let cur = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (cur <= end) {
    const stop = new Date(cur);
    stop.setUTCDate(stop.getUTCDate() + maxDays - 1);
    if (stop > end) stop.setTime(end.getTime());
    out.push([isoDay(cur), isoDay(stop)]);
    cur = new Date(stop);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

async function fetchRows(actId: string, token: string, since: string, until: string): Promise<InsightRow[]> {
  const params = new URLSearchParams({
    level: "ad",
    time_increment: "1",
    time_range: JSON.stringify({ since, until }),
    action_report_time: "conversion",
    action_attribution_windows: JSON.stringify(["7d_click", "1d_view"]),
    fields: "ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,date_start,actions,action_values",
    filtering: JSON.stringify([{ field: "action_type", operator: "IN", value: PURCHASE_ACTIONS }]),
    limit: "500",
    access_token: token,
  });
  const rows: InsightRow[] = [];
  let url: string | null = `${GRAPH}/${actId}/insights?${params}`;
  while (url) {
    const res = await fetch(url);
    const body = (await res.json()) as { data?: InsightRow[]; paging?: { next?: string }; error?: { message?: string } };
    if (!res.ok || body.error) throw new Error(body.error?.message ?? `Meta HTTP ${res.status}`);
    rows.push(...(body.data ?? []));
    url = body.paging?.next ?? null;
  }
  return rows;
}

export type MetaPurchaseSyncResult = { accounts: number; rows: number; error?: string };

/** Sincroniza `MetaAdPurchaseDaily` de todas as contas Meta do cliente no intervalo (datas YYYY-MM-DD). */
export async function syncMetaAdPurchases(
  clienteId: string,
  range: { dateFrom: string; dateTo: string },
): Promise<MetaPurchaseSyncResult> {
  const creds = await resolveMetaCredentials(clienteId);
  if (!creds?.token) return { accounts: 0, rows: 0, error: "Meta não conectada" };

  const contas = await prisma.conta.findMany({
    where: { clienteId, plataforma: "META", accountIdPlataforma: { not: null } },
    select: { accountIdPlataforma: true },
  });
  const accountIds = Array.from(
    new Set([...contas.map((c) => c.accountIdPlataforma!), ...(creds.accountId ? [creds.accountId] : [])].map((a) => a.replace(/^act_/, ""))),
  );
  if (!accountIds.length) return { accounts: 0, rows: 0, error: "Sem conta de anúncios Meta" };

  let total = 0;
  for (const accountId of accountIds) {
    const seen = new Set<string>();
    for (const [since, until] of chunks(range.dateFrom, range.dateTo)) {
      const rows = await fetchRows(`act_${accountId}`, creds.token, since, until);
      for (const r of rows) {
        if (!r.ad_id || !r.date_start) continue;
        const count = pickPurchase(r.actions);
        if (!count) continue;
        const value = pickPurchase(r.action_values);
        const date = new Date(`${r.date_start}T00:00:00Z`);
        const data = {
          adAccountId: accountId,
          campaignId: r.campaign_id ?? "",
          campaignName: (r.campaign_name ?? "").slice(0, 300),
          adsetId: r.adset_id ?? "",
          adsetName: (r.adset_name ?? "").slice(0, 300),
          adName: (r.ad_name ?? "").slice(0, 300),
          clickPurchases: Math.round(num(count["7d_click"])),
          clickValueCents: Math.round(num(value?.["7d_click"]) * 100),
          viewPurchases: Math.round(num(count["1d_view"])),
          viewValueCents: Math.round(num(value?.["1d_view"]) * 100),
          syncedAt: new Date(),
        };
        await prisma.metaAdPurchaseDaily.upsert({
          where: { clienteId_adId_date: { clienteId, adId: r.ad_id, date } },
          create: { clienteId, adId: r.ad_id, date, ...data },
          update: data,
        });
        seen.add(`${r.ad_id}|${r.date_start}`);
        total++;
      }
    }
    // Meta revisa conversões por até ~3 dias: o que sumiu da resposta deixa de existir.
    const stale = await prisma.metaAdPurchaseDaily.findMany({
      where: {
        clienteId,
        adAccountId: accountId,
        date: { gte: new Date(`${range.dateFrom}T00:00:00Z`), lte: new Date(`${range.dateTo}T00:00:00Z`) },
      },
      select: { id: true, adId: true, date: true },
    });
    const staleIds = stale.filter((s) => !seen.has(`${s.adId}|${isoDay(s.date)}`)).map((s) => s.id);
    if (staleIds.length) await prisma.metaAdPurchaseDaily.deleteMany({ where: { id: { in: staleIds } } });
  }
  return { accounts: accountIds.length, rows: total };
}
