import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { findWorkspaceById } from "@/lib/atrako/workspace";

function createPkce() {
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  const state = randomBytes(16).toString("hex");
  return { codeVerifier, codeChallenge, state };
}

/** Inicia OAuth Google Calendar para o workspace. */
export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }
  if (!(await findWorkspaceById(workspaceId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const redirectUri =
    process.env.GOOGLE_CALENDAR_REDIRECT_URI?.trim() ||
    `${request.nextUrl.origin}/api/atrako/oauth/google-calendar/callback`;

  if (!clientId) {
    return NextResponse.json(
      {
        error: "GOOGLE_CLIENT_ID not configured",
        hint: "Defina GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no .env",
      },
      { status: 503 },
    );
  }

  const { codeVerifier, codeChallenge, state } = createPkce();

  await prisma.workspaceOAuthPending.create({
    data: {
      state,
      provider: "GOOGLE_CALENDAR",
      clienteId: workspaceId,
      codeVerifier,
      redirectUri,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "https://www.googleapis.com/auth/calendar.events");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");

  return NextResponse.redirect(url.toString());
}
