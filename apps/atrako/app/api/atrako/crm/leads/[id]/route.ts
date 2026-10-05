import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import { getPersonJourney, storeProviderLabel } from "@/lib/atrako/person";
import type { AbandonedCartItem } from "@/lib/crm/abandoned-cart";
import { ensureDefaultPipeline } from "@/lib/modules/crm";
import { leadCommunications } from "@/lib/flows/lead-card";
import { CHANNEL_LABELS, type OrderChannel } from "@/lib/commerce-attribution/store-source";
import { isRevenueOrder } from "@/lib/commerce-attribution/order-status";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }
  const access = await requireWorkspaceAccess(workspaceId, "operate");
  if (!access.ok) return access.response;
  if (!(await findWorkspaceById(workspaceId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const lead = await prisma.nativeLead.findFirst({
    where: { id, clienteId: workspaceId },
    include: { contact: true, stage: true },
  });
  if (!lead) return NextResponse.json({ error: "not found" }, { status: 404 });

  const pipeline = await ensureDefaultPipeline(workspaceId);
  const journey = lead.contactId
    ? await getPersonJourney(workspaceId, lead.contactId).catch(() => null)
    : null;

  const sources = (lead.contact?.metadata as { sources?: string[] } | null)?.sources;
  const leadMeta = (lead.metadata ?? {}) as { lostReason?: string; lostAt?: string };

  const cartRows = await prisma.abandonedCart.findMany({
    where: {
      clienteId: workspaceId,
      OR: [{ leadId: lead.id }, ...(lead.contactId ? [{ contactId: lead.contactId }] : [])],
    },
    orderBy: { abandonedAt: "desc" },
    take: 5,
  });
  const communications = lead.contactId ? await leadCommunications(workspaceId, lead.contactId) : null;

  const orderRows = await prisma.marketplaceOrder.findMany({
    where: {
      clienteId: workspaceId,
      OR: [{ leadId: lead.id }, ...(lead.contactId ? [{ contactId: lead.contactId }] : [])],
    },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    take: 10,
    include: { items: true, source: true },
  });

  // Pedido não pago vira carrinho (`order:<id>`): o card mostra um só, com o status real do pedido.
  const cartOrderKey = (provider: string, externalId: string) => `${provider}:${externalId}`;
  const cartOrderKeys = new Set(
    cartRows.filter((c) => c.kind === "order").map((c) => cartOrderKey(c.provider, c.externalId.replace(/^order:/, ""))),
  );
  const statusOrder: Record<string, number> = { OPEN: 0, PENDING: 1, RECOVERED: 2, EXPIRED: 3 };
  const carts = cartRows
    .sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9))
    .map((c) => {
      const orderExternalId = c.kind === "order" ? c.externalId.replace(/^order:/, "") : null;
      const linked = orderExternalId
        ? orderRows.find((o) => o.provider === c.provider && o.externalId === orderExternalId)
        : null;
      return {
        id: c.id,
        provider: c.provider,
        providerLabel: storeProviderLabel(c.provider),
        kind: c.kind,
        status: c.status,
        orderExternalId,
        orderStatus: linked?.status ?? null,
        totalCents: c.totalCents,
        currency: c.currency,
        items: Array.isArray(c.items) ? (c.items as AbandonedCartItem[]) : [],
        recoveryUrl: c.recoveryUrl,
        abandonedAt: c.abandonedAt.toISOString(),
        recoveredAt: c.recoveredAt?.toISOString() ?? null,
        recoveredCents: c.recoveredCents,
        notifiedAt: c.notifiedAt?.toISOString() ?? null,
      };
    });

  const orders = orderRows.map((o) => ({
    id: o.id,
    fromCart: cartOrderKeys.has(cartOrderKey(o.provider, o.externalId)),
    externalId: o.externalId,
    provider: o.provider,
    providerLabel: storeProviderLabel(o.provider),
    status: o.status,
    paid: isRevenueOrder(o.status),
    totalCents: o.totalCents ?? 0,
    currency: o.currency ?? "BRL",
    occurredAt: (o.occurredAt ?? o.createdAt).toISOString(),
    items: o.items.map((i) => ({
      title: i.title,
      quantity: i.quantity,
      unitPriceCents: i.unitPriceCents,
      imageUrl: i.imageUrl,
      productUrl: i.productUrl,
    })),
    source: o.source
      ? {
          channel: o.source.channel,
          channelLabel: CHANNEL_LABELS[o.source.channel as OrderChannel] ?? o.source.channel,
          storeSource: o.source.storeSource,
          storeMedium: o.source.storeMedium,
          storeContent: o.source.storeContent,
          deviceType: o.source.deviceType,
          adMethod: o.source.adMethod,
          adConfidence: o.source.adConfidence,
          adWindow: o.source.adWindow,
          campaignName: o.source.metaCampaignName,
          adsetName: o.source.metaAdsetName,
          adName: o.source.metaAdName,
          adId: o.source.metaAdId,
        }
      : null,
  }));

  return NextResponse.json({
    communications,
    orders,
    lead: {
      id: lead.id,
      contactId: lead.contactId,
      name: lead.contact?.name ?? "Lead",
      email: lead.contact?.email ?? null,
      phone: lead.contact?.phone ?? null,
      source: lead.source,
      status: lead.status,
      dealValue: lead.dealValue != null ? Number(lead.dealValue) : null,
      stageId: lead.stageId,
      stageName: lead.stage?.name ?? null,
      stageColor: lead.stage?.color ?? null,
      sources: Array.isArray(sources) ? sources : [],
      lostReason: leadMeta.lostReason ?? null,
      lostAt: leadMeta.lostAt ?? null,
      createdAt: lead.createdAt.toISOString(),
      updatedAt: lead.updatedAt.toISOString(),
    },
    carts,
    stages: pipeline.stages.map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color,
    })),
    journey: journey?.items ?? [],
  });
}
