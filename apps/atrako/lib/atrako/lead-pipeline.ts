import { prisma } from "@/lib/db";
import { upsertPersonAndLead } from "@/lib/atrako/person";

async function ensureAtrakoCrmConfig(clienteId: string) {
  const existing = await prisma.crmConfig.findUnique({ where: { clienteId } });
  if (existing) return existing;
  return prisma.crmConfig.create({
    data: {
      clienteId,
      tipo: "ATRAKO",
      dominio: null,
      credenciais: {},
      ativo: true,
    },
  });
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/** Normaliza payload de form.completed (answers[]) para campos planos. */
function flattenEventPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const answers = payload.answers;
  if (!Array.isArray(answers)) return payload;
  const flat: Record<string, unknown> = { ...payload };
  for (const raw of answers) {
    if (!raw || typeof raw !== "object") continue;
    const a = raw as Record<string, unknown>;
    const fieldId = typeof a.fieldId === "string" ? a.fieldId : null;
    const value = typeof a.value === "string" ? a.value : null;
    if (fieldId && value != null) flat[fieldId] = value;
  }
  if (!flat.nome && flat.name) flat.nome = flat.name;
  if (!flat.telefone && flat.phone) flat.telefone = flat.phone;
  if (!flat.telefone && flat.whatsapp) flat.telefone = flat.whatsapp;
  return flat;
}

/** Upsert LeadCrm + Person hub a partir de eventos de conversão. */
export async function upsertLeadFromEvent(input: {
  workspaceId: string;
  eventName: string;
  source: string;
  idempotencyKey: string;
  context: Record<string, unknown>;
  payload: Record<string, unknown>;
}) {
  const config = await ensureAtrakoCrmConfig(input.workspaceId);
  const payload = flattenEventPayload(input.payload);
  const nome = pickString(payload, ["nome", "name", "fullName", "contactName"]);
  const email = pickString(payload, ["email"]);
  const telefone = pickString(payload, ["telefone", "phone", "whatsapp"]);
  const fonte =
    pickString(payload, ["fonte", "source", "origin"]) ||
    input.source ||
    input.eventName;
  const etapa = pickString(payload, ["etapa", "stage"]) || "Novo";
  const valorRaw = payload.valor ?? payload.value ?? payload.amount;
  const valor =
    typeof valorRaw === "number"
      ? valorRaw
      : typeof valorRaw === "string" && valorRaw.trim()
        ? Number(valorRaw)
        : null;

  const { contact, lead } = await upsertPersonAndLead({
    workspaceId: input.workspaceId,
    name: nome,
    email,
    phone: telefone,
    source: fonte,
    metadata: {
      eventName: input.eventName,
      lastEvent: input.eventName,
      utmSource: pickString(payload, ["utmSource", "utm_source"]),
      utmMedium: pickString(payload, ["utmMedium", "utm_medium"]),
      utmCampaign: pickString(payload, ["utmCampaign", "utm_campaign"]),
    },
  });

  // Chave estável por pessoa — recompra e multi-touch no mesmo LeadCrm
  const crmLeadId = `atrako:contact:${contact.id}`.slice(0, 190);

  const leadCrm = await prisma.leadCrm.upsert({
    where: {
      clienteId_crmLeadId: {
        clienteId: input.workspaceId,
        crmLeadId,
      },
    },
    create: {
      clienteId: input.workspaceId,
      crmConfigId: config.id,
      crmLeadId,
      etapa,
      nome: contact.name,
      email: contact.email,
      telefone: contact.phone,
      fonte,
      status: "OPEN",
      dataEntrada: new Date(),
      valor: valor != null && !Number.isNaN(valor) ? valor : null,
      dadosMarketing: {
        eventName: input.eventName,
        source: input.source,
        nativeContactId: contact.id,
        nativeLeadId: lead.id,
        payload: input.payload,
        context: input.context,
      },
    },
    update: {
      nome: contact.name,
      email: contact.email ?? undefined,
      telefone: contact.phone ?? undefined,
      fonte: fonte ?? undefined,
      etapa: etapa ?? undefined,
      valor: valor != null && !Number.isNaN(valor) ? valor : undefined,
      dadosMarketing: {
        eventName: input.eventName,
        source: input.source,
        nativeContactId: contact.id,
        nativeLeadId: lead.id,
        payload: input.payload,
        context: input.context,
        updatedAt: new Date().toISOString(),
      },
    },
  });

  return { leadCrm, contact, lead };
}
