import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/lib/generated/prisma";
import { prisma } from "@/lib/db";
import { syncCrmCliente } from "@/lib/sync/crmSync";

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
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");
  const oauthErrorDescription = searchParams.get("error_description");
  const appUrl = getAppUrl();
  const redirectBase = `${appUrl}/admin/clientes`;

  // RD Station devolve ?error=...&error_description=... quando o OAuth falha
  // (ex: redirect_uri divergente). Mostra a mensagem real em vez de mascarar.
  if (oauthError) {
    const errMsg = encodeURIComponent(oauthErrorDescription ?? oauthError);
    return NextResponse.redirect(`${redirectBase}?rdError=${errMsg}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${redirectBase}?rdError=missing_params`);
  }

  let clienteId: string;
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64").toString("utf-8"));
    clienteId = decoded.clienteId;
    const ts: number = decoded.ts;
    if (!clienteId || typeof ts !== "number" || Date.now() - ts > 15 * 60 * 1000) {
      throw new Error("state inválido ou expirado");
    }
  } catch {
    return NextResponse.redirect(`${redirectBase}?rdError=invalid_state`);
  }

  const config = await prisma.crmConfig.findUnique({ where: { clienteId } });
  const existingCreds = (config?.credenciais ?? {}) as Record<string, unknown>;
  const clientId = existingCreds.clientId as string | undefined;
  const clientSecret = existingCreds.clientSecret as string | undefined;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      `${redirectBase}?rdError=${encodeURIComponent("Client ID e Client Secret não configurados. Salve as credenciais antes de conectar.")}`,
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
      const errMsg = encodeURIComponent(
        tokenData.error_description ?? tokenData.error ?? `HTTP ${tokenRes.status}`,
      );
      return NextResponse.redirect(`${redirectBase}?rdError=${errMsg}`);
    }

    const expiresAt = Date.now() + (tokenData.expires_in ?? 7200) * 1000;

    const credenciais = {
      ...existingCreds,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token ?? "",
      expiresAt,
    };

    await prisma.crmConfig.upsert({
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
    });

    syncCrmCliente(clienteId).catch(() => {});

    return NextResponse.redirect(
      `${redirectBase}?rdConnected=1&clienteId=${encodeURIComponent(clienteId)}`,
    );
  } catch (e) {
    const errMsg = encodeURIComponent(e instanceof Error ? e.message : "Erro desconhecido");
    return NextResponse.redirect(`${redirectBase}?rdError=${errMsg}`);
  }
}
