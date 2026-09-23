import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/symbius/auth";
import { fetchIgMeProfile } from "@/lib/instagram/metaOAuth";

const schema = z.object({
  accountId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const account = await prisma.igAccount.findFirst({
    where: {
      id: parsed.data.accountId,
      organizationId: session.organizationId,
      status: { in: ["CONNECTED", "DISABLED"] },
    },
  });

  if (!account) {
    return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
  }

  try {
    const profile = await fetchIgMeProfile(
      account.accessToken,
      account.igUserId,
    );

    const updated = await prisma.igAccount.update({
      where: { id: account.id },
      data: {
        pageName: profile.name ?? account.pageName,
        igUsername: profile.username ?? account.igUsername,
        igProfilePictureUrl:
          profile.profilePictureUrl ?? account.igProfilePictureUrl,
        followersCount: profile.followersCount ?? account.followersCount,
        // Corrige igUserId se /me devolver o ID profissional
        ...(profile.igUserId &&
        profile.igUserId !== account.igUserId &&
        profile.username
          ? { igUserId: profile.igUserId }
          : {}),
      },
    });

    if (!updated.igUsername || !updated.igProfilePictureUrl) {
      return NextResponse.json(
        {
          error:
            "A Meta não retornou nome/foto. Reconecte o Instagram em Conectar para renovar o token.",
          account: {
            id: updated.id,
            igUserId: updated.igUserId,
            igUsername: updated.igUsername,
            igProfilePictureUrl: updated.igProfilePictureUrl,
            status: updated.status,
          },
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      ok: true,
      account: {
        id: updated.id,
        igUserId: updated.igUserId,
        igUsername: updated.igUsername,
        igProfilePictureUrl: updated.igProfilePictureUrl,
        status: updated.status,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao atualizar perfil";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
