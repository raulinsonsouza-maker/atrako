/**
 * Identidade de e-mail da Vilaris: tema (#354a5c / #435f76 + logo branco da LP),
 * remetente/rodapé e destinatários do aviso de lead novo. Idempotente.
 *
 * Uso:
 *   npx tsx apps/atrako/scripts/setup-vilaris-email.ts [--slug=vilaris] [--origin=https://vilarisgestao.com.br]
 */

import { prisma } from "../lib/db";
import { Prisma } from "../lib/generated/prisma";
import { sanitizeTheme, defaultTheme } from "../lib/flows/theme";

const LEAD_EMAILS = ["bruno@symbius.com.br", "raul@symbius.com.br", "vilanovacarneirogui@gmail.com"];
const FOOTER_ADDRESS = "Vilaris · Mentoria de carreira e consultoria financeira";
const LEGAL = "Você recebe este e-mail porque pediu contato com a Vilaris.";
const SOCIALS = {
  instagram: "https://www.instagram.com/vilarisgestao/",
  site: "https://vilarisgestao.com.br/",
};

async function main() {
  const args = process.argv.slice(2);
  const idArg = args.find((a) => a.startsWith("--id="))?.slice(5);
  const slugArg = args.find((a) => a.startsWith("--slug="))?.slice(7) || "vilaris";
  const origin = (
    args.find((a) => a.startsWith("--origin="))?.slice(9) || "https://vilarisgestao.com.br"
  ).replace(/\/$/, "");

  const cliente = idArg
    ? await prisma.cliente.findUnique({ where: { id: idArg }, select: { id: true, nome: true } })
    : await prisma.cliente.findFirst({ where: { slug: slugArg }, select: { id: true, nome: true } });
  if (!cliente) throw new Error(`Workspace não encontrado (${idArg ?? slugArg})`);

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
      signature: { name: "Equipe Vilaris", role: "Mentoria e consultoria", photoUrl: null },
      footer: { address: FOOTER_ADDRESS, legal: LEGAL, socials: SOCIALS },
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
    select: { messagingPrefs: true, notifyPrefs: true, primaryColor: true, logoOnDarkUrl: true },
  });
  if (!settings) throw new Error("WorkspaceSettings ausente");

  const mp = (settings.messagingPrefs ?? {}) as Record<string, unknown>;
  const np = (settings.notifyPrefs ?? {}) as Record<string, unknown>;
  const hasLeadEmails = Array.isArray(np.leadEmails) && np.leadEmails.length > 0;

  await prisma.workspaceSettings.update({
    where: { clienteId: cliente.id },
    data: {
      primaryColor: settings.primaryColor || "#354a5c",
      logoOnDarkUrl: settings.logoOnDarkUrl || "/lp/vilaris/assets/vilaris-logo-branco.png",
      messagingPrefs: {
        ...mp,
        senderName: "Vilaris",
        storeUrl: origin,
        footerAddress: FOOTER_ADDRESS,
        legalText: LEGAL,
        socials: SOCIALS,
      } as Prisma.InputJsonValue,
      ...(hasLeadEmails ? {} : { notifyPrefs: { ...np, leadEmails: LEAD_EMAILS } as Prisma.InputJsonValue }),
    },
  });

  await prisma.cliente.update({
    where: { id: cliente.id },
    data: { logoUrl: `${origin}/lp/vilaris/assets/vilaris-logo.png` },
  });

  console.log(
    JSON.stringify(
      {
        workspace: cliente.id,
        nome: cliente.nome,
        theme: "published",
        logo: theme.logoUrl,
        leadEmails: hasLeadEmails ? np.leadEmails : LEAD_EMAILS,
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
