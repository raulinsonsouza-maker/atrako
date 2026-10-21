"use client";

import { createContext, useContext } from "react";

/** Nome da marca quando a página é servida no domínio de um cliente (lib/lp-domains.ts); null no Atrako. */
const LpHostContext = createContext<string | null>(null);

export const LpHostProvider = LpHostContext.Provider;

export function useLpBrand() {
  return useContext(LpHostContext);
}

export function useLpHost() {
  return useLpBrand() !== null;
}

/** Base da área de atendimento: `/crm` no domínio do cliente, `/atendimento` no Atrako. */
export function useAtendimentoBase() {
  return useLpHost() ? "/crm" : "/atendimento";
}
