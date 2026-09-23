import { prisma } from "@/lib/db";
import {
  isWithin24hWindow,
  sendInstagramMessage,
} from "@/lib/instagram/messagingClient";

export async function processScheduledInboxMessages(): Promise<number> {
  const due = await prisma.igScheduledMessage.findMany({
    where: {
      sentAt: null,
      scheduledAt: { lte: new Date() },
    },
    take: 50,
    orderBy: { scheduledAt: "asc" },
  });

  for (const item of due) {
    try {
      const conversa = await prisma.igConversa.findFirst({
        where: { id: item.conversaId, organizationId: item.organizationId },
        include: {
          contato: { include: { igAccount: true } },
        },
      });
      if (!conversa) {
        await prisma.igScheduledMessage.update({
          where: { id: item.id },
          data: { sentAt: new Date(), error: "Conversa não encontrada" },
        });
        continue;
      }

      const within24h = isWithin24hWindow(conversa.contato.lastInteractionAt);
      const tag = within24h ? undefined : ("HUMAN_AGENT" as const);

      const sent = await sendInstagramMessage({
        igUserId: conversa.contato.igAccount.igUserId,
        accessToken: conversa.contato.igAccount.accessToken,
        recipientIgsid: conversa.contato.igsid,
        text: item.texto,
        tag,
      });

      await prisma.igMensagem.create({
        data: {
          organizationId: item.organizationId,
          conversaId: conversa.id,
          direction: "OUTBOUND",
          mid: sent.message_id,
          texto: item.texto,
          isEcho: false,
          sentByUserId: item.sentByUserId,
          tag: tag ?? null,
        },
      });

      await prisma.igConversa.update({
        where: { id: conversa.id },
        data: { lastMessageAt: new Date() },
      });

      await prisma.igScheduledMessage.update({
        where: { id: item.id },
        data: { sentAt: new Date() },
      });
    } catch (e) {
      await prisma.igScheduledMessage.update({
        where: { id: item.id },
        data: {
          sentAt: new Date(),
          error: e instanceof Error ? e.message : "Erro ao enviar",
        },
      });
    }
  }

  return due.length;
}
