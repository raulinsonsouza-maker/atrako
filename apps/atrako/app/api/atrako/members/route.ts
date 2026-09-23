import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";


export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  const access = await requireWorkspaceAccess(workspaceId, "manage");
  if (!access.ok) return access.response;
  const ws = await findWorkspaceById(workspaceId);
  if (!ws) return NextResponse.json({ error: "not found" }, { status: 404 });

  const members = await prisma.workspaceMember.findMany({
    where: { clienteId: workspaceId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ members });
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
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  if (!workspaceId || !email) {
    return NextResponse.json({ error: "workspaceId and email required" }, { status: 400 });
  }
  const access = await requireWorkspaceAccess(workspaceId, "manage");
  if (!access.ok) return access.response;
  const ws = await findWorkspaceById(workspaceId);
  if (!ws) return NextResponse.json({ error: "not found" }, { status: 404 });
  const role =
    b.role === "OWNER" || b.role === "ADMIN" || b.role === "ANALYST" ? b.role : "OPERATOR";

  const member = await prisma.workspaceMember.upsert({
    where: { clienteId_email: { clienteId: workspaceId, email } },
    create: {
      clienteId: workspaceId,
      email,
      name: typeof b.name === "string" ? b.name : null,
      role,
    },
    update: {
      name: typeof b.name === "string" ? b.name : undefined,
      role,
      active: true,
    },
  });
  return NextResponse.json({ member }, { status: 201 });
}
