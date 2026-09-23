import type { CrmAdapter } from "./types";
import { Prisma } from "@/lib/generated/prisma";
import { CvCrmAdapter } from "./cvCrmAdapter";
import { RdStationCrmAdapter } from "./rdStationAdapter";
import { KommoAdapter } from "./kommoAdapter";
import { ExactSpotterAdapter } from "./exactSpotterAdapter";
import { prisma } from "@/lib/db";

interface CrmConfigRecord {
  id?: string;
  tipo: string;
  dominio?: string | null;
  credenciais: unknown;
}

interface RdTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
}

/**
 * Renova o access_token do RD Station usando o refresh_token.
 * Endpoint oficial v2: POST https://api.rd.services/oauth2/token (form-encoded)
 */
async function refreshRdStationToken(
  creds: Record<string, unknown>,
  configId?: string,
): Promise<{ accessToken: string; refreshToken: string; expiresAt: number }> {
  const clientId = creds.clientId as string | undefined;
  const clientSecret = creds.clientSecret as string | undefined;
  const refreshToken = creds.refreshToken as string | undefined;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Client ID e Client Secret não configurados. Acesse Administração → editar cliente → Integração CRM → salve as credenciais e reconecte.",
    );
  }
  if (!refreshToken) {
    throw new Error(
      "Refresh token não disponível. Reconecte via RD Station no painel do cliente.",
    );
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch("https://api.rd.services/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Falha ao renovar token RD Station: HTTP ${res.status} — ${text.slice(0, 100)}`);
  }

  const data: RdTokenResponse = await res.json();
  if (!data.access_token) {
    throw new Error("Resposta de refresh inválida do RD Station");
  }

  const newCreds = {
    ...creds,
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt: Date.now() + (data.expires_in ?? 7200) * 1000,
  };

  if (configId) {
    await prisma.crmConfig.update({
      where: { id: configId },
      data: { credenciais: newCreds as Prisma.InputJsonValue },
    });
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt: newCreds.expiresAt,
  };
}

export async function getCrmAdapter(config: CrmConfigRecord): Promise<CrmAdapter> {
  const creds = config.credenciais as Record<string, unknown>;

  switch (config.tipo) {
    case "CVCRM": {
      if (!config.dominio) throw new Error("CV CRM requer um domínio configurado.");
      const email = creds.email as string | undefined;
      const token = creds.token as string | undefined;
      if (!email || !token) throw new Error("CV CRM requer email e token nas credenciais.");
      const tagFilter = Array.isArray(creds.tagFilter) ? (creds.tagFilter as string[]) : undefined;
      const conversaoOriginalFilter = Array.isArray(creds.conversaoOriginalFilter)
        ? (creds.conversaoOriginalFilter as string[])
        : undefined;
      return new CvCrmAdapter(config.dominio, { email, token, tagFilter, conversaoOriginalFilter });
    }

    case "RDSTATION_CRM": {
      const accessToken = creds.accessToken as string | undefined;
      const expiresAt = creds.expiresAt as number | undefined;
      const legacyToken = creds.token as string | undefined;

      if (accessToken) {
        const needsRefresh =
          !!expiresAt &&
          !!(creds.refreshToken as string | undefined) &&
          Date.now() > expiresAt - 5 * 60 * 1000;

        if (needsRefresh) {
          try {
            const newCreds = await refreshRdStationToken(creds, config.id);
            return new RdStationCrmAdapter({ accessToken: newCreds.accessToken });
          } catch {
            return new RdStationCrmAdapter({ accessToken });
          }
        }

        return new RdStationCrmAdapter({ accessToken });
      }

      if (legacyToken) {
        return new RdStationCrmAdapter({ token: legacyToken });
      }

      throw new Error(
        "RD Station CRM não está conectado via OAuth. Acesse Administração → editar cliente → Integração CRM → Conectar via RD Station.",
      );
    }

    case "KOMMO": {
      if (!config.dominio) throw new Error("Kommo requer um subdomínio configurado.");
      const token = creds.token as string | undefined;
      if (!token) throw new Error("Kommo requer token nas credenciais.");
      return new KommoAdapter(config.dominio, { token });
    }

    case "EXACT_SPOTTER": {
      const token = creds.token as string | undefined;
      if (!token) throw new Error("Exact Spotter requer token nas credenciais.");
      const allowedSources = Array.isArray(creds.allowedSources)
        ? (creds.allowedSources as string[])
        : undefined;
      const allowedStages = Array.isArray(creds.allowedStages)
        ? (creds.allowedStages as string[])
        : undefined;
      return new ExactSpotterAdapter({ token, allowedSources, allowedStages });
    }

    default:
      throw new Error(`CRM tipo desconhecido: ${config.tipo}`);
  }
}
