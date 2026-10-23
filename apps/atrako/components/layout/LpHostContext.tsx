"use client";

import { createContext, useContext } from "react";

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

/** Base da área de atendimento: `/crm` no domínio do cliente, `/atendimento` no Atrako. */
export function useAtendimentoBase() {
  return useLpHost() ? "/crm" : "/atendimento";
}
