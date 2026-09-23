import { randomUUID } from "crypto";
import { Prisma } from "@/lib/generated/prisma";
import { prisma } from "@/lib/db";
import {
  SYNTHETIC_DEMO_MARKER,
  SYNTHETIC_DEMO_SLUG,
} from "@/lib/demo/syntheticDemo";

const DEMO_NAME = "Incorporadora de São Paulo";
const DAY_MS = 86_400_000;
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;
const MONTHLY_BUDGET: Record<Channel, number> = {
  META: 40_000,
  GOOGLE: 20_000,
};

type Channel = "META" | "GOOGLE";

type Campaign = {
  channel: Channel;
  id: string;
  name: string;
  groupId: string;
  groupName: string;
  adId: string;
  adName: string;
  dailySpend: number;
  dailyLeads: number;
  cpm: number;
  ctr: number;
};

type MediaFact = {
  data: Date;
  channel: Channel;
  campaignId: string;
  campaignName: string;
  impressions: number;
  clicks: number;
  leads: number;
  spend: number;
  reach: number;
};

type CrmLeadDraft = {
  crmLeadId: string;
  metaLeadId: string | null;
  name: string;
  email: string;
  phone: null;
  source: string;
  stage: string;
  stageOrder: number;
  status: string | null;
  enteredAt: Date;
  closedAt: Date | null;
  value: number | null;
  rating: number;
  campaign: Campaign;
  saleProbability: number;
};

const CAMPAIGNS: Campaign[] = [
  {
    channel: "META",
    id: "demo-meta-camp-vila-mariana",
    name: "Lançamento Parque Vila Mariana | Leads",
    groupId: "demo-meta-adset-vila-mariana",
    groupName: "Vila Mariana | 28-55 | Alto interesse",
    adId: "demo-meta-ad-vila-mariana",
    adName: "More perto de tudo | Tour virtual",
    dailySpend: 760,
    dailyLeads: 6,
    cpm: 34,
    ctr: 1.65,
  },
  {
    channel: "META",
    id: "demo-meta-camp-moema",
    name: "Apartamentos Moema | Agende sua visita",
    groupId: "demo-meta-adset-moema",
    groupName: "Moema e região | Famílias | Renda alta",
    adId: "demo-meta-ad-moema",
    adName: "Seu novo endereço em Moema | 2 e 3 dorms",
    dailySpend: 520,
    dailyLeads: 4,
    cpm: 38,
    ctr: 1.48,
  },
  {
    channel: "GOOGLE",
    id: "demo-google-camp-search-sp",
    name: "Pesquisa | Apartamentos em São Paulo",
    groupId: "demo-google-group-search-sp",
    groupName: "Apartamentos novos | São Paulo",
    adId: "demo-google-ad-search-sp",
    adName: "Apartamentos novos em São Paulo",
    dailySpend: 560,
    dailyLeads: 5,
    cpm: 104,
    ctr: 6.8,
  },
  {
    channel: "GOOGLE",
    id: "demo-google-camp-pmax",
    name: "Performance Max | Lançamentos SP",
    groupId: "demo-google-group-pmax",
    groupName: "Sinais de intenção | Lançamentos",
    adId: "demo-google-ad-pmax",
    adName: "Encontre seu próximo apartamento",
    dailySpend: 390,
    dailyLeads: 3,
    cpm: 72,
    ctr: 2.9,
  },
];

function brtDateOnly(now: Date): Date {
  const brt = new Date(now.getTime() - BRT_OFFSET_MS);
  return new Date(Date.UTC(brt.getUTCFullYear(), brt.getUTCMonth(), brt.getUTCDate()));
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function stableNumber(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4_294_967_295;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function isoWeek(date: Date): { year: number; week: number } {
  const current = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = current.getUTCDay() || 7;
  current.setUTCDate(current.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(current.getUTCFullYear(), 0, 1));
  return {
    year: current.getUTCFullYear(),
    week: Math.ceil(((current.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7),
  };
}

function monthlyTarget(channel: Channel, year: number, month: number, today: Date): number {
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const availableDays =
    year === today.getUTCFullYear() && month === today.getUTCMonth()
      ? today.getUTCDate()
      : daysInMonth;
  return roundMoney(MONTHLY_BUDGET[channel] * (availableDays / daysInMonth));
}

function buildDailyChannelSpend(today: Date): Map<string, number> {
  const result = new Map<string, number>();
  const year = today.getUTCFullYear();

  for (let month = 0; month <= today.getUTCMonth(); month++) {
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const availableDays = month === today.getUTCMonth() ? today.getUTCDate() : daysInMonth;

    for (const channel of ["META", "GOOGLE"] as const) {
      const weights = Array.from({ length: availableDays }, (_, index) => {
        const date = new Date(Date.UTC(year, month, index + 1));
        const weekday = [0.68, 1.08, 1.16, 0.91, 1.12, 0.97, 0.74][date.getUTCDay()];
        const volatility = 0.56 + stableNumber(`${dateKey(date)}:${channel}:pacing`) * 0.92;
        return weekday * volatility;
      });
      const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
      const targetCents = Math.round(monthlyTarget(channel, year, month, today) * 100);
      let allocatedCents = 0;

      weights.forEach((weight, index) => {
        const cents =
          index === weights.length - 1
            ? targetCents - allocatedCents
            : Math.round((targetCents * weight) / totalWeight);
        allocatedCents += cents;
        const date = new Date(Date.UTC(year, month, index + 1));
        result.set(`${dateKey(date)}:${channel}`, cents / 100);
      });
    }
  }

  return result;
}

function stageForLead(sequence: number, enteredAt: Date, today: Date, isSale: boolean) {
  const bucket = sequence % 100;
  const ageDays = Math.floor((today.getTime() - enteredAt.getTime()) / DAY_MS);

  if (isSale) {
    return { stage: "Venda realizada", stageOrder: 6, status: "won", closedAfter: 10 };
  }
  if (ageDays >= 25 && bucket >= 3 && bucket < 7) {
    return { stage: "Negócio perdido", stageOrder: 7, status: "lost", closedAfter: 8 + (sequence % 10) };
  }
  if (bucket < 13) return { stage: "Proposta enviada", stageOrder: 5, status: null, closedAfter: null };
  if (bucket < 23) return { stage: "Visita agendada", stageOrder: 4, status: null, closedAfter: null };
  if (bucket < 37) return { stage: "Lead qualificado", stageOrder: 3, status: null, closedAfter: null };
  if (bucket < 59) return { stage: "Contato realizado", stageOrder: 2, status: null, closedAfter: null };
  return { stage: "Novo lead", stageOrder: 1, status: null, closedAfter: null };
}

function buildDataset(now: Date) {
  const today = brtDateOnly(now);
  const start = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
  const mediaFacts: MediaFact[] = [];
  const crmLeads: CrmLeadDraft[] = [];
  const metaLeads: Prisma.MetaLeadIndividualCreateManyInput[] = [];
  const googleCampaigns: Omit<Prisma.GoogleAdsCampanhaCreateManyInput, "clienteId" | "contaId">[] = [];
  const googleCreatives: Omit<Prisma.GoogleAdsCriativoCreateManyInput, "clienteId" | "contaId">[] = [];
  const metaCreatives: Omit<Prisma.MetaAdsCriativoCreateManyInput, "clienteId" | "contaId">[] = [];
  const analyticsDaily: Omit<Prisma.FatoAnalyticsDiarioCreateManyInput, "clienteId" | "contaId">[] = [];
  const analyticsChannels: Omit<Prisma.FatoAnalyticsPorCanalCreateManyInput, "clienteId">[] = [];
  const salePlanByMonth = [
    [{ day: 10, channel: "META" }],
    [{ day: 5, channel: "GOOGLE" }, { day: 15, channel: "META" }],
    [{ day: 10, channel: "GOOGLE" }],
    [{ day: 5, channel: "META" }, { day: 15, channel: "GOOGLE" }],
    [{ day: 3, channel: "META" }, { day: 12, channel: "GOOGLE" }, { day: 20, channel: "META" }],
    [{ day: 5, channel: "GOOGLE" }, { day: 15, channel: "META" }],
    [{ day: 5, channel: "META" }, { day: 15, channel: "GOOGLE" }],
    [{ day: 5, channel: "META" }],
    [{ day: 5, channel: "GOOGLE" }, { day: 15, channel: "META" }],
    [{ day: 10, channel: "GOOGLE" }],
    [{ day: 5, channel: "META" }, { day: 15, channel: "GOOGLE" }],
    [{ day: 10, channel: "META" }],
  ];
  const assignedSaleDays = new Set<string>();
  const dailyChannelSpend = buildDailyChannelSpend(today);

  let leadSequence = 0;
  for (let date = start; date <= today; date = addDays(date, 1)) {
    const day = dateKey(date);
    const weekdayFactor = [0.82, 1.03, 1.08, 1.1, 1.07, 0.98, 0.88][date.getUTCDay()];
    const ramp = 0.91 + date.getUTCMonth() * 0.018;
    let paidClicks = 0;
    const campaignsSeen: Record<Channel, number> = { META: 0, GOOGLE: 0 };
    const channelSpendUsed: Record<Channel, number> = { META: 0, GOOGLE: 0 };

    for (const campaign of CAMPAIGNS) {
      const channelSpend = dailyChannelSpend.get(`${day}:${campaign.channel}`) ?? 0;
      const split =
        campaign.channel === "META"
          ? 0.56 + stableNumber(`${day}:meta:campaign-split`) * 0.15
          : 0.59 + stableNumber(`${day}:google:campaign-split`) * 0.17;
      const spend =
        campaignsSeen[campaign.channel] === 0
          ? roundMoney(channelSpend * split)
          : roundMoney(channelSpend - channelSpendUsed[campaign.channel]);
      campaignsSeen[campaign.channel]++;
      channelSpendUsed[campaign.channel] = roundMoney(channelSpendUsed[campaign.channel] + spend);
      const impressions = Math.round((spend / campaign.cpm) * 1000);
      const clicks = Math.max(1, Math.round(impressions * (campaign.ctr / 100) * (0.94 + stableNumber(`${day}:${campaign.id}:clicks`) * 0.12)));
      const baseCpl = campaign.channel === "META"
        ? campaign.id.includes("moema") ? 132 : 118
        : campaign.id.includes("pmax") ? 126 : 111;
      const leadEfficiency = 0.7 + stableNumber(`${day}:${campaign.id}:leads`) * 0.72;
      const week = isoWeek(date);
      const weeklyDemand =
        0.78 +
        stableNumber(`${week.year}:${week.week}:${campaign.id}:lead-demand`) * 0.48;
      const leads = Math.max(
        1,
        Math.round((spend / (baseCpl * leadEfficiency)) * weeklyDemand),
      );
      const reach = campaign.channel === "META" ? Math.round(impressions * 0.72) : Math.round(impressions * 0.83);
      paidClicks += clicks;

      mediaFacts.push({
        data: new Date(date),
        channel: campaign.channel,
        campaignId: campaign.id,
        campaignName: campaign.name,
        impressions,
        clicks,
        leads,
        spend,
        reach,
      });

      if (campaign.channel === "META") {
        metaCreatives.push({
          data: new Date(date),
          adId: campaign.adId,
          creativeId: `${campaign.adId}-creative`,
          adName: campaign.adName,
          effectiveStatus: "ACTIVE",
          campaignObjective: "OUTCOME_LEADS",
          mediaType: "IMAGE",
          imageUrl: campaign.id.includes("moema")
            ? "/demo/incorporadora-moema.svg"
            : "/demo/incorporadora-vila-mariana.svg",
          imageUrlFull: campaign.id.includes("moema")
            ? "/demo/incorporadora-moema.svg"
            : "/demo/incorporadora-vila-mariana.svg",
          body: campaign.id.includes("moema")
            ? "Viva Moema com mobilidade, lazer completo e plantas de 2 e 3 dormitórios."
            : "Conheça um novo jeito de morar na Vila Mariana. Agende seu tour pelo decorado.",
          title: campaign.adName,
          spend,
          impressions,
          clicks,
          ctr: roundMoney((clicks / impressions) * 100),
          cpc: roundMoney(spend / clicks),
          adsetId: campaign.groupId,
          adsetName: campaign.groupName,
          campaignId: campaign.id,
          campaignName: campaign.name,
          leads,
        });
      } else {
        const costMicros = BigInt(Math.round(spend * 1_000_000));
        googleCampaigns.push({
          campaignId: campaign.id,
          campaignName: campaign.name,
          campaignStatus: "ENABLED",
          campaignType: campaign.id.includes("pmax") ? "PERFORMANCE_MAX" : "SEARCH",
          data: new Date(date),
          impressoes: impressions,
          cliques: clicks,
          custoMicros: costMicros,
          conversoes: leads,
          alcance: reach,
        });
        googleCreatives.push({
          adResourceName: `customers/demo/ads/${campaign.adId}`,
          campaignId: campaign.id,
          campaignName: campaign.name,
          adGroupId: campaign.groupId,
          adGroupName: campaign.groupName,
          headline1: campaign.adName,
          headline2: "Agende uma visita ao decorado",
          description: "Apartamentos em localizações valorizadas de São Paulo. Fale com um consultor.",
          finalUrls: "https://demo.example.invalid/incorporadora-sao-paulo",
          data: new Date(date),
          impressoes: impressions,
          cliques: clicks,
          custoMicros: costMicros,
          conversoes: leads,
          campaignStatus: "ENABLED",
        });
      }

      for (let index = 0; index < leads; index++) {
        leadSequence++;
        const leadId = `demo-${day}-${campaign.channel.toLowerCase()}-${campaign.id.slice(-8)}-${index + 1}`;
        const saleDayKey = `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
        const salePlan = salePlanByMonth[date.getUTCMonth()].find(
          (plannedSale) => plannedSale.day === date.getUTCDate(),
        );
        const isSale =
          salePlan?.channel === campaign.channel &&
          !assignedSaleDays.has(saleDayKey);
        if (isSale) assignedSaleDays.add(saleDayKey);
        const stage = stageForLead(leadSequence, date, today, isSale);
        const isCurrentDay = date.getTime() === today.getTime();
        const enteredAt = isCurrentDay
          ? new Date(date)
          : new Date(date.getTime() + (9 + (leadSequence % 9)) * 60 * 60 * 1000);
        const closedAt = stage.closedAfter == null ? null : addDays(enteredAt, stage.closedAfter);
        const metaLeadId = campaign.channel === "META" ? `meta-${leadId}` : null;
        const saleProbability = stage.status === "won" ? 5 : stage.stageOrder >= 4 ? 4 : stage.stageOrder >= 2 ? 3 : 2;
        const demoName = `Contato Demo ${String(leadSequence).padStart(4, "0")}`;

        crmLeads.push({
          crmLeadId: `crm-${leadId}`,
          metaLeadId,
          name: demoName,
          email: `lead.${leadSequence}@demo.example.invalid`,
          phone: null,
          source: campaign.channel === "META" ? "Meta Ads" : "Google Ads",
          stage: stage.stage,
          stageOrder: stage.stageOrder,
          status: stage.status,
          enteredAt,
          closedAt,
          value: stage.status === "won" ? 2_300_000 : null,
          rating: Math.min(5, Math.max(2, saleProbability)),
          campaign,
          saleProbability,
        });

        if (campaign.channel === "META" && metaLeadId) {
          metaLeads.push({
            clienteId: "",
            metaLeadId,
            formId: "demo-form-agende-visita",
            formName: "Agende uma visita ao decorado",
            campaignId: campaign.id,
            campaignName: campaign.name,
            adId: campaign.adId,
            adName: campaign.adName,
            adsetId: campaign.groupId,
            adsetName: campaign.groupName,
            createdTime: enteredAt,
            fullName: demoName,
            telefone: null,
            estado: "SP",
            tipoEmpresa: "Pessoa física",
            faixaFaturamento: "Renda familiar entre R$ 15 mil e R$ 25 mil",
            emailLead: `lead.${leadSequence}@demo.example.invalid`,
            platform: "facebook",
            statusCrm: stage.stage,
            rawFieldData: {
              syntheticDemo: true,
              interesse: campaign.name,
              consentimento: "Dados inteiramente fictícios para demonstração",
            },
          });
        }
      }
    }

    const organicSessions = Math.round(210 * weekdayFactor * ramp * (0.9 + stableNumber(`${day}:organic`) * 0.2));
    const paidSessions = Math.round(paidClicks * 0.81);
    const directSessions = Math.round(74 * weekdayFactor * (0.9 + stableNumber(`${day}:direct`) * 0.2));
    const sessions = organicSessions + paidSessions + directSessions;
    const activeUsers = Math.round(sessions * 0.83);
    const engagedSessions = Math.round(sessions * 0.69);

    analyticsDaily.push({
      data: new Date(date),
      sessions,
      activeUsers,
      engagedSessions,
      engagementRate: 0.69,
      bounceRate: 0.31,
      averageSessionDuration: 154 + Math.round(stableNumber(`${day}:duration`) * 38),
      newUsers: Math.round(activeUsers * 0.72),
      screenPageViews: Math.round(sessions * 2.36),
    });
    analyticsChannels.push(
      { data: new Date(date), canal: "Paid Social", sessions: Math.round(paidSessions * 0.55), activeUsers: Math.round(paidSessions * 0.46) },
      { data: new Date(date), canal: "Paid Search", sessions: Math.round(paidSessions * 0.45), activeUsers: Math.round(paidSessions * 0.38) },
      { data: new Date(date), canal: "Organic Search", sessions: organicSessions, activeUsers: Math.round(organicSessions * 0.82) },
      { data: new Date(date), canal: "Direct", sessions: directSessions, activeUsers: Math.round(directSessions * 0.8) },
    );
  }

  const monthly = new Map<string, Prisma.AgregadoMidiaMensalCreateManyInput>();
  const weekly = new Map<string, Prisma.AgregadoMidiaSemanalCreateManyInput>();
  for (const fact of mediaFacts) {
    const monthKey = `${fact.channel}:${fact.data.getUTCFullYear()}-${fact.data.getUTCMonth() + 1}`;
    const month = monthly.get(monthKey) ?? {
      clienteId: "",
      canal: fact.channel,
      ano: fact.data.getUTCFullYear(),
      mes: fact.data.getUTCMonth() + 1,
      investimento: 0,
      impressoes: 0,
      cliques: 0,
      leads: 0,
      conversoes: 0,
    };
    month.investimento = roundMoney(Number(month.investimento) + fact.spend);
    month.impressoes = (month.impressoes ?? 0) + fact.impressions;
    month.cliques = (month.cliques ?? 0) + fact.clicks;
    month.leads = (month.leads ?? 0) + fact.leads;
    month.conversoes = (month.conversoes ?? 0) + fact.leads;
    monthly.set(monthKey, month);

    const iso = isoWeek(fact.data);
    const weekKey = `${fact.channel}:${iso.year}-${iso.week}`;
    const week = weekly.get(weekKey) ?? {
      clienteId: "",
      canal: fact.channel,
      ano: iso.year,
      semanaIso: iso.week,
      investimento: 0,
      impressoes: 0,
      cliques: 0,
      leads: 0,
      conversoes: 0,
    };
    week.investimento = roundMoney(Number(week.investimento) + fact.spend);
    week.impressoes = (week.impressoes ?? 0) + fact.impressions;
    week.cliques = (week.cliques ?? 0) + fact.clicks;
    week.leads = (week.leads ?? 0) + fact.leads;
    week.conversoes = (week.conversoes ?? 0) + fact.leads;
    weekly.set(weekKey, week);
  }

  return {
    start,
    today,
    mediaFacts,
    crmLeads,
    metaLeads,
    googleCampaigns,
    googleCreatives,
    metaCreatives,
    analyticsDaily,
    analyticsChannels,
    monthly: [...monthly.values()],
    weekly: [...weekly.values()],
  };
}

function validateDataset(dataset: ReturnType<typeof buildDataset>) {
  const mediaByChannel = new Map<Channel, number>([["META", 0], ["GOOGLE", 0]]);
  const crmByChannel = new Map<Channel, number>([["META", 0], ["GOOGLE", 0]]);
  const mediaByCampaign = new Map<string, number>();
  const crmByCampaign = new Map<string, number>();
  const spendByMonth = new Map<string, number>();

  for (const fact of dataset.mediaFacts) {
    mediaByChannel.set(fact.channel, (mediaByChannel.get(fact.channel) ?? 0) + fact.leads);
    mediaByCampaign.set(fact.campaignName, (mediaByCampaign.get(fact.campaignName) ?? 0) + fact.leads);
    const monthKey = `${fact.data.getUTCFullYear()}-${fact.data.getUTCMonth()}-${fact.channel}`;
    spendByMonth.set(monthKey, roundMoney((spendByMonth.get(monthKey) ?? 0) + fact.spend));
    if (fact.spend <= 0 || fact.impressions < fact.clicks || fact.clicks < fact.leads) {
      throw new Error(`Métricas inválidas em ${dateKey(fact.data)} / ${fact.campaignName}`);
    }
  }
  for (const lead of dataset.crmLeads) {
    const channel = lead.campaign.channel;
    crmByChannel.set(channel, (crmByChannel.get(channel) ?? 0) + 1);
    crmByCampaign.set(lead.campaign.name, (crmByCampaign.get(lead.campaign.name) ?? 0) + 1);
  }
  for (const channel of ["META", "GOOGLE"] as const) {
    if (mediaByChannel.get(channel) !== crmByChannel.get(channel)) {
      throw new Error(`Divergência ${channel}: mídia=${mediaByChannel.get(channel)} CRM=${crmByChannel.get(channel)}`);
    }
  }
  for (let month = 0; month <= dataset.today.getUTCMonth(); month++) {
    for (const channel of ["META", "GOOGLE"] as const) {
      const key = `${dataset.today.getUTCFullYear()}-${month}-${channel}`;
      const actual = spendByMonth.get(key) ?? 0;
      const expectedSpend = monthlyTarget(
        channel,
        dataset.today.getUTCFullYear(),
        month,
        dataset.today,
      );
      if (Math.abs(actual - expectedSpend) > 0.01) {
        throw new Error(
          `Orçamento inválido ${key}: esperado=${expectedSpend.toFixed(2)} realizado=${actual.toFixed(2)}`,
        );
      }
    }
  }
  for (const [campaign, leads] of mediaByCampaign) {
    if (crmByCampaign.get(campaign) !== leads) {
      throw new Error(`Divergência na campanha ${campaign}: mídia=${leads} CRM=${crmByCampaign.get(campaign) ?? 0}`);
    }
  }
  if (dataset.metaLeads.length !== mediaByChannel.get("META")) {
    throw new Error("Leads individuais Meta não conferem com os resultados da plataforma");
  }
  return {
    mediaByChannel: Object.fromEntries(mediaByChannel),
    totalCrmLeads: dataset.crmLeads.length,
    totalMetaLeads: dataset.metaLeads.length,
  };
}

async function createInBatches<T>(rows: T[], create: (batch: T[]) => Promise<unknown>) {
  const batchSize = 400;
  for (let index = 0; index < rows.length; index += batchSize) {
    await create(rows.slice(index, index + batchSize));
  }
}

export async function replaceIncorporadoraDemo(now = new Date()) {
  const dataset = buildDataset(now);
  const expected = validateDataset(dataset);

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.cliente.findUnique({ where: { slug: SYNTHETIC_DEMO_SLUG } });
    if (existing && existing.perfilPanel !== SYNTHETIC_DEMO_MARKER) {
      throw new Error(
        `O slug reservado ${SYNTHETIC_DEMO_SLUG} já existe sem a marca permanente de cliente-demo`,
      );
    }

    const cliente = existing
      ? await tx.cliente.update({
          where: { id: existing.id },
          data: {
            nome: DEMO_NAME,
            segmento: "Incorporadora",
            ativo: true,
            objetivoMidia: "leads",
            perfilPanel: SYNTHETIC_DEMO_MARKER,
            orcamentoMidiaMetaMensal: MONTHLY_BUDGET.META,
            orcamentoMidiaGoogleMensal: MONTHLY_BUDGET.GOOGLE,
            formaPagamentoMeta: "Cartão",
            formaPagamentoGoogle: "Faturamento",
            leadScoringEnabled: false,
            socialMediaAtivo: false,
            telegramAtivo: false,
            squad: 1,
            ultimoSyncAt: now,
          },
        })
      : await tx.cliente.create({
          data: {
            nome: DEMO_NAME,
            slug: SYNTHETIC_DEMO_SLUG,
            segmento: "Incorporadora",
            ativo: true,
            objetivoMidia: "leads",
            perfilPanel: SYNTHETIC_DEMO_MARKER,
            orcamentoMidiaMetaMensal: MONTHLY_BUDGET.META,
            orcamentoMidiaGoogleMensal: MONTHLY_BUDGET.GOOGLE,
            formaPagamentoMeta: "Cartão",
            formaPagamentoGoogle: "Faturamento",
            leadScoringEnabled: false,
            socialMediaAtivo: false,
            telegramAtivo: false,
            squad: 1,
            ultimoSyncAt: now,
            portalToken: randomUUID(),
          },
        });

    await tx.leadCrm.deleteMany({ where: { clienteId: cliente.id } });
    await tx.crmConfig.deleteMany({ where: { clienteId: cliente.id } });
    await tx.metaLeadIndividual.deleteMany({ where: { clienteId: cliente.id } });
    await tx.fatoMidiaDiario.deleteMany({ where: { clienteId: cliente.id } });
    await tx.agregadoMidiaMensal.deleteMany({ where: { clienteId: cliente.id } });
    await tx.agregadoMidiaSemanal.deleteMany({ where: { clienteId: cliente.id } });
    await tx.metaAdsCriativo.deleteMany({ where: { clienteId: cliente.id } });
    await tx.googleAdsCampanha.deleteMany({ where: { clienteId: cliente.id } });
    await tx.googleAdsCriativo.deleteMany({ where: { clienteId: cliente.id } });
    await tx.fatoAnalyticsPorCanal.deleteMany({ where: { clienteId: cliente.id } });
    await tx.fatoAnalyticsDiario.deleteMany({ where: { clienteId: cliente.id } });
    await tx.conta.deleteMany({ where: { clienteId: cliente.id } });

    const accounts = await Promise.all([
      tx.conta.create({
        data: {
          clienteId: cliente.id,
          plataforma: "META",
          accountIdPlataforma: "999900000001",
          nomeConta: `${DEMO_NAME} | DEMO`,
          saldoAtual: 18_450,
          saldoAtualizadoAt: now,
        },
      }),
      tx.conta.create({
        data: {
          clienteId: cliente.id,
          plataforma: "GOOGLE_ADS",
          accountIdPlataforma: "9999000001",
          nomeConta: `${DEMO_NAME} | DEMO`,
          saldoAtual: 14_820,
          saldoAtualizadoAt: now,
        },
      }),
      tx.conta.create({
        data: {
          clienteId: cliente.id,
          plataforma: "GOOGLE_ANALYTICS",
          accountIdPlataforma: "999900001",
          nomeConta: `${DEMO_NAME} | DEMO`,
        },
      }),
    ]);
    const metaAccount = accounts.find((account) => account.plataforma === "META")!;
    const googleAccount = accounts.find((account) => account.plataforma === "GOOGLE_ADS")!;
    const analyticsAccount = accounts.find((account) => account.plataforma === "GOOGLE_ANALYTICS")!;

    const crmConfig = await tx.crmConfig.create({
      data: {
        clienteId: cliente.id,
        tipo: "CVCRM",
        ativo: false,
        ultimoSyncAt: now,
        credenciais: {
          syntheticDemo: true,
          syncDisabled: true,
          note: "Dados fictícios para apresentações; não conectar a APIs externas",
        },
      },
    });

    await createInBatches(
      dataset.mediaFacts.map((fact) => ({
        clienteId: cliente.id,
        contaId: fact.channel === "META" ? metaAccount.id : googleAccount.id,
        data: fact.data,
        canal: fact.channel,
        campaignId: fact.campaignId,
        campaignName: fact.campaignName,
        impressoes: fact.impressions,
        alcance: fact.reach,
        cliques: fact.clicks,
        leads: fact.leads,
        conversoes: fact.leads,
        investimento: fact.spend,
        cpl: roundMoney(fact.spend / fact.leads),
        landingPageViews: Math.round(fact.clicks * 0.84),
        websiteLeads: fact.channel === "GOOGLE" ? fact.leads : 0,
        onFacebookLeads: fact.channel === "META" ? fact.leads : 0,
        rawRowHash: `synthetic-demo:${dateKey(fact.data)}:${fact.campaignId}`,
      })),
      (data) => tx.fatoMidiaDiario.createMany({ data }),
    );

    await createInBatches(
      dataset.metaCreatives.map((row) => ({ ...row, clienteId: cliente.id, contaId: metaAccount.id })),
      (data) => tx.metaAdsCriativo.createMany({ data }),
    );
    await createInBatches(
      dataset.googleCampaigns.map((row) => ({ ...row, clienteId: cliente.id, contaId: googleAccount.id })),
      (data) => tx.googleAdsCampanha.createMany({ data }),
    );
    await createInBatches(
      dataset.googleCreatives.map((row) => ({ ...row, clienteId: cliente.id, contaId: googleAccount.id })),
      (data) => tx.googleAdsCriativo.createMany({ data }),
    );
    await createInBatches(
      dataset.analyticsDaily.map((row) => ({ ...row, clienteId: cliente.id, contaId: analyticsAccount.id })),
      (data) => tx.fatoAnalyticsDiario.createMany({ data }),
    );
    await createInBatches(
      dataset.analyticsChannels.map((row) => ({ ...row, clienteId: cliente.id })),
      (data) => tx.fatoAnalyticsPorCanal.createMany({ data }),
    );
    await tx.agregadoMidiaMensal.createMany({
      data: dataset.monthly.map((row) => ({ ...row, clienteId: cliente.id })),
    });
    await tx.agregadoMidiaSemanal.createMany({
      data: dataset.weekly.map((row) => ({ ...row, clienteId: cliente.id })),
    });
    await createInBatches(
      dataset.metaLeads.map((row) => ({ ...row, clienteId: cliente.id })),
      (data) => tx.metaLeadIndividual.createMany({ data }),
    );
    await createInBatches(
      dataset.crmLeads.map((lead) => ({
        clienteId: cliente.id,
        crmConfigId: crmConfig.id,
        crmLeadId: lead.crmLeadId,
        etapa: lead.stage,
        ordemEtapa: lead.stageOrder,
        nome: lead.name,
        telefone: lead.phone,
        email: lead.email,
        metaLeadId: lead.metaLeadId,
        fonte: lead.source,
        rating: lead.rating,
        status: lead.status,
        dataEntrada: lead.enteredAt,
        dataFechamento: lead.closedAt,
        valor: lead.value,
        momentoLead: lead.stage,
        dadosCv: {
          syntheticDemo: true,
          estado: "SP",
          midiaOriginal: lead.source,
          conversaoOriginal: lead.campaign.name,
          origem: lead.source,
          possibilidadeVenda: lead.saleProbability,
          tags: ["demo", "interesse_apartamento", lead.stage.toLowerCase().replaceAll(" ", "_")],
        },
        dadosMarketing: lead.campaign.channel === "META"
          ? {
              syntheticDemo: true,
              metaCampaignId: lead.campaign.id,
              metaCampaignName: lead.campaign.name,
              metaAdsetId: lead.campaign.groupId,
              metaAdsetName: lead.campaign.groupName,
              metaAdId: lead.campaign.adId,
              metaAdName: lead.campaign.adName,
              metaFormId: "demo-form-agende-visita",
              metaFormName: "Agende uma visita ao decorado",
              utmSource: "meta",
              utmMedium: "paid_social",
              utmCampaign: lead.campaign.name,
              utmContent: lead.campaign.groupName,
            }
          : {
              syntheticDemo: true,
              utmSource: "google",
              utmMedium: "cpc",
              utmCampaign: lead.campaign.name,
              utmContent: lead.campaign.groupName,
              utmTerm: lead.campaign.id.includes("pmax") ? "performance max apartamentos" : "apartamentos novos são paulo",
            },
      })),
      (data) => tx.leadCrm.createMany({ data }),
    );

    const [facts, leads] = await Promise.all([
      tx.fatoMidiaDiario.findMany({
        where: { clienteId: cliente.id },
        select: { canal: true, campaignName: true, leads: true },
      }),
      tx.leadCrm.findMany({
        where: { clienteId: cliente.id },
        select: { fonte: true, dadosCv: true },
      }),
    ]);
    const persistedMedia = { META: 0, GOOGLE: 0 };
    for (const fact of facts) {
      if (fact.canal === "META" || fact.canal === "GOOGLE") persistedMedia[fact.canal] += fact.leads;
    }
    const persistedCrm = { META: 0, GOOGLE: 0 };
    for (const lead of leads) {
      if (lead.fonte === "Meta Ads") persistedCrm.META++;
      if (lead.fonte === "Google Ads") persistedCrm.GOOGLE++;
    }
    if (persistedMedia.META !== persistedCrm.META || persistedMedia.GOOGLE !== persistedCrm.GOOGLE) {
      throw new Error(`Validação pós-carga falhou: mídia=${JSON.stringify(persistedMedia)} CRM=${JSON.stringify(persistedCrm)}`);
    }

    return {
      clienteId: cliente.id,
      portalToken: cliente.portalToken,
      mediaByChannel: persistedMedia,
      crmByChannel: persistedCrm,
      facts: facts.length,
      crmLeads: leads.length,
    };
  }, { maxWait: 30_000, timeout: 120_000 });

  return {
    ...result,
    slug: SYNTHETIC_DEMO_SLUG,
    name: DEMO_NAME,
    startDate: dateKey(dataset.start),
    endDate: dateKey(dataset.today),
    expected,
  };
}