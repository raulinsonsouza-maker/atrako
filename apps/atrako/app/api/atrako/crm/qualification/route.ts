import { NextRequest, NextResponse } from "next/server";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import { getLeadQuality } from "@/lib/qualification/quality";

function parseDateOnly(value: string | null): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  const parsed = new Date(y, m - 1, d);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  const access = await requireWorkspaceAccess(workspaceId, "operate");
  if (!access.ok) return access.response;
  if (!(await findWorkspaceById(workspaceId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const sp = request.nextUrl.searchParams;
  const dias = Math.min(365, Math.max(1, parseInt(sp.get("periodo") ?? "30", 10) || 30));
  let dataInicio = parseDateOnly(sp.get("dataInicio"));
  let dataFim = parseDateOnly(sp.get("dataFim"));
  if (!dataInicio || !dataFim || dataInicio > dataFim) {
    dataFim = new Date();
    dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - dias);
    dataInicio.setHours(0, 0, 0, 0);
  }
  dataFim.setHours(23, 59, 59, 999);

  return NextResponse.json(await getLeadQuality(workspaceId, { gte: dataInicio, lte: dataFim }));
}
