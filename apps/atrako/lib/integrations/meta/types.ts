export type MetaAdOwnership = "OWNED" | "CLIENT" | "UNKNOWN";

export type MetaConnectionHealth =
  | "ready"
  | "connected_pending_account"
  | "needs_reauth"
  | "sync_error"
  | "disconnected";

export type MetaAdAccountMeta = {
  id: string;
  name: string;
  currency?: string;
  accountStatus?: number;
  ownershipType: MetaAdOwnership;
};

export type MetaPageMeta = {
  id: string;
  name?: string;
  instagramId?: string;
  instagramUsername?: string;
};

export type MetaAssetMeta = {
  type: "PAGE" | "INSTAGRAM" | "PIXEL" | "DATASET" | "CATALOG" | "OTHER";
  id: string;
  name?: string;
  businessId?: string;
};

export type MetaAdsConnectionMetadata = {
  metaUserId?: string;
  metaUserName?: string;
  businessId?: string;
  businessName?: string;
  clientBusinessId?: string;
  scopes?: string[];
  adAccounts: MetaAdAccountMeta[];
  pages?: MetaPageMeta[];
  assets?: MetaAssetMeta[];
  selectedAdAccountId?: string | null;
  health?: MetaConnectionHealth;
  lastError?: string | null;
  lastSyncAt?: string | null;
  connectedAt?: string;
};

export type MetaAdsCredentials = {
  accessToken: string;
  tokenType?: "USER" | "SYSTEM_USER" | string;
  expiresAt?: string | null;
  expiresIn?: number | null;
};

export function parseMetaAdsMetadata(raw: unknown): MetaAdsConnectionMetadata {
  const m = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const adAccounts = Array.isArray(m.adAccounts)
    ? (m.adAccounts as MetaAdAccountMeta[]).filter((a) => a && typeof a.id === "string")
    : [];
  return {
    metaUserId: typeof m.metaUserId === "string" ? m.metaUserId : undefined,
    metaUserName: typeof m.metaUserName === "string" ? m.metaUserName : undefined,
    businessId: typeof m.businessId === "string" ? m.businessId : undefined,
    businessName: typeof m.businessName === "string" ? m.businessName : undefined,
    clientBusinessId: typeof m.clientBusinessId === "string" ? m.clientBusinessId : undefined,
    scopes: Array.isArray(m.scopes) ? (m.scopes as string[]) : undefined,
    adAccounts,
    pages: Array.isArray(m.pages) ? (m.pages as MetaPageMeta[]) : undefined,
    assets: Array.isArray(m.assets) ? (m.assets as MetaAssetMeta[]) : undefined,
    selectedAdAccountId:
      typeof m.selectedAdAccountId === "string"
        ? m.selectedAdAccountId
        : m.selectedAdAccountId === null
          ? null
          : undefined,
    health: typeof m.health === "string" ? (m.health as MetaConnectionHealth) : undefined,
    lastError: typeof m.lastError === "string" ? m.lastError : m.lastError === null ? null : undefined,
    lastSyncAt: typeof m.lastSyncAt === "string" ? m.lastSyncAt : undefined,
    connectedAt: typeof m.connectedAt === "string" ? m.connectedAt : undefined,
  };
}
