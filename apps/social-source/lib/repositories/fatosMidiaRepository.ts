import { Decimal } from "@/lib/generated/prisma/runtime/library";
import { prisma } from "@/lib/db";

export async function upsertFatoMidia(
  clienteId: string,
  data: Date,
  canal: string,
  payload: {
    impressoes: number;
    cliques: number;
    leads: number;
    conversoes: number;
    onFacebookLeads?: number;
    websiteLeads?: number;
    messagingConversationsStarted?: number;
    contacts?: number;
    purchases?: number;
    investimento: number;
    cpl?: number | null;
    costPerPurchase?: number | null;
    websitePurchaseRoas?: number | null;
    websitePurchasesConversionValue?: number;
    alcance?: number;
    checkoutIniciado?: number;
    profileVisits?: number;
    addToCart?: number;
    landingPageViews?: number;
    rawRowHash?: string | null;
    contaId?: string | null;
    campaignName?: string;
    campaignId?: string;
  }
) {
  const investimentoDecimal = new Decimal(payload.investimento);
  const cplDecimal = payload.cpl != null ? new Decimal(payload.cpl) : null;
  const costPerPurchaseDecimal =
    payload.costPerPurchase != null ? new Decimal(payload.costPerPurchase) : null;
  const websitePurchaseRoasDecimal =
    payload.websitePurchaseRoas != null ? new Decimal(payload.websitePurchaseRoas) : null;
  const websitePurchasesConversionValueDecimal = new Decimal(
    payload.websitePurchasesConversionValue ?? 0
  );
  const campaignName = payload.campaignName ?? "";
  const campaignId = payload.campaignId ?? "";

  return prisma.fatoMidiaDiario.upsert({
    where: {
      clienteId_data_canal_campaignName: { clienteId, data, canal, campaignName },
    },
    create: {
      clienteId,
      data,
      canal,
      campaignName,
      campaignId,
      impressoes: payload.impressoes,
      cliques: payload.cliques,
      leads: payload.leads,
      conversoes: payload.conversoes,
      onFacebookLeads: payload.onFacebookLeads ?? 0,
      websiteLeads: payload.websiteLeads ?? 0,
      messagingConversationsStarted: payload.messagingConversationsStarted ?? 0,
      contacts: payload.contacts ?? 0,
      purchases: payload.purchases ?? 0,
      alcance: payload.alcance ?? 0,
      checkoutIniciado: payload.checkoutIniciado ?? 0,
      profileVisits: payload.profileVisits ?? 0,
      addToCart: payload.addToCart ?? 0,
      landingPageViews: payload.landingPageViews ?? 0,
      investimento: investimentoDecimal,
      cpl: cplDecimal,
      costPerPurchase: costPerPurchaseDecimal,
      websitePurchaseRoas: websitePurchaseRoasDecimal,
      websitePurchasesConversionValue: websitePurchasesConversionValueDecimal,
      rawRowHash: payload.rawRowHash ?? null,
      contaId: payload.contaId ?? null,
    },
    update: {
      campaignId,
      impressoes: payload.impressoes,
      cliques: payload.cliques,
      leads: payload.leads,
      conversoes: payload.conversoes,
      onFacebookLeads: payload.onFacebookLeads ?? 0,
      websiteLeads: payload.websiteLeads ?? 0,
      messagingConversationsStarted: payload.messagingConversationsStarted ?? 0,
      contacts: payload.contacts ?? 0,
      purchases: payload.purchases ?? 0,
      alcance: payload.alcance ?? 0,
      checkoutIniciado: payload.checkoutIniciado ?? 0,
      profileVisits: payload.profileVisits ?? 0,
      addToCart: payload.addToCart ?? 0,
      landingPageViews: payload.landingPageViews ?? 0,
      investimento: investimentoDecimal,
      cpl: cplDecimal,
      costPerPurchase: costPerPurchaseDecimal,
      websitePurchaseRoas: websitePurchaseRoasDecimal,
      websitePurchasesConversionValue: websitePurchasesConversionValueDecimal,
      rawRowHash: payload.rawRowHash ?? null,
    },
  });
}

export async function findFatosByClienteAndPeriod(
  clienteId: string,
  dataInicio: Date,
  dataFim: Date,
  canal?: string
) {
  return prisma.fatoMidiaDiario.findMany({
    where: {
      clienteId,
      data: { gte: dataInicio, lte: dataFim },
      ...(canal ? { canal } : {}),
    },
    orderBy: { data: "asc" },
  });
}
