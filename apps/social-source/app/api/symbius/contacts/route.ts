import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isSession, requireApiSession } from "@/lib/symbius/apiHelpers";
import { getActiveIgAccountId } from "@/lib/symbius/activeIgAccount";
import { attachmentPreviewLabel } from "@/lib/instagram/messageAttachments";

export async function GET(request: NextRequest) {
  const session = await requireApiSession();
  if (!isSession(session)) return session;

  const { searchParams } = request.nextUrl;
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();
  const tag = searchParams.get("tag");
  const segmentoId = searchParams.get("segmentoId");
  const activeIg = await getActiveIgAccountId(session.organizationId);

  let where: Record<string, unknown> = {
    organizationId: session.organizationId,
    ...(activeIg ? { igAccountId: activeIg } : {}),
  };

  if (tag) {
    where = { ...where, tags: { has: tag } };
  }

  if (segmentoId) {
    const seg = await prisma.igSegmento.findFirst({
      where: { id: segmentoId, organizationId: session.organizationId },
    });
    if (seg) {
      const filters = seg.filters as Record<string, unknown>;
      if (filters.tag) where = { ...where, tags: { has: String(filters.tag) } };
      if (filters.botPaused != null) {
        where = { ...where, botPaused: Boolean(filters.botPaused) };
      }
    }
  }

  const contatos = await prisma.igContato.findMany({
    where,
    orderBy: { lastInteractionAt: "desc" },
    take: 500,
    include: {
      trackingIdentity: { select: { stId: true } },
      execucoes: {
        where: { status: { in: ["RUNNING", "WAITING"] } },
        take: 5,
        select: { id: true, status: true, fluxoId: true },
      },
      conversas: {
        orderBy: { lastMessageAt: "desc" },
        take: 1,
        select: {
          id: true,
          mensagens: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { texto: true, direction: true, createdAt: true, attachments: true },
          },
        },
      },
      _count: { select: { conversas: true } },
    },
  });

  let rows = contatos;
  if (q) {
    rows = contatos.filter((c) => {
      const hay = [c.nome, c.username, c.phone, c.trackingIdentity?.stId, ...c.tags]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  return NextResponse.json({
    contatos: rows.map((c) => {
      const conv = c.conversas[0];
      const lastMsg = conv?.mensagens[0];
      return {
        id: c.id,
        igsid: c.igsid,
        nome: c.nome,
        username: c.username,
        profilePictureUrl: c.profilePictureUrl,
        tags: c.tags,
        campos: c.campos,
        phone: c.phone,
        botPaused: c.botPaused,
        createdAt: c.createdAt,
        lastInteractionAt: c.lastInteractionAt,
        stId: c.trackingIdentity?.stId ?? null,
        conversaId: conv?.id ?? null,
        lastMessage: attachmentPreviewLabel(
          lastMsg?.attachments,
          lastMsg?.texto,
        ),
        lastMessageDirection: lastMsg?.direction ?? null,
        messageCount: c._count.conversas,
        execucoesAtivas: c.execucoes,
      };
    }),
    total: rows.length,
  });
}

export async function PATCH(request: NextRequest) {
  const session = await requireApiSession();
  if (!isSession(session)) return session;

  const body = (await request.json()) as {
    ids?: string[];
    addTags?: string[];
    removeTags?: string[];
    botPaused?: boolean;
  };

  if (!body.ids?.length) {
    return NextResponse.json({ error: "ids obrigatório" }, { status: 400 });
  }

  const contatos = await prisma.igContato.findMany({
    where: { id: { in: body.ids }, organizationId: session.organizationId },
  });

  for (const c of contatos) {
    let tags = [...c.tags];
    for (const t of body.addTags ?? []) {
      if (!tags.includes(t)) tags.push(t);
    }
    for (const t of body.removeTags ?? []) {
      tags = tags.filter((x) => x !== t);
    }
    await prisma.igContato.update({
      where: { id: c.id },
      data: {
        tags,
        ...(typeof body.botPaused === "boolean"
          ? { botPaused: body.botPaused }
          : {}),
      },
    });
  }

  return NextResponse.json({ ok: true, updated: contatos.length });
}
