import { NextRequest, NextResponse } from "next/server";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import { connectInstagramByPageToken } from "@/lib/instagram/provisionFromMeta";

/**
 * Conecta Instagram sem OAuth popup: Page Access Token + Page ID + IG User ID.
 * POST { workspaceId, pageAccessToken, pageId, igUserId? }
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId.trim() : "";
  const pageAccessToken =
    typeof body.pageAccessToken === "string"
      ? body.pageAccessToken.trim()
      : typeof body.accessToken === "string"
        ? body.accessToken.trim()
        : "";
  const pageId = typeof body.pageId === "string" ? body.pageId.trim() : "";
  const igUserId =
    typeof body.igUserId === "string" && body.igUserId.trim()
      ? body.igUserId.trim()
      : "";

  if (!workspaceId || !pageAccessToken || !pageId) {
    return NextResponse.json(
      { error: "workspaceId, pageAccessToken e pageId são obrigatórios" },
      { status: 400 },
    );
  }

  const ws = await findWorkspaceById(workspaceId);
  if (!ws) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const access = await requireWorkspaceAccess(workspaceId, "manage");
  if (!access.ok) return access.response;

  let resolvedIg = igUserId;
  if (!resolvedIg) {
    const { prisma } = await import("@/lib/db");
    const conta = await prisma.conta.findFirst({
      where: { clienteId: workspaceId, plataforma: "INSTAGRAM" },
      select: { accountIdPlataforma: true },
    });
    resolvedIg = conta?.accountIdPlataforma?.trim() || "";
  }
  if (!resolvedIg) {
    return NextResponse.json(
      { error: "igUserId obrigatório (ou cadastre a Conta INSTAGRAM antes)" },
      { status: 400 },
    );
  }

  try {
    const result = await connectInstagramByPageToken({
      workspaceId,
      pageAccessToken,
      pageId,
      igUserId: resolvedIg,
      workspaceName: ws.nome,
    });
    return NextResponse.json({ ok: true, ...result, igUserId: resolvedIg });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao conectar Instagram" },
      { status: 400 },
    );
  }
}
