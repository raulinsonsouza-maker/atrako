import { NextRequest, NextResponse } from "next/server";
import { requireClienteAccess } from "@/lib/portalSession";
import { getCicloReport, refecharCiclo } from "@/lib/relatorios/vendas-meta";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; cicloId: string }> }) {
  const { id, cicloId } = await params;
  const access = await requireClienteAccess(request, id, "read");
  if (access.response) return access.response;
  const data = await getCicloReport(id, cicloId);
  if (!data) return NextResponse.json({ error: "Ciclo não encontrado" }, { status: 404 });
  return NextResponse.json(data);
}

/** `{ action: "refechar" }` — recalcula o snapshot de um ciclo fechado. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; cicloId: string }> }) {
  const { id, cicloId } = await params;
  const access = await requireClienteAccess(request, id, "write");
  if (access.response) return access.response;
  if (!access.internalUser) {
    return NextResponse.json({ error: "Somente a equipe Atrako refaz o fechamento" }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as { action?: string };
  if (body.action !== "refechar") return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  const r = await refecharCiclo(id, cicloId);
  if (!r) return NextResponse.json({ error: "Ciclo não encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true, refeito: r.refeito });
}
