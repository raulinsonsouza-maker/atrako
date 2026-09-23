import { NextRequest, NextResponse } from "next/server";
import { importMetaClientes } from "@/lib/sync/importMetaClientes";
import { requireInternalAdmin } from "@/lib/internalAccess";
import { writeAuditLog } from "@/lib/internalUsers";

/**
 * Importa clientes e contas Meta a partir da API. Cria Cliente + Conta para cada
 * conta de anúncios que ainda não existe no BD. Usado pelo botão "Importar clientes Meta".
 */
export async function POST(request: NextRequest) {
  const access = await requireInternalAdmin();
  if (access.response) return access.response;
  try {
    const results = await importMetaClientes();
    const created = results.filter((r) => r.action === "created");
    const linked = results.filter((r) => r.action === "linked");
    const skipped = results.filter((r) => r.action === "skipped");
    await writeAuditLog({
      action: "META_CLIENTS_IMPORTED",
      actorInternalUserId: access.user.id,
      metadata: { operationType: "import" },
    });
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
