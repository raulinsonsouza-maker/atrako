import { syncGoogleAdsCliente } from "@/lib/sync/googleAdsApiSync";
import { syncMetaCliente } from "@/lib/sync/metaApiSync";
import { syncAnalyticsCliente } from "@/lib/sync/analyticsApiSync";
import { syncMetaLeadsCliente } from "@/lib/sync/metaLeadsSync";
import { syncCrmCliente } from "@/lib/sync/crmSync";
import { syncInstagramCliente } from "@/lib/sync/syncInstagram";
import { syncLinkedinCliente } from "@/lib/sync/linkedinApiSync";
import { prisma } from "@/lib/db";
import { isSyntheticDemoCliente } from "@/lib/demo/syntheticDemo";

export interface SyncClienteCanaisResult {
  ok: boolean;
  googleAds?: {
    ok: boolean;
    daysProcessed: number;
    error?: string;
  };
  meta?: {
    ok: boolean;
    daysProcessed: number;
    error?: string;
  };
  metaLeads?: {
    ok: boolean;
    leadsProcessed: number;
    leadsCreated: number;
    formsFound: number;
    error?: string;
  };
  analytics?: {
    ok: boolean;
    daysProcessed: number;
    error?: string;
  };
  crm?: {
    ok: boolean;
    leadsProcessed: number;
    leadsUpserted: number;
    error?: string;
  };
  instagram?: {
    ok: boolean;
    error?: string;
  };
  linkedin?: {
    ok: boolean;
    error?: string;
  };
}

export async function syncClienteCanais(
  clienteId: string,
  options?: { crmFull?: boolean; dateFrom?: string; dateTo?: string },
): Promise<SyncClienteCanaisResult> {
  if (await isSyntheticDemoCliente(clienteId)) {
    return { ok: true };
  }
  const contas = await prisma.conta.findMany({
    where: {
      clienteId,
      plataforma: { in: ["GOOGLE_ADS", "META", "GOOGLE_ANALYTICS", "LINKEDIN", "INSTAGRAM"] },
    },
  });

  const googleConta = contas.find((conta) => conta.plataforma === "GOOGLE_ADS");
  const metaConta = contas.find((conta) => conta.plataforma === "META");
  const analyticsConta = contas.find((conta) => conta.plataforma === "GOOGLE_ANALYTICS");
  const linkedinConta = contas.find((conta) => conta.plataforma === "LINKEDIN");
  const instagramConta = contas.find((conta) => conta.plataforma === "INSTAGRAM");

  const [googleAdsResult, metaResult, analyticsResult, metaLeadsResult, crmResult, instagramResult] = await Promise.all([
    googleConta
      ? syncGoogleAdsCliente(clienteId, {
          customerId: googleConta.accountIdPlataforma ?? undefined,
          dateFrom: options?.dateFrom,
          dateTo: options?.dateTo,
        })
      : null,
    metaConta
      ? syncMetaCliente(clienteId, {
          accountId: metaConta.accountIdPlataforma ?? undefined,
          dateFrom: options?.dateFrom,
          dateTo: options?.dateTo,
        })
      : null,
    analyticsConta
      ? syncAnalyticsCliente(clienteId, { propertyId: analyticsConta.accountIdPlataforma ?? undefined })
      : null,
    metaConta ? syncMetaLeadsCliente(clienteId) : null,
    syncCrmCliente(clienteId, { full: options?.crmFull }),
    instagramConta
      ? syncInstagramCliente(clienteId).catch((e) => ({
          clienteId,
          configured: true,
          error: e instanceof Error ? e.message : String(e),
        }))
      : null,
  ]);

  // LinkedIn: hub-first (WC), dual-read CI
  let linkedinResult: { ok: boolean; error?: string } | undefined;
  if (linkedinConta?.accountIdPlataforma) {
    try {
      const { getWorkspaceConnection } = await import("@/lib/atrako/workspace-connections");
      const {
        getValidLinkedinAccessTokenForWorkspace,
        getValidLinkedinAccessToken,
      } = await import("@/lib/linkedin/linkedinClient");
      const hub = await getWorkspaceConnection(clienteId, "LINKEDIN_ADS");
      if (hub?.credentials?.accessToken) {
        await syncLinkedinCliente({
          clienteId,
          contaId: linkedinConta.id,
          adAccountId: linkedinConta.accountIdPlataforma,
          accessToken: await getValidLinkedinAccessTokenForWorkspace(clienteId),
          dateFrom: options?.dateFrom,
          dateTo: options?.dateTo,
        });
      } else if (linkedinConta.conexaoIntegracaoId) {
        await syncLinkedinCliente({
          clienteId,
          contaId: linkedinConta.id,
          adAccountId: linkedinConta.accountIdPlataforma,
          accessToken: await getValidLinkedinAccessToken(linkedinConta.conexaoIntegracaoId),
          dateFrom: options?.dateFrom,
          dateTo: options?.dateTo,
        });
      } else {
        linkedinResult = { ok: false, error: "LinkedIn sem conexão no hub" };
      }
      if (!linkedinResult) linkedinResult = { ok: true };
    } catch (e) {
      linkedinResult = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  const igOk = !instagramResult?.error;

  return {
    ok:
      !googleAdsResult?.error &&
      !metaResult?.error &&
      !analyticsResult?.error &&
      igOk &&
      (linkedinResult ? linkedinResult.ok : true),
    googleAds: googleAdsResult
      ? {
          ok: !googleAdsResult.error,
          daysProcessed: googleAdsResult.daysProcessed,
          error: googleAdsResult.error,
        }
      : undefined,
    meta: metaResult
      ? {
          ok: !metaResult.error,
          daysProcessed: metaResult.daysProcessed,
          error: metaResult.error,
        }
      : undefined,
    metaLeads: metaLeadsResult
      ? {
          ok: !metaLeadsResult.error,
          leadsProcessed: metaLeadsResult.leadsProcessed,
          leadsCreated: metaLeadsResult.leadsCreated,
          formsFound: metaLeadsResult.formsFound,
          error: metaLeadsResult.error,
        }
      : undefined,
    analytics: analyticsResult
      ? {
          ok: !analyticsResult.error,
          daysProcessed: analyticsResult.daysProcessed,
          error: analyticsResult.error,
        }
      : undefined,
    crm: {
      ok: crmResult.ok,
      leadsProcessed: crmResult.leadsProcessed,
      leadsUpserted: crmResult.leadsUpserted,
      error: crmResult.error,
    },
    instagram: {
      ok: igOk,
      error: instagramResult?.error,
    },
    linkedin: linkedinResult,
  };
}
