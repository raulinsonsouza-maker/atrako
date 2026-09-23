import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import {
  attachSessionCookie,
  createSessionForUser,
  getSession,
  limitsForPlan,
  uniqueOrgSlug,
} from "@/lib/symbius/auth";
import { canConnectIgAccount } from "@/lib/symbius/tenant";
import {
  completeInstagramLogin,
  getSymbiusAppUrl,
} from "@/lib/instagram/metaOAuth";

type OAuthState = {
  intent?: "auth" | "connect";
  organizationId?: string;
  userId?: string;
  returnTo?: string;
  popup?: boolean;
};

type IgLoginResult = Awaited<ReturnType<typeof completeInstagramLogin>>;

const OAUTH_STATE_COOKIE = "symbius_meta_oauth_state";

function requestBaseUrl(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = (forwardedHost ?? request.headers.get("host") ?? "")
    .split(",")[0]
    ?.trim();
  if (!host) return getSymbiusAppUrl();
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? "https";
  return `${proto}://${host}`;
}

function parseState(stateParam: string): OAuthState {
  try {
    return JSON.parse(
      Buffer.from(stateParam, "base64url").toString("utf8"),
    ) as OAuthState;
  } catch {
    return {};
  }
}

function syntheticEmail(igUserId: string) {
  return `ig_${igUserId}@users.symbius.local`;
}

function redirectAuthError(base: string, error: string) {
  return NextResponse.redirect(
    `${base}/login?error=${encodeURIComponent(error)}`,
  );
}

function clearOAuthStateCookie(response: NextResponse): NextResponse {
  response.cookies.delete(OAUTH_STATE_COOKIE);
  return response;
}

function redirectAfterAuth(
  base: string,
  decoded: OAuthState,
  params: { error?: string; sessionToken?: string },
) {
  const returnTo = decoded.returnTo ?? "/app";

  if (decoded.popup) {
    const sp = new URLSearchParams();
    if (params.error) {
      sp.set("error", params.error);
    } else {
      sp.set("ok", "1");
      sp.set("returnTo", returnTo);
    }
    const res = clearOAuthStateCookie(
      NextResponse.redirect(`${base}/login/oauth-complete?${sp.toString()}`),
    );
    if (params.sessionToken) {
      attachSessionCookie(res, params.sessionToken);
    }
    return res;
  }

  if (params.error) {
    return clearOAuthStateCookie(redirectAuthError(base, params.error));
  }

  const res = clearOAuthStateCookie(
    NextResponse.redirect(`${base}${returnTo}`),
  );
  if (params.sessionToken) {
    attachSessionCookie(res, params.sessionToken);
  }
  return res;
}

function redirectAfterConnect(
  base: string,
  decoded: OAuthState,
  params: { step?: string; error?: string },
) {
  if (decoded.popup) {
    const sp = new URLSearchParams();
    if (params.error) {
      sp.set("error", params.error);
    } else {
      sp.set("ok", "1");
      if (params.step) sp.set("step", params.step);
    }
    return clearOAuthStateCookie(
      NextResponse.redirect(
        `${base}/app/connect/oauth-complete?${sp.toString()}`,
      ),
    );
  }

  if (params.error) {
    return clearOAuthStateCookie(
      NextResponse.redirect(
        `${base}/app/connect?error=${encodeURIComponent(params.error)}`,
      ),
    );
  }

  const returnTo = decoded.returnTo ?? "/app/connect";
  return clearOAuthStateCookie(
    NextResponse.redirect(`${base}${returnTo}?step=${params.step ?? "5"}`),
  );
}

async function upsertIgAccountForOrg(
  organizationId: string,
  result: IgLoginResult,
) {
  await prisma.igAccount.upsert({
    where: {
      organizationId_igUserId: {
        organizationId,
        igUserId: result.profile.igUserId,
      },
    },
    create: {
      organizationId,
      pageName: result.profile.name ?? null,
      accessToken: result.accessToken,
      igUserId: result.profile.igUserId,
      igUsername: result.profile.username,
      igProfilePictureUrl: result.profile.profilePictureUrl,
      followersCount: result.profile.followersCount,
      scopes: result.scopes,
      status: "CONNECTED",
      messagesEnabled: result.messagesEnabled,
      tokenExpiresAt: result.expiresAt,
      webhookSubscribedAt: new Date(),
    },
    update: {
      pageName: result.profile.name ?? null,
      accessToken: result.accessToken,
      igUsername: result.profile.username,
      igProfilePictureUrl: result.profile.profilePictureUrl,
      followersCount: result.profile.followersCount,
      scopes: result.scopes,
      status: "CONNECTED",
      messagesEnabled: result.messagesEnabled,
      tokenExpiresAt: result.expiresAt,
      webhookSubscribedAt: new Date(),
    },
  });
}

async function issueSessionForUser(userId: string) {
  const { token, organizationId } = await createSessionForUser(userId);
  return { token, organizationId };
}

async function handleAuthIntent(
  base: string,
  decoded: OAuthState,
  result: IgLoginResult,
): Promise<NextResponse> {
  const igUserId = result.profile.igUserId;
  const profile = result.profile;

  // 1) User já ligado a este IG
  let user = await prisma.user.findUnique({
    where: { igUserId },
    include: {
      memberships: {
        include: { organization: true },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });

  // 2) IgAccount existente → login na org dona
  if (!user) {
    const existingAccount = await prisma.igAccount.findFirst({
      where: { igUserId },
      orderBy: { createdAt: "asc" },
      include: {
        organization: {
          include: {
            members: {
              where: { role: "OWNER" },
              take: 1,
              include: { user: true },
            },
          },
        },
      },
    });

    if (existingAccount?.organization.members[0]?.user) {
      const owner = existingAccount.organization.members[0].user;
      user = await prisma.user.update({
        where: { id: owner.id },
        data: { igUserId },
        include: {
          memberships: {
            include: { organization: true },
            orderBy: { createdAt: "asc" },
            take: 1,
          },
        },
      });
    }
  }

  if (user) {
    const orgId = user.memberships[0]?.organizationId;
    if (!orgId) throw new Error("Usuário sem organização");

    await upsertIgAccountForOrg(orgId, result);
    const { token } = await issueSessionForUser(user.id);
    return redirectAfterAuth(base, decoded, { sessionToken: token });
  }

  // 3) Novo usuário: User + Org + IgAccount
  const displayName =
    profile.name?.trim() ||
    (profile.username ? `@${profile.username}` : "Conta Instagram");
  const orgNome = profile.username
    ? `@${profile.username}`
    : displayName;
  const slug = await uniqueOrgSlug(profile.username || displayName);
  const limits = limitsForPlan("FREE");
  const email = syntheticEmail(igUserId);

  const created = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        email,
        nome: displayName,
        igUserId,
        passwordHash: null,
        memberships: {
          create: {
            role: "OWNER",
            organization: {
              create: {
                nome: orgNome,
                slug,
                plan: "FREE",
                onboardingDone: true,
                maxIgAccounts: limits.maxIgAccounts,
                maxFluxos: limits.maxFluxos,
                maxMembers: limits.maxMembers,
                subscription: { create: { plan: "FREE" } },
              },
            },
          },
        },
      },
      include: {
        memberships: true,
      },
    });

    const organizationId = newUser.memberships[0].organizationId;

    await tx.igAccount.create({
      data: {
        organizationId,
        pageName: profile.name ?? null,
        accessToken: result.accessToken,
        igUserId,
        igUsername: profile.username,
        igProfilePictureUrl: profile.profilePictureUrl,
        followersCount: profile.followersCount,
        scopes: result.scopes,
        status: "CONNECTED",
        messagesEnabled: result.messagesEnabled,
        tokenExpiresAt: result.expiresAt,
        webhookSubscribedAt: new Date(),
      },
    });

    return newUser;
  });

  const { token } = await issueSessionForUser(created.id);
  return redirectAfterAuth(base, decoded, { sessionToken: token });
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");
  const error =
    searchParams.get("error_description") ??
    searchParams.get("error_reason") ??
    searchParams.get("error");

  const base = requestBaseUrl(request);
  const decoded = stateParam ? parseState(stateParam) : {};
  const isAuth = decoded.intent === "auth";

  if (error) {
    const msg = String(error).replace(/\+/g, " ");
    if (isAuth) return redirectAfterAuth(base, decoded, { error: msg });
    return redirectAfterConnect(base, decoded, { error: msg });
  }

  const jar = await cookies();
  const savedState = jar.get(OAUTH_STATE_COOKIE)?.value;

  if (!code || !stateParam || stateParam !== savedState) {
    if (isAuth) {
      return redirectAfterAuth(base, decoded, {
        error: "Sessão OAuth inválida",
      });
    }
    return redirectAfterConnect(base, decoded, {
      error: "Sessão OAuth inválida",
    });
  }

  try {
    const result = await completeInstagramLogin(code);

    if (isAuth) {
      return await handleAuthIntent(base, decoded, result);
    }

    // --- connect (logado) ---
    const session = await getSession();
    const organizationId =
      decoded.organizationId ?? session?.organizationId;
    if (!organizationId) {
      return redirectAfterConnect(base, decoded, {
        error: "Não autenticado",
      });
    }

    const already = await prisma.igAccount.findUnique({
      where: {
        organizationId_igUserId: {
          organizationId,
          igUserId: result.profile.igUserId,
        },
      },
      select: { id: true },
    });

    if (!already && !(await canConnectIgAccount(organizationId))) {
      return redirectAfterConnect(base, decoded, {
        error: "Limite de contas Instagram do plano atingido",
      });
    }

    await upsertIgAccountForOrg(organizationId, result);

    // Liga igUserId ao user logado se ainda não tiver
    if (session?.userId) {
      await prisma.user.updateMany({
        where: { id: session.userId, igUserId: null },
        data: { igUserId: result.profile.igUserId },
      });
    }

    return redirectAfterConnect(base, decoded, { step: "5" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro OAuth";
    if (isAuth) return redirectAfterAuth(base, decoded, { error: msg });
    return redirectAfterConnect(base, decoded, { error: msg });
  }
}
