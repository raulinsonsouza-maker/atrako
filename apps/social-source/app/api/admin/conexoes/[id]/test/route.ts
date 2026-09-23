import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function isAdmin(req: NextRequest) {
  const token = req.headers.get("x-admin-token") ?? req.nextUrl.searchParams.get("token");
  const expected = process.env.ADMIN_SECRET;
  if (!expected) return true;
  return token === expected;
}

async function testMeta(accessToken: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const url = `https://graph.facebook.com/v19.0/me?fields=id,name&access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    const data = await res.json();
    if (data.error) {
      return { ok: false, detail: data.error.message ?? "Erro desconhecido da API Meta" };
    }
    const name = data.name ?? data.id ?? "Usuário";
    return { ok: true, detail: `Autenticado como: ${name}` };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "Timeout ou falha de rede" };
  }
}

async function getGoogleAccessToken(params: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<{ accessToken?: string; error?: string }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: params.clientId,
      client_secret: params.clientSecret,
      refresh_token: params.refreshToken,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    return { error: data.error_description ?? data.error ?? "Falha ao obter access token" };
  }
  return { accessToken: data.access_token };
}

async function testGoogleAds(params: {
  clientId: string;
  clientSecret: string;
  developerToken: string;
  refreshToken: string;
  loginCustomerId?: string | null;
}): Promise<{ ok: boolean; detail: string }> {
  try {
    const { accessToken, error } = await getGoogleAccessToken(params);
    if (error || !accessToken) {
      return { ok: false, detail: `OAuth falhou: ${error ?? "sem access_token"}` };
    }

    const loginCustomerId = params.loginCustomerId?.replace(/\D/g, "") || undefined;
    const headers: HeadersInit = {
      Authorization: `Bearer ${accessToken}`,
      "developer-token": params.developerToken,
      "Content-Type": "application/json",
    };
    if (loginCustomerId) headers["login-customer-id"] = loginCustomerId;

    const body = JSON.stringify({
      query: "SELECT customer.id, customer.descriptive_name FROM customer LIMIT 5",
    });

    const customerId = loginCustomerId ?? "0";
    const url = `https://googleads.googleapis.com/v17/customers/${customerId}/googleAds:search`;
    const res = await fetch(url, { method: "POST", headers, body, signal: AbortSignal.timeout(12_000) });
    const data = await res.json();

    if (data.error) {
      const msg: string = data.error.message ?? JSON.stringify(data.error);
      if (msg.includes("The customer account can't be accessed") || msg.includes("NOT_FOUND")) {
        return { ok: true, detail: "Credenciais OAuth válidas (sem acesso à conta MCC informada)" };
      }
      return { ok: false, detail: msg };
    }
    const count = data.results?.length ?? 0;
    return { ok: true, detail: `Autenticado — ${count} cliente(s) visíve${count !== 1 ? "is" : "l"}` };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "Timeout ou falha de rede" };
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const c = await prisma.conexaoIntegracao.findUnique({ where: { id } });
  if (!c) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  if (c.plataforma === "META") {
    if (!c.metaAccessToken) {
      return NextResponse.json({ ok: false, detail: "Token de acesso Meta não configurado." });
    }
    const result = await testMeta(c.metaAccessToken);
    return NextResponse.json(result);
  }

  if (c.plataforma === "GOOGLE_ADS") {
    if (!c.googleClientId || !c.googleClientSecret || !c.googleRefreshToken || !c.googleDeveloperToken) {
      const missing = [
        !c.googleClientId && "Client ID",
        !c.googleClientSecret && "Client Secret",
        !c.googleDeveloperToken && "Developer Token",
        !c.googleRefreshToken && "Refresh Token",
      ]
        .filter(Boolean)
        .join(", ");
      return NextResponse.json({ ok: false, detail: `Credenciais incompletas: ${missing}` });
    }
    const result = await testGoogleAds({
      clientId: c.googleClientId,
      clientSecret: c.googleClientSecret,
      developerToken: c.googleDeveloperToken,
      refreshToken: c.googleRefreshToken,
      loginCustomerId: c.googleLoginCustomerId,
    });
    return NextResponse.json(result);
  }

  return NextResponse.json({ ok: false, detail: "Plataforma não suportada" });
}
