"use server";

import { db } from "@/lib/db";
import { assertTenantAccess } from "@/lib/dashboard-context";
import { z } from "zod";
import { CustomFieldType } from "@prisma/client";

const createSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.nativeEnum(CustomFieldType),
  required: z.boolean().default(false),
  options: z.string().optional(), // JSON array para SELECT/RADIO/CHECKBOX
  order: z.number().int().default(0),
});

const updateSchema = createSchema.partial();

export async function listCustomFields(tenantId: string) {
  await assertTenantAccess(tenantId);

  return db.customField.findMany({
    where: { tenantId },
    orderBy: { order: "asc" },
  });
}

export async function getCustomField(id: string, tenantId: string) {
  await assertTenantAccess(tenantId);

  return db.customField.findFirst({
    where: { id, tenantId },
  });
}

export async function createCustomField(tenantId: string, data: z.infer<typeof createSchema>) {
  await assertTenantAccess(tenantId);

  const d = createSchema.parse(data);
  
  // Validar options se for SELECT/RADIO/CHECKBOX
  if (["SELECT", "RADIO", "CHECKBOX"].includes(d.type) && d.options) {
    try {
      const parsed = JSON.parse(d.options);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error("Options deve ser um array não vazio");
      }
    } catch {
      throw new Error("Options deve ser um JSON array válido");
    }
  }

  return db.customField.create({
    data: {
      tenantId,
      name: d.name.trim(),
      type: d.type,
      required: d.required ?? false,
      options: d.options || null,
      order: d.order ?? 0,
    },
  });
}

export async function updateCustomField(id: string, tenantId: string, data: z.infer<typeof updateSchema>) {
  await assertTenantAccess(tenantId);

  const d = updateSchema.parse(data);
  const updateData: Record<string, unknown> = {};
  
  if (d.name !== undefined) updateData.name = d.name.trim();
  if (d.type !== undefined) {
    updateData.type = d.type;
    // Se mudou o tipo e não é SELECT/RADIO/CHECKBOX, limpar options
    if (!["SELECT", "RADIO", "CHECKBOX"].includes(d.type)) {
      updateData.options = null;
    }
  }
  if (d.required !== undefined) updateData.required = d.required;
  if (d.order !== undefined) updateData.order = d.order;
  
  if (d.options !== undefined) {
    if (d.options && ["SELECT", "RADIO", "CHECKBOX"].includes(d.type || "")) {
      try {
        const parsed = JSON.parse(d.options);
        if (!Array.isArray(parsed) || parsed.length === 0) {
          throw new Error("Options deve ser um array não vazio");
        }
        updateData.options = d.options;
      } catch {
        throw new Error("Options deve ser um JSON array válido");
      }
    } else {
      updateData.options = d.options || null;
    }
  }

  return db.customField.updateMany({
    where: { id, tenantId },
    data: updateData,
  });
}

export async function deleteCustomField(id: string, tenantId: string) {
  await assertTenantAccess(tenantId);

  await db.customField.deleteMany({
    where: { id, tenantId },
  });
}

export async function getLeadCustomFieldValues(leadId: string, tenantId: string) {
  await assertTenantAccess(tenantId);

  const values = await db.customFieldValue.findMany({
    where: { leadId, tenantId },
    include: {
      customField: true,
    },
  });

  return values;
}

export async function setLeadCustomFieldValue(
  leadId: string,
  customFieldId: string,
  value: string | null,
  tenantId: string
) {
  await assertTenantAccess(tenantId);

  // Verificar se o lead existe
  const lead = await db.lead.findFirst({
    where: { id: leadId, tenantId, deletedAt: null },
  });
  if (!lead) throw new Error("Lead não encontrado");

  // Verificar se o campo personalizado existe
  const customField = await db.customField.findFirst({
    where: { id: customFieldId, tenantId },
  });
  if (!customField) throw new Error("Campo personalizado não encontrado");

  // Validar valor obrigatório
  if (customField.required && (!value || value.trim() === "")) {
    throw new Error(`O campo "${customField.name}" é obrigatório`);
  }

  // Validar tipo
  if (value && value.trim() !== "") {
    switch (customField.type) {
      case "NUMBER":
        if (isNaN(Number(value))) {
          throw new Error(`O campo "${customField.name}" deve ser um número`);
        }
        break;
      case "EMAIL":
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          throw new Error(`O campo "${customField.name}" deve ser um e-mail válido`);
        }
        break;
      case "URL":
        try {
          new URL(value);
        } catch {
          throw new Error(`O campo "${customField.name}" deve ser uma URL válida`);
        }
        break;
      case "SELECT":
      case "RADIO":
        if (customField.options) {
          const options = JSON.parse(customField.options) as string[];
          if (!options.includes(value)) {
            throw new Error(`O campo "${customField.name}" deve ser uma das opções disponíveis`);
          }
        }
        break;
      case "CHECKBOX":
        if (customField.options) {
          const options = JSON.parse(customField.options) as string[];
          const values = value.split(",");
          if (!values.every((v) => options.includes(v))) {
            throw new Error(`O campo "${customField.name}" contém valores inválidos`);
          }
        }
        break;
    }
  }

  // Criar ou atualizar valor
  await db.customFieldValue.upsert({
    where: {
      leadId_customFieldId: {
        leadId,
        customFieldId,
      },
    },
    create: {
      tenantId,
      leadId,
      customFieldId,
      value: value?.trim() || null,
    },
    update: {
      value: value?.trim() || null,
    },
  });
}

export async function setLeadCustomFieldValues(
  leadId: string,
  values: Record<string, string | null>,
  tenantId: string
) {
  await assertTenantAccess(tenantId);

  // Verificar se o lead existe
  const lead = await db.lead.findFirst({
    where: { id: leadId, tenantId, deletedAt: null },
  });
  if (!lead) throw new Error("Lead não encontrado");

  // Buscar todos os campos personalizados do tenant
  const customFields = await db.customField.findMany({
    where: { tenantId },
  });

  // Validar e salvar cada valor
  for (const [customFieldId, value] of Object.entries(values)) {
    const customField = customFields.find((cf) => cf.id === customFieldId);
    if (!customField) continue;

    await setLeadCustomFieldValue(leadId, customFieldId, value, tenantId);
  }
}
