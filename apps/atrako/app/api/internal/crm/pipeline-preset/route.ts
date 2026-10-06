import { NextRequest, NextResponse } from "next/server";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { applyPipelinePreset, type PipelinePreset } from "@/lib/modules/crm";

/**
 * Service-to-service: troca o preset do funil (`ecommerce` tira as colunas de inside sales padrão
 * e leva os leads delas para Novo). `dryRun: true` só conta.
 *
 * Auth: Bearer ATRAKO_INTERNAL_TOKEN (fallback: ATRAKO_CONNECTIONS_TOKEN / ATRAKO_EVENTS_TOKEN).
 */
function isServiceAuthorized(request: NextRequest): boolean {
  const expected =
    process.env.ATRAKO_INTERNAL_TOKEN?.trim() ||
    process.env.ATRAKO_CONNECTIONS_TOKEN?.trim() ||
    process.env.ATRAKO_EVENTS_TOKEN?.trim();
  if (!expected) return false;
  return request.headers.get("authorization") === `Bearer ${expected}`;
}

export async function POST(request: NextRequest) {
  if (!isServiceAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const raw = body.workspaceId ?? body.clienteId;
  const workspaceId = typeof raw === "string" ? raw.trim() : "";
  const preset = body.preset === "ecommerce" || body.preset === "leads" ? (body.preset as PipelinePreset) : null;
  if (!workspaceId || !preset) {
    return NextResponse.json({ error: "workspaceId e preset (leads|ecommerce) obrigatórios" }, { status: 400 });
  }
  if (!(await findWorkspaceById(workspaceId))) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const result = await applyPipelinePreset(workspaceId, preset, { dryRun: body.dryRun === true });
  return NextResponse.json({ ok: true, ...result });
}
