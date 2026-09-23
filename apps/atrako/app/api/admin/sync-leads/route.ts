import { NextRequest, NextResponse } from "next/server";
import { syncMetaLeadsCliente } from "@/lib/sync/metaLeadsSync";
import { prisma } from "@/lib/db";
import { requireInternalAdmin } from "@/lib/internalAccess";
import { writeAuditLog } from "@/lib/internalUsers";

export async function POST(request: NextRequest) {
  const access = await requireInternalAdmin();
  if (access.response) return access.response;

  try {
    const body = await request.json().catch(() => ({})) as { clienteId?: string; dateFrom?: string };
    const { clienteId, dateFrom } = body;

    if (clienteId) {
      const result = await syncMetaLeadsCliente(clienteId, { dateFrom });
      const ok = !result.error;
      if (ok) {
        await writeAuditLog({
          action: "CLIENT_LEADS_SYNC_COMPLETED",
          actorInternalUserId: access.user.id,
          metadata: { clientId: clienteId, operationType: "admin_manual_sync" },
        });
      }
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

    await writeAuditLog({
      action: "CLIENT_LEADS_BULK_SYNC_COMPLETED",
      actorInternalUserId: access.user.id,
      metadata: { operationType: "admin_bulk_manual_sync" },
    });
    return NextResponse.json({ ok: true, results });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
