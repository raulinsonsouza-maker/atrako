/**
 * Cria usuário SUPER_ADMIN admin@admin.com com senha "admin".
 * Uso: node scripts/create-admin.mjs
 *      (DATABASE_URL no .env ou no ambiente)
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// Carrega .env se existir (sem dependência de dotenv)
const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

import { hashPassword } from "better-auth/crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.EMAIL?.trim() || "admin@admin.com";
  const password = process.env.PASSWORD || "admin";
  const name = process.env.NAME?.trim() || "Admin";

  const existing = await prisma.user.findFirst({
    where: { tenantId: null, email },
  });
  if (existing) {
    console.error("Já existe um SUPER_ADMIN com este e-mail:", email);
    process.exit(1);
  }

  const hashed = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email,
      name,
      tenantId: null,
      role: "SUPER_ADMIN",
    },
  });
  await prisma.account.create({
    data: {
      userId: user.id,
      accountId: user.id,
      providerId: "credential",
      password: hashed,
    },
  });
  console.log("SUPER_ADMIN criado:", email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
