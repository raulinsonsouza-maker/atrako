import { NextRequest, NextResponse } from "next/server";
import { importMetaClientes } from "@/lib/sync/importMetaClientes";

function isAdminAuthorized(request: NextRequest): boolean {
  const token = request.headers.get("x-admin-token") ?? request.nextUrl.searchParams.get("token");
  const expected = process.env.ADMIN_SECRET;
  if (!expected) return true;
  return token === expected;
}

/**
 * Importa clientes e contas Meta a partir da API. Cria Cliente + Conta para cada
 * conta de anúncios que ainda não existe no BD. Usado pelo botão "Importar clientes Meta".
 */
export async function POST(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const results = await importMetaClientes();
    const created = results.filter((r) => r.action === "created");
    const linked = results.filter((r) => r.action === "linked");
    const skipped = results.filter((r) => r.action === "skipped");
    return NextResponse.json({
      ok: true,
      results,
      summary: {
        created: created.length,
        linked: linked.length,
        skipped: skipped.length,
        total: results.length,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
