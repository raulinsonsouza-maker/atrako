/**
 * Abre ou atualiza o lead do workspace a partir de um contato do Instagram.
 * O id do contato social fica em IgContato.campos.nativeContactId e em
 * NativeContact.metadata.igContatoId, para e-mail e telefone caírem na mesma pessoa.
 */

import { prisma as socialPrisma } from "@/lib/db-social";
import { normalizePersonEmail, normalizePersonPhone, toPhoneE164 } from "@/lib/atrako/person";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function findWorkspaceContact(workspaceId: string, igContatoId: string, nativeContactId?: string) {
  const { prisma } = await import("@/lib/db");
  if (nativeContactId) {
    const byId = await prisma.nativeContact.findFirst({
      where: { id: nativeContactId, clienteId: workspaceId },
    });
    if (byId) return byId;
  }
  return prisma.nativeContact.findFirst({
    where: {
      clienteId: workspaceId,
      metadata: { path: ["igContatoId"], equals: igContatoId },
    },
  });
}

export async function openInstagramWorkspaceLead(input: {
  organizationId: string;
  igContatoId?: string;
  nome?: string | null;
  username?: string | null;
  email?: string | null;
  phone?: string | null;
  keyword?: string | null;
  mediaId?: string | null;
  postUrl?: string | null;
  rewardUrl?: string | null;
  sourceDetail?: string | null;
}) {
  const org = await socialPrisma.organization.findUnique({
    where: { id: input.organizationId },
    select: { centralClienteId: true },
  });
  const workspaceId = org?.centralClienteId?.trim();
  if (!workspaceId) return null;

  let campos: Record<string, unknown> = {};
  let nativeContactId: string | undefined;
  if (input.igContatoId) {
    const contato = await socialPrisma.igContato.findUnique({
      where: { id: input.igContatoId },
      select: { campos: true, nome: true, username: true, phone: true, tags: true },
    });
    campos = asRecord(contato?.campos);
    if (typeof campos.nativeContactId === "string") {
      nativeContactId = campos.nativeContactId;
    }
    input.nome = input.nome ?? contato?.nome;
    input.username = input.username ?? contato?.username;
    input.phone = input.phone ?? contato?.phone;
    if (!input.email) {
      const tag = contato?.tags.find((t) => t.startsWith("email:"));
      if (tag) input.email = tag.slice("email:".length);
    }
  }

  const nome = (input.nome || input.username || "Instagram").trim();
  const email = normalizePersonEmail(input.email);
  const phone = normalizePersonPhone(input.phone);
  const { prisma } = await import("@/lib/db");
  const known = input.igContatoId
    ? await findWorkspaceContact(workspaceId, input.igContatoId, nativeContactId)
    : null;

  if (known) {
    const generic = !known.name || known.name === "Contato" || known.name === "Instagram";
    const better = (input.nome || input.username || "").trim();
    if (email || phone || (generic && better && better !== "Instagram")) {
      await prisma.nativeContact.update({
        where: { id: known.id },
        data: {
          ...(email ? { email } : {}),
          ...(phone ? { phone, phoneE164: toPhoneE164(phone) } : {}),
          ...(generic && better && better !== "Instagram" ? { name: better.slice(0, 200) } : {}),
        },
      });
    }
  }

  const { upsertLeadFromEvent } = await import("@/lib/atrako/lead-pipeline");
  const result = await upsertLeadFromEvent({
    workspaceId,
    eventName: "lead.created",
    source: "instagram",
    idempotencyKey: `ig-${input.igContatoId ?? email ?? input.username ?? nome}`,
    context: known ? { contactId: known.id } : {},
    payload: {
      nome,
      username: input.username ?? undefined,
      email: email ?? undefined,
      telefone: phone ?? undefined,
      fonte: "instagram",
      keyword: input.keyword ?? undefined,
      mediaId: input.mediaId ?? undefined,
      postUrl: input.postUrl ?? undefined,
      rewardUrl: input.rewardUrl ?? undefined,
      sourceDetail: input.sourceDetail ?? undefined,
    },
  });

  if (result?.contact?.id && input.igContatoId) {
    const meta = asRecord(result.contact.metadata);
    if (meta.igContatoId !== input.igContatoId) {
      await prisma.nativeContact.update({
        where: { id: result.contact.id },
        data: {
          metadata: {
            ...meta,
            igContatoId: input.igContatoId,
            source: meta.source ?? "instagram",
          },
        },
      });
    }
    if (result.contact.id !== nativeContactId) {
      await socialPrisma.igContato.update({
        where: { id: input.igContatoId },
        data: { campos: { ...campos, nativeContactId: result.contact.id } },
      });
    }
  }

  return result;
}

/** Dispara o lead sem segurar o webhook da automação. */
export function queueInstagramWorkspaceLead(
  organizationId: string,
  igContatoId: string,
  sourceDetail?: string,
) {
  void openInstagramWorkspaceLead({ organizationId, igContatoId, sourceDetail }).catch((err) =>
    console.warn("[ig-lead]", err instanceof Error ? err.message : err),
  );
}

/** Quem já entrou numa automação passa a ter um card no funil, sem duplicar o contato. */
export async function backfillInstagramAutomationLeads(workspaceId: string) {
  const org = await socialPrisma.organization.findFirst({
    where: { centralClienteId: workspaceId },
    select: { id: true },
  });
  if (!org) return { workspaceId, contacts: 0, opened: 0, reason: "sem organizacao" };

  const execs = await socialPrisma.igFluxoExecucao.findMany({
    where: { organizationId: org.id },
    select: { contatoId: true },
    distinct: ["contatoId"],
  });

  let opened = 0;
  for (const row of execs) {
    const result = await openInstagramWorkspaceLead({
      organizationId: org.id,
      igContatoId: row.contatoId,
      sourceDetail: "automation",
    });
    if (result) opened += 1;
  }
  return { workspaceId, contacts: execs.length, opened };
}
