import { NextRequest, NextResponse } from "next/server";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import { validateCampaignDraft } from "@/lib/integrations/meta/campaign-builder/validation";
import type { MetaCampaignBuilderDraft } from "@/lib/integrations/meta/campaign-builder/draft-types";
import { saveDraft, publishDraft } from "@/lib/integrations/meta/campaign-builder/publish";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    workspaceId?: string;
    action?: "validate" | "save" | "create" | "retry";
    draft?: MetaCampaignBuilderDraft;
    draftId?: string;
    creationRequestId?: string;
  };
  const workspaceId = body.workspaceId?.trim();
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  const access = await requireWorkspaceAccess(workspaceId, "operate");
  if (!access.ok) return access.response;
  if (!(await findWorkspaceById(workspaceId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const action = body.action || "validate";

  if (action === "validate") {
    if (!body.draft) return NextResponse.json({ error: "draft required" }, { status: 400 });
    const issues = validateCampaignDraft(body.draft);
    return NextResponse.json({ ok: issues.length === 0, issues });
  }

  if (action === "save") {
    if (!body.draft) return NextResponse.json({ error: "draft required" }, { status: 400 });
    const row = await saveDraft({
      clienteId: workspaceId,
      draft: body.draft,
      draftId: body.draftId,
      creationRequestId: body.creationRequestId,
    });
    return NextResponse.json({ ok: true, draftId: row.id, creationRequestId: row.creationRequestId });
  }

  if (action === "create" || action === "retry") {
    let draftId = body.draftId;
    if (!draftId && body.draft) {
      const row = await saveDraft({
        clienteId: workspaceId,
        draft: body.draft,
        creationRequestId: body.creationRequestId,
      });
      draftId = row.id;
    }
    if (!draftId) return NextResponse.json({ error: "draftId ou draft obrigatório" }, { status: 400 });
    const result = await publishDraft({ clienteId: workspaceId, draftId });
    return NextResponse.json({ ...result, draftId }, { status: result.ok ? 200 : 422 });
  }

  return NextResponse.json({ error: "action inválida" }, { status: 400 });
}

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  const draftId = request.nextUrl.searchParams.get("draftId")?.trim();
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  const access = await requireWorkspaceAccess(workspaceId, "operate");
  if (!access.ok) return access.response;
  if (!(await findWorkspaceById(workspaceId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (draftId) {
    const row = await prisma.metaCampaignDraft.findFirst({
      where: { id: draftId, clienteId: workspaceId },
      include: {
        publishedCampaign: {
          include: {
            adSets: { include: { creatives: true, ads: true } },
          },
        },
      },
    });
    if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(row);
  }

  const drafts = await prisma.metaCampaignDraft.findMany({
    where: { clienteId: workspaceId },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      name: true,
      status: true,
      adAccountId: true,
      createdAt: true,
      updatedAt: true,
      lastError: true,
      publishedCampaignId: true,
    },
  });
  return NextResponse.json({ drafts });
}
