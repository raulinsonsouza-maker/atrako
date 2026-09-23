import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isSession, requireApiSession } from "@/lib/symbius/apiHelpers";
import { setActiveIgAccountCookie } from "@/lib/symbius/activeIgAccount";

const schema = z.object({
  igAccountId: z.string().nullable(),
});

export async function POST(request: NextRequest) {
  const session = await requireApiSession();
  if (!isSession(session)) return session;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  if (parsed.data.igAccountId) {
    const account = await prisma.igAccount.findFirst({
      where: {
        id: parsed.data.igAccountId,
        organizationId: session.organizationId,
      },
    });
    if (!account) {
      return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
    }
  }

  await setActiveIgAccountCookie(
    session.organizationId,
    parsed.data.igAccountId,
  );

  return NextResponse.json({ ok: true, igAccountId: parsed.data.igAccountId });
}

export async function GET() {
  const session = await requireApiSession();
  if (!isSession(session)) return session;

  const accounts = await prisma.igAccount.findMany({
    where: { organizationId: session.organizationId, status: "CONNECTED" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      igUsername: true,
      igProfilePictureUrl: true,
      pageName: true,
    },
  });

  const { getActiveIgAccountId } = await import("@/lib/symbius/activeIgAccount");
  const activeIgAccountId = await getActiveIgAccountId(session.organizationId);

  return NextResponse.json({ accounts, activeIgAccountId });
}
