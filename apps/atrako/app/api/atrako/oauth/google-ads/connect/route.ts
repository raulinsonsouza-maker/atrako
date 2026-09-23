import { NextRequest, NextResponse } from "next/server";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import { upsertWorkspaceConnection } from "@/lib/atrako/workspace-connections";
import { resolvePlatformApp } from "@/lib/config/platformApps";
import { prisma } from "@/lib/db";
import { PLATAFORMA_GOOGLE_ADS, upsertContaPlataforma } from "@/lib/repositories/contasRepository";

/**
 * Conecta Google Ads no hub: cola refresh token (+ opcional loginCustomerId / customerId).
 * App client/secret/devToken vêm de PlatformApp GOOGLE_ADS.
 * GET com workspaceId redireciona para /config/conexoes#google (UI usa POST).
 */
export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }
  const url = new URL("/config/conexoes", request.nextUrl.origin);
  url.searchParams.set("workspaceId", workspaceId);
  url.searchParams.set("connect", "GOOGLE_ADS");
  return NextResponse.redirect(url);
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const workspaceId =
    (typeof body.workspaceId === "string" && body.workspaceId.trim()) ||
    request.nextUrl.searchParams.get("workspaceId")?.trim() ||
    "";
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }
  const access = await requireWorkspaceAccess(workspaceId, "manage");
  if (!access.ok) return access.response;
  if (!(await findWorkspaceById(workspaceId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const platform = await resolvePlatformApp("GOOGLE_ADS");
  if (!platform?.enabled) {
    return NextResponse.json({ error: "Google Ads app desabilitado em /admin/apps" }, { status: 503 });
  }
  if (!platform.credentials.clientId || !platform.credentials.clientSecret || !platform.credentials.developerToken) {
    return NextResponse.json(
      { error: "Configure clientId/secret/developerToken em /admin/apps (GOOGLE_ADS)" },
      { status: 503 },
    );
  }

  const refreshToken =
    typeof body.refreshToken === "string" ? body.refreshToken.trim() : "";
  if (!refreshToken) {
    return NextResponse.json({ error: "refreshToken obrigatório" }, { status: 400 });
  }
  const loginCustomerId =
    typeof body.loginCustomerId === "string" ? body.loginCustomerId.replace(/\D/g, "") : "";
  const customerId =
    typeof body.customerId === "string" ? body.customerId.replace(/\D/g, "") : "";

  await upsertWorkspaceConnection({
    clienteId: workspaceId,
    provider: "GOOGLE_ADS",
    label: "Google Ads",
    credentials: {
      refreshToken,
      loginCustomerId: loginCustomerId || undefined,
      customerId: customerId || undefined,
    },
    metadata: {
      loginCustomerId: loginCustomerId || null,
      customerId: customerId || null,
    },
  });

  if (customerId) {
    const cliente = await prisma.cliente.findUnique({
      where: { id: workspaceId },
      select: { nome: true },
    });
    await upsertContaPlataforma({
      clienteId: workspaceId,
      plataforma: PLATAFORMA_GOOGLE_ADS,
      accountIdPlataforma: customerId,
      googleAdsLoginCustomerId: loginCustomerId || null,
      nomeConta: cliente?.nome ?? "Google Ads",
      conexaoIntegracaoId: null,
    });
  }

  return NextResponse.json({ ok: true });
}
