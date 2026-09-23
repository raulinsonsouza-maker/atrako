import { prisma } from "@/lib/db";
import { processScheduledExecutions } from "@/lib/instagram/automationEngine";
import { refreshIgLongLivedToken } from "@/lib/instagram/metaOAuth";

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
      console.error("[symbius-cron] ig token refresh failed", account.id, e);
      await prisma.igAccount.update({
        where: { id: account.id },
        data: { status: "NEEDS_REAUTH" },
      });
    }
  }
  return refreshed;
}

async function main() {
  const n = await processScheduledExecutions();
  const tokens = await refreshExpiringTokens();
  console.log(
    `[symbius-cron] processed ${n} scheduled executions, refreshed ${tokens} tokens`,
  );
}

main().catch(console.error);
