import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildLinkedinAuthUrl, signOauthState, getPublicOrigin } from "@/lib/linkedin/linkedinClient";
import { requireInternalAdmin } from "@/lib/internalAccess";
import { writeAuditLog } from "@/lib/internalUsers";

/**
 * Inicia o fluxo OAuth do LinkedIn para uma conexão específica.
 * POST /api/admin/linkedin/oauth/start  { conexaoId }
 * Auth via the signed-in local internal session.
 * Retorna { authUrl } — o cliente redireciona o navegador.
 */
export async function POST(req: NextRequest) {
  const access = await requireInternalAdmin();
  if (access.response) return access.response;

  const body = await req.json().catch(() => ({}));
  const conexaoId = typeof body?.conexaoId === "string" ? body.conexaoId : null;
  if (!conexaoId) return NextResponse.json({ error: "conexaoId é obrigatório" }, { status: 400 });

  const conexao = await prisma.conexaoIntegracao.findUnique({ where: { id: conexaoId } });
  if (!conexao || conexao.plataforma !== "LINKEDIN") {
    return NextResponse.json({ error: "Conexão LinkedIn não encontrada" }, { status: 404 });
  }

  const redirectUri = `${getPublicOrigin(req)}/api/admin/linkedin/oauth/callback`;
  const state = signOauthState(conexaoId, access.user.id);
  const authUrl = await buildLinkedinAuthUrl(redirectUri, state);
  if (!authUrl) {
    return NextResponse.json(
      { error: "App LinkedIn não configurado — use /admin/apps" },
      { status: 500 }
    );
  }
  await writeAuditLog({
    action: "LINKEDIN_OAUTH_STARTED",
    actorInternalUserId: access.user.id,
    metadata: { targetResourceId: conexaoId, operationType: "oauth_start" },
  });
  return NextResponse.json({ authUrl });
}
