import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/lib/generated/prisma";
import { prisma } from "@/lib/db";
import { syncCrmCliente } from "@/lib/sync/crmSync";
import { consumeOAuthState } from "@/lib/oauthState";
import { requireInternalAdmin } from "@/lib/internalAccess";

function getAppUrl(): string {
  // REPLIT_DEV_DOMAIN is set only in dev — takes priority so dev never uses APP_URL (prod URL)
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  return "http://localhost:5000";
}

interface RdTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

export async function GET(request: NextRequest) {
  const access = await requireInternalAdmin();
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");
  const appUrl = getAppUrl();
  const redirectBase = `${appUrl}/admin/clientes`;
  if (access.response) {
    const signIn = new URL("/sign-in", appUrl);
    signIn.searchParams.set("redirect", "/admin/clientes");
    return NextResponse.redirect(signIn);
  }

  if (!state) {
    return NextResponse.redirect(`${redirectBase}?rdError=missing_params`);
  }

  const consumedState = await consumeOAuthState(state, "rd-station");
  if (!consumedState) {
    return NextResponse.redirect(`${redirectBase}?rdError=invalid_state`);
  }
  if (consumedState.initiatedByInternalUserId !== access.user.id) {
    return NextResponse.redirect(`${redirectBase}?rdError=wrong_user`);
  }
  const clienteId = consumedState.clienteId;

  // RD Station devolve error parameters when the user denies authorization.
  // The state has already been consumed, so this callback cannot be replayed.
  if (oauthError) {
    return NextResponse.redirect(`${redirectBase}?rdError=oauth_failed`);
  }
  if (!code) {
    return NextResponse.redirect(`${redirectBase}?rdError=missing_code`);
  }

  const config = await prisma.crmConfig.findUnique({ where: { clienteId } });
  const existingCreds = (config?.credenciais ?? {}) as Record<string, unknown>;
  const clientId = existingCreds.clientId as string | undefined;
  const clientSecret = existingCreds.clientSecret as string | undefined;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      `${redirectBase}?rdError=credentials_missing`,
    );
  }

  const redirectUri = `${appUrl}/api/auth/rd-station/callback`;

  try {
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });

    const tokenRes = await fetch("https://api.rd.services/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    const tokenData: RdTokenResponse = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      return NextResponse.redirect(`${redirectBase}?rdError=token_exchange_failed`);
    }

    const expiresAt = Date.now() + (tokenData.expires_in ?? 7200) * 1000;

    const credenciais = {
      ...existingCreds,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token ?? "",
      expiresAt,
    };

    await prisma.$transaction([
      prisma.crmConfig.upsert({
        where: { clienteId },
        create: {
          clienteId,
          tipo: "RDSTATION_CRM",
          credenciais: credenciais as Prisma.InputJsonValue,
          ativo: true,
        },
        update: {
          tipo: "RDSTATION_CRM",
          credenciais: credenciais as Prisma.InputJsonValue,
        },
      }),
      prisma.auditLog.create({
        data: {
          actorInternalUserId: access.user.id,
          action: "RD_STATION_OAUTH_COMPLETED",
          metadata: { clientId: clienteId, operationType: "oauth_callback" },
        },
      }),
    ]);

    syncCrmCliente(clienteId).catch(() => {});

    return NextResponse.redirect(
      `${redirectBase}?rdConnected=1&clienteId=${encodeURIComponent(clienteId)}`,
    );
  } catch {
    return NextResponse.redirect(`${redirectBase}?rdError=callback_failed`);
  }
}
