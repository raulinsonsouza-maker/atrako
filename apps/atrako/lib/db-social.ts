/**
 * Prisma do domínio Social (schema PostgreSQL `symbius`).
 * Separado do Prisma principal do Atrako (`public`) até cutover total de modelos Ig*.
 */
import { PrismaClient } from "@/lib/generated/social-prisma";

const globalForSocial = globalThis as unknown as { socialPrisma?: PrismaClient };

export const prisma =
  globalForSocial.socialPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForSocial.socialPrisma = prisma;
