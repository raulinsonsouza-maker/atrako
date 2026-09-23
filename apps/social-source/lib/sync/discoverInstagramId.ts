/**
 * Auto-discovers the Instagram Business Account ID for a Meta Ads client.
 *
 * Strategy (in order):
 * 1. Manual config — INSTAGRAM conta row in DB (fastest, always authoritative).
 * 2. Cross-reference — get managed pages (via /me/accounts) with their
 *    instagram_business_account, then look for the same page_ids in the
 *    ad account's adsets (promoted_object.page_id). Returns the first match.
 *
 * Why not simpler fields?
 * - `instagram_actors` / `pages` fields on AdAccount: don't exist in v19+.
 * - `business/{id}/instagram_accounts`: returns ALL BM accounts (not client-specific).
 * - `/{page_id}?fields=instagram_business_account` on arbitrary pages: requires
 *   pages_read_engagement, which the token may not have.
 */
import { prisma } from "@/lib/db";
import { resolveMetaCredentials } from "@/lib/config/resolveIntegracao";

const GRAPH = "https://graph.facebook.com/v19.0";

async function metaGet(
  path: string,
  token: string,
  params: Record<string, string> = {},
): Promise<Record<string, unknown>> {
  const sp = new URLSearchParams({ access_token: token, ...params });
  const res = await fetch(`${GRAPH}/${path}?${sp}`);
  const json = (await res.json()) as Record<string, unknown>;
  if (json.error) {
    const err = json.error as { message?: string };
    throw new Error(`Meta API: ${err.message ?? String(json.error)}`);
  }
  return json;
}

/**
 * Returns the Instagram Business Account ID for the given cliente, or null
 * if it cannot be determined.
 *
 * Also saves the discovered ID to the DB so future calls are instant.
 */
export async function discoverInstagramId(
  clienteId: string,
): Promise<string | null> {
  // 1. Manual/cached config
  const igConta = await prisma.conta.findFirst({
    where: { clienteId, plataforma: "INSTAGRAM" },
  });
  if (igConta?.accountIdPlataforma) return igConta.accountIdPlataforma;

  // 2. Need a Meta Ads account to discover from
  const metaConta = await prisma.conta.findFirst({
    where: { clienteId, plataforma: "META" },
  });
  if (!metaConta?.accountIdPlataforma) return null;

  const creds = await resolveMetaCredentials(clienteId);
  if (!creds?.token) return null;

  const token = creds.token;
  const actId = `act_${metaConta.accountIdPlataforma}`;

  try {
    // 2a. Get all managed pages with their Instagram accounts
    type PageEntry = { id: string; instagram_business_account?: { id: string } };
    const pagesRaw = await metaGet("me/accounts", token, {
      fields: "id,instagram_business_account",
      limit: "100",
    });
    const pages = (pagesRaw.data as PageEntry[]) ?? [];

    // Build pageId → igId map (only pages that have Instagram connected)
    const pageToIg = new Map<string, string>();
    for (const page of pages) {
      if (page.instagram_business_account?.id) {
        pageToIg.set(page.id, page.instagram_business_account.id);
      }
    }

    if (pageToIg.size === 0) return null;

    // 2b. Get page_ids used in this ad account's adsets
    type AdsetEntry = { promoted_object?: { page_id?: string } };
    const adsetsRaw = await metaGet(actId + "/adsets", token, {
      fields: "promoted_object",
      limit: "100",
    });
    const adsets = (adsetsRaw.data as AdsetEntry[]) ?? [];

    for (const adset of adsets) {
      const pageId = adset.promoted_object?.page_id;
      if (pageId && pageToIg.has(pageId)) {
        const igId = pageToIg.get(pageId)!;

        // Cache the result in DB so next call is instant
        await prisma.conta.upsert({
          where: { clienteId_plataforma: { clienteId, plataforma: "INSTAGRAM" } },
          create: {
            clienteId,
            plataforma: "INSTAGRAM",
            accountIdPlataforma: igId,
          },
          update: { accountIdPlataforma: igId },
        });

        return igId;
      }
    }
  } catch {
    // Discovery failed — caller will get null and handle gracefully
  }

  return null;
}
