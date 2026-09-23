import { prisma } from "@/lib/db";

export interface UpsertGoogleAdsCampanhaPayload {
  campaignId: string;
  campaignName: string;
  campaignStatus?: string | null;
  campaignType?: string | null;
  data: Date;
  impressoes: number;
  cliques: number;
  custoMicros: bigint;
  conversoes: number;
  conversaoValorMicros?: bigint;
  alcance?: number;
  contaId?: string | null;
}

export async function upsertGoogleAdsCampanha(
  clienteId: string,
  payload: UpsertGoogleAdsCampanhaPayload
) {
  return prisma.googleAdsCampanha.upsert({
    where: {
      clienteId_campaignId_data: {
        clienteId,
        campaignId: payload.campaignId,
        data: payload.data,
      },
    },
    create: {
      clienteId,
      campaignId: payload.campaignId,
      campaignName: payload.campaignName,
      campaignStatus: payload.campaignStatus ?? null,
      campaignType: payload.campaignType ?? null,
      data: payload.data,
      impressoes: payload.impressoes,
      cliques: payload.cliques,
      custoMicros: payload.custoMicros,
      conversoes: payload.conversoes,
      conversaoValorMicros: payload.conversaoValorMicros ?? BigInt(0),
      alcance: payload.alcance ?? 0,
      contaId: payload.contaId ?? null,
    },
    update: {
      campaignName: payload.campaignName,
      campaignStatus: payload.campaignStatus ?? null,
      campaignType: payload.campaignType ?? null,
      impressoes: payload.impressoes,
      cliques: payload.cliques,
      custoMicros: payload.custoMicros,
      conversoes: payload.conversoes,
      conversaoValorMicros: payload.conversaoValorMicros ?? BigInt(0),
      alcance: payload.alcance ?? 0,
    },
  });
}
