import { prisma } from "@/lib/db-social";

const ORG_SLUG = "atrako-social-atrako"; // embed org slug prefix

async function main() {
  const org = await prisma.organization.findFirst({
    where: { slug: { startsWith: "atrako-social-" } },
    orderBy: { createdAt: "asc" },
  });
  if (!org) {
    console.error("Org embed Social não encontrada. Rode o app ao menos uma vez.");
    process.exit(1);
  }
  const orgId = org.id;
  console.log("Org:", orgId, org.slug);

  const igAccount = await prisma.igAccount.findFirst({ where: { organizationId: orgId } });
  const igAccountId = igAccount?.id ?? null;

  const seeds = [
    {
      nome: "Boas-vindas por comentário",
      triggerType: "comment_keyword",
      triggerConfig: { keywords: ["quero", "link", "preço", "preco"], matchMode: "contains" },
      template: "comment_dm" as const,
      messageText:
        "Olá! 👋 Obrigado pelo interesse.\n\nClique abaixo e te envio o link em um segundo ✨",
    },
    {
      nome: "Resposta a Story",
      triggerType: "story_reply",
      triggerConfig: {},
      template: "story_dm" as const,
      messageText: "Obrigado por responder nossa Story! 😊 Como posso ajudar?",
    },
  ];

  for (const s of seeds) {
    const exists = await prisma.igFluxo.findFirst({
      where: { organizationId: orgId, nome: s.nome },
    });
    if (exists) {
      console.log("Já existe:", s.nome, "→ skip");
      continue;
    }
    const fluxo = await prisma.igFluxo.create({
      data: {
        organizationId: orgId,
        igAccountId,
        nome: s.nome,
        status: "PUBLISHED",
        triggerType: s.triggerType,
        triggerConfig: s.triggerConfig as object,
        fluxoKind: "automation",
      },
    });
    console.log("Criado:", fluxo.id, s.nome);
  }
  console.log("Seed concluído.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());