/**
 * Ciclo de vida da conta WhatsApp para os fluxos:
 * ao conectar → sync de templates + limite/qualidade + criação da biblioteca padrão;
 * de hora em hora → limite do portfólio, qualidade, status da MM API e templates (backup do webhook).
 */

import { prisma } from "@/lib/db";
import { refreshWaAccountInfo } from "@/lib/flows/wa-limits";
import { ensureDefaultWaTemplates, promoteApprovedVersion, syncWaTemplates } from "@/lib/flows/wa-templates";
import { metaGraphUrl } from "@/lib/integrations/meta/graph";
import { resolvePlatformApp } from "@/lib/config/platformApps";

export async function onWhatsAppConnected(workspaceId: string) {
  const out: Record<string, unknown> = {};
  out.account = await refreshWaAccountInfo(workspaceId).catch((e) => ({ error: String(e?.message ?? e) }));
  out.templates = await ensureDefaultWaTemplates(workspaceId).catch((e) => ({ error: String(e?.message ?? e) }));
  return out;
}

/** Sincroniza templates e promove versões aprovadas (caso o webhook tenha falhado). */
export async function syncAndPromote(workspaceId: string) {
  const r = await syncWaTemplates(workspaceId);
  const approved = await prisma.waTemplateRef.findMany({
    where: { clienteId: workspaceId, status: "APPROVED", purpose: { not: null }, replacedById: null },
    select: { id: true },
  });
  for (const t of approved) await promoteApprovedVersion(t.id);
  return r;
}

export async function refreshAllWaAccounts() {
  const rows = await prisma.workspaceConnection.findMany({
    where: { provider: "WHATSAPP", status: "ACTIVE" },
    select: { clienteId: true },
  });
  let ok = 0;
  let failed = 0;
  for (const r of rows) {
    try {
      await refreshWaAccountInfo(r.clienteId);
      await syncAndPromote(r.clienteId);
      ok++;
    } catch (err) {
      failed++;
      console.warn("[wa-sync]", r.clienteId, err instanceof Error ? err.message : err);
    }
  }
  return { workspaces: rows.length, ok, failed };
}

const REQUIRED_FIELDS = [
  "messages",
  "message_template_status_update",
  "message_template_quality_update",
  "template_category_update",
  "account_update",
  "phone_number_quality_update",
  "business_capability_update",
];

/** GET /{app-id}/subscriptions — confere se o app assina os campos que os fluxos usam. */
export async function checkWebhookSubscriptions() {
  const app = await resolvePlatformApp("META");
  const appId = typeof app?.credentials.clientId === "string" ? app.credentials.clientId : "";
  const secret = typeof app?.credentials.clientSecret === "string" ? app.credentials.clientSecret : "";
  if (!appId || !secret) return { ok: false, missing: REQUIRED_FIELDS, reason: "meta_app_not_configured" };
  try {
    const res = await fetch(metaGraphUrl(`/${appId}/subscriptions`), {
      headers: { Authorization: `Bearer ${appId}|${secret}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const d = (await res.json()) as { data?: Array<{ object?: string; active?: boolean; fields?: Array<{ name?: string }> }> };
    if (!res.ok) return { ok: false, missing: REQUIRED_FIELDS, reason: `http_${res.status}` };
    const waba = d.data?.find((s) => s.object === "whatsapp_business_account" && s.active !== false);
    const have = new Set((waba?.fields ?? []).map((f) => f.name));
    const missing = REQUIRED_FIELDS.filter((f) => !have.has(f));
    return { ok: missing.length === 0, missing };
  } catch (err) {
    return { ok: false, missing: REQUIRED_FIELDS, reason: err instanceof Error ? err.message : "error" };
  }
}
