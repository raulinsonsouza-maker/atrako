import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isSession, requireApiSession } from "@/lib/symbius/apiHelpers";

export async function GET() {
  const session = await requireApiSession();
  if (!isSession(session)) return session;

  const snippets = await prisma.igSnippet.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { title: "asc" },
  });

  return NextResponse.json({ snippets });
}

const schema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  body: z.string().min(1),
  shortcut: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const session = await requireApiSession();
  if (!isSession(session)) return session;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  if (parsed.data.id) {
    const snippet = await prisma.igSnippet.update({
      where: { id: parsed.data.id },
      data: {
        title: parsed.data.title,
        body: parsed.data.body,
        shortcut: parsed.data.shortcut,
      },
    });
    return NextResponse.json({ snippet });
  }

  const snippet = await prisma.igSnippet.create({
    data: {
      organizationId: session.organizationId,
      title: parsed.data.title,
      body: parsed.data.body,
      shortcut: parsed.data.shortcut,
    },
  });

  return NextResponse.json({ snippet });
}

export async function DELETE(request: NextRequest) {
  const session = await requireApiSession();
  if (!isSession(session)) return session;

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  }

  await prisma.igSnippet.deleteMany({
    where: { id, organizationId: session.organizationId },
  });

  return NextResponse.json({ ok: true });
}
