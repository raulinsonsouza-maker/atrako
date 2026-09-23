/**
 * CaptureForm — persistência de formulários do hub Criar.
 * Usa SQL bruto quando o client Prisma ainda não tem o model (generate EPERM).
 */

import { prisma } from "@/lib/db";
import { createFormFromBrief, type FormStep } from "@atrako/forms";
import { createNativeLead } from "@/lib/modules/crm";
import { publishFormCompletion } from "@atrako/forms";
import { slugify } from "@/lib/criar/slug";

export type CaptureFormRow = {
  id: string;
  clienteId: string;
  name: string;
  slug: string;
  status: string;
  steps: FormStep[];
  source: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function parseSteps(raw: unknown): FormStep[] {
  if (Array.isArray(raw)) return raw as FormStep[];
  if (typeof raw === "string") {
    try {
      const j = JSON.parse(raw);
      return Array.isArray(j) ? (j as FormStep[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function mapRow(r: Record<string, unknown>): CaptureFormRow {
  return {
    id: String(r.id),
    clienteId: String(r.clienteId),
    name: String(r.name),
    slug: String(r.slug),
    status: String(r.status),
    steps: parseSteps(r.steps),
    source: r.source != null ? String(r.source) : null,
    active: Boolean(r.active),
    createdAt: r.createdAt instanceof Date ? r.createdAt : new Date(String(r.createdAt)),
    updatedAt: r.updatedAt instanceof Date ? r.updatedAt : new Date(String(r.updatedAt)),
  };
}

export async function listCaptureForms(clienteId: string): Promise<CaptureFormRow[]> {
  const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
    SELECT id, "clienteId", name, slug, status, steps, source, active, "createdAt", "updatedAt"
    FROM "CaptureForm"
    WHERE "clienteId" = ${clienteId}
    ORDER BY "createdAt" DESC
    LIMIT 50
  `;
  return rows.map(mapRow);
}

export async function getCaptureFormBySlug(slug: string): Promise<CaptureFormRow | null> {
  const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
    SELECT id, "clienteId", name, slug, status, steps, source, active, "createdAt", "updatedAt"
    FROM "CaptureForm"
    WHERE slug = ${slug} AND active = true AND status = 'PUBLISHED'
    LIMIT 1
  `;
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function getCaptureFormById(
  clienteId: string,
  id: string,
): Promise<CaptureFormRow | null> {
  const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
    SELECT id, "clienteId", name, slug, status, steps, source, active, "createdAt", "updatedAt"
    FROM "CaptureForm"
    WHERE id = ${id} AND "clienteId" = ${clienteId}
    LIMIT 1
  `;
  return rows[0] ? mapRow(rows[0]) : null;
}

async function uniqueSlug(clienteId: string, desired: string): Promise<string> {
  let slug = slugify(desired, `form-${Date.now().toString(36)}`);
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? slug : `${slug}-${i + 1}`;
    const exists = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "CaptureForm" WHERE "clienteId" = ${clienteId} AND slug = ${candidate} LIMIT 1
    `;
    if (!exists.length) return candidate;
  }
  return `${slug}-${Date.now().toString(36)}`;
}

export async function createCaptureForm(input: {
  clienteId: string;
  name: string;
  slug?: string;
  steps: FormStep[];
  source?: string | null;
  status?: "DRAFT" | "PUBLISHED";
}): Promise<CaptureFormRow> {
  const id = `cfm_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const slug = await uniqueSlug(input.clienteId, input.slug || input.name);
  const status = input.status ?? "PUBLISHED";
  const source = input.source ?? "form";
  const stepsJson = JSON.stringify(input.steps);

  await prisma.$executeRawUnsafe(
    `INSERT INTO "CaptureForm" (id, "clienteId", name, slug, status, steps, source, active, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, true, NOW(), NOW())`,
    id,
    input.clienteId,
    input.name.slice(0, 200),
    slug,
    status,
    stepsJson,
    source,
  );

  const created = await getCaptureFormById(input.clienteId, id);
  if (!created) throw new Error("Falha ao criar formulário");
  return created;
}

export async function createCaptureFormFromBrief(input: {
  clienteId: string;
  brief: string;
  source?: string | null;
}): Promise<CaptureFormRow> {
  const draft = createFormFromBrief({
    workspaceId: input.clienteId,
    brief: input.brief,
  });
  return createCaptureForm({
    clienteId: input.clienteId,
    name: draft.name || input.brief.slice(0, 80),
    steps: draft.steps,
    source: input.source ?? "form",
    status: "PUBLISHED",
  });
}

export type LeadAttribution = {
  productId?: string;
  pageSlug?: string;
  pageUrl?: string;
  formId?: string;
  formSlug?: string;
  formName?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  gclid?: string;
  fbclid?: string;
  referrer?: string;
  [key: string]: unknown;
};

export async function completeCaptureForm(input: {
  slug: string;
  answers: Array<{ fieldId: string; value: string }>;
  attribution?: LeadAttribution | null;
}): Promise<{ leadId: string; formId: string }> {
  const form = await getCaptureFormBySlug(input.slug);
  if (!form) throw new Error("Formulário não encontrado");

  const flat: Record<string, string> = {};
  for (const a of input.answers) flat[a.fieldId] = a.value;

  const name = flat.name || flat.nome || "Lead formulário";
  const email = flat.email || undefined;
  const phone = flat.phone || flat.whatsapp || flat.telefone || undefined;

  const attr = input.attribution ?? {};
  const pageSlug =
    typeof attr.pageSlug === "string" && attr.pageSlug.trim()
      ? attr.pageSlug.trim()
      : undefined;
  const source = pageSlug
    ? `lp:${pageSlug}`
    : form.source || "form";

  const metadata: Record<string, unknown> = {
    channel: pageSlug ? "lp" : "form",
    convertedAt: new Date().toISOString(),
    ...attr,
    formId: form.id,
    formSlug: form.slug,
    formName: form.name,
  };

  const lead = await createNativeLead({
    clienteId: form.clienteId,
    name,
    email,
    phone,
    source,
    metadata,
  });

  await publishFormCompletion({
    workspaceId: form.clienteId,
    formId: form.id,
    leadId: lead.id,
    contactId: lead.contactId ?? undefined,
    answers: input.answers,
  });

  return { leadId: lead.id, formId: form.id };
}
