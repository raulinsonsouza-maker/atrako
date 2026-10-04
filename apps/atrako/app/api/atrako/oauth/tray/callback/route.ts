import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildTrayAuthorizeUrl } from "@/lib/integrations/tray/oauth";
import {
  connectTrayStore,
  resolveTrayApp,
  trayHostFromParams,
} from "@/lib/integrations/tray/connect";
import { getPublicOrigin } from "@/lib/http/public-origin";

/**
 * Callback Tray. Três entradas:
 * 1. Instalação no painel (iframe): `url`, `adm_user`, `store` sem code → manda para auth.php.
 * 2. Retorno do auth.php iniciado em Conexões: `code` + loja com pending → conecta.
 * 3. Retorno do auth.php sem pending (instalação pelo painel) → tela de vincular empresa.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const code = sp.get("code");
  const store = sp.get("store");
  const apiAddressRaw = sp.get("api_address");
  const state = sp.get("state");
  const origin = getPublicOrigin(request);
  const hub = new URL("/config/conexoes/oauth-complete", origin);

  const storeHost = trayHostFromParams({
    storeHost: sp.get("store_host"),
    url: sp.get("url"),
    apiAddress: apiAddressRaw,
  });

  if (!code) {
    if (!storeHost) {
      hub.searchParams.set("error", "oauth_missing");
      return NextResponse.redirect(hub);
    }
    const app = await resolveTrayApp(origin);
    if (!app.consumerKey) {
      hub.searchParams.set("error", "tray_not_configured");
      return NextResponse.redirect(hub);
    }
    return NextResponse.redirect(
      buildTrayAuthorizeUrl({
        storeHost,
        consumerKey: app.consumerKey,
        callback: app.redirectUri,
      }),
    );
  }

  if (!apiAddressRaw) {
    hub.searchParams.set("error", "oauth_missing");
    return NextResponse.redirect(hub);
  }

  const now = new Date();
  const pending = state
    ? await prisma.workspaceOAuthPending.findUnique({ where: { state } })
    : storeHost
      ? await prisma.workspaceOAuthPending.findFirst({
          where: { provider: "TRAY", codeVerifier: storeHost, expiresAt: { gt: now } },
          orderBy: { createdAt: "desc" },
        })
      : null;

  if (!pending || pending.expiresAt < now || pending.provider !== "TRAY") {
    const claim = new URL("/config/conexoes/tray/vincular", origin);
    claim.searchParams.set("code", code);
    claim.searchParams.set("api_address", apiAddressRaw);
    if (store) claim.searchParams.set("store", store);
    return NextResponse.redirect(claim);
  }

  await prisma.workspaceOAuthPending.delete({ where: { id: pending.id } }).catch(() => null);

  const result = await connectTrayStore({
    clienteId: pending.clienteId,
    code,
    apiAddress: apiAddressRaw,
    store,
    storeHost: pending.codeVerifier || storeHost,
  });

  hub.searchParams.set("workspaceId", pending.clienteId);
  if (!result.ok) {
    hub.searchParams.set("error", result.error);
    return NextResponse.redirect(hub);
  }
  hub.searchParams.set("connected", "TRAY");
  return NextResponse.redirect(hub);
}
