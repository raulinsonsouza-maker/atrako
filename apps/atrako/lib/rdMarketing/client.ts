/**
 * Cliente para a API de Marketing do RD Station (platform/contacts).
 * Token: Bearer (OAuth 2.0 via api.rd.services/auth/dialog)
 */

const BASE = "https://api.rd.services/platform";

export interface RdMarketingContact {
  uuid: string;
  name?: string;
  email?: string;
  mobile_phone?: string;
  personal_phone?: string;
  company?: string;
  job_title?: string;
  city?: string;
  state?: string;
  lifecycle_stage?: string;
  opportunity?: boolean;
  interest?: number;
  fit_score?: number;
  tags?: Array<{ name: string }>;
  created_at?: string;
  updated_at?: string;
  cf_data?: Record<string, unknown>;
  // Eventos de conversão (retornados no endpoint individual)
  conversion_events?: Array<{
    created_at?: string;
    event_type?: string;
    content?: {
      email_name?: string;
      name?: string;
      utm_source?: string;
      utm_medium?: string;
      utm_campaign?: string;
      traffic_source?: string;
    };
    traffic_source?: string;
  }>;
}

/** Campos normalizados extraídos dos cf_* e eventos de conversão */
export interface MarketingEnrichment {
  faturamento: string | null;
  segmento: string | null;
  investimento: string | null;
  interesse: string | null;
  cargo: string | null;
  origemMarketing: string | null;
  eventoConversao: string | null;
  empresa: string | null;
  lifecycleStage: string | null;
  // Canal/fonte do tráfego (da plataforma RD Marketing)
  trafficSource: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  // Tags do contato (ex: form_meta_arboreto_inout, lp_arboreto_inout)
  rdTags: string[] | null;
  rdEnrichedAt: string;
}

/**
 * Extrai o primeiro valor não-nulo de uma lista de chaves em cf_data.
 */
function pick(cf: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const v = cf[key];
    if (v !== null && v !== undefined && String(v).trim() !== "") return String(v).trim();
  }
  return null;
}

/** Normaliza dados do contato em campos de negócio. */
export function normalizeEnrichment(contact: RdMarketingContact): MarketingEnrichment {
  const cf = contact.cf_data ?? {};

  const faturamento = pick(
    cf,
    "cf_faturamento_medio_mensal",
    "cf_faturamento_medio_mensal_0",
    "cf_faturamento_medio_mensal_opcoes",
    "cf_faturamento_leadster",
    "cf_v_faturamento_agencia",
  );

  const segmento = pick(
    cf,
    "cf_setor_da_empresa",
    "cf_mercado",
    "cf_27_06_2025_segmento_da_empresa_imovel",
    "cf_perfil_da_empresa",
    "cf_ramo_de_atuacao",
  );

  const investimento = pick(
    cf,
    "cf_budget_mensal_para_marketing_total_nao_apenas_midia",
    "cf_budget_mensal_para_marketing",
    "cf_investe_em_marketing_0",
    "cf_investe_em_marketing",
    "cf_investimento_em_marketing",
  );

  const interesse = pick(
    cf,
    "cf_possui_real_interesse",
    "cf_interesse",
    "cf_motivacao",
  );

  const cargo = pick(
    cf,
    "cf_cargo_inout",
    "cf_qual_o_seu_cargo",
    "cf_qual_e_o_seu_cargo",
    "cf_cargo",
  ) ?? contact.job_title ?? null;

  const origemMarketing = pick(
    cf,
    "cf_origem",
    "cf_plug_opportunity_origin",
    "_origem_primeira_conversao",
  );

  // Evento de conversão mais recente (primeiro da lista — RD retorna em ordem cronológica inversa)
  const firstEvent = contact.conversion_events?.[0];
  const eventoConversao =
    firstEvent?.content?.email_name ??
    firstEvent?.content?.name ??
    null;

  // traffic_source: do conteúdo do evento (mais granular) ou do evento em si
  const trafficSource =
    firstEvent?.content?.traffic_source ??
    firstEvent?.traffic_source ??
    null;

  // UTMs do evento de conversão mais recente
  const utmSource = firstEvent?.content?.utm_source ?? null;
  const utmMedium = firstEvent?.content?.utm_medium ?? null;
  const utmCampaign = firstEvent?.content?.utm_campaign ?? null;

  // Tags do contato
  const rdTags =
    contact.tags && contact.tags.length > 0
      ? contact.tags.map((t) => t.name).filter(Boolean)
      : null;

  const empresa = pick(cf, "cf_nome_da_empresa") ?? contact.company ?? null;
  const lifecycleStage = contact.lifecycle_stage ?? null;

  return {
    faturamento,
    segmento,
    investimento,
    interesse,
    cargo,
    origemMarketing,
    eventoConversao,
    empresa,
    lifecycleStage,
    trafficSource,
    utmSource,
    utmMedium,
    utmCampaign,
    rdTags,
    rdEnrichedAt: new Date().toISOString(),
  };
}

export class RdMarketingClient {
  private token: string;

  constructor(accessToken: string) {
    this.token = accessToken;
  }

  private headers(): HeadersInit {
    return {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
    };
  }

  /** Busca contato pelo UUID (retorna cf_data + eventos). */
  async getContact(uuid: string): Promise<RdMarketingContact | null> {
    try {
      const res = await fetch(`${BASE}/contacts/${uuid}`, { headers: this.headers() });
      if (!res.ok) return null;
      return await res.json() as RdMarketingContact;
    } catch {
      return null;
    }
  }

  /** Busca contato pelo e-mail. */
  async findByEmail(email: string): Promise<RdMarketingContact | null> {
    try {
      const res = await fetch(
        `${BASE}/contacts?email=${encodeURIComponent(email)}`,
        { headers: this.headers() },
      );
      if (!res.ok) return null;
      const body = await res.json() as { contacts?: RdMarketingContact[] } | RdMarketingContact;
      if ("contacts" in body && Array.isArray(body.contacts)) return body.contacts[0] ?? null;
      return body as RdMarketingContact;
    } catch {
      return null;
    }
  }

  /** Testa a conexão buscando um contato fictício. */
  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch(`${BASE}/contacts?page=1&page_size=1`, { headers: this.headers() });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 100)}` };
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  /**
   * Busca eventos de conversão de um contato (paginado).
   * Complementa os dados de getContact quando conversion_events não estão no payload.
   */
  async getContactEvents(uuid: string, page = 1): Promise<Array<{
    event_type: string;
    event_identifier?: string;
    event_timestamp?: string;
    payload?: {
      name?: string;
      email?: string;
      utm_source?: string;
      utm_medium?: string;
      utm_campaign?: string;
      traffic_source?: string;
      [key: string]: unknown;
    };
  }>> {
    try {
      const url = `${BASE}/contacts/${uuid}/events?page=${page}`;
      const res = await fetch(url, { headers: this.headers() });
      if (!res.ok) return [];
      const body = await res.json() as {
        events?: Array<{
          event_type: string;
          event_identifier?: string;
          event_timestamp?: string;
          payload?: Record<string, unknown>;
        }>;
      } | Array<{
        event_type: string;
        event_identifier?: string;
        event_timestamp?: string;
        payload?: Record<string, unknown>;
      }>;
      if (Array.isArray(body)) return body;
      return body?.events ?? [];
    } catch {
      return [];
    }
  }

  /** Lista todas as segmentações da conta. */
  async listSegmentations(): Promise<Array<{ id: string; name: string }>> {
    try {
      const res = await fetch(`${BASE}/segmentations`, { headers: this.headers() });
      if (!res.ok) return [];
      const body = await res.json() as { segmentations?: Array<{ id: string; name: string }> } | Array<{ id: string; name: string }>;
      if (Array.isArray(body)) return body;
      if (body && "segmentations" in body && Array.isArray(body.segmentations)) return body.segmentations;
      return [];
    } catch {
      return [];
    }
  }

  /**
   * Lista contatos de uma segmentação (paginado).
   * Retorna contatos com uuid, email, last_conversion_date, created_at.
   */
  async listSegmentationContacts(
    segmentationId: string,
    page = 1,
  ): Promise<{
    contacts: Array<{
      uuid: string;
      name?: string;
      email?: string;
      last_conversion_date?: string;
      created_at?: string;
    }>;
    hasMore: boolean;
  }> {
    try {
      const url = `${BASE}/segmentations/${segmentationId}/contacts?page=${page}`;
      const res = await fetch(url, { headers: this.headers() });
      if (!res.ok) return { contacts: [], hasMore: false };
      const body = await res.json() as {
        contacts?: Array<{ uuid: string; name?: string; email?: string; last_conversion_date?: string; created_at?: string }>;
      };
      const contacts = body?.contacts ?? [];
      return { contacts, hasMore: contacts.length > 0 };
    } catch {
      return { contacts: [], hasMore: false };
    }
  }

  /**
   * Lista todos os contatos de uma segmentação (pagina automaticamente).
   * Limita a maxPages para não travar o processo.
   */
  async listAllSegmentationContacts(
    segmentationId: string,
    options?: {
      since?: Date;
      maxPages?: number;
    },
  ): Promise<Array<{ uuid: string; name?: string; email?: string; last_conversion_date?: string; created_at?: string }>> {
    const maxPages = options?.maxPages ?? 50;
    const since = options?.since;
    const all: Array<{ uuid: string; name?: string; email?: string; last_conversion_date?: string; created_at?: string }> = [];

    for (let page = 1; page <= maxPages; page++) {
      const { contacts, hasMore } = await this.listSegmentationContacts(segmentationId, page);
      if (contacts.length === 0) break;

      for (const c of contacts) {
        // Filter by last_conversion_date if since is provided
        if (since && c.last_conversion_date) {
          const convDate = new Date(c.last_conversion_date);
          if (convDate <= since) continue;
        }
        all.push(c);
      }

      if (!hasMore) break;
    }

    return all;
  }
}
