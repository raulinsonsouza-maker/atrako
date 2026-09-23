import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import { getPersonJourney } from "@/lib/atrako/person";
import { ensureDefaultPipeline } from "@/lib/modules/crm";

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

  return NextResponse.json({
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
      createdAt: lead.createdAt.toISOString(),
      updatedAt: lead.updatedAt.toISOString(),
    },
    stages: pipeline.stages.map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color,
    })),
    journey: journey?.items ?? [],
  });
}
