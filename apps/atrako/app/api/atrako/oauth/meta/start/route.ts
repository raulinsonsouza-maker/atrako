import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import {
  buildMetaAuthorizationUrl,
  getMetaLoginConfigId,
  META_LOGIN_CONFIG_MISSING,
  resolveMetaOAuthRedirectUri,
} from "@/lib/integrations/meta/oauth";
import { getMetaAppId } from "@/lib/integrations/meta/graph";

function conexoesErrorRedirect(origin: string, workspaceId: string | null, message: string) {
  const u = new URL("/config/conexoes", origin);
  if (workspaceId) u.searchParams.set("workspaceId", workspaceId);
  u.searchParams.set("meta", "error");
  u.searchParams.set("metaError", message);
  return NextResponse.redirect(u);
}

/** Inicia Facebook Login for Business (config_id) para META_ADS. */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  if (!workspaceId) {
    return conexoesErrorRedirect(origin, null, "Selecione uma empresa antes de conectar a Meta.");
  }
  const access = await requireWorkspaceAccess(workspaceId, "manage");
  if (!access.ok) return access.response;
  const ws = await findWorkspaceById(workspaceId);
  if (!ws) {
    return conexoesErrorRedirect(origin, workspaceId, "Empresa não encontrada.");
  }

  if (!getMetaAppId()) {
    return conexoesErrorRedirect(
      origin,
      workspaceId,
      "META_APP_ID não configurado no servidor. Defina META_APP_ID (e META_APP_SECRET + META_LOGIN_CONFIG_ID) no .env e reinicie o app.",
    );
  }
  if (!getMetaLoginConfigId()) {
    return conexoesErrorRedirect(origin, workspaceId, META_LOGIN_CONFIG_MISSING);
  }

  const redirectUri = resolveMetaOAuthRedirectUri(request.nextUrl.origin);
  const state = randomBytes(24).toString("hex");

  await prisma.workspaceOAuthPending.create({
    data: {
      state,
      provider: "META_ADS",
      clienteId: workspaceId,
      redirectUri,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  console.info(
    JSON.stringify({
      event: "meta_oauth_started",
      workspaceId,
      provider: "META_ADS",
    }),
  );

  try {
    const url = buildMetaAuthorizationUrl({ state, redirectUri, systemUserFlow: true });
    return NextResponse.redirect(url);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return conexoesErrorRedirect(origin, workspaceId, message);
  }
}
