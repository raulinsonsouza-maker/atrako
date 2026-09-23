/**
 * Verifica tabelas e contagem de registros no banco.
 * Uso: node scripts/check-db.mjs
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Tabelas no schema public ===\n");

  const tables = await prisma.$queryRaw`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;
  console.log("Tabelas:", tables.map((t) => t.table_name).join(", "));
  console.log("Total:", tables.length, "tabelas\n");

  console.log("=== Contagem de registros (modelos Prisma) ===\n");

  const models = [
    "tenant",
    "user",
    "account",
    "session",
    "invite",
    "verification",
    "pipeline",
    "leadStage",
    "lead",
    "activity",
    "integration",
    "campaign",
    "conversation",
    "message",
    "auditLog",
  ];

  for (const m of models) {
    try {
      const n = await prisma[m].count();
      console.log(`  ${m.padEnd(14)} ${n}`);
    } catch (e) {
      console.log(`  ${m.padEnd(14)} (erro: ${e.message})`);
    }
  }

  console.log("\n=== SUPER_ADMIN (User + Account) ===\n");
  const admin = await prisma.user.findFirst({
    where: { tenantId: null, role: "SUPER_ADMIN" },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
  if (admin) {
    console.log("  User:", admin);
    const acc = await prisma.account.findFirst({
      where: { userId: admin.id },
      select: { providerId: true },
    });
    console.log("  Account:", acc ? `providerId=${acc.providerId}` : "—");
  } else {
    console.log("  Nenhum SUPER_ADMIN encontrado.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
