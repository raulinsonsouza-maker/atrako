import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import { ML_OAUTH_AUTHORIZE } from "@/lib/integrations/mercadolivre/oauth";
import { getPublicOrigin } from "@/lib/http/public-origin";

function createPkce() {
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  const state = randomBytes(16).toString("hex");
  return { codeVerifier, codeChallenge, state };
}

/** Inicia OAuth Mercado Livre centralizado no Atrako (mesmo padrão do Mercado Pago). */
export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }
  const access = await requireWorkspaceAccess(workspaceId, "manage");
  if (!access.ok) return access.response;
  const ws = await findWorkspaceById(workspaceId);
  if (!ws) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const { resolvePlatformApp } = await import("@/lib/config/platformApps");
  const app = await resolvePlatformApp("MERCADO_LIVRE");
  const clientId = app?.credentials.clientId?.trim() || process.env.ML_CLIENT_ID?.trim();
  const redirectUri =
    app?.credentials.redirectUri?.trim() ||
    process.env.ML_REDIRECT_URI?.trim() ||
    `${getPublicOrigin(request)}/api/atrako/oauth/mercadolivre/callback`;

  if (!clientId) {
    return NextResponse.json(
      {
        error: "ML_CLIENT_ID not configured",
        hint: "Configure Mercado Livre em /admin/apps",
      },
      { status: 503 },
    );
  }

  const { codeVerifier, codeChallenge, state } = createPkce();

  await prisma.workspaceOAuthPending.create({
    data: {
      state,
      provider: "MERCADO_LIVRE",
      clienteId: workspaceId,
      codeVerifier,
      redirectUri,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });

  const url = new URL(ML_OAUTH_AUTHORIZE);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");

  return NextResponse.redirect(url.toString());
}
