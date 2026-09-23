import type { CrmAdapter, NormalizedLead, CvCrmCredentials } from "./types";

interface CvLead {
  idlead: number | string;
  situacao?: string;
  idsituacao?: number | null;
  data_cad?: string | null;
  data_cancelamento?: string | null;
  data_ultima_interacao?: string | null;
  nome?: string | null;
  email?: string | null;
  telefone?: string | null;
  // Origem / mídia
  origem_nome?: string | null;
  origem_ultimo_nome?: string | null;
  midia_original?: string | null;
  midia_ultimo?: string | null;
  conversao_original?: string | null;
  conversao_ultimo?: string | null;
  // Empreendimento
  empreendimento?: string | null;
  empreendimento_primeiro?: string | null;
  empreendimento_ultimo?: string | null;
  // Valor e qualificação
  valor?: number | string | null;
  score?: number | null;
  possibilidade_venda?: string | null;
  profissao?: string | null;
  renda_familiar?: string | null;
  // Cancelamento / perda
  motivo_cancelamento?: string | null;
  descricao_motivo_cancelamento?: string | null;
  submotivo_cancelamento?: string | null;
  // Atribuição comercial
  corretor?: string | null;
  corretor_ultimo?: string | null;
  gestor?: string | null;
  imobiliaria?: string | null;
  ponto_venda?: string | null;
  // Temperatura de engajamento (textual: "Lead Frio", "Lead Morno", "Lead Quente", "Sem momento")
  momento_lead?: string | null;
  // Extras — API may return a string (comma-separated) or an array
  tags?: string | string[] | null;
  campos_adicionais?: Array<{ idcampo: string; idcampo_valores: string }> | null;
  reserva?: string | number | null;
  feedback?: string | null;
  regiao?: string | null;
  cidade?: string | null;
  estado?: string | null;
}

interface CvDwResponse {
  dados?: CvLead[];
}

interface CvReserva {
  idreserva?: number;
  idlead?: string | number | null;
  valor_contrato?: number | null;
  vgv_tabela?: number | null;
  situacao?: string | null;
  ativo?: string | null;
}

function parseDate(v?: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function parseValor(v?: number | string | null): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return isNaN(v) ? null : v;
  // Normalize BRL currency strings: "R$ 350.000,00" or "350.000,00" → 350000.00
  const cleaned = v
    .replace(/R\$\s*/g, "")   // strip currency symbol
    .replace(/\s/g, "")        // strip whitespace
    .replace(/\./g, "")        // remove thousand separators (BRL uses "." for thousands)
    .replace(/,/g, ".");       // replace decimal comma with dot
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

/** Temperature keywords that indicate a textual possibilidade_venda */
const TEMPERATURA_KEYWORDS = ["frio", "morno", "quente", "sem momento"];

function isTextualTemperatura(v: unknown): boolean {
  const lower = String(v).toLowerCase().trim();
  return TEMPERATURA_KEYWORDS.some((k) => lower.includes(k));
}

/** Extract UTM params from campos_adicionais (custom fields from landing page) */
function extractUtmsFromCampos(
  campos: Array<{ idcampo: string; idcampo_valores: string }> | null | undefined
): Record<string, string> | null {
  if (!campos?.length) return null;
  const UTM_KEYS: Record<string, string> = {
    utm_source: "utmSource",
    utm_medium: "utmMedium",
    utm_campaign: "utmCampaign",
    utm_content: "utmContent",
    utm_term: "utmTerm",
    fbclid: "fbclid",
    gclid: "gclid",
  };
  const result: Record<string, string> = {};
  for (const campo of campos) {
    const key = (campo.idcampo ?? "").toLowerCase().trim();
    const mapped = UTM_KEYS[key];
    if (mapped && campo.idcampo_valores) {
      result[mapped] = campo.idcampo_valores;
    }
  }
  return Object.keys(result).length > 0 ? result : null;
}

function inferStatus(l: CvLead): string {
  // Priority 1: explicit cancellation signals → lost
  if (l.motivo_cancelamento || l.descricao_motivo_cancelamento) return "lost";
  if (l.data_cancelamento) return "lost";

  // Priority 2: explicit reservation/contract number → won
  if (l.reserva) return "won";

  // Priority 3: derive from stage name (situacao)
  // Covers cases where the API does not fill reserva/motivo_cancelamento
  const s = (l.situacao ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (
    s.includes("venda realizada") ||
    s.includes("contrato") ||
    s.includes("assinado") ||
    s.includes("com reserva") ||
    s.includes("reservado")
  ) return "won";

  if (
    s.includes("perdido") ||
    s.includes("cancelado") ||
    s.includes("descartado") ||
    s.includes("desistiu") ||
    s.includes("sem interesse") ||
    s.includes("nao tem interesse")
  ) return "lost";

  return "ongoing";
}

export class CvCrmAdapter implements CrmAdapter {
  private domain: string;
  private email: string;
  private token: string;
  private tagFilter: string[];
  private conversaoOriginalFilter: string[];
  private conversaoUltimoFilter: string[];
  private midiaFilter: string[];
  private origemOriginalFilter: string[];
  private origemUltimoFilter: string[];

  constructor(domain: string, creds: CvCrmCredentials) {
    this.domain = domain.replace(/^https?:\/\//, "").replace(/\.cvcrm\.com\.br.*$/, "");
    this.email = creds.email;
    this.token = creds.token;
    this.tagFilter = creds.tagFilter?.filter(Boolean) ?? [];
    this.conversaoOriginalFilter = creds.conversaoOriginalFilter?.filter(Boolean) ?? [];
    this.conversaoUltimoFilter = creds.conversaoUltimoFilter?.filter(Boolean) ?? [];
    this.midiaFilter = creds.midiaFilter?.filter(Boolean) ?? [];
    this.origemOriginalFilter = creds.origemOriginalFilter?.filter(Boolean) ?? [];
    this.origemUltimoFilter = creds.origemUltimoFilter?.filter(Boolean) ?? [];
  }

  private get baseUrl() {
    return `https://${this.domain}.cvcrm.com.br/api/v1/cvdw`;
  }

  private headers(): HeadersInit {
    return {
      email: this.email,
      token: this.token,
      "Content-Type": "application/json",
    };
  }

  private async _fetchAllLeads(opts?: { since?: Date }): Promise<CvLead[]> {
    const leads: CvLead[] = [];
    let pagina = 1;
    const registrosPorPagina = 500;

    while (true) {
      const params = new URLSearchParams({
        pagina: String(pagina),
        registros_por_pagina: String(registrosPorPagina),
      });

      if (opts?.since) {
        params.set("a_partir_data_referencia", opts.since.toISOString().slice(0, 10));
      }

      const res = await fetch(`${this.baseUrl}/leads?${params}`, {
        headers: this.headers(),
      });

      if (res.status === 204) break;

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`CV CRM API error ${res.status}: ${text.slice(0, 200)}`);
      }

      const data = await res.json() as CvDwResponse;
      const batch: CvLead[] = data.dados ?? [];

      leads.push(...batch);

      if (batch.length < registrosPorPagina) break;
      pagina++;
      if (pagina > 100) break;
    }

    return leads;
  }

  /** Fetch all reservas and return a map of idlead → valor_contrato (the deal value). */
  async fetchReservas(): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    let pagina = 1;
    const registrosPorPagina = 500;

    while (true) {
      const params = new URLSearchParams({
        pagina: String(pagina),
        registros_por_pagina: String(registrosPorPagina),
      });

      const res = await fetch(`${this.baseUrl}/reservas?${params}`, {
        headers: this.headers(),
      });

      if (res.status === 204) break;
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.warn(`[CvCrmAdapter] reservas fetch failed ${res.status}: ${text.slice(0, 200)}`);
        break;
      }

      const data = await res.json() as { dados?: CvReserva[] };
      const batch: CvReserva[] = data.dados ?? [];

      for (const r of batch) {
        if (!r.idlead) continue;
        // idlead can be comma-separated (multiple leads linked to one reserva)
        const ids = String(r.idlead).split(",").map((s) => s.trim()).filter(Boolean);
        const valor = r.valor_contrato ?? r.vgv_tabela ?? null;
        if (valor !== null && valor > 0) {
          for (const id of ids) {
            // Keep the highest value if a lead has multiple reservas
            const existing = map.get(id) ?? 0;
            if (valor > existing) map.set(id, valor);
          }
        }
      }

      if (batch.length < registrosPorPagina) break;
      pagina++;
      if (pagina > 100) break;
    }

    console.log(`[CvCrmAdapter] fetchReservas: ${map.size} leads with deal value`);
    return map;
  }

  async fetchLeads(opts?: { since?: Date }): Promise<NormalizedLead[]> {
    // Fetch reservas in parallel with leads — provides the deal value (valor_contrato)
    // which is not present on the /cvdw/leads endpoint.
    const [leads, reservaValorMap] = await Promise.all([
      this._fetchAllLeads(opts),
      this.fetchReservas().catch((e) => {
        console.warn("[CvCrmAdapter] fetchReservas failed, valor will be null:", e instanceof Error ? e.message : e);
        return new Map<string, number>();
      }),
    ]);

    const now = new Date();

    // Sampled field-presence diagnostic (first lead only) — helps detect API plan changes
    if (leads.length > 0) {
      const sample = leads[0];
      console.log(`[CvCrmAdapter] field presence check (leadId=${sample.idlead}):`, {
        has_valor: sample.valor != null,
        valor_raw: sample.valor,
        has_possibilidade_venda: sample.possibilidade_venda != null,
        possibilidade_venda_raw: sample.possibilidade_venda,
        has_momento_lead: sample.momento_lead != null,
        momento_lead_raw: sample.momento_lead,
        has_score: sample.score != null,
      });
    }

    const normalized: NormalizedLead[] = leads.map((l): NormalizedLead => {
      const dadosCv: Record<string, unknown> = {};

      // Origem e mídia
      if (l.origem_nome) dadosCv.origem = l.origem_nome;
      if (l.origem_ultimo_nome) dadosCv.origemUltimo = l.origem_ultimo_nome;
      if (l.midia_original) dadosCv.midiaOriginal = l.midia_original;
      if (l.midia_ultimo) dadosCv.midiaUltimo = l.midia_ultimo;
      if (l.conversao_original) dadosCv.conversaoOriginal = l.conversao_original;
      if (l.conversao_ultimo) dadosCv.conversaoUltimo = l.conversao_ultimo;

      // Empreendimento de interesse
      if (l.empreendimento) dadosCv.empreendimento = l.empreendimento;
      if (l.empreendimento_primeiro) dadosCv.empreendimentoPrimeiro = l.empreendimento_primeiro;
      if (l.empreendimento_ultimo) dadosCv.empreendimentoUltimo = l.empreendimento_ultimo;

      // Qualificação
      if (l.score !== null && l.score !== undefined) dadosCv.score = l.score;

      // possibilidade_venda can be EITHER:
      //   • numeric 1–5 (manual broker score) → stored as possibilidadeVenda
      //   • textual "Lead Frio/Morno/Quente/Sem momento" → stored as momentoLead
      if (l.possibilidade_venda) {
        if (isTextualTemperatura(l.possibilidade_venda)) {
          dadosCv.momentoLead = l.possibilidade_venda;
        } else {
          dadosCv.possibilidadeVenda = l.possibilidade_venda;
        }
      }
      // momento_lead is a dedicated temperature field on some CV CRM plans
      if (l.momento_lead) dadosCv.momentoLead = l.momento_lead;

      if (l.profissao) dadosCv.profissao = l.profissao;
      if (l.renda_familiar) dadosCv.rendaFamiliar = l.renda_familiar;
      if (l.feedback) dadosCv.feedback = l.feedback;

      // Cancelamento / perda
      if (l.motivo_cancelamento) dadosCv.motivoCancelamento = l.motivo_cancelamento;
      if (l.descricao_motivo_cancelamento) dadosCv.descricaoCancelamento = l.descricao_motivo_cancelamento;
      if (l.submotivo_cancelamento) dadosCv.submotivoCancelamento = l.submotivo_cancelamento;

      // Atribuição comercial
      if (l.corretor) dadosCv.corretor = l.corretor;
      if (l.corretor_ultimo) dadosCv.corretorUltimo = l.corretor_ultimo;
      if (l.gestor) dadosCv.gestor = l.gestor;
      if (l.imobiliaria) dadosCv.imobiliaria = l.imobiliaria;
      if (l.ponto_venda) dadosCv.pontoVenda = l.ponto_venda;

      // Localização
      if (l.regiao) dadosCv.regiao = l.regiao;
      if (l.cidade) dadosCv.cidade = l.cidade;
      if (l.estado) dadosCv.estado = l.estado;

      // Extras — normalize tags to string[] regardless of API format
      if (l.tags) {
        const tagsArr = Array.isArray(l.tags)
          ? (l.tags as string[])
          : String(l.tags).split(/[,;|]/).map((t) => t.trim()).filter(Boolean);
        if (tagsArr.length > 0) dadosCv.tags = tagsArr;
      }
      if (l.campos_adicionais?.length) {
        dadosCv.camposAdicionais = l.campos_adicionais;
        // Parse UTM parameters from campos_adicionais when present
        const utms = extractUtmsFromCampos(l.campos_adicionais);
        if (utms) Object.assign(dadosCv, utms);
      }
      if (l.reserva) dadosCv.reserva = l.reserva;

      return {
        crmLeadId: String(l.idlead),
        etapa: l.situacao ?? "Desconhecido",
        ordemEtapa: l.idsituacao ?? null,
        nome: l.nome ?? null,
        email: l.email ?? null,
        telefone: l.telefone ?? null,
        dataEntrada: parseDate(l.data_cad) ?? now,
        dataFechamento: parseDate(l.data_cancelamento),
        // Campos diretos mapeados para campos de 1ª classe
        fonte: l.origem_nome ?? null,
        // Prefer deal value from /cvdw/reservas (valor_contrato); fall back to lead's own valor field
        valor: reservaValorMap.get(String(l.idlead)) ?? parseValor(l.valor),
        rating: l.score ?? null,
        status: inferStatus(l),
        // momentoLead: prefer dedicated moment_lead field, then textual possibilidade_venda
        momentoLead: (dadosCv.momentoLead as string | null | undefined)?.trim() || null,
        dadosCv: Object.keys(dadosCv).length > 0 ? dadosCv : null,
      };
    });

    const before = normalized.length;
    let result = normalized;

    // All configured filters are applied in AND — a lead must pass every active filter.

    if (this.tagFilter.length > 0) {
      const filterSet = new Set(this.tagFilter.map((t) => t.toLowerCase().trim()));
      result = result.filter((lead) => {
        const tags = (lead.dadosCv?.tags as string[] | undefined) ?? [];
        return tags.some((t) => filterSet.has(t.toLowerCase().trim()));
      });
    }

    if (this.conversaoOriginalFilter.length > 0) {
      const filterSet = new Set(this.conversaoOriginalFilter.map((v) => v.toLowerCase().trim()));
      result = result.filter((lead) => {
        const conv = ((lead.dadosCv?.conversaoOriginal as string | undefined) ?? "").toLowerCase().trim();
        return conv !== "" && filterSet.has(conv);
      });
    }

    if (this.conversaoUltimoFilter.length > 0) {
      const filterSet = new Set(this.conversaoUltimoFilter.map((v) => v.toLowerCase().trim()));
      result = result.filter((lead) => {
        const conv = ((lead.dadosCv?.conversaoUltimo as string | undefined) ?? "").toLowerCase().trim();
        return conv !== "" && filterSet.has(conv);
      });
    }

    if (this.midiaFilter.length > 0) {
      const filterSet = new Set(this.midiaFilter.map((v) => v.toLowerCase().trim()));
      result = result.filter((lead) => {
        const midia = ((lead.dadosCv?.midiaOriginal as string | undefined) ?? "").toLowerCase().trim();
        return midia !== "" && filterSet.has(midia);
      });
    }

    if (this.origemOriginalFilter.length > 0) {
      const filterSet = new Set(this.origemOriginalFilter.map((v) => v.toLowerCase().trim()));
      result = result.filter((lead) => {
        const origem = ((lead.dadosCv?.origem as string | undefined) ?? "").toLowerCase().trim();
        return origem !== "" && filterSet.has(origem);
      });
    }

    if (this.origemUltimoFilter.length > 0) {
      const filterSet = new Set(this.origemUltimoFilter.map((v) => v.toLowerCase().trim()));
      result = result.filter((lead) => {
        const origemUltimo = ((lead.dadosCv?.origemUltimo as string | undefined) ?? "").toLowerCase().trim();
        return origemUltimo !== "" && filterSet.has(origemUltimo);
      });
    }

    if (result.length !== before) {
      console.log(`[CvCrmAdapter] filters applied: ${result.length}/${before} leads passed all configured filters`);
    }

    return result;
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/leads?pagina=1&registros_por_pagina=1`, {
        headers: this.headers(),
      });
      if (res.status === 204 || res.ok) return { ok: true };
      const text = await res.text().catch(() => "");
      return { ok: false, error: `Status ${res.status}: ${text.slice(0, 100)}` };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
}
