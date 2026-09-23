import { Decimal } from "@/lib/generated/prisma/runtime/library";
import { prisma } from "@/lib/db";

export interface UpsertMetaAdsCriativoPayload {
  data: Date;
  adId: string;
  creativeId?: string | null;
  adName: string;
  effectiveStatus?: string | null;
  campaignId?: string | null;
  campaignName?: string | null;
  adsetId?: string | null;
  adsetName?: string | null;
  campaignObjective?: string | null;
  mediaType: string;
  imageUrl?: string | null;
  imageUrlFull?: string | null;
  videoId?: string | null;
  videoSourceUrl?: string | null;
  videoPictureUrl?: string | null;
  videoEmbedHtml?: string | null;
  body?: string | null;
  title?: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  leads?: number;
  purchases?: number;
  websitePurchasesConversionValue?: number;
  messagingConversationsStarted?: number;
  ctr?: number | null;
  cpc?: number | null;
  contaId?: string | null;
}

export async function upsertMetaAdsCriativo(
  clienteId: string,
  payload: UpsertMetaAdsCriativoPayload
) {
  const spendDecimal = new Decimal(payload.spend);
  const ctrDecimal = payload.ctr != null ? new Decimal(payload.ctr) : null;
  const cpcDecimal = payload.cpc != null ? new Decimal(payload.cpc) : null;
  const revenueDecimal = new Decimal(payload.websitePurchasesConversionValue ?? 0);

  return prisma.metaAdsCriativo.upsert({
    where: {
      clienteId_adId_data: {
        clienteId,
        adId: payload.adId,
        data: payload.data,
      },
    },
    create: {
      clienteId,
      contaId: payload.contaId ?? null,
      data: payload.data,
      adId: payload.adId,
      creativeId: payload.creativeId ?? null,
      adName: payload.adName,
      effectiveStatus: payload.effectiveStatus ?? null,
      campaignId: payload.campaignId ?? null,
      campaignName: payload.campaignName ?? null,
      adsetId: payload.adsetId ?? null,
      adsetName: payload.adsetName ?? null,
      campaignObjective: payload.campaignObjective ?? null,
      mediaType: payload.mediaType,
      imageUrl: payload.imageUrl ?? null,
      imageUrlFull: payload.imageUrlFull ?? null,
      videoId: payload.videoId ?? null,
      videoSourceUrl: payload.videoSourceUrl ?? null,
      videoPictureUrl: payload.videoPictureUrl ?? null,
      videoEmbedHtml: payload.videoEmbedHtml ?? null,
      body: payload.body ?? null,
      title: payload.title ?? null,
      spend: spendDecimal,
      impressions: payload.impressions,
      clicks: payload.clicks,
      leads: payload.leads ?? 0,
      purchases: payload.purchases ?? 0,
      websitePurchasesConversionValue: revenueDecimal,
      messagingConversationsStarted: payload.messagingConversationsStarted ?? 0,
      ctr: ctrDecimal,
      cpc: cpcDecimal,
    },
    update: {
      contaId: payload.contaId ?? null,
      creativeId: payload.creativeId ?? null,
      adName: payload.adName,
      effectiveStatus: payload.effectiveStatus ?? null,
      campaignId: payload.campaignId ?? null,
      campaignName: payload.campaignName ?? null,
      adsetId: payload.adsetId ?? null,
      adsetName: payload.adsetName ?? null,
      campaignObjective: payload.campaignObjective ?? null,
      mediaType: payload.mediaType,
      imageUrl: payload.imageUrl ?? null,
      imageUrlFull: payload.imageUrlFull ?? null,
      videoId: payload.videoId ?? null,
      videoSourceUrl: payload.videoSourceUrl ?? null,
      videoPictureUrl: payload.videoPictureUrl ?? null,
      videoEmbedHtml: payload.videoEmbedHtml ?? null,
      body: payload.body ?? null,
      title: payload.title ?? null,
      spend: spendDecimal,
      impressions: payload.impressions,
      clicks: payload.clicks,
      leads: payload.leads ?? 0,
      purchases: payload.purchases ?? 0,
      websitePurchasesConversionValue: revenueDecimal,
      messagingConversationsStarted: payload.messagingConversationsStarted ?? 0,
      ctr: ctrDecimal,
      cpc: cpcDecimal,
    },
  });
}

export async function findMetaAdsCriativosByClienteAndPeriod(
  clienteId: string,
  dataInicio: Date,
  dataFim: Date
) {
  return prisma.metaAdsCriativo.findMany({
    where: {
      clienteId,
      data: {
        gte: dataInicio,
        lte: dataFim,
      },
    },
    orderBy: [{ data: "desc" }, { updatedAt: "desc" }],
  });
}
