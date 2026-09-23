import type { Prisma } from "@/lib/generated/prisma";
import { prisma } from "@/lib/db";

/**
 * Parses the raw dadosCv.tags value into a string array.
 * The CV CRM API historically stored tags as a string (comma-separated);
 * newer syncs store them as a proper string[]. Both must be handled.
 */
export function parseTagsField(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return (raw as unknown[]).map(String).filter(Boolean);
  if (typeof raw === "string") {
    return raw.split(/[,;|]/).map((t) => t.trim()).filter(Boolean);
  }
  return [];
}

/**
 * Returns the Prisma `WhereInput` fragment that restricts leads to those whose
 * `dadosCv.tags` contains at least one of the configured tags.
 *
 * Handles both storage formats:
 *   - array  (new syncs):  `["form_meta_arboreto_inout","lp_arboreto_inout"]`
 *   - string (legacy):     `"lp_arboreto_inout"` or `"arboreto_inout, lp_arboreto_inout"`
 *
 * Returns `{}` (no restriction) when no tag filter is configured.
 */
export function buildTagFilterWhere(tagFilter: string[]): Prisma.LeadCrmWhereInput {
  if (!tagFilter || tagFilter.length === 0) return {};
  return {
    OR: tagFilter.flatMap((tag) => [
      // Array format (new syncs after adapter fix)
      { dadosCv: { path: ["tags"], array_contains: tag } },
      // String format (legacy — exact single tag stored as JSON string)
      { dadosCv: { path: ["tags"], equals: tag } },
      // String format (legacy — comma-separated, tag appears somewhere in string)
      { dadosCv: { path: ["tags"], string_contains: tag } },
    ]),
  };
}

/**
 * Returns a Prisma `WhereInput` that restricts leads to those whose `dadosCv[field]`
 * matches one of the given values (case-insensitive exact match via OR).
 * Returns `{}` when values array is empty.
 */
export function buildJsonStringFilterWhere(
  field: string,
  values: string[],
): Prisma.LeadCrmWhereInput {
  if (!values || values.length === 0) return {};
  return {
    OR: values.map((v) => ({
      dadosCv: { path: [field], string_contains: v },
    })),
  };
}

export interface CrmFilters {
  tagFilter: string[];
  conversaoOriginalFilter: string[];
  conversaoUltimoFilter: string[];
  midiaFilter: string[];
  origemOriginalFilter: string[];
  origemUltimoFilter: string[];
}

function toStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[]).filter((t): t is string => typeof t === "string" && t.trim() !== "");
}

/**
 * Loads all configured CRM filters for a client from their CrmConfig credentials.
 * Returns empty arrays for each dimension when no config is set.
 */
export async function getCrmFilters(clienteId: string): Promise<CrmFilters> {
  const config = await prisma.crmConfig.findUnique({
    where: { clienteId },
    select: { credenciais: true, ativo: true },
  });
  if (!config || !config.ativo) {
    return { tagFilter: [], conversaoOriginalFilter: [], conversaoUltimoFilter: [], midiaFilter: [], origemOriginalFilter: [], origemUltimoFilter: [] };
  }
  const creds = config.credenciais as Record<string, unknown>;
  return {
    tagFilter: toStringArray(creds.tagFilter),
    conversaoOriginalFilter: toStringArray(creds.conversaoOriginalFilter),
    conversaoUltimoFilter: toStringArray(creds.conversaoUltimoFilter),
    midiaFilter: toStringArray(creds.midiaFilter),
    origemOriginalFilter: toStringArray(creds.origemOriginalFilter),
    origemUltimoFilter: toStringArray(creds.origemUltimoFilter),
  };
}

/**
 * Loads the tag filter for a client from their CrmConfig credentials.
 * Returns an empty array when no config or no tag filter is set.
 */
export async function getTagFilter(clienteId: string): Promise<string[]> {
  const filters = await getCrmFilters(clienteId);
  return filters.tagFilter;
}
