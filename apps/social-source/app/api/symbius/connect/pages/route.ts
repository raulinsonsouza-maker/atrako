import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/symbius/auth";

/** Status das contas Instagram já conectadas (sem seletor de Page). */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const accounts = await prisma.igAccount.findMany({
    where: {
      organizationId: session.organizationId,
      status: { in: ["CONNECTED", "NEEDS_REAUTH"] },
    },
    select: {
      id: true,
      igUserId: true,
      igUsername: true,
      igProfilePictureUrl: true,
      status: true,
      messagesEnabled: true,
      tokenExpiresAt: true,
      webhookSubscribedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ accounts });
}
