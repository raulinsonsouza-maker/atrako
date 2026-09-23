import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isSession, requireApiSession } from "@/lib/symbius/apiHelpers";

const schema = z.object({
  organizationId: z.string().min(1),
  pinned: z.boolean(),
});

export async function POST(request: NextRequest) {
  const session = await requireApiSession();
  if (!isSession(session)) return session;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  await prisma.organizationMember.update({
    where: {
      userId_organizationId: {
        userId: session.userId,
        organizationId: parsed.data.organizationId,
      },
    },
    data: { pinnedAt: parsed.data.pinned ? new Date() : null },
  });

  return NextResponse.json({ ok: true });
}
