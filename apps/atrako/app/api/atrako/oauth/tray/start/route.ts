import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import {
  buildTrayAuthorizeUrl,
  normalizeTrayStoreHost,
} from "@/lib/integrations/tray/oauth";
import { getPublicOrigin } from "@/lib/http/public-origin";

/**
 * Inicia OAuth Tray.
 * Query: workspaceId + store (domínio da loja, ex.: minhaloja.com.br)
 */
export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  const storeRaw = request.nextUrl.searchParams.get("store")?.trim() || "";
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }
  const storeHost = normalizeTrayStoreHost(storeRaw);
  if (!storeHost) {
    return NextResponse.json(
      { error: "Informe o domínio da loja Tray (ex.: minhaloja.com.br)" },
      { status: 400 },
    );
  }

  const access = await requireWorkspaceAccess(workspaceId, "manage");
  if (!access.ok) return access.response;
  const ws = await findWorkspaceById(workspaceId);
  if (!ws) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const { resolvePlatformApp } = await import("@/lib/config/platformApps");
  const app = await resolvePlatformApp("TRAY");
  const consumerKey =
    app?.credentials.clientId?.trim() || process.env.TRAY_CONSUMER_KEY?.trim();
  if (!app?.enabled || !consumerKey) {
    return NextResponse.json(
      {
        error: "Tray app não configurado",
        hint: "Configure Consumer Key/Secret em /admin/apps (TRAY)",
      },
      { status: 503 },
    );
  }

  const redirectUri =
    app.credentials.redirectUri?.trim() ||
    process.env.TRAY_REDIRECT_URI?.trim() ||
    `${getPublicOrigin(request)}/api/atrako/oauth/tray/callback`;

  const nonce = randomBytes(16).toString("hex");
  const state = `${nonce}.${storeHost}`;

  await prisma.workspaceOAuthPending.create({
    data: {
      state,
      provider: "TRAY",
      clienteId: workspaceId,
      codeVerifier: storeHost,
      redirectUri,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });

  // Tray callback só devolve code/store/api_address — state via redirectUri query
  const callbackWithState = new URL(redirectUri);
  callbackWithState.searchParams.set("state", state);

  const url = buildTrayAuthorizeUrl({
    storeHost,
    consumerKey,
    callback: callbackWithState.toString(),
  });

  return NextResponse.redirect(url);
}
