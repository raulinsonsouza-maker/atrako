import { prisma } from "@/lib/db";
import { fetchIgScopedUserFollowStatus } from "@/lib/instagram/messagingClient";

export async function enrichContatoProfile(
  contatoId: string,
  igsid: string,
  accessToken: string,
): Promise<void> {
  try {
    const profile = await fetchIgScopedUserFollowStatus({ igsid, accessToken });
    if (!profile) return;
    await prisma.igContato.update({
      where: { id: contatoId },
      data: {
        ...(profile.username ? { username: profile.username } : {}),
        ...(profile.name ? { nome: profile.name } : {}),
        ...(profile.profilePic
          ? { profilePictureUrl: profile.profilePic }
          : {}),
      },
    });
  } catch {
    // Perfil indisponível fora da janela de 24h ou sem permissão
  }
}

export async function ensureContatoSourceTag(
  contatoId: string,
  source: "dm" | "comentario" | "story" | "live",
): Promise<void> {
  const tag = `interacao:${source}`;
  const c = await prisma.igContato.findUnique({ where: { id: contatoId } });
  if (!c || c.tags.includes(tag)) return;
  await prisma.igContato.update({
    where: { id: contatoId },
    data: { tags: [...c.tags, tag] },
  });
}

export async function getOrCreateOpenConversa(
  organizationId: string,
  igAccountId: string,
  contatoId: string,
) {
  const open = await prisma.igConversa.findFirst({
    where: { contatoId, status: "OPEN" },
    orderBy: { updatedAt: "desc" },
  });
  if (open) return open;
  return prisma.igConversa.create({
    data: {
      organizationId,
      igAccountId,
      contatoId,
      status: "OPEN",
      lastMessageAt: new Date(),
    },
  });
}

export async function persistContatoMessage(params: {
  organizationId: string;
  igAccountId: string;
  contatoId: string;
  mid?: string;
  texto?: string;
  direction: "INBOUND" | "OUTBOUND";
  isEcho?: boolean;
  attachments?: object;
}): Promise<void> {
  if (params.mid) {
    const dup = await prisma.igMensagem.findUnique({ where: { mid: params.mid } });
    if (dup) return;
  }

  const conversa = await getOrCreateOpenConversa(
    params.organizationId,
    params.igAccountId,
    params.contatoId,
  );

  await prisma.igMensagem.create({
    data: {
      organizationId: params.organizationId,
      conversaId: conversa.id,
      direction: params.direction,
      mid: params.mid,
      texto: params.texto,
      attachments: params.attachments as object | undefined,
      isEcho: params.isEcho ?? params.direction === "OUTBOUND",
    },
  });

  await prisma.igConversa.update({
    where: { id: conversa.id },
    data: { lastMessageAt: new Date() },
  });
}

export async function persistCommentAsMessage(params: {
  organizationId: string;
  igAccountId: string;
  contatoId: string;
  commentText: string;
  commentId?: string;
  mediaId?: string;
  field: "comments" | "live_comments";
}): Promise<void> {
  const prefix = params.field === "live_comments" ? "Comentário ao vivo" : "Comentário";
  await persistContatoMessage({
    organizationId: params.organizationId,
    igAccountId: params.igAccountId,
    contatoId: params.contatoId,
    texto: `${prefix}: ${params.commentText}`,
    direction: "INBOUND",
    attachments: {
      type: "instagram_comment",
      commentId: params.commentId,
      mediaId: params.mediaId,
      field: params.field,
    },
  });
  await ensureContatoSourceTag(params.contatoId, params.field === "live_comments" ? "live" : "comentario");
}
