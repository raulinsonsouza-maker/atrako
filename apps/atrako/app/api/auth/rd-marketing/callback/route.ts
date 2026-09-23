import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/lib/generated/prisma";
import { prisma } from "@/lib/db";
import { consumeOAuthState } from "@/lib/oauthState";
import { requireInternalAdmin } from "@/lib/internalAccess";

interface RdTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

function getAppUrl(): string {
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  return "http://localhost:5000";
}

export async function GET(request: NextRequest) {
  const access = await requireInternalAdmin();
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const appUrl = getAppUrl();
  const redirectBase = `${appUrl}/admin/clientes`;
  if (access.response) {
    const signIn = new URL("/sign-in", appUrl);
    signIn.searchParams.set("redirect", "/admin/clientes");
    return NextResponse.redirect(signIn);
  }

  if (!state) {
    return NextResponse.redirect(`${redirectBase}?rdMktError=missing_params`);
  }

  const consumedState = await consumeOAuthState(state, "rd-marketing");
  if (!consumedState) {
    return NextResponse.redirect(`${redirectBase}?rdMktError=invalid_state`);
  }
  if (consumedState.initiatedByInternalUserId !== access.user.id) {
    return NextResponse.redirect(`${redirectBase}?rdMktError=wrong_user`);
  }
  const clienteId = consumedState.clienteId;

  if (searchParams.get("error")) {
    return NextResponse.redirect(`${redirectBase}?rdMktError=oauth_failed`);
  }
  if (!code) {
    return NextResponse.redirect(`${redirectBase}?rdMktError=missing_code`);
  }

  const config = await prisma.rdMarketingConfig.findUnique({ where: { clienteId } });
  const existingCreds = (config?.credenciais ?? {}) as Record<string, unknown>;
  const clientId = existingCreds.clientId as string | undefined;
  const clientSecret = existingCreds.clientSecret as string | undefined;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      `${redirectBase}?rdMktError=credentials_missing`,
    );
  }

  const redirectUri = `${appUrl}/api/auth/rd-marketing/callback`;

  try {
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });

    const tokenRes = await fetch("https://api.rd.services/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    const tokenData: RdTokenResponse = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      return NextResponse.redirect(`${redirectBase}?rdMktError=token_exchange_failed`);
    }

    const expiresAt = Date.now() + (tokenData.expires_in ?? 86400) * 1000;

    const credenciais = {
      ...existingCreds,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token ?? "",
      expiresAt,
    };

    await prisma.$transaction([
      prisma.rdMarketingConfig.upsert({
        where: { clienteId },
        create: {
          clienteId,
          credenciais: credenciais as Prisma.InputJsonValue,
          ativo: true,
        },
        update: {
          credenciais: credenciais as Prisma.InputJsonValue,
        },
      }),
      prisma.auditLog.create({
        data: {
          actorInternalUserId: access.user.id,
          action: "RD_MARKETING_OAUTH_COMPLETED",
          metadata: { clientId: clienteId, operationType: "oauth_callback" },
        },
      }),
    ]);

    return NextResponse.redirect(
      `${redirectBase}?rdMktConnected=1&clienteId=${encodeURIComponent(clienteId)}`,
    );
  } catch {
    return NextResponse.redirect(`${redirectBase}?rdMktError=callback_failed`);
  }
}
