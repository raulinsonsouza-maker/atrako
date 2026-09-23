import { redirect } from "next/navigation";
import { getSession } from "@/lib/symbius/auth";
import { prisma } from "@/lib/db";
import { getActiveIgAccountId } from "@/lib/symbius/activeIgAccount";
import { ContactsClient } from "@/components/symbius/ContactsClient";
import { attachmentPreviewLabel } from "@/lib/instagram/messageAttachments";

export default async function ContactsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const activeIg = await getActiveIgAccountId(session.organizationId);

  const contatos = await prisma.igContato.findMany({
    where: {
      organizationId: session.organizationId,
      ...(activeIg ? { igAccountId: activeIg } : {}),
    },
    orderBy: { lastInteractionAt: "desc" },
    take: 100,
    include: {
      conversas: {
        orderBy: { lastMessageAt: "desc" },
        take: 1,
        select: {
          id: true,
          mensagens: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { texto: true, direction: true, attachments: true },
          },
        },
      },
    },
  });

  const rows = contatos.map((c) => {
    const conv = c.conversas[0];
    const lastMsg = conv?.mensagens[0];
    return {
      id: c.id,
      igsid: c.igsid,
      nome: c.nome,
      username: c.username,
      profilePictureUrl: c.profilePictureUrl,
      tags: c.tags,
      botPaused: c.botPaused,
      createdAt: c.createdAt.toISOString(),
      lastInteractionAt: c.lastInteractionAt
        ? c.lastInteractionAt.toISOString()
        : null,
      conversaId: conv?.id ?? null,
      lastMessage: attachmentPreviewLabel(
        lastMsg?.attachments,
        lastMsg?.texto,
      ),
      lastMessageDirection: lastMsg?.direction ?? null,
    };
  });

  return (
    <div className="symbius-light min-h-full bg-[#f4f5f7] p-6 text-zinc-900 md:p-10">
      <h1 className="text-2xl font-bold text-zinc-900">Contatos</h1>
      <p className="mt-1 text-zinc-500">
        Todas as pessoas que interagirem com suas automações são salvas
        automaticamente, com histórico de mensagens.
      </p>
      <div className="mt-8">
        <ContactsClient initialContacts={rows} />
      </div>
    </div>
  );
}
