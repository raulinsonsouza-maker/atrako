/**
 * Business Portfolio + ad accounts discovery (Marketing / Business Management API).
 */

import {
  ensureActPrefix,
  fetchMetaPaginated,
  metaGraphGet,
  normalizeAdAccountId,
} from "./graph";
import type {
  MetaAdAccountMeta,
  MetaAdsConnectionMetadata,
  MetaPageMeta,
} from "./types";

type BusinessNode = { id: string; name?: string };
type AdAccountNode = {
  id: string;
  name?: string;
  account_id?: string;
  account_status?: number;
  currency?: string;
};
type PageNode = {
  id: string;
  name?: string;
  instagram_business_account?: { id: string; username?: string };
};
type PixelNode = { id: string; name?: string };

export async function getMetaMe(accessToken: string) {
  const me = await metaGraphGet("/me", accessToken, { fields: "id,name" });
  return {
    id: String(me.id ?? ""),
    name: typeof me.name === "string" ? me.name : undefined,
  };
}

export async function getClientBusinessId(accessToken: string): Promise<string | null> {
  try {
    const me = await metaGraphGet("/me", accessToken, { fields: "client_business_id" });
    return typeof me.client_business_id === "string" ? me.client_business_id : null;
  } catch {
    return null;
  }
}

export async function getBusinesses(accessToken: string): Promise<BusinessNode[]> {
  return fetchMetaPaginated<BusinessNode>("/me/businesses", accessToken, {
    fields: "id,name",
  });
}

async function listAdAccounts(
  businessId: string,
  accessToken: string,
  edge: "owned_ad_accounts" | "client_ad_accounts",
  ownershipType: "OWNED" | "CLIENT",
): Promise<MetaAdAccountMeta[]> {
  try {
    const rows = await fetchMetaPaginated<AdAccountNode>(
      `/${businessId}/${edge}`,
      accessToken,
      { fields: "id,name,account_id,account_status,currency" },
    );
    return rows.map((r) => ({
      id: normalizeAdAccountId(r.account_id ?? r.id),
      name: r.name ?? r.id,
      currency: r.currency,
      accountStatus: r.account_status,
      ownershipType,
    }));
  } catch {
    return [];
  }
}

async function listPixels(
  businessId: string,
  accessToken: string,
  edge: "owned_pixels" | "client_pixels",
): Promise<Array<{ id: string; name?: string }>> {
  try {
    const rows = await fetchMetaPaginated<PixelNode>(`/${businessId}/${edge}`, accessToken, {
      fields: "id,name",
    });
    return rows.map((r) => ({ id: r.id, name: r.name }));
  } catch {
    return [];
  }
}

async function listPages(
  businessId: string,
  accessToken: string,
  edge: "owned_pages" | "client_pages",
): Promise<MetaPageMeta[]> {
  try {
    const rows = await fetchMetaPaginated<PageNode>(`/${businessId}/${edge}`, accessToken, {
      fields: "id,name,instagram_business_account{id,username}",
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      instagramId: r.instagram_business_account?.id,
      instagramUsername: r.instagram_business_account?.username,
    }));
  } catch {
    return [];
  }
}

async function listMeAdAccounts(accessToken: string): Promise<MetaAdAccountMeta[]> {
  try {
    const rows = await fetchMetaPaginated<AdAccountNode>("/me/adaccounts", accessToken, {
      fields: "id,name,account_id,account_status,currency",
    });
    return rows.map((r) => ({
      id: normalizeAdAccountId(r.account_id ?? r.id),
      name: r.name ?? r.id,
      currency: r.currency,
      accountStatus: r.account_status,
      ownershipType: "UNKNOWN" as const,
    }));
  } catch {
    return [];
  }
}

function dedupeAdAccounts(list: MetaAdAccountMeta[]): MetaAdAccountMeta[] {
  const map = new Map<string, MetaAdAccountMeta>();
  for (const a of list) {
    const key = normalizeAdAccountId(a.id);
    const prev = map.get(key);
    if (!prev || (prev.ownershipType === "UNKNOWN" && a.ownershipType !== "UNKNOWN")) {
      map.set(key, { ...a, id: key });
    }
  }
  return Array.from(map.values());
}

export async function discoverMetaBusinessAssets(
  accessToken: string,
): Promise<MetaAdsConnectionMetadata> {
  const me = await getMetaMe(accessToken);
  const clientBusinessId = await getClientBusinessId(accessToken);
  let businesses = await getBusinesses(accessToken);

  if (clientBusinessId && !businesses.some((b) => b.id === clientBusinessId)) {
    try {
      const b = await metaGraphGet(`/${clientBusinessId}`, accessToken, { fields: "id,name" });
      businesses = [
        { id: String(b.id ?? clientBusinessId), name: typeof b.name === "string" ? b.name : undefined },
        ...businesses,
      ];
    } catch {
      businesses = [{ id: clientBusinessId }, ...businesses];
    }
  }

  const primaryBusiness = businesses[0];
  const businessId = primaryBusiness?.id ?? clientBusinessId ?? undefined;
  const businessName = primaryBusiness?.name;

  let adAccounts: MetaAdAccountMeta[] = [];
  let pages: MetaPageMeta[] = [];
  const pixels: Array<{ id: string; name?: string }> = [];
  const igAssets: NonNullable<MetaAdsConnectionMetadata["assets"]> = [];

  const businessIds = businesses.length
    ? businesses.map((b) => b.id)
    : clientBusinessId
      ? [clientBusinessId]
      : [];

  for (const bid of businessIds) {
    const [owned, client, ownedPages, clientPages, ownedPixels, clientPixels] = await Promise.all([
      listAdAccounts(bid, accessToken, "owned_ad_accounts", "OWNED"),
      listAdAccounts(bid, accessToken, "client_ad_accounts", "CLIENT"),
      listPages(bid, accessToken, "owned_pages"),
      listPages(bid, accessToken, "client_pages"),
      listPixels(bid, accessToken, "owned_pixels"),
      listPixels(bid, accessToken, "client_pixels"),
    ]);
    adAccounts.push(...owned, ...client);
    pages.push(...ownedPages, ...clientPages);
    pixels.push(...ownedPixels, ...clientPixels);
  }

  if (adAccounts.length === 0) {
    adAccounts = await listMeAdAccounts(accessToken);
  }

  adAccounts = dedupeAdAccounts(adAccounts);
  const pageMap = new Map<string, MetaPageMeta>();
  for (const p of pages) pageMap.set(p.id, p);
  pages = Array.from(pageMap.values());

  const pixelMap = new Map<string, { id: string; name?: string }>();
  for (const px of pixels) pixelMap.set(px.id, px);
  const uniquePixels = Array.from(pixelMap.values());

  for (const p of pages) {
    if (p.instagramId) {
      igAssets.push({
        type: "INSTAGRAM",
        id: p.instagramId,
        name: p.instagramUsername ?? p.name,
        businessId,
      });
    }
  }

  const assets: MetaAdsConnectionMetadata["assets"] = [
    ...pages.map((p) => ({ type: "PAGE" as const, id: p.id, name: p.name, businessId })),
    ...uniquePixels.map((px) => ({
      type: "PIXEL" as const,
      id: px.id,
      name: px.name,
      businessId,
    })),
    ...igAssets,
  ];

  return {
    metaUserId: me.id || undefined,
    metaUserName: me.name,
    businessId,
    businessName,
    clientBusinessId: clientBusinessId ?? undefined,
    adAccounts,
    pages,
    assets,
    selectedAdAccountId: null,
    health: "connected_pending_account",
    lastError: null,
    connectedAt: new Date().toISOString(),
  };
}

export async function validateAdAccountAccess(
  accessToken: string,
  adAccountId: string,
): Promise<boolean> {
  try {
    await metaGraphGet(`/${ensureActPrefix(adAccountId)}`, accessToken, {
      fields: "id,account_id,name,account_status",
    });
    return true;
  } catch {
    return false;
  }
}
