import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { upsertWorkspaceConnection } from "@/lib/atrako/workspace-connections";
import { exchangeMetaCode } from "@/lib/integrations/meta/oauth";
import { discoverMetaBusinessAssets } from "@/lib/integrations/meta/business";
import { loadMetaPlatformAppCredentials, MetaGraphError } from "@/lib/integrations/meta/graph";
import { selectMetaAdAccount } from "@/lib/integrations/meta/connection";
import type { MetaAdsConnectionMetadata } from "@/lib/integrations/meta/types";
import { oauthCompleteRedirect } from "@/lib/oauth/oauthCompleteRedirect";

function hubRedirect(
  origin: string,
  workspaceId: string,
  params: Record<string, string>,
) {
  return oauthCompleteRedirect(origin, { workspaceId, ...params });
}

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");
  const errorReason = request.nextUrl.searchParams.get("error_reason");
  const errorDescription = request.nextUrl.searchParams.get("error_description");

  console.info(
    JSON.stringify({
      event: "meta_oauth_callback",
      hasCode: Boolean(code),
      hasError: Boolean(error),
      errorReason: errorReason ?? null,
    }),
  );

  if (error) {
    const pendingEarly = state
      ? await prisma.workspaceOAuthPending.findUnique({ where: { state } })
      : null;
    const workspaceId = pendingEarly?.clienteId ?? "";
    if (pendingEarly) {
      await prisma.workspaceOAuthPending.delete({ where: { id: pendingEarly.id } }).catch(() => null);
    }
    const hub = new URL("/config/conexoes/oauth-complete", origin);
    if (workspaceId) hub.searchParams.set("workspaceId", workspaceId);
    hub.searchParams.set("meta", "cancelled");
    if (errorDescription) hub.searchParams.set("metaError", errorDescription.slice(0, 200));
    return NextResponse.redirect(hub);
  }

  if (!code || !state) {
    return oauthCompleteRedirect(origin, { meta: "error", metaError: "oauth_missing", ok: "0" });
  }

  const pending = await prisma.workspaceOAuthPending.findUnique({ where: { state } });
  if (!pending || pending.expiresAt < new Date() || pending.provider !== "META_ADS") {
    return oauthCompleteRedirect(origin, { meta: "error", metaError: "oauth_expired", ok: "0" });
  }

  const workspaceId = pending.clienteId;
  const redirectUri =
    pending.redirectUri || `${origin}/api/atrako/oauth/meta/callback`;

  await prisma.workspaceOAuthPending.delete({ where: { id: pending.id } }).catch(() => null);

  try {
    await loadMetaPlatformAppCredentials();
    const token = await exchangeMetaCode({ code, redirectUri });
    console.info(
      JSON.stringify({
        event: "meta_token_obtained",
        workspaceId,
        expiresIn: token.expiresIn ?? null,
      }),
    );

    let metadata: MetaAdsConnectionMetadata;
    try {
      metadata = await discoverMetaBusinessAssets(token.accessToken);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const needsReauth = e instanceof MetaGraphError && e.needsReauth;
      metadata = {
        adAccounts: [],
        health: needsReauth ? "needs_reauth" : "connected_pending_account",
        lastError: msg,
        connectedAt: new Date().toISOString(),
      };
    }

    const expiresAt =
      token.expiresIn != null
        ? new Date(Date.now() + token.expiresIn * 1000).toISOString()
        : null;

    await upsertWorkspaceConnection({
      clienteId: workspaceId,
      provider: "META_ADS",
      label: metadata.businessName ?? "Meta Ads",
      credentials: {
        accessToken: token.accessToken,
        tokenType: "SYSTEM_USER",
        expiresAt,
        expiresIn: token.expiresIn ?? null,
      },
      metadata,
      status: "ACTIVE",
    });

    console.info(
      JSON.stringify({
        event: "meta_connection_created",
        workspaceId,
        businessId: metadata.businessId ?? null,
        adAccountsCount: metadata.adAccounts.length,
      }),
    );

    // Auto-select when exactly one ad account is available.
    if (metadata.adAccounts.length === 1) {
      try {
        await selectMetaAdAccount({
          workspaceId,
          adAccountId: metadata.adAccounts[0].id,
        });
        // Fire-and-forget initial sync so the dashboard is not empty.
        void import("@/lib/sync/metaApiSync")
          .then(({ syncMetaCliente }) => syncMetaCliente(workspaceId))
          .catch(() => null);
        return hubRedirect(origin, workspaceId, { meta: "ready", connected: "META_ADS" });
      } catch {
        /* fall through to select UI */
      }
    }

    if (metadata.adAccounts.length === 0) {
      return hubRedirect(origin, workspaceId, {
        meta: "no_ad_account",
        connected: "META_ADS",
      });
    }

    return hubRedirect(origin, workspaceId, {
      meta: "select_account",
      connected: "META_ADS",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.info(
      JSON.stringify({
        event: "meta_api_error",
        workspaceId,
        phase: "oauth_callback",
        message,
      }),
    );
    return hubRedirect(origin, workspaceId, {
      meta: "error",
      metaError: message.slice(0, 200),
    });
  }
}
