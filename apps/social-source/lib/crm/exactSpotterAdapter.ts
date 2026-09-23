import type { CrmAdapter, NormalizedLead } from "./types";

const BASE_URL = "https://api.exactspotter.com/v3";
const PAGE_SIZE = 500;

export interface ExactSpotterCredentials {
  token: string;
  /** Filtro de origem: só importa leads cuja source.value está na lista. Vazio = sem filtro. */
  allowedSources?: string[];
  /** Filtro de etapa: só importa leads cuja stage está na lista. Vazio = sem filtro. */
  allowedStages?: string[];
}

interface SpotterLead {
  id: number;
  lead: string;
  stage?: string | null;
  registerDate?: string | null;
  updateDate?: string | null;
  closingForecastDate?: string | null;
  phone1?: string | null;
  phone2?: string | null;
  source?: { id?: number; value?: string } | null;
  subSource?: { id?: number; value?: string } | null;
  persons?: SpotterPerson[] | null;
  sdr?: { id?: number; name?: string; lastName?: string; email?: string } | null;
}

interface SpotterPerson {
  id?: number;
  name?: string;
  email?: string | null;
  phone1?: string | null;
  mainContact?: boolean;
}

function parseDate(v?: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

export class ExactSpotterAdapter implements CrmAdapter {
  private token: string;
  private allowedSources: string[];
  private allowedStages: string[];

  constructor(creds: ExactSpotterCredentials) {
    if (!creds.token) throw new Error("Exact Spotter requer um token.");
    this.token = creds.token;
    this.allowedSources = (creds.allowedSources ?? []).map((s) => s.toLowerCase().trim());
    this.allowedStages = (creds.allowedStages ?? []).map((s) => s.toLowerCase().trim());
  }

  private headers(): HeadersInit {
    return {
      token_exact: this.token,
      "Content-Type": "application/json",
    };
  }

  async fetchLeads(opts?: { since?: Date }): Promise<NormalizedLead[]> {
    const leads: SpotterLead[] = [];
    let skip = 0;

    while (true) {
      const params = new URLSearchParams({ $skip: String(skip) });

      if (opts?.since) {
        const sinceStr = opts.since.toISOString().replace(/\.\d{3}Z$/, "Z");
        params.set("$filter", `updateDate gt ${sinceStr}`);
      }

      const res = await fetch(`${BASE_URL}/LeadsAndPersons?${params}`, {
        headers: this.headers(),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Exact Spotter API error ${res.status}: ${text.slice(0, 200)}`);
      }

      const body = await res.json() as {
        value?: SpotterLead[];
        "@odata.nextLink"?: string;
      };

      const batch = body.value ?? [];
      leads.push(...batch);

      if (batch.length < PAGE_SIZE || !body["@odata.nextLink"]) break;
      skip += PAGE_SIZE;
      if (skip > 50000) break;
    }

    const now = new Date();

    return leads
      .filter((l) => {
        if (this.allowedSources.length > 0) {
          const src = (l.source?.value ?? "").toLowerCase();
          if (!this.allowedSources.some((f) => src.includes(f))) return false;
        }
        if (this.allowedStages.length > 0) {
          const stg = (l.stage ?? "").toLowerCase();
          if (!this.allowedStages.some((f) => stg.includes(f))) return false;
        }
        return true;
      })
      .map((l): NormalizedLead => {
        const mainPerson =
          l.persons?.find((p) => p.mainContact) ?? l.persons?.[0] ?? null;

        const nome =
          mainPerson?.name?.trim() ||
          (l.lead?.trim() !== "" ? l.lead?.trim() : null) ||
          null;

        const email = mainPerson?.email ?? null;
        const telefone = mainPerson?.phone1 ?? l.phone1 ?? null;
        const fonte = l.source?.value ?? null;

        return {
          crmLeadId: String(l.id),
          etapa: l.stage ?? "Desconhecido",
          ordemEtapa: null,
          nome: nome ?? null,
          email,
          telefone,
          fonte,
          rating: null,
          status: null,
          rdContactId: null,
          dataEntrada: parseDate(l.registerDate) ?? now,
          dataFechamento: parseDate(l.closingForecastDate),
          valor: null,
          momentoLead: null,
          dadosCv: null,
        };
      });
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/LeadsAndPersons?$skip=0`, {
        headers: this.headers(),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return { ok: false, error: `Status ${res.status}: ${text.slice(0, 100)}` };
      }
      const body = await res.json() as { value?: unknown[] };
      const count = body.value?.length ?? 0;
      return { ok: true, error: undefined };
      void count;
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
}
