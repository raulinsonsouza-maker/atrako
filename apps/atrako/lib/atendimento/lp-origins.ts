/**
 * Nomes amigáveis das LPs na área de atendimento (Origem dos leads).
 * Forms `-lp` do workspace entram automaticamente; aliases cobrem slugs legados.
 */

import { prisma } from "@/lib/db";

/** pageSlug / formSlug → rótulo curto no CRM. */
const LP_LABEL_ALIASES: Record<string, string> = {
  vilaris: "Institucional",
  "vilaris-lp": "Institucional",
  "vilaris-institucional": "Institucional",
  "vilaris-mentoria": "Institucional",
  "vilaris-consultoria": "Consultoria",
  "vilaris-consultoria-lp": "Consultoria",
};

export type LpOriginSeed = {
  /** Chave estável usada em NativeLead.source (`lp:pageSlug`). */
  key: string;
  label: string;
  formSlug: string;
};

function titleCaseSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** pageSlug a partir do slug do CaptureForm (`vilaris-consultoria-lp` → `vilaris-consultoria`). */
export function pageSlugFromFormSlug(formSlug: string) {
  return formSlug.replace(/-lp$/i, "").trim() || formSlug;
}

export function friendlyLpLabel(input: {
  source?: string | null;
  pageSlug?: string | null;
  formSlug?: string | null;
  formName?: string | null;
}) {
  const source = (input.source || "").trim();
  const fromSource = source.toLowerCase().startsWith("lp:") ? source.slice(3).trim() : "";
  const candidates = [
    input.pageSlug,
    input.formSlug,
    fromSource,
    input.formSlug ? pageSlugFromFormSlug(input.formSlug) : null,
  ]
    .map((v) => (typeof v === "string" ? v.trim().toLowerCase() : ""))
    .filter(Boolean);

  for (const c of candidates) {
    if (LP_LABEL_ALIASES[c]) return LP_LABEL_ALIASES[c];
  }

  const formName = (input.formName || "").trim();
  if (formName) {
    const cleaned = formName.replace(/^Vilaris\s*[—–-]\s*/i, "").trim();
    if (cleaned) return cleaned;
  }

  const slug = candidates[0];
  if (!slug) return null;
  const withoutBrand = slug.replace(/^vilaris-?/i, "").trim();
  return titleCaseSlug(withoutBrand || slug);
}

/** LPs publicadas do workspace → linhas zeradas na tabela de origens. */
export async function listWorkspaceLpOrigins(workspaceId: string): Promise<LpOriginSeed[]> {
  const forms = await prisma.captureForm.findMany({
    where: {
      clienteId: workspaceId,
      active: true,
      OR: [{ slug: { endsWith: "-lp" } }, { source: { equals: "lp", mode: "insensitive" } }],
    },
    select: { slug: true, name: true },
    orderBy: { createdAt: "asc" },
  });

  const out: LpOriginSeed[] = [];
  const seen = new Set<string>();
  for (const form of forms) {
    const pageSlug = pageSlugFromFormSlug(form.slug);
    const key = `lp:${pageSlug}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      key,
      formSlug: form.slug,
      label:
        friendlyLpLabel({ formSlug: form.slug, pageSlug, formName: form.name }) ||
        titleCaseSlug(pageSlug),
    });
  }
  return out;
}
