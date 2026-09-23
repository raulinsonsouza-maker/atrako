import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { issueOAuthState } from "@/lib/oauthState";
import { InternalAuthError, requireInternalUser } from "@/lib/internalUsers";
import { writeAuditLog } from "@/lib/internalUsers";
import { isSameOriginNavigation } from "@/lib/requestSecurity";

function getAppUrl(): string {
  // REPLIT_DEV_DOMAIN is set only in dev — takes priority so dev never uses APP_URL (prod URL)
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  return "http://localhost:5000";
}

export async function GET(request: NextRequest) {
  // OAuth initiation changes server-side authorization state. Require an
  // authenticated administrator and a browser request from this origin
  // before even accepting the client identifier.
  if (!isSameOriginNavigation(request)) {
    return NextResponse.json({ error: "Origem da requisição não permitida" }, { status: 403 });
  }
  let internalUser;
  try {
    internalUser = await requireInternalUser("ADMIN");
  } catch (error) {
    if (error instanceof InternalAuthError) {
      return NextResponse.json({ error: "Acesso de administrador necessário" }, { status: error.status });
    }
    throw error;
  }

  const { searchParams } = request.nextUrl;
  const clienteId = searchParams.get("clienteId");

  if (!clienteId || !/^[A-Za-z0-9_-]{1,128}$/.test(clienteId)) {
    return NextResponse.json({ error: "clienteId é obrigatório" }, { status: 400 });
  }

  const config = await prisma.crmConfig.findUnique({ where: { clienteId } });
  const creds = (config?.credenciais ?? {}) as Record<string, unknown>;
  const clientId = creds.clientId as string | undefined;

  if (!clientId) {
    const appUrl = getAppUrl();
    return NextResponse.redirect(
      `${appUrl}/admin/clientes?rdError=${encodeURIComponent("Salve o Client ID antes de conectar.")}`,
    );
  }

  const redirectUri = `${getAppUrl()}/api/auth/rd-station/callback`;
  const state = await issueOAuthState({
    provider: "rd-station",
    clienteId,
    initiatedByInternalUserId: internalUser.id,
  });
  await writeAuditLog({
    action: "RD_STATION_OAUTH_STARTED",
    actorInternalUserId: internalUser.id,
    metadata: { clientId: clienteId, operationType: "oauth_start" },
  });

  const authUrl = new URL("https://accounts.rdstation.com/oauth/authorize");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("state", state);

  return NextResponse.redirect(authUrl.toString());
}
