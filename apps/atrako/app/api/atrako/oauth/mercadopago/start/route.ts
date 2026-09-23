import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { findWorkspaceById } from "@/lib/atrako/workspace";

function createPkce() {
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  const state = randomBytes(16).toString("hex");
  return { codeVerifier, codeChallenge, state };
}

/** Inicia OAuth Mercado Pago centralizado no Atrako. */
export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }
  const ws = await findWorkspaceById(workspaceId);
  if (!ws) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const clientId = process.env.MP_CLIENT_ID?.trim();
  const redirectUri =
    process.env.MP_REDIRECT_URI?.trim() ||
    `${request.nextUrl.origin}/api/atrako/oauth/mercadopago/callback`;

  if (!clientId) {
    return NextResponse.json(
      {
        error: "MP_CLIENT_ID not configured",
        hint: "Defina MP_CLIENT_ID e MP_CLIENT_SECRET no .env do Atrako",
      },
      { status: 503 },
    );
  }

  const { codeVerifier, codeChallenge, state } = createPkce();

  await prisma.workspaceOAuthPending.create({
    data: {
      state,
      provider: "MERCADO_PAGO",
      clienteId: workspaceId,
      codeVerifier,
      redirectUri,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });

  const url = new URL("https://auth.mercadopago.com/authorization");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("platform_id", "mp");
  url.searchParams.set("state", state);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");

  return NextResponse.redirect(url.toString());
}
