"use server";

import { db } from "@/lib/db";
import { assertTenantAccess } from "@/lib/dashboard-context";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor deve ser em formato hex (#RRGGBB)"),
});

const updateSchema = createSchema.partial();

export async function listTags(tenantId: string) {
  await assertTenantAccess(tenantId);

  return db.tag.findMany({
    where: { tenantId },
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { leads: true },
      },
    },
  });
}

export async function getTag(id: string, tenantId: string) {
  await assertTenantAccess(tenantId);

  return db.tag.findFirst({
    where: { id, tenantId },
  });
}

export async function createTag(tenantId: string, data: z.infer<typeof createSchema>) {
  await assertTenantAccess(tenantId);

  const d = createSchema.parse(data);
  return db.tag.create({
    data: {
      tenantId,
      name: d.name.trim(),
      color: d.color.toUpperCase(),
    },
  });
}

export async function updateTag(id: string, tenantId: string, data: z.infer<typeof updateSchema>) {
  await assertTenantAccess(tenantId);

  const d = updateSchema.parse(data);
  const updateData: Record<string, unknown> = {};
  if (d.name !== undefined) updateData.name = d.name.trim();
  if (d.color !== undefined) updateData.color = d.color.toUpperCase();

  return db.tag.updateMany({
    where: { id, tenantId },
    data: updateData,
  });
}

export async function deleteTag(id: string, tenantId: string) {
  await assertTenantAccess(tenantId);

  await db.tag.deleteMany({
    where: { id, tenantId },
  });
}

export async function getLeadTags(leadId: string, tenantId: string) {
  await assertTenantAccess(tenantId);

  const leadTags = await db.leadTag.findMany({
    where: { leadId, tenantId },
    include: {
      tag: true,
    },
  });

  return leadTags.map((lt) => lt.tag);
}

export async function addTagToLead(leadId: string, tagId: string, tenantId: string) {
  await assertTenantAccess(tenantId);

  // Verificar se o lead existe e pertence ao tenant
  const lead = await db.lead.findFirst({
    where: { id: leadId, tenantId, deletedAt: null },
  });
  if (!lead) throw new Error("Lead não encontrado");

  // Verificar se a tag existe e pertence ao tenant
  const tag = await db.tag.findFirst({
    where: { id: tagId, tenantId },
  });
  if (!tag) throw new Error("Tag não encontrada");

  // Criar relação se não existir
  await db.leadTag.upsert({
    where: {
      leadId_tagId: {
        leadId,
        tagId,
      },
    },
    create: {
      tenantId,
      leadId,
      tagId,
    },
    update: {},
  });
}

export async function removeTagFromLead(leadId: string, tagId: string, tenantId: string) {
  await assertTenantAccess(tenantId);

  await db.leadTag.deleteMany({
    where: { leadId, tagId, tenantId },
  });
}

export async function setLeadTags(leadId: string, tagIds: string[], tenantId: string) {
  await assertTenantAccess(tenantId);

  // Verificar se o lead existe
  const lead = await db.lead.findFirst({
    where: { id: leadId, tenantId, deletedAt: null },
  });
  if (!lead) throw new Error("Lead não encontrado");

  // Verificar se todas as tags existem e pertencem ao tenant
  if (tagIds.length > 0) {
    const tags = await db.tag.findMany({
      where: { id: { in: tagIds }, tenantId },
    });
    if (tags.length !== tagIds.length) {
      throw new Error("Uma ou mais tags não foram encontradas");
    }
  }

  // Remover todas as tags atuais
  await db.leadTag.deleteMany({
    where: { leadId, tenantId },
  });

  // Adicionar novas tags
  if (tagIds.length > 0) {
    await db.leadTag.createMany({
      data: tagIds.map((tagId) => ({
        tenantId,
        leadId,
        tagId,
      })),
    });
  }
}
