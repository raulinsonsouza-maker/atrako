import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db-social";
import { getSession } from "@/lib/symbius/auth";
import { fetchIgUserMedia, fetchIgUserStories } from "@/lib/instagram/metaOAuth";

export type { IgMediaItem } from "@/lib/instagram/metaOAuth";

async function organizationForMedia(request: NextRequest) {
  const wsId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  if (wsId) {
    const org = await prisma.organization.findFirst({
      where: { centralClienteId: wsId },
      select: { id: true },
    });
    return org?.id ?? null;
  }
  const session = await getSession();
  return session?.organizationId ?? null;
}

export async function GET(request: NextRequest) {
  const wsId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  const organizationId = await organizationForMedia(request);
  if (!organizationId) {
    return NextResponse.json(
      {
        error: wsId ? "Nenhuma conta Instagram conectada neste workspace." : "Não autenticado",
        media: [],
      },
      { status: wsId ? 404 : 401 },
    );
  }

  const account = await prisma.igAccount.findFirst({
    where: {
      organizationId,
      status: "CONNECTED",
      NOT: { igUserId: { startsWith: "hub-" } },
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
    const stories = request.nextUrl.searchParams.get("kind") === "stories";
    const result = stories
      ? await fetchIgUserStories({
          accessToken: account.accessToken,
          storedIgUserId: account.igUserId,
        })
      : await fetchIgUserMedia({
          accessToken: account.accessToken,
          storedIgUserId: account.igUserId,
          limit: 24,
        });

    // Corrige igUserId salvo se /me devolver o ID profissional correto
    const resolvedId = "igUserId" in result ? result.igUserId : null;
    if (
      resolvedId &&
      resolvedId !== account.igUserId &&
      result.media.length > 0
    ) {
      try {
        await prisma.igAccount.update({
          where: { id: account.id },
          data: { igUserId: resolvedId },
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
