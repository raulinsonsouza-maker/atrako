import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isSession, requireApiSession } from "@/lib/symbius/apiHelpers";

const schema = z.object({
  igAccountId: z.string().min(1),
  defaultReplyText: z.string().optional().nullable(),
  iceBreakers: z
    .array(z.object({ question: z.string(), payload: z.string().optional() }))
    .max(4)
    .optional(),
});

export async function PATCH(request: NextRequest) {
  const session = await requireApiSession("ADMIN");
  if (!isSession(session)) return session;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const existing = await prisma.igAccount.findFirst({
    where: {
      id: parsed.data.igAccountId,
      organizationId: session.organizationId,
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
  }

  const account = await prisma.igAccount.update({
    where: { id: existing.id },
    data: {
      defaultReplyText: parsed.data.defaultReplyText ?? undefined,
      iceBreakers: parsed.data.iceBreakers ?? undefined,
    },
  });

  return NextResponse.json({ account });
}

export async function GET(request: NextRequest) {
  const session = await requireApiSession();
  if (!isSession(session)) return session;

  const igAccountId = request.nextUrl.searchParams.get("igAccountId");
  if (!igAccountId) {
    const accounts = await prisma.igAccount.findMany({
      where: { organizationId: session.organizationId },
      select: {
        id: true,
        igUsername: true,
        defaultReplyText: true,
        iceBreakers: true,
        status: true,
      },
    });
    return NextResponse.json({ accounts });
  }

  const account = await prisma.igAccount.findFirst({
    where: { id: igAccountId, organizationId: session.organizationId },
    select: {
      id: true,
      igUsername: true,
      defaultReplyText: true,
      iceBreakers: true,
    },
  });

  if (!account) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }

  return NextResponse.json({ account });
}
