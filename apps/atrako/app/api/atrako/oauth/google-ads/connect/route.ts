import { NextRequest, NextResponse } from "next/server";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import { upsertWorkspaceConnection, getWorkspaceConnection } from "@/lib/atrako/workspace-connections";
import { resolvePlatformApp } from "@/lib/config/platformApps";
import { prisma } from "@/lib/db";
import { PLATAFORMA_GOOGLE_ADS, upsertContaPlataforma } from "@/lib/repositories/contasRepository";
import { getPublicOrigin } from "@/lib/http/public-origin";

/**
 * GET → redireciona para OAuth start (fluxo SaaS).
 * POST → escolher CID após OAuth (usa refresh token já gravado na WC).
 */
export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }
  const start = new URL("/api/atrako/oauth/google-ads/start", getPublicOrigin(request));
  start.searchParams.set("workspaceId", workspaceId);
  return NextResponse.redirect(start);
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
  if (!platform.credentials.clientId || !platform.credentials.clientSecret) {
    return NextResponse.json(
      { error: "Configure clientId/secret em /admin/apps (GOOGLE_ADS)" },
      { status: 503 },
    );
  }

  const refreshToken =
    typeof body.refreshToken === "string" ? body.refreshToken.trim() : "";
  const loginCustomerId =
    typeof body.loginCustomerId === "string" ? body.loginCustomerId.replace(/\D/g, "") : "";
  const customerId =
    typeof body.customerId === "string" ? body.customerId.replace(/\D/g, "") : "";

  const existing = await getWorkspaceConnection(workspaceId, "GOOGLE_ADS");
  const prevRefresh =
    typeof existing?.credentials.refreshToken === "string"
      ? existing.credentials.refreshToken
      : "";
  const nextRefresh = refreshToken || prevRefresh;
  if (!nextRefresh) {
    return NextResponse.json(
      { error: "Conecte via OAuth ou informe refreshToken" },
      { status: 400 },
    );
  }

  const prevMeta =
    existing?.metadata && typeof existing.metadata === "object"
      ? (existing.metadata as Record<string, unknown>)
      : {};

  await upsertWorkspaceConnection({
    clienteId: workspaceId,
    provider: "GOOGLE_ADS",
    label: "Google Ads",
    credentials: {
      refreshToken: nextRefresh,
      loginCustomerId: loginCustomerId || undefined,
      customerId: customerId || undefined,
    },
    metadata: {
      ...prevMeta,
      loginCustomerId: loginCustomerId || null,
      customerId: customerId || null,
      needsAccountPick: customerId ? false : prevMeta.needsAccountPick === true,
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
