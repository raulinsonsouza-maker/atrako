import "server-only";
import { prisma } from "@/lib/db";
import { LP_DOMAINS } from "@/lib/lp-domains";
import { resolveLogoOnDark } from "@/lib/brand/logo";
import type { LpHostBrand } from "@/components/layout/LpHostContext";

/** Marca do domínio próprio do cliente (login e área `/crm`); null fora deles. */
export async function lpHostBrand(host: string): Promise<LpHostBrand | null> {
  const lp = LP_DOMAINS[host];
  if (!lp) return null;
  const cliente = await prisma.cliente
    .findFirst({
      where: { slug: lp.workspaceSlug },
      select: { nome: true, workspaceSettings: { select: { logoOnDarkUrl: true } } },
    })
    .catch(() => null);
  return {
    name: cliente?.nome || lp.name,
    logoOnDark: resolveLogoOnDark(cliente?.workspaceSettings?.logoOnDarkUrl, lp.workspaceSlug),
  };
}
