import { NextRequest, NextResponse } from "next/server";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import {
  getManualLostReasons,
  setManualLostReasons,
  type ManualLostReasonItem,
} from "@/lib/crm/lost-reasons";

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim() || "";
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId obrigatório" }, { status: 400 });
  }
  const access = await requireWorkspaceAccess(workspaceId, "view");
  if (!access.ok) return access.response;
  if (!(await findWorkspaceById(workspaceId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const reasons = await getManualLostReasons(workspaceId);
  return NextResponse.json({ reasons });
}

export async function PUT(request: NextRequest) {
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

  const raw = Array.isArray(b.reasons) ? b.reasons : null;
  if (!raw) {
    return NextResponse.json({ error: "reasons obrigatório" }, { status: 400 });
  }
  const reasons: ManualLostReasonItem[] = raw.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const o = row as Record<string, unknown>;
    return [
      {
        id: typeof o.id === "string" ? o.id : "",
        label: typeof o.label === "string" ? o.label : "",
      },
    ];
  });

  try {
    const saved = await setManualLostReasons(workspaceId, reasons);
    return NextResponse.json({ reasons: saved });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Falha ao salvar motivos" },
      { status: 400 },
    );
  }
}
