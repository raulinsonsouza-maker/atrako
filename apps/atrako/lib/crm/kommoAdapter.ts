import type { CrmAdapter, NormalizedLead, KommoCredentials } from "./types";

interface KommoLead {
  id: number;
  name?: string;
  status_id?: number;
  pipeline_id?: number;
  created_at?: number;
  closed_at?: number | null;
  price?: number | null;
  _embedded?: {
    contacts?: Array<{ id: number; is_main?: boolean }>;
  };
}

interface KommoStatus {
  id: number;
  name: string;
  sort?: number;
}

interface KommoPipeline {
  id: number;
  name: string;
  _embedded?: { statuses?: KommoStatus[] };
}

interface KommoContact {
  id: number;
  name?: string;
  custom_fields_values?: Array<{
    field_code?: string;
    values?: Array<{ value?: string }>;
  }>;
}

function parseUnixDate(v?: number | null): Date | null {
  if (v == null) return null;
  const d = new Date(v * 1000);
  return isNaN(d.getTime()) ? null : d;
}

async function runBatched<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  batchSize = 10,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    results.push(...(await Promise.all(batch.map(fn))));
  }
  return results;
}

export class KommoAdapter implements CrmAdapter {
  private subdomain: string;
  private token: string;
  private stageMap: Map<number, string> = new Map();
  private stageOrderMap: Map<number, number> = new Map();

  constructor(subdomain: string, creds: KommoCredentials) {
    this.subdomain = subdomain.replace(/^https?:\/\//, "").replace(/\.kommo\.com.*$/, "");
    this.token = creds.token;
  }

  private get baseUrl() {
    return `https://${this.subdomain}.kommo.com/api/v4`;
  }

  private headers(): HeadersInit {
    return {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
    };
  }

  private async loadPipelines(): Promise<void> {
    try {
      const res = await fetch(`${this.baseUrl}/leads/pipelines?limit=50`, {
        headers: this.headers(),
      });
      if (!res.ok) return;
      const data = await res.json() as {
        _embedded?: { pipelines?: KommoPipeline[] };
      };
      const pipelines = data._embedded?.pipelines ?? [];
      for (const pipeline of pipelines) {
        const statuses = pipeline._embedded?.statuses ?? [];
        for (const status of statuses) {
          this.stageMap.set(status.id, status.name);
          // Use the API's official `sort` value for ordering (10, 20, 30 … 10000, 11000)
          this.stageOrderMap.set(status.id, status.sort ?? 0);
        }
      }
    } catch {
      /* fallback para status_id */
    }
  }

  private async fetchContactById(id: number): Promise<KommoContact | null> {
    try {
      const res = await fetch(`${this.baseUrl}/contacts/${id}`, {
        headers: this.headers(),
      });
      if (!res.ok) return null;
      return await res.json() as KommoContact;
    } catch {
      return null;
    }
  }

  private extractContactField(
    contact: KommoContact,
    fieldCode: string,
  ): string | null {
    const field = contact.custom_fields_values?.find(
      (f) => f.field_code === fieldCode,
    );
    return field?.values?.[0]?.value ?? null;
  }

  async fetchLeads(opts?: { since?: Date }): Promise<NormalizedLead[]> {
    await this.loadPipelines();

    const leads: KommoLead[] = [];
    let page = 1;

    while (true) {
      const params = new URLSearchParams({
        limit: "250",
        page: String(page),
        with: "contacts",
      });
      // Sort descending by updated_at to get most-recently-changed leads first
      params.set("order[updated_at]", "desc");

      if (opts?.since) {
        // Filter by updated_at so deals that changed stage/value after last sync are re-fetched
        params.set(
          "filter[updated_at][from]",
          String(Math.floor(opts.since.getTime() / 1000)),
        );
      }

      const res = await fetch(`${this.baseUrl}/leads?${params}`, {
        headers: this.headers(),
      });

      if (res.status === 204) break;

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Kommo API error ${res.status}: ${text.slice(0, 200)}`);
      }

      const data = await res.json() as {
        _embedded?: { leads?: KommoLead[] };
        _links?: { next?: { href?: string } };
      };

      const batch = data._embedded?.leads ?? [];
      leads.push(...batch);

      if (!data._links?.next?.href || batch.length < 250) break;
      page++;
      if (page > 40) break;
    }

    // Collect unique main-contact IDs that need enrichment (name, phone, email)
    const contactIdsToFetch = new Set<number>();
    for (const lead of leads) {
      const contacts = lead._embedded?.contacts ?? [];
      const main = contacts.find((c) => c.is_main) ?? contacts[0];
      if (main) contactIdsToFetch.add(main.id);
    }

    // Fetch contact details in batches of 10 (rate limit: 7 req/s)
    const contactMap = new Map<number, KommoContact>();
    if (contactIdsToFetch.size > 0) {
      const ids = Array.from(contactIdsToFetch).slice(0, 200);
      await runBatched(ids, async (id) => {
        const c = await this.fetchContactById(id);
        if (c) contactMap.set(id, c);
      });
    }

    const now = new Date();
    return leads.map((l): NormalizedLead => {
      const stageName =
        l.status_id != null
          ? (this.stageMap.get(l.status_id) ?? `Etapa ${l.status_id}`)
          : "Desconhecido";
      const ordemEtapa =
        l.status_id != null ? (this.stageOrderMap.get(l.status_id) ?? null) : null;

      // Resolve contact: prefer is_main, then first
      const contacts = l._embedded?.contacts ?? [];
      const mainContactRef = contacts.find((c) => c.is_main) ?? contacts[0];
      const contact = mainContactRef ? contactMap.get(mainContactRef.id) : null;

      const nome = contact?.name ?? null;
      const email = contact ? this.extractContactField(contact, "EMAIL") : null;
      const telefone = contact ? this.extractContactField(contact, "PHONE") : null;

      return {
        crmLeadId: String(l.id),
        etapa: stageName,
        ordemEtapa,
        nome,
        email,
        telefone,
        dataEntrada: parseUnixDate(l.created_at) ?? now,
        dataFechamento: parseUnixDate(l.closed_at ?? null),
        valor: l.price ?? null,
      };
    });
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/leads?limit=1&page=1`, {
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
