import "server-only";
import { prisma } from "@/lib/db";

const cache = new Map<string, { id: string | null; at: number }>();

/** `Cliente.id` do workspace dono do domínio (cache de 10 min por processo). */
export async function lpDomainWorkspaceId(slug: string): Promise<string | null> {
  const hit = cache.get(slug);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.id;
  const row = await prisma.cliente.findFirst({ where: { slug }, select: { id: true } }).catch(() => null);
  cache.set(slug, { id: row?.id ?? null, at: Date.now() });
  return row?.id ?? null;
}
