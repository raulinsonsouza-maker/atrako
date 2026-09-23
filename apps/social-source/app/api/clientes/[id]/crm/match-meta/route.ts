import { NextRequest, NextResponse } from "next/server";
import { matchMetaCrmLeads } from "@/lib/crm/metaCrmMatcher";
import { prisma } from "@/lib/db";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clienteId } = await params;

  const config = await prisma.crmConfig.findUnique({
    where: { clienteId },
    select: { ativo: true },
  });
  if (!config?.ativo) {
    return NextResponse.json({ ok: false, error: "CRM não configurado" }, { status: 422 });
  }

  const result = await matchMetaCrmLeads(clienteId);
  return NextResponse.json({ ok: true, ...result });
}
