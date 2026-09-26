export type GoogleAdsAccessibleAccount = {
  id: string;
  name: string;
  manager: boolean;
  loginCustomerId: string | null;
};

export type GoogleAdsConnectionMetadata = {
  accessibleCustomerIds: string[];
  accessibleCustomers: GoogleAdsAccessibleAccount[];
  customerId: string | null;
  customerName: string | null;
  loginCustomerId: string | null;
  needsAccountPick: boolean;
  listError: string | null;
  lastSyncAt: string | null;
  lastSyncError: string | null;
};

function cleanId(value: unknown): string {
  return typeof value === "string" ? value.replace(/\D/g, "") : "";
}

export function parseGoogleAdsConnectionMetadata(value: unknown): GoogleAdsConnectionMetadata {
  const meta = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const legacyIds = Array.isArray(meta.accessibleCustomerIds)
    ? meta.accessibleCustomerIds.map(cleanId).filter(Boolean)
    : [];
  const accounts = Array.isArray(meta.accessibleCustomers)
    ? meta.accessibleCustomers.flatMap((raw) => {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
        const row = raw as Record<string, unknown>;
        const id = cleanId(row.id);
        if (!id) return [];
        return [{
          id,
          name: typeof row.name === "string" && row.name.trim() ? row.name.trim() : id,
          manager: row.manager === true,
          loginCustomerId: cleanId(row.loginCustomerId) || null,
        }];
      })
    : [];
  const merged = accounts.length > 0
    ? accounts
    : legacyIds.map((id) => ({ id, name: id, manager: false, loginCustomerId: null }));
  const customerId = cleanId(meta.customerId) || null;
  return {
    accessibleCustomerIds: merged.map((account) => account.id),
    accessibleCustomers: merged,
    customerId,
    customerName:
      (typeof meta.customerName === "string" && meta.customerName.trim()) ||
      merged.find((account) => account.id === customerId)?.name ||
      null,
    loginCustomerId: cleanId(meta.loginCustomerId) || null,
    needsAccountPick: meta.needsAccountPick === true || (!customerId && merged.length > 0),
    listError: typeof meta.listError === "string" && meta.listError.trim() ? meta.listError : null,
    lastSyncAt: typeof meta.lastSyncAt === "string" ? meta.lastSyncAt : null,
    lastSyncError: typeof meta.lastSyncError === "string" && meta.lastSyncError.trim()
      ? meta.lastSyncError
      : null,
  };
}

export function googleAdsFriendlyError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  if (/CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION|ACTION_NOT_PERMITTED/i.test(raw)) {
    return "O projeto Google Cloud do OAuth não possui acesso de produção ao Google Ads API. Solicite acesso Explorer ou Basic no Google Ads API Overview do projeto.";
  }
  if (/invalid_grant|Token has been expired or revoked|invalid credentials/i.test(raw)) {
    return "A autorização do Google Ads expirou ou foi revogada. Reconecte a conta.";
  }
  if (/TWO_STEP_VERIFICATION_NOT_ENROLLED/i.test(raw)) {
    return "A conta Google precisa habilitar a verificação em duas etapas para usar o Google Ads API.";
  }
  return raw || "Falha desconhecida no Google Ads";
}
