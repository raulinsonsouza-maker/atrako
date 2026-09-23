import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { exchangeLinkedinCode, verifyOauthState, getPublicOrigin } from "@/lib/linkedin/linkedinClient";
import { requireInternalAdmin } from "@/lib/internalAccess";

/**
 * Callback OAuth do LinkedIn. `state` é assinado (HMAC + expiração) pelo
 * endpoint /oauth/start — só um fluxo iniciado por um admin autenticado
 * produz um state válido, o que impede CSRF/token-binding.
 */
export async function GET(req: NextRequest) {
  const access = await requireInternalAdmin();
  const sp = req.nextUrl.searchParams;
  const code = sp.get("code");
  const state = sp.get("state");
  const oauthError = sp.get("error_description") ?? sp.get("error");

  const adminUrl = new URL("/admin/conexoes", getPublicOrigin(req));
  if (access.response) {
    const signIn = new URL("/sign-in", getPublicOrigin(req));
    signIn.searchParams.set("redirect", "/admin/conexoes");
    return NextResponse.redirect(signIn);
  }

  if (oauthError || !code || !state) {
    adminUrl.searchParams.set("linkedin", "erro");
    adminUrl.searchParams.set("msg", oauthError ?? "Autorização cancelada");
    return NextResponse.redirect(adminUrl);
  }

  const verified = verifyOauthState(state);
  if (!verified) {
    adminUrl.searchParams.set("linkedin", "erro");
    adminUrl.searchParams.set("msg", "State inválido ou expirado — inicie o fluxo novamente");
    return NextResponse.redirect(adminUrl);
  }
  if (verified.initiatedByInternalUserId !== access.user.id) {
    adminUrl.searchParams.set("linkedin", "erro");
    adminUrl.searchParams.set("msg", "O fluxo deve ser concluído pelo administrador que o iniciou");
    return NextResponse.redirect(adminUrl);
  }

  const conexao = await prisma.conexaoIntegracao.findUnique({ where: { id: verified.conexaoId } });
  if (!conexao || conexao.plataforma !== "LINKEDIN") {
    adminUrl.searchParams.set("linkedin", "erro");
    adminUrl.searchParams.set("msg", "Conexão não encontrada (state inválido)");
    return NextResponse.redirect(adminUrl);
  }

  try {
    const redirectUri = `${getPublicOrigin(req)}/api/admin/linkedin/oauth/callback`;
    const tokens = await exchangeLinkedinCode(code, redirectUri);
    const now = Date.now();
    await prisma.$transaction([
      prisma.conexaoIntegracao.update({
        where: { id: conexao.id },
        data: {
          linkedinAccessToken: tokens.access_token,
          linkedinTokenExpiresAt: new Date(now + tokens.expires_in * 1000),
          linkedinRefreshToken: tokens.refresh_token ?? null,
          linkedinRefreshTokenExpiresAt: tokens.refresh_token_expires_in
            ? new Date(now + tokens.refresh_token_expires_in * 1000)
            : null,
        },
      }),
      prisma.auditLog.create({
        data: {
          actorInternalUserId: access.user.id,
          action: "LINKEDIN_OAUTH_COMPLETED",
          metadata: { targetResourceId: conexao.id, operationType: "oauth_callback" },
        },
      }),
    ]);
    adminUrl.searchParams.set("linkedin", "ok");
  } catch (e) {
    adminUrl.searchParams.set("linkedin", "erro");
    adminUrl.searchParams.set("msg", e instanceof Error ? e.message : "Falha na troca de tokens");
  }
  return NextResponse.redirect(adminUrl);
}
