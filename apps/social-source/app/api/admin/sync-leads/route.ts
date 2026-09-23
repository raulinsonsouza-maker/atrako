import { NextRequest, NextResponse } from "next/server";
import { syncMetaLeadsCliente } from "@/lib/sync/metaLeadsSync";
import { prisma } from "@/lib/db";

function isAdminAuthorized(request: NextRequest): boolean {
  const token = request.headers.get("x-admin-token") ?? request.nextUrl.searchParams.get("token");
  const expected = process.env.ADMIN_SECRET;
  if (!expected) return true;
  return token === expected;
}

export async function POST(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({})) as { clienteId?: string; dateFrom?: string };
    const { clienteId, dateFrom } = body;

    if (clienteId) {
      const result = await syncMetaLeadsCliente(clienteId, { dateFrom });
      const ok = !result.error;
      return NextResponse.json(
        { ok, results: [{ clienteId, ...result }] },
        { status: ok ? 200 : 422 }
      );
    }

    const clientes = await prisma.cliente.findMany({
      where: { ativo: true },
      select: { id: true },
    });

    const results = [];
    for (const cliente of clientes) {
      const result = await syncMetaLeadsCliente(cliente.id, { dateFrom });
      results.push({ clienteId: cliente.id, ...result });
    }

    return NextResponse.json({ ok: true, results });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
