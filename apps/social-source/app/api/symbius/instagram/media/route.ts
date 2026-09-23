import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/symbius/auth";
import { fetchIgUserMedia } from "@/lib/instagram/metaOAuth";

export type { IgMediaItem } from "@/lib/instagram/metaOAuth";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const account = await prisma.igAccount.findFirst({
    where: {
      organizationId: session.organizationId,
      status: "CONNECTED",
    },
    orderBy: { createdAt: "desc" },
  });

  if (!account) {
    return NextResponse.json(
      { error: "Nenhuma conta Instagram conectada", media: [] },
      { status: 404 },
    );
  }

  try {
    const result = await fetchIgUserMedia({
      accessToken: account.accessToken,
      storedIgUserId: account.igUserId,
      limit: 24,
    });

    // Corrige igUserId salvo se /me devolver o ID profissional correto
    if (
      result.igUserId &&
      result.igUserId !== account.igUserId &&
      result.media.length > 0
    ) {
      try {
        await prisma.igAccount.update({
          where: { id: account.id },
          data: { igUserId: result.igUserId },
        });
      } catch (e) {
        console.warn(
          "[instagram] could not persist corrected igUserId:",
          e instanceof Error ? e.message : e,
        );
      }
    }

    if (result.warning) {
      return NextResponse.json({
        media: result.media,
        warning: result.warning,
      });
    }

    return NextResponse.json({ media: result.media });
  } catch (e) {
    console.warn(
      "[instagram] media list failed:",
      e instanceof Error ? e.message : e,
    );
    return NextResponse.json({
      media: [],
      warning:
        "Não foi possível listar publicações agora. Use “qualquer publicação” ou reconecte o Instagram.",
    });
  }
}
