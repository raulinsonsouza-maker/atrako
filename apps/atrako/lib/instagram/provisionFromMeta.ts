/**
 * Liga o Instagram de mensagens à mesma conexão Meta do dashboard.
 * O token de anúncio não envia DM: usamos o token da Página e assinamos o webhook de verdade.
 */

import { prisma as socialPrisma } from "@/lib/db-social";
import { upsertWorkspaceConnection } from "@/lib/atrako/workspace-connections";
import type { MetaPageMeta } from "@/lib/integrations/meta/types";

const FB_GRAPH = "https://graph.facebook.com/v21.0";
const PAGE_SCOPES =
  "facebook_page,instagram_manage_comments,instagram_manage_messages,pages_manage_metadata";
const SUBSCRIBED_FIELDS =
  "messages,messaging_postbacks,messaging_referral,comments";

export type PageInstagramAccount = {
  pageId: string;
  pageName?: string;
  pageToken: string;
  igUserId: string;
  igUsername?: string;
};

async function ensureWorkspaceSocialOrg(workspaceId: string, nome?: string) {
  const existing = await socialPrisma.organization.findFirst({
    where: { centralClienteId: workspaceId },
  });
  if (existing) return existing;

  const embed = await socialPrisma.organization.findFirst({
    where: { slug: { startsWith: "atrako-social-" }, centralClienteId: null },
    orderBy: { createdAt: "asc" },
  });
  if (embed) {
    return socialPrisma.organization.update({
      where: { id: embed.id },
      data: { centralClienteId: workspaceId, nome: nome?.trim() || embed.nome },
    });
  }

  const slug = `ws-${workspaceId}`.slice(0, 48);
  return socialPrisma.organization.create({
    data: {
      nome: nome?.trim() || "Workspace",
      slug: `${slug}-${Date.now().toString(36)}`,
      centralClienteId: workspaceId,
      onboardingDone: true,
    },
  });
}

async function graphGet(path: string, token: string, fields: string) {
  const url = new URL(`${FB_GRAPH}/${path.replace(/^\//, "")}`);
  url.searchParams.set("fields", fields);
  url.searchParams.set("access_token", token);
  url.searchParams.set("limit", "50");
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as {
    access_token?: string;
    data?: Array<{
      id?: string;
      name?: string;
      access_token?: string;
      instagram_business_account?: { id?: string; username?: string };
    }>;
  };
}

export async function discoverPageInstagramAccounts(
  userToken: string,
  knownPages: MetaPageMeta[] = [],
): Promise<PageInstagramAccount[]> {
  const found = new Map<string, PageInstagramAccount>();

  const accounts = await graphGet(
    "me/accounts",
    userToken,
    "id,name,access_token,instagram_business_account{id,username}",
  );
  for (const page of accounts?.data ?? []) {
    const ig = page.instagram_business_account;
    if (!page.id || !ig?.id || !page.access_token) continue;
    found.set(ig.id, {
      pageId: page.id,
      pageName: page.name,
      pageToken: page.access_token,
      igUserId: ig.id,
      igUsername: ig.username,
    });
  }

  for (const page of knownPages) {
    if (!page.instagramId || found.has(page.instagramId)) continue;
    const detail = await graphGet(page.id, userToken, "access_token");
    const pageToken = detail?.access_token;
    if (!pageToken) continue;
    found.set(page.instagramId, {
      pageId: page.id,
      pageName: page.name,
      pageToken,
      igUserId: page.instagramId,
      igUsername: page.instagramUsername,
    });
  }

  return Array.from(found.values());
}

async function subscribeEdge(id: string, pageToken: string): Promise<boolean> {
  const res = await fetch(`${FB_GRAPH}/${id}/subscribed_apps`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      subscribed_fields: SUBSCRIBED_FIELDS,
      access_token: pageToken,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    error?: { message?: string };
  };
  if (!res.ok || json.error || json.success === false) {
    console.warn(
      "[instagram] webhook subscribe failed",
      id,
      json.error?.message ?? res.status,
    );
    return false;
  }
  return true;
}

export async function connectInstagramPages(input: {
  workspaceId: string;
  userAccessToken: string;
  expiresAt?: Date | null;
  pages?: MetaPageMeta[];
  workspaceName?: string;
}): Promise<{ connected: number }> {
  const pages = await discoverPageInstagramAccounts(
    input.userAccessToken,
    input.pages ?? [],
  );
  if (pages.length === 0) return { connected: 0 };

  const org = await ensureWorkspaceSocialOrg(input.workspaceId, input.workspaceName);
  const primary = pages[0];

  await upsertWorkspaceConnection({
    clienteId: input.workspaceId,
    provider: "INSTAGRAM",
    label: primary.igUsername ? `@${primary.igUsername}` : "Instagram",
    credentials: {
      accessToken: primary.pageToken,
      pageId: primary.pageId,
      igUserId: primary.igUserId,
      tokenType: "PAGE",
      expiresAt: input.expiresAt?.toISOString() ?? null,
    },
    metadata: {
      connectedAt: new Date().toISOString(),
      source: "META_ADS",
      pageId: primary.pageId,
      igUserId: primary.igUserId,
      igUsername: primary.igUsername ?? null,
    },
    status: "ACTIVE",
  });

  let connected = 0;
  for (const page of pages) {
    const pageOk = await subscribeEdge(page.pageId, page.pageToken);
    const igOk = await subscribeEdge(page.igUserId, page.pageToken);
    const subscribed = pageOk || igOk;
    await socialPrisma.igAccount.upsert({
      where: {
        organizationId_igUserId: {
          organizationId: org.id,
          igUserId: page.igUserId,
        },
      },
      create: {
        organizationId: org.id,
        pageId: page.pageId,
        pageName: page.pageName ?? null,
        accessToken: page.pageToken,
        igUserId: page.igUserId,
        igUsername: page.igUsername ?? null,
        status: "CONNECTED",
        messagesEnabled: true,
        scopes: PAGE_SCOPES,
        tokenExpiresAt: input.expiresAt ?? null,
        webhookSubscribedAt: subscribed ? new Date() : null,
      },
      update: {
        pageId: page.pageId,
        pageName: page.pageName ?? null,
        accessToken: page.pageToken,
        igUsername: page.igUsername ?? null,
        status: "CONNECTED",
        messagesEnabled: true,
        scopes: PAGE_SCOPES,
        tokenExpiresAt: input.expiresAt ?? null,
        webhookSubscribedAt: subscribed ? new Date() : undefined,
      },
    });
    connected += 1;
  }

  return { connected };
}
