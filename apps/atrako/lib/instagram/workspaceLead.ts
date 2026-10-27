/**
 * Abre ou atualiza o lead do workspace a partir de um contato do Instagram.
 * O id do contato social fica em IgContato.campos.nativeContactId para o e-mail
 * e o telefone caírem na mesma pessoa.
 */

import { prisma as socialPrisma } from "@/lib/db-social";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
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
      select: { campos: true, nome: true, username: true },
    });
    campos = asRecord(contato?.campos);
    if (typeof campos.nativeContactId === "string") {
      nativeContactId = campos.nativeContactId;
    }
    input.nome = input.nome ?? contato?.nome;
    input.username = input.username ?? contato?.username;
  }

  const nome = (input.nome || input.username || "Instagram").trim();
  const { prisma } = await import("@/lib/db");
  if (nativeContactId && (input.email || input.phone)) {
    await prisma.nativeContact
      .update({
        where: { id: nativeContactId },
        data: {
          ...(input.email ? { email: input.email } : {}),
          ...(input.phone ? { phone: input.phone } : {}),
        },
      })
      .catch(() => null);
  }

  const { upsertLeadFromEvent } = await import("@/lib/atrako/lead-pipeline");
  const result = await upsertLeadFromEvent({
    workspaceId,
    eventName: "lead.created",
    source: "instagram",
    idempotencyKey: `ig-${input.igContatoId ?? input.email ?? input.username ?? nome}`,
    context: nativeContactId ? { contactId: nativeContactId } : {},
    payload: {
      nome,
      username: input.username ?? undefined,
      email: input.email ?? undefined,
      telefone: input.phone ?? undefined,
      fonte: "instagram",
      keyword: input.keyword ?? undefined,
      mediaId: input.mediaId ?? undefined,
      postUrl: input.postUrl ?? undefined,
      rewardUrl: input.rewardUrl ?? undefined,
      sourceDetail: input.sourceDetail ?? undefined,
    },
  });

  if (result?.contact?.id && input.igContatoId && result.contact.id !== nativeContactId) {
    await socialPrisma.igContato.update({
      where: { id: input.igContatoId },
      data: { campos: { ...campos, nativeContactId: result.contact.id } },
    });
  }

  return result;
}
