import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function getAppUrl(): string {
  // REPLIT_DEV_DOMAIN is set only in dev — takes priority so dev never uses APP_URL (prod URL)
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  return "http://localhost:5000";
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const clienteId = searchParams.get("clienteId");

  if (!clienteId) {
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
  const state = Buffer.from(
    JSON.stringify({ clienteId, ts: Date.now() }),
  ).toString("base64");

  const authUrl = new URL("https://accounts.rdstation.com/oauth/authorize");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("state", state);

  return NextResponse.redirect(authUrl.toString());
}
