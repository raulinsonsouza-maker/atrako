/**
 * POST do lead novo da franquia para o CRM da Regicenter.
 * Sem REGICENTER_LEAD_WEBHOOK_URL, não envia.
 */

import { resolveChoice } from "./choices";

/** createdAt e updatedAt no insert ficam juntos; um card reaproveitado já diverge. */
const FRESH_LEAD_MS = 2000;

export type RegicenterCrmLeadPayload = {
  id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  investment: string | null;
  origem: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
};

export type RegicenterCrmLeadInput = {
  id: string;
  source: string;
  createdAt: Date;
  updatedAt: Date;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  flat: Record<string, string>;
  attribution?: Record<string, unknown> | null;
};

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export function isFreshFranchiseLead(input: {
  source: string;
  createdAt: Date;
  updatedAt: Date;
}): boolean {
  if (!input.source.startsWith("franquia:")) return false;
  return Math.abs(input.updatedAt.getTime() - input.createdAt.getTime()) < FRESH_LEAD_MS;
}

export function buildRegicenterCrmPayload(input: RegicenterCrmLeadInput): RegicenterCrmLeadPayload {
  const phone =
    text(input.phone) ?? text(input.flat.phone) ?? text(input.flat.whatsapp) ?? text(input.flat.telefone);
  const investmentRaw = text(input.flat.investment_status);
  const attr = input.attribution ?? {};
  return {
    id: input.id,
    name: text(input.name) ?? text(input.flat.name) ?? text(input.flat.nome) ?? "",
    phone,
    whatsapp: phone,
    email: text(input.email) ?? text(input.flat.email),
    city: text(input.flat.city),
    state: text(input.flat.state),
    investment: investmentRaw ? resolveChoice("investment_status", investmentRaw).label : null,
    origem: input.source,
    utm_source: text(attr.utm_source),
    utm_medium: text(attr.utm_medium),
    utm_campaign: text(attr.utm_campaign),
  };
}

export function regicenterLeadWebhookUrl(): string | null {
  const url = process.env.REGICENTER_LEAD_WEBHOOK_URL?.trim();
  return url || null;
}

type FetchImpl = (url: string, init: RequestInit) => Promise<Response>;

export async function postRegicenterCrmLead(
  input: RegicenterCrmLeadInput,
  deps?: { fetchImpl?: FetchImpl; url?: string | null },
): Promise<"sent" | "skipped" | "failed"> {
  if (!isFreshFranchiseLead(input)) return "skipped";
  const url = deps && "url" in deps ? deps.url : regicenterLeadWebhookUrl();
  if (!url) return "skipped";
  const payload = buildRegicenterCrmPayload(input);
  const fetchImpl = deps?.fetchImpl ?? fetch;
  try {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      console.warn("[regicenter-crm] webhook", res.status);
      return "failed";
    }
    return "sent";
  } catch (err) {
    console.warn("[regicenter-crm] webhook", err instanceof Error ? err.message : err);
    return "failed";
  }
}

/** Não espera a resposta: falha no CRM não derruba o cadastro. */
export function dispatchRegicenterCrmLead(input: RegicenterCrmLeadInput): void {
  void postRegicenterCrmLead(input);
}
