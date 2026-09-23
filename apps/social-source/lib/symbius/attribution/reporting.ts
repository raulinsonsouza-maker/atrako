import { Prisma } from "@/lib/generated/prisma";
import { prisma } from "@/lib/db";
import type { AttributionModel } from "@/lib/symbius/attribution/types";

export async function getAttributionSummary(params: {
  organizationId: string;
  from: Date;
  to: Date;
  model?: AttributionModel;
}) {
  const orders = await prisma.attributionOrder.findMany({
    where: {
      organizationId: params.organizationId,
      status: { in: ["paid", "completed"] },
      occurredAt: { gte: params.from, lte: params.to },
    },
    include: {
      attribution: true,
      identity: { select: { id: true, stId: true } },
    },
  });

  const model = params.model ?? "first_touch";
  let revenue = 0;
  const customers = new Set<string>();
  const byCampaign = new Map<
    string,
    { campaign: string; source: string; medium: string; orders: number; revenue: number }
  >();

  for (const order of orders) {
    const attr = order.attribution;
    if (!attr) continue;

    let value = Number(attr.attributedValue);
    let campaign = attr.attributedCampaign ?? "(sem campanha)";
    let source = attr.attributedSource ?? "(direct)";
    let medium = attr.attributedMedium ?? "(none)";

    if (model === "last_touch") {
      const last = attr.lastTouch as {
        campaign?: string;
        source?: string;
        medium?: string;
      } | null;
      campaign = last?.campaign ?? campaign;
      source = last?.source ?? source;
      medium = last?.medium ?? medium;
      value = Number(order.value);
    } else if (
      (model === "linear" ||
        model === "position_based" ||
        model === "time_decay") &&
      attr.linearShares
    ) {
      const shares = attr.linearShares as Array<{
        touch: { campaign?: string; source?: string; medium?: string };
        value: number;
      }>;
      for (const share of shares) {
        const c = share.touch?.campaign ?? "(sem campanha)";
        const s = share.touch?.source ?? "(direct)";
        const m = share.touch?.medium ?? "(none)";
        const key = `${s}|${m}|${c}`;
        const row = byCampaign.get(key) ?? {
          campaign: c,
          source: s,
          medium: m,
          orders: 0,
          revenue: 0,
        };
        row.orders += 1;
        row.revenue += share.value;
        byCampaign.set(key, row);
      }
      revenue += Number(order.value);
      if (order.identityId) customers.add(order.identityId);
      continue;
    }

    revenue += value;
    if (order.identityId) customers.add(order.identityId);
    const key = `${source}|${medium}|${campaign}`;
    const row = byCampaign.get(key) ?? {
      campaign,
      source,
      medium,
      orders: 0,
      revenue: 0,
    };
    row.orders += 1;
    row.revenue += value;
    byCampaign.set(key, row);
  }

  const leads = await prisma.trackingIdentity.count({
    where: {
      organizationId: params.organizationId,
      mergedIntoId: null,
      createdAt: { gte: params.from, lte: params.to },
    },
  });

  const spendAgg = await prisma.adSpendDaily.aggregate({
    where: {
      organizationId: params.organizationId,
      date: { gte: params.from, lte: params.to },
    },
    _sum: { spend: true },
  });
  const spend = Number(spendAgg._sum.spend ?? 0);
  const roas = spend > 0 ? revenue / spend : null;

  return {
    from: params.from.toISOString(),
    to: params.to.toISOString(),
    model,
    revenue,
    leads,
    customers: customers.size,
    orders: orders.length,
    averageTicket: orders.length ? revenue / orders.length : 0,
    spend,
    roas,
    byCampaign: Array.from(byCampaign.values()).sort(
      (a, b) => b.revenue - a.revenue,
    ),
  };
}

export async function upsertAdSpend(params: {
  organizationId: string;
  date: string;
  platform: string;
  campaignId?: string;
  campaignName?: string;
  adsetId?: string;
  adsetName?: string;
  adId?: string;
  adName?: string;
  spend: number;
  currency?: string;
}) {
  const date = new Date(params.date);
  return prisma.adSpendDaily.upsert({
    where: {
      organizationId_date_platform_campaignId_adsetId_adId: {
        organizationId: params.organizationId,
        date,
        platform: params.platform,
        campaignId: params.campaignId ?? "",
        adsetId: params.adsetId ?? "",
        adId: params.adId ?? "",
      },
    },
    create: {
      organizationId: params.organizationId,
      date,
      platform: params.platform,
      campaignId: params.campaignId ?? "",
      campaignName: params.campaignName,
      adsetId: params.adsetId ?? "",
      adsetName: params.adsetName,
      adId: params.adId ?? "",
      adName: params.adName,
      spend: new Prisma.Decimal(params.spend),
      currency: params.currency ?? "BRL",
    },
    update: {
      spend: new Prisma.Decimal(params.spend),
      campaignName: params.campaignName,
      adsetName: params.adsetName,
      adName: params.adName,
      currency: params.currency ?? "BRL",
    },
  });
}
