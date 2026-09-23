import "server-only";

import { prisma } from "@/lib/db";
import { isValidMetaAdsetId } from "@/lib/meta/adsetId";

export async function clientOwnsMetaAdset(clienteId: string, adsetId: string) {
  if (!isValidMetaAdsetId(adsetId)) return false;

  const matchingAd = await prisma.metaAdsCriativo.findFirst({
    where: {
      clienteId,
      adsetId,
      cliente: { ativo: true },
    },
    select: { id: true },
  });

  return Boolean(matchingAd);
}