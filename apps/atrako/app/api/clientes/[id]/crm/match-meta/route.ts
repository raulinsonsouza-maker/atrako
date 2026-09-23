import { NextRequest, NextResponse } from "next/server";
import { matchMetaCrmLeads } from "@/lib/crm/metaCrmMatcher";
import { prisma } from "@/lib/db";
import { requireClienteAccess } from "@/lib/portalSession";
import { writeAuditLog } from "@/lib/internalUsers";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clienteId } = await params;
  const access = await requireClienteAccess(_request, clienteId, "write");
  if (access.response) return access.response;

  const config = await prisma.crmConfig.findUnique({
    where: { clienteId },
    select: { ativo: true },
  });
  if (!config?.ativo) {
    return NextResponse.json({ ok: false, error: "CRM não configurado" }, { status: 422 });
  }

  const result = await matchMetaCrmLeads(clienteId);
  if (access.internalUser) {
    await writeAuditLog({
      action: "CRM_META_MATCH_COMPLETED",
      actorInternalUserId: access.internalUser.id,
      metadata: { clientId: clienteId, operationType: "match" },
    });
  }
  return NextResponse.json({ ok: true, ...result });
}
