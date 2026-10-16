/**
 * Garante CaptureForms LP + typeform Regicenter no workspace.
 */

import { prisma } from "@/lib/db";
import { createCaptureForm, getCaptureFormBySlug } from "@/lib/modules/capture-form";
import { REGICENTER_LP_FORM, REGICENTER_QUALIFY_FORM } from "./forms";

async function upsertForm(
  clienteId: string,
  spec: { name: string; slug: string; source: string; steps: unknown },
) {
  const existing = await getCaptureFormBySlug(spec.slug);
  if (existing) {
    if (existing.clienteId !== clienteId) {
      throw new Error(`Slug ${spec.slug} já existe em outro workspace`);
    }
    await prisma.$executeRaw`
      UPDATE "CaptureForm"
      SET name = ${spec.name}, steps = ${JSON.stringify(spec.steps)}::jsonb,
          source = ${spec.source}, status = 'PUBLISHED', active = true, "updatedAt" = NOW()
      WHERE id = ${existing.id}
    `;
    return { id: existing.id, slug: spec.slug, created: false as const };
  }
  const created = await createCaptureForm({
    clienteId,
    name: spec.name,
    slug: spec.slug,
    steps: spec.steps as Parameters<typeof createCaptureForm>[0]["steps"],
    source: spec.source,
    status: "PUBLISHED",
  });
  return { id: created.id, slug: created.slug, created: true as const };
}

export async function ensureRegicenterQualifyForms(clienteId: string) {
  const lp = await upsertForm(clienteId, REGICENTER_LP_FORM);
  const qualify = await upsertForm(clienteId, REGICENTER_QUALIFY_FORM);
  return { lp, qualify };
}
