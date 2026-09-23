import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { RdMarketingClient } from "@/lib/rdMarketing/client";

function isAdmin(request: NextRequest): boolean {
  const token = request.headers.get("x-admin-token") ?? request.nextUrl.searchParams.get("token");
  const expected = process.env.ADMIN_SECRET;
  if (!expected) return true;
  return token === expected;
}

/**
 * GET /api/admin/clientes/[id]/rd-marketing/segmentations
 * Lista as segmentações da conta RD Marketing do cliente.
 * Usado pelo admin para descobrir o ID da segmentação "Todos os contatos".
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdmin(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const config = await prisma.rdMarketingConfig.findUnique({ where: { clienteId: id } });
  if (!config?.ativo) {
    return NextResponse.json({ error: "RD Marketing não configurado" }, { status: 404 });
  }

  const creds = config.credenciais as Record<string, unknown>;
  const accessToken = creds.accessToken as string | undefined;
  if (!accessToken) {
    return NextResponse.json({ error: "Token não encontrado — faça o OAuth" }, { status: 400 });
  }

  const client = new RdMarketingClient(accessToken);
  const segmentations = await client.listSegmentations();

  return NextResponse.json({ segmentations });
}
