import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { randomUUID } from "crypto";
import { requireInternalAdmin } from "@/lib/internalAccess";
import { writeAuditLog } from "@/lib/internalUsers";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireInternalAdmin();
  if (access.response) return access.response;
  const { id } = await params;
  const newToken = randomUUID();
  try {
    const updated = await prisma.cliente.update({
      where: { id },
      data: { portalToken: newToken },
      select: { id: true, portalToken: true },
    });
    await writeAuditLog({
      action: "CLIENT_PORTAL_TOKEN_REGENERATED",
      actorInternalUserId: access.user.id,
      metadata: { clientId: id, operationType: "regenerate" },
    });
    return NextResponse.json({ portalToken: updated.portalToken });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
