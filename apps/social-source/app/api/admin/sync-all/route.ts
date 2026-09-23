import { NextRequest, NextResponse } from "next/server";
import { syncClienteCanais } from "@/lib/sync/syncClienteCanais";
import { prisma } from "@/lib/db";

function isAdminAuthorized(request: NextRequest): boolean {
  const token = request.headers.get("x-admin-token") ?? request.nextUrl.searchParams.get("token");
  const expected = process.env.ADMIN_SECRET;
  if (!expected) return true;
  return token === expected;
}

/**
 * Sincroniza Meta Ads, Google Ads, GA4, Meta Leads e CRM para todos os clientes ativos.
 * Protegido por token de admin. Usado pelo botão "Atualizar todos" no painel.
 */
export async function POST(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const clientes = await prisma.cliente.findMany({
      where: { ativo: true },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    });

    const results: Array<{
      clienteId: string;
      nome: string;
      ok: boolean;
      error?: string;
    }> = [];

    for (const { id: clienteId, nome } of clientes) {
      const r = await syncClienteCanais(clienteId);
      results.push({
        clienteId,
        nome,
        ok: r.ok,
        error: r.meta?.error ?? r.googleAds?.error ?? r.analytics?.error,
      });
    }

    const okCount = results.filter((r) => r.ok).length;
    const errosCount = results.filter((r) => !r.ok).length;

    console.log(`[sync-all] total=${clientes.length} ok=${okCount} erros=${errosCount}`);

    return NextResponse.json({
      ok: true,
      results,
      summary: {
        total: clientes.length,
        ok: okCount,
        erros: errosCount,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export const maxDuration = 300;
