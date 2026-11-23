import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";

/** Orçamento mensal de mídia Meta (`Cliente.orcamentoMidiaMetaMensal`). */
export async function PATCH(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const workspaceId = typeof b.workspaceId === "string" ? b.workspaceId.trim() : "";
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId obrigatório" }, { status: 400 });
  }

  const access = await requireWorkspaceAccess(workspaceId, "operate");
  if (!access.ok) return access.response;
  if (!(await findWorkspaceById(workspaceId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const raw = b.orcamentoMidiaMetaMensal;
  let value: number | null = null;
  if (raw === null || raw === "" || raw === undefined) {
    value = null;
  } else if (typeof raw === "number" && Number.isFinite(raw)) {
    value = Math.max(0, raw);
  } else if (typeof raw === "string") {
    const n = Number(raw.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
    }
    value = n;
  } else {
    return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
  }

  const updated = await prisma.cliente.update({
    where: { id: workspaceId },
    data: { orcamentoMidiaMetaMensal: value },
    select: { id: true, orcamentoMidiaMetaMensal: true },
  });

  return NextResponse.json({
    workspaceId: updated.id,
    orcamentoMidiaMetaMensal:
      updated.orcamentoMidiaMetaMensal == null ? null : Number(updated.orcamentoMidiaMetaMensal),
  });
}
