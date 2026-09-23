/**
 * Templates aprovados da WABA (Business Management API).
 */

import { waFetch, getWhatsAppCredsOrThrow } from "./client";

export type WaTemplateListItem = {
  name: string;
  language: string;
  status: string;
  category?: string;
};

export async function listWhatsAppTemplates(workspaceId: string): Promise<WaTemplateListItem[]> {
  const creds = await getWhatsAppCredsOrThrow(workspaceId);
  if (!creds.wabaId) return [];

  const res = await waFetch(
    workspaceId,
    `/${creds.wabaId}/message_templates?limit=100&fields=name,language,status,category`,
  );
  const data = (await res.json()) as {
    data?: Array<{
      name?: string;
      language?: string;
      status?: string;
      category?: string;
    }>;
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(data.error?.message || `Falha ao listar templates (${res.status})`);
  }

  return (data.data ?? [])
    .filter((t) => t.name && t.language)
    .map((t) => ({
      name: t.name!,
      language: t.language!,
      status: t.status || "UNKNOWN",
      category: t.category,
    }));
}
