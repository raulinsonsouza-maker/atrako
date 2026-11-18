/**
 * Garante os CaptureForms das LPs Vilaris no workspace.
 */

import { prisma } from "@/lib/db";
import { stripConsentFromSteps } from "@/lib/criar/form-test";
import { createCaptureForm, getCaptureFormBySlug } from "@/lib/modules/capture-form";
import { VILARIS_CONSULTORIA_LP_FORM, VILARIS_LP_FORM } from "./forms";

async function ensureForm(
  clienteId: string,
  spec: typeof VILARIS_LP_FORM | typeof VILARIS_CONSULTORIA_LP_FORM,
) {
  const steps = stripConsentFromSteps(spec.steps);
  const existing = await getCaptureFormBySlug(spec.slug);
  if (existing) {
    if (existing.clienteId !== clienteId) {
      throw new Error(`Slug ${spec.slug} já existe em outro workspace`);
    }
    await prisma.$executeRaw`
      UPDATE "CaptureForm"
      SET name = ${spec.name}, steps = ${JSON.stringify(steps)}::jsonb,
          source = ${spec.source}, status = 'PUBLISHED', active = true, "updatedAt" = NOW()
      WHERE id = ${existing.id}
    `;
    return { id: existing.id, slug: spec.slug, created: false as const };
  }
  const created = await createCaptureForm({
    clienteId,
    name: spec.name,
    slug: spec.slug,
    steps,
    source: spec.source,
    status: "PUBLISHED",
  });
  return { id: created.id, slug: created.slug, created: true as const };
}

export async function ensureVilarisLpForm(clienteId: string) {
  return ensureForm(clienteId, VILARIS_LP_FORM);
}

export async function ensureVilarisConsultoriaLpForm(clienteId: string) {
  return ensureForm(clienteId, VILARIS_CONSULTORIA_LP_FORM);
}

/** Mentoria + consultoria. */
export async function ensureVilarisForms(clienteId: string) {
  const mentoria = await ensureVilarisLpForm(clienteId);
  const consultoria = await ensureVilarisConsultoriaLpForm(clienteId);
  return { mentoria, consultoria };
}
