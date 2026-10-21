/**
 * Identidade de e-mail da Regicenter: tema (navy/ciano + logo branco da LP), remetente/rodapé,
 * destinatários do aviso de lead novo e fluxo de nutrição da franquia. Idempotente.
 *
 * Uso:
 *   npx tsx apps/atrako/scripts/setup-regicenter-email.ts [--slug=regicenter] [--id=xxx] [--origin=https://lp.regicenter.com]
 */

import { prisma } from "../lib/db";
import { Prisma } from "../lib/generated/prisma";
import { sanitizeTheme, defaultTheme } from "../lib/flows/theme";
import { ensureFranchiseFlows } from "../lib/flows/playbooks-franchise";

const LEAD_EMAILS = ["contato@regicenter.com", "raul@symbius.com.br"];
const FOOTER_ADDRESS = "Regicenter Marcas & Patentes · 0800 789 0007 · contato@regicenter.com";
const LEGAL = "Você recebe este e-mail porque pediu informações sobre a franquia Regicenter.";
const SOCIALS = {
  instagram: "https://www.instagram.com/regicenter/",
  facebook: "https://www.facebook.com/franquiaregicenter",
  site: "https://regicenter.com/",
};

async function main() {
  const args = process.argv.slice(2);
  const idArg = args.find((a) => a.startsWith("--id="))?.slice(5);
  const slugArg = args.find((a) => a.startsWith("--slug="))?.slice(7) || "regicenter";
  const origin = (args.find((a) => a.startsWith("--origin="))?.slice(9) || "https://lp.regicenter.com").replace(/\/$/, "");

  const cliente = idArg
    ? await prisma.cliente.findUnique({ where: { id: idArg }, select: { id: true, nome: true } })
    : await prisma.cliente.findFirst({ where: { slug: slugArg }, select: { id: true, nome: true } });
  if (!cliente) throw new Error(`Workspace não encontrado (${idArg ?? slugArg})`);

  const theme = sanitizeTheme(
    {
      logoUrl: `${origin}/lp/regicenter-franquia/assets/regicenter-logo-branco.png`,
      logoWidth: 180,
      headerAlign: "center",
      headerBg: "#03112f",
      colors: {
        accent: "#12c0de",
        buttonText: "#03112f",
        background: "#f1f4f8",
        card: "#ffffff",
        text: "#10213c",
        muted: "#58677c",
      },
      font: "helvetica",
      buttonRadius: 6,
      buttonUppercase: false,
      couponStyle: "solid",
      signature: { name: "Equipe de Expansão Regicenter", role: "Regicenter Marcas & Patentes", photoUrl: null },
      footer: { address: FOOTER_ADDRESS, legal: LEGAL, socials: SOCIALS },
      tone: "proximo",
    },
    defaultTheme({ logoUrl: null, primaryColor: null, storeName: "Regicenter" }),
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
    select: { messagingPrefs: true, notifyPrefs: true },
  });
  if (!settings) throw new Error("WorkspaceSettings ausente — rode seed-regicenter-qualify antes");
  const mp = (settings.messagingPrefs ?? {}) as Record<string, unknown>;
  const np = (settings.notifyPrefs ?? {}) as Record<string, unknown>;
  const hasLeadEmails = Array.isArray(np.leadEmails) && np.leadEmails.length > 0;
  await prisma.workspaceSettings.update({
    where: { clienteId: cliente.id },
    data: {
      messagingPrefs: {
        ...mp,
        senderName: "Regicenter",
        storeUrl: origin,
        footerAddress: FOOTER_ADDRESS,
        legalText: LEGAL,
        socials: SOCIALS,
      } as Prisma.InputJsonValue,
      ...(hasLeadEmails ? {} : { notifyPrefs: { ...np, leadEmails: LEAD_EMAILS } as Prisma.InputJsonValue }),
    },
  });

  const flows = await ensureFranchiseFlows(cliente.id);
  // O D0 da nutrição substitui as boas-vindas genéricas (evita dois e-mails no cadastro)
  const welcomePaused = await prisma.messageFlow.updateMany({
    where: { clienteId: cliente.id, key: "lead_welcome", status: "ACTIVE" },
    data: { status: "PAUSED" },
  });
  const nurture = await prisma.messageFlow.findFirst({
    where: { clienteId: cliente.id, key: "franchise_nurture" },
    select: { status: true, _count: { select: { steps: true } } },
  });

  console.log(
    JSON.stringify(
      {
        workspace: cliente.id,
        nome: cliente.nome,
        theme: "published",
        leadEmails: hasLeadEmails ? np.leadEmails : LEAD_EMAILS,
        flowsCreated: flows.created,
        welcomePaused: welcomePaused.count,
        nurture,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
