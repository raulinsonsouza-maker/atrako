import { NextRequest, NextResponse } from "next/server";
import { fetchAdsWithCreatives } from "@/lib/meta/metaClient";
import { prisma } from "@/lib/db";
import { getIntegrationsConfig } from "@/lib/config/integrations";
import { findMetaAdsCriativosByClienteAndPeriod } from "@/lib/repositories/metaAdsCriativosRepository";

function parseDateOnly(value?: string | null) {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  const parsed = new Date(y, m - 1, d);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getDateRange(request: NextRequest) {
  const dataInicioParam = request.nextUrl.searchParams.get("dataInicio");
  const dataFimParam = request.nextUrl.searchParams.get("dataFim");
  const fallbackDays = Math.min(365, Math.max(1, parseInt(request.nextUrl.searchParams.get("periodo") ?? "90", 10) || 90));

  const dataFim = parseDateOnly(dataFimParam) ?? new Date();
  dataFim.setHours(23, 59, 59, 999);
  const dataInicio =
    parseDateOnly(dataInicioParam) ??
    new Date(dataFim.getFullYear(), dataFim.getMonth(), dataFim.getDate() - (fallbackDays - 1));
  dataInicio.setHours(0, 0, 0, 0);

  return {
    dataInicio,
    dataFim,
    dataInicioStr: formatDateOnly(dataInicio),
    dataFimStr: formatDateOnly(dataFim),
  };
}

function buildPersistedAdsResponse(
  rows: Awaited<ReturnType<typeof findMetaAdsCriativosByClienteAndPeriod>>
) {
  const byAd = new Map<
    string,
    {
      id: string;
      name: string;
      effective_status?: string;
      objective?: string;
      creative: {
        id?: string;
        thumbnail_url?: string;
        image_url?: string;
        image_url_full?: string;
        video_id?: string;
        video_source_url?: string;
        video_picture_url?: string;
        video_embed_html?: string;
        body?: string;
        title?: string;
      };
      spend: number;
      impressions: number;
      clicks: number;
      cpc: number;
      leads: number;
      purchases: number;
      messagingConversationsStarted: number;
    }
  >();

  for (const row of rows) {
    const existing = byAd.get(row.adId);
    const spend = Number(row.spend ?? 0);
    const clicks = row.clicks ?? 0;
    const impressions = row.impressions ?? 0;
    const cpc = Number(row.cpc ?? 0);
    const leads = row.leads ?? 0;
    const purchases = row.purchases ?? 0;
    const conversas = row.messagingConversationsStarted ?? 0;

    if (existing) {
      existing.spend += spend;
      existing.impressions += impressions;
      existing.clicks += clicks;
      existing.leads += leads;
      existing.purchases += purchases;
      existing.messagingConversationsStarted += conversas;
      if (!existing.creative.video_source_url && row.videoSourceUrl) {
        existing.creative.video_source_url = row.videoSourceUrl;
      }
      if (!existing.creative.image_url && row.imageUrl) {
        existing.creative.image_url = row.imageUrl;
      }
      if (!existing.creative.image_url_full && row.imageUrlFull) {
        existing.creative.image_url_full = row.imageUrlFull;
      }
      if (!existing.creative.thumbnail_url && (row.videoPictureUrl || row.imageUrl)) {
        existing.creative.thumbnail_url = row.videoPictureUrl ?? row.imageUrl ?? undefined;
      }
      if (!existing.creative.video_picture_url && row.videoPictureUrl) {
        existing.creative.video_picture_url = row.videoPictureUrl;
      }
      if (!existing.creative.video_embed_html && row.videoEmbedHtml) {
        existing.creative.video_embed_html = row.videoEmbedHtml;
      }
      if (!existing.cpc && cpc) existing.cpc = cpc;
      continue;
    }

    byAd.set(row.adId, {
      id: row.adId,
      name: row.adName,
      effective_status: row.effectiveStatus ?? undefined,
      objective: row.campaignObjective ?? undefined,
      creative: {
        id: row.creativeId ?? undefined,
        thumbnail_url: row.videoPictureUrl ?? row.imageUrl ?? undefined,
        image_url: row.imageUrl ?? undefined,
        image_url_full: row.imageUrlFull ?? undefined,
        video_id: row.videoId ?? undefined,
        video_source_url: row.videoSourceUrl ?? undefined,
        video_picture_url: row.videoPictureUrl ?? undefined,
        video_embed_html: row.videoEmbedHtml ?? undefined,
        body: row.body ?? undefined,
        title: row.title ?? undefined,
      },
      spend,
      impressions,
      clicks,
      cpc,
      leads,
      purchases,
      messagingConversationsStarted: conversas,
    });
  }

  return Array.from(byAd.values()).map((item) => {
    const actions: Array<{ action_type: string; value: string }> = [];
    if (item.leads > 0) {
      actions.push({ action_type: "lead", value: String(item.leads) });
      actions.push({ action_type: "onsite_conversion.lead_grouped", value: String(item.leads) });
    }
    if (item.purchases > 0) {
      actions.push({ action_type: "offsite_conversion.fb_pixel_purchase", value: String(item.purchases) });
    }
    if (item.messagingConversationsStarted > 0) {
      actions.push({ action_type: "onsite_conversion.messaging_conversation_started_7d", value: String(item.messagingConversationsStarted) });
    }
    return {
      id: item.id,
      name: item.name,
      effective_status: item.effective_status,
      adset: {
        campaign: {
          objective: item.objective,
        },
      },
      adcreatives: {
        data: [item.creative],
      },
      insights: {
        data: [
          {
            spend: item.spend.toFixed(2),
            impressions: String(item.impressions),
            clicks: String(item.clicks),
            ctr: item.impressions > 0 ? ((item.clicks / item.impressions) * 100).toFixed(2) : "0.00",
            cpc:
              item.clicks > 0
                ? (item.spend / item.clicks).toFixed(2)
                : item.cpc
                  ? item.cpc.toFixed(2)
                  : "0.00",
            ...(actions.length > 0 ? { actions } : {}),
          },
        ],
      },
    };
  });
}

export async function GET(request: NextRequest) {
  const fromDb = await getIntegrationsConfig();
  const token = fromDb.metaAccessToken ?? process.env.META_ACCESS_TOKEN;
  const defaultAccountId = fromDb.metaAdAccountId ?? process.env.META_AD_ACCOUNT_ID;
  const clienteId = request.nextUrl.searchParams.get("clienteId") ?? undefined;
  const liveMode = request.nextUrl.searchParams.get("live") === "1";
  const { dataInicio, dataFim, dataInicioStr, dataFimStr } = getDateRange(request);

  if (clienteId && !liveMode) {
    const persistedRows = await findMetaAdsCriativosByClienteAndPeriod(clienteId, dataInicio, dataFim);
    if (persistedRows.length > 0) {
      return NextResponse.json({
        source: "db",
        data: buildPersistedAdsResponse(persistedRows),
      });
    }
  }

  if (!token) {
    return NextResponse.json(
      { error: "META_ACCESS_TOKEN não configurado (Configurações ou variável de ambiente)" },
      { status: 503 }
    );
  }

  let accountId = defaultAccountId;
  if (clienteId) {
    const conta = await prisma.conta.findFirst({
      where: { clienteId, plataforma: "META" },
    });
    if (conta?.accountIdPlataforma) {
      accountId = conta.accountIdPlataforma;
    }
  }

  if (!accountId) {
    return NextResponse.json(
      { error: "META_AD_ACCOUNT_ID não configurado e cliente sem conta Meta" },
      { status: 503 }
    );
  }

  try {
    const ads = await fetchAdsWithCreatives(accountId, token, {
      dateFrom: dataInicioStr,
      dateTo: dataFimStr,
    });
    return NextResponse.json({ source: "live", data: ads });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
