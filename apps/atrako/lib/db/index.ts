import { PrismaClient } from "@/lib/generated/prisma";

/** Bump ao adicionar campos/models — força recriar o singleton HMR em dev. */
const PRISMA_SCHEMA_REV = 8;

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaSchemaRev?: number;
};

function createPrisma() {
  return new PrismaClient({
    log: ["error"],
  });
}

function needsRefresh(client: PrismaClient | undefined) {
  if (!client) return true;
  if (globalForPrisma.prismaSchemaRev !== PRISMA_SCHEMA_REV) return true;
  // Dev HMR: se o schema ganhou models novos (ex.: CommerceStore), o singleton
  // antigo em globalThis fica sem o delegate até recriar.
  const asAny = client as unknown as { commerceStore?: { findUnique?: unknown } };
  return typeof asAny.commerceStore?.findUnique !== "function";
}

export const prisma = (() => {
  if (needsRefresh(globalForPrisma.prisma)) {
    void globalForPrisma.prisma?.$disconnect().catch(() => null);
    globalForPrisma.prisma = createPrisma();
    globalForPrisma.prismaSchemaRev = PRISMA_SCHEMA_REV;
  }
  return globalForPrisma.prisma!;
})();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
