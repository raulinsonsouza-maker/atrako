/**
 * Configura PlatformApp MERCADO_PAGO (+ opcional WC Sense).
 * Credenciais via env — não versionar secrets.
 */
import { prisma } from "../lib/db";
import { encryptCredentials, decryptCredentials } from "../lib/atrako/credentials-crypto";

async function main() {
  const clientId = process.env.MP_CLIENT_ID?.trim();
  const clientSecret = process.env.MP_CLIENT_SECRET?.trim();
  const redirectUri =
    process.env.MP_REDIRECT_URI?.trim() ||
    "https://atrako.com.br/api/atrako/oauth/mercadopago/callback";
  const webhookSecret = process.env.MP_WEBHOOK_SECRET?.trim();
  const accessToken = process.env.MP_ACCESS_TOKEN?.trim();
  const publicKey = process.env.MP_PUBLIC_KEY?.trim();
  const slug = process.env.MP_SEED_WORKSPACE_SLUG?.trim() || "sense";

  if (!clientId || !clientSecret) {
    throw new Error("MP_CLIENT_ID e MP_CLIENT_SECRET são obrigatórios.");
  }

  const existing = await prisma.platformApp.findUnique({ where: { provider: "MERCADO_PAGO" } });
  const prev = existing
    ? (decryptCredentials(existing.credentialsEnc) as Record<string, unknown>)
    : {};
  const next = {
    ...prev,
    clientId,
    clientSecret,
    redirectUri,
    ...(webhookSecret ? { webhookSecret } : {}),
  };

  await prisma.platformApp.upsert({
    where: { provider: "MERCADO_PAGO" },
    create: {
      provider: "MERCADO_PAGO",
      enabled: true,
      label: "Mercado Pago",
      credentialsEnc: encryptCredentials(next),
    },
    update: {
      enabled: true,
      label: "Mercado Pago",
      credentialsEnc: encryptCredentials(next),
    },
  });

  let workspace: { id: string; slug: string; nome: string } | null = null;
  if (accessToken) {
    const cliente = await prisma.cliente.findUnique({ where: { slug } });
    if (!cliente) {
      throw new Error(`Workspace slug="${slug}" não encontrado.`);
    }
    const credentialsEnc = encryptCredentials({
      accessToken,
      ...(publicKey ? { publicKey } : {}),
    });
    await prisma.workspaceConnection.upsert({
      where: {
        clienteId_provider: { clienteId: cliente.id, provider: "MERCADO_PAGO" },
      },
      create: {
        clienteId: cliente.id,
        provider: "MERCADO_PAGO",
        label: "Mercado Pago",
        status: "ACTIVE",
        credentialsEnc,
        metadata: { source: "production_credentials", applicationId: clientId },
        lastSyncedAt: new Date(),
      },
      update: {
        label: "Mercado Pago",
        status: "ACTIVE",
        credentialsEnc,
        metadata: { source: "production_credentials", applicationId: clientId },
        lastSyncedAt: new Date(),
      },
    });
    workspace = { id: cliente.id, slug: cliente.slug, nome: cliente.nome };
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        platformApp: {
          provider: "MERCADO_PAGO",
          enabled: true,
          clientIdPreview: `${clientId.slice(0, 6)}…`,
          redirectUri,
          webhookSecretConfigured: Boolean(webhookSecret || prev.webhookSecret),
        },
        workspaceConnection: workspace
          ? {
              workspace,
              provider: "MERCADO_PAGO",
              hasAccessToken: true,
              hasPublicKey: Boolean(publicKey),
            }
          : null,
        webhookUrl: "https://atrako.com.br/api/atrako/commerce/webhook",
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
