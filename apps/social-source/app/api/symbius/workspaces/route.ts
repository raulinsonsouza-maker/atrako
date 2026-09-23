import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  createSessionToken,
  limitsForPlan,
  setSessionCookie,
  uniqueOrgSlug,
} from "@/lib/symbius/auth";
import { isSession, requireApiSession } from "@/lib/symbius/apiHelpers";
import { isConversaUnread } from "@/lib/symbius/inboxUnread";

export async function GET() {
  const session = await requireApiSession();
  if (!isSession(session)) return session;

  const memberships = await prisma.organizationMember.findMany({
    where: { userId: session.userId },
    include: {
      organization: {
        include: {
          igAccounts: {
            where: { status: "CONNECTED" },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
    },
    orderBy: [{ pinnedAt: "desc" }, { createdAt: "asc" }],
  });

  const workspaces = await Promise.all(
    memberships.map(async (m) => {
      const ig = m.organization.igAccounts[0];
      const open = await prisma.igConversa.findMany({
        where: { organizationId: m.organizationId, status: "OPEN" },
        select: {
          lastMessageAt: true,
          lastReadAt: true,
          mensagens: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { direction: true, createdAt: true },
          },
        },
        take: 200,
      });
      const unread = open.filter((c) =>
        isConversaUnread({
          lastMessageDirection: c.mensagens[0]?.direction,
          lastMessageAt: c.lastMessageAt ?? c.mensagens[0]?.createdAt,
          lastReadAt: c.lastReadAt,
        }),
      ).length;
      return {
        id: m.organizationId,
        nome: m.organization.nome,
        plan: m.organization.plan,
        role: m.role,
        pinned: Boolean(m.pinnedAt),
        isActive: m.organizationId === session.organizationId,
        igUsername: ig?.igUsername ?? null,
        igProfilePictureUrl: ig?.igProfilePictureUrl ?? null,
        inboxUnread: unread,
      };
    }),
  );

  return NextResponse.json({ workspaces });
}

const createSchema = z.object({
  nome: z.string().min(2).max(80),
});

export async function POST(request: NextRequest) {
  const session = await requireApiSession("OWNER");
  if (!isSession(session)) return session;

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Nome inválido" }, { status: 400 });
  }

  const slug = await uniqueOrgSlug(parsed.data.nome);
  const limits = limitsForPlan("FREE");

  const org = await prisma.organization.create({
    data: {
      nome: parsed.data.nome,
      slug,
      plan: "FREE",
      maxIgAccounts: limits.maxIgAccounts,
      maxFluxos: limits.maxFluxos,
      maxMembers: limits.maxMembers,
      members: {
        create: { userId: session.userId, role: "OWNER" },
      },
      subscription: { create: { plan: "FREE" } },
      orgSettings: { create: {} },
    },
  });

  const token = await createSessionToken({
    userId: session.userId,
    organizationId: org.id,
    role: "OWNER",
    email: session.email,
    nome: session.nome,
  });
  await setSessionCookie(token);

  return NextResponse.json({ ok: true, organizationId: org.id });
}
