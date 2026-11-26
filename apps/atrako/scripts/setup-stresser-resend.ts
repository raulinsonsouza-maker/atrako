/**
 * Conecta o Resend da Stresser: domínio de envio (SPF/DKIM) + remetente.
 * Não precisa ser o host da LP — só o domínio verificado no Resend.
 * Não imprime a API key.
 *
 * Uso (API key só via env):
 *   RESEND_API_KEY=re_… npx tsx apps/atrako/scripts/setup-stresser-resend.ts
 *   RESEND_API_KEY=re_… npx tsx apps/atrako/scripts/setup-stresser-resend.ts --verify
 *
 * Depois: Config → Conexões (Resend ACTIVE) + DNS do domínio no provedor.
 * Flows order_paid (paid.thanks) e order_unpaid ficam prontos; sem DNS verificado não disparam.
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
import { ensureDefaultFlows } from "../lib/flows/playbooks";
import { sanitizeTheme, defaultTheme } from "../lib/flows/theme";

const DOMAIN = process.env.STRESSER_RESEND_DOMAIN?.trim() || "stressercolchoes.com.br";
const FROM_LOCAL = process.env.STRESSER_RESEND_FROM_LOCAL?.trim() || "pedidos";
const FROM_NAME = process.env.STRESSER_RESEND_FROM_NAME?.trim() || "Stresser Colchões";
const WEBHOOK_BASE = process.env.APP_URL?.replace(/\/$/, "") || "https://atrako.com.br";
const SLUG = "stresser";

async function main() {
  const apiKey = process.env.RESEND_API_KEY?.trim() || "";
  if (!apiKey.startsWith("re_")) throw new Error("Defina RESEND_API_KEY=re_…");
  const doVerify = process.argv.includes("--verify");

  const cliente = await prisma.cliente.findFirst({
    where: { slug: SLUG },
    select: { id: true, nome: true },
  });
  if (!cliente) throw new Error(`Workspace ${SLUG} não encontrado`);

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
      /* webhook pode já existir */
    }
  }

  const origin = `https://${DOMAIN}`;
  const theme = sanitizeTheme(
    {
      logoUrl: `${origin}/lp/stresser/assets/logo.webp`,
      logoWidth: 140,
      headerAlign: "center",
      headerBg: "#162538",
      colors: {
        accent: "#3f6b1f",
        buttonText: "#ffffff",
        background: "#fbfaf7",
        card: "#ffffff",
        text: "#162538",
        muted: "#5c6b7a",
      },
      font: "helvetica",
      buttonRadius: 0,
      buttonUppercase: false,
      couponStyle: "solid",
      signature: { name: "Equipe Stresser", role: "Atendimento", photoUrl: null },
      footer: {
        address: `Stresser Colchões · ${fromEmail}`,
        legal: "Você recebe este e-mail porque iniciou ou concluiu uma compra na Stresser.",
        socials: { site: origin },
      },
      tone: "proximo",
    },
    defaultTheme({ logoUrl: null, primaryColor: "#3f6b1f", storeName: "Stresser Colchões" }),
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
        footerAddress: `Stresser Colchões · ${fromEmail}`,
        legalText: "Você recebe este e-mail porque iniciou ou concluiu uma compra na Stresser.",
        socials: { site: origin },
      } as Prisma.InputJsonValue,
    },
  });

  const flows = await ensureDefaultFlows(cliente.id);

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
          ? "Resend pronto. paid.thanks + order_unpaid ativos quando o domínio estiver verified."
          : "Adicione os registros DNS no provedor do domínio e rode de novo com --verify. Até lá os flows ficam prontos mas não disparam.",
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
