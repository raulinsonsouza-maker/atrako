import { prisma } from "@/lib/db";
import { fetchIgMeProfile } from "@/lib/instagram/metaOAuth";
import type { SymbiusSession } from "./auth";
import { getActiveIgAccountId } from "./activeIgAccount";
import { isConversaUnread } from "./inboxUnread";

export type SymbiusShellData = {
  userName: string;
  userEmail: string;
  plan: string;
  accountDisplayName: string;
  igUsername: string | null;
  igProfilePictureUrl: string | null;
  hasIgAccount: boolean;
  needsReauth: boolean;
  inboxUnread: number;
  workspaces: Array<{
    id: string;
    nome: string;
    plan: string;
    pinned: boolean;
    isActive: boolean;
    igUsername: string | null;
    igProfilePictureUrl: string | null;
    inboxUnread: number;
  }>;
  igAccounts: Array<{
    id: string;
    igUsername: string | null;
    igProfilePictureUrl: string | null;
    pageName: string | null;
    status: string;
  }>;
  activeIgAccountId: string | null;
};

function pickDisplayName(params: {
  pageName: string | null | undefined;
  igUsername: string | null | undefined;
  igName: string | null | undefined;
  orgName: string | null | undefined;
  userName: string;
}): string {
  const page = params.pageName?.trim();
  if (page) return page;

  const igName = params.igName?.trim();
  if (igName) return igName;

  const username = params.igUsername?.replace(/^@/, "").trim();
  if (username) return username;

  const org = params.orgName?.trim();
  if (org) return org;

  return params.userName;
}

export async function getSymbiusShellData(
  session: SymbiusSession,
): Promise<SymbiusShellData> {
  const [org, igAccounts, openConversas, memberships, activeIgAccountId] =
    await Promise.all([
    prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: { plan: true, nome: true },
    }),
    prisma.igAccount.findMany({
      where: {
        organizationId: session.organizationId,
        status: { in: ["CONNECTED", "NEEDS_REAUTH"] },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        accessToken: true,
        igUserId: true,
        pageName: true,
        igUsername: true,
        igProfilePictureUrl: true,
        status: true,
      },
    }),
    prisma.igConversa.findMany({
      where: {
        organizationId: session.organizationId,
        status: "OPEN",
      },
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
    }),
    prisma.organizationMember.findMany({
      where: { userId: session.userId },
      include: {
        organization: {
          include: {
            igAccounts: {
              where: { status: { in: ["CONNECTED", "NEEDS_REAUTH"] } },
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        },
      },
      orderBy: [{ pinnedAt: "desc" }, { createdAt: "asc" }],
    }),
    getActiveIgAccountId(session.organizationId),
  ]);

  let igAccountRaw = igAccounts[0] ?? null;
  let igAccount = igAccountRaw;
  let igName: string | null = null;

  if (
    igAccount &&
    (!igAccount.igUsername || !igAccount.igProfilePictureUrl)
  ) {
    try {
      const profile = await fetchIgMeProfile(
        igAccount.accessToken,
        igAccount.igUserId,
      );
      igName = profile.name ?? null;
      igAccount = await prisma.igAccount.update({
        where: { id: igAccount.id },
        data: {
          igUsername: profile.username ?? igAccount.igUsername,
          igProfilePictureUrl:
            profile.profilePictureUrl ?? igAccount.igProfilePictureUrl,
          pageName: igAccount.pageName ?? profile.name ?? undefined,
        },
        select: {
          id: true,
          accessToken: true,
          igUserId: true,
          pageName: true,
          igUsername: true,
          igProfilePictureUrl: true,
          status: true,
        },
      });
    } catch {
      // Mantém dados em cache se a API falhar
    }
  }

  const inboxUnread = openConversas.filter((c) =>
    isConversaUnread({
      lastMessageDirection: c.mensagens[0]?.direction,
      lastMessageAt: c.lastMessageAt ?? c.mensagens[0]?.createdAt,
      lastReadAt: c.lastReadAt,
    }),
  ).length;

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
        pinned: Boolean(m.pinnedAt),
        isActive: m.organizationId === session.organizationId,
        igUsername: ig?.igUsername ?? null,
        igProfilePictureUrl: ig?.igProfilePictureUrl ?? null,
        inboxUnread: unread,
      };
    }),
  );

  return {
    userName: session.nome,
    userEmail: session.email,
    plan: org?.plan ?? "FREE",
    accountDisplayName: pickDisplayName({
      pageName: igAccount?.pageName,
      igUsername: igAccount?.igUsername,
      igName,
      orgName: org?.nome,
      userName: session.nome,
    }),
    igUsername: igAccount?.igUsername ?? null,
    igProfilePictureUrl: igAccount?.igProfilePictureUrl ?? null,
    hasIgAccount: Boolean(igAccount),
    needsReauth: igAccounts.some((a) => a.status === "NEEDS_REAUTH"),
    inboxUnread,
    workspaces,
    igAccounts: igAccounts.map((a) => ({
      id: a.id,
      igUsername: a.igUsername,
      igProfilePictureUrl: a.igProfilePictureUrl,
      pageName: a.pageName,
      status: a.status,
    })),
    activeIgAccountId,
  };
}
