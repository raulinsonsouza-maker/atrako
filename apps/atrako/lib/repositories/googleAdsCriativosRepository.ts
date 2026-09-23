import { prisma } from "@/lib/db";

export interface UpsertGoogleAdsCriativoPayload {
  adResourceName: string;
  campaignId?: string | null;
  campaignName?: string | null;
  campaignStatus?: string | null;
  adGroupId?: string | null;
  adGroupName?: string | null;
  headline1?: string | null;
  headline2?: string | null;
  description?: string | null;
  finalUrls?: string | null;
  data: Date;
  impressoes: number;
  cliques: number;
  custoMicros: bigint;
  conversoes: number;
  conversaoValorMicros?: bigint;
  contaId?: string | null;
}

export async function upsertGoogleAdsCriativo(
  clienteId: string,
  payload: UpsertGoogleAdsCriativoPayload
) {
  return prisma.googleAdsCriativo.upsert({
    where: {
      clienteId_adResourceName_data: {
        clienteId,
        adResourceName: payload.adResourceName,
        data: payload.data,
      },
    },
    create: {
      clienteId,
      adResourceName: payload.adResourceName,
      campaignId: payload.campaignId ?? null,
      campaignName: payload.campaignName ?? null,
      campaignStatus: payload.campaignStatus ?? null,
      adGroupId: payload.adGroupId ?? null,
      adGroupName: payload.adGroupName ?? null,
      headline1: payload.headline1 ?? null,
      headline2: payload.headline2 ?? null,
      description: payload.description ?? null,
      finalUrls: payload.finalUrls ?? null,
      data: payload.data,
      impressoes: payload.impressoes,
      cliques: payload.cliques,
      custoMicros: payload.custoMicros,
      conversoes: payload.conversoes,
      conversaoValorMicros: payload.conversaoValorMicros ?? BigInt(0),
      contaId: payload.contaId ?? null,
    },
    update: {
      campaignId: payload.campaignId ?? null,
      campaignName: payload.campaignName ?? null,
      campaignStatus: payload.campaignStatus ?? null,
      adGroupId: payload.adGroupId ?? null,
      adGroupName: payload.adGroupName ?? null,
      headline1: payload.headline1 ?? null,
      headline2: payload.headline2 ?? null,
      description: payload.description ?? null,
      finalUrls: payload.finalUrls ?? null,
      impressoes: payload.impressoes,
      cliques: payload.cliques,
      custoMicros: payload.custoMicros,
      conversoes: payload.conversoes,
      conversaoValorMicros: payload.conversaoValorMicros ?? BigInt(0),
    },
  });
}
