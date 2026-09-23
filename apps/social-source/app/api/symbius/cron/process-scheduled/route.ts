import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  processScheduledExecutions,
} from "@/lib/instagram/automationEngine";
import { refreshIgLongLivedToken } from "@/lib/instagram/metaOAuth";
import { processScheduledInboxMessages } from "@/lib/symbius/scheduledMessages";

async function refreshExpiringTokens(): Promise<number> {
  const threshold = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const accounts = await prisma.igAccount.findMany({
    where: {
      status: "CONNECTED",
      tokenExpiresAt: { lte: threshold },
    },
    take: 50,
  });

  let refreshed = 0;
  for (const account of accounts) {
    try {
      const result = await refreshIgLongLivedToken(account.accessToken);
      await prisma.igAccount.update({
        where: { id: account.id },
        data: {
          accessToken: result.accessToken,
          tokenExpiresAt: new Date(Date.now() + result.expiresIn * 1000),
        },
      });
      refreshed += 1;
    } catch (e) {
      console.error("[cron] ig token refresh failed", account.id, e);
      await prisma.igAccount.update({
        where: { id: account.id },
        data: { status: "NEEDS_REAUTH" },
      });
    }
  }
  return refreshed;
}

export async function POST(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  const expected = process.env.ADMIN_SECRET ?? process.env.CRON_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [processed, scheduledMessages, tokensRefreshed] = await Promise.all([
    processScheduledExecutions(),
    processScheduledInboxMessages(),
    refreshExpiringTokens(),
  ]);
  return NextResponse.json({ processed, scheduledMessages, tokensRefreshed });
}
