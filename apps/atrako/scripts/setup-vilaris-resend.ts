/**
 * Conecta o Resend da Vilaris: domínio vilarisgestao.com.br + remetente contato@.
 * Não imprime a API key.
 *
 * Uso (API key só via env):
 *   RESEND_API_KEY=re_… npx tsx apps/atrako/scripts/setup-vilaris-resend.ts
 *   RESEND_API_KEY=re_… npx tsx apps/atrako/scripts/setup-vilaris-resend.ts --verify
 */

import { prisma } from "../lib/db";
import { Prisma } from "../lib/generated/prisma";
import { upsertWorkspaceConnection, getWorkspaceConnection } from "../lib/atrako/workspace-connections";
import {
  configureResendDomainTracking,
  createResendDomain,
  createResendWebhook,
  getResendDomain,
  listResendDomains,
  verifyResendDomain,
} from "../lib/integrations/resend/client";
import { ensureVilarisConsultoriaFlows } from "../lib/flows/playbooks-vilaris";
import { sanitizeTheme, defaultTheme } from "../lib/flows/theme";

const DOMAIN = "vilarisgestao.com.br";
const FROM_LOCAL = "contato";
const FROM_NAME = "Vilaris";
const WEBHOOK_BASE = process.env.APP_URL?.replace(/\/$/, "") || "https://atrako.com.br";

async function main() {
  const apiKey = process.env.RESEND_API_KEY?.trim() || "";
  if (!apiKey.startsWith("re_")) throw new Error("Defina RESEND_API_KEY=re_…");
  const doVerify = process.argv.includes("--verify");

  const cliente = await prisma.cliente.findFirst({
    where: { slug: "vilaris" },
    select: { id: true, nome: true },
  });
  if (!cliente) throw new Error("Workspace vilaris não encontrado");

  let domains = await listResendDomains(apiKey);
  let domain = domains.find((d) => d.name === DOMAIN) ?? null;
  if (!domain) {
    const created = await createResendDomain(apiKey, DOMAIN);
    domain = { id: created.id, name: created.name, status: created.status };
    domains = await listResendDomains(apiKey);
    domain = domains.find((d) => d.name === DOMAIN) ?? domain;
  }

  const detail = await getResendDomain(apiKey, domain.id);
  if (doVerify) {
    await verifyResendDomain(apiKey, domain.id).catch(() => null);
  }
  const refreshed = await getResendDomain(apiKey, domain.id);
  const status = refreshed.status || detail.status || domain.status;
  const verified = status === "verified";

  await configureResendDomainTracking(apiKey, domain.id).catch(() => null);

  const fromEmail = `${FROM_LOCAL}@${DOMAIN}`;
  const prev = await getWorkspaceConnection(cliente.id, "RESEND");
  const prevCreds = prev?.status === "ACTIVE" ? prev.credentials : {};
  const prevMeta = (prev?.metadata ?? {}) as Record<string, unknown>;
  const sameDomain = prevMeta.domainId === domain.id;

  await upsertWorkspaceConnection({
    clienteId: cliente.id,
    provider: "RESEND",
    label: DOMAIN,
    credentials: { ...prevCreds, apiKey },
    metadata: {
      ...prevMeta,
      fromName: FROM_NAME,
      fromEmail,
      replyTo: fromEmail,
      domain: DOMAIN,
      domainId: domain.id,
      domainStatus: status,
      domainVerifiedAt:
        verified && sameDomain && typeof prevMeta.domainVerifiedAt === "string"
          ? prevMeta.domainVerifiedAt
          : verified
            ? new Date().toISOString()
            : null,
      clonedFrom: null,
    },
    status: "ACTIVE",
  });

  if (!prevCreds.webhookSecret) {
    const endpoint = `${WEBHOOK_BASE}/api/webhooks/resend/${cliente.id}`;
    try {
      const hook = await createResendWebhook(apiKey, endpoint);
      if (hook.signing_secret) {
        const fresh = await getWorkspaceConnection(cliente.id, "RESEND");
        await upsertWorkspaceConnection({
          clienteId: cliente.id,
          provider: "RESEND",
          label: DOMAIN,
          credentials: { ...(fresh?.credentials ?? {}), webhookSecret: hook.signing_secret },
          metadata: {
            ...((fresh?.metadata ?? {}) as Record<string, unknown>),
            webhookId: hook.id ?? null,
            webhookEndpoint: endpoint,
          },
        });
      }
    } catch {
      /* webhook pode já existir — segue */
    }
  }

  const origin = `https://${DOMAIN}`;
  const theme = sanitizeTheme(
    {
      logoUrl: `${origin}/lp/vilaris/assets/vilaris-logo-branco.png`,
      logoWidth: 160,
      headerAlign: "center",
      headerBg: "#354a5c",
      colors: {
        accent: "#435f76",
        buttonText: "#ffffff",
        background: "#f4f6f8",
        card: "#ffffff",
        text: "#1f2a33",
        muted: "#6b7c8a",
      },
      font: "helvetica",
      buttonRadius: 5,
      buttonUppercase: false,
      couponStyle: "solid",
      signature: { name: "Equipe Vilaris", role: "Gestão e estratégia", photoUrl: null },
      footer: {
        address: "Vilaris · Gestão e Estratégia · contato@vilarisgestao.com.br",
        legal: "Você recebe este e-mail porque pediu contato com a Vilaris.",
        socials: { site: origin, instagram: "https://www.instagram.com/vilarisgestao/" },
      },
      tone: "proximo",
    },
    defaultTheme({ logoUrl: null, primaryColor: "#354a5c", storeName: "Vilaris" }),
  );
  const themeJson = JSON.parse(JSON.stringify(theme)) as Prisma.InputJsonValue;
  const now = new Date();
  await prisma.emailTheme.upsert({
    where: { clienteId: cliente.id },
    create: { clienteId: cliente.id, draft: themeJson, published: themeJson, publishedAt: now, draftUpdatedAt: now },
    update: { draft: themeJson, published: themeJson, publishedAt: now, draftUpdatedAt: now },
  });

  const settings = await prisma.workspaceSettings.findUnique({
    where: { clienteId: cliente.id },
    select: { messagingPrefs: true },
  });
  const mp = (settings?.messagingPrefs ?? {}) as Record<string, unknown>;
  await prisma.workspaceSettings.update({
    where: { clienteId: cliente.id },
    data: {
      messagingPrefs: {
        ...mp,
        senderName: FROM_NAME,
        storeUrl: origin,
        footerAddress: "Vilaris · Gestão e Estratégia · contato@vilarisgestao.com.br",
        legalText: "Você recebe este e-mail porque pediu contato com a Vilaris.",
        socials: { site: origin, instagram: "https://www.instagram.com/vilarisgestao/" },
      } as Prisma.InputJsonValue,
    },
  });

  const flows = await ensureVilarisConsultoriaFlows(cliente.id);
  await prisma.messageFlow.updateMany({
    where: { clienteId: cliente.id, key: "lead_welcome", status: "ACTIVE" },
    data: { status: "PAUSED" },
  });

  const records = (refreshed.records || detail.records || []).map((r) => ({
    type: r.type,
    name: r.name,
    value: r.value,
    status: r.status,
  }));

  console.log(
    JSON.stringify(
      {
        workspace: cliente.id,
        fromEmail,
        fromName: FROM_NAME,
        domain: DOMAIN,
        domainId: domain.id,
        domainStatus: status,
        verified,
        dnsRecords: records,
        flowsCreated: flows.created,
        next: verified
          ? "Resend pronto. Cadência consultoria ativa."
          : "Adicione os registros DNS no provedor do domínio e rode de novo com --verify.",
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
