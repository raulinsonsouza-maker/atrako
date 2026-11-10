/**
 * Contatos Olist ERP (API v2 Token).
 */

import { olistV2Post, resolveOlistCredentials } from "./client";

export type OlistContact = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  cpfCnpj: string | null;
  raw: Record<string, unknown>;
};

type V2ListResponse = {
  retorno?: {
    status?: string;
    pagina?: string;
    numero_paginas?: string | number;
    contatos?: Array<{ contato?: Record<string, unknown> }>;
  };
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function normalizeContact(row: Record<string, unknown>): OlistContact {
  return {
    id: asString(row.id) ?? "",
    name: asString(row.nome),
    email: asString(row.email),
    phone: asString(row.celular) ?? asString(row.fone),
    cpfCnpj: asString(row.cpf_cnpj),
    raw: row,
  };
}

export async function listOlistContacts(
  workspaceId: string,
  options?: { maxPages?: number },
): Promise<{ contacts: OlistContact[]; pages: number }> {
  const resolved = await resolveOlistCredentials(workspaceId);
  if (!resolved) throw new Error("Olist ERP não conectado");
  if (resolved.apiVersion === "v3") {
    // Contatos v3 ficam para OAuth; no Token API usamos v2.
    return { contacts: [], pages: 0 };
  }

  const maxPages = Math.max(1, options?.maxPages ?? 5);
  const contacts: OlistContact[] = [];
  let pages = 0;
  let totalPages = 1;

  for (let pagina = 1; pagina <= maxPages && pagina <= totalPages; pagina++) {
    const json = await olistV2Post<V2ListResponse>(workspaceId, "contatos.pesquisa", {
      pagina,
      situacao: "B",
    });
    pages++;
    if ((json.retorno?.status ?? "").toUpperCase() !== "OK") break;
    totalPages = Math.max(1, Number(json.retorno?.numero_paginas ?? 1) || 1);
    const rows = Array.isArray(json.retorno?.contatos) ? json.retorno!.contatos! : [];
    if (!rows.length) break;
    for (const wrap of rows) {
      const contato = asRecord(wrap.contato) ?? asRecord(wrap);
      if (!contato || !asString(contato.id)) continue;
      contacts.push(normalizeContact(contato));
    }
  }

  return { contacts, pages };
}
