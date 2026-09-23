import { prisma } from "@/lib/db";

export const PLATAFORMA_GOOGLE_ADS = "GOOGLE_ADS";
export const PLATAFORMA_META = "META";
export const PLATAFORMA_GOOGLE_ANALYTICS = "GOOGLE_ANALYTICS";
export const PLATAFORMA_INSTAGRAM = "INSTAGRAM";
export const PLATAFORMA_LINKEDIN = "LINKEDIN";

export function normalizeLinkedinAccountId(value?: string | null): string | null {
  // Aceita "512345678", "urn:li:sponsoredAccount:512345678"
  const normalized = String(value ?? "").replace(/^urn:li:sponsoredAccount:/i, "").replace(/\D/g, "");
  return normalized || null;
}

export function normalizeGoogleAdsAccountId(value?: string | null): string | null {
  const normalized = String(value ?? "").replace(/\D/g, "");
  return normalized || null;
}

export function normalizeMetaAccountId(value?: string | null): string | null {
  const normalized = String(value ?? "")
    .replace(/^act_/i, "")
    .replace(/\D/g, "");
  return normalized || null;
}

export function normalizeGa4PropertyId(value?: string | null): string | null {
  const normalized = String(value ?? "").replace(/\D/g, "");
  return normalized || null;
}

export function normalizeGoogleAdsLoginCustomerId(value?: string | null): string | null {
  const normalized = String(value ?? "").replace(/\D/g, "");
  return normalized || null;
}

export function normalizeAccountIdByPlatform(
  plataforma: string,
  accountId?: string | null
): string | null {
  if (plataforma === PLATAFORMA_GOOGLE_ADS) {
    return normalizeGoogleAdsAccountId(accountId);
  }
  if (plataforma === PLATAFORMA_META) {
    return normalizeMetaAccountId(accountId);
  }
  if (plataforma === PLATAFORMA_GOOGLE_ANALYTICS) {
    return normalizeGa4PropertyId(accountId);
  }
  if (plataforma === PLATAFORMA_LINKEDIN) {
    return normalizeLinkedinAccountId(accountId);
  }
  const trimmed = String(accountId ?? "").trim();
  return trimmed || null;
}

export async function findContaByClienteAndPlataforma(clienteId: string, plataforma: string) {
  return prisma.conta.findFirst({
    where: { clienteId, plataforma },
  });
}

export async function upsertContaPlataforma(params: {
  clienteId: string;
  plataforma: string;
  accountIdPlataforma?: string | null;
  googleAdsLoginCustomerId?: string | null;
  nomeConta?: string | null;
  conexaoIntegracaoId?: string | null;
}) {
  const accountIdPlataforma = normalizeAccountIdByPlatform(
    params.plataforma,
    params.accountIdPlataforma
  );

  const existing = await findContaByClienteAndPlataforma(params.clienteId, params.plataforma);
  const googleAdsLoginCustomerId =
    params.plataforma === PLATAFORMA_GOOGLE_ADS
      ? normalizeGoogleAdsLoginCustomerId(params.googleAdsLoginCustomerId)
      : null;

  if (!accountIdPlataforma) {
    if (existing) {
      await prisma.conta.delete({ where: { id: existing.id } });
    }
    return null;
  }

  const conexaoIntegracaoId = params.conexaoIntegracaoId ?? undefined;

  if (existing) {
    return prisma.conta.update({
      where: { id: existing.id },
      data: {
        accountIdPlataforma,
        googleAdsLoginCustomerId,
        nomeConta: params.nomeConta?.trim() || existing.nomeConta || null,
        ...(conexaoIntegracaoId !== undefined
          ? { conexaoIntegracaoId: conexaoIntegracaoId || null }
          : {}),
      },
    });
  }

  return prisma.conta.create({
    data: {
      clienteId: params.clienteId,
      plataforma: params.plataforma,
      accountIdPlataforma,
      googleAdsLoginCustomerId,
      nomeConta: params.nomeConta?.trim() || null,
      conexaoIntegracaoId: conexaoIntegracaoId || null,
    },
  });
}
