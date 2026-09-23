export interface NormalizedLead {
  crmLeadId: string;
  etapa: string;
  ordemEtapa?: number | null;
  nome?: string | null;
  telefone?: string | null;
  email?: string | null;
  fonte?: string | null;
  rating?: number | null;
  /** won | lost | ongoing | paused */
  status?: string | null;
  /** UUID do contato no RD Station Marketing (para enriquecimento) */
  rdContactId?: string | null;
  dataEntrada: Date;
  dataFechamento?: Date | null;
  valor?: number | null;
  /** Temperatura de engajamento do lead: "Lead Frio", "Lead Morno", "Lead Quente", etc. */
  momentoLead?: string | null;
  /** Campos adicionais do CV CRM (origem, mídia, empreendimento, score, etc.) */
  dadosCv?: Record<string, unknown> | null;
}

export interface CrmAdapter {
  fetchLeads(opts?: { since?: Date }): Promise<NormalizedLead[]>;
  testConnection(): Promise<{ ok: boolean; error?: string }>;
}

export interface CvCrmCredentials {
  email: string;
  token: string;
  /** Only import/show leads that have at least one of these tags. Empty/absent = no filter. */
  tagFilter?: string[];
  /**
   * Only import leads whose `conversao_original` (first conversion) matches one of these values.
   * Case-insensitive exact match. Empty/absent = no filter.
   */
  conversaoOriginalFilter?: string[];
  /**
   * Only import leads whose `conversao_ultimo` (last conversion) matches one of these values.
   * Case-insensitive exact match. Empty/absent = no filter.
   */
  conversaoUltimoFilter?: string[];
  /**
   * Only import leads whose `midia_original` matches one of these values.
   * Case-insensitive exact match. Empty/absent = no filter.
   */
  midiaFilter?: string[];
  /**
   * Only import leads whose `origem_ultimo_nome` (last origin) matches one of these values.
   * Case-insensitive exact match. Empty/absent = no filter.
   */
  origemOriginalFilter?: string[];
  origemUltimoFilter?: string[];
}

export interface RdStationCredentials {
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  token?: string;
}

export interface KommoCredentials {
  token: string;
}

export interface ExactSpotterCredentials {
  token: string;
  /** Filtro de origem: só importa leads cuja source.value contém um desses valores (case-insensitive). Vazio = sem filtro. */
  allowedSources?: string[];
  /** Filtro de etapa: só importa leads cuja stage contém um desses valores (case-insensitive). Vazio = sem filtro. */
  allowedStages?: string[];
}
