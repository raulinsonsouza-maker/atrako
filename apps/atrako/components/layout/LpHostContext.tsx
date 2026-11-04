"use client";

import { createContext, useContext } from "react";
import { usePathname } from "next/navigation";
import { matchLpPathArea, matchLpPathAreaFromNext } from "@/lib/lp-path-areas";

export type LpHostBrand = { name: string; logoOnDark: string | null };

/** Marca quando a página é servida no domínio de um cliente (lib/lp-domains.ts); null no Atrako. */
const LpHostContext = createContext<LpHostBrand | null>(null);

export const LpHostProvider = LpHostContext.Provider;

export function useLpBrand() {
  return useContext(LpHostContext)?.name ?? null;
}

/** Logo claro do cliente, para fundos escuros ou de cor. */
export function useLpLogoOnDark() {
  return useContext(LpHostContext)?.logoOnDark ?? null;
}

export function useLpHost() {
  return useContext(LpHostContext) !== null;
}

/**
 * Base da área de atendimento:
 * - path area (ex. `/vilaris/crm`) no host Atrako
 * - `/crm` no domínio LP do cliente
 * - `/atendimento` no SaaS Atrako
 */
export function useAtendimentoBase() {
  const pathname = usePathname();
  const lpCtx = useContext(LpHostContext);
  const pathArea = matchLpPathArea(pathname);
  if (pathArea) return pathArea.prefix;
  return lpCtx !== null ? "/crm" : "/atendimento";
}

/** Brand efetiva: host LP (server) ou path area (client). */
export function resolveLpBrand(
  hostBrand: LpHostBrand | null | undefined,
  pathname: string | null | undefined,
): LpHostBrand | null {
  if (hostBrand) return hostBrand;
  const area = matchLpPathArea(pathname);
  if (!area) return null;
  return { name: area.name, logoOnDark: area.logoOnDark };
}

/** Brand a partir do `next` do sign-in (path area sem estar ainda na URL da área). */
export function brandFromNextParam(next: string | null | undefined): LpHostBrand | null {
  const area = matchLpPathAreaFromNext(next);
  if (!area) return null;
  return { name: area.name, logoOnDark: area.logoOnDark };
}

export function areaBaseFromNextParam(next: string | null | undefined): string | null {
  return matchLpPathAreaFromNext(next)?.prefix ?? null;
}
