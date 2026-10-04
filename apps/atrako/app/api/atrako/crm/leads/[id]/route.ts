import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import { getPersonJourney, storeProviderLabel } from "@/lib/atrako/person";
import type { AbandonedCartItem } from "@/lib/crm/abandoned-cart";
import { ensureDefaultPipeline } from "@/lib/modules/crm";
import { leadCommunications } from "@/lib/flows/lead-card";

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
  const statusOrder: Record<string, number> = { OPEN: 0, PENDING: 1, RECOVERED: 2, EXPIRED: 3 };
  const carts = cartRows
    .sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9))
    .map((c) => ({
      id: c.id,
      provider: c.provider,
      providerLabel: storeProviderLabel(c.provider),
      kind: c.kind,
      status: c.status,
      totalCents: c.totalCents,
      currency: c.currency,
      items: Array.isArray(c.items) ? (c.items as AbandonedCartItem[]) : [],
      recoveryUrl: c.recoveryUrl,
      abandonedAt: c.abandonedAt.toISOString(),
      recoveredAt: c.recoveredAt?.toISOString() ?? null,
      recoveredCents: c.recoveredCents,
      notifiedAt: c.notifiedAt?.toISOString() ?? null,
    }));

  const communications = lead.contactId ? await leadCommunications(workspaceId, lead.contactId) : null;

  return NextResponse.json({
    communications,
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
