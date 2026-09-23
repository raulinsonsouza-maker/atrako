/**
 * Smoke checklist for ingest after PlatformApp/WC cutover.
 * Run manually against a workspace with hub connections:
 *
 *   npx tsx scripts/ingest-regression-smoke.ts --clienteId=<id>
 *
 * Validates resolve paths exist (does not call external APIs unless SYNC=1).
 */
import { resolveGoogleAdsCredentials, resolveMetaCredentials } from "../lib/config/resolveIntegracao";
import { resolvePlatformApp } from "../lib/config/platformApps";
import { getWorkspaceConnection } from "../lib/atrako/workspace-connections";

async function main() {
  const arg = process.argv.find((a) => a.startsWith("--clienteId="));
  const clienteId = arg?.slice("--clienteId=".length)?.trim();
  if (!clienteId) {
    console.error("Usage: npx tsx scripts/ingest-regression-smoke.ts --clienteId=<id>");
    process.exit(1);
  }

  const [metaApp, googleApp, ga4App, mpApp] = await Promise.all([
    resolvePlatformApp("META"),
    resolvePlatformApp("GOOGLE_ADS"),
    resolvePlatformApp("GOOGLE_ANALYTICS"),
    resolvePlatformApp("MERCADO_PAGO"),
  ]);

  console.log("PlatformApp META:", Boolean(metaApp?.credentials.clientId));
  console.log("PlatformApp GOOGLE_ADS:", Boolean(googleApp?.credentials.clientId));
  console.log("PlatformApp GA4:", Boolean(ga4App?.credentials.serviceAccountJson));
  console.log("PlatformApp MP:", Boolean(mpApp?.credentials.clientId));

  const [metaWc, googleWc, liWc, waWc] = await Promise.all([
    getWorkspaceConnection(clienteId, "META_ADS"),
    getWorkspaceConnection(clienteId, "GOOGLE_ADS"),
    getWorkspaceConnection(clienteId, "LINKEDIN_ADS"),
    getWorkspaceConnection(clienteId, "WHATSAPP"),
  ]);

  console.log("WC META_ADS:", metaWc?.status ?? "none");
  console.log("WC GOOGLE_ADS:", googleWc?.status ?? "none");
  console.log("WC LINKEDIN_ADS:", liWc?.status ?? "none");
  console.log("WC WHATSAPP:", waWc?.status ?? "none");

  try {
    const meta = await resolveMetaCredentials(clienteId);
    console.log("resolveMeta:", meta ? "ok" : "null");
  } catch (e) {
    console.log("resolveMeta error:", e instanceof Error ? e.message : e);
  }

  try {
    const google = await resolveGoogleAdsCredentials(clienteId);
    console.log("resolveGoogleAds:", google ? "ok" : "null");
  } catch (e) {
    console.log("resolveGoogleAds error:", e instanceof Error ? e.message : e);
  }

  if (process.env.SYNC === "1") {
    const { syncClienteCanais } = await import("../lib/sync/syncClienteCanais");
    const result = await syncClienteCanais(clienteId);
    console.log("syncClienteCanais:", JSON.stringify(result, null, 2));
  } else {
    console.log("Skip live sync (set SYNC=1 to run syncClienteCanais)");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
