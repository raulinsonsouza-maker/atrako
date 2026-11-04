/**
 * Garante o CaptureForm da LP Vilaris no workspace.
 */

import { prisma } from "@/lib/db";
import { stripConsentFromSteps } from "@/lib/criar/form-test";
import { createCaptureForm, getCaptureFormBySlug } from "@/lib/modules/capture-form";
import { VILARIS_LP_FORM } from "./forms";

export async function ensureVilarisLpForm(clienteId: string) {
  const steps = stripConsentFromSteps(VILARIS_LP_FORM.steps);
  const existing = await getCaptureFormBySlug(VILARIS_LP_FORM.slug);
  if (existing) {
    if (existing.clienteId !== clienteId) {
      throw new Error(`Slug ${VILARIS_LP_FORM.slug} já existe em outro workspace`);
    }
    await prisma.$executeRaw`
      UPDATE "CaptureForm"
      SET name = ${VILARIS_LP_FORM.name}, steps = ${JSON.stringify(steps)}::jsonb,
          source = ${VILARIS_LP_FORM.source}, status = 'PUBLISHED', active = true, "updatedAt" = NOW()
      WHERE id = ${existing.id}
    `;
    return { id: existing.id, slug: VILARIS_LP_FORM.slug, created: false as const };
  }
  const created = await createCaptureForm({
    clienteId,
    name: VILARIS_LP_FORM.name,
    slug: VILARIS_LP_FORM.slug,
    steps,
    source: VILARIS_LP_FORM.source,
    status: "PUBLISHED",
  });
  return { id: created.id, slug: created.slug, created: true as const };
}
