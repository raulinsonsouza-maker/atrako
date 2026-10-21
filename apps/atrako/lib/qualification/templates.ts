/**
 * Blocos do roteiro que viram modelo da Meta (fora da janela de 24h).
 * Editar o texto gera nova versão; a anterior segue valendo até a aprovação.
 */

import { prisma } from "@/lib/db";
import { createTemplateVersion, ensureDefaultWaTemplates } from "@/lib/flows/wa-templates";
import { resolveWhatsApp } from "@/lib/config/resolveConnection";
import { followUpOf, templateBody, type QualifyScript, type ScriptBlockId } from "./script";

export const SCRIPT_TEMPLATE_BLOCKS = {
  opening: "qualify_open",
  "followUp:nudge": "qualify_nudge",
} as const satisfies Partial<Record<ScriptBlockId, string>>;

export type TemplateBlock = keyof typeof SCRIPT_TEMPLATE_BLOCKS;
export const QUALIFY_TEMPLATES = Object.values(SCRIPT_TEMPLATE_BLOCKS) as string[];

export type TemplateState = "missing" | "approved" | "pending" | "updating" | "rejected";

export function isTemplateBlock(block: string): block is TemplateBlock {
  return block in SCRIPT_TEMPLATE_BLOCKS;
}

export function templateTextOf(script: QualifyScript, block: TemplateBlock) {
  return block === "opening" ? script.opening.text : followUpOf(script, "nudge").text;
}

/** Corpo dos modelos a partir do roteiro (para criar já com o texto do operador). */
export function scriptTemplateBodies(script: QualifyScript): Record<string, string> {
  return Object.fromEntries(
    (Object.keys(SCRIPT_TEMPLATE_BLOCKS) as TemplateBlock[]).map((block) => [
      SCRIPT_TEMPLATE_BLOCKS[block],
      templateBody(templateTextOf(script, block)),
    ]),
  );
}

function bodyOfComponents(components: unknown): string | null {
  if (!Array.isArray(components)) return null;
  const body = components.find((c) => c && typeof c === "object" && (c as { type?: string }).type === "BODY") as
    | { text?: string }
    | undefined;
  return body?.text ?? null;
}

async function templateRows(workspaceId: string) {
  return prisma.waTemplateRef.findMany({
    where: { clienteId: workspaceId, purpose: { in: QUALIFY_TEMPLATES }, status: { notIn: ["DELETED", "PENDING_DELETION"] } },
    select: { id: true, purpose: true, status: true, version: true, components: true },
    orderBy: { version: "desc" },
  });
}

/** Situação do modelo de cada bloco: aprovado, em análise, nova versão em análise, reprovado ou ainda não criado. */
export async function scriptTemplateStates(workspaceId: string): Promise<Record<TemplateBlock, TemplateState>> {
  const rows = await templateRows(workspaceId);
  const out = {} as Record<TemplateBlock, TemplateState>;
  for (const block of Object.keys(SCRIPT_TEMPLATE_BLOCKS) as TemplateBlock[]) {
    const list = rows.filter((r) => r.purpose === SCRIPT_TEMPLATE_BLOCKS[block]);
    const latest = list[0];
    const approved = list.some((r) => r.status === "APPROVED");
    if (!latest) out[block] = "missing";
    else if (latest.status === "APPROVED") out[block] = "approved";
    else if (latest.status === "REJECTED") out[block] = "rejected";
    else out[block] = approved ? "updating" : "pending";
  }
  return out;
}

/** Depois de salvar o texto: cria o modelo (se ainda não existe) ou uma nova versão quando o texto mudou. */
export async function syncScriptTemplate(workspaceId: string, block: TemplateBlock, script: QualifyScript) {
  if (!(await resolveWhatsApp(workspaceId))) return { synced: false as const, reason: "whatsapp_not_connected" };
  const purpose = SCRIPT_TEMPLATE_BLOCKS[block];
  const body = templateBody(templateTextOf(script, block));
  const rows = (await templateRows(workspaceId)).filter((r) => r.purpose === purpose);
  const latest = rows[0];
  if (!latest) {
    await ensureDefaultWaTemplates(workspaceId, undefined, [purpose], { [purpose]: body });
    return { synced: true as const };
  }
  if (bodyOfComponents(latest.components) === body) return { synced: false as const, reason: "unchanged" };
  await createTemplateVersion(workspaceId, latest.id, { body });
  return { synced: true as const };
}
