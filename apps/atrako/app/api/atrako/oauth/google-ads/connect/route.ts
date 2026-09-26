import { NextRequest, NextResponse } from "next/server";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import { upsertWorkspaceConnection, getWorkspaceConnection } from "@/lib/atrako/workspace-connections";
import { resolvePlatformApp } from "@/lib/config/platformApps";
import {
  PLATAFORMA_GOOGLE_ADS,
  normalizeGoogleAdsAccountId,
  normalizeGoogleAdsLoginCustomerId,
} from "@/lib/repositories/contasRepository";
import { getPublicOrigin } from "@/lib/http/public-origin";
import { prisma } from "@/lib/db";
import { encryptCredentials } from "@/lib/atrako/credentials-crypto";
import { backfillGoogleAdsCliente } from "@/lib/sync/googleAdsApiSync";
import { googleAdsFriendlyError, parseGoogleAdsConnectionMetadata } from "@/lib/googleAds/types";

export const maxDuration = 300;

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

  const prevMeta = parseGoogleAdsConnectionMetadata(existing?.metadata);
  const previousLoginCustomerId =
    (typeof existing?.credentials.loginCustomerId === "string"
      ? existing.credentials.loginCustomerId.replace(/\D/g, "")
      : "") ||
    (prevMeta.loginCustomerId ?? "");

  const accounts = prevMeta.accessibleCustomers;
  const selectedAccount = accounts.find((account) => account.id === customerId);
  const inferredManagerId = selectedAccount?.loginCustomerId ||
    accounts.find((account) => account.manager)?.id || "";
  const effectiveLoginCustomerId =
    selectedAccount?.loginCustomerId || loginCustomerId || previousLoginCustomerId || inferredManagerId;
  const customerNameFromList =
    customerId &&
    selectedAccount?.name?.trim();
  const customerName =
    (typeof body.customerName === "string" && body.customerName.trim()) ||
    customerNameFromList ||
    null;

  if (customerId) {
    if (selectedAccount?.manager && accounts.some((account) => !account.manager)) {
      return NextResponse.json({ error: "Selecione uma conta anunciante, não a conta MCC." }, { status: 400 });
    }
    const normalizedCustomerId = normalizeGoogleAdsAccountId(customerId)!;
    const normalizedLoginId = normalizeGoogleAdsLoginCustomerId(effectiveLoginCustomerId);
    const credentials = {
      ...existing?.credentials,
      refreshToken: nextRefresh,
      loginCustomerId: normalizedLoginId ?? undefined,
      customerId: normalizedCustomerId,
    };
    const pendingMetadata = {
      ...prevMeta,
      loginCustomerId: normalizedLoginId,
      customerId: normalizedCustomerId,
      customerName,
      needsAccountPick: false,
      lastSyncError: null,
    };
    await prisma.$transaction(async (tx) => {
      await tx.workspaceConnection.upsert({
        where: { clienteId_provider: { clienteId: workspaceId, provider: "GOOGLE_ADS" } },
        create: {
          clienteId: workspaceId,
          provider: "GOOGLE_ADS",
          label: customerName || "Google Ads",
          status: "SYNCING",
          credentialsEnc: encryptCredentials(credentials),
          metadata: pendingMetadata,
        },
        update: {
          label: customerName || "Google Ads",
          status: "SYNCING",
          credentialsEnc: encryptCredentials(credentials),
          metadata: pendingMetadata,
        },
      });
      const current = await tx.conta.findFirst({
        where: { clienteId: workspaceId, plataforma: PLATAFORMA_GOOGLE_ADS },
      });
      if (current) {
        await tx.conta.update({
          where: { id: current.id },
          data: {
            accountIdPlataforma: normalizedCustomerId,
            googleAdsLoginCustomerId: normalizedLoginId,
            nomeConta: customerName || current.nomeConta || "Google Ads",
          },
        });
      } else {
        await tx.conta.create({
          data: {
            clienteId: workspaceId,
            plataforma: PLATAFORMA_GOOGLE_ADS,
            accountIdPlataforma: normalizedCustomerId,
            googleAdsLoginCustomerId: normalizedLoginId,
            nomeConta: customerName || "Google Ads",
          },
        });
      }
    });

    const sync = await backfillGoogleAdsCliente(workspaceId, { customerId: normalizedCustomerId });
    const completedAt = new Date().toISOString();
    const syncError = sync.error ? googleAdsFriendlyError(sync.error) : null;
    await upsertWorkspaceConnection({
      clienteId: workspaceId,
      provider: "GOOGLE_ADS",
      label: customerName || "Google Ads",
      status: syncError ? "SYNC_ERROR" : "ACTIVE",
      credentials,
      metadata: {
        ...pendingMetadata,
        lastSyncAt: syncError ? prevMeta.lastSyncAt : completedAt,
        lastSyncError: syncError,
      },
    });
    if (!syncError) {
      await prisma.cliente.update({ where: { id: workspaceId }, data: { ultimoSyncAt: new Date() } });
    }
    return NextResponse.json({
      ok: !syncError,
      customerId: normalizedCustomerId,
      loginCustomerId: normalizedLoginId,
      daysProcessed: sync.daysProcessed,
      campaignsProcessed: sync.campaignsProcessed,
      error: syncError,
    }, { status: syncError ? 502 : 200 });
  }

  return NextResponse.json({ ok: true });
}
