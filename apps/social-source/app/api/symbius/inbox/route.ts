import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/symbius/auth";
import { getActiveIgAccountId } from "@/lib/symbius/activeIgAccount";
import {
  isWithin24hWindow,
  sendInstagramMediaMessage,
  sendInstagramMessage,
} from "@/lib/instagram/messagingClient";
import { attachmentPreviewLabel } from "@/lib/instagram/messageAttachments";
import { isConversaUnread } from "@/lib/symbius/inboxUnread";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status");
  const unreadOnly = searchParams.get("unread") === "1";
  const tag = searchParams.get("tag");
  const assignedUserId = searchParams.get("assignedUserId");
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();
  const activeIg = await getActiveIgAccountId(session.organizationId);

  const conversas = await prisma.igConversa.findMany({
    where: {
      organizationId: session.organizationId,
      ...(activeIg ? { igAccountId: activeIg } : {}),
      ...(status && status !== "all" ? { status } : {}),
      ...(assignedUserId ? { assignedUserId } : {}),
      ...(tag ? { contato: { tags: { has: tag } } } : {}),
    },
    orderBy: { lastMessageAt: "desc" },
    take: 150,
    include: {
      contato: true,
      mensagens: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  let mapped = conversas.map((c) => {
    const last = c.mensagens[0];
    const unread = isConversaUnread({
      lastMessageDirection: last?.direction,
      lastMessageAt: c.lastMessageAt ?? last?.createdAt,
      lastReadAt: c.lastReadAt,
    });
    return {
      id: c.id,
      status: c.status,
      handoffHuman: c.handoffHuman,
      assignedUserId: c.assignedUserId,
      unread,
      contato: {
        id: c.contato.id,
        nome: c.contato.nome,
        username: c.contato.username,
        profilePictureUrl: c.contato.profilePictureUrl,
        igsid: c.contato.igsid,
        tags: c.contato.tags,
        botPaused: c.contato.botPaused,
        lastInteractionAt: c.contato.lastInteractionAt,
      },
      lastMessage: attachmentPreviewLabel(last?.attachments, last?.texto),
      lastDirection: last?.direction ?? null,
      lastMessageAt: c.lastMessageAt,
    };
  });

  // Contagens sobre a lista completa (antes do filtro unread/q)
  const countsBase = conversas.map((c) => {
    const last = c.mensagens[0];
    return {
      status: c.status,
      handoffHuman: c.handoffHuman,
      unread: isConversaUnread({
        lastMessageDirection: last?.direction,
        lastMessageAt: c.lastMessageAt ?? last?.createdAt,
        lastReadAt: c.lastReadAt,
      }),
    };
  });

  if (unreadOnly) {
    mapped = mapped.filter((c) => c.unread);
  }
  if (q) {
    mapped = mapped.filter((c) => {
      const hay = [
        c.contato.username,
        c.contato.nome,
        c.lastMessage,
        ...c.contato.tags,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  return NextResponse.json({
    conversas: mapped,
    counts: {
      all: conversas.length,
      open: countsBase.filter((c) => c.status === "OPEN").length,
      unread: countsBase.filter((c) => c.unread).length,
      handoff: countsBase.filter((c) => c.handoffHuman).length,
    },
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = (await request.json()) as {
    conversaId: string;
    text?: string;
    scheduledAt?: string;
    attachment?: {
      type: "image" | "video" | "audio" | "file";
      url: string;
    };
  };

  const text = (body.text ?? "").trim();
  const attachment = body.attachment;

  if (!text && !attachment?.url) {
    return NextResponse.json(
      { error: "Informe texto ou anexo" },
      { status: 400 },
    );
  }

  if (body.scheduledAt) {
    if (!text) {
      return NextResponse.json(
        { error: "Agendamento só disponível para texto" },
        { status: 400 },
      );
    }
    const scheduled = await prisma.igScheduledMessage.create({
      data: {
        organizationId: session.organizationId,
        conversaId: body.conversaId,
        texto: text,
        scheduledAt: new Date(body.scheduledAt),
        sentByUserId: session.userId,
      },
    });
    return NextResponse.json({ scheduled });
  }

  const conversa = await prisma.igConversa.findFirst({
    where: {
      id: body.conversaId,
      organizationId: session.organizationId,
    },
    include: {
      contato: { include: { igAccount: true } },
    },
  });

  if (!conversa) {
    return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
  }

  const within24h = isWithin24hWindow(conversa.contato.lastInteractionAt);
  const tag = within24h ? undefined : ("HUMAN_AGENT" as const);

  if (!within24h && session.role === "AGENT") {
    return NextResponse.json(
      { error: "Janela de 24h expirada — apenas humanos podem responder" },
      { status: 403 },
    );
  }

  let mid: string | undefined;
  let storedText: string | null = text || null;
  let storedAttachments: object | undefined;

  if (attachment?.url) {
    const sent = await sendInstagramMediaMessage({
      igUserId: conversa.contato.igAccount.igUserId,
      accessToken: conversa.contato.igAccount.accessToken,
      recipientIgsid: conversa.contato.igsid,
      mediaType: attachment.type,
      mediaUrl: attachment.url,
      text: text || undefined,
      tag,
    });
    mid = sent.message_id;
    storedAttachments = {
      attachments: [
        {
          type: attachment.type,
          payload: { url: attachment.url },
        },
      ],
    };
  } else {
    const sent = await sendInstagramMessage({
      igUserId: conversa.contato.igAccount.igUserId,
      accessToken: conversa.contato.igAccount.accessToken,
      recipientIgsid: conversa.contato.igsid,
      text,
      tag,
    });
    mid = sent.message_id;
  }

  const msg = await prisma.igMensagem.create({
    data: {
      organizationId: session.organizationId,
      conversaId: conversa.id,
      direction: "OUTBOUND",
      mid,
      texto: storedText,
      attachments: storedAttachments,
      isEcho: false,
      sentByUserId: session.userId,
      tag: tag ?? null,
    },
  });

  await prisma.igConversa.update({
    where: { id: conversa.id },
    data: {
      lastMessageAt: new Date(),
      lastReadAt: new Date(),
      status: "OPEN",
      handoffHuman: true,
    },
  });

  // Pausar bot ao responder humano (promessa das Settings)
  await prisma.igContato.update({
    where: { id: conversa.contatoId },
    data: { botPaused: true },
  });

  return NextResponse.json({ message: msg });
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = (await request.json()) as {
    conversaId: string;
    status?: string;
    handoffHuman?: boolean;
    botPaused?: boolean;
    assignedUserId?: string | null;
    fluxoId?: string;
  };

  const conversa = await prisma.igConversa.findFirst({
    where: {
      id: body.conversaId,
      organizationId: session.organizationId,
    },
  });
  if (!conversa) {
    return NextResponse.json({ error: "Não encontrada" }, { status: 404 });
  }

  await prisma.igConversa.update({
    where: { id: conversa.id },
    data: {
      status: body.status,
      handoffHuman: body.handoffHuman,
      assignedUserId: body.assignedUserId,
    },
  });

  if (typeof body.botPaused === "boolean") {
    await prisma.igContato.update({
      where: { id: conversa.contatoId },
      data: { botPaused: body.botPaused },
    });
  }

  if (body.fluxoId) {
    const { triggerManualFluxo } = await import("@/lib/symbius/manualFluxo");
    await triggerManualFluxo({
      organizationId: session.organizationId,
      fluxoId: body.fluxoId,
      contatoId: conversa.contatoId,
      context: { manual: true, fromInbox: true },
    });
  }

  return NextResponse.json({ ok: true });
}
