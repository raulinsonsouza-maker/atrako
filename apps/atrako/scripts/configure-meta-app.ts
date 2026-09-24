/**
 * Configura PlatformApp META (App ID + Secret).
 * Credenciais via env — não versionar secrets.
 *
 * META_APP_ID=… META_APP_SECRET=… npx tsx scripts/configure-meta-app.ts
 * Opcional: META_LOGIN_CONFIG_ID=…
 */
import { prisma } from "../lib/db";
import { encryptCredentials, decryptCredentials } from "../lib/atrako/credentials-crypto";

async function main() {
  const clientId = process.env.META_APP_ID?.trim();
  const clientSecret = process.env.META_APP_SECRET?.trim();
  const loginConfigId = process.env.META_LOGIN_CONFIG_ID?.trim();
  const redirectUri =
    process.env.META_OAUTH_REDIRECT_URI?.trim() ||
    "https://atrako.com.br/api/atrako/oauth/meta/callback";
  const webhookVerifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN?.trim();

  if (!clientId || !clientSecret) {
    throw new Error("META_APP_ID e META_APP_SECRET são obrigatórios.");
  }

  const existing = await prisma.platformApp.findUnique({ where: { provider: "META" } });
  const prev = existing
    ? (decryptCredentials(existing.credentialsEnc) as Record<string, unknown>)
    : {};
  const next = {
    ...prev,
    clientId,
    clientSecret,
    redirectUri,
    webhookSecret: clientSecret,
    ...(loginConfigId ? { loginConfigId } : {}),
    ...(webhookVerifyToken ? { webhookVerifyToken } : {}),
  };

  await prisma.platformApp.upsert({
    where: { provider: "META" },
    create: {
      provider: "META",
      enabled: true,
      label: "Meta",
      credentialsEnc: encryptCredentials(next),
    },
    update: {
      enabled: true,
      label: "Meta",
      credentialsEnc: encryptCredentials(next),
    },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        hasClientId: true,
        hasClientSecret: true,
        hasLoginConfigId: Boolean(next.loginConfigId),
        redirectUri,
        enabled: true,
        status: next.loginConfigId ? "ready" : "incomplete_needs_login_config_id",
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
