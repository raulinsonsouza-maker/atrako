/**
 * Cria o primeiro usuário SUPER_ADMIN (tenantId=null).
 * Uso: EMAIL=admin@exemplo.com PASSWORD=senha123 NAME="Admin" npx tsx scripts/create-super-admin.ts
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// Carrega .env se existir
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
  const email = process.env.EMAIL?.trim();
  const password = process.env.PASSWORD;
  const name = process.env.NAME?.trim() || "Super Admin";
  const allowShort = process.env.ALLOW_SHORT_PASSWORD === "1";
  const minLen = allowShort ? 1 : 8;
  if (!email || !password || password.length < minLen) {
    console.error(
      allowShort
        ? "Use: EMAIL=... PASSWORD=... [NAME=...] ALLOW_SHORT_PASSWORD=1 npx tsx scripts/create-super-admin.ts"
        : "Use: EMAIL=... PASSWORD=... (mín. 8) [NAME=...] npx tsx scripts/create-super-admin.ts"
    );
    process.exit(1);
  }

  const existing = await prisma.user.findFirst({
    where: { tenantId: null, email },
  });
  if (existing) {
    console.error("Já existe um SUPER_ADMIN com este e-mail.");
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
