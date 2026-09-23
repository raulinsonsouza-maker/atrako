/**
 * Setup script: configures Social Media Only clients (Bild Piracicaba & Vitta Piracicaba).
 *
 * These clients have perfilPanel = "social-media" which renders only the SocialMediaPanel
 * (no Geral/Meta/Google/CRM tabs). They are tracked exclusively via organic Instagram insights.
 *
 * Run: npx tsx scripts/setup-social-media-clients.ts
 */

import { PrismaClient } from "../lib/generated/prisma";
import { slugify } from "../lib/admin/slugify";

const prisma = new PrismaClient();

const SOCIAL_MEDIA_CLIENTS = [
  {
    nome: "Bild Piracicaba",
    instagramBusinessAccountId: "17841447522197193",
  },
  {
    nome: "Vitta Piracicaba",
    instagramBusinessAccountId: "17841424093365910",
  },
];

async function main() {
  for (const cfg of SOCIAL_MEDIA_CLIENTS) {
    const slug = slugify(cfg.nome);

    const existing = await prisma.cliente.findFirst({
      where: { OR: [{ nome: cfg.nome }, { slug }] },
      include: { contas: true },
    });

    let clienteId: string;

    if (existing) {
      console.log(`[SKIP] Cliente já existe: ${cfg.nome} (id=${existing.id})`);

      // Ensure perfilPanel and socialMediaAtivo are correct
      if (existing.perfilPanel !== "social-media" || !existing.socialMediaAtivo) {
        await prisma.cliente.update({
          where: { id: existing.id },
          data: { perfilPanel: "social-media", socialMediaAtivo: true },
        });
        console.log(`  → perfilPanel e socialMediaAtivo atualizados`);
      }

      clienteId = existing.id;
    } else {
      const created = await prisma.cliente.create({
        data: {
          nome: cfg.nome,
          slug,
          ativo: true,
          perfilPanel: "social-media",
          socialMediaAtivo: true,
          leadScoringEnabled: false,
        },
      });
      console.log(`[CREATE] ${cfg.nome} criado (id=${created.id})`);
      clienteId = created.id;
    }

    // Upsert INSTAGRAM conta
    const igConta = await prisma.conta.findFirst({
      where: { clienteId, plataforma: "INSTAGRAM" },
    });

    if (igConta) {
      if (igConta.accountIdPlataforma !== cfg.instagramBusinessAccountId) {
        await prisma.conta.update({
          where: { id: igConta.id },
          data: { accountIdPlataforma: cfg.instagramBusinessAccountId },
        });
        console.log(`  → INSTAGRAM accountId atualizado para ${cfg.instagramBusinessAccountId}`);
      } else {
        console.log(`  → INSTAGRAM accountId já correto: ${cfg.instagramBusinessAccountId}`);
      }
    } else {
      await prisma.conta.create({
        data: {
          clienteId,
          plataforma: "INSTAGRAM",
          accountIdPlataforma: cfg.instagramBusinessAccountId,
          nomeConta: cfg.nome,
        },
      });
      console.log(`  → INSTAGRAM conta criada com accountId ${cfg.instagramBusinessAccountId}`);
    }
  }

  console.log("\nDone.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
