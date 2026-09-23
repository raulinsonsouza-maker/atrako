import { NextRequest, NextResponse } from "next/server";
import {
  createNativeLead,
  listNativeLeads,
  ensureDefaultPipeline,
  getPipelineBoard,
  updateLeadStage,
} from "@/lib/modules/crm";
import { findWorkspaceById } from "@/lib/atrako/workspace";

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  if (!(await findWorkspaceById(workspaceId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const view = request.nextUrl.searchParams.get("view")?.trim();
  if (view === "pipeline") {
    const board = await getPipelineBoard(workspaceId, {
      q: request.nextUrl.searchParams.get("q") ?? undefined,
      source: request.nextUrl.searchParams.get("source") ?? undefined,
    });
    return NextResponse.json(board);
  }

  await ensureDefaultPipeline(workspaceId);
  const leads = await listNativeLeads(workspaceId);
  return NextResponse.json({
    leads: leads.map((l) => ({
      id: l.id,
      contactId: l.contactId,
      status: l.status,
      source: l.source,
      stage: l.stage?.name ?? null,
      stageId: l.stageId,
      dealValue: l.dealValue != null ? Number(l.dealValue) : null,
      name: l.contact?.name ?? null,
      email: l.contact?.email ?? null,
      phone: l.contact?.phone ?? null,
      createdAt: l.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const workspaceId = typeof b.workspaceId === "string" ? b.workspaceId : "";
  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!workspaceId || !name) {
    return NextResponse.json({ error: "workspaceId and name required" }, { status: 400 });
  }
  if (!(await findWorkspaceById(workspaceId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const lead = await createNativeLead({
    clienteId: workspaceId,
    name,
    email: typeof b.email === "string" ? b.email : undefined,
    phone: typeof b.phone === "string" ? b.phone : undefined,
    source: typeof b.source === "string" ? b.source : undefined,
  });
  return NextResponse.json(
    {
      id: lead.id,
      contactId: lead.contactId,
      contact: lead.contact
        ? {
            id: lead.contact.id,
            name: lead.contact.name,
            email: lead.contact.email,
            phone: lead.contact.phone,
          }
        : null,
      source: lead.source,
      stage: lead.stage?.name ?? null,
    },
    { status: 201 },
  );
}

export async function PATCH(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const workspaceId = typeof b.workspaceId === "string" ? b.workspaceId : "";
  const leadId = typeof b.leadId === "string" ? b.leadId : "";
  const stageId = typeof b.stageId === "string" ? b.stageId : "";
  if (!workspaceId || !leadId || !stageId) {
    return NextResponse.json({ error: "workspaceId, leadId e stageId required" }, { status: 400 });
  }
  try {
    const lead = await updateLeadStage({ workspaceId, leadId, stageId });
    return NextResponse.json({
      ok: true,
      id: lead.id,
      stageId: lead.stageId,
      stage: lead.stage?.name ?? null,
      status: lead.status,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Falha ao mover" },
      { status: 400 },
    );
  }
}
