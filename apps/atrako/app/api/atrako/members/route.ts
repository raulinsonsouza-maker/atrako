import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";

type MemberRole = "OWNER" | "ADMIN" | "OPERATOR" | "ANALYST";

function parseRole(v: unknown): MemberRole | null {
  return v === "OWNER" || v === "ADMIN" || v === "OPERATOR" || v === "ANALYST" ? v : null;
}

async function readJson(request: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Impede que o workspace fique sem nenhum OWNER ativo. */
async function wouldOrphanOwners(workspaceId: string, memberId: string) {
  const member = await prisma.workspaceMember.findFirst({
    where: { id: memberId, clienteId: workspaceId },
    select: { role: true, active: true },
  });
  if (!member || member.role !== "OWNER" || !member.active) return false;
  const owners = await prisma.workspaceMember.count({
    where: { clienteId: workspaceId, role: "OWNER", active: true },
  });
  return owners <= 1;
}

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  const access = await requireWorkspaceAccess(workspaceId, "manage");
  if (!access.ok) return access.response;
  const ws = await findWorkspaceById(workspaceId);
  if (!ws) return NextResponse.json({ error: "not found" }, { status: 404 });

  const members = await prisma.workspaceMember.findMany({
    where: { clienteId: workspaceId, active: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
  return NextResponse.json({ members });
}

export async function POST(request: NextRequest) {
  const b = await readJson(request);
  if (!b) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const workspaceId = typeof b.workspaceId === "string" ? b.workspaceId : "";
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  if (!workspaceId || !email) {
    return NextResponse.json({ error: "workspaceId and email required" }, { status: 400 });
  }
  const access = await requireWorkspaceAccess(workspaceId, "manage");
  if (!access.ok) return access.response;
  const ws = await findWorkspaceById(workspaceId);
  if (!ws) return NextResponse.json({ error: "not found" }, { status: 404 });
  const role = parseRole(b.role) ?? "OPERATOR";

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

/** Troca o papel: `{ workspaceId, memberId, role }`. */
export async function PATCH(request: NextRequest) {
  const b = await readJson(request);
  if (!b) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const workspaceId = typeof b.workspaceId === "string" ? b.workspaceId : "";
  const memberId = typeof b.memberId === "string" ? b.memberId : "";
  const role = parseRole(b.role);
  if (!workspaceId || !memberId || !role) {
    return NextResponse.json({ error: "workspaceId, memberId and role required" }, { status: 400 });
  }
  const access = await requireWorkspaceAccess(workspaceId, "manage");
  if (!access.ok) return access.response;

  if (role !== "OWNER" && (await wouldOrphanOwners(workspaceId, memberId))) {
    return NextResponse.json(
      { error: "A empresa precisa de pelo menos um proprietário." },
      { status: 409 },
    );
  }

  const { count } = await prisma.workspaceMember.updateMany({
    where: { id: memberId, clienteId: workspaceId, active: true },
    data: { role },
  });
  if (count === 0) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

/** Remove o acesso (desativa): `?workspaceId=…&memberId=…`. */
export async function DELETE(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const workspaceId = sp.get("workspaceId")?.trim() ?? "";
  const memberId = sp.get("memberId")?.trim() ?? "";
  if (!workspaceId || !memberId) {
    return NextResponse.json({ error: "workspaceId and memberId required" }, { status: 400 });
  }
  const access = await requireWorkspaceAccess(workspaceId, "manage");
  if (!access.ok) return access.response;

  if (await wouldOrphanOwners(workspaceId, memberId)) {
    return NextResponse.json(
      { error: "A empresa precisa de pelo menos um proprietário." },
      { status: 409 },
    );
  }

  const { count } = await prisma.workspaceMember.updateMany({
    where: { id: memberId, clienteId: workspaceId, active: true },
    data: { active: false },
  });
  if (count === 0) return NextResponse.json({ error: "not found" }, { status: 404 });
  await prisma.workspaceMemberSession.updateMany({
    where: { memberId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
