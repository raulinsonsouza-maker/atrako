import { NextRequest, NextResponse } from "next/server";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import { getPersonJourney } from "@/lib/atrako/person";
import { prisma } from "@/lib/db";

/** Jornada da pessoa: ?workspaceId=&contactId= ou &leadId= */
export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  const contactId = request.nextUrl.searchParams.get("contactId")?.trim();
  const leadId = request.nextUrl.searchParams.get("leadId")?.trim();
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }
  const access = await requireWorkspaceAccess(workspaceId, "operate");
  if (!access.ok) return access.response;
  if (!(await findWorkspaceById(workspaceId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  let resolvedContactId = contactId;
  if (!resolvedContactId && leadId) {
    const lead = await prisma.nativeLead.findFirst({
      where: { id: leadId, clienteId: workspaceId },
      select: { contactId: true },
    });
    resolvedContactId = lead?.contactId ?? undefined;
  }
  if (!resolvedContactId) {
    return NextResponse.json({ error: "contactId or leadId required" }, { status: 400 });
  }

  try {
    const journey = await getPersonJourney(workspaceId, resolvedContactId);
    return NextResponse.json(journey);
  } catch {
    return NextResponse.json({ error: "contact not found" }, { status: 404 });
  }
}
